/**
 * Local Purchase destination routing — ONE place that decides which operational
 * queue a posted Local Purchase belongs to.
 *
 * The booking form stores the user's "Shipment Type" choice as
 * local_purchases.shipping_mode (and loading_details.shipmentType):
 *   Loading by Truck   → "Loading"         → /dashboard/purchase/local-purchase-loading
 *   Warehouse Transfer → "Transfer Layout" → /dashboard/purchase/local-purchase-warehouse-transfer
 *   Export Shipment    → "Export"          → /dashboard/purchase/local-purchase-export
 *
 * The destination-stage API (app/api/erp/purchases/local-purchase/destination-stage)
 * rejects a stage that does not match shipping_mode, and each queue page lists only
 * its own mode. Any "Transfer to …" button must therefore route by this helper, never
 * to a fixed page.
 */
export type LocalPurchaseDestinationStage = "loading" | "warehouse_transfer" | "export";

export const LOCAL_PURCHASE_STAGE_SHIPPING_MODE: Record<LocalPurchaseDestinationStage, string> = {
  loading: "Loading",
  warehouse_transfer: "Transfer Layout",
  export: "Export",
};

export const LOCAL_PURCHASE_STAGE_PATH: Record<LocalPurchaseDestinationStage, string> = {
  loading: "/dashboard/purchase/local-purchase-loading",
  warehouse_transfer: "/dashboard/purchase/local-purchase-warehouse-transfer",
  export: "/dashboard/purchase/local-purchase-export",
};

const SHIPMENT_TYPE_STAGE: Record<string, LocalPurchaseDestinationStage> = {
  "loading by truck": "loading",
  "warehouse transfer": "warehouse_transfer",
  "export shipment": "export",
};

function parseObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Maps a stored shipping_mode value to its queue stage (null = no operational queue). */
export function stageForShippingMode(mode: unknown): LocalPurchaseDestinationStage | null {
  const m = String(mode ?? "").trim().toLowerCase();
  if (!m) return null;
  if (m === "transfer layout" || m.includes("warehouse")) return "warehouse_transfer";
  if (m === "export" || m.includes("export")) return "export";
  if (m === "loading" || m.includes("loading")) return "loading";
  return null;
}

/**
 * Resolves the destination queue for a Local Purchase row (snake_case or camelCase).
 * shipping_mode is authoritative because the destination-stage API checks it;
 * loading_details.shipmentType is the fallback for rows without shipping_mode.
 */
export function resolveLocalPurchaseDestination(row: Record<string, any> | null | undefined): LocalPurchaseDestinationStage | null {
  if (!row) return null;
  const fromMode = stageForShippingMode(row.shipping_mode ?? row.shippingMode);
  if (fromMode) return fromMode;
  const ld = parseObject(row.loading_details ?? row.loadingDetails);
  const shipmentType = String(ld?.shipmentType ?? "").trim().toLowerCase();
  return SHIPMENT_TYPE_STAGE[shipmentType] ?? stageForShippingMode(ld?.shippingMode);
}

export function localPurchaseDestinationHref(stage: LocalPurchaseDestinationStage, billId?: string | null): string {
  const base = LOCAL_PURCHASE_STAGE_PATH[stage];
  return billId ? `${base}?billId=${encodeURIComponent(billId)}` : base;
}
