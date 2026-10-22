/**
 * DEV only — every Clearing Agent screen renders for a signed-in super admin in English, with no page errors,
 * no server-error text and no sideways scroll. BASE=http://localhost:3520 OUT=<dir> node scripts/dev/clearing-agent-browser-e2e.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".ui-out/clearing"; fs.mkdirSync(OUT, { recursive: true });
const PAGES = ["clearing-agent/clearing-workspace", "clearing-agent/customer-bill", "clearing-agent/customer-order", "clearing-agent/customs-expenses", "clearing-agent/customer-expenses", "clearing-agent/truck-expenses", "clearing-agent/other-expenses", "clearing-agent/import-loading", "clearing-agent/truck-loading", "clearing-agent/transit-loading", "clearing-agent/transit-entry", "clearing-agent/truck-freight-bill", "clearing-agent/truck-registration", "clearing-agent/payment-bill-entry", "clearing-agent/agent-custom-entry", "clearing-agent/route-border-insurance-report"];
const results = []; const check = (n, ok, d = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 200) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
for (const path of PAGES) {
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  try {
    await p.goto(`${BASE}/dashboard/${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const info = await p.evaluate(() => ({ text: document.body.innerText, overflow: document.documentElement.scrollWidth - innerWidth }));
    const serverErr = /Internal Server Error|Application error|Unhandled Runtime Error|NEXT_REDIRECT/i.test(info.text);
    check(`${path}: renders`, info.text.length > 300, `len=${info.text.length}`);
    check(`${path}: no server-error text`, !serverErr);
    check(`${path}: no page errors`, errs.length === 0, errs.join(" | "));
    check(`${path}: no sideways scroll`, info.overflow <= 2, String(info.overflow));
    await p.screenshot({ path: `${OUT}/${path.replace(/\//g, "_")}.png` }).catch(() => {});
  } catch (e) { check(`${path}: loaded`, false, String(e).slice(0, 120)); }
  await p.close();
}
await b.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
