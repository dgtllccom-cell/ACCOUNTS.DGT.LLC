export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, recordInSessionScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { normalizeBalanceRow, registerTotals } from "@/lib/stock/warehouse-register";

/**
 * GET /api/erp/stock/warehouse-register -> warehouse stock balances (read-only), limited to the caller's scope.
 * Reads product_inventory_balances joined to warehouses and goods. Writes nothing.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "read", countryId: null, countryBranchId: null, cityBranchId: null });
    // language contract: warehouse, goods and country names are business data, returned as saved; labels are translated in the page.
    void (await getRequestLanguage(request.nextUrl.searchParams.get("lang")));
    const rows = await withLocalPg(async (sql) => sql`
      select b.warehouse_id::text as warehouse_id,
             coalesce(w.warehouse_name, w.name_en, '') as warehouse_name,
             b.product_id::text as goods_id,
             coalesce(g.goods_name, '') as goods_name,
             coalesce(c.name, '') as country_name,
             b.country_id, b.country_branch_id, b.city_branch_id,
             coalesce(cb.name, '') as country_branch_name,
             coalesce(cib.name, cib.city_name, '') as city_branch_name,
             b.quantity_on_hand, b.quantity_reserved, b.quantity_available
      from public.product_inventory_balances b
      join public.warehouses w on w.id = b.warehouse_id and w.deleted_at is null
      join public.goods g on g.id = b.product_id and g.deleted_at is null
      left join public.countries c on c.id = b.country_id
      left join public.country_branches cb on cb.id = b.country_branch_id
      left join public.city_branches cib on cib.id = b.city_branch_id
      order by warehouse_name, goods_name
      limit 1000`);
    const scoped = (rows as Record<string, unknown>[]).filter((r) => recordInSessionScope(session, r as never));
    const data = scoped.map(normalizeBalanceRow);
    return apiOk({ rows: data, totals: registerTotals(data) });
  } catch (error) {
    return handleApiError(error);
  }
}
