// DEV-only: load a route on the DEV (non-minified) server and print React's full hydration-mismatch messages. Env: BASE, PAGE_PATH
import fs from "node:fs";
import { webkit } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: process.env.LANG_CODE || "en", domain: "localhost", path: "/" }]);
const p = await ctx.newPage();
p.on("console", (m) => { const t = m.text(); if (m.type() === "error") console.log("CONSOLE-ERR:", t.slice(0, 2500)); });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 3500)));
await p.goto(BASE + process.env.PAGE_PATH, { waitUntil: "load", timeout: 240000 }); await p.waitForTimeout(15000);
await b.close();
