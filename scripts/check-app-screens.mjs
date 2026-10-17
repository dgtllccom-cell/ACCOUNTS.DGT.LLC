/**
 * DGT.llc B / BS — store-app screen check in a browser that sends the apps' exact User-Agent tags (DEV ONLY).
 * NOT the real app: it proves the web screens the apps load (activation, login, wrong-app) in 5 languages on phone/tablet sizes:
 * no horizontal page scroll, RTL flips for ur/ar/fa/ps, and the stub biometric button is hidden inside the apps but still shown on the web.
 *   BASE=http://127.0.0.1:3520 node scripts/check-app-screens.mjs [outDir]
 */
import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import postgres from "postgres";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3520";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.argv[2] || "mobile-builds-screens";
fs.mkdirSync(OUT, { recursive: true });
// a store app only reaches /auth/login from an ACTIVE device (otherwise it is sent to /auth/device) — use a DEV device row, removed at the end
const envVal = (k) => process.env[k] || fs.readFileSync(".env.local", "utf8").match(new RegExp("^" + k + "\s*=\s*(.+)$", "m"))?.[1].trim().replace(/^['"]|['"]$/g, "");
const DB_URL = envVal("DATABASE_URL");
if (!/csesvyxxjivnkkozgopt/.test(DB_URL)) { console.error("REFUSING: DATABASE_URL is not the DEV project"); process.exit(2); }
const SECRET = envVal("ERP_SESSION_SECRET") || envVal("AUTH_SECRET") || envVal("NEXTAUTH_SECRET");
const sql = postgres(DB_URL, { max: 1, prepare: false, ssl: "require" });
const deviceIds = [];
async function deviceCookieValue() {
  const id = (await sql`insert into mobile_devices (app, requested_name, requested_identifier, request_note, status, activated_at) values ('b', 'e2e app-screens', 'e2e-app-screens@dev.local', 'check-app-screens', 'active', now()) returning id`)[0].id;
  deviceIds.push(id);
  return `${id}.${createHmac("sha256", SECRET).update("device:" + id).digest("base64url")}`;
}
const UA = (tag) => `Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36${tag ? " " + tag : ""}`;
const LANGS = ["en", "ur", "ps", "fa", "ar"];
const SIZES = { phone360x800: { width: 360, height: 800 }, tablet800x1280: { width: 800, height: 1280 } };
const PAGES = [["login", "/auth/login"], ["device", "/auth/device"], ["app-access", "/auth/app-access?app=bs"]];
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`); };

const browser = await chromium.launch();
async function open(tag, size, lang, withDevice = false) {
  const ctx = await browser.newContext({ userAgent: UA(tag), viewport: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); } catch {} }, lang);
  const cookies = [{ name: "erp_lang", value: lang, url: BASE }];
  if (withDevice && tag) cookies.push({ name: "dgt_device", value: await deviceCookieValue(), url: BASE });
  await ctx.addCookies(cookies);
  return ctx;
}
for (const [sizeName, size] of Object.entries(SIZES)) {
  for (const lang of LANGS) {
    for (const [pageName, url] of PAGES) {
      const ctx = await open("DGTllc-B/1", size, lang, pageName === "login");
      const page = await ctx.newPage();
      try {
        const resp = await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 240000 });
        // dev-mode hydration is slow: wait for real content, then for client effects (the biometric hide runs in useEffect)
        await page.waitForFunction(() => document.body.innerText.length > 20, null, { timeout: 120000 }).catch(() => {});
        await page.waitForTimeout(6000);
        const m = await page.evaluate(() => ({
          dir: document.documentElement.dir || document.body.getAttribute("dir") || (document.querySelector("[dir]")?.getAttribute("dir") ?? ""),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bio: [...document.querySelectorAll("button")].some((b) => b.querySelector("svg.lucide-fingerprint") && !b.closest("[role=dialog]")),
          text: document.body.innerText.length,
          url: location.pathname,
          signIn: [...document.querySelectorAll("button")].some((b) => b.querySelector("svg.lucide-shield-check")),
        }));
        const rtl = lang !== "en";
        const tag = `${sizeName} ${lang} ${pageName}`;
        check(`${tag}: loads (${resp?.status()})`, !!resp && resp.status() < 400 && m.text > 20);
        check(`${tag}: no horizontal page scroll (${m.overflow}px)`, m.overflow <= 1);
        if (pageName === "login") {
          check(`${tag}: login form shown (not the activation gate)`, m.url.includes("/auth/login") && m.signIn);
          check(`${tag}: stub biometric button hidden inside the app`, !m.bio);
          check(`${tag}: ${rtl ? "RTL" : "LTR"} direction (${m.dir || "none"})`, rtl ? m.dir === "rtl" : m.dir !== "rtl");
        }
        if (lang === "en" || lang === "ur") await page.screenshot({ path: path.join(OUT, `${sizeName}-${lang}-${pageName}.png`) });
      } catch (e) { check(`${sizeName} ${lang} ${pageName}: ran`, false, String(e).slice(0, 120)); }
      await ctx.close();
    }
  }
}
// control: the same login page in a plain browser (no app tag) still offers the biometric button
{
  const ctx = await open("", SIZES.phone360x800, "en");
  const page = await ctx.newPage();
  await page.goto(BASE + "/auth/login", { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => document.body.innerText.length > 20, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const bio = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.querySelector("svg.lucide-fingerprint")));
  check("control: plain browser (no app tag) still shows the biometric button (web unchanged)", bio);
  await ctx.close();
}
await browser.close();
if (deviceIds.length) await sql`delete from mobile_device_events where device_id = any(${deviceIds}::uuid[])`.catch(() => {});
if (deviceIds.length) await sql`delete from mobile_devices where id = any(${deviceIds}::uuid[])`.catch(() => {});
await sql.end({ timeout: 2 }).catch(() => {});
const pass = results.filter(Boolean).length;
console.log(`\n==== ${pass} PASS / ${results.length - pass} FAIL ====`);
process.exit(pass === results.length ? 0 : 1);
