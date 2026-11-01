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
    address: "Deira, Dubai",
    phone: "+97142233445",
    whatsapp: "+971501234567",
    email: "billing@acme.ae",
  },
  normalBalance: normal,
  fromDate: "2026-01-01",
  toDate: "2026-01-31",
  openingBalance: 0,
  totalDebit: 1050,
  totalCredit: 840,
  closingBalance: 210,
  lines: [
    {
      date: "2026-01-05",
      entryNo: "ENT-001",
      rznNo: "RZ-101",
      rznName: "Sales",
      serial: "V-1",
      manualRef: "M-1",
      source: "roznamcha_entries",
      branch: "Deira",
      branchCode: "DEI",
      user: "Asmat",
      userCode: "ASMT",
      description: "Customer invoice INV-001",
      currency: "AED",
      usdRate: 3.67,
      debit: 1050,
      credit: 0,
      balance: 1050,
    },
    {
      date: "2026-01-06",
      entryNo: "ENT-002",
      rznNo: "RZ-102",
      rznName: "Receipt",
      serial: "V-2",
      manualRef: null,
      source: "ledger_posting_batches",
      branch: null,
      branchCode: null,
      user: null,
      userCode: null,
      description: "Payment received from customer",
      currency: "USD",
      usdRate: 3.67,
      debit: 0,
      credit: 840,
      balance: 210,
    },
  ],
});

const cols = (html: string) => (html.match(/<tr class="cols">([\s\S]*?)<\/tr>/)?.[1].match(/<th/g) ?? []).length;

