import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/erp/reports/activity-summary
 *
 * Returns branch-wise activity counts for the ERP Activity Summary Dashboard.
 * Queries purchase_orders, sales_orders, roznamcha_entries, ledgers,
 * loading_records, enterprise_accounts, and shipping_line_records tables.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const admin = createSupabaseAdminClient();

    // 1. Get all branches (country_branches) with their country
    const { data: branches, error: brErr } = await admin
      .from("country_branches")
      .select("id, name, code, country_id, countries(name)")
      .is("deleted_at", null)
      .order("name");

    if (brErr) throw brErr;

    // 2. Parallel queries for all module counts
    const [
      purchaseRows,
      salesRows,
      roznamchaRows,
      ledgerRows,
      loadingRows,
      accountRows,
      shippingRows,
    ] = await Promise.all([
      // Purchase Orders
      admin
        .from("purchase_orders")
        .select("id, country_branch_id, country_id, status, created_at")
        .is("deleted_at", null),

      // Sales Orders
      admin
        .from("sales_orders")
        .select("id, country_branch_id, country_id, sales_status, created_at")
        .is("deleted_at", null),

      // Roznamcha Entries (cash entries, payments, journal entries)
      admin
        .from("roznamcha_entries")
        .select("id, country_branch_id, city_branch_id, country_id, type, status, created_at")
        .is("deleted_at", null),

      // Ledgers
      admin
        .from("ledgers")
        .select("id, country_branch_id, country_id, created_at")
        .is("deleted_at", null),

      // Loading Records
      admin
        .from("purchase_loading_records")
        .select("id, country_branch_id, country_id, created_at")
        .is("deleted_at", null)
        .then((res) => res)
        .catch(() => ({ data: [], error: null })),

      // Enterprise Accounts
      admin
        .from("enterprise_accounts")
        .select("id, country_branch_id, country_id, created_at")
        .is("deleted_at", null),

      // Shipping Line Records
      admin
        .from("shipping_line_records")
        .select("id, country_branch_id, country_id, created_at")
        .is("deleted_at", null)
        .then((res) => res)
        .catch(() => ({ data: [], error: null })),
    ]);

    const purchases = purchaseRows.data ?? [];
    const sales = salesRows.data ?? [];
    const roznamcha = roznamchaRows.data ?? [];
    const ledgers = ledgerRows.data ?? [];
    const loading = (loadingRows as any)?.data ?? [];
    const accounts = accountRows.data ?? [];
    const shipping = (shippingRows as any)?.data ?? [];

    // Helper: match row to branch
    function branchIdOf(row: any): string | null {
      return row.country_branch_id || null;
    }

    function countryIdOf(row: any): string | null {
      return row.country_id || null;
    }

    function latestDate(dates: (string | null | undefined)[]): string | null {
      const valid = dates.filter(Boolean) as string[];
      if (valid.length === 0) return null;
      return valid.sort().reverse()[0];
    }

    // Build per-branch stats
    const branchStats = (branches ?? []).map((branch: any) => {
      const bId = branch.id;
      const cId = branch.country_id;

      // Match rows: either exact branch match or country match when no branch assigned
      const matchBranch = (row: any) =>
        branchIdOf(row) === bId ||
        (!branchIdOf(row) && countryIdOf(row) === cId);

      const brPurchases = purchases.filter(matchBranch);
      const brSales = sales.filter(matchBranch);
      const brRoznamcha = roznamcha.filter(matchBranch);
      const brLedgers = ledgers.filter(matchBranch);
      const brLoading = loading.filter(matchBranch);
      const brAccounts = accounts.filter(matchBranch);
      const brShipping = shipping.filter(matchBranch);

      // Roznamcha breakdown by type
      const cashEntries = brRoznamcha.filter(
        (r: any) => r.type === "cash_entry" || r.type === "cash" || r.type === "receipt"
      );
      const payments = brRoznamcha.filter(
        (r: any) => r.type === "payment" || r.type === "expense"
      );
      const transfers = brPurchases.filter(
        (r: any) => r.status === "transferred" || r.status === "completed"
      );

      // Last activity from all tables
      const allDates = [
        ...brPurchases.map((r: any) => r.created_at),
        ...brSales.map((r: any) => r.created_at),
        ...brRoznamcha.map((r: any) => r.created_at),
        ...brLedgers.map((r: any) => r.created_at),
        ...brLoading.map((r: any) => r.created_at),
        ...brShipping.map((r: any) => r.created_at),
      ];

      return {
        branchId: bId,
        branchName: branch.name || branch.code || "Unknown",
        branchCode: branch.code || "",
        countryId: cId,
        countryName: (branch.countries as any)?.name || "Unknown",
        purchases: brPurchases.length,
        sales: brSales.length,
        accounts: brAccounts.length,
        cashEntries: cashEntries.length,
        payments: payments.length,
        journalEntries: brRoznamcha.length,
        ledgerEntries: brLedgers.length,
        loadingRecords: brLoading.length,
        transfers: transfers.length,
        shippingRecords: brShipping.length,
        lastActivity: latestDate(allDates),
        isActive:
          brPurchases.length > 0 ||
          brSales.length > 0 ||
          brRoznamcha.length > 0,
      };
    });

    // Country-wise totals
    const countryMap = new Map<string, any>();
    for (const bs of branchStats) {
      if (!countryMap.has(bs.countryId)) {
        countryMap.set(bs.countryId, {
          countryId: bs.countryId,
          countryName: bs.countryName,
          purchases: 0,
          sales: 0,
          accounts: 0,
          cashEntries: 0,
          payments: 0,
          journalEntries: 0,
          ledgerEntries: 0,
          loadingRecords: 0,
          transfers: 0,
          shippingRecords: 0,
          lastActivity: null as string | null,
          branchCount: 0,
        });
      }
      const ct = countryMap.get(bs.countryId)!;
      ct.purchases += bs.purchases;
      ct.sales += bs.sales;
      ct.accounts += bs.accounts;
      ct.cashEntries += bs.cashEntries;
      ct.payments += bs.payments;
      ct.journalEntries += bs.journalEntries;
      ct.ledgerEntries += bs.ledgerEntries;
      ct.loadingRecords += bs.loadingRecords;
      ct.transfers += bs.transfers;
      ct.shippingRecords += bs.shippingRecords;
      ct.lastActivity = latestDate([ct.lastActivity, bs.lastActivity]);
      ct.branchCount += 1;
    }

    // Grand total
    const grandTotal = {
      purchases: purchases.length,
      sales: sales.length,
      accounts: accounts.length,
      cashEntries: roznamcha.filter(
        (r: any) => r.type === "cash_entry" || r.type === "cash" || r.type === "receipt"
      ).length,
      payments: roznamcha.filter(
        (r: any) => r.type === "payment" || r.type === "expense"
      ).length,
      journalEntries: roznamcha.length,
      ledgerEntries: ledgers.length,
      loadingRecords: loading.length,
      transfers: purchases.filter(
        (r: any) => r.status === "transferred" || r.status === "completed"
      ).length,
      shippingRecords: shipping.length,
      lastActivity: latestDate([
        ...purchases.map((r: any) => r.created_at),
        ...sales.map((r: any) => r.created_at),
        ...roznamcha.map((r: any) => r.created_at),
      ]),
      totalBranches: (branches ?? []).length,
      activeBranches: branchStats.filter((b) => b.isActive).length,
    };

    return apiOk({
      branches: branchStats,
      countryTotals: Array.from(countryMap.values()),
      grandTotal,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
