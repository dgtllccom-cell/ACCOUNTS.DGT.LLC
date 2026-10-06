/**
 * Document Intake — the single catalogue of ERP modules a scanned document can be entered into.
 *
 * Why this exists: the module the USER picks (not the document title) decides which accounts, party
 * and fields the review form shows. A supplier's "Sales Contract" is OUR Purchase; a customer's
 * "Purchase Order" is OUR Sale. This file is pure (no React / DB) so the same rules drive the UI, the
 * API validation and the unit tests.
 */

export type IntakeDomain = "business" | "shipping";
export type IntakeSide = "purchase" | "sales" | "shipping" | "cash" | "expense" | "master" | "other";
/** Which account pickers apply to a module. */
export type AccountRole = "supplier" | "purchase" | "customer" | "sales" | "debit" | "credit" | "bank";
export type ReviewTabId = "basic" | "items" | "payment" | "notes";

export type IntakeModule = {
  id: string;
  domain: IntakeDomain;
  /** draft-mapping MODULE_MAP key / document_intake_drafts.target_module */
  target: string;
  side: IntakeSide;
  group: "trade" | "shipping" | "finance" | "master" | "other";
  /** English fallback; the UI resolves `dintake.<labelKey>` in all five languages. */
  label: string;
  labelKey: string;
  /** account pickers shown for this module (in display order) */
  roles: AccountRole[];
  /** subset of roles that must be filled before the draft can be saved */
  required: AccountRole[];
  /** false = the module's own form carries NO price / currency / amount (Shipping 1C cargo). */
  financial: boolean;
  /** which counter-party the document names for OUR side of the deal */
  party: "supplier" | "customer" | null;
  /** what the existing ERP screen is called, for the "will be saved to" line */
  routeUrl: string;
  routeLabel: string;
};