describe("ledger statement print layouts", () => {
  it("renders 12 columns in both Landscape (Reference Image 1) and Portrait (Reference Image 2)", () => {
    const landscapeHtml = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" });
    const portraitHtml = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" });

    expect(cols(landscapeHtml)).toBe(12);
    expect(cols(portraitHtml)).toBe(12);

    const landscapeHeader = landscapeHtml.match(/<tr class="cols">([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(landscapeHeader).toContain(">Date<");
    expect(landscapeHeader).toContain(">Entry No.<");
    expect(landscapeHeader).toContain(">Rzn. No.<");
    expect(landscapeHeader).toContain(">Rzn. Name<");
    expect(landscapeHeader).toContain(">Details<");
    expect(landscapeHeader).toContain(">DR<");
    expect(landscapeHeader).toContain(">CR<");
    expect(landscapeHeader).toContain(">Balance<");
    expect(landscapeHeader).toContain(">Ex. Rate<");
    expect(landscapeHeader).toContain(">DR USD<");
    expect(landscapeHeader).toContain(">CR USD<");
    expect(landscapeHeader).toContain(">Balance USD<");

    const portraitHeader = portraitHtml.match(/<tr class="cols">([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(portraitHeader).toContain(">Ex.Rate<");
    expect(portraitHeader).toContain(">Bal. USD<");
  });

  it("renders Reference Image 1 Landscape top header and three small panels (ACCOUNT DETAILS, STATEMENT SUMMARY, REPORTING BASIS)", () => {
    const html = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" });

    // Top Header
    expect(html).toContain("CUSTOMER GENERAL LEDGER");
    expect(html).toContain("ADMIN REPORT");
    expect(html).toContain("BANK-STYLE ACCOUNT STATEMENT");

    // Three Panel Headers
    expect(html).toContain("ACCOUNT DETAILS");
    expect(html).toContain("STATEMENT SUMMARY");
    expect(html).toContain("REPORTING BASIS");

    // Panel 1: 16 Account Details fields
    expect(html).toContain("ACC-1001");
    expect(html).toContain("Acme &lt;Ltd&gt;");
    expect(html).toContain("CUST-500");
    expect(html).toContain("Customer Account");
    expect(html).toContain("Deira Main Branch");
    expect(html).toContain("BR-01");
    expect(html).toContain("United Arab Emirates");
    expect(html).toContain("ARE");
    expect(html).toContain("Trade Receivable");
    expect(html).toContain("AED");
    expect(html).toContain("15 Jan 2025");
    expect(html).toContain("Dubai / Deira");
    expect(html).toContain("Office 402, Al Ras Building, Deira, Dubai");
    expect(html).toContain("+97142233445");
    expect(html).toContain("+971501234567");
    expect(html).toContain("billing@acme.ae");

    // Panel 2: Statement Summary
    expect(html).toContain("Total Debit");
    expect(html).toContain("Total Credit");
    expect(html).toContain("Grand Balance");
    expect(html).toContain("Starting Date");
    expect(html).toContain("Last Date");
    expect(html).toContain("Total Entries");

    // Panel 3: Reporting Basis
    expect(html).toContain("Each customer uses its own local currency.");
    expect(html).toContain("Local Currency");
    expect(html).toContain("USD Equivalent");

    // No SAMPLE DATA watermarks
    expect(html).not.toContain("SAMPLE DATA");
    expect(html).not.toContain("PRINT LAYOUT SAMPLE");
    expect(html).not.toContain("DESIGN SAMPLE");
  });

  it("renders Reference Image 2 Portrait layout with prominent Account Name, 2-column details, and STATEMENT SUMMARY | LOCAL strip", () => {
    const html = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" });

    expect(html).toContain("ACCOUNT DETAILS");
    expect(html).toContain("ACC-1001");
    expect(html).toContain("Acme &lt;Ltd&gt;");
    expect(html).toContain("BR-01 / ARE");
    expect(html).toContain("STATEMENT SUMMARY");
    expect(html).toContain("LOCAL");
    expect(html).toContain("Local figures use the customer currency; USD columns use saved per-entry rates.");

    // Verify Account No. appears before prominent Account Name
    const codeIdx = html.indexOf("ACC-1001");
    const nameIdx = html.indexOf('<h1 class="p-acct-name">Acme &lt;Ltd&gt;</h1>');
    expect(codeIdx).toBeGreaterThan(-1);
    expect(nameIdx).toBeGreaterThan(-1);
    expect(codeIdx).toBeLessThan(nameIdx);

    // No SAMPLE DATA watermarks
    expect(html).not.toContain("SAMPLE DATA");
    expect(html).not.toContain("DESIGN SAMPLE");
  });

  it("calculates USD equivalent DR USD, CR USD, and running Balance USD accurately from saved exchange rates", () => {
    const html = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" });
    // 1050 / 3.67 = 286.10
    expect(html).toContain("286.10");
    // 840 / 3.67 = 228.88
    expect(html).toContain("228.88");
    // 286.10 - 228.88 = 57.22
    expect(html).toContain("57.22");
  });

  it("sets the A4 page size per layout and repeats the header", () => {
    const p = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" });
    expect(p).toMatch(/size: A4 portrait/);
    expect(p).toMatch(/thead \{ display: table-header-group; \}/);
    expect(buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" })).toMatch(/size: A4 landscape/);
  });

  it("RTL languages render right-to-left with translated labels in both orientations", () => {
    for (const lang of ["ur", "ar", "fa", "ps"]) {
      const p = buildLedgerStatementPrintHtml(data("debit"), { lang, orientation: "portrait" });
      const l = buildLedgerStatementPrintHtml(data("debit"), { lang, orientation: "landscape" });
      expect(p).toMatch(/<html lang="\w+" dir="rtl">/);
      expect(l).toMatch(/<html lang="\w+" dir="rtl">/);
      expect(l).not.toContain(">CUSTOMER GENERAL LEDGER<");
    }
  });

  it("escapes data and marks foreign-currency rows", () => {
    const h = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" });
    expect(h).toContain("Acme &lt;Ltd&gt;");
    expect(h).toContain("(USD @ <bdi dir=\"ltr\">3.67</bdi>)");
  });
});
