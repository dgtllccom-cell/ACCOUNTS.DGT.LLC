import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "inventory", action: "read" });

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();
    const warehouseId = searchParams.get("warehouseId")?.trim();
    const limit = Number(searchParams.get("limit") || "200");
    const offset = Number(searchParams.get("offset") || "0");

    const rawLang = (searchParams.get("lang") || request.headers.get("accept-language") || "en").toLowerCase();
    const lang = (["en", "ur", "ar", "fa", "ps"].includes(rawLang) ? rawLang : "en") as SupportedLanguage;

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

      let rows: any[] = await sql`
        ${query}
        ORDER BY g.goods_name ASC, w.warehouse_name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      if (rows.length > 0) {
        // Localize goods_name
        const goodsItems = rows.map(r => ({ id: r.goods_id, goods_name: r.goods_name })).filter(r => r.id);
        const localizedGoods = await localizeRecordNames(goodsItems, "goods", "goods_name", lang);
        const goodsMap = new Map(localizedGoods.map(g => [g.id, g.goods_name]));

        // Localize warehouse_name
        const whItems = rows.map(r => ({ id: r.warehouse_id, warehouse_name: r.warehouse_name })).filter(r => r.id);
        const localizedWh = await localizeRecordNames(whItems, "warehouses", "warehouse_name", lang);
        const whMap = new Map(localizedWh.map(w => [w.id, w.warehouse_name]));

        // Localize country_name
        const countryItems = rows.map(r => ({ id: r.country_id, name: r.country_name })).filter(r => r.id);
        const localizedCountries = await localizeRecordNames(countryItems, "countries", "name", lang);
        const countryMap = new Map(localizedCountries.map(c => [c.id, c.name]));

        rows = rows.map(r => ({
          ...r,
          goods_name: r.goods_id ? (goodsMap.get(r.goods_id) || r.goods_name) : r.goods_name,
          warehouse_name: r.warehouse_id ? (whMap.get(r.warehouse_id) || r.warehouse_name) : r.warehouse_name,
          country_name: r.country_id ? (countryMap.get(r.country_id) || r.country_name) : r.country_name
        }));
      }

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
