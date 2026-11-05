/**
 * Purchase Journal Booking Stock register (issue #38) - a PURE view over the canonical Stock Journal rows.
 *
 * Input: the scoped rows `loadStockJournal` already produces (one row per bill line / loading chunk / confirmation, each quantity in exactly one
 * stage). Output: one parent row per Purchase Booking bill with its loading / receipt entries, plus the three summary panels.
 * Nothing here reads the database or moves stock; it only regroups what the stock journal computed, so the register can never disagree with it.
 *
 * Rules the issue fixes in place:
 *   - Purchase Booking only (Local Purchase rows are dropped here, they have their own Goods Transfer Journal);
 *   - quantities are kept PER UNIT (bags, boxes and cartons are never added together);
 *   - booked = not loaded + in transit + awaiting confirmation (received, not yet confirmed) + confirmed + damaged + shortage, per unit;
 *     receiving a load MOVES its quantity from transit to awaiting / confirmed, it is never counted twice;
 *   - gross / net kg of a stage are derived only from the SAME goods line's recorded booking weight (kg per unit of that line), never across
 *     goods; a line with no recorded weight contributes no kg (and the result says so);
 *   - invoice figures are read-only; there is no payment figure in the register.
 */
import type { StockJournalRow, InvoiceDetail, LoadingDetail } from "@/lib/services/stock-journal-service";

export type UnitQty = Record<string, number>;
export type Weighted = { qty: UnitQty; gross: number; net: number; weightMissing: boolean };

export type EntryReceiving = "in_transit" | "partially_received" | "received" | "received_with_loss";
export type EntryConfirmation = "not_received" | "awaiting_customs" | "awaiting_payment" | "ready" | "partially_confirmed" | "confirmed";
export type BillStatus = "draft" | "booked" | "partially_loaded" | "in_transit" | "partially_received" | "received" | "partially_confirmed" | "confirmed";

export type RegisterEntry = {
  loadingRecordId: string;
  entryNo: string;
  loadingNo: string;
  date: string | null;
  goods: string;
  unit: string;
  loaded: UnitQty;
  received: UnitQty;
  damaged: UnitQty;
  shortage: UnitQty;
  inTransit: UnitQty;
  awaiting: UnitQty;
  confirmed: UnitQty;
  gross: number;
  net: number;
  /** true when the kg come from the loading record itself; false when derived from the booked line weight */
  weightRecorded: boolean;
  /** derived kg are incomplete: a goods line of this entry has no recorded weight */
  weightPartial: boolean;
  truckOrContainer: string;
  blNumber: string;
  transportMode: string;
  loadingPlace: string;
  departureDate: string | null;
  receivingPlace: string;
  arrivalDate: string | null;
  arrivalExpected: boolean;
  receivedAt: string | null;
  customsStatus: string;
  receiving: EntryReceiving;
  confirmation: EntryConfirmation;
};

export type RegisterBill = {
  sourceId: string;
  purchaseNo: string;
  manualNo: string;
  date: string | null;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  countryBranchId: string | null;
  cityBranchId: string | null;
  branchName: string;
  supplierName: string;
  goods: Array<{ name: string; unit: string; brand: string; size: string; booked: number; gross: number; net: number }>;
  booked: UnitQty;
  gross: number;
  net: number;
  loaded: UnitQty;
  received: UnitQty;
  inTransit: UnitQty;
  awaiting: UnitQty;
  confirmed: UnitQty;
  sold: UnitQty;
  notLoaded: UnitQty;
  pending: UnitQty;
  damaged: UnitQty;
  shortage: UnitQty;
  entries: RegisterEntry[];
  status: BillStatus;
  bookingNo: string;
  invoiceNo: string;
  origin: string;
  bookingStatus: "draft" | "confirmed";
  invoiceStatus: "posted" | "unposted";
  invoice: InvoiceDetail | null;
  /** search haystack (bill, supplier, goods, containers, BL, entries) */
  text: string;
};

