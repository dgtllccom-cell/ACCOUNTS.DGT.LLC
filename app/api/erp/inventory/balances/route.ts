import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "inventory", action: "read" });

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();
    const warehouseId = searchParams.get("warehouseId")?.trim();
    const limit = Number(searchParams.get("limit") || "200");
    const offset = Number(searchParams.get("offset") || "0");

    const result = await withLocalPg(async (sql) => {
      let query = sql`
        SELECT 
          pib.id,
          pib.product_id AS goods_id,
          pib.warehouse_id,
          pib.country_id,
          pib.country_branch_id,
          pib.city_branch_id,
          pib.quantity_on_hand,
          pib.quantity_reserved,
          pib.quantity_available,
          pib.updated_at,
          g.goods_name,
          g.chs_code,
          g.original_language_code,
          w.warehouse_name,
          w.warehouse_code,
          w.warehouse_type,
          c.name AS country_name
        FROM public.product_inventory_balances pib
        LEFT JOIN public.goods g ON g.id = pib.product_id
        LEFT JOIN public.warehouses w ON w.id = pib.warehouse_id
        LEFT JOIN public.countries c ON c.id = pib.country_id
        WHERE g.deleted_at IS NULL AND w.deleted_at IS NULL
      `;

      if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
        query = sql`${query} AND (pib.country_id IS NULL OR pib.country_id = ANY(${session.countryIds}::uuid[]))`;
      }

      if (warehouseId) {
        query = sql`${query} AND pib.warehouse_id = ${warehouseId}::uuid`;
      }

      if (q) {
        const searchPattern = `%${q}%`;
        query = sql`${query} AND (
          g.goods_name ILIKE ${searchPattern} OR 
          g.chs_code ILIKE ${searchPattern} OR 
          w.warehouse_name ILIKE ${searchPattern}
        )`;
      }

      const rows = await sql`
        ${query}
        ORDER BY g.goods_name ASC, w.warehouse_name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const summary = await sql`
        SELECT 
          COUNT(DISTINCT pib.product_id) as total_items,
          COALESCE(SUM(pib.quantity_on_hand), 0) as total_quantity_on_hand,
          COALESCE(SUM(pib.quantity_available), 0) as total_quantity_available
        FROM public.product_inventory_balances pib
        LEFT JOIN public.goods g ON g.id = pib.product_id
        LEFT JOIN public.warehouses w ON w.id = pib.warehouse_id
        WHERE g.deleted_at IS NULL AND w.deleted_at IS NULL
        ${!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0 ? sql`AND (pib.country_id IS NULL OR pib.country_id = ANY(${session.countryIds}::uuid[]))` : sql``}
        ${warehouseId ? sql`AND pib.warehouse_id = ${warehouseId}::uuid` : sql``}
      `;

      return {
        balances: rows,
        summary: summary[0] || { total_items: 0, total_quantity_on_hand: 0, total_quantity_available: 0 }
      };
    });

    return apiOk(result || { balances: [], summary: { total_items: 0, total_quantity_on_hand: 0, total_quantity_available: 0 } });
  } catch (error) {
    return handleApiError(error);
  }
}
