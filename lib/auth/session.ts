import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type EnterpriseRole, type StoredEnterpriseRole, type AccessProfile, enterpriseRoles, accessProfiles,
  deriveEffectiveRole, storedRoleScopeLevel, NON_FINANCIAL_ROLES, GLOBAL_SCOPE_ROLES,
} from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions, SHIPPING_BUNDLE_SHIPPING_DOMAIN_ONLY, capPermissionsForRoles } from "@/lib/permissions/enterprise-roles";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { readTempSession } from "@/lib/auth/temp-session";
import { type MobileProfile, normalizeMobileProfile } from "@/lib/permissions/mobile-profiles";

export { storedRoleScopeLevel };
export type LedgerVisibility = "scoped" | "shipping_only" | "full";

export type OperationalDomain = "business" | "shipping" | "both";

export type RoleAssignmentScope = {
  /** EFFECTIVE role (derived from stored role + access profile — see deriveEffectiveRole). */
  role: EnterpriseRole;
  /** The role as stored in user_role_assignments.role (decides the scope level). */
  storedRole?: StoredEnterpriseRole;
  /** NULL = standard role template; operations / shipping_line narrow the template. */
  accessProfile?: AccessProfile | null;
  shippingLineId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  warehouseIds?: string[] | null;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  clearingAgentId: string | null;
  ledgerVisibility: LedgerVisibility;
  operationalDomain: OperationalDomain;
  mobileProfile: MobileProfile;
};

/**
 * Role-template permissions for a set of roles. The Shipping-only tokens of the approved agent_user
 * bundle apply only when the agent's assignment is in the Shipping (or both) operational domain — an
 * agent_user row left on the default 'business' domain must not inherit reports/accounts/roznamcha.
 */
function roleTemplatePermissions(roles: EnterpriseRole[], assignments: Array<{ role: string; operationalDomain?: string | null }>): string[] {
  const out = new Set(roles.flatMap((role) => enterpriseRolePermissions[role] ?? []));
  if (roles.includes("agent_user")) {
    const shippingAgent = assignments.some((a) => a.role === "agent_user" && (a.operationalDomain === "shipping" || a.operationalDomain === "both"));
    if (!shippingAgent) {
      const otherRoleGrants = new Set(roles.filter((r) => r !== "agent_user").flatMap((r) => enterpriseRolePermissions[r] ?? []));
      for (const t of SHIPPING_BUNDLE_SHIPPING_DOMAIN_ONLY) if (!otherRoleGrants.has(t)) out.delete(t);
    }
  }
  return [...out];
}

/** One assignment with its own expanded scope and its own permissions (used to bind permissions to the scope that grants them). */
export type AssignmentGrant = {
  role: EnterpriseRole;
  permissions: string[];
  countryIds: string[];
  countryBranchIds: string[];
  cityBranchIds: string[];
  assignment: RoleAssignmentScope;
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
  // True right after an admin-issued temporary password reset - the dashboard
  // layout redirects to /auth/set-new-password until the user sets their own.
  mustChangePassword: boolean;
  /** Global DATA scope (every country/branch) — Super Admin, Super Admin Reports and Global Operations Admin. Does NOT imply any permission. */
  isGlobalScope: boolean;
  /** Shipping lines this login is bound to (Shipping Line Admin / User). Empty = not shipping-line-bound. */
  shippingLineIds: string[];
  /** False for operations / shipping-line logins and when the field-level permission finance_amounts:deny is set. */
  canViewFinancials: boolean;
  /** Present only for a login with several assignments of different permission sets: per-assignment scope+grants. */
  assignmentGrants?: AssignmentGrant[];
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
  source: string | null;
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
  access_profile?: string | null;
  shipping_line_id?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  warehouse_ids?: string[] | null;
};

function normalizeAccessProfile(v: unknown): AccessProfile | null {
  return typeof v === "string" && (accessProfiles as readonly string[]).includes(v) ? (v as AccessProfile) : null;
}

