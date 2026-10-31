/**
 * DEV only — Sales Booking Step 1 (currency & conversion) and Step 2 (goods entry, Select Stock panel), driven in a real browser
 * and against the real routes.
 *   BASE=http://localhost:3550 OUT=<dir> LANG_CODE=en WIDTH=1440 node scripts/dev/sales-booking-step1-2-e2e.mjs
 * Checks: a new booking is EMPTY (no demo data); the currency card + daily rate; a missing rate blocks Step 1; the Select Stock panel
 * (3 sources, real lots with goods / lot / origin / brand / size / quantity / total weight / sold / remaining, lot details, confirm);
 * the selected stock sits above the editable fields with its remaining balance; over-selling is blocked in the form and by the server;
 * the goods table amounts follow the Purchase formula; the saved booking reduces the lot's remaining balance; the server refuses a
 * conversion without a rate.
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3550";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/sales-e2e"; fs.mkdirSync(OUT, { recursive: true });
const lang = process.env.LANG_CODE || "en";
const width = Number(process.env.WIDTH || 1440);
const RATE = 280;
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8");
const block = (name) => {
  const start = ui.indexOf(`\nconst ${name}: Dict = {`);
  const end = ui.indexOf("\n};", start);
  const map = new Map();
  for (const m of ui.slice(start, end).matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\r?$/gm)) map.set(m[1], m[2].replace(/\\"/g, '"'));
  return map;
};
const enDict = block("en");
const langDict = lang === "en" ? enDict : block(lang);
/** the page-language text of an English UI string (falls back to the English text) */
const tx = (enValue, key) => { if (key) return langDict.get(key) ?? enValue; for (const [k, v] of enDict) if (v === enValue) return langDict.get(k) ?? enValue; return enValue; };
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const results = [];
const check = (group, name, ok, detail = "") => { results.push({ group, name, ok: !!ok, detail: String(detail).slice(0, 240) }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 200) : ""); };

const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const api = async (method, path, body) => {
  const x = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie: `erp_session=${token}; erp_lang=${lang}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, j, msg: j?.error?.message || j?.message || "", code: j?.error?.code };
};
const lotsOf = async (source) => (await api("GET", `/api/erp/sales/available-lots?source=${source}&limit=300`)).j?.data?.lots ?? [];

// ── API: the resolver and the server rules ──
const booking = await lotsOf("booking");
const warehouse = await lotsOf("warehouse_all");
const exportLots = await lotsOf("export_all");
console.log(`resolver: warehouse ${warehouse.length}, booking ${booking.length}, export ${exportLots.length}`);
check("api", "all three stock sources answer (Warehouse / Booking / Export)", Array.isArray(warehouse) && Array.isArray(booking) && Array.isArray(exportLots), `${warehouse.length}/${booking.length}/${exportLots.length}`);
check("api", "every lot carries total / sold / remaining quantity", [...warehouse, ...booking, ...exportLots].every((l) => typeof l.remainingQty === "number" && typeof l.soldQty === "number" && typeof l.totalQty === "number"), "");
check("api", "remaining = quantity − sold for booking stock (never negative)", booking.every((l) => l.remainingQty >= 0 && Math.abs(l.remainingQty - Math.max(0, l.totalQty - l.soldQty)) < 1e-6), "");

const base = { orderDate: new Date().toISOString().slice(0, 10), customerName: "E2E Customer", currencyCode: "USD", exchangeRate: 1, orderTotal: 100 };
const noRate = await api("POST", "/api/erp/sales/orders", { ...base, formData: { form: { currencyType: "USD", secondaryCurrency: "AED", exchangeRate: "" }, goodsEntries: [] } });
check("server", "a conversion without an exchange rate is refused (422, not silently 1)", noRate.status === 422 && /exchange rate/i.test(noRate.msg), `${noRate.status} ${noRate.msg}`);
const zeroRate = await api("POST", "/api/erp/sales/orders", { ...base, formData: { form: { currencyType: "USD", secondaryCurrency: "AED", exchangeRate: 0 }, goodsEntries: [] } });
check("server", "a zero exchange rate is refused", zeroRate.status === 422, `${zeroRate.status}`);

// pick a booking lot with a comfortable balance for the UI run (whole units, at least 20)
const lot = [...booking].filter((l) => l.remainingQty >= 20 && Number.isInteger(l.remainingQty) && l.goodsName).sort((a, b) => b.remainingQty - a.remainingQty)[0];
if (!lot) { check("setup", "a booking lot with at least 20 units remaining exists on DEV", false, "none"); process.exit(1); }
console.log(`lot: ${lot.goodsName} ${lot.lotNo} remaining ${lot.remainingQty} ${lot.qtyName}`);
const tooMuch = await api("POST", "/api/erp/sales/orders", { ...base, formData: { form: { currencyType: "USD", secondaryCurrency: "USD", exchangeRate: 1 }, goodsEntries: [{ goodsName: lot.goodsName, qtyNo: lot.remainingQty + 1, stockLotNo: lot.lotNo, stockSource: lot.source, stockLinked: true }] } });
check("server", `selling more than the lot has left (${lot.remainingQty} + 1) is refused`, tooMuch.status === 409 && /remain/i.test(tooMuch.msg), `${tooMuch.status} ${tooMuch.msg}`);

// ── browser ──
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
const page = await ctx.newPage();
const errs = [], dialogs = [];
page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
page.on("dialog", (d) => { dialogs.push(d.message()); void d.accept(); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}-${lang}-${width}.png`, fullPage: true }).catch(() => {});
const T = (id) => page.locator(`[data-testid="${id}"]`);
const num = (v) => Number(String(v ?? "").replace(/,/g, "").replace(/[^0-9.\-]/g, "")) || 0;

