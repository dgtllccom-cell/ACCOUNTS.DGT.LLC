/**
 * DEV only — Truck Registration print: the Print action builds a printable A4 document through the shared truck report
 * action (a hidden print iframe, removed after printing). The test captures that document as it is created and checks
 * its content. BASE=http://localhost:3520 OUT=<dir> node scripts/dev/truck-print-e2e.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".ui-out/truck-print"; fs.mkdirSync(OUT, { recursive: true });
const results = []; const check = (n, ok, d = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 180) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => {
  try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {}
  window.__printedDocs = [];
  window.print = () => {};
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.tagName === "IFRAME" && n.srcdoc) window.__printedDocs.push(n.srcdoc); })
    .observe(document, { childList: true, subtree: true });
});
const p = await ctx.newPage();
await p.goto(BASE + "/dashboard/clearing-agent/truck-registration", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForSelector("#trk-live-report", { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(2500);
const liveText = await p.locator("#trk-live-report").innerText().catch(() => "");
check("truck registration live report has content", liveText.length > 200, `len=${liveText.length}`);
await p.getByRole("button", { name: /^Print$/ }).first().click();
await p.waitForFunction(() => window.__printedDocs.length > 0, null, { timeout: 60000 }).catch(() => {});
const docs = await p.evaluate(() => window.__printedDocs);
const doc = docs[docs.length - 1] || "";
const text = doc.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
check("print document is generated", doc.length > 1000, `html=${doc.length} chars`);
check("print document carries the live truck report content", text.length > 200 && /Registration|Owner|Truck/i.test(text), `text=${text.length} chars`);
check("print document uses an A4 page setup", /size:\s*A4|A4/i.test(doc), "");
check("print document shows no Arabic-script text in the English print", !/[؀-ۿ]/.test(text), "");
check("print document has no sample shipment or invented company names", !/LED TV|Global Cargo Logistics|ABC Exporters|A&C Transport Services|OWN-0001/.test(text), "");
fs.writeFileSync(`${OUT}/truck-print.html`, doc);
await b.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
