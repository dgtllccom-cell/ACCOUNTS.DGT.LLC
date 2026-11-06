import type { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError } from "@/lib/permissions/middleware";

export const CLEARING_MENU_MARKER = "clearing_menu:restricted";
export const CLEARING_MENU_PATHS = [
  "/dashboard/shipping-line/agent-entry", "/dashboard/clearing-agent/list",
  "/dashboard/clearing-agent/agent-custom-entry", "/dashboard/clearing-agent/payment-bill-entry",
  "/dashboard/shipping-line/shipment-report", "/dashboard/tracking",
] as const;
export const CLEARING_MENU_HOME = CLEARING_MENU_PATHS[0];
export const CLEARING_MENU_PERMISSIONS = [
  CLEARING_MENU_MARKER, "finance_amounts:deny", "shipping_records:read", "shipping_records:create", "shipping_records:update",
  "clearing_agents:read", "clearing_agents:update", "shipping_reports:read", "reports:read", "reports:export",
  "customers:read", "companies:read", "countries:read", "country_branches:read", "city_branches:read", "location_master:read",
  "record_transfers:create", "inter_branch_transfers:create",
  ...CLEARING_MENU_PATHS.map((p) => `route:${p}`),
] as const;
type MenuSession = { isSuperAdmin?: boolean; permissions?: readonly string[] | null };
export function isClearingMenu(s: MenuSession) { return !s.isSuperAdmin && Boolean(s.permissions?.includes(CLEARING_MENU_MARKER)); }
export function capClearingMenuPermissions(permissions: string[], isSuperAdmin: boolean) {
  if (!isClearingMenu({ permissions, isSuperAdmin })) return permissions;
  const allowed = new Set<string>(CLEARING_MENU_PERMISSIONS);
  return [...new Set([...permissions.filter((p) => allowed.has(p)), "finance_amounts:deny"])];
}
export function clearingMenuAllowsPath(path: string) { return (CLEARING_MENU_PATHS as readonly string[]).includes(path.split("?")[0].replace(/\/+$/, "")); }
export function clearingMenuAllowsApi(pathname: string, method: string) {
  const path = pathname.split("?")[0].replace(/\/+$/, ""); const m = method.toUpperCase();
  if (/^\/api\/erp\/auth\/(session|logout|language|preferences)$/.test(path)) return ["GET", "POST"].includes(m);
  if (["/api/erp/shipping-line/agent-entry", "/api/erp/clearing-agent/agent-custom-entry", "/api/erp/clearing-agent/payment-bill"].includes(path)) return ["GET", "POST", "PATCH"].includes(m);
  if (/^\/api\/erp\/clearing-agent\/(agent-custom-entry|payment-bill)\/[0-9a-f-]{36}$/i.test(path)) return m === "PATCH";
  if (/^\/api\/erp\/clearing-agents\/[0-9a-f-]{36}$/i.test(path)) return ["GET", "PATCH", "PUT"].includes(m);
  if (path === "/api/erp/transfer-center") return m === "POST";
  if (/^\/api\/erp\/tracking\/[0-9a-f-]{36}\/events$/i.test(path)) return ["GET", "POST"].includes(m);
  if (m !== "GET") return false;
  if (["/api/erp/clearing-agents", "/api/erp/customers", "/api/erp/companies", "/api/erp/shipping-lines", "/api/erp/shipping/bl-records", "/api/erp/branding", "/api/erp/users/eligible-assignees"].includes(path)) return true;
  if (/^\/api\/erp\/(customers|companies|shipping-lines)\/[0-9a-f-]{36}$/i.test(path)) return true;
  if (/^\/api\/erp\/tracking\/(summary|list|search|[0-9a-f-]{36})$/i.test(path)) return true;
  return /^\/api\/erp\/locations\/(countries|states|districts|cities|areas)$/.test(path);
}
export function clearingAgentForWrite(session: ErpSession, value: string | null | undefined) {
  if (!isClearingMenu(session)) return value ?? null;
  const id = value || session.clearingAgentIds[0];
  if (!id || !session.clearingAgentIds.includes(id)) throw new ErpPermissionError("Clearing Agent assignment is outside your access.");
  return id;
}
export function clearingRecordAllowed(session: ErpSession, row: Record<string, any>, agentColumn = "agent_id") {
  if (!isClearingMenu(session)) return true;
  if (!session.clearingAgentIds.includes(row[agentColumn])) return false;
  return ["country_id", "country_branch_id", "city_branch_id"].every((key) => {
    if (!(key in row)) return true;
    const ids = key === "country_id" ? session.countryIds : key === "country_branch_id" ? session.countryBranchIds : session.cityBranchIds;
    return Boolean(row[key]) && ids.includes(row[key]);
  });
}
export function clearingAgentCondition(sql: any, session: ErpSession, column: string) {
  return isClearingMenu(session) ? sql`${sql.unsafe(column)} = any(${session.clearingAgentIds}::uuid[])` : sql`true`;
}
