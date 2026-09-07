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

      // one CTE-based unified view of both payment sources with full contextual linkage
      const rows = await sql`
        with unified as (
          select
            pop.id::text                            as id,
            'supplier_payment'                      as flow,
            'purchase'                              as module,
            coalesce(pop.reference_no, po.purchase_order_no, pop.id::text) as ref_no,
            po.purchase_order_no                    as order_no,
            po.purchase_contract_no                 as contract_no,
            coalesce(po.form_data->'form'->>'manualBillNumber', po.form_data->'form'->>'manual_bill_number', po.form_data->'form'->>'billNo', '') as manual_bill_no,
            pop.entry_date                          as txn_date,
            po.country_id                           as country_id,
            po.country_branch_id                    as country_branch_id,
            po.city_branch_id                       as city_branch_id,
            coalesce(sup.name, '—')                 as party,
            pop.kind::text                          as payment_kind,
            pop.currency_code                       as currency,
            pop.amount::numeric                     as amount,
            coalesce(pop.exchange_rate::numeric, 1) as exchange_rate,
            coalesce(pop.base_currency_amount::numeric, pop.amount::numeric) as base_amount,
            pop.status::text                        as status,
            pop.narration                           as narration,
            dl.name                                 as debit_ledger_name,
            cl.name                                 as credit_ledger_name,
            coalesce(pop.super_admin_serial, re.super_admin_serial_number) as super_admin_serial,
            coalesce(pop.country_serial, re.country_transaction_serial_number) as country_serial,
            coalesce(pop.branch_serial, re.branch_transaction_serial_number) as branch_serial,
            pr.full_name                            as created_by,
            pop.created_at                          as created_at
          from public.purchase_order_payments pop
          left join public.purchase_orders po on po.id = pop.purchase_order_id
          left join public.companies sup on sup.id = po.supplier_company_id
          left join public.ledgers dl on dl.id = pop.debit_ledger_id
          left join public.ledgers cl on cl.id = pop.credit_ledger_id
          left join public.roznamcha_entries re on re.id = pop.roznamcha_entry_id
          left join public.profiles pr on pr.id = pop.created_by
          where pop.deleted_at is null
          union all
          select
            sop.id::text                            as id,
            'customer_receipt'                      as flow,
            'sales'                                 as module,
            coalesce(sop.manual_reference_number, so.sales_order_no, sop.id::text) as ref_no,
            so.sales_order_no                       as order_no,
            so.manual_reference_number              as contract_no,
            coalesce(so.form_data->'form'->>'manualBillNumber', so.form_data->'form'->>'billNo', '') as manual_bill_no,
            sop.payment_date                        as txn_date,
            so.country_id                           as country_id,
            so.country_branch_id                    as country_branch_id,
            so.city_branch_id                       as city_branch_id,
            coalesce(so.customer_name, '—')         as party,
            sop.payment_kind::text                  as payment_kind,
            sop.currency_code                       as currency,
            sop.amount::numeric                     as amount,
            coalesce(sop.exchange_rate::numeric, 1) as exchange_rate,
            (sop.amount::numeric * coalesce(sop.exchange_rate::numeric, 1)) as base_amount,
            sop.status::text                        as status,
            sop.remarks                             as narration,
            'Customer Receivables'                  as debit_ledger_name,
            'Sales / Cash Account'                  as credit_ledger_name,
            sop.super_admin_serial                  as super_admin_serial,
            sop.country_serial                      as country_serial,
            sop.branch_serial                       as branch_serial,
            pr.full_name                            as created_by,
            sop.created_at                          as created_at
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
          ${q ? sql`and (u.ref_no ilike ${"%" + q + "%"} or u.order_no ilike ${"%" + q + "%"} or u.party ilike ${"%" + q + "%"})` : sql``}
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
          orderNo: r.order_no || "—",
          contractNo: r.contract_no || null,
          manualBillNo: r.manual_bill_no || null,
          date: r.txn_date,
          flow: r.flow as "supplier_payment" | "customer_receipt",
          module: (r.module || (r.flow === "supplier_payment" ? "purchase" : "sales")) as "purchase" | "sales",
          country: r.country_name || "—",
          branch: r.city_branch_name || r.country_branch_name || "—",
          party: r.party || "—",
          paymentKind: r.payment_kind || "payment",
          currency: r.currency || "—",
          amount: num(r.amount),
          exchangeRate: num(r.exchange_rate) || 1,
          baseAmount: num(r.base_amount),
          debitLedgerName: r.debit_ledger_name || "—",
          creditLedgerName: r.credit_ledger_name || "—",
          narration: r.narration || "",
          superAdminSerial: r.super_admin_serial || null,
          countrySerial: r.country_serial || null,
          branchSerial: r.branch_serial || null,
          status: r.status || "—",
          createdBy: r.created_by || "—",
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
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
