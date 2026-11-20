import { describe, expect, it } from "vitest";
import { buildLedgerStatementPrintHtml, type LedgerPrintData } from "@/lib/reports/ledger-statement-print";

/**
 * Detailed Ledger print (owner report 20 Nov 2026): columns must never overlap and the
 * layout must be the same for every role — only the toolbar orientation changes it.
 */
const line = (i: number, serial: string, rzn: string) => ({
  date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
  entryNo: serial,
  rznNo: rzn,
  rznName: "Roznamcha",
  serial,
  manualRef: rzn,
  source: "roznamcha_entries",
  description: `Long narration for entry ${i} — goods received at Chaman border, customs cleared`,
  currency: "AED",
  usdRate: 3.6725,
  debit: i % 2 ? 1234567.89 : 0,
  credit: i % 2 ? 0 : 987654.32,
  balance: 1234567.89 - i,
});

// Super Admin and Country Admin see the same statement; only the serial numbering differs
// (super-admin serial vs long branch/country serial such as AREAEDU001-000…).
const dataFor = (role: "super_admin" | "country_admin", rows = 3): LedgerPrintData => ({
  company: { name: "DGT LLC" },
  account: {
    name: "Haji abdullah chaman — a deliberately very long customer account name for wrapping",
    code: "ACC-000010",
    currency: "AED",
  },
  normalBalance: "debit",
  fromDate: "2026-01-01",
  toDate: "2026-11-20",
  openingBalance: 0,
  totalDebit: 1,
  totalCredit: 1,
  closingBalance: 0,
  lines: Array.from({ length: rows }, (_, i) =>
    role === "super_admin"
      ? line(i, `SA-${i + 1}`, `R-${i + 1}`)
      : line(i, `AREAEDU001-0000000${i + 1}`, `LP-JRN-00000000${i + 1}`),
  ),
});

const widths = (html: string) =>
  [...(html.match(/<colgroup>([\s\S]*?)<\/colgroup>/)?.[1] ?? "").matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]));

/** strip row data so only the layout skeleton (classes, structure, CSS) remains */
const skeleton = (html: string) =>
  html
    .replace(/<tbody>[\s\S]*?<\/tbody>/, "<tbody/>")
    .replace(/<meta name="erp-page-count"[^>]*>/, "");

describe("detailed ledger print — fixed columns, no overlap", () => {
  for (const orientation of ["portrait", "landscape"] as const) {
    it(`${orientation}: table-layout fixed with 12 fixed widths summing to 100%`, () => {
      const html = buildLedgerStatementPrintHtml(dataFor("country_admin"), { lang: "en", orientation });
      expect(html).toMatch(/table-layout: fixed/);
      const w = widths(html);
      expect(w).toHaveLength(12);
      expect(Math.round(w.reduce((a, b) => a + b, 0) * 100) / 100).toBe(100);
      expect(html).toMatch(new RegExp(`size: A4 ${orientation}`));
    });

    it(`${orientation}: long Entry / Rzn numbers render in wrapping monospace code cells`, () => {
      const html = buildLedgerStatementPrintHtml(dataFor("country_admin"), { lang: "en", orientation });
      expect(html).toContain('<td class="code"><bdi dir="ltr">AREAEDU001-00000001</bdi></td>');
      expect(html).toContain('<td class="code"><bdi dir="ltr">LP-JRN-000000001</bdi></td>');
      const codeCss = html.match(/td\.code \{([\s\S]*?)\}/)?.[1] ?? "";
      expect(codeCss).toMatch(/monospace/);
      expect(codeCss).toMatch(/word-break: break-all/);
      expect(codeCss).toMatch(/white-space: normal/);
      // nothing in the table body is forced onto one line except the short date
      expect([...html.matchAll(/<td class="([^"]*\bnw\b[^"]*)"/g)].every((m) => m[1] === "nw date")).toBe(true);
      expect(html).toMatch(/table\.data-table td \{\s*overflow: hidden;/);
      // numbers stay right-aligned
      expect(html.match(/td\.num \{([\s\S]*?)\}/)?.[1]).toMatch(/text-align: end/);
    });

    it(`${orientation}: complete statement — title, account details, summary, reporting basis, all columns, footer`, () => {
      const html = buildLedgerStatementPrintHtml(dataFor("super_admin"), { lang: "en", orientation });
      for (const s of [
        "CUSTOMER GENERAL LEDGER",
        "ACCOUNT DETAILS",
        "STATEMENT SUMMARY",
        "REPORTING BASIS",
        ">DR<",
        ">CR<",
        ">Balance<",
        ">DR USD<",
        ">CR USD<",
        "DGT LLC",
        'counter(page) " of " counter(pages)',
        "thead { display: table-header-group; }",
      ]) {
        expect(html).toContain(s);
      }
    });
  }

  it("same layout for Super Admin and Country Admin — role never switches orientation or template", () => {
    for (const orientation of ["portrait", "landscape"] as const) {
      const sa = buildLedgerStatementPrintHtml(dataFor("super_admin"), { lang: "en", orientation });
      const ca = buildLedgerStatementPrintHtml(dataFor("country_admin"), { lang: "en", orientation });
      expect(skeleton(sa)).toBe(skeleton(ca));
      expect(sa).toContain(`data-layout="${orientation}"`);
      expect(ca).toContain(`data-layout="${orientation}"`);
    }
  });

  it("all five languages, both orientations: correct dir and multi-page header repeat", () => {
    for (const lang of ["en", "ur", "ar", "fa", "ps"]) {
      for (const orientation of ["portrait", "landscape"] as const) {
        const html = buildLedgerStatementPrintHtml(dataFor("country_admin", 80), { lang, orientation });
        expect(html).toContain(`dir="${lang === "en" ? "ltr" : "rtl"}"`);
        expect(Number(html.match(/name="erp-page-count" content="(\d+)"/)?.[1])).toBeGreaterThan(1);
        expect(html).toContain("display: table-header-group");
        expect(widths(html)).toHaveLength(12);
      }
    }
  });
});
