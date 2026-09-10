import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import {
  asObject,
  extractBranchNames,
  extractReference,
  humanizeTableName,
  normalizeActorRole,
  deriveRiskLevel
} from "@/lib/audit/edit-history-service";

// Real Deleted Entries Audit: reads delete actions directly out of
// record_change_history - the same table Edit History reads - instead of the
// orphaned enterprise_audit_events table. Deleting an operational record never
// deletes its audit trail; this route only ever reads, never writes.
// Security: no password/token/secret columns exist on record_change_history
// snapshots for the modules that write it (banks/companies/customers/goods),
// and none are ever selected or echoed back here.
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

    const moduleName = searchParams.get("module") || searchParams.get("entityType");
    const deletedBy = searchParams.get("deletedBy");
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
      `;
      const cityBranches = await sql`
        select id, name, code, country_id, country_branch_id
        from public.city_branches
        where deleted_at is null ${effectiveCountryId ? sql`and country_id = ${effectiveCountryId}::uuid` : sql``}
      `;

      const deleteRows = (await sql`
        select id, record_table, record_id, country_id, city_branch_id, action, actor_id, approval_request_id, before_data, after_data, created_at
        from public.record_change_history
        where action ilike '%delete%'
          ${effectiveCountryId ? sql`and country_id = ${effectiveCountryId}::uuid` : sql``}
          ${effectiveBranchId ? sql`and city_branch_id = ${effectiveBranchId}::uuid` : sql``}
        order by created_at desc
        limit 2000
      `) as any[];

      const actorIds = [...new Set(deleteRows.map((r) => r.actor_id).filter(Boolean))];
      const profiles = actorIds.length
        ? (await sql`select id, full_name, user_code from public.profiles where deleted_at is null and id = any(${actorIds})`)
        : [];
      const assignments = actorIds.length
        ? (await sql`select user_id, role, country_id, country_branch_id, city_branch_id from public.user_role_assignments where is_active = true and deleted_at is null and user_id = any(${actorIds})`)
        : [];

      return { deleteRows, mainBranches, cityBranches, profiles, assignments, countryName };
    });

    if (!result) return NextResponse.json({ success: true, records: [], total: 0, kpis: emptyKpis() });

    const mainBranchMap = new Map(result.mainBranches.map((r: any) => [r.id, r]));
    const cityBranchMap = new Map(result.cityBranches.map((r: any) => [r.id, r]));
    const profileMap = new Map(result.profiles.map((r: any) => [r.id, r]));
    const assignmentsByUserId = new Map<string, any[]>();
    for (const a of result.assignments as any[]) {
      const list = assignmentsByUserId.get(a.user_id) ?? [];
      list.push(a);
      assignmentsByUserId.set(a.user_id, list);
    }

    let records = result.deleteRows.map((row: any) => {
      const snapshot = asObject(row.before_data) ?? asObject(row.after_data) ?? {};
      const scopeInfo = extractBranchNames(snapshot, new Map([[String(row.country_id ?? ""), result.countryName]]), mainBranchMap as any, cityBranchMap as any);
      const actorId = String(row.actor_id || "");
      const profile = profileMap.get(actorId) as any;
      const module = humanizeTableName(String(row.record_table));
      const reference = extractReference(String(row.record_table), snapshot, String(row.record_id));
      const partyName = typeof snapshot.party_name === "string" ? snapshot.party_name
        : typeof snapshot.customer_name === "string" ? snapshot.customer_name
        : typeof snapshot.name === "string" ? snapshot.name
        : null;
      const amount = typeof snapshot.amount === "number" ? snapshot.amount
        : typeof snapshot.total_amount === "number" ? snapshot.total_amount
        : null;
      return {
        id: row.id,
        entity_type: row.record_table,
        entity_id: row.record_id,
        reference_no: reference,
        module,
        version_number: 1,
        party_name: partyName,
        amount,
        currency: typeof snapshot.currency === "string" ? snapshot.currency : null,
        user_id: actorId || null,
        user_name: profile?.full_name || profile?.user_code || actorId || "—",
        user_role: normalizeActorRole(actorId || null, assignmentsByUserId as any),
        country_id: row.country_id,
        country_name: scopeInfo.countryName === "—" ? "Global" : scopeInfo.countryName,
        city_branch_id: row.city_branch_id,
        branch_name: scopeInfo.cityBranchName !== "—" ? scopeInfo.cityBranchName : (scopeInfo.mainBranchName !== "—" ? scopeInfo.mainBranchName : "Main Branch"),
        reason: null,
        risk_level: deriveRiskLevel(0, true),
        review_status: "Reviewed" as const,
        deleted_at: row.created_at,
        original_date: row.created_at,
        previous_edit_count: 0,
        is_restored: false
      };
    });

    if (moduleName) records = records.filter((r: any) => r.module.toLowerCase() === moduleName.toLowerCase() || r.entity_type === moduleName);
    if (deletedBy) records = records.filter((r: any) => r.user_id === deletedBy);
    if (fromDate) records = records.filter((r: any) => String(r.deleted_at).slice(0, 10) >= fromDate);
    if (toDate) records = records.filter((r: any) => String(r.deleted_at).slice(0, 10) <= toDate);
    if (search) {
      records = records.filter((r: any) =>
        String(r.reference_no || "").toLowerCase().includes(search) ||
        String(r.module || "").toLowerCase().includes(search) ||
        String(r.user_name || "").toLowerCase().includes(search) ||
        String(r.party_name || "").toLowerCase().includes(search)
      );
    }

    const total = records.length;
    const paged = records.slice(offset, offset + limit);

    const todayStr = new Date().toISOString().slice(0, 10);
    const kpis = {
      deletedToday: records.filter((r: any) => String(r.deleted_at).slice(0, 10) === todayStr).length,
      pendingReview: 0,
      highRiskDeletions: records.filter((r: any) => r.risk_level === "High").length,
      restoredRecords: 0,
      totalCountries: new Set(records.map((r: any) => r.country_name)).size,
      totalBranches: new Set(records.map((r: any) => r.branch_name)).size
    };

    return NextResponse.json({ success: true, records: paged, total, kpis });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to fetch deleted records." }, { status: 500 });
  }
}

function emptyKpis() {
  return { deletedToday: 0, pendingReview: 0, highRiskDeletions: 0, restoredRecords: 0, totalCountries: 0, totalBranches: 0 };
}
