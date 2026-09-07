import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/inventory/reports?report=<key>
 *
 * Inventory / Stock report suite on the canonical UniversalReportShell. Returns
 * { columns, rows, totals } for one of the keys below. Read-only; country/branch
 * scope is enforced server-side (a user cannot widen scope with query params).
 * Quantities and stored unit costs are read as-is — no revaluation.
 */

const REPORTS = [
  "stock_on_hand",
  "stock_valuation",
  "low_stock",
  "warehouse_wise",
  "country_wise",
  "goods_wise",
  "stock_movements",
] as const;
type ReportKey = (typeof REPORTS)[number];

const n = (v: any) => (v == null || v === "" ? 0 : Number(v) || 0);
const round2 = (v: number) => +v.toFixed(2);

type Col = { key: string; label: string; align?: "left" | "right" | "center"; kind?: "money" | "qty" | "text" | "date" };

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const scope = resolveReportScope(session);
    const sp = request.nextUrl.searchParams;

    const report = (sp.get("report") || "stock_on_hand") as ReportKey;
    if (!REPORTS.includes(report)) {
      throw new ApiClientError(`Unknown report "${report}"`, { status: 400, code: "UNKNOWN_REPORT" });
    }

    const { effectiveCountryId } = enforceScopeFilters(
      scope,
      sp.get("countryId") && sp.get("countryId") !== "all" ? sp.get("countryId") : null,
      null,
    );
    const from = sp.get("from") || null;
    const to = sp.get("to") || null;
    const warehouseF = sp.get("warehouseId") && sp.get("warehouseId") !== "all" ? sp.get("warehouseId") : null;

    const payload = await withLocalPg(async (sql) => {
      // ---- balances in scope --------------------------------------------------
      const balances = await sql`
        select
          pib.id, pib.product_id as goods_id, pib.warehouse_id, pib.country_id,
          pib.quantity_on_hand, pib.quantity_reserved, pib.quantity_available, pib.updated_at,
          g.goods_name, g.chs_code,
          coalesce(g.reorder_level, g.min_stock_level, 0) as reorder_level,
          w.warehouse_name, w.warehouse_code,
          c.name as country_name, c.currency_code as country_currency
        from public.product_inventory_balances pib
        left join public.goods g on g.id = pib.product_id
        left join public.warehouses w on w.id = pib.warehouse_id
        left join public.countries c on c.id = pib.country_id
        where g.deleted_at is null and w.deleted_at is null
          ${effectiveCountryId ? sql`and pib.country_id = ${effectiveCountryId}` : sql``}
          ${warehouseF ? sql`and pib.warehouse_id = ${warehouseF}` : sql``}
        order by g.goods_name asc, w.warehouse_name asc
      `;

      // ---- last known unit cost per goods (from stock movements) -------------
      const goodsIds = [...new Set(balances.map((b: any) => b.goods_id).filter(Boolean))];
      const costRows = goodsIds.length
        ? await sql`
            select distinct on (goods_id) goods_id, unit_cost
            from public.stock_movements
            where goods_id = any(${goodsIds}::uuid[]) and coalesce(unit_cost, 0) > 0
            order by goods_id, movement_date desc nulls last, created_at desc
          `
        : [];
      const costByGoods = new Map(costRows.map((r: any) => [r.goods_id, n(r.unit_cost)]));

      const enriched = balances.map((b: any) => {
        const unitCost = costByGoods.get(b.goods_id) || 0;
        const onHand = n(b.quantity_on_hand);
        return {
          goodsName: b.goods_name || "—",
          chsCode: b.chs_code || "—",
          warehouseName: b.warehouse_name || "—",
          warehouseCode: b.warehouse_code || "—",
          countryName: b.country_name || "—",
          currency: b.country_currency || "USD",
          onHand,
          reserved: n(b.quantity_reserved),
          available: n(b.quantity_available),
          reorderLevel: n(b.reorder_level),
          unitCost: round2(unitCost),
          stockValue: round2(onHand * unitCost),
          updatedAt: b.updated_at,
        };
      });

      const fcOf = enriched[0]?.currency || "USD";
      let columns: Col[] = [];
      let rows: Record<string, any>[] = [];
      let totals: Record<string, any> = {};

      const groupSum = (keyFn: (m: any) => string, label: string) => {
        const map = new Map<string, any>();
        for (const m of enriched) {
          const g = keyFn(m) || "—";
          const cur = map.get(g) || { group: g, items: 0, onHand: 0, available: 0, value: 0 };
          cur.items += 1;
          cur.onHand += m.onHand;
          cur.available += m.available;
          cur.value += m.stockValue;
          map.set(g, cur);
        }
        columns = [
          { key: "group", label, kind: "text" },
          { key: "items", label: "Line Items", align: "right", kind: "qty" },
          { key: "onHand", label: "On Hand", align: "right", kind: "qty" },
          { key: "available", label: "Available", align: "right", kind: "qty" },
          { key: "value", label: "Stock Value", align: "right", kind: "money" },
        ];
        rows = [...map.values()].map((r) => ({
          group: r.group, items: r.items,
          onHand: round2(r.onHand), available: round2(r.available), value: round2(r.value),
        }));
        totals = {
          items: enriched.length,
          onHand: round2(rows.reduce((s, r) => s + r.onHand, 0)),
          available: round2(rows.reduce((s, r) => s + r.available, 0)),
          value: round2(rows.reduce((s, r) => s + r.value, 0)),
        };
      };

      switch (report) {
        case "stock_on_hand": {
          columns = [
            { key: "goodsName", label: "Goods", kind: "text" },
            { key: "chsCode", label: "CHS Code", kind: "text" },
            { key: "warehouseName", label: "Warehouse", kind: "text" },
            { key: "countryName", label: "Country", kind: "text" },
            { key: "onHand", label: "On Hand", align: "right", kind: "qty" },
            { key: "reserved", label: "Reserved", align: "right", kind: "qty" },
            { key: "available", label: "Available", align: "right", kind: "qty" },
          ];
          rows = enriched.map((m) => ({
            goodsName: m.goodsName, chsCode: m.chsCode, warehouseName: m.warehouseName,
            countryName: m.countryName, onHand: m.onHand, reserved: m.reserved, available: m.available,
          }));
          totals = {
            items: enriched.length,
            onHand: round2(enriched.reduce((s, m) => s + m.onHand, 0)),
            reserved: round2(enriched.reduce((s, m) => s + m.reserved, 0)),
            available: round2(enriched.reduce((s, m) => s + m.available, 0)),
          };
          break;
        }
        case "stock_valuation": {
          columns = [
            { key: "goodsName", label: "Goods", kind: "text" },
            { key: "warehouseName", label: "Warehouse", kind: "text" },
            { key: "countryName", label: "Country", kind: "text" },
            { key: "onHand", label: "On Hand", align: "right", kind: "qty" },
            { key: "unitCost", label: "Unit Cost", align: "right", kind: "money" },
            { key: "stockValue", label: "Stock Value", align: "right", kind: "money" },
          ];
          rows = enriched.map((m) => ({
            goodsName: m.goodsName, warehouseName: m.warehouseName, countryName: m.countryName,
            onHand: m.onHand, unitCost: m.unitCost, stockValue: m.stockValue,
          }));
          totals = {
            items: enriched.length,
            onHand: round2(enriched.reduce((s, m) => s + m.onHand, 0)),
            stockValue: round2(enriched.reduce((s, m) => s + m.stockValue, 0)),
          };
          break;
        }
        case "low_stock": {
          const low = enriched.filter((m) => m.reorderLevel > 0 && m.available <= m.reorderLevel);
          columns = [
            { key: "goodsName", label: "Goods", kind: "text" },
            { key: "warehouseName", label: "Warehouse", kind: "text" },
            { key: "countryName", label: "Country", kind: "text" },
            { key: "available", label: "Available", align: "right", kind: "qty" },
            { key: "reorderLevel", label: "Reorder Level", align: "right", kind: "qty" },
            { key: "shortfall", label: "Shortfall", align: "right", kind: "qty" },
          ];
          rows = low.map((m) => ({
            goodsName: m.goodsName, warehouseName: m.warehouseName, countryName: m.countryName,
            available: m.available, reorderLevel: m.reorderLevel,
            shortfall: round2(Math.max(0, m.reorderLevel - m.available)),
          }));
          totals = { items: low.length, shortfall: round2(rows.reduce((s, r) => s + r.shortfall, 0)) };
          break;
        }
        case "warehouse_wise":
          groupSum((m) => m.warehouseName, "Warehouse");
          break;
        case "country_wise":
          groupSum((m) => m.countryName, "Country");
          break;
        case "goods_wise":
          groupSum((m) => m.goodsName, "Goods");
          break;
        case "stock_movements": {
          const moves = await sql`
            select
              sm.movement_type, sm.quantity, sm.unit_cost, sm.total_amount, sm.reference_no,
              sm.notes, sm.movement_date,
              g.goods_name, w.warehouse_name, c.name as country_name
            from public.stock_movements sm
            left join public.goods g on g.id = sm.goods_id
            left join public.warehouses w on w.id = sm.warehouse_id
            left join public.countries c on c.id = sm.country_id
            where 1 = 1
              ${effectiveCountryId ? sql`and sm.country_id = ${effectiveCountryId}` : sql``}
              ${warehouseF ? sql`and sm.warehouse_id = ${warehouseF}` : sql``}
              ${from ? sql`and sm.movement_date >= ${from}` : sql``}
              ${to ? sql`and sm.movement_date <= ${to}` : sql``}
            order by sm.movement_date desc nulls last, sm.created_at desc
            limit 2000
          `;
          columns = [
            { key: "movementDate", label: "Date", kind: "date" },
            { key: "movementType", label: "Type", kind: "text" },
            { key: "goodsName", label: "Goods", kind: "text" },
            { key: "warehouseName", label: "Warehouse", kind: "text" },
            { key: "countryName", label: "Country", kind: "text" },
            { key: "referenceNo", label: "Reference", kind: "text" },
            { key: "quantity", label: "Quantity", align: "right", kind: "qty" },
            { key: "unitCost", label: "Unit Cost", align: "right", kind: "money" },
            { key: "totalAmount", label: "Total Amount", align: "right", kind: "money" },
          ];
          rows = moves.map((m: any) => ({
            movementDate: m.movement_date,
            movementType: m.movement_type || "—",
            goodsName: m.goods_name || "—",
            warehouseName: m.warehouse_name || "—",
            countryName: m.country_name || "—",
            referenceNo: m.reference_no || "—",
            quantity: n(m.quantity),
            unitCost: round2(n(m.unit_cost)),
            totalAmount: round2(n(m.total_amount)),
          }));
          totals = {
            movements: moves.length,
            quantity: round2(moves.reduce((s: number, m: any) => s + n(m.quantity), 0)),
            totalAmount: round2(moves.reduce((s: number, m: any) => s + n(m.total_amount), 0)),
          };
          break;
        }
      }

      return {
        report,
        functionalCurrency: fcOf,
        scope: { level: scope.level, countryId: effectiveCountryId, branchId: null, label: scope.scopeLabel },
        filters: { from, to, warehouseId: warehouseF },
        columns,
        rows,
        totals,
        rowCount: rows.length,
        generatedAt: new Date().toISOString(),
      };
    });

    if (!payload) throw new ApiClientError("Inventory reports need a direct database connection.", { status: 503 });
    return apiOk(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
