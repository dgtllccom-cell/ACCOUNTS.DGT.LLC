import { describe, expect, it } from "vitest";
import { buildGenericErpReportHtml } from "@/lib/reports/open-generic-erp-report";

/**
 * Standalone HTML report export (Download HTML). Verifies the file the user
 * downloads: real filtered rows + totals, safe escaping of user values, no
 * session/secret leakage, correct language + RTL/LTR, and a graceful
 * zero-record report.
 */

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "party", label: "Party" },
  { key: "debit", label: "Debit", format: "currency" as const },
  { key: "credit", label: "Credit", format: "currency" as const },
];

const ROWS = [
  { date: "2026-08-01", party: "Al-Noor Traders", debit: 1500, credit: 0 },
  { date: "2026-08-02", party: 'Evil "Co" <script>alert(1)</script>', debit: 0, credit: 900 },
];

describe("buildGenericErpReportHtml — standalone HTML export", () => {
  it("includes the title, every filtered row and the totals", () => {
    const { html, title, filename } = buildGenericErpReportHtml({
      title: "Ledger Statement",
      lang: "en",
      columns: COLUMNS,
      rows: ROWS,
      summary: { total_debit: 1500, total_credit: 900 },
      filters: [{ label: "Country", value: "Pakistan" }],
    });
    expect(title).toBe("Ledger Statement");
    expect(html).toContain("Ledger Statement");
    expect(html).toContain("Al-Noor Traders");
    expect(html).toContain("2026-08-01");
    expect(html).toContain("Pakistan"); // active filter preserved
    expect(html).toMatch(/1[,.]?500/); // debit total rendered
    expect(filename).toMatch(/^ledger-statement-\d{4}-\d{2}-\d{2}\.html$/);
  });

  it("escapes user-provided values in the table body — no live markup", () => {
    const { html } = buildGenericErpReportHtml({ title: "X", lang: "en", columns: COLUMNS, rows: ROWS });
    // table cell: the payload is HTML-escaped
    expect(html).toContain("&lt;script&gt;");
    // the report body must not carry an intact, injectable <script>alert(1)</script>
    // outside the one helper block the template ships.
    const bodyOnly = html.replace(/<script[\s\S]*?<\/script>/i, "");
    expect(bodyOnly).not.toContain("<script>alert(1)</script>");
  });

  // KNOWN ISSUE (pre-existing, lib/reports/erp-report-template-builder.ts:695): the
  // downloadCsv() helper interpolates csvData into a <script> template literal and
  // escapes backticks + ${ but NOT </script>. A cell value containing "</script>…"
  // can close the helper block early → HTML injection in the saved/previewed file.
  // A 4-line defang (add .replace(/<\/(script)/gi, "<\\/$1")) is prepared in
  // scratchpad/csv-xss-fix.patch — awaiting approval to touch that file (outside the
  // approved 5). Un-skip once applied.
  it.skip("neutralises </script> from row data in the CSV-download helper", () => {
    const { html } = buildGenericErpReportHtml({ title: "X", lang: "en", columns: COLUMNS, rows: ROWS });
    expect(html).toMatch(/<\\\/script/);
  });

  it("contains no session / cookie / token / password material", () => {
    const { html } = buildGenericErpReportHtml({
      title: "Scoped Report",
      lang: "en",
      columns: COLUMNS,
      rows: ROWS,
      companyInfo: { name: "DGT LLC" },
    });
    for (const secret of ["cookie", "authorization", "bearer", "session_id", "access_token", "refresh_token", "password", "set-cookie", "supabase.auth"]) {
      expect(html.toLowerCase()).not.toContain(secret);
    }
  });

  it("emits dir=rtl for Urdu and dir=ltr for English, with lang set", () => {
    const en = buildGenericErpReportHtml({ title: "T", lang: "en", columns: COLUMNS, rows: ROWS }).html;
    const ur = buildGenericErpReportHtml({ title: "T", lang: "ur", columns: COLUMNS, rows: ROWS }).html;
    expect(en).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/);
    expect(ur).toMatch(/<html[^>]*lang="ur"[^>]*dir="rtl"/);
  });

  it("renders a titled 'No records found' report for zero rows (no crash, non-blank)", () => {
    const { html } = buildGenericErpReportHtml({ title: "Empty Report", lang: "en", columns: COLUMNS, rows: [] });
    expect(html).toContain("Empty Report");
    expect(html.toLowerCase()).toContain("no records found");
    expect(html.length).toBeGreaterThan(200);
  });
});
