/**
 * Ledger Statement print verification (DEV ONLY) — real DEV ledgers, both layouts, five languages.
 *
 *  1. Loads real statements through the SAME permission-checked API the screen uses (as the given login).
 *  2. Maps them exactly like the Detailed Ledger screen (opening balance + normal-side running balance) and checks the mapping
 *     against the server's own running balance (the screen used to start at 0 and always use Dr−Cr).
 *  3. Builds the portrait + landscape HTML in EN/UR/AR/FA/PS and renders each with Chromium's print engine (Playwright
 *     page.pdf, preferCSSPageSize) — real A4 pages, repeated header, page numbers.
 *  4. Checks: no clipped cell / no horizontal overflow, header repeats (one <thead>), page count > 1 for long ledgers,
 *     RTL direction, translated labels, totals = closing balance.
 * Env: BASE, ERP_COOKIE (erp_session=...), OUT_DIR. Usage: vite-node --config vitest.config.mjs scripts/e2e-ledger-print.mts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { buildLedgerStatementPrintHtml, type LedgerPrintData } from "@/lib/reports/ledger-statement-print";
import { resolveLedgerBranding } from "@/lib/reports/resolve-ledger-branding";
import { t } from "@/lib/i18n/ui";
// @ts-expect-error — the legacy ESM build ships no bundled types for this path
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

/** text of the first and last PDF page (proves the end block is never an orphan page) */
async function pdfPagesText(buf: Buffer) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  const text = async (n: number) => ((await (await doc.getPage(n)).getTextContent()).items as { str: string }[]).map((i) => i.str).join(" ").replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").replace(/\s+:/g, ":");
  return { pages: doc.numPages as number, first: await text(1), last: await text(doc.numPages) };
}

const BASE = process.env.BASE || "http://localhost:3000";
const COOKIE = process.env.ERP_COOKIE || "";
const OUT = process.env.OUT_DIR || "ledger-print-out";
fs.mkdirSync(OUT, { recursive: true });

// relative /api fetches made by the shared branding resolver go to the running app as this login
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: any, init: any = {}) => {
  const url = typeof input === "string" && input.startsWith("/") ? BASE + input : input;
  return realFetch(url, { ...init, headers: { ...(init.headers || {}), cookie: COOKIE } });
}) as typeof fetch;

const CASES = [
  { key: "pk-cash", code: "LOADTEST-PK-CASH", from: "2020-01-01", to: "2026-12-31" },     // longest DEV ledger, debit-normal
  { key: "ae-payable", code: "LOADTEST-AE-PAYABLE", from: "2026-09-15", to: "2026-12-31" }, // credit-normal, opening balance
];
const LANGS = ["en", "ur", "ar", "fa", "ps"];

type Check = { case: string; lang: string; orientation: string; name: string; pass: boolean; observed?: unknown };
const results: Check[] = [];
const ok = (c: Omit<Check, "pass">, pass: boolean) => results.push({ ...c, pass });

const ledgers = await (await fetch(`/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=2000&q=LOADTEST`)).json();
const browser = await chromium.launch();

