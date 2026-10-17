/**
 * Stock Balance Report — pure model (no database, no I/O).
 *
 * One Purchase Bill (a Purchase Booking OR a Local Purchase) owns LOTS; a lot owns goods ENTRIES; every figure of the report is derived
 * from entry-level movements that already exist in the ERP (loading records, the Stock Journal confirmations, the Goods Transfer Journal,
 * sales postings). Nothing here stores stock — it only adds up what happened.
 *
 *   Remaining = Purchased − Sold − Transferred out − Adjusted (damage / shortage / treatment loss)
 *   (Reserved and in-transit quantities are NOT sold: they stay inside Remaining and are shown beside it.)
 */

export { q4, EPS, parseJsonish } from "@/lib/stock-journal/model";
import { q4, EPS } from "@/lib/stock-journal/model";

export type BillType = "booking" | "local";
export type StockStatus = "available" | "in_transit" | "not_loaded" | "sold_out" | "over_sold";

export type Weighted = { qty: number; gross: number; net: number };
export const zero = (): Weighted => ({ qty: 0, gross: 0, net: 0 });
export const add = (a: Weighted, b: Weighted): Weighted => ({ qty: q4(a.qty + b.qty), gross: q4(a.gross + b.gross), net: q4(a.net + b.net) });
export const sub = (a: Weighted, b: Weighted): Weighted => ({ qty: q4(a.qty - b.qty), gross: q4(a.gross - b.gross), net: q4(a.net - b.net) });

/** weight of `part` units when the whole `qty` weighs `weight` (linear — the lot-level weight per unit) */
export function proportional(weight: number, part: number, qty: number): number {
  if (!(qty > EPS) || !Number.isFinite(weight)) return 0;
  return q4((weight * part) / qty);
}

/** One goods entry of a lot, with everything the report needs. All weights are KG. */
export interface BalanceEntry {
  entryId: string;
  lotNo: string;
  entryNo: number;
  lotEntryLabel: string;
  goodsName: string;
  goodsId: string | null;
  brand: string;
  size: string;
  origin: string;
  unit: string;
  purchased: Weighted;
  sold: Weighted;
  /** left the bill to another DGT branch / country (not a sale) */
  transferred: Weighted;
  /** damage + shortage + treatment loss */
  adjusted: Weighted;
  /** still to be sold: reserved / in transit (inside remaining) */
  reservedQty: number;
  inTransitQty: number;
  remaining: Weighted;
  unitPrice: number | null;
  amount: number | null;
  currency: string;
  warehouseId: string | null;
  warehouseName: string | null;
  loadingRecordId: string | null;
  lotRef: string | null;
  status: StockStatus;
  /** treatment register totals for this entry (information only — never changes stock) */
  treatment: { received: number; treated: number; loss: number; pending: number };
}

export function remainingOf(p: Weighted, sold: Weighted, transferred: Weighted, adjusted: Weighted): Weighted {
  return sub(sub(sub(p, sold), transferred), adjusted);
}

export function statusOf(e: Pick<BalanceEntry, "purchased" | "remaining" | "inTransitQty" | "lotNo">, notLoaded: boolean): StockStatus {
  if (e.remaining.qty < -EPS) return "over_sold";
  if (notLoaded) return "not_loaded";
  if (e.remaining.qty <= EPS) return "sold_out";
  if (e.inTransitQty > EPS && e.inTransitQty + EPS >= e.remaining.qty) return "in_transit";
  return "available";
}

export const entryLabel = (lotNo: string, entryNo: number) => `${lotNo} / Entry ${entryNo}`;

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Totals
// ──────────────────────────────────────────────────────────────────────────────────────────────

export interface UnitTotals { [unit: string]: Weighted }
export interface BillTotals {
  lots: number;
  entries: number;
  purchased: Weighted;
  sold: Weighted;
  transferred: Weighted;
  adjusted: Weighted;
  remaining: Weighted;
  byUnit: { purchased: UnitTotals; sold: UnitTotals; remaining: UnitTotals };
  reservedQty: number;
  inTransitQty: number;
}

