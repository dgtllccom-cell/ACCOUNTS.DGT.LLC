/**
 * Pure, dependency-free rules for the Shipping & Clearing "New Customer Order"
 * workflow (1A Booking -> 1B Truck/Fleet -> 1C Goods -> Review/Final).
 *
 * Shared by the generic order save (clearing-customer-order-service.ts), the
 * stage workflow API (customer-order/[id]/workflow/route.ts) and the E2E script,
 * so every writer applies the SAME rules and a later step can never silently
 * undo an earlier one.
 */

/** Truck number the 1B form writes for "Option 3: Assign Later". It is a placeholder, not a truck. */
export const TRUCK_PLACEHOLDER = "TO BE ASSIGNED";

export function isTruckPlaceholder(value: unknown): boolean {
  const v = String(value ?? "").trim().toUpperCase();
  return v === "" || v === TRUCK_PLACEHOLDER;
}

/**
 * jsonb columns written by older code as JSON *text* (`${JSON.stringify(x)}::jsonb`
 * double-encodes into a jsonb string) come back from Postgres as a string. Readers
 * must accept both shapes; new writers always store a real jsonb object.
 */
export function parseJsonObject(value: unknown): Record<string, any> {
  if (value == null) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{")) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function parseJsonArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("[")) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Order status ladder. A generic "Save Draft" carries whatever status the browser
 * loaded; it must never move an order BACKWARDS past a workflow action that already
 * advanced it (Confirm Truck -> truck_confirmed, Complete Goods -> completed, approval).
 * 'returned_for_correction' is deliberately rank 0: re-saving a returned order puts it
 * back into normal editing.
 */
const STATUS_RANK: Record<string, number> = {
  draft: 0,
  pending: 0,
  returned_for_correction: 0,
  rejected: 0,
  booking_confirmed: 1,
  truck_confirmed: 2,
  completed: 3,
  approved: 3,
};

export function resolveSavedStatus(existing: string | null | undefined, incoming: string | null | undefined): string {
  const inc = (incoming ?? "pending") || "pending";
  const cur = existing ?? null;
  const rc = cur ? STATUS_RANK[cur] : undefined;
  const ri = STATUS_RANK[inc];
  // truck_confirmed / completed (and approved) can only be reached through their own stage
  // actions, never by a generic save carrying that string — otherwise "Final Submit" with an
  // empty 1B/1C could stamp an order complete.
  if (ri !== undefined && ri >= 2 && inc !== cur) return cur ?? "pending";
  if (cur && rc !== undefined && ri !== undefined && ri < rc) return cur;
  return inc;
}

/** Keys of truck_details owned by the 1B confirmation; a generic save may never overwrite them. */
export const TRUCK_CONFIRMATION_KEYS = [
  "stage1bCompleted",
  "stage1bCompletedAt",
  "confirmedBy",
  "confirmedByName",
  "confirmedByBranch",
  "confirmedAt",
] as const;

export function mergeTruckDetails(existingRaw: unknown, incomingRaw: unknown): Record<string, any> | null {
  const existing = parseJsonObject(existingRaw);
  const incoming = parseJsonObject(incomingRaw);
  const merged: Record<string, any> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined || v === null || v === "") continue; // an empty form field never erases a stored value
    merged[k] = v;
  }
  for (const key of TRUCK_CONFIRMATION_KEYS) {
    if (existing[key] !== undefined) merged[key] = existing[key];
  }
  return Object.keys(merged).length ? merged : null;
}

export type Stage1bView = {
  truck_number?: string | null;
  truck_details?: unknown;
  status?: string | null;
};

/** Everything 1B must have before the order may move on / be completed. */
export function stage1bMissing(order: Stage1bView): string[] {
  const missing: string[] = [];
  const details = parseJsonObject(order.truck_details);
  const confirmed = details.stage1bCompleted === true || order.status === "truck_confirmed" || order.status === "completed";
  if (!confirmed) missing.push("Stage 1B (Truck & Transport) has not been confirmed");
  if (isTruckPlaceholder(order.truck_number)) missing.push("a real Truck / Registration Number (\"To be assigned\" is only a placeholder)");
  return missing;
}

export type GoodsItemInput = Record<string, any>;

const num = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** The first-class field values of one goods row, tolerant of the browser's and the API's field names. */
export function readGoodsItem(g: GoodsItemInput) {
  const quantity = num(g.quantity);
  const gross = num(g.grossWeight) || num(g.totalKg);
  const empty = num(g.emptyWeight);
  return {
    name: String(g.goodsName ?? g.goods_name ?? "").trim(),
    hsCode: String(g.goodsChsCode ?? g.hsCode ?? g.chsCode ?? "").trim() || null,
    brand: String(g.brandQuality ?? g.brand ?? "").trim() || null,
    size: String(g.size ?? "").trim() || null,
    originCountry: String(g.originCountry ?? "").trim() || null,
    unit: String(g.unit ?? "").trim() || "Bags",
    quantity,
    gross,
    empty,
    net: Math.max(0, gross - empty),
  };
}

/** Per-row problems that block 1C completion. Row numbers are 1-based. */
export function validateGoodsItems(items: GoodsItemInput[]): string[] {
  const problems: string[] = [];
  if (!Array.isArray(items) || items.length === 0) return ["at least one goods item is required"];
  items.forEach((raw, idx) => {
    const g = readGoodsItem(raw);
    const row = idx + 1;
    if (!g.name) problems.push(`row ${row}: goods name is required`);
    if (!(g.quantity > 0)) problems.push(`row ${row}: quantity must be greater than 0`);
    if (!(g.gross > 0)) problems.push(`row ${row}: gross weight must be greater than 0`);
    if (g.empty > g.gross) problems.push(`row ${row}: empty/tare weight cannot exceed gross weight`);
  });
  return problems;
}

/**
 * Cross-border road legs may only carry a REGISTERED fleet truck (DB check
 * clearing_customer_order_legs_cross_border_truck_chk). "Assign Later" must therefore
 * leave the leg's registration type empty instead of defaulting it to 'temporary'.
 */
export function legTruckRegistrationType(opts: {
  legValue?: string | null;
  assignmentMode?: string | null;
  orderRegistrationType?: string | null;
}): "registered" | "temporary" | null {
  // The user's CURRENT 1B choice decides — a registration type loaded from an earlier save
  // (e.g. the 1A default "registered") must not outvote switching to Hired / Assign Later.
  if (opts.assignmentMode === "later") return null;
  if (opts.assignmentMode === "permanent") return "registered";
  if (opts.assignmentMode === "hired") return "temporary";
  if (opts.legValue === "registered" || opts.legValue === "temporary") return opts.legValue;
  if (opts.orderRegistrationType === "registered" || opts.orderRegistrationType === "temporary") return opts.orderRegistrationType;
  return null;
}

export function violatesCrossBorderTruckRule(leg: {
  transportMode?: string | null;
  fromCountryId?: string | null;
  toCountryId?: string | null;
  truckRegistrationType?: string | null;
}): boolean {
  return (
    leg.transportMode === "by_road" &&
    !!leg.fromCountryId &&
    !!leg.toCountryId &&
    leg.fromCountryId !== leg.toCountryId &&
    leg.truckRegistrationType === "temporary"
  );
}

/**
 * 1B fleet fields arrive from the browser as separate keys (truck_vehicle_type, ...) and/or a
 * truck_details object. Fold them into the single truck_details jsonb object the order stores,
 * so a plain "Save Draft" at step 1B keeps vehicle type / arrival time / loading location /
 * status / photo instead of silently dropping everything except the truck number.
 */
export function collectTruckDetailsFromBody(body: Record<string, any>): Record<string, any> | null {
  const fromObject = parseJsonObject(body.truck_details ?? body.truckDetails);
  const pick = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : v);
  const collected: Record<string, any> = {
    ...fromObject,
    vehicleType: pick(body.truck_vehicle_type) ?? fromObject.vehicleType,
    arrivalTime: pick(body.truck_arrival_time) ?? fromObject.arrivalTime,
    loadingLocation: pick(body.truck_loading_location) ?? fromObject.loadingLocation,
    truckStatus: pick(body.truck_status) ?? fromObject.truckStatus,
    poRef: pick(body.truck_po_ref) ?? fromObject.poRef,
    truckPhotoName: pick(body.truck_photo_name) ?? fromObject.truckPhotoName,
  };
  const photo = pick(body.truck_photo_url);
  if (photo && !(Array.isArray(collected.truckPhotos) && collected.truckPhotos.length)) collected.truckPhotos = [photo];
  for (const k of Object.keys(collected)) if (collected[k] === undefined) delete collected[k];
  return Object.keys(collected).length ? collected : null;
}

export const CROSS_BORDER_TRUCK_MESSAGE =
  "A road leg that crosses a country border must use a registered truck from the Truck Master " +
  "(Option 1 in Stage 1B), not a hired/temporary one. Choose a Permanent Fleet truck, or use \"Assign Later\" until one is available.";

/** True when a Postgres error is the cross-border registered-truck CHECK constraint. */
export function isCrossBorderTruckViolation(error: unknown): boolean {
  const e = error as { code?: string; constraint_name?: string; constraint?: string; message?: string } | null;
  if (!e || e.code !== "23514") return false;
  return /cross_border_truck/i.test(`${e.constraint_name ?? ""} ${e.constraint ?? ""} ${e.message ?? ""}`);
}

/**
 * HTTP status to report for a caught route error: an error that carries its own 4xx status
 * (e.g. ErpPermissionError = 403) keeps it, so a permission denial is not reported as a
 * 500 "server error". Anything else stays 500.
 */
export function httpStatusOfError(error: unknown): number {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500 ? status : 500;
}
