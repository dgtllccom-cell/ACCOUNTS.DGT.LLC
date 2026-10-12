// DEV only: console errors/warnings of a page on a phone viewport. PAGE=/dashboard/... LANG=ur BASE=http://localhost:3300
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const lang = process.env.LANG_CODE || "ur";
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
const p = await ctx.newPage(); const out = [];
p.on("console", (m) => { if (["error", "warning"].includes(m.type())) out.push(m.type() + ": " + m.text().slice(0, 4000)); });
p.on("pageerror", (e) => out.push("pageerror: " + String(e).slice(0, 4000)));
await p.goto(BASE + (process.env.PAGE || "/dashboard/journal/purchase-order-payment/history"), { waitUntil: "load", timeout: 240000 });
await p.waitForTimeout(25000);
console.log(out.join("\n---\n") || "no console errors/warnings");
await b.close();
