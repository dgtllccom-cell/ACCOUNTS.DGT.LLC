/**
 * DEV only — Purchase Booking → Advance Payment → Loading → Remaining Payment → Ledger & Stock, end to end through the REAL routes.
 *   BASE=http://localhost:3547 node scripts/dev/advance-loading-remaining-e2e.mjs
 * Builds a throw-away USD 80,000 Advance order (50 % advance, 500 bales, AED branch @ 3.675) and drives it:
 *   1. Loading is refused before any payment;  2. a PARTIAL advance entered in AED (USD 12,000 of the USD 40,000 required) must NOT unlock
 *   Loading (it used to, because AED amounts were added up as if they were USD);  3. the full advance unlocks it;  4. a Remaining payment is
 *   refused while nothing is loaded;  5. partial loading (200 / 300 bales), duplicate container, over-quantity and concurrent loads;
 *   6. Remaining payments are capped at the loaded share and recorded against their container;  7. DR = CR for every voucher, no duplicate
 *   posting, balances / loaded quantities in step;  8. another country's admin cannot load this booking.
 * Run it on an OLD and a NEW build to get a BEFORE / AFTER; results go to $OUT (default .tmp/advance-loading).
 */
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";

const BASE = process.env.BASE || "http://localhost:3547";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/advance-loading"; fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not the DEV database");
const sql = postgres(url, { max: 2, prepare: false, onnotice: () => {} });

const results = [];
const check = (group, name, ok, detail = "") => { results.push({ group, name, ok: !!ok, detail: String(detail).slice(0, 240) }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 200) : ""); };
const near = (a, b, e = 0.02) => Math.abs(Number(a) - Number(b)) <= e;

const session = async (body) => {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
};
const cookie = await session({ role: "super_admin" });
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14"; // Pakistan — a different country from the UAE test order
const otherCookie = await session({ role: "country_admin", countryId: PK });
const api = async (method, path, body, ck = cookie, key) => {
  const headers = { cookie: ck, "content-type": "application/json" };
  if (key) headers["idempotency-key"] = key;
  const x = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, j, msg: j?.error?.message || j?.message || "", code: j?.error?.code };
};

// ── fixture: a throw-away clone of a working UAE order, re-shaped as a USD 80,000 Advance order ──────────────────────────────
const [src] = await sql`select * from purchase_orders where purchase_order_no = 'AE-001-0022' and deleted_at is null limit 1`;
if (!src) throw new Error("AE-001-0022 not found in DEV");
const [payable] = await sql`select id from ledgers where code = 'LOADTEST-AE-PAYABLE' limit 1`;
const [bank] = await sql`select id from ledgers where code = 'LOADTEST-AE-BANK' limit 1`;
const id = crypto.randomUUID(), no = "E2EADV-" + String(Date.now()).slice(-6);
const RATE = 3.675, TOTAL_USD = 80000, QTY = 500, REQUIRED_USD = 40000;
const formData = {
  form: { paymentType: "Advance", advancePercent: 50, advanceAmount: REQUIRED_USD, totalAmount: TOTAL_USD, currency: "USD", purchaseCurrency: "USD", exchangeRate: RATE, purchaseOrderNo: no, supplierName: "E2E Supplier", goodsName: "Raw Ginned Cotton Bales" },
  goodsEntries: [{ goodsName: "Raw Ginned Cotton Bales", item: "Raw Ginned Cotton Bales", qtyNo: QTY, quantity: QTY, priceType: "P/Item", coursePrice: 160, totalAmount: TOTAL_USD }],
  totals: { totalQuantity: QTY, totalAmount: TOTAL_USD, grandFinal: TOTAL_USD },
  workflow: { totalQuantity: QTY, loadedQuantity: 0, transferStatus: "transferred", advancePaymentStatus: "pending" }
};
const clone = {
  ...src, id, purchase_order_no: no, status: "transferred", ledger_posting_status: "draft", payment_status: "pending", currency_code: "USD", purchase_currency: "USD", exchange_rate: RATE,
  order_total: Math.round(TOTAL_USD * RATE * 100) / 100, total_goods_original: TOTAL_USD, total_goods_usd: TOTAL_USD, advance_paid: 0, remaining_paid: 0, credit_amount: 0, remaining_due: TOTAL_USD,
  form_data: sql.json(formData), created_at: new Date(), updated_at: new Date()
};
for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k)) delete clone[k];
await sql`insert into purchase_orders ${sql(clone)}`;

