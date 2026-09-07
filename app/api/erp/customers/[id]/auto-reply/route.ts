import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError, ApiClientError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateErp } from "@/lib/i18n/erp-translator";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import {
  AUTO_REPLY_TEMPLATES,
  AUTO_REPLY_LANGS,
  getAutoReplyTemplate,
  fillPlaceholders,
} from "@/lib/customers/auto-reply-templates";
import { sendCustomerReply, type ReplyChannel } from "@/lib/customers/send-customer-reply";

export const dynamic = "force-dynamic";

const RTL_LANGS = new Set<SupportedLanguage>(["ur", "ps", "fa", "ar"]);

function normLang(v: unknown): SupportedLanguage {
  const s = String(v ?? "").toLowerCase();
  return (AUTO_REPLY_LANGS as string[]).includes(s) ? (s as SupportedLanguage) : "en";
}

type CustomerCtx = {
  id: string;
  customer_name: string | null;
  company_name: string | null;
  email: string | null;
  whatsapp: string | null;
  mobile: string | null;
  country_id: string | null;
  original_language_code: string | null;
  preferred_reply_language: string | null;
};

async function loadCustomer(admin: ReturnType<typeof createSupabaseAdminClient>, id: string): Promise<CustomerCtx> {
  // `preferred_reply_language` was added by migration 20261112; generated types may lag.
  const { data, error } = await (admin.from("customers") as any)
    .select(
      "id, customer_name, company_name, email, whatsapp, mobile, country_id, original_language_code, preferred_reply_language",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new ApiClientError(error.message);
  if (!data) throw new ApiClientError("Customer not found", { status: 404, code: "NOT_FOUND" });
  return data as unknown as CustomerCtx;
}

function placeholderValues(c: CustomerCtx, session: { fullName: string | null; email: string | null }, extra: Record<string, string>) {
  return {
    customer_name: c.customer_name || c.company_name || "Customer",
    company_name: c.company_name || "our company",
    sender_name: session.fullName || session.email || "Digital Dock ERP",
    branch_name: "",
    date: new Date().toISOString().slice(0, 10),
    invoice_no: "",
    order_no: "",
    amount: "",
    currency: "",
    due_date: "",
    reference: "",
    ...extra,
  };
}

/* ------------------------------------------------------------------ GET ---- */
/** Reply history + available templates + customer contact context. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    authorizeApiScope(session, {
      resource: "customers",
      action: "read",
      countryId: request.nextUrl.searchParams.get("countryId"),
    });

    const admin = createSupabaseAdminClient();
    const customer = await loadCustomer(admin, id);

    const { data: rows } = await (admin.from("communication_messages") as any)
      .select(
        "id, subject, body, channel, status, error_reason, reply_language, ai_generated_reply, edited_reply, sent_by, sent_at, created_at",
      )
      .eq("customer_id", id)
      .eq("direction", "outgoing")
      .order("created_at", { ascending: false })
      .limit(100);

    const senderIds: string[] = [
      ...new Set(
        ((rows ?? []) as any[])
          .map((r) => r.sent_by)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    ];
    const nameById = new Map<string, string>();
    if (senderIds.length > 0) {
      const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", senderIds);
      for (const p of profs ?? []) nameById.set((p as any).id, (p as any).full_name || "");
    }

    const replies = (rows ?? []).map((r: any) => ({
      id: r.id,
      subject: r.subject,
      body: r.body,
      channel: r.channel,
      status: r.status,
      detail: r.error_reason,
      language: r.reply_language,
      wasEdited: Boolean(r.ai_generated_reply && r.edited_reply && r.ai_generated_reply !== r.edited_reply),
      sentByName: r.sent_by ? nameById.get(r.sent_by) || "—" : "—",
      sentAt: r.sent_at,
      createdAt: r.created_at,
    }));

    const defaultLang = normLang(customer.preferred_reply_language || customer.original_language_code || "en");

    return apiOk({
      customer: {
        id: customer.id,
        name: customer.customer_name || customer.company_name,
        email: customer.email,
        whatsapp: customer.whatsapp || customer.mobile,
        defaultLanguage: defaultLang,
      },
      templates: AUTO_REPLY_TEMPLATES.map((t) => ({
        code: t.code,
        title: t.title,
        category: t.category,
        subject: t.subject,
        body: t.body,
      })),
      replies,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/* ----------------------------------------------------------------- POST ---- */
const draftSchema = z.object({
  action: z.literal("draft"),
  targetLang: z.string(),
  templateCode: z.string().optional(),
  sourceText: z.string().max(16000).optional(),
  sourceLang: z.string().optional(),
  fields: z.record(z.string()).optional(),
});

const sendSchema = z.object({
  action: z.literal("send"),
  channel: z.enum(["email", "whatsapp"]).default("email"),
  targetLang: z.string(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  templateCode: z.string().optional(),
  aiDraftBody: z.string().max(20000).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const raw = await request.json();

    const admin = createSupabaseAdminClient();
    const customer = await loadCustomer(admin, id);

    authorizeApiScope(session, {
      resource: "customers",
      action: raw?.action === "send" ? "update" : "read",
      countryId: customer.country_id,
    });

    /* ---- draft: build an editable draft in the target language ---- */
    if (raw?.action === "draft") {
      const p = draftSchema.parse(raw);
      const targetLang = normLang(p.targetLang);
      const values = placeholderValues(customer, session, p.fields ?? {});

      if (p.templateCode) {
        const tpl = getAutoReplyTemplate(p.templateCode);
        if (!tpl) throw new ApiClientError("Unknown template");
        return apiOk({
          subject: fillPlaceholders(tpl.subject[targetLang] || tpl.subject.en, values),
          body: fillPlaceholders(tpl.body[targetLang] || tpl.body.en, values),
          lang: targetLang,
          engine: "template",
        });
      }

      const src = (p.sourceText || "").trim();
      if (!src) throw new ApiClientError("Provide template code or source text");
      const sourceLang = normLang(p.sourceLang || "en");
      if (sourceLang === targetLang) {
        return apiOk({ subject: "", body: src, lang: targetLang, engine: "identity" });
      }
      try {
        const translated = await translateErp(src, sourceLang, { targetLang });
        return apiOk({
          subject: "",
          body: translated.text,
          lang: targetLang,
          engine: translated.engine,
          confidence: translated.confidence,
        });
      } catch {
        // Translation memory unavailable — hand back the original so the
        // operator can translate by hand rather than blocking the reply.
        return apiOk({ subject: "", body: src, lang: targetLang, engine: "unavailable" });
      }
    }

    /* ---- send: honest delivery + full audit ---- */
    const p = sendSchema.parse(raw);
    const targetLang = normLang(p.targetLang);
    const channel = p.channel as ReplyChannel;

    const delivery = await sendCustomerReply({
      channel,
      countryId: customer.country_id,
      toEmail: customer.email,
      toWhatsapp: customer.whatsapp || customer.mobile,
      subject: p.subject,
      body: p.body,
      rtl: RTL_LANGS.has(targetLang),
    });

    // upsert a conversation for this customer + channel
    const contactId =
      channel === "email" ? customer.email || "" : customer.whatsapp || customer.mobile || "";
    let conversationId: string | null = null;
    const db = admin as any;
    const { data: existingConvs } = await db
      .from("communication_conversations")
      .select("id")
      .eq("sender_type", "customer")
      .eq("sender_entity_id", customer.id)
      .eq("channel", channel)
      .order("created_at", { ascending: false })
      .limit(1);
    const existingConv = existingConvs?.[0] ?? null;
    if (existingConv?.id) {
      conversationId = existingConv.id;
      await db
        .from("communication_conversations")
        .update({
          status: delivery.status === "sent" ? "replied" : "failed",
          message_language: targetLang,
          last_message_text: p.body.slice(0, 500),
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } else {
      const { data: newConv } = await db
        .from("communication_conversations")
        .insert({
          channel,
          contact_identifier: contactId || "unknown",
          sender_name: customer.customer_name || customer.company_name || "Customer",
          sender_type: "customer",
          sender_entity_id: customer.id,
          country_id: customer.country_id,
          related_entity_type: "customer",
          related_entity_id: customer.id,
          status: delivery.status === "sent" ? "replied" : "failed",
          priority: "normal",
          message_language: targetLang,
          reply_mode: "manual",
          last_message_text: p.body.slice(0, 500),
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      conversationId = newConv?.id ?? null;
    }

    const msgStatus =
      delivery.status === "sent" ? "sent" : delivery.status === "failed" ? "failed" : "no_channel";

    const aiDraft = (p.aiDraftBody || "").trim() || null;
    const { data: msg, error: msgErr } = await db
      .from("communication_messages")
      .insert({
        conversation_id: conversationId,
        customer_id: customer.id,
        direction: "outgoing",
        channel,
        sender_identifier: delivery.fromEmail || session.email || "ERP",
        recipient_identifier: contactId || "unknown",
        subject: p.subject,
        body: p.body,
        message_category: "general",
        detected_language: targetLang,
        reply_language: targetLang,
        status: msgStatus,
        error_reason: delivery.detail,
        ai_generated_reply: aiDraft,
        edited_reply: aiDraft && aiDraft !== p.body ? p.body : null,
        sent_by: session.userId,
        sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
      })
      .select("id")
      .maybeSingle();

    if (msgErr) {
      // The reply record itself could not be written — surface it rather than
      // returning a misleading success.
      throw new ApiClientError(`Could not record the reply: ${msgErr.message}`);
    }

    try {
      await db.from("communication_audit_logs").insert({
        conversation_id: conversationId,
        message_id: msg?.id ?? null,
        customer_id: customer.id,
        user_id: session.userId,
        country_id: customer.country_id,
        action: "customer_reply.sent",
        reply_mode: "manual",
        reply_language: targetLang,
        ai_text: aiDraft,
        edited_text: p.body,
        delivery_result: delivery.status,
      });
    } catch {
      /* audit-log is best-effort; auditApiAction below is the durable trail */
    }

    await auditApiAction(request, {
      action: "customer_reply.send",
      entityTable: "customers",
      entityId: customer.id,
      after: {
        channel,
        language: targetLang,
        templateCode: p.templateCode ?? null,
        status: delivery.status,
        detail: delivery.detail,
        subject: p.subject,
      },
    });

    return apiCreated({
      replyId: msg?.id ?? null,
      status: delivery.status,
      channel: delivery.channel,
      detail: delivery.detail,
      language: targetLang,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
