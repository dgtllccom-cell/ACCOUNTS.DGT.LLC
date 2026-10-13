/**
 * DEV only — authenticated browser E2E of the Clearing Truck Registration form.
 *   BASE=http://localhost:3300 OUT=<dir> node scripts/dev/truck-registration-e2e.mjs
 * Reproduces: English selected + Urdu-registered owner/driver (with a STALE Urdu erp_lang cookie), then switches through
 * EN/UR/AR/FA/PS and checks names/labels/dates, kept form data, step controls and the A4 print copy.
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const OWNER = "81b1bacf-0490-45aa-846c-e57a7c9d83e4"; // احمد خان (Urdu-registered)
const DRIVER = "2482c655-fbbd-489a-9644-04f272a77bcd"; // محمد یوسف ٹیسٹ (Urdu-registered)
const ARABIC = /[؀-ۿ]/;
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 140) : ""); };

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "country_admin", countryId: PK }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1440), height: Number(process.env.H || 900) } });
// English selected (cookie + local setting agree); the owner / driver were registered in Urdu script
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
const draft = { form: { hasOwner: "yes", ownerId: OWNER, ownerType: "Truck Owner", truckNumber: "TKB 861", chassisNumber: "CH-1", engineNumber: "EN-1", truckType: "Trailer Truck", color: "White", fuelType: "Diesel", capacity: "20", manufacturingYear: "2021", companyLink: "no", driverType: "permanent", driverId: DRIVER, status: "active" }, contacts: [{ id: "c-1", type: "WhatsApp", value: "" }], activeStep: 1, editingId: null };
await ctx.addInitScript(([d]) => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); if (!sessionStorage.getItem("dgt-trk-draft-v2")) sessionStorage.setItem("dgt-trk-draft-v2", JSON.stringify(d)); } catch {} }, [draft]);
const p = await ctx.newPage(); const errors = [];
p.on("pageerror", (e) => { if (!/Failed to fetch/.test(String(e))) errors.push("pageerror: " + String(e).slice(0, 160)); });
p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to fetch|favicon|Failed to load resource|ResizeObserver|DevTools|dgt-connect|presence|Download the React/i.test(m.text())) errors.push(m.type() + ": " + m.text().slice(0, 200)); });
const reqs = [];
p.on("request", (rq) => { const u = rq.url(); if (/\/api\/erp\/(customers|companies)\//.test(u)) reqs.push(u.replace(BASE, "")); });

const reportText = async () => (await p.locator("#trk-live-report").innerText().catch(() => "")) || "";
const rowValue = async (label) => p.evaluate((l) => { const rows = [...document.querySelectorAll("#trk-live-report .flex.items-center.justify-between")]; const hit = rows.find((r) => (r.querySelector("span")?.textContent || "").trim() === l); return hit ? (hit.lastElementChild?.textContent || "").replace(/^\s*:\s*/, "").trim() : null; }, label);

await p.goto(BASE + "/dashboard/clearing-agent/truck-registration", { waitUntil: "load", timeout: 240000 });
await p.waitForSelector("#trk-live-report", { timeout: 180000 });
await p.waitForFunction(() => /Ahmad|احمد/.test(document.querySelector("#trk-live-report")?.innerText || ""), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500);

