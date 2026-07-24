import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { applySessionScopeDefaults, resolveCommunicationSender } from "@/lib/communication-center/communication-center-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const messageSchema = z.object({
  channel: z.enum(["email", "whatsapp", "internal", "notification"]).default("email"),
  folder: z.enum(["draft", "sent", "scheduled"]).default("sent"),
  to: z.string().trim().min(1).max(500),
  cc: z.string().trim().max(500).optional(),
  bcc: z.string().trim().max(500).optional(),
  subject: z.string().trim().max(300).optional(),
  body: z.string().trim().min(1).max(20000),
  countryId: z.string().uuid().or(z.literal("")).nullable().optional(),
  countryBranchId: z.string().uuid().or(z.literal("")).nullable().optional(),
  cityBranchId: z.string().uuid().or(z.literal("")).nullable().optional(),
  linkedModule: z.string().trim().max(80).optional(),
  linkedDocumentNo: z.string().trim().max(100).optional(),
  linkedRoute: z.string().trim().max(255).optional(),
  attachments: z.array(z.record(z.unknown())).optional()
});

function clean(value: string | null | undefined) {
  return value && value !== "all" ? value : null;
}

function applyScope(query: any, scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }) {
  if (scope.countryId) query = query.eq("country_id", scope.countryId);
  if (scope.countryBranchId) query = query.eq("country_branch_id", scope.countryBranchId);
  if (scope.cityBranchId) query = query.eq("city_branch_id", scope.cityBranchId);
  return query;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient() as any;
    const { searchParams } = new URL(req.url);
    const scope = applySessionScopeDefaults(session, {
      countryId: clean(searchParams.get("countryId")),
      countryBranchId: clean(searchParams.get("countryBranchId")),
      cityBranchId: clean(searchParams.get("cityBranchId"))
    });

    let query = admin
      .from("communication_center_messages")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Number(searchParams.get("limit") ?? 50));
    query = applyScope(query, scope);
    const { data, error } = await query;
    if (error) throw error;

    return apiOk({ messages: data ?? [], scope });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient() as any;
    const body = messageSchema.parse(await req.json());
    const scope = applySessionScopeDefaults(session, {
      countryId: clean(body.countryId),
      countryBranchId: clean(body.countryBranchId),
      cityBranchId: clean(body.cityBranchId)
    });
    const sender = await resolveCommunicationSender(admin, scope);

    const { data, error } = await admin
      .from("communication_center_messages")
      .insert({
        channel: body.channel,
        direction: "outgoing",
        folder: body.folder,
        profile_id: sender.profileId,
        country_id: scope.countryId,
        country_branch_id: scope.countryBranchId,
        city_branch_id: scope.cityBranchId,
        sender_user_id: session.userId,
        sender_name: sender.fromName,
        sender_email: sender.fromEmail,
        sender_whatsapp: sender.whatsappNumber,
        recipient_to: body.to,
        recipient_cc: body.cc ?? "",
        recipient_bcc: body.bcc ?? "",
        subject: body.subject ?? (body.channel === "whatsapp" ? "WhatsApp Message" : "ERP Communication"),
        body: `${body.body.trim()}\n\n--\n${sender.signatureText}`.trim(),
        attachments: body.attachments ?? [],
        linked_module: body.linkedModule ?? null,
        linked_document_no: body.linkedDocumentNo ?? null,
        linked_route: body.linkedRoute ?? null,
        delivery_status: body.folder === "draft" ? "draft" : "logged",
        sender_snapshot: sender,
        sent_at: body.folder === "sent" ? new Date().toISOString() : null
      })
      .select("*")
      .single();

    if (error) throw error;
    return apiCreated({ message: data, sender });
  } catch (error) {
    return handleApiError(error);
  }
}
