import { scopedSessionForPermission } from "@/lib/permissions/scoped-session";
import type { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError } from "@/lib/permissions/middleware";
import { assertNotShippingOnly } from "@/lib/permissions/shipping-explicit-gate";
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { canManageTasks } from "@/lib/user-tasks/access";

const SOURCES: Record<string, string> = {
  cheques: "roznamcha", purchases: "purchases", sales: "sales", shipping_bl: "shipping_records",
  shipping_line: "shipping_records", followups: "messages", approvals: "approvals", tasks: "tasks",
};

/** Both summary counts and detail rows must use the permission/scope of their own source. */
export function smartDueSourceSql(sql: any, session: ErpSession, source: string, alias = "") {
  let scoped = { ...session };
  if (!SOURCES[source]) return sql`FALSE`;
  const financial = ["cheques", "purchases", "sales", "shipping_bl"].includes(source);
  if (!scoped.isSuperAdmin && financial && scoped.canViewFinancials !== true) return sql`FALSE`;
  // These sources have no agent/line filter. Do not expose other agents' records by geographic scope alone.
  if (!scoped.isSuperAdmin && ["shipping_bl", "shipping_line"].includes(source) && (scoped.isShippingScoped || scoped.shippingLineIds?.length)) return sql`FALSE`;
  try {
    if (financial) assertNotShippingOnly(scoped, "Smart Operations financial findings");
    scoped = scopedSessionForPermission(scoped, SOURCES[source], "read");
    if (financial) assertNotShippingOnly(scoped, "Smart Operations financial findings");
    if (financial && !scoped.isSuperAdmin && scoped.canViewFinancials !== true) return sql`FALSE`;
  } catch (error) {
    if (error instanceof ErpPermissionError) return sql`FALSE`;
    throw error;
  }
  const scope = sqlScopeCondition(sql, sessionSqlScope(scoped), alias);
  const col = (name: string) => sql.unsafe(alias ? `${alias}.${name}` : name);
  if (["tasks", "followups"].includes(source) && !canManageTasks(scoped)) {
    return sql`${scope} AND (${col("created_by")} = ${scoped.userId}::uuid OR ${col("assigned_to")} = ${scoped.userId}::uuid)`;
  }
  return scope;
}
