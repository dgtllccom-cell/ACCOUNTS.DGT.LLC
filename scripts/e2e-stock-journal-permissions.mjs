/**
 * DEV ONLY — who may see / act on the Stock Journal, and country / branch data isolation.
 *   BASE=http://localhost:3400 node scripts/e2e-stock-journal-permissions.mjs
 * A real booking (+ loading + receipt + customs) is created in DEV, then every role / scope below tries to read it and to confirm stock.
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

let REAL_USER = null;
const login = async (body) => {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(REAL_USER && body.role !== "super_admin" ? { userId: REAL_USER } : {}), ...body }) });
  const c = (r.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  if (!c) throw new Error("dev-session failed for " + JSON.stringify(body));
  return async (method, path, b) => {
    const rr = await fetch(BASE + path, { method, headers: { cookie: c, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined, redirect: "manual" });
    let j = null; try { j = await rr.json(); } catch {}
    return { status: rr.status, json: j, data: j?.data ?? j };
  };
};
const sa = await login({ role: "super_admin" });
// scoped dev users need a REAL profile id (created_by / stock_movements FKs), exactly like real users have
REAL_USER = (await sql`select id from profiles order by created_at limit 1`)[0].id;

const TAG = "PERMSJ" + String(Date.now()).slice(-6);
const [src] = await sql`select * from purchase_orders where deleted_at is null and jsonb_typeof(form_data)='object' and country_id is not null and city_branch_id is not null order by created_at desc limit 1`;
const scope = { countryId: src.country_id, countryBranchId: src.country_branch_id, cityBranchId: src.city_branch_id };
const [otherCountry] = await sql`select id from countries where id <> ${scope.countryId} order by created_at limit 1`;
const [otherCityBranch] = await sql`select cb.id, cb.country_branch_id, cb.country_id from city_branches cb where cb.id <> ${scope.cityBranchId} and cb.deleted_at is null and cb.country_branch_id is not null order by cb.created_at limit 1`;
const [sibling] = await sql`select id from city_branches where country_branch_id = ${scope.countryBranchId} and id <> ${scope.cityBranchId} and deleted_at is null limit 1`;
const [wh1] = await sql`select id from warehouses where deleted_at is null and country_id = ${scope.countryId} order by created_at limit 1`;
const [goods] = await sql`select id, goods_name from goods where deleted_at is null order by created_at limit 1`;
const poNo = TAG + "-PO";
const over = { id: crypto.randomUUID(), purchase_order_no: poNo, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "Draft", ledger_posting_status: "posted", payment_status: "completed", super_admin_serial_number: null, country_transaction_serial_number: null, branch_transaction_serial_number: null, main_branch_transaction_serial: null, city_branch_transaction_serial: null, super_admin_serial: null, country_serial: null, branch_serial: null, entry_serial: null, global_reference_id: null, dest_country_id: null, dest_country_branch_id: null, dest_city_branch_id: null, purchase_contract_no: null };
const fd = JSON.stringify({ form: {}, goodsEntries: [{ goodsName: goods.goods_name, goodsId: goods.id, qtyNo: 50, qtyName: "BAGS" }] });
const [po] = await sql`insert into purchase_orders select (jsonb_populate_record(null::purchase_orders, to_jsonb(p) || ${sql.json(over)}::jsonb || jsonb_build_object('form_data', to_jsonb(${fd}::text)))).* from purchase_orders p where p.id = ${src.id} returning id`;
const [b0] = await sql`select quantity_on_hand, quantity_reserved from product_inventory_balances where product_id = ${goods.id} and warehouse_id = ${wh1.id}`;

try {
  const l = await sa("POST", "/api/erp/purchases/loading-records", { ...scope, purchaseOrderId: po.id, purchaseOrderNo: poNo, containerNumber: TAG + "-C", loadingStatus: "loaded", loadedQuantity: 50, loadedContainers: 1, transportMode: "By Road", vehicleNo: "T" });
  const [plr] = await sql`select id from purchase_loading_records where purchase_order_id = ${po.id}`;
  await sa("POST", `/api/erp/purchases/loading-records/${plr.id}/receive`, { receivedQuantity: 50, warehouseId: wh1.id, goodsId: goods.id });
  await sa("POST", "/api/erp/inventory/journal-stock/customs", { loadingRecordId: plr.id, customsStatus: "cleared" });
  const find = async (who) => { const r = await who("GET", `/api/erp/inventory/journal-stock?limit=2000&search=${TAG}`); return { status: r.status, rows: (r.data?.rows || []).filter((x) => x.sourceId === po.id), perms: r.data?.permissions }; };
  const ready = (await find(sa)).rows.find((r) => r.stage === "ready");
  check("fixture: 50 received + customs cleared = Ready", !!ready && ready.quantity === 50, l.status + "");
  const body = (k, q = 5) => ({ idempotencyKey: `perm-${TAG}-${k}`, purchaseOrderId: po.id, loadingRecordId: plr.id, lineKey: ready.lineKey, destinationType: "local_sales", warehouseId: wh1.id, quantity: q, authorized: true });

  // ── roles that SHOULD see it ──
  const should = [
    ["Super Admin", { role: "super_admin" }],
    ["Country Admin (same country)", { role: "country_admin", countryId: scope.countryId }],
    ["Main-Branch Admin (same country branch)", { role: "main_branch_admin", countryId: scope.countryId, countryBranchId: scope.countryBranchId }],
    ["City-branch Admin (same city branch)", { role: "city_branch_admin", countryId: scope.countryId, countryBranchId: scope.countryBranchId, cityBranchId: scope.cityBranchId }],
  ];
  for (const [name, b] of should) {
    const who = await login(b);
    const r = await find(who);
    check(`${name}: sees the booking`, r.status === 200 && r.rows.length >= 1, `${r.status} rows=${r.rows.length} perms=${JSON.stringify(r.perms)}`);
    const h = await who("GET", `/api/erp/inventory/journal-stock/history?sourceType=purchase_booking&sourceId=${po.id}`);
    check(`${name}: can open History`, h.status === 200 && (h.data?.events || []).length >= 3, String(h.status));
  }
  // ── scopes that must NOT see it ──
  const shouldNot = [
    ["Country Admin (other country)", { role: "country_admin", countryId: otherCountry.id }],
    ["Main-Branch Admin (other country branch)", { role: "main_branch_admin", countryId: otherCityBranch.country_id, countryBranchId: otherCityBranch.country_branch_id }],
    ["City-branch Admin (other city branch)", { role: "city_branch_admin", countryId: otherCityBranch.country_id, countryBranchId: otherCityBranch.country_branch_id, cityBranchId: otherCityBranch.id }],
    ...(sibling ? [["City-branch Admin (SIBLING city branch, same country branch)", { role: "city_branch_admin", countryId: scope.countryId, countryBranchId: scope.countryBranchId, cityBranchId: sibling.id }]] : []),
  ];
  for (const [name, b] of shouldNot) {
    const who = await login(b);
    const r = await find(who);
    check(`${name}: does NOT see the booking (data isolation)`, r.status === 200 && r.rows.length === 0, `${r.status} rows=${r.rows.length}`);
    const h = await who("GET", `/api/erp/inventory/journal-stock/history?sourceType=purchase_booking&sourceId=${po.id}`);
    check(`${name}: History refused`, h.status === 403, String(h.status));
    const c = await who("POST", "/api/erp/inventory/journal-stock/confirm", body("x" + name.length));
    check(`${name}: Confirm refused`, c.status === 403, String(c.status));
    const cu = await who("POST", "/api/erp/inventory/journal-stock/customs", { loadingRecordId: plr.id, customsStatus: "pending" });
    check(`${name}: Customs change refused`, cu.status === 403, String(cu.status));
    const rv = await who("POST", "/api/erp/inventory/journal-stock/reverse", { transferId: crypto.randomUUID(), reason: "probe" });
    check(`${name}: unknown / foreign allocation cannot be reversed`, rv.status >= 400, String(rv.status));
    if (!/SIBLING/.test(name)) {
      const e = await who("GET", `/api/erp/inventory/journal-stock?countryId=${scope.countryId}`);
      check(`${name}: explicitly asking for this country is refused (403)`, e.status === 403, String(e.status));
    }
  }
  // ── a role with no purchases rights at all ──
  const viewer = await login({ role: "viewer", countryId: scope.countryId });
  const vr = await viewer("GET", "/api/erp/inventory/journal-stock?limit=5");
  check("Viewer (no purchases permission): read refused", vr.status === 403, String(vr.status));
  const vc = await viewer("POST", "/api/erp/inventory/journal-stock/confirm", body("viewer"));
  check("Viewer: confirm refused", vc.status === 403, String(vc.status));
  const vi = await viewer("POST", "/api/erp/inventory/journal-stock/issue", { transferId: crypto.randomUUID(), issueType: "delivery", issueRef: "x" });
  check("Viewer: issue refused", vi.status === 403 || vi.status === 404, String(vi.status));
  // ── unauthenticated ──
  const anon = await fetch(BASE + "/api/erp/inventory/journal-stock", { redirect: "manual" });
  check("No session: redirected to login, no data", anon.status === 307 || anon.status === 401, String(anon.status));
  // ── an allowed branch user can act, and the act is attributed ──
  const bu = await login({ role: "city_branch_admin", countryId: scope.countryId, countryBranchId: scope.countryBranchId, cityBranchId: scope.cityBranchId });
  const ok = await bu("POST", "/api/erp/inventory/journal-stock/confirm", body("ok", 5));
  check("Authorized city-branch admin can confirm 5", ok.status < 300 && ok.data?.transfer?.status === "confirmed", `${ok.status} ${ok.json?.error?.message || ""}`);
  const rb = await bu("POST", "/api/erp/inventory/journal-stock/reverse", { transferId: ok.data?.transfer?.id, reason: "permission test" });
  check("…and reverse it", rb.status < 300 && rb.data?.transfer?.status === "reversed", `${rb.status}`);
} catch (e) {
  fail++; console.log("FATAL", e?.stack || e);
} finally {
  try {
    await sql`delete from stock_movements where purchase_order_id = ${po.id}`;
    await sql`delete from journal_stock_transfers where purchase_order_id = ${po.id}`;
    if (b0) await sql`update product_inventory_balances set quantity_on_hand = ${b0.quantity_on_hand}, quantity_reserved = ${b0.quantity_reserved} where product_id = ${goods.id} and warehouse_id = ${wh1.id}`;
    else await sql`delete from product_inventory_balances where product_id = ${goods.id} and warehouse_id = ${wh1.id}`;
    await sql`delete from purchase_loading_records where purchase_order_id = ${po.id}`;
    await sql`delete from purchase_orders where id = ${po.id}`;
  } catch (e) { console.log("cleanup:", String(e).slice(0, 140)); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
