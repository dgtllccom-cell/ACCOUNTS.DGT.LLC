import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

const MODULES = ["purchase_booking", "local_purchase", "sales_booking", "local_sales"] as const;

/**
 * GET /api/erp/bill-expenses
 *   ?module=purchase_booking|local_purchase|sales_booking|local_sales
 *   ?countryId= &branchId= &status=open|in_progress|closed|all
 *   ?eligibility=active|withdrawn|all   (default active)
 *   ?q= &limit=
 *
 * Every eligible submitted source bill auto-appears here (via the
 * bill_expenses_sync_from_source DB trigger). This endpoint only READS the
 * register; it never creates a source transaction. Country/branch scope is
 * enforced server-side — a user cannot widen it with query params.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const scope = resolveReportScope(session);
    const sp = request.nextUrl.searchParams;

    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      scope,
      sp.get("countryId") && sp.get("countryId") !== "all" ? sp.get("countryId") : null,
      sp.get("branchId") && sp.get("branchId") !== "all" ? sp.get("branchId") : null
    );

    const moduleFilter = MODULES.includes((sp.get("module") ?? "") as any) ? sp.get("module") : null;
    const statusFilter = sp.get("status") && sp.get("status") !== "all" ? sp.get("status") : null;
    const eligibility = sp.get("eligibility") || "active";
    const q = (sp.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(sp.get("limit") || 500), 1), 2000);

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select
          be.id, be.source_module, be.source_id, be.source_table,
          be.bill_no, be.manual_bill_no, be.bill_date, be.transaction_date,
          be.country_id, be.country_branch_id, be.city_branch_id,
          be.party_account_no, be.party_name, be.party_company_id,
          be.currency, be.original_bill_amount, be.expense_total, be.expense_count,
          be.eligibility, be.source_status, be.status, be.created_at, be.updated_at,
          c.name  as country_name, c.iso2 as country_code,
          cb.name as country_branch_name, cb.code as country_branch_code,
          cib.city_name as city_branch_name, cib.code as city_branch_code
        from public.bill_expenses be
        left join public.countries        c   on c.id   = be.country_id
        left join public.country_branches cb  on cb.id  = be.country_branch_id
        left join public.city_branches    cib on cib.id = be.city_branch_id
        where be.deleted_at is null
          ${eligibility === "all" ? sql`` : sql`and be.eligibility = ${eligibility}`}
          ${moduleFilter ? sql`and be.source_module = ${moduleFilter}` : sql``}
          ${statusFilter ? sql`and be.status = ${statusFilter}` : sql``}
          ${effectiveCountryId ? sql`and be.country_id = ${effectiveCountryId}` : sql``}
          ${effectiveBranchId ? sql`and be.city_branch_id = ${effectiveBranchId}` : sql``}
          ${
            q
              ? sql`and (be.bill_no ilike ${`%${q}%`} or be.manual_bill_no ilike ${`%${q}%`}
                        or be.party_name ilike ${`%${q}%`} or be.party_account_no ilike ${`%${q}%`})`
              : sql``
          }
        order by be.transaction_date desc nulls last, be.created_at desc
        limit ${limit}
      `;
    });

    const list = (rows ?? []).map((r: any) => ({
      id: r.id,
      sourceModule: r.source_module,
      sourceId: r.source_id,
      sourceTable: r.source_table,
      billNo: r.bill_no,
      manualBillNo: r.manual_bill_no,
      billDate: r.bill_date,
      transactionDate: r.transaction_date,
      countryId: r.country_id,
      countryName: r.country_name,
      countryCode: r.country_code,
      countryBranchId: r.country_branch_id,
      countryBranchName: r.country_branch_name,
      cityBranchId: r.city_branch_id,
      cityBranchName: r.city_branch_name,
      branchLabel:
        r.city_branch_name || r.country_branch_name || r.country_name || "—",
      partyAccountNo: r.party_account_no,
      partyName: r.party_name,
      currency: r.currency,
      originalBillAmount: Number(r.original_bill_amount || 0),
      expenseTotal: Number(r.expense_total || 0),
      expenseCount: Number(r.expense_count || 0),
      eligibility: r.eligibility,
      sourceStatus: r.source_status,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const summary = {
      totalBills: list.length,
      byModule: MODULES.reduce<Record<string, number>>((acc, m) => {
        acc[m] = list.filter((x) => x.sourceModule === m).length;
        return acc;
      }, {}),
      originalTotal: list.reduce((s, x) => s + x.originalBillAmount, 0),
      expenseTotal: list.reduce((s, x) => s + x.expenseTotal, 0),
      withExpenses: list.filter((x) => x.expenseCount > 0).length
    };

    return apiOk({
      scope: { level: scope.level, countryId: effectiveCountryId, branchId: effectiveBranchId, label: scope.scopeLabel },
      summary,
      rows: list,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
