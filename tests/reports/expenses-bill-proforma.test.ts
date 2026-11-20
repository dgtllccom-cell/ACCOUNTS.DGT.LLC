import { describe, expect, it } from "vitest";
import {
  expensesBillToTradeInput,
  expenseBillTotals,
  type ExpenseBillLike,
} from "@/lib/reports/expenses-bill/to-trade-document";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import { amountInWords, expensesBillTitle, renderExpensesProformaHtml } from "@/lib/reports/expenses-bill/render-proforma-html";

const branding = (over: Partial<DocumentBranding> = {}): DocumentBranding => ({
  entityName: "Damaan General Trading L.L.C",
  legalName: "Damaan General Trading L.L.C",
  logoUrl: null,
  stampUrl: null,
  address: "Office No. 101, Al Fahidi Building, Deira, Dubai",
  phone: "+971 4 123 4567",
  email: "info@dgt.ae",
  website: "www.dgt.ae",
  registrationNumber: null,
  taxNumber: "100534678900003",
  countryName: "United Arab Emirates",
  branchName: "Dubai",
  baseCurrency: "AED",
  bank: {
    bankName: "Emirates NBD",
    branchName: "Deira City Centre Branch",
    accountTitle: "Damaan General Trading L.L.C",
    accountNumber: "1004 5678 9001",
    iban: "AE07 0260 0010 0456 7890 01",
    swift: "EBILAEAD",
    currency: "AED",
    address: null,
  },
  raw: null,
  ...over,
});

// The five lines of the owner's sample proforma (PI-000784).
const sampleBill: ExpenseBillLike = {
  serial_no: "PI-000784",
  bill_title: "Other Expenses Bill",
  reference_no: "PO-24-554",
  bill_date: "2026-10-15",
  debit_ledger_name: "RubiconInfo Trading L.L.C",
  base_currency: "AED",
  city_branches: { name: "Dubai", countries: { currency_code: "AED" } },
  expenses_bill_lines: [
    { qty: 1, details: "Customs Clearing Service", unit_price: 350, tax_pct: 5, tax_amt: 17.5, amount: 350, grand_amount: 367.5 },
    { qty: 1, details: "Import Duty (5% of CIF Value)", unit_price: 2500, tax_pct: 0, tax_amt: 0, amount: 2500, grand_amount: 2500 },
    { qty: 1, details: "Terminal Handling Charges (THC)", unit_price: 450, tax_pct: 5, tax_amt: 22.5, amount: 450, grand_amount: 472.5 },
    { qty: 1, details: "Documentation & Processing", unit_price: 150, tax_pct: 5, tax_amt: 7.5, amount: 150, grand_amount: 157.5 },
    { qty: 1, details: "Delivery to Warehouse (Dubai)", unit_price: 300, tax_pct: 5, tax_amt: 15, amount: 300, grand_amount: 315 },
  ],
};

describe("expense bill proforma: totals", () => {
  it("sums taxable value, VAT and grand total exactly as the sample shows (AED 3,750.00 + 62.50 = 3,812.50)", () => {
    const t = expenseBillTotals(sampleBill.expenses_bill_lines ?? []);
    expect(t.taxable).toBeCloseTo(3750, 2);
    expect(t.vat).toBeCloseTo(62.5, 2);
    expect(t.grand).toBeCloseTo(3812.5, 2);
    expect(t.quantity).toBe(5);
  });
});

