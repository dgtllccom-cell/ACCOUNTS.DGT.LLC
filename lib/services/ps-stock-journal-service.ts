/**
 * Server-side Stock Journal & P/S Journal loader.
 *
 * Reuses the ERP's authoritative business tables ONLY (strictly separate from Shipping/Clearing):
 *   - Purchase Bookings : purchase_orders + purchase_loading_records + journal_stock_transfers
 *   - Local Purchases   : local_purchases + purchase_lots + lot_stock + goods_transfers
 *   - Opening/WH Stock  : product_inventory_balances (excess not already in purchase_lots / journal_stock_transfers)
 *   - Adjustments       : stock_treatments (loss) + damaged/shortage quantities on loading records
 *   - Sales             : sales_orders (reconciled once across journal_stock_transfers, goods_transfers,
 *                         stockLotNo/lotNo line allocations, and purchase_order_id links — never double-counted)
 *
 * Role & Scope Enforcement:
 *   - Super Admin   : All authorized countries and branches
 *   - Country Admin : Own country and authorized branches
 *   - Branch Admin  : Own branch only
 *   Enforced server-side via assertExplicitScopeAllowed + sessionSqlScope / sqlScopeCondition.
 */

import type { ErpSession } from "@/lib/auth/session";
import { ApiClientError } from "@/lib/api/response";
import {
  assertExplicitScopeAllowed,
  authorizeApiScope,
  sessionSqlScope,
  sqlScopeCondition,
} from "@/lib/api/scope-middleware";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { isGlobalSession } from "@/lib/permissions/middleware";
import { localPurchaseBillNo, localPurchaseContractRef } from "@/lib/purchases/local-purchase-number";
import { proportional, treatmentFigures, treatmentSplit } from "@/lib/stock-balance/model";
import { allocateLoadings, EPS, extractPoGoodsLines, parseJsonish, q4, type LoadingFact } from "@/lib/stock-journal/model";
import {
  buildJournalBookingStockView,
  buildPsJournalView,
  buildPsLotDetailView,
  normalizeStockUnit,
  type PsAdvancedFilters,
  type PsSaleItem,
  type PsStockChunk,
  type StockRoleTier,
} from "@/lib/stock/ps-journal-model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v == null ? "" : String(v).trim());
const cleanDash = (v: unknown): string => {
  const s = str(v);
  return s === "-" || s === "—" ? "" : s;
};
const dateOnly = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? str(v).slice(0, 10) || null : d.toISOString().slice(0, 10);
};
const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function resolveStockRoleTier(session: ErpSession): StockRoleTier {
  const roles = session.roles ?? [];
  if (
    isGlobalSession(session) ||
    roles.includes("super_admin") ||
    roles.includes("super_admin_reports") ||
    roles.includes("business_super_admin")
  ) {
    return "super_admin";
  }
  if (roles.includes("country_admin") || roles.includes("country_user")) {
    return "country_admin";
  }
  return "branch_admin";
}

