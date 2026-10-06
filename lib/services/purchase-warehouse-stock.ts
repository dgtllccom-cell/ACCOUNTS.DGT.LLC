/**
 * The ONE place a purchased load is booked into warehouse stock.
 *
 * Extracted from the Destination Receiving route so that route and the Purchase Lane "Send to Warehouse"
 * disposition write the SAME tables the rest of the ERP's inventory uses (products shadow row,
 * stock_movements, product_inventory_balances) — no parallel stock system, and no second code path that
 * could double-count. Callers are responsible for the "only once" guard (received_quantity /
 * disposition_final) and run this inside their own transaction.
 */

export type StockInInput = {
  goodsId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number;
  scope: { countryId: string | null; countryBranchId: string | null; cityBranchId: string | null };
  referenceNo: string | null;
  purchaseOrderId: string | null;
  loadingRecordId: string | null;
  userId: string;
  remarks?: string | null;
};

const money = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 10000) / 10000 : 0;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function stockInToWarehouse(tx: any, input: StockInInput): Promise<{ stockMovementId: string | null }> {
  const nowIso = new Date().toISOString();
  const qty = money(input.quantity);
  const unitCost = money(input.unitCost ?? 0);
  const { countryId, countryBranchId, cityBranchId } = input.scope;

  const goodsRows = await tx`
    select goods_name, chs_code, min_stock_level, reorder_level, barcode, barcode_type
    from public.goods where id = ${input.goodsId}::uuid
  `;
  const goodsName = goodsRows[0]?.goods_name || "Goods Item";
  const chsCode = goodsRows[0]?.chs_code || "PRD-" + String(input.goodsId).slice(0, 8);
  const gMin = goodsRows[0]?.min_stock_level ?? null;
  const gReorder = goodsRows[0]?.reorder_level ?? null;
  const gBarcode = goodsRows[0]?.barcode ?? null;
  const gBarcodeType = goodsRows[0]?.barcode_type ?? "CODE128";

  // Shadow row for the FK product_inventory_balances.product_id -> products.id expects
  // (same convention used by app/api/erp/inventory/stock-movements/route.ts).
  await tx`
    insert into public.products (id, product_code, product_name, hs_code, country_id, is_active,
      min_stock_level, reorder_level, barcode, barcode_type, created_at, updated_at)
    values (${input.goodsId}::uuid, ${chsCode}, ${goodsName}, ${chsCode},
      ${countryId ? tx`${countryId}::uuid` : null}, true,
      ${gMin}, ${gReorder}, ${gBarcode}, ${gBarcodeType}, ${nowIso}, ${nowIso})
    on conflict (id) do update set
      min_stock_level = coalesce(excluded.min_stock_level, public.products.min_stock_level),
      reorder_level   = coalesce(excluded.reorder_level,   public.products.reorder_level),
      barcode         = coalesce(excluded.barcode,         public.products.barcode),
      barcode_type    = coalesce(excluded.barcode_type,    public.products.barcode_type),
      updated_at      = ${nowIso}
  `;

  const movementRows = await tx`
    insert into public.stock_movements (
      movement_type, goods_id, warehouse_id, country_id, country_branch_id, city_branch_id,
      quantity, unit_cost, total_amount, reference_no, notes, movement_date,
      purchase_order_id, loading_record_id, created_by, created_at, updated_at
    ) values (
      'STOCK_IN', ${input.goodsId}::uuid, ${input.warehouseId}::uuid,
      ${countryId ? tx`${countryId}::uuid` : null},
      ${countryBranchId ? tx`${countryBranchId}::uuid` : null},
      ${cityBranchId ? tx`${cityBranchId}::uuid` : null},
      ${qty}, ${unitCost}, ${qty * unitCost},
      ${input.referenceNo}, ${input.remarks ?? null}, ${nowIso},
      ${input.purchaseOrderId ? tx`${input.purchaseOrderId}::uuid` : null},
      ${input.loadingRecordId ? tx`${input.loadingRecordId}::uuid` : null},
      ${input.userId}::uuid, ${nowIso}, ${nowIso}
    )
    returning id;
  `;

  await tx`
    insert into public.product_inventory_balances (
      product_id, country_id, country_branch_id, city_branch_id, warehouse_id,
      quantity_on_hand, quantity_reserved, updated_at
    ) values (
      ${input.goodsId}::uuid,
      ${countryId ? tx`${countryId}::uuid` : null},
      ${countryBranchId ? tx`${countryBranchId}::uuid` : null},
      ${cityBranchId ? tx`${cityBranchId}::uuid` : null},
      ${input.warehouseId}::uuid,
      ${qty}, 0, ${nowIso}
    )
    on conflict (product_id, warehouse_id) do update set
      quantity_on_hand = public.product_inventory_balances.quantity_on_hand + ${qty},
      updated_at = ${nowIso}
  `;

  return { stockMovementId: movementRows[0]?.id ?? null };
}