for (const cs of CASES) {
  const row = (ledgers?.data?.ledgers ?? []).find((l: any) => l.ledgerCode === cs.code || l.accountCode === cs.code);
  if (!row) { ok({ case: cs.key, lang: "-", orientation: "-", name: "ledger visible to this login", observed: cs.code }, false); continue; }
  const res = await (await fetch(`/api/erp/accounting/reports/ledger/statement?ledgerId=${row.ledgerId}&fromDate=${cs.from}&toDate=${cs.to}&limit=5000`)).json();
  const d = res?.data;
  const header = d.header;
  const opening = Number(d.totals?.openingBalance ?? 0);
  const creditNormal = header.normalBalance === "credit";
  let running = opening; let sumDr = 0; let sumCr = 0; let maxDiff = 0;
  const lines = (d.lines as any[]).map((l) => {
    sumDr += l.debit || 0; sumCr += l.credit || 0;
    running += creditNormal ? (l.credit || 0) - (l.debit || 0) : (l.debit || 0) - (l.credit || 0);
    maxDiff = Math.max(maxDiff, Math.abs(running - l.runningBalance));
    return { date: l.entryDate, serial: l.branchSerialNo || l.countrySerialNo || l.superAdminSerialNo || null, manualRef: l.referenceNo, source: l.sourceTable, branch: l.branchName ?? null, user: l.createdByName, description: l.description, currency: l.currency, usdRate: l.usdRate, usdAmount: l.usdAmount, debit: l.debit || 0, credit: l.credit || 0, balance: running };
  });
  ok({ case: cs.key, lang: "-", orientation: "-", name: "screen running balance == server running balance (opening + normal side)", observed: { opening, maxDiff, lines: lines.length } }, maxDiff < 0.005);
  ok({ case: cs.key, lang: "-", orientation: "-", name: "closing == server balance", observed: { closing: running, server: d.totals.balance } }, Math.abs(running - d.totals.balance) < 0.005);

  for (const lang of LANGS) {
    const brand = await resolveLedgerBranding(header, lang, "RBAC-TEST Super Admin");
    const data: LedgerPrintData = {
      company: brand.companyInfo,
      account: { name: header.accountName || header.ledgerName, code: header.accountCode || header.ledgerCode, customerNumber: header.customerNumber, manualReference: header.manualReferenceNumber, kind: header.accountKind, currency: header.ledgerCurrency, country: brand.countryName || header.countryName, branch: brand.branchName || header.cityBranchName || header.countryBranchName, company: header.companyName, address: header.address },
      normalBalance: creditNormal ? "credit" : "debit",
      fromDate: cs.from, toDate: cs.to, openingBalance: opening, totalDebit: sumDr, totalCredit: sumCr, closingBalance: running,
      lines, printedBy: "RBAC-TEST Super Admin", printedAt: "2026-10-03 19:00",
    };
    for (const orientation of ["portrait", "landscape"] as const) {
      const c = { case: cs.key, lang, orientation };
      const html = buildLedgerStatementPrintHtml(data, { lang, orientation });
      const base = path.join(OUT, `${cs.key}-${orientation}-${lang}`);
      fs.writeFileSync(base + ".html", html);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.emulateMedia({ media: "print" });
      // printable width of the page box: A4 minus the @page side margins
      const widthPx = Math.round(((orientation === "portrait" ? 210 - 20 : 297 - 18) / 25.4) * 96);
      await page.setViewportSize({ width: widthPx, height: 1100 });
      const geo = await page.evaluate(() => {
        const table = document.querySelector("table.data-table") as HTMLElement;
        const clipped = [...table.querySelectorAll("td, th")].filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1).map((el) => (el as HTMLElement).innerText.slice(0, 30));
        return { tableW: table.getBoundingClientRect().width, docW: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth, clipped, theads: document.querySelectorAll("table.data-table > thead").length, dir: document.documentElement.dir, cols: table.querySelectorAll("thead tr.cols th").length, title: document.querySelector("h1")?.textContent };
      });
      ok({ ...c, name: "no clipped cell", observed: geo.clipped.slice(0, 3) }, geo.clipped.length === 0);
      ok({ ...c, name: "table fits the printable width (no horizontal overflow)", observed: { tableW: geo.tableW, docW: geo.docW, scrollW: geo.scrollW } }, geo.scrollW <= geo.docW + 1 && geo.tableW <= geo.docW + 1);
      ok({ ...c, name: `column set (${orientation === "portrait" ? 7 : 12} columns)`, observed: geo.cols }, geo.cols === (orientation === "portrait" ? 7 : 12));
      ok({ ...c, name: "direction", observed: geo.dir }, geo.dir === (lang === "en" ? "ltr" : "rtl"));
      ok({ ...c, name: "translated title", observed: geo.title }, geo.title === t(lang as never, "lprint.title" as never, "Account Ledger Statement"));
      const pdf = await page.pdf({ path: base + ".pdf", preferCSSPageSize: true, printBackground: true });
      const pt = await pdfPagesText(pdf);
      const pages = pt.pages;
      if (lang === "en") {
        const beforeTotals = pt.last.split("Totals for the period")[0];
        ok({ ...c, name: "last page carries entries + totals + closing + signatures (no orphan page)", observed: pt.last.slice(0, 120) },
          /Totals for the period/.test(pt.last) && /Closing balance carried forward/.test(pt.last) && /Approved by/.test(pt.last) && /\d{4}-\d{2}-\d{2}/.test(beforeTotals));
        ok({ ...c, name: "page footer 'Page x of N' printed", observed: pt.first.match(/Page \d+ of \d+/)?.[0] }, new RegExp(`Page 1 of ${pages}`).test(pt.first));
      }
      ok({ ...c, name: "multi-page PDF rendered", observed: { pages, bytes: pdf.length } }, lines.length > 40 ? pages > 1 : pages >= 1);
      // screenshot of the first printed page area for the evidence report
      await page.setViewportSize({ width: widthPx, height: Math.round(widthPx * (orientation === "portrait" ? 1.414 : 0.707)) });
      await page.screenshot({ path: base + ".png" });
      await page.close();
    }
  }
}
await browser.close();
const fail = results.filter((r) => !r.pass);
for (const r of results) console.log(r.pass ? "PASS" : "FAIL", r.case, r.lang, r.orientation, r.name, JSON.stringify(r.observed ?? ""));
console.log(`\nTOTAL ${results.length - fail.length}/${results.length} PASS`);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
process.exit(fail.length ? 1 : 0);
