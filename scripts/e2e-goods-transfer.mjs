/**
 * Goods Transfer Journal — end-to-end harness (DEV ONLY).
 *
 * Drives the REAL API (dev-session cookie) and checks the REAL database:
 * purchase → posting → lots → own/DGT/third-party warehouse → sale / export → inter-country trade,
 * plus idempotency, concurrency, over-quantity, cancel/return, reconciliation and scope isolation.
 *
 *   ALLOW_DEV_SESSION=true must be set on the dev server (port from BASE, default 3240).
 *   node scripts/e2e-goods-transfer.mjs [section,section...]
 *
 * Refuses to run against anything but the DEV Supabase project (csesvyxxjivnkkozgopt).
 */
import fs from "node:fs";
import postgres from "postgres";

const BASE = process.env.BASE || "http://localhost:3240";
const only = (process.argv[2] || "").split(",").filter(Boolean);

function envUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const t = fs.readFileSync(".env.local", "utf8");
  return t.match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
}
const URL_ = envUrl();
if (!/csesvyxxjivnkkozgopt/.test(URL_)) {
  console.error("REFUSING TO RUN: DATABASE_URL is not the DEV project (csesvyxxjivnkkozgopt). Production is never used for tests.");
  process.exit(2);
}
const sql = postgres(URL_, { max: 3, prepare: false, ssl: "require" });

// ---- tiny assertion framework
const results = [];
function check(section, name, ok, detail = "") {
  results.push({ section, name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${section}] ${name}${!ok && detail ? "  -> " + detail : ""}`);
}
const near = (a, b, eps = 0.0051) => Math.abs(Number(a) - Number(b)) <= eps;

// ---- sessions (cookie jars)
async function login(body) {
  const r = await fetch(`${BASE}/api/erp/auth/dev-session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("dev-session failed: " + r.status);
  const cookies = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return async (method, path, payload) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: { "content-type": "application/json", cookie: cookies }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, data: json?.data, err: json?.error?.message || json?.error };
  };
}

const PK = { country: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", branch: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", city: "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b" };
const AE = { country: "935dd0b9-8228-43b3-b53d-c06e9ae2882f", branch: "87c2e253-b6c1-482d-a808-272337f3ffda", code: "ARE-MAIN-001", city: "b5e94645-05c1-4420-8ecb-141ca7d84f12" };
const key = () => "k" + Math.random().toString(36).slice(2, 14);
const run = "T" + Date.now().toString(36).slice(-5);