describe("expense bill proforma: mapping", () => {
  it("uses the branch company as the seller, so every branch prints its own name at the top", () => {
    const input = expensesBillToTradeInput(sampleBill, { lang: "en", branding: branding() });
    expect(input.seller.name).toBe("Damaan General Trading L.L.C");
    const other = expensesBillToTradeInput(sampleBill, {
      lang: "en",
      branding: branding({ legalName: "Chaman Shipping LLC", entityName: "Chaman Shipping LLC" }),
    });
    expect(other.seller.name).toBe("Chaman Shipping LLC");
  });

  it("prints the proforma document type and the bill's serial, date and reference", () => {
    const input = expensesBillToTradeInput(sampleBill, { lang: "en", branding: branding() });
    expect(input.docType).toBe("proforma_invoice");
    expect(input.docNo).toBe("PI-000784");
    expect(input.docDate).toBe("2026-10-15");
    expect(input.referenceNos?.po).toBe("PO-24-554");
  });

  it("never invents an HS code: expense lines print a dash", () => {
    const input = expensesBillToTradeInput(sampleBill, { lang: "en", branding: branding() });
    expect(input.goods.every((g) => g.hsCode === null)).toBe(true);
  });

  it("makes the bill out to the recorded party, falling back to the debit ledger name", () => {
    const input = expensesBillToTradeInput(sampleBill, { lang: "en", branding: branding() });
    expect(input.buyer.name).toBe("RubiconInfo Trading L.L.C");
    const withParty = expensesBillToTradeInput({ ...sampleBill, party_name: "Acme Trading" }, { lang: "en", branding: branding() });
    expect(withParty.buyer.name).toBe("Acme Trading");
  });

  it("takes the bank block from the branch branding, and leaves it empty when the branch has no bank", () => {
    const input = expensesBillToTradeInput(sampleBill, { lang: "en", branding: branding() });
    expect(input.bank?.bankName).toBe("Emirates NBD");
    expect(input.bank?.iban).toBe("AE07 0260 0010 0456 7890 01");
    const noBank = expensesBillToTradeInput(sampleBill, { lang: "en", branding: branding({ bank: null }) });
    expect(noBank.bank).toBeNull();
  });

  it("uses the bill's currency, then the base currency, and never fabricates one", () => {
    const usd = expensesBillToTradeInput(
      { ...sampleBill, city_branches: { countries: { currency_code: "USD" } } },
      { lang: "en", branding: branding() },
    );
    expect(usd.currency).toBe("USD");
  });
});

describe("expense bill proforma: rendered page (sample layout)", () => {
  it("renders the branch company at the top, the proforma title, the serial and the grand total", () => {
    const input = expensesBillToTradeInput(sampleBill, { lang: "en", branding: branding() });
    const html = renderExpensesProformaHtml(input);
    expect(html).toContain("Damaan General Trading L.L.C");
    expect(html).toContain("Expenses Bill");
    expect(html).not.toContain("Proforma Invoice");
    expect(html).toContain("PI-000784");
    expect(html).toMatch(/3,812\.50/);
  });

  it("shows the VAT rate on the VAT-able lines (5%), not diluted by the 0% import duty line", () => {
    const input = expensesBillToTradeInput(sampleBill, { lang: "en", branding: branding() });
    const html = renderExpensesProformaHtml(input);
    expect(html).toContain("Add: VAT (5%)");
  });

  it("titles the document with the bill's own name, else plain Expenses Bill", () => {
    expect(expensesBillTitle("Office Expenses Bill")).toBe("Office Expenses Bill");
    expect(expensesBillTitle("Other Expenses Bill")).toBe("Other Expenses Bill");
    expect(expensesBillTitle("")).toBe("");
    expect(expensesBillTitle(null)).toBe("");
  });

  it("writes the amount in words the way the sample does", () => {
    expect(amountInWords(3812.5, "AED")).toBe("Three Thousand Eight Hundred Twelve Dirhams and Fifty Fils Only");
  });

  it("prints the branch's own company name, not another branch's", () => {
    const input = expensesBillToTradeInput(sampleBill, {
      lang: "en",
      branding: branding({ legalName: "Chaman Shipping LLC", entityName: "Chaman Shipping LLC" }),
    });
    const html = renderExpensesProformaHtml(input);
    expect(html).toContain("Chaman Shipping LLC");
    expect(html).not.toContain("Damaan General Trading L.L.C</div>");
  });
});
