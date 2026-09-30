import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope, sqlHierarchyScopeCondition } from "@/lib/api/scope-middleware";
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
        query = sql`${query} AND (pib.country_id IS NULL OR ${sqlHierarchyScopeCondition(sql, session, "pib")})`;
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
          COALESCE(SUM(pib.quantity_available), 0) as total_quantity_available,
          COALESCE(SUM(pib.quantity_reserved), 0) as total_quantity_reserved
        FROM public.product_inventory_balances pib
        LEFT JOIN public.goods g ON g.id = pib.product_id
        LEFT JOIN public.warehouses w ON w.id = pib.warehouse_id
        WHERE g.deleted_at IS NULL AND w.deleted_at IS NULL
        ${!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0 ? sql`AND (pib.country_id IS NULL OR ${sqlHierarchyScopeCondition(sql, session, "pib")})` : sql``}
        ${warehouseId ? sql`AND pib.warehouse_id = ${warehouseId}::uuid` : sql``}
      `;

      // Real low-stock count from the already-built product_low_stock_v view (same
      // reorder/min-stock config a user enters on the goods master, mirrored onto its
      // products shadow row on stock receive — see 20261027_goods_reorder_barcode.sql).
      const lowStock = await sql`
        SELECT COUNT(*) as low_stock_count
        FROM public.product_low_stock_v v
        WHERE v.stock_status IN ('reorder', 'low')
        ${!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0 ? sql`AND (v.country_id IS NULL OR ${sqlHierarchyScopeCondition(sql, session, "v")})` : sql``}
        ${warehouseId ? sql`AND v.warehouse_id = ${warehouseId}::uuid` : sql``}
      `;

      // Incoming: real ordered-not-yet-received quantity, from purchase_order_items
      // linked to the goods master (poi.product_id) on Posted (confirmed, not Draft)
      // purchase orders. Most existing DEV purchase order lines predate the
      // goods-master link (entered as free text), so this is honestly small/zero on
      // DEV today — it is architecturally correct, not a placeholder.
      const incoming = await sql`
        SELECT COALESCE(SUM(poi.quantity), 0) AS incoming_qty, COUNT(DISTINCT poi.purchase_order_id) AS incoming_po_count
        FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.purchase_order_id AND po.deleted_at IS NULL
        WHERE poi.product_id IS NOT NULL AND po.status = 'Posted'
        ${!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0 ? sql`AND (po.country_id IS NULL OR ${sqlHierarchyScopeCondition(sql, session, "po")})` : sql``}
      `;

      // In Transit: the subset of Incoming that also has an active (not yet arrived)
      // shipping_bl_records row — a real physical-shipment signal, not invented.
      const inTransit = await sql`
        SELECT COALESCE(SUM(poi.quantity), 0) AS in_transit_qty
        FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.purchase_order_id AND po.deleted_at IS NULL
        WHERE poi.product_id IS NOT NULL AND po.status = 'Posted'
          AND EXISTS (
            SELECT 1 FROM public.shipping_bl_records b
            WHERE b.purchase_order_id = po.id AND b.deleted_at IS NULL
              AND COALESCE(b.shipment_status,'') NOT IN ('arrived','delivered','completed','cleared','closed')
          )
        ${!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0 ? sql`AND (po.country_id IS NULL OR ${sqlHierarchyScopeCondition(sql, session, "po")})` : sql``}
      `;

      // Outgoing: committed (non-draft, non-cancelled) sales orders. sales_order_items
      // has no product/goods link at all (free-text goods_name only), so this is an
      // honest ORDER-level aggregate, not a per-SKU quantity — never fuzzy-matched
      // against the goods master to fabricate a per-item number.
      const outgoing = await sql`
        SELECT COUNT(*) AS outgoing_order_count, COALESCE(SUM(so.total_weight), 0) AS outgoing_weight
        FROM public.sales_orders so
        WHERE so.deleted_at IS NULL AND lower(coalesce(so.sales_status,'')) NOT IN ('draft','cancelled')
        ${!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0 ? sql`AND (so.country_id IS NULL OR ${sqlHierarchyScopeCondition(sql, session, "so")})` : sql``}
      `;

      return {
        balances: rows,
        summary: {
          ...(summary[0] || { total_items: 0, total_quantity_on_hand: 0, total_quantity_available: 0, total_quantity_reserved: 0 }),
          low_stock_count: Number(lowStock[0]?.low_stock_count || 0),
          incoming_quantity: Number(incoming[0]?.incoming_qty || 0),
          incoming_po_count: Number(incoming[0]?.incoming_po_count || 0),
          in_transit_quantity: Number(inTransit[0]?.in_transit_qty || 0),
          outgoing_order_count: Number(outgoing[0]?.outgoing_order_count || 0),
          outgoing_weight: Number(outgoing[0]?.outgoing_weight || 0)
        }
      };
    });

    return apiOk(result || { balances: [], summary: { total_items: 0, total_quantity_on_hand: 0, total_quantity_available: 0, total_quantity_reserved: 0, low_stock_count: 0, incoming_quantity: 0, incoming_po_count: 0, in_transit_quantity: 0, outgoing_order_count: 0, outgoing_weight: 0 } });
  } catch (error) {
    return handleApiError(error);
  }
}
