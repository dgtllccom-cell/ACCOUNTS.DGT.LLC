import { openScopedGenericReport } from "./open-scoped-report";
import type { GenericReportColumn } from "./open-generic-erp-report";

/**
 * One print builder for the Purchase Payments and Sales Payments journals.
 * Rows are the journal's own order rows (purchase_orders / sales_orders shape); every
 * figure is read from the row, nothing is invented. Amounts are never summed across
 * currencies — totals are produced per currency.
 */
export type PaymentJournalKind = "purchase" | "sales";

type AnyRow = Record<string, any>;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function paymentJournalRow(row: AnyRow, kind: PaymentJournalKind): Record<string, unknown> {
  const form = row.form_data?.form ?? row.form_data ?? {};
  const isSales = kind === "sales";
  const total = num(row.order_total);
  const paid = isSales
    ? num(row.paid_amount ?? row.advance_paid) || num(row.advance_paid) + num(row.remaining_paid)
    : num(row.advance_paid) + num(row.remaining_paid);
  const remaining = isSales ? num(row.remaining_amount ?? row.remaining_due) : num(row.remaining_due);
  const party = isSales
    ? form.customerName || form.buyerName || form.salesAccountName || form.partyName || row.sales_account_name
    : form.supplierName || form.purchaseAccountName || form.partyName || row.purchase_account_name;
  return {
    reference: isSales ? row.sales_order_no : row.purchase_order_no,
    contract: (isSales ? row.sales_contract_no : row.purchase_contract_no) || "",
    date: row.created_at,
    country: row.countryName || "",
    branch: row.branchName || row.audit?.branchCode || "",
    party: party || "",
    currency: row.currency_code || row.payment_currency || row.currency || "",
    total,
    paid,
    remaining,
    credit: num(row.credit_amount),
    paymentStatus: row.payment_status || "Pending",
    journalStatus: row.ledger_posting_status || "Pending",
    user: row.createdByName || row.audit?.userName || "",
  };
}

export async function printPaymentJournal(input: {
  kind: PaymentJournalKind;
  rows: AnyRow[];
  lang: string;
  /** localized report title, e.g. "Purchase Payments Journal" */
  title: string;
  /** mode label already localized (Advance / Remaining / ...) */
  modeLabel?: string;
  filters?: Array<{ label: string; value: string }>;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  countryName?: string | null;
  branchName?: string | null;
  printedBy?: string | null;
  reportPeriod?: string | null;
}): Promise<void> {
  const mapped = input.rows.map((r) => paymentJournalRow(r, input.kind));

  const byCurrency = new Map<string, { total: number; paid: number; remaining: number }>();
  for (const r of mapped) {
    const cur = String(r.currency || "—");
    const acc = byCurrency.get(cur) ?? { total: 0, paid: 0, remaining: 0 };
    acc.total += Number(r.total);
    acc.paid += Number(r.paid);
    acc.remaining += Number(r.remaining);
    byCurrency.set(cur, acc);
  }
  const summary: Record<string, unknown> = { entries: mapped.length };
  const single = byCurrency.size === 1 ? Array.from(byCurrency.entries())[0] : null;
  if (single) {
    summary.totalAmount = single[1].total;
    summary.paidAmount = single[1].paid;
    summary.remainingBalance = single[1].remaining;
  }

  const columns: GenericReportColumn[] = [
    { key: "reference", label: input.kind === "sales" ? "Sales Booking No" : "Purchase Booking No", align: "center" },
    { key: "contract", label: "Contract No", align: "center" },
    { key: "date", label: "Date", format: "date", align: "center" },
    { key: "country", label: "Country" },
    { key: "branch", label: "Branch" },
    { key: "party", label: input.kind === "sales" ? "Customer" : "Supplier" },
    { key: "currency", label: "Currency", align: "center" },
    { key: "total", label: "Order Total", format: "number", align: "right" },
    { key: "paid", label: "Paid", format: "number", align: "right" },
    { key: "remaining", label: "Remaining", format: "number", align: "right" },
    { key: "credit", label: "Credit", format: "number", align: "right" },
    { key: "paymentStatus", label: "Payment Status", format: "status", align: "center" },
    { key: "journalStatus", label: "Journal Status", format: "status", align: "center" },
    { key: "user", label: "User" },
  ];

  const filters = [...(input.filters ?? [])];
  if (input.modeLabel) filters.unshift({ label: "Mode", value: input.modeLabel });
  if (byCurrency.size > 1) {
    filters.push({
      label: "Totals by currency",
      value: Array.from(byCurrency.entries())
        .map(([cur, v]) => `${cur}: ${v.total.toLocaleString("en-US", { maximumFractionDigits: 2 })}`)
        .join(" | "),
    });
  }

  await openScopedGenericReport({
    title: input.title,
    lang: input.lang,
    orientation: "landscape",
    columns,
    rows: mapped,
    summary,
    totalsRow: single ? { total: single[1].total, paid: single[1].paid, remaining: single[1].remaining } : undefined,
    filters,
    countryId: input.countryId,
    countryBranchId: input.countryBranchId,
    cityBranchId: input.cityBranchId,
    countryName: input.countryName,
    branchName: input.branchName,
    printedBy: input.printedBy,
    reportPeriod: input.reportPeriod,
  });
}
