/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireErpSession, ErpAuthError, type ErpSession } from "@/lib/auth/session";

const MANAGEMENT_ROLES = ["country_admin", "main_branch_admin", "city_branch_admin"];

/** Any authenticated ERP user may read; only super admins + management roles may write. */
export async function requireOfficeSession(write: boolean): Promise<ErpSession> {
  const session = await requireErpSession();
  if (write) {
    const canManage = session.isSuperAdmin || (session.roles || []).some((r) => MANAGEMENT_ROLES.includes(r));
    if (!canManage) throw new ErpAuthError("You do not have permission to manage General Office HR records.");
  }
  return session;
}

/**
 * Branch-scoped read filter: super admins see everything; everyone else sees records whose
 * country / city branch is within their assigned scope (or records they created).
 */
export function officeScopeWhere(sql: any, session: ErpSession, alias?: string) {
  if (session.isSuperAdmin) return sql`true`;
  const cids = session.countryIds || [];
  const ccids = session.cityBranchIds || [];
  // qualify the columns when the caller's query joins other tables that also
  // have country_id / city_branch_id / created_by (employees, customers …)
  const co = alias ? sql(`${alias}.country_id`) : sql`country_id`;
  const city = alias ? sql(`${alias}.city_branch_id`) : sql`city_branch_id`;
  const cb = alias ? sql(`${alias}.created_by`) : sql`created_by`;
  return sql`(
    (${cids.length > 0} and ${co} = any(${cids}))
    or (${ccids.length > 0} and ${city} = any(${ccids}))
    or ${cb} = ${session.userId}
  )`;
}
