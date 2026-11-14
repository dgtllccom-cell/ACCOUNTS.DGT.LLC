/**
 * Lot-level Current Stock for the Warehouse Stock Register. READ ONLY: writes nothing.
 *
 * Sources, each stock flow counted once by its own record id:
 *   local purchase lots : purchase_lots (original lot: lot_no = name, lot_ref = number, purchased quantity)
 *                         lot_stock (quantity the lot holds in each warehouse) and lot_movements (history of every move)
 *   booking loadings    : stock_movements STOCK_IN linked to a purchase_loading_records row (receipt into the warehouse),
 *                         and journal_stock_transfers.issue_stock_movement_id (sale). Lot name: the bill's goods entry
 *                         (allotName), else the loading's lot_name. Never invented: when neither is recorded the lot is
 *                         shown as "Lot Not Recorded".
 *   unrecorded          : any other STOCK_IN / STOCK_OUT movement. Kept, never dropped, grouped by goods and warehouse.
 * Mirrors are skipped: a stock_movements row written by the goods-transfer journal repeats a lot movement that is already
 * counted, so it is excluded here and its number is reported in `mirrorsSkipped`.
 */
import type { ErpSession } from "@/lib/auth/session";
import { authorizeApiScope, recordInSessionScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { parseJsonish } from "@/lib/stock-journal/model";
import { buildLotRows, lotTotals, NOT_RECORDED, reconcileLots, type LotFlow, type LotMeta, type LotState } from "@/lib/stock/lot-register";

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? "")).slice(0, 10);
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v: unknown) => String(v ?? "").trim();

export type LotRegisterFlowView = LotFlow & { container: string; seal: string; transport: string };

