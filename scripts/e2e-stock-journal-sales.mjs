/**
 * DEV ONLY — (1) real Sales posting route issues the Stock Journal allocation linked to its sales booking exactly once,
 *            (2) customs status is matched from a Clearing order leg by container / B/L.
 *   BASE=http://localhost:3400 node scripts/e2e-stock-journal-sales.mjs
 * Test sales postings are written to the DEV database only (tagged E2ESJS…). Refuses to run on anything but DEV.
 */
import fs from "node:fs";
import postgres from "postgres";

const BASE = process.env.BASE || "http://localhost:3400";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const DB = process.env.DATABASE_URL || env.DATABASE_URL;
if (!DB.includes(env.DEV_SUPABASE_REF || "csesvyxxjivnkkozgopt") || DB.includes(env.PROD_SUPABASE_REF || "inmayhrxucimxqhgseqi")) throw new Error("Refusing: not the DEV database");
const sql = postgres(DB, { max: 2, prepare: false, onnotice: () => {} });
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { (ok ? pass++ : fail++); console.log(`${ok ? "PASS" : "FAIL"} ${n}${d ? " · " + d : ""}`); };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.001;

const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = (r0.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
const call = async (method, path, body, extra = {}) => {
  const r = await fetch(BASE + path, { method, headers: { cookie, "content-type": "application/json", ...extra }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j, data: j?.data ?? j };
};

const TAG = "E2ESJS" + String(Date.now()).slice(-6);
const [src] = await sql`select * from purchase_orders where deleted_at is null and jsonb_typeof(form_data)='object' and country_id is not null and city_branch_id is not null order by created_at desc limit 1`;
const scope = { countryId: src.country_id, countryBranchId: src.country_branch_id, cityBranchId: src.city_branch_id };
const [wh1] = await sql`select id, warehouse_name from warehouses where deleted_at is null and country_id = ${scope.countryId} order by created_at limit 1`;
const [goods] = await sql`select id, goods_name from goods where deleted_at is null order by created_at limit 1`;
const [customer] = await sql`select id, customer_name from customers where deleted_at is null and customer_name is not null order by created_at limit 1`;
const accts = await sql`select ea.id, ea.account_number, ea.name, l.id as ledger_id from enterprise_accounts ea join ledgers l on l.enterprise_account_id = ea.id where (ea.country_id = ${scope.countryId} or ea.country_id is null) and ea.deleted_at is null and ea.currency = 'USD' and ea.account_number is not null order by ea.created_at limit 4`;
if (accts.length < 2) { console.log("FATAL: need two USD accounts with ledgers in the DEV country"); process.exit(2); }

const poNo = `${TAG}-PO`;
const formData = JSON.stringify({ form: { salesAccountName: "E2E Supplier" }, goodsEntries: [{ goodsName: goods.goods_name, goodsId: goods.id, qtyNo: 100, qtyName: "BAGS" }] });
const poOver = { id: crypto.randomUUID(), purchase_order_no: poNo, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "Draft", ledger_posting_status: "posted", payment_status: "completed", super_admin_serial_number: null, country_transaction_serial_number: null, branch_transaction_serial_number: null, main_branch_transaction_serial: null, city_branch_transaction_serial: null, super_admin_serial: null, country_serial: null, branch_serial: null, entry_serial: null, global_reference_id: null, dest_country_id: null, dest_country_branch_id: null, dest_city_branch_id: null, purchase_contract_no: null };
const [po] = await sql`insert into purchase_orders select (jsonb_populate_record(null::purchase_orders, to_jsonb(p) || ${sql.json(poOver)}::jsonb || jsonb_build_object('form_data', to_jsonb(${formData}::text)))).* from purchase_orders p where p.id = ${src.id} returning id`;
const [bal0] = await sql`select quantity_on_hand::float oh, quantity_reserved::float rs from product_inventory_balances where product_id = ${goods.id} and warehouse_id = ${wh1.id}`;
const snap = bal0 || null;

// sales booking (stands in for the wizard's saved booking): unposted, two accounts, USD
const soNo = `${TAG}-SO`;
const soForm = { form: { customerAccountNo: accts[0].account_number, salesAccountNo: accts[1].account_number, customerAccountId: accts[0].id, customerAccountLedgerId: accts[0].ledger_id, salesAccountLedgerId: accts[1].id, paymentType: "Advance Payment", goodsName: goods.goods_name, customerName: customer.customer_name, qtyNo: 25 }, goodsEntries: [{ goodsName: goods.goods_name, qtyNo: 25, qtyName: "BAGS" }] };
const [srcSo] = await sql`select * from sales_orders where deleted_at is null and sales_order_no = 'SO-DEV-0001'`;
const soOver = { id: crypto.randomUUID(), sales_order_no: soNo, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ledger_posting_status: "unposted", payment_status: "pending", currency_code: "USD", exchange_rate: 1, order_total: 1000, total_goods_original: 1000, total_goods_usd: 1000, total_goods_local: 1000, form_data: soForm, customer_account_id: accts[0].id, country_id: scope.countryId, country_branch_id: scope.countryBranchId, city_branch_id: scope.cityBranchId, super_admin_serial_number: null, country_transaction_serial_number: null, branch_transaction_serial_number: null, super_admin_serial: null, country_serial: null, branch_serial: null, entry_serial: null, global_reference_id: null, is_edited_since_transfer: false };
const [so] = await sql`insert into sales_orders select (jsonb_populate_record(null::sales_orders, to_jsonb(s) || ${sql.json(soOver)}::jsonb)).* from sales_orders s where s.id = ${srcSo.id} returning id, sales_order_no`;

const load = (c, q) => call("POST", "/api/erp/purchases/loading-records", { ...scope, purchaseOrderId: po.id, purchaseOrderNo: poNo, containerNumber: c, loadingStatus: "loaded", loadedQuantity: q, loadedContainers: 1, transportMode: "By Road", vehicleNo: "TRK-" + c });
const balance = async () => { const [b] = await sql`select quantity_on_hand::float oh, quantity_reserved::float rs from product_inventory_balances where product_id = ${goods.id} and warehouse_id = ${wh1.id}`; return b || { oh: 0, rs: 0 }; };
let leg = null, legBefore = null;

try {
  await load(TAG + "-C1", 60); await load(TAG + "-C2", 40);
  const plrs = await sql`select id, container_number from purchase_loading_records where purchase_order_id = ${po.id} and deleted_at is null order by created_at`;
  for (const p of plrs) {
    const q = p.container_number.endsWith("C1") ? 60 : 40;
    const rc = await call("POST", `/api/erp/purchases/loading-records/${p.id}/receive`, { receivedQuantity: q, warehouseId: wh1.id, goodsId: goods.id });
    check(`received ${p.container_number}`, rc.status < 300, String(rc.status));
  }
  const rowsOf = async () => ((await call("GET", `/api/erp/inventory/journal-stock?limit=2000&search=${TAG}`)).data?.rows || []).filter((r) => r.sourceId === po.id);

  // ── Customs matching from a Clearing order leg (container / B/L) ──
  [leg] = await sql`select id, container_number, bl_number, customs_status from clearing_customer_order_legs where deleted_at is null order by created_at limit 1`;
  legBefore = { ...leg };
  await sql`update clearing_customer_order_legs set container_number = ${TAG + "-C1"}, customs_status = 'pending' where id = ${leg.id}`;
  let rows = await rowsOf();
  let c1 = rows.find((r) => r.truckOrContainer === TAG + "-C1" && (r.stage === "receiving" || r.stage === "ready"));
  check("Clearing leg (same container) with customs 'pending' → row is Receiving / Customs, source = clearing order", c1?.stage === "receiving" && c1.customsStatus === "pending", `${c1?.stage}/${c1?.customsStatus}`);
  const key = (n) => `e2es-${TAG}-${n}`;
  const body = (o) => ({ idempotencyKey: key(o.k), purchaseOrderId: po.id, loadingRecordId: plrs[0].id, lineKey: c1.lineKey, destinationType: "warehouse", warehouseId: wh1.id, quantity: 10, authorized: true, ...o });
  let r = await call("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "blocked" }));
  check("Pending customs (from Clearing) blocks Confirm Stock", r.status === 409 && /customs/i.test(JSON.stringify(r.json)), `${r.status}`);
  await sql`update clearing_customer_order_legs set customs_status = 'submitted' where id = ${leg.id}`;
  c1 = (await rowsOf()).find((x) => x.truckOrContainer === TAG + "-C1" && (x.stage === "receiving" || x.stage === "ready"));
  check("Customs 'submitted' still blocks (Receiving / Customs)", c1?.stage === "receiving" && c1.customsStatus === "submitted", `${c1?.stage}/${c1?.customsStatus}`);
  await sql`update clearing_customer_order_legs set customs_status = 'cleared' where id = ${leg.id}`;
  c1 = (await rowsOf()).find((x) => x.truckOrContainer === TAG + "-C1" && (x.stage === "receiving" || x.stage === "ready"));
  check("Clearing leg 'cleared' → Ready for Confirmation (automatic match by container)", c1?.stage === "ready" && c1.customsStatus === "cleared", `${c1?.stage}/${c1?.customsStatus}`);
  // match by B/L number too
  await sql`update clearing_customer_order_legs set container_number = ${legBefore.container_number}, bl_number = ${TAG + "-BL"}, customs_status = 'pending' where id = ${leg.id}`;
  await sql`update purchase_loading_records set bl_number = ${TAG + "-BL"} where id = ${plrs[0].id}`;
  c1 = (await rowsOf()).find((x) => x.loadingRecordId === plrs[0].id && (x.stage === "receiving" || x.stage === "ready"));
  check("Customs also matches by B/L number", c1?.stage === "receiving" && c1.customsStatus === "pending", `${c1?.stage}/${c1?.customsStatus}`);
  await sql`update clearing_customer_order_legs set customs_status = 'cleared' where id = ${leg.id}`;
  // a manual status on the loading record wins over the clearing leg
  await call("POST", "/api/erp/inventory/journal-stock/customs", { loadingRecordId: plrs[1].id, customsStatus: "cleared", reference: "MAN-" + TAG });
  const c2 = (await rowsOf()).find((x) => x.loadingRecordId === plrs[1].id && x.stage === "ready");
  check("Manual customs status on a loading record is honoured", !!c2 && c2.customsStatus === "cleared");

  // ── Sales posting issues the linked allocation exactly once ──
  c1 = (await rowsOf()).find((x) => x.loadingRecordId === plrs[0].id && x.stage === "ready");
  const conf = await call("POST", "/api/erp/inventory/journal-stock/confirm", body({ k: "ds", destinationType: "direct_sale", quantity: 25, customerId: customer.id, salesOrderNo: soNo, documentRef: "D-" + TAG }));
  check("Direct-sale allocation linked to the sales booking number", conf.status < 300 && conf.data?.transfer?.sales_order_no === soNo, `${conf.status} ${conf.json?.error?.message || ""}`);
  const b1 = await balance();
  const post = await call("POST", `/api/erp/sales/orders/${so.id}/transfer`, { paymentKind: "Advance Payment" }, { "idempotency-key": "k-" + TAG });
  check("REAL sales posting route succeeded", post.status < 300, `${post.status} ${JSON.stringify(post.json)?.slice(0, 220)}`);
  const [t] = await sql`select status, issue_type, issue_ref, quantity::float q from journal_stock_transfers where id = ${conf.data.transfer.id}`;
  check("Sales posting issued the allocation (delivery, ref = sales booking)", t?.status === "issued" && t.issue_type === "delivery" && t.issue_ref === soNo, JSON.stringify(t));
  const b2 = await balance();
  check("Warehouse stock −25 once, reservation released", near(b1.oh - b2.oh, 25) && near(b1.rs - b2.rs, 25), `oh ${b1.oh}→${b2.oh} rs ${b1.rs}→${b2.rs}`);
  const post2 = await call("POST", `/api/erp/sales/orders/${so.id}/transfer`, { paymentKind: "Advance Payment" }, { "idempotency-key": "k2-" + TAG });
  const b3 = await balance();
  check("Posting the same sales booking again is refused and deducts nothing", post2.status >= 400 && near(b3.oh, b2.oh), `${post2.status} oh ${b2.oh}→${b3.oh}`);
  const moves = await sql`select count(*)::int n from stock_movements where reference_no = ${conf.data.transfer.transfer_no} and movement_type = 'STOCK_OUT'`;
  check("Exactly one STOCK_OUT movement for the allocation", moves[0].n === 1, String(moves[0].n));
  const jr = await sql`select count(*)::int n from roznamcha_entries where reference_no like ${"%" + soNo + "%"}`;
  console.log("   (sales posting wrote", jr[0].n, "roznamcha entry/entries — DEV only)");
} catch (e) {
  fail++; console.log("FATAL", e?.stack || e);
} finally {
  try {
    if (leg && legBefore) await sql`update clearing_customer_order_legs set container_number = ${legBefore.container_number}, bl_number = ${legBefore.bl_number}, customs_status = ${legBefore.customs_status} where id = ${leg.id}`;
    await sql`delete from stock_movements where purchase_order_id = ${po.id}`;
    await sql`delete from journal_stock_transfers where purchase_order_id = ${po.id}`;
    if (snap) await sql`update product_inventory_balances set quantity_on_hand = ${snap.oh}, quantity_reserved = ${snap.rs} where product_id = ${goods.id} and warehouse_id = ${wh1.id}`;
    else await sql`delete from product_inventory_balances where product_id = ${goods.id} and warehouse_id = ${wh1.id}`;
    await sql`delete from purchase_loading_records where purchase_order_id = ${po.id}`;
    await sql`delete from purchase_orders where id = ${po.id}`;
  } catch (e) { console.log("cleanup:", String(e).slice(0, 160)); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