export type CountryStock = {
  key: string;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  countryBranchId: string | null;
  cityBranchId: string | null;
  branchName: string;
  bills: number;
  booked: UnitQty;
  gross: number;
  net: number;
};

export type RegisterPanels = {
  purchase: { bills: number; booked: UnitQty; gross: number; net: number; loaded: UnitQty; supplierPending: UnitQty };
  confirm: { inTransit: Weighted; confirmed: Weighted; sold: Weighted; notLoaded: Weighted; awaiting: Weighted };
  countries: CountryStock[];
};

const EPS = 0.0001;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const r2 = (v: number) => Math.round(v * 100) / 100;
/**
 * One spelling per unit: "CARTONS", "Cartons", "carton" and "CTN" are the same unit typed differently, so they are grouped (case and plural
 * only). Different units (bags, boxes, cartons, bales ...) are NEVER merged. "-" = no unit recorded.
 */
const UNIT_ALIASES: Record<string, string> = {
  CARTONS: "CARTON", CTN: "CARTON", CTNS: "CARTON", BAGS: "BAG", BALES: "BALE", BOXES: "BOX", BX: "BOX", PIECES: "PCS", PIECE: "PCS", PC: "PCS",
  KGS: "KG", KILOGRAM: "KG", KILOGRAMS: "KG", TONS: "TON", TONNES: "TON", TONNE: "TON", DRUMS: "DRUM", SACKS: "SACK", CASES: "CASE", PACKS: "PACK", ROLLS: "ROLL",
};
export function unitOf(u: string | null | undefined): string {
  const t = String(u ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!t) return "-";
  return UNIT_ALIASES[t] ?? t;
}

export function addQty(target: UnitQty, unit: string, qty: number) {
  if (!Number.isFinite(qty) || Math.abs(qty) <= EPS) return target;
  const u = unitOf(unit);
  target[u] = r4((target[u] ?? 0) + qty);
  return target;
}
export function sumQty(...parts: UnitQty[]): UnitQty {
  const out: UnitQty = {};
  for (const p of parts) for (const [u, q] of Object.entries(p)) addQty(out, u, q);
  return out;
}
export function minusQty(a: UnitQty, b: UnitQty): UnitQty {
  const out: UnitQty = { ...a };
  for (const [u, q] of Object.entries(b)) out[u] = r4((out[u] ?? 0) - q);
  for (const u of Object.keys(out)) if (Math.abs(out[u]) <= EPS) delete out[u];
  return out;
}
export const isZero = (q: UnitQty) => Object.values(q).every((v) => Math.abs(v) <= EPS);
/** a >= b in every unit b has */
const covers = (a: UnitQty, b: UnitQty) => Object.entries(b).every(([u, v]) => (a[u] ?? 0) + EPS >= v);

const emptyWeighted = (): Weighted => ({ qty: {}, gross: 0, net: 0, weightMissing: false });

type LineInfo = { unit: string; booked: number; gross: number; net: number };
/** kg of `qty` units of ONE goods line, from that line's recorded booking weight; null when the line has no weight */
function kgOf(line: LineInfo | undefined, qty: number): { gross: number; net: number } | null {
  if (!line || line.booked <= EPS || (line.gross <= 0 && line.net <= 0)) return null;
  return { gross: (line.gross / line.booked) * qty, net: (line.net / line.booked) * qty };
}
function addWeighted(w: Weighted, line: LineInfo | undefined, unit: string, qty: number) {
  if (qty <= EPS) return;
  addQty(w.qty, unit, qty);
  const kg = kgOf(line, qty);
  if (kg) { w.gross += kg.gross; w.net += kg.net; } else w.weightMissing = true;
}

