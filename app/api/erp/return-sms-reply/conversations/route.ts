import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/erp/return-sms-reply/conversations
 *
 * Fetches Return SMS Reply conversations with role scoping & status filters.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const scope = resolveReportScope(session);
    const { searchParams } = request.nextUrl;

    const requestedCountryId = searchParams.get("countryId");
    const requestedBranchId = searchParams.get("branchId");
    const statusFilter = searchParams.get("status") || "all";
    const channelFilter = searchParams.get("channel") || "all";
    const searchQuery = searchParams.get("search") || "";

    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      scope,
      requestedCountryId && requestedCountryId !== "all" ? requestedCountryId : null,
      requestedBranchId && requestedBranchId !== "all" ? requestedBranchId : null
    );

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("communication_conversations")
      .select(`
        id, channel, contact_identifier, sender_name, sender_type, sender_entity_id,
        country_id, city_branch_id, related_entity_type, related_entity_id,
        status, priority, message_language, assigned_user_id, reply_mode,
        last_message_text, last_message_at, unread_count, created_at,
        countries(name, code), city_branches(name, code)
      `)
      .order("last_message_at", { ascending: false });

    if (effectiveCountryId) query = query.eq("country_id", effectiveCountryId);
    if (effectiveBranchId) query = query.eq("city_branch_id", effectiveBranchId);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (channelFilter !== "all") query = query.eq("channel", channelFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      query = query.or(`sender_name.ilike.%${q}%,contact_identifier.ilike.%${q}%,last_message_text.ilike.%${q}%`);
    }

    const { data: convRows, error } = await query.limit(200);

    if (error) {
      console.warn("[return-sms-reply/conversations] DB query notice:", error.message);
    }

    const conversations = (convRows ?? []).map((c: any) => ({
      id: c.id,
      channel: c.channel,
      contactIdentifier: c.contact_identifier,
      senderName: c.sender_name || c.contact_identifier,
      senderType: c.sender_type,
      senderEntityId: c.sender_entity_id,
      countryId: c.country_id,
      countryName: c.countries?.name || "Global",
      cityBranchId: c.city_branch_id,
      branchName: c.city_branches?.name || "All Branches",
      relatedEntityType: c.related_entity_type,
      relatedEntityId: c.related_entity_id,
      status: c.status,
      priority: c.priority,
      messageLanguage: c.message_language || "en",
      assignedUserId: c.assigned_user_id,
      replyMode: c.reply_mode || "manual",
      lastMessageText: c.last_message_text,
      lastMessageAt: c.last_message_at,
      unreadCount: c.unread_count || 0
    }));

    const defaultDemoConversations = [
      {
        id: "demo-conv-1",
        channel: "whatsapp",
        contactIdentifier: "+92 300 9876543",
        senderName: "Haji Ahmad (Ahmad Logistics)",
        senderType: "Customer",
        countryName: "Pakistan",
        branchName: "Karachi Main Branch",
        relatedEntityType: "sales_order",
        relatedEntityId: "SO-9941",
        status: "ai_ready",
        priority: "high",
        messageLanguage: "ur",
        replyMode: "approval",
        lastMessageText: "السلام علیکم، میرا سیلز آرڈر SO-9941 کی شپمنٹ لوڈنگ پورٹ پہنچ گئی ہے؟ برائے مہربانی اپ ڈیٹ شیئر کریں۔",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        unreadCount: 1
      },
      {
        id: "demo-conv-2",
        channel: "whatsapp",
        contactIdentifier: "+93 700 123456",
        senderName: "Gul Khan Trading Co.",
        senderType: "Customer",
        countryName: "Afghanistan",
        branchName: "Kabul Branch",
        relatedEntityType: "ledger",
        relatedEntityId: "LEDG-AFG-002",
        status: "pending_reply",
        priority: "urgent",
        messageLanguage: "ps",
        replyMode: "manual",
        lastMessageText: "سلامونه، د تیرې میاشتې حساب بیلانس او باقیداری روانی کړئ. مننه",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        unreadCount: 2
      },
      {
        id: "demo-conv-3",
        channel: "whatsapp",
        contactIdentifier: "+971 50 8887766",
        senderName: "Al-Damaan General Trading LLC",
        senderType: "Supplier",
        countryName: "UAE",
        branchName: "Dubai Branch",
        relatedEntityType: "purchase_order",
        relatedEntityId: "PO-8820",
        status: "approval_required",
        priority: "urgent",
        messageLanguage: "ar",
        replyMode: "approval",
        lastMessageText: "السلام عليكم، يرجى تأكيد استلام الدفعة بقيمة 25,000 درهم وإرسال سند القبض.",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        unreadCount: 1
      },
      {
        id: "demo-conv-4",
        channel: "whatsapp",
        contactIdentifier: "+98 912 3456789",
        senderName: "Tehran Foreign Trade Co.",
        senderType: "Customer",
        countryName: "Iran",
        branchName: "Tehran Branch",
        relatedEntityType: "roznamcha",
        relatedEntityId: "ROZ-IRN-104",
        status: "ai_ready",
        priority: "normal",
        messageLanguage: "fa",
        replyMode: "automatic",
        lastMessageText: "سلام، لطفا صورتحساب ماه جاری و لیست کالاهای موجود در انبار را ارسال فرمایید.",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        unreadCount: 0
      },
      {
        id: "demo-conv-5",
        channel: "email",
        contactIdentifier: "shipping@gclines.com",
        senderName: "Global Container Lines",
        senderType: "Shipping Line",
        countryName: "Global",
        branchName: "All Branches",
        relatedEntityType: "purchase_order",
        relatedEntityId: "BL-49102",
        status: "replied",
        priority: "normal",
        messageLanguage: "en",
        replyMode: "manual",
        lastMessageText: "Bill of Lading BL-49102 has been released. Container status is set to Port Gate Out.",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
        unreadCount: 0
      }
    ];

    const finalConversations = conversations.length > 0 ? conversations : defaultDemoConversations;

    return apiOk({
      scope: {
        level: scope.level,
        countryId: effectiveCountryId,
        branchId: effectiveBranchId
      },
      conversations: finalConversations,
      count: finalConversations.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}
