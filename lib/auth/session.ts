import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type EnterpriseRole, enterpriseRoles } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { readTempSession } from "@/lib/auth/temp-session";

export type LedgerVisibility = "scoped" | "shipping_only" | "full";

export type RoleAssignmentScope = {
  role: EnterpriseRole;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  clearingAgentId: string | null;
  ledgerVisibility: LedgerVisibility;
};

export type ErpSession = {
  userId: string;
  email: string | null;
  fullName: string | null;
  preferredLanguage: SupportedLanguage;
  roles: EnterpriseRole[];
  permissions: string[];
  assignments: RoleAssignmentScope[];
  countryIds: string[];
  countryBranchIds: string[];
  cityBranchIds: string[];
  isSuperAdmin: boolean;
  // Shipping/Clearing scope. `clearingAgentIds` = the clearing agents this login is bound to.
  // `isShippingScoped` = true only for a shipping-only login (bound to an agent, no 'full' grant,
  // not super admin) â€” such a login must see ONLY its own agent's shipping transactions.
  clearingAgentIds: string[];
  ledgerVisibility: LedgerVisibility;
  isShippingScoped: boolean;
};

type ProfileRow = {
  full_name: string | null;
  preferred_language_code: SupportedLanguage | null;
};

type PermissionSetRow = {
  permissions: string[] | null;
};

type AssignmentRow = {
  role: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  clearing_agent_id?: string | null;
  ledger_visibility?: string | null;
};

/** Derive the shipping/clearing scope fields from a user's active assignments. */
export function resolveShippingScope(assignments: RoleAssignmentScope[], isSuperAdmin: boolean): {
  clearingAgentIds: string[];
  ledgerVisibility: LedgerVisibility;
  isShippingScoped: boolean;
} {
  const clearingAgentIds = [...new Set(assignments.map((a) => a.clearingAgentId).filter((v): v is string => Boolean(v)))];
  const hasFull = assignments.some((a) => a.ledgerVisibility === "full");
  const hasShippingOnly = assignments.some((a) => a.clearingAgentId && a.ledgerVisibility === "shipping_only");
  const ledgerVisibility: LedgerVisibility = hasFull ? "full" : hasShippingOnly ? "shipping_only" : "scoped";
  const isShippingScoped = !isSuperAdmin && !hasFull && hasShippingOnly && clearingAgentIds.length > 0;
  return { clearingAgentIds, ledgerVisibility, isShippingScoped };
}

type LooseQueryBuilder = {
  select(columns: string): LooseQueryBuilder;
  eq(column: string, value: string | boolean): LooseQueryBuilder;
  is(column: string, value: null): Promise<{ data: AssignmentRow[] | null; error: { message: string } | null }>;
  maybeSingle(): Promise<{ data: ProfileRow | null }>;
};

export class ErpAuthError extends Error {
  status = 401;

  constructor(message = "Authentication is required") {
    super(message);
  }
}

function normalizeRole(role: string): EnterpriseRole | null {
  if (role === "branch_admin") return "city_branch_admin";
  if (role === "staff") return "staff_user";
  return enterpriseRoles.includes(role as EnterpriseRole) ? (role as EnterpriseRole) : null;
}