const pay = (kind, usd, extra = {}) => ({
  kind, entryDate: new Date().toISOString().slice(0, 10), amount: Math.round(usd * RATE * 100) / 100, currencyCode: "AED", exchangeRate: RATE,
  debitLedgerId: payable.id, creditLedgerId: bank.id, referenceNo: `${no}-${Math.random().toString(36).slice(2, 7)}`, ...extra
});
const postPay = (body, ck = cookie) => api("POST", `/api/erp/purchases/orders/${id}/payments`, body, ck, crypto.randomUUID());
const loadBody = (container, qty, extra = {}) => ({
  purchaseOrderId: id, purchaseOrderNo: no, containerNumber: container, loadedContainers: 1, loadedQuantity: qty,
  reportPayload: { entryCount: 1, loadedQuantity: qty, goodsEntries: [{ goodsName: "Raw Ginned Cotton Bales", quantityNo: qty }] }, ...extra
});
const postLoad = (body, ck = cookie) => api("POST", "/api/erp/purchases/loading-records", body, ck);
const order = async () => (await sql`select advance_paid::float adv, remaining_paid::float rem, remaining_due::float due, payment_status::text ps, form_data from purchase_orders where id = ${id}`)[0];
const loads = async () => await sql`select id::text id, container_number, loaded_quantity::float q, loading_status from purchase_loading_records where purchase_order_id = ${id} and deleted_at is null order by created_at`;
const realLoads = async () => (await loads()).filter((l) => l.q > 0);
const queueHas = async () => {
  const r = await api("GET", `/api/erp/purchases/loading-records?limit=500&q=${no}`);
  const rows = r.j?.data?.records ?? r.j?.data?.loadingRecords ?? r.j?.records ?? (Array.isArray(r.j?.data) ? r.j.data : []);
  return rows.some((x) => x.purchase_order_id === id || x.purchase_order_no === no);
};
const stockRows = async () => {
  const r = await api("GET", `/api/erp/inventory/journal-stock?limit=2000&search=${no}`);
  return (r.j?.data?.rows ?? []).filter((x) => x.sourceId === id);
};
const stockQty = (rows, stage) => rows.filter((x) => x.stage === stage).reduce((a, x) => a + Number(x.quantity || 0), 0);
const wf = async () => { const f = (await order()).form_data; const o = typeof f === "string" ? JSON.parse(f) : f; return o?.workflow ?? {}; };

