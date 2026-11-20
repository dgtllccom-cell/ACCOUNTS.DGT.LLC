/**
 * The two accounts a trade bill posts to, read from the saved record and shown separately on its View:
 *   Purchase Booking / Local Purchase:  Purchase account (Dr)  and  Sales / Supplier account (Cr — the supplier party)
 *   Sales Booking:                      Customer account (Dr)  and  Sales account (Cr)
 * Codes and names only (business data); a missing name is looked up from the account master by the caller.
 */
export type BillAccount = { code: string; name: string };
export type BillAccounts = { debit: BillAccount; credit: BillAccount };
export type BillSource = "purchase_order" | "sales_order" | "local_purchase";

type AnyRec = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const first = (...vals: unknown[]) => vals.map(s).find(Boolean) || "";

function formOf(record: AnyRec): AnyRec {
  let fd: unknown = record.form_data;
  if (typeof fd === "string") {
    try { fd = JSON.parse(fd); } catch { fd = {}; }
  }
  const obj = (fd && typeof fd === "object" ? fd : {}) as AnyRec;
  return ((obj.form && typeof obj.form === "object" ? obj.form : obj) as AnyRec) || {};
}

export function billAccounts(source: BillSource, record: AnyRec | null | undefined): BillAccounts {
  const r = record || {};
  const f = formOf(r);
  if (source === "sales_order") {
    return {
      debit: { code: first(f.customerAccountNo, f.customerAccountCode, r.customer_account_no), name: first(f.customerAccountName, f.customerName, r.customer_name) },
      credit: { code: first(f.salesAccountNo, f.salesAccountCode, r.sales_account_no), name: first(f.salesAccountName, r.sales_account_name) },
    };
  }
  if (source === "local_purchase") {
    return {
      debit: {
        code: first(r.purchase_account_no, r.purchaseAccountNo, r.resolved_dr_account_code, r.dr_account_no, f.purchaseAccountNo),
        name: first(r.purchase_account_name, r.purchaseAccountName, r.resolved_dr_account_name, r.dr_account_name, f.purchaseAccountName),
      },
      credit: {
        code: first(r.sales_account_no, r.salesAccountNo, r.resolved_cr_account_code, r.cr_account_no, f.salesAccountNo),
        name: first(r.sales_account_name, r.salesAccountName, r.resolved_cr_account_name, r.cr_account_name, f.salesAccountName, r.supplier_name),
      },
    };
  }
  return {
    debit: { code: first(f.purchaseAccountNo, f.purchaseAccountCode, r.purchase_account_no), name: first(f.purchaseAccountName, r.purchase_account_name) },
    credit: { code: first(f.salesAccountNo, f.salesAccountCode, r.sales_account_no), name: first(f.salesAccountName, r.sales_account_name) },
  };
}

/**
 * The supplier a purchase invoice prints. Booking forms often carry our own purchase office in `supplierName`
 * (it is the Dr account's company); the real supplier is the Cr party. Our own purchase account is never the seller.
 */
export function purchaseSupplierName(accounts: BillAccounts, savedSupplier: unknown): string {
  const saved = s(savedSupplier);
  const own = accounts.debit.name.toLowerCase();
  if (saved && saved.toLowerCase() !== own) return saved;
  return accounts.credit.name || (saved && saved.toLowerCase() !== own ? saved : "");
}
