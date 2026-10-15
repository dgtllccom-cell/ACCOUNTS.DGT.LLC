/**
 * Stock Journal — pure model (no database, no I/O) so every quantity rule is unit-testable.
 *
 * One Purchase Booking goods line travels:  booking → transit (loaded) → receiving (received, customs open)
 *   → ready (received + customs cleared, waiting for an authorized Confirm Stock) → available / reserved → sold.
 * The quantities of one goods line are split across those stages and ALWAYS add back up to what was booked
 * (nothing is counted twice; a quantity lives in exactly one stage at a time).
 */

export const EPS = 0.0001;
export const q4 = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
};

export type StockStage = "booking" | "transit" | "receiving" | "ready" | "available" | "reserved" | "sold";
export type DestinationType = "warehouse" | "local_sales" | "export" | "direct_sale";
export type CustomsStatus = "pending" | "submitted" | "cleared" | "not_applicable" | "not_recorded";

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Reading JSON that was stored as text
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Several Purchase Booking / Loading rows hold `form_data` / `report_payload` as a JSON STRING inside the jsonb column
 * (double-encoded) — and a few as an object whose keys are the string's character positions ("0","1",…).
 * Reading them as objects made the booked quantity 0, which is why those bookings never showed in the Stock Journal.
 */
export function parseJsonish(value: unknown, depth = 0): any {
  if (value == null) return {};
  if (typeof value === "string") {
    const t = value.trim();
    if (!t || (t[0] !== "{" && t[0] !== "[" && t[0] !== '"')) return {};
    try {
      const parsed = JSON.parse(t);
      return depth < 3 ? parseJsonish(parsed, depth + 1) : parsed;
    } catch {
      return {};
    }
  }
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (keys.length > 20 && keys.every((k) => /^\d+$/.test(k))) {
      // a string that was spread into an object: rebuild it from the character positions
      const chars = keys.sort((a, b) => Number(a) - Number(b)).map((k) => String((value as any)[k] ?? ""));
      return depth < 3 ? parseJsonish(chars.join(""), depth + 1) : {};
    }
    return value;
  }
  return {};
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Goods lines of a Purchase Booking
// ──────────────────────────────────────────────────────────────────────────────────────────────

export type GoodsLine = {
  lineKey: string;
  index: number;
  goodsName: string;
  goodsId: string | null;
  unit: string;
  booked: number;
  brand: string;
  size: string;
};

