/**
 * Stock Journal service — the read model and the three authorized stock events behind
 * /dashboard/purchase/stock/*  (Purchase Booking & Local Purchase → Loading → Receiving & Customs → Confirm Stock → Sale / Export).
 *
 * REUSE, NOT A SECOND STOCK SYSTEM
 *   - bookings / loadings / receiving  : purchase_orders, purchase_loading_records (+ the existing Destination Receiving route)
 *   - physical warehouse stock         : product_inventory_balances + stock_movements (stockInToWarehouse, same tables as Inventory)
 *   - Local Purchase goods             : purchase_lots + lot_stock (Goods Transfer Journal) — read here, confirmed THERE
 *   - authorization decisions           : journal_stock_transfers (the confirmation ledger; one row per decision)
 *
 * SAFETY
 *   - every write runs in one transaction that first locks the booking row, so two clicks / two users serialize;
 *   - confirm is idempotent (unique idempotency key) and can never exceed what is received − already confirmed;
 *   - reservation (export / direct sale) is held in product_inventory_balances.quantity_reserved, so the normal Sales wizard
 *     (which offers quantity_available) can never sell the same stock twice;
 *   - physical stock leaves ONLY on an explicit Goods Issue / Dispatch / Delivery (issue) — once; negative stock is refused.
 */
import type { ErpSession } from "@/lib/auth/session";
import { ApiClientError } from "@/lib/api/response";
import { ErpPermissionError, hasRolePermission, isGlobalSession } from "@/lib/permissions/middleware";
import {
  assertExplicitScopeAllowed,
  authorizeApiScope,
  recordInSessionScope,
  sessionSqlScope,
  sqlScopeCondition,
} from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { recordAuditEvent } from "@/lib/audit/enterprise-audit-service";
import { stockInToWarehouse } from "@/lib/services/purchase-warehouse-stock";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import {
  EPS,
  allocateLoadings,
  confirmableQuantity,
  confirmationStage,
  extractPoGoodsLines,
  isCustomsOk,
  parseJsonish,
  q4,
  type Chunk,
  type ConfirmationFact,
  type CustomsStatus,
  type DestinationType,
  type GoodsLine,
  type LoadingFact,
  type StockStage,
} from "@/lib/stock-journal/model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const iso = (v: unknown) => (v ? new Date(v as any).toISOString() : null);

/**
 * Authorization for every Stock Journal ACTION: the role must hold purchases:<action> AND the record must lie inside the caller's scope
 * by the SAME rule the list uses (recordInSessionScope = sqlScopeCondition), so a row a user can see is a row they can act on — and a row
 * outside their country / branch can be neither seen nor touched. A Country-to-Country booking is also in scope for its destination side.
 */
