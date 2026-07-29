import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateConversation } from "@/lib/services/return-sms-reply-service";
import { generateContextualAiReply } from "@/lib/services/ai-reply-generator";

/**
 * POST /api/erp/return-sms-reply/webhooks/email
 * Receives incoming official email webhooks (SendGrid, Mailgun, AWS SES, or IMAP Receiver)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const fromEmail = payload.from || payload.sender || payload.envelope?.from;
    const subject = payload.subject || "No Subject";
    const bodyText = payload.text || payload.body || payload.html || "[No content]";
    const senderName = payload.from_name || fromEmail?.split("@")[0] || "Email Contact";

    if (!fromEmail) {
      return NextResponse.json({ error: "Sender email is missing from payload" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Get or create conversation thread for sender
    const conversation = await getOrCreateConversation({
      channel: "email",
      contactIdentifier: fromEmail,
      senderName,
      initialMessageText: `${subject}: ${bodyText}`
    });

    // Store incoming email message
    const { data: savedMsg } = await admin
      .from("communication_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "incoming",
        channel: "email",
        sender_identifier: fromEmail,
        recipient_identifier: payload.to || "ERP Official Email",
        subject,
        body: bodyText,
        raw_payload: payload,
        status: "delivered"
      })
      .select()
      .single();

    // Generate AI Contextual Reply Draft
    const aiResult = await generateContextualAiReply({
      incomingMessage: `${subject}: ${bodyText}`,
      senderIdentifier: fromEmail,
      senderName,
      countryId: conversation.country_id,
      cityBranchId: conversation.city_branch_id
    });

    const targetStatus = aiResult.requiresApproval ? "approval_required" : "ai_ready";
    await admin
      .from("communication_conversations")
      .update({
        status: targetStatus,
        last_message_text: `${subject}: ${bodyText.slice(0, 100)}...`,
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
    console.error("[return-sms-reply/webhooks/email] Error handling email webhook:", error);
    return NextResponse.json({ error: error.message || "Email webhook processing error" }, { status: 500 });
  }
}
