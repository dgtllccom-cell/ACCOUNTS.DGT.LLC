import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Branch/Country Business Summary — CLAUDE.md Section C.
 *
 * A single reusable aggregation endpoint for total purchase / sales /
 * expenses / outstanding / payments / stock / profit / customer balances,
 * scoped by the same super_admin/country_admin/branch RBAC every other
 * report endpoint uses (resolveReportScope/enforceScopeFilters, identical
 * to app/api/erp/bill-expenses/route.ts). Previously this arithmetic was
 * duplicated ad hoc inside app/dashboard/page.tsx and
 * app/dashboard/country/page.tsx server components with no callable API —
 * this route exposes the same figures as one composable JSON response so
 * any other screen (or a future read-only AI business-query endpoint) can
 * call it instead of re-deriving totals. It intentionally does not touch
 * or replace those two existing dashboard pages.
 *
 * Query params: countryId, branchId (= city_branch_id; ignored/forced per
 * the caller's scope exactly like every other scoped report route).
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

    // One round trip: every aggregate as a scalar subquery in a single
    // SELECT, plus one lightweight row-fetch for stock valuation (JSONB
    // parsing happens in JS below, so it can't be folded into the same
    // scalar-subquery statement). withLocalPg's pool is a single remote
    // connection (max: 1) with real pooler round-trip latency per query
    // (see lib/db/local-postgres.ts) -- 6 separate sequential statements
    // measured ~20s end-to-end in testing; 2 statements is the fix.
    const data = await withLocalPg(async (sql) => {
      const countryFilter = effectiveCountryId ? sql`and country_id = ${effectiveCountryId}` : sql``;
      const branchFilter = effectiveBranchId ? sql`and city_branch_id = ${effectiveBranchId}` : sql``;
      const custCountryFilter = effectiveCountryId ? sql`and l.country_id = ${effectiveCountryId}` : sql``;
      const custBranchFilter = effectiveBranchId ? sql`and l.city_branch_id = ${effectiveBranchId}` : sql``;

      const [summaryRows, productsRows] = await Promise.all([
        sql`
          select
            (select coalesce(sum(order_total), 0) from public.purchase_orders where deleted_at is null ${countryFilter} ${branchFilter})::numeric as purchase_total,
            (select coalesce(sum(advance_paid), 0) from public.purchase_orders where deleted_at is null ${countryFilter} ${branchFilter})::numeric as purchase_paid,
            (select coalesce(sum(remaining_due), 0) from public.purchase_orders where deleted_at is null ${countryFilter} ${branchFilter})::numeric as purchase_outstanding,
            (select coalesce(sum(order_total), 0) from public.sales_orders where deleted_at is null ${countryFilter} ${branchFilter})::numeric as sales_total,
            (select coalesce(sum(paid_amount), 0) from public.sales_orders where deleted_at is null ${countryFilter} ${branchFilter})::numeric as sales_paid,
            (select coalesce(sum(order_total - coalesce(paid_amount, 0)), 0) from public.sales_orders where deleted_at is null ${countryFilter} ${branchFilter})::numeric as sales_outstanding,
            (select coalesce(sum(expense_total), 0) from public.bill_expenses where deleted_at is null ${countryFilter} ${branchFilter})::numeric as expense_total,
            (select coalesce(sum(debit_total), 0) from public.ledgers where deleted_at is null ${countryFilter} ${branchFilter})::numeric as ledger_debit,
            (select coalesce(sum(credit_total), 0) from public.ledgers where deleted_at is null ${countryFilter} ${branchFilter})::numeric as ledger_credit,
            (select coalesce(sum(current_balance), 0) from public.ledgers where deleted_at is null ${countryFilter} ${branchFilter})::numeric as ledger_balance,
            (select coalesce(sum(l.current_balance), 0) from public.ledgers l join public.account_customer_owners aco on aco.account_id = l.enterprise_account_id where l.deleted_at is null ${custCountryFilter} ${custBranchFilter})::numeric as customer_balance_total,
            (select count(distinct aco.customer_id) from public.ledgers l join public.account_customer_owners aco on aco.account_id = l.enterprise_account_id where l.deleted_at is null ${custCountryFilter} ${custBranchFilter})::int as customer_count;
        `.catch(() => [{}]),
        sql`
          select product_specifications
          from public.products
          where deleted_at is null ${countryFilter} ${branchFilter};
        `.catch(() => [])
      ]);

      return { summaryRows, productsRows };
    });

    if (!data) throw new Error("Database connection could not be established");
    const { summaryRows, productsRows } = data;
    const s: any = summaryRows[0] || {};

    const purchase = { total: s.purchase_total ?? 0, paid: s.purchase_paid ?? 0, outstanding: s.purchase_outstanding ?? 0 };
    const sales = { total: s.sales_total ?? 0, paid: s.sales_paid ?? 0, outstanding: s.sales_outstanding ?? 0 };
    const expenses = { total: s.expense_total ?? 0 };
    const ledger = { debit: s.ledger_debit ?? 0, credit: s.ledger_credit ?? 0, balance: s.ledger_balance ?? 0 };
    const customerBalance = { total: s.customer_balance_total ?? 0, customer_count: s.customer_count ?? 0 };

    const stockValueTotal = (productsRows || []).reduce((sum: number, row: any) => {
      const spec = row.product_specifications || {};
      const qty = Number(spec.stockQty || spec.stock_qty || spec.quantity || spec.qty || 0);
      const price = Number(spec.costPrice || spec.cost_price || spec.purchaseRate || spec.purchase_rate || 0);
      const val = Number(spec.inventoryValue || spec.inventory_value || 0) || qty * price;
      return sum + val;
    }, 0);

    const purchaseTotal = Number(purchase.total || 0);
    const salesTotal = Number(sales.total || 0);

    return apiOk({
      scope: {
        level: scope.level,
        countryId: effectiveCountryId,
        branchId: effectiveBranchId,
        label: scope.scopeLabel
      },
      purchase: {
        total: purchaseTotal,
        paid: Number(purchase.paid || 0),
        outstanding: Number(purchase.outstanding || 0)
      },
      sales: {
        total: salesTotal,
        paid: Number(sales.paid || 0),
        outstanding: Number(sales.outstanding || 0)
      },
      expenses: {
        total: Number(expenses.total || 0)
      },
      payments: {
        purchasePaid: Number(purchase.paid || 0),
        salesReceived: Number(sales.paid || 0)
      },
      outstanding: {
        receivable: Number(sales.outstanding || 0),
        payable: Number(purchase.outstanding || 0)
      },
      stock: {
        valueTotal: stockValueTotal,
        productsCount: (productsRows || []).length
      },
      profit: {
        // Same naive sales-minus-purchase methodology already shown on the
        // existing dashboards -- not a true accrual P&L (that gap is
        // tracked separately; see get_trial_balance/financial-summaries).
        grossEstimate: salesTotal - purchaseTotal
      },
      ledger: {
        debit: Number(ledger.debit || 0),
        credit: Number(ledger.credit || 0),
        balance: Number(ledger.balance || 0)
      },
      customerBalances: {
        total: Number(customerBalance.total || 0),
        customerCount: Number(customerBalance.customer_count || 0)
      }
    });
  } catch (err: any) {
    return handleApiError(err);
  }
}
