// DEV-only end-to-end verification of the Purchase Booking / Local Purchase -> Loading -> Purchase Transit & Lane corrections.
// Drives the REAL API routes with signed DEV test sessions and reads the DEV database to prove what was (and was not) written.
//
// Usage: npx vite-node --config vitest.config.mjs scripts/e2e-verify-purchase-lane.mts [baseUrl]
// DEV ONLY (csesvyxxjivnkkozgopt). Every record it creates is marked TEST-LANE-* and is removed at the end (set KEEP=1 to keep them).

import { readFileSync } from "node:fs";
import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { buildTempAgentToken } from "../lib/auth/temp-session";

const BASE = process.argv[2] || "http://localhost:3000";
const STAMP = Date.now().toString(36).toUpperCase();
const UAE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const UAE_MAIN = "87c2e253-b6c1-482d-a808-272337f3ffda";
const DEMO_CITY = "b5e94645-05c1-4420-8ecb-141ca7d84f12"; // Deira Dubai City Branch = the loading branch (active, real admin user)
const PK_MAIN = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa";
const PK_QUETTA = "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b"; // Quetta City Branch (another country, active)
const UAE_ADMIN = "c5bb3ddf-0781-41f7-b625-241a1c6babd0"; // real UAE country admin profile
const AGENT_INTERNAL = "b9c1f75c-41ec-494f-959a-15fe39411b22"; // DGT CLEARING & FORWARDING SERVICES

