export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

/**
 * Flat, cross-order list of purchase order payments — read-only. Reuses the exact
 * same join shape as the existing per-order GET /api/erp/purchases/orders/[id]/payments
 * (purchase_order_payments -> roznamcha_entries -> profiles), extended with the
 * parent purchase_orders row (PO No./Vendor) and payment_methods/ledgers names so a
 * single request can back a payment-per-row table instead of fetching per order.
 * No posting/mutation logic — POST/payment creation stays on the existing per-order route.
 */
const listQuerySchema = z.object({
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      countryId: searchParams.get("countryId") || undefined,
      countryBranchId: searchParams.get("countryBranchId") || undefined,
      cityBranchId: searchParams.get("cityBranchId") || undefined,
      status: searchParams.get("status") || undefined,
      q: searchParams.get("q") || searchParams.get("search") || undefined,
      limit: searchParams.get("limit") || undefined
    });
    const lang = await getRequestLanguage(searchParams.get("lang"));

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const term = query.q ? String(query.q).trim().replace(/[%_]/g, "") : null;
    const like = term ? `%${term}%` : null;

    const scopedCountryIds = !session.isSuperAdmin && session.countryIds.length > 0 ? session.countryIds : null;
    const scopedCountryBranchIds = !session.isSuperAdmin && session.countryBranchIds.length > 0 ? session.countryBranchIds : null;
    const scopedCityBranchIds = !session.isSuperAdmin && session.cityBranchIds.length > 0 ? session.cityBranchIds : null;

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select
          p.id, p.purchase_order_id, p.local_purchase_id, p.kind, p.entry_date, p.amount, p.currency_code, p.exchange_rate,
          p.debit_ledger_id, p.credit_ledger_id, p.roznamcha_entry_id, p.status, p.reference_no,
          p.narration, p.super_admin_serial, p.country_serial, p.branch_serial, p.entry_serial,
          p.created_at,
          coalesce(po.purchase_order_no, lp.manual_bill_no, lp.contract_no, lp.journal_serial_no, lp.super_admin_serial, 'LP-' || substring(lp.id::text, 1, 8)) as purchase_order_no,
          coalesce(po.country_id, lp.country_id) as country_id,
          coalesce(po.country_branch_id, lp.country_branch_id) as country_branch_id,
          coalesce(po.city_branch_id, lp.city_branch_id) as city_branch_id,
          coalesce(po.order_total, lp.final_cost, 0) as order_total,
          coalesce(po.advance_paid, lp.advance_amount, 0) as advance_paid,
          coalesce(po.remaining_due, lp.remaining_balance, 0) as remaining_due,
          coalesce(po.currency_code, lp.purchase_currency, 'USD') as po_currency_code,
          coalesce(po.form_data->'form'->>'supplierName', lp.supplier_name, 'Supplier') as vendor_name,
          case when p.local_purchase_id is not null then 'local_purchase' else 'purchase_booking' end as source_type,
          dl.name as debit_ledger_name, cl.name as credit_ledger_name,
          re.super_admin_serial_number as journal_no, re.posted_at as journal_posted_at,
          pm.name as payment_method_name,
          pr.full_name as created_by_name
        from public.purchase_order_payments p
        left join public.purchase_orders po on po.id = p.purchase_order_id and po.deleted_at is null
        left join public.local_purchases lp on lp.id = p.local_purchase_id and lp.deleted_at is null
        left join public.ledgers dl on dl.id = p.debit_ledger_id
        left join public.ledgers cl on cl.id = p.credit_ledger_id
        left join public.roznamcha_entries re on re.id = p.roznamcha_entry_id
        left join public.payment_methods pm on pm.id = re.payment_method_id
        left join public.profiles pr on pr.id = re.created_by
        where p.deleted_at is null
          and (po.id is not null or lp.id is not null)
          -- Exclude the system-generated initial booking-transfer entry (kind='booking') —
          -- matches the existing filter already applied to payment history elsewhere
          -- (handleOpenA4PDF's paymentHistory.filter on "initial booking transfer"
          -- narration in purchase-order-payment-journal.tsx): it is not a user payment.
          and p.kind != 'booking'
          and (${scopedCityBranchIds ? sql`coalesce(po.city_branch_id, lp.city_branch_id) = any(${scopedCityBranchIds}::uuid[])` : sql`true`})
          and (${!scopedCityBranchIds && scopedCountryBranchIds ? sql`coalesce(po.country_branch_id, lp.country_branch_id) = any(${scopedCountryBranchIds}::uuid[])` : sql`true`})
          and (${!scopedCityBranchIds && !scopedCountryBranchIds && scopedCountryIds ? sql`coalesce(po.country_id, lp.country_id) = any(${scopedCountryIds}::uuid[])` : sql`true`})
          and (${query.cityBranchId ? sql`coalesce(po.city_branch_id, lp.city_branch_id) = ${query.cityBranchId}::uuid` : sql`true`})
          and (${!query.cityBranchId && query.countryBranchId ? sql`coalesce(po.country_branch_id, lp.country_branch_id) = ${query.countryBranchId}::uuid` : sql`true`})
          and (${!query.cityBranchId && !query.countryBranchId && query.countryId ? sql`coalesce(po.country_id, lp.country_id) = ${query.countryId}::uuid` : sql`true`})
          and (${query.status ? sql`p.status = ${query.status}` : sql`true`})
          and (${like ? sql`(
            coalesce(po.purchase_order_no, lp.contract_no, lp.super_admin_serial, '') ILIKE ${like} OR p.reference_no ILIKE ${like} OR
            p.super_admin_serial ILIKE ${like} OR coalesce(po.form_data->'form'->>'supplierName', lp.supplier_name, '') ILIKE ${like}
          )` : sql`true`})
        order by p.created_at desc
        limit ${query.limit}
      `;
    });

    const localizedPayments = await localizeRecordNames(
      (rows ?? []) as unknown as Array<{ id: string; narration?: string | null }>,
      "purchase_order_payments",
      "narration",
      lang
    );

    return apiOk({ payments: localizedPayments, limit: query.limit });
  } catch (error) {
    return handleApiError(error);
  }
}
