import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Low-stock / re-order worklist backed by the REAL product_inventory_balances data via
 * public.product_low_stock_v (migration 20261025). A product is only ever listed when it
 * has a configured min_stock_level or reorder_level — there is no hard-coded magic
 * threshold. Country/branch scoped to the caller's session.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const params = request.nextUrl.searchParams;
    const countryId = params.get("countryId");
    const countryBranchId = params.get("countryBranchId");
    const cityBranchId = params.get("cityBranchId");
    const warehouseId = params.get("warehouseId");
    const statusFilter = params.get("status"); // 'reorder' | 'low' | undefined (both)
    const limit = Math.min(Number(params.get("limit") || "200"), 1000);

    authorizeApiScope(session, { resource: "products", action: "read", countryId, countryBranchId, cityBranchId });

    const rawLang = (params.get("lang") || request.headers.get("accept-language") || "en").toLowerCase();
    const lang = (["en", "ur", "ar", "fa", "ps"].includes(rawLang) ? rawLang : "en") as SupportedLanguage;

    const result = await withLocalPg(async (sql) => {
      let query = sql`
        SELECT v.balance_id, v.product_id, v.product_name, v.sku, v.barcode,
               v.country_id, v.country_branch_id, v.city_branch_id, v.warehouse_id,
               v.quantity_on_hand, v.quantity_reserved, v.quantity_available,
               v.min_stock_level, v.reorder_level, v.stock_status, v.suggested_restock_qty,
               v.updated_at, w.warehouse_name, c.name AS country_name
        FROM public.product_low_stock_v v
        LEFT JOIN public.warehouses w ON w.id = v.warehouse_id
        LEFT JOIN public.countries c ON c.id = v.country_id
        WHERE v.stock_status IN ('reorder','low')
      `;

      if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
        query = sql`${query} AND (v.country_id IS NULL OR v.country_id = ANY(${session.countryIds}::uuid[]))`;
      }
      if (countryId) query = sql`${query} AND v.country_id = ${countryId}::uuid`;
      if (countryBranchId) query = sql`${query} AND v.country_branch_id = ${countryBranchId}::uuid`;
      if (cityBranchId) query = sql`${query} AND v.city_branch_id = ${cityBranchId}::uuid`;
      if (warehouseId) query = sql`${query} AND v.warehouse_id = ${warehouseId}::uuid`;
      if (statusFilter === "reorder" || statusFilter === "low") {
        query = sql`${query} AND v.stock_status = ${statusFilter}`;
      }

      let rows: any[] = await sql`${query} ORDER BY (v.stock_status = 'reorder') DESC, v.suggested_restock_qty DESC LIMIT ${limit}`;

      if (rows.length > 0) {
        const nameItems = rows.map((r) => ({ id: r.product_id, product_name: r.product_name })).filter((r) => r.id);
        const localized = await localizeRecordNames(nameItems, "products", "product_name", lang);
        const nameMap = new Map(localized.map((r) => [r.id, r.product_name]));
        rows = rows.map((r) => ({ ...r, product_name: nameMap.get(r.product_id) || r.product_name }));
      }

      const [summary] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE stock_status = 'reorder')                          AS reorder_count,
          COUNT(*) FILTER (WHERE stock_status = 'low')                              AS low_count,
          COUNT(DISTINCT product_id) FILTER (WHERE stock_status IN ('reorder','low')) AS distinct_products
        FROM public.product_low_stock_v
        ${
          !session.isSuperAdmin && session.countryIds && session.countryIds.length > 0
            ? sql`WHERE (country_id IS NULL OR country_id = ANY(${session.countryIds}::uuid[]))`
            : sql``
        }
      `;

      return { rows, summary: summary || { reorder_count: 0, low_count: 0, distinct_products: 0 } };
    });

    return apiOk(result || { rows: [], summary: { reorder_count: 0, low_count: 0, distinct_products: 0 } });
  } catch (error) {
    return handleApiError(error);
  }
}
