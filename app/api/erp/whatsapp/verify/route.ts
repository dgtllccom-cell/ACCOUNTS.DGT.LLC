import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";

// Uses cookies() via requireErpSession — must be dynamic
export const dynamic = "force-dynamic";


const verifySchema = z.object({
  phoneNumberId: z.string().min(5, "Phone Number ID is required"),
  accessToken: z.string().min(20, "Access Token is required")
});

/**
 * POST /api/erp/whatsapp/verify
 * Verifies real Meta WhatsApp Cloud API credentials by calling the live Meta Graph API.
 * Returns the real phone number name and verification status from Meta, or the exact error.
 * This is the ONLY gate before whatsapp_accounts is written to the database.
 */
export async function POST(request: NextRequest) {
  try {
    await requireErpSession();
    const body = verifySchema.parse(await request.json());

    const { phoneNumberId, accessToken } = body;

    // Call real Meta Graph API to verify credentials
    const metaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=verified_name,code_verification_status,display_phone_number,quality_rating,platform_type&access_token=${accessToken}`;

    let metaRes: Response;
    try {
      metaRes = await fetch(metaUrl, { method: "GET" });
    } catch (networkErr: any) {
      return apiOk({
        verified: false,
        httpCode: 0,
        error: {
          code: "NETWORK_ERROR",
          message: `Cannot reach Meta Graph API: ${networkErr?.message || "Network timeout"}`
        }
      });
    }

    const httpCode = metaRes.status;
    const metaJson = await metaRes.json();

    if (metaRes.ok && metaJson.display_phone_number) {
      return apiOk({
        verified: true,
        httpCode,
        phoneNumberId,
        displayPhoneNumber: metaJson.display_phone_number,
        verifiedName: metaJson.verified_name || null,
        verificationStatus: metaJson.code_verification_status || "VERIFIED",
        qualityRating: metaJson.quality_rating || null,
        platformType: metaJson.platform_type || "CLOUD_API"
      });
    }

    // Real Meta error — return exact error code and message
    return apiOk({
      verified: false,
      httpCode,
      error: {
        code: metaJson?.error?.code || httpCode,
        type: metaJson?.error?.type || "UNKNOWN",
        message: metaJson?.error?.message || "Meta Graph API rejected the credentials",
        fbTraceId: metaJson?.error?.fbtrace_id || null
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
