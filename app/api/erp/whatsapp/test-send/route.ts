import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Uses cookies() via requireErpSession — must be dynamic
export const dynamic = "force-dynamic";

const testSendSchema = z.object({
  senderNumber: z.string().min(7, "Sender phone number is required"),
  recipientNumber: z.string().min(7, "Recipient phone number is required"),
  messageText: z.string().min(1, "Message content is required"),
  scope: z.string().default("super_admin")
});

/**
 * Convert phone number to E.164 digits only (no + or 00 prefix).
 * Meta Graph API requires e.g. "971544816664", not "+971544816664" or "00971544816664".
 */
function toMetaE164(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.substring(2);
  while (digits.startsWith("0")) digits = digits.substring(1);
  return digits;
}

/**
 * POST /api/erp/whatsapp/test-send
 *
 * Sends a real WhatsApp message via the Meta Cloud API.
 * Rules:
 * - NEVER writes a message to the database unless Meta returns a real WAMID.
 * - NEVER returns success unless Meta HTTP 200 + messages[0].id is received.
 * - Returns the exact Meta error code, type, and message on failure.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const parsed = testSendSchema.parse(await request.json());
    const admin = createSupabaseAdminClient();

    // Look up the real Meta credentials from the database for this sender number
    const { data: account } = await admin
      .from("whatsapp_accounts")
      .select("phone_number_id, access_token, waba_id, display_name, is_active")
      .eq("phone_number", parsed.senderNumber)
      .eq("is_active", true)
      .maybeSingle();

    // Also check environment variables as a fallback for super-admin setup
    const token = account?.access_token || process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || null;
    const phoneNumberId = account?.phone_number_id || process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || null;

    // Reject if no real credentials exist or if they look like placeholder values
    const isFakeToken = !token || token.includes("SECURE_TOKEN") || token.includes("PNID-") || token.length < 20;
    const isFakePnid = !phoneNumberId || phoneNumberId.startsWith("PNID-") || phoneNumberId.length < 5;

    if (isFakeToken || isFakePnid) {
      return apiOk({
        success: false,
        metaSuccess: false,
        status: "NO_REAL_CREDENTIALS",
        details: "No verified Meta WhatsApp Cloud API credentials found for this sender number. Please complete the WhatsApp Connection Wizard with your real Meta Phone Number ID and Access Token.",
        action: "Open Connect WhatsApp and enter your real Meta credentials from developers.facebook.com"
      });
    }

    const formattedRecipient = toMetaE164(parsed.recipientNumber);

    console.log(`[Meta Cloud API Send] To: +${formattedRecipient}, PNID: ${phoneNumberId}`);

    // Call the real Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedRecipient,
        type: "text",
        text: { preview_url: false, body: parsed.messageText }
      })
    });

    const metaHttpCode = metaRes.status;
    const metaJson = await metaRes.json();

    // Real success — Meta returned a real WAMID
    if (metaRes.ok && metaJson.messages?.[0]?.id) {
      const realWamid = metaJson.messages[0].id;

      // Only NOW write the message to the database with real WAMID
      let conversationId: string | null = null;

      const { data: existingConv } = await admin
        .from("communication_conversations")
        .select("id")
        .eq("contact_identifier", parsed.recipientNumber)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv } = await admin
          .from("communication_conversations")
          .insert({
            channel: "whatsapp",
            contact_identifier: parsed.recipientNumber,
            sender_name: `WhatsApp Contact (${parsed.recipientNumber})`,
            sender_type: "customer",
            status: "replied",
            last_message_text: parsed.messageText,
            last_message_at: new Date().toISOString(),
            unread_count: 0
          })
          .select("id")
          .single();
        if (newConv) conversationId = newConv.id;
      }

      if (conversationId) {
        await admin.from("communication_messages").insert({
          conversation_id: conversationId,
          direction: "outgoing",
          channel: "whatsapp",
          sender_identifier: parsed.senderNumber,
          recipient_identifier: parsed.recipientNumber,
          body: parsed.messageText,
          raw_payload: { wamid: realWamid, metaResponse: metaJson },
          status: "sent", // Only 'sent' — Meta confirmed acceptance; 'delivered'/'read' comes via webhook
          sent_by: session.userId,
          sent_at: new Date().toISOString()
        });
      }

      return apiOk({
        success: true,
        metaSuccess: true,
        status: "SENT",
        wamid: realWamid,
        httpCode: metaHttpCode,
        senderNumber: parsed.senderNumber,
        recipientNumber: parsed.recipientNumber,
        formattedE164: `+${formattedRecipient}`,
        sentAt: new Date().toISOString(),
        details: `Message accepted by Meta WhatsApp Network. WAMID: ${realWamid}. Delivery confirmation will arrive via webhook.`,
        note: "Status will update to DELIVERED and READ automatically when Meta sends webhook confirmation."
      });
    }

    // Real Meta error — return exact error, no DB write
    const metaError = metaJson?.error || metaJson;
    console.error(`[Meta Cloud API Error] HTTP ${metaHttpCode}:`, JSON.stringify(metaError));

    return apiOk({
      success: false,
      metaSuccess: false,
      status: "FAILED",
      httpCode: metaHttpCode,
      senderNumber: parsed.senderNumber,
      recipientNumber: parsed.recipientNumber,
      formattedE164: `+${formattedRecipient}`,
      metaError: {
        code: metaError?.code || metaHttpCode,
        type: metaError?.type || "UNKNOWN",
        message: metaError?.message || "Meta WhatsApp API rejected the message",
        fbTraceId: metaError?.fbtrace_id || null,
        subcode: metaError?.error_subcode || null
      },
      details: `Meta API returned HTTP ${metaHttpCode}: ${metaError?.message || "Delivery rejected"}`,
      action: metaHttpCode === 401
        ? "Your Access Token is invalid or expired. Generate a new Permanent System User Token in Meta Business Manager."
        : metaHttpCode === 400
        ? "Check that the recipient number is in the correct international format and is registered on WhatsApp."
        : "Check your Meta Business Manager dashboard for details."
    });
  } catch (error) {
    return handleApiError(error);
  }
}