function uniqueStrings(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function getAssignmentRoots(assignments: RoleAssignmentScope[]) {
  const cIds: string[] = [];
  const cbIds: string[] = [];
  const cityIds: string[] = [];
  
  for (const a of assignments) {
    if (a.cityBranchId) {
      cityIds.push(a.cityBranchId);
    } else if (a.countryBranchId) {
      cbIds.push(a.countryBranchId);
    } else if (a.countryId) {
      cIds.push(a.countryId);
    }
  }
  
  return {
    initialCountryIds: uniqueStrings(cIds),
    initialCountryBranchIds: uniqueStrings(cbIds),
    initialCityBranchIds: uniqueStrings(cityIds)
  };
}

async function resolveHierarchyScopes(
  supabase: any,
  initialCountryIds: string[],
  initialCountryBranchIds: string[],
  initialCityBranchIds: string[],
  isSuperAdmin: boolean
): Promise<{ countryIds: string[]; countryBranchIds: string[]; cityBranchIds: string[] }> {
  if (isSuperAdmin || !supabase) {
    return {
      countryIds: initialCountryIds,
      countryBranchIds: initialCountryBranchIds,
      cityBranchIds: initialCityBranchIds
    };
  }

  const finalCountryIds = new Set(initialCountryIds);
  const finalCountryBranchIds = new Set(initialCountryBranchIds);
  const finalCityBranchIds = new Set(initialCityBranchIds);

  // 1. Resolve DOWNWARD from country authority roots
  if (initialCountryIds.length > 0) {
    try {
      const [cbRes, cityRes] = await Promise.all([
        supabase.from("country_branches").select("id").in("country_id", initialCountryIds).is("deleted_at", null),
        supabase.from("city_branches").select("id").in("country_id", initialCountryIds).is("deleted_at", null)
      ]);
      cbRes?.data?.forEach((r: any) => { if (r.id) finalCountryBranchIds.add(r.id); });
      cityRes?.data?.forEach((r: any) => { if (r.id) finalCityBranchIds.add(r.id); });
    } catch (e) {
      console.error("Error resolving downward from country IDs:", e);
    }
  }

  // 2. Resolve DOWNWARD from country branch roots
  if (initialCountryBranchIds.length > 0) {
    try {
      const { data: cityRes } = await supabase
        .from("city_branches")
        .select("id")
        .in("country_branch_id", initialCountryBranchIds)
        .is("deleted_at", null);
      cityRes?.forEach((r: any) => { if (r.id) finalCityBranchIds.add(r.id); });
    } catch (e) {
      console.error("Error resolving downward from country branch IDs:", e);
    }
  }

  return {
    countryIds: Array.from(finalCountryIds),
    countryBranchIds: Array.from(finalCountryBranchIds),
    cityBranchIds: Array.from(finalCityBranchIds)
  };
}

export async function getCurrentErpSession(): Promise<ErpSession | null> {
  try {
    // Temporary local session (for initial Super Admin bootstrapping)
    const temp = await readTempSession();
    if (temp) {
      // A temporary session is self-contained. Do not make an Admin API call here:
      // because local development may intentionally have no service-role key configured.
      const resolvedUserId = temp.userId;
      const adminSupabase: any = null;

      const perms = [...new Set(temp.roles.flatMap((role) => enterpriseRolePermissions[role] ?? []))];
      const tempAssignments: RoleAssignmentScope[] = (temp.assignments ?? []).map((a) => ({
        role: a.role,
        countryId: a.countryId,
        countryBranchId: a.countryBranchId,
        cityBranchId: a.cityBranchId,
        clearingAgentId: (a as any).clearingAgentId ?? null,
        ledgerVisibility: ((a as any).ledgerVisibility as LedgerVisibility) ?? "scoped"
      }));
      const { initialCountryIds, initialCountryBranchIds, initialCityBranchIds } = getAssignmentRoots(tempAssignments);
      const isSuperAdmin = temp.roles.includes("super_admin");

      const resolvedScopes = await resolveHierarchyScopes(
        adminSupabase,
        initialCountryIds,
        initialCountryBranchIds,
        initialCityBranchIds,
        isSuperAdmin
      );

      return {
        userId: resolvedUserId,
        email: temp.email,
        fullName: temp.fullName ?? null,
        preferredLanguage: temp.preferredLanguage,
        roles: temp.roles,
        permissions: perms,
        assignments: tempAssignments,
        countryIds: resolvedScopes.countryIds,
        countryBranchIds: resolvedScopes.countryBranchIds,
        cityBranchIds: resolvedScopes.cityBranchIds,
        isSuperAdmin,
        ...resolveShippingScope(tempAssignments, isSuperAdmin)
      };
    }

    if (!isSupabaseConfigured()) {
      return null;
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const db = supabase as unknown as { from(table: string): LooseQueryBuilder };

    const profileQuery = db.from("profiles").select("full_name, preferred_language_code").eq("id", user.id);
    const profileResult = await profileQuery.maybeSingle();

    // Select the shipping/clearing scope columns when present, but fall back gracefully for
    // databases where the 20260818_shipping_clearing_rbac migration has not been applied yet â€”
    // otherwise an unknown-column error here would return null and break authentication.
    let assignmentsResult = await db
      .from("user_role_assignments")
      .select("role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .is("deleted_at", null);
    if (assignmentsResult.error) {
      assignmentsResult = await db
        .from("user_role_assignments")
        .select("role, country_id, country_branch_id, city_branch_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .is("deleted_at", null);
    }

    if (assignmentsResult.error) {
      console.error("Role assignments query error:", assignmentsResult.error.message);
      return null;
    }

    const assignments = (assignmentsResult.data ?? [])
      .map((assignment) => {
        const role = normalizeRole(assignment.role);
        if (!role) return null;

        return {
          role,
          countryId: assignment.country_id,
          countryBranchId: assignment.country_branch_id,
          cityBranchId: assignment.city_branch_id,
          clearingAgentId: assignment.clearing_agent_id ?? null,
          ledgerVisibility: (assignment.ledger_visibility as LedgerVisibility) ?? "scoped"
        };
      })
      .filter((assignment): assignment is RoleAssignmentScope => Boolean(assignment));

    let roles = [...new Set(assignments.map((assignment) => assignment.role))];

    const isKnownSuperAdminEmail =
      user.email &&
      (user.email.toLowerCase() === "superadmin@damaan.com" ||
       user.email.toLowerCase() === "asmatdgtllc@users.damaan.local" ||
       user.email.toLowerCase().startsWith("superadmin"));

    if ((!roles.length || !roles.includes("super_admin")) && isKnownSuperAdminEmail) {
      roles = Array.from(new Set(["super_admin", ...roles]));
    }

    // Load explicit permission set if available; else fallback to role-template permissions.
    let permissions: string[] = [];
    try {
      const permQuery = db.from("user_permission_sets").select("permissions").eq("user_id", user.id);
      const permResult = (await (permQuery as any).maybeSingle()) as { data: PermissionSetRow | null };
      const explicit = permResult?.data?.permissions ?? null;
      permissions = explicit && Array.isArray(explicit) ? explicit.filter((p) => typeof p === "string" && p.length > 0) : [];
    } catch {
      permissions = [];
    }

    if (!permissions.length) {
      permissions = [...new Set(roles.flatMap((role) => enterpriseRolePermissions[role] ?? []))];
    }

    if (roles.includes("super_admin") && !permissions.includes("*:*")) {
      permissions = ["*:*", ...permissions];
    }

    const { initialCountryIds, initialCountryBranchIds, initialCityBranchIds } = getAssignmentRoots(assignments);
    const isSuperAdmin = roles.includes("super_admin") || Boolean(isKnownSuperAdminEmail);

    const resolvedScopes = await resolveHierarchyScopes(
      supabase,
      initialCountryIds,
      initialCountryBranchIds,
      initialCityBranchIds,
      isSuperAdmin
    );

    return {
      userId: user.id,
      email: user.email ?? null,
      fullName: profileResult.data?.full_name ?? null,
      preferredLanguage: profileResult.data?.preferred_language_code ?? "en",
      roles,
      permissions,
      assignments,
      countryIds: resolvedScopes.countryIds,
      countryBranchIds: resolvedScopes.countryBranchIds,
      cityBranchIds: resolvedScopes.cityBranchIds,
      isSuperAdmin,
      ...resolveShippingScope(assignments, isSuperAdmin)
    };
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE" || (err?.message && String(err.message).includes("Dynamic server usage"))) {
      throw err;
    }
    console.error("getCurrentErpSession Error:", err);
    return null;
  }
}

export async function requireErpSession() {
  const session = await getCurrentErpSession();

  if (!session) {
    redirect("/auth/login");
  }

  return session;
}

// Compatibility Aliases
export const requireSession = requireErpSession;
export const getSession = getCurrentErpSession;

