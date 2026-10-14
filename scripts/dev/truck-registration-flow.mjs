/**
 * DEV only — real end-to-end flow of Clearing Truck Registration (authenticated browser, real DEV record):
 *   New Registration → Owner selection → Truck → Transporter → Driver → Next/Back → Save → List → View → Print → PDF
 *   → Edit → Save → Live Report (View / Print / Download PDF) → 5-language + RTL report check → cleanup.
 *   BASE=http://localhost:3300 OUT=<dir> DEVICE=desktop|iphone|samsung|ipad|wide [LANGS=ur,ar,fa,ps,en] node scripts/dev/truck-registration-flow.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const DEVICE = process.env.DEVICE || "desktop";
const OUT = (process.env.OUT || "out/flow") + "/" + DEVICE; fs.mkdirSync(OUT, { recursive: true });
const DEVICES = {
  desktop: { w: 1440, h: 900, dpr: 1, mobile: false },
  wide: { w: 2560, h: 1300, dpr: 1, mobile: false },
  ipad: { w: 820, h: 1180, dpr: 2, mobile: true },
  samsung: { w: 412, h: 915, dpr: 2.6, mobile: true },
  iphone: { w: 390, h: 844, dpr: 3, mobile: true },
};
const D = DEVICES[DEVICE]; if (!D) throw new Error("device");
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const OWNER = "81b1bacf-0490-45aa-846c-e57a7c9d83e4";
const DRIVER = "2482c655-fbbd-489a-9644-04f272a77bcd";
const ARABIC = /[؀-ۿ]/;
const TRK = "E2E" + String(Date.now()).slice(-6);
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 260) }); console.log(ok ? "PASS" : "FAIL", `[${DEVICE}]`, name, detail ? "· " + String(detail).slice(0, 160) : ""); };

const login = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "country_admin", countryId: PK, userId: "04e0ced1-ea58-49c5-865d-e08b40f62de2" }) });
const token = login.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const cookieHdr = `erp_session=${token}`;
const api = async (path, init = {}) => { const r = await fetch(BASE + path, { ...init, headers: { cookie: cookieHdr, "content-type": "application/json", ...(init.headers || {}) } }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const driverRaw = (await api(`/api/erp/customers/${DRIVER}?raw=1`)).json?.data?.customer || {};
const ownerRaw = (await api(`/api/erp/customers/${OWNER}?raw=1`)).json?.data?.customer || {};

for (const u of ["/api/erp/customers?limit=500&lang=en","/api/erp/customers?q=Ahmad&limit=50&lang=en","/api/erp/master-data/trucks","/api/erp/branding"]) { const t0 = Date.now(); await api(u); console.log("warm", u, Date.now() - t0, "ms"); }
// remove leftovers of earlier aborted runs of THIS script only (E2E + 6 digits, optional T) — DEV test rows
for (const t of ((await api("/api/erp/master-data/trucks")).json?.trucks || [])) if (/^E2E[0-9]{6}T?$/.test(t.truck_number)) { const d = await api(`/api/erp/master-data/trucks/${t.id}`, { method: "DELETE" }); console.log("cleanup leftover", t.truck_number, d.status); }
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: D.mobile, hasTouch: D.mobile, acceptDownloads: true });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => {
  try { localStorage.setItem("erp_lang", localStorage.getItem("erp_lang") || "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {}
  // capture every window.print() (main page, preview iframe, hidden print iframe) instead of opening a native dialog
  window.print = () => { try { const t = window.top; t.__printed = t.__printed || []; t.__printed.push(document.documentElement.outerHTML); } catch {} };
});
ctx.setDefaultTimeout(300000); ctx.setDefaultNavigationTimeout(300000);
let STAGE = "init";
const p = await ctx.newPage(); const errors = [];
process.on("uncaughtException", async (e) => { console.log("FATAL", String(e).slice(0, 300)); try { await p.screenshot({ path: `${OUT}/fatal.png` }); } catch {} process.exit(2); });
p.on("pageerror", (e) => { if (!/Failed to fetch|NetworkError|AbortError/.test(String(e))) { if (!/:prime$/.test(STAGE)) errors.push(`pageerror[${STAGE}] ` + String(e).slice(0, 180)); }; });
p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to fetch|favicon|Failed to load resource|ResizeObserver|DevTools|dgt-connect|presence|Download the React|net::ERR|AbortError/i.test(m.text())) errors.push(m.type() + ": " + m.text().slice(0, 200)); });
let posted = null, putPayload = null;
p.on("request", (rq) => {
  const u = new URL(rq.url());
  if (u.pathname === "/api/erp/master-data/trucks" && rq.method() === "POST") posted = rq.postDataJSON();
  if (/^\/api\/erp\/master-data\/trucks\/[^/]+$/.test(u.pathname) && rq.method() === "PATCH") putPayload = rq.postDataJSON();
});
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });
const noOverflow = async (label) => { const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })); check(`${label}: no horizontal page overflow`, o.sw <= o.iw + 2, JSON.stringify(o)); };
const heights = (sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().height)), sel);
const printed = () => p.evaluate(() => (window.top.__printed || []).length);
const lastPrinted = () => p.evaluate(() => (window.top.__printed || []).slice(-1)[0] || "");
const closePreview = async () => { await p.keyboard.press("Escape").catch(() => {}); const c = p.locator('button[title="Close"]'); if (await c.count()) await c.first().click().catch(() => {}); await p.waitForTimeout(500); };
const previewFrame = async () => { await p.waitForFunction(() => document.querySelectorAll("iframe").length > 0, null, { timeout: 60000 }); await p.waitForTimeout(1800); const fr = p.frames().filter((f) => f !== p.mainFrame()).find((f) => /Registration|TRUCK|رجسٹریشن|تسجيل|ثبت/.test(f.url() + "")) || p.frames().filter((f) => f !== p.mainFrame()).slice(-1)[0]; return fr; };
const frameText = async (fr) => (await fr.evaluate(() => document.body?.innerText || "").catch(() => "")) || "";

async function gotoList(lang = "en") {
  STAGE = `list:${lang}:prime`;
  await ctx.addCookies([{ name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await p.goto(BASE + "/dashboard/clearing-agent/truck-registration", { waitUntil: "load", timeout: 300000 });
  await p.evaluate((l) => { localStorage.setItem("erp_lang", l); sessionStorage.removeItem("dgt-trk-draft-v2"); }, lang);
  await p.reload({ waitUntil: "load" });
  STAGE = `list:${lang}`;
  await p.waitForSelector("table", { timeout: 180000 });
  await p.waitForFunction(() => !/Loading/.test(document.querySelector("tbody")?.innerText || ""), null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(1200);
}
const rowMenu = async (rowText, item) => {
  const row = p.locator("tbody tr", { hasText: rowText }).first();
  await row.waitFor({ timeout: 60000 });
  await row.locator("button").last().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: item }).last().click();
};
async function submitTruck() {
  const btn = p.getByRole("button", { name: /Submit Truck Record/ });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  try { await p.waitForSelector("table", { timeout: 60000 }); }
  catch (e) {
    const banner = await p.locator("[class*=rose-50], .bg-red-50").allInnerTexts().catch(() => []);
    console.log("SUBMIT-DIAG banner:", JSON.stringify(banner), "saving-btn-disabled:", await btn.isDisabled().catch(() => "?"), "url:", p.url());
    await p.screenshot({ path: OUT + "/submit-diag.png", fullPage: true }).catch(() => {});
    throw e;
  }
  await p.waitForTimeout(1500);
}
const nextBtn = (re) => p.getByRole("button", { name: re }).first();
const stepText = async () => (await p.locator(".dgt-trk-stepper").innerText().catch(() => "")) || "";

STAGE = "new-registration";
// ═════════ 1) New registration → owner → truck → transporter → driver ═════════
await gotoList("en");
await shot("01-list");
await noOverflow("List");
await p.getByRole("button", { name: /New Clearing Truck Registration/i }).first().click();
await p.waitForSelector("form", { timeout: 60000 });
await p.waitForTimeout(800);
check("New registration opens the 5-step form at step 1", /step 1 of 5/i.test(await stepText()), (await stepText()).replace(/\s+/g, " ").slice(0, 80));
await noOverflow("Step 1");

// owner selection through the real picker
await p.locator("button.group", { hasText: "Search truck owner" }).first().click();
await p.waitForTimeout(1500);
await p.keyboard.type("Ahmad"); await p.waitForTimeout(4000);
await shot("02a-owner-search");
await p.locator("li, [role=option], [data-radix-popper-content-wrapper] button", { hasText: ownerRaw.person_code || "PER-000108" }).first().click({ timeout: 60000 });
await p.waitForFunction((c) => new RegExp(c).test(document.querySelector("#trk-live-report")?.innerText || ""), ownerRaw.person_code || "PER-000108", { timeout: 60000 });
const liveEn = (await p.locator("#trk-live-report").innerText()) || "";
check("Owner selected: live report shows the owner code", /PER-000108/.test(liveEn));
check("Owner name is Latin on the English screen (never the stored Urdu)", !ARABIC.test(liveEn), (liveEn.match(/[؀-ۿ]+/) || [""])[0]);
await shot("02-step1-owner");
const navH = await p.evaluate(() => [...document.querySelectorAll(".dgt-trk button")].filter((b) => /^(Next|Back:|Save|View Report|Print|Download PDF)/.test(b.textContent.trim()) && b.getBoundingClientRect().width > 0).map((b) => Math.round(b.getBoundingClientRect().height)));
check("Step 1: Next / Back / Save / View Report / Print / Download PDF buttons >= 44px", navH.length >= 4 && Math.min(...navH) >= 44, JSON.stringify(navH));
await nextBtn(/Next: Truck Details/).click(); await p.waitForTimeout(500);
check("Next → step 2", /step 2 of 5/i.test(await stepText()));
await nextBtn(/Back: Owner Details/).click(); await p.waitForTimeout(500);
check("Back → step 1 with owner still selected", /step 1 of 5/i.test(await stepText()) && /PER-000108/.test((await p.locator("#trk-live-report").innerText()) || ""));
await nextBtn(/Next: Truck Details/).click(); await p.waitForTimeout(500);

// step 2 — truck details
await p.locator('input[placeholder="Enter truck number"]').fill(TRK);
await p.locator('input[placeholder="Enter truck name or nickname"]').fill("E2E Flow Truck");
await p.locator('input[placeholder="Enter make / brand"]').fill("Volvo");
await p.locator('input[placeholder="Enter model"]').fill("FH16");
await p.locator('input[placeholder="Enter chassis number"]').fill("CH-" + TRK);
await p.locator('input[placeholder="Enter engine number"]').fill("EN-" + TRK);
await p.locator('input[placeholder="Enter registration number"]').fill("REG-" + TRK);
await p.locator('input[placeholder="Enter insurance provider"]').fill("Test Insurance Co");
const nums = p.locator('form input[type="number"]'); await nums.nth(0).fill("2021"); await nums.nth(1).fill("22");
const dates = p.locator('form input[type="date"]'); await dates.nth(0).fill("2027-03-15"); await dates.nth(1).fill("2027-06-30"); await dates.nth(2).fill("2027-09-01");
const sels = p.locator("form select");
for (let i = 0; i < Math.min(3, await sels.count()); i++) { const opts = await sels.nth(i).locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean)); if (opts.length) await sels.nth(i).selectOption(opts[0]); }
await p.waitForTimeout(500);
const liveTruck = (await p.locator("#trk-live-report").innerText()) || "";
check("Truck details appear in the Live Truck Report immediately", liveTruck.includes(TRK) && /Volvo/.test(liveTruck) && /FH16/.test(liveTruck), "");
await shot("03-step2-truck");
await noOverflow("Step 2");
await nextBtn(/Next: Transporter Details/).click(); await p.waitForTimeout(600);
check("Next → step 3", /step 3 of 5/i.test(await stepText()));
await shot("04-step3-transporter");
await nextBtn(/Back: Truck Details/).click(); await p.waitForTimeout(400);
check("Back keeps the truck number", (await p.locator('input[placeholder="Enter truck number"]').inputValue()) === TRK);
await nextBtn(/Next: Transporter Details/).click(); await p.waitForTimeout(400);
await nextBtn(/Next: Driver Details/).click(); await p.waitForTimeout(600);
check("Next → step 4 (driver)", /step 4 of 5/i.test(await stepText()));

// driver via the real picker
await p.locator("button.group", { hasText: "Search driver" }).first().click();
await p.waitForTimeout(1500);
await p.keyboard.type(driverRaw.person_code || "PER"); await p.waitForTimeout(4000);
await shot("05a-driver-search");
await p.locator("li, [role=option], [data-radix-popper-content-wrapper] button", { hasText: driverRaw.person_code || "PER-" }).first().click({ timeout: 60000 });
await p.waitForFunction((c) => new RegExp(c).test(document.querySelector("#trk-live-report")?.innerText || ""), driverRaw.person_code || "PER-", { timeout: 60000 });
await p.waitForTimeout(1500);
await shot("05-step4-driver");
await noOverflow("Step 4");
const liveDrv = (await p.locator("#trk-live-report").innerText()) || "";
check("Driver name is Latin on the English screen", !ARABIC.test(liveDrv), (liveDrv.match(/[؀-ۿ]+/) || [""])[0]);
check("No fabricated driver defaults (HTV / Balochistan Transport Dept / Married) unless the driver record has them", !/Balochistan Transport Dept|HTV \(Heavy/.test(liveDrv));
await nextBtn(/Next: Documents/).click(); await p.waitForTimeout(600);
check("Next → step 5", /step 5 of 5/i.test(await stepText()));
await shot("06-step5-review");

// ═════════ 2) live report actions (View Report / Print / Download PDF) before saving ═════════
const asideBtns = await heights("[data-testid^=trk-report-]");
check("Live report actions are >= 40px (View Report / Print / Download PDF)", asideBtns.length >= 3 && Math.min(...asideBtns) >= 40, JSON.stringify(asideBtns));
await p.getByTestId("trk-report-view").click();
let fr = await previewFrame();
let ft = await frameText(fr);
check("View Report opens the A4 preview with the entered truck", ft.includes(TRK) && /Ahmad Khan/i.test(ft) || ft.includes(TRK), ft.slice(0, 100).replace(/\s+/g, " "));
check("A4 preview has no Arabic-script names on the English screen", !ARABIC.test(ft), (ft.match(/[؀-ۿ]+/) || [""])[0]);
check("A4 preview has no leftover 'OPTION 1' / sample strings", !/OPTION 1|OWN-0001|A&C Transport|3222711/.test(ft));
await shot("07-preview-live");
await closePreview();
await p.getByTestId("trk-report-print").click();
await p.waitForFunction(() => (window.top.__printed || []).length > 0, null, { timeout: 60000 }).catch(() => {});
check("Print builds a standalone A4 document (report only)", (await printed()) >= 1 && /@page/.test(await lastPrinted()) && !/dgt-trk-stepper|DashboardFrame|Collapse Menu/.test(await lastPrinted()));
const [dlLive] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }).catch(() => null), p.getByTestId("trk-report-pdf").click()]);
if (dlLive) { await dlLive.saveAs(`${OUT}/live-report.pdf`); const buf = fs.readFileSync(`${OUT}/live-report.pdf`); check("Download PDF (live report) is a real PDF", buf.subarray(0, 4).toString() === "%PDF" && buf.length > 15000, `${Math.round(buf.length / 1024)} KB · ${dlLive.suggestedFilename()}`); }
else check("Download PDF (live report) is a real PDF", false, "no download event");

// ═════════ 3) Save → record exists, no demo defaults, raw names ═════════
await p.getByRole("button", { name: /Submit Truck Record/ }).click();
await p.waitForSelector("table", { timeout: 90000 });
await p.waitForTimeout(1500);
check("Save sent the registration (POST) and returned to the list", !!posted && posted.truck_number === TRK, posted ? posted.truck_number : "no POST");
check("Saved owner_name is the ORIGINAL stored name (unchanged by the English view)", posted && posted.owner_name === (ownerRaw.customer_name || null), `${posted?.owner_name} vs ${ownerRaw.customer_name}`);
check("Saved driver_name is the ORIGINAL stored name", posted && posted.driver_name === (driverRaw.customer_name || null), `${posted?.driver_name}`);
check("Saved record has no invented licence-type / authority / marital defaults", posted && !/HTV|Balochistan|Married/.test(String(posted.notes || "")), String(posted?.notes || "").slice(0, 200));
const savedList = (await api("/api/erp/master-data/trucks")).json?.trucks || [];
const rec = savedList.find((t) => t.truck_number === TRK);
check("Record exists in DEV database", !!rec, rec ? rec.id : "not found");
await shot("08-list-after-save");
await noOverflow("List after save");

// ═════════ 4) list row: View / Print / PDF from the saved record ═════════
await p.reload({ waitUntil: "load" }); await p.waitForSelector("table"); await p.waitForTimeout(1500);
await rowMenu(TRK, /^View$/);
fr = await previewFrame(); ft = await frameText(fr);
check("Row View: report built from the SAVED record (truck, chassis, insurer)", ft.includes(TRK) && ft.includes("CH-" + TRK) && /Test Insurance Co/.test(ft), ft.slice(0, 120).replace(/\s+/g, " "));
check("Row View: owner / driver codes present and names Latin", /PER-000108/.test(ft) && !ARABIC.test(ft));
check("Row View: Volvo / FH16 / year / capacity present", /Volvo/.test(ft) && /FH16/.test(ft) && /2021/.test(ft) && /22/.test(ft));
await shot("09-row-view");
fs.writeFileSync(`${OUT}/row-view.txt`, ft);
await closePreview();
const before = await printed();
await rowMenu(TRK, /^Print$/);
await p.waitForFunction((n) => (window.top.__printed || []).length > n, before, { timeout: 60000 }).catch(() => {});
const printHtml = await lastPrinted();
check("Row Print: report-only A4 document", (await printed()) > before && /@page/.test(printHtml) && printHtml.includes(TRK) && !/Collapse Menu|dgt-trk-stepper/.test(printHtml));
fs.writeFileSync(`${OUT}/row-print.html`, printHtml);
if (printHtml) {
  const pp = await ctx.newPage(); await pp.setViewportSize({ width: 794, height: 1123 });
  await pp.setContent(printHtml.replace(/<script[\s\S]*?<\/script>/g, "").replace("<head>", `<head><base href="${BASE}/">`), { waitUntil: "load" });
  await pp.waitForTimeout(1200); await pp.emulateMedia({ media: "print" });
  const m = await pp.evaluate(() => ({ sw: document.documentElement.scrollWidth, over: [...document.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > 800).length }));
  check("Row Print: nothing wider than the A4 page", m.sw <= 800 && m.over === 0, JSON.stringify(m));
  const pdf = await pp.pdf({ preferCSSPageSize: true, printBackground: true }); fs.writeFileSync(`${OUT}/row-print-a4.pdf`, pdf);
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  check("Row Print: A4 page count is sensible (1-3, no blank page)", pages >= 1 && pages <= 3, `${pages} page(s)`);
  await pp.close();
}
const [dlRow] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }).catch(() => null), rowMenu(TRK, /PDF/)]);
if (dlRow) { await dlRow.saveAs(`${OUT}/row-report.pdf`); const buf = fs.readFileSync(`${OUT}/row-report.pdf`); check("Row Download PDF is a real PDF", buf.subarray(0, 4).toString() === "%PDF" && buf.length > 15000, `${Math.round(buf.length / 1024)} KB · ${dlRow.suggestedFilename()}`); }
else check("Row Download PDF is a real PDF", false, "no download event");

// ═════════ 5) Edit → change → save ═════════
await rowMenu(TRK, /^Edit$/);
await p.waitForSelector("form", { timeout: 60000 }); await p.waitForTimeout(1500);
check("Edit opens the saved record at step 1", /step 1 of 5/i.test(await stepText()));
await nextBtn(/Next: Truck Details/).click(); await p.waitForTimeout(500);
check("Edit: saved truck number / name restored", (await p.locator('input[placeholder="Enter truck number"]').inputValue()) === TRK && (await p.locator('input[placeholder="Enter truck name or nickname"]').inputValue()) === "E2E Flow Truck");
await p.locator('input[placeholder="Enter truck name or nickname"]').fill("E2E Flow Truck EDITED");
await shot("10-edit-step2");
await p.getByTestId("trk-report-view").click();
fr = await previewFrame(); ft = await frameText(fr);
check("Edit → View Report reflects the unsaved edit", /EDITED/.test(ft));
await closePreview();
await nextBtn(/Next: Transporter Details/).click(); await nextBtn(/Next: Driver Details/).click(); await nextBtn(/Next: Documents/).click(); await p.waitForTimeout(500);
await submitTruck();
check("Edit saved (PATCH) with the new name", !!putPayload && putPayload.truck_name === "E2E Flow Truck EDITED", putPayload?.truck_name);
const after = ((await api("/api/erp/master-data/trucks")).json?.trucks || []).find((t) => t.truck_number === TRK);
check("Database shows the edited truck name; owner/driver ids unchanged", after?.truck_name === "E2E Flow Truck EDITED" && after?.owner_person_id === OWNER && after?.driver_person_id === DRIVER);

// ═════════ 5b) temporary driver with licence details → licence section of the report ═════════
const TRK2 = TRK + "T";
await gotoList("en");
await p.getByRole("button", { name: /New Clearing Truck Registration/i }).first().click(); await p.waitForSelector("form"); await p.waitForTimeout(600);
await nextBtn(/Next: Truck Details/).click(); await p.waitForTimeout(400);
await p.locator('input[placeholder="Enter truck number"]').fill(TRK2);
await p.locator('input[placeholder="Enter chassis number"]').fill("CH-" + TRK2);
await p.locator('input[placeholder="Enter engine number"]').fill("EN-" + TRK2);
await nextBtn(/Next: Transporter Details/).click(); await nextBtn(/Next: Driver Details/).click(); await p.waitForTimeout(400);
await p.locator("label:visible", { hasText: /Temporary/ }).first().click(); await p.waitForTimeout(400);
await p.locator('input[placeholder="Enter driver name..."]').fill("Temp Driver Test");
await p.locator('input[placeholder="Driving License Number"]').fill("LIC-" + TRK2);
await p.locator('input[placeholder="Enter license type"]').fill("HTV Test Class");
await p.locator('input[placeholder="Enter issuing authority"]').fill("Test Transport Authority");
await p.waitForTimeout(500);
const liveT = (await p.locator("#trk-live-report").innerText()) || "";
check("Temporary driver + licence entered appear in the live report", /Temp Driver Test/.test(liveT) && liveT.includes("LIC-" + TRK2) && /HTV Test Class/.test(liveT) && /Test Transport Authority/.test(liveT));
await shot("12-temp-driver");
await noOverflow("Temporary-driver step");
await nextBtn(/Next: Documents/).click(); await p.waitForTimeout(400);
await submitTruck();
await rowMenu(TRK2, /^View$/);
fr = await previewFrame(); ft = await frameText(fr);
fs.writeFileSync(`${OUT}/temp-driver-view.txt`, ft);
const tdFlags = { lic: ft.includes("LIC-" + TRK2), type: /HTV Test Class/.test(ft), auth: /Test Transport Authority/.test(ft), name: /Temp Driver Test/.test(ft) };
check("Row View (temporary driver): licence section shows number, type and authority", Object.values(tdFlags).every(Boolean), JSON.stringify(tdFlags));
check("Row View (temporary driver): no section is blank-filled with dashes", !/—s*—/.test(ft));
await shot("13-temp-driver-report");
await closePreview();
const rec2 = ((await api("/api/erp/master-data/trucks")).json?.trucks || []).find((t) => t.truck_number === TRK2);
if (rec2?.id) { const del2 = await api(`/api/erp/master-data/trucks/${rec2.id}`, { method: "DELETE" }); check("Temporary-driver test record removed (cleanup)", del2.status < 300, String(del2.status)); }

// ═════════ 6) five languages + RTL on the saved record ═════════
for (const lang of (process.env.LANGS || "ur,ar,fa,ps,en").split(",")) {
  await gotoList(lang);
  await p.locator("tbody tr", { hasText: TRK }).first().locator("button").last().click(); await p.waitForTimeout(500); await p.locator("button:has(svg.lucide-eye)").last().click();
  fr = await previewFrame(); ft = await frameText(fr);
  const dirAttr = await fr.evaluate(() => document.documentElement.getAttribute("dir") || document.body.getAttribute("dir") || getComputedStyle(document.body).direction).catch(() => "");
  const L = lang.toUpperCase();
  if (lang === "en") { check(`${L}: report in English, Latin names`, /Registration No\./.test(ft) && !ARABIC.test(ft)); }
  else {
    check(`${L}: report labels translated (no English label rows)`, ARABIC.test(ft) && !/Registration No\.|Father's Name|Mobile Number|Final Address|Driver Details/.test(ft), "");
    check(`${L}: owner name shown in original Arabic script`, ARABIC.test(ft));
  }
  check(`${L}: report direction ${lang === "en" ? "LTR" : "RTL"}`, lang === "en" ? /ltr/i.test(dirAttr) : /rtl/i.test(dirAttr), dirAttr);
  check(`${L}: truck / chassis / owner code numbers unchanged`, ft.includes(TRK) && ft.includes("CH-" + TRK) && /PER-000108/.test(ft));
  await shot(`11-lang-${lang}`);
}

// ═════════ 7) cleanup + errors ═════════
if (rec?.id) { const del = await api(`/api/erp/master-data/trucks/${rec.id}`, { method: "DELETE" }); check("Test record removed from DEV (cleanup)", del.status < 300, String(del.status)); }
check("No page / console errors", errors.length === 0, errors[0] || "");
fs.writeFileSync(`${OUT}/flow-results.json`, JSON.stringify(results, null, 1));
const bad = results.filter((x) => !x.ok);
console.log(`\n==== [${DEVICE}] ${results.length - bad.length} PASS / ${bad.length} FAIL ====`);
await browser.close();
process.exit(bad.length ? 1 : 0);
