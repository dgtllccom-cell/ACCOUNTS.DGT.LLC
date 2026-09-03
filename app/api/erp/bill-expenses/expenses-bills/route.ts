import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/bill-expenses/expenses-bills
 *
 * Read-only projection of the Daily-Payment `expenses_bills` for the consolidated
 * "Expenses" area of the BILL COST, EXPENSES & PROFIT menu. This does NOT create,
 * post, or duplicate anything — it surfaces the existing Daily-Payment register
 * next to the cross-module `bill_expenses` register so a user has one operational
 * view. Country/branch scope is enforced server-side.
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
    const q = (sp.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(sp.get("limit") || 500), 1), 2000);

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select
          b.id, b.serial_no, b.bill_date, b.bill_mode, b.bill_title, b.reference_no,
          b.transferred_to_roznamcha, b.roznamcha_entry_id, b.created_at,
          cb.id as city_branch_id, cb.name as city_branch_name, cb.country_id,
          c.name as country_name, c.currency_code as country_currency,
          coalesce((
            select sum(l.grand_amount) from public.expenses_bill_lines l where l.bill_id = b.id
          ), 0) as grand_total,
          (
            select l.currency from public.expenses_bill_lines l where l.bill_id = b.id
            order by l.row_serial asc limit 1
          ) as line_currency
        from public.expenses_bills b
        left join public.city_branches cb on cb.id = b.branch_id
        left join public.countries c on c.id = cb.country_id
        where b.deleted_at is null
          ${effectiveCountryId ? sql`and cb.country_id = ${effectiveCountryId}` : sql``}
          ${effectiveBranchId ? sql`and cb.id = ${effectiveBranchId}` : sql``}
          ${q ? sql`and (b.serial_no ilike ${`%${q}%`} or b.bill_title ilike ${`%${q}%`} or b.reference_no ilike ${`%${q}%`})` : sql``}
        order by b.bill_date desc nulls last, b.created_at desc
        limit ${limit}
      `;
    });

    const list = (rows ?? []).map((r: any) => ({
      id: r.id,
      billSerial: r.serial_no,
      billDate: r.bill_date,
      billMode: r.bill_mode,
      billTitle: r.bill_title,
      referenceNo: r.reference_no,
      transferredToRoznamcha: !!r.transferred_to_roznamcha,
      roznamchaEntryId: r.roznamcha_entry_id,
      cityBranchId: r.city_branch_id,
      countryId: r.country_id,
      countryName: r.country_name,
      branchLabel: r.city_branch_name || r.country_name || "—",
      currency: r.line_currency || r.country_currency || "",
      grandTotal: Number(r.grand_total || 0),
      createdAt: r.created_at
    }));

    return apiOk({
      scope: { level: scope.level, countryId: effectiveCountryId, branchId: effectiveBranchId, label: scope.scopeLabel },
      summary: {
        totalBills: list.length,
        grandTotal: list.reduce((s, x) => s + x.grandTotal, 0),
        transferred: list.filter((x) => x.transferredToRoznamcha).length
      },
      rows: list,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
