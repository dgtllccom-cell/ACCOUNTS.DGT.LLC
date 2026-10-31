/**
 * DEV only — Purchase Booking → Advance Payment → Loading → Remaining Payment → Confirmed Stock, end to end, through the REAL routes and the
 * real Advance / Advance-Completed / Remaining screens.
 *   BASE=http://localhost:3553 OUT=<dir> node scripts/dev/advance-to-confirmed-stock-e2e.mjs
 * A throw-away USD 100,000 Advance bill (20 %, 2,000 cartons, USD bill in an AED branch @ 3.675) is cloned from a working DEV order; real
 * Production bills are never touched. Covers: partial advances in two currencies, screens follow the advance, Loading blocked until the advance
 * is complete and posted, partial Loading (800 of 2,000), Remaining Payment only for the loaded quantity, Confirmed Stock only after that
 * loading's Remaining Payment is complete, a second loading tracked separately, quantities counted once, DR = CR with no duplicates, and a
 * Credit bill that follows its own rule.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3553";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/advance-confirmed"; fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not the DEV database");
const sql = postgres(url, { max: 2, prepare: false, onnotice: () => {} });

const results = [];
const check = (group, name, ok, detail = "") => { results.push({ group, name, ok: !!ok, detail: String(detail).slice(0, 260) }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 220) : ""); };
const near = (a, b, e = 0.05) => Math.abs(Number(a) - Number(b)) <= e;

const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session=")).slice(12);
const cookie = `erp_session=${token}`;
const api = async (method, path, body, key) => {
  const headers = { cookie, "content-type": "application/json" };
  if (key) headers["idempotency-key"] = key;
  const x = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, j, msg: j?.error?.message || j?.message || "", code: j?.error?.code };
};

// ── fixture ──
const [src] = await sql`select * from purchase_orders where purchase_order_no = 'AE-001-0022' and deleted_at is null limit 1`;
if (!src) throw new Error("AE-001-0022 not found in DEV");
const [payable] = await sql`select id from ledgers where code = 'LOADTEST-AE-PAYABLE' limit 1`;
const [bank] = await sql`select id from ledgers where code = 'LOADTEST-AE-BANK' limit 1`;
const [goods] = await sql`select id::text id, goods_name from goods where deleted_at is null order by created_at limit 1`;
const [wh] = await sql`select id::text id, warehouse_name from warehouses where deleted_at is null and country_id = ${src.country_id} order by created_at limit 1`;
if (!wh) throw new Error("no warehouse in the fixture's country");
const RATE = 3.675, TOTAL = 100000, QTY = 2000, PCT = 20, ADV = TOTAL * PCT / 100; // 20,000
const TAG = "E2EACS-" + String(Date.now()).slice(-6);
const created = [];
async function makeBill(kind) {
  const id = crypto.randomUUID(), no = `${TAG}-${kind}`;
  const fd = {
    form: { paymentType: kind === "ADV" ? "Advance Payment" : "Credit", advancePercent: kind === "ADV" ? PCT : 0, totalAmount: TOTAL, currency: "USD", purchaseCurrency: "USD", exchangeRate: RATE, purchaseOrderNo: no, supplierName: "E2E Supplier" },
    goodsEntries: [{ goodsName: goods.goods_name, goodsId: goods.id, item: goods.goods_name, qtyNo: QTY, quantity: QTY, qtyName: "CARTONS", totalAmount: TOTAL, coursePrice: 5, netWeight: 20000 }],
    totals: { totalQuantity: QTY, totalAmount: TOTAL, grandPrimaryFinal: TOTAL, grandFinal: TOTAL * RATE },
    workflow: { totalQuantity: QTY, loadedQuantity: 0, transferStatus: "transferred" }
  };
  const clone = { ...src, id, purchase_order_no: no, status: "transferred", ledger_posting_status: "draft", payment_status: "pending", currency_code: "USD", purchase_currency: "USD", exchange_rate: RATE,
    order_total: Math.round(TOTAL * RATE * 100) / 100, total_goods_original: TOTAL, total_goods_usd: TOTAL, advance_paid: 0, remaining_paid: 0, credit_amount: 0, remaining_due: TOTAL, form_data: sql.json(fd), created_at: new Date(), updated_at: new Date() };
  for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k)) delete clone[k];
  await sql`insert into purchase_orders ${sql(clone)}`;
  created.push(id);
  return { id, no };
}
const pay = (kind, usd, extra = {}) => ({ kind, entryDate: new Date().toISOString().slice(0, 10), amount: Math.round(usd * RATE * 100) / 100, currencyCode: "AED", exchangeRate: RATE, debitLedgerId: payable.id, creditLedgerId: bank.id, referenceNo: `${TAG}-${Math.random().toString(36).slice(2, 8)}`, ...extra });
const postPay = (bill, body) => api("POST", `/api/erp/purchases/orders/${bill.id}/payments`, body, crypto.randomUUID());
const loadBody = (bill, container, qty) => ({ countryId: src.country_id, countryBranchId: src.country_branch_id, cityBranchId: src.city_branch_id, purchaseOrderId: bill.id, purchaseOrderNo: bill.no, containerNumber: container, loadedContainers: 1, loadedQuantity: qty, reportPayload: { entryCount: 1, loadedQuantity: qty, goodsEntries: [{ goodsName: goods.goods_name, quantityNo: qty }] } });
const order = async (bill) => (await sql`select advance_paid::float adv, remaining_paid::float rem, remaining_due::float due, payment_status::text ps, form_data from purchase_orders where id = ${bill.id}`)[0];
const wf = async (bill) => { const f = (await order(bill)).form_data; return (typeof f === "string" ? JSON.parse(f) : f)?.workflow ?? {}; };
const rows = async (bill) => (await api("GET", `/api/erp/inventory/journal-stock?limit=2000&search=${bill.no}`)).j?.data?.rows?.filter((r) => r.sourceId === bill.id) ?? [];
const qtyIn = (rs, stage) => rs.filter((r) => r.stage === stage).reduce((a, r) => a + Number(r.quantity || 0), 0);
const stageSummary = (rs) => ["booking", "transit", "receiving", "ready", "available", "reserved"].map((s) => `${s}:${qtyIn(rs, s)}`).join(" ");
const loadsOf = async (bill) => await sql`select id::text id, container_number, loaded_quantity::float q from purchase_loading_records where purchase_order_id = ${bill.id} and deleted_at is null and coalesce(loaded_quantity,0) > 0 order by created_at`;

// ── the real screens ──
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const page = await ctx.newPage();
async function listedIn(mode, bill) {
  // wait for the orders list of THIS page load (so a negative result means 'not listed', not 'not loaded yet'), then search for the bill
  const loaded = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/erp/purchases/orders' && r.status() === 200, { timeout: 150000 }).catch(() => null);
  await page.goto(`${BASE}/dashboard/journal/purchase-order-payment/${mode}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const search = page.locator('input[placeholder="Search"], input[type="search"]').first();
  await search.waitFor({ timeout: 120000 });
  const resp = await loaded;
  if (!resp) { check('screens', `(harness) ${mode}: the orders list did not load`, false); return false; }
  await page.waitForTimeout(2500);
  await search.fill(bill.no);
  await page.waitForTimeout(2000);
  const text = await page.locator('body').innerText().catch(() => '');
  return text.includes(bill.no);
}

try {
  const bill = await makeBill("ADV");

  // ── 1. a fresh Advance bill is in the Advance screen only ──
  check("screens", "[1] the new Advance bill is listed in Advance Payment", await listedIn("advance", bill));
  check("screens", "[1] … and NOT in Advance Completed", !(await listedIn("advance-completed", bill)));
  check("screens", "[1] … and NOT in Remaining Payment", !(await listedIn("remaining", bill)));
  const l0 = await api("POST", "/api/erp/purchases/loading-records", loadBody(bill, `${TAG}-NOPAY`, 800));
  check("loading", "[1] Loading is refused while no advance is paid", l0.status === 422 || l0.status === 409, `${l0.status} ${l0.msg}`);

  // ── 2. partial advances in two currencies ──
  const a1 = await postPay(bill, pay("advance", 5000)); // entered in AED
  check("advance", "[2] advance part 1: USD 5,000 entered in AED posts", a1.status < 300, `${a1.status} ${a1.msg}`);
  const o1 = await order(bill), w1 = await wf(bill);
  check("advance", "[2] bill advance_paid = USD 5,000", near(o1.adv, 5000, 0.5), String(o1.adv));
  check("advance", "[2] workflow flags are in the PURCHASE currency: required 20,000, remaining 15,000, not fulfilled (was AED-vs-USD)", near(w1.endorsementRequirement, ADV, 0.5) && near(w1.endorsementRemaining, ADV - 5000, 0.5) && w1.isEndorsementFulfilled === false, JSON.stringify({ req: w1.endorsementRequirement, rem: w1.endorsementRemaining, ok: w1.isEndorsementFulfilled, ccy: w1.endorsementCurrency }));
  { const q0 = await api("GET", `/api/erp/purchases/loading-records?limit=500&q=${bill.no}`); check("loading", "[2] not in the Loading queue while the required advance is unpaid", !(q0.j?.data?.records ?? []).some((r) => r.purchase_order_id === bill.id)); }
  check("loading", "[2] Loading still refused at 25 % of the advance", (await api("POST", "/api/erp/purchases/loading-records", loadBody(bill, `${TAG}-EARLY`, 800))).status >= 400);
  { const v = { advance: await listedIn("advance", bill), completed: await listedIn("advance-completed", bill), remaining: await listedIn("remaining", bill) };
    check("screens", "[2] still in Advance Payment, not in Advance Completed, not in Remaining", v.advance && !v.completed && !v.remaining, JSON.stringify(v)); }

  const a2 = await postPay(bill, { ...pay("advance", 15000), currencyCode: "USD", amount: 15000, exchangeRate: RATE });
  check("advance", "[2] advance part 2: USD 15,000 entered in USD posts", a2.status < 300, `${a2.status} ${a2.msg}`);
  const o2 = await order(bill), w2 = await wf(bill);
  check("advance", "[2] required advance complete: advance_paid = USD 20,000", near(o2.adv, ADV, 0.5), String(o2.adv));
  check("advance", "[2] workflow now says fulfilled, remaining 0 (USD)", w2.isEndorsementFulfilled === true && near(w2.endorsementRemaining, 0, 0.05) && w2.endorsementCurrency === "USD", JSON.stringify({ ok: w2.isEndorsementFulfilled, rem: w2.endorsementRemaining }));
  const placeholder = await sql`select count(*)::int n from purchase_loading_records where purchase_order_id = ${bill.id} and deleted_at is null`;
  check("loading", "[2] the bill is made available in Loading automatically (placeholder loading created)", placeholder[0].n >= 1, `${placeholder[0].n} loading rows`);
  const q = await api("GET", `/api/erp/purchases/loading-records?limit=500&q=${bill.no}`);
  check("loading", "[2] … and it is in the Loading queue", (q.j?.data?.records ?? []).some((r) => r.purchase_order_id === bill.id));
  { const v = { completed: await listedIn("advance-completed", bill), advance: await listedIn("advance", bill), remaining: await listedIn("remaining", bill) };
    check("screens", "[2] Advance Completed lists it; Advance no longer does; Remaining still does NOT (nothing loaded)", v.completed && !v.advance && !v.remaining, JSON.stringify(v)); }
  const remEarly = await postPay(bill, pay("remaining", 1000));
  check("remaining", "[2] a Remaining payment is refused while nothing is loaded", remEarly.status >= 400, `${remEarly.status} ${remEarly.msg}`);

  // ── 3. partial Loading: 800 of 2,000 cartons ──
  const L1 = await api("POST", "/api/erp/purchases/loading-records", loadBody(bill, `${TAG}-C1`, 800));
  check("loading", "[3] Loading transfer of 800 cartons is created", L1.status === 201, `${L1.status} ${L1.msg}`);
  let rs = await rows(bill);
  check("stock", "[3] Booking Stock 1,200 and Loading Stock 800 — counted once (total 2,000)", near(qtyIn(rs, "booking"), 1200, 0.001) && near(qtyIn(rs, "transit"), 800, 0.001), stageSummary(rs));
  const loads = await loadsOf(bill);
  const C1 = loads[0];
  check("stock", "[3] the bill's workflow shows loaded 800 / remaining 1,200", (await wf(bill)).loadedQuantity === 800 && (await wf(bill)).remainingQuantity === 1200);
  check("screens", "[3] the Remaining Payment page lists Remaining payments only — none posted yet, so the bill is not on it", !(await listedIn("remaining", bill)));
  const rp = rs.find((r) => r.loadingRecordId === C1.id && r.payment)?.payment;
  check("money", "[3] the Stock Journal shows the loading's money: value 40,000, advance share 8,000, owed 32,000", rp?.loading && near(rp.loading.value, 40000, 0.5) && near(rp.loading.advanceAllocated, 8000, 0.5) && near(rp.loading.outstanding, 32000, 0.5), JSON.stringify(rp?.loading));
  check("money", "[3] … and the bill: total 100,000, advance required 20,000 paid 20,000, qty 2,000 / loaded 800 / balance 1,200", rp && near(rp.billTotal, 100000, 0.5) && near(rp.advanceRequired, 20000, 0.5) && near(rp.advancePaid, 20000, 0.5) && rp.totalQuantity === 2000 && rp.loadedQuantity === 800 && rp.balanceQuantity === 1200, JSON.stringify({ t: rp?.billTotal, ar: rp?.advanceRequired, ap: rp?.advancePaid, q: rp?.totalQuantity, l: rp?.loadedQuantity, b: rp?.balanceQuantity }));

  // ── 4. Remaining Payment for the 800 loaded cartons only ──
  const over = await postPay(bill, pay("remaining", 32001, { typeDetails: { loadingRecordId: C1.id } }));
  check("remaining", "[4] USD 32,001 against the 800 cartons is refused (they owe 32,000)", over.status >= 400, `${over.status} ${over.msg}`);
  const p1 = await postPay(bill, pay("remaining", 31000, { typeDetails: { loadingRecordId: C1.id } }));
  check("remaining", "[4] USD 31,000 (part) posts against loading 1", p1.status < 300, `${p1.status} ${p1.msg}`);
  check("screens", "[4] the Remaining Payment page now lists the bill (its first Remaining payment is posted)", await listedIn("remaining", bill));

  // receive + customs, still not paid in full
  const rc = await api("POST", `/api/erp/purchases/loading-records/${C1.id}/receive`, { receivedQuantity: 800, damagedQuantity: 0, shortageQuantity: 0, warehouseId: wh.id, goodsId: goods.id, unitCost: 0 });
  check("stock", "[4] Destination Receiving of 800 posts", rc.status < 300 && rc.j?.ok !== false, `${rc.status} ${rc.msg}`);
  const cu = await api("POST", "/api/erp/inventory/journal-stock/customs", { loadingRecordId: C1.id, customsStatus: "cleared", reference: "CUS-" + TAG });
  check("stock", "[4] customs cleared", cu.status < 300, `${cu.status}`);
  rs = await rows(bill);
  const held = rs.find((r) => r.loadingRecordId === C1.id && (r.stage === "receiving" || r.stage === "ready"));
  check("confirmed", "[4] received + cleared but 1,000 still unpaid → NOT ready for Confirmed Stock, flagged 'awaiting payment'", held?.stage === "receiving" && held.paymentHold === true && held.canConfirm === false && near(held.payment?.loading?.outstanding, 1000, 0.5), JSON.stringify({ stage: held?.stage, hold: held?.paymentHold, out: held?.payment?.loading?.outstanding }));
  const confirmBody = (k, qty, extra = {}) => ({ idempotencyKey: `${TAG}-${k}`, purchaseOrderId: bill.id, loadingRecordId: C1.id, lineKey: held?.lineKey, destinationType: "warehouse", warehouseId: wh.id, quantity: qty, authorized: true, ...extra });
  const early = await api("POST", "/api/erp/inventory/journal-stock/confirm", confirmBody("early", 800));
  check("confirmed", "[4] the server refuses the confirmation (409 PAYMENT_NOT_COMPLETE)", early.status === 409 && early.code === "PAYMENT_NOT_COMPLETE", `${early.status} ${early.code} ${early.msg}`.slice(0, 160));

  // ── 5. the rest of loading 1's payment → eligible for Confirmed Stock ──
  const p2 = await postPay(bill, pay("remaining", 1000, { typeDetails: { loadingRecordId: C1.id } }));
  check("remaining", "[5] the last USD 1,000 posts — loading 1 is fully paid", p2.status < 300, `${p2.status} ${p2.msg}`);
  const again = await postPay(bill, pay("remaining", 1, { typeDetails: { loadingRecordId: C1.id } }));
  check("remaining", "[5] loading 1 cannot be paid a second time", again.status >= 400, `${again.status}`);
  rs = await rows(bill);
  const ready = rs.find((r) => r.loadingRecordId === C1.id && r.stage === "ready");
  check("confirmed", "[5] loading 1 is now Ready for Confirmation (800, canConfirm, no hold)", !!ready && near(ready.quantity, 800, 0.001) && ready.canConfirm === true && ready.paymentHold === false && ready.payment?.loading?.complete === true, `${ready?.stage}:${ready?.quantity}`);
  check("money", "[5] bill money after payments: remaining paid 32,000, total paid 52,000, outstanding 48,000", near(ready?.payment?.remainingPaid, 32000, 0.5) && near(ready?.payment?.totalPaid, 52000, 0.5) && near(ready?.payment?.outstanding, 48000, 0.5), JSON.stringify({ rp: ready?.payment?.remainingPaid, tp: ready?.payment?.totalPaid, o: ready?.payment?.outstanding }));
  const cf1 = await api("POST", "/api/erp/inventory/journal-stock/confirm", confirmBody("go", 800));
  check("confirmed", "[5] the authorized user transfers the 800 to Warehouse through the existing stock system", cf1.status < 300, `${cf1.status} ${cf1.code} ${cf1.msg}`.slice(0, 160));
  const cfAgain = await api("POST", "/api/erp/inventory/journal-stock/confirm", confirmBody("go2", 1));
  check("confirmed", "[5] nothing more can be confirmed from loading 1 (counted once)", cfAgain.status >= 400, `${cfAgain.status} ${cfAgain.code}`);
  rs = await rows(bill);
  check("stock", "[5] every quantity is in exactly one stage: Booking 1,200 · Available 800 · Transit 0 · Ready 0", near(qtyIn(rs, "booking"), 1200, 0.001) && near(qtyIn(rs, "available"), 800, 0.001) && near(qtyIn(rs, "transit"), 0) && near(qtyIn(rs, "ready"), 0) && near(qtyIn(rs, "receiving"), 0), stageSummary(rs));
  const hist = await api("GET", `/api/erp/inventory/journal-stock/history?sourceType=purchase_booking&sourceId=${bill.id}`);
  const events = hist.j?.data?.events ?? hist.j?.data ?? [];
  check("confirmed", "[5] the transfer history lists the booking, loading, receiving and confirmation", Array.isArray(events) && events.length >= 3, `${Array.isArray(events) ? events.length : "?"} events`);

  // ── 6. a second loading, tracked separately ──
  const L2 = await api("POST", "/api/erp/purchases/loading-records", loadBody(bill, `${TAG}-C2`, 600));
  check("loading", "[6] a second Loading transfer of 600 cartons is created against the same bill", L2.status === 201, `${L2.status} ${L2.msg}`);
  const C2 = (await loadsOf(bill)).find((l) => l.container_number === `${TAG}-C2`);
  rs = await rows(bill);
  check("stock", "[6] Booking 600 · Transit 600 · Available 800 (2,000 in total, once each)", near(qtyIn(rs, "booking"), 600, 0.001) && near(qtyIn(rs, "transit"), 600, 0.001) && near(qtyIn(rs, "available"), 800, 0.001), stageSummary(rs));
  const owed2 = 30000 - 6000; // 600 cartons = 30,000 of value, less 6,000 of advance
  check("money", "[6] loading 2 owes its own 24,000; loading 1 is unaffected (complete)", (() => { const p = rs.find((r) => r.loadingRecordId === C2.id)?.payment; return near(p?.loading?.outstanding, owed2, 0.5); })());
  const over2 = await postPay(bill, pay("remaining", owed2 + 1, { typeDetails: { loadingRecordId: C2.id } }));
  check("remaining", "[6] USD 24,001 against loading 2 is refused", over2.status >= 400, `${over2.status}`);
  const noLink = await postPay(bill, pay("remaining", 100, { typeDetails: { loadingRecordId: C1.id } }));
  check("remaining", "[6] a payment cannot be pushed onto loading 1, which is already paid", noLink.status >= 400, `${noLink.status}`);
  const p3 = await postPay(bill, pay("remaining", owed2, { typeDetails: { loadingRecordId: C2.id } }));
  check("remaining", "[6] USD 24,000 settles loading 2", p3.status < 300, `${p3.status} ${p3.msg}`);
  await api("POST", `/api/erp/purchases/loading-records/${C2.id}/receive`, { receivedQuantity: 600, damagedQuantity: 0, shortageQuantity: 0, warehouseId: wh.id, goodsId: goods.id, unitCost: 0 });
  await api("POST", "/api/erp/inventory/journal-stock/customs", { loadingRecordId: C2.id, customsStatus: "cleared", reference: "CUS2-" + TAG });
  rs = await rows(bill);
  const ready2 = rs.find((r) => r.loadingRecordId === C2.id && r.stage === "ready");
  check("confirmed", "[6] loading 2 becomes Ready for Confirmation once its own payment is complete", !!ready2 && near(ready2.quantity, 600, 0.001) && ready2.canConfirm, `${ready2?.stage}:${ready2?.quantity}`);
  const cf2 = await api("POST", "/api/erp/inventory/journal-stock/confirm", { idempotencyKey: `${TAG}-c2a`, purchaseOrderId: bill.id, loadingRecordId: C2.id, lineKey: ready2?.lineKey, destinationType: "local_sales", warehouseId: wh.id, quantity: 400, authorized: true });
  check("confirmed", "[6] part of loading 2 (400) goes to the Local Market through the existing stock system", cf2.status < 300, `${cf2.status} ${cf2.code} ${cf2.msg}`.slice(0, 160));

  // ── 7. ledger: balanced, no duplicates ──
  const fin = await order(bill);
  check("ledger", "[7] bill totals follow the payments: advance 20,000, remaining paid 56,000, still due 24,000 (1,400 loaded of 2,000 → 600 cartons not loaded yet)", near(fin.adv, 20000, 0.5) && near(fin.rem, 56000, 0.5) && near(fin.due, 24000, 0.5), JSON.stringify({ adv: fin.adv, rem: fin.rem, due: fin.due }));
  const vouchers = await sql`
    select p.kind::text kind, p.status::text status, p.posted_to_journal, p.roznamcha_entry_id::text rid,
           (select coalesce(sum(l.debit),0)::float from roznamcha_lines l where l.roznamcha_entry_id = p.roznamcha_entry_id) dr,
           (select coalesce(sum(l.credit),0)::float from roznamcha_lines l where l.roznamcha_entry_id = p.roznamcha_entry_id) cr,
           p.reference_no, p.loading_record_id::text lr
    from purchase_order_payments p where p.purchase_order_id = ${bill.id} and p.deleted_at is null and p.kind::text in ('advance','remaining')`;
  check("ledger", `[7] ${vouchers.length} payment vouchers, every one posted with DR = CR`, vouchers.length === 5 && vouchers.every((v) => v.status === "posted" && v.posted_to_journal && v.rid && v.dr > 0 && near(v.dr, v.cr, 0.01)), `${vouchers.length} vouchers`);
  check("ledger", "[7] no duplicate posting: unique references, one Roznamcha entry per payment", new Set(vouchers.map((v) => v.reference_no)).size === vouchers.length && new Set(vouchers.map((v) => v.rid)).size === vouchers.length);
  check("ledger", "[7] every Remaining payment is tied to its loading", vouchers.filter((v) => v.kind === "remaining").every((v) => v.lr));
  await page.screenshot({ path: `${OUT}/remaining-screen.png` }).catch(() => {});

  // ── 8. Credit bills follow their own rule ──
  const cr = await makeBill("CR");
  const lc = await api("POST", "/api/erp/purchases/loading-records", loadBody(cr, `${TAG}-CRC`, 500));
  check("credit", "[8] a Credit bill loads with nothing paid (its own approved rule)", lc.status === 201, `${lc.status} ${lc.msg}`);
  const CL = (await loadsOf(cr))[0];
  await api("POST", `/api/erp/purchases/loading-records/${CL.id}/receive`, { receivedQuantity: 500, damagedQuantity: 0, shortageQuantity: 0, warehouseId: wh.id, goodsId: goods.id, unitCost: 0 });
  await api("POST", "/api/erp/inventory/journal-stock/customs", { loadingRecordId: CL.id, customsStatus: "cleared", reference: "CR-" + TAG });
  const crRows = await rows(cr);
  const crReady = crRows.find((r) => r.loadingRecordId === CL.id && r.stage === "ready");
  check("credit", "[8] … and its stock is Ready for Confirmation without any payment (payable stays outstanding)", !!crReady && crReady.canConfirm === true && crReady.paymentHold === false && crReady.payment?.gated === false, `${crReady?.stage} gated=${crReady?.payment?.gated}`);
  const crConf = await api("POST", "/api/erp/inventory/journal-stock/confirm", { idempotencyKey: `${TAG}-cr`, purchaseOrderId: cr.id, loadingRecordId: CL.id, lineKey: crReady?.lineKey, destinationType: "warehouse", warehouseId: wh.id, quantity: 500, authorized: true });
  check("credit", "[8] the Credit bill's stock can be confirmed to the warehouse", crConf.status < 300, `${crConf.status} ${crConf.code} ${crConf.msg}`.slice(0, 140));
} catch (e) {
  results.push({ group: "fatal", name: "unexpected error", ok: false, detail: String(e?.stack || e).slice(0, 500) });
  console.log("FATAL", e?.stack || e);
} finally {
  await browser.close().catch(() => {});
  for (const id of created) {
    await sql`update purchase_loading_records set deleted_at = now() where purchase_order_id = ${id} and deleted_at is null`.catch(() => {});
    await sql`update purchase_orders set deleted_at = now() where id = ${id}`.catch(() => {});
  }
  await sql.end({ timeout: 5 });
  const pass = results.filter((r) => r.ok).length;
  const byGroup = {};
  for (const r of results) { const g = (byGroup[r.group] ??= { pass: 0, fail: 0 }); r.ok ? g.pass++ : g.fail++; }
  fs.writeFileSync(`${OUT}/advance-to-confirmed-stock.json`, JSON.stringify({ base: BASE, tag: TAG, pass, fail: results.length - pass, byGroup, results }, null, 2));
  console.log(`\n${pass} PASS / ${results.length - pass} FAIL`, JSON.stringify(byGroup));
  process.exit(results.length - pass ? 1 : 0);
}
