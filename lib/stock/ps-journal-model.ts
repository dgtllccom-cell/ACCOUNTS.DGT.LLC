/**
 * Pure Stock Journal & P/S Journal aggregation model (no database I/O).
 *
 * Powers BOTH:
 *   1. P/S Journal — Purchase & Sales (Issue #263: /dashboard/stock/ps-journal)
 *   2. Journal Booking Stock (/dashboard/purchase/journal-booking-stock)
 *
 * Core Invariants:
 *   - Quantities are ALWAYS tracked per normalized unit (UnitQty = Record<string, number>).
 *     Incompatible units (e.g. BAG vs BOX vs CARTON) are NEVER summed into a single number.
 *   - Booking -> Loading -> Receiving -> Confirmation stages NEVER double-count purchased stock:
 *     each purchase line's booked quantity is partitioned across its loaded chunks + unloaded remainder.
 *   - Partial sales and multiple sales against the same purchase lot/chunk NEVER duplicate purchase
 *     quantities or remaining-stock quantities in row/card/footer totals.
 *   - Reversed confirmations and cancelled/rejected sales orders are excluded before entering this model.
 *   - Negative balances (when recorded sales exceed recorded purchase/loaded quantity) are preserved
 *     verbatim (never clamped to 0) and tagged with an explicit explanation.
 */

import { EPS, q4 } from "@/lib/stock-journal/model";

export type UnitQty = Record<string, number>;

export type StockRoleTier = "super_admin" | "country_admin" | "branch_admin";

export type PsStockStatusFilter =
  | ""
  | "available"
  | "partial"
  | "sold_out"
  | "negative"
  | "in_transit"
  | "not_loaded";

export interface PsAdvancedFilters {
  countryId?: string;
  branchId?: string;
  warehouseId?: string;
  goods?: string;
  origin?: string;
  lot?: string;
  purchaseBill?: string;
  salesBill?: string;
  blNo?: string;
  containerNo?: string;
  stockStatus?: PsStockStatusFilter;
  dateFrom?: string;
  dateTo?: string;
}

export interface PsSaleItem {
  id: string;
  salesOrderId: string | null;
  salesBillNo: string;
  manualBillNo: string;
  saleType: string;
  date: string | null;
  accountNo: string;
  accountName: string;
  blNo: string;
  containerNo: string;
  goodsName: string;
  brand: string;
  size: string;
  origin: string;
  unit: string;
  qty: number;
  grossKg: number;
  netKg: number;
}

export interface PsStockChunk {
  chunkId: string;
  sourceKind: "purchase_booking" | "local_purchase" | "opening_stock" | "unlinked_sale";
  purchaseBillId: string | null;
  purchaseBillNo: string;
  manualBillNo: string;
  purchaseDate: string | null;
  entryRef: string;
  entryTypeLabel: string;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  countryBranchId: string | null;
  cityBranchId: string | null;
  branchId: string | null;
  branchName: string;
  warehouseId: string | null;
  warehouseName: string;
  lotKey: string;
  lotName: string;
  blNo: string;
  containerNo: string;
  supplierAccountNo: string;
  supplierAccountName: string;
  goodsId: string | null;
  goodsName: string;
  brand: string;
  size: string;
  origin: string;
  unit: string;
  purchasedQty: number;
  purchasedGrossKg: number;
  purchasedNetKg: number;
  transferredQty: number;
  transferredGrossKg: number;
  transferredNetKg: number;
  adjustedQty: number;
  adjustedGrossKg: number;
  adjustedNetKg: number;
  inTransitQty: number;
  notLoaded: boolean;
  sales: PsSaleItem[];
}

export interface PsCardSummary {
  bills: number;
  lots: number;
  qtyByUnit: UnitQty;
  grossKg: number;
  netKg: number;
}

export interface PsPlaceSummaryRow {
  key: string;
  countryId: string | null;
  countryName: string;
  branchId: string | null;
  branchName: string;
  branchCount: number;
  pBills: number;
  pQtyByUnit: UnitQty;
  pGrossKg: number;
  pNetKg: number;
  sBills: number;
  sQtyByUnit: UnitQty;
  sGrossKg: number;
  sNetKg: number;
  balQtyByUnit: UnitQty;
  balGrossKg: number;
  balNetKg: number;
}

