import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

const reportTypes = ["ledger", "bills", "payments", "sales", "purchase", "user-activity", "edit-history", "employee", "branch", "project"] as const;
const scopeModes = ["entire-country", "main-branch", "city-branch"] as const;

const querySchema = z.object({
  reportType: z.enum(reportTypes).default("ledger"),
  countryId: z.string().optional().or(z.literal("all")).or(z.literal("")),
  scopeMode: z.enum(scopeModes).default("entire-country"),
  mainBranchId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  project: z.string().max(200).optional(),
  userId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  currency: z.string().max(8).optional(),
  lang: z.enum(["en", "ur", "ar", "fa", "ps"]).default("en"),
  limit: z.coerce.number().int().min(1).max(2000).default(1000)
});

type JsonRecord = Record<string, unknown>;

function asObject(value: unknown): JsonRecord | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function projectName(value: unknown): string | null {
  const data = asObject(value);
  if (!data) return null;
  for (const key of ["projectName", "project_name", "project", "projectTitle", "project_title"]) {
    const candidate = data[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    const nested = asObject(candidate);
    if (nested) {
      const name = nested.name ?? nested.title;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  for (const key of ["details", "metadata", "header", "booking", "order"]) {
    const nested = projectName(data[key]);
    if (nested) return nested;
  }
  return null;
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireQuery(result: { data: any; error: { message: string } | null }, label: string): any {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function changedFields(before: unknown, after: unknown) {
  const left = asObject(before) ?? {};
  const right = asObject(after) ?? {};
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
}

function humanizeTableName(tableName: string) {
  const moduleLabels: Record<string, string> = {
    purchase_orders: "Purchase",
    sales_orders: "Sales",
    purchase_order_payments: "Purchase Payment",
    sales_order_payments: "Sales Payment",
    purchase_loading_records: "Loading",
    product_warehouse_mapping: "Warehouse Mapping",
    customers: "Customer",
    companies: "Company",
    banks: "Bank",
    warehouses: "Warehouse",
    employees: "Employee",
    ledger_posting_batches: "Ledger",
    ledger_posting_lines: "Ledger Line",
    roznamcha_entries: "Roznamcha",
    roznamcha_lines: "Roznamcha Line",
    approval_requests: "Approval",
    approval_status_history: "Approval Status History",
    record_change_history: "Audit History",
    daily_usd_rates: "Exchange Rate",
    cash_bank_entries: "Cash / Bank",
    daily_entries: "Daily Entry",
    endorsement_entries: "Endorsement"
  };
  return moduleLabels[tableName] ?? tableName.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function pickFirstText(source: JsonRecord | null, keys: string[]) {
  if (!source) return null;
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function extractReference(tableName: string, snapshot: JsonRecord | null, recordId: string) {
  const lookupKeys: Record<string, string[]> = {
    purchase_orders: ["purchase_order_no", "purchase_contract_no", "reference_no", "serial_no"],
    sales_orders: ["sales_order_no", "sales_contract_no", "reference_no", "serial_no"],
    purchase_order_payments: ["reference_no", "source_reference_no", "purchase_order_no"],
    sales_order_payments: ["manual_reference_number", "customer_number", "reference_no", "sales_order_no"],
    purchase_loading_records: ["loading_record_no", "purchase_order_no", "reference_no"],
    customers: ["customer_name", "company_name", "reference_no", "customer_number"],
    companies: ["name", "legal_name", "reference_no"],
    banks: ["bank_name", "account_number", "short_name", "reference_no"],
    warehouses: ["warehouse_name", "warehouse_code", "entry_serial", "country_serial"],
    employees: ["employee_code", "entry_serial", "branch_serial", "country_serial"],
    ledger_posting_batches: ["reference_no", "voucher_no", "batch_no"],
    ledger_posting_lines: ["reference_no", "voucher_no", "batch_no"],
    roznamcha_entries: ["voucher_no", "reference_no", "entry_no"],
    roznamcha_lines: ["voucher_no", "reference_no", "entry_no"],
    approval_requests: ["request_no", "reference_no"],
    daily_usd_rates: ["rate_date", "reference_no"],
    cash_bank_entries: ["serial_no", "reference_no", "entry_no"],
    daily_entries: ["serial_no", "reference_no", "entry_no"],
    endorsement_entries: ["endorsement_no", "reference_no", "serial_no"]
  };
  const direct = pickFirstText(snapshot, lookupKeys[tableName] ?? ["reference_no", "serial_no", "entry_no", "voucher_no", "name", "bank_name", "warehouse_name", "employee_code", "customer_name"]);
  return direct || `${tableName}:${String(recordId).slice(0, 8)}`;
}

function extractBranchNames(
  snapshot: JsonRecord | null,
  countriesById: Map<string, string>,
  mainBranchesById: Map<string, { name: string; code?: string | null }>,
  cityBranchesById: Map<string, { name: string; code?: string | null; country_branch_id?: string | null }>
) {
  const countryId = typeof snapshot?.country_id === "string" ? snapshot.country_id : null;
  const countryName = countryId ? countriesById.get(countryId) ?? countryId : "—";
  const cityBranchId = typeof snapshot?.city_branch_id === "string" ? snapshot.city_branch_id : null;
  const mainBranchId = typeof snapshot?.country_branch_id === "string"
    ? snapshot.country_branch_id
    : cityBranchId
      ? cityBranchesById.get(cityBranchId)?.country_branch_id ?? null
      : null;
  const cityBranchName = cityBranchId ? cityBranchesById.get(cityBranchId)?.name ?? cityBranchId : "—";
  const mainBranchName = mainBranchId ? mainBranchesById.get(mainBranchId)?.name ?? mainBranchId : "—";
  return { countryName, mainBranchName, cityBranchName, countryId, mainBranchId, cityBranchId };
}

function normalizeActorRole(
  actorId: string | null,
  assignmentsByUserId: Map<string, Array<{ role: string; country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }>>
) {
  if (!actorId) return "—";
  const assignments = assignmentsByUserId.get(actorId) ?? [];
  if (!assignments.length) return "—";
  const priority = assignments.find((assignment) => assignment.city_branch_id) ?? assignments.find((assignment) => assignment.country_branch_id) ?? assignments[0];
  return priority?.role ?? "—";
}

function isEditingAction(action: string) {
  const normalized = String(action || "").toLowerCase();
  return !["create", "insert", "created", "new", "initial", "original"].includes(normalized);
}

function labelForVersion(index: number, totalVersions: number, action: string) {
  if (index === 0) return "Original";
  if (index === totalVersions - 1) return "Current Version";
  const normalized = String(action || "").toLowerCase();
  if (normalized.includes("delete") || normalized.includes("void") || normalized.includes("cancel") || normalized.includes("reverse")) return `Void / Cancel #${index}`;
  return `Edit #${index}`;
}

function buildHistoryTimeline(entryRows: Array<any>) {
  const ordered = [...entryRows].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const versions: Array<any> = [];
  const originalSource = ordered[0];
  if (originalSource) {
    const originalSnapshot = asObject(originalSource.before_data) ?? asObject(originalSource.after_data) ?? {};
    versions.push({
      id: `${originalSource.id}:original`,
      versionLabel: "Original",
      action: originalSource.action,
      created_at: originalSource.created_at,
      actor_id: originalSource.actor_id ?? null,
      loginUserId: originalSource.actor_id ?? null,
      role: "—",
      country_id: originalSource.country_id ?? null,
      city_branch_id: originalSource.city_branch_id ?? null,
      reason: originalSource.reason ?? null,
      changedFields: changedFields(null, originalSnapshot),
      beforeData: null,
      afterData: originalSnapshot,
      fields: Object.entries(originalSnapshot).map(([field, after]) => ({ field, before: null, after }))
    });
  }

  ordered.slice(1).forEach((row, index) => {
    const beforeData = asObject(row.before_data) ?? null;
    const afterData = asObject(row.after_data) ?? null;
    versions.push({
      id: row.id,
      versionLabel: `Edit #${index + 1}`,
      action: row.action,
      created_at: row.created_at,
      actor_id: row.actor_id ?? null,
      loginUserId: row.actor_id ?? null,
      role: "—",
      country_id: row.country_id ?? null,
      city_branch_id: row.city_branch_id ?? null,
      reason: null,
      changedFields: changedFields(beforeData, afterData),
      beforeData,
      afterData,
      fields: changedFields(beforeData, afterData).map((field) => ({ field, before: beforeData?.[field] ?? null, after: afterData?.[field] ?? null }))
    });
  });

  const lastSource = ordered[ordered.length - 1];
  if (lastSource) {
    const lastSnapshot = asObject(lastSource.after_data) ?? asObject(lastSource.before_data) ?? {};
    versions.push({
      id: `${lastSource.id}:current`,
      versionLabel: "Current Version",
      action: "current",
      created_at: lastSource.created_at,
      actor_id: lastSource.actor_id ?? null,
      loginUserId: lastSource.actor_id ?? null,
      role: "—",
      country_id: lastSource.country_id ?? null,
      city_branch_id: lastSource.city_branch_id ?? null,
      reason: null,
      changedFields: changedFields(asObject(lastSource.before_data), lastSnapshot),
      beforeData: asObject(lastSource.before_data) ?? null,
      afterData: lastSnapshot,
      fields: Object.entries(lastSnapshot).map(([field, after]) => ({ field, before: null, after }))
    });
  }

  return versions;
}

function buildEditHistoryReport(payload: {
  session: Awaited<ReturnType<typeof requireErpSession>>;
  scopeLevel: "global" | "country" | "branch";
  scopeLabel: string;
  countryName: string;
  mainBranches: Array<{ id: string; name: string; code?: string | null }>;
  cityBranches: Array<{ id: string; name: string; code?: string | null; country_branch_id?: string | null }>;
  profiles: Array<{ id: string; full_name?: string | null; user_code?: string | null }>;
  assignments: Array<{ user_id: string; role: string; country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }>;
  rows: Array<any>;
}) {
  const { session, scopeLevel, scopeLabel, countryName, mainBranches, cityBranches, profiles, assignments, rows } = payload;
  const profileMap = new Map(profiles.map((row) => [row.id, row]));
  const mainBranchMap = new Map(mainBranches.map((row) => [row.id, row]));
  const cityBranchMap = new Map(cityBranches.map((row) => [row.id, row]));
  const assignmentsByUserId = new Map<string, Array<{ role: string; country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }>>();
  for (const assignment of assignments) {
    const current = assignmentsByUserId.get(assignment.user_id) ?? [];
    current.push(assignment);
    assignmentsByUserId.set(assignment.user_id, current);
  }

  const approvalIds = [...new Set(rows.map((row) => row.approval_request_id).filter(Boolean))];
  const approvalMap = new Map<string, { reason?: string | null; rejection_reason?: string | null }>();
  if (approvalIds.length) {
    // populated by the caller when available
  }

  const grouped = new Map<string, Array<any>>();
  for (const row of rows) {
    const key = `${row.record_table}:${row.record_id}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const groupRows = [...grouped.entries()].map(([historyRecordId, entries]) => {
    const ordered = [...entries].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const last = ordered[ordered.length - 1];
    const latestSnapshot = asObject(last.after_data) ?? asObject(last.before_data) ?? {};
    const firstSnapshot = asObject(ordered[0]?.before_data) ?? asObject(ordered[0]?.after_data) ?? {};
    const scope = extractBranchNames(latestSnapshot, new Map([[String(last.country_id ?? latestSnapshot.country_id ?? ""), countryName]]), mainBranchMap, cityBranchMap);
    const actorId = String(last.actor_id || ordered[0]?.actor_id || "");
    const profile = profileMap.get(actorId);
    const user = profile?.full_name || profile?.user_code || actorId || "—";
    const role = normalizeActorRole(actorId || null, assignmentsByUserId);
    const editCount = ordered.filter((entry) => isEditingAction(entry.action)).length;
    const module = humanizeTableName(String(last.record_table || ordered[0]?.record_table || "record"));
    const reference = extractReference(String(last.record_table || ordered[0]?.record_table || "record"), latestSnapshot, String(last.record_id || ordered[0]?.record_id || ""));
    const historyKey = historyRecordId;
    const history = buildHistoryTimeline(ordered).map((entry) => {
      const snapshot = asObject(entry.afterData) ?? asObject(entry.beforeData) ?? {};
      const entryActorId = String(entry.actor_id || "");
      const entryProfile = profileMap.get(entryActorId);
      const entryScope = extractBranchNames(snapshot, new Map([[String(entry.country_id ?? latestSnapshot.country_id ?? ""), countryName]]), mainBranchMap, cityBranchMap);
      const entryRole = normalizeActorRole(entryActorId || null, assignmentsByUserId);
      const approvalReason = approvalIds.includes(entry.id) ? approvalMap.get(entry.id)?.reason ?? approvalMap.get(entry.id)?.rejection_reason ?? null : null;
      return {
        ...entry,
        user: entryProfile?.full_name || entryProfile?.user_code || entryActorId || "—",
        loginUserId: entryActorId || "—",
        role: entryRole,
        country: entryScope.countryName,
        mainBranch: entryScope.mainBranchName,
        cityBranch: entryScope.cityBranchName,
        reason: entry.reason || approvalReason || null,
        changedFields: entry.changedFields ?? [],
        beforeData: entry.beforeData ?? null,
        afterData: entry.afterData ?? null,
        fields: entry.fields ?? []
      };
    });

    const orderedHistory = history.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return {
      id: historyKey,
      historyRecordId,
      module,
      reference,
      country: scope.countryName,
      mainBranch: scope.mainBranchName,
      cityBranch: scope.cityBranchName,
      user,
      loginUserId: actorId || "—",
      role,
      editCount,
      lastEdited: last.created_at,
      history: `${editCount}+`,
      status: editCount > 0 ? "edited" : "created",
      sourceTable: String(last.record_table || ordered[0]?.record_table || "record_change_history"),
      historyEntries: orderedHistory,
      currentVersion: latestSnapshot,
      originalVersion: firstSnapshot
    };
  });

  const data = groupRows.sort((a, b) => String(b.lastEdited || "").localeCompare(String(a.lastEdited || "")));
  const history = Object.fromEntries(data.map((row) => [row.historyRecordId, row.historyEntries]));
  return {
    reportType: "edit-history",
    data,
    summary: {
      totalRecords: data.length,
      totalEditCount: data.reduce((sum, row) => sum + Number(row.editCount || 0), 0)
    },
    history,
    sourceTables: [...new Set(rows.map((row) => row.record_table).filter(Boolean)), "record_change_history"],
    generatedAt: new Date().toISOString(),
    generatedBy: { id: session.userId, name: session.fullName || session.email || session.userId },
    applied: { country: countryName, scopeMode: "edit-history" },
    scope: { level: scopeLevel, label: scopeLabel }
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const scope = resolveReportScope(session);
    const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    if (params.reportType === "edit-history" && !session.isSuperAdmin) {
      throw new Error("Edit history reports are restricted to Super Admin users.");
    }

    const isGlobalCountry = !params.countryId || params.countryId === "all";
    const targetCountryId = isGlobalCountry ? null : params.countryId;

    if (!session.isSuperAdmin && targetCountryId && !session.countryIds.includes(targetCountryId)) {
      throw new Error("Requested country is outside the signed-in user's report scope.");
    }
    if (params.scopeMode === "main-branch" && !params.mainBranchId) throw new Error("Main branch is required for Main Branch scope.");
    if (params.scopeMode === "city-branch" && !params.branchId) throw new Error("City branch is required for City Branch scope.");
    if (!session.isSuperAdmin && params.mainBranchId && !session.countryBranchIds.includes(params.mainBranchId)) {
      throw new Error("Requested main branch is outside the signed-in user's report scope.");
    }
    if (!session.isSuperAdmin && params.branchId && !session.cityBranchIds.includes(params.branchId)) {
      throw new Error("Requested city branch is outside the signed-in user's report scope.");
    }

    const localPgResponse = await withLocalPg(async (sql) => {
      const countryRows = targetCountryId
        ? await sql`
            select id, name, currency_code
            from public.countries
            where deleted_at is null and id = ${targetCountryId}::uuid
            limit 1
          `
        : [{ id: "all", name: "All Countries", currency_code: "USD" }];
      if (!countryRows[0]) return null;

      const branchRows = (params.scopeMode === "main-branch" && params.mainBranchId)
        ? await sql`
            select id, name, code, country_id
            from public.country_branches
            where deleted_at is null
              and id = ${params.mainBranchId}::uuid
              ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
            limit 1
          `
        : [];
      const cityRows = (params.scopeMode === "city-branch" && params.branchId)
        ? await sql`
            select id, name, code, country_id, country_branch_id
            from public.city_branches
            where deleted_at is null
              and id = ${params.branchId}::uuid
              ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
            limit 1
          `
        : [];

      if (params.reportType === "edit-history") {
        const allMainBranches = await sql`
          select id, name, code, country_id
          from public.country_branches
          where deleted_at is null ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
          order by name
        `;
        const allCityBranches = await sql`
          select id, name, code, country_id, country_branch_id
          from public.city_branches
          where deleted_at is null ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
          order by name
        `;
        let historyRows = (await sql`
          select id, record_table, record_id, country_id, city_branch_id, action, actor_id, approval_request_id, before_data, after_data, created_at
          from public.record_change_history
          where 1=1 ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
          order by created_at desc
          limit ${params.limit}
        `) as any[];
        if (params.userId) {
          historyRows = historyRows.filter((row: any) => row.actor_id === params.userId);
        }
        if (params.fromDate) {
          const fDate = params.fromDate;
          historyRows = historyRows.filter((row: any) => String(row.created_at).slice(0, 10) >= fDate);
        }
        if (params.toDate) {
          const tDate = params.toDate;
          historyRows = historyRows.filter((row: any) => String(row.created_at).slice(0, 10) <= tDate);
        }
        const localizedMainBranches = await localizeRecordNames<any>(allMainBranches as any, "country_branches", "name", params.lang);
        const localizedCityBranches = await localizeRecordNames<any>(allCityBranches as any, "city_branches", "name", params.lang);
        const mainBranchMap = new Map((localizedMainBranches as any[]).map((row) => [row.id, row]));
        const cityBranchMap = new Map((localizedCityBranches as any[]).map((row) => [row.id, row]));
        const filteredHistoryRows = historyRows.filter((row: any) => {
          const snapshot = asObject(row.after_data) ?? asObject(row.before_data) ?? {};
          const scopeSnapshot = extractBranchNames(snapshot, new Map([[targetCountryId || "all", countryRows[0].name]]), mainBranchMap, cityBranchMap);
          if (params.scopeMode === "main-branch") {
            return scopeSnapshot.mainBranchId === params.mainBranchId && !scopeSnapshot.cityBranchId;
          }
          if (params.scopeMode === "city-branch") {
            return scopeSnapshot.cityBranchId === params.branchId;
          }
          return true;
        });
        const actorIds = [...new Set(filteredHistoryRows.map((row: any) => row.actor_id).filter(Boolean))];
        const profiles = actorIds.length
          ? (await sql`
              select id, full_name, user_code
              from public.profiles
              where deleted_at is null and id = any(${actorIds})
              order by full_name
            `) as any[]
          : [];
        const assignments = actorIds.length
          ? (await sql`
              select user_id, role, country_id, country_branch_id, city_branch_id
              from public.user_role_assignments
              where is_active = true and deleted_at is null and user_id = any(${actorIds})
            `) as any[]
          : [];
        return apiOk(buildEditHistoryReport({
          session,
          scopeLevel: scope.level,
          scopeLabel: scope.scopeLabel,
          countryName: countryRows[0].name,
          mainBranches: localizedMainBranches as Array<{ id: string; name: string; code?: string | null }>,
          cityBranches: localizedCityBranches as Array<{ id: string; name: string; code?: string | null; country_branch_id?: string | null }>,
          profiles: profiles as Array<{ id: string; full_name?: string | null; user_code?: string | null }>,
          assignments: assignments as Array<{ user_id: string; role: string; country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }>,
          rows: filteredHistoryRows
        }));
      }

      if (params.reportType === "branch") {
        const mbId = params.mainBranchId;
        const bId = params.branchId;
        const mainBranches = params.scopeMode !== "city-branch"
          ? (await sql`
              select id, name, code, status, local_currency, country_id, created_at, created_by, is_main
              from public.country_branches
              where deleted_at is null
                ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
                ${params.scopeMode === "main-branch" && mbId ? sql`and id = ${mbId}::uuid` : sql``}
              order by name
            `) as any[]
          : [];
        const cityBranches = params.scopeMode !== "main-branch"
          ? (await sql`
              select id, name, code, status, local_currency, country_id, country_branch_id, city_name, created_at, created_by
              from public.city_branches
              where deleted_at is null
                ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
                ${params.scopeMode === "city-branch" && bId ? sql`and id = ${bId}::uuid` : sql``}
              order by name
            `) as any[]
          : [];
        return apiOk({
          reportType: params.reportType,
          data: [
            ...mainBranches.map((row: any) => ({
              id: row.id,
              reference: row.code,
              branch: row.name,
              branchType: "main",
              country: countryRows[0].name,
              city: "—",
              currency: row.local_currency,
              status: row.status,
              user: row.created_by || "—",
              createdAt: row.created_at,
              sourceTable: "country_branches"
            })),
            ...cityBranches.map((row: any) => ({
              id: row.id,
              reference: row.code,
              branch: row.name,
              branchType: "city",
              country: countryRows[0].name,
              city: row.city_name,
              currency: row.local_currency,
              status: row.status,
              user: row.created_by || "—",
              createdAt: row.created_at,
              sourceTable: "city_branches"
            }))
          ],
          summary: {},
          history: {},
          sourceTables: ["country_branches", "city_branches"],
          generatedAt: new Date().toISOString(),
          generatedBy: { id: session.userId, name: session.fullName || session.email || session.userId },
          applied: {
            countryId: targetCountryId,
            country: countryRows[0].name,
            scopeMode: params.scopeMode,
            mainBranchId: params.mainBranchId || null,
            mainBranch: branchRows[0]?.name || null,
            branchId: params.branchId || null,
            branch: cityRows[0]?.name || null,
            project: params.project && params.project !== "all" ? params.project : null,
            userId: params.userId || null,
            fromDate: params.fromDate || null,
            toDate: params.toDate || null,
            currency: params.currency || "all",
            year: params.fromDate ? params.fromDate.slice(0, 4) : null
          },
          scope: { level: scope.level, label: scope.scopeLabel }
        });
      }

      if (params.reportType === "user-activity") {
        const mbId = params.mainBranchId;
        const bId = params.branchId;
        const assignments = (await sql`
          select user_id, country_id, country_branch_id, city_branch_id
          from public.user_role_assignments
          where is_active = true and deleted_at is null
            ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
            ${params.scopeMode === "main-branch" && mbId ? sql`and country_branch_id = ${mbId}::uuid and city_branch_id is null` : sql``}
            ${params.scopeMode === "city-branch" && bId ? sql`and city_branch_id = ${bId}::uuid` : sql``}
        `) as any[];
        const userIds = [...new Set(assignments.map((row: any) => row.user_id).filter(Boolean))];
        const profiles = userIds.length
          ? (await sql`
              select id, full_name, user_code
              from public.profiles
              where deleted_at is null and id = any(${userIds})
              order by full_name
            `) as any[]
          : [];
        let activities = (await sql`
          select id, created_at, actor_id, action, resource, record_id, record_table, metadata, ip_address, user_agent, country_id, country_branch_id, city_branch_id
          from public.erp_activity_events
          where 1=1 ${targetCountryId ? sql`and country_id = ${targetCountryId}::uuid` : sql``}
          order by created_at desc
          limit ${params.limit}
        `) as any[];
        if (params.scopeMode === "main-branch") {
          activities = activities.filter((row: any) => row.country_branch_id === params.mainBranchId && !row.city_branch_id);
        } else if (params.scopeMode === "city-branch") {
          activities = activities.filter((row: any) => row.city_branch_id === params.branchId);
        }
        if (params.fromDate) {
          const fDate = params.fromDate;
          activities = activities.filter((row: any) => String(row.created_at).slice(0, 10) >= fDate);
        }
        if (params.toDate) {
          const tDate = params.toDate;
          activities = activities.filter((row: any) => String(row.created_at).slice(0, 10) <= tDate);
        }
        if (params.userId) {
          activities = activities.filter((row: any) => row.actor_id === params.userId);
        }
        const profileMap = new Map((profiles as Array<{ id: string; full_name?: string | null; user_code?: string | null }>)
          .map((row) => [row.id, row]));
        return apiOk({
          reportType: params.reportType,
          data: activities.map((row: any) => ({
            id: row.id,
            date: row.created_at,
            user: profileMap.get(row.actor_id)?.full_name || profileMap.get(row.actor_id)?.user_code || row.actor_id || "—",
            action: row.action,
            resource: row.resource,
            reference: row.record_id || "—",
            description: asObject(row.metadata)?.description || asObject(row.metadata)?.message || "—",
            ip: String(row.ip_address || "—"),
            status: "logged",
            createdAt: row.created_at,
            sourceTable: row.record_table || "erp_activity_events"
          })),
          summary: {},
          history: {},
          sourceTables: ["erp_activity_events", "audit_logs", "record_change_history"],
          generatedAt: new Date().toISOString(),
          generatedBy: { id: session.userId, name: session.fullName || session.email || session.userId },
          applied: {
            countryId: targetCountryId,
            country: countryRows[0].name,
            scopeMode: params.scopeMode,
            mainBranchId: params.mainBranchId || null,
            mainBranch: branchRows[0]?.name || null,
            branchId: params.branchId || null,
            branch: cityRows[0]?.name || null,
            project: params.project && params.project !== "all" ? params.project : null,
            userId: params.userId || null,
            fromDate: params.fromDate || null,
            toDate: params.toDate || null,
            currency: params.currency || "all",
            year: params.fromDate ? params.fromDate.slice(0, 4) : null
          },
          scope: { level: scope.level, label: scope.scopeLabel }
        });
      }

      return null;
    });

    if (localPgResponse) {
      return apiOk(localPgResponse);
    }

    const db = await createServerSupabaseClient();
    const [countryResult, mainResult, cityResult] = await Promise.all([
      targetCountryId
        ? db.from("countries").select("id, name, currency_code").eq("id", targetCountryId).is("deleted_at", null).maybeSingle()
        : Promise.resolve({ data: { id: "all", name: "All Countries", currency_code: "USD" }, error: null }),
      params.mainBranchId
        ? (targetCountryId
            ? db.from("country_branches").select("id, name, code, country_id").eq("id", params.mainBranchId).eq("country_id", targetCountryId).is("deleted_at", null).maybeSingle()
            : db.from("country_branches").select("id, name, code, country_id").eq("id", params.mainBranchId).is("deleted_at", null).maybeSingle())
        : Promise.resolve({ data: null, error: null }),
      params.branchId
        ? (targetCountryId
            ? db.from("city_branches").select("id, name, code, country_id, country_branch_id").eq("id", params.branchId).eq("country_id", targetCountryId).is("deleted_at", null).maybeSingle()
            : db.from("city_branches").select("id, name, code, country_id, country_branch_id").eq("id", params.branchId).is("deleted_at", null).maybeSingle())
        : Promise.resolve({ data: null, error: null })
    ]);
    let country = requireQuery(countryResult, "Country lookup");
    let mainBranch = requireQuery(mainResult, "Main branch lookup");
    let cityBranch = requireQuery(cityResult, "City branch lookup");
    if (!country) throw new Error("Selected country was not found or is unavailable.");
    if (params.mainBranchId && !mainBranch) throw new Error("Selected main branch does not belong to the selected country.");
    if (params.branchId && !cityBranch) throw new Error("Selected city branch does not belong to the selected country.");
    if (params.scopeMode === "city-branch" && params.mainBranchId && cityBranch?.country_branch_id !== params.mainBranchId) {
      throw new Error("Selected city branch does not belong to the selected main branch.");
    }
    if (targetCountryId) {
      [country] = await localizeRecordNames([country], "countries", "name", params.lang);
    }
    if (mainBranch) [mainBranch] = await localizeRecordNames([mainBranch], "country_branches", "name", params.lang);
    if (cityBranch) [cityBranch] = await localizeRecordNames([cityBranch], "city_branches", "name", params.lang);

    const applyOrderScope = (query: any, dateField: string) => {
      query = query.is("deleted_at", null);
      if (targetCountryId) query = query.eq("country_id", targetCountryId);
      if (params.scopeMode === "main-branch" && params.mainBranchId) query = query.eq("country_branch_id", params.mainBranchId).is("city_branch_id", null);
      if (params.scopeMode === "city-branch" && params.branchId) query = query.eq("city_branch_id", params.branchId);
      if (params.fromDate) query = query.gte(dateField, params.fromDate);
      if (params.toDate) query = query.lte(dateField, params.toDate);
      if (params.userId) query = query.eq("created_by", params.userId);
      return query;
    };
    const currencyMatches = (rowCurrency: unknown) => !params.currency || params.currency === "all" || rowCurrency === params.currency;
    const projectMatches = (formData: unknown) => !params.project || params.project === "all" || projectName(formData) === params.project;

    let rows: JsonRecord[] = [];
    let summary: JsonRecord = {};
    let sourceTables: string[] = [];

    if (params.reportType === "edit-history") {
      let historyQuery = db.from("record_change_history")
        .select("id, record_table, record_id, country_id, city_branch_id, action, actor_id, approval_request_id, before_data, after_data, created_at")
        .order("created_at", { ascending: false })
        .limit(params.limit);
      if (targetCountryId) historyQuery = historyQuery.eq("country_id", targetCountryId);
      let historyRows = requireQuery(await historyQuery, "Edit history query") ?? [];
      if (params.userId) {
        historyRows = historyRows.filter((row: any) => row.actor_id === params.userId);
      }
      if (params.fromDate) {
        const fDate = params.fromDate;
        historyRows = historyRows.filter((row: any) => String(row.created_at).slice(0, 10) >= fDate);
      }
      if (params.toDate) {
        const tDate = params.toDate;
        historyRows = historyRows.filter((row: any) => String(row.created_at).slice(0, 10) <= tDate);
      }
      let mainBranchesQ = db.from("country_branches").select("id, name, code, country_id").is("deleted_at", null).order("name");
      if (targetCountryId) mainBranchesQ = mainBranchesQ.eq("country_id", targetCountryId);
      let cityBranchesQ = db.from("city_branches").select("id, name, code, country_id, country_branch_id").is("deleted_at", null).order("name");
      if (targetCountryId) cityBranchesQ = cityBranchesQ.eq("country_id", targetCountryId);
      let assignmentsQ = db.from("user_role_assignments").select("user_id, role, country_id, country_branch_id, city_branch_id").eq("is_active", true).is("deleted_at", null);
      if (targetCountryId) assignmentsQ = assignmentsQ.eq("country_id", targetCountryId);

      const [mainBranchesResult, cityBranchesResult, assignmentsResult] = await Promise.all([mainBranchesQ, cityBranchesQ, assignmentsQ]);
      const localizedMainBranches = await localizeRecordNames<any>(requireQuery(mainBranchesResult, "Edit history main branches query") ?? [], "country_branches", "name", params.lang);
      const localizedCityBranches = await localizeRecordNames<any>(requireQuery(cityBranchesResult, "Edit history city branches query") ?? [], "city_branches", "name", params.lang);
      const mainBranchMap = new Map((localizedMainBranches as any[]).map((row) => [row.id, row]));
      const cityBranchMap = new Map((localizedCityBranches as any[]).map((row) => [row.id, row]));
      const filteredHistoryRows = historyRows.filter((row: any) => {
        const snapshot = asObject(row.after_data) ?? asObject(row.before_data) ?? {};
        const scopeSnapshot = extractBranchNames(snapshot, new Map([[targetCountryId || "all", country.name]]), mainBranchMap, cityBranchMap);
        if (params.scopeMode === "main-branch") {
          return scopeSnapshot.mainBranchId === params.mainBranchId && !scopeSnapshot.cityBranchId;
        }
        if (params.scopeMode === "city-branch") {
          return scopeSnapshot.cityBranchId === params.branchId;
        }
        return true;
      });
      const actorIds = [...new Set(filteredHistoryRows.map((row: any) => row.actor_id).filter(Boolean))];
      const profiles = actorIds.length
        ? requireQuery(await db.from("profiles").select("id, full_name, user_code").in("id", actorIds).is("deleted_at", null).order("full_name"), "Edit history profiles query") ?? []
        : [];
      return apiOk(buildEditHistoryReport({
        session,
        scopeLevel: scope.level,
        scopeLabel: scope.scopeLabel,
        countryName: country.name,
        mainBranches: localizedMainBranches as Array<{ id: string; name: string; code?: string | null }>,
        cityBranches: localizedCityBranches as Array<{ id: string; name: string; code?: string | null; country_branch_id?: string | null }>,
        profiles: profiles as Array<{ id: string; full_name?: string | null; user_code?: string | null }>,
        assignments: requireQuery(assignmentsResult, "Edit history assignments query") as Array<{ user_id: string; role: string; country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }>,
        rows: filteredHistoryRows
      }));
    }

    if (params.reportType === "purchase" || params.reportType === "bills" || params.reportType === "project") {
      let q = db.from("purchase_orders").select("id, purchase_order_no, status, order_total, advance_paid, remaining_due, currency_code, payment_status, ledger_posting_status, country_id, country_branch_id, city_branch_id, created_at, created_by, supplier_company_id, form_data, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number").order("created_at", { ascending: false });
      q = applyOrderScope(q, "created_at");
      const purchaseRows = requireQuery(await q.limit(params.limit), "Purchase report query") ?? [];
      const supplierIds = [...new Set(purchaseRows.map((row: any) => row.supplier_company_id).filter(Boolean))];
      let supplierMap = new Map<string, string>();
      if (supplierIds.length) {
        const suppliersResult = await db.from("companies").select("id, name").in("id", supplierIds).is("deleted_at", null);
        const suppliers = await localizeRecordNames<any>(requireQuery(suppliersResult, "Purchase suppliers query") ?? [], "companies", "name", params.lang);
        supplierMap = new Map(suppliers.map((supplier: any) => [supplier.id, supplier.name]));
      }
      const mapped = purchaseRows.filter((r: any) => currencyMatches(r.currency_code) && projectMatches(r.form_data)).map((r: any) => ({
        id: r.id, recordType: "purchase", reference: r.purchase_order_no, serial: r.super_admin_serial_number || r.purchase_order_no,
        date: r.created_at, party: supplierMap.get(r.supplier_company_id) || r.supplier_company_id || "—", project: projectName(r.form_data) || "—", amount: money(r.order_total),
        paid: money(r.advance_paid), outstanding: money(r.remaining_due), currency: r.currency_code, status: r.status || r.payment_status,
        postingStatus: r.ledger_posting_status, country: country.name, branch: cityBranch?.name || mainBranch?.name || "Entire Country",
        user: r.created_by || "—", createdAt: r.created_at, approvedAt: null, sourceTable: "purchase_orders"
      }));
      rows.push(...mapped);
      sourceTables.push("purchase_orders");
    }

    if (params.reportType === "sales" || params.reportType === "bills" || params.reportType === "project") {
      let q = db.from("sales_orders").select("id, sales_order_no, order_date, sales_status, order_total, paid_amount, remaining_amount, currency_code, payment_status, delivery_status, ledger_posting_status, country_id, country_branch_id, city_branch_id, created_at, created_by, customer_name, form_data, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number").order("order_date", { ascending: false });
      q = applyOrderScope(q, "order_date");
      const salesRowsRaw = requireQuery(await q.limit(params.limit), "Sales report query") ?? [];
      const salesRows = await localizeRecordNames<any>(salesRowsRaw, "sales_orders", "customer_name", params.lang);
      const mapped = salesRows.filter((r: any) => currencyMatches(r.currency_code) && projectMatches(r.form_data)).map((r: any) => ({
        id: r.id, recordType: "sales", reference: r.sales_order_no, serial: r.super_admin_serial_number || r.sales_order_no,
        date: r.order_date, party: r.customer_name || "—", project: projectName(r.form_data) || "—", amount: money(r.order_total),
        paid: money(r.paid_amount), outstanding: money(r.remaining_amount), currency: r.currency_code, status: r.sales_status || r.payment_status,
        postingStatus: r.ledger_posting_status, country: country.name, branch: cityBranch?.name || mainBranch?.name || "Entire Country",
        user: r.created_by || "—", createdAt: r.created_at, approvedAt: null, sourceTable: "sales_orders"
      }));
      rows.push(...mapped);
      sourceTables.push("sales_orders");
    }

    if (params.reportType === "payments") {
      let purchaseQ = db.from("purchase_order_payments").select("id, amount, currency_code, entry_date, kind, narration, reference_no, status, created_at, created_by, journal_posted_at, roznamcha_entry_id, purchase_order_id, purchase_orders!inner(purchase_order_no, country_id, country_branch_id, city_branch_id, form_data)").is("deleted_at", null).order("entry_date", { ascending: false });
      if (targetCountryId) purchaseQ = purchaseQ.eq("purchase_orders.country_id", targetCountryId);
      if (params.scopeMode === "main-branch" && params.mainBranchId) purchaseQ = purchaseQ.eq("purchase_orders.country_branch_id", params.mainBranchId).is("purchase_orders.city_branch_id", null);
      if (params.scopeMode === "city-branch" && params.branchId) purchaseQ = purchaseQ.eq("purchase_orders.city_branch_id", params.branchId);
      if (params.fromDate) purchaseQ = purchaseQ.gte("entry_date", params.fromDate);
      if (params.toDate) purchaseQ = purchaseQ.lte("entry_date", params.toDate);
      if (params.userId) purchaseQ = purchaseQ.eq("created_by", params.userId);
      let salesQ = db.from("sales_order_payments").select("id, amount, currency_code, payment_date, payment_kind, remarks, status, created_at, created_by, roznamcha_entry_id, sales_order_id, sales_orders!inner(sales_order_no, country_id, country_branch_id, city_branch_id, form_data)").is("deleted_at", null).order("payment_date", { ascending: false });
      if (targetCountryId) salesQ = salesQ.eq("sales_orders.country_id", targetCountryId);
      if (params.scopeMode === "main-branch" && params.mainBranchId) salesQ = salesQ.eq("sales_orders.country_branch_id", params.mainBranchId).is("sales_orders.city_branch_id", null);
      if (params.scopeMode === "city-branch" && params.branchId) salesQ = salesQ.eq("sales_orders.city_branch_id", params.branchId);
      if (params.fromDate) salesQ = salesQ.gte("payment_date", params.fromDate);
      if (params.toDate) salesQ = salesQ.lte("payment_date", params.toDate);
      if (params.userId) salesQ = salesQ.eq("created_by", params.userId);
      const [purchasePayments, salesPayments] = await Promise.all([purchaseQ.limit(params.limit), salesQ.limit(params.limit)]);
      const pp = requireQuery(purchasePayments, "Purchase payments query") ?? [];
      const sp = requireQuery(salesPayments, "Sales payments query") ?? [];
      let rozQ = db.from("roznamcha_entries").select("id, entry_date, journal_no, voucher_no, reference_no, source_reference_no, source_module, source_transaction_type, entry_category, narration, status, posted_at, journal_entry_id, created_at, created_by, country_id, country_branch_id, city_branch_id, roznamcha_lines(debit, credit, currency, payment_entry_type, description)").is("deleted_at", null).order("entry_date", { ascending: false });
      if (targetCountryId) rozQ = rozQ.eq("country_id", targetCountryId);
      if (params.scopeMode === "main-branch" && params.mainBranchId) rozQ = rozQ.eq("country_branch_id", params.mainBranchId).is("city_branch_id", null);
      if (params.scopeMode === "city-branch" && params.branchId) rozQ = rozQ.eq("city_branch_id", params.branchId);
      if (params.fromDate) rozQ = rozQ.gte("entry_date", params.fromDate);
      if (params.toDate) rozQ = rozQ.lte("entry_date", params.toDate);
      if (params.userId) rozQ = rozQ.eq("created_by", params.userId);
      const rozRows = requireQuery(await rozQ.limit(params.limit), "Roznamcha payment query") ?? [];
      const linkedRoznamcha = new Set([...pp, ...sp].map((row: any) => row.roznamcha_entry_id).filter(Boolean));
      const relevantRoznamcha = rozRows.filter((row: any) => {
        if (linkedRoznamcha.has(row.id)) return false;
        const marker = `${row.source_module || ""} ${row.source_transaction_type || ""} ${row.entry_category || ""} ${row.narration || ""}`.toLowerCase();
        return ["payment", "advance", "daily", "purchase", "sales", "invoice", "cash"].some((word) => marker.includes(word));
      });
      rows = [
        ...pp.filter((r: any) => currencyMatches(r.currency_code) && projectMatches(r.purchase_orders?.form_data)).map((r: any) => ({ id: r.id, recordType: "purchase-payment", reference: r.reference_no || r.purchase_orders?.purchase_order_no, date: r.entry_date, paymentType: r.kind, description: r.narration || "—", debit: money(r.amount), credit: 0, amount: money(r.amount), currency: r.currency_code, status: r.status, postingStatus: r.journal_posted_at ? "posted" : "pending", roznamchaEntryId: r.roznamcha_entry_id, project: projectName(r.purchase_orders?.form_data) || "—", user: r.created_by || "—", createdAt: r.created_at, sourceTable: "purchase_order_payments" })),
        ...sp.filter((r: any) => currencyMatches(r.currency_code) && projectMatches(r.sales_orders?.form_data)).map((r: any) => ({ id: r.id, recordType: "sales-payment", reference: r.sales_orders?.sales_order_no, date: r.payment_date, paymentType: r.payment_kind, description: r.remarks || "—", debit: 0, credit: money(r.amount), amount: money(r.amount), currency: r.currency_code, status: r.status, postingStatus: r.roznamcha_entry_id ? "posted" : "pending", roznamchaEntryId: r.roznamcha_entry_id, project: projectName(r.sales_orders?.form_data) || "—", user: r.created_by || "—", createdAt: r.created_at, sourceTable: "sales_order_payments" })),
        ...relevantRoznamcha.map((r: any) => {
          const debit = (r.roznamcha_lines ?? []).reduce((sum: number, line: any) => sum + money(line.debit), 0);
          const credit = (r.roznamcha_lines ?? []).reduce((sum: number, line: any) => sum + money(line.credit), 0);
          const rowCurrency = r.roznamcha_lines?.[0]?.currency || country.currency_code;
          return { id: r.id, recordType: "roznamcha-payment", reference: r.source_reference_no || r.reference_no || r.voucher_no || r.journal_no, date: r.entry_date, paymentType: r.source_transaction_type || r.entry_category || r.roznamcha_lines?.[0]?.payment_entry_type || "payment", description: r.narration || "—", debit, credit, amount: Math.max(debit, credit), currency: rowCurrency, status: r.status, postingStatus: r.posted_at && r.journal_entry_id ? "posted" : "pending", roznamchaEntryId: r.id, journalEntryId: r.journal_entry_id, project: "—", user: r.created_by || "—", createdAt: r.created_at, sourceTable: "roznamcha_entries" };
        }).filter((r: any) => currencyMatches(r.currency))
      ].sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
      sourceTables = ["purchase_order_payments", "sales_order_payments", "roznamcha_entries", "journal_entries"];
    }

    if (params.reportType === "ledger") {
      let q = db.from("ledger_posting_batches").select("id, entry_date, reference_no, narration, status, approval_status, approved_at, approved_by, created_at, created_by, scope, country_id, country_branch_id, city_branch_id, branch_name_snapshot, transaction_type, ledger_posting_lines(id, ledger_id, ledger_name_snapshot, account_number, description, debit, credit, currency, usd_amount, user_name_snapshot)").is("deleted_at", null).order("entry_date", { ascending: false });
      if (targetCountryId) q = q.eq("country_id", targetCountryId);
      if (params.scopeMode === "main-branch" && params.mainBranchId) q = q.eq("country_branch_id", params.mainBranchId).is("city_branch_id", null);
      if (params.scopeMode === "city-branch" && params.branchId) q = q.eq("city_branch_id", params.branchId);
      if (params.fromDate) q = q.gte("entry_date", params.fromDate);
      if (params.toDate) q = q.lte("entry_date", params.toDate);
      if (params.userId) q = q.eq("created_by", params.userId);
      const batches = requireQuery(await q.limit(params.limit), "Ledger report query") ?? [];
      let rozQ = db.from("roznamcha_lines").select("id, roznamcha_entry_id, ledger_id, account_number, description, debit, credit, currency, usd_amount, ledgers(code, name), roznamcha_entries!inner(entry_date, voucher_no, narration, status, posted_at, created_at, created_by, country_id, country_branch_id, city_branch_id, deleted_at)")
        .is("roznamcha_entries.deleted_at", null);
      if (targetCountryId) rozQ = rozQ.eq("roznamcha_entries.country_id", targetCountryId);
      if (params.scopeMode === "main-branch" && params.mainBranchId) rozQ = rozQ.eq("roznamcha_entries.country_branch_id", params.mainBranchId).is("roznamcha_entries.city_branch_id", null);
      if (params.scopeMode === "city-branch" && params.branchId) rozQ = rozQ.eq("roznamcha_entries.city_branch_id", params.branchId);
      if (params.fromDate) rozQ = rozQ.gte("roznamcha_entries.entry_date", params.fromDate);
      if (params.toDate) rozQ = rozQ.lte("roznamcha_entries.entry_date", params.toDate);
      if (params.userId) rozQ = rozQ.eq("roznamcha_entries.created_by", params.userId);
      const roznamchaLines = requireQuery(await rozQ.limit(params.limit), "Roznamcha ledger report query") ?? [];

      const batchRows = batches.flatMap((batch: any) => (batch.ledger_posting_lines ?? []).filter((line: any) => currencyMatches(line.currency)).map((line: any) => ({ id: line.id, batchId: batch.id, historyRecordId: batch.id, reference: batch.reference_no || batch.id.slice(0, 8), date: batch.entry_date, account: line.ledger_name_snapshot || line.account_number || line.ledger_id, accountNumber: line.account_number || "—", description: line.description || batch.narration || "—", opening: 0, debit: money(line.debit), credit: money(line.credit), closing: money(line.debit) - money(line.credit), currency: line.currency, status: batch.status, approvalStatus: batch.approval_status, country: country.name, branch: batch.branch_name_snapshot || cityBranch?.name || mainBranch?.name || "Entire Country", user: line.user_name_snapshot || batch.created_by || "—", createdAt: batch.created_at, approvedAt: batch.approved_at, approvedBy: batch.approved_by, sourceTable: "ledger_posting_batches" })));
      const roznamchaRows = roznamchaLines.filter((line: any) => currencyMatches(line.currency)).map((line: any) => ({
        id: line.id,
        historyRecordId: line.roznamcha_entry_id,
        reference: line.roznamcha_entries?.voucher_no || line.roznamcha_entry_id,
        date: line.roznamcha_entries?.entry_date,
        account: line.ledgers?.name || line.ledgers?.code || line.account_number || line.ledger_id,
        accountNumber: line.account_number || line.ledgers?.code || "—",
        description: line.description || line.roznamcha_entries?.narration || "—",
        opening: 0,
        debit: money(line.debit),
        credit: money(line.credit),
        closing: money(line.debit) - money(line.credit),
        currency: line.currency,
        status: line.roznamcha_entries?.status,
        approvalStatus: line.roznamcha_entries?.posted_at ? "posted" : "pending",
        country: country.name,
        branch: cityBranch?.name || mainBranch?.name || "Entire Country",
        user: line.roznamcha_entries?.created_by || "—",
        createdAt: line.roznamcha_entries?.created_at,
        approvedAt: line.roznamcha_entries?.posted_at,
        approvedBy: line.roznamcha_entries?.created_by || null,
        sourceTable: "roznamcha_entries"
      }));
      rows = [...batchRows, ...roznamchaRows];
      sourceTables = ["ledger_posting_batches", "ledger_posting_lines", "roznamcha_entries", "roznamcha_lines", "ledgers"];
    }

    if (params.reportType === "user-activity") {
      let q = db.from("erp_activity_events").select("id, created_at, actor_id, action, resource, record_id, record_table, metadata, ip_address, user_agent, country_id, country_branch_id, city_branch_id").order("created_at", { ascending: false });
      if (targetCountryId) q = q.eq("country_id", targetCountryId);
      if (params.scopeMode === "main-branch" && params.mainBranchId) q = q.eq("country_branch_id", params.mainBranchId).is("city_branch_id", null);
      if (params.scopeMode === "city-branch" && params.branchId) q = q.eq("city_branch_id", params.branchId);
      if (params.fromDate) q = q.gte("created_at", `${params.fromDate}T00:00:00`);
      if (params.toDate) q = q.lte("created_at", `${params.toDate}T23:59:59.999`);
      if (params.userId) q = q.eq("actor_id", params.userId);
      const activities = requireQuery(await q.limit(params.limit), "User activity query") ?? [];
      rows = activities.map((r: any) => ({ id: r.id, date: r.created_at, user: r.actor_id || "—", action: r.action, resource: r.resource, reference: r.record_id || "—", description: asObject(r.metadata)?.description || asObject(r.metadata)?.message || "—", ip: String(r.ip_address || "—"), status: "logged", createdAt: r.created_at, sourceTable: r.record_table || "erp_activity_events" }));
      sourceTables = ["erp_activity_events", "audit_logs", "record_change_history"];
    }

    if (params.reportType === "employee") {
      const employeeResult = await db.rpc("list_employees_with_relations", { p_country_id: targetCountryId || null, p_branch_id: params.scopeMode === "city-branch" ? params.branchId : null, p_category: null, p_status: null });
      let employees = requireQuery(employeeResult, "Employee report query") ?? [];
      if (params.scopeMode === "main-branch" && params.mainBranchId) employees = employees.filter((r: any) => r.country_branch_id === params.mainBranchId && !r.city_branch_id);
      rows = employees.filter((r: any) => currencyMatches(r.salary_currency)).map((r: any) => ({ id: r.id, reference: r.employee_code, employee: r.person?.customer_name || r.full_name || r.employee_code, department: r.department || "—", designation: r.designation || "—", employmentType: r.employment_type || "—", joiningDate: r.joining_date, basicSalary: money(r.basic_salary), allowance: money(r.allowance) + money(r.other_allowance), deduction: money(r.deduction), netSalary: money(r.net_salary), currency: r.salary_currency, branch: r.city_branch?.name || r.country_branch?.name || "—", status: r.status, user: r.created_by || "—", createdAt: r.created_at, sourceTable: "employees" }));
      sourceTables = ["employees", "employee_salaries_due", "employee_advances_loans"];
    }

    if (params.reportType === "branch") {
      if (params.scopeMode !== "city-branch") {
        let q = db.from("country_branches").select("id, name, code, status, local_currency, country_id, created_at, created_by, is_main").is("deleted_at", null).order("name");
        if (targetCountryId) q = q.eq("country_id", targetCountryId);
        if (params.scopeMode === "main-branch" && params.mainBranchId) q = q.eq("id", params.mainBranchId);
        const mains = await localizeRecordNames<any>(requireQuery(await q, "Main branch report query") ?? [], "country_branches", "name", params.lang);
        rows.push(...mains.map((r: any) => ({ id: r.id, reference: r.code, branch: r.name, branchType: "main", country: country.name, city: "—", currency: r.local_currency, status: r.status, user: r.created_by || "—", createdAt: r.created_at, sourceTable: "country_branches" })));
      }
      if (params.scopeMode !== "main-branch") {
        let q = db.from("city_branches").select("id, name, code, status, local_currency, country_id, country_branch_id, city_name, created_at, created_by").is("deleted_at", null).order("name");
        if (targetCountryId) q = q.eq("country_id", targetCountryId);
        if (params.scopeMode === "city-branch" && params.branchId) q = q.eq("id", params.branchId);
        const cities = await localizeRecordNames<any>(requireQuery(await q, "City branch report query") ?? [], "city_branches", "name", params.lang);
        rows.push(...cities.map((r: any) => ({ id: r.id, reference: r.code, branch: r.name, branchType: "city", country: country.name, city: r.city_name, currency: r.local_currency, status: r.status, user: r.created_by || "—", createdAt: r.created_at, sourceTable: "city_branches" })));
      }
      sourceTables = ["country_branches", "city_branches"];
    }

    if (params.reportType === "project") {
      const grouped = new Map<string, any>();
      for (const row of rows) {
        const name = String(row.project || "");
        if (!name || name === "—") continue;
        const current = grouped.get(name) ?? { id: `project-${grouped.size + 1}`, reference: name, project: name, records: 0, purchase: 0, sales: 0, paid: 0, outstanding: 0, currency: row.currency, status: "active", sourceTable: "derived-from-orders" };
        current.records += 1;
        current[row.recordType === "purchase" ? "purchase" : "sales"] += money(row.amount);
        current.paid += money(row.paid);
        current.outstanding += money(row.outstanding);
        grouped.set(name, current);
      }
      rows = [...grouped.values()];
      sourceTables = ["purchase_orders.form_data", "sales_orders.form_data"];
    }

    rows.sort((a: any, b: any) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
    const totalDebit = rows.reduce((sum, row) => sum + money(row.debit), 0);
    const totalCredit = rows.reduce((sum, row) => sum + money(row.credit), 0);
    const totalAmount = rows.reduce((sum, row) => sum + money(row.amount), 0);
    const totalPaid = rows.reduce((sum, row) => sum + money(row.paid), 0);
    const totalOutstanding = rows.reduce((sum, row) => sum + money(row.outstanding), 0);
    summary = { records: rows.length, openingBalance: rows.reduce((sum, row) => sum + money(row.opening), 0), totalDebit, totalCredit, closingBalance: totalDebit - totalCredit, totalAmount, totalPaid, totalOutstanding, posted: rows.filter((row) => String(row.status).toLowerCase() === "posted" || String(row.postingStatus).toLowerCase() === "posted").length, pending: rows.filter((row) => String(row.status).toLowerCase() === "pending" || String(row.postingStatus).toLowerCase() === "pending").length };

    const idsByTable = new Map<string, string[]>();
    for (const row of rows) {
      const table = String(row.sourceTable || "");
      const id = String(row.historyRecordId || row.id || "");
      if (table && id && !table.startsWith("derived")) idsByTable.set(table, [...(idsByTable.get(table) ?? []), id]);
    }
    const history: Record<string, any[]> = {};
    for (const [table, ids] of idsByTable) {
      const result = await db.from("record_change_history").select("id, record_id, action, actor_id, before_data, after_data, approval_request_id, created_at").eq("record_table", table).in("record_id", ids.slice(0, 500)).order("created_at", { ascending: false });
      if (result.error) continue;
      for (const item of result.data ?? []) {
        (history[item.record_id] ??= []).push({ ...item, changedFields: changedFields(item.before_data, item.after_data) });
      }
    }

    return apiOk({ reportType: params.reportType, data: rows, summary, history, sourceTables: [...new Set(sourceTables)], generatedAt: new Date().toISOString(), generatedBy: { id: session.userId, name: session.fullName || session.email || session.userId }, applied: { countryId: targetCountryId, country: country.name, scopeMode: params.scopeMode, mainBranchId: params.mainBranchId || null, mainBranch: mainBranch?.name || null, branchId: params.branchId || null, branch: cityBranch?.name || null, project: params.project && params.project !== "all" ? params.project : null, userId: params.userId || null, fromDate: params.fromDate || null, toDate: params.toDate || null, currency: params.currency || "all", year: params.fromDate ? params.fromDate.slice(0, 4) : null }, scope: { level: scope.level, label: scope.scopeLabel } });
  } catch (error) {
    return handleApiError(error);
  }
}
