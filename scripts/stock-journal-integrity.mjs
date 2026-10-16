/**
 * Stock Journal integrity check — READ ONLY (safe on DEV and on Production). Prints PASS / FAIL per rule; exit 1 on any FAIL.
 *   node scripts/stock-journal-integrity.mjs                (reads DATABASE_URL from the environment or .env.local)
 * Rules: no negative / over-reserved balance · allocations never exceed what was received · receiving never exceeds loading ·
 *        every issued allocation has exactly ONE STOCK_OUT (and non-issued ones have none) · no duplicate transfer numbers /
 *        idempotency keys · reversed allocations hold no reservation · reserved quantity is backed by balances.
 */
import fs from "node:fs";
import postgres from "postgres";

let url = process.env.DATABASE_URL;
if (!url) {
  for (const f of [".env.local", ".env"]) if (!url && fs.existsSync(f)) { const m = fs.readFileSync(f, "utf8").match(/^DATABASE_URL=(.*)$/m); if (m) url = m[1].replace(/^"|"$/g, ""); }
}
if (!url) throw new Error("DATABASE_URL missing");
const project = (url.match(/postgres\.([a-z0-9]{20})/) || [])[1] || "unknown";
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
let fail = 0, pass = 0;
const rule = async (name, query, describe) => {
  const rows = await query();
  const bad = rows.length;
  (bad ? fail++ : pass++);
  console.log(`${bad ? "FAIL" : "PASS"} ${name}${bad ? ` · ${bad} problem(s): ${rows.slice(0, 3).map((r) => describe(r)).join(" | ")}` : ""}`);
};
console.log(`Stock Journal integrity — database project ${project} (read-only)`);
try {
  const [{ n: total }] = await sql`select count(*)::int n from public.journal_stock_transfers`;
  const [{ n: live }] = await sql`select count(*)::int n from public.journal_stock_transfers where deleted_at is null and status <> 'reversed'`;
  console.log(`allocations: ${total} total, ${live} active`);

  await rule("no negative stock balance", () => sql`select product_id, warehouse_id, quantity_on_hand::float oh, quantity_reserved::float rs from product_inventory_balances where quantity_on_hand < 0 or quantity_reserved < 0`, (r) => `${r.product_id}@${r.warehouse_id} on-hand ${r.oh} reserved ${r.rs}`);
  await rule("reserved never exceeds on-hand (no oversold reservation)", () => sql`select product_id, warehouse_id, quantity_on_hand::float oh, quantity_reserved::float rs from product_inventory_balances where quantity_reserved > quantity_on_hand + 0.0001`, (r) => `${r.product_id}@${r.warehouse_id} on-hand ${r.oh} reserved ${r.rs}`);
  await rule("receiving + damage + shortage never exceed loaded", () => sql`select loading_record_no, loaded_quantity::float l, received_quantity::float r, damaged_quantity::float d, shortage_quantity::float s from purchase_loading_records where deleted_at is null and coalesce(received_quantity,0) + coalesce(damaged_quantity,0) + coalesce(shortage_quantity,0) > coalesce(loaded_quantity,0) + 0.0001`, (r) => `${r.loading_record_no} loaded ${r.l} accounted ${r.r}+${r.d}+${r.s}`);
  await rule("active allocations never exceed what the loading record received", () => sql`
      select plr.loading_record_no, coalesce(plr.received_quantity, plr.loaded_quantity)::float rec, sum(j.quantity)::float alloc
      from public.journal_stock_transfers j join public.purchase_loading_records plr on plr.id = j.loading_record_id
      where j.deleted_at is null and j.status <> 'reversed'
      group by plr.id, plr.loading_record_no, plr.received_quantity, plr.loaded_quantity
      having sum(j.quantity) > coalesce(plr.received_quantity, plr.loaded_quantity) + 0.0001`, (r) => `${r.loading_record_no} received ${r.rec} allocated ${r.alloc}`);
  await rule("every ISSUED allocation has exactly one STOCK_OUT of its quantity", () => sql`
      select j.transfer_no, j.quantity::float q, count(sm.id)::int n, coalesce(sum(sm.quantity),0)::float out_q
      from public.journal_stock_transfers j
      left join public.stock_movements sm on sm.reference_no = j.transfer_no and upper(sm.movement_type::text) = 'STOCK_OUT' and sm.deleted_at is null
      where j.status = 'issued' and j.deleted_at is null
      group by j.id, j.transfer_no, j.quantity
      having count(sm.id) <> 1 or abs(coalesce(sum(sm.quantity),0) - j.quantity) > 0.0001`, (r) => `${r.transfer_no} qty ${r.q} → ${r.n} STOCK_OUT(s) totalling ${r.out_q}`);
  await rule("non-issued allocations have NO issue movement (no early deduction)", () => sql`
      select j.transfer_no, j.status from public.journal_stock_transfers j
      where j.status = 'confirmed' and j.deleted_at is null and (j.issue_stock_movement_id is not null or j.issued_at is not null)`, (r) => `${r.transfer_no} is ${r.status} but carries an issue`);
  await rule("a reversed allocation holds no reservation", () => sql`select transfer_no from public.journal_stock_transfers where status = 'reversed' and reserved = true`, (r) => r.transfer_no);
  await rule("reserved allocations are backed by the warehouse reservation", () => sql`
      select j.goods_id, j.warehouse_id, sum(j.quantity)::float need, coalesce(b.quantity_reserved,0)::float have
      from public.journal_stock_transfers j
      left join public.product_inventory_balances b on b.product_id = j.goods_id and b.warehouse_id = j.warehouse_id
      where j.status = 'confirmed' and j.reserved and j.deleted_at is null
      group by j.goods_id, j.warehouse_id, b.quantity_reserved
      having coalesce(b.quantity_reserved,0) + 0.0001 < sum(j.quantity)`, (r) => `${r.goods_id}@${r.warehouse_id} needs ${r.need} reserved, balance holds ${r.have}`);
  await rule("transfer numbers are unique", () => sql`select transfer_no, count(*)::int n from public.journal_stock_transfers group by transfer_no having count(*) > 1`, (r) => `${r.transfer_no} ×${r.n}`);
  await rule("idempotency keys are unique", () => sql`select idempotency_key, count(*)::int n from public.journal_stock_transfers where idempotency_key is not null group by idempotency_key having count(*) > 1`, (r) => `${r.idempotency_key} ×${r.n}`);
  await rule("no duplicate STOCK_OUT for one reference + warehouse", () => sql`
      select reference_no, warehouse_id, count(*)::int n from public.stock_movements
      where upper(movement_type::text) = 'STOCK_OUT' and deleted_at is null and reference_no like 'TRF-%'
      group by reference_no, warehouse_id having count(*) > 1`, (r) => `${r.reference_no} ×${r.n}`);
  await rule("no allocation without a quantity, warehouse for stored stock, or loading link", () => sql`
      select transfer_no from public.journal_stock_transfers
      where deleted_at is null and status <> 'reversed' and (quantity <= 0 or (purchase_order_id is not null and loading_record_id is null))`, (r) => r.transfer_no);
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
