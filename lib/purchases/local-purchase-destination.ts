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

/** shipmentType written into loading_details for each queue (matches the booking form's Shipment Type options). */
export const LOCAL_PURCHASE_STAGE_SHIPMENT_TYPE: Record<LocalPurchaseDestinationStage, string> = {
  loading: "Loading by Truck",
  warehouse_transfer: "Warehouse Transfer",
  export: "Export Shipment",
};

const field = (row: Record<string, any>, snake: string, camel: string) => row[snake] ?? row[camel];

/**
 * loading_details as a plain object. Rows written by older code hold it as a JSON string inside jsonb, so both forms are read;
 * writers must store an object (postgres.js tx.json), never JSON.stringify(...)::jsonb, or the loading entries are lost.
 */
export function parseLoadingDetails(value: unknown): Record<string, any> {
  return parseObject(value) ?? {};
}

/** True when the bill records a warehouse (warehouse_name or warehouse_id, snake_case or camelCase). */
export function localPurchaseHasWarehouse(row: Record<string, any> | null | undefined): boolean {
  if (!row) return false;
  return Boolean(String(field(row, "warehouse_name", "warehouseName") ?? "").trim() || field(row, "warehouse_id", "warehouseId"));
}

/**
 * Why a posted bill's destination cannot move to `target` (null = it can move).
 * Changing a destination never posts money; it only moves the bill to another queue. It is locked once goods have moved for
 * the current destination: a loading entry or completed loading, a completed export handover, or a warehouse transfer that
 * recorded a warehouse. A warehouse stage marked complete with NO warehouse recorded moved nothing, so it can be undone.
 */
export function localPurchaseDestinationChangeBlocker(row: Record<string, any> | null | undefined, target: LocalPurchaseDestinationStage): string | null {
  if (!row) return "Local purchase record not found.";
  if (String(field(row, "status", "status") ?? "").toLowerCase() !== "posted") return "Only a posted bill can change its destination.";
  if (resolveLocalPurchaseDestination(row) === target) return "The bill is already in this destination.";
  const ld = parseObject(field(row, "loading_details", "loadingDetails")) ?? {};
  const entries: any[] = Array.isArray(ld.entries) ? ld.entries : [];
  const loaded = entries.reduce((sum, e) => sum + Number(e?.loadedQuantity ?? 0), 0);
  if (loaded > 0 || field(row, "loading_completed_at", "loadingCompletedAt")) {
    return "Goods are already loaded for this bill, so its destination is locked.";
  }
  if (field(row, "export_handover_at", "exportHandoverAt") || String(field(row, "export_status", "exportStatus") ?? "") === "completed") {
    return "This bill was already handed over for export, so its destination is locked.";
  }
  if (String(field(row, "warehouse_transfer_status", "warehouseTransferStatus") ?? "") === "completed" && localPurchaseHasWarehouse(row)) {
    return "The warehouse transfer for this bill is already complete, so its destination is locked.";
  }
  return null;
}