export function assertRecordAccess(session: ErpSession, action: "read" | "update", rec: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }, dest?: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null } | null) {
  if (!hasRolePermission(session, "purchases", action)) throw new ErpPermissionError(`Missing permission: purchases:${action}`);
  if (isGlobalSession(session)) return;
  const destSet = !!dest && !!(dest.country_id || dest.country_branch_id || dest.city_branch_id);
  if (recordInSessionScope(session, rec) || (destSet && recordInSessionScope(session, dest))) return;
  throw new ErpPermissionError("This record is outside your authorized country / branch scope.");
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Row shape shared with the dashboard
// ──────────────────────────────────────────────────────────────────────────────────────────────

export type PaymentState = "paid" | "partial" | "unpaid";

export interface StockJournalRow {
  id: string;
  sourceType: "purchase_booking" | "local_purchase";
  sourceId: string;
  lineKey: string;
  stage: StockStage;
  billNumber: string;
  systemBillNumber: string;
  manualBillNumber: string;
  date: string | null;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  countryBranchId: string | null;
  cityBranchId: string | null;
  branchName: string;
  supplierName: string;
  productName: string;
  /** Goods master id when known — used only to show the product name in the viewer's language */
  goodsId: string | null;
  brand: string;
  size: string;
  unit: string;
  currencyCode: string;
  /** quantity held by THIS row (its stage) */
  quantity: number;
  bookedQuantity: number;
  loadedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  shortageQuantity: number;
  outstandingQuantity: number;
  origin: string;
  grossWeight: number;
  netWeight: number;
  bookingNo: string;
  invoiceNo: string;
  shipDetails: string;
  bookingStatus: "draft" | "confirmed";
  invoiceStatus: "posted" | "unposted";
  paymentStatus: PaymentState;
  customsStatus: CustomsStatus;
  truckOrContainer: string;
  loadingRecordId: string | null;
  loadingRecordNo: string | null;
  blNumber: string;
  warehouseId: string | null;
  warehouseName: string | null;
  transferId: string | null;
  transferNo: string | null;
  destinationType: DestinationType | null;
  customerName: string | null;
  salesOrderNo: string | null;
  documentRef: string | null;
  issueType: string | null;
  confirmedAt: string | null;
  issuedAt: string | null;
  quantityNotEntered: boolean;
  legacyReceived: boolean;
  overLoaded: boolean;
  canConfirm: boolean;
  canIssue: boolean;
  canReverse: boolean;
  /** Local Purchase stock is confirmed in its own Goods Transfer Journal */
  goodsTransferHref: string | null;
}

export type CardTotals = { lines: number; qty: number; byUnit: Record<string, number> };
export interface StockJournalSummary {
  booking: CardTotals;
  confirmedBooking: CardTotals;
  transit: CardTotals;
  receivingCustoms: CardTotals;
  readyForConfirmation: CardTotals;
  availableMixed: CardTotals;
  reserved: CardTotals;
  soldExported: CardTotals;
  totalBills: number;
}

export type JournalFilters = {
  stage: "all" | "booking" | "confirmed_booking" | "transit" | "receiving" | "ready" | "available" | "sold" | "reserved";
  destination?: DestinationType;
  sourceType?: "all" | "purchase_booking" | "local_purchase";
  search?: string;
  goodsName?: string;
  purchaseOrderNo?: string;
  containerNo?: string;
  warehouseId?: string;
  countryId?: string;
  countryBranchId?: string;
  cityBranchId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
  /** viewer language: product / warehouse NAMES are shown in it (stored names are never changed) */
  lang?: SupportedLanguage;
};

const emptyCard = (): CardTotals => ({ lines: 0, qty: 0, byUnit: {} });
function addCard(card: CardTotals, row: StockJournalRow) {
  card.lines += 1;
  card.qty = q4(card.qty + row.quantity);
  const u = row.unit || "—";
  card.byUnit[u] = q4((card.byUnit[u] ?? 0) + row.quantity);
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Customs: the loading record's own status wins; otherwise the Clearing order leg that carries the same container / B/L
// ──────────────────────────────────────────────────────────────────────────────────────────────

async function clearingCustoms(sql: Tx, plrs: any[]) {
  const containers = [...new Set(plrs.map((p) => String(p.container_number || "").trim().toUpperCase()).filter(Boolean))];
  const bls = [...new Set(plrs.map((p) => String(p.bl_number || "").trim().toUpperCase()).filter(Boolean))];
  const byKey = new Map<string, CustomsStatus>();
  if (containers.length === 0 && bls.length === 0) return byKey;
  const legs = await sql`
    select upper(coalesce(l.container_number,'')) as container, upper(coalesce(l.bl_number,'')) as bl, l.customs_status
    from public.clearing_customer_order_legs l
    where l.deleted_at is null and l.customs_status is not null
      and (upper(coalesce(l.container_number,'')) = any(${containers}::text[]) or upper(coalesce(l.bl_number,'')) = any(${bls}::text[]))`;
  const rank: Record<string, number> = { pending: 4, submitted: 3, cleared: 2, not_applicable: 1 };
  const put = (k: string, s: string) => {
    if (!k) return;
    const cur = byKey.get(k);
    if (!cur || (rank[s] ?? 0) > (rank[cur] ?? 0)) byKey.set(k, s as CustomsStatus);
  };
  for (const l of legs) {
    put("c:" + l.container, l.customs_status);
    put("b:" + l.bl, l.customs_status);
  }
  return byKey;
}

function customsFor(p: any, clearing: Map<string, CustomsStatus>): { status: CustomsStatus; source: LoadingFact["customsSource"] } {
  if (p.customs_status) return { status: p.customs_status as CustomsStatus, source: "loading_record" };
  const c = clearing.get("c:" + String(p.container_number || "").trim().toUpperCase());
  if (c) return { status: c, source: "clearing_order" };
  const b = clearing.get("b:" + String(p.bl_number || "").trim().toUpperCase());
  if (b) return { status: b, source: "clearing_order" };
  return { status: "not_recorded", source: "none" };
}

function toLoadingFact(p: any, clearing: Map<string, CustomsStatus>): LoadingFact {
  const c = customsFor(p, clearing);
  return {
    id: p.id,
    no: p.loading_record_no || "",
    containerNo: p.container_number || "",
    vehicleNo: p.vehicle_no || "",
    blNumber: p.bl_number || "",
    createdAt: iso(p.created_at) || "",
    loadedAt: iso(p.loaded_at),
    loaded: num(p.loaded_quantity),
    received: p.received_quantity == null ? null : num(p.received_quantity),
    damaged: num(p.damaged_quantity),
    shortage: num(p.shortage_quantity),
    loadingStatus: p.loading_status || "",
    receivingWarehouseId: p.receiving_warehouse_id || null,
    receivingGoodsId: p.receiving_goods_id || null,
    customsStatus: c.status,
    customsSource: c.source,
    payload: p.report_payload,
  };
}

function toConfirmationFact(r: any): ConfirmationFact {
  return {
    id: r.id,
    transferNo: r.transfer_no,
    loadingRecordId: r.loading_record_id || null,
    lineKey: r.line_key || null,
    goodsName: r.goods_name || "",
    destinationType: r.destination_type,
    status: r.status,
    reserved: !!r.reserved,
    quantity: num(r.quantity),
    warehouseId: r.warehouse_id || null,
    customerName: r.customer_name || null,
    salesOrderNo: r.sales_order_no || null,
    documentRef: r.document_ref || null,
    issueType: r.issue_type || null,
    issuedAt: iso(r.issued_at),
    confirmedAt: iso(r.confirmed_at),
    referenceNo: r.reference_no || null,
  };
}

const paymentFromPo = (s: unknown): PaymentState => {
  const v = String(s || "").toLowerCase();
  if (["completed", "paid", "settled", "closed"].includes(v)) return "paid";
  if (["partial", "partially_paid", "partially paid"].includes(v)) return "partial";
  return "unpaid";
};

/**
 * Product and warehouse NAMES are master data: they are shown in the viewer's language through the same record-translation
 * layer the rest of the ERP uses. The stored names are never touched; anything without a translation keeps its stored text.
 */
async function localizeNames(rows: StockJournalRow[], warehouses: any[], lang?: SupportedLanguage) {
  if (!lang) return;
  try {
    // goods: by id when the line carries one, otherwise by exact (case-insensitive) master name
    const byName = [...new Set(rows.filter((r) => !r.goodsId && r.productName).map((r) => r.productName.trim().toLowerCase()))];
    const nameToId = new Map<string, string>();
    if (byName.length) {
      const found = await withLocalPg((sql) => sql`select id, lower(goods_name) as n from public.goods where deleted_at is null and lower(goods_name) = any(${byName}::text[])`);
      const count = new Map<string, number>();
      for (const g of found ?? []) count.set(g.n, (count.get(g.n) ?? 0) + 1);
      for (const g of found ?? []) if (count.get(g.n) === 1) nameToId.set(g.n, g.id);
    }
    const goodsRecords = new Map<string, { id: string; goods_name: string }>();
    for (const r of rows) {
      const id = r.goodsId || nameToId.get(r.productName.trim().toLowerCase());
      if (id && r.productName) goodsRecords.set(id, { id, goods_name: r.productName });
    }
    const goodsLocal = await localizeRecordNames([...goodsRecords.values()], "goods", "goods_name", lang);
    const goodsName = new Map(goodsLocal.map((g) => [g.id, g.goods_name]));
    for (const r of rows) {
      const id = r.goodsId || nameToId.get(r.productName.trim().toLowerCase());
      if (id && goodsName.get(id)) r.productName = goodsName.get(id)!;
    }
    // warehouses
    const whLocal = await localizeRecordNames(warehouses.map((w: any) => ({ id: w.id, warehouse_name: w.warehouse_name })), "warehouses", "warehouse_name", lang);
    const whName = new Map(whLocal.map((w) => [w.id, w.warehouse_name]));
    for (const w of warehouses) if (whName.get(w.id)) w.warehouse_name = whName.get(w.id);
    for (const r of rows) if (r.warehouseId && whName.get(r.warehouseId)) r.warehouseName = whName.get(r.warehouseId)!;
  } catch {
    // translation is a courtesy; the stored names stay
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// READ MODEL
// ──────────────────────────────────────────────────────────────────────────────────────────────

export async function loadStockJournal(session: ErpSession, f: JournalFilters) {
  assertExplicitScopeAllowed(session, { countryId: f.countryId, countryBranchId: f.countryBranchId, cityBranchId: f.cityBranchId });
  authorizeApiScope(session, { resource: "purchases", action: "read", countryId: f.countryId ?? null, countryBranchId: f.countryBranchId ?? null, cityBranchId: f.cityBranchId ?? null });
  const mayAct = (a: string) => {
    try {
      authorizeApiScope(session, { resource: "purchases", action: a });
      return true;
    } catch {
      return false;
    }
  };
  const perms = { confirm: mayAct("update"), issue: mayAct("update"), reverse: mayAct("update") };

  const data = await withLocalPg(async (sql) => {
    const scope = sessionSqlScope(session);
    const poScope = sql`(${sqlScopeCondition(sql, scope, "po")} OR ${sqlScopeCondition(sql, scope, "po", { prefix: "dest_" })})`;
    const lpScope = sqlScopeCondition(sql, scope, "lp");
    const range = (col: string) => sql`${f.dateFrom ? sql`${sql.unsafe(col)} >= ${f.dateFrom}::timestamptz` : sql`true`} AND ${f.dateTo ? sql`${sql.unsafe(col)} <= ${f.dateTo + "T23:59:59.999Z"}::timestamptz` : sql`true`}`;
    const poPlace = sql`${f.cityBranchId ? sql`(po.city_branch_id = ${f.cityBranchId}::uuid OR po.dest_city_branch_id = ${f.cityBranchId}::uuid)` : sql`true`}
      AND ${!f.cityBranchId && f.countryBranchId ? sql`(po.country_branch_id = ${f.countryBranchId}::uuid OR po.dest_country_branch_id = ${f.countryBranchId}::uuid)` : sql`true`}
      AND ${!f.cityBranchId && !f.countryBranchId && f.countryId ? sql`(po.country_id = ${f.countryId}::uuid OR po.dest_country_id = ${f.countryId}::uuid)` : sql`true`}`;
    const lpPlace = sql`${f.cityBranchId ? sql`lp.city_branch_id = ${f.cityBranchId}::uuid` : sql`true`}
      AND ${!f.cityBranchId && f.countryBranchId ? sql`lp.country_branch_id = ${f.countryBranchId}::uuid` : sql`true`}
      AND ${!f.cityBranchId && !f.countryBranchId && f.countryId ? sql`lp.country_id = ${f.countryId}::uuid` : sql`true`}`;

    // every booking in scope — Draft / Pending / zero-quantity included (they are Booking Stock)
    const pos = await sql`
      select po.id, po.purchase_order_no, po.purchase_contract_no, po.country_id, po.country_branch_id, po.city_branch_id,
             po.status, po.ledger_posting_status, po.payment_status, po.purchase_currency, po.currency_code, po.form_data, po.created_at,
             c.name as country_name, c.iso2 as country_code, cb.name as country_branch_name, cib.city_name as city_branch_name
      from public.purchase_orders po
      left join public.countries c on c.id = po.country_id
      left join public.country_branches cb on cb.id = po.country_branch_id
      left join public.city_branches cib on cib.id = po.city_branch_id
      where po.deleted_at is null and ${poScope} and ${poPlace} and ${range("po.created_at")}
      order by po.created_at desc limit 3000`;
    const poIds = pos.map((p: any) => p.id);

    const plrs = poIds.length
      ? await sql`
          select plr.id, plr.purchase_order_id, plr.loading_record_no, plr.container_number, plr.bl_number, plr.vehicle_no, plr.truck_id,
                 plr.loading_status, plr.loaded_at, plr.created_at, plr.loaded_quantity, plr.received_quantity, plr.damaged_quantity,
                 plr.shortage_quantity, plr.customs_status, plr.receiving_warehouse_id, plr.receiving_goods_id, plr.report_payload
          from public.purchase_loading_records plr
          where plr.deleted_at is null and plr.purchase_order_id = any(${poIds}::uuid[])
          order by plr.created_at asc, plr.id asc`
      : [];
    const clearing = await clearingCustoms(sql, plrs);

    const lps = await sql`
      select lp.id, lp.goods_id, lp.goods_name, lp.supplier_name, lp.quantity_name, lp.quantity_kgs, lp.numbers, lp.purchase_currency, lp.final_cost,
             lp.status, lp.manual_bill_no, lp.contract_no, lp.brand, lp.size, lp.country_id, lp.country_branch_id, lp.city_branch_id,
             lp.created_at, lp.line_items, lp.truck_no, lp.warehouse_id,
             c.name as country_name, c.iso2 as country_code, cb.name as country_branch_name, cib.city_name as city_branch_name,
             coalesce((select sum(pay.amount) from public.purchase_order_payments pay where pay.local_purchase_id = lp.id and pay.deleted_at is null and coalesce(pay.status::text,'') not in ('cancelled','reversed','void','draft')), 0) as paid
      from public.local_purchases lp
      left join public.countries c on c.id = lp.country_id
      left join public.country_branches cb on cb.id = lp.country_branch_id
      left join public.city_branches cib on cib.id = lp.city_branch_id
      where lp.deleted_at is null and ${lpScope} and ${lpPlace} and ${range("lp.created_at")}
      order by lp.created_at desc limit 3000`;
    const lpIds = lps.map((l: any) => l.id);
    const lots = lpIds.length
      ? await sql`
          select l.id, l.lot_ref, l.local_purchase_id, l.goods_name, l.goods_id, l.unit_name, l.qty_purchased, l.brand, l.size, l.status
          from public.purchase_lots l where l.local_purchase_id = any(${lpIds}::uuid[])`
      : [];
    const lotIds = lots.map((l: any) => l.id);
    const lotStock = lotIds.length
      ? await sql`select ls.lot_id, ls.state, ls.warehouse_id, ls.qty from public.lot_stock ls where ls.lot_id = any(${lotIds}::uuid[]) and ls.qty > 0`
      : [];

    const confs = poIds.length || lpIds.length
      ? await sql`
          select jst.*, p.full_name as confirmed_by_name
          from public.journal_stock_transfers jst left join public.profiles p on p.id = jst.confirmed_by
          where jst.deleted_at is null
            and (jst.purchase_order_id = any(${poIds}::uuid[]) or jst.local_purchase_id = any(${lpIds}::uuid[]))`
      : [];

    const warehouses = await sql`
      select w.id, w.warehouse_name, w.warehouse_code, w.country_id, w.warehouse_type
      from public.warehouses w
      where w.deleted_at is null and coalesce(w.is_active, true) = true
        and ${scope.kind === "all" ? sql`true` : scope.kind === "none" ? sql`false` : sql`(w.country_id is null or w.country_id = any(${session.countryIds ?? []}::uuid[]))`}
      order by w.warehouse_name asc`;
    return { pos, plrs, clearing, lps, lots, lotStock, confs, warehouses };
  });
  if (!data) throw new Error("Unable to load the stock database.");

  const whName = new Map<string, string>(data.warehouses.map((w: any) => [w.id, w.warehouse_name]));
  const rows: StockJournalRow[] = [];

  // ── Purchase Bookings ──
  const plrByPo = new Map<string, any[]>();
  for (const p of data.plrs) (plrByPo.get(p.purchase_order_id) ?? plrByPo.set(p.purchase_order_id, []).get(p.purchase_order_id)!).push(p);
  const confByPo = new Map<string, ConfirmationFact[]>();
  const confByLp = new Map<string, any[]>();
  const confRaw = new Map<string, any>();
  for (const c of data.confs) {
    confRaw.set(c.id, c);
    if (c.purchase_order_id) (confByPo.get(c.purchase_order_id) ?? confByPo.set(c.purchase_order_id, []).get(c.purchase_order_id)!).push(toConfirmationFact(c));
    if (c.local_purchase_id) (confByLp.get(c.local_purchase_id) ?? confByLp.set(c.local_purchase_id, []).get(c.local_purchase_id)!).push(c);
  }

  for (const po of data.pos) {
    const { lines, form } = extractPoGoodsLines(po.form_data);
    const facts = (plrByPo.get(po.id) ?? []).map((p: any) => toLoadingFact(p, data.clearing));
    const factById = new Map(facts.map((x) => [x.id, x]));
    const { chunks, overLoaded } = allocateLoadings(lines, facts);
    const poConfs = confByPo.get(po.id) ?? [];

    const systemNo = po.purchase_order_no || "-";
    const manualNo = String(form.manualBillNumber || form.billNo || po.purchase_contract_no || "").trim();
    const bookingConfirmed = String(po.ledger_posting_status || "").toLowerCase() === "posted" || !["", "draft"].includes(String(po.status || "").toLowerCase());
    const origin = String(form.originCountry || form.origin || form.countryOfOrigin || po.country_name || "").trim();
    const rawBookingNo = String(form.bookingNo || form.bookingNumber || po.purchase_order_no || "").trim();
    const bookingNo = rawBookingNo ? (rawBookingNo.startsWith("#") ? rawBookingNo : `#${rawBookingNo}`) : "#PB-001";
    const rawInvNo = String(form.invoiceNo || form.invoiceNumber || form.supplierInvoiceNo || manualNo || "").trim();
    const invoiceNo = rawInvNo ? (rawInvNo.startsWith("#") ? rawInvNo : `#${rawInvNo}`) : "#PI-001";

    const base = {
      sourceType: "purchase_booking" as const,
      sourceId: po.id,
      billNumber: [systemNo, manualNo && manualNo !== systemNo ? manualNo : ""].filter(Boolean).join(" / "),
      systemBillNumber: systemNo,
      manualBillNumber: manualNo || "-",
      date: String(form.purchaseDate || form.receiptDate || "") || iso(po.created_at),
      countryId: po.country_id,
      countryName: po.country_name || "",
      countryCode: po.country_code || "",
      countryBranchId: po.country_branch_id,
      cityBranchId: po.city_branch_id,
      branchName: po.city_branch_name ? `${po.city_branch_name}` : po.country_branch_name || "",
      supplierName: String(form.salesAccountName || form.salesAccount || form.supplierName || ""),
      currencyCode: po.purchase_currency || po.currency_code || String(form.purchaseCurrency || ""),
      bookingStatus: (bookingConfirmed ? "confirmed" : "draft") as "confirmed" | "draft",
      invoiceStatus: (String(po.ledger_posting_status || "").toLowerCase() === "posted" ? "posted" : "unposted") as "posted" | "unposted",
      paymentStatus: paymentFromPo(po.payment_status),
    };

    for (const line of lines) {
      const lineChunks = chunks.filter((c) => c.lineKey === line.lineKey);
      const loadedTotal = q4(lineChunks.reduce((s, c) => s + c.loaded, 0));
      const lineBase = {
        ...base,
        lineKey: line.lineKey,
        productName: line.goodsName || "",
        goodsId: line.goodsId,
        brand: line.brand,
        size: line.size,
        unit: line.unit,
        bookedQuantity: line.booked,
        grossWeight: line.grossWeight || 0,
        netWeight: line.netWeight || 0,
        origin,
        bookingNo,
        invoiceNo,
        shipDetails: "",
        quantityNotEntered: line.booked <= EPS && lineChunks.length === 0,
        overLoaded: !!overLoaded[line.lineKey],
        goodsTransferHref: null,
      };
      const common = (over: Partial<StockJournalRow>): StockJournalRow => ({
        id: "",
        stage: "booking",
        quantity: 0,
        loadedQuantity: loadedTotal,
        receivedQuantity: 0,
        damagedQuantity: 0,
        shortageQuantity: 0,
        outstandingQuantity: 0,
        customsStatus: "not_recorded",
        truckOrContainer: "",
        loadingRecordId: null,
        loadingRecordNo: null,
        blNumber: "",
        warehouseId: null,
        warehouseName: null,
        transferId: null,
        transferNo: null,
        destinationType: null,
        customerName: null,
        salesOrderNo: null,
        documentRef: null,
        issueType: null,
        confirmedAt: null,
        issuedAt: null,
        legacyReceived: false,
        canConfirm: false,
        canIssue: false,
        canReverse: false,
        ...lineBase,
        ...over,
      });

      // 1. Booking Stock = what is booked and not yet loaded (a zero-quantity Draft is still listed, flagged)
      const remaining = q4(line.booked - loadedTotal);
      if (remaining > EPS || (line.booked <= EPS && lineChunks.length === 0)) {
        rows.push(common({ id: `BK-${po.id}-${line.lineKey}`, stage: "booking", quantity: Math.max(0, remaining), outstandingQuantity: Math.max(0, remaining) }));
      }

      // 2..7. one stage per loaded chunk / confirmation
      for (const ch of lineChunks) {
        const lf = factById.get(ch.loadingId)!;
        const chunkBase = {
          loadingRecordId: lf.id,
          loadingRecordNo: lf.no,
          truckOrContainer: lf.containerNo || lf.vehicleNo || "",
          blNumber: lf.blNumber,
          shipDetails: [lf.containerNo, lf.vehicleNo, lf.blNumber].filter(Boolean).join(" · ") || lf.containerNo || lf.vehicleNo || "—",
          customsStatus: lf.customsStatus,
          loadedQuantity: ch.loaded,
          receivedQuantity: ch.receivedGood,
          damagedQuantity: ch.damaged,
          shortageQuantity: ch.shortage,
          outstandingQuantity: ch.inTransit,
          legacyReceived: ch.legacyReceived,
          warehouseId: lf.receivingWarehouseId,
          warehouseName: lf.receivingWarehouseId ? whName.get(lf.receivingWarehouseId) ?? null : null,
        };
        if (ch.inTransit > EPS) {
          rows.push(common({ ...chunkBase, id: `TR-${lf.id}-${line.lineKey}`, stage: "transit", quantity: ch.inTransit }));
        }
        const eligible = confirmableQuantity(ch, poConfs);
        if (eligible > EPS) {
          const ready = isCustomsOk(lf.customsStatus);
          rows.push(
            common({ ...chunkBase, id: `RV-${lf.id}-${line.lineKey}`, stage: ready ? "ready" : "receiving", quantity: eligible, canConfirm: ready && perms.confirm }),
          );
        }
        for (const c of poConfs) {
          if (c.status === "reversed" || c.loadingRecordId !== lf.id || (c.lineKey && c.lineKey !== line.lineKey)) continue;
          const raw = confRaw.get(c.id);
          const st = confirmationStage(c);
          rows.push(
            common({
              ...chunkBase,
              id: `CF-${c.id}`,
              stage: st,
              quantity: c.quantity,
              warehouseId: c.warehouseId,
              warehouseName: c.warehouseId ? whName.get(c.warehouseId) ?? null : null,
              transferId: c.id,
              transferNo: c.transferNo,
              destinationType: c.destinationType,
              customerName: c.customerName,
              salesOrderNo: c.salesOrderNo,
              documentRef: c.documentRef,
              issueType: c.issueType,
              confirmedAt: c.confirmedAt,
              issuedAt: c.issuedAt,
              canIssue: c.status === "confirmed" && perms.issue,
              canReverse: c.status === "confirmed" && perms.reverse,
              brand: line.brand || raw?.brand || "",
            }),
          );
        }
      }
    }
  }

  // ── Local Purchases (stock identity lives in purchase_lots / lot_stock; confirmed in the Goods Transfer Journal) ──
  const lotsByLp = new Map<string, any[]>();
  for (const l of data.lots) (lotsByLp.get(l.local_purchase_id) ?? lotsByLp.set(l.local_purchase_id, []).get(l.local_purchase_id)!).push(l);
  const stockByLot = new Map<string, any[]>();
  for (const s of data.lotStock) (stockByLot.get(s.lot_id) ?? stockByLot.set(s.lot_id, []).get(s.lot_id)!).push(s);

  for (const lp of data.lps) {
    const status = String(lp.status || "").toLowerCase();
    if (status === "cancelled" || status === "deleted") continue;
    const contractNo = lp.contract_no ? String(lp.contract_no) : "";
    const systemNo = contractNo ? `LP-${contractNo}` : lp.manual_bill_no || `LP-${String(lp.id).slice(0, 8)}`;
    const posted = ["posted", "transferred", "in_transit", "sold", "accepted"].includes(status);
    const paid = num(lp.paid);
    const cost = num(lp.final_cost);
    const base = {
      sourceType: "local_purchase" as const,
      sourceId: lp.id,
      billNumber: systemNo,
      systemBillNumber: systemNo,
      manualBillNumber: lp.manual_bill_no || contractNo || "-",
      date: iso(lp.created_at),
      countryId: lp.country_id,
      countryName: lp.country_name || "",
      countryCode: lp.country_code || "",
      countryBranchId: lp.country_branch_id,
      cityBranchId: lp.city_branch_id,
      branchName: lp.city_branch_name ? `${lp.city_branch_name}` : lp.country_branch_name || "",
      supplierName: lp.supplier_name || "",
      currencyCode: lp.purchase_currency || "",
      bookingStatus: (posted ? "confirmed" : "draft") as "confirmed" | "draft",
      invoiceStatus: (posted ? "posted" : "unposted") as "posted" | "unposted",
      paymentStatus: (cost > 0 && paid + 0.005 >= cost ? "paid" : paid > 0 ? "partial" : "unpaid") as PaymentState,
      goodsTransferHref: `/dashboard/purchase/local-purchase/${lp.id}/goods-transfer`,
    };
    const lpQty = num(lp.quantity_kgs || num(lp.numbers || 0) * 50);
    const lpBookingNo = contractNo ? `#PB-${contractNo}` : `#PB-${String(lp.id).slice(0, 6).toUpperCase()}`;
    const lpInvoiceNo = lp.manual_bill_no ? `#PI-${lp.manual_bill_no}` : `#PI-${String(lp.id).slice(0, 6).toUpperCase()}`;
    const mk = (over: Partial<StockJournalRow>): StockJournalRow => ({
      id: "", lineKey: "", stage: "booking", productName: lp.goods_name || "", goodsId: lp.goods_id || null, brand: lp.brand || "", size: lp.size || "",
      unit: lp.quantity_name || "", quantity: 0, bookedQuantity: 0, loadedQuantity: 0, receivedQuantity: 0, damagedQuantity: 0,
      shortageQuantity: 0, outstandingQuantity: 0,
      origin: lp.country_name || "",
      grossWeight: lpQty,
      netWeight: lpQty,
      bookingNo: lpBookingNo,
      invoiceNo: lpInvoiceNo,
      shipDetails: lp.truck_no ? `TRK: ${lp.truck_no}` : "—",
      customsStatus: "not_applicable", truckOrContainer: lp.truck_no || "",
      loadingRecordId: null, loadingRecordNo: null, blNumber: "", warehouseId: null, warehouseName: null, transferId: null,
      transferNo: null, destinationType: null, customerName: null, salesOrderNo: null, documentRef: null, issueType: null,
      confirmedAt: null, issuedAt: null, quantityNotEntered: false, legacyReceived: false, overLoaded: false,
      canConfirm: false, canIssue: false, canReverse: false, ...base, ...over,
    });
    const lpLots = lotsByLp.get(lp.id) ?? [];
    if (lpLots.length === 0) {
      const booked = q4(num(lp.numbers) > 0 ? num(lp.numbers) : num(lp.quantity_kgs));
      const stage: StockStage = status === "in_transit" ? "transit" : status === "sold" ? "sold" : "booking";
      rows.push(mk({ id: `LP-${lp.id}`, stage, quantity: booked, bookedQuantity: booked, outstandingQuantity: stage === "transit" ? booked : 0, quantityNotEntered: booked <= EPS }));
      continue;
    }
    for (const lot of lpLots) {
      for (const s of stockByLot.get(lot.id) ?? []) {
        const st: StockStage =
          s.state === "available" ? "available" : s.state === "reserved" ? "reserved" : s.state === "sold" || s.state === "exported" ? "sold" : "transit";
        rows.push(
          mk({
            id: `LT-${lot.id}-${s.state}-${s.warehouse_id ?? ""}`,
            lineKey: lot.lot_ref || lot.id,
            stage: st,
            productName: lot.goods_name || lp.goods_name || "",
            goodsId: lot.goods_id || lp.goods_id || null,
            brand: lot.brand || lp.brand || "",
            size: lot.size || lp.size || "",
            unit: lot.unit_name || lp.quantity_name || "",
            quantity: num(s.qty),
            bookedQuantity: num(lot.qty_purchased),
            receivedQuantity: st === "transit" ? 0 : num(s.qty),
            outstandingQuantity: st === "transit" ? num(s.qty) : 0,
            warehouseId: s.warehouse_id || null,
            warehouseName: s.warehouse_id ? whName.get(s.warehouse_id) ?? null : null,
            transferNo: lot.lot_ref || null,
          }),
        );
      }
    }
  }

  await localizeNames(rows, data.warehouses, f.lang);

  // ── Summary: all scoped stock, before any tab / search filter ──
  const summary: StockJournalSummary = {
    booking: emptyCard(), confirmedBooking: emptyCard(), transit: emptyCard(), receivingCustoms: emptyCard(),
    readyForConfirmation: emptyCard(), availableMixed: emptyCard(), reserved: emptyCard(), soldExported: emptyCard(), totalBills: 0,
  };
  const bills = new Set<string>();
  for (const r of rows) {
    bills.add(r.sourceId);
    if (r.stage === "booking") { addCard(summary.booking, r); if (r.bookingStatus === "confirmed") addCard(summary.confirmedBooking, r); }
    else if (r.stage === "transit") addCard(summary.transit, r);
    else if (r.stage === "receiving") addCard(summary.receivingCustoms, r);
    else if (r.stage === "ready") { addCard(summary.receivingCustoms, r); addCard(summary.readyForConfirmation, r); }
    else if (r.stage === "available") addCard(summary.availableMixed, r);
    else if (r.stage === "reserved") { addCard(summary.availableMixed, r); addCard(summary.reserved, r); }
    else if (r.stage === "sold") addCard(summary.soldExported, r);
  }
  summary.totalBills = bills.size;

  // ── Tab + search filters ──
  const stageOk = (r: StockJournalRow) => {
    switch (f.stage) {
      case "all": return true;
      case "booking": return r.stage === "booking";
      case "confirmed_booking": return r.stage === "booking" && r.bookingStatus === "confirmed";
      case "transit": return r.stage === "transit";
      case "receiving": return r.stage === "receiving" || r.stage === "ready";
      case "ready": return r.stage === "ready";
      case "available": return r.stage === "available" || r.stage === "reserved";
      case "reserved": return r.stage === "reserved";
      case "sold": return r.stage === "sold";
    }
  };
  const has = (v: string | null | undefined, q: string) => !!v && v.toLowerCase().includes(q);
  const search = f.search?.toLowerCase().trim();
  const filtered = rows.filter((r) => {
    if (!stageOk(r)) return false;
    if (f.sourceType && f.sourceType !== "all" && r.sourceType !== f.sourceType) return false;
    if (f.destination && r.destinationType !== f.destination) return false;
    if (f.warehouseId && r.warehouseId !== f.warehouseId) return false;
    if (f.goodsName && !has(r.productName, f.goodsName.toLowerCase().trim())) return false;
    if (f.purchaseOrderNo && !has(r.billNumber, f.purchaseOrderNo.toLowerCase().trim())) return false;
    if (f.containerNo && !has(r.truckOrContainer, f.containerNo.toLowerCase().trim())) return false;
    if (search && ![r.billNumber, r.productName, r.supplierName, r.truckOrContainer, r.loadingRecordNo, r.transferNo, r.customerName, r.salesOrderNo, r.blNumber, r.warehouseName, r.origin, r.bookingNo, r.invoiceNo, r.countryName, r.branchName].some((v) => has(v, search))) return false;
    return true;
  });
  filtered.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const totalRecords = filtered.length;
  const offset = (f.page - 1) * f.limit;
  return {
    rows: filtered.slice(offset, offset + f.limit),
    allRows: filtered,
    summary,
    warehouses: data.warehouses,
    permissions: perms,
    pagination: { page: f.page, limit: f.limit, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / f.limit)) },
  };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// WRITE: balances (same tables as Inventory)
// ──────────────────────────────────────────────────────────────────────────────────────────────

async function lockBalance(tx: Tx, goodsId: string, warehouseId: string) {
  const rows = await tx`
    select id, quantity_on_hand, quantity_reserved from public.product_inventory_balances
    where product_id = ${goodsId}::uuid and warehouse_id = ${warehouseId}::uuid for update`;
  return rows[0] ? { id: rows[0].id as string, onHand: num(rows[0].quantity_on_hand), reserved: num(rows[0].quantity_reserved) } : null;
}

async function stockMovement(tx: Tx, m: { type: "STOCK_IN" | "STOCK_OUT"; goodsId: string; warehouseId: string; qty: number; ref: string; notes: string; po: string | null; plr: string | null; userId: string; scope: any }) {
  const now = new Date().toISOString();
  const rows = await tx`
    insert into public.stock_movements (movement_type, goods_id, warehouse_id, country_id, country_branch_id, city_branch_id, quantity, unit_cost, total_amount,
      reference_no, notes, movement_date, purchase_order_id, loading_record_id, created_by, created_at, updated_at)
    values (${m.type}, ${m.goodsId}::uuid, ${m.warehouseId}::uuid, ${m.scope.countryId ?? null}::uuid, ${m.scope.countryBranchId ?? null}::uuid, ${m.scope.cityBranchId ?? null}::uuid,
      ${m.qty}, 0, 0, ${m.ref}, ${m.notes}, ${now}, ${m.po}::uuid, ${m.plr}::uuid, ${m.userId}::uuid, ${now}, ${now})
    returning id`;
  return rows[0]?.id as string;
}

/** Takes physical stock out of a warehouse balance (refuses to go negative, never touches other people's reservations). */
async function stockOut(tx: Tx, o: { goodsId: string; warehouseId: string; qty: number; releaseReserved: number; ref: string; notes: string; po: string | null; plr: string | null; userId: string; scope: any }) {
  const bal = await lockBalance(tx, o.goodsId, o.warehouseId);
  const free = bal ? bal.onHand - bal.reserved + o.releaseReserved : 0;
  if (!bal || bal.onHand + EPS < o.qty || free + EPS < o.qty) {
    throw new ApiClientError(`Not enough free stock in the warehouse (free ${q4(Math.max(0, free))}, needed ${q4(o.qty)}). Stock cannot go negative.`, { status: 409, code: "INSUFFICIENT_STOCK" });
  }
  await tx`
    update public.product_inventory_balances
    set quantity_on_hand = quantity_on_hand - ${o.qty}, quantity_reserved = greatest(0, quantity_reserved - ${o.releaseReserved}), updated_at = now()
    where id = ${bal.id}::uuid`;
  return stockMovement(tx, { type: "STOCK_OUT", ...o, qty: o.qty });
}

async function reserve(tx: Tx, goodsId: string, warehouseId: string, qty: number, delta: 1 | -1) {
  const bal = await lockBalance(tx, goodsId, warehouseId);
  if (!bal) throw new ApiClientError("No stock balance exists in that warehouse for this product.", { status: 409, code: "NO_BALANCE" });
  if (delta === 1 && bal.onHand - bal.reserved + EPS < qty) {
    throw new ApiClientError(`Only ${q4(Math.max(0, bal.onHand - bal.reserved))} is free in that warehouse; ${q4(qty)} cannot be reserved.`, { status: 409, code: "INSUFFICIENT_STOCK" });
  }
  await tx`
    update public.product_inventory_balances set quantity_reserved = greatest(0, quantity_reserved + ${delta * qty}), updated_at = now()
    where id = ${bal.id}::uuid`;
}

async function resolveGoodsId(tx: Tx, line: GoodsLine | undefined, plr: any, goodsName: string): Promise<string | null> {
  if (line?.goodsId) return line.goodsId;
  if (plr?.receiving_goods_id) return plr.receiving_goods_id;
  const name = (line?.goodsName || goodsName || "").trim();
  if (!name) return null;
  const rows = await tx`select id from public.goods where lower(goods_name) = lower(${name}) and deleted_at is null limit 2`;
  return rows.length === 1 ? rows[0].id : null;
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// WRITE: Confirm Stock
// ──────────────────────────────────────────────────────────────────────────────────────────────

export type ConfirmInput = {
  idempotencyKey: string;
  purchaseOrderId: string;
  loadingRecordId: string;
  lineKey: string;
  destinationType: DestinationType;
  warehouseId?: string | null;
  quantity: number;
  customerId?: string | null;
  customerName?: string | null;
  salesOrderNo?: string | null;
  documentRef?: string | null;
  referenceNo?: string | null;
  remarks?: string | null;
  transferDate?: string | null;
  authorized: boolean;
};

async function nextTransferNo(tx: Tx) {
  await tx`select pg_advisory_xact_lock(hashtext('journal_stock_transfers.transfer_no'))`;
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const [{ n }] = await tx`select count(*)::int as n from public.journal_stock_transfers where transfer_no like ${"TRF-" + day + "-%"}`;
  return `TRF-${day}-${String(Number(n) + 1).padStart(4, "0")}`;
}

async function salesOrderByNo(tx: Tx, no: string) {
  const r = await tx`select id, sales_order_no from public.sales_orders where sales_order_no = ${no} and deleted_at is null limit 1`;
  return r[0] ?? null;
}

export async function confirmStock(session: ErpSession, input: ConfirmInput) {
  if (!input.authorized) throw new ApiClientError("Stock allocation needs the authorized user's explicit confirmation.", { status: 400, code: "NOT_AUTHORIZED" });
  const qty = q4(input.quantity);
  if (!(qty > 0)) throw new ApiClientError("Quantity must be greater than zero.", { status: 400, code: "BAD_QTY" });

  const result = await withLocalPg((sql) =>
    sql.begin(async (tx: Tx) => {
      const prior = await tx`select * from public.journal_stock_transfers where idempotency_key = ${input.idempotencyKey} limit 1`;
      if (prior[0]) {
        if (prior[0].loading_record_id !== input.loadingRecordId) throw new ApiClientError("This confirmation key was already used for a different stock record.", { status: 409, code: "IDEMPOTENCY_CONFLICT" });
        return { transfer: prior[0], replayed: true };
      }

      const poRows = await tx`select * from public.purchase_orders where id = ${input.purchaseOrderId}::uuid and deleted_at is null for update`;
      const po = poRows[0];
      if (!po) throw new ApiClientError("Purchase booking not found.", { status: 404, code: "NOT_FOUND" });
      assertRecordAccess(session, "update", po, { country_id: po.dest_country_id, country_branch_id: po.dest_country_branch_id, city_branch_id: po.dest_city_branch_id });

      const plrs = await tx`select * from public.purchase_loading_records where purchase_order_id = ${po.id}::uuid and deleted_at is null order by created_at asc, id asc`;
      const clearing = await clearingCustoms(tx, plrs);
      const facts = plrs.map((p: any) => toLoadingFact(p, clearing));
      const { lines } = extractPoGoodsLines(po.form_data);
      const { chunks } = allocateLoadings(lines, facts);
      const chunk = chunks.find((c: Chunk) => c.loadingId === input.loadingRecordId && c.lineKey === input.lineKey);
      const plr = plrs.find((p: any) => p.id === input.loadingRecordId);
      const lf = facts.find((x: LoadingFact) => x.id === input.loadingRecordId);
      if (!chunk || !plr || !lf) throw new ApiClientError("That loaded stock line was not found on this booking.", { status: 404, code: "NOT_FOUND" });

      const confs = (await tx`select * from public.journal_stock_transfers where purchase_order_id = ${po.id}::uuid and deleted_at is null`).map(toConfirmationFact);
      const eligible = confirmableQuantity(chunk, confs);
      if (!isCustomsOk(lf.customsStatus)) {
        throw new ApiClientError("Customs clearance is not complete for this loading record, so the stock is not ready for confirmation.", { status: 409, code: "CUSTOMS_NOT_CLEARED" });
      }
      if (qty > eligible + EPS) {
        throw new ApiClientError(`Only ${eligible} is received, cleared and not yet confirmed; ${qty} cannot be allocated.`, { status: 409, code: "EXCEEDS_AVAILABLE" });
      }

      const line = lines.find((l) => l.lineKey === input.lineKey);
      const dest = input.destinationType;
      const destCountry = po.dest_country_id || po.country_id;

      // warehouse rules
      const sourceWh: string | null = chunk.legacyReceived ? null : plr.receiving_warehouse_id || null;
      let physicalWh: string | null = input.warehouseId || sourceWh || plr.receiving_warehouse_id || null;
      if (dest === "warehouse" && !input.warehouseId) throw new ApiClientError("Select the warehouse for Warehouse Storage.", { status: 400, code: "WAREHOUSE_REQUIRED" });
      if (dest !== "warehouse" && sourceWh) physicalWh = sourceWh; // reservations / local market stay where the stock physically is
      if (!physicalWh) throw new ApiClientError("Select the warehouse that holds this stock.", { status: 400, code: "WAREHOUSE_REQUIRED" });
      const wh = (await tx`select id, warehouse_name, country_id from public.warehouses where id = ${physicalWh}::uuid and deleted_at is null`)[0];
      if (!wh) throw new ApiClientError("The selected warehouse was not found.", { status: 404, code: "NOT_FOUND" });
      if (wh.country_id && destCountry && wh.country_id !== destCountry && !session.isSuperAdmin) {
        throw new ApiClientError("That warehouse belongs to another country.", { status: 409, code: "WAREHOUSE_COUNTRY" });
      }

      // sale / export documents
      let customerName = (input.customerName || "").trim() || null;
      if (input.customerId && !customerName) {
        customerName = (await tx`select coalesce(customer_name, first_name) as n from public.customers where id = ${input.customerId}::uuid`)[0]?.n ?? null;
      }
      if (dest === "direct_sale" && !input.customerId && !customerName) throw new ApiClientError("Select the customer for a Direct Sale / Delivery.", { status: 400, code: "CUSTOMER_REQUIRED" });
      if (dest === "export" && !input.customerId && !customerName && !input.documentRef) {
        throw new ApiClientError("An Export allocation needs a customer or an export document reference.", { status: 400, code: "EXPORT_REFERENCE_REQUIRED" });
      }
      let so: any = null;
      if (input.salesOrderNo) {
        so = await salesOrderByNo(tx, input.salesOrderNo.trim());
        if (!so) throw new ApiClientError(`Sales booking "${input.salesOrderNo}" was not found.`, { status: 404, code: "SALES_ORDER_NOT_FOUND" });
      }

      // physical effect
      const goodsId = await resolveGoodsId(tx, line, plr, line?.goodsName || "");
      const needsBalance = chunk.legacyReceived || (dest === "warehouse" && sourceWh && input.warehouseId !== sourceWh) || dest === "export" || dest === "direct_sale";
      if (needsBalance && !goodsId) {
        throw new ApiClientError("This product is not linked to the Goods master, so its warehouse stock cannot be moved or reserved. Link the goods first.", { status: 409, code: "GOODS_NOT_LINKED" });
      }
      const scope = { countryId: po.dest_country_id || po.country_id, countryBranchId: po.dest_country_branch_id || po.country_branch_id, cityBranchId: po.dest_city_branch_id || po.city_branch_id };
      const transferNo = await nextTransferNo(tx);
      let inMovementId: string | null = null;
      const refText = `${transferNo} · ${po.purchase_order_no || ""}`;

      if (chunk.legacyReceived) {
        // received before receiving facts existed: the physical stock was never booked, so booking it IS the receipt
        const r = await stockInToWarehouse(tx, { goodsId: goodsId!, warehouseId: physicalWh, quantity: qty, unitCost: 0, scope, referenceNo: transferNo, purchaseOrderId: po.id, loadingRecordId: plr.id, userId: session.userId, remarks: `Stock Journal confirmation of ${plr.loading_record_no || ""}` });
        inMovementId = r.stockMovementId;
      } else if (dest === "warehouse" && sourceWh && input.warehouseId !== sourceWh) {
        await stockOut(tx, { goodsId: goodsId!, warehouseId: sourceWh, qty, releaseReserved: 0, ref: transferNo, notes: `Stock Journal transfer to ${wh.warehouse_name}`, po: po.id, plr: plr.id, userId: session.userId, scope });
        const r = await stockInToWarehouse(tx, { goodsId: goodsId!, warehouseId: physicalWh, quantity: qty, unitCost: 0, scope, referenceNo: transferNo, purchaseOrderId: po.id, loadingRecordId: plr.id, userId: session.userId, remarks: "Stock Journal warehouse storage" });
        inMovementId = r.stockMovementId;
      }
      const reserved = dest === "export" || dest === "direct_sale";
      if (reserved) await reserve(tx, goodsId!, physicalWh, qty, 1);

      const day = (input.transferDate || new Date().toISOString()).slice(0, 10);
      const inserted = await tx`
        insert into public.journal_stock_transfers (
          transfer_no, purchase_order_id, loading_record_id, line_key, source_stage, destination_type, warehouse_id, source_warehouse_id,
          goods_name, goods_id, quantity, unit, country_id, country_branch_id, city_branch_id, transfer_date, reference_no, remarks,
          status, reserved, idempotency_key, customer_id, customer_name, sales_order_id, sales_order_no, document_ref,
          confirmed_by, confirmed_at, confirm_stock_movement_id, created_by)
        values (
          ${transferNo}, ${po.id}::uuid, ${plr.id}::uuid, ${input.lineKey}, 'loading', ${dest}, ${physicalWh}::uuid, ${sourceWh}::uuid,
          ${line?.goodsName || "Goods"}, ${goodsId}::uuid, ${qty}, ${line?.unit || "KG"}, ${po.country_id}::uuid, ${po.country_branch_id}::uuid, ${po.city_branch_id}::uuid,
          ${day}::date, ${input.referenceNo || null}, ${input.remarks || null},
          'confirmed', ${reserved}, ${input.idempotencyKey}, ${input.customerId || null}::uuid, ${customerName}, ${so?.id ?? null}::uuid, ${so?.sales_order_no ?? null}, ${input.documentRef || null},
          ${session.userId}::uuid, now(), ${inMovementId}::uuid, ${session.userId}::uuid)
        returning *`;
      return { transfer: inserted[0], replayed: false, bookingNo: refText };
    }),
  );
  if (!result) throw new Error("Unable to confirm stock.");

  if (!result.replayed) {
    void recordAuditEvent({
      entityType: "journal_stock_transfer", entityId: result.transfer.id, referenceNo: result.transfer.transfer_no, module: "stock_journal",
      actionType: "POST", currentSnapshot: { destination: result.transfer.destination_type, quantity: Number(result.transfer.quantity), warehouseId: result.transfer.warehouse_id, customer: result.transfer.customer_name },
      session, reason: "Confirm Stock", countryId: result.transfer.country_id, cityBranchId: result.transfer.city_branch_id,
    }).catch(() => undefined);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// WRITE: Goods Issue / Dispatch / Delivery  (the ONLY event that takes physical stock out)
// ──────────────────────────────────────────────────────────────────────────────────────────────

export type IssueInput = { transferId: string; issueType: "goods_issue" | "dispatch" | "delivery"; issueRef: string; salesOrderNo?: string | null; remarks?: string | null };

/** Issues one confirmation inside an open transaction. Idempotent: an already-issued row is returned untouched. */
export async function issueConfirmationTx(tx: Tx, session: Pick<ErpSession, "userId"> & Partial<ErpSession>, row: any, i: { issueType: IssueInput["issueType"]; issueRef: string; salesOrder?: { id: string; sales_order_no: string } | null }) {
  if (row.status === "issued") return { transfer: row, replayed: true };
  if (row.status !== "confirmed") throw new ApiClientError("Only a confirmed allocation can be issued.", { status: 409, code: "NOT_CONFIRMED" });
  const qty = num(row.quantity);
  const goodsId = row.goods_id;
  if (!goodsId || !row.warehouse_id) throw new ApiClientError("This allocation has no linked goods / warehouse, so physical stock cannot be deducted.", { status: 409, code: "GOODS_NOT_LINKED" });
  const scope = { countryId: row.country_id, countryBranchId: row.country_branch_id, cityBranchId: row.city_branch_id };
  const movementId = await stockOut(tx, {
    goodsId, warehouseId: row.warehouse_id, qty, releaseReserved: row.reserved ? qty : 0, ref: row.transfer_no,
    notes: `Stock Journal ${i.issueType}: ${i.issueRef}`, po: row.purchase_order_id, plr: row.loading_record_id, userId: session.userId as string, scope,
  });
  const updated = await tx`
    update public.journal_stock_transfers
    set status = 'issued', reserved = false, issue_type = ${i.issueType}, issue_ref = ${i.issueRef}, issued_at = now(), issued_by = ${session.userId as string}::uuid,
        issue_stock_movement_id = ${movementId}::uuid,
        sales_order_id = coalesce(${i.salesOrder?.id ?? null}::uuid, sales_order_id), sales_order_no = coalesce(${i.salesOrder?.sales_order_no ?? null}, sales_order_no)
    where id = ${row.id}::uuid returning *`;
  return { transfer: updated[0], replayed: false };
}

export async function issueStock(session: ErpSession, input: IssueInput) {
  if (!input.issueRef?.trim()) throw new ApiClientError("Enter the Goods Issue / Dispatch / Delivery document reference.", { status: 400, code: "ISSUE_REF_REQUIRED" });
  const result = await withLocalPg((sql) =>
    sql.begin(async (tx: Tx) => {
      const rows = await tx`select * from public.journal_stock_transfers where id = ${input.transferId}::uuid and deleted_at is null for update`;
      const row = rows[0];
      if (!row) throw new ApiClientError("Stock allocation not found.", { status: 404, code: "NOT_FOUND" });
      assertRecordAccess(session, "update", row);
      let so: any = null;
      if (input.salesOrderNo) {
        so = await salesOrderByNo(tx, input.salesOrderNo.trim());
        if (!so) throw new ApiClientError(`Sales booking "${input.salesOrderNo}" was not found.`, { status: 404, code: "SALES_ORDER_NOT_FOUND" });
      }
      return issueConfirmationTx(tx, session, row, { issueType: input.issueType, issueRef: input.issueRef.trim(), salesOrder: so });
    }),
  );
  if (!result) throw new Error("Unable to issue stock.");
  if (!result.replayed) {
    void recordAuditEvent({
      entityType: "journal_stock_transfer", entityId: result.transfer.id, referenceNo: result.transfer.transfer_no, module: "stock_journal", actionType: "POST",
      currentSnapshot: { status: "issued", issueType: input.issueType, issueRef: input.issueRef, quantity: Number(result.transfer.quantity) }, session, reason: `Stock ${input.issueType}`,
      countryId: result.transfer.country_id, cityBranchId: result.transfer.city_branch_id,
    }).catch(() => undefined);
  }
  return result;
}

/** Sales hook: when a sales booking is finally posted, every confirmed allocation linked to it is issued exactly once. */
export async function issueForSalesOrder(tx: Tx, o: { salesOrderId: string; salesOrderNo: string | null; userId: string | null }) {
  const rows = await tx`
    select * from public.journal_stock_transfers
    where deleted_at is null and status = 'confirmed' and (sales_order_id = ${o.salesOrderId}::uuid or (${o.salesOrderNo}::text is not null and sales_order_no = ${o.salesOrderNo}))
    for update`;
  const out: any[] = [];
  for (const r of rows) {
    const done = await issueConfirmationTx(tx, { userId: o.userId } as any, r, { issueType: "delivery", issueRef: o.salesOrderNo || o.salesOrderId, salesOrder: { id: o.salesOrderId, sales_order_no: o.salesOrderNo || "" } });
    out.push(done.transfer);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// WRITE: Reverse a confirmation (before it is issued)
// ──────────────────────────────────────────────────────────────────────────────────────────────

export async function reverseConfirmation(session: ErpSession, input: { transferId: string; reason: string }) {
  const reason = (input.reason || "").trim();
  if (reason.length < 3) throw new ApiClientError("Enter the reason for the reversal.", { status: 400, code: "REASON_REQUIRED" });
  const result = await withLocalPg((sql) =>
    sql.begin(async (tx: Tx) => {
      const row = (await tx`select * from public.journal_stock_transfers where id = ${input.transferId}::uuid and deleted_at is null for update`)[0];
      if (!row) throw new ApiClientError("Stock allocation not found.", { status: 404, code: "NOT_FOUND" });
      assertRecordAccess(session, "update", row);
      if (row.status === "reversed") return { transfer: row, replayed: true };
      if (row.status === "issued") throw new ApiClientError("Issued stock cannot be reversed here — the goods have already left. Record a return instead.", { status: 409, code: "ALREADY_ISSUED" });
      const qty = num(row.quantity);
      const scope = { countryId: row.country_id, countryBranchId: row.country_branch_id, cityBranchId: row.city_branch_id };
      if (row.reserved && row.goods_id && row.warehouse_id) await reserve(tx, row.goods_id, row.warehouse_id, qty, -1);
      if (row.confirm_stock_movement_id && row.goods_id && row.warehouse_id) {
        // the confirmation itself moved / booked physical stock → put it back exactly as it was
        await stockOut(tx, { goodsId: row.goods_id, warehouseId: row.warehouse_id, qty, releaseReserved: 0, ref: row.transfer_no, notes: `Reversal of ${row.transfer_no}: ${reason}`, po: row.purchase_order_id, plr: row.loading_record_id, userId: session.userId, scope });
        if (row.source_warehouse_id) {
          await stockInToWarehouse(tx, { goodsId: row.goods_id, warehouseId: row.source_warehouse_id, quantity: qty, unitCost: 0, scope, referenceNo: row.transfer_no, purchaseOrderId: row.purchase_order_id, loadingRecordId: row.loading_record_id, userId: session.userId, remarks: `Reversal of ${row.transfer_no}` });
        }
      }
      const updated = await tx`
        update public.journal_stock_transfers set status = 'reversed', reserved = false, reversed_at = now(), reversed_by = ${session.userId}::uuid, reverse_reason = ${reason}
        where id = ${row.id}::uuid returning *`;
      return { transfer: updated[0], replayed: false };
    }),
  );
  if (!result) throw new Error("Unable to reverse the allocation.");
  if (!result.replayed) {
    void recordAuditEvent({
      entityType: "journal_stock_transfer", entityId: result.transfer.id, referenceNo: result.transfer.transfer_no, module: "stock_journal", actionType: "EDIT",
      currentSnapshot: { status: "reversed" }, session, reason, countryId: result.transfer.country_id, cityBranchId: result.transfer.city_branch_id,
    }).catch(() => undefined);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Customs status of a loading record (manual, when no Clearing order carries the container)
// ──────────────────────────────────────────────────────────────────────────────────────────────

export async function setCustomsStatus(session: ErpSession, input: { loadingRecordId: string; customsStatus: "pending" | "submitted" | "cleared" | "not_applicable"; reference?: string | null }) {
  const res = await withLocalPg((sql) =>
    sql.begin(async (tx: Tx) => {
      const r = (await tx`
        select plr.*, po.dest_country_id, po.dest_country_branch_id, po.dest_city_branch_id from public.purchase_loading_records plr
        left join public.purchase_orders po on po.id = plr.purchase_order_id where plr.id = ${input.loadingRecordId}::uuid and plr.deleted_at is null for update of plr`)[0];
      if (!r) throw new ApiClientError("Loading record not found.", { status: 404, code: "NOT_FOUND" });
      assertRecordAccess(session, "update", r, { country_id: r.dest_country_id, country_branch_id: r.dest_country_branch_id, city_branch_id: r.dest_city_branch_id });
      const u = await tx`
        update public.purchase_loading_records
        set customs_status = ${input.customsStatus}, customs_reference = coalesce(${input.reference ?? null}, customs_reference),
            customs_cleared_at = case when ${input.customsStatus} = 'cleared' then now() else null end, updated_at = now()
        where id = ${r.id}::uuid returning id, customs_status, customs_reference, customs_cleared_at`;
      return u[0];
    }),
  );
  return res;
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// HISTORY — the complete linked transaction trail of one booking / loading / local purchase
// ──────────────────────────────────────────────────────────────────────────────────────────────

export type HistoryEvent = {
  at: string;
  type: "booking" | "loading" | "received" | "customs" | "stock_in" | "stock_out" | "confirmed" | "issued" | "reversed" | "lot_move" | "payment";
  title: string;
  quantity?: number;
  unit?: string;
  reference?: string | null;
  warehouse?: string | null;
  actor?: string | null;
  note?: string | null;
  loadingRecordId?: string | null;
};

export async function getStockHistory(session: ErpSession, q: { sourceType: "purchase_booking" | "local_purchase"; sourceId: string; loadingRecordId?: string | null }) {
  const data = await withLocalPg(async (sql) => {
    const events: HistoryEvent[] = [];
    let head: any = null;
    if (q.sourceType === "purchase_booking") {
      const po = (await sql`
        select po.*, c.name as country_name from public.purchase_orders po left join public.countries c on c.id = po.country_id
        where po.id = ${q.sourceId}::uuid and po.deleted_at is null`)[0];
      if (!po) throw new ApiClientError("Purchase booking not found.", { status: 404, code: "NOT_FOUND" });
      assertRecordAccess(session, "read", po, { country_id: po.dest_country_id, country_branch_id: po.dest_country_branch_id, city_branch_id: po.dest_city_branch_id });
      const { lines, form } = extractPoGoodsLines(po.form_data);
      head = { billNo: po.purchase_order_no, supplier: String(form.salesAccountName || form.supplierName || ""), country: po.country_name, goods: lines.map((l) => ({ name: l.goodsName, unit: l.unit, booked: l.booked })), status: po.status, ledger: po.ledger_posting_status, payment: po.payment_status };
      events.push({ at: iso(po.created_at)!, type: "booking", title: "booking_created", reference: po.purchase_order_no, quantity: lines.reduce((s, l) => s + l.booked, 0), unit: lines[0]?.unit });
      const plrs = await sql`
        select plr.*, w.warehouse_name from public.purchase_loading_records plr left join public.warehouses w on w.id = plr.receiving_warehouse_id
        where plr.purchase_order_id = ${po.id}::uuid and plr.deleted_at is null
          and ${q.loadingRecordId ? sql`plr.id = ${q.loadingRecordId}::uuid` : sql`true`} order by plr.created_at asc`;
      for (const p of plrs) {
        events.push({ at: iso(p.loaded_at || p.created_at)!, type: "loading", title: "loaded", reference: p.loading_record_no, quantity: num(p.loaded_quantity), unit: lines[0]?.unit, note: [p.container_number, p.vehicle_no].filter(Boolean).join(" · "), loadingRecordId: p.id });
        if (p.received_at) events.push({ at: iso(p.received_at)!, type: "received", title: "received", reference: p.loading_record_no, quantity: num(p.received_quantity), unit: lines[0]?.unit, warehouse: p.warehouse_name, note: `damage ${num(p.damaged_quantity)} · shortage ${num(p.shortage_quantity)}`, loadingRecordId: p.id });
        if (p.customs_status) events.push({ at: iso(p.customs_cleared_at || p.updated_at)!, type: "customs", title: `customs_${p.customs_status}`, reference: p.customs_reference || p.loading_record_no, loadingRecordId: p.id });
      }
      const plrIds = plrs.map((p: any) => p.id);
      const confs = await sql`
        select jst.*, w.warehouse_name, pc.full_name as confirmed_by_name, pi.full_name as issued_by_name, pr.full_name as reversed_by_name
        from public.journal_stock_transfers jst left join public.warehouses w on w.id = jst.warehouse_id
        left join public.profiles pc on pc.id = jst.confirmed_by left join public.profiles pi on pi.id = jst.issued_by left join public.profiles pr on pr.id = jst.reversed_by
        where jst.purchase_order_id = ${po.id}::uuid and jst.deleted_at is null and ${q.loadingRecordId ? sql`jst.loading_record_id = ${q.loadingRecordId}::uuid` : sql`true`} order by jst.created_at asc`;
      for (const c of confs) {
        events.push({ at: iso(c.confirmed_at || c.created_at)!, type: "confirmed", title: `confirmed_${c.destination_type}`, quantity: num(c.quantity), unit: c.unit, reference: c.transfer_no, warehouse: c.warehouse_name, actor: c.confirmed_by_name, note: [c.customer_name, c.sales_order_no, c.document_ref].filter(Boolean).join(" · ") || null, loadingRecordId: c.loading_record_id });
        if (c.issued_at) events.push({ at: iso(c.issued_at)!, type: "issued", title: `issued_${c.issue_type}`, quantity: num(c.quantity), unit: c.unit, reference: c.issue_ref || c.transfer_no, warehouse: c.warehouse_name, actor: c.issued_by_name, loadingRecordId: c.loading_record_id });
        if (c.reversed_at) events.push({ at: iso(c.reversed_at)!, type: "reversed", title: "reversed", quantity: num(c.quantity), unit: c.unit, reference: c.transfer_no, actor: c.reversed_by_name, note: c.reverse_reason, loadingRecordId: c.loading_record_id });
      }
      const refs = confs.map((c: any) => c.transfer_no);
      const moves = await sql`
        select sm.*, w.warehouse_name from public.stock_movements sm left join public.warehouses w on w.id = sm.warehouse_id
        where sm.deleted_at is null and (sm.purchase_order_id = ${po.id}::uuid or sm.loading_record_id = any(${plrIds}::uuid[]) or sm.reference_no = any(${refs}::text[])) order by sm.movement_date asc`;
      for (const m of moves) {
        events.push({ at: iso(m.movement_date || m.created_at)!, type: String(m.movement_type).toUpperCase() === "STOCK_OUT" ? "stock_out" : "stock_in", title: String(m.movement_type).toLowerCase(), quantity: num(m.quantity), reference: m.reference_no, warehouse: m.warehouse_name, note: m.notes, loadingRecordId: m.loading_record_id });
      }
    } else {
      const lp = (await sql`select lp.*, c.name as country_name from public.local_purchases lp left join public.countries c on c.id = lp.country_id where lp.id = ${q.sourceId}::uuid and lp.deleted_at is null`)[0];
      if (!lp) throw new ApiClientError("Local purchase not found.", { status: 404, code: "NOT_FOUND" });
      assertRecordAccess(session, "read", lp);
      head = { billNo: lp.contract_no ? `LP-${lp.contract_no}` : lp.manual_bill_no, supplier: lp.supplier_name, country: lp.country_name, goods: [{ name: lp.goods_name, unit: lp.quantity_name, booked: num(lp.numbers) || num(lp.quantity_kgs) }], status: lp.status };
      events.push({ at: iso(lp.created_at)!, type: "booking", title: "booking_created", reference: lp.manual_bill_no || lp.contract_no, quantity: num(lp.numbers) || num(lp.quantity_kgs), unit: lp.quantity_name });
      const lotMoves = await sql`
        select m.*, l.lot_ref, wf.warehouse_name as from_wh, wt.warehouse_name as to_wh, p.full_name as actor
        from public.lot_movements m join public.purchase_lots l on l.id = m.lot_id
        left join public.warehouses wf on wf.id = m.from_warehouse_id left join public.warehouses wt on wt.id = m.to_warehouse_id left join public.profiles p on p.id = m.created_by
        where l.local_purchase_id = ${lp.id}::uuid order by m.created_at asc`;
      for (const m of lotMoves) {
        events.push({ at: iso(m.created_at)!, type: "lot_move", title: `lot_${m.movement_type}`, quantity: num(m.qty), unit: lp.quantity_name, reference: m.reference_no || m.lot_ref, warehouse: m.to_wh || m.from_wh, actor: m.actor, note: `${m.from_state || ""} → ${m.to_state || ""}` });
      }
    }
    events.sort((a, b) => a.at.localeCompare(b.at));
    return { head, events };
  });
  return data;
}

