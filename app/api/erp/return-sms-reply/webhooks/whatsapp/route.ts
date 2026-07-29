import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation } from "@/lib/services/return-sms-reply-service";
import { generateContextualAiReply } from "@/lib/services/ai-reply-generator";

/**
 * GET /api/erp/return-sms-reply/webhooks/whatsapp
 * Official Meta / WhatsApp Business API webhook verification endpoint
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "digital_dock_erp_whatsapp_secret";

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification token mismatch" }, { status: 403 });
}

/**
 * POST /api/erp/return-sms-reply/webhooks/whatsapp
 * Receives incoming WhatsApp messages, logs conversation, generates AI reply draft
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Parse official Meta WhatsApp Business webhook structure
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ status: "received", note: "No message in event" }, { status: 200 });
    }

    const fromPhone = message.from; // Sender phone number
    const contactName = value?.contacts?.[0]?.profile?.name || fromPhone;
    const messageText = message.text?.body || message.caption || "[Media Message]";
    const waMessageId = message.id;

    const admin = createSupabaseAdminClient();

    // Idempotency check: prevent duplicate message processing
    const { data: existingMsg } = await admin
      .from("communication_messages")
      .select("id")
      .eq("sender_identifier", fromPhone)
      .eq("body", messageText)
      .limit(1);

    if (existingMsg && existingMsg.length > 0) {
      return NextResponse.json({ status: "ignored_duplicate" }, { status: 200 });
    }

    // Resolve or create conversation thread in ERP
    const conversation = await getOrCreateConversation({
      channel: "whatsapp",
      contactIdentifier: fromPhone,
      senderName: contactName,
      initialMessageText: messageText
    });

    // Save incoming message in ERP DB
    const { data: savedMsg } = await admin
      .from("communication_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "incoming",
        channel: "whatsapp",
        sender_identifier: fromPhone,
        recipient_identifier: "ERP WhatsApp System",
        body: messageText,
        raw_payload: payload,
        status: "delivered"
      })
      .select()
      .single();

    // Generate AI Reply Draft
    const aiResult = await generateContextualAiReply({
      incomingMessage: messageText,
      senderIdentifier: fromPhone,
      senderName: contactName,
      countryId: conversation.country_id,
      cityBranchId: conversation.city_branch_id
    });

    // Update conversation state based on AI safety checks
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

    return NextResponse.json({
      status: "success",
      conversationId: conversation.id,
      aiReplyGenerated: true,
      requiresApproval: aiResult.requiresApproval
    });
  } catch (error: any) {
    console.error("[return-sms-reply/webhooks/whatsapp] Error handling webhook:", error);
    return NextResponse.json({ error: error.message || "Webhook handling error" }, { status: 500 });
  }
}
