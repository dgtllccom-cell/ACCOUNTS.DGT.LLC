// DEV-only: load a route on the live server and report pageerror + failed /api requests. Env: BASE, RBAC_SECRET, PAGE_PATH, LANG_CODE
import fs from "node:fs";
import { webkit } from "playwright";
const BASE = process.env.BASE || "http://localhost:3230";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: process.env.LANG_CODE || "en", domain: "localhost", path: "/" }]);
const p = await ctx.newPage();
const errs = [], badApi = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
p.on("response", (r) => { const u = r.url(); if (u.includes("/api/") && r.status() >= 400) badApi.push(`${r.status()} ${u.replace(BASE, "").slice(0, 70)}`); });
await p.goto(BASE + process.env.PAGE_PATH, { waitUntil: "load", timeout: 90000 }); await p.waitForTimeout(10000);
console.log("PAGE:", process.env.PAGE_PATH);
console.log("pageerrors:", errs.length ? JSON.stringify(errs) : "NONE");
console.log("failed /api:", badApi.length ? JSON.stringify([...new Set(badApi)]) : "NONE");
await b.close();