/** Every booking yields at least one line — a Draft with no quantity yet still appears (quantity 0, flagged). */
export function extractPoGoodsLines(formData: unknown): { lines: GoodsLine[]; form: any; data: any } {
  const data = parseJsonish(formData);
  const form = data?.form && typeof data.form === "object" ? data.form : {};
  const entries: any[] = Array.isArray(data?.goodsEntries) ? data.goodsEntries.filter((g: any) => g && typeof g === "object") : [];
  const seen = new Map<string, number>();
  const key = (name: string) => {
    const base = slug(name) || "goods";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  };
  let lines: GoodsLine[];
  if (entries.length > 0) {
    lines = entries.map((g, index) => {
      const goodsName = str(g.goodsName ?? g.goods_name ?? g.name) || str(form.goodsName) || "";
      return {
        lineKey: key(goodsName),
        index,
        goodsName,
        goodsId: str(g.goodsId ?? g.goods_id) || null,
        unit: str(g.qtyName ?? g.unit ?? g.unitName) || str(form.qtyName ?? form.unitName),
        booked: q4(num(g.qtyNo ?? g.quantity ?? g.qty ?? 0)),
        brand: str(g.brand) || str(form.brand),
        size: str(g.size) || str(form.size),
      };
    });
  } else {
    const goodsName = str(form.goodsName ?? form.goods_name);
    lines = [
      {
        lineKey: key(goodsName),
        index: 0,
        goodsName,
        goodsId: str(form.goodsId ?? form.goods_id) || null,
        unit: str(form.qtyName ?? form.unit ?? form.unitName),
        booked: q4(num(form.qtyNo ?? form.quantity ?? form.qtyNumber ?? 0)),
        brand: str(form.brand),
        size: str(form.size),
      },
    ];
  }
  return { lines, form, data };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Loading records → goods lines (partial loading, several containers / trucks, never duplicated)
// ──────────────────────────────────────────────────────────────────────────────────────────────

export type LoadingFact = {
  id: string;
  no: string;
  containerNo: string;
  vehicleNo: string;
  blNumber: string;
  createdAt: string;
  loadedAt: string | null;
  loaded: number;
  received: number | null;
  damaged: number;
  shortage: number;
  loadingStatus: string;
  receivingWarehouseId: string | null;
  receivingGoodsId: string | null;
  customsStatus: CustomsStatus;
  customsSource: "loading_record" | "clearing_order" | "none";
  payload: unknown;
};

export type Chunk = {
  loadingId: string;
  lineKey: string;
  /** quantity of THIS goods line carried by this loading record */
  loaded: number;
  receivedGood: number;
  damaged: number;
  shortage: number;
  inTransit: number;
  /** received before the receiving facts were recorded (status "received", no received quantity): treated as fully received */
  legacyReceived: boolean;
};

/** What a loading record physically did: good received / damaged / short / still on the road. */
export function receivingFacts(l: Pick<LoadingFact, "loaded" | "received" | "damaged" | "shortage" | "loadingStatus">) {
  const loaded = q4(l.loaded);
  const hasReceipt = l.received != null && l.received > EPS;
  const legacyReceived = !hasReceipt && String(l.loadingStatus).toLowerCase() === "received";
  const receivedGood = legacyReceived ? loaded : q4(hasReceipt ? l.received : 0);
  const damaged = q4(legacyReceived ? 0 : l.damaged);
  const shortage = q4(legacyReceived ? 0 : l.shortage);
  const inTransit = Math.max(0, q4(loaded - receivedGood - damaged - shortage));
  return { loaded, receivedGood, damaged, shortage, inTransit, legacyReceived };
}

/**
 * Splits each loading record's quantity over the booking's goods lines.
 *   1. the loading record's own per-goods quantities (report_payload.goodsEntries), when it has them;
 *   2. otherwise the line it names (receiving_goods_id), or the only line;
 *   3. otherwise first-in-first-out over the lines' remaining booked capacity (the remainder, if the loading exceeds the
 *      booking, stays on the last line and is flagged as over-loaded — it is never dropped).
 * Receiving facts are split in the same proportion, so the totals of all chunks equal the loading record exactly.
 */
export function allocateLoadings(lines: GoodsLine[], loadings: LoadingFact[]): { chunks: Chunk[]; overLoaded: Record<string, number> } {
  const chunks: Chunk[] = [];
  const used = new Map<string, number>(lines.map((l) => [l.lineKey, 0]));
  const byName = new Map(lines.map((l) => [l.goodsName.toLowerCase(), l.lineKey]));
  const ordered = [...loadings].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));

  for (const l of ordered) {
    const f = receivingFacts(l);
    if (f.loaded <= EPS || lines.length === 0) continue;

    const parts: { lineKey: string; qty: number }[] = [];
    const payload = parseJsonish(l.payload);
    const declared: any[] = Array.isArray(payload?.goodsEntries) ? payload.goodsEntries : [];
    let declaredTotal = 0;
    const declaredParts: { lineKey: string; qty: number }[] = [];
    for (const d of declared) {
      const key = byName.get(str(d?.goodsName ?? d?.goods_name ?? d?.name).toLowerCase());
      const qty = q4(num(d?.loadedQuantity ?? d?.quantity ?? d?.qtyNo ?? d?.qty ?? 0));
      if (key && qty > EPS) {
        declaredParts.push({ lineKey: key, qty });
        declaredTotal += qty;
      }
    }
    if (declaredParts.length > 0 && Math.abs(declaredTotal - f.loaded) <= 0.01) {
      parts.push(...declaredParts);
    } else {
      const named = l.receivingGoodsId ? lines.find((x) => x.goodsId && x.goodsId === l.receivingGoodsId) : undefined;
      if (named) parts.push({ lineKey: named.lineKey, qty: f.loaded });
      else if (lines.length === 1) parts.push({ lineKey: lines[0].lineKey, qty: f.loaded });
      else {
        let left = f.loaded;
        for (const line of lines) {
          if (left <= EPS) break;
          const room = Math.max(0, q4(line.booked - (used.get(line.lineKey) ?? 0)));
          const take = Math.min(room, left);
          if (take > EPS) {
            parts.push({ lineKey: line.lineKey, qty: q4(take) });
            left = q4(left - take);
          }
        }
        if (left > EPS) parts.push({ lineKey: lines[lines.length - 1].lineKey, qty: left });
      }
    }

    // proportional receiving facts; the last part absorbs rounding so the sums stay exact
    let rec = f.receivedGood, dam = f.damaged, sho = f.shortage, tra = f.inTransit;
    parts.forEach((p, i) => {
      const last = i === parts.length - 1;
      const share = f.loaded > EPS ? p.qty / f.loaded : 0;
      const r = last ? rec : q4(f.receivedGood * share);
      const d = last ? dam : q4(f.damaged * share);
      const s = last ? sho : q4(f.shortage * share);
      const t = last ? tra : q4(f.inTransit * share);
      rec = q4(rec - r); dam = q4(dam - d); sho = q4(sho - s); tra = q4(tra - t);
      chunks.push({ loadingId: l.id, lineKey: p.lineKey, loaded: p.qty, receivedGood: r, damaged: d, shortage: s, inTransit: t, legacyReceived: f.legacyReceived });
      used.set(p.lineKey, q4((used.get(p.lineKey) ?? 0) + p.qty));
    });
  }

  const loadedPerLine = new Map<string, number>();
  for (const c of chunks) loadedPerLine.set(c.lineKey, q4((loadedPerLine.get(c.lineKey) ?? 0) + c.loaded));
  const overLoaded: Record<string, number> = {};
  for (const line of lines) {
    const over = q4((loadedPerLine.get(line.lineKey) ?? 0) - line.booked);
    if (over > EPS && line.booked > 0) overLoaded[line.lineKey] = over;
  }
  return { chunks, overLoaded };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Confirmation ledger → stage
