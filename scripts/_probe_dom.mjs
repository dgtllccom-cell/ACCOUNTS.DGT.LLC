// DEV-only: evaluate a JS expression on a page (desktop or phone) after load. Env: PAGE_PATH, EXPR, W, H, THEME, INJECT_CSS
import fs from "node:fs";
import { webkit } from "playwright";
const BASE = process.env.BASE || "http://localhost:3230";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await webkit.launch();
const THEME = process.env.THEME || "night";
const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1440), height: Number(process.env.H || 900) } });
await ctx.addCookies([{ name: "erp_lang", value: process.env.LANG_CODE || "en", domain: "localhost", path: "/" }, { name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_theme_mode", value: THEME, domain: "localhost", path: "/" }]);
await ctx.addInitScript((t) => { try { localStorage.setItem("erp_theme_mode", t); } catch {} }, THEME);
const p = await ctx.newPage();
await p.goto(BASE + process.env.PAGE_PATH, { waitUntil: "load", timeout: 90000 }); await p.waitForTimeout(6000);
if (process.env.INJECT_CSS) await p.addStyleTag({ content: fs.readFileSync(process.env.INJECT_CSS, "utf8") });
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(process.env.EXPR), null, 1));
await b.close();
