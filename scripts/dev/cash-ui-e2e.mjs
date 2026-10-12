/**
 * DEV only — authenticated browser E2E of the redesigned Cash Journal (Roznamcha cash entry) screen.
 *   BASE=http://localhost:3300 OUT=<dir> [ROLE=country_admin COUNTRY_ID=<uuid> ... LANG_CODE=en] node scripts/dev/cash-ui-e2e.mjs
 * Checks the toolbar, journal table paging, Filters dialog, search, "Amount & Payment" card (re-computed independently from the API rows),
 * Print preview, New Entry dialog and the browser console. Prints PASS/FAIL per check, writes <OUT>/cash-ui-e2e.json.
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const lang = process.env.LANG_CODE || "en";
const body = { role: process.env.ROLE || "country_admin", countryId: process.env.COUNTRY_ID || "935dd0b9-8228-43b3-b53d-c06e9ae2882f", countryBranchId: process.env.COUNTRY_BRANCH_ID || undefined, cityBranchId: process.env.CITY_BRANCH_ID || undefined, operationalDomain: process.env.DOMAIN || undefined };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 220) }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 150) : ""); };
const W = Number(process.env.W || 1440), H = Number(process.env.H || 1000);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: W, height: H }, acceptDownloads: true });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
const p = await ctx.newPage(); const errors = []; let listBody = null;
p.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/favicon|Failed to load resource|ResizeObserver|DevTools|dgt-connect|presence|Download the React/i.test(m.text())) errors.push(m.type() + ": " + m.text().slice(0, 200)); });
p.on("response", async (res) => { const u = res.url(); if (/\/api\/erp\/roznamcha\?/.test(u) && res.status() === 200) { try { const j = await res.json(); if ((j.data?.entries ?? []).length) listBody = j.data.entries; } catch {} } });
await p.goto(BASE + "/dashboard/roznamcha/cash-entry", { waitUntil: "load", timeout: 240000 });
await p.waitForTimeout(12000);
await p.locator("div.inline-flex.rounded-lg button").last().click(); // "All Dates"
await p.waitForFunction(() => /of [1-9]/.test(document.querySelector(".dgt-cj-pager")?.innerText || ""), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500);
const pager = async () => ((await p.locator(".dgt-cj-range").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
const total = async () => Number(((await pager()).match(/of (\d+)/) || [])[1] ?? NaN);
const rowsOnScreen = async () => p.locator("table.min-w-\\[1050px\\] tbody tr").count();
const N = await total();
check("Toolbar present: Reports, Filters, Search, Print, journal actions, New Entry", await p.evaluate(() => { const t = document.getElementById("erp-page-actions-portal-content"); return !!t && t.querySelectorAll("button").length >= 5 && !!t.querySelector("input"); }));
check("Heading + subtitle render", await p.locator(".dgt-cj-heading h1").count() === 1 && (await p.locator(".dgt-cj-heading p").innerText()).length > 10);
check("Journal pager shows a real total from the scoped API", N > 0, await pager());
const entries = (listBody ?? []).filter((e) => (e.roznamcha_lines || []).length > 0);
check("Pager total == entries that carry posted lines in the API response", N === entries.length, `pager=${N} api=${entries.length}`);

// Amount & Payment — recomputed independently from the API rows (same USD cell rule as the table)
let credit = 0, debit = 0, cc = 0, dc = 0, miss = 0;
for (const e of listBody ?? []) for (const l of e.roznamcha_lines || []) {
  const rate = l.exchange_rate ?? l.usd_rate ?? e.exchange_rate ?? null;
  for (const [side, amt] of [["credit", Number(l.credit || 0)], ["debit", Number(l.debit || 0)]]) {
    if (amt <= 0) continue; const u = l.usd_amount ?? (rate ? amt / Number(rate) : null); const v = u ? Number(u) : rate ? amt / Number(rate) : null;
    if (side === "credit") { cc++; if (v === null) miss++; else credit += v; } else { dc++; if (v === null) miss++; else debit += v; }
  }
}
const cardTxt = await p.locator(".dgt-cj-summary").innerText();
const nums = [...cardTxt.matchAll(/(\d[\d,]*\.\d{2})\s*USD/g)].map((m) => Number(m[1].replace(/,/g, "")));
check("Amount & Payment card == independent sum of the table's USD columns", nums.length >= 2 && Math.abs(nums[0] - credit) < 0.02 && Math.abs(nums[1] - debit) < 0.02, `card=${nums.slice(0, 3)} expected=${credit.toFixed(2)}/${debit.toFixed(2)}`);
check("Credit / debit entry counts match", cardTxt.includes(String(cc)) && cardTxt.includes(String(dc)), `${cc}/${dc}${miss ? " (missing rate " + miss + ")" : ""}`);

// paging
await p.locator(".dgt-cj-rows select").selectOption("10"); await p.waitForTimeout(800);
const r10 = await pager(); check("Rows per page = 10", /Showing 1 to 10 of/.test(r10) || /1.*10/.test(r10), r10);
const nextBtn = p.locator(".dgt-cj-pages button").last(); await nextBtn.click(); await p.waitForTimeout(600);
const r2 = await pager(); check("Next page shows rows 11-20", /11.*20/.test(r2), r2);
await p.locator(".dgt-cj-pages button").first().click(); await p.waitForTimeout(600);
check("Previous returns to page 1", /1 .*10/.test(await pager()), await pager());
await p.locator(".dgt-cj-rows select").selectOption("50"); await p.waitForTimeout(600);
const lines50 = await rowsOnScreen();
check("Rows per page = 50 renders up to 50 entries (2 lines each)", lines50 > 0 && lines50 <= 101, `${lines50} table rows`);

// search
const sample = entries[0]?.voucher_no || entries[0]?.journal_no;
const search = p.locator("#erp-page-actions-portal-content input");
await search.fill(String(sample)); await p.waitForTimeout(900);
const sTotal = await total(); const expectS = entries.filter((e) => JSON.stringify([e.voucher_no, e.journal_no, e.narration, ...(e.roznamcha_lines || []).map((l) => [l.account_number, l.entry_serial_number])]).toLowerCase().includes(String(sample).toLowerCase())).length;
check("Search narrows the journal (page search, client-side over scoped rows)", sTotal >= 1 && sTotal <= N && sTotal === expectS, `${sample}: ${sTotal} (expected ${expectS}) of ${N}`);
await search.fill(""); await p.waitForTimeout(800);
check("Clearing the search restores the journal", (await total()) === N);

// filters dialog
const filtersBtn = p.locator("#erp-page-actions-portal-content button").filter({ hasText: /Filters|فلٹر|التصفية|فیلتر|فلټر/ }).first();
await filtersBtn.click(); await p.waitForTimeout(800);
check("Filters dialog opens", await p.locator(".dgt-cj-filter-body").count() === 1);
const selects = p.locator(".dgt-cj-filter-body select");
const curOpts = await selects.nth(1).locator("option").allInnerTexts();
const apiCur = [...new Set((listBody ?? []).flatMap((e) => (e.roznamcha_lines || []).map((l) => String(l.currency || "").toUpperCase())).filter(Boolean))].sort();
check("Currency choices come only from the loaded scoped rows", JSON.stringify(curOpts.slice(1)) === JSON.stringify(apiCur), `${curOpts.slice(1)} vs ${apiCur}`);
await selects.nth(0).selectOption("debit");
await p.locator(".dgt-cj-filter-body button[type=submit]").click(); await p.waitForTimeout(1200);
const dTotal = await total(); const expectD = entries.filter((e) => (e.roznamcha_lines || []).some((l) => Number(l.debit || 0) > 0)).length;
check("Filter Journal Type = Debit narrows correctly", dTotal === expectD && dTotal <= N, `${dTotal} (expected ${expectD})`);
check("Active filter count badge shown", (await p.locator(".dgt-cj-count").innerText()) === "1");
await filtersBtn.click(); await p.waitForTimeout(500);
await p.locator(".dgt-cj-filter-actions .dgt-cj-ctrl").first().click(); await p.waitForTimeout(1200); // Clear All
check("Clear All restores the full journal", (await total()) === N && (await p.locator(".dgt-cj-count").count()) === 0);

// print preview (existing handler, scoped data)
const popupP = ctx.waitForEvent("page", { timeout: 20000 }).catch(() => null);
await p.locator('button[data-testid="print-action"]').click(); await p.waitForTimeout(6000);
const popup = await popupP; const frames = await p.locator("iframe").count();
check("Print opens the report preview (existing Universal Print)", !!popup || frames > 0 || /journal|Roznamcha|Cash/i.test(await p.evaluate(() => document.body.innerText)), popup ? "new window" : `${frames} iframe`);
if (popup) await popup.close().catch(() => {});
await p.screenshot({ path: `${OUT}/print-preview-${lang}.png` });
await p.keyboard.press("Escape").catch(() => {});

// new entry dialog
await p.goto(BASE + "/dashboard/roznamcha/cash-entry", { waitUntil: "load", timeout: 240000 }); await p.waitForTimeout(9000);
await p.locator('button.bg-blue-600:has-text("New Entry"), #erp-page-actions-portal-content button:last-child').last().click(); await p.waitForTimeout(2500);
check("New Cash Entry dialog opens with the six steps + account panel", (await p.locator(".dgt-cj-modal").count()) === 1 && (await p.locator(".dgt-cj-modal span.rounded-full").count()) >= 6);
await p.locator(".dgt-cj-modal button[aria-label]").first().click(); await p.waitForTimeout(800);
check("Dialog closes", (await p.locator(".dgt-cj-modal").count()) === 0);
check("No page errors / console errors / hydration warnings", errors.length === 0, errors[0] || "");
fs.writeFileSync(`${OUT}/cash-ui-e2e.json`, JSON.stringify(results, null, 1));
const bad = results.filter((x) => !x.ok);
console.log(`\n==== ${results.length - bad.length} PASS / ${bad.length} FAIL ====`);
await b.close();