function billStatus(b: Pick<RegisterBill, "booked" | "loaded" | "received" | "inTransit" | "confirmed" | "bookingStatus">): BillStatus {
  const anyQ = (q: UnitQty) => Object.values(q).some((v) => v > EPS);
  if (!anyQ(b.loaded)) return b.bookingStatus === "draft" ? "draft" : "booked";
  if (anyQ(b.booked) && covers(b.confirmed, b.booked)) return "confirmed";
  if (anyQ(b.confirmed)) return "partially_confirmed";
  if (anyQ(b.received) && !anyQ(b.inTransit) && covers(b.loaded, b.booked)) return "received";
  if (anyQ(b.received)) return "partially_received";
  if (anyQ(b.inTransit)) return covers(b.loaded, b.booked) ? "in_transit" : "partially_loaded";
  return "partially_loaded";
}

export function buildBookingRegister(allRows: StockJournalRow[]): { bills: RegisterBill[]; panels: RegisterPanels } {
  const rows = allRows.filter((r) => r.sourceType === "purchase_booking");
  const byBill = new Map<string, StockJournalRow[]>();
  for (const r of rows) (byBill.get(r.sourceId) ?? byBill.set(r.sourceId, []).get(r.sourceId)!).push(r);

  const panels: RegisterPanels = {
    purchase: { bills: 0, booked: {}, gross: 0, net: 0, loaded: {}, supplierPending: {} },
    confirm: { inTransit: emptyWeighted(), confirmed: emptyWeighted(), sold: emptyWeighted(), notLoaded: emptyWeighted(), awaiting: emptyWeighted() },
    countries: [],
  };
  const countries = new Map<string, CountryStock>();
  const bills: RegisterBill[] = [];

  for (const [sourceId, list] of byBill) {
    const head = list[0];
    // goods lines (each line once)
    const lines = new Map<string, LineInfo & { name: string; brand: string; size: string }>();
    for (const r of list) {
      if (!lines.has(r.lineKey)) lines.set(r.lineKey, { name: r.productName, unit: unitOf(r.unit), brand: r.brand, size: r.size, booked: r.bookedQuantity, gross: r.grossWeight || 0, net: r.netWeight || 0 });
    }
    const booked: UnitQty = {};
    let gross = 0, net = 0;
    for (const l of lines.values()) { addQty(booked, l.unit, l.booked); gross += l.gross; net += l.net; }

    // chunk facts (loading x line) once each, and stage quantities
    const notLoaded: UnitQty = {}, inTransit: UnitQty = {}, awaiting: UnitQty = {}, confirmed: UnitQty = {}, sold: UnitQty = {};
    const chunkSeen = new Set<string>();
    const loaded: UnitQty = {}, received: UnitQty = {}, damaged: UnitQty = {}, shortage: UnitQty = {};
    const entryMap = new Map<string, { rows: StockJournalRow[]; detail: LoadingDetail | null }>();

    for (const r of list) {
      const line = lines.get(r.lineKey);
      const unit = line?.unit ?? unitOf(r.unit);
      if (r.loadingRecordId) {
        const e = entryMap.get(r.loadingRecordId) ?? { rows: [], detail: r.loadingDetail ?? null };
        e.rows.push(r);
        if (!e.detail && r.loadingDetail) e.detail = r.loadingDetail;
        entryMap.set(r.loadingRecordId, e);
        const ck = `${r.loadingRecordId}|${r.lineKey}`;
        if (!chunkSeen.has(ck)) {
          chunkSeen.add(ck);
          addQty(loaded, unit, r.loadedQuantity);
          addQty(received, unit, r.receivedQuantity);
          addQty(damaged, unit, r.damagedQuantity);
          addQty(shortage, unit, r.shortageQuantity);
        }
      }
      switch (r.stage) {
        case "booking": addQty(notLoaded, unit, r.quantity); addWeighted(panels.confirm.notLoaded, line, unit, r.quantity); break;
        case "transit": addQty(inTransit, unit, r.quantity); addWeighted(panels.confirm.inTransit, line, unit, r.quantity); break;
        case "receiving": case "ready": addQty(awaiting, unit, r.quantity); addWeighted(panels.confirm.awaiting, line, unit, r.quantity); break;
        case "available": case "reserved": case "sold":
          addQty(confirmed, unit, r.quantity); addWeighted(panels.confirm.confirmed, line, unit, r.quantity);
          if (r.stage === "sold") { addQty(sold, unit, r.quantity); addWeighted(panels.confirm.sold, line, unit, r.quantity); }
          break;
      }
    }

    // loading / receipt entries, numbered in loading order: <Purchase No>-01, -02 ...
    const ordered = [...entryMap.entries()].sort(([, a], [, b]) => String(a.detail?.createdAt ?? a.rows[0].date ?? "").localeCompare(String(b.detail?.createdAt ?? b.rows[0].date ?? "")) || a.rows[0].id.localeCompare(b.rows[0].id));
    const entries: RegisterEntry[] = ordered.map(([loadingRecordId, e], i) => {
      const seen = new Set<string>();
      const q = { loaded: {} as UnitQty, received: {} as UnitQty, damaged: {} as UnitQty, shortage: {} as UnitQty, inTransit: {} as UnitQty, awaiting: {} as UnitQty, confirmed: {} as UnitQty };
      let derivedGross = 0, derivedNet = 0, weightKnown = true;
      const goodsNames = new Set<string>(), units = new Set<string>();
      let readyQty = 0, receivingQty = 0, hold = false;
      for (const r of e.rows) {
        const line = lines.get(r.lineKey);
        const unit = line?.unit ?? unitOf(r.unit);
        goodsNames.add(r.productName); units.add(unit);
        if (!seen.has(r.lineKey)) {
          seen.add(r.lineKey);
          addQty(q.loaded, unit, r.loadedQuantity); addQty(q.received, unit, r.receivedQuantity);
          addQty(q.damaged, unit, r.damagedQuantity); addQty(q.shortage, unit, r.shortageQuantity);
          const kg = kgOf(line, r.loadedQuantity);
          if (kg) { derivedGross += kg.gross; derivedNet += kg.net; } else weightKnown = false;
        }
        if (r.stage === "transit") addQty(q.inTransit, unit, r.quantity);
        else if (r.stage === "receiving" || r.stage === "ready") {
          addQty(q.awaiting, unit, r.quantity);
          if (r.stage === "ready") readyQty += r.quantity; else receivingQty += r.quantity;
          if (r.paymentHold) hold = true;
        } else if (r.stage === "available" || r.stage === "reserved" || r.stage === "sold") addQty(q.confirmed, unit, r.quantity);
      }
      const d = e.detail;
      const recorded = d && (d.grossWeight != null || d.netWeight != null);
      const first = e.rows[0];
      const lossy = !isZero(q.damaged) || !isZero(q.shortage);
      const receiving: EntryReceiving = !isZero(q.inTransit) ? (isZero(q.received) && !lossy ? "in_transit" : "partially_received") : lossy ? "received_with_loss" : "received";
      const confirmation: EntryConfirmation = isZero(q.received)
        ? (isZero(q.confirmed) ? "not_received" : "confirmed")
        : isZero(q.awaiting) ? "confirmed"
        : !isZero(q.confirmed) ? "partially_confirmed"
        : readyQty > EPS ? "ready"
        : hold ? "awaiting_payment"
        : receivingQty > EPS ? "awaiting_customs" : "not_received";
      return {
        loadingRecordId,
        entryNo: `${head.systemBillNumber}-${String(i + 1).padStart(2, "0")}`,
        loadingNo: first.loadingRecordNo ?? "",
        date: d?.loadedAt ?? d?.createdAt ?? first.date,
        goods: [...goodsNames].filter(Boolean).join(", "),
        unit: [...units].join(", "),
        ...q,
        gross: r2(recorded ? d!.grossWeight ?? 0 : derivedGross),
        net: r2(recorded ? d!.netWeight ?? 0 : derivedNet),
        weightRecorded: !!recorded,
        truckOrContainer: first.truckOrContainer,
        blNumber: first.blNumber,
        transportMode: d?.transportMode ?? "",
        loadingPlace: d?.loadingPlace ?? "",
        departureDate: d?.departureDate ?? null,
        receivingPlace: d?.receivingPlace ?? "",
        arrivalDate: d?.arrivalDate ?? null,
        arrivalExpected: d?.arrivalExpected ?? false,
        receivedAt: d?.receivedAt ?? null,
        customsStatus: first.customsStatus,
        receiving,
        confirmation,
        weightPartial: !recorded && !weightKnown,
      };
    });

    const pending = sumQty(notLoaded, awaiting);
    const bill: RegisterBill = {
      sourceId,
      purchaseNo: head.systemBillNumber,
      manualNo: head.manualBillNumber && head.manualBillNumber !== "-" && head.manualBillNumber !== head.systemBillNumber ? head.manualBillNumber : "",
      date: head.date,
      countryId: head.countryId,
      countryName: head.countryName,
      countryCode: head.countryCode,
      countryBranchId: head.countryBranchId,
      cityBranchId: head.cityBranchId,
      branchName: head.branchName,
      supplierName: head.supplierName,
      goods: [...lines.values()].map((l) => ({ name: l.name, unit: l.unit, brand: l.brand, size: l.size, booked: l.booked, gross: r2(l.gross), net: r2(l.net) })),
      booked, gross: r2(gross), net: r2(net), loaded, received, inTransit, awaiting, confirmed, sold, notLoaded, pending, damaged, shortage,
      entries,
      status: "booked",
      bookingNo: head.bookingNo,
      invoiceNo: head.invoiceNo,
      origin: head.origin,
      bookingStatus: head.bookingStatus,
      invoiceStatus: head.invoiceStatus,
      invoice: head.invoice ?? null,
      text: [head.systemBillNumber, head.manualBillNumber, head.supplierName, head.countryName, head.branchName, ...[...lines.values()].map((l) => `${l.name} ${l.brand} ${l.size}`), ...entries.flatMap((e) => [e.entryNo, e.loadingNo, e.truckOrContainer, e.blNumber])]
        .filter(Boolean).join(" ").toLowerCase(),
    };
    bill.status = billStatus(bill);
    bills.push(bill);

    // panels
    panels.purchase.bills += 1;
    for (const [u, v] of Object.entries(booked)) addQty(panels.purchase.booked, u, v);
    for (const [u, v] of Object.entries(loaded)) addQty(panels.purchase.loaded, u, v);
    panels.purchase.gross += gross;
    panels.purchase.net += net;
    const ck = `${head.countryId ?? "-"}|${head.cityBranchId ?? head.countryBranchId ?? "-"}`;
    const c = countries.get(ck) ?? { key: ck, countryId: head.countryId, countryName: head.countryName, countryCode: head.countryCode, countryBranchId: head.countryBranchId, cityBranchId: head.cityBranchId, branchName: head.branchName, bills: 0, booked: {}, gross: 0, net: 0 };
    c.bills += 1;
    for (const [u, v] of Object.entries(booked)) addQty(c.booked, u, v);
    c.gross = r2(c.gross + gross);
    c.net = r2(c.net + net);
    countries.set(ck, c);
  }

  // supplier pending = booked - loaded, per unit (never below zero: an over-loaded line is flagged on the bill, not netted against another)
  for (const b of bills) for (const [u, v] of Object.entries(minusQty(b.booked, b.loaded))) if (v > EPS) addQty(panels.purchase.supplierPending, u, v);
  panels.purchase.gross = r2(panels.purchase.gross);
  panels.purchase.net = r2(panels.purchase.net);
  for (const w of Object.values(panels.confirm)) { w.gross = r2(w.gross); w.net = r2(w.net); }
  panels.countries = [...countries.values()].sort((a, b) => a.countryName.localeCompare(b.countryName) || a.branchName.localeCompare(b.branchName));
  bills.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || b.purchaseNo.localeCompare(a.purchaseNo));
  return { bills, panels };
}
