/**
 * Stock Balance Report service — Purchase Bill Journal · Sales Details · Lot-wise Remaining Balance · Payment · Treatment.
 *
 * REUSE, NOT A NEW ENGINE. Every number comes from records the ERP already keeps:
 *   booking bills : purchase_orders (goods lines) + purchase_loading_records (the lots) + journal_stock_transfers (issued = sold)
 *   local bills   : local_purchases + purchase_lots / lot_stock + goods_transfers (Goods Transfer Journal) + sales_orders
 *   payments      : purchase_order_payments (+ the credit ledger's name as the payment method) — read only, no new ledger rows
 *   treatment     : stock_treatments (the small register added for this report; information only, never moves / sells stock)
 * Scope: every query is filtered in SQL by the one scope rule (sessionSqlScope / sqlScopeCondition), single-record reads use
 * assertRecordAccess — never a front-end filter.
 */
import type { ErpSession } from "@/lib/auth/session";
import { ApiClientError } from "@/lib/api/response";
import { assertExplicitScopeAllowed, authorizeApiScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { hasRolePermission, isGlobalSession } from "@/lib/permissions/middleware";
import { assertRecordAccess } from "@/lib/services/stock-journal-service";
import { allocateLoadings, extractPoGoodsLines, parseJsonish, receivingFacts, type LoadingFact } from "@/lib/stock-journal/model";
import {
  EPS, add, entryLabel, maxTreatable, mergeUnitTotals, normalizeUnit, proportional, q4, remainingOf, statusOf, topUnit, totalsOf, treatmentFigures, treatmentSplit, zero,
  type BalanceEntry, type BillTotals, type BillType, type StockStatus, type Weighted,
} from "@/lib/stock-balance/model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;
const num = (v: unknown) => { const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const iso = (v: unknown) => (v ? new Date(v as any).toISOString() : null);
const dateOnly = (v: unknown) => (v ? new Date(v as any).toISOString().slice(0, 10) : null);
export const NOT_LOADED = "—";

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────────────────────

export interface BalanceFilters {
  type?: BillType;
  billId?: string;
  countryId?: string;
  countryBranchId?: string;
  cityBranchId?: string;
  companyId?: string;
  warehouseId?: string;
  billNo?: string;
  salesBillNo?: string;
  lotNo?: string;
  goodsName?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: StockStatus;
  lang?: SupportedLanguage;
}

export interface BalanceSale {
  id: string;
  salesBillNo: string;
  salesOrderId: string | null;
  date: string | null;
  saleType: string;
  status: "completed" | "reserved" | "cancelled" | "issued";
  sellerAccount: string;
  buyerAccount: string;
  truckBillNo: string;
  billType: BillType | null;
  billId: string | null;
  billNo: string | null;
  lotNo: string;
  entryId: string | null;
  lotEntryLabel: string;
  goodsName: string;
  unit: string;
  qty: number;
  gross: number;
  net: number;
  amount: number | null;
  currency: string;
  /** a sale that exists in the ERP but is not tied to a purchase lot (shown on its own, never mixed into a bill) */
  linked: boolean;
}

export interface BalancePayment {
  id: string;
  date: string | null;
  kind: string;
  method: string;
  amount: number;
  currency: string;
  exchangeRate: number | null;
  status: string;
  referenceNo: string | null;
}

export interface BalanceTreatment {
  id: string;
  treatmentNo: string;
  billType: BillType;
  billId: string;
  billNo: string;
  lotNo: string;
  entryKey: string;
  goodsName: string;
  unit: string;
  treatmentType: string;
  treatmentDate: string | null;
  received: number;
  treated: number;
  pending: number;
  loss: number;
  finalQty: number;
  status: string;
  warehouseId: string | null;
  warehouseName: string | null;
  branchName: string;
  remarks: string | null;
}

export interface BalanceBill {
  id: string;
  type: BillType;
  billNo: string;
  manualBillNo: string;
  date: string | null;
  purchaseAccountName: string;
  purchaseAccountDetails: string;
  companyId: string | null;
  companyName: string;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  countryBranchId: string | null;
  cityBranchId: string | null;
  cityName: string;
  branchName: string;
  originCountry: string;
  currency: string;
  exchangeRate: number | null;
  remarks: string;
  /** purchase amount in the bill currency (null when the viewer may not see money) */
  amount: number | null;
  totals: BillTotals;
  entries: BalanceEntry[];
  sales: BalanceSale[];
  /** sales tied to the bill but not to one of its lots (older bookings); they count in the bill totals */
  unallocatedSales: Weighted;
  payments: BalancePayment[];
  paid: number | null;
  pending: number | null;
  mixedCurrency: boolean;
  treatments: BalanceTreatment[];
  paymentStatus: string;
}

export interface BalanceCards {
  purchase: { byUnit: Record<string, Weighted>; qty: number; gross: number; net: number; top: { unit: string; qty: number; more: number } };
  sales: { byUnit: Record<string, Weighted>; qty: number; gross: number; net: number; top: { unit: string; qty: number; more: number } };
  remaining: { byUnit: Record<string, Weighted>; qty: number; gross: number; net: number; top: { unit: string; qty: number; more: number }; reserved: number; inTransit: number };
  /** amounts are never added across currencies: byCurrency holds one line per currency, the top one is shown large */
  payment: { total: number | null; paid: number | null; pending: number | null; currency: string; mixed: boolean; more: number; byCurrency: Record<string, { total: number; paid: number; pending: number }> };
  treatment: { received: number; treated: number; pending: number; untreated: number; loss: number };
  lots: { lots: number; entries: number; bills: number };
}

export interface Perms { view: boolean; add: boolean; edit: boolean; delete: boolean; print: boolean; export: boolean; money: boolean }

export function permissionsOf(session: ErpSession): Perms {
  const may = (resource: string, action: string) => { try { return hasRolePermission(session, resource, action) || isGlobalSession(session); } catch { return false; } };
  return {
    view: may("purchases", "read"),
    add: may("purchases", "create"),
    edit: may("purchases", "update"),
    delete: may("purchases", "delete"),
    print: may("purchases", "read"),
    export: may("reports", "export") || may("purchases", "export"),
    money: isGlobalSession(session) || Boolean(session.canViewFinancials),
  };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Goods-entry extras (weights, price, amount) read from a booking's goods lines
// ──────────────────────────────────────────────────────────────────────────────────────────────

function bookingExtras(formData: unknown, lineCount: number) {
  const data = parseJsonish(formData);
  const form = data?.form && typeof data.form === "object" ? data.form : {};
  const list: any[] = Array.isArray(data?.goodsEntries) ? data.goodsEntries.filter((g: any) => g && typeof g === "object") : [];
  const src = list.length > 0 ? list : [form];
  return Array.from({ length: Math.max(lineCount, 1) }, (_, i) => {
    const g = src[i] ?? {};
    const qty = num(g.qtyNo ?? g.quantity ?? g.qty);
    const net = num(g.netWeight) || num(g.qtyKgs) || (num(g.oneQtyKgs) > 0 ? qty * num(g.oneQtyKgs) : 0);
    const gross = num(g.grossWeight);
    const price = num(g.coursePrice ?? g.rate ?? g.priceRateC1 ?? g.unitPrice);
    const amount = num(g.finalAmount ?? g.totalAmount ?? g.amount);
    return {
      origin: str(g.origin) || str(form.origin) || str(form.originCountry),
      gross: gross > 0 ? gross : 0,
      net: net > 0 ? net : 0,
      unitPrice: price > 0 ? price : null,
      amount: amount > 0 ? amount : null,
      currency: str(g.purchaseCurrency ?? g.currencyType) || str(form.purchaseCurrency ?? form.currencyType),
    };
  });
}

const SALE_PURPOSES = new Set(["local_sale", "export_customer"]);
const saleTypeOf = (purpose: string, so: any) => {
  const form = parseJsonish(so?.form_data)?.form ?? {};
  if (purpose === "export_customer") return "Export";
  if (purpose === "local_sale") return "Local Market";
  const st = str(form.saleType ?? form.saleSource ?? form.saleMode);
  return st ? st.charAt(0).toUpperCase() + st.slice(1) : "Booking";
};
const issueSaleType = (dest: string) => ({ direct_sale: "Direct Sale", export: "Export", local_sales: "Local Market", warehouse: "Goods Issue" } as Record<string, string>)[dest] || "Sale";

function salesParty(so: any) {
  const form = parseJsonish(so?.form_data)?.form ?? {};
  return {
    buyer: str(form.customerAccountName ?? form.customerName) || str(so?.customer_name) || "",
    seller: str(form.salesAccountName) || str(form.salesAccountNo) || "",
    truck: str(form.truckBillNo ?? form.truckNo ?? form.transportReference ?? form.containerNo),
  };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Loader
// ──────────────────────────────────────────────────────────────────────────────────────────────

export async function loadBalance(session: ErpSession, f: BalanceFilters) {
  assertExplicitScopeAllowed(session, { countryId: f.countryId, countryBranchId: f.countryBranchId, cityBranchId: f.cityBranchId });
  authorizeApiScope(session, { resource: "purchases", action: "read", countryId: f.countryId ?? null, countryBranchId: f.countryBranchId ?? null, cityBranchId: f.cityBranchId ?? null });
  const perms = permissionsOf(session);

  const data = await withLocalPg(async (sql) => {
    const scope = sessionSqlScope(session);
    const wantPo = !f.type || f.type === "booking";
    const wantLp = !f.type || f.type === "local";
    const poScope = sql`(${sqlScopeCondition(sql, scope, "po")} OR ${sqlScopeCondition(sql, scope, "po", { prefix: "dest_" })})`;
    const lpScope = sqlScopeCondition(sql, scope, "lp");
    const dateRange = (col: string) => sql`${f.dateFrom ? sql`${sql.unsafe(col)} >= ${f.dateFrom}::timestamptz` : sql`true`} AND ${f.dateTo ? sql`${sql.unsafe(col)} <= ${f.dateTo + "T23:59:59.999Z"}::timestamptz` : sql`true`}`;
    const poPlace = sql`${f.cityBranchId ? sql`(po.city_branch_id = ${f.cityBranchId}::uuid OR po.dest_city_branch_id = ${f.cityBranchId}::uuid)` : sql`true`}
      AND ${!f.cityBranchId && f.countryBranchId ? sql`(po.country_branch_id = ${f.countryBranchId}::uuid OR po.dest_country_branch_id = ${f.countryBranchId}::uuid)` : sql`true`}
      AND ${!f.cityBranchId && !f.countryBranchId && f.countryId ? sql`(po.country_id = ${f.countryId}::uuid OR po.dest_country_id = ${f.countryId}::uuid)` : sql`true`}
      AND ${f.companyId ? sql`coalesce(cib.company_id, cb.company_id) = ${f.companyId}::uuid` : sql`true`}`;
    const lpPlace = sql`${f.cityBranchId ? sql`lp.city_branch_id = ${f.cityBranchId}::uuid` : sql`true`}
      AND ${!f.cityBranchId && f.countryBranchId ? sql`lp.country_branch_id = ${f.countryBranchId}::uuid` : sql`true`}
      AND ${!f.cityBranchId && !f.countryBranchId && f.countryId ? sql`lp.country_id = ${f.countryId}::uuid` : sql`true`}
      AND ${f.companyId ? sql`coalesce(lp.company_id, cib.company_id, cb.company_id) = ${f.companyId}::uuid` : sql`true`}`;

    const pos = wantPo
      ? await sql`
        select po.id, po.purchase_order_no, po.purchase_contract_no, po.country_id, po.country_branch_id, po.city_branch_id, po.status, po.ledger_posting_status,
               po.payment_status, po.purchase_currency, po.currency_code, po.exchange_rate, po.order_total, po.total_goods_original, po.form_data, po.created_at,
               c.name as country_name, c.iso2 as country_code, cb.name as country_branch_name, cib.city_name as city_name,
               coalesce(cib.company_id, cb.company_id) as company_id
        from public.purchase_orders po
        left join public.countries c on c.id = po.country_id
        left join public.country_branches cb on cb.id = po.country_branch_id
        left join public.city_branches cib on cib.id = po.city_branch_id
        where po.deleted_at is null and ${poScope} and ${poPlace} and ${dateRange("po.created_at")}
          and ${f.billId && f.type === "booking" ? sql`po.id = ${f.billId}::uuid` : sql`true`}
          and ${f.billNo ? sql`(po.purchase_order_no ilike ${"%" + f.billNo + "%"} or po.purchase_contract_no ilike ${"%" + f.billNo + "%"})` : sql`true`}
        order by po.created_at desc limit 2000`
      : [];
    const lps = wantLp
      ? await sql`
        select lp.id, lp.goods_id, lp.goods_name, lp.supplier_name, lp.supplier_person_id, lp.quantity_name, lp.quantity_kgs, lp.numbers, lp.net_weight, lp.total_gross_weight, lp.purchase_currency, lp.exchange_rate,
               lp.final_cost, lp.status, lp.manual_bill_no, lp.contract_no, lp.origin_country_name, lp.remarks, lp.country_id, lp.country_branch_id, lp.city_branch_id, lp.created_at,
               lp.purchase_account_no, lp.sales_account_no, c.name as country_name, c.iso2 as country_code, cb.name as country_branch_name, cib.city_name as city_name,
               coalesce(lp.company_id, cib.company_id, cb.company_id) as company_id
        from public.local_purchases lp
        left join public.countries c on c.id = lp.country_id
        left join public.country_branches cb on cb.id = lp.country_branch_id
        left join public.city_branches cib on cib.id = lp.city_branch_id
        where lp.deleted_at is null and coalesce(lp.status,'') not in ('cancelled','deleted') and ${lpScope} and ${lpPlace} and ${dateRange("lp.created_at")}
          and ${f.billId && f.type === "local" ? sql`lp.id = ${f.billId}::uuid` : sql`true`}
          and ${f.billNo ? sql`(lp.manual_bill_no ilike ${"%" + f.billNo + "%"} or lp.contract_no::text ilike ${"%" + f.billNo + "%"} or ('LP-' || coalesce(lp.contract_no::text, left(lp.id::text, 8))) ilike ${"%" + f.billNo + "%"})` : sql`true`}
        order by lp.created_at desc limit 2000`
      : [];
    const poIds = pos.map((p: any) => p.id);
    const lpIds = lps.map((l: any) => l.id);

    const plrs = poIds.length
      ? await sql`select plr.id, plr.purchase_order_id, plr.loading_record_no, plr.lot_name, plr.container_number, plr.bl_number, plr.vehicle_no, plr.loading_status, plr.created_at, plr.loaded_at,
                         plr.loaded_quantity, plr.received_quantity, plr.damaged_quantity, plr.shortage_quantity, plr.receiving_warehouse_id, plr.receiving_goods_id, plr.report_payload
                  from public.purchase_loading_records plr where plr.deleted_at is null and plr.purchase_order_id = any(${poIds}::uuid[]) order by plr.created_at asc, plr.id asc`
      : [];
    const jst = poIds.length
      ? await sql`select j.id, j.transfer_no, j.purchase_order_id, j.loading_record_id, j.line_key, j.destination_type, j.status, j.reserved, j.quantity, j.sales_order_id, j.sales_order_no,
                         j.issue_ref, j.issued_at, j.confirmed_at, j.customer_name, j.warehouse_id
                  from public.journal_stock_transfers j where j.deleted_at is null and j.purchase_order_id = any(${poIds}::uuid[]) and j.status <> 'reversed'`
      : [];
    const lots = lpIds.length
      ? await sql`select l.id, l.lot_ref, l.lot_no, l.line_key, l.local_purchase_id, l.goods_id, l.goods_name, l.brand, l.size, l.origin, l.unit_name, l.qty_purchased, l.net_weight_kg, l.gross_weight_kg,
                         l.currency_code, l.unit_cost, l.original_cost, l.created_at
                  from public.purchase_lots l where l.local_purchase_id = any(${lpIds}::uuid[]) order by l.created_at asc, l.id asc`
      : [];
    const lotIds = lots.map((l: any) => l.id);
    const lotStock = lotIds.length ? await sql`select ls.lot_id, ls.state, ls.warehouse_id, ls.qty from public.lot_stock ls where ls.lot_id = any(${lotIds}::uuid[]) and ls.qty > 0` : [];
    const gts = lotIds.length
      ? await sql`select t.id, t.lot_id, t.purpose, t.status, t.qty, t.sales_order_id, t.created_at, t.completed_at, t.transfer_no, t.dest_warehouse_id, t.source_warehouse_id
                  from public.goods_transfers t where t.lot_id = any(${lotIds}::uuid[])`
      : [];

    // sales: tied through a transfer / issued allocation / the booking itself
    const soIds = [...new Set([...gts.map((t: any) => t.sales_order_id), ...jst.map((j: any) => j.sales_order_id)].filter(Boolean))];
    const salesOrders = poIds.length || soIds.length
      ? await sql`select s.id, s.sales_order_no, s.order_date, s.created_at, s.customer_name, s.purchase_order_id, s.quantity, s.total_weight, s.order_total, s.currency_code, s.total_goods_original,
                         s.form_data, s.ledger_posting_status, s.sales_status
                  from public.sales_orders s where s.deleted_at is null and (s.id = any(${soIds}::uuid[]) or s.purchase_order_id = any(${poIds}::uuid[]))`
      : [];

    const payments = poIds.length || lpIds.length
      ? await sql`select pay.id, pay.purchase_order_id, pay.local_purchase_id, pay.kind, pay.entry_date, pay.amount, pay.base_currency_amount, pay.currency_code, pay.exchange_rate, pay.status::text as status, pay.reference_no,
                         coalesce(ea.name, l.name) as method
                  from public.purchase_order_payments pay
                  left join public.ledgers l on l.id = pay.credit_ledger_id left join public.enterprise_accounts ea on ea.id = l.enterprise_account_id
                  where pay.deleted_at is null and (pay.purchase_order_id = any(${poIds}::uuid[]) or pay.local_purchase_id = any(${lpIds}::uuid[]))
                  order by pay.entry_date asc, pay.created_at asc`
      : [];
    const treatments = poIds.length || lpIds.length
      ? await sql`select t.*, w.warehouse_name from public.stock_treatments t left join public.warehouses w on w.id = t.warehouse_id
                  where t.deleted_at is null and (t.purchase_order_id = any(${poIds}::uuid[]) or t.local_purchase_id = any(${lpIds}::uuid[])) order by t.treatment_date asc, t.created_at asc`
      : [];
    const warehouses = await sql`select w.id, w.warehouse_name from public.warehouses w where w.deleted_at is null`;
    const companies = await sql`select id, coalesce(trade_name, name) as name from public.companies`;

    // sales with no link to any purchase lot, inside the caller's scope (listed on their own)
    const unlinked = !f.billId && !f.lotNo && !f.billNo
      ? await sql`select s.id, s.sales_order_no, s.order_date, s.created_at, s.customer_name, s.purchase_order_id, s.quantity, s.total_weight, s.order_total, s.currency_code, s.total_goods_original, s.form_data, s.sales_status, s.ledger_posting_status
                  from public.sales_orders s
                  where s.deleted_at is null and ${sqlScopeCondition(sql, scope, "s")} and ${f.countryId ? sql`s.country_id = ${f.countryId}::uuid` : sql`true`} and ${dateRange("s.created_at")}
                    and s.purchase_order_id is null
                    and not exists (select 1 from public.goods_transfers t where t.sales_order_id = s.id)
                    and not exists (select 1 from public.journal_stock_transfers j where j.sales_order_id = s.id)
                  order by s.created_at desc limit 500`
      : [];
    return { pos, lps, plrs, jst, lots, lotStock, gts, salesOrders, payments, treatments, warehouses, companies, unlinked };
  });
  if (!data) throw new Error("Unable to load the stock database.");

  const whName = new Map<string, string>(data.warehouses.map((w: any) => [w.id, w.warehouse_name]));
  const companyName = new Map<string, string>(data.companies.map((c: any) => [c.id, c.name]));
  const soById = new Map<string, any>(data.salesOrders.map((s: any) => [s.id, s]));
  const groupBy = <T,>(rows: T[], key: (r: T) => string | null | undefined) => { const m = new Map<string, T[]>(); for (const r of rows) { const k = key(r); if (!k) continue; (m.get(k) ?? m.set(k, []).get(k)!).push(r); } return m; };
  const plrByPo = groupBy(data.plrs, (r: any) => r.purchase_order_id);
  const jstByPo = groupBy(data.jst, (r: any) => r.purchase_order_id);
  const soByPo = groupBy(data.salesOrders, (r: any) => r.purchase_order_id);
  const lotsByLp = groupBy(data.lots, (r: any) => r.local_purchase_id);
  const stockByLot = groupBy(data.lotStock, (r: any) => r.lot_id);
  const gtByLot = groupBy(data.gts, (r: any) => r.lot_id);
  const payByPo = groupBy(data.payments, (r: any) => r.purchase_order_id);
  const payByLp = groupBy(data.payments, (r: any) => r.local_purchase_id);
  const trByPo = groupBy(data.treatments, (r: any) => r.purchase_order_id);
  const trByLp = groupBy(data.treatments, (r: any) => r.local_purchase_id);
  const money = perms.money;

  const bills: BalanceBill[] = [];

  const finishBill = (b: BalanceBill, rawTreatments: any[], rawPayments: any[], billAmount: number | null, billCurrency: string, paymentStatus: string) => {
    // treatment register → per entry + bill list. A treatment's LOSS is a stock adjustment; treated goods stay in their lot (no double count).
    const trByEntry = groupBy(rawTreatments, (t: any) => `${t.lot_no}||${t.entry_key}`);
    for (const e of b.entries) {
      const list = (trByEntry.get(`${e.lotNo}||${e.entryId.split("::").pop()}`) ?? []).map((t: any) => treatmentFigures({ qty_received: num(t.qty_received), qty_treated: num(t.qty_treated), qty_loss: num(t.qty_loss), status: t.status }));
      const sp = treatmentSplit(e.remaining.qty, list);
      e.treatment = { received: sp.received, treated: sp.treated, loss: sp.loss, pending: sp.pending };
      if (sp.loss > EPS) {
        const w = { qty: sp.loss, gross: proportional(e.purchased.gross, sp.loss, e.purchased.qty), net: proportional(e.purchased.net, sp.loss, e.purchased.qty) };
        e.adjusted = add(e.adjusted, w);
        e.remaining = remainingOf(e.purchased, e.sold, e.transferred, e.adjusted);
        e.status = statusOf(e, e.lotNo === NOT_LOADED);
      }
    }
    b.treatments = rawTreatments.map((t: any) => {
      const fg = treatmentFigures({ qty_received: num(t.qty_received), qty_treated: num(t.qty_treated), qty_loss: num(t.qty_loss), status: t.status });
      return {
        id: t.id, treatmentNo: t.treatment_no, billType: b.type, billId: b.id, billNo: b.billNo, lotNo: t.lot_no, entryKey: t.entry_key, goodsName: t.goods_name, unit: t.unit,
        treatmentType: t.treatment_type, treatmentDate: dateOnly(t.treatment_date), received: num(t.qty_received), treated: num(t.qty_treated), pending: fg.pending, loss: num(t.qty_loss),
        finalQty: fg.finalQty, status: t.status, warehouseId: t.warehouse_id, warehouseName: t.warehouse_name ?? (t.warehouse_id ? whName.get(t.warehouse_id) ?? null : null), branchName: b.branchName, remarks: t.remarks,
      };
    });
    b.totals = totalsOf(b.entries);
    // sales tied to the bill but not to a lot count in the bill totals (never silently dropped)
    if (b.unallocatedSales.qty > EPS || b.unallocatedSales.net > EPS) {
      b.totals.sold = add(b.totals.sold, b.unallocatedSales);
      b.totals.remaining = remainingOf(b.totals.purchased, b.totals.sold, b.totals.transferred, b.totals.adjusted);
    }
    b.payments = rawPayments.map((p: any) => ({ id: p.id, date: dateOnly(p.entry_date), kind: str(p.kind), method: str(p.method), amount: money ? num(p.amount) : 0, currency: str(p.currency_code), exchangeRate: p.exchange_rate == null ? null : num(p.exchange_rate), status: str(p.status), referenceNo: p.reference_no ?? null }));
    // 'booking' is the accrual posting of the purchase itself (DR purchase / CR supplier), not a settlement — it is never "paid".
    // Settlements are expressed in the BILL's currency: a payment made in another currency (e.g. AED on a USD bill) is converted through its
    // posted base amount and the bill's own exchange rate, exactly as the payment screens do, so 76,899.375 AED on a USD bill at 3.675 = 20,925 USD.
    const posted = rawPayments.filter((p: any) => str(p.status) === "posted" && str(p.kind) !== "booking");
    const billRate = Number(b.exchangeRate) || 0;
    const inBillCcy = (p: any): number | null => {
      const pc = str(p.currency_code);
      if (!billCurrency || !pc || pc === billCurrency) return num(p.amount);
      if (billRate > 0) return num(p.base_currency_amount != null ? p.base_currency_amount : num(p.amount) * (num(p.exchange_rate) || 1)) / billRate;
      return null; // cannot be converted safely
    };
    const converted = posted.map(inBillCcy);
    b.mixedCurrency = converted.some((x) => x == null);
    b.amount = money ? billAmount : null;
    b.paid = money ? q4(converted.reduce<number>((sum, x) => sum + (x ?? 0), 0)) : null;
    b.pending = money && billAmount != null && !b.mixedCurrency ? Math.max(0, q4(billAmount - (b.paid ?? 0))) : null;
    b.paymentStatus = paymentStatus;
    b.currency = billCurrency || b.currency;
    return b;
  };

  // ── Purchase Bookings ──
  for (const po of data.pos) {
    const { lines, form } = extractPoGoodsLines(po.form_data);
    const extras = bookingExtras(po.form_data, lines.length);
    const facts: LoadingFact[] = (plrByPo.get(po.id) ?? []).map((p: any) => ({
      id: p.id, no: p.loading_record_no || "", containerNo: p.container_number || "", vehicleNo: p.vehicle_no || "", blNumber: p.bl_number || "", createdAt: iso(p.created_at) || "", loadedAt: iso(p.loaded_at),
      loaded: num(p.loaded_quantity), received: p.received_quantity == null ? null : num(p.received_quantity), damaged: num(p.damaged_quantity), shortage: num(p.shortage_quantity), loadingStatus: p.loading_status || "",
      receivingWarehouseId: p.receiving_warehouse_id || null, receivingGoodsId: p.receiving_goods_id || null, customsStatus: "not_recorded", customsSource: "none", payload: p.report_payload,
    }));
    const factById = new Map(facts.map((x) => [x.id, x]));
    const lotNameById = new Map<string, string>((plrByPo.get(po.id) ?? []).map((p: any) => [p.id, str(p.lot_name) || str(p.loading_record_no)]));
    const { chunks } = allocateLoadings(lines, facts);
    const issued = (jstByPo.get(po.id) ?? []).filter((j: any) => j.status === "issued");
    const reservedJ = (jstByPo.get(po.id) ?? []).filter((j: any) => j.status === "confirmed" && j.reserved);
    const currency = str(po.purchase_currency || po.currency_code) || extras[0]?.currency || "";
    const lotCounter = new Map<string, number>();
    const entries: BalanceEntry[] = [];
    const sales: BalanceSale[] = [];
    const mkEntry = (lotNo: string, lineIdx: number, qty: number, o: Partial<BalanceEntry>): BalanceEntry => {
      const line = lines[lineIdx], ex = extras[lineIdx] ?? extras[0];
      const entryNo = (lotCounter.get(lotNo) ?? 0) + 1; lotCounter.set(lotNo, entryNo);
      const purchased: Weighted = { qty: q4(qty), gross: proportional(ex.gross, qty, line.booked), net: proportional(ex.net, qty, line.booked) };
      const e: BalanceEntry = {
        entryId: `po:${po.id}::${lotNo}::${line.lineKey}`, lotNo, entryNo, lotEntryLabel: entryLabel(lotNo, entryNo), goodsName: line.goodsName, goodsId: line.goodsId, brand: line.brand, size: line.size,
        origin: ex.origin, unit: normalizeUnit(line.unit), purchased, sold: zero(), transferred: zero(), adjusted: zero(), reservedQty: 0, inTransitQty: 0, remaining: purchased,
        unitPrice: money ? ex.unitPrice : null, amount: money && ex.amount != null && line.booked > EPS ? q4((ex.amount * qty) / line.booked) : null, currency: ex.currency || currency,
        warehouseId: null, warehouseName: null, loadingRecordId: null, lotRef: null, status: "available", treatment: { received: 0, treated: 0, loss: 0, pending: 0 }, ...o,
      };
      return e;
    };
    for (const [idx, line] of lines.entries()) {
      const lineChunks = chunks.filter((c) => c.lineKey === line.lineKey);
      for (const ch of lineChunks) {
        const lf = factById.get(ch.loadingId)!;
        const lotNo = lotNameById.get(ch.loadingId) || lf.no || NOT_LOADED;
        const e = mkEntry(lotNo, idx, ch.loaded, { loadingRecordId: lf.id, lotRef: lf.no, warehouseId: lf.receivingWarehouseId, warehouseName: lf.receivingWarehouseId ? whName.get(lf.receivingWarehouseId) ?? null : null });
        const ex = extras[idx] ?? extras[0];
        const w = (q: number): Weighted => ({ qty: q4(q), gross: proportional(ex.gross, q, line.booked), net: proportional(ex.net, q, line.booked) });
        e.adjusted = w(ch.damaged + ch.shortage);
        const mine = issued.filter((j: any) => j.loading_record_id === lf.id && (!j.line_key || j.line_key === line.lineKey));
        const soldQty = mine.reduce((s: number, j: any) => s + num(j.quantity), 0);
        e.sold = w(soldQty);
        e.reservedQty = q4(reservedJ.filter((j: any) => j.loading_record_id === lf.id && (!j.line_key || j.line_key === line.lineKey)).reduce((s: number, j: any) => s + num(j.quantity), 0));
        e.inTransitQty = ch.inTransit;
        e.remaining = remainingOf(e.purchased, e.sold, e.transferred, e.adjusted);
        e.status = statusOf(e, false);
        entries.push(e);
        for (const j of mine) {
          const so = j.sales_order_id ? soById.get(j.sales_order_id) : null;
          const party = salesParty(so);
          const q = num(j.quantity);
          sales.push({
            id: `jst:${j.id}`, salesBillNo: str(j.sales_order_no) || str(j.issue_ref) || str(j.transfer_no), salesOrderId: j.sales_order_id ?? null, date: dateOnly(so?.order_date ?? j.issued_at), saleType: issueSaleType(j.destination_type),
            status: "issued", sellerAccount: party.seller, buyerAccount: party.buyer || str(j.customer_name), truckBillNo: party.truck, billType: "booking", billId: po.id, billNo: str(po.purchase_order_no), lotNo, entryId: e.entryId,
            lotEntryLabel: e.lotEntryLabel, goodsName: line.goodsName, unit: normalizeUnit(line.unit), qty: q, gross: w(q).gross, net: w(q).net, amount: money && so ? num(so.order_total) : null, currency: str(so?.currency_code), linked: true,
          });
        }
      }
      const loaded = lineChunks.reduce((s, c) => s + c.loaded, 0);
      const rest = q4(line.booked - loaded);
      if (rest > EPS) entries.push(mkEntry(NOT_LOADED, idx, rest, { status: "not_loaded" }));
    }
    // legacy: sales tied to the booking itself, not to a lot (shown in Sales Details, counted once in the bill totals)
    const linkedNos = new Set(issued.map((j: any) => str(j.sales_order_no)).filter(Boolean));
    const unallocated = zero();
    for (const so of soByPo.get(po.id) ?? []) {
      if (linkedNos.has(str(so.sales_order_no))) continue;
      const party = salesParty(so);
      const form2 = parseJsonish(so.form_data);
      const ge: any[] = Array.isArray(form2?.goodsEntries) ? form2.goodsEntries : [];
      const q = ge.reduce((s, g) => s + num(g.qtyNo ?? g.quantity), 0) || num(so.quantity);
      const net = ge.reduce((s, g) => s + (num(g.netWeight) || num(g.qtyKgs)), 0) || num(so.total_weight);
      const gross = ge.reduce((s, g) => s + num(g.grossWeight), 0);
      unallocated.qty = q4(unallocated.qty + q); unallocated.net = q4(unallocated.net + net); unallocated.gross = q4(unallocated.gross + gross);
      sales.push({
        id: `so:${so.id}`, salesBillNo: str(so.sales_order_no), salesOrderId: so.id, date: dateOnly(so.order_date ?? so.created_at), saleType: saleTypeOf("", so), status: "completed", sellerAccount: party.seller, buyerAccount: party.buyer,
        truckBillNo: party.truck, billType: "booking", billId: po.id, billNo: str(po.purchase_order_no), lotNo: NOT_LOADED, entryId: null, lotEntryLabel: "—", goodsName: str(ge[0]?.goodsName), unit: normalizeUnit(str(ge[0]?.qtyName)), qty: q, gross, net,
        amount: money ? num(so.total_goods_original ?? so.order_total) : null, currency: str(so.currency_code), linked: true,
      });
    }
    const manual = str(form.manualBillNumber || form.billNo || po.purchase_contract_no);
    const acctName = str(form.salesAccountName || form.supplierName || form.purchaseAccountName);
    const bill: BalanceBill = {
      id: po.id, type: "booking", billNo: str(po.purchase_order_no) || "-", manualBillNo: manual && manual !== po.purchase_order_no ? manual : "", date: dateOnly(form.purchaseDate || form.receiptDate || po.created_at),
      purchaseAccountName: acctName, purchaseAccountDetails: [str(form.salesAccountNo || form.purchaseAccountNo), str(form.supplierAddress), str(form.supplierPhone)].filter(Boolean).join(" · "),
      companyId: po.company_id ?? null, companyName: po.company_id ? companyName.get(po.company_id) ?? "" : "", countryId: po.country_id, countryName: po.country_name || "", countryCode: po.country_code || "",
      countryBranchId: po.country_branch_id, cityBranchId: po.city_branch_id, cityName: po.city_name || "", branchName: po.city_name || po.country_branch_name || "",
      originCountry: str(form.origin || form.originCountry || extras[0]?.origin), currency, exchangeRate: po.exchange_rate == null ? null : num(po.exchange_rate), remarks: str(form.remarks),
      amount: null, totals: totalsOf([]), entries, sales, unallocatedSales: unallocated, payments: [], paid: null, pending: null, mixedCurrency: false, treatments: [], paymentStatus: str(po.payment_status),
    };
    bills.push(finishBill(bill, trByPo.get(po.id) ?? [], payByPo.get(po.id) ?? [], num(po.total_goods_original) || num(po.order_total) || null, currency, str(po.payment_status)));
  }

  // ── Local Purchases (lots live in purchase_lots / lot_stock; sales + transfers in the Goods Transfer Journal) ──
  for (const lp of data.lps) {
    const lpLots = lotsByLp.get(lp.id) ?? [];
    const currency = str(lp.purchase_currency);
    const entries: BalanceEntry[] = [];
    const sales: BalanceSale[] = [];
    const lotCounter = new Map<string, number>();
    const bookedQty = num(lp.numbers) > 0 ? num(lp.numbers) : num(lp.quantity_kgs);
    const units = lpLots.length > 0 ? lpLots : [{ id: null, lot_ref: null, lot_no: str(lp.manual_bill_no) || "LOT-1", line_key: "l1", goods_id: lp.goods_id, goods_name: lp.goods_name, brand: "", size: "", origin: lp.origin_country_name, unit_name: lp.quantity_name, qty_purchased: bookedQty, net_weight_kg: num(lp.net_weight) || num(lp.quantity_kgs), gross_weight_kg: num(lp.total_gross_weight), unit_cost: null, original_cost: lp.final_cost }];
    for (const lot of units as any[]) {
      const lotNo = str(lot.lot_no) || str(lot.lot_ref) || "LOT-1";
      const entryNo = (lotCounter.get(lotNo) ?? 0) + 1; lotCounter.set(lotNo, entryNo);
      const qty = num(lot.qty_purchased);
      const gross = num(lot.gross_weight_kg), net = num(lot.net_weight_kg);
      const w = (q: number): Weighted => ({ qty: q4(q), gross: proportional(gross, q, qty), net: proportional(net, q, qty) });
      const transfers = lot.id ? gtByLot.get(lot.id) ?? [] : [];
      const stock = lot.id ? stockByLot.get(lot.id) ?? [] : [];
      const sumState = (...st: string[]) => q4(stock.filter((s: any) => st.includes(s.state)).reduce((a: number, s: any) => a + num(s.qty), 0));
      const done = (p: (t: any) => boolean) => transfers.filter((t: any) => t.status === "completed" && p(t));
      const soldQty = done((t) => SALE_PURPOSES.has(t.purpose)).reduce((a: number, t: any) => a + num(t.qty), 0);
      const branchOut = transfers.filter((t: any) => t.purpose === "export_dgt_branch" && ["in_transit", "completed", "confirmed"].includes(t.status)).reduce((a: number, t: any) => a + num(t.qty), 0);
      const purchased = w(qty);
      const e: BalanceEntry = {
        entryId: `lp:${lp.id}::${lotNo}::${str(lot.line_key) || String(entryNo)}`, lotNo, entryNo, lotEntryLabel: entryLabel(lotNo, entryNo), goodsName: str(lot.goods_name), goodsId: lot.goods_id ?? null,
        brand: str(lot.brand) === "-" ? "" : str(lot.brand), size: str(lot.size) === "-" ? "" : str(lot.size), origin: str(lot.origin) || str(lp.origin_country_name), unit: normalizeUnit(str(lot.unit_name || lp.quantity_name)), purchased, sold: w(soldQty), transferred: w(branchOut),
        adjusted: zero(), reservedQty: sumState("reserved"), inTransitQty: sumState("in_transit", "loading"), remaining: purchased, unitPrice: money && lot.unit_cost != null ? num(lot.unit_cost) : null,
        amount: money && lot.original_cost != null ? num(lot.original_cost) : null, currency: str(lot.currency_code) || currency,
        warehouseId: stock.find((s: any) => s.warehouse_id && ["available", "reserved"].includes(s.state))?.warehouse_id ?? null, warehouseName: null, loadingRecordId: null, lotRef: lot.lot_ref ?? null, status: "available",
        treatment: { received: 0, treated: 0, loss: 0, pending: 0 },
      };
      e.warehouseName = e.warehouseId ? whName.get(e.warehouseId) ?? null : null;
      e.remaining = remainingOf(e.purchased, e.sold, e.transferred, e.adjusted);
      e.status = statusOf(e, false);
      entries.push(e);
      for (const t of transfers.filter((x: any) => SALE_PURPOSES.has(x.purpose) && x.sales_order_id)) {
        const so = soById.get(t.sales_order_id);
        const party = salesParty(so);
        const q = num(t.qty);
        const status = t.status === "completed" ? "completed" : t.status === "cancelled" ? "cancelled" : "reserved";
        sales.push({
          id: `gt:${t.id}`, salesBillNo: str(so?.sales_order_no) || str(t.transfer_no), salesOrderId: t.sales_order_id, date: dateOnly(so?.order_date ?? t.completed_at ?? t.created_at), saleType: saleTypeOf(t.purpose, so), status,
          sellerAccount: party.seller, buyerAccount: party.buyer, truckBillNo: party.truck, billType: "local", billId: lp.id, billNo: str(lp.manual_bill_no) || (lp.contract_no ? `LP-${lp.contract_no}` : `LP-${String(lp.id).slice(0, 8)}`),
          lotNo, entryId: e.entryId, lotEntryLabel: e.lotEntryLabel, goodsName: e.goodsName, unit: e.unit, qty: q, gross: w(q).gross, net: w(q).net, amount: money && so ? num(so.total_goods_original ?? so.order_total) : null, currency: str(so?.currency_code), linked: true,
        });
      }
    }
    const systemNo = lp.contract_no ? `LP-${lp.contract_no}` : str(lp.manual_bill_no) || `LP-${String(lp.id).slice(0, 8)}`;
    const bill: BalanceBill = {
      id: lp.id, type: "local", billNo: systemNo, manualBillNo: str(lp.manual_bill_no) && str(lp.manual_bill_no) !== systemNo ? str(lp.manual_bill_no) : "", date: dateOnly(lp.created_at),
      purchaseAccountName: str(lp.supplier_name), purchaseAccountDetails: str(lp.purchase_account_no), companyId: lp.company_id ?? null, companyName: lp.company_id ? companyName.get(lp.company_id) ?? "" : "",
      countryId: lp.country_id, countryName: lp.country_name || "", countryCode: lp.country_code || "", countryBranchId: lp.country_branch_id, cityBranchId: lp.city_branch_id, cityName: lp.city_name || "",
      branchName: lp.city_name || lp.country_branch_name || "", originCountry: str(lp.origin_country_name) || entries[0]?.origin || "", currency, exchangeRate: lp.exchange_rate == null ? null : num(lp.exchange_rate), remarks: str(lp.remarks),
      amount: null, totals: totalsOf([]), entries, sales, unallocatedSales: zero(), payments: [], paid: null, pending: null, mixedCurrency: false, treatments: [], paymentStatus: "",
    };
    const paidAll = (payByLp.get(lp.id) ?? []).filter((p: any) => str(p.status) === "posted" && str(p.kind) !== "booking").reduce((s: number, p: any) => s + num(p.amount), 0);
    const cost = num(lp.final_cost);
    bills.push(finishBill(bill, trByLp.get(lp.id) ?? [], payByLp.get(lp.id) ?? [], cost > 0 ? cost : null, currency, cost > 0 && paidAll + 0.005 >= cost ? "paid" : paidAll > 0 ? "partial" : "unpaid"));
  }

  // ── bill-level filters that need the assembled model ──
  const lcase = (v?: string) => (v ?? "").toLowerCase().trim();
  let out = bills;
  if (f.lotNo) out = out.filter((b) => b.entries.some((e) => e.lotNo.toLowerCase().includes(lcase(f.lotNo)) || (e.lotRef ?? "").toLowerCase().includes(lcase(f.lotNo))));
  if (f.goodsName) out = out.filter((b) => b.entries.some((e) => e.goodsName.toLowerCase().includes(lcase(f.goodsName))));
  if (f.salesBillNo) out = out.filter((b) => b.sales.some((s) => s.salesBillNo.toLowerCase().includes(lcase(f.salesBillNo))));
  if (f.warehouseId) out = out.filter((b) => b.entries.some((e) => e.warehouseId === f.warehouseId));
  if (f.status) out = out.filter((b) => b.entries.some((e) => e.status === f.status));
  out = [...out].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  // ── unlinked sales (listed separately, only on the global Sales Details view) ──
  const unlinkedSales: BalanceSale[] = (data.unlinked as any[]).map((so) => {
    const party = salesParty(so);
    const form2 = parseJsonish(so.form_data);
    const ge: any[] = Array.isArray(form2?.goodsEntries) ? form2.goodsEntries : [];
    return {
      id: `so:${so.id}`, salesBillNo: str(so.sales_order_no), salesOrderId: so.id, date: dateOnly(so.order_date ?? so.created_at), saleType: saleTypeOf("", so), status: str(so.sales_status) === "cancelled" ? "cancelled" : "completed",
      sellerAccount: party.seller, buyerAccount: party.buyer, truckBillNo: party.truck, billType: null, billId: null, billNo: null, lotNo: "—", entryId: null, lotEntryLabel: "—", goodsName: str(ge[0]?.goodsName), unit: normalizeUnit(str(ge[0]?.qtyName)),
      qty: ge.reduce((s, g) => s + num(g.qtyNo ?? g.quantity), 0) || num(so.quantity), gross: ge.reduce((s, g) => s + num(g.grossWeight), 0), net: ge.reduce((s, g) => s + (num(g.netWeight) || num(g.qtyKgs)), 0) || num(so.total_weight),
      amount: money ? num(so.total_goods_original ?? so.order_total) : null, currency: str(so.currency_code), linked: false,
    };
  });

  await localizeBills(out, unlinkedSales, data.warehouses, f.lang);
  return { bills: out, unlinkedSales, cards: cardsOf(out, perms.money), perms, warehouses: data.warehouses, companies: data.companies };
}

/** Product and warehouse NAMES are master data: shown in the viewer's language, the stored text is never changed. */
async function localizeBills(bills: BalanceBill[], sales: BalanceSale[], warehouses: any[], lang?: SupportedLanguage) {
  if (!lang) return;
  try {
    const goodsIds = new Map<string, { id: string; goods_name: string }>();
    for (const b of bills) for (const e of b.entries) if (e.goodsId && e.goodsName) goodsIds.set(e.goodsId, { id: e.goodsId, goods_name: e.goodsName });
    const gl = await localizeRecordNames([...goodsIds.values()], "goods", "goods_name", lang);
    const gMap = new Map(gl.map((g) => [g.id, g.goods_name]));
    const nameMap = new Map<string, string>();
    for (const b of bills) for (const e of b.entries) { const loc = e.goodsId ? gMap.get(e.goodsId) : null; if (loc) { nameMap.set(e.goodsName.toLowerCase(), loc); e.goodsName = loc; } }
    for (const b of bills) {
      for (const s of b.sales) s.goodsName = nameMap.get(s.goodsName.toLowerCase()) ?? s.goodsName;
      for (const t of b.treatments) t.goodsName = nameMap.get(t.goodsName.toLowerCase()) ?? t.goodsName;
    }
    const wl = await localizeRecordNames(warehouses.map((w: any) => ({ id: w.id, warehouse_name: w.warehouse_name })), "warehouses", "warehouse_name", lang);
    const wMap = new Map(wl.map((w) => [w.id, w.warehouse_name]));
    for (const b of bills) {
      for (const e of b.entries) if (e.warehouseId && wMap.get(e.warehouseId)) e.warehouseName = wMap.get(e.warehouseId)!;
      for (const t of b.treatments) if (t.warehouseId && wMap.get(t.warehouseId)) t.warehouseName = wMap.get(t.warehouseId)!;
    }
    for (const w of warehouses) if (wMap.get(w.id)) w.warehouse_name = wMap.get(w.id);
    void sales;
  } catch {
    /* a courtesy — the stored names stay */
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Dashboard cards
// ──────────────────────────────────────────────────────────────────────────────────────────────

export function cardsOf(bills: BalanceBill[], money: boolean): BalanceCards {
  const purchased = mergeUnitTotals(bills.map((b) => b.totals.byUnit.purchased));
  const sold = mergeUnitTotals(bills.map((b) => b.totals.byUnit.sold));
  const remaining = mergeUnitTotals(bills.map((b) => b.totals.byUnit.remaining));
  const sum = (m: Record<string, Weighted>) => Object.values(m).reduce((a, w) => add(a, w), zero());
  const top = (m: Record<string, Weighted>) => { const t = topUnit(m); return { unit: t.unit, qty: t.w.qty, more: t.more }; };
  const all = bills.flatMap((b) => b.entries);
  const split = treatmentSplit(q4(all.reduce((s, e) => s + e.remaining.qty, 0)), all.map((e) => e.treatment));
  const byCurrency: Record<string, { total: number; paid: number; pending: number }> = {};
  if (money) {
    for (const b of bills) {
      const cur = b.currency || "—";
      const row = byCurrency[cur] ?? (byCurrency[cur] = { total: 0, paid: 0, pending: 0 });
      row.total = q4(row.total + (b.amount ?? 0));
      row.paid = q4(row.paid + (b.paid ?? 0));
    }
    for (const row of Object.values(byCurrency)) row.pending = Math.max(0, q4(row.total - row.paid));
  }
  const ranked = Object.entries(byCurrency).sort((x, y) => y[1].total - x[1].total);
  const top1 = ranked[0];
  return {
    purchase: { byUnit: purchased, qty: sum(purchased).qty, gross: sum(purchased).gross, net: sum(purchased).net, top: top(purchased) },
    sales: { byUnit: sold, qty: sum(sold).qty, gross: sum(sold).gross, net: sum(sold).net, top: top(sold) },
    remaining: { byUnit: remaining, qty: sum(remaining).qty, gross: sum(remaining).gross, net: sum(remaining).net, top: top(remaining), reserved: q4(all.reduce((s, e) => s + e.reservedQty, 0)), inTransit: q4(all.reduce((s, e) => s + e.inTransitQty, 0)) },
    payment: { total: top1 ? top1[1].total : null, paid: top1 ? top1[1].paid : null, pending: top1 ? top1[1].pending : null, currency: top1 ? top1[0] : "", mixed: ranked.length > 1 || bills.some((b) => b.mixedCurrency), more: Math.max(0, ranked.length - 1), byCurrency },
    treatment: { received: split.received, treated: split.treated, pending: split.pending, untreated: split.untreated, loss: split.loss },
    lots: { lots: bills.reduce((s, b) => s + b.totals.lots, 0), entries: bills.reduce((s, b) => s + b.totals.entries, 0), bills: bills.length },
  };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Lot report
// ──────────────────────────────────────────────────────────────────────────────────────────────

export async function loadLotReport(session: ErpSession, ref: { type: BillType; billId: string; lotNo: string; lang?: SupportedLanguage }) {
  const { bills, perms } = await loadBalance(session, { type: ref.type, billId: ref.billId, lang: ref.lang });
  const bill = bills[0];
  if (!bill) throw new ApiClientError("Purchase bill not found or outside your scope.", { status: 404, code: "NOT_FOUND" });
  const entries = bill.entries.filter((e) => e.lotNo === ref.lotNo);
  if (entries.length === 0) throw new ApiClientError("Lot not found on this bill.", { status: 404, code: "NOT_FOUND" });
  const ids = new Set(entries.map((e) => e.entryId));
  const sales = bill.sales.filter((s) => (s.entryId && ids.has(s.entryId)) || (!s.entryId && ref.lotNo === "—"));
  const treatments = bill.treatments.filter((t) => t.lotNo === ref.lotNo);
  const totals = totalsOf(entries);
  const transfers = await withLocalPg(async (sql) => {
    if (ref.type === "local") {
      const lotRefs = entries.map((e) => e.lotRef).filter(Boolean) as string[];
      return sql`select t.transfer_no, t.purpose, t.status, t.qty::float qty, t.created_at, t.completed_at, ws.warehouse_name as from_wh, wd.warehouse_name as to_wh, l.lot_ref
                 from public.goods_transfers t join public.purchase_lots l on l.id = t.lot_id
                 left join public.warehouses ws on ws.id = t.source_warehouse_id left join public.warehouses wd on wd.id = t.dest_warehouse_id
                 where l.local_purchase_id = ${ref.billId}::uuid and l.lot_ref = any(${lotRefs}::text[]) order by t.created_at asc`;
    }
    const loadingIds = entries.map((e) => e.loadingRecordId).filter(Boolean) as string[];
    if (loadingIds.length === 0) return [];
    return sql`select j.transfer_no, j.destination_type as purpose, j.status, j.quantity::float qty, j.created_at, j.issued_at as completed_at, w.warehouse_name as to_wh, null::text as from_wh, null::text as lot_ref
               from public.journal_stock_transfers j left join public.warehouses w on w.id = j.warehouse_id
               where j.loading_record_id = any(${loadingIds}::uuid[]) and j.deleted_at is null order by j.created_at asc`;
  });
  return { bill: { id: bill.id, type: bill.type, billNo: bill.billNo, manualBillNo: bill.manualBillNo, date: bill.date, countryName: bill.countryName, branchName: bill.branchName, companyName: bill.companyName, currency: bill.currency, purchaseAccountName: bill.purchaseAccountName },
    lotNo: ref.lotNo, entries, sales, treatments, totals, transfers: (transfers ?? []).map((t: any) => ({ ...t, created_at: iso(t.created_at), completed_at: iso(t.completed_at) })), perms };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Filter options (follow the logged-in user's scope)
// ──────────────────────────────────────────────────────────────────────────────────────────────

export async function loadFilterOptions(session: ErpSession) {
  const data = await withLocalPg(async (sql) => {
    const scope = sessionSqlScope(session);
    const countries = await sql`select distinct c.id, c.name from public.countries c where ${scope.kind === "all" ? sql`true` : scope.kind === "none" ? sql`false` : sql`c.id = any(${session.countryIds ?? []}::uuid[])`} order by c.name`;
    const branches = await sql`
      select cb.id, cb.name, cb.country_id, cb.company_id from public.country_branches cb
      where cb.deleted_at is null and ${scope.kind === "all" ? sql`true` : scope.kind === "none" ? sql`false` : scope.kind === "country" ? sql`cb.country_id = any(${scope.ids}::uuid[])` : scope.kind === "countryBranch" ? sql`cb.id = any(${scope.ids}::uuid[])` : sql`cb.id = any(${(scope as any).ownCountryBranchIds ?? []}::uuid[])`}
      order by cb.name`;
    const cities = await sql`
      select cib.id, cib.city_name as name, cib.country_branch_id, cib.company_id from public.city_branches cib
      where cib.deleted_at is null and ${scope.kind === "all" ? sql`true` : scope.kind === "none" ? sql`false` : scope.kind === "country" ? sql`cib.country_id = any(${scope.ids}::uuid[])` : scope.kind === "countryBranch" ? sql`cib.country_branch_id = any(${scope.ids}::uuid[])` : sql`(cib.id = any(${scope.ids}::uuid[]) or cib.country_branch_id = any(${(scope as any).ownCountryBranchIds ?? []}::uuid[]))`}
      order by cib.city_name`;
    const companies = await sql`select id, coalesce(trade_name, name) as name from public.companies where id in (select company_id from public.country_branches where company_id is not null union select company_id from public.city_branches where company_id is not null) order by 2`;
    const warehouses = await sql`select w.id, w.warehouse_name as name, w.country_id from public.warehouses w where w.deleted_at is null and coalesce(w.is_active, true) and ${scope.kind === "all" ? sql`true` : scope.kind === "none" ? sql`false` : sql`(w.country_id is null or w.country_id = any(${session.countryIds ?? []}::uuid[]))`} order by w.warehouse_name`;
    return { countries, branches, cities, companies, warehouses };
  });
  if (!data) throw new Error("Unable to load filter options.");
  // a company filter never widens access: it only lists companies that own a branch inside the viewer's scope
  const allowedCompanies = new Set([...data.branches.map((b: any) => b.company_id), ...data.cities.map((c: any) => c.company_id)].filter(Boolean));
  return { ...data, companies: isGlobalSession(session) ? data.companies : data.companies.filter((c: any) => allowedCompanies.has(c.id)) };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Treatment register (add / edit / cancel) — information only: stock never moves
// ──────────────────────────────────────────────────────────────────────────────────────────────

export type TreatmentInput = {
  idempotencyKey: string;
  billType: BillType;
  billId: string;
  lotNo: string;
  entryKey: string;
  treatmentType: string;
  treatmentDate?: string | null;
  qtyReceived: number;
  qtyTreated?: number;
  qtyLoss?: number;
  status?: "pending" | "in_progress" | "completed";
  warehouseId?: string | null;
  remarks?: string | null;
};

async function treatmentTarget(session: ErpSession, action: "read" | "update", billType: BillType, billId: string, lotNo: string, entryKey: string) {
  const { bills } = await loadBalance(session, { type: billType, billId });
  const bill = bills[0];
  if (!bill) throw new ApiClientError("Purchase bill not found or outside your scope.", { status: 404, code: "NOT_FOUND" });
  assertRecordAccess(session, action, { country_id: bill.countryId, country_branch_id: bill.countryBranchId, city_branch_id: bill.cityBranchId });
  const entry = bill.entries.find((e) => e.lotNo === lotNo && e.entryId.split("::").pop() === entryKey);
  if (!entry) throw new ApiClientError("That lot entry was not found on this bill.", { status: 404, code: "NOT_FOUND" });
  return { bill, entry };
}

export async function createTreatment(session: ErpSession, input: TreatmentInput) {
  const received = q4(input.qtyReceived), treated = q4(input.qtyTreated ?? 0), loss = q4(input.qtyLoss ?? 0);
  if (!(received > 0)) throw new ApiClientError("Quantity received for treatment must be greater than zero.", { status: 400, code: "BAD_QTY" });
  if (treated + loss > received + EPS) throw new ApiClientError("Treated + loss cannot exceed the quantity received for treatment.", { status: 400, code: "BAD_QTY" });
  const { bill, entry } = await treatmentTarget(session, "update", input.billType, input.billId, input.lotNo, input.entryKey);
  const result = await withLocalPg((sql) =>
    sql.begin(async (tx: Tx) => {
      const prior = await tx`select * from public.stock_treatments where idempotency_key = ${input.idempotencyKey} limit 1`;
      if (prior[0]) return { treatment: prior[0], replayed: true };
      // serialize on the bill so two users cannot both treat the last units
      if (bill.type === "booking") await tx`select 1 from public.purchase_orders where id = ${bill.id}::uuid for update`;
      else await tx`select 1 from public.local_purchases where id = ${bill.id}::uuid for update`;
      const already = await tx`select coalesce(sum(greatest(qty_received - qty_treated - qty_loss, 0)), 0)::float as n from public.stock_treatments where deleted_at is null and status <> 'cancelled' and ${bill.type === "booking" ? tx`purchase_order_id = ${bill.id}::uuid` : tx`local_purchase_id = ${bill.id}::uuid`} and lot_no = ${input.lotNo} and entry_key = ${input.entryKey}`;
      const room = maxTreatable(entry.remaining.qty, Number(already[0].n));
      if (received > room + EPS) throw new ApiClientError(`Only ${room} ${entry.unit} of this entry is available for treatment (received for treatment is limited to the stock still on hand).`, { status: 409, code: "EXCEEDS_AVAILABLE" });
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      await tx`select pg_advisory_xact_lock(hashtext('stock_treatments.treatment_no'))`;
      const [{ n }] = await tx`select count(*)::int n from public.stock_treatments where treatment_no like ${"TRT-" + day + "-%"}`;
      const no = `TRT-${day}-${String(Number(n) + 1).padStart(4, "0")}`;
      const status = input.status ?? (treated + loss >= received - EPS ? "completed" : treated > 0 ? "in_progress" : "pending");
      const rows = await tx`
        insert into public.stock_treatments (treatment_no, bill_type, purchase_order_id, local_purchase_id, lot_no, entry_key, goods_name, unit, treatment_type, treatment_date, qty_received, qty_treated, qty_loss, status,
          warehouse_id, remarks, country_id, country_branch_id, city_branch_id, idempotency_key, created_by)
        values (${no}, ${bill.type}, ${bill.type === "booking" ? bill.id : null}::uuid, ${bill.type === "local" ? bill.id : null}::uuid, ${input.lotNo}, ${input.entryKey}, ${entry.goodsName}, ${entry.unit}, ${input.treatmentType.trim()},
          ${(input.treatmentDate || new Date().toISOString()).slice(0, 10)}::date, ${received}, ${treated}, ${loss}, ${status}, ${input.warehouseId ?? entry.warehouseId}::uuid, ${input.remarks ?? null},
          ${bill.countryId}::uuid, ${bill.countryBranchId}::uuid, ${bill.cityBranchId}::uuid, ${input.idempotencyKey}, ${session.userId}::uuid)
        returning *`;
      return { treatment: rows[0], replayed: false };
    }),
  );
  if (!result) throw new Error("Unable to save the treatment.");
  return result;
}

export async function updateTreatment(session: ErpSession, input: { id: string; qtyTreated?: number; qtyLoss?: number; status?: "pending" | "in_progress" | "completed"; remarks?: string | null; treatmentType?: string }) {
  const result = await withLocalPg((sql) =>
    sql.begin(async (tx: Tx) => {
      const row = (await tx`select * from public.stock_treatments where id = ${input.id}::uuid and deleted_at is null for update`)[0];
      if (!row) throw new ApiClientError("Treatment not found.", { status: 404, code: "NOT_FOUND" });
      assertRecordAccess(session, "update", row);
      if (row.status === "cancelled") throw new ApiClientError("A cancelled treatment cannot be changed.", { status: 409, code: "CANCELLED" });
      const treated = q4(input.qtyTreated ?? num(row.qty_treated)), loss = q4(input.qtyLoss ?? num(row.qty_loss)), received = num(row.qty_received);
      if (treated + loss > received + EPS) throw new ApiClientError("Treated + loss cannot exceed the quantity received for treatment.", { status: 400, code: "BAD_QTY" });
      const status = input.status ?? (treated + loss >= received - EPS ? "completed" : treated > 0 ? "in_progress" : "pending");
      const u = await tx`update public.stock_treatments set qty_treated = ${treated}, qty_loss = ${loss}, status = ${status}, remarks = coalesce(${input.remarks ?? null}, remarks),
                         treatment_type = coalesce(${input.treatmentType?.trim() || null}, treatment_type), updated_by = ${session.userId}::uuid where id = ${row.id}::uuid returning *`;
      return u[0];
    }),
  );
  return result;
}

export async function cancelTreatment(session: ErpSession, input: { id: string; reason: string }) {
  if ((input.reason || "").trim().length < 3) throw new ApiClientError("Enter the reason for cancelling the treatment.", { status: 400, code: "REASON_REQUIRED" });
  return withLocalPg((sql) =>
    sql.begin(async (tx: Tx) => {
      const row = (await tx`select * from public.stock_treatments where id = ${input.id}::uuid and deleted_at is null for update`)[0];
      if (!row) throw new ApiClientError("Treatment not found.", { status: 404, code: "NOT_FOUND" });
      assertRecordAccess(session, "update", row);
      if (!hasRolePermission(session, "purchases", "delete") && !isGlobalSession(session)) throw new ApiClientError("Missing permission: purchases:delete", { status: 403, code: "FORBIDDEN" });
      const u = await tx`update public.stock_treatments set status = 'cancelled', remarks = coalesce(remarks || E'\n', '') || ${"Cancelled: " + input.reason.trim()}, updated_by = ${session.userId}::uuid where id = ${row.id}::uuid returning *`;
      return u[0];
    }),
  );
}
