export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, recordInSessionScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { loadTotals, normalizeBalanceRow, normalizeLoadRow, registerTotals } from "@/lib/stock/warehouse-register";

/**
 * GET /api/erp/stock/warehouse-register -> warehouse stock balances and purchase loading entries (read-only),
 * limited to the caller's scope. Reads product_inventory_balances and purchase_lane_loads. Writes nothing.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "read", countryId: null, countryBranchId: null, cityBranchId: null });
    // language contract: warehouse, goods, purchase and branch names are business data, returned as saved; labels are translated in the page.
    void (await getRequestLanguage(request.nextUrl.searchParams.get("lang")));

    const balanceRows = await withLocalPg(async (sql) => sql`
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
      limit 1000`);

    const loadRows = await withLocalPg(async (sql) => sql`
      select l.id::text as id, l.purchase_ref_no, l.loading_record_no, l.loading_date, l.goods_name,
             l.loaded_quantity, l.unit, l.gross_weight, l.net_weight, l.disposition, l.transfer_destination,
             l.lane_status, l.lane_stock_qty,
             l.country_id, l.country_branch_id, l.city_branch_id,
             coalesce(c.name, '') as country_name,
             coalesce(cb.name, '') as country_branch_name,
             coalesce(cb.code, '') as country_branch_code,
             coalesce(cib.name, cib.city_name, '') as city_branch_name,
             coalesce(cib.code, '') as city_branch_code
      from public.purchase_lane_loads l
      left join public.countries c on c.id = l.country_id
      left join public.country_branches cb on cb.id = l.country_branch_id
      left join public.city_branches cib on cib.id = l.city_branch_id
      where l.deleted_at is null
      order by l.purchase_ref_no, l.loading_record_no nulls last, l.loading_date nulls last
      limit 2000`);

    const scopedBalances = (balanceRows as Record<string, unknown>[]).filter((r) => recordInSessionScope(session, r as never));
    const balances = scopedBalances.map(normalizeBalanceRow);
    const scopedLoads = (loadRows as Record<string, unknown>[]).filter((r) => recordInSessionScope(session, r as never));
    const loads = scopedLoads.map(normalizeLoadRow);

    return apiOk({
      rows: balances,
      totals: registerTotals(balances),
      loads,
      loadTotals: loadTotals(loads),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
