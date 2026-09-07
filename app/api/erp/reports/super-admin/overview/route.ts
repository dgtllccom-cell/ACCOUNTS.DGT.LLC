/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/erp/reports/super-admin/overview
 *
 * Real global performance snapshot for the Super Admin Reports screen —
 * per-country branch / user / financial rollup + the aggregates the four
 * report cards need. Every number is queried from live tables; nothing is
 * fabricated. Super admin (or super_admin_reports) only.
 *
 * Query: countryId (optional filter), fromDate, toDate
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const scope = resolveReportScope(session);
    if (scope.level !== "global") {
      return apiOk({ error: "Super admin only", rows: [], summary: {}, txns: {}, coverage: {} });
    }
    const p = request.nextUrl.searchParams;
    const countryId = p.get("countryId")?.trim() || null;
    const fromDate = p.get("fromDate")?.trim() || null;
    const toDate = p.get("toDate")?.trim() || null;

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        select
          c.id::text as id, c.name, coalesce(c.iso2, '') as iso2, coalesce(c.currency_code, 'USD') as currency_code,
          coalesce(c.is_active, true) as is_active,
          (select count(*) from public.country_branches cb where cb.country_id = c.id and cb.deleted_at is null) as main_branches,
          (select count(*) from public.city_branches ccb where ccb.country_id = c.id and ccb.deleted_at is null) as city_branches,
          (select count(distinct ura.user_id) from public.user_role_assignments ura where ura.country_id = c.id and ura.is_active) as users,
          (select coalesce(round(sum(rl.usd_amount) filter (where rl.credit > 0), 2), 0)
             from public.roznamcha_lines rl join public.roznamcha_entries re on re.id = rl.roznamcha_entry_id
             where re.country_id = c.id and re.deleted_at is null and re.status = 'posted'
               ${fromDate ? sql`and re.entry_date >= ${fromDate}::date` : sql``}
               ${toDate ? sql`and re.entry_date <= ${toDate}::date` : sql``}) as credit_usd,
          (select coalesce(round(sum(rl.usd_amount) filter (where rl.debit > 0), 2), 0)
             from public.roznamcha_lines rl join public.roznamcha_entries re on re.id = rl.roznamcha_entry_id
             where re.country_id = c.id and re.deleted_at is null and re.status = 'posted'
               ${fromDate ? sql`and re.entry_date >= ${fromDate}::date` : sql``}
               ${toDate ? sql`and re.entry_date <= ${toDate}::date` : sql``}) as debit_usd
        from public.countries c
        where c.deleted_at is null
          ${countryId ? sql`and c.id = ${countryId}::uuid` : sql``}
        order by c.name
      `;

      const list = (rows as any[]).map((r) => {
        const credit = Number(r.credit_usd) || 0;
        const debit = Number(r.debit_usd) || 0;
        return {
          id: r.id, name: r.name, iso2: r.iso2, currencyCode: r.currency_code,
          isActive: r.is_active !== false,
          mainBranches: Number(r.main_branches) || 0,
          cityBranches: Number(r.city_branches) || 0,
          totalBranches: (Number(r.main_branches) || 0) + (Number(r.city_branches) || 0),
          users: Number(r.users) || 0,
          totalCredit: credit, totalDebit: debit, netBalance: credit - debit,
        };
      });

      const sum = (f: (x: (typeof list)[number]) => number) => list.reduce((a, x) => a + f(x), 0);
      const summary = {
        totalCountries: list.length,
        activeCountries: list.filter((x) => x.isActive).length,
        totalBranches: sum((x) => x.totalBranches),
        totalUsers: sum((x) => x.users),
        totalCredit: sum((x) => x.totalCredit),
        totalDebit: sum((x) => x.totalDebit),
        netBalance: sum((x) => x.totalCredit) - sum((x) => x.totalDebit),
      };

      const [txnRow] = await sql`
        select
          (select count(*) from public.purchase_orders where deleted_at is null) as purchase_orders,
          (select count(*) from public.sales_orders where deleted_at is null) as sales_orders,
          (select count(*) from public.roznamcha_entries where deleted_at is null and status = 'posted') as roznamcha_posted,
          (select count(*) from public.roznamcha_entries where deleted_at is null and status = 'cancelled') as roznamcha_cancelled,
          (select count(*) from public.bill_expenses where deleted_at is null) as bill_register,
          (select count(*) from public.purchase_order_payments where deleted_at is null) as po_payments,
          (select count(*) from public.sales_order_payments where deleted_at is null) as so_payments
      `;
      const txns = {
        purchaseOrders: Number(txnRow.purchase_orders) || 0,
        salesOrders: Number(txnRow.sales_orders) || 0,
        roznamchaPosted: Number(txnRow.roznamcha_posted) || 0,
        roznamchaCancelled: Number(txnRow.roznamcha_cancelled) || 0,
        billRegister: Number(txnRow.bill_register) || 0,
        paymentEntries: (Number(txnRow.po_payments) || 0) + (Number(txnRow.so_payments) || 0),
      };

      const coverage = {
        countries: list.length,
        mainBranches: list.reduce((a, x) => a + x.mainBranches, 0),
        cityBranches: list.reduce((a, x) => a + x.cityBranches, 0),
        currencies: new Set(list.map((x) => x.currencyCode)).size,
        activeCountries: list.filter((x) => x.isActive).length,
      };

      return { rows: list, summary, txns, coverage };
    });

    return apiOk({
      ...(data ?? { rows: [], summary: {}, txns: {}, coverage: {} }),
      generatedAt: new Date().toISOString(),
      generatedBy: { id: session.userId, name: session.fullName || session.email || session.userId },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
