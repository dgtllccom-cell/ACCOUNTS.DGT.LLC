import type { ErpSession } from "@/lib/auth/session";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { SHIPPING_EXPENSE_BILL_TITLES } from "@/lib/permissions/bill-expense-domain";

/** Expense bills post to ledgers: FINANCIAL. No financial field access, or neither expense nor cash-book permission → denied. */
export function expensesDenied(session: ErpSession, action: "read" | "create"): boolean {
  if (session.isSuperAdmin) return false;
  if (!session.canViewFinancials) return true;
  return !(hasRolePermission(session, "expenses", action) || hasRolePermission(session, "roznamcha", action));
}

/** Bill titles of the Shipping Line (clearing agent) expense registers — one list, shared with the bill-expense domain rules. */
export const SHIPPING_ACCOUNTING_BILL_TITLES: ReadonlySet<string> = SHIPPING_EXPENSE_BILL_TITLES;
