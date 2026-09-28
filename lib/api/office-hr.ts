/* eslint-disable @typescript-eslint/no-explicit-any */
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
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
  // One scope rule (sessionSqlScope): country roles → their country, branch users → their
  // city branch only (session.countryIds also carries a branch user's parent country, so
  // matching on it widened branch users to the whole country), plus the caller's own rows.
  const scope = sessionSqlScope(session);
  if (scope.kind === "all") return sql`true`;
  const cb = alias ? sql(`${alias}.created_by`) : sql`created_by`;
  const inScope = sqlScopeCondition(sql, scope, alias || "", { hasCountryBranchCol: false });
  return sql`(${inScope} or ${cb} = ${session.userId})`;
}
