// DEV only, read-only: final verification of the two Shipping Line work cards on the rc2 build.
//  1. the Main Menu "Shipping Lines" link opens /dashboard/shipping-line (no 404), and
//  2. BL Entry loads its goods from the Goods Master (/api/erp/goods), shows no invented sample values, and follows the language.
// EN/UR/AR/FA/PS × phone (390) and desktop (1440).   node scripts/dev/shipping-line-bl-entry-e2e.mjs [--base http://localhost:3521]
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3521");
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const INVENTED = ["BL-871867", "ISS-871867", "ABC-123", "S-5542", "22 Wheeler", "Pending Data", "Not Assigned", "Grade A (99.1%)", "5.2 %", "STEP 3 - Goods Entry"];
const GOODS_STEP = { en: "3) Goods Entry", ur: "٣) مال اندراج", ar: "٣) إدخال البضائع", fa: "۳) ثبت کالا", ps: "۳) د توکو ننوت" };
const NEW_ENTRY = { en: "New B/L Entry", ur: "نئی بی/ایل انٹری", ar: "إدخال بوليصة شحن جديد", fa: "ورودی بارنامه جدید", ps: "نوی B/L ننوتل" };

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session="))?.slice(12);
if (!token) throw new Error("no dev session");
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` · ${String(detail).slice(0, 160)}` : ""}`); };
const browser = await chromium.launch();

for (const width of [390, 1440]) for (const lang of LANGS) {
  const mobile = width < 800;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
  const tag = `[${lang} ${width}px]`;
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
  try {
    // 1. Shipping Line menu destination
    const res = await p.goto(BASE + "/dashboard/shipping-line", { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    const sl = await p.evaluate(() => ({
      notFound: /This page could not be found|404/.test(document.title + " " + document.body.innerText.slice(0, 400)),
      dir: document.documentElement.dir,
      menuLink: Boolean(document.querySelector("a[href='/dashboard/shipping-line']"))
    }));
    check(`${tag} Shipping Lines page opens (no 404)`, res?.status() === 200 && !sl.notFound, `HTTP ${res?.status()}`);
    check(`${tag} Shipping Lines page direction`, sl.dir === (lang === "en" ? "ltr" : "rtl"), sl.dir);
    if (!mobile) check(`${tag} Main Menu carries the Shipping Lines link`, sl.menuLink);

    // 2. BL Entry
    const goodsCalls = [];
    p.on("response", (resp) => { if (resp.url().includes("/api/erp/goods?")) goodsCalls.push(resp.status()); });
    const res2 = await p.goto(BASE + "/dashboard/shipping-line/bl-entry", { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
    await p.waitForTimeout(2500);
    // the page opens on the B/L register: start a new entry, then open the goods step (its labels are in the viewer's language)
    await p.getByText(NEW_ENTRY[lang], { exact: false }).first().click({ timeout: 15000 });
    await p.waitForTimeout(2500);
    const step3 = p.getByText(GOODS_STEP[lang], { exact: false }).first();
    if (await step3.count()) await step3.click({ timeout: 5000 }).catch(() => {});
    await p.waitForResponse((resp) => resp.url().includes("/api/erp/goods?"), { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1500);
    check(`${tag} BL Entry goods step heading follows the language`, await p.getByText(GOODS_STEP[lang], { exact: false }).count() > 0, GOODS_STEP[lang]);
    const bl = await p.evaluate((invented) => {
      const text = document.body.innerText;
      return {
        invented: invented.filter((s) => text.includes(s)),
        dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        error: /Application error|Unhandled Runtime Error|could not be found/.test(text)
      };
    }, INVENTED);
    check(`${tag} BL Entry opens`, res2?.status() === 200 && !bl.error, `HTTP ${res2?.status()}`);
    check(`${tag} BL Entry goods come from the Goods Master (/api/erp/goods)`, goodsCalls.some((s) => s === 200), `responses ${JSON.stringify(goodsCalls)}`);
    check(`${tag} BL Entry shows no invented sample values`, bl.invented.length === 0, bl.invented.join(", "));
    check(`${tag} BL Entry direction`, bl.dir === (lang === "en" ? "ltr" : "rtl"), bl.dir);
    check(`${tag} BL Entry no sideways page scroll`, bl.overflow <= 2, `${bl.overflow}px`);
    check(`${tag} no page errors`, errors.length === 0, errors[0]);
    await p.screenshot({ path: `.tmp/bl-entry-${lang}-${width}.png` });
  } catch (e) {
    check(`${tag} loads`, false, String(e.message).split("\n")[0]);
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - failed} PASS / ${failed} FAIL ====`);
process.exit(failed ? 1 : 0);