export function totalsOf(entries: BalanceEntry[]): BillTotals {
  const t: BillTotals = {
    lots: new Set(entries.map((e) => e.lotNo)).size,
    entries: entries.length,
    purchased: zero(), sold: zero(), transferred: zero(), adjusted: zero(), remaining: zero(),
    byUnit: { purchased: {}, sold: {}, remaining: {} },
    reservedQty: 0, inTransitQty: 0,
  };
  for (const e of entries) {
    t.purchased = add(t.purchased, e.purchased);
    t.sold = add(t.sold, e.sold);
    t.transferred = add(t.transferred, e.transferred);
    t.adjusted = add(t.adjusted, e.adjusted);
    t.remaining = add(t.remaining, e.remaining);
    t.reservedQty = q4(t.reservedQty + e.reservedQty);
    t.inTransitQty = q4(t.inTransitQty + e.inTransitQty);
    const u = e.unit || "—";
    t.byUnit.purchased[u] = add(t.byUnit.purchased[u] ?? zero(), e.purchased);
    t.byUnit.sold[u] = add(t.byUnit.sold[u] ?? zero(), e.sold);
    t.byUnit.remaining[u] = add(t.byUnit.remaining[u] ?? zero(), e.remaining);
  }
  return t;
}

/** merge several bills' per-unit totals (the dashboard cards) */
export function mergeUnitTotals(list: UnitTotals[]): UnitTotals {
  const out: UnitTotals = {};
  for (const m of list) for (const [u, w] of Object.entries(m)) out[u] = add(out[u] ?? zero(), w);
  return out;
}

/** the unit with the most quantity (what a card shows large) and how many other units hide behind it */
export function topUnit(m: UnitTotals): { unit: string; w: Weighted; more: number } {
  const e = Object.entries(m).filter(([, w]) => Math.abs(w.qty) > EPS || Math.abs(w.net) > EPS).sort((a, b) => b[1].qty - a[1].qty);
  if (e.length === 0) return { unit: "", w: zero(), more: 0 };
  return { unit: e[0][0] === "—" ? "" : e[0][0], w: e[0][1], more: e.length - 1 };
}

export interface GoodsSummaryRow { goodsName: string; unit: string; purchased: number; sold: number; remaining: number }
/** Goods-wise summary: one row per goods + unit, over any set of entries */
export function goodsWise(entries: BalanceEntry[]): GoodsSummaryRow[] {
  const m = new Map<string, GoodsSummaryRow>();
  for (const e of entries) {
    const k = `${e.goodsName.toLowerCase()}|${e.unit}`;
    const r = m.get(k) ?? { goodsName: e.goodsName, unit: e.unit, purchased: 0, sold: 0, remaining: 0 };
    r.purchased = q4(r.purchased + e.purchased.qty);
    r.sold = q4(r.sold + e.sold.qty);
    r.remaining = q4(r.remaining + e.remaining.qty);
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => a.goodsName.localeCompare(b.goodsName));
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Treatment register arithmetic (shared by the API validation and the report)
// ──────────────────────────────────────────────────────────────────────────────────────────────

export function treatmentFigures(t: { qty_received: number; qty_treated: number; qty_loss: number; status: string }) {
  const received = q4(t.qty_received), treated = q4(t.qty_treated), loss = q4(t.qty_loss);
  const cancelled = t.status === "cancelled";
  return {
    received: cancelled ? 0 : received,
    treated: cancelled ? 0 : treated,
    loss: cancelled ? 0 : loss,
    pending: cancelled ? 0 : Math.max(0, q4(received - treated - loss)),
    finalQty: cancelled ? 0 : q4(received - loss),
  };
}

/** Treatment stays inside the lot: treated / pending / untreated of what is still on hand (never added to stock) */
export function treatmentSplit(remainingQty: number, rows: { received: number; treated: number; loss: number; pending: number }[]) {
  const received = rows.reduce((s, r) => s + r.received, 0);
  const treated = rows.reduce((s, r) => s + r.treated, 0);
  const pending = rows.reduce((s, r) => s + r.pending, 0);
  const loss = rows.reduce((s, r) => s + r.loss, 0);
  return { received: q4(received), treated: q4(treated), pending: q4(pending), loss: q4(loss), untreated: Math.max(0, q4(remainingQty - treated - pending)) };
}

/** A treatment request can never exceed what is still there to treat (received-for-treatment of an entry ≤ its remaining quantity) */
export function maxTreatable(entryRemaining: number, alreadyForTreatment: number) {
  return Math.max(0, q4(entryRemaining - alreadyForTreatment));
}

/** one spelling per unit so "BAGS" and "Bags" never become two cards: short codes (PCS, MT, KG) stay upper-case, words are Capitalised */
export function normalizeUnit(raw: string | null | undefined): string {
  const u = String(raw ?? "").trim();
  if (!u) return "";
  return u.length <= 3 ? u.toUpperCase() : u.charAt(0).toUpperCase() + u.slice(1).toLowerCase();
}
