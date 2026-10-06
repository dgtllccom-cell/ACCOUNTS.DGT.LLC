import { describe, expect, it } from "vitest";
import { buildLedgerStatementPrintHtml, type LedgerPrintData } from "@/lib/reports/ledger-statement-print";

const data = (normal: "debit" | "credit"): LedgerPrintData => ({
  company: { name: "Test Co" },
  account: { name: "Acme <Ltd>", code: "A-1", currency: "AED" },
  normalBalance: normal,
  fromDate: "2026-01-01", toDate: "2026-01-31",
  openingBalance: 100, totalDebit: 50, totalCredit: 200, closingBalance: -50,
  lines: [
    { date: "2026-01-05", serial: "V-1", manualRef: "M-1", source: "roznamcha_entries", branch: "Deira", user: "U", description: "x", currency: "AED", debit: 50, credit: 0, balance: 150 },
    { date: "2026-01-06", serial: "V-2", manualRef: null, source: "ledger_posting_batches", branch: null, user: null, description: "y", currency: "USD", usdRate: 3.67, debit: 0, credit: 200, balance: -50 },
  ],
});
const cols = (html: string) => (html.match(/<tr class="cols">([\s\S]*?)<\/tr>/)?.[1].match(/<th/g) ?? []).length;

describe("ledger statement print layouts", () => {
  it("portrait and landscape are different layouts (7 vs 12 columns)", () => {
    expect(cols(buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "portrait" }))).toBe(7);
    expect(cols(buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" }))).toBe(12);
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
    expect(debitNormal).toMatch(/50\.00<\/bdi> <span class="dc">Cr<\/span><\/td><\/tr>\s*<tr class="total-row end"/);
    expect(creditNormal).toMatch(/50\.00<\/bdi> <span class="dc">Dr<\/span><\/td><\/tr>\s*<tr class="total-row end"/);
  });
  it("escapes data and marks foreign-currency rows", () => {
    const h = buildLedgerStatementPrintHtml(data("debit"), { lang: "en", orientation: "landscape" });
    expect(h).toContain("Acme &lt;Ltd&gt;");
    expect(h).toContain("USD @ <bdi dir=\"ltr\">3.67</bdi>");
  });
});
