import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("startDate") || new Date().toISOString().split("T")[0];
    const endDate = searchParams.get("endDate") || startDate;
    let countryId = searchParams.get("countryId");
    let cityBranchId = searchParams.get("cityBranchId");

    // Scope check
    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      if (session.countryIds.length > 0) {
        countryId = session.countryIds[0];
      }
      if (session.cityBranchIds.length > 0) {
        cityBranchId = session.cityBranchIds[0];
      }
    }

    const data = await withLocalPg(async (sql) => {
      // Dynamic live calculation across operational tables for maximum precision
      const branchStats = await sql`
        SELECT 
          b.id AS branch_id,
          b.name AS branch_name,
          b.country_id,
          c.name AS country_name,
          -- Purchases count and amount
          COALESCE((
            SELECT COUNT(*) 
            FROM purchase_orders p 
            WHERE p.city_branch_id = b.id 
              AND DATE(p.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS purchases_count,
          COALESCE((
            SELECT SUM(COALESCE(p.total_amount, 0)) 
            FROM purchase_orders p 
            WHERE p.city_branch_id = b.id 
              AND DATE(p.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS purchases_amount,
          -- Sales count and amount
          COALESCE((
            SELECT COUNT(*) 
            FROM sales_orders s 
            WHERE s.city_branch_id = b.id 
              AND DATE(s.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS sales_count,
          COALESCE((
            SELECT SUM(COALESCE(s.total_amount, 0)) 
            FROM sales_orders s 
            WHERE s.city_branch_id = b.id 
              AND DATE(s.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS sales_amount,
          -- Payments count and amount
          COALESCE((
            SELECT COUNT(*) 
            FROM purchase_order_payments pop 
            WHERE pop.city_branch_id = b.id 
              AND DATE(pop.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS purchase_payments_count,
          COALESCE((
            SELECT SUM(COALESCE(pop.amount, 0)) 
            FROM purchase_order_payments pop 
            WHERE pop.city_branch_id = b.id 
              AND DATE(pop.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS purchase_payments_amount,
          COALESCE((
            SELECT COUNT(*) 
            FROM sales_order_payments sop 
            WHERE sop.city_branch_id = b.id 
              AND DATE(sop.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS sales_payments_count,
          COALESCE((
            SELECT SUM(COALESCE(sop.amount, 0)) 
            FROM sales_order_payments sop 
            WHERE sop.city_branch_id = b.id 
              AND DATE(sop.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS sales_payments_amount,
          -- Roznamcha entries
          COALESCE((
            SELECT COUNT(*) 
            FROM roznamcha_entries r 
            WHERE r.city_branch_id = b.id 
              AND DATE(r.entry_date) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS roznamcha_count,
          -- Audit events: edited & deleted counts
          COALESCE((
            SELECT COUNT(*) 
            FROM enterprise_audit_events a 
            WHERE a.city_branch_id = b.id::text 
              AND a.action_type = 'EDIT'
              AND DATE(a.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS edited_count,
          COALESCE((
            SELECT COUNT(*) 
            FROM enterprise_audit_events a 
            WHERE a.city_branch_id = b.id::text 
              AND a.action_type = 'SOFT_DELETE'
              AND DATE(a.created_at) BETWEEN ${startDate}::date AND ${endDate}::date
          ), 0) AS deleted_count
        FROM city_branches b
        LEFT JOIN countries c ON c.id = b.country_id
        WHERE b.deleted_at IS NULL
          ${countryId ? sql`AND b.country_id = ${countryId}` : sql``}
          ${cityBranchId ? sql`AND b.id = ${cityBranchId}` : sql``}
        ORDER BY c.name ASC, b.name ASC;
      `;

      // Overall totals across selected criteria
      let totalPurchasesAmt = 0;
      let totalSalesAmt = 0;
      let totalPaymentsAmt = 0;
      let totalRoznamcha = 0;
      let totalEdits = 0;
      let totalDeletes = 0;

      for (const row of branchStats) {
        totalPurchasesAmt += Number(row.purchases_amount || 0);
        totalSalesAmt += Number(row.sales_amount || 0);
        totalPaymentsAmt += Number(row.purchase_payments_amount || 0) + Number(row.sales_payments_amount || 0);
        totalRoznamcha += Number(row.roznamcha_count || 0);
        totalEdits += Number(row.edited_count || 0);
        totalDeletes += Number(row.deleted_count || 0);
      }

      return {
        startDate,
        endDate,
        branchStats,
        totals: {
          totalBranches: branchStats.length,
          totalPurchasesAmt,
          totalSalesAmt,
          totalPaymentsAmt,
          totalRoznamcha,
          totalEdits,
          totalDeletes
        }
      };
    });

    return NextResponse.json({
      success: true,
      ...data
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch daily branch activity." }, { status: 500 });
  }
}
