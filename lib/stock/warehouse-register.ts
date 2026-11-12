/**
 * Warehouse stock register rows. Reads the EXISTING stock balances (product_inventory_balances, joined to warehouses and
 * goods); it does not keep its own stock. Quantities only: the stock tables do not carry gross or net weights.
 */
export type WarehouseBalanceRow = {
  warehouseId: string;
  warehouseName: string;
  goodsId: string;
  goodsName: string;
  countryName: string;
  onHand: number;
  reserved: number;
  available: number;
};

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

export function normalizeBalanceRow(r: Record<string, unknown>): WarehouseBalanceRow {
  return {
    warehouseId: String(r.warehouse_id ?? ""),
    warehouseName: String(r.warehouse_name ?? "").trim() || "—",
    goodsId: String(r.goods_id ?? ""),
    goodsName: String(r.goods_name ?? "").trim() || "—",
    countryName: String(r.country_name ?? "").trim() || "—",
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
