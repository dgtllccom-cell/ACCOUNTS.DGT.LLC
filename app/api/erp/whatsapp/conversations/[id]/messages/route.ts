import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

const sendMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    body: z.string().min(1).max(4096)
  }),
  z.object({
    type: z.literal("internal_note"),
    body: z.string().min(1).max(4096)
  }),
  z.object({
    type: z.literal("template"),
    templateName: z.string().min(1),
    templateParams: z.array(z.string()).optional(),
    language: z.string().default("en")
  }),
  z.object({
    type: z.literal("image"),
    mediaUrl: z.string().url(),
    caption: z.string().max(1024).optional()
  }),
  z.object({
    type: z.literal("document"),
    mediaUrl: z.string().url(),
    filename: z.string().min(1),
    caption: z.string().max(1024).optional()
  })
]);

const META_API_URL = "https://graph.facebook.com/v19.0";

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "whatsapp", action: "read" });

    const { id } = await params;
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 50)));
    const offset = (page - 1) * limit;

    const supabase = await createServerSupabaseClient();

    const { data: messages, error, count } = await (supabase as any)
      .from("whatsapp_messages")
      .select(`
        id, direction, message_type, status, body, template_name,
        media_url, media_mime_type, media_filename, media_size_bytes,
        location_lat, location_lng, location_name,
        external_message_id, context_message_id,
        sender_phone, sender_user_id,
        sent_at, delivered_at, read_at, failed_at, failed_reason,
        created_at,
        sender_profiles:sender_user_id(id, full_name),
        whatsapp_message_media(id, storage_path, public_url, mime_type, filename, duration_secs)
      `, { count: "exact" })
      .eq("conversation_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    return apiOk({
      messages: messages ?? [],
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "whatsapp", action: "create" });

    const { id } = await params;
    const body = sendMessageSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();

    // Load conversation + account
    const { data: conv } = await (supabase as any)
      .from("whatsapp_conversations")
      .select(`
        id, country_id, country_branch_id, city_branch_id,
        whatsapp_accounts:whatsapp_account_id(
          id, phone_number_id, access_token, waba_id
        ),
        whatsapp_contacts:contact_id(phone_number)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!conv) return apiOk({ error: "Conversation not found" });

    authorizeApiScope(session, {
      resource: "whatsapp",
      action: "create",
      countryId: conv.country_id,
      countryBranchId: conv.country_branch_id,
      cityBranchId: conv.city_branch_id
    });

    const account = conv.whatsapp_accounts;
    const toPhone = conv.whatsapp_contacts?.phone_number?.replace(/^\+/, "");

    const scopeCols = {
      conversation_id: id,
      whatsapp_account_id: account.id,
      country_id: conv.country_id,
      country_branch_id: conv.country_branch_id,
      city_branch_id: conv.city_branch_id,
      sender_user_id: session.userId
    };

    // Internal notes do not go to Meta — just saved in DB
    if (body.type === "internal_note") {
      const { data: noteMsg } = await (supabase as any)
        .from("whatsapp_messages")
        .insert({
          ...scopeCols,
          direction: "internal_note",
          message_type: "text",
          status: "sent",
          body: body.body,
          sent_at: new Date().toISOString()
        })
        .select("id")
        .single();

      // Activity log
      await (supabase as any).from("whatsapp_activity_log").insert({
        conversation_id: id,
        country_id: conv.country_id,
        city_branch_id: conv.city_branch_id,
        actor_id: session.userId,
        actor_name: session.fullName ?? session.email,
        event_type: "note_added",
        event_data: { note_preview: body.body.slice(0, 100) }
      });

      return apiCreated({ messageId: noteMsg.id });
    }

    // Build Meta API payload
    const metaPayload = buildMetaPayload(toPhone!, body);

    // Send to Meta API
    const metaResponse = await fetch(`${META_API_URL}/${account.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${account.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(metaPayload)
    });

    const metaResult = await metaResponse.json();
    if (!metaResponse.ok) {
      const errMsg = metaResult?.error?.message ?? "Meta API error";
      throw new Error(errMsg);
    }

    const wamid = metaResult.messages?.[0]?.id ?? null;

    // Save outbound message
    const { data: msg } = await (supabase as any)
      .from("whatsapp_messages")
      .insert({
        ...scopeCols,
        direction: "outbound",
        message_type: body.type === "template" ? "template" : (body.type as string),
        status: "sent",
        body: "type" in body && body.type === "text" ? body.body : null,
        template_name: body.type === "template" ? body.templateName : null,
        external_message_id: wamid,
        sent_at: new Date().toISOString()
      })
      .select("id")
      .single();

    return apiCreated({ messageId: msg.id, wamid });
  } catch (error) {
    return handleApiError(error);
  }
}

function buildMetaPayload(to: string, body: z.infer<typeof sendMessageSchema>) {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };

  if (body.type === "text") {
    return { ...base, type: "text", text: { preview_url: false, body: body.body } };
  }
  if (body.type === "template") {
    return {
      ...base,
      type: "template",
      template: {
        name: body.templateName,
        language: { code: body.language },
        components: body.templateParams?.length
          ? [{ type: "body", parameters: body.templateParams.map((t) => ({ type: "text", text: t })) }]
          : []
      }
    };
  }
  if (body.type === "image") {
    return { ...base, type: "image", image: { link: body.mediaUrl, caption: body.caption } };
  }
  if (body.type === "document") {
    return { ...base, type: "document", document: { link: body.mediaUrl, filename: body.filename, caption: body.caption } };
  }
  return base;
}
