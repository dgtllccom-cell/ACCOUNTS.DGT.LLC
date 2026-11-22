/**
 * DEV ONLY — Sales booking from WAREHOUSE stock: draft save → transfer to payment → stock + picker consistency.
 *   BASE=http://localhost:3000 node scripts/dev/sales-warehouse-stock-e2e.mjs
 * Regression for two defects fixed together:
 *  1. the transfer's stock_movements insert used `product_id` (the column is `goods_id`), so every warehouse-stock sale
 *     failed with 500 AFTER the cash payment had posted, and the on-hand decrement stayed behind without its movement row;
 *  2. the sales picker subtracted a POSTED sale again after its stock had already left the warehouse (double count).
 * Uses the real routes on the DEV database only. Creates DEV sales bookings (SO-…) and does not delete them.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const postgres = createRequire(import.meta.url)("postgres");

const BASE = process.env.BASE || "http://localhost:3000";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const DB = process.env.DATABASE_URL || env.DATABASE_URL;
if (!DB.includes("csesvyxxjivnkkozgopt") || DB.includes("inmayhrxucimxqhgseqi")) throw new Error("Refusing: not the DEV database");
const sql = postgres(DB, { max: 2, prepare: false, onnotice: () => {} });

// UAE DEV scope and DEV chain accounts (customer + sales), as seeded in the DEV database
const SCOPE = { countryId: "935dd0b9-8228-43b3-b53d-c06e9ae2882f", countryBranchId: "87c2e253-b6c1-482d-a808-272337f3ffda", cityBranchId: "79b31aba-45f1-4aba-9068-fb3eb2102a81" };
const CUST = { accountId: "caf19b1b-7a0c-46da-a4e5-56db8710bd78", ledgerId: "745485bc-414c-40d8-a671-0369c9d4a02a", no: "CHAIN-MTG4227P-CUST" };
const SALES = { accountId: "1c380f24-0a06-424d-a9d2-ce754e8937d9", no: "CHAIN-MTG4227P-SALES" };
const QTY = Number(process.env.QTY || 10);

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { (ok ? pass++ : fail++); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " · " + detail : ""}`); };

async function session() {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
  const c = (r.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  if (!c) throw new Error("dev-session failed " + r.status);
  return c;
}
const cookie = await session();
const H = { cookie, "content-type": "application/json" };

async function pickerQty(lotId) {
  const r = await fetch(`${BASE}/api/erp/sales/available-lots?source=warehouse&limit=500`, { headers: H });
  const lots = (await r.json()).data?.lots || [];
  const l = lots.find((x) => x.id === lotId);
  return l ? Number(l.remainingQty ?? l.availableQty) : null;
}
async function onHand(lotId) {
  const [b] = await sql`select quantity_on_hand::numeric as oh from public.product_inventory_balances where id = ${lotId}::uuid`;
  return Number(b.oh);
}

try {
  const [b] = await sql`select pib.id, pib.product_id, pib.warehouse_id, g.goods_name from public.product_inventory_balances pib join public.goods g on g.id = pib.product_id
    where pib.country_id = ${SCOPE.countryId}::uuid and pib.quantity_on_hand > ${QTY * 3} and g.deleted_at is null order by pib.quantity_on_hand desc limit 1`;
  if (!b) throw new Error("no DEV warehouse balance with enough stock");
  const lotNo = `WH-${String(b.id).slice(0, 8)}`;

  const oh0 = await onHand(b.id);
  const p0 = await pickerQty(b.id);

  // 1. draft booking (reserves the quantity in the picker, does not move physical stock yet)
  const body = {
    ...SCOPE, customerAccountId: CUST.accountId, customerLedgerId: CUST.ledgerId, currencyCode: "AED", exchangeRate: 1,
    quantity: QTY, orderTotal: QTY * 10, totalGoodsLocal: QTY * 10, totalGoodsOriginal: QTY * 10, totalGoodsUsd: 0, salesStatus: "draft",
    customerName: "E2E-WH-" + Date.now().toString().slice(-5),
    formData: {
      form: { customerAccountNo: CUST.no, customerAccountId: CUST.accountId, customerAccountLedgerId: CUST.accountId, salesAccountNo: SALES.no, salesAccountName: SALES.no, salesAccountLedgerId: SALES.accountId,
        customerName: "E2E WH customer", saleSource: "warehouse", currencyType: "AED", salesCurrency: "AED", secondaryCurrency: "AED", exchangeRate: 1, paymentType: "Cash",
        /* the wizard clears the form-level pick after each line: stock travels on the goods line only */ },
      goodsEntries: [{ goodsName: b.goods_name, goodsId: b.product_id, qtyNo: QTY, qtyName: "BAGS", coursePrice: 10, currency: "AED", lotNo, stockLotNo: lotNo, allotName: lotNo,
        stockSource: "warehouse", saleSource: "warehouse", selectedLotId: b.id, warehouseId: b.warehouse_id, lotId: "", managedLotId: "" }],
    },
  };
  const c = await fetch(`${BASE}/api/erp/sales/orders`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const cj = await c.json().catch(() => ({}));
  check("draft booking saved", c.status === 201 && !!cj?.data?.salesOrderId, `HTTP ${c.status}`);
  const soId = cj?.data?.salesOrderId;
  const soNo = cj?.data?.salesOrderNo;
  const p1 = await pickerQty(b.id);
  check("draft reduces the picker by the sold quantity", p1 === p0 - QTY, `${p0} → ${p1}`);
  check("draft does NOT move physical stock yet", (await onHand(b.id)) === oh0);

  // 2. transfer to payment (posts the sale and deducts the warehouse stock once)
  const t = await fetch(`${BASE}/api/erp/sales/orders/${soId}/transfer`, { method: "POST", headers: H, body: JSON.stringify({}) });
  const tj = await t.json().catch(() => ({}));
  check("transfer succeeds (no product_id column error)", t.status === 200 && tj?.data?.ledgerPostingStatus === "posted", `HTTP ${t.status}`);

  const oh2 = await onHand(b.id);
  check("physical stock falls by the sold quantity exactly once", oh2 === oh0 - QTY, `${oh0} → ${oh2}`);
  const [mv] = await sql`select count(*)::int as n from public.stock_movements where reference_no = ${soNo} and movement_type = 'STOCK_OUT' and goods_id = ${b.product_id}::uuid and quantity = ${QTY}`;
  check("one STOCK_OUT movement row is written for this sale", mv.n === 1, `rows=${mv.n}`);

  const p2 = await pickerQty(b.id);
  check("posting does NOT subtract the posted sale a second time", p2 === p1, `${p1} → ${p2}`);

  const [so] = await sql`select ledger_posting_status from public.sales_orders where id = ${soId}::uuid`;
  check("sales booking shows the ledger as posted", so?.ledger_posting_status === "posted", so?.ledger_posting_status);
} catch (e) {
  fail++;
  console.log("FAIL run · " + (e?.message || e));
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
