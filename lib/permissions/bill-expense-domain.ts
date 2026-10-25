import type { ErpSession } from "@/lib/auth/session";
import { ApiClientError } from "@/lib/api/response";
import { isBusinessDomainOnly, isShippingDomainOnly } from "@/lib/permissions/shipping-explicit-gate";

/** Source bills of the BUSINESS domain (purchase / sales). */
export const BUSINESS_BILL_MODULES = ["purchase_booking", "local_purchase", "sales_booking", "local_sales"] as const;
/** Source bills of the SHIPPING LINE & CLEARING AGENT domain. */
export const SHIPPING_BILL_MODULES = ["shipping_bl", "clearing_bill"] as const;
export const ALL_BILL_MODULES = [...BUSINESS_BILL_MODULES, ...SHIPPING_BILL_MODULES] as const;

/**
 * The bill-expense source modules a login may see. Business and Shipping expenses stay separated: a Business-only login never
 * receives Shipping BL / clearing bills, a Shipping-only login never receives purchase / sales bills. Super Admin and logins bound to
 * both domains see everything inside their country / branch scope.
 */
export function allowedBillExpenseModules(session: ErpSession): readonly string[] {
  if (session.isSuperAdmin) return ALL_BILL_MODULES;
  if (isShippingDomainOnly(session)) return SHIPPING_BILL_MODULES;
  if (isBusinessDomainOnly(session)) return BUSINESS_BILL_MODULES;
  return ALL_BILL_MODULES;
}

export function billExpenseModuleAllowed(session: ErpSession, sourceModule: string | null | undefined): boolean {
  return Boolean(sourceModule) && allowedBillExpenseModules(session).includes(String(sourceModule));
}

/** Throws a 403 when the login's operational domain does not include this source bill's module. */
export function assertBillExpenseModuleAllowed(session: ErpSession, sourceModule: string | null | undefined): void {
  if (!billExpenseModuleAllowed(session, sourceModule)) {
    throw new ApiClientError("This bill belongs to a different operational domain than your login (Business vs Shipping Line).", { status: 403, code: "DOMAIN_FORBIDDEN" });
  }
}

/** Bill titles of the standalone expense bills (expenses_bills) that belong to the Shipping Line domain. */
export const SHIPPING_EXPENSE_BILL_TITLES: ReadonlySet<string> = new Set([
  "customer_expenses",
  "truck_expenses",
  "customs_expenses",
  "other_expenses",
  "truck_freight_rent"
]);

/** True when a standalone expense bill (by title) may be seen by this login. */
export function expenseBillTitleAllowed(session: ErpSession, billTitle: string | null | undefined): boolean {
  if (session.isSuperAdmin) return true;
  const isShippingTitle = SHIPPING_EXPENSE_BILL_TITLES.has(String(billTitle || ""));
  if (isShippingTitle) return !isBusinessDomainOnly(session);
  return !isShippingDomainOnly(session);
}

export type ExpenseSection = "all" | "business" | "shipping";

/**
 * The section a request may actually see. A Business-only login always gets "business", a Shipping-only login always "shipping"
 * (whatever the query string says). Logins explicitly authorized for BOTH domains (Branch / Country / Super Admin) get the section
 * they asked for, defaulting to "all"; the country / branch scope is enforced separately and never widened by this value.
 */
export function effectiveExpenseSection(session: ErpSession, requested: string | null | undefined): ExpenseSection {
  if (!session.isSuperAdmin && isShippingDomainOnly(session)) return "shipping";
  if (!session.isSuperAdmin && isBusinessDomainOnly(session)) return "business";
  return requested === "business" || requested === "shipping" ? requested : "all";
}

/** Source modules (bill_expenses) for an effective section. */
export function modulesForSection(section: ExpenseSection): readonly string[] {
  return section === "business" ? BUSINESS_BILL_MODULES : section === "shipping" ? SHIPPING_BILL_MODULES : ALL_BILL_MODULES;
}

/** True when this login may choose between the Business and Shipping Line sections (Super Admin, or explicitly authorized for both). */
export function canChooseExpenseSection(session: ErpSession): boolean {
  return Boolean(session.isSuperAdmin) || (!isShippingDomainOnly(session) && !isBusinessDomainOnly(session));
}
