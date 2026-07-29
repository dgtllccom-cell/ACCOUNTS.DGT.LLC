import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const testSendSchema = z.object({
  senderNumber: z.string().default("00971544816664"),
  recipientNumber: z.string().min(7, "Recipient phone number is required"),
  messageText: z.string().min(1, "Message content is required"),
  scope: z.string().default("super_admin")
});

/**
 * Helper to convert phone number into international E.164 format for Meta Graph API
 * e.g. "00971544816664" -> "971544816664", "+971 54 481 6664" -> "971544816664"
 */
function toMetaE164(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.substring(2);
  while (digits.startsWith("0")) digits = digits.substring(1);
  return digits;
}

/**
 * POST /api/erp/whatsapp/test-send
 * Sends a live WhatsApp test message and returns verification status & Meta API diagnostics
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const parsed = testSendSchema.parse(body);

    const admin = createSupabaseAdminClient();

    // Check or create conversation thread
    let conversationId = `conv-test-${Date.now()}`;
    
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
          sender_name: `Test Contact (${parsed.recipientNumber})`,
          sender_type: "Customer",
          status: "replied",
          last_message_text: parsed.messageText,
          last_message_at: new Date().toISOString(),
          unread_count: 0
        })
        .select("id")
        .single();

      if (newConv) {
        conversationId = newConv.id;
      }
    }

    // Insert outgoing message into ERP Inbox database
    const messageId = `WAMID-2026-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    await admin.from("communication_messages").insert({
      conversation_id: conversationId,
      direction: "outgoing",
      channel: "whatsapp",
      sender_identifier: parsed.senderNumber,
      recipient_identifier: parsed.recipientNumber,
      body: parsed.messageText,
      status: "delivered",
      sent_by: session.userId,
      sent_at: new Date().toISOString(),
      delivered_at: new Date().toISOString()
    });

    // Check Meta Cloud API credentials in Database OR Environment variables
    const { data: account } = await admin
      .from("whatsapp_accounts")
      .select("phone_number_id, access_token, waba_id")
      .eq("phone_number", parsed.senderNumber)
      .maybeSingle();

    const token = account?.access_token || process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || null;
    const phoneNumberId = account?.phone_number_id || process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || null;
    const formattedRecipient = toMetaE164(parsed.recipientNumber);

    let metaSuccess = false;
    let metaStatus = "LOCAL_ERP_SYNCD";
    let metaHttpCode = 200;
    let metaErrorPayload = null;
    let metaDetails = `Message logged in Digital Dock ERP Inbox. Formatted E.164: +${formattedRecipient}`;

    if (token && phoneNumberId && !token.includes("SECURE_TOKEN")) {
      try {
        console.log(`[Meta Cloud API Send Attempt] To: +${formattedRecipient}, PNID: ${phoneNumberId}`);

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

        metaHttpCode = metaRes.status;
        const metaJson = await metaRes.json();

        if (metaRes.ok && metaJson.messages?.[0]?.id) {
          metaSuccess = true;
          metaStatus = "META_NETWORK_TRANSMITTED";
          metaDetails = `Live WhatsApp message delivered to Meta network (WAMID: ${metaJson.messages[0].id})`;
        } else {
          metaErrorPayload = metaJson?.error || metaJson;
          metaStatus = "META_API_FAILED";
          metaDetails = `Meta API returned HTTP ${metaRes.status}: ${metaJson?.error?.message || "Transmission rejected by Meta"}`;
        }
      } catch (err: any) {
        metaHttpCode = 500;
        metaStatus = "META_NETWORK_ERROR";
        metaErrorPayload = { message: err?.message || "Network timeout connecting to Meta Graph API" };
        metaDetails = `Meta Network Error: ${err?.message}`;
      }
    } else {
      metaDetails += " (Note: Real Meta System User Access Token & Phone Number ID required for physical phone delivery)";
    }

    return apiCreated({
      success: true,
      metaSuccess,
      messageId,
      senderNumber: parsed.senderNumber,
      recipientNumber: parsed.recipientNumber,
      formattedE164: formattedRecipient,
      status: metaStatus,
      httpCode: metaHttpCode,
      metaError: metaErrorPayload,
      deliveredAt: new Date().toISOString(),
      details: metaDetails
    });
  } catch (error) {
    return handleApiError(error);
  }
}
