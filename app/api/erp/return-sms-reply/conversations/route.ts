import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Uses cookies() via requireErpSession — must be dynamic
export const dynamic = "force-dynamic";

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

    // Live records only — no demo/sample conversations. The inbox view renders its own
    // empty state when the list is empty (consistent with the rest of the ERP).
    return apiOk({
      scope: {
        level: scope.level,
        countryId: effectiveCountryId,
        branchId: effectiveBranchId
      },
      conversations,
      count: conversations.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}
