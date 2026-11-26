import { withLocalPg } from "@/lib/db/local-postgres";

export type SalesLoadingSummary = {
  containerNumber: string;
  containerType: string | null;
  loadingDate: string | null;
  receivedDate: string | null;
  quantity: number;
  netWeight: number;
  truck: string | null;
  driver: string | null;
  truckRegistrationType: string | null;
};

export type SalesTransferContext = {
  loadingRecords: SalesLoadingSummary[];
  warehouseNames: Record<string, string>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFormData(value: unknown): any {
  if (typeof value !== "string") return value ?? {};
  try { return JSON.parse(value); } catch { return {}; }
}

function goodsTotals(goods: unknown) {
  const lines = Array.isArray(goods) ? goods : [];
  const total = (keys: string[]) => lines.reduce((sum: number, g: any) => {
    const value = keys.map(key => Number(g?.[key])).find(n => Number.isFinite(n));
    return sum + (value ?? 0);
  }, 0);
  // record goods are planSalesLoading() lines: { line, quantity, gross, net, ... }
  return { quantity: total(["quantity"]), netWeight: total(["net", "netWeight"]) };
}

/** Read-only extra context for the Sales transfer verification report: the booking's container-wise
 * Sales Loading records and the names of the warehouses its goods lines draw stock from. */
export async function readSalesTransferContext(orderId: string, rawFormData: unknown): Promise<SalesTransferContext> {
  const formData = parseFormData(rawFormData);
  const goods: any[] = Array.isArray(formData?.goodsEntries) ? formData.goodsEntries : [];
  const warehouseIds = [...new Set([
    ...goods.map(g => String(g?.warehouseId || g?.managedWarehouseId || "").trim()),
    String(formData?.form?.warehouseId || formData?.form?.managedWarehouseId || "").trim(),
  ].filter(id => UUID.test(id)))];

  const result = await withLocalPg(async sql => {
    const loading = await sql`
      select container_number, container_type, loading_date::text as loading_date, received_date::text as received_date, goods, details
      from public.sales_loading_records where sales_order_id = ${orderId}::uuid
      order by loading_date, entry_no`;
    const warehouses = warehouseIds.length
      ? await sql`select id::text as id, warehouse_name, warehouse_code from public.warehouses where id = any(${warehouseIds}::uuid[])`
      : [];
    return { loading, warehouses };
  }).catch(() => null);

  return {
    loadingRecords: (result?.loading ?? []).map((row: any) => ({
      containerNumber: String(row.container_number),
      containerType: row.container_type ?? null,
      loadingDate: row.loading_date ?? null,
      receivedDate: row.received_date ?? null,
      ...goodsTotals(row.goods),
      truck: row.details?.vehicle || null,
      driver: [row.details?.driver, row.details?.driverMobile].filter(Boolean).join(" · ") || null,
      truckRegistrationType: row.details?.truckRegistrationType || null,
    })),
    warehouseNames: Object.fromEntries((result?.warehouses ?? []).map((w: any) =>
      [w.id, [w.warehouse_name, w.warehouse_code].filter(Boolean).join(" · ")])),
  };
}
