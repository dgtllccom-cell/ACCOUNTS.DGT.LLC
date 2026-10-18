/**
 * DEV only — shared Grid / List view toggle.
 *   BASE=http://localhost:3510 OUT=<dir> [LANG_CODE=en] [W=1440] [PAGES=/dashboard/a,/dashboard/b] node scripts/dev/view-mode-e2e.mjs
 */
import fs from "node:fs"; import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const LANG = process.env.LANG_CODE || "en", W = Number(process.env.W || 1440);
const PAGES = (process.env.PAGES || "/dashboard/reports/country,/dashboard/accounts,/dashboard/purchase/stock/report,/dashboard/purchase/purchase-booking-journal-report,/dashboard/user-tasks").split(",");
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 170) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: LANG, domain: "localhost", path: "/" }]);
await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [LANG]);
const settle = async (p) => { await p.waitForFunction(() => !document.querySelector(".animate-spin") && !/Loading (Report|report)/.test(document.body.innerText.slice(0, 3000)), null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(2500); };
const stable = async (p) => { let last = -1; for (let i = 0; i < 20; i++) { const n = await p.evaluate(() => { const t = document.querySelector("main[data-erp-content] table"); return t?.tBodies[0]?.rows.length ?? 0; }); if (n === last && n > 0) return; last = n; await p.waitForTimeout(1000); } };
const stats = (p) => p.evaluate(() => {
  const main = document.querySelector("main[data-erp-content]");
  const t = [...main.querySelectorAll("table[data-card-ready], table")].find((x) => x.tHead && x.tBodies[0]?.rows.length > 0 && x.tHead.rows[0].cells.length >= 3);
  if (!t) return null;
  const tb = t.tBodies[0]; const cs = getComputedStyle(tb); const tr = [...tb.rows].sort((a, b) => b.cells.length - a.cells.length)[0]; const trs = getComputedStyle(tr);
  return { rows: tb.rows.length, tbodyDisplay: cs.display, trDisplay: trs.display, labelled: [...tr.cells].filter((c) => c.getAttribute("data-label")).length, cells: tr.cells.length, mode: main.getAttribute("data-view-mode"), overflowX: document.documentElement.scrollWidth - window.innerWidth };
});
for (const path of PAGES) {
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 }); await settle(p);
  const tag = `${path} [${LANG} ${W}px]`;
  const toggle = p.locator("[data-testid='view-mode-toggle']");
  await toggle.first().waitFor({ state: "attached", timeout: 25000 }).catch(() => {});
  if (!(await toggle.count())) { const s0 = await stats(p); check(`${tag}: toggle ${s0 ? "MISSING although the page has a table" : "absent (no eligible table on this page)"}`, !s0, ""); await p.close(); continue; }
  check(`${tag}: exactly one toggle`, (await toggle.count()) === 1, String(await toggle.count()));
  await stable(p); const list = await stats(p);
  check(`${tag}: list view is the default (real table)`, list && list.mode === "list" && /table/.test(list.tbodyDisplay), JSON.stringify(list));
  await p.locator("[data-testid='view-grid']").first().click(); await p.waitForFunction(() => document.querySelector("main[data-erp-content]")?.getAttribute("data-view-mode") === "grid" && document.querySelector("table[data-card-ready]"), null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(500);
  const grid = await stats(p);
  check(`${tag}: grid view shows cards (grid body, block rows)`, grid && grid.tbodyDisplay === "grid" && grid.trDisplay === "block", JSON.stringify(grid));
  check(`${tag}: same number of records in both views`, grid && list && grid.rows === list.rows, `${list?.rows} → ${grid?.rows}`);
  check(`${tag}: cards carry column labels`, grid && (grid.cells <= 1 || grid.labelled >= Math.min(2, grid.cells)), `${grid?.labelled}/${grid?.cells}`);
  check(`${tag}: no sideways page scroll in grid view`, grid && grid.overflowX <= 2, String(grid?.overflowX));
  await p.screenshot({ path: `${OUT}/${LANG}-${W}-${path.replace(/\W+/g, "_")}-grid.png` });
  // print always uses the real table and hides the toggle
  await p.emulateMedia({ media: "print" }); await p.waitForTimeout(400);
  const pr = await stats(p); const tgPrint = await toggle.first().isVisible().catch(() => false);
  check(`${tag}: print uses the real table and hides the toggle`, pr && /table/.test(pr.tbodyDisplay) && !tgPrint, JSON.stringify(pr && pr.tbodyDisplay) + " toggleVisible=" + tgPrint);
  await p.emulateMedia({ media: "screen" });
  // remembered per report
  await p.reload({ waitUntil: "domcontentloaded", timeout: 180000 }); await settle(p); await p.waitForFunction(() => document.querySelector("main[data-erp-content]")?.getAttribute("data-view-mode") === "grid", null, { timeout: 25000 }).catch(() => {});
  const again = await stats(p);
  check(`${tag}: choice is remembered after reload`, again && again.mode === "grid" && again.tbodyDisplay === "grid", JSON.stringify(again && again.mode));
  await p.locator("[data-testid='view-list']").first().click(); await p.waitForFunction(() => document.querySelector("main[data-erp-content]")?.getAttribute("data-view-mode") === "list", null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(500);
  await stable(p); const back = await stats(p);
  check(`${tag}: switching back restores the table`, back && back.mode === "list" && /table/.test(back.tbodyDisplay) && back.rows === list.rows, JSON.stringify(back && back.tbodyDisplay));
  check(`${tag}: no page errors`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await p.close();
}
await b.close(); console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
