/**
 * Lot-level Current Stock for the Warehouse Stock Register: one row per lot + warehouse.
 *
 * Pure functions only (no database access). Each stock flow is counted once, by the id of its own record
 * (lot movement, or stock movement that is not a mirror of a lot movement), so no transfer is added twice.
 *
 *   available = received + transferred in − transferred out − exported − sold
 *
 * `byState` is the stock the lot record itself holds in that warehouse (lot_stock). When both are present, `check`
 * must be zero; a non-zero check is shown on the page, never hidden.
 */

export const NOT_RECORDED = "Lot Not Recorded";

export type FlowKind = "received" | "transfer_in" | "transfer_out" | "exported" | "sold";

/** One stock flow for one lot in one warehouse. `id` is the counting key within its source. */
export type LotFlow = {
  source: "local_lot" | "booking" | "unrecorded";
  id: string;
  lotKey: string;
  warehouseId: string;
  kind: FlowKind;
  qty: number;
  date: string;
  refNo: string;
  note: string;
};

/** Identity and original data of a lot, read from the original purchase record. */
export type LotMeta = {
  lotKey: string;
  source: "local_lot" | "booking" | "unrecorded";
  goodsId: string;
  goodsName: string;
  brand: string;
  size: string;
  origin: string;
  /** Lot name as recorded on the original bill or loading. Null when not recorded (never invented). */
  lotName: string | null;
  /** Lot number, e.g. LOT-2610-000003. Null when not recorded. */
  lotNo: string | null;
  billNo: string;
  billId: string;
  purchased: number;
  /** Weight per unit of the lot, used to show the remaining weight. Null when the original weight is not recorded. */
  grossPerUnit: number | null;
  netPerUnit: number | null;
  unit: string;
};

/** Stock the lot record holds in a warehouse right now (lot_stock, state 'available'). */
export type LotState = { lotKey: string; warehouseId: string; byState: number };

export type LotRow = {
  key: string;
  lotKey: string;
  source: LotMeta["source"];
  goodsId: string;
  goodsName: string;
  brand: string;
  size: string;
  origin: string;
  lotName: string | null;
  lotNo: string | null;
  billNo: string;
  billId: string;
  unit: string;
  warehouseId: string;
  firstReceiptDate: string | null;
  purchased: number;
  received: number;
  transferredIn: number;
  transferredOut: number;
  exported: number;
  sold: number;
  available: number;
  byState: number | null;
  /** available − byState. Zero is correct. */
  check: number | null;
  gross: number | null;
  net: number | null;
  negative: boolean;
  flows: LotFlow[];
};

export type Reconciliation = {
  goodsId: string;
  warehouseId: string;
  balanceOnHand: number;
  lotsAvailable: number;
  /** balanceOnHand − lotsAvailable. Non-zero must be explained, never hidden. */
  difference: number;
};

const round4 = (n: number) => Math.round(n * 10000) / 10000;
const rowKey = (lotKey: string, warehouseId: string) => `${lotKey}|${warehouseId}`;
const pairKey = (goodsId: string, warehouseId: string) => `${goodsId}|${warehouseId}`;