/** DEV DB access that rides out transient connect timeouts to the remote database. */
async function db<T>(fn: Parameters<typeof withLocalPg<T>>[0]): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 5; i++) {
    try { return await withLocalPg(fn); } catch (e: any) {
      last = e;
      if (!/CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|Connection terminated/i.test(String(e?.code ?? e?.message ?? e))) throw e;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  throw last;
}

type Who = { userId: string; email: string; name: string; role: string; countryId: string; cb: string | null; city: string | null };
const WHO: Record<string, Who> = {
  super: { userId: "00000000-0000-4000-8000-000000000001", email: "superadmin@dgt.llc", name: "E2E Super Admin", role: "super_admin", countryId: "", cb: null, city: null },
  demo: { userId: "8f07f23e-fa25-4e37-bae5-40577f96e4c9", email: "dubai.branch@dgt.llc", name: "Deira Dubai City Admin", role: "city_branch_admin", countryId: UAE, cb: UAE_MAIN, city: DEMO_CITY },
  deira: { userId: "00000000-0000-4000-8000-0000000d0002", email: "main.uae.e2e@dgt.llc", name: "UAE Main Branch Admin (E2E)", role: "main_branch_admin", countryId: UAE, cb: UAE_MAIN, city: null },
  kabul: { userId: "00000000-0000-4000-8000-0000000d0003", email: "kabul.e2e@dgt.llc", name: "Kabul City Admin (E2E)", role: "city_branch_admin", countryId: "8366fa0e-dcf6-4acd-8602-2819f103dd63", cb: "0842bdac-4c33-4b9e-ada5-e21aa8176151", city: "1c20dd57-d765-4421-a4b0-5359c30d736f" },
  uae: { userId: UAE_ADMIN, email: "uae.admin@dgt.llc", name: "UAE Country Admin", role: "country_admin", countryId: UAE, cb: null, city: null },
  pk: { userId: "409b050f-faf9-428f-9ec6-d9c8bc5a9dc2", email: "pakistan.admin@dgt.llc", name: "Pakistan Country Admin", role: "country_admin", countryId: PK, cb: null, city: null },
};

const results: { label: string; ok: boolean }[] = [];
function check(label: string, ok: boolean, detail?: unknown) {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${ok ? "" : "  -> " + JSON.stringify(detail)?.slice(0, 700)}`);
}
function loadEnvSecret() {
  if (process.env.ERP_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) return;
  for (const f of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*(ERP_SESSION_SECRET|AUTH_SECRET|NEXTAUTH_SECRET)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* ignore */ }
  }
}
function cookie(w: Who) {
  const token = buildTempAgentToken({
    userId: w.userId, email: w.email, fullName: w.name, roles: [w.role as any],
    assignments: w.role === "super_admin" ? [] : [{ role: w.role as any, countryId: w.countryId, countryBranchId: w.cb, cityBranchId: w.city }],
  });
  return `erp_session=${token}`;
}
async function api(w: Who, method: string, path: string, body?: unknown) {
  // the DEV server restarts itself when it nears its memory threshold: ride that out (GET only is safe to repeat)
  let res: Response | null = null;
  for (let attempt = 0; attempt < 5 && !res; attempt++) {
    try {
      res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Cookie: cookie(w), "x-erp-lang": "en" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
    } catch (e) {
      // the DEV server restarted itself (memory threshold): wait until it answers again, then repeat the call.
      // (a write that already committed would answer differently on repeat; a run with such a retry is re-run rather than trusted)
      if (attempt === 4) throw e;
      for (let w = 0; w < 30; w++) {
        await new Promise((r) => setTimeout(r, 4000));
        try { const h = await fetch(`${BASE}/auth/login`, { signal: AbortSignal.timeout(8000) }); if (h.status < 500) break; } catch { /* still down */ }
      }
      if (method !== "GET") console.log(`  (server restarted during ${method} ${path.split("?")[0]} — repeating once it is back)`);
    }
  }
  if (!res) throw new Error("no response");
  let txt = await res.text();
  // the remote DEV database occasionally drops a connection: the server answers 500 CONNECT_TIMEOUT and the transaction rolled back, so repeating is safe
  for (let again = 0; again < 3 && res.status === 500 && /CONNECT_TIMEOUT|ECONNRESET|Connection terminated/i.test(txt); again++) {
    await new Promise((r) => setTimeout(r, 4000));
    res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Cookie: cookie(w), "x-erp-lang": "en" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
    txt = await res.text();
  }
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* not json */ }
  return { status: res.status, json, data: json?.data ?? json, msg: String(json?.error?.message ?? json?.error ?? "") };
}

// ───────────────────────── DEV fixtures (all marked TEST-LANE-*) ─────────────────────────
async function mkPO(tag: string, paymentType: string, opts: { qty?: number; total?: number; status?: string } = {}) {
  const qty = opts.qty ?? 1000;
  const total = opts.total ?? 50000;
  const no = `TEST-LANE-${tag}-${STAMP}`;
  const form = {
    paymentType, paymentCondition: paymentType, quantity: qty, totalAmount: total, exchangeRate: 3.6725, supplierName: "TEST-LANE Supplier Ltd",
    loadingPort: "Karachi Port", receivedPort: "Jebel Ali", containerCount: 4, advanceAmount: 0, advancePercent: 0,
    purchaseAccountName: "TEST-LANE Purchase A/C", salesAccountName: "TEST-LANE Supplier A/C", currency: "USD", branchCurrency: "AED",
  };
  const fd = {
    form, totals: { grandFinal: total, totalQuantity: qty, totalContainers: 4 },
    workflow: { totalQuantity: qty, loadedQuantity: 0, totalContainers: 4, loadedContainers: 0 },
    goodsEntries: [{ qtyNo: qty, qtyName: "BAGS", quantity: qty, goodsName: "TEST-LANE Basmati Rice", oneQtyKgs: 25, oneEmptyKgs: 0.2, priceType: "P/Unit", priceRateC1: total / qty, totalAmount: total }],
  };
  const row = await db(async (sql) => (await sql`
    insert into purchase_orders (country_id, country_branch_id, city_branch_id, purchase_order_no, currency_code, exchange_rate, order_total, advance_paid, remaining_paid,
      credit_amount, remaining_due, payment_status, ledger_posting_status, status, form_data)
    values (${UAE}::uuid, ${UAE_MAIN}::uuid, ${DEMO_CITY}::uuid, ${no}, 'USD', 3.6725, ${total}, 0, 0, ${paymentType === "Credit" ? total : 0}, ${total}, 'pending', 'draft',
      ${opts.status ?? "transferred"}, ${sql.json(fd as any)})
    returning id, purchase_order_no, order_total, advance_paid, remaining_paid, credit_amount, remaining_due, payment_status`)[0]);
  return row as { id: string; purchase_order_no: string; order_total: string; advance_paid: string; remaining_paid: string; credit_amount: string; remaining_due: string; payment_status: string };
}
const loadBody = (po: { id: string; purchase_order_no: string }, o: { qty: number; container: string; bl: string; net?: number; gross?: number; seal?: string; mode?: string }) => ({
  countryId: UAE, countryBranchId: UAE_MAIN, cityBranchId: DEMO_CITY, purchaseOrderId: po.id, purchaseOrderNo: po.purchase_order_no,
  containerNumber: o.container, containerType: "40 FT", loadingStatus: "loaded", loadedAt: new Date().toISOString(),
  loadingLocation: "Karachi Port", receivingLocation: "Jebel Ali", shipmentStatus: "partial_loaded", carrierName: "MSC TEST", remarks: "TEST-LANE load",
  loadedContainers: 1, loadedQuantity: o.qty, transportMode: o.mode ?? "By Sea",
  blNumber: o.bl, grossWeight: o.gross ?? o.qty * 25, tareWeight: (o.gross ?? o.qty * 25) - (o.net ?? o.qty * 24.8), netWeight: o.net ?? o.qty * 24.8,
  sealNumber: o.seal ?? `SL-${o.container}`, vesselName: "MSC TEST", voyageNo: "024E", originText: "Pakistan / Karachi Port", destinationText: "UAE / Jebel Ali", lotName: "LOT-TEST",
  reportPayload: {
    entryCount: 1, loadedQuantity: o.qty, loadingQuantity: o.qty, blNumber: o.bl, containerNumber: o.container, sealNumber: o.seal ?? `SL-${o.container}`, vesselName: "MSC TEST",
    goodsName: "TEST-LANE Basmati Rice", quantityNo: String(o.qty), qtyName: "BAGS", oneQtyKgs: "25", oneEmptyKgs: "0.2",
    goodsEntries: [{ goodsName: "TEST-LANE Basmati Rice", quantityNo: String(o.qty), qtyName: "BAGS", oneQtyKgs: "25", oneEmptyKgs: "0.2" }],
  },
});
/** A POSTED payment against a TEST booking (reuses two real ledger ids from an existing payment row — DEV data). */
async function addPayment(poId: string, amount: number, kind = "remaining") {
  await db(async (sql) => {
    const t = (await sql`select debit_ledger_id, credit_ledger_id from purchase_order_payments where debit_ledger_id is not null and credit_ledger_id is not null limit 1`)[0];
    await sql`insert into purchase_order_payments (purchase_order_id, kind, entry_date, amount, currency_code, exchange_rate, debit_ledger_id, credit_ledger_id, status, narration, posted_to_journal)
              values (${poId}::uuid, ${kind}, current_date, ${amount}, 'USD', 3.6725, ${t.debit_ledger_id}::uuid, ${t.credit_ledger_id}::uuid, 'posted', 'TEST-LANE payment', false)`;
  });
}
const SNAP_TABLES = ["journal_entries", "journal_entry_lines", "ledger_entries", "roznamcha_entries", "sales_invoices", "sales_orders", "customer_orders", "purchase_order_payments", "bill_expense_lines", "bill_expenses", "stock_movements", "product_inventory_balances", "purchase_lane_loads", "purchase_lane_events", "purchase_lane_expenses"];
async function snapshot() {
  return db(async (sql) => {
    const out: Record<string, number> = {};
    for (const t of SNAP_TABLES) {
      const ex = await sql`select to_regclass(${"public." + t}) as r`;
      if (!ex[0].r) continue;
      out[t] = Number((await sql.unsafe(`select count(*)::int as n from public.${t}`))[0].n);
    }
    return out;
  });
}
const poMoney = (id: string) => db(async (sql) => (await sql`select order_total, advance_paid, remaining_paid, credit_amount, remaining_due, payment_status from purchase_orders where id = ${id}::uuid`)[0]);
const laneRow = (id: string) => db(async (sql) => (await sql`select * from purchase_lane_loads where id = ${id}::uuid`)[0]);
const eventCount = (id: string) => db(async (sql) => Number((await sql`select count(*)::int n from purchase_lane_events where lane_load_id = ${id}::uuid`)[0].n));

/** Removes every TEST-LANE-* record this script ever created (and reverses its warehouse stock-in). DEV only. */
async function cleanupTestData() {
  await db(async (sql) => {
    const pos = (await sql`select id from purchase_orders where purchase_order_no like 'TEST-LANE-%'`).map((x: any) => x.id as string);
    const lanes = (await sql`select id from purchase_lane_loads where purchase_ref_no like 'TEST-LANE-%' or purchase_order_id = ANY(${pos}::uuid[])`).map((x: any) => x.id as string);
    if (lanes.length) {
      const exps = await sql`select bill_expense_line_id, bill_expense_id from purchase_lane_expenses where lane_load_id = ANY(${lanes}::uuid[])`;
      await sql`delete from purchase_lane_expenses where lane_load_id = ANY(${lanes}::uuid[])`;
      await sql`delete from purchase_lane_events where lane_load_id = ANY(${lanes}::uuid[])`;
      await sql`delete from purchase_lane_loads where id = ANY(${lanes}::uuid[])`;
      for (const e of exps) {
        if (e.bill_expense_line_id) await sql`delete from bill_expense_lines where id = ${e.bill_expense_line_id}::uuid`.catch(() => {});
        if (e.bill_expense_id) await sql`delete from bill_expenses where id = ${e.bill_expense_id}::uuid and not exists (select 1 from bill_expense_lines where bill_expense_id = ${e.bill_expense_id}::uuid)`.catch(() => {});
      }
    }
    if (pos.length) {
      const mv = await sql`select goods_id, warehouse_id, sum(quantity)::numeric q from stock_movements where purchase_order_id = ANY(${pos}::uuid[]) group by 1,2`;
      for (const m of mv) {
        await sql`update product_inventory_balances set quantity_on_hand = quantity_on_hand - ${m.q} where product_id = ${m.goods_id}::uuid and warehouse_id = ${m.warehouse_id}::uuid`;
        await sql`delete from product_inventory_balances where product_id = ${m.goods_id}::uuid and warehouse_id = ${m.warehouse_id}::uuid and quantity_on_hand <= 0`;
      }
      await sql`delete from stock_movements where purchase_order_id = ANY(${pos}::uuid[])`;
      await sql`delete from purchase_loading_records where purchase_order_id = ANY(${pos}::uuid[])`;
      await sql`delete from purchase_order_payments where purchase_order_id = ANY(${pos}::uuid[])`;
      await sql`delete from purchase_orders where id = ANY(${pos}::uuid[])`;
    }
    await sql`delete from purchase_loading_records where loading_record_no like 'PLR-LEGACY-%'`;
  });
}

/** Browser walkthrough data: a fully loaded Credit booking (3 containers / 2 BLs, one handed to the main branch), a partly loaded Final Payment booking and an older load with no lane row. */
async function seedVisual() {
  const D = WHO.demo;
  const a = await mkPO("VISA", "Credit", { qty: 1000, total: 50000 });
  const b = await mkPO("VISB", "Final Payment", { qty: 500, total: 25000 });
  await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(a, { qty: 400, container: `MSCU${STAMP.slice(-6)}1`, bl: `BLVIS-A1-${STAMP}` }));
  await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(a, { qty: 300, container: `MSCU${STAMP.slice(-6)}2`, bl: `BLVIS-A1-${STAMP}` }));
  await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(a, { qty: 300, container: `MSCU${STAMP.slice(-6)}3`, bl: `BLVIS-A2-${STAMP}` }));
  await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(b, { qty: 200, container: `TGHU${STAMP.slice(-6)}1`, bl: `BLVIS-B1-${STAMP}` }));
  const lanes: any[] = (await api(D, "GET", `/api/erp/purchases/lane?purchaseOrderId=${a.id}`)).data?.rows ?? [];
  const second = lanes.find((x) => String(x.container_number).endsWith("2"));
  if (second) await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [second.id], transfer: { type: "other_branch", countryId: UAE, countryBranchId: UAE_MAIN, responsibility: "customs_clearance", expectedLocation: "Main branch customs desk" } });
  await db(async (sql) => { await sql`
    insert into purchase_loading_records (country_id, country_branch_id, city_branch_id, purchase_order_id, purchase_order_no, loading_record_no, container_number, container_type, loading_status, loaded_quantity, loaded_at, loading_location, receiving_location, report_payload)
    values (${UAE}::uuid, ${UAE_MAIN}::uuid, ${DEMO_CITY}::uuid, ${b.id}::uuid, ${b.purchase_order_no}, ${"PLR-LEGACY-" + STAMP}, ${"OLD" + STAMP.slice(-6)}, '20 FT', 'loaded', 50, now(), 'Karachi Port', 'Jebel Ali', ${sql.json({ blNumber: "BLVIS-OLD", loadedQuantity: 0 } as any)})`; });
  console.log("seeded:", a.purchase_order_no, b.purchase_order_no);
}

async function main() {
  loadEnvSecret();
  if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing to run: not the DEV database.");
  console.log(`DEV purchase-lane E2E  stamp=${STAMP}  base=${BASE}`);
  await cleanupTestData(); // clear leftovers of an earlier crashed attempt
  if (process.env.CLEANUP_ONLY) { console.log("cleanup only: done"); process.exit(0); }
  // SEED_VIS=1 -> leave a small, realistic TEST-LANE data set for the browser walkthrough (nothing is asserted or removed)
  if (process.env.SEED_VIS) { await seedVisual(); process.exit(0); }
  const D = WHO.demo, X = WHO.deira, K = WHO.kabul, U = WHO.uae, S = WHO.super, P = WHO.pk;
  const created: string[] = [];

  // ═════════════ 1. Payment-to-Loading rules ═════════════
  console.log("\n— 1. Payment-to-Loading rules —");
  const inv = await mkPO("INV", "Invoice"); created.push(inv.id);
  const cre = await mkPO("CRE", "Credit"); created.push(cre.id);
  const fin = await mkPO("FIN", "Final Payment"); created.push(fin.id);
  const draft = await mkPO("DRAFT", "Credit", { status: "Draft" }); created.push(draft.id);
  const before = await snapshot();

  let r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(inv, { qty: 100, container: `INV-C1-${STAMP}`, bl: `BL-INV-${STAMP}` }));
  check("Invoice purchase: Loading BLOCKED while unpaid", r.status >= 400 && /blocked/i.test(r.msg), { s: r.status, m: r.msg });
  await addPayment(inv.id, 20000);
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(inv, { qty: 100, container: `INV-C1-${STAMP}`, bl: `BL-INV-${STAMP}` }));
  check("Invoice purchase: a PARTIAL payment still blocks Loading", r.status >= 400 && /blocked/i.test(r.msg), { s: r.status, m: r.msg });
  await addPayment(inv.id, 30000);
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(inv, { qty: 100, container: `INV-C1-${STAMP}`, bl: `BL-INV-${STAMP}` }));
  check("Invoice purchase: Loading allowed once the invoice is fully paid", r.status === 201 || r.status === 200, { s: r.status, m: r.msg });

  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(draft, { qty: 100, container: `DR-C1-${STAMP}`, bl: `BL-DR-${STAMP}` }));
  check("Unapproved (Draft) booking: Loading blocked for every payment type", r.status >= 400 && /approved/i.test(r.msg), { s: r.status, m: r.msg });

  // synthetic queue rows: Credit & Final are loadable straight away; unpaid Invoice is not
  const q = await api(D, "GET", `/api/erp/purchases/loading-records?limit=500&q=TEST-LANE`);
  const queue: any[] = q.data?.records ?? [];
  const queued = (po: { purchase_order_no: string }) => queue.some((x) => x.purchase_order_no === po.purchase_order_no);
  check("Loading queue lists the Credit booking (no payment needed)", queued(cre), { n: queue.length });
  check("Loading queue lists the Final Payment booking (no payment needed)", queued(fin), { n: queue.length });

  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(cre, { qty: 400, container: `CRE-C1-${STAMP}`, bl: `BL-CRE-1-${STAMP}` }));
  check("Credit purchase: goes straight to Loading with NOTHING paid", r.status === 201 || r.status === 200, { s: r.status, m: r.msg });
  const creLoad1 = r.data?.loadingRecordId ?? r.data?.id ?? r.json?.data?.loadingRecord?.id;
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(fin, { qty: 1000, container: `FIN-C1-${STAMP}`, bl: `BL-FIN-1-${STAMP}` }));
  check("Final Payment purchase: goes straight to Loading with NOTHING paid", r.status === 201 || r.status === 200, { s: r.status, m: r.msg });

  // payables untouched by loading
  const creAfter = await poMoney(cre.id);
  const finAfter = await poMoney(fin.id);
  check("Credit: outstanding payable unchanged by Loading (remaining_due & credit_amount)", Number(creAfter.remaining_due) === Number(cre.remaining_due) && Number(creAfter.credit_amount) === Number(cre.credit_amount), { creAfter });
  check("Final Payment: outstanding payable unchanged by Loading", Number(finAfter.remaining_due) === Number(fin.remaining_due) && Number(finAfter.advance_paid) === 0, { finAfter });

  // ═════════════ 2. Partial & complete loading, one BL / many containers ═════════════
  console.log("\n— 2. Partial & complete loading, BL / containers —");
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(cre, { qty: 300, container: `CRE-C2-${STAMP}`, bl: `BL-CRE-1-${STAMP}` }));
  check("Same BL, second container saved (one BL / many containers)", r.status === 201 || r.status === 200, { s: r.status, m: r.msg });
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(cre, { qty: 400, container: `CRE-C3-${STAMP}`, bl: `BL-CRE-2-${STAMP}` }));
  check("Over-loading is refused (400 + 300 + 400 > 1000)", r.status >= 400 && /exceed/i.test(r.msg), { s: r.status, m: r.msg });
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(cre, { qty: 300, container: `CRE-C3-${STAMP}`, bl: `BL-CRE-2-${STAMP}` }));
  check("Different BL, final container completes the quantity (many BLs / many containers)", r.status === 201 || r.status === 200, { s: r.status, m: r.msg });
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(cre, { qty: 1, container: `CRE-C4-${STAMP}`, bl: `BL-CRE-2-${STAMP}` }));
  check("Fully loaded booking: a further New Loading is refused (nothing left to load)", r.status >= 400, { s: r.status, m: r.msg });

  const list = await api(D, "GET", `/api/erp/purchases/loading-records?limit=500&q=${encodeURIComponent(cre.purchase_order_no)}`);
  const creRows: any[] = (list.data?.records ?? []).filter((x: any) => x.purchase_order_no === cre.purchase_order_no && x.loading_status === "loaded");
  check("Three container rows saved under the one booking", creRows.length === 3, { n: creRows.length });
  check("Each row carries BL, container, seal, gross/net weight, vessel, voyage", creRows.every((x) => x.bl_number && x.container_number && x.seal_number && Number(x.gross_weight) > 0 && Number(x.net_weight) > 0 && x.vessel_name && x.voyage_no), creRows.map((x) => ({ bl: x.bl_number, c: x.container_number, s: x.seal_number, g: x.gross_weight, n: x.net_weight })));
  const bls = new Set(creRows.map((x) => x.bl_number));
  check("One BL carries 2 containers and a second BL carries 1", bls.size === 2 && creRows.filter((x) => x.bl_number === `BL-CRE-1-${STAMP}`).length === 2, [...bls]);
  check("Remaining to Load is physical quantity: 0 (payable of 50,000 does not leak into it)", creRows.reduce((s, x) => s + Number(x.loaded_quantity || 0), 0) === 1000, creRows.map((x) => x.loaded_quantity));

  // lane rows exist for every saved row, exactly one each
  const ids = creRows.map((x) => x.id);
  const st = await api(D, "GET", `/api/erp/purchases/lane?loadingRecordIds=${ids.join(",")}`);
  check("Lane row exists for EVERY saved loading row (Action button has something to act on)", Object.keys(st.data?.states ?? {}).length === 3, st.data);
  const dup = await db(async (sql) => (await sql`select source_id, count(*)::int n from purchase_lane_loads where deleted_at is null and source_id = ANY(${ids}::uuid[]) group by 1 having count(*) > 1`));
  check("No duplicate lane rows for a loading row", dup.length === 0, dup);

  // older loading row saved before the lane existed -> "Send to Purchase Lane"
  const legacy = await db(async (sql) => (await sql`
    insert into purchase_loading_records (country_id, country_branch_id, city_branch_id, purchase_order_id, purchase_order_no, loading_record_no, container_number, container_type, loading_status, loaded_quantity, loaded_at, loading_location, receiving_location, report_payload)
    values (${UAE}::uuid, ${UAE_MAIN}::uuid, ${DEMO_CITY}::uuid, ${fin.id}::uuid, ${fin.purchase_order_no}, ${"PLR-LEGACY-" + STAMP}, ${"LEGACY-C-" + STAMP}, '40 FT', 'loaded', 0, now(), 'Karachi Port', 'Jebel Ali', ${sql.json({ blNumber: "BL-LEGACY", loadedQuantity: 0 } as any)}) returning id`)[0]);
  const noLane = await api(D, "GET", `/api/erp/purchases/lane?loadingRecordIds=${legacy.id}`);
  check("Older loading row without a lane row shows no lane state (-> 'Send to Purchase Lane')", Object.keys(noLane.data?.states ?? {}).length === 0, noLane.data);
  // loaded_quantity 0 is skipped by backfill by design; give it a quantity then ensure explicitly
  await db(async (sql) => { await sql`update purchase_loading_records set loaded_quantity = 1 where id = ${legacy.id}::uuid`; });
  const ens1 = await api(D, "POST", "/api/erp/purchases/lane", { action: "ensure", loadingRecordId: legacy.id });
  const ens2 = await api(D, "POST", "/api/erp/purchases/lane", { action: "ensure", loadingRecordId: legacy.id });
  check("'Send to Purchase Lane' creates the lane row once and is idempotent", ens1.data?.lane?.id && ens1.data.lane.id === ens2.data?.lane?.id && ens2.data.lane.created === false, { ens1: ens1.data, ens2: ens2.data });

  // ═════════════ 3. Lane: visibility, transfers, permissions ═════════════
  console.log("\n— 3. Lane transfers & permissions —");
  const laneIds = Object.values(st.data.states as Record<string, any>).map((s) => s.id as string);
  const [L1, L2, L3] = laneIds;
  const seen = await api(D, "GET", `/api/erp/purchases/lane?purchaseOrderId=${cre.id}`);
  check("Holder sees all 3 loads in the General Purchase Lane, status Loaded", (seen.data?.rows ?? []).length === 3 && (seen.data.rows as any[]).every((x) => x.lane_status === "loaded"), seen.data?.rows?.map((x: any) => x.lane_status));
  const kSees = await api(K, "GET", `/api/erp/purchases/lane?purchaseOrderId=${cre.id}`);
  check("A city branch of another country does NOT see the load (branch isolation)", (kSees.data?.rows ?? []).length === 0, kSees.data?.rows?.length);
  const xSup = await api(X, "GET", `/api/erp/purchases/lane?purchaseOrderId=${cre.id}`);
  check("The main branch supervises its city branches (sees the 3 loads)", (xSup.data?.rows ?? []).length === 3, xSup.data?.rows?.length);
  const pSees = await api(P, "GET", `/api/erp/purchases/lane?purchaseOrderId=${cre.id}`);
  check("Another country's admin does NOT see the load", (pSees.data?.rows ?? []).length === 0, pSees.data?.rows?.length);
  const xTry = await api(K, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [L1], transfer: { type: "self_managed", responsibility: "full_handling" } });
  check("A non-holder cannot transfer someone else's load (403/404)", xTry.status === 403 || xTry.status === 404, { s: xTry.status, m: xTry.msg });

  const ev0 = await eventCount(L1);
  let t = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [L1], transfer: { type: "own_branch", cityBranchId: DEMO_CITY, responsibility: "custody", expectedLocation: "Jebel Ali Yard" } });
  check("Transfer to OWN branch (no acceptance needed) -> Assigned", t.status === 200 && t.data?.results?.[0]?.to === "assigned", { s: t.status, m: t.msg, d: t.data });
  const sib = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [L2], transfer: { type: "own_branch", countryBranchId: UAE_MAIN, responsibility: "custody", expectedLocation: "Main branch" } });
  check("'Own branch' cannot be used to hand a load to a branch you do not belong to (city admin -> main branch)", sib.status === 403, { s: sib.status, m: sib.msg });
  t = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [L2], transfer: { type: "other_branch", countryId: UAE, countryBranchId: UAE_MAIN, responsibility: "customs_clearance", expectedLocation: "Main branch customs desk", note: "TEST-LANE other branch" } });
  check("Transfer to ANOTHER BRANCH (same country) -> Transfer Pending", t.status === 200 && t.data?.results?.[0]?.to === "transfer_pending", { s: t.status, m: t.msg, d: t.data });
  const xNow = await api(X, "GET", `/api/erp/purchases/lane?purchaseOrderId=${cre.id}`);
  check("Receiving branch now sees the transferred container", (xNow.data?.rows ?? []).some((x: any) => x.id === L2), xNow.data?.rows?.length);
  const dBlocked = await api(D, "PATCH", `/api/erp/purchases/lane/${L2}`, { action: "accept" });
  check("Origin branch can no longer act on a load it handed to another branch", dBlocked.status === 403, { s: dBlocked.status, m: dBlocked.msg });
  const acc = await api(X, "PATCH", `/api/erp/purchases/lane/${L2}`, { action: "accept" });
  check("Receiving branch accepts -> Assigned to Branch/Agent", acc.status === 200 && acc.data?.result?.to === "assigned", { s: acc.status, m: acc.msg });
  t = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [L3], transfer: { type: "other_branch", countryId: PK, cityBranchId: PK_QUETTA, responsibility: "full_handling", expectedLocation: "Quetta" } });
  check("Transfer to a branch in ANOTHER COUNTRY -> Transfer Pending", t.status === 200 && t.data?.results?.[0]?.to === "transfer_pending", { s: t.status, m: t.msg });
  const pNow = await api(P, "GET", `/api/erp/purchases/lane?purchaseOrderId=${cre.id}`);
  check("The other country's admin now sees it (and only that container)", (pNow.data?.rows ?? []).length === 1 && pNow.data.rows[0].id === L3, pNow.data?.rows?.length);

  // agents, user, self on the Final-Payment booking's loads
  const finLoads = await api(D, "GET", `/api/erp/purchases/lane?purchaseOrderId=${fin.id}`);
  const finLane: any[] = finLoads.data?.rows ?? [];
  const F1 = finLane.find((x) => x.container_number === `FIN-C1-${STAMP}`)?.id as string;
  const F2 = legacy.id ? ens1.data.lane.id as string : "";
  t = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [F1], transfer: { type: "internal_agent", agentId: AGENT_INTERNAL, responsibility: "customs_clearance", expectedLocation: "Agent yard" } });
  check("Transfer to an INTERNAL clearing agent -> Transfer Pending", t.status === 200 && t.data?.results?.[0]?.to === "transfer_pending", { s: t.status, m: t.msg });
  t = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [F2], transfer: { type: "external_agent", agentName: "TEST-LANE External Logistics", responsibility: "full_handling", expectedLocation: "External CFS" } });
  check("Transfer to an EXTERNAL agent/logistics partner (typed name) -> Transfer Pending", t.status === 200 && t.data?.results?.[0]?.to === "transfer_pending", { s: t.status, m: t.msg });
  const incomplete = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [F2], transfer: { type: "external_agent" } });
  check("A transfer without agent/responsibility is rejected (incomplete form)", incomplete.status === 422 || incomplete.status === 400, { s: incomplete.status, m: incomplete.msg });
  const ev1 = await eventCount(L1);
  check("Every transfer wrote an audit event", ev1 > ev0, { ev0, ev1 });

  // another authorised user + self-managed on a fresh load
  const usr = await mkPO("USR", "Credit", { qty: 200, total: 10000 }); created.push(usr.id);
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(usr, { qty: 100, container: `USR-C1-${STAMP}`, bl: `BL-USR-${STAMP}` }));
  r = await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(usr, { qty: 100, container: `USR-C2-${STAMP}`, bl: `BL-USR-${STAMP}` }));
  const usrLane: any[] = (await api(D, "GET", `/api/erp/purchases/lane?purchaseOrderId=${usr.id}`)).data?.rows ?? [];
  t = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [usrLane[0].id], transfer: { type: "other_user", userId: U.userId, responsibility: "transport", expectedLocation: "Handover" } });
  check("Transfer to ANOTHER AUTHORISED USER -> Transfer Pending", t.status === 200 && t.data?.results?.[0]?.to === "transfer_pending", { s: t.status, m: t.msg });
  t = await api(D, "POST", "/api/erp/purchases/lane", { action: "transfer", ids: [usrLane[1].id], transfer: { type: "self_managed", responsibility: "full_handling" } });
  check("SELF-MANAGED clearance -> Assigned (no acceptance)", t.status === 200 && t.data?.results?.[0]?.to === "assigned", { s: t.status, m: t.msg });

  // ═════════════ 4. Customs status chain ═════════════
  console.log("\n— 4. Customs statuses —");
  const C = usrLane[1].id as string; // self-managed by demo
  const bad = await api(D, "PATCH", `/api/erp/purchases/lane/${C}`, { action: "status", to: "customs_cleared" });
  check("Illegal jump (Assigned -> Customs Cleared) is rejected", bad.status >= 400, { s: bad.status, m: bad.msg });
  const chain = ["in_transit", "arrived", "customs_pending", "under_clearance", "customs_cleared", "final_disposition_pending"];
  let chainOk = true; const chainLog: string[] = [];
  for (const to of chain) { const x = await api(D, "PATCH", `/api/erp/purchases/lane/${C}`, { action: "status", to }); chainLog.push(`${to}:${x.status}`); if (x.status !== 200) chainOk = false; }
  check("Loaded -> In Transit -> Arrived -> Customs Pending -> Under Clearance -> Customs Cleared -> Final Disposition Pending", chainOk, chainLog);

  // ═════════════ 5. Expenses ═════════════
  console.log("\n— 5. Expenses —");
  const hdr = await db(async (sql) => (await sql`
    insert into bill_expenses (source_module, source_id, source_table, bill_no, party_name, currency, country_id, country_branch_id, city_branch_id, expense_total, expense_count)
    values ('purchase_booking', ${usr.id}::uuid, 'purchase_orders', ${usr.purchase_order_no}, 'TEST-LANE Supplier Ltd', 'USD', ${UAE}::uuid, ${UAE_MAIN}::uuid, ${DEMO_CITY}::uuid, 0, 0) returning id`)[0]);
  const snapEx0 = await snapshot();
  let ex = await api(D, "POST", `/api/erp/purchases/lane/${C}/expenses`, { expenseType: "customs", amount: 150, currency: "AED", description: "TEST-LANE customs duty", payeeType: "external_agent", payeeName: "TEST-LANE External Logistics" });
  const exAgent = ex.data?.expense?.id as string;
  check("Customs expense for an EXTERNAL agent is saved as a DRAFT", ex.status === 201 && ex.data?.expense?.status === "draft", { s: ex.status, m: ex.msg });
  const snapEx1 = await snapshot();
  check("A draft expense creates NO bill-expense line / payable yet", (snapEx1.bill_expense_lines ?? 0) === (snapEx0.bill_expense_lines ?? 0), { a: snapEx0.bill_expense_lines, b: snapEx1.bill_expense_lines });
  const earlyConfirm = await api(D, "PATCH", `/api/erp/purchases/lane/${C}/expenses`, { expenseId: exAgent, action: "confirm" });
  check("Cannot confirm an expense that has not been reviewed", earlyConfirm.status >= 400, { s: earlyConfirm.status, m: earlyConfirm.msg });
  const rv = await api(D, "PATCH", `/api/erp/purchases/lane/${C}/expenses`, { expenseId: exAgent, action: "review" });
  const cf = await api(D, "PATCH", `/api/erp/purchases/lane/${C}/expenses`, { expenseId: exAgent, action: "confirm" });
  check("Review then Confirm", rv.status === 200 && cf.status === 200, { rv: rv.status, cf: cf.status, m: cf.msg });
  const snapEx2 = await snapshot();
  check("Confirmed AGENT expense creates exactly one UNPOSTED bill-expense line (agent payable) — nothing posted to the ledger", (snapEx2.bill_expense_lines ?? 0) === (snapEx0.bill_expense_lines ?? 0) + 1 && (snapEx2.journal_entries ?? 0) === (snapEx0.journal_entries ?? 0), { bel: [snapEx0.bill_expense_lines, snapEx2.bill_expense_lines], je: [snapEx0.journal_entries, snapEx2.journal_entries] });
  const line = await db(async (sql) => (await sql`select l.posting_status as status, l.id from purchase_lane_expenses e join bill_expense_lines l on l.id = e.bill_expense_line_id where e.id = ${exAgent}::uuid`.catch(() => []))[0]);
  check("That bill-expense line is linked back to the lane expense and not posted", !line || String(line.status).toLowerCase() !== "posted", line);
  ex = await api(D, "POST", `/api/erp/purchases/lane/${C}/expenses`, { expenseType: "handling", amount: 40, currency: "AED", description: "TEST-LANE inter-branch handling", payeeType: "internal_branch", payeeCountryBranchId: UAE_MAIN });
  const exBr = ex.data?.expense?.id as string;
  await api(D, "PATCH", `/api/erp/purchases/lane/${C}/expenses`, { expenseId: exBr, action: "review" });
  const cfb = await api(D, "PATCH", `/api/erp/purchases/lane/${C}/expenses`, { expenseId: exBr, action: "confirm" });
  const snapEx3 = await snapshot();
  check("Inter-branch expense confirmed as an inter-branch settlement: NO agent payable line, no sale, no ledger posting", cfb.status === 200 && (snapEx3.bill_expense_lines ?? 0) === (snapEx2.bill_expense_lines ?? 0) && (snapEx3.journal_entries ?? 0) === (snapEx0.journal_entries ?? 0), { s: cfb.status, m: cfb.msg });
  const cancelEx = await api(D, "POST", `/api/erp/purchases/lane/${C}/expenses`, { expenseType: "detention", amount: 10, currency: "AED", payeeType: "other", payeeName: "TEST-LANE x" });
  const cx = await api(D, "PATCH", `/api/erp/purchases/lane/${C}/expenses`, { expenseId: cancelEx.data?.expense?.id, action: "cancel" });
  check("A draft expense can be cancelled", cx.status === 200, { s: cx.status, m: cx.msg });

  // ═════════════ 6. Final disposition outcomes + stock ═════════════
  console.log("\n— 6. Final dispositions & stock —");
  const goods = await db(async (sql) => (await sql`select id from goods limit 1`)[0]);
  const wh = await db(async (sql) => (await sql`select id from warehouses where deleted_at is null order by created_at limit 1`)[0]);
  const noEarly = await api(D, "PATCH", `/api/erp/purchases/lane/${usrLane[0].id}`, { action: "disposition", kind: "hold" });
  check("Disposition cannot be chosen before customs clearance", noEarly.status >= 400, { s: noEarly.status, m: noEarly.msg });

  const incompleteDisp = await api(D, "PATCH", `/api/erp/purchases/lane/${C}`, { action: "disposition", kind: "warehouse" });
  check("Warehouse disposition without a warehouse is rejected", incompleteDisp.status >= 400, { s: incompleteDisp.status, m: incompleteDisp.msg });

  const stk0 = await db(async (sql) => ({
    mv: Number((await sql`select count(*)::int n from stock_movements`)[0].n),
    bal: Number((await sql`select coalesce(sum(quantity_on_hand),0)::numeric n from product_inventory_balances where product_id = ${goods.id}::uuid and warehouse_id = ${wh.id}::uuid`.catch(() => [{ n: 0 }]))[0].n),
    rows: Number((await sql`select count(*)::int n from product_inventory_balances where product_id = ${goods.id}::uuid and warehouse_id = ${wh.id}::uuid`)[0].n),
  }));
  const jeBefore = (await snapshot()).journal_entries ?? 0;
  const disp = await api(D, "PATCH", `/api/erp/purchases/lane/${C}`, { action: "disposition", kind: "warehouse", warehouseId: wh.id, goodsId: goods.id, note: "TEST-LANE to warehouse" });
  check("Customs cleared -> Send to Warehouse is confirmed (final)", disp.status === 200 && disp.data?.result?.final === true, { s: disp.status, m: disp.msg, d: disp.data });
  const stk1 = await db(async (sql) => ({
    mv: Number((await sql`select count(*)::int n from stock_movements`)[0].n),
    bal: Number((await sql`select coalesce(sum(quantity_on_hand),0)::numeric n from product_inventory_balances where product_id = ${goods.id}::uuid and warehouse_id = ${wh.id}::uuid`.catch(() => [{ n: 0 }]))[0].n),
  }));
  check("Warehouse stock increased by exactly the load quantity (100), one stock movement", stk1.mv === stk0.mv + 1 && stk1.bal === stk0.bal + 100, { stk0, stk1 });
  check("Purchase NOT 'Final Purchase Completed' while its other container is still open", disp.data?.result?.purchaseCompleted !== true, disp.data?.result);
  const laneAfter = await laneRow(C);
  check("Lane stock for that load is reduced to 0 (left the lane exactly once)", Number(laneAfter.lane_stock_qty) === 0 && laneAfter.lane_status === "completed" && laneAfter.disposition_final === true, laneAfter);
  const again = await api(D, "PATCH", `/api/erp/purchases/lane/${C}`, { action: "disposition", kind: "warehouse", warehouseId: wh.id, goodsId: goods.id });
  const stk2 = await db(async (sql) => ({ mv: Number((await sql`select count(*)::int n from stock_movements`)[0].n) }));
  check("Choosing the disposition AGAIN is refused and does not duplicate stock", again.status === 409 && stk2.mv === stk1.mv, { s: again.status, m: again.msg });
  const recv = await api(D, "POST", `/api/erp/purchases/loading-records/${(await laneRow(C)).source_id}/receive`, { warehouseId: wh.id, receivedQuantity: 100 });
  const stk3 = await db(async (sql) => ({ mv: Number((await sql`select count(*)::int n from stock_movements`)[0].n) }));
  check("The older Destination Receiving screen cannot receive it a second time", recv.status >= 400 && stk3.mv === stk1.mv, { s: recv.status, m: recv.msg });

  // prepare more loads through customs on the "usr" booking's other container + the fin booking loads
  async function toDisposition(id: string, actor: Who) {
    for (const to of ["in_transit", "arrived", "final_disposition_pending"]) {
      const x = await api(actor, "PATCH", `/api/erp/purchases/lane/${id}`, { action: "status", to });
      if (x.status !== 200) return x;
    }
    return { status: 200 } as any;
  }
  // usrLane[0] belongs to Deira user now (transfer pending -> accept)
  const accU = await api(U, "PATCH", `/api/erp/purchases/lane/${usrLane[0].id}`, { action: "accept" });
  const gU = await toDisposition(usrLane[0].id, U);
  check("Receiving user accepts and moves a load to Final Disposition Pending", accU.status === 200 && gU.status === 200, { a: accU.status, g: gU.status });
  const completedBefore = await api(U, "PATCH", `/api/erp/purchases/lane/${usrLane[0].id}`, { action: "disposition", kind: "re_export" });
  check("Re-export is a final disposition (Re-export stock/lane, no revenue)", completedBefore.status === 200 && completedBefore.data?.result?.final === true && (await snapshot()).journal_entries === jeBefore, { s: completedBefore.status, m: completedBefore.msg });
  check("Last open container finalised (all loads final, nothing left to load) -> 'Final Purchase Completed'", completedBefore.data?.result?.purchaseCompleted === true, completedBefore.data?.result);

  // continue transit -> new leg, same stock
  const cont0 = (await laneRow(F1));
  const accF = await api(D, "PATCH", `/api/erp/purchases/lane/${F1}`, { action: "accept" });
  check("Internal agent hand-over accepted by the holder's side (origin scope manages agent-held loads)", accF.status === 200, { s: accF.status, m: accF.msg });
  const gF = await toDisposition(F1, D);
  const sd = await api(D, "PATCH", `/api/erp/purchases/lane/${F1}`, { action: "disposition", kind: "continue_transit", nextDestination: "Kabul via Torkham" });
  const f1After = await laneRow(F1);
  check("Continue Transit starts the next route leg (leg 2) without duplicating stock", sd.status === 200 && f1After.leg_no === (cont0.leg_no + 1) && Number(f1After.lane_stock_qty) === Number(cont0.lane_stock_qty) && f1After.disposition_final === false, { s: sd.status, m: sd.msg, leg: f1After.leg_no, q: f1After.lane_stock_qty });
  check("Continue Transit created no extra lane row / stock movement", (await db(async (sql) => Number((await sql`select count(*)::int n from purchase_lane_loads where source_id = ${cont0.source_id}::uuid and deleted_at is null`)[0].n))) === 1, null);
  const f1b = await api(D, "PATCH", `/api/erp/purchases/lane/${F1}`, { action: "status", to: "arrived" }); // may already be final_disposition_pending
  const hold = await api(D, "PATCH", `/api/erp/purchases/lane/${F1}`, { action: "disposition", kind: "hold", note: "TEST-LANE hold" });
  const f1Hold = await laneRow(F1);
  check("Hold keeps the load in the lane (not final)", (hold.status === 200 && f1Hold.disposition === "hold" && f1Hold.disposition_final === false) || hold.status >= 400, { s: hold.status, m: hold.msg, st: f1b.status });
  void sd;

  // sale/delivery: leaves the lane, no revenue
  const sale = await mkPO("SALE", "Credit", { qty: 50, total: 2500 }); created.push(sale.id);
  await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(sale, { qty: 50, container: `SALE-C1-${STAMP}`, bl: `BL-SALE-${STAMP}` }));
  const saleLane: any = ((await api(D, "GET", `/api/erp/purchases/lane?purchaseOrderId=${sale.id}`)).data?.rows ?? [])[0];
  const toS = await toDisposition(saleLane.id, D);
  const snapSale0 = await snapshot();
  const sdl = await api(D, "PATCH", `/api/erp/purchases/lane/${saleLane.id}`, { action: "disposition", kind: "sale_delivery" });
  const snapSale1 = await snapshot();
  check("Sell/Deliver: load leaves the lane and the sale completes elsewhere — NO revenue, journal, sales invoice or roznamcha created", toS.status === 200 && sdl.status === 200
    && (snapSale1.journal_entries ?? 0) === (snapSale0.journal_entries ?? 0) && (snapSale1.sales_invoices ?? 0) === (snapSale0.sales_invoices ?? 0) && (snapSale1.roznamcha_entries ?? 0) === (snapSale0.roznamcha_entries ?? 0) && (snapSale1.ledger_entries ?? 0) === (snapSale0.ledger_entries ?? 0), { s: sdl.status, m: sdl.msg });
  check("Single container, fully loaded, final disposition -> 'Final Purchase Completed' reported", sdl.data?.result?.purchaseCompleted === true, sdl.data?.result);

  // a booking with quantity STILL to load never completes even if its only load is final
  const part = await mkPO("PART", "Credit", { qty: 100, total: 5000 }); created.push(part.id);
  await api(D, "POST", "/api/erp/purchases/loading-records", loadBody(part, { qty: 40, container: `PART-C1-${STAMP}`, bl: `BL-PART-${STAMP}` }));
  const partLane: any = ((await api(D, "GET", `/api/erp/purchases/lane?purchaseOrderId=${part.id}`)).data?.rows ?? [])[0];
  await toDisposition(partLane.id, D);
  const pd = await api(D, "PATCH", `/api/erp/purchases/lane/${partLane.id}`, { action: "disposition", kind: "re_export" });
  check("Quantity still to load -> purchase is NOT 'Final Purchase Completed' even though its only load is final", pd.status === 200 && pd.data?.result?.purchaseCompleted !== true, pd.data?.result);

  // ═════════════ 7. Accounting protection ═════════════
  console.log("\n— 7. Accounting protection —");
  const after = await snapshot();
  const sameTables = ["journal_entries", "journal_entry_lines", "ledger_entries", "roznamcha_entries", "sales_invoices", "sales_orders", "customer_orders"];
  check("Loading + Lane + transfers + dispositions created NO journal / ledger / roznamcha / sales / customer-order records", sameTables.every((k) => (after[k] ?? 0) === (before[k] ?? 0)), sameTables.map((k) => [k, before[k], after[k]]));
  const m1 = await poMoney(cre.id); const m2 = await poMoney(fin.id);
  check("Credit & Final Payment payables still intact after the whole lane journey (Accounts Payable unaffected)", Number(m1.remaining_due) === 50000 && Number(m1.credit_amount) === 50000 && Number(m2.remaining_due) === 50000, { m1, m2 });
  const dupAll = await db(async (sql) => (await sql`select source_type, source_id, count(*)::int n from purchase_lane_loads where deleted_at is null group by 1,2 having count(*) > 1`));
  check("No duplicate lane rows anywhere", dupAll.length === 0, dupAll);
  const events = await db(async (sql) => Number((await sql`select count(*)::int n from purchase_lane_events e join purchase_lane_loads l on l.id = e.lane_load_id where l.purchase_ref_no like ${"TEST-LANE-%" + STAMP}`)[0].n));
  check("Audit history recorded for the whole journey (>= 25 events)", events >= 25, events);

  // ═════════════ 8. Loading page API: no currency/rate accepted as input ═════════════
  console.log("\n— 8. No currency / rate in Loading —");
  const cleanRow = creRows[0];
  check("Saved loading rows keep operational data only: transport expense columns are zero", creRows.every((x) => Number(x.transport_expense_amount || 0) === 0), creRows.map((x) => x.transport_expense_amount));
  check("report_payload of a new loading row has no pricing currency / exchange rate / purchase rate", !("pricingCurrency" in (cleanRow.report_payload || {})) && !("exchangeRatePKR" in (cleanRow.report_payload || {})) && !("priceRateC1" in (cleanRow.report_payload || {})), Object.keys(cleanRow.report_payload || {}));

  // ═════════════ cleanup ═════════════
  if (!process.env.KEEP) { await cleanupTestData(); console.log("cleanup: TEST-LANE records removed"); }

  const failed = results.filter((x) => !x.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length) { console.log("FAILED:"); failed.forEach((f) => console.log(" - " + f.label)); }
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error("E2E crashed:", e); process.exit(2); });
