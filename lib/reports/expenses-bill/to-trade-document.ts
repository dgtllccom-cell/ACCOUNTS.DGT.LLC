/**
 * Maps an Office / Other Expenses Bill (expenses_bills + expenses_bill_lines) onto the shared invoice engine input, so
 * the bill prints and views in the same proforma layout as the owner's sample. Pure: no fetch, no storage.
 *
 * Nothing is invented. A value the bill does not carry stays null and prints as a dash. The seller block and the bank
 * block come from the bill's own branch branding, so every branch prints its own company name at the top.
 */
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import type { TradeDocumentInput, TradeLineItem } from "@/lib/reports/trade-documents/types";

export type ExpenseBillLine = {
  qty?: number | string | null;
  details?: string | null;
  unit_price?: number | string | null;
  tax_pct?: number | string | null;
  tax_amt?: number | string | null;
  amount?: number | string | null;
  grand_amount?: number | string | null;
};

export type ExpenseBillLike = {
  serial_no?: string | number | null;
  bill_title?: string | null;
  reference_no?: string | null;
  bill_date?: string | null;
  /** the party the bill is made out to (M/S). Falls back to the debit ledger name when no party is recorded. */
  party_name?: string | null;
  debit_ledger_name?: string | null;
  base_currency?: string | null;
  city_branches?: { name?: string | null; countries?: { currency_code?: string | null } | null } | null;
  expenses_bill_lines?: ExpenseBillLine[] | null;
};

const num = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const str = (v: unknown): string | null => (v == null || String(v).trim() === "" ? null : String(v));

/** Totals are summed from the saved lines; the engine prints them as-is. */
export function expenseBillTotals(lines: ExpenseBillLine[]): {
  quantity: number;
  taxable: number;
  vat: number;
  grand: number;
} {
  return lines.reduce(
    (acc, l) => ({
      quantity: acc.quantity + num(l.qty),
      taxable: acc.taxable + num(l.amount),
      vat: acc.vat + num(l.tax_amt),
      grand: acc.grand + num(l.grand_amount),
    }),
    { quantity: 0, taxable: 0, vat: 0, grand: 0 },
  );
}

export function expensesBillToTradeInput(
  bill: ExpenseBillLike,
  opts: { lang: SupportedLanguage; branding: DocumentBranding },
): TradeDocumentInput {
  const { branding } = opts;
  const lines = bill.expenses_bill_lines ?? [];
  const totals = expenseBillTotals(lines);

  const goods: TradeLineItem[] = lines.map((l) => ({
    description: str(l.details),
    // expense lines carry no HS code; the engine prints a dash rather than a made-up code
    hsCode: null,
    quantity: num(l.qty),
    unit: null,
    unitPrice: num(l.unit_price),
    amount: num(l.amount),
    taxAmount: num(l.tax_amt),
  }));

  const currency =
    str(bill.city_branches?.countries?.currency_code) ?? str(bill.base_currency) ?? str(branding.baseCurrency) ?? "AED";

  return {
    docType: "proforma_invoice",
    txnKind: "sales",
    tradeScope: "local",
    lang: opts.lang,
    branding,
    docNo: str(bill.serial_no) ?? "—",
    docDate: str(bill.bill_date),
    referenceNos: { po: str(bill.reference_no) },
    // seller = the branch's own company (branding), so each branch prints its own name at the top
    seller: {
      name: str(branding.legalName) ?? str(branding.entityName),
      address: str(branding.address),
      phone: str(branding.phone),
      email: str(branding.email),
      taxId: str(branding.taxNumber),
      country: str(branding.countryName),
    },
    buyer: {
      name: str(bill.party_name) ?? str(bill.debit_ledger_name),
    },
    goods,
    currency,
    totals: {
      totalQuantity: totals.quantity,
      subTotal: totals.taxable,
      taxAmount: totals.vat,
      grandTotal: totals.grand,
    },
    bank: branding.bank
      ? {
          bankName: branding.bank.bankName ?? null,
          branchName: branding.bank.branchName ?? null,
          accountTitle: branding.bank.accountTitle ?? null,
          accountNumber: branding.bank.accountNumber ?? null,
          iban: branding.bank.iban ?? null,
          swift: branding.bank.swift ?? null,
          currency: branding.bank.currency ?? null,
          address: branding.bank.address ?? null,
        }
      : null,
  };
}
