/**
 * Real available-stock resolver for the Sales Order wizard's "Sale Source / Lot Selection".
 * Replaces the former hard-coded MOCK_SALE_LOTS / MOCK_LOT_DEDUCTIONS.
 *
 * Sources (match SALE_SOURCE_OPTIONS in the wizard):
 *   booking     → purchase_orders goods lines (a fresh booking sale off an existing PO)
 *   in_transit  → purchase_loading_records that are loaded / on-route (not yet received)
 *   local       → local_purchases stock in this branch
 *   warehouse   → product_inventory_balances with quantity_available > 0
 *   endorse     → stock_movements of an endorsement type (none seeded on DEV → empty, honest)
 *
 * Country / branch scoped from the session (super_admin = all). goods_name is localised.
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type SaleSource = "booking" | "in_transit" | "local" | "warehouse" | "endorse" | "stock" | "lot";
export const SALE_SOURCES: SaleSource[] = ["booking", "in_transit", "local", "warehouse", "endorse", "stock", "lot"];

export interface AvailableLot {
  id?: string;
  lotNo: string;
  source: SaleSource;
  goodsId: string | null;
  goodsName: string;
  brand: string;
  size: string;
  origin: string;
  hsCode: string;
  qtyName: string;
  availableQty: number;
  qtyKgs: number;
  emptyKgs: number;
  netWeight: number;
  location: string;
  branchName?: string;
  branchId?: string | null;
  warehouseName?: string;
  warehouseId?: string | null;
  countryId?: string | null;
  stockRef: string;
  containerNo: string | null;
  currencyType: string;
  exchangeRate: number;
  coursePrice: number;
  status: string;
  /** Set for lots managed by the Goods Transfer Journal: the permanent lot identity + the exact stock place. */
  lotId?: string;
  lotRef?: string;
  rackBin?: string;
  placeLabel?: string;
  purchaseId?: string;
  unitCost?: number;
  landedUnitCost?: number;
  costCurrency?: string;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

function scopeClause(sql: any, session: ErpSession) {
  if (session.isSuperAdmin) return sql`true`;
  const co = session.countryIds ?? [];
  const cb = session.countryBranchIds ?? [];
  const ci = session.cityBranchIds ?? [];
  return sql`(
    (country_id IS NULL AND country_branch_id IS NULL AND city_branch_id IS NULL)
    OR country_id = ANY(${co}::uuid[])
    OR country_branch_id = ANY(${cb}::uuid[])
    OR city_branch_id = ANY(${ci}::uuid[])
  )`;
}

function scopeClauseFor(sql: any, session: ErpSession, alias: string) {
  if (session.isSuperAdmin) return sql`true`;
  const co = session.countryIds ?? [];
  const cb = session.countryBranchIds ?? [];
  const ci = session.cityBranchIds ?? [];
  const a = sql.unsafe(alias);
  return sql`(
    (${a}.country_id IS NULL AND ${a}.country_branch_id IS NULL AND ${a}.city_branch_id IS NULL)
    OR ${a}.country_id = ANY(${co}::uuid[])
    OR ${a}.country_branch_id = ANY(${cb}::uuid[])
    OR ${a}.city_branch_id = ANY(${ci}::uuid[])
  )`;
}