/** An assignment is live when today falls inside its (optional) effective window. */
export function assignmentIsEffective(a: { effectiveFrom?: string | null; effectiveTo?: string | null }, today = new Date().toISOString().slice(0, 10)): boolean {
  if (a.effectiveFrom && String(a.effectiveFrom).slice(0, 10) > today) return false;
  if (a.effectiveTo && String(a.effectiveTo).slice(0, 10) < today) return false;
  return true;
}

/** Field-level financial visibility: explicit deny wins, explicit grant wins, otherwise operations/shipping-line roles are denied. */
export function deriveCanViewFinancials(roles: string[], permissions: string[], isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  if (permissions.includes("finance_amounts:deny")) return false;
  // an operations / shipping-line-only login never sees amounts, whatever token it carries (capPermissionsForRoles strips them too)
  if (roles.length > 0 && roles.every((r) => NON_FINANCIAL_ROLES.includes(r))) return false;
  if (permissions.includes("finance_amounts:read") || permissions.includes("*:*")) return true;
  return roles.some((r) => !NON_FINANCIAL_ROLES.includes(r));
}

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

function normalizeRole(role: string): StoredEnterpriseRole | null {
  if (role === "branch_admin") return "city_branch_admin";
  if (role === "staff") return "staff_user";
  return enterpriseRoles.includes(role as StoredEnterpriseRole) ? (role as StoredEnterpriseRole) : null;
}

