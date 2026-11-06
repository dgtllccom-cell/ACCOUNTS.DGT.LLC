/** Restricted Truck Registration access, stored in the existing per-user permission set. */
export const TRUCK_TRIAL_MARKER = "truck_trial:restricted";
export const TRUCK_TRIAL_HOME = "/dashboard/clearing-agent/truck-registration";
export const TRUCK_TRIAL_PERMISSIONS = [
  TRUCK_TRIAL_MARKER, "finance_amounts:deny",
  "shipping_records:read", "shipping_records:create",
  "customers:read", "customers:create", "companies:read", "companies:create",
  "countries:read", "country_branches:read", "city_branches:read", "location_master:read",
  `route:${TRUCK_TRIAL_HOME}`,
] as const;

export function isTruckTrial(session: { isSuperAdmin?: boolean; permissions?: readonly string[] | null }) {
  return !session.isSuperAdmin && Boolean(session.permissions?.includes(TRUCK_TRIAL_MARKER));
}

export function capTruckTrialPermissions(permissions: string[], isSuperAdmin: boolean) {
  if (!isTruckTrial({ permissions, isSuperAdmin })) return permissions;
  const allowed = new Set<string>(TRUCK_TRIAL_PERMISSIONS);
  return [...new Set([...permissions.filter((p) => allowed.has(p)), "finance_amounts:deny"])];
}

export function truckTrialAllowsPath(pathname: string) {
  return pathname.split("?")[0].replace(/\/+$/, "") === TRUCK_TRIAL_HOME;
}

/** Only the existing truck and embedded master forms; no sibling Shipping APIs or financial endpoints. */
export function truckTrialAllowsApi(pathname: string, method: string) {
  const path = pathname.split("?")[0].replace(/\/+$/, "");
  const verb = method.toUpperCase();
  if (/^\/api\/erp\/auth\/(session|logout|language|preferences)$/.test(path)) return ["GET", "POST"].includes(verb);
  if (verb === "POST") return ["/api/erp/master-data/trucks", "/api/erp/customers", "/api/erp/companies"].includes(path);
  if (verb !== "GET") return false;
  if (["/api/erp/master-data/trucks", "/api/erp/master-data/truck-options", "/api/erp/customers", "/api/erp/companies", "/api/erp/companies/duplicates"].includes(path)) return true;
  if (/^\/api\/erp\/(master-data\/trucks|customers|companies)\/[0-9a-f-]{36}$/i.test(path)) return true;
  if (/^\/api\/erp\/locations\/(countries|states|states-provinces|districts|cities|areas|area-locations)(\/[0-9a-f-]{36})?$/i.test(path)) return true;
  return /^\/api\/branch-management\/(countries|country-branches|city-branches)$/.test(path);
}