export async function listAvailableLots(
  session: ErpSession,
  opts: {
    source: SaleSource;
    q?: string | null;
    goodsName?: string | null;
    goodsId?: string | null;
    lotId?: string | null;
    lang?: SupportedLanguage;
    limit?: number;
  },
): Promise<AvailableLot[]> {
  const source = opts.source;
  const lang = opts.lang ?? "en";
  const limit = Math.min(opts.limit ?? 300, 1000);
  const needle = (opts.q ?? "").trim().toLowerCase();

  const lots = await withLocalPg(async (sql) => {
    const scope = scopeClause(sql, session);
    const out: AvailableLot[] = [];

    const fetchWarehouseLots = async () => {
      const rows = (await sql`
        SELECT pib.id, pib.product_id AS goods_id, pib.quantity_available, pib.quantity_on_hand,
               pib.warehouse_id, pib.city_branch_id, pib.country_id,
               g.goods_name, g.chs_code, w.warehouse_name, w.warehouse_code,
               cb.name as branch_name,
               GREATEST(0, coalesce(pib.quantity_available, pib.quantity_on_hand, 0) - coalesce((
                 SELECT sum(ls.qty) FROM public.lot_stock ls JOIN public.purchase_lots pl ON pl.id = ls.lot_id
                 WHERE pl.goods_id = pib.product_id AND ls.warehouse_id = pib.warehouse_id AND ls.state = 'available'), 0)) AS legacy_available
        FROM public.product_inventory_balances pib
        LEFT JOIN public.goods g ON g.id = pib.product_id
        LEFT JOIN public.warehouses w ON w.id = pib.warehouse_id
        LEFT JOIN public.city_branches cb ON cb.id = pib.city_branch_id
        WHERE ${scopeClauseFor(sql, session, "pib")} AND g.deleted_at IS NULL
          AND GREATEST(0, coalesce(pib.quantity_available, pib.quantity_on_hand, 0) - coalesce((
                 SELECT sum(ls.qty) FROM public.lot_stock ls JOIN public.purchase_lots pl ON pl.id = ls.lot_id
                 WHERE pl.goods_id = pib.product_id AND ls.warehouse_id = pib.warehouse_id AND ls.state = 'available'), 0)) > 0
        ORDER BY pib.updated_at DESC
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        out.push({
          id: r.id,
          lotNo: `WH-${String(r.id).slice(0, 8)}`,
          source: "warehouse",
          goodsId: r.goods_id ?? null,
          goodsName: r.goods_name ?? "",
          brand: "",
          size: "",
          origin: "",
          hsCode: r.chs_code ?? "",
          qtyName: "BAGS",
          availableQty: n(r.legacy_available),
          qtyKgs: 0,
          emptyKgs: 0,
          netWeight: 0,
          location: r.warehouse_name || "Warehouse",
          branchName: r.branch_name || "Main Branch",
          branchId: r.city_branch_id ?? null,
          warehouseName: r.warehouse_name || "Warehouse",
          warehouseId: r.warehouse_id ?? null,
          countryId: r.country_id ?? null,
          stockRef: r.warehouse_code || `WH-${String(r.id).slice(0, 8)}`,
          containerNo: null,
          currencyType: "USD",
          exchangeRate: 1,
          coursePrice: 0,
          status: "Warehouse available",
        });
      }
    };

    const fetchLocalLots = async () => {
      const rows = (await sql`
        SELECT lp.id, lp.goods_id, lp.goods_name, lp.brand, lp.size, lp.quantity_name, lp.numbers, lp.net_weight,
               lp.empty_kgs, lp.quantity_kgs, lp.purchase_rate, lp.purchase_currency, lp.exchange_rate,
               lp.warehouse_name, lp.lot_no, lp.manual_bill_no, lp.status, lp.origin_country_name,
               lp.city_branch_id, lp.country_id,
               cb.name as branch_name
        FROM public.local_purchases lp
        LEFT JOIN public.city_branches cb ON cb.id = lp.city_branch_id
        WHERE ${scopeClauseFor(sql, session, "lp")} AND lp.deleted_at IS NULL
          AND coalesce(lp.status,'') NOT IN ('sold','consumed','cancelled')
          AND coalesce(lp.numbers, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM public.purchase_lots pl WHERE pl.local_purchase_id = lp.id)
        ORDER BY lp.created_at DESC
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        out.push({
          id: r.id,
          lotNo: r.lot_no || `LP-${String(r.id).slice(0, 8)}`,
          source: "local",
          goodsId: r.goods_id ?? null,
          goodsName: r.goods_name ?? "",
          brand: r.brand ?? "",
          size: r.size ?? "",
          origin: r.origin_country_name ?? "",
          hsCode: "",
          qtyName: r.quantity_name ?? "BAGS",
          availableQty: n(r.numbers),
          qtyKgs: n(r.quantity_kgs),
          emptyKgs: n(r.empty_kgs),
          netWeight: n(r.net_weight),
          location: r.warehouse_name || "Local Purchase Stock",
          branchName: r.branch_name || "Local Branch",
          branchId: r.city_branch_id ?? null,
          warehouseName: r.warehouse_name || "Local Stock",
          warehouseId: null,
          countryId: r.country_id ?? null,
          stockRef: r.manual_bill_no || r.lot_no || `LP-${String(r.id).slice(0, 8)}`,
          containerNo: null,
          currencyType: r.purchase_currency ?? "USD",
          exchangeRate: n(r.exchange_rate) || 1,
          coursePrice: n(r.purchase_rate),
          status: r.status || "Local stock",
        });
      }
    };

    const fetchTransitLots = async () => {
      const rows = (await sql`
        SELECT plr.id, plr.loading_record_no, plr.purchase_order_no, plr.container_number, plr.loading_location,
               plr.receiving_location, plr.shipment_status, plr.purchase_currency, plr.exchange_rate,
               plr.loaded_quantity, plr.total_quantity, plr.received_quantity, plr.report_payload,
               plr.city_branch_id, plr.country_id,
               cb.name as branch_name
        FROM public.purchase_loading_records plr
        LEFT JOIN public.city_branches cb ON cb.id = plr.city_branch_id
        WHERE ${scope}
          AND plr.loading_status = 'loaded'
          AND coalesce(plr.shipment_status,'') NOT IN ('received','local-sale')
        ORDER BY plr.created_at DESC
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        const entries: any[] = r.report_payload?.goodsEntries ?? [];
        const remain = n(r.loaded_quantity) - n(r.received_quantity);
        if (entries.length) {
          entries.forEach((e: any, idx: number) => {
            out.push({
              id: r.id,
              lotNo: `${r.loading_record_no}#${idx + 1}`,
              source: "in_transit",
              goodsId: e.goodsId ?? null,
              goodsName: e.goodsName ?? e.item ?? "",
              brand: e.brand ?? "",
              size: e.size ?? "",
              origin: e.origin ?? "",
              hsCode: e.hsCode ?? "",
              qtyName: e.qtyName ?? e.unitName ?? "BAGS",
              availableQty: n(e.qtyNo ?? e.quantity),
              qtyKgs: n(e.qtyKgs),
              emptyKgs: n(e.emptyKgs),
              netWeight: n(e.netWeight),
              location: `In Transit — ${r.loading_location || r.receiving_location || ""}`.trim(),
              branchName: r.branch_name || "Transit Branch",
              branchId: r.city_branch_id ?? null,
              warehouseName: r.receiving_location || "In-Transit",
              warehouseId: null,
              countryId: r.country_id ?? null,
              stockRef: r.loading_record_no,
              containerNo: r.container_number ?? null,
              currencyType: e.currency ?? r.purchase_currency ?? "USD",
              exchangeRate: n(e.exchangeRate ?? r.exchange_rate) || 1,
              coursePrice: n(e.coursePrice),
              status: r.shipment_status || "Loaded / On route",
            });
          });
        } else {
          out.push({
            id: r.id,
            lotNo: r.loading_record_no,
            source: "in_transit",
            goodsId: null,
            goodsName: r.purchase_order_no ? `PO ${r.purchase_order_no}` : r.loading_record_no,
            brand: "",
            size: "",
            origin: "",
            hsCode: "",
            qtyName: "BAGS",
            availableQty: remain > 0 ? remain : n(r.loaded_quantity),
            qtyKgs: 0,
            emptyKgs: 0,
            netWeight: 0,
            location: `In Transit — ${r.loading_location || r.receiving_location || ""}`.trim(),
            branchName: r.branch_name || "Transit Branch",
            branchId: r.city_branch_id ?? null,
            warehouseName: r.receiving_location || "In-Transit",
            warehouseId: null,
            countryId: r.country_id ?? null,
            stockRef: r.loading_record_no,
            containerNo: r.container_number ?? null,
            currencyType: r.purchase_currency ?? "USD",
            exchangeRate: n(r.exchange_rate) || 1,
            coursePrice: 0,
            status: r.shipment_status || "Loaded / On route",
          });
        }
      }
    };

    const fetchManagedLots = async () => {
      const rows = (await sql`
        SELECT l.id AS lot_id, l.lot_ref, l.goods_id, l.goods_name, l.brand, l.size, l.origin, l.unit_name, l.net_weight_kg, l.qty_purchased,
               l.original_cost, l.unit_cost, l.currency_code, l.country_id, l.city_branch_id, l.local_purchase_id,
               s.warehouse_id, s.location_label, s.rack_bin, s.qty,
               w.warehouse_name, w.warehouse_code, cb.name AS branch_name, g.chs_code
        FROM public.purchase_lots l
        JOIN public.lot_stock s ON s.lot_id = l.id AND s.state = 'available' AND s.qty > 0
        LEFT JOIN public.warehouses w ON w.id = s.warehouse_id
        LEFT JOIN public.city_branches cb ON cb.id = l.city_branch_id
        LEFT JOIN public.goods g ON g.id = l.goods_id
        WHERE ${scopeClauseFor(sql, session, "l")} AND l.status = 'active'
          ${opts.lotId ? sql`AND l.id = ${opts.lotId}::uuid` : sql``}
        ORDER BY l.created_at DESC, l.lot_ref
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        const whLabel = r.warehouse_name || r.location_label || "Purchase location";
        const place = [r.warehouse_code || r.location_label || "", r.rack_bin ? `/${r.rack_bin}` : ""].join("");
        const qty = n(r.qty_purchased) || 1;
        out.push({
          id: `${r.lot_id}|${r.warehouse_id ?? "-"}|${r.rack_bin ?? ""}|${r.location_label ?? ""}`,
          lotNo: place ? `${r.lot_ref}@${place}` : r.lot_ref,
          source: "lot",
          goodsId: r.goods_id ?? null,
          goodsName: r.goods_name ?? "",
          brand: r.brand ?? "",
          size: r.size ?? "",
          origin: r.origin ?? "",
          hsCode: r.chs_code ?? "",
          qtyName: r.unit_name ?? "BAGS",
          availableQty: n(r.qty),
          qtyKgs: n(r.net_weight_kg) / qty,
          emptyKgs: 0,
          netWeight: (n(r.net_weight_kg) / qty) * n(r.qty),
          location: whLabel + (r.rack_bin ? ` / ${r.rack_bin}` : ""),
          branchName: r.branch_name || "",
          branchId: r.city_branch_id ?? null,
          warehouseName: whLabel,
          warehouseId: r.warehouse_id ?? null,
          countryId: r.country_id ?? null,
          stockRef: r.lot_ref,
          containerNo: null,
          currencyType: r.currency_code ?? "USD",
          exchangeRate: 1,
          coursePrice: 0,
          status: "Lot available",
          lotId: r.lot_id,
          lotRef: r.lot_ref,
          rackBin: r.rack_bin ?? "",
          placeLabel: r.location_label ?? "",
          purchaseId: r.local_purchase_id,
          unitCost: n(r.original_cost) / qty,
          landedUnitCost: n(r.unit_cost),
          costCurrency: r.currency_code ?? "",
        });
      }
    };

    if (source === "lot") {
      await fetchManagedLots();
    } else if (source === "stock") {
      await fetchManagedLots();
      await fetchWarehouseLots();
      await fetchLocalLots();
      await fetchTransitLots();
    } else if (source === "booking") {
      const rows = (await sql`
        SELECT id, purchase_order_no, currency_code, exchange_rate, form_data
        FROM public.purchase_orders
        WHERE ${scope}
          AND (jsonb_typeof(form_data->'goodsEntries') = 'array'
               OR jsonb_typeof(form_data->'form'->'goodsEntries') = 'array')
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        const entries = r.form_data?.goodsEntries ?? r.form_data?.form?.goodsEntries ?? [];
        entries.forEach((e: any, idx: number) => {
          out.push({
            lotNo: `${r.purchase_order_no}#${idx + 1}`,
            source,
            goodsId: e.goodsId ?? null,
            goodsName: e.goodsName ?? e.item ?? "",
            brand: e.brand ?? "",
            size: e.size ?? "",
            origin: e.origin ?? "",
            hsCode: e.hsCode ?? "",
            qtyName: e.qtyName ?? e.unitName ?? "BAGS",
            availableQty: n(e.qtyNo ?? e.quantity),
            qtyKgs: n(e.qtyKgs),
            emptyKgs: n(e.emptyKgs),
            netWeight: n(e.netWeight),
            location: "Purchase Booking",
            branchName: "Booking Origin",
            warehouseName: "Purchase Booking",
            stockRef: r.purchase_order_no,
            containerNo: null,
            currencyType: e.currency ?? e.currencyType ?? r.currency_code ?? "USD",
            exchangeRate: n(e.exchangeRate ?? r.exchange_rate) || 1,
            coursePrice: n(e.coursePrice),
            status: "Ready for booking",
          });
        });
      }
    } else if (source === "in_transit") {
      await fetchTransitLots();
    } else if (source === "local") {
      await fetchLocalLots();
    } else if (source === "warehouse") {
      await fetchWarehouseLots();
    } else if (source === "endorse") {
      const rows = (await sql`
        SELECT sm.id, sm.goods_id, sm.quantity, sm.reference_no, sm.unit_cost,
               g.goods_name, g.chs_code, w.warehouse_name,
               cb.name as branch_name
        FROM public.stock_movements sm
        LEFT JOIN public.goods g ON g.id = sm.goods_id
        LEFT JOIN public.warehouses w ON w.id = sm.warehouse_id
        LEFT JOIN public.city_branches cb ON cb.id = sm.city_branch_id
        WHERE ${scope} AND sm.deleted_at IS NULL
          AND lower(sm.movement_type) LIKE '%endors%'
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        out.push({
          lotNo: r.reference_no || `END-${String(r.id).slice(0, 8)}`,
          source,
          goodsId: r.goods_id ?? null,
          goodsName: r.goods_name ?? "",
          brand: "",
          size: "",
          origin: "",
          hsCode: r.chs_code ?? "",
          qtyName: "BAGS",
          availableQty: n(r.quantity),
          qtyKgs: 0,
          emptyKgs: 0,
          netWeight: 0,
          location: r.warehouse_name || "Endorse Stock",
          branchName: r.branch_name || "Endorse Branch",
          warehouseName: r.warehouse_name || "Endorse Stock",
          stockRef: r.reference_no || `END-${String(r.id).slice(0, 8)}`,
          containerNo: null,
          currencyType: "USD",
          exchangeRate: 1,
          coursePrice: n(r.unit_cost),
          status: "Endorsed / sellable",
        });
      }
    }
    return out;
  });

  let result = (lots ?? []).filter((l) => l.goodsName && l.availableQty > 0);

  if (opts.goodsName) {
    const target = opts.goodsName.trim().toLowerCase();
    result = result.filter(
      (l) => l.goodsName.toLowerCase().includes(target) || target.includes(l.goodsName.toLowerCase()),
    );
  }

  if (opts.goodsId) {
    result = result.filter((l) => l.goodsId === opts.goodsId);
  }

  if (needle) {
    result = result.filter((l) =>
      [l.lotNo, l.goodsName, l.location, l.branchName, l.warehouseName, l.stockRef, l.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }

  // localise goods_name for lots that carry a real goods_id
  const withId = result.filter((l) => l.goodsId);
  if (withId.length) {
    const localized = await localizeRecordNames(
      withId.map((l) => ({ id: l.goodsId as string, goods_name: l.goodsName })),
      "goods",
      "goods_name",
      lang,
    ).catch(() => null);
    if (localized) {
      const byId = new Map(localized.map((r: any) => [r.id, r.goods_name]));
      result = result.map((l) => (l.goodsId && byId.has(l.goodsId) ? { ...l, goodsName: byId.get(l.goodsId) as string } : l));
    }
  }

  return result.slice(0, limit);
}

export interface LotDeduction {
  customer: string;
  date: string;
  quantity: number;
  weight: number;
  reference: string;
}

/**
 * Real prior-sales history against a stock reference / lot — the wizard stores the chosen
 * lot's ref in form_data (allotName / stockLotNo / sourceStockRef) on save, so match on that.
 */
export async function getLotDeductions(session: ErpSession, stockRef: string): Promise<LotDeduction[]> {
  const ref = (stockRef ?? "").trim();
  if (!ref) return [];
  const rows = await withLocalPg(async (sql) => {
    const scope = scopeClause(sql, session);
    return (await sql`
      SELECT sales_order_no, customer_name, order_date, quantity, total_weight, form_data
      FROM public.sales_orders
      WHERE ${scope} AND deleted_at IS NULL
        AND (
          form_data->'form'->>'allotName' = ${ref}
          OR form_data->>'stockLotNo' = ${ref}
          OR form_data->'form'->>'sourceStockRef' = ${ref}
          OR form_data->'form'->>'stockRef' = ${ref}
        )
      ORDER BY order_date DESC
      LIMIT 100
    `) as unknown as any[];
  });
  return (rows ?? []).map((r) => ({
    customer: r.customer_name || r.form_data?.form?.customerName || "—",
    date: String(r.order_date || "").slice(0, 10),
    quantity: n(r.quantity),
    weight: n(r.total_weight),
    reference: r.sales_order_no || "—",
  }));
}
