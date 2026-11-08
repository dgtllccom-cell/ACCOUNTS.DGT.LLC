/**
 * Loading → Consignment — pure rules (no DB / React), shared by the service, the API, the UI and the tests.
 *
 * The Consignment page is the common destination of every saved loading from BOTH purchase sources:
 *   - Purchase Booking  → one row per purchase_loading_records row
 *   - Local Purchase    → one row per local_purchases.loading_details.entries[] item
 * A consignment row is DERIVED from its loading (never re-entered, never inserted separately), so a loading can
 * never appear twice. Destination transfers are recorded on the loading itself and may only move the loading's
 * still-untransferred balance.
 *
 * Payment rules are NOT changed here: Local Purchase loading is already payment-gated when the loading is saved;
 * Purchase Booking keeps the established "payment proof complete" rule used by the existing booking stock-forward
 * route (app/api/erp/purchases/loading-records/[id]/transfer).
 */

export const CONSIGNMENT_SOURCES = ["purchase_booking", "local_purchase"] as const;
export type ConsignmentSource = (typeof CONSIGNMENT_SOURCES)[number];

export const CONSIGNMENT_DESTINATIONS = ["warehouse", "re_export"] as const;
export type ConsignmentDestination = (typeof CONSIGNMENT_DESTINATIONS)[number];

export const CONSIGNMENT_DESTINATION_LABEL: Record<ConsignmentDestination, string> = {
  warehouse: "Warehouse",
  re_export: "Re-export",
};

export type ConsignmentTransferRecord = {
  id: string;
  idempotencyKey: string;
  destination: ConsignmentDestination;
  qty: number;
  grossWeight: number;
  netWeight: number;
  warehouseId: string | null;
  warehouseName: string | null;
  destinationNote: string | null;
  stockReference: string | null;
  at: string;
  userId: string;
  userName: string;
};

export type ConsignmentStatus = "awaiting_payment" | "ready" | "partial" | "transferred";

const q4 = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
};
const EPS = 0.00005;

export function isConsignmentDestination(v: unknown): v is ConsignmentDestination {
  return (CONSIGNMENT_DESTINATIONS as readonly string[]).includes(String(v));
}

/** Stable unique key of one loading. A purchase with several loadings yields several keys. */
export function consignmentKey(source: ConsignmentSource, purchaseId: string, loadingId: string): string {
  return source === "purchase_booking" ? `pb:${loadingId}` : `lp:${purchaseId}:${loadingId}`;
}

export function parseConsignmentKey(key: string): { source: ConsignmentSource; purchaseId: string | null; loadingId: string } | null {
  const pb = /^pb:([0-9a-f-]{36})$/i.exec(key);
  if (pb) return { source: "purchase_booking", purchaseId: null, loadingId: pb[1] };
  const lp = /^lp:([0-9a-f-]{36}):([A-Za-z0-9_-]{1,80})$/i.exec(key);
  if (lp) return { source: "local_purchase", purchaseId: lp[1], loadingId: lp[2] };
  return null;
}

/** Older local loading entries may lack an id — fall back to a positional id that never changes for that entry. */
export function localEntryId(entry: { id?: unknown; entryNo?: unknown }, index: number): string {
  const id = String(entry?.id ?? "").trim();
  if (id && /^[A-Za-z0-9_-]{1,80}$/.test(id)) return id;
  const no = Number(entry?.entryNo);
  return `entry-${Number.isFinite(no) && no > 0 ? no : index + 1}`;
}

export function readTransfers(value: unknown): ConsignmentTransferRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t) => t && typeof t === "object" && q4((t as any).qty) > 0)
    .map((t: any) => ({
      id: String(t.id ?? ""),
      idempotencyKey: String(t.idempotencyKey ?? ""),
      destination: isConsignmentDestination(t.destination) ? t.destination : "warehouse",
      qty: q4(t.qty),
      grossWeight: q4(t.grossWeight),
      netWeight: q4(t.netWeight),
      warehouseId: t.warehouseId ?? null,
      warehouseName: t.warehouseName ?? null,
      destinationNote: t.destinationNote ?? null,
      stockReference: t.stockReference ?? null,
      at: String(t.at ?? ""),
      userId: String(t.userId ?? ""),
      userName: String(t.userName ?? ""),
    }));
}

