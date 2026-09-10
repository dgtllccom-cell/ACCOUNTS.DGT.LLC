import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import {
  humanizeTableName,
  isDeleteAction,
  deriveRiskLevel,
  buildEditHistoryReport
} from "@/lib/audit/edit-history-service";

// Reads the SAME real record_change_history data (via the SAME grouping logic)
// as the Reports Hub "Edit History" report - no second audit engine. This route
// exists only to reshape that real data into the EditHistoryRow[]/KPI contract
// the polished "+N Edits" pill UI (AllEditVersionHistoryView) expects.
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = resolveReportScope(session);
    const { searchParams } = new URL(request.url);

    const requestedCountryId = searchParams.get("countryId") || null;
    const requestedBranchId = searchParams.get("cityBranchId") || null;
    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      scope,
      requestedCountryId === "all" ? null : requestedCountryId,
      requestedBranchId === "all" ? null : requestedBranchId
    );

    const moduleName = searchParams.get("module");
    const userFilter = searchParams.get("user");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const search = searchParams.get("search")?.trim().toLowerCase() || null;
    const limit = Math.min(Number(searchParams.get("limit") || 50), 500);
    const offset = Number(searchParams.get("offset") || 0);

    const result = await withLocalPg(async (sql) => {
      const countryRows = effectiveCountryId
        ? await sql`select id, name from public.countries where deleted_at is null and id = ${effectiveCountryId}::uuid limit 1`
        : [{ id: "all", name: "All Countries" }];
      if (!countryRows[0]) return null;
      const countryName = countryRows[0].name as string;

      const mainBranches = await sql`
        select id, name, code, country_id
        from public.country_branches
        where deleted_at is null ${effectiveCountryId ? sql`and country_id = ${effectiveCountryId}::uuid` : sql``}
        order by name
      `;
      const cityBranches = await sql`
        select id, name, code, country_id, country_branch_id
        from public.city_branches
        where deleted_at is null ${effectiveCountryId ? sql`and country_id = ${effectiveCountryId}::uuid` : sql``}
        order by name
      `;

      let historyRows = (await sql`
        select id, record_table, record_id, country_id, city_branch_id, action, actor_id, approval_request_id, before_data, after_data, created_at
        from public.record_change_history
        where 1=1
          ${effectiveCountryId ? sql`and country_id = ${effectiveCountryId}::uuid` : sql``}
          ${effectiveBranchId ? sql`and city_branch_id = ${effectiveBranchId}::uuid` : sql``}
        order by created_at desc
        limit 5000
      `) as any[];

      if (userFilter) historyRows = historyRows.filter((row) => row.actor_id === userFilter);
      if (fromDate) historyRows = historyRows.filter((row) => String(row.created_at).slice(0, 10) >= fromDate);
      if (toDate) historyRows = historyRows.filter((row) => String(row.created_at).slice(0, 10) <= toDate);
      if (moduleName) {
        historyRows = historyRows.filter((row) => humanizeTableName(String(row.record_table)).toLowerCase() === moduleName.toLowerCase() || row.record_table === moduleName);
      }

      const actorIds = [...new Set(historyRows.map((row) => row.actor_id).filter(Boolean))];
      const profiles = actorIds.length
        ? (await sql`select id, full_name, user_code from public.profiles where deleted_at is null and id = any(${actorIds})`)
        : [];
      const assignments = actorIds.length
        ? (await sql`select user_id, role, country_id, country_branch_id, city_branch_id from public.user_role_assignments where is_active = true and deleted_at is null and user_id = any(${actorIds})`)
        : [];

      const report = buildEditHistoryReport({
        session,
        scopeLevel: scope.level,
        scopeLabel: scope.scopeLabel,
        countryName,
        mainBranches: mainBranches as any,
        cityBranches: cityBranches as any,
        profiles: profiles as any,
        assignments: assignments as any,
        rows: historyRows
      });

      return { report, mainBranches, cityBranches };
    });

    if (!result) return NextResponse.json({ success: true, records: [], total: 0, kpis: emptyKpis() });

    let records = result.report.data.map((row: any) => {
      const hasDelete = row.historyEntries.some((entry: any) => isDeleteAction(entry.action));
      const risk = deriveRiskLevel(row.editCount, hasDelete);
      return {
        entity_type: row.sourceTable,
        entity_id: row.historyRecordId.split(":").slice(1).join(":") || row.historyRecordId,
        reference_no: row.reference,
        module: row.module,
        country_id: null,
        country_name: row.country === "—" ? "Global" : row.country,
        city_branch_id: null,
        branch_name: row.cityBranch === "—" ? (row.mainBranch === "—" ? "Main Branch" : row.mainBranch) : row.cityBranch,
        party_name: null,
        user_id: row.loginUserId,
        user_name: row.user,
        user_role: row.role,
        risk_level: risk,
        approval_status: "Completed" as const,
        version_number: row.editCount + 1,
        total_versions: row.editCount + 1,
        edit_count: row.editCount,
        original_created_at: row.historyEntries[0]?.created_at || row.lastEdited,
        created_at: row.lastEdited
      };
    });

    if (search) {
      records = records.filter((r: any) =>
        String(r.reference_no || "").toLowerCase().includes(search) ||
        String(r.module || "").toLowerCase().includes(search) ||
        String(r.user_name || "").toLowerCase().includes(search)
      );
    }

    const total = records.length;
    const paged = records.slice(offset, offset + limit);

    const todayStr = new Date().toISOString().slice(0, 10);
    const kpis = {
      editsToday: records.filter((r: any) => String(r.created_at).slice(0, 10) === todayStr).length,
      pendingApprovals: 0,
      highRiskChanges: records.filter((r: any) => r.risk_level === "High").length,
      expiredAccess: 0,
      totalCountries: new Set(records.map((r: any) => r.country_name)).size,
      totalBranches: new Set(records.map((r: any) => r.branch_name)).size
    };

    return NextResponse.json({ success: true, records: paged, total, kpis, timelineByRecord: result.report.history });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to fetch edit history." }, { status: 500 });
  }
}

function emptyKpis() {
  return { editsToday: 0, pendingApprovals: 0, highRiskChanges: 0, expiredAccess: 0, totalCountries: 0, totalBranches: 0 };
}
