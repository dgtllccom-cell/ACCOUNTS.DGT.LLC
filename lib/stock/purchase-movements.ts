/**
 * Warehouse Stock Register: purchase-level view and the Destination & Re-Export register. Pure model, no database.
 *
 * Every figure comes from records the ERP already keeps. Nothing is stored here:
 *  - purchase bills and their lot entries come from the Stock Balance Report model (loadBalance): Purchase Booking AND Local Purchase,
 *    with brand, size, lot, purchased and remaining quantity and weights;
 *  - loading entries come from purchase_lane_loads (Purchase Booking and Local Purchase sources only, never sales loads);
 *  - stock transfer entries come from journal_stock_transfers (Stock Journal) and goods_transfers (Goods Transfer Journal).
 *
 * Destination register rule (no double count): a transfer entry is the destination of the goods it moved. A loading entry is listed
 * there only when no transfer entry was made from it; it then counts under its lane disposition, or as In Transit when it has none.
 */
import type { BalanceBill } from "@/lib/services/stock-balance-report-service";
import { proportional } from "@/lib/stock-balance/model";

export type DestinationCategory = "warehouse" | "re_export" | "local_sale" | "in_transit" | "hold";
export const DESTINATION_CATEGORIES: DestinationCategory[] = ["warehouse", "re_export", "local_sale", "in_transit", "hold"];

/** One purchase_lane_loads row (purchase sources only). */
export type RawLaneLoad = {
  id: string;
  source_type: string;
  source_id: string | null;
  purchase_order_id: string | null;
  local_purchase_id: string | null;
  loading_record_no: string | null;
  loading_date: unknown;
  goods_name: string | null;
  loaded_quantity: unknown;
  unit: string | null;
  gross_weight: unknown;
  net_weight: unknown;
  disposition: string | null;
  transfer_destination: string | null;
  destination_text: string | null;
  lane_status: string | null;
  disposition_warehouse_name: string | null;
};

/** One stock transfer, from either journal. `destination` is journal_stock_transfers.destination_type or goods_transfers.purpose. */
export type RawTransfer = {
  id: string;
  journal: "stock" | "goods";
  transfer_no: string | null;
  purchase_order_id: string | null;
  local_purchase_id: string | null;
  loading_record_id: string | null;
  line_key: string | null;
  lot_ref: string | null;
  destination: string | null;
  status: string | null;
  quantity: unknown;
  unit: string | null;
  transfer_date: unknown;
  goods_name: string | null;
  warehouse_name: string | null;
  party_name: string | null;
};

export type Movement = {
  id: string;
  kind: "loading" | "transfer";
  refNo: string;
  date: string;
  goodsName: string;
  brand: string;
  size: string;
  lot: string;
  qty: number;
  unit: string;
  gross: number;
  net: number;
  category: DestinationCategory;
  destination: string;
  status: string;
  /** the loading record (booking) or local purchase (local) this loading came from */
  sourceId: string | null;
};

export type EntryRow = {
  id: string;
  entryNo: string;
  loadingDate: string;
  goodsName: string;
  brand: string;
  size: string;
  lot: string;
  qty: number;
  unit: string;
  gross: number;
  net: number;
  destination: string;
  remaining: number;
  status: string;
};

export type PurchaseRow = {
  key: string;
  billType: "booking" | "local";
  billId: string;
  purchaseNo: string;
  manualNo: string;
  purchaseDate: string;
  countryName: string;
  branch: string;
  goodsNames: string[];
  unit: string;
  qty: number;
  gross: number;
  net: number;
  remaining: number;
  entries: EntryRow[];
  movements: Movement[];
};

export type DestinationRow = Movement & { purchaseNo: string; purchaseDate: string; billType: "booking" | "local"; branch: string };

export type DestinationGroup = {
  category: DestinationCategory;
  destination: string;
  qty: number;
  gross: number;
  net: number;
  rows: DestinationRow[];
};

const DASH = "—";
const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const str = (v: unknown): string => String(v ?? "").trim();
const orDash = (v: unknown): string => str(v) || DASH;
function dateOnly(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return str(v).slice(0, 10);
}

/** Lane disposition, Stock Journal destination_type or Goods Transfer purpose -> destination category. */
export function categoryOf(value: string | null | undefined): DestinationCategory | null {
  switch (str(value)) {
    case "warehouse":
    case "own_warehouse":
    case "dgt_warehouse":
    case "third_party_warehouse":
      return "warehouse";
    case "re_export":
    case "export":
    case "export_customer":
    case "export_dgt_branch":
      return "re_export";
    case "sale_delivery":
    case "local_sales":
    case "local_sale":
    case "direct_sale":
      return "local_sale";
    case "continue_transit":
      return "in_transit";
    case "hold":
      return "hold";
    default:
      return null;
  }
}

