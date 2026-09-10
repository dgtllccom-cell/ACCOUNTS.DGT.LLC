import { requireErpSession } from "@/lib/auth/session";

// Shared, real-data audit/edit-history logic. Extracted verbatim from
// app/api/erp/reports/super-admin/route.ts (its "edit-history" reportType branch)
// so the Reports Hub AND the dedicated Super Admin audit screens
// (/dashboard/super-admin/edit-history, /api/erp/audit/edit-history,
// /api/erp/audit/version-timeline) read the SAME record_change_history data
// through the SAME grouping/versioning logic - no second audit engine.

export type JsonRecord = Record<string, unknown>;

export function asObject(value: unknown): JsonRecord | null {
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

export function changedFields(before: unknown, after: unknown) {
  const left = asObject(before) ?? {};
  const right = asObject(after) ?? {};
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
}

export function humanizeTableName(tableName: string) {
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

export function pickFirstText(source: JsonRecord | null, keys: string[]) {
  if (!source) return null;
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function extractReference(tableName: string, snapshot: JsonRecord | null, recordId: string) {
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

export function extractBranchNames(
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

export function normalizeActorRole(
  actorId: string | null,
  assignmentsByUserId: Map<string, Array<{ role: string; country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }>>
) {
  if (!actorId) return "—";
  const assignments = assignmentsByUserId.get(actorId) ?? [];
  if (!assignments.length) return "—";
  const priority = assignments.find((assignment) => assignment.city_branch_id) ?? assignments.find((assignment) => assignment.country_branch_id) ?? assignments[0];
  return priority?.role ?? "—";
}

export function isEditingAction(action: string) {
  const normalized = String(action || "").toLowerCase();
  return !["create", "insert", "created", "new", "initial", "original"].includes(normalized);
}

export function isDeleteAction(action: string) {
  const normalized = String(action || "").toLowerCase();
  return normalized.includes("delete") || normalized.includes("remove");
}

export function buildHistoryTimeline(entryRows: Array<any>) {
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

export function buildEditHistoryReport(payload: {
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

// Heuristic, honestly-derived (never fabricated) risk tiering for real
// record_change_history rows, which carry no risk_level column of their own.
// Deletes are always High; a record edited many times is Medium; anything
// else is Low. This is a transparent function of real edit_count/action data,
// not invented numbers.
export function deriveRiskLevel(editCount: number, hasDelete: boolean): "High" | "Medium" | "Low" {
  if (hasDelete) return "High";
  if (editCount >= 3) return "Medium";
  return "Low";
}