export async function loadLotRegister(session: ErpSession) {
  authorizeApiScope(session, { resource: "purchases", action: "read", countryId: null, countryBranchId: null, cityBranchId: null });

  const db = await withLocalPg(async (sql) => {
    const localLots = await sql`
      select pl.id::text as id, pl.lot_ref, pl.lot_no, pl.goods_id::text as goods_id, pl.goods_name, pl.brand, pl.size, pl.origin,
             pl.unit_name, pl.qty_purchased::float8 as purchased, pl.gross_weight_kg::float8 as gross_kg, pl.net_weight_kg::float8 as net_kg,
             pl.local_purchase_id::text as bill_id, pl.country_id, pl.country_branch_id, pl.city_branch_id,
             lp.manual_bill_no, lp.contract_no, coalesce(lp.origin_country_name, '') as origin_country
      from public.purchase_lots pl
      join public.local_purchases lp on lp.id = pl.local_purchase_id
      where pl.local_purchase_id is not null`;

    const lotStates = await sql`
      select s.lot_id::text as lot_id, s.warehouse_id::text as warehouse_id, s.qty::float8 as qty
      from public.lot_stock s
      where s.warehouse_id is not null and s.state = 'available'`;

    const lotMoves = await sql`
      select m.id::text as id, m.lot_id::text as lot_id, m.movement_type, m.from_state, m.to_state,
             m.from_warehouse_id::text as from_wh, m.to_warehouse_id::text as to_wh, m.qty::float8 as qty,
             m.reference_no, m.created_at, m.transfer_id::text as transfer_id
      from public.lot_movements m`;

    const transfers = await sql`select id::text as id, transfer_no, purpose, status from public.goods_transfers`;

    const movements = await sql`
      select sm.id::text as id, sm.movement_type, sm.goods_id::text as goods_id, sm.warehouse_id::text as warehouse_id,
             sm.quantity::float8 as qty, sm.movement_date, sm.created_at, sm.reference_no, sm.notes,
             sm.loading_record_id::text as loading_id, sm.purchase_order_id::text as purchase_order_id,
             sm.country_id, sm.country_branch_id, sm.city_branch_id,
             plr.lot_name as plr_lot_name, plr.loading_record_no, plr.purchase_order_id::text as plr_po_id, plr.loaded_quantity::float8 as plr_loaded,
             plr.gross_weight::float8 as plr_gross, plr.net_weight::float8 as plr_net, plr.container_number, plr.seal_number, plr.transport_mode,
             plr.transport_reference, plr.bl_number, plr.origin_text, plr.receiving_goods_id::text as receiving_goods_id,
             jst.transfer_no as sale_transfer_no, jst.customer_name, jst.sales_order_no, jst.loading_record_id::text as sale_loading_id,
             jst.issue_type, jst.id::text as sale_transfer_id
      from public.stock_movements sm
      left join public.purchase_loading_records plr on plr.id = sm.loading_record_id
      left join public.journal_stock_transfers jst on jst.issue_stock_movement_id = sm.id and jst.deleted_at is null
      where sm.deleted_at is null and sm.movement_type in ('STOCK_IN', 'STOCK_OUT', 'TRANSFER')`;

    const orders = await sql`
      select po.id::text as id, po.purchase_order_no, po.form_data
      from public.purchase_orders po
      where po.deleted_at is null and po.id in (
        select sm.purchase_order_id from public.stock_movements sm where sm.deleted_at is null and sm.purchase_order_id is not null
        union select plr.purchase_order_id from public.purchase_loading_records plr where plr.deleted_at is null and plr.purchase_order_id is not null)`;

    const warehouseNames = await sql`select id::text as id, coalesce(nullif(warehouse_name, ''), name_en, '') as name from public.warehouses where deleted_at is null`;
    const goodsNames = await sql`select id::text as id, goods_name from public.goods where deleted_at is null`;

    const balances = await sql`
      select b.product_id::text as goods_id, b.warehouse_id::text as warehouse_id, b.quantity_on_hand::float8 as on_hand,
             b.country_id, b.country_branch_id, b.city_branch_id
      from public.product_inventory_balances b`;

    return { localLots, lotStates, lotMoves, transfers, movements, orders, balances, warehouseNames, goodsNames };
  });
  if (!db) throw new Error("Unable to load the stock database.");

  // Scope: every record is kept only when the caller's scope covers it.
  const lots = (db.localLots as any[]).filter((r) => recordInSessionScope(session, r));
  const lotIds = new Set(lots.map((r) => r.id));
  const states = (db.lotStates as any[]).filter((r) => lotIds.has(r.lot_id));
  const moves = (db.lotMoves as any[]).filter((r) => lotIds.has(r.lot_id));
  const movements = (db.movements as any[]).filter((r) => recordInSessionScope(session, r));
  const balances = (db.balances as any[]).filter((r) => recordInSessionScope(session, r));

  // ── purchase bill goods entries (primary source for lot name, brand, size, origin) ──
  const billGoods = new Map<string, { no: string; entries: any[] }>();
  for (const o of db.orders as any[]) {
    const data = parseJsonish(o.form_data);
    const entries: any[] = Array.isArray(data?.goodsEntries) ? data.goodsEntries.filter((g: any) => g && typeof g === "object") : [];
    billGoods.set(o.id, { no: txt(o.purchase_order_no), entries });
  }
  const goodsEntryFor = (poId: string | null, goodsId: string | null) => {
    if (!poId) return null;
    const bill = billGoods.get(poId);
    if (!bill) return null;
    return bill.entries.find((g) => txt(g.goodsId ?? g.goods_id) && txt(g.goodsId ?? g.goods_id) === goodsId) ?? null;
  };

  // ── mirror detection: stock_movements rows repeating a lot movement that is already counted ──
  const transferNos = new Set((db.transfers as any[]).map((t) => txt(t.transfer_no)).filter(Boolean));
  const lotRefs = lots.map((l) => txt(l.lot_ref)).filter(Boolean);
  const isMirror = (m: any) => {
    const ref = txt(m.reference_no);
    if (ref && (transferNos.has(ref) || lotRefs.includes(ref))) return true;
    const notes = txt(m.notes);
    return !!notes && lotRefs.some((r) => notes.includes(r));
  };

  const metas = new Map<string, LotMeta>();
  const flows: LotFlow[] = [];
  const flowViews: Record<string, LotRegisterFlowView> = {};
  let mirrorsSkipped = 0;

  // ── 1. local purchase lots and their lot movements ──
  for (const l of lots) {
    const perUnit = (total: number) => (num(l.purchased) > 0 && total > 0 ? Math.round((total / num(l.purchased)) * 1e6) / 1e6 : null);
    const billNo = txt(l.manual_bill_no) || (txt(l.contract_no) ? `LP-${txt(l.contract_no)}` : `LP-${String(l.bill_id).slice(0, 8)}`);
    metas.set(l.id, {
      lotKey: l.id, source: "local_lot", goodsId: txt(l.goods_id), goodsName: txt(l.goods_name), brand: txt(l.brand), size: txt(l.size),
      origin: txt(l.origin) || txt(l.origin_country), lotName: txt(l.lot_no) || null, lotNo: txt(l.lot_ref) || null, billNo, billId: l.bill_id,
      purchased: num(l.purchased), grossPerUnit: perUnit(num(l.gross_kg)), netPerUnit: perUnit(num(l.net_kg)), unit: txt(l.unit_name),
    });
  }
  for (const m of moves) {
    const date = iso(m.created_at);
    const refNo = txt(m.reference_no) || txt(m.movement_type);
    const push = (kind: LotFlow["kind"], warehouseId: string, id: string) => {
      const f: LotFlow = { source: "local_lot", id, lotKey: m.lot_id, warehouseId, kind, qty: num(m.qty), date, refNo, note: txt(m.movement_type) };
      flows.push(f);
    };
    if (m.to_state === "sold" && (m.to_wh || m.from_wh)) push("sold", m.to_wh || m.from_wh, m.id);
    else if (m.to_state === "exported" && m.from_wh) push("exported", m.from_wh, m.id);
    else if (m.to_wh && m.to_state === "available" && m.to_wh !== m.from_wh) {
      if (m.from_wh) push("transfer_in", m.to_wh, `${m.id}:in`);
      else push("received", m.to_wh, m.id);
    } else if (m.from_wh && m.from_wh !== m.to_wh) {
      if (m.to_wh) {
        push("transfer_out", m.from_wh, `${m.id}:out`);
        push("transfer_in", m.to_wh, `${m.id}:in`);
      } else push("transfer_out", m.from_wh, m.id);
    }
    // movements that never touch a warehouse (in transit, reserve, loading, custody) do not change warehouse stock
  }

  // ── 2. booking loadings and any other stock movement ──
  for (const m of movements) {
    if (isMirror(m)) {
      mirrorsSkipped += 1;
      continue;
    }
    const qty = num(m.qty);
    const date = iso(m.movement_date ?? m.created_at);
    const warehouseId = txt(m.warehouse_id);
    if (!warehouseId || !(qty > 0)) continue;
    const isOut = m.movement_type === "STOCK_OUT";
    const isIn = m.movement_type === "STOCK_IN";
    if (!isIn && !isOut) continue; // TRANSFER direction is not recorded on the movement itself: never guessed

    const poId = txt(m.plr_po_id) || txt(m.purchase_order_id) || null;
    const loadingId = txt(m.loading_id) || txt(m.sale_loading_id) || null;
    const goodsId = txt(m.goods_id);
    const ge = goodsEntryFor(poId, goodsId);
    const billNo = poId ? billGoods.get(poId)?.no || "—" : "—";
    const lotName = txt(ge?.allotName) || txt(m.plr_lot_name) || null;
    const bookingKey = loadingId ? `bk:${loadingId}` : `nr:${goodsId}`;
    const source: LotFlow["source"] = loadingId ? "booking" : "unrecorded";
    const perUnit = (total: unknown, loaded: unknown) => (num(loaded) > 0 && num(total) > 0 ? Math.round((num(total) / num(loaded)) * 1e6) / 1e6 : null);

    if (!metas.has(bookingKey)) {
      metas.set(bookingKey, {
        lotKey: bookingKey, source, goodsId, goodsName: txt(ge?.goodsName ?? ge?.goods_name) || "", brand: txt(ge?.brand), size: txt(ge?.size),
        origin: txt(ge?.origin) || txt(m.origin_text), lotName, lotNo: null, billNo, billId: poId ?? "", purchased: 0,
        grossPerUnit: loadingId ? perUnit(m.plr_gross, m.plr_loaded) : null, netPerUnit: loadingId ? perUnit(m.plr_net, m.plr_loaded) : null, unit: "",
      });
    }
    const id = m.id;
    const kind: LotFlow["kind"] = isIn ? "received" : "sold";
    const f: LotFlow = { source, id, lotKey: bookingKey, warehouseId, kind, qty, date, refNo: txt(m.reference_no) || txt(m.loading_record_no) || txt(m.sale_transfer_no), note: m.movement_type };
    flows.push(f);
    flowViews[`${source}|${id}`] = {
      ...f, container: txt(m.container_number), seal: txt(m.seal_number), transport: [txt(m.transport_mode), txt(m.transport_reference) || txt(m.bl_number)].filter(Boolean).join(" · "),
    };
  }

  // ── 3. lot states and balances for reconciliation ──
  const stateRows: LotState[] = states.map((s) => ({ lotKey: s.lot_id, warehouseId: s.warehouse_id, byState: num(s.qty) }));
  const rows = buildLotRows(flows, [...metas.values()], stateRows);
  const warehouseName = new Map((db.warehouseNames as any[]).map((w) => [w.id, txt(w.name)]));
  const goodsName = new Map((db.goodsNames as any[]).map((g) => [g.id, txt(g.goods_name)]));
  const reconciliation = reconcileLots(
    rows,
    balances.map((b) => ({ goodsId: b.goods_id, warehouseId: b.warehouse_id, onHand: num(b.on_hand) }))
  ).map((r) => ({ ...r, goodsName: goodsName.get(r.goodsId) ?? "", warehouseName: warehouseName.get(r.warehouseId) ?? "" }));

  return {
    rows: rows.map((r) => ({ ...r, goodsName: r.goodsName || goodsName.get(r.goodsId) || "", warehouseName: warehouseName.get(r.warehouseId) ?? "", notRecorded: r.lotName == null })),
    notRecordedLabel: NOT_RECORDED,
    flowViews,
    totals: lotTotals(rows),
    reconciliation,
    mirrorsSkipped,
    generatedAt: new Date().toISOString(),
  };
}
