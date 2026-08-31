/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  role: z.string().trim().max(64).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500)
});

type AssignmentRow = {
  user_id: string;
  role: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  clearing_agent_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  user_code: string | null;
  preferred_language_code: string | null;
  raw_password?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type PermissionRow = {
  user_id: string;
  permissions: string[] | null;
};

type AuditRow = {
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  created_at: string;
};

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function withTimeout<T>(query: PromiseLike<QueryResult<T>>, label: string, ms = 7000): Promise<QueryResult<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(query),
      new Promise<QueryResult<T>>((resolve) => {
        timeout = setTimeout(() => resolve({ data: [], error: { message: `${label} timed out` } }), ms);
      })
    ]);
  } catch (error) {
    return {
      data: [],
      error: { message: error instanceof Error ? error.message : `${label} failed` }
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function emptyReport(reason: string) {
  return {
    summary: {
      totalUsers: 0,
      activeUsers: 0,
      countryUsers: 0,
      branchUsers: 0,
      adminUsers: 0,
      recentLogins: 0
    },
    filters: { countries: [], branches: [], roles: [] },
    rows: [] as unknown[],
    generatedAt: new Date().toISOString(),
    warning: reason
  };
}

async function requireJournalSession(_request: NextRequest) {
  // A real, validated session only — never fabricate a super-admin identity.
  // requireErpSession() redirects an unauthenticated caller to /auth/login;
  // authorizeApiScope() below still enforces the caller's real scope.
  return requireErpSession();
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizeRole(role: string): EnterpriseRole | null {
  if (role === "staff") return "staff_user";
  return (Object.keys(enterpriseRolePermissions) as EnterpriseRole[]).includes(role as EnterpriseRole)
    ? (role as EnterpriseRole)
    : null;
}

function roleLabel(role: EnterpriseRole) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function activityBucket(action: string, entityTable: string) {
  const lowerAction = action.toLowerCase();
  const lowerTable = entityTable.toLowerCase();
  if (lowerAction.startsWith("auth.login")) return "login";
  if (lowerAction.includes("approve")) return "approvals";
  if (lowerAction.includes("transaction") || lowerTable.includes("transaction")) return "transactions";
  if (lowerAction.includes("roznamcha") || lowerTable.includes("roznamcha")) return "roznamcha";
  if (lowerAction.includes("purchase") || lowerTable.includes("purchase")) return "purchases";
  if (lowerAction.includes("payment") || lowerTable.includes("payment")) return "payments";
  if (lowerAction.includes("account") || lowerTable.includes("account")) return "accounts";
  if (lowerAction.includes("update") || lowerAction.includes("edit")) return "edits";
  return "other";
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireJournalSession(request);
    const query = querySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      role: request.nextUrl.searchParams.get("role") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") ?? undefined,
      toDate: request.nextUrl.searchParams.get("toDate") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      ...getScopeFromSearchParams(request)
    });

    let admin: any;
    try {
      admin = createSupabaseAdminClient() as any;
    } catch (error) {
      return apiOk(emptyReport(error instanceof Error ? error.message : "Supabase admin client unavailable"));
    }

    const [profilesRes, assignmentsRes, permissionsRes, authUsersRes] = await Promise.all([
      withTimeout<ProfileRow>(
        admin
        .from("profiles")
        .select("id, full_name, user_code, preferred_language_code, raw_password, created_at, updated_at, deleted_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
          .limit(query.limit),
        "profiles"
      ),
      withTimeout<AssignmentRow>(
        admin
        .from("user_role_assignments")
        .select("user_id, role, country_id, country_branch_id, city_branch_id, clearing_agent_id, is_active, created_at, updated_at")
        .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(Math.max(query.limit * 3, 500)),
        "user role assignments"
      ),
      withTimeout<PermissionRow>(admin.from("user_permission_sets").select("user_id, permissions").limit(Math.max(query.limit * 2, 500)), "user permissions"),
      withTimeout<any>(
        Promise.resolve()
          .then(() => admin?.auth?.admin?.listUsers({ limit: 1000 }))
          .then((res: any) => ({
            data: res?.data?.users ?? [],
            error: res?.error ? { message: res.error.message } : null
          }))
          .catch((err) => ({
            data: [],
            error: { message: err instanceof Error ? err.message : "Failed to list auth users" }
          })),
        "auth users list"
      )
    ]);

    if (profilesRes.error || assignmentsRes.error) {
      return apiOk(emptyReport(profilesRes.error?.message ?? assignmentsRes.error?.message ?? "User journal data source unavailable"));
    }

    const profiles = (profilesRes.data ?? []) as ProfileRow[];
    const assignments = (assignmentsRes.data ?? []) as AssignmentRow[];
    const permissionSets = (permissionsRes.error ? [] : permissionsRes.data ?? []) as PermissionRow[];
    const authUsers = (authUsersRes.error ? [] : authUsersRes.data ?? []) as any[];

    const emailLookup = new Map<string, string>();
    for (const u of authUsers) {
      if (u?.id && u?.email) {
        emailLookup.set(u.id, u.email);
      }
    }

    if (!profiles.length) {
      return apiOk(emptyReport("No user profile records found"));
    }

    const userIds = profiles.map((profile) => profile.id);
    const [countryIds, countryBranchIds, cityBranchIds, clearingAgentIds] = [
      unique(assignments.map((row) => row.country_id)),
      unique(assignments.map((row) => row.country_branch_id)),
      unique(assignments.map((row) => row.city_branch_id)),
      unique(assignments.map((row) => row.clearing_agent_id))
    ];

    const [countriesRes, countryBranchesRes, cityBranchesRes, clearingAgentsRes, clearingAgentBranchesRes, auditRes] = await Promise.all([
      countryIds.length
        ? withTimeout<{ id: string; name: string; iso2: string | null }>(admin.from("countries").select("id, name, iso2").in("id", countryIds), "countries")
        : Promise.resolve({ data: [], error: null }),
      withTimeout<{ id: string; name: string; code: string; country_id: string }>(
        admin.from("country_branches").select("id, name, code, country_id").is("deleted_at", null),
        "country branches"
      ),
      cityBranchIds.length
        ? withTimeout<{ id: string; name: string; code: string; city_name: string; country_id: string; country_branch_id: string }>(
            admin.from("city_branches").select("id, name, code, city_name, country_id, country_branch_id").in("id", cityBranchIds),
            "city branches"
          )
        : Promise.resolve({ data: [], error: null }),
      clearingAgentIds.length
        ? withTimeout<{ id: string; name: string; code: string; head_office_country_id: string | null }>(
            admin.from("clearing_agents").select("id, name, code, head_office_country_id").in("id", clearingAgentIds),
            "clearing agents"
          )
        : Promise.resolve({ data: [], error: null }),
      clearingAgentIds.length
        ? withTimeout<{ id: string; name: string; code: string; clearing_agent_id: string; branch_level: string }>(
            admin.from("clearing_agent_branches").select("id, name, code, clearing_agent_id, branch_level").in("clearing_agent_id", clearingAgentIds).is("deleted_at", null),
            "clearing agent branches"
          )
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? withTimeout<AuditRow>(
            admin
              .from("audit_logs")
              .select("actor_id, action, entity_table, entity_id, created_at")
              .in("actor_id", userIds)
              .order("created_at", { ascending: false })
              .limit(1500),
            "audit logs",
            5000
          )
        : Promise.resolve({ data: [], error: null })
    ]);

    const countries = (countriesRes.error ? [] : countriesRes.data ?? []) as Array<{ id: string; name: string; iso2: string | null }>;
    const countryBranches = (countryBranchesRes.error ? [] : countryBranchesRes.data ?? []) as Array<{ id: string; name: string; code: string; country_id: string }>;
    const cityBranches = (cityBranchesRes.error ? [] : cityBranchesRes.data ?? []) as Array<{
      id: string;
      name: string;
      code: string;
      city_name: string;
      country_id: string;
      country_branch_id: string;
    }>;
    const clearingAgents = (clearingAgentsRes.error ? [] : clearingAgentsRes.data ?? []) as Array<{
      id: string;
      name: string;
      code: string;
      head_office_country_id: string | null;
    }>;
    const clearingAgentBranches = (clearingAgentBranchesRes.error ? [] : clearingAgentBranchesRes.data ?? []) as Array<{
      id: string;
      name: string;
      code: string;
      clearing_agent_id: string;
      branch_level: string;
    }>;
    const audits = (auditRes.error ? [] : auditRes.data ?? []) as AuditRow[];

    const countryLookup = new Map(countries.map((row) => [row.id, row] as const));
    const mainBranchLookup = new Map(countryBranches.map((row) => [row.id, row] as const));
    const cityBranchLookup = new Map(cityBranches.map((row) => [row.id, row] as const));
    const clearingAgentLookup = new Map(clearingAgents.map((row) => [row.id, row] as const));
    const clearingBranchLookup = new Map(clearingAgentBranches.map((row) => [row.clearing_agent_id, row] as const));

    const permissionsByUser = new Map(permissionSets.map((row) => [row.user_id, (row.permissions ?? []).filter((p): p is string => typeof p === "string" && Boolean(p))] as const));

    const auditsByUser = new Map<string, AuditRow[]>();
    for (const row of audits) {
      if (!row.actor_id) continue;
      const list = auditsByUser.get(row.actor_id) ?? [];
      list.push(row);
      auditsByUser.set(row.actor_id, list);
    }

    const rowData = profiles.map((profile) => {
      const userAssignments = assignments.filter((row) => row.user_id === profile.id);
      const latestAssignment =
        [...userAssignments].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.updated_at.localeCompare(a.updated_at)).find((row) => row.is_active) ??
        [...userAssignments].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.updated_at.localeCompare(a.updated_at))[0] ??
        null;

      const normalizedRole = latestAssignment ? normalizeRole(latestAssignment.role) : null;
      const role = normalizedRole ?? "staff_user";
      const country = latestAssignment?.country_id ? countryLookup.get(latestAssignment.country_id) ?? null : null;
      const mainBranch = latestAssignment?.country_branch_id ? mainBranchLookup.get(latestAssignment.country_branch_id) ?? null : null;
      const cityBranch = latestAssignment?.city_branch_id ? cityBranchLookup.get(latestAssignment.city_branch_id) ?? null : null;
      const clearingAgent = latestAssignment?.clearing_agent_id ? clearingAgentLookup.get(latestAssignment.clearing_agent_id) ?? null : null;
      const clearingBranch = latestAssignment?.clearing_agent_id ? clearingBranchLookup.get(latestAssignment.clearing_agent_id) ?? null : null;

      const branchType =
        latestAssignment?.clearing_agent_id
          ? "Clearing HQ"
          : latestAssignment?.city_branch_id
            ? "City Branch"
            : latestAssignment?.country_branch_id
              ? "Main Branch"
              : latestAssignment?.country_id
                ? "Country"
                : "Global";

      const countryMainBranch = country
        ? countryBranches.find((b) => b.country_id === country.id) ?? null
        : null;

      const branchName =
        branchType === "Clearing HQ"
          ? clearingBranch?.name ?? clearingAgent?.name ?? "Clearing Agent Head Office"
          : branchType === "City Branch"
            ? `${cityBranch?.city_name ?? "-"} - ${cityBranch?.name ?? "-"}`
            : branchType === "Main Branch"
              ? mainBranch?.name ?? "-"
              : branchType === "Country"
                ? country?.name ?? "-"
                : "Global";

      const branchCode =
        branchType === "Clearing HQ"
          ? clearingBranch?.code ?? clearingAgent?.code ?? "CLEARING-HO-01"
          : branchType === "City Branch"
            ? cityBranch?.code ?? mainBranch?.code ?? countryMainBranch?.code ?? "-"
            : branchType === "Main Branch"
              ? mainBranch?.code ?? "-"
              : branchType === "Country"
                ? countryMainBranch?.code ?? mainBranch?.code ?? "-"
                : "-";

      const permissions = permissionsByUser.get(profile.id) ?? [...new Set(enterpriseRolePermissions[role] ?? [])];
      const userAudits = (auditsByUser.get(profile.id) ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
      const lastActivity = userAudits[0] ?? null;
      const lastActivityDate = lastActivity?.created_at ?? profile.updated_at ?? profile.created_at;

      const activityCounts = userAudits.reduce(
        (acc, audit) => {
          const bucket = activityBucket(audit.action, audit.entity_table);
          if (bucket === "login") acc.logins += 1;
          if (bucket === "transactions") acc.transactions += 1;
          if (bucket === "roznamcha") acc.roznamcha += 1;
          if (bucket === "purchases") acc.purchases += 1;
          if (bucket === "payments") acc.payments += 1;
          if (bucket === "accounts") acc.accounts += 1;
          if (bucket === "approvals") acc.approvals += 1;
          if (bucket === "edits") acc.edits += 1;
          return acc;
        },
        { logins: 0, transactions: 0, roznamcha: 0, purchases: 0, payments: 0, accounts: 0, approvals: 0, edits: 0 }
      );

      return {
        userId: profile.id,
        userCode: profile.user_code ?? profile.id.slice(0, 8).toUpperCase(),
        fullName: profile.full_name ?? "-",
        email: emailLookup.get(profile.id) ?? "-",
        countryId: country?.id ?? null,
        countryName: country?.name ?? "-",
        branchId: cityBranch?.id ?? mainBranch?.id ?? null,
        branchName,
        branchCode,
        branchType,
        role,
        registrationDate: profile.created_at,
        status: latestAssignment?.is_active ? "active" : "inactive",
        permissions,
        lastActivity: lastActivityDate,
        lastActivityAction: lastActivity?.action ?? null,
        activityCounts,
        rawPassword: session.isSuperAdmin ? (profile.raw_password ?? null) : null
      };
    });

    const scopedRows = session.isSuperAdmin
      ? rowData
      : rowData.filter((row) => {
          if (session.cityBranchIds.length) return row.branchId ? session.cityBranchIds.includes(row.branchId) : false;
          if (session.countryBranchIds.length) return row.branchId ? session.countryBranchIds.includes(row.branchId) : row.countryId ? session.countryIds.includes(row.countryId) : false;
          if (session.countryIds.length) return row.countryId ? session.countryIds.includes(row.countryId) : false;
          return false;
        });

    const q = normalizeForSearch(query.q ?? "");
    const filtered = scopedRows
      .filter((row) => {
        if (query.status !== "all" && row.status !== query.status) return false;
        if (query.role && row.role !== query.role) return false;
        if (query.countryId && row.countryId !== query.countryId) return false;
        if (query.countryBranchId && row.branchId !== query.countryBranchId && row.branchType !== "Country") return false;
        if (query.cityBranchId && row.branchId !== query.cityBranchId && row.branchType !== "City Branch") return false;
        if (query.fromDate && row.registrationDate.slice(0, 10) < query.fromDate) return false;
        if (query.toDate && row.registrationDate.slice(0, 10) > query.toDate) return false;
        if (!q) return true;
        return normalizeForSearch(
          [
            row.userCode,
            row.fullName,
            row.countryName,
            row.branchName,
            row.branchType,
            row.role,
            row.permissions.join(" "),
            row.lastActivityAction ?? ""
          ]
            .filter(Boolean)
            .join(" ")
        ).includes(q);
      })
      .sort((a, b) => b.registrationDate.localeCompare(a.registrationDate));

    const recentLogins = audits
      .filter((row) => row.action.startsWith("auth.login"))
      .filter((row) => (row.created_at ? new Date(row.created_at).getTime() : 0) >= Date.now() - 1000 * 60 * 60 * 24 * 7).length;

    const summary = {
      totalUsers: filtered.length,
      activeUsers: filtered.filter((row) => row.status === "active").length,
      countryUsers: filtered.filter((row) => row.branchType === "Country").length,
      branchUsers: filtered.filter((row) => row.branchType === "Main Branch" || row.branchType === "City Branch" || row.branchType === "Branch").length,
      adminUsers: filtered.filter((row) => ["super_admin", "country_admin", "main_branch_admin"].includes(row.role)).length,
      recentLogins
    };

    const filters = {
      countries: unique(filtered.map((row) => row.countryId)).map((id) => {
        const row = filtered.find((item) => item.countryId === id);
        return { value: String(id), label: row?.countryName ?? id, keywords: [row?.countryName, id].filter(Boolean).join(" ") };
      }),
      branches: unique(filtered.map((row) => row.branchId)).map((id) => {
        const row = filtered.find((item) => item.branchId === id);
        return { value: String(id), label: row?.branchName ?? id, keywords: [row?.branchName, row?.userCode, row?.fullName].filter(Boolean).join(" ") };
      }),
      roles: unique(filtered.map((row) => row.role)).map((value) => ({
        value,
        label: roleLabel(value as EnterpriseRole),
        keywords: value
      }))
    };

    return apiOk({
      summary,
      filters,
      rows: filtered,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
