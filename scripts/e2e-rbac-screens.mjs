#!/usr/bin/env node
/**
 * RBAC visual evidence (DEV ONLY): for every test user — real login, landing dashboard on desktop (EN + one RTL language) and
 * mobile, the 403 page for a forbidden URL, and the ACTUAL top-level sidebar menu read from the DOM.
 * Env: BASE, RBAC_USERS, RBAC_SECRET, SHOTS_DIR. Writes <SHOTS_DIR>/<role>-*.png and <SHOTS_DIR>/menus.json.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const users = JSON.parse(fs.readFileSync(process.env.RBAC_USERS, "utf8"));
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const DIR = process.env.SHOTS_DIR;
fs.mkdirSync(DIR, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

const PLAN = {
  super: { rtl: "ur", denied: null },
  country_uae: { rtl: "ar", denied: "/dashboard/super-admin" },
  branch_deira: { rtl: "fa", denied: "/dashboard/users" },
  ops_global: { rtl: "ps", denied: "/dashboard/ledger/detailed" },
  ops_pk: { rtl: "ur", denied: "/dashboard/roznamcha/cash-entry" },
  ops_chaman: { rtl: "ps", denied: "/dashboard/accounts" },
  sl_admin: { rtl: "ar", denied: "/dashboard/purchase/purchase-loading-records" },
  sl_deira: { rtl: "fa", denied: "/dashboard/ledger/detailed" },
  agent: { rtl: "ur", denied: "/dashboard/general-office/payroll" },
  finance: { rtl: "ar", denied: "/dashboard/super-admin" },
  restricted: { rtl: "ps", denied: "/dashboard/ledger/detailed" },
  combo: { rtl: "fa", denied: "/dashboard/super-admin" },
};

const browser = await chromium.launch();
const menus = {};
for (const [key, plan] of Object.entries(PLAN)) {
  if (ONLY && !ONLY.includes(key)) continue;
  const u = users[key];
  if (!u?.userId) continue;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const login = await ctx.request.post(BASE + "/api/erp/auth/login", { data: { identifier: u.email, password } });
  if (login.status() !== 200) { console.log(key, "login", login.status()); await ctx.close(); continue; }
  const page = await ctx.newPage();
  const setLang = async (lang) => {
    await ctx.addCookies([{ name: "erp_lang", value: lang, url: BASE }]);
    await page.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); } catch {} }, lang);
  };
  const shot = async (name) => { await page.waitForTimeout(2500); await page.screenshot({ path: path.join(DIR, `${key}-${name}.png`) }); };

  await setLang("en");
  const r = await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 120000 }).catch((e) => ({ status: () => String(e).slice(0, 80) }));
  const landing = new URL(page.url()).pathname;
  await shot("desktop-en");
  menus[key] = {
    landing,
    status: typeof r?.status === "function" ? r.status() : null,
    menu: await page.$$eval("nav > *", (els) => els.map((e) => (e.innerText || "").split("\n")[0].trim()).filter(Boolean)).catch(() => []),
  };

  await setLang(plan.rtl);
  await page.goto(BASE + landing, { waitUntil: "networkidle", timeout: 120000 }).catch(() => {});
  menus[key].rtlDir = await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction);
  menus[key].rtlLang = plan.rtl;
  await shot(`desktop-${plan.rtl}`);

  if (plan.denied) {
    const d = await page.goto(BASE + plan.denied, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => null);
    menus[key].denied = { url: plan.denied, status: d?.status?.() ?? null };
    await shot(`denied-${plan.rtl}`);
  }

  await setLang("en");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + landing, { waitUntil: "networkidle", timeout: 120000 }).catch(() => {});
  menus[key].mobileOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await shot("mobile-en");
  console.log(key, JSON.stringify(menus[key]));
  await ctx.close();
}
fs.writeFileSync(path.join(DIR, "menus.json"), JSON.stringify(menus, null, 2));
await browser.close();