export interface PsLotRow {
  lotKey: string;
  lotName: string;
  sourceKind: PsStockChunk["sourceKind"];
  countryId: string | null;
  countryName: string;
  branchId: string | null;
  branchName: string;
  warehouseId: string | null;
  warehouseName: string;
  goodsName: string;
  brand: string;
  size: string;
  origin: string;
  purchaseBills: string[];
  salesBills: string[];
  blNos: string[];
  containerNos: string[];
  pQtyByUnit: UnitQty;
  pGrossKg: number;
  pNetKg: number;
  sQtyByUnit: UnitQty;
  sGrossKg: number;
  sNetKg: number;
  transferredQtyByUnit: UnitQty;
  adjustedQtyByUnit: UnitQty;
  balQtyByUnit: UnitQty;
  balGrossKg: number;
  balNetKg: number;
  hasNegativeBalance: boolean;
  negativeReason: string | null;
  status: Exclude<PsStockStatusFilter, "">;
}

export interface PsPurchasedDetailItem {
  chunkId: string;
  entryRef: string;
  purchaseBillNo: string;
  entryType: string;
  date: string | null;
  accountNo: string;
  accountName: string;
  blNo: string;
  containerNo: string;
  goodsName: string;
  size: string;
  brand: string;
  origin: string;
  unit: string;
  qty: number;
  grossKg: number;
  netKg: number;
  transferredQty: number;
  adjustedQty: number;
}

export interface PsLotDetailView {
  lot: PsLotRow;
  purchasedItems: PsPurchasedDetailItem[];
  soldItems: PsSaleItem[];
}

export interface BookingStockSideBySideRow {
  rowId: string;
  purchaseBillId: string;
  purchaseBillNo: string;
  manualBillNo: string;
  purchaseDate: string | null;
  countryId: string | null;
  countryName: string;
  branchId: string | null;
  branchName: string;
  warehouseName: string;
  lotName: string;
  blNo: string;
  containerNo: string;
  goodsName: string;
  brand: string;
  size: string;
  origin: string;
  unit: string;
  pQty: number;
  pGrossKg: number;
  pNetKg: number;
  salesBillDisplay: string;
  salesCount: number;
  salesItems: PsSaleItem[];
  sQty: number;
  sGrossKg: number;
  sNetKg: number;
  transferredQty: number;
  adjustedQty: number;
  remQty: number;
  remGrossKg: number;
  remNetKg: number;
  hasNegativeBalance: boolean;
  status: Exclude<PsStockStatusFilter, "">;
}

const UNIT_ALIASES: Record<string, string> = {
  CARTONS: "CARTON",
  CTN: "CARTON",
  CTNS: "CARTON",
  BAGS: "BAG",
  BALES: "BALE",
  BOXES: "BOX",
  BX: "BOX",
  PIECES: "PCS",
  PIECE: "PCS",
  PC: "PCS",
  KGS: "KG",
  KILOGRAM: "KG",
  KILOGRAMS: "KG",
  TONS: "TON",
  TONNES: "TON",
  TONNE: "TON",
  DRUMS: "DRUM",
  SACKS: "SACK",
  CASES: "CASE",
  PACKS: "PACK",
  ROLLS: "ROLL",
};

