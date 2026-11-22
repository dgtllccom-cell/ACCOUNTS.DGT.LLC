/**
 * DEV ONLY — a sales booking with TWO goods lines from TWO different warehouse lots (what the wizard saves for a real order).
 *   BASE=http://localhost:3000 node scripts/dev/sales-warehouse-stock-multiline-e2e.mjs
 * Each saved line must take its own quantity from its own lot, exactly once, when the booking is transferred.
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

const SCOPE = { countryId: "935dd0b9-8228-43b3-b53d-c06e9ae2882f", countryBranchId: "87c2e253-b6c1-482d-a808-272337f3ffda", cityBranchId: "79b31aba-45f1-4aba-9068-fb3eb2102a81" };
const CUST = { accountId: "caf19b1b-7a0c-46da-a4e5-56db8710bd78", ledgerId: "745485bc-414c-40d8-a671-0369c9d4a02a", no: "CHAIN-MTG4227P-CUST" };
const SALES = { accountId: "1c380f24-0a06-424d-a9d2-ce754e8937d9", no: "CHAIN-MTG4227P-SALES" };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { (ok ? pass++ : fail++); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " · " + detail : ""}`); };

const cookie = await (async () => {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
  const c = (r.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  if (!c) throw new Error("dev-session failed " + r.status);
  return c;
})();
const H = { cookie, "content-type": "application/json" };
const onHand = async (id) => Number((await sql`select quantity_on_hand::numeric as oh from public.product_inventory_balances where id = ${id}::uuid`)[0].oh);

try {
  // two different warehouse lots that the Sales picker itself offers for this branch (same list the wizard reads)
  const listed = (await (await fetch(`${BASE}/api/erp/sales/available-lots?source=warehouse&limit=500`, { headers: H })).json()).data?.lots || [];
  const lots = listed.filter((l) => l.warehouseId && l.goodsId && Number(l.remainingQty ?? l.availableQty) >= 10).slice(0, 2)
    .map((l) => ({ id: l.id, product_id: l.goodsId, warehouse_id: l.warehouseId, goods_name: l.goodsName }));
  if (lots.length < 2) throw new Error("need two warehouse lots the picker offers");
  const [A, B] = lots;
  const qa = 4, qb = 6;
  const ohA0 = await onHand(A.id), ohB0 = await onHand(B.id);

  const line = (L, q) => {
    const lotNo = `WH-${String(L.id).slice(0, 8)}`;
    return { goodsName: L.goods_name, goodsId: L.product_id, qtyNo: q, qtyName: "BAGS", coursePrice: 10, currency: "AED", lotNo, stockLotNo: lotNo, allotName: lotNo,
      stockSource: "warehouse", saleSource: "warehouse", selectedLotId: L.id, warehouseId: L.warehouse_id, lotId: "", managedLotId: "" };
  };
  const total = (qa + qb) * 10;
  const body = {
    ...SCOPE, customerAccountId: CUST.accountId, customerLedgerId: CUST.ledgerId, currencyCode: "AED", exchangeRate: 1,
    quantity: qa + qb, orderTotal: total, totalGoodsLocal: total, totalGoodsOriginal: total, totalGoodsUsd: 0, salesStatus: "draft",
    customerName: "E2E-MULTI-" + Date.now().toString().slice(-5),
    formData: {
      // the wizard clears the form-level pick after each line, so no stock fields here: the lines carry the stock
      form: { customerAccountNo: CUST.no, customerAccountId: CUST.accountId, customerAccountLedgerId: CUST.accountId, salesAccountNo: SALES.no, salesAccountName: SALES.no, salesAccountLedgerId: SALES.accountId,
        customerName: "E2E multi customer", saleSource: "warehouse", currencyType: "AED", salesCurrency: "AED", secondaryCurrency: "AED", exchangeRate: 1, paymentType: "Cash" },
      goodsEntries: [line(A, qa), line(B, qb)],
    },
  };
  const c = await fetch(`${BASE}/api/erp/sales/orders`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const cj = await c.json().catch(() => ({}));
  check("two-line draft saved", c.status === 201 && !!cj?.data?.salesOrderId, `HTTP ${c.status} ${JSON.stringify(cj?.error ?? cj).slice(0, 300)}`);
  const soId = cj?.data?.salesOrderId, soNo = cj?.data?.salesOrderNo;
  check("draft does not move physical stock", (await onHand(A.id)) === ohA0 && (await onHand(B.id)) === ohB0);

  const t = await fetch(`${BASE}/api/erp/sales/orders/${soId}/transfer`, { method: "POST", headers: H, body: JSON.stringify({}) });
  check("two-line transfer succeeds", t.status === 200, `HTTP ${t.status}`);

  const ohA1 = await onHand(A.id), ohB1 = await onHand(B.id);
  check("lot A falls by its own line quantity exactly once", ohA1 === ohA0 - qa, `${ohA0} → ${ohA1} (expected −${qa})`);
  check("lot B falls by its own line quantity exactly once", ohB1 === ohB0 - qb, `${ohB0} → ${ohB1} (expected −${qb})`);
  const [mv] = await sql`select count(*)::int as n from public.stock_movements where reference_no = ${soNo} and movement_type = 'STOCK_OUT'`;
  check("one STOCK_OUT row per line", mv.n === 2, `rows=${mv.n}`);
} catch (e) {
  fail++;
  console.log("FAIL run · " + (e?.message || e));
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
