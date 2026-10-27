import type { ErpSession } from "@/lib/auth/session";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { SHIPPING_EXPENSE_BILL_TITLES } from "@/lib/permissions/bill-expense-domain";

/** Expense bills post to ledgers: FINANCIAL. No financial field access, or neither expense nor cash-book permission → denied. */
export function expensesDenied(session: ErpSession, action: "read" | "create", billTitle?: string | null): boolean {
  if (session.isSuperAdmin) return false;
  if (!session.canViewFinancials) return true;

  if (billTitle) {
    const title = String(billTitle);
    if (title === "truck_expenses" || title === "truck") {
      return !(hasRolePermission(session, "expenses_truck", action) || hasRolePermission(session, "expenses", action) || hasRolePermission(session, "roznamcha", action));
    }
    if (title === "customer_expenses" || title === "customer") {
      return !(hasRolePermission(session, "expenses_customer", action) || hasRolePermission(session, "expenses", action) || hasRolePermission(session, "roznamcha", action));
    }
    if (title === "customs_expenses" || title === "customs") {
      return !(hasRolePermission(session, "expenses_customs", action) || hasRolePermission(session, "expenses", action) || hasRolePermission(session, "roznamcha", action));
    }
    if (title === "other_expenses" || title === "other") {
      return !(hasRolePermission(session, "expenses_other", action) || hasRolePermission(session, "expenses", action) || hasRolePermission(session, "roznamcha", action));
    }
  }

  return !(
    hasRolePermission(session, "expenses", action) ||
    hasRolePermission(session, "roznamcha", action) ||
    hasRolePermission(session, "expenses_truck", action) ||
    hasRolePermission(session, "expenses_customer", action) ||
    hasRolePermission(session, "expenses_customs", action) ||
    hasRolePermission(session, "expenses_other", action)
  );
}

/** Bill titles of the Shipping Line (clearing agent) expense registers — one list, shared with the bill-expense domain rules. */
export const SHIPPING_ACCOUNTING_BILL_TITLES: ReadonlySet<string> = SHIPPING_EXPENSE_BILL_TITLES;
