import { describe, expect, it } from "vitest";
import { buildLedgerStatementPrintHtml, type LedgerPrintData } from "@/lib/reports/ledger-statement-print";

const data = (normal: "debit" | "credit"): LedgerPrintData => ({
  company: { name: "Test Co", logoUrl: "https://example.com/logo.png", taxNo: "1002997554321003" },
  account: {
    name: "Acme <Ltd>",
    code: "ACC-1001",
    customerNumber: "CUST-500",
    kind: "Customer Account",
    category: "Trade Receivable",
    currency: "AED",
    openedDate: "2025-01-15",
    branchName: "Deira Main Branch",
    branchCode: "BR-01",
    countryCode: "ARE",
    country: "United Arab Emirates",
    stateProvince: "Dubai",
    city: "Deira",
    finalAddress: "Office 402, Al Ras Building, Deira, Dubai",
    phone: "+97142233445",
    whatsapp: "+971501234567",
    email: "billing@acme.ae",
  },
  normalBalance: normal,
  fromDate: "2026-01-01",
  toDate: "2026-01-31",
  openingBalance: 100,
  totalDebit: 50,
  totalCredit: 200,
  closingBalance: -50,
  lines: [
    {
      date: "2026-01-05",
      entryNo: "ENT-001",
      rznNo: "RZ-101",
      rznName: "Cash Entry",
      serial: "V-1",
      manualRef: "M-1",
      source: "roznamcha_entries",
      branch: "Deira",
      branchCode: "DEI",
      user: "Asmat",
      userCode: "ASMT",
      description: "Payment for goods",
      currency: "AED",
      debit: 50,
      credit: 0,
      balance: 150,
    },
    {
      date: "2026-01-06",
      entryNo: "ENT-002",
      rznNo: "RZ-102",
      rznName: "Purchase Booking",
      serial: "V-2",
      manualRef: null,
      source: "ledger_posting_batches",
      branch: null,
      branchCode: null,
      user: null,
      userCode: null,
      description: "Import freight charges",
      currency: "USD",
      usdRate: 3.67,
      debit: 0,
      credit: 200,
      balance: -50,
    },
  ],
});

const cols = (html: string) => (html.match(/<tr class="cols">([\s\S]*?)<\/tr>/)?.[1].match(/<th/g) ?? []).length;

describe("ledger statement print layouts", () => {
  it("portrait and landscape are different layouts (8 vs 10 columns)", () => {
    expect(cols(buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" }))).toBe(8);
    expect(cols(buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" }))).toBe(10);
  });

  it("portrait customer print omits user and branch columns, while landscape includes them", () => {
    const portraitHtml = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" });
    const landscapeHtml = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" });

    // Portrait table header must NOT contain User or Branch
    const portraitColsHeader = portraitHtml.match(/<tr class="cols">([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(portraitColsHeader).not.toContain(">User<");
    expect(portraitColsHeader).not.toContain(">Branch<");

    // Landscape table header must contain User and Branch
    const landscapeColsHeader = landscapeHtml.match(/<tr class="cols">([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(landscapeColsHeader).toContain(">User<");
    expect(landscapeColsHeader).toContain(">Branch<");
  });

  it("renders 17 bank-statement account details fields in sequence on page 1 with Account Number before Account Name", () => {
    const html = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" });
    expect(html).toContain("ACC-1001");
    expect(html).toContain("CUST-500");
    expect(html).toContain("Acme &lt;Ltd&gt;");
    expect(html).toContain("Customer Account");
    expect(html).toContain("Trade Receivable");
    expect(html).toContain("AED");
    expect(html).toContain("2025-01-15");
    expect(html).toContain("Deira Main Branch");
    expect(html).toContain("BR-01");
    expect(html).toContain("ARE");
    expect(html).toContain("United Arab Emirates");
    expect(html).toContain("Dubai");
    expect(html).toContain("Deira");
    expect(html).toContain("Office 402, Al Ras Building, Deira, Dubai");
    expect(html).toContain("+97142233445");
    expect(html).toContain("+971501234567");
    expect(html).toContain("billing@acme.ae");

    // Verify Account Number appears before Account Name in the Account Details section
    const gridHtml = html.match(/<div class="acct-grid">([\s\S]*?)<\/div>\s*<div class="fin-summary">/)?.[1] ?? "";
    const accNumIndex = gridHtml.indexOf("ACC-1001");
    const accNameIndex = gridHtml.indexOf("Acme &lt;Ltd&gt;");
    expect(accNumIndex).toBeGreaterThan(-1);
    expect(accNameIndex).toBeGreaterThan(-1);
    expect(accNumIndex).toBeLessThan(accNameIndex);
  });

  it("renders integrated financial summary and does not repeat totals underneath the table", () => {
    const html = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" });

    // Integrated financial summary presence
    expect(html).toContain("Total Debit");
    expect(html).toContain("Total Credit");
    expect(html).toContain("Grand Balance");
    expect(html).toContain("Starting Date");
    expect(html).toContain("Last Date");
    expect(html).toContain("Total Entries");

    // Must NOT have repeated totals underneath the table
    expect(html).not.toContain("Totals for the period");
    expect(html).not.toContain("Closing balance carried forward");
  });

  it("sets the A4 page size per layout and repeats the header", () => {
    const p = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" });
    expect(p).toMatch(/size: A4 portrait/);
    expect(p).toMatch(/thead \{ display: table-header-group; \}/);
    expect(buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" })).toMatch(/size: A4 landscape/);
  });

  it("RTL languages render right-to-left with translated labels", () => {
    for (const lang of ["ur", "ar", "fa", "ps"]) {
      const h = buildLedgerStatementPrintHtml(data("debit"), { lang, orientation: "portrait" });
      expect(h).toMatch(/<html lang="\w+" dir="rtl">/);
      expect(h).not.toMatch(/Account Ledger Statement<\/h1>/);
    }
  });

  it("Dr/Cr side follows the account's normal balance", () => {
    const debitNormal = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" });
    const creditNormal = buildLedgerStatementPrintHtml(data("credit"), { lang: "en", orientation: "portrait" });
    // closing -50: debit-normal account is overdrawn to the credit side; credit-normal account to the debit side
    expect(debitNormal).toMatch(/50\.00<\/bdi>\s*<span class="dc">Cr<\/span>/);
    expect(creditNormal).toMatch(/50\.00<\/bdi>\s*<span class="dc">Dr<\/span>/);
  });

  it("escapes data and marks foreign-currency rows", () => {
    const h = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" });
    expect(h).toContain("Acme &lt;Ltd&gt;");
    expect(h).toContain("USD @ <bdi dir=\"ltr\">3.67</bdi>");
  });
});
