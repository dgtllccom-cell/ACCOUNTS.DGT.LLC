/**
 * Warehouse stock register rows. Reads the EXISTING stock balances (product_inventory_balances, joined to warehouses,
 * goods and branches); it does not keep its own stock. Quantities only: the stock tables do not carry gross or net weights.
 */
export type WarehouseBalanceRow = {
  warehouseId: string;
  warehouseName: string;
  goodsId: string;
  goodsName: string;
  countryName: string;
  countryBranchId: string;
  countryBranchName: string;
  countryBranchCode: string;
  cityBranchId: string;
  cityBranchName: string;
  cityBranchCode: string;
  onHand: number;
  reserved: number;
  available: number;
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
export function branchLabel(r: WarehouseBalanceRow): string {
  const parts = [branchPart(r.countryBranchName, r.countryBranchCode), branchPart(r.cityBranchName, r.cityBranchCode)].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

/** Sums the register per key (goods, country or branch). Groups are sorted by label. */
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