const RAW_MODULES: Array<Omit<IntakeModule, "required">> = [
  // ── Trade ───────────────────────────────────────────────────────────────
  { id: "purchase_booking", domain: "business", target: "purchase_orders", side: "purchase", group: "trade", label: "Purchase Booking", labelKey: "mod_purchase_booking", roles: ["supplier", "purchase"], financial: true, party: "supplier", routeUrl: "/dashboard/purchase/new-purchase-booking-order", routeLabel: "Purchase → New Purchase Booking Order" },
  { id: "local_purchase", domain: "business", target: "local_purchases", side: "purchase", group: "trade", label: "Local Purchase", labelKey: "mod_local_purchase", roles: ["supplier", "purchase"], financial: true, party: "supplier", routeUrl: "/dashboard/purchase/local-purchase", routeLabel: "Purchase → Local Purchase" },
  { id: "purchase_loading", domain: "business", target: "purchase_loading_records", side: "purchase", group: "trade", label: "Purchase Loading / Receiving", labelKey: "mod_purchase_loading", roles: ["supplier"], financial: false, party: "supplier", routeUrl: "/dashboard/purchase-loading-records", routeLabel: "Purchase → Loading Records" },
  { id: "sales_booking", domain: "business", target: "sales_orders", side: "sales", group: "trade", label: "Sales Booking", labelKey: "mod_sales_booking", roles: ["customer", "sales"], financial: true, party: "customer", routeUrl: "/dashboard/sales/new-sales-booking-order", routeLabel: "Sales → New Sales Booking Order" },
  { id: "local_sales", domain: "business", target: "sales_orders", side: "sales", group: "trade", label: "Local Sales", labelKey: "mod_local_sales", roles: ["customer", "sales"], financial: true, party: "customer", routeUrl: "/dashboard/sales/new-sales-booking-order?source=local", routeLabel: "Sales → Local Sales" },
  // ── Shipping & Clearing ────────────────────────────────────────────────
  { id: "shipping_bl", domain: "shipping", target: "shipping_bl_records", side: "shipping", group: "shipping", label: "Shipping Line / Bill of Lading", labelKey: "mod_shipping_bl", roles: [], financial: false, party: null, routeUrl: "/dashboard/shipping-line/bl-entry", routeLabel: "Shipping Line → B/L Entry" },
  { id: "clearing_customs", domain: "shipping", target: "clearing_agent_custom_entries", side: "shipping", group: "shipping", label: "Clearing / Customs Entry", labelKey: "mod_clearing_customs", roles: [], financial: false, party: null, routeUrl: "/dashboard/clearing-agent/agent-custom-entry", routeLabel: "Clearing Agent → Custom Entry" },
  { id: "customer_order", domain: "shipping", target: "clearing_customer_orders", side: "shipping", group: "shipping", label: "Customer Order (cargo)", labelKey: "mod_customer_order", roles: [], financial: false, party: "customer", routeUrl: "/dashboard/clearing-agent/customer-order", routeLabel: "Clearing Agent → Customer Order" },
  { id: "clearing_customer_bill", domain: "shipping", target: "clearing_customer_bills", side: "shipping", group: "shipping", label: "Clearing Customer Bill", labelKey: "mod_clearing_customer_bill", roles: ["customer"], financial: true, party: "customer", routeUrl: "/dashboard/clearing-agent/customer-bill", routeLabel: "Clearing Agent → Customer Bill" },
  { id: "shipping_expense", domain: "shipping", target: "bill_expense_line", side: "expense", group: "shipping", label: "Shipping / Clearing Expense", labelKey: "mod_shipping_expense", roles: ["debit", "credit"], financial: true, party: "supplier", routeUrl: "/dashboard/clearing-agent/customs-expenses", routeLabel: "Clearing Agent → Expenses" },
  // ── Finance ─────────────────────────────────────────────────────────────
  { id: "cash_entry", domain: "business", target: "roznamcha_entries", side: "cash", group: "finance", label: "Cash / Bank Entry (Roznamcha)", labelKey: "mod_cash_entry", roles: ["debit", "credit"], financial: true, party: null, routeUrl: "/dashboard/roznamcha/cash-entry", routeLabel: "Finance → Roznamcha Cash Entry" },
  { id: "expense", domain: "business", target: "expenses", side: "expense", group: "finance", label: "Expense Bill", labelKey: "mod_expense", roles: ["debit", "credit"], financial: true, party: "supplier", routeUrl: "/dashboard/expenses", routeLabel: "Finance → Expenses" },
  // ── Masters ─────────────────────────────────────────────────────────────
  { id: "bank", domain: "business", target: "banks", side: "master", group: "master", label: "Bank", labelKey: "mod_bank", roles: ["bank"], financial: false, party: null, routeUrl: "/dashboard/accounts/setup", routeLabel: "Masters → Bank Account" },
  { id: "company", domain: "business", target: "companies", side: "master", group: "master", label: "Company", labelKey: "mod_company", roles: [], financial: false, party: null, routeUrl: "/dashboard/companies/new", routeLabel: "Masters → Companies" },
  { id: "customer_supplier", domain: "business", target: "customers", side: "master", group: "master", label: "Customer / Supplier (KYC)", labelKey: "mod_customer_supplier", roles: [], financial: false, party: null, routeUrl: "/dashboard/crm/customers/new", routeLabel: "Masters → Customers" },
  { id: "account_master", domain: "business", target: "account_master", side: "master", group: "master", label: "Account / Ledger", labelKey: "mod_account_master", roles: [], financial: false, party: null, routeUrl: "/dashboard/accounts/setup", routeLabel: "Masters → Chart of Accounts" },
  { id: "other", domain: "business", target: "other_document", side: "other", group: "other", label: "Other document", labelKey: "mod_other", roles: [], financial: false, party: null, routeUrl: "/dashboard/document-intake", routeLabel: "Document Intake" },
];

/** Roles that block saving when empty. The optional ones (purchase / sales posting accounts, bank) are matched or chosen but never forced. */
const REQUIRED_ROLES: AccountRole[] = ["supplier", "customer", "debit", "credit"];

export const INTAKE_MODULES: IntakeModule[] = RAW_MODULES.map((m) => ({ ...m, required: m.roles.filter((r) => REQUIRED_ROLES.includes(r)) }));

export const INTAKE_MODULE_GROUPS: Array<{ id: IntakeModule["group"]; label: string; labelKey: string }> = [
  { id: "trade", label: "Purchase & Sales", labelKey: "grp_trade" },
  { id: "shipping", label: "Shipping & Clearing", labelKey: "grp_shipping" },
  { id: "finance", label: "Finance", labelKey: "grp_finance" },
  { id: "master", label: "Masters", labelKey: "grp_master" },
  { id: "other", label: "Other", labelKey: "grp_other" },
];