function uniqueStrings(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function getAssignmentRoots(assignments: RoleAssignmentScope[]) {
  const cIds: string[] = [];
  const cbIds: string[] = [];
  const cityIds: string[] = [];
  // Narrower roots: only counted when the assignment's role genuinely holds
  // authority AT that level (no more-specific column also set on the same
  // row) — used to drive DOWNWARD expansion in resolveHierarchyScopes().
  // Without this split, a city-branch assignment's denormalized parent
  // country_branch_id/country_id (see below) would be treated the same as
  // a real main_branch_admin/country_admin grant and silently widen a
  // city-scoped user's cityBranchIds to every sibling city under that same
  // branch — defeating city-level RBAC for every such user.
  const downwardCIds: string[] = [];
  const downwardCbIds: string[] = [];

  // A city-branch assignment row commonly also carries its own parent
  // country_branch_id/country_id (denormalized at assignment time) — collect
  // ALL populated levels from each assignment rather than only the most
  // specific one, so a city-branch-scoped user's session still knows its
  // own parent chain. resolveHierarchyScopes() below additionally resolves
  // upward via the branch tables for any assignment where the parent
  // columns were left null, so both cases are covered.
  for (const a of assignments) {
    if (a.cityBranchId) cityIds.push(a.cityBranchId);
    if (a.countryBranchId) cbIds.push(a.countryBranchId);
    if (a.countryId) cIds.push(a.countryId);

    if (a.countryBranchId && !a.cityBranchId) downwardCbIds.push(a.countryBranchId);
    if (a.countryId && !a.countryBranchId && !a.cityBranchId) downwardCIds.push(a.countryId);
  }

  return {
    initialCountryIds: uniqueStrings(cIds),
    initialCountryBranchIds: uniqueStrings(cbIds),
    initialCityBranchIds: uniqueStrings(cityIds),
    downwardCountryIds: uniqueStrings(downwardCIds),
    downwardCountryBranchIds: uniqueStrings(downwardCbIds)
  };
}

async function resolveHierarchyScopes(
  supabase: any,
  initialCountryIds: string[],
  initialCountryBranchIds: string[],
  initialCityBranchIds: string[],
  isSuperAdmin: boolean,
  downwardCountryIds: string[] = initialCountryIds,
  downwardCountryBranchIds: string[] = initialCountryBranchIds
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

  // 1. Resolve DOWNWARD from country authority roots — only countryIds that
  //    represent a genuine country-level grant (no countryBranchId/cityBranchId
  //    also set on that same assignment row), never a narrower assignment's
  //    denormalized parent country_id.
  if (downwardCountryIds.length > 0) {
    try {
      const [cbRes, cityRes] = await Promise.all([
        supabase.from("country_branches").select("id").in("country_id", downwardCountryIds).is("deleted_at", null),
        supabase.from("city_branches").select("id").in("country_id", downwardCountryIds).is("deleted_at", null)
      ]);
      cbRes?.data?.forEach((r: any) => { if (r.id) finalCountryBranchIds.add(r.id); });
      cityRes?.data?.forEach((r: any) => { if (r.id) finalCityBranchIds.add(r.id); });
    } catch (e) {
      console.error("Error resolving downward from country IDs:", e);
    }
  }

  // 2. Resolve DOWNWARD from country branch roots — only countryBranchIds that
  //    represent a genuine main-branch-level grant (no cityBranchId also set
  //    on that same assignment row). A city-branch_admin's assignment carries
  //    its parent countryBranchId too, but that is denormalized context, not
  //    a grant over every sibling city branch — using the unfiltered set here
  //    was the root cause of a city-scoped user's cityBranchIds silently
  //    widening to every city under the same main branch.
  if (downwardCountryBranchIds.length > 0) {
    try {
      const { data: cityRes } = await supabase
        .from("city_branches")
        .select("id")
        .in("country_branch_id", downwardCountryBranchIds)
        .is("deleted_at", null);
      cityRes?.forEach((r: any) => { if (r.id) finalCityBranchIds.add(r.id); });
    } catch (e) {
      console.error("Error resolving downward from country branch IDs:", e);
    }
  }

  // 3. Resolve UPWARD from city-branch roots to their parent country branch
  //    and country. Without this, a user scoped ONLY at the city-branch level
  //    (e.g. a Business/Shipping admin or user assigned to one city branch,
  //    with no separate country/country-branch assignment) never gets their
  //    parent IDs into countryBranchIds/countryIds — so any query that reads
  //    an account/ledger/master record shared at the country-branch or
  //    country level (city_branch_id IS NULL, scoped one level up) matches
  //    nothing for them, even though that record legitimately applies to
  //    their branch. This was the root cause of Purchase/Sales accounts not
  //    loading for a city-branch-scoped user (e.g. Al Ras / Dubai) despite
  //    valid accounts existing at the country-branch level.
  if (initialCityBranchIds.length > 0) {
    try {
      const { data: cityRows } = await supabase
        .from("city_branches")
        .select("id, country_branch_id, country_id")
        .in("id", initialCityBranchIds)
        .is("deleted_at", null);
      cityRows?.forEach((r: any) => {
        if (r.country_branch_id) finalCountryBranchIds.add(r.country_branch_id);
        if (r.country_id) finalCountryIds.add(r.country_id);
      });
    } catch (e) {
      console.error("Error resolving upward from city branch IDs:", e);
    }
  }

  // 4. Resolve UPWARD from country-branch roots (including any just added in
  //    step 3) to their parent country, for the same reason as step 3.
  const countryBranchIdsForUpwardLookup = Array.from(finalCountryBranchIds);
  if (countryBranchIdsForUpwardLookup.length > 0) {
    try {
      const { data: branchRows } = await supabase
        .from("country_branches")
        .select("id, country_id")
        .in("id", countryBranchIdsForUpwardLookup)
        .is("deleted_at", null);
      branchRows?.forEach((r: any) => {
        if (r.country_id) finalCountryIds.add(r.country_id);
      });
    } catch (e) {
      console.error("Error resolving upward from country branch IDs:", e);
    }
  }

  return {
    countryIds: Array.from(finalCountryIds),
    countryBranchIds: Array.from(finalCountryBranchIds),
    cityBranchIds: Array.from(finalCityBranchIds)
  };
}

/** Every active country / main branch / city branch id (Global Operations Admin). */
async function expandToWholeNetwork(db: any, scopes: { countryIds: string[]; countryBranchIds: string[]; cityBranchIds: string[] }) {
  try {
    const [c, cb, ci] = await Promise.all([
      db.from("countries").select("id").is("deleted_at", null),
      db.from("country_branches").select("id").is("deleted_at", null),
      db.from("city_branches").select("id").is("deleted_at", null),
    ]);
    scopes.countryIds = (c?.data ?? []).map((r: any) => r.id);
    scopes.countryBranchIds = (cb?.data ?? []).map((r: any) => r.id);
    scopes.cityBranchIds = (ci?.data ?? []).map((r: any) => r.id);
  } catch (e) {
    console.error("Error expanding global scope:", e);
  }
}

/**
 * Per-assignment scope + permissions. Only built when the login has several assignments whose permission sets differ —
 * that is the only case where the flat union (all permissions x all scopes) would over-grant (e.g. Country Admin in UAE
 * plus Finance in ONE branch must not give Finance for the whole country). authorize() narrows the session to the
 * assignments that actually grant what is being used.
 */
async function buildAssignmentGrants(db: any, assignments: RoleAssignmentScope[], isSuperAdmin: boolean, explicit: string[] | null): Promise<AssignmentGrant[] | null> {
  if (isSuperAdmin || assignments.length < 2) return null;
  const perAssignment = assignments.map((a) => ({ a, permissions: explicit ?? roleTemplatePermissions([a.role], [a]) }));
  const distinct = new Set(perAssignment.map((x) => [...x.permissions].sort().join("|")));
  if (distinct.size < 2) return null;
  const out: AssignmentGrant[] = [];
  for (const x of perAssignment) {
    const roots = getAssignmentRoots([x.a]);
    const sc = await resolveHierarchyScopes(db, roots.initialCountryIds, roots.initialCountryBranchIds, roots.initialCityBranchIds, false, roots.downwardCountryIds, roots.downwardCountryBranchIds);
    out.push({ role: x.a.role, permissions: x.permissions, countryIds: sc.countryIds, countryBranchIds: sc.countryBranchIds, cityBranchIds: sc.cityBranchIds, assignment: x.a });
  }
  return out;
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
  let profile: { full_name: string | null; preferred_language_code: SupportedLanguage | null; deleted_at?: string | null; must_change_password?: boolean | null } | null = null;
  let profileErrored = false;
  {
    let r = await db.from("profiles").select("full_name, preferred_language_code, deleted_at, must_change_password").eq("id", identity.userId).maybeSingle();
    if (r?.error) r = await db.from("profiles").select("full_name, preferred_language_code, deleted_at").eq("id", identity.userId).maybeSingle();
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
    "role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility, operational_domain, mobile_profile, access_profile, shipping_line_id, effective_from, effective_to, warehouse_ids",
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
      const storedRole = normalizeRole(assignment.role);
      if (!storedRole) return null;
      const rawDomain = (assignment as AssignmentRow).operational_domain;
      const operationalDomain: OperationalDomain = rawDomain === "shipping" || rawDomain === "both" ? rawDomain : "business";
      const accessProfile = normalizeAccessProfile((assignment as AssignmentRow).access_profile);
      const role = deriveEffectiveRole(storedRole, accessProfile);
      return {
        role,
        storedRole,
        accessProfile,
        shippingLineId: (assignment as AssignmentRow).shipping_line_id ?? null,
        effectiveFrom: (assignment as AssignmentRow).effective_from ?? null,
        effectiveTo: (assignment as AssignmentRow).effective_to ?? null,
        warehouseIds: (assignment as AssignmentRow).warehouse_ids ?? null,
        countryId: assignment.country_id,
        countryBranchId: assignment.country_branch_id,
        cityBranchId: assignment.city_branch_id,
        clearingAgentId: assignment.clearing_agent_id ?? null,
        ledgerVisibility: (assignment.ledger_visibility as LedgerVisibility) ?? "scoped",
        operationalDomain,
        mobileProfile: normalizeMobileProfile((assignment as AssignmentRow).mobile_profile),
      } as RoleAssignmentScope;
    })
    .filter((a): a is RoleAssignmentScope => Boolean(a))
    // an assignment outside its effective window grants nothing (not yet started / already ended)
    .filter((a) => assignmentIsEffective(a));

  let roles = [...new Set(assignments.map((a) => a.role))];
  if ((!roles.length || !roles.includes("super_admin")) && isBootstrapEmail) {
    roles = Array.from(new Set(["super_admin", ...roles]));
  }

  // A non-bootstrap user with no active assignment has been revoked.
  if (!roles.length && !isBootstrapEmail) return null;

  // 3. Effective permissions — a genuinely CUSTOM saved set wins over role
  //    defaults (never widened). But a set stamped source="role_default" was
  //    never a deliberate override — it was just a snapshot of the role's
  //    permissions taken at some earlier point (e.g. at user creation), and
  //    silently goes stale whenever enterpriseRolePermissions[role] is fixed
  //    or extended later (confirmed in practice: an inter_branch_transfers
  //    :approve fix to main_branch_admin/city_branch_admin never reached
  //    already-provisioned users on this path, leaving Accept broken for
  //    them specifically). Recompute live from the role definition for those
  //    rows instead of trusting the stored array.
  let permissions: string[] = [];
  // Field-level financial tokens are per-USER decisions, not part of any role template: they survive the role_default
  // recompute below (otherwise "Deny amounts and balances" on a role-default user would be silently dropped).
  let fieldLevelTokens: string[] = [];
  try {
    const permResult = (await db.from("user_permission_sets").select("permissions, source").eq("user_id", identity.userId).maybeSingle()) as { data: PermissionSetRow | null };
    const source = permResult?.data?.source ?? null;
    const stored = Array.isArray(permResult?.data?.permissions) ? permResult!.data!.permissions : [];
    fieldLevelTokens = stored.filter((p) => p === "finance_amounts:deny" || p === "finance_amounts:read");
    const explicit = source === "role_default" ? null : (permResult?.data?.permissions ?? null);
    permissions = explicit && Array.isArray(explicit) ? explicit.filter((p) => typeof p === "string" && p.length > 0) : [];
  } catch { permissions = []; }
  const usedExplicitPermissionSet = permissions.length > 0;
  if (!permissions.length) {
    permissions = [...new Set([...roleTemplatePermissions(roles, assignments), ...fieldLevelTokens])];
  }
  if (roles.includes("super_admin") && !permissions.includes("*:*")) {
    permissions = ["*:*", ...permissions];
  }

  const { initialCountryIds, initialCountryBranchIds, initialCityBranchIds, downwardCountryIds, downwardCountryBranchIds } = getAssignmentRoots(assignments);
  const isSuperAdmin = roles.includes("super_admin") || isBootstrapEmail;
  const isGlobalScope = isSuperAdmin || roles.some((r) => GLOBAL_SCOPE_ROLES.includes(r));

  const resolvedScopes = await resolveHierarchyScopes(db, initialCountryIds, initialCountryBranchIds, initialCityBranchIds, isSuperAdmin, downwardCountryIds, downwardCountryBranchIds);
  // A Global Operations Admin is global in DATA scope but not a Super Admin: give it every active country/branch id so both
  // "no filter" and "filter by session ids" call styles see the whole network (and nothing else).
  if (isGlobalScope && !isSuperAdmin) await expandToWholeNetwork(db, resolvedScopes);
  const assignmentGrants = await buildAssignmentGrants(db, assignments, isSuperAdmin, usedExplicitPermissionSet ? permissions : null);

  // 3b. Apply Branch Rules & Scoped Permission Overrides / Denials
  if (!isSuperAdmin) {
    try {
      const scopeIdsToCheck = [
        ...resolvedScopes.cityBranchIds,
        ...resolvedScopes.countryBranchIds,
        ...resolvedScopes.countryIds
      ].filter(Boolean);

      if (scopeIdsToCheck.length > 0) {
        const { data: branchRuleRows } = await db
          .from("branch_rules")
          .select("scope_type, scope_id, permissions, denied_permissions, allowed_domains")
          .in("scope_id", scopeIdsToCheck);

        if (branchRuleRows && branchRuleRows.length > 0) {
          const deniedSet = new Set<string>();
          const grantedSet = new Set<string>();
          branchRuleRows.forEach((br: any) => {
            if (Array.isArray(br.denied_permissions)) {
              br.denied_permissions.forEach((dp: string) => deniedSet.add(dp));
            }
            if (Array.isArray(br.permissions)) {
              br.permissions.forEach((gp: string) => grantedSet.add(gp));
            }
          });

          // Custom grants from Country/Main Branch/City Branch rules widen the role
          // default set (e.g. a Super Admin can grant a specific country's users an
          // extra module without changing their role). Applied BEFORE the deny pass
          // below so an explicit deny at any level in the chain always wins, even
          // over a custom grant at another level — matching the Permission Control
          // Center's own inherited→custom→denied precedence.
          if (grantedSet.size > 0) {
            permissions = [...new Set([...permissions, ...grantedSet])];
          }

          // Strip any denied permissions (including wildcard matches like "users:*")
          if (deniedSet.size > 0) {
            permissions = permissions.filter((p) => {
              if (deniedSet.has(p)) return false;
              const resource = p.split(":")[0];
              if (deniedSet.has(`${resource}:*`)) return false;
              return true;
            });
          }
        }
      }
    } catch {
      // Graceful fallback: maintain role default permissions if branch_rules lookup errors
    }
  }
  // operations / shipping-line logins: financial resources and wildcards never survive (last step, after branch rules)
  permissions = capPermissionsForRoles(roles, permissions);

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
    mustChangePassword: Boolean(profile?.must_change_password) && !isBootstrapEmail,
    isGlobalScope,
    shippingLineIds: [...new Set(assignments.map((a) => a.shippingLineId).filter((v): v is string => Boolean(v)))],
    canViewFinancials: deriveCanViewFinancials(roles, permissions, isSuperAdmin),
    ...(assignmentGrants ? { assignmentGrants } : {}),
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
      // `admin` is hoisted out of the `!isBootstrap` block so the signed-cookie
      // fallback below can still resolve city-branch -> country-branch/country
      // hierarchy scope with a real client, instead of silently skipping it.
      let admin: any = null;
      if (!isBootstrap) {
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

      // Fallback (bootstrap super admin, a synthetic dev-session identity, or
      // no service-role key in local dev): trust the signed, non-forgeable
      // cookie. Custom permission sets cannot be loaded here, so use
      // role-template permissions. Still resolve the city-branch/country-branch
      // hierarchy with `admin` when we have one (bootstrap identities skip this
      // — isSuperAdmin short-circuits resolveHierarchyScopes anyway) so a
      // city-branch-only assignment reached via this path still inherits its
      // parent country-branch/country scope, same as the DB-driven path above.
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
          accessProfile: normalizeAccessProfile((a as any).accessProfile),
          shippingLineId: (a as any).shippingLineId ?? null,
          effectiveFrom: (a as any).effectiveFrom ?? null,
          effectiveTo: (a as any).effectiveTo ?? null,
          warehouseIds: (a as any).warehouseIds ?? null,
        };
      }).filter((a) => assignmentIsEffective(a));
      const { initialCountryIds, initialCountryBranchIds, initialCityBranchIds, downwardCountryIds, downwardCountryBranchIds } = getAssignmentRoots(tempAssignments);
      const isSuperAdmin = temp.roles.includes("super_admin");
      const isGlobalScope = isSuperAdmin || temp.roles.some((r) => GLOBAL_SCOPE_ROLES.includes(r));
      const resolvedScopes = await resolveHierarchyScopes(admin, initialCountryIds, initialCountryBranchIds, initialCityBranchIds, isSuperAdmin, downwardCountryIds, downwardCountryBranchIds);
      if (isGlobalScope && !isSuperAdmin && admin) await expandToWholeNetwork(admin, resolvedScopes);
      let perms = roleTemplatePermissions(temp.roles, tempAssignments);

      // Same branch_rules custom-grant/deny application as resolveErpSessionFromDb,
      // so a synthetic dev-session identity or DB-unreachable fallback session is
      // still subject to Country/Main Branch/City Branch rules, not just role
      // defaults — keeping this path's enforcement consistent with the primary one.
      if (!isSuperAdmin && admin) {
        try {
          const scopeIdsToCheck = [
            ...resolvedScopes.cityBranchIds,
            ...resolvedScopes.countryBranchIds,
            ...resolvedScopes.countryIds
          ].filter(Boolean);

          if (scopeIdsToCheck.length > 0) {
            const { data: branchRuleRows } = await admin
              .from("branch_rules")
              .select("scope_type, scope_id, permissions, denied_permissions, allowed_domains")
              .in("scope_id", scopeIdsToCheck);

            if (branchRuleRows && branchRuleRows.length > 0) {
              const deniedSet = new Set<string>();
              const grantedSet = new Set<string>();
              branchRuleRows.forEach((br: any) => {
                if (Array.isArray(br.denied_permissions)) br.denied_permissions.forEach((dp: string) => deniedSet.add(dp));
                if (Array.isArray(br.permissions)) br.permissions.forEach((gp: string) => grantedSet.add(gp));
              });
              if (grantedSet.size > 0) perms = [...new Set([...perms, ...grantedSet])];
              if (deniedSet.size > 0) {
                perms = perms.filter((p) => {
                  if (deniedSet.has(p)) return false;
                  const resource = p.split(":")[0];
                  if (deniedSet.has(`${resource}:*`)) return false;
                  return true;
                });
              }
            }
          }
        } catch {
          // Graceful fallback: maintain role default permissions if branch_rules lookup errors
        }
      }
      return {
        userId: temp.userId,
        email: temp.email,
        fullName: temp.fullName ?? null,
        preferredLanguage: temp.preferredLanguage,
        roles: temp.roles,
        permissions: isSuperAdmin && !perms.includes("*:*") ? ["*:*", ...perms] : capPermissionsForRoles(temp.roles, perms),
        assignments: tempAssignments,
        countryIds: resolvedScopes.countryIds,
        countryBranchIds: resolvedScopes.countryBranchIds,
        cityBranchIds: resolvedScopes.cityBranchIds,
        isSuperAdmin,
        ...resolveShippingScope(tempAssignments, isSuperAdmin),
        mobileProfile: resolveMobileProfile(tempAssignments, isSuperAdmin),
        mustChangePassword: false,
        isGlobalScope,
        shippingLineIds: [...new Set(tempAssignments.map((a) => a.shippingLineId).filter((v): v is string => Boolean(v)))],
        canViewFinancials: deriveCanViewFinancials(temp.roles, perms, isSuperAdmin),
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

/** API-safe session getter - does NOT redirect, only returns null or session.
 *  Use this in API routes, server actions, and anywhere you can't use redirect(). */
export async function getErpSessionForApi(): Promise<ErpSession | null> {
  try {
    const session = await getCurrentErpSession();
    console.log("[session-api] getCurrentErpSession returned:", !!session, session?.email);
    return session;
  } catch (e) {
    console.error("[session-api] getCurrentErpSession threw:", (e as any)?.message);
    return null;
  }
}

/**
 * The EXACT session another user would receive on their next request — same resolver as login, no copy of the rules.
 * Used by User Setup / User Profile to show an administrator the effective-access summary. Returns null for a
 * disabled account or one with no effective assignment.
 */
export async function resolveEffectiveAccessForUser(userId: string, email: string | null): Promise<ErpSession | null> {
  const admin = createSupabaseAdminClient() as any;
  try {
    return await resolveErpSessionFromDb(admin, { userId, email });
  } catch {
    return null;
  }
}

// Compatibility Aliases
export const requireSession = requireErpSession;
export const getSession = getCurrentErpSession;

