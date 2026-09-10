import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { canAccessCountry } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { asObject, buildHistoryTimeline, extractReference, humanizeTableName, normalizeActorRole } from "@/lib/audit/edit-history-service";

// Real deleted-record detail: the delete event plus its full lifecycle
// (Original -> Edit #1 ... -> the delete), all read from record_change_history.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    const result = await withLocalPg(async (sql) => {
      const deleteEventRows = (await sql`
        select id, record_table, record_id, country_id, city_branch_id, action, actor_id, approval_request_id, before_data, after_data, created_at
        from public.record_change_history
        where id = ${id}::uuid
        limit 1
      `) as any[];
      if (!deleteEventRows.length) return null;
      const deleteEvent = deleteEventRows[0];

      const lifecycleRows = (await sql`
        select id, record_table, record_id, country_id, city_branch_id, action, actor_id, approval_request_id, before_data, after_data, created_at
        from public.record_change_history
        where record_table = ${deleteEvent.record_table} and record_id = ${deleteEvent.record_id}
        order by created_at asc
      `) as any[];

      const actorIds = [...new Set(lifecycleRows.map((r) => r.actor_id).filter(Boolean))];
      const [profiles, assignments] = actorIds.length
        ? await Promise.all([
            sql`select id, full_name, user_code from public.profiles where deleted_at is null and id = any(${actorIds})`,
            sql`select user_id, role, country_id, country_branch_id, city_branch_id from public.user_role_assignments where is_active = true and deleted_at is null and user_id = any(${actorIds})`
          ])
        : [[], []];

      return { deleteEvent, lifecycleRows, profiles, assignments };
    });

    if (!result) return NextResponse.json({ error: "Deleted record not found." }, { status: 404 });

    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      if (result.deleteEvent.country_id && !canAccessCountry(session, result.deleteEvent.country_id)) {
        return NextResponse.json({ error: "Access denied to foreign country record audit trail." }, { status: 403 });
      }
    }

    const profileMap = new Map(result.profiles.map((r: any) => [r.id, r]));
    const assignmentsByUserId = new Map<string, any[]>();
    for (const a of result.assignments as any[]) {
      const list = assignmentsByUserId.get(a.user_id) ?? [];
      list.push(a);
      assignmentsByUserId.set(a.user_id, list);
    }

    const snapshot = asObject(result.deleteEvent.before_data) ?? asObject(result.deleteEvent.after_data) ?? {};
    const actorId = String(result.deleteEvent.actor_id || "");
    const profile = profileMap.get(actorId) as any;

    const deletedRecord = {
      id: result.deleteEvent.id,
      entity_type: result.deleteEvent.record_table,
      entity_id: result.deleteEvent.record_id,
      reference_no: extractReference(String(result.deleteEvent.record_table), snapshot, String(result.deleteEvent.record_id)),
      module: humanizeTableName(String(result.deleteEvent.record_table)),
      previous_snapshot: snapshot,
      current_snapshot: null,
      party_name: typeof snapshot.party_name === "string" ? snapshot.party_name : typeof snapshot.customer_name === "string" ? snapshot.customer_name : null,
      amount: typeof snapshot.amount === "number" ? snapshot.amount : null,
      currency: typeof snapshot.currency === "string" ? snapshot.currency : null,
      user_id: actorId || null,
      user_name: profile?.full_name || profile?.user_code || actorId || "—",
      user_role: normalizeActorRole(actorId || null, assignmentsByUserId as any),
      country_id: result.deleteEvent.country_id,
      city_branch_id: result.deleteEvent.city_branch_id,
      reason: null,
      is_restored: false,
      deleted_at: result.deleteEvent.created_at,
      created_at: result.deleteEvent.created_at
    };

    const lifecycleTimeline = buildHistoryTimeline(result.lifecycleRows).map((entry: any, index: number) => {
      const entryActorId = String(entry.actor_id || "");
      const entryProfile = profileMap.get(entryActorId) as any;
      return {
        id: entry.id,
        entity_type: result.deleteEvent.record_table,
        entity_id: result.deleteEvent.record_id,
        reference_no: deletedRecord.reference_no,
        action_type: entry.action,
        version_number: index + 1,
        diff_changes: (entry.fields ?? []).map((f: any) => ({ field: f.field, label: f.field, oldValue: f.before, newValue: f.after, isHighRisk: false })),
        previous_snapshot: entry.beforeData,
        current_snapshot: entry.afterData,
        user_id: entryActorId || null,
        user_name: entryProfile?.full_name || entryProfile?.user_code || entryActorId || "—",
        user_role: normalizeActorRole(entryActorId || null, assignmentsByUserId as any),
        reason: entry.reason || null,
        created_at: entry.created_at,
        is_deleted: entry.action === result.deleteEvent.action && entry.created_at === result.deleteEvent.created_at,
        is_restored: false
      };
    });

    return NextResponse.json({ success: true, data: { deletedRecord, lifecycleTimeline } });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to fetch deleted record details." }, { status: 500 });
  }
}