/** Counts each flow once: a flow repeated with the same source and id is ignored. */
function uniqueFlows(flows: LotFlow[]): LotFlow[] {
  const seen = new Set<string>();
  const out: LotFlow[] = [];
  for (const f of flows) {
    const k = `${f.source}|${f.id}`;
    if (seen.has(k) || !(f.qty > 0)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

export function buildLotRows(flowsIn: LotFlow[], metas: LotMeta[], states: LotState[] = []): LotRow[] {
  const flows = uniqueFlows(flowsIn);
  const metaByKey = new Map(metas.map((m) => [m.lotKey, m]));
  // a lot can hold several stock records in one warehouse (different racks or states): their quantities add up
  const stateByRow = new Map<string, number>();
  for (const s of states) {
    const k = rowKey(s.lotKey, s.warehouseId);
    stateByRow.set(k, round4((stateByRow.get(k) ?? 0) + s.byState));
  }
  const rows = new Map<string, LotRow>();

  const rowFor = (lotKey: string, warehouseId: string): LotRow | null => {
    const meta = metaByKey.get(lotKey);
    if (!meta) return null;
    const k = rowKey(lotKey, warehouseId);
    let row = rows.get(k);
    if (!row) {
      const byState = stateByRow.get(k);
      row = {
        key: k, lotKey, source: meta.source, goodsId: meta.goodsId, goodsName: meta.goodsName, brand: meta.brand, size: meta.size, origin: meta.origin,
        lotName: meta.lotName, lotNo: meta.lotNo, billNo: meta.billNo, billId: meta.billId, unit: meta.unit, warehouseId,
        firstReceiptDate: null, purchased: meta.purchased, received: 0, transferredIn: 0, transferredOut: 0, exported: 0, sold: 0,
        available: 0, byState: byState ?? null, check: null, gross: null, net: null, negative: false, flows: [],
      };
      rows.set(k, row);
    }
    return row;
  };

  for (const f of flows) {
    const row = rowFor(f.lotKey, f.warehouseId);
    if (!row) continue;
    row.flows.push(f);
    if (f.kind === "received") {
      row.received += f.qty;
      if (!row.firstReceiptDate || f.date < row.firstReceiptDate) row.firstReceiptDate = f.date;
    } else if (f.kind === "transfer_in") row.transferredIn += f.qty;
    else if (f.kind === "transfer_out") row.transferredOut += f.qty;
    else if (f.kind === "exported") row.exported += f.qty;
    else row.sold += f.qty;
  }

  for (const row of rows.values()) {
    row.received = round4(row.received);
    row.transferredIn = round4(row.transferredIn);
    row.transferredOut = round4(row.transferredOut);
    row.exported = round4(row.exported);
    row.sold = round4(row.sold);
    row.available = round4(row.received + row.transferredIn - row.transferredOut - row.exported - row.sold);
    row.negative = row.available < -0.0001;
    row.check = row.byState == null ? null : round4(row.available - row.byState);
    const meta = metaByKey.get(row.lotKey)!;
    if (meta.grossPerUnit != null) row.gross = round4(Math.max(0, row.available) * meta.grossPerUnit);
    if (meta.netPerUnit != null) row.net = round4(Math.max(0, row.available) * meta.netPerUnit);
    row.flows.sort((a, b) => a.date.localeCompare(b.date) || a.refNo.localeCompare(b.refNo));
  }

  return [...rows.values()].sort(
    (a, b) => (a.firstReceiptDate ?? "").localeCompare(b.firstReceiptDate ?? "") || (a.lotNo ?? a.lotName ?? "").localeCompare(b.lotNo ?? b.lotName ?? "")
  );
}

/** Compares the lot totals with the warehouse balance for each goods + warehouse pair. */
export function reconcileLots(rows: LotRow[], balances: { goodsId: string; warehouseId: string; onHand: number }[]): Reconciliation[] {
  const lotsByPair = new Map<string, number>();
  for (const r of rows) {
    const k = pairKey(r.goodsId, r.warehouseId);
    lotsByPair.set(k, round4((lotsByPair.get(k) ?? 0) + r.available));
  }
  const balanceByPair = new Map(balances.map((b) => [pairKey(b.goodsId, b.warehouseId), b]));
  const keys = new Set<string>([...lotsByPair.keys(), ...balanceByPair.keys()]);
  return [...keys]
    .map((k) => {
      const [goodsId, warehouseId] = k.split("|");
      const balanceOnHand = round4(balanceByPair.get(k)?.onHand ?? 0);
      const lotsAvailable = lotsByPair.get(k) ?? 0;
      return { goodsId, warehouseId, balanceOnHand, lotsAvailable, difference: round4(balanceOnHand - lotsAvailable) };
    })
    .sort((a, b) => a.goodsId.localeCompare(b.goodsId) || a.warehouseId.localeCompare(b.warehouseId));
}

/** Headline figures for the Current Stock cards. Active lots are rows with stock still available. */
export function lotTotals(rows: LotRow[]) {
  return rows.reduce(
    (t, r) => ({
      activeLots: t.activeLots + (r.available > 0.0001 ? 1 : 0),
      received: round4(t.received + r.received),
      sold: round4(t.sold + r.sold),
      available: round4(t.available + r.available),
    }),
    { activeLots: 0, received: 0, sold: 0, available: 0 }
  );
}