async function main() {
  const admin = await login({ role: "super_admin" });
  const realUser = "00000000-0000-4000-8000-000000000001"; // an existing DEV profile (FKs such as stock_movements.created_by need a real one)
  const pkAdmin = await login({ role: "country_admin", countryId: PK.country, userId: realUser });
  const aeAdmin = await login({ role: "country_admin", countryId: AE.country, userId: realUser });

  // ---- fixtures from DEV (existing records only)
  const wh = await sql`select w.id, w.warehouse_code, w.country_id from public.warehouses w where w.deleted_at is null and w.warehouse_code like 'DEV-PK-QUETTA-WH-%' order by w.warehouse_code limit 6`;
  const [WA, WB, WC] = wh;
  const aeWh = (await sql`select id, warehouse_code from public.warehouses where deleted_at is null and country_id = ${AE.country}::uuid order by warehouse_code limit 3`);
  const goodsRows = await sql`select id, goods_name from public.goods where goods_name in ('Pistachio In-Shell','Walnut In-Shell') and deleted_at is null`;
  const gP = goodsRows.find((g) => g.goods_name === "Pistachio In-Shell");
  const gW = goodsRows.find((g) => g.goods_name === "Walnut In-Shell");
  const ledgers = await sql`
    select l.id, l.code, l.enterprise_account_id,
      coalesce(l.country_id,(select c.country_id from public.city_branches c where c.id=l.city_branch_id),(select b.country_id from public.country_branches b where b.id=l.country_branch_id)) as cty
    from public.ledgers l where l.deleted_at is null and l.code not in ('1001','1002') order by l.code`;
  const pkL = ledgers.filter((l) => l.cty === PK.country && l.enterprise_account_id);
  const aeL = ledgers.filter((l) => l.cty === AE.country);
  const [cust, salesL, cogsL, recvL, expSalesL] = pkL;
  const [aeInv, aePay] = aeL;
  const provider = (await sql`select id from public.enterprise_accounts where deleted_at is null limit 1`)[0];
  console.log(`fixtures: wh=${wh.length} pkLedgers=${pkL.length} aeLedgers=${aeL.length} aeWh=${aeWh.length} run=${run}`);
  if (!WA || !WB || !gP || !gW || pkL.length < 5 || aeL.length < 2 || aeWh.length < 1) throw new Error("DEV fixtures missing");

  const pibQty = async (goodsId, whId) => {
    const r = (await sql`select quantity_on_hand, quantity_reserved from public.product_inventory_balances where product_id=${goodsId}::uuid and warehouse_id=${whId}::uuid`)[0];
    return { onHand: Number(r?.quantity_on_hand ?? 0), reserved: Number(r?.quantity_reserved ?? 0) };
  };
  const lotStock = async (lotId) => (await sql`select state, warehouse_id, location_label, rack_bin, qty::float8 as qty from public.lot_stock where lot_id=${lotId}::uuid order by state, rack_bin`);
  const sum = (rows, f) => rows.filter(f).reduce((s, r) => s + Number(r.qty), 0);
  const rozCount = async (ref) => Number((await sql`select count(*)::int c from public.roznamcha_entries where source_transaction_id::text = ${ref} and deleted_at is null`)[0].c);

  // =============================================================================================
  // SECTION A — purchase → posting → lots
  // =============================================================================================
  const purchasePayload = (suffix) => ({
    countryId: PK.country, countryBranchId: PK.branch, cityBranchId: PK.city,
    goodsId: gP.id, purchaseAccountNo: "1002", salesAccountNo: "1001", goodsName: "Pistachio In-Shell + Walnut In-Shell",
    supplierName: `E2E Supplier ${run}${suffix}`, paymentMode: "Credit", shippingMode: "Local Market", originCountryName: "Local",
    quantityName: "Bags", quantityKgs: 140, totalGrossWeight: 7000, emptyKgs: 0, netWeight: 7000, divideKgs: 1, numbers: 140,
    purchaseRate: 44.2857, purchaseCurrency: "PKR", exchangeRate: 1, localCurrency: "PKR", purchaseCost: 310000, finalCost: 310000,
    lotNo: `E2E-${run}${suffix}`,
    lineItems: [
      { id: `l1-${run}${suffix}`, goodsId: gP.id, goodsName: "Pistachio In-Shell", brand: "-", size: "-", origin: "Local", numbers: 100, quantityCount: 100, quantityName: "Bags", netWeight: 5000, totalGrossWeight: 5000, finalCost: 250000, amount: 250000 },
      { id: `l2-${run}${suffix}`, goodsId: gW.id, goodsName: "Walnut In-Shell", brand: "-", size: "-", origin: "Local", numbers: 40, quantityCount: 40, quantityName: "Bags", netWeight: 2000, totalGrossWeight: 2000, finalCost: 60000, amount: 60000 },
    ],
    extraCharges: [{ id: "c1", label: "Freight", amount: 800, allocate: true }, { id: "c2", label: "Unloading", amount: 400, allocate: false }],
  });
  async function newPostedPurchase(suffix) {
    const c = await admin("POST", "/api/erp/purchases/local-purchase", purchasePayload(suffix));
    const id = c.data?.purchase?.id ?? c.data?.id ?? c.json?.data?.id;
    if (!id) throw new Error("create purchase failed: " + c.status + " " + c.err);
    const a = await admin("POST", "/api/erp/purchases/local-purchase/accept", { purchaseId: id });
    if (a.status >= 300) throw new Error("accept failed: " + a.err);
    const t = await admin("POST", "/api/erp/purchases/local-purchase/transfer", { purchaseId: id });
    if (t.status >= 300) throw new Error("transfer failed: " + t.err);
    return id;
  }

  const P1 = await newPostedPurchase("a");
  const lots1 = await sql`select * from public.purchase_lots where local_purchase_id = ${P1}::uuid order by line_key`;
  check("A", "posting created one permanent lot per purchase line", lots1.length === 2, `got ${lots1.length}`);
  const lotP = lots1.find((l) => l.goods_name === "Pistachio In-Shell");
  const lotW = lots1.find((l) => l.goods_name === "Walnut In-Shell");
  check("A", "lot original costs add up to the posted amount (310,000)", near(Number(lotP.original_cost) + Number(lotW.original_cost), 310000));
  check("A", "freight (800) allocated by net weight into landed cost", near(Number(lotP.landed_cost) - Number(lotP.original_cost), 571.4286, 0.01) && near(Number(lotW.landed_cost) - Number(lotW.original_cost), 228.5714, 0.01));
  check("A", "unallocated charge (unloading) is NOT in landed cost", near(Number(lotP.landed_cost) + Number(lotW.landed_cost), 310800, 0.02));
  const pRow = (await sql`select roznamcha_entry_id, status from public.local_purchases where id=${P1}::uuid`)[0];
  check("A", "purchase posted with exactly one Roznamcha entry", pRow.status === "posted" && (await rozCount(P1)) === 1);
  const rozLines = await sql`select debit::float8 d, credit::float8 c, ledger_id from public.roznamcha_lines where roznamcha_entry_id=${pRow.roznamcha_entry_id}::uuid`;
  check("A", "purchase posting is balanced DR=CR=310,000 (Credit purchase → payable)", near(sum(rozLines.map((r) => ({ qty: r.d })), () => true), 310000) && near(sum(rozLines.map((r) => ({ qty: r.c })), () => true), 310000));
  check("A", "lot remembers the posting's purchase & payable ledgers + Roznamcha entry", !!lotP.purchase_ledger_id && !!lotP.payable_ledger_id && lotP.roznamcha_entry_id === pRow.roznamcha_entry_id);
  const st0 = await lotStock(lotP.id);
  check("A", "initial stock = full quantity available at the purchase location", st0.length === 1 && st0[0].state === "available" && near(st0[0].qty, 100));
  const j0 = await admin("GET", `/api/erp/purchases/local-purchase/${P1}/goods-transfer`);
  check("A", "journal GET returns lots, balances and movements", j0.status === 200 && j0.data.lots.length === 2 && j0.data.movements.length >= 2);
  const lotsAfterGet = Number((await sql`select count(*)::int c from public.purchase_lots where local_purchase_id=${P1}::uuid`)[0].c);
  check("A", "opening the journal again never recreates lots", lotsAfterGet === 2);

  // =============================================================================================
  // SECTION B — own warehouse, rack/bin move
  // =============================================================================================
  const base = { A: await pibQty(gP.id, WA.id), B: await pibQty(gP.id, WB.id) };
  const J = `/api/erp/purchases/local-purchase/${P1}/goods-transfer`;
  const k1 = key();
  const tOwn = await admin("POST", J, { lotId: lotP.id, purpose: "own_warehouse", qty: 30, idempotencyKey: k1, source: { label: "Purchase location" }, dest: { warehouseId: WA.id, rack: "A1" } });
  check("B", "own warehouse transfer accepted (30 → warehouse A / rack A1)", tOwn.status === 200 && tOwn.data?.transfer?.status === "completed", tOwn.err);
  let s = await lotStock(lotP.id);
  check("B", "stock moved: 70 at purchase location + 30 at A/A1", near(sum(s, (r) => r.location_label === "Purchase location"), 70) && near(sum(s, (r) => r.warehouse_id === WA.id && r.rack_bin === "A1"), 30));
  let pa = await pibQty(gP.id, WA.id);
  check("B", "warehouse receipt mirrored to Inventory (+30 on hand)", near(pa.onHand - base.A.onHand, 30));
  const smIn = Number((await sql`select count(*)::int c from public.stock_movements where warehouse_id=${WA.id}::uuid and goods_id=${gP.id}::uuid and movement_type='STOCK_IN' and reference_no=${tOwn.data.transfer.transfer_no}`)[0].c);
  check("B", "a stock movement + warehouse receipt was recorded", smIn === 1);
  check("B", "no financial posting was repeated (still exactly 1 purchase entry)", (await rozCount(P1)) === 1);
  const tOwn2 = await admin("POST", J, { lotId: lotP.id, purpose: "own_warehouse", qty: 30, idempotencyKey: k1, source: { label: "Purchase location" }, dest: { warehouseId: WA.id, rack: "A1" } });
  check("B", "repeating the same request (same key) is a no-op replay", tOwn2.status === 200 && tOwn2.data?.replayed === true && near(sum(await lotStock(lotP.id), (r) => r.warehouse_id === WA.id), 30));
  const tRack = await admin("POST", J, { lotId: lotP.id, purpose: "own_warehouse", qty: 10, idempotencyKey: key(), source: { warehouseId: WA.id, rack: "A1" }, dest: { warehouseId: WA.id, rack: "B2" } });
  s = await lotStock(lotP.id);
  pa = await pibQty(gP.id, WA.id);
  check("B", "same-warehouse rack/bin move A1 → B2 keeps total stock unchanged", tRack.status === 200 && near(sum(s, (r) => r.warehouse_id === WA.id), 30) && near(sum(s, (r) => r.rack_bin === "B2"), 10) && near(pa.onHand - base.A.onHand, 30));
  const samePlace = await admin("POST", J, { lotId: lotP.id, purpose: "own_warehouse", qty: 5, idempotencyKey: key(), source: { warehouseId: WA.id, rack: "B2" }, dest: { warehouseId: WA.id, rack: "B2" } });
  check("B", "moving to the very same place is refused", samePlace.status === 400, samePlace.err);
  const noWh = await admin("POST", J, { lotId: lotP.id, purpose: "own_warehouse", qty: 5, idempotencyKey: key(), source: { label: "Purchase location" }, dest: {} });
  check("B", "own warehouse requires a Warehouse Master selection", noWh.status === 400, noWh.err);

  // =============================================================================================
  // SECTION C — another DGT warehouse (same country): Source → In Transit → Received
  // =============================================================================================
  const brs = (await admin("GET", J)).data.branches;
  const tDgt = await admin("POST", J, { lotId: lotP.id, purpose: "dgt_warehouse", qty: 20, idempotencyKey: key(), source: { warehouseId: WA.id, rack: "A1" }, dest: { warehouseId: WB.id, countryBranchId: brs[0].id }, transport: { truck: "TRK-E2E", driver: "Gul" } });
  check("C", "dispatch to another DGT warehouse puts the quantity In Transit", tDgt.status === 200 && tDgt.data?.transfer?.status === "in_transit", tDgt.err);
  s = await lotStock(lotP.id);
  check("C", "20 In Transit, none at destination yet", near(sum(s, (r) => r.state === "in_transit"), 20) && near(sum(s, (r) => r.warehouse_id === WB.id), 0));
  const pbMid = await pibQty(gP.id, WB.id);
  check("C", "destination Inventory not increased before receipt", near(pbMid.onHand - base.B.onHand, 0));
  check("C", "no Sale and no new Purchase created by a warehouse transfer", Number((await sql`select count(*)::int c from public.sales_orders where form_data->>'transferNo' = ${tDgt.data.transfer.transfer_no}`)[0].c) === 0 && Number((await sql`select count(*)::int c from public.local_purchases where deleted_at is null and created_at > now() - interval '30 minutes' and supplier_name like ${"E2E Supplier " + run + "%"}`)[0].c) === 1);
  const wrongCountry = await admin("POST", J, { lotId: lotW.id, purpose: "dgt_warehouse", qty: 5, idempotencyKey: key(), source: { label: "Purchase location" }, dest: { warehouseId: aeWh[0].id, countryBranchId: brs[0].id } });
  check("C", "a warehouse in another country is refused here (must be an Inter-Country Trade)", wrongCountry.status === 400, wrongCountry.err);
  const rcv = await admin("POST", `/api/erp/goods-transfers/${tDgt.data.transfer.id}`, { action: "receive", rack: "R1" });
  const rcv2 = await admin("POST", `/api/erp/goods-transfers/${tDgt.data.transfer.id}`, { action: "receive" });
  s = await lotStock(lotP.id);
  const pb = await pibQty(gP.id, WB.id);
  check("C", "receipt moves it into the destination warehouse (+20) exactly once", rcv.status === 200 && rcv2.data?.replayed === true && near(sum(s, (r) => r.warehouse_id === WB.id), 20) && near(pb.onHand - base.B.onHand, 20));
  check("C", "country total unchanged by the same-country transfer (70+10+20 =100 available)", near(sum(s, (r) => r.state === "available"), 100) && near(sum(s, () => true), 100));

  // =============================================================================================
  // SECTION D — third-party warehouse
  // =============================================================================================
  const prov = { accountId: provider.id, name: "Zeeshan Storage", city: "Quetta", address: "Industrial Area", contractRef: "C-77", storageCharge: 150, chargeCurrency: "PKR" };
  const t3pBad = await admin("POST", J, { lotId: lotW.id, purpose: "third_party_warehouse", qty: 5, idempotencyKey: key(), source: { label: "Purchase location" }, provider: { name: "x" } });
  check("D", "third-party requires provider account, city, address, contract, charge, currency", t3pBad.status === 400, t3pBad.err);
  const t3p = await admin("POST", J, { lotId: lotW.id, purpose: "third_party_warehouse", qty: 5, idempotencyKey: key(), source: { label: "Purchase location" }, provider: prov });
  const sw = await lotStock(lotW.id);
  check("D", "third-party custody keeps the goods DGT-owned (available, labelled place)", t3p.status === 200 && near(sum(sw, (r) => r.location_label.startsWith("3P:")), 5) && sw.every((r) => r.state === "available"), t3p.err);
  check("D", "no sale and no customer account involved", Number((await sql`select count(*)::int c from public.goods_transfers where id=${t3p.data.transfer.id}::uuid and sales_order_id is not null`)[0].c) === 0);
  check("D", "storage charge recorded on the transfer, not auto-posted", Number(t3p.data.transfer.storage_charge) === 150 && (await rozCount(t3p.data.transfer.id)) === 0);

  // =============================================================================================
  // SECTION E — over-quantity, hold, concurrency
  // =============================================================================================
  const over = await admin("POST", J, { lotId: lotW.id, purpose: "own_warehouse", qty: 999, idempotencyKey: key(), source: { label: "Purchase location" }, dest: { warehouseId: WC.id } });
  check("E", "transfer above the available quantity is refused (409)", over.status === 409, over.err);
  const zero = await admin("POST", J, { lotId: lotW.id, purpose: "own_warehouse", qty: 0, idempotencyKey: key(), source: { label: "Purchase location" }, dest: { warehouseId: WC.id } });
  check("E", "zero / negative quantity is refused", [400, 422].includes(zero.status));
  const hold = await admin("POST", J, { lotId: lotW.id, purpose: "hold", qty: 3, idempotencyKey: key(), source: { label: "Purchase location" } });
  check("E", "Hold at Current Location is recorded without moving stock", hold.status === 200 && near(sum(await lotStock(lotW.id), (r) => r.location_label === "Purchase location"), 35));
  // same key x6 in parallel (double-click / repeated API submission)
  const kd = key();
  const par = await Promise.all(Array.from({ length: 6 }, () => admin("POST", J, { lotId: lotW.id, purpose: "own_warehouse", qty: 7, idempotencyKey: kd, source: { label: "Purchase location" }, dest: { warehouseId: WC.id, rack: "Z" } })));
  const okCount = par.filter((r) => r.status === 200).length;
  const created = Number((await sql`select count(*)::int c from public.goods_transfers where lot_id=${lotW.id}::uuid and idempotency_key=${kd}`)[0].c);
  check("E", "6 parallel identical submissions create exactly ONE transfer", created === 1 && okCount >= 1, `created=${created} ok=${okCount} statuses=${par.map((p) => p.status)}`);
  check("E", "…and stock moved exactly once (7 at C)", near(sum(await lotStock(lotW.id), (r) => r.warehouse_id === WC.id), 7));
  // different keys racing for more than is available
  const before = sum(await lotStock(lotW.id), (r) => r.location_label === "Purchase location");
  const race = await Promise.all(Array.from({ length: 6 }, () => admin("POST", J, { lotId: lotW.id, purpose: "own_warehouse", qty: 10, idempotencyKey: key(), source: { label: "Purchase location" }, dest: { warehouseId: WC.id, rack: "Y" } })));
  const won = race.filter((r) => r.status === 200).length;
  const after = sum(await lotStock(lotW.id), (r) => r.location_label === "Purchase location");
  check("E", "racing requests can never take more than available (no negative stock)", after >= 0 && near(before - after, won * 10) && won === Math.floor(before / 10), `before=${before} after=${after} won=${won}`);

  // =============================================================================================
  // SECTION F — cancel / return
  // =============================================================================================
  const tc = await admin("POST", J, { lotId: lotP.id, purpose: "dgt_warehouse", qty: 5, idempotencyKey: key(), source: { warehouseId: WA.id, rack: "B2" }, dest: { warehouseId: WC.id, countryBranchId: brs[0].id } });
  const cancelNoReason = await admin("POST", `/api/erp/goods-transfers/${tc.data.transfer.id}`, { action: "cancel", reason: "" });
  check("F", "cancel requires a reason", [400, 422].includes(cancelNoReason.status));
  const canc = await admin("POST", `/api/erp/goods-transfers/${tc.data.transfer.id}`, { action: "cancel", reason: "wrong warehouse" });
  s = await lotStock(lotP.id);
  check("F", "cancelling an In Transit transfer puts the quantity back at its source", canc.status === 200 && near(sum(s, (r) => r.state === "in_transit"), 0) && near(sum(s, (r) => r.warehouse_id === WA.id && r.rack_bin === "B2"), 10));
  const canc2 = await admin("POST", `/api/erp/goods-transfers/${tc.data.transfer.id}`, { action: "cancel", reason: "again" });
  check("F", "a second cancel is a replay (no double reversal)", canc2.data?.replayed === true && near(sum(await lotStock(lotP.id), (r) => r.warehouse_id === WA.id), 10));
  const tRet = await admin("POST", J, { lotId: lotW.id, purpose: "own_warehouse", qty: 4, idempotencyKey: key(), source: { label: "Purchase location" }, dest: { warehouseId: WB.id, rack: "RET" } });
  const beforeRet = sum(await lotStock(lotW.id), (r) => r.warehouse_id === WB.id && r.rack_bin === "RET");
  const ret = await admin("POST", `/api/erp/goods-transfers/${tRet.data.transfer.id}`, { action: "cancel", reason: "returned to purchase location" });
  s = await lotStock(lotW.id);
  check("F", "a completed own-warehouse transfer can be returned (audited reversal)", ret.status === 200 && ret.data?.transfer?.status === "returned" && near(beforeRet, 4) && near(sum(s, (r) => r.warehouse_id === WB.id && r.rack_bin === "RET"), 0), ret.err);
  const stale = await admin("POST", `/api/erp/goods-transfers/${tOwn.data.transfer.id}`, { action: "cancel", reason: "stock already moved on" });
  check("F", "returning goods that already moved on is refused (nothing is invented)", stale.status === 409, stale.err);
  const mv = await sql`select movement_type from public.lot_movements where lot_id = any(${[lotP.id, lotW.id]}::uuid[]) and movement_type in ('return','cancel')`;
  check("F", "reversals are recorded as movements (append-only history)", mv.length >= 2);
  let appendOnly = false;
  try { await sql`delete from public.lot_movements where lot_id=${lotP.id}::uuid`; } catch { appendOnly = true; }
  check("F", "movement history cannot be deleted (database-enforced)", appendOnly);

  // =============================================================================================
  // SECTION G — reconciliation
  // =============================================================================================
  for (const lot of [lotP, lotW]) {
    const bal = (await sql`select qty_purchased::float8 p, qty_accounted::float8 a from public.purchase_lot_balance_v where lot_id=${lot.id}::uuid`)[0];
    check("G", `lot ${lot.goods_name}: stock rows always sum to the quantity purchased`, near(bal.p, bal.a));
  }
  let conservationBlocked = false;
  try { await sql`update public.lot_stock set qty = qty + 1 where lot_id=${lotP.id}::uuid and id = (select id from public.lot_stock where lot_id=${lotP.id}::uuid limit 1)`; } catch { conservationBlocked = true; }
  check("G", "the database rejects any change that unbalances a lot", conservationBlocked);

  return { admin, pkAdmin, aeAdmin, sql, ids: { P1, lotP, lotW, WA, WB, WC, gP, gW, cust, salesL, cogsL, recvL, expSalesL, aeInv, aePay, aeWh, brs }, helpers: { check, near, sum, key, lotStock, pibQty, rozCount, newPostedPurchase } };
}

// SECTION H.. (sales / export / inter-country / isolation) live in the second file part
import("./e2e-goods-transfer-part2.mjs")
  .then(async (part2) => {
    const ctx = await main();
    if (part2?.default) await part2.default({ ...ctx, check, results, only, BASE, PK, AE, login });
  })
  .catch((e) => {
    console.error("HARNESS ERROR:", e);
    results.push({ section: "harness", name: "no crash", ok: false, detail: String(e?.message || e) });
  })
  .finally(async () => {
    const bad = results.filter((r) => !r.ok);
    console.log(`\n==== ${results.length - bad.length} PASS / ${bad.length} FAIL ====`);
    for (const b of bad) console.log(`FAIL [${b.section}] ${b.name} ${b.detail}`);
    await sql.end({ timeout: 5 });
    process.exit(bad.length ? 1 : 0);
  });
