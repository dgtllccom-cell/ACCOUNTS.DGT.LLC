import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const configSchema = z.object({
  accessToken: z.string().min(20, "Access token is required"),
  phoneNumberId: z.string().min(5, "Phone Number ID is required"),
  wabaId: z.string().optional(),
  phoneNumber: z.string().optional()
});

/**
 * POST /api/erp/admin/configure-meta
 * Validates and saves Meta WhatsApp Cloud API credentials into database as System Default Account.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return apiOk({ success: false, error: "Only Super Admin can update server Meta credentials." });
    }

    const body = configSchema.parse(await request.json());
    const { accessToken, phoneNumberId, wabaId, phoneNumber } = body;

    // Verify credentials live with Meta Graph API
    const metaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=verified_name,code_verification_status,display_phone_number,quality_rating&access_token=${accessToken}`;
    
    let metaRes: Response;
    try {
      metaRes = await fetch(metaUrl);
    } catch (e: any) {
      return apiOk({
        success: false,
        error: `Cannot reach Meta Graph API: ${e?.message || "Timeout"}`
      });
    }

    const metaJson = await metaRes.json();

    if (!metaRes.ok || !metaJson.display_phone_number) {
      const err = metaJson?.error || metaJson;
      return apiOk({
        success: false,
        httpCode: metaRes.status,
        error: `Meta API verification failed (HTTP ${metaRes.status}): ${err?.message || "Invalid Token or Phone Number ID"}`
      });
    }

    const admin = createSupabaseAdminClient();
    const verifiedPhone = metaJson.display_phone_number.replace(/\s/g, "");
    const verifiedName = metaJson.verified_name || "Super Admin Dubai Meta WhatsApp";

    // Deactivate previous default system accounts
    await admin
      .from("whatsapp_accounts")
      .update({ is_default: false })
      .eq("scope", "super_admin");

    // Upsert into whatsapp_accounts as system default
    const { data: existing } = await admin
      .from("whatsapp_accounts")
      .select("id")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();

    let accountId = existing?.id;

    if (accountId) {
      await admin
        .from("whatsapp_accounts")
        .update({
          access_token: accessToken,
          waba_id: wabaId || "WABAID-OFFICIAL",
          phone_number: phoneNumber || verifiedPhone,
          display_name: verifiedName,
          is_active: true,
          is_default: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", accountId);
    } else {
      const { data: newAcc, error: insErr } = await admin
        .from("whatsapp_accounts")
        .insert({
          scope: "super_admin",
          display_name: verifiedName,
          phone_number: phoneNumber || verifiedPhone,
          phone_number_id: phoneNumberId,
          waba_id: wabaId || "WABAID-OFFICIAL",
          access_token: accessToken,
          verify_token: "digitaldock_webhook_2026",
          is_active: true,
          is_default: true,
          created_by: session.userId
        })
        .select("id")
        .single();

      if (insErr) throw new Error(insErr.message);
      accountId = newAcc.id;
    }

    return apiOk({
      success: true,
      accountId,
      verifiedName,
      displayPhoneNumber: verifiedPhone,
      httpCode: metaRes.status,
      message: `✅ System Meta WhatsApp Cloud API credentials verified and activated for ${verifiedPhone} (${verifiedName})!`
    });

  } catch (error) {
    return handleApiError(error);
  }
}
