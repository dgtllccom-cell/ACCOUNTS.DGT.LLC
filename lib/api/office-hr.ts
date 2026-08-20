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
export function officeScopeWhere(sql: any, session: ErpSession) {
  if (session.isSuperAdmin) return sql`true`;
  const cids = session.countryIds || [];
  const ccids = session.cityBranchIds || [];
  return sql`(
    (${cids.length > 0} and country_id = any(${cids}))
    or (${ccids.length > 0} and city_branch_id = any(${ccids}))
    or created_by = ${session.userId}
  )`;
}
