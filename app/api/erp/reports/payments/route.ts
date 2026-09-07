/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/erp/reports/payments
 *
 * Unified payments report — one row per real payment transaction from
 * purchase_order_payments (Supplier Payment) + sales_order_payments
 * (Customer Receipt), scoped to the caller's country/branch. Returns the
 * detailed rows + the exact aggregates the four report cards need.
 *
 * Query: fromDate, toDate, countryId, countryBranchId, cityBranchId,
 *        status (posted|cancelled|pending|partial), q, page, pageSize
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const rscope = resolveReportScope(session);
    const p = request.nextUrl.searchParams;
    const scope = getScopeFromSearchParams(request);

    const fromDate = p.get("fromDate")?.trim() || null;
    const toDate = p.get("toDate")?.trim() || null;
    const status = p.get("status")?.trim() || null;
    const q = p.get("q")?.trim() || null;
    const page = Math.max(1, Number(p.get("page")) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(p.get("pageSize")) || 25));

    const result = await withLocalPg(async (sql) => {
      // ── scope: super admin sees all; others clamped to their assignments ──
      const countryIds: string[] = [];
      const countryBranchIds: string[] = [];
      const cityBranchIds: string[] = [];
      if (!session.isSuperAdmin) {
        for (const a of session.assignments) {
          if (a.countryId) countryIds.push(a.countryId);
          if (a.countryBranchId) countryBranchIds.push(a.countryBranchId);
          if (a.cityBranchId) cityBranchIds.push(a.cityBranchId);
        }
      }
      const filterCountry = scope.countryId || null;
      const filterCountryBranch = scope.countryBranchId || null;
      const filterCityBranch = scope.cityBranchId || null;

      // one CTE-based unified view of both payment sources
      const rows = await sql`
        with unified as (
          select
            pop.id::text                            as id,
            'supplier_payment'                      as flow,
            coalesce(po.purchase_order_no, pop.reference_no, pop.id::text) as ref_no,
            pop.entry_date                          as txn_date,
            po.country_id                           as country_id,
            po.country_branch_id                    as country_branch_id,
            po.city_branch_id                       as city_branch_id,
            coalesce(sup.name, '—')                 as party,
            pop.kind::text                          as payment_kind,
            pop.currency_code                       as currency,
            pop.amount::numeric                     as amount,
            pop.status::text                        as status,
            pr.full_name                            as created_by
          from public.purchase_order_payments pop
          left join public.purchase_orders po on po.id = pop.purchase_order_id
          left join public.companies sup on sup.id = po.supplier_company_id
          left join public.profiles pr on pr.id = pop.created_by
          where pop.deleted_at is null
          union all
          select
            sop.id::text                            as id,
            'customer_receipt'                      as flow,
            coalesce(so.sales_order_no, sop.manual_reference_number, sop.id::text) as ref_no,
            sop.payment_date                        as txn_date,
            so.country_id                           as country_id,
            so.country_branch_id                    as country_branch_id,
            so.city_branch_id                       as city_branch_id,
            coalesce(so.customer_name, '—')         as party,
            sop.payment_kind::text                  as payment_kind,
            sop.currency_code                       as currency,
            sop.amount::numeric                     as amount,
            sop.status::text                        as status,
            pr.full_name                            as created_by
          from public.sales_order_payments sop
          left join public.sales_orders so on so.id = sop.sales_order_id
          left join public.profiles pr on pr.id = sop.created_by
          where sop.deleted_at is null
        )
        select u.*,
          c.name as country_name, c.currency_code as country_currency,
          cb.name as country_branch_name, cb.code as country_branch_code,
          ccb.name as city_branch_name, ccb.code as city_branch_code
        from unified u
        left join public.countries c on c.id = u.country_id
        left join public.country_branches cb on cb.id = u.country_branch_id
        left join public.city_branches ccb on ccb.id = u.city_branch_id
        where 1=1
          ${session.isSuperAdmin ? sql`` : sql`and (
            u.country_id = any(${countryIds}::uuid[])
            or u.country_branch_id = any(${countryBranchIds}::uuid[])
            or u.city_branch_id = any(${cityBranchIds}::uuid[])
          )`}
          ${filterCountry ? sql`and u.country_id = ${filterCountry}::uuid` : sql``}
          ${filterCountryBranch ? sql`and u.country_branch_id = ${filterCountryBranch}::uuid` : sql``}
          ${filterCityBranch ? sql`and u.city_branch_id = ${filterCityBranch}::uuid` : sql``}
          ${fromDate ? sql`and u.txn_date >= ${fromDate}::date` : sql``}
          ${toDate ? sql`and u.txn_date <= ${toDate}::date` : sql``}
          ${status ? sql`and u.status = ${status}` : sql``}
          ${q ? sql`and (u.ref_no ilike ${"%" + q + "%"} or u.party ilike ${"%" + q + "%"})` : sql``}
        order by u.txn_date desc nulls last, u.ref_no desc
      `;

      const all = rows as any[];
      const total = all.length;
      const pageRows = all.slice((page - 1) * pageSize, page * pageSize);

      // ── aggregates for the four cards (from the FULL scoped set, not the page) ──
      const num = (v: unknown) => Number(v ?? 0) || 0;
      const byStatus = (st: string) => all.filter((r) => r.status === st);
      const sumAmt = (arr: any[]) => arr.reduce((s, r) => s + num(r.amount), 0);

      const supplierRows = all.filter((r) => r.flow === "supplier_payment");
      const receiptRows = all.filter((r) => r.flow === "customer_receipt");

      const summary = {
        totalRecords: total,
        totalDebit: sumAmt(supplierRows),        // money paid out
        totalCredit: sumAmt(receiptRows),        // money received in
        paidAmount: sumAmt(byStatus("posted").filter((r) => r.flow === "supplier_payment")),
        receivedAmount: sumAmt(byStatus("posted").filter((r) => r.flow === "customer_receipt")),
        pendingAmount: sumAmt(all.filter((r) => ["pending", "partial", "draft"].includes(r.status))),
        cancelledAmount: sumAmt(byStatus("cancelled")),
        remainingBalance: sumAmt(supplierRows) - sumAmt(byStatus("posted").filter((r) => r.flow === "supplier_payment")),
      };

      const entriesSummary = {
        totalEntries: total,
        posted: byStatus("posted").length,
        cancelled: byStatus("cancelled").length,
        pending: all.filter((r) => r.status === "pending").length,
        partial: all.filter((r) => r.status === "partial").length,
        draft: all.filter((r) => r.status === "draft").length,
        supplierPayments: supplierRows.length,
        customerReceipts: receiptRows.length,
      };

      const geo = {
        countries: new Set(all.map((r) => r.country_id).filter(Boolean)).size,
        countryBranches: new Set(all.map((r) => r.country_branch_id).filter(Boolean)).size,
        cityBranches: new Set(all.map((r) => r.city_branch_id).filter(Boolean)).size,
        users: new Set(all.map((r) => r.created_by).filter(Boolean)).size,
        parties: new Set(all.map((r) => r.party).filter((x) => x && x !== "—")).size,
        scopedPaymentTotal: sumAmt(all),
      };

      return {
        rows: pageRows.map((r) => ({
          id: r.id,
          refNo: r.ref_no,
          date: r.txn_date,
          flow: r.flow,
          country: r.country_name || "—",
          branch: r.city_branch_name || r.country_branch_name || "—",
          party: r.party || "—",
          paymentKind: r.payment_kind || "—",
          currency: r.currency || "—",
          amount: num(r.amount),
          status: r.status || "—",
          createdBy: r.created_by || "—",
        })),
        total,
        page,
        pageSize,
        summary,
        entriesSummary,
        geo,
      };
    });

    return apiOk({
      ...result,
      scope: { level: rscope.level, label: rscope.scopeLabel ?? null },
      generatedAt: new Date().toISOString(),
      generatedBy: { id: session.userId, name: session.fullName || session.email || session.userId },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
