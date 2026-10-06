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

  // FIXED (lib/reports/erp-report-template-builder.ts, downloadCsv helper): csvData is
  // interpolated into a <script> template literal. The helper now escapes, in order,
  // backslash → backtick → ${ → </script, so no row value can break out of the string
  // literal or close the <script> block early in the saved/previewed HTML file.
  it("neutralises </script>, backslash, backtick and ${...} from row data in the CSV-download helper", () => {
    const HOSTILE_ROWS = [
      {
        date: "2026-08-02",
        // eslint-disable-next-line no-template-curly-in-string
        party: 'Evil </script><img src=x onerror=alert(1)> `tick` ${bad} C:\\path\\end',
        debit: 0,
        credit: 0,
      },
    ];
    const { html } = buildGenericErpReportHtml({ title: "X", lang: "en", columns: COLUMNS, rows: HOSTILE_ROWS });

    // isolate the single helper <script> block that carries csvData
    const start = html.indexOf("function downloadCsv()");
    expect(start).toBeGreaterThan(-1);
    const helperEnd = html.indexOf("</script>", start); // the *real* block terminator
    const helper = html.slice(start, helperEnd);

    // 1. no intact </script (case-insensitive) survives inside the helper string
    expect(helper).not.toMatch(/<\/script/i);
    // 2. the payload's closer is present only in defanged form
    expect(helper).toContain("<\\/script");
    // 3. no unescaped backtick from the row can close the csvRaw template literal
    expect(helper).not.toContain("`tick`");
    expect(helper).toContain("\\`tick\\`");
    // 4. no unescaped ${ from the row can open an interpolation
    expect(helper).not.toMatch(/(?<!\\)\$\{bad\}/);
    expect(helper).toContain("\\${bad}");
    // 5. a lone backslash from the row is doubled so it can't escape our escaping
    expect(helper).toContain("C:\\\\path\\\\end");
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
