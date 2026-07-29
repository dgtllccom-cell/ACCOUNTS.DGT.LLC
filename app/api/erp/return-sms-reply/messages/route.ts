import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateContextualAiReply } from "@/lib/services/ai-reply-generator";

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
      return handleApiError(new Error("conversationId parameter is required"));
    }

    const admin = createSupabaseAdminClient();

    // Handle Demo Conversation IDs
    if (conversationId.startsWith("demo-conv-")) {
      const demoThreads: Record<string, { conversation: any; messages: any[] }> = {
        "demo-conv-1": {
          conversation: {
            id: "demo-conv-1",
            channel: "whatsapp",
            contact_identifier: "+92 300 9876543",
            sender_name: "Haji Ahmad (Ahmad Logistics)",
            sender_type: "Customer",
            country_id: "pk",
            message_language: "ur",
            reply_mode: "approval",
            related_entity_type: "sales_order",
            related_entity_id: "SO-9941"
          },
          messages: [
            {
              id: "msg-d1-1",
              conversationId: "demo-conv-1",
              direction: "incoming",
              channel: "whatsapp",
              senderIdentifier: "+92 300 9876543",
              recipientIdentifier: "ERP WhatsApp",
              body: "السلام علیکم، میرا سیلز آرڈر SO-9941 کی شپمنٹ لوڈنگ پورٹ پہنچ گئی ہے؟ برائے مہربانی اپ ڈیٹ شیئر کریں۔",
              detectedLanguage: "ur",
              status: "received",
              aiGeneratedReply: "وعلیکم السلام حاجی صاحب! آپ کا آرڈر SO-9941 پورٹ قاسم پر کامیا بی سے لوڈ ہو چکا ہے اور جہاز پر روانگی کے لیے تیار ہے۔ آپ اپنا سندِ باربرداری (B/L) آن لائن پورٹل سے بھی دیکھ سکتے ہیں۔",
              createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
            }
          ]
        },
        "demo-conv-2": {
          conversation: {
            id: "demo-conv-2",
            channel: "whatsapp",
            contact_identifier: "+93 700 123456",
            sender_name: "Gul Khan Trading Co.",
            sender_type: "Customer",
            country_id: "af",
            message_language: "ps",
            reply_mode: "manual",
            related_entity_type: "ledger",
            related_entity_id: "LEDG-AFG-002"
          },
          messages: [
            {
              id: "msg-d2-1",
              conversationId: "demo-conv-2",
              direction: "incoming",
              channel: "whatsapp",
              senderIdentifier: "+93 700 123456",
              recipientIdentifier: "ERP WhatsApp",
              body: "سلامونه، د تیرې میاشتې حساب بیلانس او باقیداری روانی کړئ. مننه",
              detectedLanguage: "ps",
              status: "received",
              aiGeneratedReply: "سلامونه گل خان صاحب! ستاسو باقیداری افغانی 450,000 دی. د ډیجیټل ډاک ای آر پی تفصیلی حساب صورتحساب تیار شوی دی.",
              createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
            }
          ]
        },
        "demo-conv-3": {
          conversation: {
            id: "demo-conv-3",
            channel: "whatsapp",
            contact_identifier: "+971 50 8887766",
            sender_name: "Al-Damaan General Trading LLC",
            sender_type: "Supplier",
            country_id: "ae",
            message_language: "ar",
            reply_mode: "approval",
            related_entity_type: "purchase_order",
            related_entity_id: "PO-8820"
          },
          messages: [
            {
              id: "msg-d3-1",
              conversationId: "demo-conv-3",
              direction: "incoming",
              channel: "whatsapp",
              senderIdentifier: "+971 50 8887766",
              recipientIdentifier: "ERP WhatsApp",
              body: "السلام عليكم، يرجى تأكيد استلام الدفعة بقيمة 25,000 درهم وإرسال سند القبض.",
              detectedLanguage: "ar",
              status: "received",
              aiGeneratedReply: "وعليكم السلام ورحمة الله! تم تأكيد استلام مبلغ 25,000 درهم بحساب الشركة وتم إصدار سند القبض الرسمي برقم REC-8820.",
              createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString()
            }
          ]
        },
        "demo-conv-4": {
          conversation: {
            id: "demo-conv-4",
            channel: "whatsapp",
            contact_identifier: "+98 912 3456789",
            sender_name: "Tehran Foreign Trade Co.",
            sender_type: "Customer",
            country_id: "ir",
            message_language: "fa",
            reply_mode: "automatic",
            related_entity_type: "roznamcha",
            related_entity_id: "ROZ-IRN-104"
          },
          messages: [
            {
              id: "msg-d4-1",
              conversationId: "demo-conv-4",
              direction: "incoming",
              channel: "whatsapp",
              senderIdentifier: "+98 912 3456789",
              recipientIdentifier: "ERP WhatsApp",
              body: "سلام، لطفا صورتحساب ماه جاری و لیست کالاهای موجود در انبار را ارسال فرمایید.",
              detectedLanguage: "fa",
              status: "received",
              aiGeneratedReply: "سلام وقت بخیر! صورتحساب ماه جاری به همراه لیست موجودی انبار مرزی برای شما آماده و تایید گردید.",
              createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
            }
          ]
        },
        "demo-conv-5": {
          conversation: {
            id: "demo-conv-5",
            channel: "email",
            contact_identifier: "shipping@gclines.com",
            senderName: "Global Container Lines",
            sender_type: "Shipping Line",
            country_id: "global",
            message_language: "en",
            reply_mode: "manual",
            related_entity_type: "purchase_order",
            related_entity_id: "BL-49102"
          },
          messages: [
            {
              id: "msg-d5-1",
              conversationId: "demo-conv-5",
              direction: "incoming",
              channel: "email",
              senderIdentifier: "shipping@gclines.com",
              recipientIdentifier: "ERP Email",
              subject: "Release Notice: Bill of Lading BL-49102",
              body: "Bill of Lading BL-49102 has been released. Container status is set to Port Gate Out.",
              detectedLanguage: "en",
              status: "received",
              aiGeneratedReply: "Dear Global Container Lines team, Thank you for the release update regarding BL-49102. Our logistics department has updated the shipment status in Digital Dock ERP.",
              createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString()
            }
          ]
        }
      };

      const thread = demoThreads[conversationId] || {
        conversation: { id: conversationId, sender_name: "Contact" },
        messages: []
      };

      return apiOk(thread);
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
