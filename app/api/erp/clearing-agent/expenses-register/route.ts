import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { shippingAccountingDenied } from "@/lib/permissions/shipping-explicit-gate";

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    {
      const __denied = shippingAccountingDenied(session);
      if (__denied) return __denied;
    }
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });

    const { searchParams } = new URL(req.url);
    const category = (searchParams.get("category") || "customer").toLowerCase();
    const country = searchParams.get("country");
    const status = searchParams.get("status");
    const search = (searchParams.get("search") || "").toLowerCase();

    const cityBranchIds = session.cityBranchIds ?? [];
    const countryBranchIds = session.countryBranchIds ?? [];
    const countryIds = session.countryIds ?? [];

    const dbRows = await withLocalPg(async (sql) => {
      // 1. If category is 'customs', check clearing_payment_bills as primary source, plus bill_expenses
      if (category === "customs") {
        return sql`
          SELECT
            b.id::text,
            COALESCE(b.bill_no, b.gd_number, 'CB-' || substr(b.id::text, 1, 8)) as "expenseNo",
            COALESCE(b.created_at::date::text, '') as "date",
            COALESCE(c.iso2, 'AE') as "countryCode",
            COALESCE(c.name, 'United Arab Emirates') as "countryName",
            COALESCE(c.flag_emoji, '🇦🇪') as "flag",
            COALESCE(cb.name, cityb.name, 'Main Branch') as "branch",
            COALESCE(p.full_name, 'System Admin') as "entryUser",
            COALESCE(b.agent_name, cust.customer_name, 'Customs Authority') as "party",
            'Customs Clearance' as "expenseType",
            COALESCE(b.bl_number, b.order_no, '') as "creditAcc",
            COALESCE(b.gd_number, '') as "debitAcc",
            COALESCE(b.total_amount, 0)::numeric as "amount",
            COALESCE(b.currency_code, 'USD') as "currency",
            CASE
              WHEN lower(COALESCE(b.payment_status, 'pending')) IN ('paid', 'approved', 'transferred') THEN 'approved'
              WHEN lower(COALESCE(b.payment_status, 'pending')) IN ('rejected', 'cancelled') THEN 'rejected'
              ELSE 'pending'
            END as "status"
          FROM public.clearing_payment_bills b
          LEFT JOIN public.countries c ON c.id = b.country_id
          LEFT JOIN public.country_branches cb ON cb.id = b.country_branch_id
          LEFT JOIN public.city_branches cityb ON cityb.id = b.city_branch_id
          LEFT JOIN public.customers cust ON cust.id = b.customer_id
          LEFT JOIN public.profiles p ON p.id = b.created_by
          WHERE b.deleted_at IS NULL
            AND (
              ${session.isSuperAdmin}
              OR (b.country_id IS NULL AND b.customer_id IS NULL)
              OR (${cityBranchIds.length > 0} AND b.city_branch_id = ANY(${cityBranchIds}))
              OR (${cityBranchIds.length === 0 && countryBranchIds.length > 0} AND b.country_branch_id = ANY(${countryBranchIds}))
              OR (${cityBranchIds.length === 0 && countryBranchIds.length === 0} AND b.country_id = ANY(${countryIds}))
            )
          ORDER BY b.created_at DESC
        `;
      }

      // 2. Otherwise query public.bill_expenses for other categories
      const moduleFilter =
        category === "truck"
          ? ["shipping_bl"]
          : category === "customer"
          ? ["clearing_bill", "purchase_booking", "local_purchase"]
          : ["shipping_bl", "clearing_bill"];

      return sql`
        SELECT
          be.id::text,
          COALESCE(be.bill_no, be.manual_bill_no, 'EXP-' || substr(be.id::text, 1, 8)) as "expenseNo",
          COALESCE(be.bill_date::text, be.created_at::date::text, '') as "date",
          COALESCE(c.iso2, 'AE') as "countryCode",
          COALESCE(c.name, 'United Arab Emirates') as "countryName",
          COALESCE(c.flag_emoji, '🇦🇪') as "flag",
          COALESCE(cb.name, cityb.name, 'Main Branch') as "branch",
          COALESCE(p.full_name, 'System Admin') as "entryUser",
          COALESCE(be.party_name, 'N/A') as "party",
          COALESCE(be.source_module, 'Expense') as "expenseType",
          COALESCE(be.party_account_no, '') as "creditAcc",
          '' as "debitAcc",
          COALESCE(be.original_bill_amount, 0)::numeric as "amount",
          COALESCE(be.currency, 'USD') as "currency",
          CASE
            WHEN lower(COALESCE(be.source_status, 'pending')) IN ('posted', 'approved', 'transferred', 'completed') THEN 'approved'
            WHEN lower(COALESCE(be.source_status, 'pending')) IN ('rejected', 'cancelled', 'withdrawn', 'deleted') THEN 'rejected'
            ELSE 'pending'
          END as "status"
        FROM public.bill_expenses be
        LEFT JOIN public.countries c ON c.id = be.country_id
        LEFT JOIN public.country_branches cb ON cb.id = be.country_branch_id
        LEFT JOIN public.city_branches cityb ON cityb.id = be.city_branch_id
        LEFT JOIN public.profiles p ON p.id = be.created_by
        WHERE be.eligibility = 'active'
          AND be.source_module = ANY(${moduleFilter})
          AND (
            ${session.isSuperAdmin}
            OR (${cityBranchIds.length > 0} AND be.city_branch_id = ANY(${cityBranchIds}))
            OR (${cityBranchIds.length === 0 && countryBranchIds.length > 0} AND be.country_branch_id = ANY(${countryBranchIds}))
            OR (${cityBranchIds.length === 0 && countryBranchIds.length === 0} AND be.country_id = ANY(${countryIds}))
          )
        ORDER BY be.created_at DESC
      `;
    });

    const rows = (dbRows || []).map((r: any) => ({
      id: r.id,
      expenseNo: r.expenseNo,
      date: r.date,
      countryCode: r.countryCode,
      countryName: r.countryName,
      flag: r.flag,
      branch: r.branch,
      entryUser: r.entryUser,
      party: r.party,
      expenseType: r.expenseType,
      creditAcc: r.creditAcc,
      debitAcc: r.debitAcc,
      amount: Number(r.amount || 0),
      currency: r.currency,
      status: r.status
    }));

    // In-memory filter on DB records if requested
    const filtered = rows.filter((item: any) => {
      if (country && country !== "all" && item.countryCode !== country && item.countryName !== country) {
        return false;
      }
      if (status && status !== "all" && item.status !== status) {
        return false;
      }
      if (search) {
        const match =
          item.expenseNo.toLowerCase().includes(search) ||
          item.party.toLowerCase().includes(search) ||
          item.branch.toLowerCase().includes(search) ||
          item.expenseType.toLowerCase().includes(search) ||
          item.entryUser.toLowerCase().includes(search);
        if (!match) return false;
      }
      return true;
    });

    // Summary calculations purely from real database rows
    const totalAmount = filtered.reduce((acc: number, cur: any) => acc + cur.amount, 0);
    const approvedAmount = filtered.filter((i: any) => i.status === "approved").reduce((acc: number, cur: any) => acc + cur.amount, 0);
    const pendingAmount = filtered.filter((i: any) => i.status === "pending").reduce((acc: number, cur: any) => acc + cur.amount, 0);
    const rejectedAmount = filtered.filter((i: any) => i.status === "rejected").reduce((acc: number, cur: any) => acc + cur.amount, 0);

    const summary = {
      totalAmount,
      totalCount: filtered.length,
      approvedAmount,
      approvedCount: filtered.filter((i: any) => i.status === "approved").length,
      pendingAmount,
      pendingCount: filtered.filter((i: any) => i.status === "pending").length,
      rejectedAmount,
      rejectedCount: filtered.filter((i: any) => i.status === "rejected").length
    };

    return NextResponse.json({
      success: true,
      category,
      summary,
      data: filtered
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    console.error("GET /api/erp/clearing-agent/expenses-register error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load expenses register." },
      { status: 500 }
    );
  }
}