function authorizeStockRead(
  session: ErpSession,
  scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null },
) {
  assertExplicitScopeAllowed(session, {
    countryId: scope.countryId ?? undefined,
    countryBranchId: scope.countryBranchId ?? undefined,
    cityBranchId: scope.cityBranchId ?? undefined,
  });

  const candidates = ["purchases", "inventory", "sales", "reports"] as const;
  let lastErr: unknown = null;
  for (const resource of candidates) {
    try {
      authorizeApiScope(session, {
        resource,
        action: "read",
        countryId: scope.countryId ?? null,
        countryBranchId: scope.countryBranchId ?? null,
        cityBranchId: scope.cityBranchId ?? null,
      });
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function parseBranchParam(branchParam?: string): { countryBranchId?: string; cityBranchId?: string; raw?: string } {
  const b = str(branchParam);
  if (!b) return {};
  if (b.startsWith("city:")) return { cityBranchId: b.slice(5), raw: b.slice(5) };
  if (b.startsWith("main:")) return { countryBranchId: b.slice(5), raw: b.slice(5) };
  return { raw: b };
}

function extractSaleHeader(so: Row) {
  const fd = parseJsonish(so?.form_data);
  const form = fd?.form && typeof fd.form === "object" ? fd.form : {};
  const customerName =
    cleanDash(form.customerAccountName ?? form.customerName ?? so?.customer_name) || "—";
  const customerNo =
    cleanDash(form.customerAccountNo ?? so?.account_number ?? so?.customer_number) || "";
  const salesAcctName = cleanDash(form.salesAccountName) || "";
  const salesAcctNo = cleanDash(form.salesAccountNo) || "";
  const blNo = cleanDash(form.blNumber ?? form.blNo ?? form.billOfLadingNo);
  const containerNo = cleanDash(form.containerNo ?? form.containerNumber ?? form.truckNo ?? form.truckBillNo);
  const manualBillNo = cleanDash(form.manualBillNumber ?? form.billNo ?? so?.sales_contract_no);
  const rawType = cleanDash(form.saleType ?? form.saleSource ?? form.saleMode);
  const saleType =
    rawType.toLowerCase() === "local"
      ? "Local Sale"
      : rawType
        ? rawType.charAt(0).toUpperCase() + rawType.slice(1)
        : "Sales Booking";
  const date = dateOnly(form.salesDate ?? form.purchaseDate ?? so?.order_date ?? so?.created_at);
  const goodsEntries: Row[] = Array.isArray(fd?.goodsEntries)
    ? fd.goodsEntries.filter((g: Row) => g && typeof g === "object")
    : form.goodsName
      ? [form]
      : [];

  return {
    fd,
    form,
    customerName,
    accountNo: customerNo || salesAcctNo || "—",
    accountName: customerName !== "—" ? customerName : salesAcctName || "—",
    blNo,
    containerNo,
    manualBillNo,
    saleType,
    date,
    goodsEntries,
  };
}

export interface PsFilterOptionSet {
  role: StockRoleTier;
  lockedCountryId: string | null;
  lockedBranchId: string | null;
  countries: Array<{ id: string; name: string; code: string }>;
  branches: Array<{ id: string; value: string; name: string; code: string; countryId: string | null }>;
  warehouses: Array<{ id: string; name: string; countryId: string | null; cityBranchId: string | null }>;
  goods: string[];
  origins: string[];
  lots: string[];
}

export async function loadCanonicalPsStockChunks(
  session: ErpSession,
  opts: {
    countryId?: string;
    branchParam?: string;
    lang?: SupportedLanguage;
  },
): Promise<{ chunks: PsStockChunk[]; filterOptions: PsFilterOptionSet }> {
  const parsedBranch = parseBranchParam(opts.branchParam);
  authorizeStockRead(session, {
    countryId: opts.countryId ?? null,
    countryBranchId: parsedBranch.countryBranchId ?? null,
    cityBranchId: parsedBranch.cityBranchId ?? null,
  });

  const role = resolveStockRoleTier(session);

  const runDb = <T,>(fn: Parameters<typeof withLocalPg<T>>[0]) =>
    withReadPg(fn).then((r) => (r !== null ? r : withLocalPg(fn)));

  const raw = await runDb(async (sql) => {
    const scope = sessionSqlScope(session);
    const poScope = sql`(${sqlScopeCondition(sql, scope, "po")} OR ${sqlScopeCondition(sql, scope, "po", { prefix: "dest_" })})`;
    const lpScope = sqlScopeCondition(sql, scope, "lp");
    const soScope = sqlScopeCondition(sql, scope, "s");
    const pibScope = sqlScopeCondition(sql, scope, "pib");

    const [
      countries,
      countryBranches,
      cityBranches,
      warehouses,
      pos,
      lps,
    ] = await Promise.all([
      sql`
        SELECT DISTINCT c.id::text AS id, c.name, coalesce(c.iso2, '') AS code
        FROM public.countries c
        WHERE ${
          scope.kind === "all"
            ? sql`true`
            : scope.kind === "none"
              ? sql`false`
              : sql`c.id = ANY(${session.countryIds ?? []}::uuid[])`
        }
        ORDER BY c.name
      `,
      sql`
        SELECT cb.id::text AS id, cb.name, coalesce(cb.code, '') AS code, cb.country_id::text AS country_id
        FROM public.country_branches cb
        WHERE cb.deleted_at IS NULL
          AND ${
            scope.kind === "all"
              ? sql`true`
              : scope.kind === "none"
                ? sql`false`
                : scope.kind === "country"
                  ? sql`cb.country_id = ANY(${scope.ids}::uuid[])`
                  : scope.kind === "countryBranch"
                    ? sql`cb.id = ANY(${scope.ids}::uuid[])`
                    : sql`cb.id = ANY(${(scope as Row).ownCountryBranchIds ?? []}::uuid[])`
          }
        ORDER BY cb.name
      `,
      sql`
        SELECT cib.id::text AS id, coalesce(cib.name, cib.city_name) AS name, coalesce(cib.code, '') AS code,
               cib.country_id::text AS country_id, cib.country_branch_id::text AS country_branch_id
        FROM public.city_branches cib
        WHERE cib.deleted_at IS NULL
          AND ${
            scope.kind === "all"
              ? sql`true`
              : scope.kind === "none"
                ? sql`false`
                : scope.kind === "country"
                  ? sql`cib.country_id = ANY(${scope.ids}::uuid[])`
                  : scope.kind === "countryBranch"
                    ? sql`cib.country_branch_id = ANY(${scope.ids}::uuid[])`
                    : sql`cib.id = ANY(${scope.ids}::uuid[])`
          }
        ORDER BY 2
      `,
      sql`
        SELECT w.id::text AS id, w.warehouse_name AS name, w.country_id::text AS country_id, null::text AS city_branch_id
        FROM public.warehouses w
        WHERE w.deleted_at IS NULL AND coalesce(w.is_active, true)
          AND ${
            scope.kind === "all"
              ? sql`true`
              : scope.kind === "none"
                ? sql`false`
                : sql`(w.country_id IS NULL OR w.country_id = ANY(${session.countryIds ?? []}::uuid[]))`
          }
        ORDER BY w.warehouse_name
      `,
      sql`
        SELECT po.id::text AS id, po.purchase_order_no, po.purchase_contract_no,
               po.country_id::text AS country_id, po.country_branch_id::text AS country_branch_id, po.city_branch_id::text AS city_branch_id,
               po.status, po.ledger_posting_status, po.form_data, po.created_at,
               c.name AS country_name, coalesce(c.iso2, '') AS country_code,
               cb.name AS country_branch_name, coalesce(cb.code, '') AS country_branch_code,
               coalesce(cib.name, cib.city_name) AS city_branch_name, coalesce(cib.code, '') AS city_branch_code
        FROM public.purchase_orders po
        LEFT JOIN public.countries c ON c.id = po.country_id
        LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
        LEFT JOIN public.city_branches cib ON cib.id = po.city_branch_id
        WHERE po.deleted_at IS NULL
          AND coalesce(po.status::text, '') NOT IN ('cancelled', 'deleted', 'rejected')
          AND ${poScope}
        ORDER BY po.created_at DESC
        LIMIT 2500
      `,
      sql`
        SELECT lp.id::text AS id, lp.goods_id::text AS goods_id, lp.goods_name, lp.brand, lp.size,
               lp.supplier_name, lp.quantity_name, lp.quantity_kgs, lp.numbers, lp.net_weight, lp.total_gross_weight,
               lp.status, lp.manual_bill_no, lp.contract_no, lp.lot_no, lp.truck_no, lp.warehouse_name,
               lp.origin_country_name, lp.purchase_account_no, lp.sales_account_no,
               lp.country_id::text AS country_id, lp.country_branch_id::text AS country_branch_id, lp.city_branch_id::text AS city_branch_id,
               lp.created_at,
               c.name AS country_name, coalesce(c.iso2, '') AS country_code,
               cb.name AS country_branch_name, coalesce(cb.code, '') AS country_branch_code,
               coalesce(cib.name, cib.city_name) AS city_branch_name, coalesce(cib.code, '') AS city_branch_code
        FROM public.local_purchases lp
        LEFT JOIN public.countries c ON c.id = lp.country_id
        LEFT JOIN public.country_branches cb ON cb.id = lp.country_branch_id
        LEFT JOIN public.city_branches cib ON cib.id = lp.city_branch_id
        WHERE lp.deleted_at IS NULL
          AND coalesce(lp.status::text, '') NOT IN ('cancelled', 'deleted')
          AND ${lpScope}
        ORDER BY lp.created_at DESC
        LIMIT 2500
      `,
    ]);

    const poIds = pos.map((p: Row) => p.id);
    const lpIds = lps.map((l: Row) => l.id);

    const [plrs, jst, lots, treatments, pibOpening] = await Promise.all([
      poIds.length
        ? sql`
            SELECT plr.id::text AS id, plr.purchase_order_id::text AS purchase_order_id,
                   plr.loading_record_no, plr.lot_name, plr.container_number, plr.bl_number, plr.vehicle_no,
                   plr.loading_status, plr.created_at, plr.loaded_at,
                   plr.loaded_quantity, plr.received_quantity, plr.damaged_quantity, plr.shortage_quantity,
                   plr.receiving_warehouse_id::text AS receiving_warehouse_id, plr.receiving_goods_id::text AS receiving_goods_id,
                   plr.report_payload
            FROM public.purchase_loading_records plr
            WHERE plr.deleted_at IS NULL AND plr.purchase_order_id = ANY(${poIds}::uuid[])
            ORDER BY plr.created_at ASC, plr.id ASC
          `
        : Promise.resolve([]),
      poIds.length
        ? sql`
            SELECT j.id::text AS id, j.transfer_no, j.purchase_order_id::text AS purchase_order_id,
                   j.loading_record_id::text AS loading_record_id, j.line_key, j.destination_type,
                   j.status, j.reserved, j.quantity, j.sales_order_id::text AS sales_order_id,
                   j.sales_order_no, j.issue_ref, j.issued_at, j.confirmed_at, j.customer_name,
                   j.warehouse_id::text AS warehouse_id
            FROM public.journal_stock_transfers j
            WHERE j.deleted_at IS NULL
              AND j.purchase_order_id = ANY(${poIds}::uuid[])
              AND j.status <> 'reversed'
          `
        : Promise.resolve([]),
      lpIds.length
        ? sql`
            SELECT l.id::text AS id, l.lot_ref, l.lot_no, l.line_key, l.local_purchase_id::text AS local_purchase_id,
                   l.goods_id::text AS goods_id, l.goods_name, l.brand, l.size, l.origin, l.unit_name,
                   l.qty_purchased, l.net_weight_kg, l.gross_weight_kg, l.created_at
            FROM public.purchase_lots l
            WHERE l.local_purchase_id = ANY(${lpIds}::uuid[])
            ORDER BY l.created_at ASC, l.id ASC
          `
        : Promise.resolve([]),
      poIds.length || lpIds.length
        ? sql`
            SELECT t.purchase_order_id::text AS purchase_order_id, t.local_purchase_id::text AS local_purchase_id,
                   t.lot_no, t.entry_key, t.qty_received, t.qty_treated, t.qty_loss, t.status
            FROM public.stock_treatments t
            WHERE t.deleted_at IS NULL
              AND t.status <> 'cancelled'
              AND (
                ${poIds.length ? sql`t.purchase_order_id = ANY(${poIds}::uuid[])` : sql`false`}
                OR ${lpIds.length ? sql`t.local_purchase_id = ANY(${lpIds}::uuid[])` : sql`false`}
              )
          `
        : Promise.resolve([]),
      sql`
        SELECT pib.id::text AS id, pib.product_id::text AS goods_id,
               pib.warehouse_id::text AS warehouse_id,
               pib.country_id::text AS country_id, pib.country_branch_id::text AS country_branch_id, pib.city_branch_id::text AS city_branch_id,
               g.goods_name, w.warehouse_name, w.warehouse_code,
               c.name AS country_name, coalesce(c.iso2, '') AS country_code,
               cb.name AS country_branch_name, coalesce(cib.name, cib.city_name) AS city_branch_name,
               pib.updated_at,
               GREATEST(0, coalesce(pib.quantity_on_hand, pib.quantity_available, 0)
                 - coalesce((
                     SELECT sum(ls.qty) FROM public.lot_stock ls
                     JOIN public.purchase_lots pl ON pl.id = ls.lot_id
                     WHERE pl.goods_id = pib.product_id AND ls.warehouse_id = pib.warehouse_id AND ls.state IN ('available', 'reserved')
                   ), 0)
                 - coalesce((
                     SELECT sum(jt.quantity) FROM public.journal_stock_transfers jt
                     WHERE jt.deleted_at IS NULL AND jt.status = 'confirmed'
                       AND jt.goods_id = pib.product_id AND jt.warehouse_id = pib.warehouse_id
                   ), 0)
               ) AS opening_qty
        FROM public.product_inventory_balances pib
        JOIN public.goods g ON g.id = pib.product_id AND g.deleted_at IS NULL
        LEFT JOIN public.warehouses w ON w.id = pib.warehouse_id AND w.deleted_at IS NULL
        LEFT JOIN public.countries c ON c.id = pib.country_id
        LEFT JOIN public.country_branches cb ON cb.id = pib.country_branch_id
        LEFT JOIN public.city_branches cib ON cib.id = pib.city_branch_id
        WHERE ${pibScope}
      `,
    ]);

    const lotIds = lots.map((l: Row) => l.id);
    const [lotStock, gts] = await Promise.all([
      lotIds.length
        ? sql`
            SELECT ls.lot_id::text AS lot_id, ls.state, ls.warehouse_id::text AS warehouse_id, ls.qty
            FROM public.lot_stock ls
            WHERE ls.lot_id = ANY(${lotIds}::uuid[]) AND ls.qty > 0
          `
        : Promise.resolve([]),
      lotIds.length
        ? sql`
            SELECT t.id::text AS id, t.lot_id::text AS lot_id, t.purpose, t.status, t.qty,
                   t.sales_order_id::text AS sales_order_id, t.created_at, t.completed_at, t.transfer_no
            FROM public.goods_transfers t
            WHERE t.lot_id = ANY(${lotIds}::uuid[]) AND coalesce(t.status::text, '') <> 'cancelled'
          `
        : Promise.resolve([]),
    ]);

    const linkedSoIds = [
      ...new Set(
        [...jst.map((j: Row) => j.sales_order_id), ...gts.map((t: Row) => t.sales_order_id)].filter(Boolean),
      ),
    ];

    const salesOrders = await sql`
      SELECT s.id::text AS id, s.sales_order_no, s.sales_contract_no, s.order_date, s.created_at,
             s.customer_name, s.account_number, s.customer_number,
             s.purchase_order_id::text AS purchase_order_id,
             s.country_id::text AS country_id, s.country_branch_id::text AS country_branch_id, s.city_branch_id::text AS city_branch_id,
             s.quantity, s.total_weight, s.sales_status, s.delivery_status, s.form_data,
             c.name AS country_name, coalesce(c.iso2, '') AS country_code,
             cb.name AS country_branch_name, coalesce(cib.name, cib.city_name) AS city_branch_name
      FROM public.sales_orders s
      LEFT JOIN public.countries c ON c.id = s.country_id
      LEFT JOIN public.country_branches cb ON cb.id = s.country_branch_id
      LEFT JOIN public.city_branches cib ON cib.id = s.city_branch_id
      WHERE s.deleted_at IS NULL
        AND coalesce(s.sales_status::text, '') NOT IN ('cancelled', 'rejected')
        AND (
          ${soScope}
          ${poIds.length ? sql`OR s.purchase_order_id = ANY(${poIds}::uuid[])` : sql``}
          ${linkedSoIds.length ? sql`OR s.id = ANY(${linkedSoIds}::uuid[])` : sql``}
        )
      ORDER BY s.created_at DESC
      LIMIT 2500
    `;

    return {
      countries,
      countryBranches,
      cityBranches,
      warehouses,
      pos,
      lps,
      plrs,
      jst,
      lots,
      lotStock,
      gts,
      treatments,
      pibOpening,
      salesOrders,
    };
  });

  if (!raw) throw new ApiClientError("Unable to load stock journal database records.", { status: 500 });

  // Localize master names (goods & warehouses) in viewer's active language
  const goodsMap = new Map<string, string>();
  const whNameMap = new Map<string, string>(raw.warehouses.map((w: Row) => [w.id, str(w.name)]));

  if (opts.lang) {
    try {
      const uniqueGoods = new Map<string, { id: string; goods_name: string }>();
      for (const lp of raw.lps) if (lp.goods_id && lp.goods_name) uniqueGoods.set(lp.goods_id, { id: lp.goods_id, goods_name: lp.goods_name });
      for (const l of raw.lots) if (l.goods_id && l.goods_name) uniqueGoods.set(l.goods_id, { id: l.goods_id, goods_name: l.goods_name });
      for (const p of raw.pibOpening) if (p.goods_id && p.goods_name) uniqueGoods.set(p.goods_id, { id: p.goods_id, goods_name: p.goods_name });
      for (const po of raw.pos) {
        const { lines } = extractPoGoodsLines(po.form_data);
        for (const ln of lines) if (ln.goodsId && ln.goodsName) uniqueGoods.set(ln.goodsId, { id: ln.goodsId, goods_name: ln.goodsName });
      }
      if (uniqueGoods.size > 0) {
        const locG = await localizeRecordNames([...uniqueGoods.values()], "goods", "goods_name", opts.lang);
        for (const g of locG) goodsMap.set(g.id, g.goods_name);
      }
      if (raw.warehouses.length > 0) {
        const locW = await localizeRecordNames(
          raw.warehouses.map((w: Row) => ({ id: w.id, warehouse_name: w.name })),
          "warehouses",
          "warehouse_name",
          opts.lang,
        );
        for (const w of locW) whNameMap.set(w.id, w.warehouse_name);
      }
    } catch {
      /* keep stored master names on fallback */
    }
  }

  const groupBy = <T,>(rows: T[], fn: (r: T) => string | null | undefined) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = fn(r);
      if (!k) continue;
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return m;
  };

  const plrByPo = groupBy(raw.plrs, (r: Row) => r.purchase_order_id);
  const jstByPo = groupBy(raw.jst, (r: Row) => r.purchase_order_id);
  const lotsByLp = groupBy(raw.lots, (r: Row) => r.local_purchase_id);
  const stockByLot = groupBy(raw.lotStock, (r: Row) => r.lot_id);
  const gtByLot = groupBy(raw.gts, (r: Row) => r.lot_id);
  const trByPo = groupBy(raw.treatments, (r: Row) => r.purchase_order_id);
  const trByLp = groupBy(raw.treatments, (r: Row) => r.local_purchase_id);
  const soById = new Map<string, Row>(raw.salesOrders.map((s: Row) => [s.id, s]));

  // Track which sales_orders have already been attributed via explicit transfer records so we NEVER double-count
  const consumedSaleOrders = new Set<string>();
  const chunks: PsStockChunk[] = [];

  // Index lookup maps so unlinked/wizard sales_orders (`stockLotNo`, `purchase_order_id`, `WH-xxxx`, `TRF-xxxx`) resolve cleanly
  const chunkByRef = new Map<string, PsStockChunk>();
  const chunksByPoId = new Map<string, PsStockChunk[]>();
  const jstTransferNoToChunk = new Map<string, PsStockChunk>();

  const registerRef = (ref: string | null | undefined, chunk: PsStockChunk) => {
    const k = cleanDash(ref);
    if (!k) return;
    if (!chunkByRef.has(k.toUpperCase())) chunkByRef.set(k.toUpperCase(), chunk);
  };

  // ── 1. Purchase Bookings (purchase_orders) ──
  for (const po of raw.pos) {
    const { lines, form } = extractPoGoodsLines(po.form_data);
    const fd = parseJsonish(po.form_data);
    const rawGoods: Row[] = Array.isArray(fd?.goodsEntries)
      ? fd.goodsEntries.filter((g: Row) => g && typeof g === "object")
      : [form];

    const poBillNo = cleanDash(po.purchase_order_no) || `PO-${po.id.slice(0, 8)}`;
    const manualNo = cleanDash(form.manualBillNumber ?? form.billNo ?? po.purchase_contract_no);
    const poDate = dateOnly(form.purchaseDate ?? form.receiptDate ?? po.created_at);
    const supplierName =
      cleanDash(form.salesAccountName ?? form.supplierName ?? form.supplierAccountName ?? form.purchaseAccountName) || "—";
    const supplierNo = cleanDash(form.salesAccountNo ?? form.supplierAccountNo ?? form.purchaseAccountNo) || "—";
    const formBl = cleanDash(form.blNumber ?? form.blNo);
    const formContainer = cleanDash(form.containerNo ?? form.containerNumber);
    const branchId = po.city_branch_id || po.country_branch_id || null;
    const branchName = cleanDash(po.city_branch_name || po.country_branch_name || form.branchName) || "—";
    const countryName = cleanDash(po.country_name || form.branchCountry || form.countryName) || "—";

    const plrList = plrByPo.get(po.id) ?? [];
    const facts: LoadingFact[] = plrList.map((p: Row) => ({
      id: p.id,
      no: str(p.loading_record_no),
      containerNo: str(p.container_number),
      vehicleNo: str(p.vehicle_no),
      blNumber: str(p.bl_number),
      createdAt: iso(p.created_at) || "",
      loadedAt: iso(p.loaded_at),
      loaded: num(p.loaded_quantity),
      received: p.received_quantity == null ? null : num(p.received_quantity),
      damaged: num(p.damaged_quantity),
      shortage: num(p.shortage_quantity),
      loadingStatus: str(p.loading_status),
      receivingWarehouseId: p.receiving_warehouse_id || null,
      receivingGoodsId: p.receiving_goods_id || null,
      customsStatus: "not_recorded",
      customsSource: "none",
      payload: p.report_payload,
    }));
    const plrById = new Map<string, Row>(plrList.map((p: Row) => [p.id, p]));
    const { chunks: loadedChunks } = allocateLoadings(lines, facts);

    const poJst = jstByPo.get(po.id) ?? [];
    const poTreatments = trByPo.get(po.id) ?? [];
    const poChunkList: PsStockChunk[] = [];

    const effectiveLines =
      lines.length > 0
        ? lines
        : [
            {
              lineKey: "l0",
              goodsId: null,
              goodsName: cleanDash(form.goodsName) || "—",
              brand: cleanDash(form.brand),
              size: cleanDash(form.size),
              unit: normalizeStockUnit(form.qtyName),
              booked: num(form.quantity ?? form.qtyNo),
              grossWeight: num(form.grossWeight),
              netWeight: num(form.netWeight),
            },
          ];

    for (const [idx, line] of effectiveLines.entries()) {
      const rawLine = rawGoods[idx] ?? form ?? {};
      const lineGross = num(rawLine.grossWeight) || num(line.grossWeight);
      const lineNet =
        num(rawLine.netWeight) ||
        num(rawLine.qtyKgs) ||
        (num(rawLine.oneQtyKgs) > 0 ? num(line.booked) * num(rawLine.oneQtyKgs) : num(line.netWeight));
      const lineOrigin = cleanDash(rawLine.origin ?? form.origin ?? form.originCountry ?? form.countryOfOrigin) || "—";
      const localizedGoods = (line.goodsId && goodsMap.get(line.goodsId)) || cleanDash(line.goodsName) || "—";
      const unit = normalizeStockUnit(line.unit);

      const weightFor = (q: number) => ({
        gross: line.booked > EPS ? proportional(lineGross, q, line.booked) : 0,
        net: line.booked > EPS ? proportional(lineNet, q, line.booked) : 0,
      });

      const lineLoaded = loadedChunks.filter((c) => c.lineKey === line.lineKey);

      for (const lc of lineLoaded) {
        const plr = plrById.get(lc.loadingId);
        const lotName =
          cleanDash(plr?.lot_name) ||
          cleanDash(plr?.loading_record_no) ||
          `${poBillNo}-L${idx + 1}`;
        const lotKey = `LOT:${lotName.toUpperCase()}`;
        const whId = plr?.receiving_warehouse_id || null;
        const whName = (whId && whNameMap.get(whId)) || "";
        const blNo = cleanDash(plr?.bl_number) || formBl;
        const containerNo = cleanDash(plr?.container_number || plr?.vehicle_no) || formContainer;

        const pW = weightFor(lc.loaded);
        const lossFromLoad = q4(lc.damaged + lc.shortage);

        // Treatment losses on this lot/line
        const trRows = poTreatments
          .filter((t: Row) => str(t.lot_no) === lotName && (!t.entry_key || str(t.entry_key) === line.lineKey))
          .map((t: Row) =>
            treatmentFigures({
              qty_received: num(t.qty_received),
              qty_treated: num(t.qty_treated),
              qty_loss: num(t.qty_loss),
              status: str(t.status),
            }),
          );
        const trLoss = treatmentSplit(Math.max(0, lc.loaded - lossFromLoad), trRows).loss;
        const totalAdjQty = q4(lossFromLoad + trLoss);
        const adjW = weightFor(totalAdjQty);

        // Stock Journal transfers on this loading + line:
        //   - status === 'issued' OR (status === 'confirmed' && sales_order_id != null && destination in sale/export)
        const matchingJst = poJst.filter(
          (j: Row) =>
            j.loading_record_id === lc.loadingId &&
            (!j.line_key || j.line_key === line.lineKey),
        );

        const sales: PsSaleItem[] = [];
        for (const j of matchingJst) {
          const isSaleAllocation =
            j.status === "issued" ||
            (j.status === "confirmed" &&
              (Boolean(j.sales_order_id) ||
                Boolean(j.sales_order_no) ||
                ["direct_sale", "export", "local_sales"].includes(str(j.destination_type))));

          if (isSaleAllocation && num(j.quantity) > EPS) {
            const so = j.sales_order_id ? soById.get(j.sales_order_id) : null;
            if (j.sales_order_id) consumedSaleOrders.add(j.sales_order_id);
            const sh = so ? extractSaleHeader(so) : null;
            const sq = q4(num(j.quantity));
            const sW = weightFor(sq);
            sales.push({
              id: `jst:${j.id}`,
              salesOrderId: j.sales_order_id ?? null,
              salesBillNo: cleanDash(so?.sales_order_no || j.sales_order_no || j.issue_ref || j.transfer_no) || "—",
              manualBillNo: sh?.manualBillNo ?? "",
              saleType:
                str(j.destination_type) === "export"
                  ? "Export Sale"
                  : str(j.destination_type) === "local_sales"
                    ? "Local Sale"
                    : sh?.saleType || "Sales Booking",
              date: sh?.date ?? dateOnly(j.issued_at ?? j.confirmed_at),
              accountNo: sh?.accountNo ?? "—",
              accountName: sh?.accountName || cleanDash(j.customer_name) || "—",
              blNo: sh?.blNo || blNo,
              containerNo: sh?.containerNo || containerNo,
              goodsName: localizedGoods,
              brand: cleanDash(line.brand),
              size: cleanDash(line.size),
              origin: lineOrigin,
              unit,
              qty: sq,
              grossKg: sW.gross,
              netKg: sW.net,
            });
          }
        }

        const chunk: PsStockChunk = {
          chunkId: `po:${po.id}:load:${lc.loadingId}:${line.lineKey}`,
          sourceKind: "purchase_booking",
          purchaseBillId: po.id,
          purchaseBillNo: poBillNo,
          manualBillNo: manualNo !== poBillNo ? manualNo : "",
          purchaseDate: dateOnly(plr?.loaded_at ?? plr?.created_at) ?? poDate,
          entryRef: cleanDash(plr?.loading_record_no) ? `${poBillNo} / ${cleanDash(plr?.loading_record_no)}` : poBillNo,
          entryTypeLabel: "Purchase Booking (Loaded)",
          countryId: po.country_id,
          countryName,
          countryCode: str(po.country_code),
          countryBranchId: po.country_branch_id,
          cityBranchId: po.city_branch_id,
          branchId,
          branchName,
          warehouseId: whId,
          warehouseName: whName,
          lotKey,
          lotName,
          blNo,
          containerNo,
          supplierAccountNo: supplierNo,
          supplierAccountName: supplierName,
          goodsId: line.goodsId,
          goodsName: localizedGoods,
          brand: cleanDash(line.brand),
          size: cleanDash(line.size),
          origin: lineOrigin,
          unit,
          purchasedQty: q4(lc.loaded),
          purchasedGrossKg: pW.gross,
          purchasedNetKg: pW.net,
          transferredQty: 0,
          transferredGrossKg: 0,
          transferredNetKg: 0,
          adjustedQty: totalAdjQty,
          adjustedGrossKg: adjW.gross,
          adjustedNetKg: adjW.net,
          inTransitQty: q4(lc.inTransit),
          notLoaded: false,
          sales,
        };

        chunks.push(chunk);
        poChunkList.push(chunk);
        registerRef(lotName, chunk);
        registerRef(plr?.loading_record_no, chunk);
        registerRef(`${plr?.loading_record_no}#${idx + 1}`, chunk);
        for (const j of matchingJst) {
          if (j.transfer_no) jstTransferNoToChunk.set(str(j.transfer_no).toUpperCase(), chunk);
        }
      }

      // Unloaded remainder of this Purchase Booking line
      const loadedSum = lineLoaded.reduce((s, c) => s + c.loaded, 0);
      const unloadedQty = q4(Math.max(0, num(line.booked) - loadedSum));
      if (unloadedQty > EPS || lineLoaded.length === 0) {
        const uW = lineLoaded.length === 0 && unloadedQty <= EPS ? { gross: lineGross, net: lineNet } : weightFor(unloadedQty);
        const lotName = effectiveLines.length > 1 ? `${poBillNo}#${idx + 1}` : poBillNo;
        const lotKey = `LOT:${lotName.toUpperCase()}`;
        const chunk: PsStockChunk = {
          chunkId: `po:${po.id}:book:${line.lineKey}`,
          sourceKind: "purchase_booking",
          purchaseBillId: po.id,
          purchaseBillNo: poBillNo,
          manualBillNo: manualNo !== poBillNo ? manualNo : "",
          purchaseDate: poDate,
          entryRef: poBillNo,
          entryTypeLabel: "Purchase Booking",
          countryId: po.country_id,
          countryName,
          countryCode: str(po.country_code),
          countryBranchId: po.country_branch_id,
          cityBranchId: po.city_branch_id,
          branchId,
          branchName,
          warehouseId: null,
          warehouseName: "",
          lotKey,
          lotName,
          blNo: formBl,
          containerNo: formContainer,
          supplierAccountNo: supplierNo,
          supplierAccountName: supplierName,
          goodsId: line.goodsId,
          goodsName: localizedGoods,
          brand: cleanDash(line.brand),
          size: cleanDash(line.size),
          origin: lineOrigin,
          unit,
          purchasedQty: unloadedQty,
          purchasedGrossKg: uW.gross,
          purchasedNetKg: uW.net,
          transferredQty: 0,
          transferredGrossKg: 0,
          transferredNetKg: 0,
          adjustedQty: 0,
          adjustedGrossKg: 0,
          adjustedNetKg: 0,
          inTransitQty: 0,
          notLoaded: true,
          sales: [],
        };
        chunks.push(chunk);
        poChunkList.push(chunk);
        registerRef(lotName, chunk);
        registerRef(`${poBillNo}#${idx + 1}`, chunk);
        if (idx === 0) registerRef(poBillNo, chunk);
      }
    }

    chunksByPoId.set(po.id, poChunkList);
  }

  // ── 2. Local Purchases (local_purchases + purchase_lots + goods_transfers) ──
  const SALE_PURPOSES = new Set(["local_sale", "export_customer"]);
  for (const lp of raw.lps) {
    const lpBillNo = localPurchaseBillNo(lp);
    const contractRef = localPurchaseContractRef(lp);
    const manualNo = cleanDash(lp.manual_bill_no) || contractRef;
    const lpDate = dateOnly(lp.created_at);
    const supplierName = cleanDash(lp.supplier_name) || "—";
    const supplierNo = cleanDash(lp.purchase_account_no || lp.sales_account_no) || "—";
    const branchId = lp.city_branch_id || lp.country_branch_id || null;
    const branchName = cleanDash(lp.city_branch_name || lp.country_branch_name) || "—";
    const countryName = cleanDash(lp.country_name) || "—";
    const lpTreatments = trByLp.get(lp.id) ?? [];

    const lpLots = lotsByLp.get(lp.id) ?? [];
    const fallbackQty = num(lp.numbers) > 0 ? num(lp.numbers) : num(lp.quantity_kgs);
    const lotUnits =
      lpLots.length > 0
        ? lpLots
        : [
            {
              id: null,
              lot_ref: cleanDash(lp.lot_no) || lpBillNo,
              lot_no: cleanDash(lp.lot_no) || lpBillNo,
              line_key: "l1",
              goods_id: lp.goods_id,
              goods_name: lp.goods_name,
              brand: lp.brand,
              size: lp.size,
              origin: lp.origin_country_name,
              unit_name: lp.quantity_name,
              qty_purchased: fallbackQty,
              gross_weight_kg: num(lp.total_gross_weight),
              net_weight_kg: num(lp.net_weight) || num(lp.quantity_kgs),
            },
          ];

    for (const lot of lotUnits) {
      const lotName = cleanDash(lot.lot_no) || cleanDash(lot.lot_ref) || lpBillNo;
      const lotKey = `LOT:${lotName.toUpperCase()}`;
      const qty = q4(num(lot.qty_purchased));
      const gross = q4(num(lot.gross_weight_kg));
      const net = q4(num(lot.net_weight_kg));
      const unit = normalizeStockUnit(lot.unit_name || lp.quantity_name);
      const localizedGoods =
        (lot.goods_id && goodsMap.get(lot.goods_id)) || cleanDash(lot.goods_name || lp.goods_name) || "—";
      const origin = cleanDash(lot.origin || lp.origin_country_name) || "Local";

      const wFor = (q: number) => ({
        gross: qty > EPS ? proportional(gross, q, qty) : 0,
        net: qty > EPS ? proportional(net, q, qty) : 0,
      });

      const stockRows = lot.id ? stockByLot.get(lot.id) ?? [] : [];
      const activeWhId =
        stockRows.find((s: Row) => s.warehouse_id && ["available", "reserved"].includes(str(s.state)))?.warehouse_id ?? null;
      const whName = (activeWhId && whNameMap.get(activeWhId)) || cleanDash(lp.warehouse_name);
      const inTransitQty = q4(
        stockRows
          .filter((s: Row) => ["in_transit", "loading"].includes(str(s.state)))
          .reduce((acc: number, s: Row) => acc + num(s.qty), 0),
      );

      const transfers = lot.id ? gtByLot.get(lot.id) ?? [] : [];
      const branchTransferQty = q4(
        transfers
          .filter((t: Row) => t.purpose === "export_dgt_branch" && ["in_transit", "completed", "confirmed"].includes(str(t.status)))
          .reduce((acc: number, t: Row) => acc + num(t.qty), 0),
      );
      const branchTransferW = wFor(branchTransferQty);

      const trRows = lpTreatments
        .filter((t: Row) => str(t.lot_no) === lotName)
        .map((t: Row) =>
          treatmentFigures({
            qty_received: num(t.qty_received),
            qty_treated: num(t.qty_treated),
            qty_loss: num(t.qty_loss),
            status: str(t.status),
          }),
        );
      const trLoss = treatmentSplit(Math.max(0, qty - branchTransferQty), trRows).loss;
      const adjW = wFor(trLoss);

      const sales: PsSaleItem[] = [];
      for (const t of transfers) {
        if (!SALE_PURPOSES.has(str(t.purpose))) continue;
        const sq = q4(num(t.qty));
        if (sq <= EPS) continue;
        const so = t.sales_order_id ? soById.get(t.sales_order_id) : null;
        if (t.sales_order_id) consumedSaleOrders.add(t.sales_order_id);
        const sh = so ? extractSaleHeader(so) : null;
        const sW = wFor(sq);
        sales.push({
          id: `gt:${t.id}`,
          salesOrderId: t.sales_order_id ?? null,
          salesBillNo: cleanDash(so?.sales_order_no || t.transfer_no) || "—",
          manualBillNo: sh?.manualBillNo ?? "",
          saleType: str(t.purpose) === "export_customer" ? "Export Sale" : "Local Sale",
          date: sh?.date ?? dateOnly(t.completed_at ?? t.created_at),
          accountNo: sh?.accountNo ?? "—",
          accountName: sh?.accountName ?? "—",
          blNo: sh?.blNo ?? "",
          containerNo: sh?.containerNo || cleanDash(lp.truck_no),
          goodsName: localizedGoods,
          brand: cleanDash(lot.brand || lp.brand),
          size: cleanDash(lot.size || lp.size),
          origin,
          unit,
          qty: sq,
          grossKg: sW.gross,
          netKg: sW.net,
        });
      }

      const chunk: PsStockChunk = {
        chunkId: `lp:${lp.id}:lot:${lot.id || lot.line_key}`,
        sourceKind: "local_purchase",
        purchaseBillId: lp.id,
        purchaseBillNo: lpBillNo,
        manualBillNo: manualNo !== lpBillNo ? manualNo : "",
        purchaseDate: lpDate,
        entryRef: lot.lot_ref ? `${lpBillNo} / ${lot.lot_ref}` : lpBillNo,
        entryTypeLabel: "Local Purchase",
        countryId: lp.country_id,
        countryName,
        countryCode: str(lp.country_code),
        countryBranchId: lp.country_branch_id,
        cityBranchId: lp.city_branch_id,
        branchId,
        branchName,
        warehouseId: activeWhId,
        warehouseName: whName,
        lotKey,
        lotName,
        blNo: "",
        containerNo: cleanDash(lp.truck_no),
        supplierAccountNo: supplierNo,
        supplierAccountName: supplierName,
        goodsId: lot.goods_id ?? lp.goods_id ?? null,
        goodsName: localizedGoods,
        brand: cleanDash(lot.brand || lp.brand),
        size: cleanDash(lot.size || lp.size),
        origin,
        unit,
        purchasedQty: qty,
        purchasedGrossKg: gross,
        purchasedNetKg: net,
        transferredQty: branchTransferQty,
        transferredGrossKg: branchTransferW.gross,
        transferredNetKg: branchTransferW.net,
        adjustedQty: q4(trLoss),
        adjustedGrossKg: adjW.gross,
        adjustedNetKg: adjW.net,
        inTransitQty,
        notLoaded: false,
        sales,
      };

      chunks.push(chunk);
      registerRef(lotName, chunk);
      registerRef(lot.lot_ref, chunk);
      registerRef(`LP-${lp.id.slice(0, 8)}`, chunk);
      registerRef(lpBillNo, chunk);
    }
  }

  // ── 3. Opening / Legacy Warehouse Balances (not backed by purchase_lots / journal_stock_transfers) ──
  const whChunkByRef = new Map<string, PsStockChunk>();
  for (const pib of raw.pibOpening) {
    const openQty = q4(num(pib.opening_qty));
    const whShortRef = `WH-${String(pib.id).slice(0, 8)}`;
    if (openQty <= EPS) continue;
    const whName = (pib.warehouse_id && whNameMap.get(pib.warehouse_id)) || cleanDash(pib.warehouse_name) || "Warehouse";
    const localizedGoods = (pib.goods_id && goodsMap.get(pib.goods_id)) || cleanDash(pib.goods_name) || "—";
    const lotName = whShortRef.toUpperCase();
    const chunk: PsStockChunk = {
      chunkId: `wh:${pib.id}`,
      sourceKind: "opening_stock",
      purchaseBillId: null,
      purchaseBillNo: "—",
      manualBillNo: "",
      purchaseDate: dateOnly(pib.updated_at),
      entryRef: lotName,
      entryTypeLabel: "Opening / Warehouse Stock",
      countryId: pib.country_id,
      countryName: cleanDash(pib.country_name) || "—",
      countryCode: str(pib.country_code),
      countryBranchId: pib.country_branch_id,
      cityBranchId: pib.city_branch_id,
      branchId: pib.city_branch_id || pib.country_branch_id || null,
      branchName: cleanDash(pib.city_branch_name || pib.country_branch_name) || "—",
      warehouseId: pib.warehouse_id,
      warehouseName: whName,
      lotKey: `LOT:${lotName}`,
      lotName,
      blNo: "",
      containerNo: "",
      supplierAccountNo: "—",
      supplierAccountName: whName,
      goodsId: pib.goods_id,
      goodsName: localizedGoods,
      brand: "",
      size: "",
      origin: "Warehouse",
      unit: "BAG",
      purchasedQty: openQty,
      purchasedGrossKg: 0,
      purchasedNetKg: 0,
      transferredQty: 0,
      transferredGrossKg: 0,
      transferredNetKg: 0,
      adjustedQty: 0,
      adjustedGrossKg: 0,
      adjustedNetKg: 0,
      inTransitQty: 0,
      notLoaded: false,
      sales: [],
    };
    chunks.push(chunk);
    whChunkByRef.set(whShortRef.toUpperCase(), chunk);
    registerRef(whShortRef, chunk);
  }

  // ── 4. Reconcile remaining Sales Orders (not already attributed via jst / goods_transfers) ──
  for (const so of raw.salesOrders) {
    if (consumedSaleOrders.has(so.id)) continue;
    const sh = extractSaleHeader(so);
    const soNo = cleanDash(so.sales_order_no) || `SO-${so.id.slice(0, 8)}`;

    const lines =
      sh.goodsEntries.length > 0
        ? sh.goodsEntries
        : [
            {
              goodsName: cleanDash(sh.form.goodsName) || "—",
              qtyNo: num(so.quantity),
              qtyName: sh.form.qtyName || "BAG",
              grossWeight: 0,
              netWeight: num(so.total_weight),
              stockLotNo: sh.form.allotName || sh.form.sourceStockRef || sh.form.stockRef || "",
            },
          ];

    for (const [lIdx, ge] of lines.entries()) {
      const sq = q4(num(ge.qtyNo ?? ge.quantity) || (lines.length === 1 ? num(so.quantity) : 0));
      const sNet = q4(num(ge.netWeight) || num(ge.qtyKgs) || (lines.length === 1 ? num(so.total_weight) : 0));
      const sGross = q4(num(ge.grossWeight) || sNet);
      if (sq <= EPS && sNet <= EPS) continue;

      const rawRef = cleanDash(
        ge.stockLotNo ?? ge.lotNo ?? sh.form.allotName ?? sh.form.sourceStockRef ?? sh.form.stockRef,
      );
      const strippedAt = rawRef.split("@")[0].trim();
      const strippedHash = strippedAt.split("#")[0].trim();

      let targetChunk: PsStockChunk | undefined =
        (rawRef ? jstTransferNoToChunk.get(rawRef.toUpperCase()) : undefined) ||
        (strippedAt ? chunkByRef.get(strippedAt.toUpperCase()) : undefined) ||
        (strippedHash ? chunkByRef.get(strippedHash.toUpperCase()) : undefined) ||
        (strippedAt ? whChunkByRef.get(strippedAt.toUpperCase()) : undefined);

      if (!targetChunk && so.purchase_order_id) {
        const candidates = chunksByPoId.get(so.purchase_order_id) ?? [];
        const gName = cleanDash(ge.goodsName).toLowerCase();
        targetChunk =
          candidates.find((c) => gName && c.goodsName.toLowerCase() === gName) ||
          candidates[0];
      }

      const unit = normalizeStockUnit(ge.qtyName ?? ge.unitName ?? targetChunk?.unit);
      const saleItem: PsSaleItem = {
        id: `so:${so.id}:${lIdx}`,
        salesOrderId: so.id,
        salesBillNo: soNo,
        manualBillNo: sh.manualBillNo,
        saleType: sh.saleType,
        date: sh.date,
        accountNo: sh.accountNo,
        accountName: sh.accountName,
        blNo: cleanDash(ge.blNo) || sh.blNo || targetChunk?.blNo || "",
        containerNo: cleanDash(ge.containerNo) || sh.containerNo || targetChunk?.containerNo || "",
        goodsName:
          (ge.goodsId && goodsMap.get(String(ge.goodsId))) ||
          cleanDash(ge.goodsName) ||
          targetChunk?.goodsName ||
          "—",
        brand: cleanDash(ge.brand) || targetChunk?.brand || "",
        size: cleanDash(ge.size) || targetChunk?.size || "",
        origin: cleanDash(ge.origin) || targetChunk?.origin || "—",
        unit,
        qty: sq,
        grossKg: sGross,
        netKg: sNet,
      };

      if (targetChunk) {
        // If sale did not record explicit weights, derive proportionally from the linked purchase chunk
        if (saleItem.grossKg <= EPS && targetChunk.purchasedQty > EPS && targetChunk.purchasedGrossKg > EPS) {
          saleItem.grossKg = proportional(targetChunk.purchasedGrossKg, sq, targetChunk.purchasedQty);
        }
        if (saleItem.netKg <= EPS && targetChunk.purchasedQty > EPS && targetChunk.purchasedNetKg > EPS) {
          saleItem.netKg = proportional(targetChunk.purchasedNetKg, sq, targetChunk.purchasedQty);
        }
        targetChunk.sales.push(saleItem);
      } else {
        // Unlinked sale in caller's scope: preserve in its own lot bucket so Sales Bills & balances reconcile honestly
        const syntheticLot = strippedAt || `DIRECT-${soNo}`;
        chunks.push({
          chunkId: `unlinked:${so.id}:${lIdx}`,
          sourceKind: "unlinked_sale",
          purchaseBillId: null,
          purchaseBillNo: "—",
          manualBillNo: "",
          purchaseDate: sh.date,
          entryRef: soNo,
          entryTypeLabel: "Unlinked Sale",
          countryId: so.country_id,
          countryName: cleanDash(so.country_name) || "—",
          countryCode: str(so.country_code),
          countryBranchId: so.country_branch_id,
          cityBranchId: so.city_branch_id,
          branchId: so.city_branch_id || so.country_branch_id || null,
          branchName: cleanDash(so.city_branch_name || so.country_branch_name) || "—",
          warehouseId: null,
          warehouseName: "",
          lotKey: `LOT:${syntheticLot.toUpperCase()}`,
          lotName: syntheticLot,
          blNo: saleItem.blNo,
          containerNo: saleItem.containerNo,
          supplierAccountNo: "—",
          supplierAccountName: "—",
          goodsId: ge.goodsId ? String(ge.goodsId) : null,
          goodsName: saleItem.goodsName,
          brand: saleItem.brand,
          size: saleItem.size,
          origin: saleItem.origin,
          unit,
          purchasedQty: 0,
          purchasedGrossKg: 0,
          purchasedNetKg: 0,
          transferredQty: 0,
          transferredGrossKg: 0,
          transferredNetKg: 0,
          adjustedQty: 0,
          adjustedGrossKg: 0,
          adjustedNetKg: 0,
          inTransitQty: 0,
          notLoaded: false,
          sales: [saleItem],
        });
      }
    }
  }

  // ── 5. Assemble role-scoped Filter Options from actual scoped records ──
  const branchOptions: PsFilterOptionSet["branches"] = [];
  const seenBranchIds = new Set<string>();
  for (const cib of raw.cityBranches) {
    seenBranchIds.add(cib.id);
    branchOptions.push({
      id: cib.id,
      value: `city:${cib.id}`,
      name: str(cib.name),
      code: str(cib.code),
      countryId: cib.country_id ?? null,
    });
  }
  for (const cb of raw.countryBranches) {
    if (seenBranchIds.has(cb.id)) continue;
    branchOptions.push({
      id: cb.id,
      value: `main:${cb.id}`,
      name: str(cb.name),
      code: str(cb.code),
      countryId: cb.country_id ?? null,
    });
  }

  const distinctGoods = new Set<string>();
  const distinctOrigins = new Set<string>();
  const distinctLots = new Set<string>();
  for (const c of chunks) {
    if (c.goodsName && c.goodsName !== "—") distinctGoods.add(c.goodsName);
    if (c.origin && c.origin !== "—") distinctOrigins.add(c.origin);
    if (c.lotName && c.lotName !== "—") distinctLots.add(c.lotName);
  }

  const lockedCountryId =
    role !== "super_admin" && raw.countries.length === 1 ? raw.countries[0].id : null;
  const lockedBranchId =
    role === "branch_admin" && branchOptions.length === 1 ? branchOptions[0].value : null;

  const filterOptions: PsFilterOptionSet = {
    role,
    lockedCountryId,
    lockedBranchId,
    countries: raw.countries.map((c: Row) => ({ id: c.id, name: str(c.name), code: str(c.code) })),
    branches: branchOptions,
    warehouses: raw.warehouses.map((w: Row) => ({
      id: w.id,
      name: whNameMap.get(w.id) || str(w.name),
      countryId: w.country_id ?? null,
      cityBranchId: w.city_branch_id ?? null,
    })),
    goods: [...distinctGoods].sort((a, b) => a.localeCompare(b)),
    origins: [...distinctOrigins].sort((a, b) => a.localeCompare(b)),
    lots: [...distinctLots].sort((a, b) => a.localeCompare(b)),
  };

  return { chunks, filterOptions };
}

export async function loadPsStockJournalEndpoint(
  session: ErpSession,
  params: {
    mode: "ps_journal" | "booking_stock";
    filters: PsAdvancedFilters;
    lotKey?: string;
    lotSearch?: string;
    lotDateFrom?: string;
    lotDateTo?: string;
    page: number;
    limit: number;
    lang: SupportedLanguage;
  },
) {
  const { chunks, filterOptions } = await loadCanonicalPsStockChunks(session, {
    countryId: params.filters.countryId,
    branchParam: params.filters.branchId,
    lang: params.lang,
  });

  if (params.lotKey) {
    const detail = buildPsLotDetailView(chunks, params.lotKey, {
      search: params.lotSearch,
      dateFrom: params.lotDateFrom,
      dateTo: params.lotDateTo,
    });
    if (!detail) {
      throw new ApiClientError("Lot not found or outside your authorized scope.", {
        status: 404,
        code: "NOT_FOUND",
      });
    }
    return {
      mode: "lot_detail" as const,
      role: filterOptions.role,
      detail,
      filterOptions,
    };
  }

  if (params.mode === "booking_stock") {
    const view = buildJournalBookingStockView(chunks, params.filters);
    const totalRecords = view.rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / params.limit));
    const offset = (params.page - 1) * params.limit;
    return {
      mode: "booking_stock" as const,
      role: filterOptions.role,
      cards: view.cards,
      rows: view.rows.slice(offset, offset + params.limit),
      allRowsCount: totalRecords,
      pagination: {
        page: params.page,
        limit: params.limit,
        totalRecords,
        totalPages,
      },
      filterOptions,
    };
  }

  const view = buildPsJournalView(chunks, params.filters);
  const totalRecords = view.lots.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / params.limit));
  const offset = (params.page - 1) * params.limit;

  return {
    mode: "ps_journal" as const,
    role: filterOptions.role,
    cards: view.cards,
    countrySummary: view.countrySummary,
    branchSummary: view.branchSummary,
    lots: view.lots.slice(offset, offset + params.limit),
    pagination: {
      page: params.page,
      limit: params.limit,
      totalRecords,
      totalPages,
    },
    filterOptions,
  };
}