export function normalizeStockUnit(raw: string | null | undefined): string {
  const cleaned = String(raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!cleaned || cleaned === "-" || cleaned === "—") return "UNIT";
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

export function addUnitQty(target: UnitQty, unit: string | null | undefined, delta: number): UnitQty {
  if (!Number.isFinite(delta) || Math.abs(delta) <= EPS) return target;
  const u = normalizeStockUnit(unit);
  const next = q4((target[u] ?? 0) + delta);
  if (Math.abs(next) <= EPS) delete target[u];
  else target[u] = next;
  return target;
}

export function mergeUnitQty(...maps: UnitQty[]): UnitQty {
  const out: UnitQty = {};
  for (const m of maps) {
    for (const [u, v] of Object.entries(m || {})) {
      addUnitQty(out, u, v);
    }
  }
  return out;
}

export function formatUnitQty(map: UnitQty | undefined, zeroLabel = "0"): string {
  const entries = Object.entries(map ?? {}).filter(([, v]) => Math.abs(v) > EPS);
  if (entries.length === 0) return zeroLabel;
  return entries
    .map(([u, v]) => {
      const formatted = v.toLocaleString("en-US", { maximumFractionDigits: 2 });
      return u === "UNIT" ? formatted : `${formatted} ${u}`;
    })
    .join(" · ");
}

export function hasNegativeUnit(map: UnitQty | undefined): boolean {
  return Object.values(map ?? {}).some((v) => v < -EPS);
}

export function chunkSoldTotals(chunk: PsStockChunk): { qty: number; grossKg: number; netKg: number } {
  let qty = 0;
  let grossKg = 0;
  let netKg = 0;
  for (const s of chunk.sales) {
    qty = q4(qty + s.qty);
    grossKg = q4(grossKg + s.grossKg);
    netKg = q4(netKg + s.netKg);
  }
  return { qty, grossKg, netKg };
}

export function chunkRemainingTotals(chunk: PsStockChunk): { qty: number; grossKg: number; netKg: number } {
  const sold = chunkSoldTotals(chunk);
  return {
    qty: q4(chunk.purchasedQty - sold.qty - chunk.transferredQty - chunk.adjustedQty),
    grossKg: q4(chunk.purchasedGrossKg - sold.grossKg - chunk.transferredGrossKg - chunk.adjustedGrossKg),
    netKg: q4(chunk.purchasedNetKg - sold.netKg - chunk.transferredNetKg - chunk.adjustedNetKg),
  };
}

export function classifyStockStatus(params: {
  purchasedQty: number;
  soldQty: number;
  remainingQty: number;
  inTransitQty: number;
  notLoaded: boolean;
}): Exclude<PsStockStatusFilter, ""> {
  if (params.remainingQty < -EPS) return "negative";
  if (params.notLoaded && params.soldQty <= EPS) return "not_loaded";
  if (params.remainingQty <= EPS && (params.purchasedQty > EPS || params.soldQty > EPS)) return "sold_out";
  if (params.inTransitQty > EPS && params.soldQty <= EPS) return "in_transit";
  if (params.soldQty > EPS && params.remainingQty > EPS) return "partial";
  return "available";
}

function matchesBranchFilter(
  filterBranchId: string | undefined,
  countryBranchId: string | null,
  cityBranchId: string | null,
  branchId: string | null,
): boolean {
  const f = (filterBranchId ?? "").trim();
  if (!f) return true;
  const raw = f.replace(/^(city:|main:)/, "");
  return branchId === raw || cityBranchId === raw || countryBranchId === raw;
}

function withinDateRange(dateStr: string | null, dateFrom?: string, dateTo?: string): boolean {
  if (!dateFrom && !dateTo) return true;
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (dateFrom && d < dateFrom) return false;
  if (dateTo && d > dateTo) return false;
  return true;
}

/**
 * Filters canonical stock chunks across ALL 13 Advanced Search & Filter fields.
 * Notice: when `salesBill` or `dateFrom`/`dateTo` is set, a chunk matches if either the purchase chunk
 * or one of its linked sales matches; when `salesBill` is specified, only matching sales on that chunk
 * are highlighted in sales totals while keeping the purchase chunk intact (never duplicating purchase qty).
 */
export function applyPsStockFilters(chunks: PsStockChunk[], f: PsAdvancedFilters): PsStockChunk[] {
  const needle = (v?: string) => (v ?? "").trim().toLowerCase();
  const goodsTerm = needle(f.goods);
  const originTerm = needle(f.origin);
  const lotTerm = needle(f.lot);
  const pBillTerm = needle(f.purchaseBill);
  const sBillTerm = needle(f.salesBill);
  const blTerm = needle(f.blNo);
  const contTerm = needle(f.containerNo);

  const result: PsStockChunk[] = [];

  for (const ch of chunks) {
    if (f.countryId && ch.countryId !== f.countryId) continue;
    if (!matchesBranchFilter(f.branchId, ch.countryBranchId, ch.cityBranchId, ch.branchId)) continue;
    if (f.warehouseId && ch.warehouseId !== f.warehouseId) continue;

    if (goodsTerm) {
      const matchGoods =
        ch.goodsId === f.goods ||
        ch.goodsName.toLowerCase().includes(goodsTerm) ||
        ch.sales.some((s) => s.goodsName.toLowerCase().includes(goodsTerm));
      if (!matchGoods) continue;
    }

    if (originTerm) {
      const matchOrigin =
        ch.origin.toLowerCase().includes(originTerm) ||
        ch.sales.some((s) => s.origin.toLowerCase().includes(originTerm));
      if (!matchOrigin) continue;
    }

    if (lotTerm) {
      const matchLot =
        ch.lotName.toLowerCase().includes(lotTerm) ||
        ch.lotKey.toLowerCase().includes(lotTerm) ||
        ch.entryRef.toLowerCase().includes(lotTerm);
      if (!matchLot) continue;
    }

    if (pBillTerm) {
      const matchPBill =
        ch.purchaseBillNo.toLowerCase().includes(pBillTerm) ||
        ch.manualBillNo.toLowerCase().includes(pBillTerm) ||
        ch.entryRef.toLowerCase().includes(pBillTerm);
      if (!matchPBill) continue;
    }

    if (sBillTerm) {
      const matchSBill = ch.sales.some(
        (s) =>
          s.salesBillNo.toLowerCase().includes(sBillTerm) ||
          s.manualBillNo.toLowerCase().includes(sBillTerm),
      );
      if (!matchSBill) continue;
    }

    if (blTerm) {
      const matchBl =
        ch.blNo.toLowerCase().includes(blTerm) ||
        ch.sales.some((s) => s.blNo.toLowerCase().includes(blTerm));
      if (!matchBl) continue;
    }

    if (contTerm) {
      const matchCont =
        ch.containerNo.toLowerCase().includes(contTerm) ||
        ch.sales.some((s) => s.containerNo.toLowerCase().includes(contTerm));
      if (!matchCont) continue;
    }

    if (f.dateFrom || f.dateTo) {
      const pMatch = withinDateRange(ch.purchaseDate, f.dateFrom, f.dateTo);
      const sMatch = ch.sales.some((s) => withinDateRange(s.date, f.dateFrom, f.dateTo));
      if (!pMatch && !sMatch) continue;
    }

    const sold = chunkSoldTotals(ch);
    const rem = chunkRemainingTotals(ch);
    const st = classifyStockStatus({
      purchasedQty: ch.purchasedQty,
      soldQty: sold.qty,
      remainingQty: rem.qty,
      inTransitQty: ch.inTransitQty,
      notLoaded: ch.notLoaded,
    });

    if (f.stockStatus && st !== f.stockStatus) continue;

    result.push(ch);
  }

  return result;
}

/**
 * Builds the Journal Booking Stock view (/dashboard/purchase/journal-booking-stock):
 *   - Purchase Booking chunks only
 *   - 3 upper summary cards (Purchase Booking, Sales Booking, Remaining Stock)
 *   - Side-by-side table rows with partial & multiple sales supported without duplicate stock math
 */
export function buildJournalBookingStockView(allChunks: PsStockChunk[], filters: PsAdvancedFilters) {
  const bookingChunks = allChunks.filter((c) => c.sourceKind === "purchase_booking");
  const filtered = applyPsStockFilters(bookingChunks, filters);

  const pBills = new Set<string>();
  const sBills = new Set<string>();
  const pQtyByUnit: UnitQty = {};
  const sQtyByUnit: UnitQty = {};
  const remQtyByUnit: UnitQty = {};
  let pGrossKg = 0;
  let pNetKg = 0;
  let sGrossKg = 0;
  let sNetKg = 0;
  let remGrossKg = 0;
  let remNetKg = 0;

  const rows: BookingStockSideBySideRow[] = filtered.map((ch) => {
    if (ch.purchaseBillId) pBills.add(ch.purchaseBillId);
    else if (ch.purchaseBillNo && ch.purchaseBillNo !== "—") pBills.add(ch.purchaseBillNo);

    for (const s of ch.sales) {
      const key = s.salesOrderId || s.salesBillNo;
      if (key && key !== "—") sBills.add(key);
    }

    const sold = chunkSoldTotals(ch);
    const rem = chunkRemainingTotals(ch);
    const unit = normalizeStockUnit(ch.unit);

    addUnitQty(pQtyByUnit, unit, ch.purchasedQty);
    addUnitQty(sQtyByUnit, unit, sold.qty);
    addUnitQty(remQtyByUnit, unit, rem.qty);

    pGrossKg = q4(pGrossKg + ch.purchasedGrossKg);
    pNetKg = q4(pNetKg + ch.purchasedNetKg);
    sGrossKg = q4(sGrossKg + sold.grossKg);
    sNetKg = q4(sNetKg + sold.netKg);
    remGrossKg = q4(remGrossKg + rem.grossKg);
    remNetKg = q4(remNetKg + rem.netKg);

    const uniqueSaleBills = [...new Set(ch.sales.map((s) => s.salesBillNo).filter(Boolean))];
    const salesBillDisplay =
      uniqueSaleBills.length === 0
        ? "—"
        : uniqueSaleBills.length === 1
          ? uniqueSaleBills[0]
          : `${uniqueSaleBills[0]} (+${uniqueSaleBills.length - 1})`;

    const status = classifyStockStatus({
      purchasedQty: ch.purchasedQty,
      soldQty: sold.qty,
      remainingQty: rem.qty,
      inTransitQty: ch.inTransitQty,
      notLoaded: ch.notLoaded,
    });

    return {
      rowId: ch.chunkId,
      purchaseBillId: ch.purchaseBillId || ch.chunkId,
      purchaseBillNo: ch.purchaseBillNo || "—",
      manualBillNo: ch.manualBillNo,
      purchaseDate: ch.purchaseDate,
      countryId: ch.countryId,
      countryName: ch.countryName || "—",
      branchId: ch.branchId,
      branchName: ch.branchName || "—",
      warehouseName: ch.warehouseName || "—",
      lotName: ch.lotName || "—",
      blNo: ch.blNo || "—",
      containerNo: ch.containerNo || "—",
      goodsName: ch.goodsName || "—",
      brand: ch.brand || "",
      size: ch.size || "",
      origin: ch.origin || "—",
      unit,
      pQty: ch.purchasedQty,
      pGrossKg: ch.purchasedGrossKg,
      pNetKg: ch.purchasedNetKg,
      salesBillDisplay,
      salesCount: ch.sales.length,
      salesItems: ch.sales,
      sQty: sold.qty,
      sGrossKg: sold.grossKg,
      sNetKg: sold.netKg,
      transferredQty: ch.transferredQty,
      adjustedQty: ch.adjustedQty,
      remQty: rem.qty,
      remGrossKg: rem.grossKg,
      remNetKg: rem.netKg,
      hasNegativeBalance: rem.qty < -EPS || rem.netKg < -EPS,
      status,
    };
  });

  const activeLotCount = new Set(rows.map((r) => r.lotName !== "—" ? r.lotName : r.rowId)).size;

  return {
    cards: {
      purchase: {
        bills: pBills.size,
        lots: activeLotCount,
        qtyByUnit: pQtyByUnit,
        grossKg: pGrossKg,
        netKg: pNetKg,
      } satisfies PsCardSummary,
      sales: {
        bills: sBills.size,
        lots: activeLotCount,
        qtyByUnit: sQtyByUnit,
        grossKg: sGrossKg,
        netKg: sNetKg,
      } satisfies PsCardSummary,
      remaining: {
        bills: pBills.size,
        lots: activeLotCount,
        qtyByUnit: remQtyByUnit,
        grossKg: remGrossKg,
        netKg: remNetKg,
      } satisfies PsCardSummary,
    },
    rows,
  };
}

/**
 * Builds the P/S Journal — Purchase & Sales view (Issue #263: /dashboard/stock/ps-journal):
 *   - 3 upper summary cards (Total Purchase Bills, Total Sales Bills, Remaining Stock)
 *   - Country Wise & Branch Wise Summary tables
 *   - Lot Wise Stock Register (every Lot Name clickable)
 */
export function buildPsJournalView(allChunks: PsStockChunk[], filters: PsAdvancedFilters) {
  // Group into lots first, then apply lot-level status filter accurately so multi-chunk lots stay coherent
  const { stockStatus, ...chunkFilters } = filters;
  const preFiltered = applyPsStockFilters(allChunks, chunkFilters);

  const byLot = new Map<string, PsStockChunk[]>();
  for (const ch of preFiltered) {
    const key = ch.lotKey;
    const arr = byLot.get(key) ?? [];
    arr.push(ch);
    byLot.set(key, arr);
  }

  const allLotRows: PsLotRow[] = [];
  const keptChunks: PsStockChunk[] = [];

  for (const [lotKey, list] of byLot.entries()) {
    const head = list[0];
    const pQtyByUnit: UnitQty = {};
    const sQtyByUnit: UnitQty = {};
    const transferredQtyByUnit: UnitQty = {};
    const adjustedQtyByUnit: UnitQty = {};
    const balQtyByUnit: UnitQty = {};

    let pGrossKg = 0;
    let pNetKg = 0;
    let sGrossKg = 0;
    let sNetKg = 0;
    let balGrossKg = 0;
    let balNetKg = 0;
    let totalPQty = 0;
    let totalSQty = 0;
    let totalRemQty = 0;
    let totalInTransit = 0;
    let allNotLoaded = true;

    const pBillsSet = new Set<string>();
    const sBillsSet = new Set<string>();
    const blSet = new Set<string>();
    const contSet = new Set<string>();
    const goodsNames = new Set<string>();
    const origins = new Set<string>();

    for (const ch of list) {
      const u = normalizeStockUnit(ch.unit);
      const sold = chunkSoldTotals(ch);
      const rem = chunkRemainingTotals(ch);

      addUnitQty(pQtyByUnit, u, ch.purchasedQty);
      addUnitQty(sQtyByUnit, u, sold.qty);
      addUnitQty(transferredQtyByUnit, u, ch.transferredQty);
      addUnitQty(adjustedQtyByUnit, u, ch.adjustedQty);
      addUnitQty(balQtyByUnit, u, rem.qty);

      pGrossKg = q4(pGrossKg + ch.purchasedGrossKg);
      pNetKg = q4(pNetKg + ch.purchasedNetKg);
      sGrossKg = q4(sGrossKg + sold.grossKg);
      sNetKg = q4(sNetKg + sold.netKg);
      balGrossKg = q4(balGrossKg + rem.grossKg);
      balNetKg = q4(balNetKg + rem.netKg);

      totalPQty = q4(totalPQty + ch.purchasedQty);
      totalSQty = q4(totalSQty + sold.qty);
      totalRemQty = q4(totalRemQty + rem.qty);
      totalInTransit = q4(totalInTransit + ch.inTransitQty);
      if (!ch.notLoaded) allNotLoaded = false;

      if (ch.purchaseBillNo && ch.purchaseBillNo !== "—") pBillsSet.add(ch.purchaseBillNo);
      for (const s of ch.sales) {
        if (s.salesBillNo && s.salesBillNo !== "—") sBillsSet.add(s.salesBillNo);
        if (s.blNo) blSet.add(s.blNo);
        if (s.containerNo) contSet.add(s.containerNo);
      }
      if (ch.blNo) blSet.add(ch.blNo);
      if (ch.containerNo) contSet.add(ch.containerNo);
      if (ch.goodsName && ch.goodsName !== "—") goodsNames.add(ch.goodsName);
      if (ch.origin && ch.origin !== "—") origins.add(ch.origin);
    }

    const neg = hasNegativeUnit(balQtyByUnit) || balNetKg < -EPS || balGrossKg < -EPS;
    const status = classifyStockStatus({
      purchasedQty: totalPQty,
      soldQty: totalSQty,
      remainingQty: neg ? -1 : totalRemQty,
      inTransitQty: totalInTransit,
      notLoaded: allNotLoaded,
    });

    if (stockStatus && status !== stockStatus) continue;

    let negativeReason: string | null = null;
    if (neg) {
      negativeReason =
        head.sourceKind === "unlinked_sale"
          ? "Direct/unlinked sales recorded without an assigned purchase lot."
          : "Recorded sales or stock issues exceed the recorded purchased/loaded quantity on this lot.";
    }

    allLotRows.push({
      lotKey,
      lotName: head.lotName || lotKey,
      sourceKind: head.sourceKind,
      countryId: head.countryId,
      countryName: head.countryName || "—",
      branchId: head.branchId,
      branchName: head.branchName || "—",
      warehouseId: head.warehouseId,
      warehouseName: head.warehouseName || "—",
      goodsName: [...goodsNames].join(", ") || head.goodsName || "—",
      brand: head.brand || "",
      size: head.size || "",
      origin: [...origins].join(", ") || head.origin || "—",
      purchaseBills: [...pBillsSet],
      salesBills: [...sBillsSet],
      blNos: [...blSet],
      containerNos: [...contSet],
      pQtyByUnit,
      pGrossKg,
      pNetKg,
      sQtyByUnit,
      sGrossKg,
      sNetKg,
      transferredQtyByUnit,
      adjustedQtyByUnit,
      balQtyByUnit,
      balGrossKg,
      balNetKg,
      hasNegativeBalance: neg,
      negativeReason,
      status,
    });

    keptChunks.push(...list);
  }

  // Compute global 3 summary cards & Country / Branch summaries from keptChunks (exact, deduplicated)
  const globalPBills = new Set<string>();
  const globalSBills = new Set<string>();
  const globalPQty: UnitQty = {};
  const globalSQty: UnitQty = {};
  const globalBalQty: UnitQty = {};
  let globalPGross = 0;
  let globalPNet = 0;
  let globalSGross = 0;
  let globalSNet = 0;
  let globalBalGross = 0;
  let globalBalNet = 0;

  type PlaceAccum = {
    countryId: string | null;
    countryName: string;
    branchId: string | null;
    branchName: string;
    branches: Set<string>;
    pBills: Set<string>;
    sBills: Set<string>;
    pQtyByUnit: UnitQty;
    sQtyByUnit: UnitQty;
    balQtyByUnit: UnitQty;
    pGrossKg: number;
    pNetKg: number;
    sGrossKg: number;
    sNetKg: number;
    balGrossKg: number;
    balNetKg: number;
  };

  const countryMap = new Map<string, PlaceAccum>();
  const branchMap = new Map<string, PlaceAccum>();

  const touchPlace = (map: Map<string, PlaceAccum>, key: string, init: Omit<PlaceAccum, "branches" | "pBills" | "sBills" | "pQtyByUnit" | "sQtyByUnit" | "balQtyByUnit" | "pGrossKg" | "pNetKg" | "sGrossKg" | "sNetKg" | "balGrossKg" | "balNetKg">) => {
    let acc = map.get(key);
    if (!acc) {
      acc = {
        ...init,
        branches: new Set<string>(),
        pBills: new Set<string>(),
        sBills: new Set<string>(),
        pQtyByUnit: {},
        sQtyByUnit: {},
        balQtyByUnit: {},
        pGrossKg: 0,
        pNetKg: 0,
        sGrossKg: 0,
        sNetKg: 0,
        balGrossKg: 0,
        balNetKg: 0,
      };
      map.set(key, acc);
    }
    return acc;
  };

  for (const ch of keptChunks) {
    const u = normalizeStockUnit(ch.unit);
    const sold = chunkSoldTotals(ch);
    const rem = chunkRemainingTotals(ch);

    if (ch.purchaseBillId) globalPBills.add(ch.purchaseBillId);
    else if (ch.purchaseBillNo && ch.purchaseBillNo !== "—") globalPBills.add(ch.purchaseBillNo);

    for (const s of ch.sales) {
      const sk = s.salesOrderId || s.salesBillNo;
      if (sk && sk !== "—") globalSBills.add(sk);
    }

    addUnitQty(globalPQty, u, ch.purchasedQty);
    addUnitQty(globalSQty, u, sold.qty);
    addUnitQty(globalBalQty, u, rem.qty);
    globalPGross = q4(globalPGross + ch.purchasedGrossKg);
    globalPNet = q4(globalPNet + ch.purchasedNetKg);
    globalSGross = q4(globalSGross + sold.grossKg);
    globalSNet = q4(globalSNet + sold.netKg);
    globalBalGross = q4(globalBalGross + rem.grossKg);
    globalBalNet = q4(globalBalNet + rem.netKg);

    const cKey = ch.countryId || ch.countryName || "global";
    const bKey = `${cKey}|${ch.branchId || ch.branchName || "main"}`;

    const cAcc = touchPlace(countryMap, cKey, {
      countryId: ch.countryId,
      countryName: ch.countryName || "—",
      branchId: null,
      branchName: "—",
    });
    const bAcc = touchPlace(branchMap, bKey, {
      countryId: ch.countryId,
      countryName: ch.countryName || "—",
      branchId: ch.branchId,
      branchName: ch.branchName || "—",
    });

    if (ch.branchId || ch.branchName) cAcc.branches.add(ch.branchId || ch.branchName);
    bAcc.branches.add(ch.branchId || ch.branchName || "main");

    for (const acc of [cAcc, bAcc]) {
      if (ch.purchaseBillId) acc.pBills.add(ch.purchaseBillId);
      else if (ch.purchaseBillNo && ch.purchaseBillNo !== "—") acc.pBills.add(ch.purchaseBillNo);

      for (const s of ch.sales) {
        const sk = s.salesOrderId || s.salesBillNo;
        if (sk && sk !== "—") acc.sBills.add(sk);
      }

      addUnitQty(acc.pQtyByUnit, u, ch.purchasedQty);
      addUnitQty(acc.sQtyByUnit, u, sold.qty);
      addUnitQty(acc.balQtyByUnit, u, rem.qty);
      acc.pGrossKg = q4(acc.pGrossKg + ch.purchasedGrossKg);
      acc.pNetKg = q4(acc.pNetKg + ch.purchasedNetKg);
      acc.sGrossKg = q4(acc.sGrossKg + sold.grossKg);
      acc.sNetKg = q4(acc.sNetKg + sold.netKg);
      acc.balGrossKg = q4(acc.balGrossKg + rem.grossKg);
      acc.balNetKg = q4(acc.balNetKg + rem.netKg);
    }
  }

  const toPlaceRows = (map: Map<string, PlaceAccum>): PsPlaceSummaryRow[] =>
    [...map.entries()]
      .map(([key, a]) => ({
        key,
        countryId: a.countryId,
        countryName: a.countryName,
        branchId: a.branchId,
        branchName: a.branchName,
        branchCount: Math.max(1, a.branches.size),
        pBills: a.pBills.size,
        pQtyByUnit: a.pQtyByUnit,
        pGrossKg: a.pGrossKg,
        pNetKg: a.pNetKg,
        sBills: a.sBills.size,
        sQtyByUnit: a.sQtyByUnit,
        sGrossKg: a.sGrossKg,
        sNetKg: a.sNetKg,
        balQtyByUnit: a.balQtyByUnit,
        balGrossKg: a.balGrossKg,
        balNetKg: a.balNetKg,
      }))
      .sort((x, y) => x.countryName.localeCompare(y.countryName) || x.branchName.localeCompare(y.branchName));

  return {
    cards: {
      purchase: {
        bills: globalPBills.size,
        lots: allLotRows.length,
        qtyByUnit: globalPQty,
        grossKg: globalPGross,
        netKg: globalPNet,
      } satisfies PsCardSummary,
      sales: {
        bills: globalSBills.size,
        lots: allLotRows.length,
        qtyByUnit: globalSQty,
        grossKg: globalSGross,
        netKg: globalSNet,
      } satisfies PsCardSummary,
      balance: {
        bills: globalPBills.size,
        lots: allLotRows.length,
        qtyByUnit: globalBalQty,
        grossKg: globalBalGross,
        netKg: globalBalNet,
      } satisfies PsCardSummary,
    },
    countrySummary: toPlaceRows(countryMap),
    branchSummary: toPlaceRows(branchMap),
    lots: allLotRows,
  };
}

/**
 * Builds the Lot Detail drilldown (Summary on left, Purchased Items above Sold Items on right).
 */
export function buildPsLotDetailView(
  allChunks: PsStockChunk[],
  lotKey: string,
  detailFilters?: { search?: string; dateFrom?: string; dateTo?: string },
): PsLotDetailView | null {
  const matching = allChunks.filter((c) => c.lotKey === lotKey || c.lotName === lotKey);
  if (matching.length === 0) return null;

  const { lots } = buildPsJournalView(matching, {});
  const lot = lots[0];
  if (!lot) return null;

  const q = (detailFilters?.search ?? "").trim().toLowerCase();
  const df = detailFilters?.dateFrom;
  const dt = detailFilters?.dateTo;

  const purchasedItems: PsPurchasedDetailItem[] = matching
    .filter((ch) => ch.sourceKind !== "unlinked_sale")
    .map((ch) => ({
      chunkId: ch.chunkId,
      entryRef: ch.entryRef || ch.purchaseBillNo || "—",
      purchaseBillNo: ch.purchaseBillNo || "—",
      entryType: ch.entryTypeLabel,
      date: ch.purchaseDate,
      accountNo: ch.supplierAccountNo || "—",
      accountName: ch.supplierAccountName || "—",
      blNo: ch.blNo || "—",
      containerNo: ch.containerNo || "—",
      goodsName: ch.goodsName || "—",
      size: ch.size || "—",
      brand: ch.brand || "—",
      origin: ch.origin || "—",
      unit: normalizeStockUnit(ch.unit),
      qty: ch.purchasedQty,
      grossKg: ch.purchasedGrossKg,
      netKg: ch.purchasedNetKg,
      transferredQty: ch.transferredQty,
      adjustedQty: ch.adjustedQty,
    }))
    .filter((item) => {
      if (!withinDateRange(item.date, df, dt)) return false;
      if (!q) return true;
      return [
        item.entryRef,
        item.purchaseBillNo,
        item.entryType,
        item.accountNo,
        item.accountName,
        item.blNo,
        item.containerNo,
        item.goodsName,
        item.brand,
        item.size,
        item.origin,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

  const soldItems: PsSaleItem[] = matching
    .flatMap((ch) => ch.sales)
    .filter((s) => {
      if (!withinDateRange(s.date, df, dt)) return false;
      if (!q) return true;
      return [
        s.salesBillNo,
        s.manualBillNo,
        s.saleType,
        s.accountNo,
        s.accountName,
        s.blNo,
        s.containerNo,
        s.goodsName,
        s.brand,
        s.size,
        s.origin,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

  return {
    lot,
    purchasedItems,
    soldItems,
  };
}
