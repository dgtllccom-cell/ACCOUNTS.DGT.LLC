// DEV only: print the blue "payment type" card rows of a page after waiting for network idle. PAGE=/dashboard/... BASE=http://localhost:3300
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();
const reqs = [];
p.on("response", async (res) => { if (/purchases\/payments|sales\/payments|usd-rates/.test(res.url())) reqs.push(res.status() + " " + res.url().replace(BASE, "")); });
await p.goto(BASE + (process.env.PAGE || "/dashboard/journal/purchase-order-payment/final"), { waitUntil: "load", timeout: 240000 });
for (const wait of [5, 15, 30]) {
  await p.waitForTimeout(wait * 1000 / (wait === 5 ? 1 : 1) - (wait === 5 ? 0 : 0));
  const txt = await p.evaluate(() => [...document.querySelectorAll(".dgt-pa-card")].map((c) => c.innerText.replace(/\n+/g, " | ")).join("\n"));
  console.log(`--- after ~${wait}s`); console.log(txt.slice(0, 900));
}
console.log(reqs.join("\n")); await b.close();
