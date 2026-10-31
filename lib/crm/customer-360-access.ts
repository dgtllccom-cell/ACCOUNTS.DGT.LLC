import { scopedSessionForPermission } from "@/lib/permissions/scoped-session";
import type { ErpSession } from "@/lib/auth/session";
import { assertFinancialAccess, assertResourceDomain, ErpPermissionError, isStrictOperationalSession } from "@/lib/permissions/middleware";
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";

/** Authorize before direct SQL (which bypasses database RLS). */
export function authorizeCustomer360(session: ErpSession, action: "read" | "update" = "read") {
  if (isStrictOperationalSession(session)) throw new ErpPermissionError("CRM financial views are outside your access.");
  const scoped = scopedSessionForPermission(session, "customers", action);
  assertFinancialAccess(scoped);
  assertResourceDomain(scoped, "purchases");
  return scoped;
}

/** Customers.city_id is a geographic city, never an operational city branch.
 * Branch access comes from an existing, scoped enterprise account linked to the customer. */
export function customerVisibilitySql(sql: any, session: ErpSession, alias = "c") {
  const scope = sessionSqlScope(session);
  if (scope.kind === "all") return sql`TRUE`;
  if (scope.kind === "none") return sql`FALSE`;
  if (scope.kind === "country") return sql`${sql.unsafe(`${alias}.country_id`)} = ANY(${scope.ids}::uuid[])`;
  return sql`EXISTS (SELECT 1 FROM public.enterprise_accounts visible_account
    WHERE visible_account.customer_id = ${sql.unsafe(`${alias}.id`)} AND visible_account.deleted_at IS NULL
      AND ${sqlScopeCondition(sql, scope, "visible_account")})`;
}

/** CRM action scope IDs are text in the canonical schema. Never widen empty assignments. */
export function crmActionScopeSql(sql: any, session: ErpSession, alias = "a") {
  const scope = sessionSqlScope(session);
  const col = (name: string) => sql.unsafe(`${alias}.${name}`);
  if (scope.kind === "all") return sql`TRUE`;
  if (scope.kind === "none") return sql`FALSE`;
  if (scope.kind === "country") return sql`${col("country_id")} = ANY(${scope.ids}::text[])`;
  if (scope.kind === "countryBranch") return sql`${col("country_branch_id")} = ANY(${scope.ids}::text[])`;
  return sql`(${col("city_branch_id")} = ANY(${scope.ids}::text[]) OR
    (${col("city_branch_id")} IS NULL AND ${col("country_branch_id")} = ANY(${scope.ownCountryBranchIds ?? []}::text[])))`;
}

/** Each linked module retains its own permission and the scope that granted it. */
export function customerModuleScopeSql(sql: any, session: ErpSession, resource: string, alias: string) {
  try {
    const scoped = scopedSessionForPermission(session, resource, "read");
    return sqlScopeCondition(sql, sessionSqlScope(scoped), alias);
  } catch (error) {
    if (error instanceof ErpPermissionError) return sql`FALSE`;
    throw error;
  }
}