/** Transfers that did not move goods (reversed, cancelled, returned or still a draft) are left out. */
export function isLiveTransfer(t: Pick<RawTransfer, "status">): boolean {
  return !["reversed", "cancelled", "returned", "draft"].includes(str(t.status));
}

function billKey(b: Pick<BalanceBill, "type" | "id">) {
  return `${b.type}:${b.id}`;
}

function laneBillKey(l: RawLaneLoad): string | null {
  if (l.source_type === "purchase_booking" && l.purchase_order_id) return `booking:${l.purchase_order_id}`;
  if (l.source_type === "local_purchase") return `local:${l.local_purchase_id || l.source_id}`;
  return null;
}

function transferBillKey(t: RawTransfer): string | null {
  if (t.purchase_order_id) return `booking:${t.purchase_order_id}`;
  if (t.local_purchase_id) return `local:${t.local_purchase_id}`;
  return null;
}

type Entry = BalanceBill["entries"][number];

/** The lot entry a transfer or loading came from: the loading record (+ line) for a booking, the lot for a local purchase. */
function entryFor(bill: BalanceBill, ref: { loadingRecordId?: string | null; lineKey?: string | null; lotRef?: string | null }): Entry | undefined {
  if (ref.loadingRecordId) {
    const own = bill.entries.filter((e) => e.loadingRecordId === ref.loadingRecordId);
    return (ref.lineKey ? own.find((e) => e.entryId.endsWith(`::${ref.lineKey}`)) : undefined) ?? own[0];
  }
  if (ref.lotRef) return bill.entries.find((e) => e.lotRef === ref.lotRef);
  return bill.type === "local" ? bill.entries[0] : undefined;
}

function laneDestination(l: RawLaneLoad): string {
  return str(l.disposition_warehouse_name) || str(l.transfer_destination) || str(l.destination_text) || DASH;
}

function loadingMovement(l: RawLaneLoad, entry: Entry | undefined): Movement {
  return {
    id: `lane:${l.id}`,
    kind: "loading",
    refNo: orDash(l.loading_record_no),
    date: dateOnly(l.loading_date),
    goodsName: orDash(l.goods_name || entry?.goodsName),
    brand: orDash(entry?.brand),
    size: orDash(entry?.size),
    lot: orDash(entry?.lotNo),
    qty: num(l.loaded_quantity),
    unit: str(l.unit) || entry?.unit || "",
    gross: num(l.gross_weight),
    net: num(l.net_weight),
    category: categoryOf(l.disposition) ?? "in_transit",
    destination: laneDestination(l),
    status: str(l.disposition) || str(l.lane_status) || DASH,
    sourceId: l.source_id,
  };
}

function transferMovement(t: RawTransfer, entry: Entry | undefined): Movement | null {
  const category = categoryOf(t.destination);
  if (!category) return null;
  const qty = num(t.quantity);
  const p = entry?.purchased;
  return {
    id: `${t.journal}:${t.id}`,
    kind: "transfer",
    refNo: orDash(t.transfer_no),
    date: dateOnly(t.transfer_date),
    goodsName: orDash(t.goods_name || entry?.goodsName),
    brand: orDash(entry?.brand),
    size: orDash(entry?.size),
    lot: orDash(entry?.lotNo),
    qty,
    unit: str(t.unit) || entry?.unit || "",
    // a transfer row holds a quantity only: its weight is the lot entry's weight per unit, as in the Stock Balance Report
    gross: p ? proportional(p.gross, qty, p.qty) : 0,
    net: p ? proportional(p.net, qty, p.qty) : 0,
    category,
    destination: str(t.warehouse_name) || str(t.party_name) || DASH,
    status: orDash(t.status),
    sourceId: t.journal === "stock" ? t.loading_record_id : t.local_purchase_id,
  };
}

/**
 * One row per purchase bill (Purchase Booking and Local Purchase), each with its lot entries and every loading and transfer entry made from it.
 * `loadingDates` maps a loading record id to its loading date (Purchase Booking entries).
 */
