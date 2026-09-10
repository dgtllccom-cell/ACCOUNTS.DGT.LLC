import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type EnterpriseRole, enterpriseRoles } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { readTempSession } from "@/lib/auth/temp-session";
import { type MobileProfile, normalizeMobileProfile } from "@/lib/permissions/mobile-profiles";

export type LedgerVisibility = "scoped" | "shipping_only" | "full";

export type OperationalDomain = "business" | "shipping" | "both";

export type RoleAssignmentScope = {
  role: EnterpriseRole;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  clearingAgentId: string | null;
  ledgerVisibility: LedgerVisibility;
  operationalDomain: OperationalDomain;
  mobileProfile: MobileProfile;
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
  // Operational domains this login belongs to, derived from its active assignments.
  // "business" → Purchase/Sales/Ledger/Accounting; "shipping" → Clearing Agent / Shipping Line.
  operationalDomains: OperationalDomain[];
  // Simplified mobile working interface. "standard" for every full-ERP user;
  // "mobile_cash_ledger" / "mobile_field" route the user to a simple mobile
  // screen and hard-cap what the server will allow (see lib/permissions/mobile-profiles).
  mobileProfile: MobileProfile;
};

/** True when this session may see data in the given operational domain. */
export function sessionInDomain(session: ErpSession, domain: OperationalDomain): boolean {
  if (session.isSuperAdmin) return true;
  return session.operationalDomains.includes("both") || session.operationalDomains.includes(domain);
}

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
  operational_domain?: string | null;
  mobile_profile?: string | null;
};

/** The effective mobile profile for a session = the most restrictive non-standard
 *  profile across active assignments (a user is normally on exactly one). */
export function resolveMobileProfile(assignments: RoleAssignmentScope[], isSuperAdmin: boolean): MobileProfile {
  if (isSuperAdmin) return "standard";
  const nonStandard = assignments.map((a) => a.mobileProfile).filter((p) => p && p !== "standard");
  return (nonStandard[0] as MobileProfile) ?? "standard";
}

