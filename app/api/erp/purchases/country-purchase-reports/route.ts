export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

const querySchema = z.object({
  countryId: z.string().uuid().optional(),
  countryBranchId: z.string().uuid().optional(),
  destCountryId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
  lang: z.string().trim().max(5).optional()
});

/**
 * Country Purchase Report — one row per Country-to-Country purchase order (dest_country_id
 * is set), with its loading/transit/receiving quantities rolled up from the SAME
 * purchase_loading_records rows the Transportation/Loading and Receiving pages use (no
 * parallel report-only data model).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);
    const query = querySchema.parse({
      countryId: url.searchParams.get("countryId") || undefined,
      countryBranchId: url.searchParams.get("countryBranchId") || undefined,
      destCountryId: url.searchParams.get("destCountryId") || undefined,
      fromDate: url.searchParams.get("fromDate") || undefined,
      toDate: url.searchParams.get("toDate") || undefined,
      q: url.searchParams.get("q") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      lang: url.searchParams.get("lang") || undefined
    });
    const lang = normalizeLanguage(query.lang, "en");

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: null
    });

    const term = query.q ? query.q.trim().replace(/[%_]/g, "") : null;
    const like = term ? `%${term}%` : null;

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select
          po.id as purchase_order_id,
          po.purchase_order_no,
          po.purchase_contract_no,
          po.currency_code,
          po.order_total,
          po.advance_paid,
          po.remaining_paid,
          po.credit_amount,
          po.remaining_due,
          po.payment_status,
          po.created_at,
          c.name as source_country_name,
          cb.name as source_branch_name,
          dc.name as dest_country_name,
          dcb.name as dest_branch_name,
          po.form_data->'form'->>'goodsName' as goods_name,
          po.form_data->'form'->>'supplierName' as supplier_name,
          po.supplier_company_id,
          (select poi.product_id from purchase_order_items poi where poi.purchase_order_id = po.id and poi.product_id is not null limit 1) as goods_id,
          coalesce((select sum(plr.loaded_quantity) from purchase_loading_records plr where plr.purchase_order_id = po.id and plr.deleted_at is null), 0) as loaded_qty,
          coalesce((select sum(plr.received_quantity) from purchase_loading_records plr where plr.purchase_order_id = po.id and plr.deleted_at is null), 0) as received_qty,
          coalesce((select sum(case when plr.loading_status in ('dispatched','in_transit') then plr.loaded_quantity - coalesce(plr.received_quantity,0) else 0 end) from purchase_loading_records plr where plr.purchase_order_id = po.id and plr.deleted_at is null), 0) as in_transit_qty,
          (select string_agg(distinct plr.transport_mode, ', ') from purchase_loading_records plr where plr.purchase_order_id = po.id and plr.deleted_at is null and plr.transport_mode is not null) as transport_modes,
          (select plr2.loading_status from purchase_loading_records plr2 where plr2.purchase_order_id = po.id and plr2.deleted_at is null order by plr2.updated_at desc limit 1) as latest_loading_status,
          coalesce((po.form_data->'form'->>'qtyNo')::numeric, 0) as purchased_qty
        from purchase_orders po
        left join countries c on c.id = po.country_id
        left join country_branches cb on cb.id = po.country_branch_id
        left join countries dc on dc.id = po.dest_country_id
        left join country_branches dcb on dcb.id = po.dest_country_branch_id
        where po.deleted_at is null
          and po.dest_country_id is not null
          ${query.countryId ? sql`and po.country_id = ${query.countryId}::uuid` : sql``}
          ${query.countryBranchId ? sql`and po.country_branch_id = ${query.countryBranchId}::uuid` : sql``}
          ${query.destCountryId ? sql`and po.dest_country_id = ${query.destCountryId}::uuid` : sql``}
          ${query.fromDate ? sql`and po.created_at >= ${query.fromDate}::date` : sql``}
          ${query.toDate ? sql`and po.created_at < (${query.toDate}::date + interval '1 day')` : sql``}
          ${like ? sql`and (po.purchase_order_no ilike ${like} or po.purchase_contract_no ilike ${like} or po.form_data->'form'->>'goodsName' ilike ${like} or po.form_data->'form'->>'supplierName' ilike ${like})` : sql``}
        order by po.created_at desc
        limit ${query.limit}
      `;
    });

    // Localize the master goods/company names the SAME way the goods and companies masters
    // themselves are localized (record_translations keyed by goods.id / companies.id) —
    // not a parallel translation of the denormalized text snapshot in form_data.
    const rawRows = (rows ?? []) as any[];
    const goodsForLookup = rawRows
      .filter((r) => r.goods_id)
      .map((r) => ({ id: r.goods_id as string, goods_name: r.goods_name }));
    const localizedGoods = await localizeRecordNames(goodsForLookup, "goods", "goods_name", lang);
    const goodsNameById = new Map(localizedGoods.map((g) => [g.id, g.goods_name]));

    const companiesForLookup = rawRows
      .filter((r) => r.supplier_company_id)
      .map((r) => ({ id: r.supplier_company_id as string, name: r.supplier_name }));
    const localizedCompanies = await localizeRecordNames(companiesForLookup, "companies", "name", lang);
    const companyNameById = new Map(localizedCompanies.map((c) => [c.id, c.name]));

    const localized = rawRows.map((r) => ({
      ...r,
      goods_name: (r.goods_id && goodsNameById.get(r.goods_id)) || r.goods_name,
      supplier_name: (r.supplier_company_id && companyNameById.get(r.supplier_company_id)) || r.supplier_name
    }));

    const totals = (rows ?? []).reduce(
      (acc: any, r: any) => {
        acc.orderTotal += Number(r.order_total || 0);
        acc.advancePaid += Number(r.advance_paid || 0);
        acc.remainingPaid += Number(r.remaining_paid || 0);
        acc.creditAmount += Number(r.credit_amount || 0);
        acc.remainingDue += Number(r.remaining_due || 0);
        acc.purchasedQty += Number(r.purchased_qty || 0);
        acc.loadedQty += Number(r.loaded_qty || 0);
        acc.receivedQty += Number(r.received_qty || 0);
        return acc;
      },
      { orderTotal: 0, advancePaid: 0, remainingPaid: 0, creditAmount: 0, remainingDue: 0, purchasedQty: 0, loadedQty: 0, receivedQty: 0 }
    );

    return apiOk({ rows: localized, totals, count: (rows ?? []).length });
  } catch (error) {
    return handleApiError(error);
  }
}
