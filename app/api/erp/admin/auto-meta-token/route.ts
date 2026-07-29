import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const tokenGenSchema = z.object({
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  shortLivedToken: z.string().optional()
});

/**
 * POST /api/erp/admin/auto-meta-token
 * Server-side Meta Token Generator & Auto-Refresher.
 * Exchanges Meta App Credentials or short-lived token for a long-lived / permanent Meta API Access Token.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return apiOk({ success: false, error: "Only Super Admin can generate Meta tokens." });
    }

    const body = tokenGenSchema.parse(await request.json());
    const appId = body.appId || process.env.META_APP_ID;
    const appSecret = body.appSecret || process.env.META_APP_SECRET;
    const shortLivedToken = body.shortLivedToken;

    let accessToken: string | null = null;

    // Option 1: Extend short-lived user token to 60-day / permanent token
    if (shortLivedToken && appId && appSecret) {
      const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
      const res = await fetch(url);
      const json = await res.json();

      if (res.ok && json.access_token) {
        accessToken = json.access_token;
      } else {
        return apiOk({
          success: false,
          error: `Meta Token Exchange Failed: ${json?.error?.message || "Invalid App ID/Secret"}`
        });
      }
    } else if (appId && appSecret) {
      // Option 2: Generate App Access Token via client_credentials
      const url = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
      const res = await fetch(url);
      const json = await res.json();

      if (res.ok && json.access_token) {
        accessToken = json.access_token;
      }
    }

    if (!accessToken) {
      return apiOk({
        success: false,
        error: "Meta App ID & App Secret (or User Token) required to auto-generate Meta Access Token."
      });
    }

    // Save token to database
    const admin = createSupabaseAdminClient();
    const phoneNumberId = "154760354377649";
    const wabaId = "335626955041488";

    const { data: existing } = await admin
      .from("whatsapp_accounts")
      .select("id")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();

    if (existing?.id) {
      await admin
        .from("whatsapp_accounts")
        .update({
          access_token: accessToken,
          is_active: true,
          is_default: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
    } else {
      await admin
        .from("whatsapp_accounts")
        .insert({
          scope: "super_admin",
          display_name: "Super Admin Dubai WhatsApp",
          phone_number: "00971544816664",
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          access_token: accessToken,
          verify_token: "digitaldock_webhook_2026",
          is_active: true,
          is_default: true,
          created_by: session.userId
        });
    }

    return apiOk({
      success: true,
      accessToken,
      message: "✅ Permanent Meta Access Token generated and configured automatically on server!"
    });

  } catch (error) {
    return handleApiError(error);
  }
}
