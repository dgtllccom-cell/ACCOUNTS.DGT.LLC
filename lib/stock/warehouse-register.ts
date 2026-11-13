/**
 * Warehouse stock register. Reads EXISTING tables only and keeps no stock of its own:
 *  - product_inventory_balances (stock per warehouse, branch and goods) for the KPI cards and summary panels;
 *  - purchase_lane_loads (one row per loading entry, with gross and net weight) for the Purchase Stock Details table.
 * Quantities and weights come straight from those rows; a missing value is shown as a dash, never as a made-up number.
 */

export type BranchFields = {
  countryBranchName: string;
  countryBranchCode: string;
  cityBranchName: string;
  cityBranchCode: string;
};

export type WarehouseBalanceRow = BranchFields & {
  warehouseId: string;
  warehouseName: string;
  goodsId: string;
  goodsName: string;
  countryName: string;
  countryBranchId: string;
  cityBranchId: string;
  onHand: number;
  reserved: number;
  available: number;
};

export type LoadEntry = BranchFields & {
  id: string;
  purchaseRef: string;
  loadingNo: string;
  loadingDate: string;
  goodsName: string;
  qty: number;
  unit: string;
  gross: number;
  net: number;
  transferType: string;
  balance: number;
  countryName: string;
};

export type PurchaseGroup = {
  purchaseRef: string;
  branchLabel: string;
  goodsNames: string[];
  qty: number;
  gross: number;
  net: number;
  balance: number;
  entries: LoadEntry[];
};

export type RegisterGroup = {
  key: string;
  label: string;
  lines: number;
  onHand: number;
  reserved: number;
  available: number;
};

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

const text = (v: unknown): string => String(v ?? "").trim() || "—";
const code = (v: unknown): string => String(v ?? "").trim();

function dateOnly(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return String(v ?? "").slice(0, 10);
}

export function normalizeBalanceRow(r: Record<string, unknown>): WarehouseBalanceRow {
  return {
    warehouseId: String(r.warehouse_id ?? ""),
    warehouseName: text(r.warehouse_name),
    goodsId: String(r.goods_id ?? ""),
    goodsName: text(r.goods_name),
    countryName: text(r.country_name),
    countryBranchId: String(r.country_branch_id ?? ""),
    countryBranchName: text(r.country_branch_name),
    countryBranchCode: code(r.country_branch_code),
    cityBranchId: String(r.city_branch_id ?? ""),
    cityBranchName: text(r.city_branch_name),
    cityBranchCode: code(r.city_branch_code),
    onHand: num(r.quantity_on_hand),
    reserved: num(r.quantity_reserved),
    available: num(r.quantity_available),
  };
}

export function normalizeLoadRow(r: Record<string, unknown>): LoadEntry {
  const qty = num(r.loaded_quantity);
  return {
    id: String(r.id ?? ""),
    purchaseRef: text(r.purchase_ref_no),
    loadingNo: text(r.loading_record_no),
    loadingDate: dateOnly(r.loading_date),
    goodsName: text(r.goods_name),
    qty,
    unit: code(r.unit),
    gross: num(r.gross_weight),
    net: num(r.net_weight),
    transferType: code(r.disposition) || code(r.transfer_destination) || code(r.lane_status) || "—",
    balance: r.lane_stock_qty == null ? qty : num(r.lane_stock_qty),
    countryName: text(r.country_name),
    countryBranchName: text(r.country_branch_name),
    countryBranchCode: code(r.country_branch_code),
    cityBranchName: text(r.city_branch_name),
    cityBranchCode: code(r.city_branch_code),
  };
}

export function registerTotals(rows: WarehouseBalanceRow[]) {
  return rows.reduce(
    (t, r) => ({ lines: t.lines + 1, onHand: t.onHand + r.onHand, reserved: t.reserved + r.reserved, available: t.available + r.available }),
    { lines: 0, onHand: 0, reserved: 0, available: 0 }
  );
}

/** One branch part: its name, followed by its code in brackets when a code exists. */
function branchPart(name: string, branchCode: string): string {
  if (name === "—") return "";
  return branchCode ? `${name} (${branchCode})` : name;
}

/** Main (country) branch first, then city branch, each with its code. Missing parts are skipped. */
export function branchLabel(r: BranchFields): string {
  const parts = [branchPart(r.countryBranchName, r.countryBranchCode), branchPart(r.cityBranchName, r.cityBranchCode)].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

/** Sums the balances per key (goods, country or branch). Groups are sorted by label. */
export function groupRegister(
  rows: WarehouseBalanceRow[],
  keyOf: (r: WarehouseBalanceRow) => string,
  labelOf: (r: WarehouseBalanceRow) => string
): RegisterGroup[] {
  const groups = new Map<string, RegisterGroup>();
  for (const r of rows) {
    const key = keyOf(r);
    const g = groups.get(key) ?? { key, label: labelOf(r), lines: 0, onHand: 0, reserved: 0, available: 0 };
    g.lines += 1;
    g.onHand += r.onHand;
    g.reserved += r.reserved;
    g.available += r.available;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Groups loading entries by purchase reference, with totals per purchase. Purchases sort by reference. */
export function groupPurchases(entries: LoadEntry[]): PurchaseGroup[] {
  const map = new Map<string, PurchaseGroup>();
  for (const e of entries) {
    const g =
      map.get(e.purchaseRef) ??
      { purchaseRef: e.purchaseRef, branchLabel: branchLabel(e), goodsNames: [], qty: 0, gross: 0, net: 0, balance: 0, entries: [] };
    if (!g.goodsNames.includes(e.goodsName)) g.goodsNames.push(e.goodsName);
    g.qty += e.qty;
    g.gross += e.gross;
    g.net += e.net;
    g.balance += e.balance;
    g.entries.push(e);
    map.set(e.purchaseRef, g);
  }
  return [...map.values()].sort((a, b) => a.purchaseRef.localeCompare(b.purchaseRef));
}

/** KPI figures for the loading side: distinct purchases, total loaded quantity, and stock still in the lanes. */
export function loadTotals(entries: LoadEntry[]) {
  return {
    bills: new Set(entries.map((e) => e.purchaseRef)).size,
    loaded: entries.reduce((s, e) => s + e.qty, 0),
    inLanes: entries.reduce((s, e) => s + e.balance, 0),
  };
}
