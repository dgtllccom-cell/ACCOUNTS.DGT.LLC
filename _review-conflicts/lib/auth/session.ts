import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type EnterpriseRole, enterpriseRoles } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readTempSession } from "@/lib/auth/temp-session";

export type RoleAssignmentScope = {
  role: EnterpriseRole;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
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
};

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

  // 1. Resolve DOWNWARD from initial roots
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

  // 2. Resolve UPWARD from all gathered nodes to ensure parent context is included
  const cityBranchArray = Array.from(finalCityBranchIds);
  if (cityBranchArray.length > 0) {
    try {
      const { data } = await supabase
        .from("city_branches")
        .select("country_id, country_branch_id")
        .in("id", cityBranchArray)
        .is("deleted_at", null);
      data?.forEach((r: any) => {
        if (r.country_id) finalCountryIds.add(r.country_id);
        if (r.country_branch_id) finalCountryBranchIds.add(r.country_branch_id);
      });
    } catch (e) {
      console.error("Error resolving upward from city branches:", e);
    }
  }

  const countryBranchArray = Array.from(finalCountryBranchIds);
  if (countryBranchArray.length > 0) {
    try {
      const { data } = await supabase
        .from("country_branches")
        .select("country_id")
        .in("id", countryBranchArray)
        .is("deleted_at", null);
      data?.forEach((r: any) => {
        if (r.country_id) finalCountryIds.add(r.country_id);
      });
    } catch (e) {
      console.error("Error resolving upward from country branches:", e);
    }
  }

  return {
    countryIds: Array.from(finalCountryIds),
    countryBranchIds: Array.from(finalCountryBranchIds),
    cityBranchIds: Array.from(finalCityBranchIds)
  };
}

export async function getCurrentErpSession(): Promise<ErpSession | null> {
  // Temporary local session (for initial Super Admin bootstrapping)
  const temp = await readTempSession();
  if (temp) {
    let resolvedUserId = temp.userId;
    let adminSupabase: any = null;
    if (isSupabaseConfigured()) {
      try {
        adminSupabase = createSupabaseAdminClient();
        if (temp.userId.startsWith("00000000-")) {
          const { data: firstProfile } = await adminSupabase
            .from("profiles")
            .select("id")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstProfile?.id) {
            resolvedUserId = firstProfile.id;
          }
        }
      } catch (e) {
        console.error("Failed to resolve profile ID for temp session:", e);
      }
    }

    const perms = [...new Set(temp.roles.flatMap((role) => enterpriseRolePermissions[role] ?? []))];
    const { initialCountryIds, initialCountryBranchIds, initialCityBranchIds } = getAssignmentRoots(temp.assignments);
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
      fullName: temp.fullName,
      preferredLanguage: temp.preferredLanguage,
      roles: temp.roles,
      permissions: perms,
      assignments: temp.assignments,
      countryIds: resolvedScopes.countryIds,
      countryBranchIds: resolvedScopes.countryBranchIds,
      cityBranchIds: resolvedScopes.cityBranchIds,
      isSuperAdmin
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

  const assignmentsQuery = db
    .from("user_role_assignments")
    .select("role, country_id, country_branch_id, city_branch_id")
    .eq("user_id", user.id)
    .eq("is_active", true);
  const assignmentsResult = await assignmentsQuery.is("deleted_at", null);

  if (assignmentsResult.error) {
    throw new Error(assignmentsResult.error.message);
  }

  const assignments = (assignmentsResult.data ?? [])
    .map((assignment) => {
      const role = normalizeRole(assignment.role);
      if (!role) return null;

      return {
        role,
        countryId: assignment.country_id,
        countryBranchId: assignment.country_branch_id,
        cityBranchId: assignment.city_branch_id
      };
    })
    .filter((assignment): assignment is RoleAssignmentScope => Boolean(assignment));

  const roles = [...new Set(assignments.map((assignment) => assignment.role))];

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
  const isSuperAdmin = roles.includes("super_admin");

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
    isSuperAdmin
  };
}

export async function requireErpSession() {
  const session = await getCurrentErpSession();

  if (!session) {
    throw new ErpAuthError();
  }

  return session;
}
