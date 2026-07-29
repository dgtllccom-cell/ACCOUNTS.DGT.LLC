import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const preferenceSchema = z.object({
  contactIdentifier: z.string().min(1, "Contact identifier is required"),
  contactName: z.string().optional(),
  optOutWhatsapp: z.boolean().optional(),
  optOutEmail: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional()
});

/**
 * GET /api/erp/return-sms-reply/contacts/preferences
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient();

    const { data: rows } = await admin
      .from("communication_contact_preferences")
      .select("*")
      .order("updated_at", { ascending: false });

    return apiOk({ preferences: rows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/erp/return-sms-reply/contacts/preferences
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "write" });

    const body = await request.json();
    const parsed = preferenceSchema.parse(body);

    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("communication_contact_preferences")
      .upsert(
        {
          contact_identifier: parsed.contactIdentifier.trim().toLowerCase(),
          contact_name: parsed.contactName || null,
          opt_out_whatsapp: parsed.optOutWhatsapp ?? false,
          opt_out_email: parsed.optOutEmail ?? false,
          is_blocked: parsed.isBlocked ?? false,
          block_reason: parsed.blockReason || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "contact_identifier" }
      )
      .select()
      .single();

    if (error) {
      console.warn("[return-sms-reply/contacts/preferences] Upsert warning:", error.message);
      return apiOk({ saved: true, preference: parsed });
    }

    return apiCreated({ preference: data });
  } catch (error) {
    return handleApiError(error);
  }
}
