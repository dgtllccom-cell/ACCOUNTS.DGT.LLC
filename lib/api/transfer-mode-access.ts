import type { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError, hasRolePermission } from "@/lib/permissions/middleware";

/**
 * Who may touch the Transfer Mode master (Settings -> Transfer Modes, and the Transfer Details section of Roznamcha cash entry):
 *  - read: anyone who can read Settings or work in Roznamcha (the cash-entry dropdown needs the list);
 *  - add:  Settings editors and Roznamcha posters (the cash-entry form can add a mode inline);
 *  - manage (edit / re-activate / delete): Settings editors only. A plain login with no permission can do none of these.
 */
export const canReadTransferModes = (s: ErpSession) =>
  s.isSuperAdmin || hasRolePermission(s, "settings", "read") || hasRolePermission(s, "roznamcha", "read") || hasRolePermission(s, "roznamcha", "post");
export const canManageTransferModes = (s: ErpSession) => s.isSuperAdmin || hasRolePermission(s, "settings", "update");
export const canAddTransferModes = (s: ErpSession) => canManageTransferModes(s) || hasRolePermission(s, "roznamcha", "post");

export function assertTransferMode(ok: boolean, what: string) {
  if (!ok) throw new ErpPermissionError("Missing permission: " + what);
}
