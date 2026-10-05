// DEV-only: list fixed full-screen layers on a page before/after clicking steps (to find the modal selector pattern)
import fs from "node:fs";
import { webkit } from "playwright";
const BASE = process.env.BASE || "http://localhost:3230";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();
await p.goto(BASE + process.env.PAGE_PATH, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(9000);
const layers = () => p.evaluate(() => [...document.querySelectorAll("*")].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.position === "fixed" && r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9 && cs.display !== "none" && cs.visibility !== "hidden"; }).map((e) => `${e.tagName.toLowerCase()}.${(e.className || "").toString().slice(0, 90)} role=${e.getAttribute("role")} inContent=${!!e.closest("[data-erp-content]")} pe=${getComputedStyle(e).pointerEvents}`));
console.log("BEFORE", JSON.stringify(await layers(), null, 1));
for (const st of JSON.parse(process.env.STEPS || "[]")) { await p.locator("button, a", { hasText: st }).first().click({ timeout: 15000 }); await p.waitForTimeout(3500); }
console.log("AFTER", JSON.stringify(await layers(), null, 1));
await b.close();