export function sumTransferred(transfers: ConsignmentTransferRecord[]): number {
  return q4(transfers.reduce((s, t) => s + q4(t.qty), 0));
}

/**
 * Quantity of a Purchase Booking loading that has already left the consignment by ANY path, so nothing is moved twice:
 *  - consignment transfers recorded on the loading,
 *  - quantity received into a warehouse by the older Destination Receiving screen (received_quantity minus the part
 *    this page itself booked, which also raises received_quantity),
 *  - a final Purchase Lane disposition made outside this page (the whole load is then gone).
 */
export function bookingTransferredQty(p: {
  loadedQty: number;
  receivedQty: number;
  transfers: ConsignmentTransferRecord[];
  laneFinalElsewhere: boolean;
}): number {
  const loaded = q4(p.loadedQty);
  if (p.laneFinalElsewhere) return loaded;
  const own = sumTransferred(p.transfers);
  const ownWarehouse = q4(p.transfers.filter((t) => t.destination === "warehouse").reduce((s, t) => s + t.qty, 0));
  const receivedElsewhere = Math.max(0, q4(p.receivedQty) - ownWarehouse);
  return Math.min(loaded, q4(own + receivedElsewhere));
}

export function availableToTransfer(loadedQty: number, transferredQty: number): number {
  return Math.max(0, q4(q4(loadedQty) - q4(transferredQty)));
}

/** The established booking rule (same as the existing booking stock-forward route). */
export function bookingPaymentProofComplete(paymentStatus: unknown, remainingDue: unknown): boolean {
  const s = String(paymentStatus ?? "").trim().toLowerCase();
  return s === "completed" || s === "paid" || q4(remainingDue) <= 0;
}

export function consignmentStatus(p: { loadedQty: number; transferredQty: number; locked: boolean }): ConsignmentStatus {
  const avail = availableToTransfer(p.loadedQty, p.transferredQty);
  if (avail <= EPS) return "transferred";
  if (p.locked) return "awaiting_payment";
  return q4(p.transferredQty) > EPS ? "partial" : "ready";
}

export type TransferProblem = "qty" | "exceeds" | "nothing_left" | "destination" | "warehouse" | "locked";

/** Every reason a requested transfer must be refused. Empty = valid. */
export function transferProblems(p: {
  destination: unknown;
  qty: unknown;
  available: number;
  warehouseId?: string | null;
  locked?: boolean;
}): TransferProblem[] {
  const out: TransferProblem[] = [];
  if (p.locked) out.push("locked");
  if (!isConsignmentDestination(p.destination)) out.push("destination");
  if (p.destination === "warehouse" && !p.warehouseId) out.push("warehouse");
  const qty = q4(p.qty);
  if (!(qty > 0)) out.push("qty");
  if (q4(p.available) <= EPS) out.push("nothing_left");
  else if (qty > q4(p.available) + EPS) out.push("exceeds");
  return out;
}

/** Weights travel with the quantity: a partial transfer carries its proportional share of the loading's weights. */
export function proportionalWeights(loadedQty: number, grossWeight: number, netWeight: number, qty: number) {
  const loaded = q4(loadedQty);
  if (!(loaded > 0)) return { grossWeight: 0, netWeight: 0 };
  const f = q4(qty) / loaded;
  return { grossWeight: Math.round(q4(grossWeight) * f * 100) / 100, netWeight: Math.round(q4(netWeight) * f * 100) / 100 };
}

export function findReplay(transfers: ConsignmentTransferRecord[], idempotencyKey: string): ConsignmentTransferRecord | null {
  if (!idempotencyKey) return null;
  return transfers.find((t) => t.idempotencyKey === idempotencyKey) ?? null;
}

