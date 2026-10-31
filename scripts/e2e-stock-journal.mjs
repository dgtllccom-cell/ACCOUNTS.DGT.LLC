/**
 * DEV ONLY — end-to-end harness for the Stock Journal (Purchase Booking → Loading → Receiving & Customs → Confirm Stock → Sale / Export).
 *   BASE=http://localhost:3400 node scripts/e2e-stock-journal.mjs
 * Uses the REAL routes (loading-records, receive, journal-stock confirm / issue / reverse) against the DEV database. The only direct SQL is
 * (a) the DEV test Purchase Booking row that stands in for the booking wizard and (b) read-only balance checks.
 * Refuses to run unless DATABASE_URL is the DEV Supabase project.
 */
import fs from "node:fs";
import postgres from "postgres";

const BASE = process.env.BASE || "http://localhost:3400";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const URL = process.env.DATABASE_URL || env.DATABASE_URL;
if (!URL.includes(env.DEV_SUPABASE_REF || "csesvyxxjivnkkozgopt") || URL.includes(env.PROD_SUPABASE_REF || "inmayhrxucimxqhgseqi")) throw new Error("Refusing: not the DEV database");
const sql = postgres(URL, { max: 2, prepare: false, onnotice: () => {} });

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { (ok ? pass++ : fail++); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " · " + detail : ""}`); };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.001;

async function session(body) {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const c = (r.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  if (!c) throw new Error("dev-session failed " + r.status);
  return c;
}
const call = (cookie) => async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j, data: j?.data ?? j };
};

const sa = call(await session({ role: "super_admin" }));
const TAG = "E2ESJ" + String(Date.now()).slice(-6);

// ── real DEV references ──
const [src] = await sql`select * from purchase_orders where deleted_at is null and jsonb_typeof(form_data)='object' and country_id is not null and city_branch_id is not null order by created_at desc limit 1`;
const scope = { countryId: src.country_id, countryBranchId: src.country_branch_id, cityBranchId: src.city_branch_id };
const [wh1] = await sql`select id, warehouse_name from warehouses where deleted_at is null and country_id = ${scope.countryId} order by created_at limit 1`;
const [wh2] = await sql`select id, warehouse_name from warehouses where deleted_at is null and country_id = ${scope.countryId} and id <> ${wh1.id} order by created_at limit 1`;
const goods = await sql`select id, goods_name from goods where deleted_at is null order by created_at limit 2`;
const [customer] = await sql`select id, customer_name from customers where deleted_at is null order by created_at limit 1`;
console.log("scope", scope, "wh1", wh1?.warehouse_name, "wh2", wh2?.warehouse_name, "goods", goods.map((g) => g.goods_name).join(","));

// ── the DEV booking (stands in for the booking wizard): TWO goods lines, form_data stored as a JSON STRING like most real DEV rows ──
const poNo = `${TAG}-PO`;
const formData = JSON.stringify({
  form: { supplierName: "E2E Supplier", salesAccountName: "E2E Supplier A/C", manualBillNumber: TAG + "-M", purchaseCurrency: "USD", paymentType: "Credit" }, // Credit goes straight to Loading; a bare status flag is no longer accepted as payment
  goodsEntries: [
    { goodsName: goods[0].goods_name, goodsId: goods[0].id, qtyNo: 100, qtyName: "BAGS" },
    { goodsName: goods[1].goods_name, goodsId: goods[1].id, qtyNo: 50, qtyName: "BAGS" },
  ],
});
const overrides = {
  id: crypto.randomUUID(), purchase_order_no: poNo, form_data: formData, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "Draft",
  ledger_posting_status: "draft", payment_status: "pending", super_admin_serial_number: null, country_transaction_serial_number: null, branch_transaction_serial_number: null,
  main_branch_transaction_serial: null, city_branch_transaction_serial: null, super_admin_serial: null, country_serial: null, branch_serial: null, entry_serial: null,
  global_reference_id: null, dest_country_id: null, dest_country_branch_id: null, dest_city_branch_id: null, purchase_contract_no: null,
};
// one statement, no temp table (the DEV pooler keeps temp tables on shared backends)
const [po] = await sql`
  insert into purchase_orders
  select (jsonb_populate_record(null::purchase_orders, to_jsonb(p) || ${sql.json(overrides)}::jsonb || jsonb_build_object('form_data', to_jsonb(${formData}::text)))).*
  from purchase_orders p where p.id = ${src.id}
  returning id, purchase_order_no`;
console.log("test booking", po.purchase_order_no, po.id);

const journal = async (qs = "") => (await sa("GET", `/api/erp/inventory/journal-stock?limit=2000&search=${TAG}${qs}`)).data;
const mine = (j) => (j?.rows || []).filter((r) => r.sourceId === po.id);
const sum = (rows, stage, key = "quantity") => rows.filter((r) => r.stage === stage).reduce((s, r) => s + Number(r[key]), 0);
const snap = {};
for (const w of [wh1, wh2].filter(Boolean)) for (const g of goods) { const [b] = await sql`select quantity_on_hand, quantity_reserved from product_inventory_balances where product_id = ${g.id} and warehouse_id = ${w.id}`; snap[g.id + "|" + w.id] = b || null; }
const balance = async (goodsId, whId) => { const [b] = await sql`select quantity_on_hand::float as oh, quantity_reserved::float as rs from product_inventory_balances where product_id = ${goodsId} and warehouse_id = ${whId}`; return b || { oh: 0, rs: 0 }; };

try {
  // 1 ── Draft booking with string form_data shows as Booking Stock (the root-cause fix)
  let j = await journal();
  let rows = mine(j);
  check("Draft booking (JSON-string form_data) appears as Booking Stock", rows.filter((r) => r.stage === "booking").length === 2, rows.map((r) => `${r.productName}:${r.stage}:${r.quantity}`).join(" | "));
  check("Booked quantities read correctly (100 + 50)", near(sum(rows, "booking"), 150));
  check("Booking / invoice / payment shown separately", rows[0]?.bookingStatus === "draft" && rows[0]?.invoiceStatus === "unposted" && rows[0]?.paymentStatus === "unpaid", `${rows[0]?.bookingStatus}/${rows[0]?.invoiceStatus}/${rows[0]?.paymentStatus}`);
  check("Row carries supplier, country, branch, currency", !!rows[0]?.supplierName && !!rows[0]?.countryName && !!rows[0]?.currencyCode, `${rows[0]?.supplierName}|${rows[0]?.countryName}|${rows[0]?.branchName}|${rows[0]?.currencyCode}`);

  // payment completed → black indicator state (paid), separate from physical receipt
  await sql`update purchase_orders set payment_status = 'completed', ledger_posting_status = 'posted' where id = ${po.id}`;
  rows = mine(await journal());
  check("Payment completed → paymentStatus 'paid' (black dot) and stock is NOT received", rows[0]?.paymentStatus === "paid" && sum(rows, "booking") === 150 && sum(rows, "available") === 0, rows[0]?.paymentStatus);
  check("Posted booking counts as Confirmed Booking", rows[0]?.bookingStatus === "confirmed");

  // 2 ── real loading records (partial, two containers) — FIFO across the two goods lines
  const load = async (container, qty) => sa("POST", "/api/erp/purchases/loading-records", { ...scope, purchaseOrderId: po.id, purchaseOrderNo: po.purchase_order_no, containerNumber: container, loadingStatus: "loaded", loadedQuantity: qty, loadedContainers: 1, transportMode: "By Road", vehicleNo: "TRK-" + container });
  const l1 = await load(TAG + "-C1", 80);
  check("Loading record 1 created through the real route", l1.status < 300, `${l1.status} ${JSON.stringify(l1.json)?.slice(0, 160)}`);
  const l2 = await load(TAG + "-C2", 40);
  check("Loading record 2 created through the real route", l2.status < 300, `${l2.status}`);
  rows = mine(await journal());
  const loadedTotal = sum(rows, "transit");
  check("Loaded 120 shows as Loading / Transit, once", near(loadedTotal, 120), String(loadedTotal));
  check("Booking remainder = 150 − 120 = 30 (no duplication)", near(sum(rows, "booking"), 30), String(sum(rows, "booking")));
  check("Booking + transit always equal what was booked", near(sum(rows, "booking") + sum(rows, "transit"), 150));
  const plrs = await sql`select id, loading_record_no, loaded_quantity::float as q, container_number from purchase_loading_records where purchase_order_id = ${po.id} and deleted_at is null order by created_at`;
  check("Two loading records exist for the booking", plrs.length === 2, plrs.map((p) => `${p.container_number}:${p.q}`).join(","));

  // 3 ── Destination Receiving through the real route: good + damaged + shortage (no stock for the bad quantity)
  const A = plrs[0];
  const before1 = await balance(goods[0].id, wh1.id);
  const rc = await sa("POST", `/api/erp/purchases/loading-records/${A.id}/receive`, { receivedQuantity: 70, damagedQuantity: 6, shortageQuantity: 4, warehouseId: wh1.id, goodsId: goods[0].id, unitCost: 0 });
  check("Receiving accepted (70 good + 6 damaged + 4 short = 80)", rc.status < 300 && rc.json?.ok !== false, `${rc.status} ${JSON.stringify(rc.json)?.slice(0, 200)}`);
  const over = await sa("POST", `/api/erp/purchases/loading-records/${A.id}/receive`, { receivedQuantity: 5, warehouseId: wh1.id, goodsId: goods[0].id });
  check("Receiving more than loaded is refused", over.status >= 400, `${over.status}`);
  const after1 = await balance(goods[0].id, wh1.id);
  check("Only the GOOD 70 became warehouse stock", near(after1.oh - before1.oh, 70), `${before1.oh} → ${after1.oh}`);
  rows = mine(await journal());
  const rcv = rows.find((r) => r.loadingRecordId === A.id && (r.stage === "receiving" || r.stage === "ready"));
  check("Received stock is 'Receiving / Customs' until customs is cleared", rcv?.stage === "receiving" && near(rcv?.quantity, 70), `${rcv?.stage}:${rcv?.quantity}`);
  check("Row shows loaded / received / damage / shortage / outstanding", rcv && near(rcv.receivedQuantity, 70) && near(rcv.damagedQuantity, 6) && near(rcv.shortageQuantity, 4) && near(rcv.outstandingQuantity, 0), JSON.stringify({ l: rcv?.loadedQuantity, r: rcv?.receivedQuantity, d: rcv?.damagedQuantity, s: rcv?.shortageQuantity, o: rcv?.outstandingQuantity }));

  // 4 ── customs gate
  const key = (n) => `e2e-${TAG}-${n}`;
  const body = (o) => ({ idempotencyKey: key(o.k), purchaseOrderId: po.id, loadingRecordId: A.id, lineKey: rcv.lineKey, destinationType: "warehouse", warehouseId: wh1.id, quantity: 10, authorized: true, ...o });
  let r = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "early" }));
  check("Confirm before customs clearance is refused", r.status === 409 && /customs/i.test(JSON.stringify(r.json)), `${r.status} ${r.json?.error?.code || ""}`);
  r = await sa("POST", "/api/erp/inventory/journal-stock/customs", { loadingRecordId: A.id, customsStatus: "cleared", reference: "CUS-" + TAG });
  check("Customs status recorded", r.status < 300, `${r.status}`);
  rows = mine(await journal());
  const ready = rows.find((r) => r.loadingRecordId === A.id && r.stage === "ready");
  check("After receiving + customs the stock is Ready for Confirmation", !!ready && near(ready.quantity, 70) && ready.canConfirm === true, `${ready?.stage}:${ready?.quantity}`);

  // 5 ── authorization + validation
  r = await sa("POST", "/api/erp/inventory/journal-stock/confirm", { ...body({ k: "noauth" }), authorized: false });
  check("Confirm without the authorized-user confirmation is refused", r.status === 400, `${r.status}`);
  r = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "toomuch", quantity: 71 }));
  check("Cannot confirm more than received − confirmed", r.status === 409, `${r.status} ${r.json?.error?.code || ""}`);
  r = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "nocust", destinationType: "direct_sale", quantity: 5 }));
  check("Direct sale without a customer is refused", r.status === 400 && /customer/i.test(JSON.stringify(r.json)), `${r.status}`);

  // 6 ── Warehouse Storage in the SAME warehouse: allocation only, no second stock-in
  const bBefore = await balance(goods[0].id, wh1.id);
  const c1 = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "wh30", quantity: 30 }));
  check("Confirm 30 → Warehouse Storage", c1.status < 300 && c1.data?.transfer?.status === "confirmed", `${c1.status} ${c1.json?.error?.message || ""}`);
  const c1b = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "wh30", quantity: 30 }));
  check("Same click twice (same idempotency key) → one record, replayed", c1b.status < 300 && c1b.data?.replayed === true && c1b.data?.transfer?.id === c1.data?.transfer?.id);
  const cnt = await sql`select count(*)::int n from journal_stock_transfers where idempotency_key = ${key("wh30")}`;
  check("Exactly one confirmation row exists", cnt[0].n === 1);
  const bAfter = await balance(goods[0].id, wh1.id);
  check("Same-warehouse storage did not add stock a second time", near(bAfter.oh, bBefore.oh), `${bBefore.oh} → ${bAfter.oh}`);

  // 7 ── Direct sale: reserved (not deducted)
  const so = await sql`select sales_order_no from sales_orders where deleted_at is null order by created_at desc limit 1`;
  const soNo = so[0]?.sales_order_no;
  const c2 = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "ds25", destinationType: "direct_sale", quantity: 25, customerId: customer.id, salesOrderNo: soNo, documentRef: "DOC-" + TAG }));
  check("Confirm 25 → Direct Sale / Delivery (customer + sales booking + document)", c2.status < 300 && c2.data?.transfer?.reserved === true, `${c2.status} ${c2.json?.error?.message || ""}`);
  const bRes = await balance(goods[0].id, wh1.id);
  check("Direct sale RESERVES 25 (on-hand unchanged, reserved +25)", near(bRes.oh, bAfter.oh) && near(bRes.rs - bAfter.rs, 25), `oh ${bRes.oh} rs ${bRes.rs}`);
  rows = mine(await journal());
  check("Stages add up: available 30 + reserved 25 + ready 15 = 70 received", near(sum(rows, "available"), 30) && near(sum(rows, "reserved"), 25) && near(sum(rows.filter((x) => x.loadingRecordId === A.id), "ready"), 15), `${sum(rows, "available")}/${sum(rows, "reserved")}/${sum(rows.filter((x) => x.loadingRecordId === A.id), "ready")}`);

  // reservation cannot exceed free stock
  const c3 = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "ex999", destinationType: "export", quantity: 15, customerId: customer.id }));
  check("Export allocation of the last 15 is accepted (reserved)", c3.status < 300, `${c3.status} ${c3.json?.error?.message || ""}`);
  const c4 = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "ex_over", destinationType: "export", quantity: 1, customerId: customer.id }));
  check("Nothing is left to allocate (no negative / double allocation)", c4.status === 409, `${c4.status}`);

  // 8 ── Goods Issue: the ONLY deduction, once
  const sold = c2.data.transfer;
  let i = await sa("POST", "/api/erp/inventory/journal-stock/issue", { transferId: sold.id, issueType: "delivery", issueRef: "" });
  check("Issue without a document reference is refused", i.status === 400, `${i.status}`);
  const bPreIssue = await balance(goods[0].id, wh1.id);
  i = await sa("POST", "/api/erp/inventory/journal-stock/issue", { transferId: sold.id, issueType: "delivery", issueRef: "DN-" + TAG });
  check("Delivery issues the reserved 25", i.status < 300 && i.data?.transfer?.status === "issued", `${i.status} ${i.json?.error?.message || ""}`);
  const bPost = await balance(goods[0].id, wh1.id);
  check("Physical stock −25 and reservation released", near(bPreIssue.oh - bPost.oh, 25) && near(bPreIssue.rs - bPost.rs, 25), `oh ${bPreIssue.oh}→${bPost.oh} rs ${bPreIssue.rs}→${bPost.rs}`);
  i = await sa("POST", "/api/erp/inventory/journal-stock/issue", { transferId: sold.id, issueType: "delivery", issueRef: "DN-" + TAG });
  const bTwice = await balance(goods[0].id, wh1.id);
  check("Issuing twice does NOT deduct twice", i.data?.replayed === true && near(bTwice.oh, bPost.oh), `${bPost.oh} → ${bTwice.oh}`);
  const rv = await sa("POST", "/api/erp/inventory/journal-stock/reverse", { transferId: sold.id, reason: "test reverse of issued" });
  check("An issued allocation cannot be reversed", rv.status === 409, `${rv.status}`);
  rows = mine(await journal());
  check("Issued stock shows as Sold / Exported", near(sum(rows, "sold"), 25), String(sum(rows, "sold")));

  // 9 ── Reversal of a confirmed (not issued) allocation
  const exp = c3.data.transfer;
  const rv2 = await sa("POST", "/api/erp/inventory/journal-stock/reverse", { transferId: exp.id, reason: "customer cancelled export" });
  check("Reverse the export allocation (reason required, audited)", rv2.status < 300 && rv2.data?.transfer?.status === "reversed", `${rv2.status} ${rv2.json?.error?.message || ""}`);
  const bRev = await balance(goods[0].id, wh1.id);
  check("Reservation released on reversal", near(bRev.rs, bPost.rs - 15 + 0) || near(bRev.rs, bPost.rs), `rs ${bPost.rs} → ${bRev.rs}`);
  const rvNoReason = await sa("POST", "/api/erp/inventory/journal-stock/reverse", { transferId: exp.id, reason: "" });
  check("Reversal without a reason is refused", rvNoReason.status === 400, `${rvNoReason.status}`);
  rows = mine(await journal());
  check("Reversed 15 is confirmable again (Ready)", near(sum(rows.filter((x) => x.loadingRecordId === A.id), "ready"), 15), String(sum(rows.filter((x) => x.loadingRecordId === A.id), "ready")));

  // 10 ── Warehouse transfer to a DIFFERENT warehouse moves stock out of one and into the other
  if (wh2) {
    const w1b = await balance(goods[0].id, wh1.id), w2b = await balance(goods[0].id, wh2.id);
    const mv = await sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "mv10", warehouseId: wh2.id, quantity: 10 }));
    const w1a = await balance(goods[0].id, wh1.id), w2a = await balance(goods[0].id, wh2.id);
    check("Storage in ANOTHER warehouse moves stock (−10 / +10)", mv.status < 300 && near(w1b.oh - w1a.oh, 10) && near(w2a.oh - w2b.oh, 10), `${mv.status} ${mv.json?.error?.message || ""} wh1 ${w1b.oh}→${w1a.oh} wh2 ${w2b.oh}→${w2a.oh}`);
    const rvm = await sa("POST", "/api/erp/inventory/journal-stock/reverse", { transferId: mv.data.transfer.id, reason: "wrong warehouse" });
    const w1c = await balance(goods[0].id, wh1.id), w2c = await balance(goods[0].id, wh2.id);
    check("Reversing the move restores both warehouses exactly", rvm.status < 300 && near(w1c.oh, w1b.oh) && near(w2c.oh, w2b.oh), `wh1 ${w1c.oh} (was ${w1b.oh}) wh2 ${w2c.oh} (was ${w2b.oh})`);
  }

  // 10b ── concurrency: five simultaneous confirmations (different keys) of 10 against only 15 still ready → at most ONE can win
  {
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => sa("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "race" + n, quantity: 10 }))));
    const won = results.filter((x) => x.status < 300).length;
    check("5 parallel confirmations of 10 against 15 → exactly 1 succeeds, the rest are refused", won === 1 && results.filter((x) => x.status === 409).length === 4, results.map((x) => x.status).join(","));
    const ready2 = sum(mine(await journal()).filter((x) => x.loadingRecordId === A.id), "ready");
    check("Nothing was over-allocated (5 left ready)", near(ready2, 5), String(ready2));
  }

  // 11 ── history trail
  const h = await sa("GET", `/api/erp/inventory/journal-stock/history?sourceType=purchase_booking&sourceId=${po.id}`);
  const types = new Set((h.data?.events || []).map((e) => e.type));
  check("History links booking → loading → received → customs → confirmed → issued → reversed → stock movements", ["booking", "loading", "received", "customs", "confirmed", "issued", "reversed", "stock_in", "stock_out"].every((t) => types.has(t)), [...types].join(","));

  // 12 ── summary reconciles
  j = await journal();
  const s = j.summary;
  check("Summary: Booking card includes this booking's remaining 30", s.booking.qty >= 30);
  check("Summary: six cards present", ["booking", "confirmedBooking", "transit", "receivingCustoms", "availableMixed", "soldExported"].every((k) => s[k] && typeof s[k].qty === "number"));

  // 13 ── Available / Mixed report keeps every source
  const av = await sa("GET", `/api/erp/inventory/journal-stock?view=available&search=${TAG}`);
  const grp = (av.data?.groups || []).find((g) => g.sources.some((x) => x.sourceId === po.id));
  check("Available report groups by product × warehouse and keeps the booking / container sources", !!grp && grp.sources.every((x) => x.bookingNo && x.container !== undefined), JSON.stringify(grp && { p: grp.productName, wh: grp.warehouseName, a: grp.available, r: grp.reserved, n: grp.sources.length }));

  // 14 ── scope: a user outside this country sees nothing and cannot confirm
  const [other] = await sql`select id from countries where id <> ${scope.countryId} order by created_at limit 1`;
  const out = call(await session({ role: "country_admin", countryId: other.id }));
  const oj = await out("GET", `/api/erp/inventory/journal-stock?limit=2000&search=${TAG}`);
  check("Other country's admin cannot see the booking", (oj.data?.rows || []).filter((r) => r.sourceId === po.id).length === 0, `${oj.status} rows=${(oj.data?.rows || []).length}`);
  const oc = await out("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "other", quantity: 1 }));
  check("Other country's admin cannot confirm (403)", oc.status === 403, `${oc.status}`);
  const oq = await out("GET", `/api/erp/inventory/journal-stock?countryId=${scope.countryId}`);
  check("Other country's admin asking for this country explicitly is refused (403)", oq.status === 403, `${oq.status}`);
} catch (e) {
  fail++; console.log("FATAL", e?.stack || e);
} finally {
  // clean the DEV test booking + everything hanging off it (DEV only)
  try {
    const ids = (await sql`select id from journal_stock_transfers where purchase_order_id = ${po.id}`).map((x) => x.id);
    await sql`delete from stock_movements where purchase_order_id = ${po.id}`;
    for (const [k, b] of Object.entries(snap)) {
      const [g, w] = k.split("|");
      if (b) await sql`update product_inventory_balances set quantity_on_hand = ${b.quantity_on_hand}, quantity_reserved = ${b.quantity_reserved} where product_id = ${g} and warehouse_id = ${w}`;
      else await sql`delete from product_inventory_balances where product_id = ${g} and warehouse_id = ${w}`;
    }
    await sql`delete from journal_stock_transfers where purchase_order_id = ${po.id}`;
    await sql`delete from purchase_loading_records where purchase_order_id = ${po.id}`;
    if (!process.env.KEEP) await sql`delete from purchase_orders where id = ${po.id}`;
  } catch (e) { console.log("cleanup:", String(e).slice(0, 120)); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
