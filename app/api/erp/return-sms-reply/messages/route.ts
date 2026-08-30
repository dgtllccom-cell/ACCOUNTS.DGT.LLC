import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateContextualAiReply } from "@/lib/services/ai-reply-generator";

// Uses cookies() via requireErpSession — must be dynamic
export const dynamic = "force-dynamic";

const sendMessageSchema = z.object({
  conversationId: z.string(),
  body: z.string().min(1, "Message content is required"),
  channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
  subject: z.string().optional(),
  action: z.enum(["send_manual", "approve_ai", "generate_ai", "save_draft"]).default("send_manual"),
  overrideLanguage: z.enum(["en", "ur", "ps", "fa"]).optional()
});

/**
 * GET /api/erp/return-sms-reply/messages?conversationId=<id>
 * Fetches thread message history for a conversation
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const conversationId = request.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      return handleApiError(new ApiClientError("conversationId parameter is required"));
    }

    const admin = createSupabaseAdminClient();

    // Legacy demo-conversation ids no longer exist (the conversations endpoint returns
    // live records only). Return an empty thread rather than sample data.
    if (conversationId.startsWith("demo-conv-")) {
      return apiOk({ conversation: { id: conversationId, sender_name: "Contact" }, messages: [] });
    }

    // Fetch conversation details
    const { data: conversation } = await admin
      .from("communication_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

    // Fetch messages in thread
    const { data: messageRows } = await admin
      .from("communication_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const messages = (messageRows ?? []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      direction: m.direction,
      channel: m.channel,
      senderIdentifier: m.sender_identifier,
      recipientIdentifier: m.recipient_identifier,
      subject: m.subject,
      body: m.body,
      messageCategory: m.message_category,
      detectedLanguage: m.detected_language,
      status: m.status,
      errorReason: m.error_reason,
      aiGeneratedReply: m.ai_generated_reply,
      editedReply: m.edited_reply,
      isSensitive: m.is_sensitive,
      approvedBy: m.approved_by,
      sentBy: m.sent_by,
      sentAt: m.sent_at,
      deliveredAt: m.delivered_at,
      readAt: m.read_at,
      createdAt: m.created_at
    }));

    return apiOk({
      conversation,
      messages
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/erp/return-sms-reply/messages
 * Sends a message, approves AI reply, or generates a fresh AI draft.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "write" });

    const body = await request.json();
    const parsed = sendMessageSchema.parse(body);

    const admin = createSupabaseAdminClient();

    // Fetch conversation thread
    const { data: conv } = await admin
      .from("communication_conversations")
      .select("*")
      .eq("id", parsed.conversationId)
      .maybeSingle();

    const senderName = conv?.sender_name || "Valued Customer";
    const contactId = conv?.contact_identifier || "contact";

    // Handle Action: Generate AI Draft
    if (parsed.action === "generate_ai") {
      const aiResult = await generateContextualAiReply({
        incomingMessage: parsed.body,
        senderIdentifier: contactId,
        senderName,
        countryId: conv?.country_id,
        cityBranchId: conv?.city_branch_id,
        overrideLanguage: parsed.overrideLanguage
      });

      return apiOk({
        action: "generate_ai",
        aiReply: aiResult.replyText,
        detectedLanguage: aiResult.detectedLanguage,
        category: aiResult.category,
        isSensitive: aiResult.isSensitive,
        requiresApproval: aiResult.requiresApproval,
        verifiedContext: aiResult.verifiedContext
      });
    }

    // Handle Actions: Send Manual or Approve AI
    const messageStatus = parsed.action === "approve_ai" || parsed.action === "send_manual" ? "sent" : "pending";

    const { data: createdMsg, error } = await admin
      .from("communication_messages")
      .insert({
        conversation_id: parsed.conversationId,
        direction: "outgoing",
        channel: parsed.channel,
        sender_identifier: "ERP System",
        recipient_identifier: contactId,
        subject: parsed.subject || null,
        body: parsed.body,
        status: messageStatus,
        sent_by: session.userId,
        approved_by: parsed.action === "approve_ai" ? session.userId : null,
        approved_at: parsed.action === "approve_ai" ? new Date().toISOString() : null,
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    // Update conversation status & last message
    await admin
      .from("communication_conversations")
      .update({
        status: "replied",
        last_message_text: parsed.body,
        last_message_at: new Date().toISOString(),
        unread_count: 0
      })
      .eq("id", parsed.conversationId);

    // Audit Log
    await admin.from("communication_audit_logs").insert({
      conversation_id: parsed.conversationId,
      message_id: createdMsg?.id || null,
      user_id: session.userId,
      country_id: conv?.country_id || null,
      city_branch_id: conv?.city_branch_id || null,
      action: parsed.action === "approve_ai" ? "approved_and_sent" : "sent_manual",
      edited_text: parsed.body,
      delivery_result: messageStatus
    });

    return apiCreated({
      message: createdMsg || {
        id: `msg-${Date.now()}`,
        conversationId: parsed.conversationId,
        body: parsed.body,
        status: messageStatus
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
