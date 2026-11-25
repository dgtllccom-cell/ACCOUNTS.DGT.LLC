export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Flat, cross-order list of sales order payments / receipts — READ-ONLY. It is the sales twin of GET /api/erp/purchases/payments and exists so the
 * Sales Payments pages can show a payment-type breakdown (advance / credit / remaining / all) from the real payment records without fetching
 * per order. Same scope rules as /api/erp/sales/orders: super admin sees all, everyone else only their country / main-branch / city-branch rows.
 * No posting or mutation lives here — payment creation stays on the existing per-order routes.
 */
const listQuerySchema = z.object({
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      countryId: searchParams.get("countryId") || undefined,
      countryBranchId: searchParams.get("countryBranchId") || undefined,
      cityBranchId: searchParams.get("cityBranchId") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    authorizeApiScope(session, {
      resource: "sales",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null,
    });

    const scopedCountryIds = !session.isSuperAdmin && session.countryIds.length > 0 ? session.countryIds : null;
    const scopedCountryBranchIds = !session.isSuperAdmin && session.countryBranchIds.length > 0 ? session.countryBranchIds : null;
    const scopedCityBranchIds = !session.isSuperAdmin && session.cityBranchIds.length > 0 ? session.cityBranchIds : null;
    // a non-super-admin session with no scope at all must see nothing, never everything
    const noScope = !session.isSuperAdmin && !scopedCountryIds && !scopedCountryBranchIds && !scopedCityBranchIds;

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select
          p.id, p.sales_order_id, p.payment_kind, p.payment_date, p.amount, p.currency_code, p.exchange_rate, p.status,
          p.manual_reference_number, p.created_at,
          so.sales_order_no, so.customer_name, so.country_id, so.country_branch_id, so.city_branch_id,
          so.order_total, so.currency_code as order_currency_code
        from public.sales_order_payments p
        join public.sales_orders so on so.id = p.sales_order_id and so.deleted_at is null
        where p.deleted_at is null
          and p.payment_kind <> 'booking'
          and ${noScope ? sql`false` : sql`true`}
          and (${scopedCityBranchIds ? sql`so.city_branch_id = any(${scopedCityBranchIds}::uuid[])` : sql`true`})
          and (${!scopedCityBranchIds && scopedCountryBranchIds ? sql`so.country_branch_id = any(${scopedCountryBranchIds}::uuid[])` : sql`true`})
          and (${!scopedCityBranchIds && !scopedCountryBranchIds && scopedCountryIds ? sql`so.country_id = any(${scopedCountryIds}::uuid[])` : sql`true`})
          and (${query.cityBranchId ? sql`so.city_branch_id = ${query.cityBranchId}::uuid` : sql`true`})
          and (${!query.cityBranchId && query.countryBranchId ? sql`so.country_branch_id = ${query.countryBranchId}::uuid` : sql`true`})
          and (${!query.cityBranchId && !query.countryBranchId && query.countryId ? sql`so.country_id = ${query.countryId}::uuid` : sql`true`})
        order by p.created_at desc
        limit ${query.limit}
      `;
    });

    return apiOk({ payments: rows ?? [], limit: query.limit });
  } catch (error) {
    return handleApiError(error);
  }
}
