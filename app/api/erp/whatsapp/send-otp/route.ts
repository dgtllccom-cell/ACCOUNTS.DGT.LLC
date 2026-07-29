import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSystemMetaConfig } from "@/lib/services/meta-whatsapp-config";

export const dynamic = "force-dynamic";

const sendOtpSchema = z.object({
  phoneNumber: z.string().min(7, "Phone number is required"),
  scope: z.string().default("super_admin")
});

function toMetaE164(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.substring(2);
  while (digits.startsWith("0")) digits = digits.substring(1);
  return digits;
}

/**
 * POST /api/erp/whatsapp/send-otp
 * Dispatches an official Meta WhatsApp 6-Digit verification code directly to the target phone number.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();

    const digitsOnly = String(body?.phoneNumber || "").replace(/\D/g, "");
    if (digitsOnly.length < 7) {
      return apiOk({
        success: false,
        error: "Please enter your full WhatsApp phone number (e.g. 00971544816664) in the phone input box above."
      });
    }

    const parsed = sendOtpSchema.parse(body);
    const admin = createSupabaseAdminClient();

    const formattedPhone = toMetaE164(parsed.phoneNumber);

    // Look for system default Meta credentials
    const { token, phoneNumberId, isConfigured } = await getSystemMetaConfig();

    // Generate random 6-digit OTP code
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));

    // Save OTP to database for verification
    const { error: otpError } = await admin
      .from("communication_contact_preferences")
      .upsert({
        contact_identifier: parsed.phoneNumber,
        contact_name: "WhatsApp OTP Verification",
        block_reason: `OTP:${otpCode}:${Date.now() + 10 * 60 * 1000}`, // 10 min validity
        updated_at: new Date().toISOString()
      }, { onConflict: "contact_identifier" });

    if (otpError) {
      console.warn("[Send OTP DB Notice]:", otpError.message);
    }

    const messageText = `🔐 Digital Dock ERP Verification Code: ${otpCode}\n\nDo not share this code with anyone. Valid for 10 minutes.`;

    const isFakeToken = !token || token.includes("SECURE_TOKEN") || token.length < 20;
    const isFakePnid = !phoneNumberId || phoneNumberId.startsWith("PNID-") || phoneNumberId.length < 5;

    // If Meta Cloud API credentials exist, send via official Meta Graph API to target phone
    if (!isFakeToken && !isFakePnid) {
      console.log(`[Official Meta OTP Send] Sending code to +${formattedPhone} via Meta Graph API`);

      const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: { preview_url: false, body: messageText }
        })
      });

      const metaHttpCode = metaRes.status;
      const metaJson = await metaRes.json();

      if (metaRes.ok && metaJson.messages?.[0]?.id) {
        return apiOk({
          success: true,
          metaDelivered: true,
          wamid: metaJson.messages[0].id,
          formattedE164: `+${formattedPhone}`,
          message: `✓ 6-Digit Verification Code sent directly to your WhatsApp (+${formattedPhone}). Please check your WhatsApp messages.`
        });
      } else {
        console.warn("[Meta OTP Delivery Error]:", metaJson);
        const errObj = metaJson?.error || metaJson;
        return apiOk({
          success: false,
          metaDelivered: false,
          httpCode: metaHttpCode,
          metaError: errObj,
          error: `Meta WhatsApp API returned HTTP ${metaHttpCode}: ${errObj?.message || "Delivery rejected"}`
        });
      }
    }

    // No Meta credentials on server yet
    return apiOk({
      success: false,
      metaDelivered: false,
      error: "Administrator Setup Required: Meta WhatsApp Cloud API System Access Token & Phone Number ID have not been saved on the server yet."
    });

  } catch (error) {
    return handleApiError(error);
  }
}
