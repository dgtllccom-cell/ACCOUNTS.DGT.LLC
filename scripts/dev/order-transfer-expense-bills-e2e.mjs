/**
 * DEV only — Customer Order Transfer ↔ the four expense bill pages, end to end:
 *   BASE=http://localhost:3521 node scripts/dev/order-transfer-expense-bills-e2e.mjs
 *  A  API: the expenses list filters by referenceNos (an order's bills), per category, inside the session's scope
 *  B  Order Transfer shows each bill type's status for the selected order: the bill made (Open bill) or none (Create bill)
 *  C  Open bill → the bill page opens on the order (banner) with that bill in the edit form
 *  D  Transfer → Truck / Customer / Other open their bill page on the order: entry form, attached, reference = order number
 *     (Customer goes to Customer Expenses — not the Clearing Customer Bill)
 *  E  General Received Bills desk: the order first, its bill per type, "only missing" filter; Clearing Agent transfer lands there
 *  F  a missing / out-of-scope order is never linked (warning banner, no reference prefilled); another country's branch admin
 *     does not see the order on the desk
 *  G  five languages + RTL on the desk and the banner
 * The test bills it creates are soft-deleted at the end (DEV).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import { BASE, devSession, client, check, summary } from "./expense-framework-lib.mjs";
import { devQuery } from "./_rbac-users.mjs";

const OUT = process.env.OUT || ".tmp/order-transfer-bills"; fs.mkdirSync(OUT, { recursive: true });
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8");
const dict = (lang, key) => { const s = ui.indexOf(`const ${lang}: Dict = {`); const m = ui.slice(s, ui.indexOf("\n};", s)).match(new RegExp(`"${key.replace(/\./g, "\\.")}": "((?:[^"\\\\]|\\\\.)*)"`)); return m ? JSON.parse(`"${m[1]}"`) : null; };
const today = new Date().toISOString().slice(0, 10);
const RUN = Date.now().toString(36).toUpperCase();
const PK = { country: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", main: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", quetta: "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b" };

const saCookie = await devSession("super_admin");
const sa = client(saCookie);
const created = [];
const T0 = (await devQuery((sql) => sql`select now() as t`))[0].t;

// the order: a DEV customer order with a city branch (its bills are entered on that branch)
const list = await sa("GET", "/api/erp/clearing-agent/customer-order");
const orders = list.json?.data ?? [];
const order = orders.find((o) => o.order_no === "RBAC-TEST-CO-ALRAS") ?? orders.find((o) => o.city_branch_id);
check("[setup] a customer order with a city branch exists on DEV", !!order, `${orders.length} orders`);
if (!order) { summary("order-transfer-expense-bills-e2e"); process.exit(1); }
const branchCtx = await devQuery((sql) => sql`select co.currency_code from public.city_branches cb join public.countries co on co.id = cb.country_id where cb.id = ${order.city_branch_id}::uuid`);
const CUR = branchCtx[0]?.currency_code || "AED";
console.log("order:", order.order_no, "branch:", order.city_branch_id, CUR);

// ── A  a customs bill attached to the order (the same payload the form posts)
const row = { rowSerial: 1, details: `E2E customs duty ${RUN}`, qty: 1, unitPrice: 150, amount: 150, currency: CUR, operation: "*", exchangeRate: 0, finalAmount: 150, taxOn: false, taxPct: 0, taxAmt: 0, grandAmount: 150, taxMode: "exempt" };
const post = await sa("POST", "/api/erp/expenses", { header: { billSerial: "AUTO", branch: order.city_branch_id, billDate: today, billMode: "attached", billTitle: "customs_expenses", referenceNo: order.order_no }, entries: [row] });
const billId = post.json?.billId;
check("[A] attached customs bill saved for the order", post.status === 200 && !!billId, JSON.stringify(post.json).slice(0, 200));
if (billId) created.push(billId);
const byRef = await sa("GET", `/api/erp/expenses?category=customs_expenses&referenceNos=${encodeURIComponent(order.order_no)}&limit=200`);
check("[A] referenceNos filter returns the order's customs bill", (byRef.json?.bills ?? []).some((b) => b.id === billId) && (byRef.json?.bills ?? []).every((b) => b.reference_no === order.order_no), `${byRef.json?.bills?.length} bills`);
const truckByRef = await sa("GET", `/api/erp/expenses?category=truck_expenses&referenceNos=${encodeURIComponent(order.order_no)}&limit=200`);
check("[A] …and nothing in another category", !(truckByRef.json?.bills ?? []).some((b) => b.id === billId));
const none = await sa("GET", `/api/erp/expenses?category=customs_expenses&referenceNos=NO-SUCH-${RUN}`);
check("[A] an unknown reference returns no bill (the filter is applied, not ignored)", Array.isArray(none.json?.bills) && none.json.bills.length === 0, none.json?.bills?.length);

const browser = await chromium.launch();
async function open(path, lang = "en", cookie = saCookie) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: "erp_session", value: cookie.split("=").slice(1).join("="), domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 });
  return { ctx, p, errs };
}

try {
  // ── B  Order Transfer: bill status per type
  {
    const { ctx, p, errs } = await open(`/dashboard/clearing-agent/order-transfer?orderId=${order.id}`);
    const customs = p.locator('[data-testid="transfer-bill-status-customs"]');
    await customs.locator('[data-testid="obill-customs-made"]').waitFor({ timeout: 90000 });
    const txt = (await customs.innerText()).replace(/\s+/g, " ");
    check("[B] Customs card: the order's bill is shown (Bill created + serial + Open bill)", /Bill created|Posted/.test(txt) && /Open bill/.test(txt), txt);
    const truck = p.locator('[data-testid="transfer-bill-status-truck"]');
    await truck.locator('[data-testid="obill-truck-none"], [data-testid="obill-truck-made"]').first().waitFor({ timeout: 30000 });
    check("[B] Truck card: no bill yet → Create bill", (await truck.locator('[data-testid="obill-truck-none"]').count()) === 1 && /Create bill/.test(await truck.innerText()), await truck.innerText());
    await p.screenshot({ path: `${OUT}/B-order-transfer.png` });

    // ── C  Open bill → the customs page, on the order, with the bill in the edit form
    await customs.locator('[data-testid="obill-customs-open"]').first().click();
    await p.waitForURL(/customs-expenses\?.*billId=/, { timeout: 60000 });
    await p.locator('[data-testid="order-context-banner"]').waitFor({ timeout: 60000 });
    check("[C] Open bill → Customs page with the order banner", (await p.locator('[data-testid="order-context-no"]').innerText()).trim() === order.order_no);
    // the visible form row (the print template also contains the text, hidden)
    await p.locator(`text="E2E customs duty ${RUN}" >> visible=true`).first().waitFor({ timeout: 60000 });
    check("[C] the order's bill is loaded in the edit form (its line is shown)", true);
    await p.screenshot({ path: `${OUT}/C-open-bill.png` });
    check("[B/C] no page errors", errs.length === 0, errs.join(" | "));
    await ctx.close();
  }

  // ── D  Transfer → Truck / Customer / Other open their bill page on the order
  for (const [type, page, cat] of [["truck", "truck-expenses", "truck_expenses"], ["customer", "customer-expenses", "customer_expenses"], ["other", "other-expenses", "other_expenses"]]) {
    const { ctx, p, errs } = await open(`/dashboard/clearing-agent/order-transfer?orderId=${order.id}`);
    const card = p.locator(`[data-testid="transfer-bill-status-${type}"]`);
    await card.locator(`[data-testid="obill-${type}-none"], [data-testid="obill-${type}-made"]`).first().waitFor({ timeout: 90000 });
    // Create bill (no bill yet) or the card's Transfer button opens the assignment dialog
    const create = card.locator("button", { hasText: "Create bill" });
    if (await create.count()) await create.first().click();
    else await card.locator("xpath=ancestor::div[contains(@class,'justify-between')][1]").locator("button").last().click();
    await p.getByRole("button", { name: /Confirm & Proceed/ }).click({ timeout: 30000 });
    await p.waitForURL(new RegExp(`/dashboard/clearing-agent/${page}\\?`), { timeout: 60000 });
    const url = new URL(p.url());
    check(`[D] ${type}: Transfer opens /${page} on the order`, url.searchParams.get("orderId") === order.id && !!url.searchParams.get("assignedUser"), p.url());
    await p.locator('[data-testid="order-context-banner"]').waitFor({ timeout: 60000 });
    const refInput = p.locator(`input[placeholder="${dict("en", "exp.ref_placeholder")}"]`);
    await refInput.waitFor({ timeout: 60000 });
    check(`[D] ${type}: entry form open, attached, reference = order number`, (await refInput.inputValue()) === order.order_no, await refInput.inputValue());
    const sel = await p.locator(`select option[value="attached-${cat}"]`).count();
    check(`[D] ${type}: the bill keeps its own category (attached-${cat})`, sel === 1);
    if (type === "customer") check("[D] customer: NOT the Clearing Customer Bill page", !/customer-bill/.test(p.url()));
    if (type === "truck") await p.screenshot({ path: `${OUT}/D-truck-entry.png` });
    check(`[D] ${type}: no page errors`, errs.length === 0, errs.join(" | "));
    await ctx.close();
  }

  // ── E  General Received Bills desk
  {
    const { ctx, p, errs } = await open(`/dashboard/clearing-agent/order-transfer?orderId=${order.id}`);
    await p.locator('[data-testid="open-general-received-bills"]').click({ timeout: 90000 });
    await p.waitForURL(/general-received-bill\?orderId=/, { timeout: 60000 });
    const first = p.locator('[data-testid="grb-row"]').first();
    await first.waitFor({ timeout: 90000 });
    check("[E] the desk lists the order opened from Order Transfer first", (await first.getAttribute("data-order-no")) === order.order_no, await first.getAttribute("data-order-no"));
    await first.locator('[data-testid="grb-customs"] [data-testid="obill-customs-made"]').waitFor({ timeout: 60000 });
    check("[E] its customs bill is shown with Open bill; truck still Create bill", /Open bill/.test(await first.locator('[data-testid="grb-customs"]').innerText()) && /Create bill|No bill yet/.test(await first.locator('[data-testid="grb-truck"]').innerText()));
    await p.screenshot({ path: `${OUT}/E-general-received-en.png` });
    const before = await p.locator('[data-testid="grb-row"]').count();
    await p.getByLabel(/Only orders with a bill still to make/).check();
    const after = await p.locator('[data-testid="grb-row"]').count();
    check("[E] 'only missing' keeps orders with a bill type still to make", after <= before && after >= 1, `${before} → ${after}`);
    check("[E] no page errors", errs.length === 0, errs.join(" | "));
    await ctx.close();
  }

  // ── F  never linked to a missing / out-of-scope order
  {
    const { ctx, p } = await open(`/dashboard/clearing-agent/customs-expenses?orderId=00000000-0000-4000-8000-00000000abcd`);
    await p.locator('[data-testid="order-context-unavailable"]').waitFor({ timeout: 60000 });
    const refInput = p.locator(`input[placeholder="${dict("en", "exp.ref_optional")}"], input[placeholder="${dict("en", "exp.ref_placeholder")}"]`).first();
    await refInput.waitFor({ timeout: 60000 }).catch(() => {});
    check("[F] unknown order → warning, no banner, no reference prefilled", (await p.locator('[data-testid="order-context-banner"]').count()) === 0 && !(await refInput.inputValue().catch(() => "")));
    await ctx.close();
    const pkCookie = await devSession("city_branch_admin", { countryId: PK.country, countryBranchId: PK.main, cityBranchId: PK.quetta, operationalDomain: "shipping" });
    const pkApi = client(pkCookie);
    const pkOrder = await pkApi("GET", `/api/erp/clearing-agent/customer-order/${order.id}`);
    check("[F] another country's branch admin cannot open the order (API)", [403, 404].includes(pkOrder.status), pkOrder.status);
    const pkBills = await pkApi("GET", `/api/erp/expenses?category=customs_expenses&referenceNos=${encodeURIComponent(order.order_no)}`);
    check("[F] …nor read its bills", pkBills.status === 403 || !(pkBills.json?.bills ?? []).some((b) => b.id === billId), pkBills.status);
    const g = await open(`/dashboard/clearing-agent/customs-expenses?orderId=${order.id}`, "en", pkCookie);
    await g.p.locator('[data-testid="order-context-unavailable"], [data-testid="order-context-banner"]').first().waitFor({ timeout: 90000 }).catch(() => {});
    check("[F] …and its bill page shows the order as unavailable (never linked)", (await g.p.locator('[data-testid="order-context-banner"]').count()) === 0);
    await g.ctx.close();
  }

  // ── H  persistence: a transfer survives a reload; refused without permission / scope; invalid input rejected
  {
    const tUrl = `/api/erp/clearing-agent/customer-order/${order.id}/expense-transfer`;
    const rec = await sa("POST", tUrl, { destination: "customs", assignedUser: "E2E Officer", date: today, memo: `E2E customs memo ${RUN}` });
    check("[H] API: a customs transfer is recorded", rec.status === 200 && rec.json?.data?.destination === "customs" && rec.json?.data?.memo === `E2E customs memo ${RUN}`, JSON.stringify(rec.json).slice(0, 200));
    const hist = await sa("GET", tUrl);
    check("[H] API: the order's transfer history returns it (newest first)", hist.status === 200 && hist.json?.data?.[0]?.id === rec.json?.data?.id, JSON.stringify(hist.json).slice(0, 160));
    const bad = await sa("POST", tUrl, { destination: "nowhere" });
    check("[H] API: an unknown destination is rejected (400)", bad.status === 400, bad.status);
    const miss = await sa("POST", `/api/erp/clearing-agent/customer-order/00000000-0000-4000-8000-00000000abcd/expense-transfer`, { destination: "customs" });
    check("[H] API: an unknown order is 404", miss.status === 404, miss.status);
    const acct = client(await devSession("accountant", { countryId: order.country_id, cityBranchId: order.city_branch_id }));
    const noPerm = await acct("POST", tUrl, { destination: "customs" });
    check("[H] API: a login without shipping update permission is refused (403)", noPerm.status === 403, noPerm.status);
    const pkCookie2 = await devSession("city_branch_admin", { countryId: PK.country, countryBranchId: PK.main, cityBranchId: PK.quetta, operationalDomain: "shipping" });
    const crossScope = await client(pkCookie2)("POST", tUrl, { destination: "customs" });
    check("[H] API: another country's branch admin cannot record a transfer on this order (403/404)", [403, 404].includes(crossScope.status), crossScope.status);
    const listed = await sa("GET", "/api/erp/clearing-agent/customer-order");
    const lo = (listed.json?.data ?? []).find((o) => o.id === order.id);
    check("[H] API: the orders list carries the latest transfer", lo?.expense_transfer?.destination === "customs" && lo?.general_received === false, JSON.stringify(lo?.expense_transfer));

    // UI: Configure Handler & Stage Transfer → Confirm & Proceed records the receipt, lands on the desk, survives a reload
    const memo = `E2E desk memo ${RUN}`;
    const a = await open(`/dashboard/clearing-agent/order-transfer?orderId=${order.id}`);
    await a.p.getByText("Configure Handler & Stage Transfer").first().click({ timeout: 90000 });
    await a.p.getByPlaceholder(/Enter specific notes/).fill(memo);
    await a.p.getByRole("button", { name: /Confirm & Proceed/ }).click();
    await a.p.waitForURL(/general-received-bill\?orderId=/, { timeout: 60000 });
    await a.ctx.close();
    const listed2 = await sa("GET", "/api/erp/clearing-agent/customer-order");
    const lo2 = (listed2.json?.data ?? []).find((o) => o.id === order.id);
    check("[H] UI transfer to the Clearing Agent desk is saved on the server (general_received, memo, handler, date)", lo2?.general_received === true && lo2?.expense_transfer?.destination === "clearing_agent" && lo2?.expense_transfer?.memo === memo && !!lo2?.expense_transfer?.user && lo2?.expense_transfer?.date === today, JSON.stringify(lo2?.expense_transfer));

    const r = await open(`/dashboard/clearing-agent/order-transfer?orderId=${order.id}`);
    await r.p.getByText("✓ Received").first().waitFor({ timeout: 90000 });
    check("[H] after a reload Order Transfer still shows the order as Received", true);
    await r.ctx.close();

    const d = await open(`/dashboard/clearing-agent/general-received-bill`);
    await d.p.locator('[data-testid="grb-row"]').first().waitFor({ timeout: 90000 });
    check("[H] the desk opens on the received orders (Received tab selected)", (await d.p.locator('[data-testid="grb-tab-received"]').getAttribute("aria-selected")) === "true");
    const row = d.p.locator(`[data-testid="grb-row"][data-order-no="${order.order_no}"]`);
    await row.waitFor({ timeout: 60000 });
    const rt = (await row.locator('[data-testid="grb-received"]').innerText()).replace(/\s+/g, " ");
    check("[H] the desk row shows Received, the date, the handler and the memo", /Received/.test(rt) && rt.includes(today) && /Handler:/.test(rt) && rt.includes(memo), rt);
    await d.p.locator('[data-testid="grb-tab-all"]').click();
    check("[H] All orders lists more than the received ones", (await d.p.locator('[data-testid="grb-row"]').count()) > 1);
    await d.p.screenshot({ path: `${OUT}/H-desk-received.png` });
    await d.ctx.close();
  }

  // ── G  five languages + RTL
  for (const lang of LANGS) {
    const { ctx, p, errs } = await open(`/dashboard/clearing-agent/general-received-bill?orderId=${order.id}`, lang);
    await p.locator('[data-testid="grb-row"]').first().waitFor({ timeout: 90000 });
    const title = (await p.locator('[data-testid="general-received-bills"] h1').innerText()).trim();
    const dir = await p.locator('[data-testid="general-received-bills"]').getAttribute("dir");
    check(`[G] ${lang}: desk title in the language, ${lang === "en" ? "LTR" : "RTL"}`, title === dict(lang, "grb.title") && dir === (lang === "en" ? "ltr" : "rtl"), `${title} · ${dir}`);
    await p.locator('[data-testid="grb-row"]').first().locator('[data-testid="obill-customs-open"]').first().waitFor({ timeout: 60000 });
    const open1 = (await p.locator('[data-testid="obill-customs-open"]').first().innerText()).trim();
    check(`[G] ${lang}: bill status labels translated`, open1 === dict(lang, "obill.open"), open1);
    if (lang === "ur") await p.screenshot({ path: `${OUT}/G-general-received-ur.png` });
    const b = await open(`/dashboard/clearing-agent/truck-expenses?orderId=${order.id}`, lang);
    await b.p.locator('[data-testid="order-context-banner"]').waitFor({ timeout: 90000 });
    const bt = await b.p.locator('[data-testid="order-context-banner"]').innerText();
    check(`[G] ${lang}: order banner in the language`, bt.includes(dict(lang, "obill.linked_order")) && bt.includes(order.order_no), bt.slice(0, 120));
    check(`[G] ${lang}: no page errors`, errs.length === 0 && b.errs.length === 0, [...errs, ...b.errs].join(" | "));
    await b.ctx.close();
    await ctx.close();
  }
} finally {
  await browser.close();
  // DEV test bills only
  if (created.length) await devQuery((sql) => sql`update public.expenses_bills set deleted_at = now() where id = any(${created}::uuid[]) and deleted_at is null`);
  console.log("cleaned up test bills:", created.length);
  // the transfer events this run recorded on the test order (DEV)
  const gone = await devQuery((sql) => sql`delete from public.erp_activity_events where action = 'expense_transfer' and record_table = 'clearing_customer_orders' and record_id = ${order.id}::uuid and created_at >= ${T0} returning id`);
  console.log("cleaned up test transfer events:", gone.length);
}
process.exit(summary("order-transfer-expense-bills-e2e") ? 0 : 1);
