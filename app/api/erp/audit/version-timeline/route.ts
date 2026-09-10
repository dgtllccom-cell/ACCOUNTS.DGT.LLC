import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { canAccessCountry } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { buildHistoryTimeline, normalizeActorRole, extractBranchNames } from "@/lib/audit/edit-history-service";

// Real per-record version timeline, read directly from record_change_history -
// the same table and grouping logic (buildHistoryTimeline) the Reports Hub
// Edit History "+ expand" panel already uses. entityType is the record's
// source table (record_table), entityId is its record_id.
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required parameters." }, { status: 400 });
    }

    const result = await withLocalPg(async (sql) => {
      const rows = (await sql`
        select id, record_table, record_id, country_id, city_branch_id, action, actor_id, approval_request_id, before_data, after_data, created_at
        from public.record_change_history
        where record_table = ${entityType} and record_id = ${entityId}
        order by created_at asc
      `) as any[];
      if (!rows.length) return { rows: [], mainBranches: [], cityBranches: [], profiles: [], assignments: [] };

      const countryId = rows[0].country_id;
      const [mainBranches, cityBranches] = await Promise.all([
        sql`select id, name, code, country_id from public.country_branches where deleted_at is null ${countryId ? sql`and country_id = ${countryId}::uuid` : sql``}`,
        sql`select id, name, code, country_id, country_branch_id from public.city_branches where deleted_at is null ${countryId ? sql`and country_id = ${countryId}::uuid` : sql``}`
      ]);
      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
      const [profiles, assignments] = actorIds.length
        ? await Promise.all([
            sql`select id, full_name, user_code from public.profiles where deleted_at is null and id = any(${actorIds})`,
            sql`select user_id, role, country_id, country_branch_id, city_branch_id from public.user_role_assignments where is_active = true and deleted_at is null and user_id = any(${actorIds})`
          ])
        : [[], []];
      return { rows, mainBranches, cityBranches, profiles, assignments };
    });

    if (!result) {
      return NextResponse.json({ success: true, entityType, entityId, totalVersions: 0, timeline: [] });
    }

    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      const firstRow = result.rows[0];
      if (firstRow?.country_id && !canAccessCountry(session, firstRow.country_id)) {
        return NextResponse.json({ error: "Access denied to foreign country record audit trail." }, { status: 403 });
      }
    }

    const mainBranchMap = new Map(result.mainBranches.map((r: any) => [r.id, r]));
    const cityBranchMap = new Map(result.cityBranches.map((r: any) => [r.id, r]));
    const profileMap = new Map(result.profiles.map((r: any) => [r.id, r]));
    const assignmentsByUserId = new Map<string, any[]>();
    for (const a of result.assignments as any[]) {
      const list = assignmentsByUserId.get(a.user_id) ?? [];
      list.push(a);
      assignmentsByUserId.set(a.user_id, list);
    }

    const versions = buildHistoryTimeline(result.rows).map((entry: any, index: number) => {
      const snapshot = entry.afterData ?? entry.beforeData ?? {};
      const actorId = String(entry.actor_id || "");
      const profile = profileMap.get(actorId) as any;
      const scope = extractBranchNames(snapshot, new Map(), mainBranchMap as any, cityBranchMap as any);
      return {
        id: entry.id,
        version_number: index + 1,
        action_type: entry.action,
        reference_no: entityId,
        entity_id: entityId,
        entity_type: entityType,
        created_at: entry.created_at,
        actor_id: actorId || null,
        user_name: profile?.full_name || profile?.user_code || actorId || "—",
        role: normalizeActorRole(actorId || null, assignmentsByUserId as any),
        country_name: scope.countryName,
        branch_name: scope.cityBranchName !== "—" ? scope.cityBranchName : scope.mainBranchName,
        reason: entry.reason || null,
        diff_changes: (entry.fields ?? []).map((f: any) => ({
          field: f.field,
          label: f.field,
          oldValue: f.before,
          newValue: f.after,
          isHighRisk: false
        }))
      };
    });

    return NextResponse.json({
      success: true,
      entityType,
      entityId,
      totalVersions: versions.length,
      timeline: versions
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to fetch version timeline." }, { status: 500 });
  }
}
