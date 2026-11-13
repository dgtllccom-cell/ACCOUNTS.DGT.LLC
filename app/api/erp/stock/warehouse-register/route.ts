export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, recordInSessionScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { loadBalance } from "@/lib/services/stock-balance-report-service";
import { buildDestinationGroups, buildPurchaseRows, destinationTotals, type RawLaneLoad, type RawTransfer } from "@/lib/stock/purchase-movements";
import { loadTotals, normalizeBalanceRow, normalizeLoadRow, registerTotals } from "@/lib/stock/warehouse-register";

const PURCHASE_SOURCES = ["purchase_booking", "local_purchase"];

/**
 * GET /api/erp/stock/warehouse-register -> warehouse stock balances, every Purchase Booking and Local Purchase with its lot entries,
 * loading entries and stock transfer entries, and the Destination & Re-Export register (read-only), limited to the caller's scope.
 * Reads product_inventory_balances, the Stock Balance Report model (loadBalance), purchase_lane_loads, journal_stock_transfers and
 * goods_transfers. Writes nothing.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "read", countryId: null, countryBranchId: null, cityBranchId: null });
    // language contract: warehouse, goods, purchase and branch names are business data, returned as saved; labels are translated in the page.
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const db = await withLocalPg(async (sql) => {
      const balanceRows = await sql`
        select b.warehouse_id::text as warehouse_id,
               coalesce(w.warehouse_name, w.name_en, '') as warehouse_name,
               b.product_id::text as goods_id,
               coalesce(g.goods_name, '') as goods_name,
               coalesce(c.name, '') as country_name,
               b.country_id, b.country_branch_id, b.city_branch_id,
               coalesce(cb.name, '') as country_branch_name,
               coalesce(cib.name, cib.city_name, '') as city_branch_name,
               coalesce(cb.code, '') as country_branch_code,
               coalesce(cib.code, '') as city_branch_code,
               b.quantity_on_hand, b.quantity_reserved, b.quantity_available
        from public.product_inventory_balances b
        join public.warehouses w on w.id = b.warehouse_id and w.deleted_at is null
        join public.goods g on g.id = b.product_id and g.deleted_at is null
        left join public.countries c on c.id = b.country_id
        left join public.country_branches cb on cb.id = b.country_branch_id
        left join public.city_branches cib on cib.id = b.city_branch_id
        order by warehouse_name, goods_name
        limit 1000`;

      // Purchase sources only: Sales Booking / Local Sales loads share this table and are not purchase stock.
      const loadRows = await sql`
        select l.id::text as id, l.source_type, l.source_id::text as source_id,
               l.purchase_order_id::text as purchase_order_id, l.local_purchase_id::text as local_purchase_id,
               -- Local Purchase loads are saved without a loading date: the lane row's own creation time is when the load entered the lane.
               l.purchase_ref_no, l.loading_record_no, coalesce(l.loading_date, l.created_at::date) as loading_date, l.goods_name,
               l.loaded_quantity, l.unit, l.gross_weight, l.net_weight, l.disposition, l.transfer_destination, l.destination_text,
               l.lane_status, l.lane_stock_qty,
               coalesce(dw.warehouse_name, '') as disposition_warehouse_name,
               l.country_id, l.country_branch_id, l.city_branch_id,
               coalesce(c.name, '') as country_name,
               coalesce(cb.name, '') as country_branch_name,
               coalesce(cb.code, '') as country_branch_code,
               coalesce(cib.name, cib.city_name, '') as city_branch_name,
               coalesce(cib.code, '') as city_branch_code
        from public.purchase_lane_loads l
        left join public.warehouses dw on dw.id = l.disposition_warehouse_id
        left join public.countries c on c.id = l.country_id
        left join public.country_branches cb on cb.id = l.country_branch_id
        left join public.city_branches cib on cib.id = l.city_branch_id
        where l.deleted_at is null and l.source_type = any(${PURCHASE_SOURCES}::text[])
        order by l.purchase_ref_no, l.loading_record_no nulls last, l.loading_date nulls last
        limit 2000`;

      const stockTransfers = await sql`
        select j.id::text as id, 'stock' as journal, j.transfer_no, j.purchase_order_id::text as purchase_order_id,
               j.local_purchase_id::text as local_purchase_id, j.loading_record_id::text as loading_record_id, j.line_key,
               null::text as lot_ref, j.destination_type as destination, j.status, j.quantity, j.unit,
               coalesce(j.issued_at::date, j.confirmed_at::date, j.transfer_date) as transfer_date, j.goods_name,
               coalesce(w.warehouse_name, '') as warehouse_name, coalesce(j.customer_name, j.sales_order_no, '') as party_name
        from public.journal_stock_transfers j
        left join public.warehouses w on w.id = j.warehouse_id
        where j.deleted_at is null
        limit 5000`;

      // The Goods Transfer Journal may not be installed on every database yet.
      const hasGoodsTransfers = (await sql`select to_regclass('public.goods_transfers') is not null as ok`)[0]?.ok === true;
      const goodsTransfers = hasGoodsTransfers
        ? await sql`
          select t.id::text as id, 'goods' as journal, t.transfer_no, null::text as purchase_order_id,
                 t.local_purchase_id::text as local_purchase_id, null::text as loading_record_id, null::text as line_key,
                 pl.lot_ref, t.purpose as destination, t.status, t.qty as quantity, pl.unit_name as unit,
                 coalesce(t.completed_at::date, t.created_at::date) as transfer_date, pl.goods_name,
                 coalesce(w.warehouse_name, '') as warehouse_name, coalesce(t.provider_name, '') as party_name
          from public.goods_transfers t
          join public.purchase_lots pl on pl.id = t.lot_id
          left join public.warehouses w on w.id = t.dest_warehouse_id
          limit 5000`
        : [];

      const loadingDates = await sql`
        select plr.id::text as id, coalesce(plr.loaded_at::date, plr.created_at::date) as loading_date
        from public.purchase_loading_records plr
        where plr.deleted_at is null`;

      return { balanceRows, loadRows, transfers: [...stockTransfers, ...goodsTransfers], loadingDates };
    });
    if (!db) throw new Error("Unable to load the stock database.");

    const scopedBalances = (db.balanceRows as Record<string, unknown>[]).filter((r) => recordInSessionScope(session, r as never));
    const balances = scopedBalances.map(normalizeBalanceRow);
    const scopedLoads = (db.loadRows as Record<string, unknown>[]).filter((r) => recordInSessionScope(session, r as never));
    const loads = scopedLoads.map(normalizeLoadRow);

    // Purchase bills are scope-filtered in SQL by loadBalance; transfers and loadings only attach to bills the caller can see.
    const { bills } = await loadBalance(session, { lang });
    const dates: Record<string, string> = {};
    for (const r of db.loadingDates as Record<string, unknown>[]) {
      const d = r.loading_date instanceof Date ? r.loading_date.toISOString().slice(0, 10) : String(r.loading_date ?? "").slice(0, 10);
      if (d) dates[String(r.id)] = d;
    }
    const purchases = buildPurchaseRows(bills, scopedLoads as unknown as RawLaneLoad[], db.transfers as unknown as RawTransfer[], dates);
    const destinations = buildDestinationGroups(purchases);

    return apiOk({
      rows: balances,
      totals: registerTotals(balances),
      loads,
      loadTotals: loadTotals(loads),
      purchases,
      destinations,
      destinationTotals: destinationTotals(destinations),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