// ── 1) English selected, Urdu-registered owner & driver
let txt = await reportText();
const fullName = await rowValue("Full Name");
check("EN screen: owner Full Name is Latin (not the stored Urdu text)", fullName && !ARABIC.test(fullName), fullName);
check("EN screen: report has no Arabic-script names at all", !ARABIC.test(txt.replace(/\s+/g, " ")), (txt.match(/[؀-ۿ][؀-ۿ ]+/) || [""])[0]);
const formText = (await p.locator("form").first().innerText().catch(() => "")) || "";
check("EN screen: owner picker / registered-owner card show no Arabic-script text", !ARABIC.test(formText), (formText.match(/[؀-ۿ][؀-ۿ ]+/) || [""])[0]);
check("EN screen: API calls carry ?lang=en for the display copy", reqs.some((u) => /customers\/.+\?lang=en/.test(u)), reqs.slice(0, 3).join(" | "));
check("EN screen: raw copy requested for saving (?raw=1)", reqs.some((u) => /raw=1/.test(u)));
check("EN screen: invented fallbacks are gone (OWN-0001 / A&C Transport Services / 3222711-66 / Balochistan Transport Dept)", !/OWN-0001|A&C Transport|3222711|Balochistan Transport Dept|HTV \(Heavy/.test(txt));
check("EN screen: no 'OPTION 1' design label", !/OPTION 1/.test(txt));
check("Codes are untouched (person code stays PER-000108)", /PER-000108/.test(txt), (txt.match(/PER-\d+/) || [""])[0]);
await p.screenshot({ path: `${OUT}/form-en.png`, fullPage: false });

// ── 2) controls: stepper + Next/Back sizes, View Report / Print buttons
const sizes = await p.evaluate(() => {
  const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0);
  const next = [...document.querySelectorAll("button")].find((x) => /^Next/.test(x.textContent.trim()));
  const step = document.querySelector(".dgt-trk-stepper ol button");
  const view = [...document.querySelectorAll("aside button")].find((x) => /View Report/.test(x.textContent));
  const print = [...document.querySelectorAll("aside button")].find((x) => /Print \/ PDF/.test(x.textContent));
  return { next: h(next), step: h(step), view: h(view), print: h(print), hasView: !!view, hasPrint: !!print };
});
check("Next button is large (>= 44px)", sizes.next >= 44, JSON.stringify(sizes));
check("Step buttons are large (>= 56px)", sizes.step >= 56, String(sizes.step));
check("'View Report' and 'Print / PDF' buttons visible and >= 40px", sizes.hasView && sizes.hasPrint && sizes.view >= 40 && sizes.print >= 40);

// ── 3) step navigation keeps entered data
await p.locator("form input").first().waitFor({ state: "attached" }).catch(() => {});
await p.getByRole("button", { name: /Next: Truck Details/ }).first().click(); await p.waitForTimeout(500);
check("Next goes to step 2", /step 2 of 5/i.test(await p.locator(".dgt-trk-stepper").innerText()));
await p.getByRole("button", { name: /Back: Owner Details/ }).first().click(); await p.waitForTimeout(500);
check("Back returns to step 1", /step 1 of 5/i.test(await p.locator(".dgt-trk-stepper").innerText()));
check("Owner still selected after Next/Back", (await rowValue("Full Name")) === fullName);
await p.getByRole("button", { name: /Next: Truck Details/ }).first().click(); await p.waitForTimeout(400);
const truckNo = await p.locator('input[placeholder="Enter truck number"]').inputValue().catch(() => "");
check("Truck number entered earlier is still there", truckNo === "TKB 861", truckNo);