try {
  // ── 1. nothing paid ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const l0 = await postLoad(loadBody(`E2E-NOPAY-${no}`, 100));
  check("gate", "[1] Loading is refused while no advance has been paid", l0.status === 422 || l0.status === 409, `${l0.status} ${l0.msg}`);
  check("gate", "[1] … the booking is not offered in the Loading queue", !(await queueHas()));

  // ── 2. a PARTIAL advance entered in AED: USD 12,000 of USD 40,000 required ─────────────────────────────────────────────
  const a1 = await postPay(pay("advance", 12000));
  check("advance", "[2] partial advance (AED 44,100 = USD 12,000) posts", a1.status < 300, `${a1.status} ${a1.msg}`);
  const o1 = await order();
  check("advance", "[2] order advance_paid = USD 12,000 (not AED 44,100)", near(o1.adv, 12000, 0.5), `advance_paid ${o1.adv}`);
  const queuedEarly = await queueHas();
  check("gate", "[2] BUG CHECK — 30 % of the advance must NOT put the booking in the Loading queue", !queuedEarly, queuedEarly ? "listed in the queue" : "");
  const early = await postLoad(loadBody(`E2E-EARLY-${no}`, 100));
  check("gate", "[2] BUG CHECK — 30 % of the advance must NOT allow Loading", early.status >= 400, `${early.status} ${early.msg}`);
  if (early.status < 300) { await sql`update purchase_loading_records set deleted_at = now() where purchase_order_id = ${id}`; await sql`update purchase_orders set form_data = ${sql.json(formData)} where id = ${id}`; }
  if (early.status >= 400) check("gate", "[2] … the refusal explains the shortfall", /advance/i.test(early.msg) && /shortfall|required|not cleared/i.test(early.msg), early.msg);

  // ── 3. the rest of the advance → unlocked ────────────────────────────────────────────────────────────────────────────────
  const a2 = await postPay({ ...pay("advance", 28000), currencyCode: "USD", amount: 28000, exchangeRate: RATE });
  check("advance", "[3] remaining USD 28,000 of the advance (entered in USD) posts", a2.status < 300, `${a2.status} ${a2.msg}`);
  const o2 = await order();
  check("advance", "[3] advance_paid = USD 40,000 (12,000 AED-entered + 28,000 USD-entered)", near(o2.adv, 40000, 0.5), `advance_paid ${o2.adv}`);
  check("gate", "[3] the booking now appears in the Loading queue", await queueHas());
  const overAdv = await postPay(pay("advance", 50000));
  check("advance", "[3] an advance larger than the order balance is refused", overAdv.status >= 400, `${overAdv.status} ${overAdv.msg}`);

  // ── 4. Remaining payment before anything is loaded ────────────────────────────────────────────────────────────────────────
  const earlyRem = await postPay(pay("remaining", 1000));
  check("remaining", "[4] BUG CHECK — a Remaining payment is refused while nothing is loaded", earlyRem.status >= 400, `${earlyRem.status} ${earlyRem.msg}`);
  if (earlyRem.status < 300) check("remaining", "[4] (cleanup note) an early remaining payment was accepted by this build", false, "payment posted before any loading");

  { const st = await stockRows(); check("stock", "[4] before any loading all 500 bales are Booking stock and none is in Transit", stockQty(st, "booking") === 500 && stockQty(st, "transit") === 0, JSON.stringify(st.map((x) => [x.stage, x.quantity]))); }

  // ── 5. loading ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  const l1 = await postLoad(loadBody(`E2E-C1-${no}`, 200));
  check("loading", "[5] first container (200 bales) is created", l1.status === 201, `${l1.status} ${l1.msg}`);
  const dup = await postLoad(loadBody(`E2E-C1-${no}`, 200));
  check("loading", "[5] BUG CHECK — the identical load submitted again (double-click / replay) is refused", dup.status >= 400, `${dup.status} ${dup.msg}`);
  let rl = await realLoads();
  check("stock", "[5] exactly one loading holds the 200 bales", rl.length === 1 && rl[0].q === 200, JSON.stringify(rl.map((x) => [x.container_number, x.q])));
  check("stock", "[5] booking workflow loaded 200 / remaining 300 — in step with the loading rows", (await wf()).loadedQuantity === 200 && (await wf()).remainingQuantity === 300, JSON.stringify(await wf()).slice(0, 160));
  { const st = await stockRows(); check("stock", "[5] Stock Journal: 200 moved out of Booking stock (300 left) into Loading / Transit stock (200); the total stays 500", stockQty(st, "booking") === 300 && stockQty(st, "transit") === 200, JSON.stringify(st.map((x) => [x.stage, x.quantity]))); }
  const tooMany = await postLoad(loadBody(`E2E-BIG-${no}`, 301));
  check("loading", "[5] loading more than the 300 bales left is refused", tooMany.status >= 400 && /exceeds|remaining/i.test(tooMany.msg), `${tooMany.status} ${tooMany.msg}`);
  check("stock", "[5] the refused load changed nothing", (await realLoads()).length === 1 && (await wf()).loadedQuantity === 200);

  // two simultaneous loads of 300 bales when only 300 are left: exactly one may win
  const [r1, r2] = await Promise.all([postLoad(loadBody(`E2E-RACE-A-${no}`, 300)), postLoad(loadBody(`E2E-RACE-B-${no}`, 300))]);
  const wins = [r1, r2].filter((r) => r.status === 201).length;
  check("loading", "[5] BUG CHECK — two simultaneous loads of the last 300 bales: exactly one succeeds", wins === 1, `statuses ${r1.status}/${r2.status}`);
  rl = await realLoads();
  const loadedTotal = rl.reduce((s, x) => s + x.q, 0);
  check("stock", "[5] total loaded never exceeds the 500 booked bales; workflow equals the rows", loadedTotal <= 500 && (await wf()).loadedQuantity === loadedTotal, `rows ${loadedTotal}, workflow ${(await wf()).loadedQuantity}`);
  { const st = await stockRows(); check("stock", "[5] Stock Journal after the second container: Booking 0, Transit = everything loaded, nothing counted twice", stockQty(st, "booking") === 500 - loadedTotal && stockQty(st, "transit") === loadedTotal, JSON.stringify(st.map((x) => [x.stage, x.quantity]))); }
  const second = rl.find((x) => x.container_number.startsWith("E2E-RACE-"));
  const first = rl.find((x) => x.container_number === `E2E-C1-${no}`);

  // ── 6. Remaining payments: loaded share only, recorded against their container ──────────────────────────────────────────
  // the advance (USD 40,000) is spread over all 500 bales; the unpaid half (USD 40,000) falls due as the bales are loaded
  const owed1 = (REQUIRED_USD * first.q) / QTY; // 200 bales → 16,000
  const over1 = await postPay(pay("remaining", owed1 + 1, { typeDetails: { loadingRecordId: first.id } }));
  check("remaining", "[6] BUG CHECK — paying USD 1 more than container 1 owes (16,000) is refused", over1.status >= 400, `${over1.status} ${over1.msg}`);
  const rem1 = await postPay(pay("remaining", owed1, { typeDetails: { loadingRecordId: first.id } }));
  check("remaining", "[6] exactly what container 1 owes (USD 16,000) posts", rem1.status < 300, `${rem1.status} ${rem1.msg}`);
  const linked = (await sql`select loading_record_id::text lr from purchase_order_payments where purchase_order_id = ${id} and kind = 'remaining' and deleted_at is null`);
  check("remaining", "[6] BUG CHECK — the payment is recorded against container 1", linked.length === 1 && linked[0].lr === first.id, JSON.stringify(linked));
  const hist = await api("GET", `/api/erp/purchases/orders/${id}/payments`);
  const hrow = (hist.j?.data?.payments ?? []).find((p) => p.kind === "remaining");
  check("remaining", "[6] the payment history returns the container link (the screen needs it to show what is already paid)", hrow?.loading_record_id === first.id, JSON.stringify(hrow?.loading_record_id));
  const again1 = await postPay(pay("remaining", 1, { typeDetails: { loadingRecordId: first.id } }));
  check("remaining", "[6] BUG CHECK — container 1 cannot be paid a second time", again1.status >= 400, `${again1.status} ${again1.msg}`);
  const wrongLoad = await postPay(pay("remaining", 10, { typeDetails: { loadingRecordId: crypto.randomUUID() } }));
  check("remaining", "[6] a loading that is not on this booking is refused", wrongLoad.status >= 400, `${wrongLoad.status} ${wrongLoad.msg}`);

  if (second) {
    const owed2 = (REQUIRED_USD * second.q) / QTY;
    const rem2 = await postPay(pay("remaining", owed2, { typeDetails: { loadingRecordId: second.id } }));
    check("remaining", `[6] container 2 (${second.q} bales) settles exactly its share (USD ${owed2})`, rem2.status < 300, `${rem2.status} ${rem2.msg}`);
  }

  // ── 7. ledger & balances ─────────────────────────────────────────────────────────────────────────────────────────────────
  const fin = await order();
  const expectedPaid = second ? 40000 + (REQUIRED_USD * (first.q + second.q)) / QTY : 40000 + owed1;
  check("ledger", "[7] order balances add up (advance 40,000 + remaining = loaded share)", near(fin.adv, 40000, 0.5) && near(fin.rem, expectedPaid - 40000, 0.5), `advance ${fin.adv}, remaining ${fin.rem}, due ${fin.due}`);
  if (second && first.q + second.q === QTY) check("ledger", "[7] fully loaded + fully paid → remaining due 0, payment status completed", near(fin.due, 0, 0.05) && fin.ps === "completed", `due ${fin.due} ${fin.ps}`);
  const vouchers = await sql`
    select p.id::text pid, p.kind::text kind, p.status::text status, p.posted_to_journal, p.roznamcha_entry_id::text rid,
           (select coalesce(sum(l.debit),0)::float from roznamcha_lines l where l.roznamcha_entry_id = p.roznamcha_entry_id) dr,
           (select coalesce(sum(l.credit),0)::float from roznamcha_lines l where l.roznamcha_entry_id = p.roznamcha_entry_id) cr
    from purchase_order_payments p where p.purchase_order_id = ${id} and p.deleted_at is null and p.kind::text in ('advance','remaining')`;
  check("ledger", "[7] every posted payment has its ledger voucher and DR = CR", vouchers.length >= 3 && vouchers.every((v) => v.status === "posted" && v.posted_to_journal && v.rid && near(v.dr, v.cr, 0.01) && v.dr > 0), `${vouchers.length} vouchers`);
  const refs = await sql`select reference_no, count(*)::int n from purchase_order_payments where purchase_order_id = ${id} and deleted_at is null group by 1 having count(*) > 1`;
  check("ledger", "[7] no duplicate posting (every reference used once)", refs.length === 0, JSON.stringify(refs));
  const rid = new Set(vouchers.map((v) => v.rid));
  check("ledger", "[7] one Roznamcha entry per payment (nothing shared or double-booked)", rid.size === vouchers.length);

  // ── 8. branch separation ───────────────────────────────────────────────────────────────────────────────────────────────────
  const stranger = await postLoad(loadBody(`E2E-X-${no}`, 1), otherCookie);
  check("security", "[8] BUG CHECK — another country's admin cannot load this booking", stranger.status === 403 || stranger.status === 404 || stranger.status === 401, `${stranger.status} ${stranger.msg}`);
  const strangerPay = await postPay(pay("remaining", 1), otherCookie);
  check("security", "[8] another country's admin cannot post a payment on it either", strangerPay.status >= 400, `${strangerPay.status}`);
  check("security", "[8] nothing was created by the refused attempts", !(await loads()).some((l) => l.container_number === `E2E-X-${no}`));
} catch (e) {
  results.push({ group: "fatal", name: "unexpected error", ok: false, detail: String(e?.stack || e).slice(0, 400) });
  console.log("FATAL", e?.stack || e);
} finally {
  await sql`update purchase_orders set deleted_at = now() where id = ${id}`.catch(() => {});
  await sql`update purchase_loading_records set deleted_at = now() where purchase_order_id = ${id} and deleted_at is null`.catch(() => {});
  await sql.end({ timeout: 5 });
  const pass = results.filter((r) => r.ok).length;
  const byGroup = {};
  for (const r of results) { const g = (byGroup[r.group] ??= { pass: 0, fail: 0 }); r.ok ? g.pass++ : g.fail++; }
  fs.writeFileSync(`${OUT}/advance-loading-remaining.json`, JSON.stringify({ base: BASE, order: no, pass, fail: results.length - pass, byGroup, results }, null, 2));
  console.log(`\n${pass} PASS / ${results.length - pass} FAIL`, JSON.stringify(byGroup));
  process.exit(results.length - pass ? 1 : 0);
}
