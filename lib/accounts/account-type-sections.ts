/**
 * Which information sections apply to an account, driven ONLY by the Account Type the user selected (and the linked-master toggles).
 * Single source of truth for the New/Edit Account wizard, the Live Report panel and the Account Print / PDF report, so a Personal Account
 * never shows (or asks for) Bank / Warehouse / Company details it does not have.
 */
export type AccountSectionFlags = { customer: boolean; company: boolean; bank: boolean; warehouse: boolean; tax: boolean };

export type AccountSectionInput = {
  accountTitle?: string | null;
  subType?: string | null;
  category?: string | null;
  /** wizard toggles; `undefined` = not known (print of a stored account) → decided by the data that exists */
  companyRequired?: boolean;
  bankRequired?: boolean;
  warehouseRequired?: boolean;
  hasCustomer?: boolean;
  hasCompany?: boolean;
  hasBank?: boolean;
  hasWarehouse?: boolean;
};

const norm = (v?: string | null) => String(v ?? "").trim().toLowerCase();

/** Sub-types that are a private person — no company entity behind them. */
export function isPersonalSubType(subType?: string | null) {
  const s = norm(subType);
  return s === "personal account" || s === "personal bank";
}

export function accountSectionsFor(i: AccountSectionInput): AccountSectionFlags {
  const title = norm(i.accountTitle);
  const isExpense = i.category === "EX" || title === "expenses account";
  const isPersonalOrEmployee = title === "personal" || title === "employee";
  if (isExpense || isPersonalOrEmployee) return { customer: false, company: false, bank: false, warehouse: false, tax: false };

  const customer = title === "customer" || Boolean(i.hasCustomer);
  const company = title === "company" || i.companyRequired === true || Boolean(i.hasCompany);
  const bank = title === "bank" || i.bankRequired === true || Boolean(i.hasBank);
  const warehouse = i.warehouseRequired === true || Boolean(i.hasWarehouse);
  return { customer, company, bank, warehouse, tax: company };
}