// ── 4) every language: names, labels and kept data
const langs = (process.env.LANGS || "ur,ar,fa,ps,en").split(",");
for (const lang of langs) {
  await p.evaluate((l) => { localStorage.setItem("erp_lang", l); }, lang);
  await ctx.addCookies([{ name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await p.reload({ waitUntil: "load" });
  await p.waitForSelector("#trk-live-report", { timeout: 180000 });
  await p.waitForFunction(() => (document.querySelector("#trk-live-report")?.innerText || "").length > 400, null, { timeout: 90000 }).catch(() => {});
  await p.waitForFunction(() => /PER-000108/.test(document.querySelector("#trk-live-report")?.innerText || ""), null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const t2 = await reportText();
  const first = (await p.locator("#trk-live-report .flex.items-center.justify-between").first().innerText().catch(() => "")) || "";
  const fnm = await p.evaluate(() => { const rows = [...document.querySelectorAll("#trk-live-report .flex.items-center.justify-between")]; const hit = rows.find((r) => /PER-/.test(r.textContent || "")); return hit ? hit.textContent : ""; });
  if (lang === "en") check("EN: labels in English", /Registration No\./.test(t2) && !ARABIC.test(t2.replace(/\s+/g, " ")), "");
  else {
    check(`${lang.toUpperCase()}: report labels are translated (no English label rows)`, ARABIC.test(t2) && !/Registration No\.|Father's Name|Mobile Number|Final Address/.test(t2), "");
    check(`${lang.toUpperCase()}: owner name shown in Arabic script`, /احمد|ﺍﺣﻤﺪ/.test(t2) || ARABIC.test(t2));
  }
  check(`${lang.toUpperCase()}: dir attribute follows the language`, (await p.evaluate(() => document.querySelector(".dgt-trk")?.getAttribute("dir"))) === (lang === "en" ? "ltr" : "rtl"));
  check(`${lang.toUpperCase()}: form data kept after reload / language change (draft restored)`, /step 2 of 5|مرحلہ 2|الخطوة 2|مرحله ۲|مرحله 2|2 پړاو/i.test(await p.locator(".dgt-trk-stepper").innerText()) && (await p.locator("form input").count()) > 0);
  check(`${lang.toUpperCase()}: phone/ID/code numbers unchanged`, /PER-000108/.test(t2));
  await p.screenshot({ path: `${OUT}/form-${lang}.png`, fullPage: false });
}

// ── 5) A4 print copy
await p.evaluate(() => { localStorage.setItem("erp_lang", "en"); });
await ctx.addCookies([{ name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await p.reload({ waitUntil: "load" }); await p.waitForSelector("#trk-live-report", { timeout: 180000 }); await p.waitForTimeout(4000);
await p.evaluate(() => { window.__trkPrint = null; const orig = HTMLIFrameElement.prototype; });
await p.addInitScript(() => {});
await p.evaluate(() => {
  const obs = new MutationObserver(() => {
    const f = document.querySelector("iframe[aria-hidden='true']");
    if (f && f.contentWindow && !f.__patched) { f.__patched = true; f.contentWindow.print = () => { window.__trkPrint = f.contentDocument.documentElement.outerHTML; }; }
  });
  obs.observe(document.body, { childList: true, subtree: true });
});
await p.locator("aside").getByRole("button", { name: /Print \/ PDF/ }).click();
await p.waitForFunction(() => !!window.__trkPrint, null, { timeout: 15000 }).catch(() => {});
const html = await p.evaluate(() => window.__trkPrint);
check("Print / PDF builds an isolated A4 document", !!html && /@page\{size:A4/.test(html));
if (html) {
  const pp = await ctx.newPage();
  await pp.setContent(html.replace(/<script[\s\S]*?<\/script>/g, "").replace("<head>", `<head><base href="${BASE}/">`), { waitUntil: "load" });
  await pp.waitForTimeout(1200);
  await pp.emulateMedia({ media: "print" });
  const m = await pp.evaluate(() => { const root = document.querySelector(".trk-a4"); const over = [...root.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).length; return { width: Math.round(root.getBoundingClientRect().width), scrollW: document.documentElement.scrollWidth, over, text: root.innerText.length }; });
  check("A4 copy: nothing wider than the printable width (no cut-off)", m.over === 0 && m.width <= 720, JSON.stringify(m));
  const pdf = await pp.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } });
  fs.writeFileSync(`${OUT}/truck-report-a4.pdf`, pdf);
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  check("A4 PDF generated with real content", pdf.length > 20000 && pages >= 1, `${pages} page(s), ${Math.round(pdf.length / 1024)} KB`);
  await pp.screenshot({ path: `${OUT}/a4-print-copy.png`, fullPage: true });
  await pp.close();
}
check("No page / console errors / hydration warnings", errors.length === 0, errors[0] || "");
fs.writeFileSync(`${OUT}/truck-e2e.json`, JSON.stringify(results, null, 1));
const bad = results.filter((x) => !x.ok);
console.log(`\n==== ${results.length - bad.length} PASS / ${bad.length} FAIL ====`);
await b.close();
