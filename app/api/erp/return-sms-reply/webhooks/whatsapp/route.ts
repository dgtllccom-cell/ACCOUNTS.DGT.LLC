import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation } from "@/lib/services/return-sms-reply-service";
import { generateContextualAiReply } from "@/lib/services/ai-reply-generator";

/**
 * GET /api/erp/return-sms-reply/webhooks/whatsapp
 * Official Meta WhatsApp Business API webhook verification.
 * Meta calls this URL with hub.mode, hub.verify_token, hub.challenge when you
 * register the webhook in your Meta App dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";

  if (!verifyToken) {
    console.error("[Webhook] WHATSAPP_VERIFY_TOKEN env variable is not set. Rejecting all verification requests.");
    return NextResponse.json(
      { error: "Webhook not configured. Set WHATSAPP_VERIFY_TOKEN environment variable." },
      { status: 403 }
    );
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Webhook] Meta webhook verified successfully.");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[Webhook] Verification token mismatch. Expected:", verifyToken, "Got:", token);
  return NextResponse.json({ error: "Verification token mismatch" }, { status: 403 });
}

/**
 * POST /api/erp/return-sms-reply/webhooks/whatsapp
 * Receives all real WhatsApp events from Meta:
 * - Incoming messages → saved to ERP inbox, AI draft generated
 * - Delivery status updates (sent/delivered/read/failed) → message status updated in DB
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const admin = createSupabaseAdminClient();

    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // ─────────────────────────────────────────────────────────────────────────
    // Handle delivery status updates from Meta (sent/delivered/read/failed)
    // ─────────────────────────────────────────────────────────────────────────
    if (value?.statuses && value.statuses.length > 0) {
      for (const statusEvent of value.statuses) {
        const wamid = statusEvent.id; // Real WhatsApp message ID
        const newStatus: string = statusEvent.status; // "sent" | "delivered" | "read" | "failed"
        const timestamp = statusEvent.timestamp
          ? new Date(Number(statusEvent.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        const updatePayload: Record<string, any> = {
          status: newStatus,
          raw_payload: payload
        };

        if (newStatus === "delivered") {
          updatePayload.delivered_at = timestamp;
        } else if (newStatus === "read") {
          updatePayload.read_at = timestamp;
        }

        // Update the message record that matches the real WAMID stored in raw_payload
        const { data: updatedRows, error: updateError } = await admin
          .from("communication_messages")
          .update(updatePayload)
          .contains("raw_payload", { wamid })
          .select("id");

        if (updateError) {
          console.error("[Webhook Status Update Error]:", updateError.message);
        } else {
          console.log(`[Webhook] Message ${wamid} status updated to '${newStatus}'. Rows: ${updatedRows?.length ?? 0}`);
        }
      }

      return NextResponse.json({ status: "status_updates_processed" }, { status: 200 });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Handle incoming messages from real WhatsApp users
    // ─────────────────────────────────────────────────────────────────────────
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ status: "received", note: "No actionable event in payload" }, { status: 200 });
    }

    const fromPhone = message.from; // Sender phone in E.164 digits (e.g. "971544816664")
    const contactName = value?.contacts?.[0]?.profile?.name || fromPhone;
    const messageText = message.text?.body || message.caption || "[Media Message]";
    const waMessageId = message.id; // Real WAMID from Meta

    // Idempotency: skip if we already saved this exact WAMID
    const { data: existingMsg } = await admin
      .from("communication_messages")
      .select("id")
      .contains("raw_payload", { wamid: waMessageId })
      .limit(1);

    if (existingMsg && existingMsg.length > 0) {
      console.log("[Webhook] Duplicate WAMID detected, ignoring:", waMessageId);
      return NextResponse.json({ status: "ignored_duplicate" }, { status: 200 });
    }

    // Resolve or create conversation thread in ERP
    const conversation = await getOrCreateConversation({
      channel: "whatsapp",
      contactIdentifier: fromPhone,
      senderName: contactName,
      initialMessageText: messageText
    });

    // Save incoming message with real WAMID in raw_payload
    await admin
      .from("communication_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "incoming",
        channel: "whatsapp",
        sender_identifier: fromPhone,
        recipient_identifier: "ERP",
        body: messageText,
        raw_payload: { wamid: waMessageId, fullPayload: payload },
        status: "delivered" // Incoming messages are always delivered by definition
      });

    // Generate AI Reply Draft
    const aiResult = await generateContextualAiReply({
      incomingMessage: messageText,
      senderIdentifier: fromPhone,
      senderName: contactName,
      countryId: conversation.country_id,
      cityBranchId: conversation.city_branch_id
    });

    const targetStatus = aiResult.requiresApproval ? "approval_required" : "ai_ready";
    await admin
      .from("communication_conversations")
      .update({
        status: targetStatus,
        last_message_text: messageText,
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1
      })
      .eq("id", conversation.id);

    console.log(`[Webhook] Incoming message from ${fromPhone} saved. WAMID: ${waMessageId}. Conv: ${conversation.id}`);

    return NextResponse.json({
      status: "success",
      conversationId: conversation.id,
      wamid: waMessageId,
      aiReplyGenerated: true,
      requiresApproval: aiResult.requiresApproval
    });
  } catch (error: any) {
    console.error("[Webhook Error]:", error.message);
    return NextResponse.json({ error: error.message || "Webhook handling error" }, { status: 500 });
  }
}
