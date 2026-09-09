/**
 * Mobile access profiles — two SIMPLIFIED mobile working interfaces layered on
 * top of the existing user id / login / authentication / scope / permissions.
 *
 * These are NOT new roles and NOT a second backend. A user keeps their
 * enterprise role and country/branch scope; the mobile profile only:
 *   1. routes the user, after login, straight to a simple mobile screen, and
 *   2. hard-caps what resources/actions the server will allow — anything not on
 *      the profile's allow-list is denied in `authorize()` regardless of role.
 *
 *   standard            → full ERP (unchanged default)
 *   mobile_cash_ledger  → "Brother User": daily cash entry + cash book /
 *                          roznamcha / ledger / journal VIEWING. No user admin,
 *                          no settings, no editing/deleting posted transactions.
 *   mobile_field        → "Field User" (Munshi / loading / vehicle check):
 *                          only assigned operational forms + assigned jobs.
 *                          (UI delivered in a later phase; the cap is defined
 *                           here so the server is already safe.)
 */

export const MOBILE_PROFILES = ["standard", "mobile_cash_ledger", "mobile_field"] as const;
export type MobileProfile = (typeof MOBILE_PROFILES)[number];

export function isMobileProfile(v: unknown): v is MobileProfile {
  return typeof v === "string" && (MOBILE_PROFILES as readonly string[]).includes(v);
}

export function normalizeMobileProfile(v: unknown): MobileProfile {
  return isMobileProfile(v) ? v : "standard";
}

/**
 * The EXACT `resource:action` set each restricted mobile profile may touch.
 * `authorize()` denies anything outside this list for a user on that profile,
 * even if their role would otherwise permit it. Scope (country/branch) is still
 * enforced separately by the existing canAccess* checks.
 */
export const MOBILE_PROFILE_ALLOWED: Record<Exclude<MobileProfile, "standard">, readonly string[]> = {
  // Brother User — find an account, read its ledger, enter an authorized daily
  // cash receipt/payment. Reuses the existing roznamcha validation + posting.
  mobile_cash_ledger: [
    "dashboard:read",
    "countries:read",
    "country_branches:read",
    "city_branches:read",
    "companies:read",
    "customers:read",
    "accounts:read",
    "ledgers:read",
    "ledger:read",
    "currency_rates:read",
    "roznamcha:read",
    "roznamcha:create",
    "roznamcha:post",
    "journal_entries:read",
    "transactions:read",
    "reports:read",
  ],
  // Field User — read only the operational forms/records they are assigned, and
  // submit them into the EXISTING review workflow. No ledger, no amounts.
  mobile_field: [
    "dashboard:read",
    "countries:read",
    "country_branches:read",
    "city_branches:read",
    "shipping_records:read",
    "shipping_records:create",
    "shipping_records:update",
    "assignments:read",
    "assignments:update",
    "attachments:read",
    "attachments:create",
    "documents:read",
    "documents:create",
  ],
} as const;

/** Landing route for each profile after login. */
export const MOBILE_PROFILE_HOME: Record<MobileProfile, string> = {
  standard: "/dashboard",
  mobile_cash_ledger: "/m/cash",
  mobile_field: "/m/field",
};

/** URL-path prefixes a restricted profile is allowed to open (pages, not APIs). */
export const MOBILE_PROFILE_PATHS: Record<Exclude<MobileProfile, "standard">, readonly string[]> = {
  mobile_cash_ledger: ["/m/cash", "/m/common"],
  mobile_field: ["/m/field", "/m/common"],
};

/**
 * Exact set of API path prefixes a restricted profile's session may call. The
 * middleware returns 403 for any /api/erp/** request outside this list — the
 * hard perimeter that closes routes which do NOT go through authorize()
 * (HR/payroll, CRM, clearing-agents, audit, messages, …). `/api/erp/auth/*` is
 * always allowed (it is excluded from the middleware matcher).
 */
export const MOBILE_PROFILE_API_ALLOW: Record<Exclude<MobileProfile, "standard">, readonly string[]> = {
  mobile_cash_ledger: [
    "/api/erp/roznamcha",
    "/api/erp/ledgers",
    "/api/erp/accounting/ledgers",
    "/api/erp/accounting/accounts/lookup",
    "/api/erp/accounting/reports/ledger",
    "/api/erp/currency/daily-rate",
    "/api/erp/locations/countries",
  ],
  mobile_field: [
    "/api/erp/mobile-field",
    "/api/erp/locations/countries",
  ],
};

/** True when a restricted profile's session may call the given API path. */
export function mobileProfileAllowsApi(profile: MobileProfile, pathname: string): boolean {
  if (profile === "standard") return true;
  if (!pathname.startsWith("/api/erp/")) return true; // non-erp APIs (auth handled by matcher)
  const allow = MOBILE_PROFILE_API_ALLOW[profile] ?? [];
  return allow.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

/** goods→products alias, mirrors hasRolePermission(). */
function canon(resource: string) {
  return resource === "goods" ? "products" : resource;
}

/**
 * True when a user on `profile` may perform `resource:action`.
 * `standard` (and any unknown) → unrestricted (returns true).
 */
export function mobileProfileAllows(profile: MobileProfile, resource: string, action: string): boolean {
  if (profile === "standard") return true;
  const allow = MOBILE_PROFILE_ALLOWED[profile];
  if (!allow) return true;
  const r = canon(resource);
  return allow.includes(`${r}:${action}`) || allow.includes(`${r}:*`);
}

/** True when a restricted profile may open the given app path. */
export function mobileProfileAllowsPath(profile: MobileProfile, pathname: string): boolean {
  if (profile === "standard") return true;
  const prefixes = MOBILE_PROFILE_PATHS[profile];
  if (!prefixes) return true;
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Intersect an issued permission list with a profile's hard cap. */
export function capPermissionsToProfile(profile: MobileProfile, permissions: string[]): string[] {
  if (profile === "standard") return permissions;
  const allow = new Set(MOBILE_PROFILE_ALLOWED[profile] ?? []);
  return permissions.filter((p) => {
    const [res] = p.split(":");
    return allow.has(p) || allow.has(`${res}:*`);
  });
}