// ──────────────────────────────────────────────────────────────────────────────────────────────

export type ConfirmationFact = {
  id: string;
  transferNo: string;
  loadingRecordId: string | null;
  lineKey: string | null;
  goodsName: string;
  destinationType: DestinationType;
  status: "confirmed" | "issued" | "reversed";
  reserved: boolean;
  quantity: number;
  warehouseId: string | null;
  customerName: string | null;
  salesOrderNo: string | null;
  documentRef: string | null;
  issueType: string | null;
  issuedAt: string | null;
  confirmedAt: string | null;
  referenceNo: string | null;
};

export const isCustomsOk = (s: CustomsStatus) => s === "cleared" || s === "not_applicable";

/** Stage of an active confirmation: issued → sold; reserved for export / direct sale → reserved; otherwise → available. */
export function confirmationStage(c: Pick<ConfirmationFact, "status" | "destinationType" | "reserved">): StockStage {
  if (c.status === "issued") return "sold";
  if (c.destinationType === "export" || c.destinationType === "direct_sale" || c.reserved) return "reserved";
  return "available";
}

/** Quantity of a (loading, line) chunk that can still be confirmed: received good stock minus active confirmations. */
export function confirmableQuantity(chunk: Chunk, confirmations: Pick<ConfirmationFact, "loadingRecordId" | "lineKey" | "status" | "quantity">[]) {
  const taken = confirmations
    .filter((c) => c.status !== "reversed" && c.loadingRecordId === chunk.loadingId && (c.lineKey ? c.lineKey === chunk.lineKey : true))
    .reduce((s, c) => s + c.quantity, 0);
  return Math.max(0, q4(chunk.receivedGood - taken));
}