export function buildPurchaseRows(
  bills: BalanceBill[],
  lanes: RawLaneLoad[],
  transfers: RawTransfer[],
  loadingDates: Record<string, string> = {}
): PurchaseRow[] {
  const lanesByBill = new Map<string, RawLaneLoad[]>();
  for (const l of lanes) {
    const k = laneBillKey(l);
    if (k) lanesByBill.set(k, [...(lanesByBill.get(k) ?? []), l]);
  }
  const transfersByBill = new Map<string, RawTransfer[]>();
  for (const t of transfers.filter(isLiveTransfer)) {
    const k = transferBillKey(t);
    if (k) transfersByBill.set(k, [...(transfersByBill.get(k) ?? []), t]);
  }

  return bills.map((b) => {
    const key = billKey(b);
    const billLanes = lanesByBill.get(key) ?? [];
    const laneOfEntry = (e: Entry) =>
      b.type === "booking" ? billLanes.find((l) => l.source_id === e.loadingRecordId) : billLanes[0];

    const entries: EntryRow[] = b.entries.map((e) => {
      const lane = laneOfEntry(e);
      const loadingDate = (e.loadingRecordId && loadingDates[e.loadingRecordId]) || (lane ? dateOnly(lane.loading_date) : "");
      return {
        id: e.entryId,
        entryNo: e.lotEntryLabel,
        loadingDate,
        goodsName: orDash(e.goodsName),
        brand: orDash(e.brand),
        size: orDash(e.size),
        lot: orDash(e.lotNo),
        qty: e.purchased.qty,
        unit: e.unit,
        gross: e.purchased.gross,
        net: e.purchased.net,
        destination: str(e.warehouseName) || (lane ? laneDestination(lane) : DASH),
        remaining: e.remaining.qty,
        status: e.status,
      };
    });

    const movements: Movement[] = [
      ...billLanes.map((l) => loadingMovement(l, b.type === "booking" ? entryFor(b, { loadingRecordId: l.source_id }) : b.entries[0])),
      ...(transfersByBill.get(key) ?? [])
        .map((t) => transferMovement(t, entryFor(b, { loadingRecordId: t.loading_record_id, lineKey: t.line_key, lotRef: t.lot_ref })))
        .filter((m): m is Movement => m !== null),
    ].sort((x, y) => x.date.localeCompare(y.date) || x.refNo.localeCompare(y.refNo));

    const units = [...new Set(b.entries.map((e) => e.unit).filter(Boolean))];
    return {
      key,
      billType: b.type,
      billId: b.id,
      purchaseNo: b.billNo,
      manualNo: b.manualBillNo,
      purchaseDate: b.date ?? "",
      countryName: b.countryName,
      branch: b.branchName || DASH,
      goodsNames: [...new Set(b.entries.map((e) => e.goodsName).filter(Boolean))],
      unit: units.length === 1 ? units[0] : "",
      qty: b.totals.purchased.qty,
      gross: b.totals.purchased.gross,
      net: b.totals.purchased.net,
      remaining: b.totals.remaining.qty,
      entries,
      movements,
    };
  });
}

/**
 * Destination & Re-Export register: every movement of every purchase, by destination category and destination name.
 * A loading entry is counted only when no transfer entry was made from it (see the rule at the top of this file).
 */
export function buildDestinationGroups(purchases: PurchaseRow[]): DestinationGroup[] {
  const groups = new Map<string, DestinationGroup>();
  for (const p of purchases) {
    const transferred = new Set(p.movements.filter((m) => m.kind === "transfer").map((m) => m.sourceId).filter(Boolean));
    const hasLocalTransfer = p.billType === "local" && p.movements.some((m) => m.kind === "transfer");
    for (const m of p.movements) {
      if (m.kind === "loading" && (hasLocalTransfer || (m.sourceId && transferred.has(m.sourceId)))) continue;
      const k = `${m.category}|${m.destination}`;
      const g = groups.get(k) ?? { category: m.category, destination: m.destination, qty: 0, gross: 0, net: 0, rows: [] };
      g.qty += m.qty;
      g.gross += m.gross;
      g.net += m.net;
      g.rows.push({ ...m, purchaseNo: p.purchaseNo, purchaseDate: p.purchaseDate, billType: p.billType, branch: p.branch });
      groups.set(k, g);
    }
  }
  const order = (c: DestinationCategory) => DESTINATION_CATEGORIES.indexOf(c);
  return [...groups.values()].sort((a, b) => order(a.category) - order(b.category) || a.destination.localeCompare(b.destination));
}

/** Quantity per destination category, for the summary cards. */
export function destinationTotals(groups: DestinationGroup[]): Record<DestinationCategory, number> {
  const t = { warehouse: 0, re_export: 0, local_sale: 0, in_transit: 0, hold: 0 } as Record<DestinationCategory, number>;
  for (const g of groups) t[g.category] += g.qty;
  return t;
}
