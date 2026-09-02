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

export type SaleSource = "booking" | "in_transit" | "local" | "warehouse" | "endorse";
export const SALE_SOURCES: SaleSource[] = ["booking", "in_transit", "local", "warehouse", "endorse"];

export interface AvailableLot {
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
  stockRef: string;
  containerNo: string | null;
  currencyType: string;
  exchangeRate: number;
  coursePrice: number;
  status: string;
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

export async function listAvailableLots(
  session: ErpSession,
  opts: { source: SaleSource; q?: string | null; lang?: SupportedLanguage; limit?: number },
): Promise<AvailableLot[]> {
  const source = opts.source;
  const lang = opts.lang ?? "en";
  const limit = Math.min(opts.limit ?? 300, 1000);
  const needle = (opts.q ?? "").trim().toLowerCase();

  const lots = await withLocalPg(async (sql) => {
    const scope = scopeClause(sql, session);
    const out: AvailableLot[] = [];

    if (source === "booking") {
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
      const rows = (await sql`
        SELECT id, loading_record_no, purchase_order_no, container_number, loading_location,
               receiving_location, shipment_status, purchase_currency, exchange_rate,
               loaded_quantity, total_quantity, received_quantity, report_payload
        FROM public.purchase_loading_records
        WHERE ${scope}
          AND loading_status = 'loaded'
          AND coalesce(shipment_status,'') NOT IN ('received','local-sale')
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        const entries: any[] = r.report_payload?.goodsEntries ?? [];
        const remain = n(r.loaded_quantity) - n(r.received_quantity);
        if (entries.length) {
          entries.forEach((e: any, idx: number) => {
            out.push({
              lotNo: `${r.loading_record_no}#${idx + 1}`,
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
              location: `In Transit — ${r.loading_location || r.receiving_location || ""}`.trim(),
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
            lotNo: r.loading_record_no,
            source,
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
            stockRef: r.loading_record_no,
            containerNo: r.container_number ?? null,
            currencyType: r.purchase_currency ?? "USD",
            exchangeRate: n(r.exchange_rate) || 1,
            coursePrice: 0,
            status: r.shipment_status || "Loaded / On route",
          });
        }
      }
    } else if (source === "local") {
      const rows = (await sql`
        SELECT id, goods_id, goods_name, brand, size, quantity_name, numbers, net_weight,
               empty_kgs, quantity_kgs, purchase_rate, purchase_currency, exchange_rate,
               warehouse_name, lot_no, manual_bill_no, status, origin_country_name
        FROM public.local_purchases
        WHERE ${scope} AND deleted_at IS NULL
          AND coalesce(status,'') NOT IN ('sold','consumed','cancelled')
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        out.push({
          lotNo: r.lot_no || `LP-${String(r.id).slice(0, 8)}`,
          source,
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
          stockRef: r.manual_bill_no || r.lot_no || `LP-${String(r.id).slice(0, 8)}`,
          containerNo: null,
          currencyType: r.purchase_currency ?? "USD",
          exchangeRate: n(r.exchange_rate) || 1,
          coursePrice: n(r.purchase_rate),
          status: r.status || "Local stock",
        });
      }
    } else if (source === "warehouse") {
      const rows = (await sql`
        SELECT pib.id, pib.product_id AS goods_id, pib.quantity_available,
               g.goods_name, g.chs_code, w.warehouse_name, w.warehouse_code
        FROM public.product_inventory_balances pib
        LEFT JOIN public.goods g ON g.id = pib.product_id
        LEFT JOIN public.warehouses w ON w.id = pib.warehouse_id
        WHERE ${scope} AND pib.quantity_available > 0 AND g.deleted_at IS NULL
        ORDER BY pib.updated_at DESC
        LIMIT ${limit}
      `) as unknown as any[];
      for (const r of rows) {
        out.push({
          lotNo: `WH-${String(r.id).slice(0, 8)}`,
          source,
          goodsId: r.goods_id ?? null,
          goodsName: r.goods_name ?? "",
          brand: "",
          size: "",
          origin: "",
          hsCode: r.chs_code ?? "",
          qtyName: "BAGS",
          availableQty: n(r.quantity_available),
          qtyKgs: 0,
          emptyKgs: 0,
          netWeight: 0,
          location: r.warehouse_name || "Warehouse",
          stockRef: r.warehouse_code || `WH-${String(r.id).slice(0, 8)}`,
          containerNo: null,
          currencyType: "USD",
          exchangeRate: 1,
          coursePrice: 0,
          status: "Warehouse available",
        });
      }
    } else if (source === "endorse") {
      const rows = (await sql`
        SELECT sm.id, sm.goods_id, sm.quantity, sm.reference_no, sm.unit_cost,
               g.goods_name, g.chs_code, w.warehouse_name
        FROM public.stock_movements sm
        LEFT JOIN public.goods g ON g.id = sm.goods_id
        LEFT JOIN public.warehouses w ON w.id = sm.warehouse_id
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

  if (needle) {
    result = result.filter((l) =>
      [l.lotNo, l.goodsName, l.location, l.stockRef, l.status].join(" ").toLowerCase().includes(needle),
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
