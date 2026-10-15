/**
 * DEV ONLY — browser E2E of the Stock Journal screen on a REAL DEV booking.
 *   BASE=http://localhost:3400 OUT=out/sj DEVICE=desktop|iphone|samsung|ipad|wide LANGS=en,ur node scripts/e2e-stock-journal-ui.mjs
 * Fixture (booking row + loading + receiving + customs) is created through the real routes; every stock EVENT below is driven through the UI:
 *   six cards → tabs → Ready for Confirmation → Confirm Stock (warehouse + direct sale) → Available report → History → Issue → Reverse → Print/PDF.
 */
import fs from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3400";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const DEVICE = process.env.DEVICE || "desktop";
const LANGS = (process.env.LANGS || "en").split(",");
const OUT = (process.env.OUT || "out/sj") + "/" + DEVICE;
fs.mkdirSync(OUT, { recursive: true });
const DEVICES = {
  desktop: { w: 1440, h: 900, dpr: 1, mobile: false },
  wide: { w: 2560, h: 1300, dpr: 1, mobile: false },
  ipad: { w: 820, h: 1180, dpr: 2, mobile: true },
  samsung: { w: 412, h: 915, dpr: 2.6, mobile: true },
  iphone: { w: 390, h: 844, dpr: 3, mobile: true },
};
const D = DEVICES[DEVICE];
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const URL_DB = process.env.DATABASE_URL || env.DATABASE_URL;
if (!URL_DB.includes(env.DEV_SUPABASE_REF || "csesvyxxjivnkkozgopt") || URL_DB.includes(env.PROD_SUPABASE_REF || "inmayhrxucimxqhgseqi")) throw new Error("Refusing: not the DEV database");
const sql = postgres(URL_DB, { max: 2, prepare: false, onnotice: () => {} });

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} [${DEVICE}] ${name}${detail ? " · " + detail : ""}`); };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.001;

async function sessionCookie(body) {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const c = (r.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  if (!c) throw new Error("dev-session failed");
  return c;
}
const cookie = await sessionCookie({ role: "super_admin" });
const call = async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j, data: j?.data ?? j };
};

// ── fixture through real routes ──
const TAG = "UISJ" + String(Date.now()).slice(-6);
const [src] = await sql`select * from purchase_orders where deleted_at is null and jsonb_typeof(form_data)='object' and country_id is not null and city_branch_id is not null order by created_at desc limit 1`;
const scope = { countryId: src.country_id, countryBranchId: src.country_branch_id, cityBranchId: src.city_branch_id };
const [wh1] = await sql`select id, warehouse_name from warehouses where deleted_at is null and country_id = ${scope.countryId} order by created_at limit 1`;
const [wh2] = await sql`select id, warehouse_name from warehouses where deleted_at is null and country_id = ${scope.countryId} and id <> ${wh1.id} order by created_at limit 1`;
const goods = await sql`select id, goods_name from goods where deleted_at is null order by created_at limit 2`;
const [customer] = await sql`select id, customer_name from customers where deleted_at is null and customer_name is not null order by created_at limit 1`;
const poNo = `${TAG}-PO`;
const formData = JSON.stringify({ form: { salesAccountName: "UI Supplier A/C", manualBillNumber: TAG + "-M", purchaseCurrency: "USD" }, goodsEntries: [{ goodsName: goods[0].goods_name, goodsId: goods[0].id, qtyNo: 100, qtyName: "BAGS" }, { goodsName: goods[1].goods_name, goodsId: goods[1].id, qtyNo: 50, qtyName: "BAGS" }] });
const overrides = { id: crypto.randomUUID(), purchase_order_no: poNo, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "Draft", ledger_posting_status: "posted", payment_status: "completed", super_admin_serial_number: null, country_transaction_serial_number: null, branch_transaction_serial_number: null, main_branch_transaction_serial: null, city_branch_transaction_serial: null, super_admin_serial: null, country_serial: null, branch_serial: null, entry_serial: null, global_reference_id: null, dest_country_id: null, dest_country_branch_id: null, dest_city_branch_id: null, purchase_contract_no: null };
const [po] = await sql`insert into purchase_orders select (jsonb_populate_record(null::purchase_orders, to_jsonb(p) || ${sql.json(overrides)}::jsonb || jsonb_build_object('form_data', to_jsonb(${formData}::text)))).* from purchase_orders p where p.id = ${src.id} returning id, purchase_order_no`;
const snap = {};
for (const w of [wh1, wh2].filter(Boolean)) for (const g of goods) { const [b] = await sql`select quantity_on_hand, quantity_reserved from product_inventory_balances where product_id = ${g.id} and warehouse_id = ${w.id}`; snap[g.id + "|" + w.id] = b || null; }
const load = (c, q) => call("POST", "/api/erp/purchases/loading-records", { ...scope, purchaseOrderId: po.id, purchaseOrderNo: poNo, containerNumber: c, loadingStatus: "loaded", loadedQuantity: q, loadedContainers: 1, transportMode: "By Road", vehicleNo: "TRK-" + c });
await load(TAG + "-C1", 80); await load(TAG + "-C2", 40);
const plrs = await sql`select id from purchase_loading_records where purchase_order_id = ${po.id} and deleted_at is null order by created_at`;
await call("POST", `/api/erp/purchases/loading-records/${plrs[0].id}/receive`, { receivedQuantity: 70, damagedQuantity: 6, shortageQuantity: 4, warehouseId: wh1.id, goodsId: goods[0].id });
console.log("fixture", poNo, "wh1", wh1.warehouse_name);

const browser = await chromium.launch();
try {
  for (const lang of LANGS) {
    const rtl = ["ur", "ar", "fa", "ps"].includes(lang);
    const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: D.mobile, hasTouch: D.mobile, acceptDownloads: true });
    await ctx.addCookies([{ name: "erp_session", value: cookie.slice(12), domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
    await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|hydrat/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
    const L = (n) => `${lang}-${n}`;
    const shot = (n) => p.screenshot({ path: `${OUT}/${L(n)}.png`, fullPage: false }).catch(() => {});
    const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    const rowsFor = () => p.locator('[data-testid="sj-row"]:visible');
    // wait until the table / cards finished reloading (aria-busy) so assertions never read the previous tab's rows
    const settle = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 60000 }); await p.waitForTimeout(300); };

    await p.goto(BASE + "/dashboard/purchase/stock/journal", { waitUntil: "load", timeout: 240000 });
    await p.waitForSelector('[data-testid="stock-journal"]', { timeout: 120000 });
    await p.getByTestId("sj-search").fill(TAG);
    await p.getByTestId("sj-search").press("Enter");
    await p.waitForFunction(() => document.querySelectorAll('[data-testid="sj-row"]').length > 0, null, { timeout: 90000 });
    await p.waitForTimeout(800);

    check(`${lang}: screen follows the language (dir=${rtl ? "rtl" : "ltr"})`, (await p.getByTestId("stock-journal").getAttribute("dir")) === (rtl ? "rtl" : "ltr"));
    check(`${lang}: six summary cards`, (await p.locator('[id^="sj-card-"]').count()) === 6);
    if (lang !== "en") {
      const t = await p.getByTestId("stock-journal").innerText();
      check(`${lang}: heading is not English`, !/Stock Journal/.test(t.slice(0, 200)) && /[؀-ۿ]/.test(t.slice(0, 300)));
    }
    check(`${lang}: no horizontal page overflow`, !(await overflow()));
    await shot("01-journal-all");

    // booking rows + remaining 30
    await p.getByTestId("sj-tab-booking").click();
    await settle();
    const bookingText = (await rowsFor().allInnerTexts()).join("\n");
    const bookingStages = await rowsFor().evaluateAll((els) => els.map((e) => e.dataset.stage));
    check(`${lang}: Booking tab lists ONLY booking-stage rows`, bookingStages.length > 0 && bookingStages.every((x) => x === "booking"), [...new Set(bookingStages)].join(","));
    check(`${lang}: Booking tab quantity 30`, /\b30\b/.test(bookingText), bookingText.replace(/\s+/g, " ").slice(0, 120));
    await shot("02-booking");

    // payment indicator (paid = black) is visible and separate
    check(`${lang}: indicators present (booking / invoice / payment)`, (await p.locator('[title]:visible').count()) > 0);

    // receiving / customs tab → customs not recorded → Customs modal → cleared via UI
    if (lang === "en") {
      await p.getByTestId("sj-tab-receiving").click();
      await settle();
      const recv = rowsFor().filter({ hasText: "70" });
      check("en: received 70 sits in Receiving / Customs with damage / shortage", (await recv.count()) >= 1 && /6/.test(await recv.first().innerText()));
      await shot("03-receiving");
      await recv.first().getByTestId("sj-customs").click();
      await p.getByTestId("sj-customs-status").selectOption("cleared");
      await p.getByTestId("sj-customs-submit").click();
      await p.waitForSelector('[data-testid="sj-customs-form"]', { state: "detached", timeout: 30000 });
      await settle();
    }

    // ready tab → Confirm Stock
    await p.getByTestId("sj-tab-ready").click();
    await settle();
    const ready = rowsFor().filter({ hasText: "70" });
    if (lang === "en") {
      check("en: Ready for Confirmation lists the cleared 70", (await ready.count()) >= 1);
      await shot("04-ready");
      await ready.first().getByTestId("sj-confirm").click();
      await p.waitForSelector('[data-testid="sj-confirm-form"]');
      await shot("05-confirm-modal");
      check("en: Confirm modal offers 4 destinations", (await p.locator('[data-testid^="sj-dest-"]').count()) === 4);
      // submit without authorization → refused client-side
      await p.getByTestId("sj-qty").fill("30");
      await p.getByTestId("sj-warehouse").selectOption(wh1.id);
      await p.getByTestId("sj-confirm-submit").click();
      check("en: cannot confirm without the authorization tick", (await p.getByRole("alert").count()) >= 1);
      await p.getByTestId("sj-authorize").check();
      await p.getByTestId("sj-confirm-submit").click();
      await p.waitForSelector('[data-testid="sj-confirm-form"]', { state: "detached", timeout: 60000 });
      await p.waitForTimeout(1800);
      check("en: success banner shown after Confirm Stock", (await p.getByRole("status").count()) >= 1);

      // second: direct sale 25 (reserved)
      await p.getByTestId("sj-tab-ready").click();
      await settle();
      await rowsFor().filter({ hasText: "40" }).first().getByTestId("sj-confirm").click();
      await p.getByTestId("sj-dest-direct_sale").click();
      await p.getByTestId("sj-qty").fill("25");
      await p.getByTestId("sj-customer").fill((customer.customer_name || "").slice(0, 4));
      await settle();
      const pick = p.locator("ul li button").first();
      if (await pick.count()) await pick.click(); else await p.getByTestId("sj-customer").fill(customer.customer_name);
      await p.getByTestId("sj-docref").fill("DOC-" + TAG);
      await p.getByTestId("sj-authorize").check();
      await shot("06-direct-sale-modal");
      await p.getByTestId("sj-confirm-submit").click();
      await p.waitForSelector('[data-testid="sj-confirm-form"]', { state: "detached", timeout: 60000 });
      await p.waitForTimeout(1800);
      const jr = await call("GET", `/api/erp/inventory/journal-stock?limit=2000&search=${TAG}`);
      const mine = (jr.data?.rows || []).filter((r) => r.sourceId === po.id);
      check("en: warehouse allocation 30 is Available", near(mine.filter((r) => r.stage === "available").reduce((s, r) => s + r.quantity, 0), 30));
      check("en: direct sale 25 is Reserved (not deducted)", near(mine.filter((r) => r.stage === "reserved").reduce((s, r) => s + r.quantity, 0), 25));

      // Available / Mixed consolidated report + drill-down
      await p.getByTestId("sj-tab-available").click();
      await p.waitForSelector('[data-testid="sj-group"]', { timeout: 60000 });
      await shot("07-available-report");
      const grp = p.locator('[data-testid="sj-group"]').filter({ hasText: wh1.warehouse_name }).first();
      await grp.click();
      await p.waitForTimeout(500);
      check("en: expanded group lists booking no + container sources", /UISJ/.test(await p.getByTestId("sj-available-report").innerText()) && /C1/.test(await p.getByTestId("sj-available-report").innerText()));
      await shot("08-available-expanded");
      await p.getByTestId("sj-source-history").first().click();
      await p.waitForSelector('[data-testid="sj-history-modal"]');
      await p.waitForFunction(() => document.querySelectorAll('[data-testid="sj-event"]').length >= 4, null, { timeout: 30000 });
      const evText = await p.getByTestId("sj-history-modal").innerText();
      check("en: history shows booking → loaded → received → confirmed", /booking created/i.test(evText) && /Loaded/.test(evText) && /Received/.test(evText) && /confirmed/i.test(evText));
      await shot("09-history");
      await p.keyboard.press("Escape").catch(() => {});
      await p.locator('button[aria-label="Close"]').first().click().catch(() => {});
      await p.waitForTimeout(500);

      // rows view → Issue the reserved allocation through the UI, then Reverse the warehouse allocation
      await p.getByRole("button", { name: /Transaction rows/ }).click();
      await settle();
      const resRow = rowsFor().filter({ has: p.locator("text=Reserved") }).first();
      await resRow.getByTestId("sj-issue").click();
      await p.getByTestId("sj-issue-ref").fill("DN-" + TAG);
      await shot("10-issue-modal");
      await p.getByTestId("sj-issue-submit").click();
      await p.waitForSelector('[data-testid="sj-issue-form"]', { state: "detached", timeout: 60000 });
      await settle();
      await p.getByTestId("sj-tab-sold").click();
      await settle();
      check("en: issued 25 appears under Sold / Exported", (await rowsFor().filter({ hasText: "25" }).count()) >= 1);
      await shot("11-sold");

      await p.getByTestId("sj-tab-available").click();
      await p.getByRole("button", { name: /Transaction rows/ }).click();
      await settle();
      await rowsFor().first().getByTestId("sj-reverse").click();
      await p.getByTestId("sj-reverse-reason").fill("ui test reversal");
      await p.getByTestId("sj-reverse-submit").click();
      await p.waitForSelector('[data-testid="sj-reverse-form"]', { state: "detached", timeout: 60000 });
      await settle();
      const after = await call("GET", `/api/erp/inventory/journal-stock?limit=2000&search=${TAG}`);
      const m2 = (after.data?.rows || []).filter((r) => r.sourceId === po.id);
      check("en: reversal returned the 30 to Ready for Confirmation", near(m2.filter((r) => r.stage === "ready" && r.loadingRecordId === plrs[0].id).reduce((s, r) => s + r.quantity, 0), 45), m2.map((r) => r.stage + ":" + r.quantity).join(","));

      // Print / PDF opens the report preview
      await p.getByTestId("sj-print").click();
      await p.waitForSelector("iframe", { timeout: 60000 });
      await p.waitForTimeout(2500);
      await shot("12-print-preview");
      const printed = await p.evaluate(() => document.querySelectorAll("iframe").length);
      check("en: Print / PDF opens the A4 report preview", printed >= 1);
    } else {
      // other languages: the same screen, translated, with RTL — open the modals that carry the most text
      await shot("03-ready-" + lang);
      const hasConfirm = await rowsFor().first().getByTestId("sj-confirm").count();
      if (hasConfirm) {
        await rowsFor().first().getByTestId("sj-confirm").click();
        await p.waitForSelector('[data-testid="sj-confirm-form"]');
        const modalText = await p.getByTestId("sj-confirm-form").innerText();
        check(`${lang}: Confirm Stock modal is translated`, /[؀-ۿ]/.test(modalText) && !/Confirm allocation|Destination|Authorization/.test(modalText));
        await shot("04-confirm-modal");
        await p.locator("div.fixed.inset-0 button[aria-label]").first().click();
        await p.waitForSelector('[data-testid="sj-confirm-form"]', { state: "detached", timeout: 15000 });
      }
      await p.getByTestId("sj-tab-available").click();
      await p.waitForTimeout(1800);
      await shot("05-available");
      check(`${lang}: no horizontal page overflow on the Available report`, !(await overflow()));
    }

    check(`${lang}: no page errors`, errors.length === 0, errors[0] || "");
    await ctx.close();
  }
} catch (e) {
  results.push(false);
  console.log("FATAL", e?.stack || e);
} finally {
  await browser.close();
  try {
    await sql`delete from stock_movements where purchase_order_id = ${po.id}`;
    await sql`delete from journal_stock_transfers where purchase_order_id = ${po.id}`;
    for (const [k, b] of Object.entries(snap)) {
      const [g, w] = k.split("|");
      if (b) await sql`update product_inventory_balances set quantity_on_hand = ${b.quantity_on_hand}, quantity_reserved = ${b.quantity_reserved} where product_id = ${g} and warehouse_id = ${w}`;
      else await sql`delete from product_inventory_balances where product_id = ${g} and warehouse_id = ${w}`;
    }
    await sql`delete from purchase_loading_records where purchase_order_id = ${po.id}`;
    if (!process.env.KEEP) await sql`delete from purchase_orders where id = ${po.id}`;
  } catch (e) { console.log("cleanup:", String(e).slice(0, 140)); }
  await sql.end({ timeout: 5 });
  const pass = results.filter(Boolean).length;
  console.log(`\n[${DEVICE}] ${pass} passed, ${results.length - pass} failed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
