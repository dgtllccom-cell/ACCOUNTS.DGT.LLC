/**
 * Flat views of the loaded bills (pure functions). The API, the Excel export and the PDF reports all read THESE rows, so a figure on
 * screen, in the sheet and on paper can never differ.
 */
import type { BalanceBill, BalancePayment, BalanceSale, BalanceTreatment } from "@/lib/services/stock-balance-report-service";
import type { BalanceEntry, BillTotals } from "@/lib/stock-balance/model";

export type BillSummary = Omit<BalanceBill, "entries" | "sales" | "payments" | "treatments"> & { entryCount: number; salesCount: number };

/** the bill list: header + totals, without the heavy arrays */
export function billSummaries(bills: BalanceBill[]): BillSummary[] {
  return bills.map(({ entries, sales, payments, treatments, ...rest }) => ({ ...rest, entryCount: entries.length, salesCount: sales.length }));
}

export type StockRow = BalanceEntry & { billType: BalanceBill["type"]; billId: string; billNo: string; billDate: string | null; countryName: string; branchName: string; companyName: string; purchaseAccountName: string };
export function stockRows(bills: BalanceBill[]): StockRow[] {
  return bills.flatMap((b) => b.entries.map((e) => ({ ...e, billType: b.type, billId: b.id, billNo: b.billNo, billDate: b.date, countryName: b.countryName, branchName: b.branchName, companyName: b.companyName, purchaseAccountName: b.purchaseAccountName })));
}

/** every sale tied to a bill (+ the unlinked ones, flagged) — cancelled / reserved ones are listed but never counted */
/** Sales Details rows. A Sales Bill No / Goods filter narrows the SALE rows themselves (not just which bills qualify); unlinked sales have no lot,
 *  bill, warehouse or stock status, so any of those filters hides them. */
export function saleRows(bills: BalanceBill[], unlinked: BalanceSale[] = [], f: { salesBillNo?: string; goodsName?: string; billNo?: string; lotNo?: string; warehouseId?: string; status?: string } = {}): BalanceSale[] {
  const has = (hay: string | null | undefined, needle?: string) => !needle || String(hay ?? "").toLowerCase().includes(needle.toLowerCase().trim());
  const keep = (s: BalanceSale) => has(s.salesBillNo, f.salesBillNo) && has(s.goodsName, f.goodsName);
  const unlinkedOk = !f.billNo && !f.lotNo && !f.warehouseId && !f.status;
  return [...bills.flatMap((b) => b.sales).filter(keep), ...(unlinkedOk ? unlinked.filter(keep) : [])].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export type PaymentRow = BalancePayment & { billType: BalanceBill["type"]; billId: string; billNo: string; supplierAccount: string; purchaseAmount: number | null; billCurrency: string; billExchangeRate: number | null; paidTotal: number | null; remainingPayable: number | null; billPaymentStatus: string };
export function paymentRows(bills: BalanceBill[]): PaymentRow[] {
  const rows: PaymentRow[] = [];
  for (const b of bills) {
    const base = { billType: b.type, billId: b.id, billNo: b.billNo, supplierAccount: b.purchaseAccountName, purchaseAmount: b.amount, billCurrency: b.currency, billExchangeRate: b.exchangeRate, paidTotal: b.paid, remainingPayable: b.pending, billPaymentStatus: b.paymentStatus };
    if (b.payments.length === 0) rows.push({ id: `bill:${b.id}`, date: null, kind: "", method: "", amount: 0, currency: b.currency, exchangeRate: b.exchangeRate, status: "none", referenceNo: null, ...base });
    for (const p of b.payments) rows.push({ ...p, ...base });
  }
  return rows;
}

export function treatmentRows(bills: BalanceBill[]): BalanceTreatment[] {
  return bills.flatMap((b) => b.treatments).sort((a, b) => String(b.treatmentDate || "").localeCompare(String(a.treatmentDate || "")));
}

export const kg = (n: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)}`;
export const qtyText = (n: number, unit?: string) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)}${unit ? " " + unit : ""}`;
export function totalsLine(t: BillTotals) {
  return { purchased: t.purchased, sold: t.sold, remaining: t.remaining, lots: t.lots, entries: t.entries };
}