/** Derive the shipping/clearing scope fields from a user's active assignments. */
export function resolveShippingScope(assignments: RoleAssignmentScope[], isSuperAdmin: boolean): {
  clearingAgentIds: string[];
  ledgerVisibility: LedgerVisibility;
  isShippingScoped: boolean;
  operationalDomains: OperationalDomain[];
} {
  const clearingAgentIds = [...new Set(assignments.map((a) => a.clearingAgentId).filter((v): v is string => Boolean(v)))];
  const hasFull = assignments.some((a) => a.ledgerVisibility === "full");
  const hasShippingOnly = assignments.some((a) => a.clearingAgentId && a.ledgerVisibility === "shipping_only");
  const ledgerVisibility: LedgerVisibility = hasFull ? "full" : hasShippingOnly ? "shipping_only" : "scoped";
  const isShippingScoped = !isSuperAdmin && !hasFull && hasShippingOnly && clearingAgentIds.length > 0;
  const domainSet = new Set<OperationalDomain>(
    assignments.map((a) => a.operationalDomain ?? "business")
  );
  if (isSuperAdmin) { domainSet.add("business"); domainSet.add("shipping"); }
  const operationalDomains = domainSet.size ? [...domainSet] : (["business"] as OperationalDomain[]);
  return { clearingAgentIds, ledgerVisibility, isShippingScoped, operationalDomains };
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

const BOOTSTRAP_EMAILS = new Set(["superadmin@damaan.com", "asmatdgtllc@users.damaan.local", "superadmin@dgt.llc", "shipping@dgt.llc"]);
// Synthetic UUIDs minted by readTempSession() for the bootstrap identities
// (temp-super-admin / temp-pakistan-country-admin / temp-quetta-city-admin / temp-shipping-line) —
// these have no DB row, so the live DB re-check is skipped for them.
const BOOTSTRAP_TEMP_UUIDS = new Set([
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
]);

/**
 * The single source of truth for a session's live state. Given an identity
 * (userId/email) and any `{ from(table) }` client, it re-reads the user's
 * CURRENT status, assignments and effective permissions from the database —
 * so disabling a user, changing their branch scope, changing their mobile
 * profile or editing their permission set all take effect on the NEXT request,
 * regardless of which login path issued the cookie.
 *
 * Returns null when the account is disabled / deleted / has no active
 * assignment (and is not a bootstrap super admin) — the caller then treats the
 * session as revoked.
 */
async function resolveErpSessionFromDb(
  db: { from(table: string): any },
  identity: { userId: string; email: string | null; preferredLanguage?: SupportedLanguage },
): Promise<ErpSession | null> {
  const isBootstrapEmail = Boolean(identity.email && BOOTSTRAP_EMAILS.has(identity.email.toLowerCase()));

  // 1. Current profile — a soft-deleted profile is a disabled account.
  //    An infrastructure error (client misconfigured) THROWS so the caller can
  //    fall back to the signed cookie rather than nuking every session.
  let profile: { full_name: string | null; preferred_language_code: SupportedLanguage | null; deleted_at?: string | null } | null = null;
  let profileErrored = false;
  {
    let r = await db.from("profiles").select("full_name, preferred_language_code, deleted_at").eq("id", identity.userId).maybeSingle();
    if (r?.error) r = await db.from("profiles").select("full_name, preferred_language_code").eq("id", identity.userId).maybeSingle();
    if (r?.error) profileErrored = true;
    else profile = (r?.data as any) ?? null;
  }
  if (profileErrored) throw new Error("session-db-unavailable: profiles");
  if (profile && (profile as any).deleted_at && !isBootstrapEmail) return null; // disabled
  if (!profile && !isBootstrapEmail) {
    // No profile row at all — a synthetic dev-session identity, not a real user.
    // Signal distinctly so the caller can keep dev-session working while a real
    // disabled/revoked account (which HAS a profile) still returns null.
    throw new Error("session-no-such-user");
  }

  // 2. Current active assignments (schema-drift tolerant).
  let assignmentsResult: { data: AssignmentRow[] | null; error?: { message: string } | null } = { data: null };
  const selects = [
    "role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility, operational_domain, mobile_profile",
    "role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility",
    "role, country_id, country_branch_id, city_branch_id",
  ];
  for (const sel of selects) {
    assignmentsResult = await db.from("user_role_assignments").select(sel).eq("user_id", identity.userId).eq("is_active", true).is("deleted_at", null);
    if (!assignmentsResult.error) break;
  }
  if (assignmentsResult.error) {
    throw new Error("session-db-unavailable: user_role_assignments " + assignmentsResult.error.message);
  }

  const assignments = (assignmentsResult.data ?? [])
    .map((assignment) => {
      const role = normalizeRole(assignment.role);
      if (!role) return null;
      const rawDomain = (assignment as AssignmentRow).operational_domain;
      const operationalDomain: OperationalDomain = rawDomain === "shipping" || rawDomain === "both" ? rawDomain : "business";
      return {
        role,
        countryId: assignment.country_id,
        countryBranchId: assignment.country_branch_id,
        cityBranchId: assignment.city_branch_id,
        clearingAgentId: assignment.clearing_agent_id ?? null,
        ledgerVisibility: (assignment.ledger_visibility as LedgerVisibility) ?? "scoped",
        operationalDomain,
        mobileProfile: normalizeMobileProfile((assignment as AssignmentRow).mobile_profile),
      } as RoleAssignmentScope;
    })
    .filter((a): a is RoleAssignmentScope => Boolean(a));

  let roles = [...new Set(assignments.map((a) => a.role))];
  if ((!roles.length || !roles.includes("super_admin")) && isBootstrapEmail) {
    roles = Array.from(new Set(["super_admin", ...roles]));
  }

  // A non-bootstrap user with no active assignment has been revoked.
  if (!roles.length && !isBootstrapEmail) return null;

  // 3. Effective permissions — the user's SAVED custom set wins; role defaults
  //    are only a fallback. Never widen a custom set to role defaults.
  let permissions: string[] = [];
  try {
    const permResult = (await db.from("user_permission_sets").select("permissions").eq("user_id", identity.userId).maybeSingle()) as { data: PermissionSetRow | null };
    const explicit = permResult?.data?.permissions ?? null;
    permissions = explicit && Array.isArray(explicit) ? explicit.filter((p) => typeof p === "string" && p.length > 0) : [];
  } catch { permissions = []; }
  if (!permissions.length) {
    permissions = [...new Set(roles.flatMap((role) => enterpriseRolePermissions[role] ?? []))];
  }
  if (roles.includes("super_admin") && !permissions.includes("*:*")) {
    permissions = ["*:*", ...permissions];
  }

  const { initialCountryIds, initialCountryBranchIds, initialCityBranchIds } = getAssignmentRoots(assignments);
  const isSuperAdmin = roles.includes("super_admin") || isBootstrapEmail;

  const resolvedScopes = await resolveHierarchyScopes(db, initialCountryIds, initialCountryBranchIds, initialCityBranchIds, isSuperAdmin);

  return {
    userId: identity.userId,
    email: identity.email,
    fullName: profile?.full_name ?? null,
    preferredLanguage: profile?.preferred_language_code ?? identity.preferredLanguage ?? "en",
    roles,
    permissions,
    assignments,
    countryIds: resolvedScopes.countryIds,
    countryBranchIds: resolvedScopes.countryBranchIds,
    cityBranchIds: resolvedScopes.cityBranchIds,
    isSuperAdmin,
    ...resolveShippingScope(assignments, isSuperAdmin),
    mobileProfile: resolveMobileProfile(assignments, isSuperAdmin),
  };
}

export async function getCurrentErpSession(): Promise<ErpSession | null> {
  try {
    // ── Custom login path (POST /api/erp/auth/login → signed temp-session JWT) ──
    const temp = await readTempSession();
    if (temp) {
      const isBootstrap =
        Boolean(temp.email && BOOTSTRAP_EMAILS.has(temp.email.toLowerCase())) ||
        BOOTSTRAP_TEMP_UUIDS.has(temp.userId);

      // Re-validate against the database on EVERY request so a disablement /
      // permission change / scope change / mobile-profile change is enforced on
      // the next protected request — not only after a voluntary re-login.
      if (!isBootstrap) {
        let admin: any = null;
        try { admin = createSupabaseAdminClient(); } catch { admin = null; }
        if (admin) {
          try {
            const live = await resolveErpSessionFromDb(admin, {
              userId: temp.userId,
              email: temp.email,
              preferredLanguage: temp.preferredLanguage,
            });
            return live; // null ⇒ revoked ⇒ requireErpSession() redirects to login
          } catch (e: any) {
            const msg = String(e?.message || "");
            // A synthetic dev-session identity has no profile row — keep it working
            // only when demo auth is explicitly enabled (never in production).
            if (msg.includes("session-no-such-user")) {
              if (!isDemoAuthEnabled()) return null;
              // fall through to the signed-cookie build below
            } else {
              // DB unreachable / client misconfigured — fall through to the signed
              // cookie so a transient infra fault does not log everyone out.
              console.warn("[session] live re-check unavailable, using signed cookie:", msg);
            }
          }
        }
      }

      // Fallback (bootstrap super admin, or no service-role key in local dev):
      // trust the signed, non-forgeable cookie. Custom permission sets cannot be
      // loaded here, so use role-template permissions.
      const tempAssignments: RoleAssignmentScope[] = (temp.assignments ?? []).map((a) => {
        const d = (a as any).operationalDomain;
        return {
          role: a.role,
          countryId: a.countryId,
          countryBranchId: a.countryBranchId,
          cityBranchId: a.cityBranchId,
          clearingAgentId: (a as any).clearingAgentId ?? null,
          ledgerVisibility: ((a as any).ledgerVisibility as LedgerVisibility) ?? "scoped",
          operationalDomain: (d === "shipping" || d === "both" ? d : "business") as OperationalDomain,
          mobileProfile: normalizeMobileProfile((a as any).mobileProfile),
        };
      });
      const { initialCountryIds, initialCountryBranchIds, initialCityBranchIds } = getAssignmentRoots(tempAssignments);
      const isSuperAdmin = temp.roles.includes("super_admin");
      const resolvedScopes = await resolveHierarchyScopes(null, initialCountryIds, initialCountryBranchIds, initialCityBranchIds, isSuperAdmin);
      const perms = [...new Set(temp.roles.flatMap((role) => enterpriseRolePermissions[role] ?? []))];
      return {
        userId: temp.userId,
        email: temp.email,
        fullName: temp.fullName ?? null,
        preferredLanguage: temp.preferredLanguage,
        roles: temp.roles,
        permissions: isSuperAdmin && !perms.includes("*:*") ? ["*:*", ...perms] : perms,
        assignments: tempAssignments,
        countryIds: resolvedScopes.countryIds,
        countryBranchIds: resolvedScopes.countryBranchIds,
        cityBranchIds: resolvedScopes.cityBranchIds,
        isSuperAdmin,
        ...resolveShippingScope(tempAssignments, isSuperAdmin),
        mobileProfile: resolveMobileProfile(tempAssignments, isSuperAdmin),
      };
    }

    if (!isSupabaseConfigured()) {
      return null;
    }

    // ── Supabase Auth login path ─────────────────────────────────────────────
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const db = supabase as unknown as { from(table: string): LooseQueryBuilder };
    return resolveErpSessionFromDb(db as any, { userId: user.id, email: user.email ?? null });
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