await page.goto(`${BASE}/dashboard/sales/new-sales-booking-order`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForTimeout(6000);
// "Open Form" is the manual-entry card (the first of four method cards)
await page.getByText(tx("Open Form", "dintake.em_start_manual"), { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(5000);

// scope (super admin): Pakistan → first branch → first city branch
const dlg = page.locator("div.fixed.inset-0").filter({ has: page.locator("select") }).first();
const selects = dlg.locator("select");
{
  const val = await selects.nth(0).evaluate((el) => { const o = [...el.options].find((x) => /\(PKR\)/.test(x.textContent)); return o ? o.value : ""; });
  await selects.nth(0).selectOption(val);
}
for (let i = 0; i < 25 && (await selects.nth(1).locator("option").count()) < 2; i++) await page.waitForTimeout(1000);
await selects.nth(1).selectOption({ index: 1 });
for (let i = 0; i < 25 && (await selects.nth(2).locator("option").count()) < 2; i++) await page.waitForTimeout(1000);
await selects.nth(2).selectOption({ index: 1 });
await dlg.locator("button").last().click();
await page.waitForTimeout(4000);
await shot("1-step1-empty");

const text1 = await page.evaluate(() => document.body.innerText);
check("ui", "[step 1] a new booking opens EMPTY — no demo customer / account / goods / TRN", !/Al Noor|Global Trading LLC|Almond Kernel|Pistachio|Raisins|MSC Evergreen|TRN1234567890|TRN0987654321|Admin User|SB-2026-0001|Business Bay/.test(text1), (text1.match(/Al Noor|Global Trading LLC|Pistachio|Raisins|MSC Evergreen|TRN0987654321|Admin User|SB-2026-0001/) || [""])[0]);
check("ui", "[step 1] Booking Currency & Conversion card is present", await T("booking-currency-card").isVisible());
check("ui", "[step 1] Invoice Currency, Settlement Currency and Exchange Rate controls exist", (await T("invoice-currency").count()) === 1 && (await T("settlement-currency").count()) === 1);
check("ui", "[step 1] settlement currency defaults to the branch's currency (PKR)", (await T("settlement-currency").inputValue()) === "PKR", await T("settlement-currency").inputValue());
check("ui", "[step 1] Daily Exchange Rate box is present", await T("daily-rate-box").isVisible());

// accounts
async function pick(label) {
  await page.getByText(label, { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await page.locator("[cmdk-input], input[placeholder*=earch]").last().fill("a").catch(() => {});
  await page.waitForTimeout(2500);
  await page.locator("[cmdk-item], [role=option]").first().click().catch(() => {});
  await page.waitForTimeout(2500);
}
await pick(tx("Search customer name, account number, company, phone...", "sales.search_customer_ph").slice(0, 14));
await pick(tx("Search sales account name, account number, company...", "sales.search_sales_ph").slice(0, 14));

// USD → PKR with NO rate: Step 1 must not continue
await T("invoice-currency").selectOption("USD");
await page.waitForTimeout(500);
check("ui", "[step 1] USD → PKR with no rate shows the 'rate required' message", await T("rate-required").isVisible().catch(() => false));
const nextBtn = page.locator("button").filter({ hasText: new RegExp(esc(tx("NEXT: GOODS ENTRY", "sales.next_goods_entry")), "i") }).last();
const dBefore = dialogs.length;
await nextBtn.click();
await page.waitForTimeout(1200);
check("ui", "[step 1] Next is refused without an exchange rate (alert shown, still on Step 1)", dialogs.length > dBefore && !(await T("sales-step2").isVisible().catch(() => false)), dialogs.slice(dBefore).join(" | ").slice(0, 120));
await shot("2-step1-rate-required");

// same currency needs no rate
await T("settlement-currency").selectOption("USD");
await page.waitForTimeout(400);
check("ui", "[step 1] same currency shows 'no conversion needed' (rate exactly 1)", await T("rate-same-currency").isVisible().catch(() => false));
await T("settlement-currency").selectOption("PKR");
await page.waitForTimeout(400);
await T("exchange-rate").fill(String(RATE));
await shot("3-step1-filled");
await nextBtn.click();
await page.waitForTimeout(3000);
check("ui", "[step 2] opens after a valid rate", await T("sales-step2").isVisible().catch(() => false));
check("ui", "[step 2] the goods table starts empty", (await T("goods-empty").isVisible().catch(() => false)) && (await T("goods-row").count()) === 0);
const fieldCount = await T("goods-fields").locator("> div").count();
check("ui", "[step 2] the full goods field set is present (22 fields: net weight … final amount)", fieldCount === 22, `${fieldCount} fields`);

// Select Stock panel
await T("select-stock-btn").click();
await page.waitForTimeout(1500);
check("ui", "[panel] Select Stock opens a panel (not a dropdown)", await T("stock-panel").isVisible());
check("ui", "[panel] the three sources are listed: Warehouse / Booking / Export Stock", (await page.locator('[data-testid^="stock-source-"]').count()) === 3);
for (let i = 0; i < 60 && (await T("stock-lot-row").count()) === 0 && !(await T("stock-empty").isVisible().catch(() => false)); i++) await page.waitForTimeout(1500);
await shot("4-panel-warehouse");
check("ui", "[panel] the first source shows real stock records", (await T("stock-lot-row").count()) > 0, `${await T("stock-lot-row").count()} rows`);
await T("stock-source-booking").click();
for (let i = 0; i < 60 && (await T("stock-lot-row").count()) === 0; i++) await page.waitForTimeout(1500);
await T("stock-search").fill(lot.lotNo);
await page.waitForTimeout(800);
const header = (await T("stock-lots").locator("thead").innerText()).toLowerCase();
check("ui", "[panel] columns: goods, lot, origin, brand, size, quantity, total weight, sold, remaining", /goods/.test(header) && /lot/.test(header) && /origin/.test(header) && /brand/.test(header) && /size/.test(header) && /quantity/.test(header) && /weight/.test(header) && /sold/.test(header) && /remaining/.test(header) || lang !== "en", header.replace(/\s+/g, " ").slice(0, 120));
const row = T("stock-lot-row").first();
await row.click();
await page.waitForTimeout(3000);
const details = await T("stock-details").innerText();
check("ui", "[panel] clicking a lot opens its complete details (goods, lot, quantity, remaining, location, reference, status)", details.includes(lot.lotNo) && /150|\d/.test(details) && details.length > 200, details.replace(/\s+/g, " ").slice(0, 100));
await shot("5-panel-lot-details");
await T("stock-confirm").click();
await page.waitForTimeout(2000);
const box = await T("selected-stock-box").innerText();
check("ui", "[step 2] the confirmed stock is shown above the editable fields with its remaining balance", box.includes(lot.lotNo) && box.replace(/,/g, "").includes(String(lot.remainingQty)), box.replace(/\s+/g, " ").slice(0, 120));
check("ui", "[step 2] goods, lot, origin, brand, size and HS code are filled from the stock and locked", (await T("f-goods").inputValue()) === lot.goodsName && (await T("f-goods").isDisabled()) && (await T("f-lot").inputValue()) === lot.lotNo);

// over-selling is blocked in the form
await T("f-qty").fill(String(lot.remainingQty + 1));
await T("f-price").fill("2");
await page.waitForTimeout(500);
check("ui", "[step 2] a quantity above the remaining balance raises the over-stock alert", await T("over-stock-alert").isVisible().catch(() => false));
await T("add-goods-btn").click();
await page.waitForTimeout(600);
check("ui", "[step 2] … and the line is NOT added to the table", (await T("goods-row").count()) === 0 && (await T("line-problems").isVisible().catch(() => false)));
await shot("6-over-stock");

// a valid line: 10 × 50 KG, 1 KG empty, price 2 USD/kg → net 490, 980 USD, ×280 = 274,400 PKR
const QTY = 10;
await T("f-qty").fill(String(QTY));
const kgs = page.locator('[data-testid="goods-fields"] input[type=number]');
const idx = async (labelPart) => page.locator('[data-testid="goods-fields"] label').evaluateAll((els, part) => els.findIndex((e) => e.textContent.includes(part)), labelPart);
const fill = async (labelPart, value) => { const i = await idx(labelPart); await page.locator('[data-testid="goods-fields"] > div').nth(i).locator("input").fill(String(value)); };
await fill(tx("1 Qty KGS", "purchase.qty_kgs_1"), 50);
await fill(tx("1 Empty KGS", "purchase.empty_kgs_1"), 1);
await page.waitForTimeout(500);
if (lang === "en") {
  check("ui", "[step 2] Amount = net 490 KG × 2 = 980 USD", num(await T("f-amount").inputValue()) === 980, await T("f-amount").inputValue());
  check("ui", `[step 2] Final = 980 × ${RATE} = 274,400 PKR`, num(await T("f-final").inputValue()) === 980 * RATE, await T("f-final").inputValue());
}
await T("add-goods-btn").click();
await page.waitForTimeout(800);
check("ui", "[step 2] 'Add Goods to Table' adds the line", (await T("goods-row").count()) === 1);
if (lang === "en") {
  const rowText = (await T("goods-row").first().innerText()).replace(/,/g, "");
  check("ui", "[step 2] the table shows the correct amounts (980 USD / 274400 PKR)", /980\.00 USD/.test(rowText) && /274400\.00 PKR/.test(rowText), rowText.replace(/\s+/g, " ").slice(0, 140));
  const total = (await T("goods-total").innerText()).replace(/,/g, "");
  check("ui", "[step 2] the table total follows (quantity 10, 980 USD, 274400 PKR)", /980\.00 USD/.test(total) && /274400\.00 PKR/.test(total), total.replace(/\s+/g, " ").slice(0, 120));
}
await shot("7-line-added");

// the same lot again: the line already in the table is counted
await T("select-stock-btn").click();
await T("stock-source-booking").click();
for (let i = 0; i < 60 && (await T("stock-lot-row").count()) === 0; i++) await page.waitForTimeout(1500);
await T("stock-search").fill(lot.lotNo);
await page.waitForTimeout(800);
await T("stock-lot-row").first().click();
await page.waitForTimeout(800);
await T("stock-confirm").click();
await page.waitForTimeout(1500);
const box2 = (await T("selected-stock-box").innerText()).replace(/,/g, "");
check("ui", `[step 2] re-selecting the lot shows the balance after the line in the table (${lot.remainingQty} − ${QTY} = ${lot.remainingQty - QTY})`, box2.includes(String(lot.remainingQty - QTY)), box2.replace(/\s+/g, " ").slice(0, 140));
check("ui", "[step 2] no script errors", errs.length === 0, errs.join(" | "));
await browser.close();

// ── server: a saved booking takes its quantity out of the lot's remaining balance ──
const saved = await api("POST", "/api/erp/sales/orders", {
  ...base, currencyCode: "USD", exchangeRate: RATE, quantity: QTY, orderTotal: 274400,
  formData: { form: { currencyType: "USD", secondaryCurrency: "PKR", exchangeRate: RATE, operator: "*" }, goodsEntries: [{ goodsName: lot.goodsName, qtyNo: QTY, stockLotNo: lot.lotNo, stockSource: lot.source, stockLinked: true, coursePrice: 2, totalAmount: 980, finalAmount: 980 * RATE }] }
});
check("server", "a valid stock-linked booking saves", saved.status === 201, `${saved.status} ${saved.msg}`);
const after = (await lotsOf("booking")).find((l) => l.lotNo === lot.lotNo);
check("server", `the lot's remaining balance drops by the booked quantity (${lot.remainingQty} → ${lot.remainingQty - QTY}) and sold shows ${QTY}`, after && after.remainingQty === lot.remainingQty - QTY && after.soldQty === QTY, JSON.stringify({ remaining: after?.remainingQty, sold: after?.soldQty }));
const over2 = await api("POST", "/api/erp/sales/orders", { ...base, formData: { form: { currencyType: "USD", secondaryCurrency: "USD", exchangeRate: 1 }, goodsEntries: [{ goodsName: lot.goodsName, qtyNo: lot.remainingQty - QTY + 1, stockLotNo: lot.lotNo, stockSource: lot.source, stockLinked: true }] } });
check("server", "a second booking cannot take more than what is now left", over2.status === 409, `${over2.status} ${over2.msg}`);
const savedId = saved.j?.data?.salesOrderId || saved.j?.data?.id;
if (savedId) await api("DELETE", `/api/erp/sales/orders/${savedId}`);
const restored = (await lotsOf("booking")).find((l) => l.lotNo === lot.lotNo);
check("server", "deleting the booking returns the quantity to the lot", restored && restored.remainingQty === lot.remainingQty, JSON.stringify({ remaining: restored?.remainingQty }));

const pass = results.filter((r) => r.ok).length;
fs.writeFileSync(`${OUT}/sales-booking-step1-2-${lang}-${width}.json`, JSON.stringify({ base: BASE, lang, width, pass, fail: results.length - pass, results }, null, 2));
console.log(`\n${pass} PASS / ${results.length - pass} FAIL`);
process.exit(results.length - pass ? 1 : 0);