const BY_ID = new Map(INTAKE_MODULES.map((m) => [m.id, m]));

export function getIntakeModule(id: string | null | undefined): IntakeModule | null {
  return (id && BY_ID.get(id)) || null;
}

/**
 * Resolve a module for a job that only knows `target_module` (older jobs, API callers). The first
 * catalogue entry for a target wins, which is the main (non-"local") variant.
 */
export function moduleForTarget(target: string | null | undefined): IntakeModule | null {
  if (!target) return null;
  return INTAKE_MODULES.find((m) => m.target === target) ?? null;
}

/** Module ids that save to the same underlying target but are distinct choices in the dropdown. */
export function resolveModule(moduleId: string | null | undefined, target: string | null | undefined): IntakeModule | null {
  return getIntakeModule(moduleId) ?? moduleForTarget(target);
}

export function modulesInGroup(group: IntakeModule["group"]): IntakeModule[] {
  return INTAKE_MODULES.filter((m) => m.group === group);
}

// ───────────────────────── Account selection model ─────────────────────────

/** The account IDs a review form holds. Always real enterprise_accounts ids (uuid) or "". */
export type AccountSelection = {
  supplierAccountId: string;
  purchaseAccountId: string;
  customerAccountId: string;
  salesAccountId: string;
  debitAccountId: string;
  creditAccountId: string;
  bankAccountId: string;
};

export const EMPTY_ACCOUNT_SELECTION: AccountSelection = {
  supplierAccountId: "",
  purchaseAccountId: "",
  customerAccountId: "",
  salesAccountId: "",
  debitAccountId: "",
  creditAccountId: "",
  bankAccountId: "",
};

const ROLE_TO_KEY: Record<AccountRole, keyof AccountSelection> = {
  supplier: "supplierAccountId",
  purchase: "purchaseAccountId",
  customer: "customerAccountId",
  sales: "salesAccountId",
  debit: "debitAccountId",
  credit: "creditAccountId",
  bank: "bankAccountId",
};

export function accountKeyForRole(role: AccountRole): keyof AccountSelection {
  return ROLE_TO_KEY[role];
}

/**
 * Changing the module must clear every mapping the new module does not use (a supplier account left
 * over from Purchase must not travel into a Sale) and keep those it still uses.
 */
export function pruneAccountsForModule(sel: Partial<AccountSelection>, mod: IntakeModule | null): AccountSelection {
  const out: AccountSelection = { ...EMPTY_ACCOUNT_SELECTION };
  if (!mod) return out;
  for (const role of mod.roles) {
    const k = ROLE_TO_KEY[role];
    out[k] = (sel[k] as string) || "";
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export type AccountLike = { id: string; kind?: string | null; /** every customer / company / supplier id this account is linked to (customer_id, company_id, account_customer_owners, account_companies) */ linkedPartyIds?: string[] };

/** kind (enterprise_accounts.kind) each role normally lives in. */
const ROLE_KINDS: Record<AccountRole, string[]> = {
  supplier: ["liability"],
  purchase: ["expense", "asset"],
  customer: ["asset"],
  sales: ["income"],
  debit: ["asset", "expense", "liability", "equity", "income"],
  credit: ["asset", "expense", "liability", "equity", "income"],
  bank: ["asset"],
};

/**
 * Does an account fit a role? Linked to the matched party → always yes. Otherwise by accounting kind;
 * accounts with no kind are never excluded (an unknown kind must not hide a valid account).
 */
export function accountFitsRole(role: AccountRole, acct: AccountLike, partyId: string | null): boolean {
  if (partyId && acct.linkedPartyIds?.includes(partyId)) return true;
  if (!acct.kind) return true;
  return ROLE_KINDS[role].includes(String(acct.kind).toLowerCase());
}

/** Required account roles still empty — the review form blocks "Save" on these, with a clear message. */
export function missingAccountRoles(mod: IntakeModule | null, sel: Partial<AccountSelection>): AccountRole[] {
  if (!mod) return [];
  return mod.required.filter((r) => !isUuid(sel[ROLE_TO_KEY[r]]));
}
