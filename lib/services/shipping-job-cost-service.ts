import { withLocalPg } from "@/lib/db/local-postgres";

export interface ShippingJobCostExpenseLine {
  id: string;
  expenseType: string;
  grandAmount: number;
  currency: string;
  postingStatus: "unposted" | "posted" | "void";
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  countryName: string | null;
  branchName: string | null;
  billNo: string | null;
  claim: {
    id: string;
    status: string;
    amount: number;
    originCountryName: string | null;
    destCountryName: string | null;
    decidedAt: string | null;
  } | null;
}

export interface ShippingJobCostReport {
  orderId: string;
  orderNo: string | null;
  customerName: string | null;
  orderScope: { countryId: string | null; countryBranchId: string | null; cityBranchId: string | null; countryName: string | null };
  customerCharges: { total: number; postedTotal: number; currency: string; count: number };
  jobExpenses: { total: number; postedTotal: number; currency: string; lines: ShippingJobCostExpenseLine[] };
  interBranchClaims: Array<{
    id: string;
    status: string;
    amount: number;
    currencyCode: string;
    originCountryName: string | null;
    originBranchName: string | null;
    destCountryName: string | null;
    destBranchName: string | null;
    category: string | null;
    createdAt: string;
    decidedAt: string | null;
  }>;
  profit: { revenue: number; expense: number; net: number; currency: string };
}

/**
 * Per-order Job Cost / Profit summary. Each expense counts EXACTLY ONCE — an
 * inter-branch claim (shipping_expense_transfers) is a SETTLEMENT event (which
 * branch ultimately carries/recovers the cost), never an additional cost on
 * top of the original bill_expense_lines entry it originated from. Reuses the
 * existing bill_expenses/bill_expense_lines register and the existing
 * shipping_expense_transfers approval workflow — no new posting engine.
 */
export async function getShippingOrderJobCost(orderId: string): Promise<ShippingJobCostReport> {
  const data = await withLocalPg(async (sql) => {
    const [order] = await sql`
      SELECT o.id, o.order_no, o.customer_name, o.country_id, o.country_branch_id, o.city_branch_id, c.name AS country_name
      FROM public.clearing_customer_orders o
      LEFT JOIN public.countries c ON c.id = o.country_id
      WHERE o.id = ${orderId} AND o.deleted_at IS NULL LIMIT 1
    `;
    if (!order) throw new Error("Customer order not found.");

    const charges = await sql`
      SELECT amount, currency_code, posting_status FROM public.clearing_bill_customer_charges
      WHERE order_id = ${orderId} AND deleted_at IS NULL
    `;

    const expenseLines = await sql`
      SELECT bel.id, bel.expense_type, bel.grand_amount, bel.currency, bel.posting_status,
             be.id AS bill_expense_id, be.country_id, be.country_branch_id, be.city_branch_id, be.bill_no,
             c.name AS country_name, cb.name AS branch_name
      FROM public.bill_expense_lines bel
      JOIN public.bill_expenses be ON be.id = bel.bill_expense_id AND be.deleted_at IS NULL
      LEFT JOIN public.countries c ON c.id = be.country_id
      LEFT JOIN public.city_branches cb ON cb.id = be.city_branch_id
      WHERE bel.deleted_at IS NULL
        AND be.source_table = 'clearing_payment_bills'
        AND be.source_id IN (SELECT id FROM public.clearing_payment_bills WHERE order_id = ${orderId} AND deleted_at IS NULL)
      ORDER BY bel.created_at ASC
    `;

    const lineIds = expenseLines.map((l: any) => l.id);
    const claims = await sql`
      SELECT t.*, oc.name AS origin_country_name, dc.name AS dest_country_name,
             ob.name AS origin_branch_name, db.name AS dest_branch_name
      FROM public.shipping_expense_transfers t
      LEFT JOIN public.countries oc ON oc.id = t.origin_country_id
      LEFT JOIN public.countries dc ON dc.id = t.dest_country_id
      LEFT JOIN public.city_branches ob ON ob.id = t.origin_city_branch_id
      LEFT JOIN public.city_branches db ON db.id = t.dest_city_branch_id
      WHERE t.deleted_at IS NULL
        AND (t.order_id = ${orderId} OR (t.source_table = 'bill_expense_lines' AND t.source_id = ANY(${lineIds}::uuid[])))
      ORDER BY t.created_at ASC
    `;

    return { order, charges, expenseLines, claims };
  });

  if (!data) throw new Error("Job cost report needs a direct database connection.");
  const { order, charges, expenseLines, claims } = data;

  const claimsByLineId = new Map<string, any>();
  for (const c of claims) {
    if (c.source_table === "bill_expense_lines" && c.source_id) claimsByLineId.set(c.source_id, c);
  }

  const currency = expenseLines[0]?.currency || charges[0]?.currency_code || "USD";

  const chargesTotal = charges.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const chargesPostedTotal = charges.filter((c: any) => c.posting_status === "posted").reduce((s: number, c: any) => s + Number(c.amount || 0), 0);

  const expenseTotal = expenseLines.reduce((s: number, l: any) => s + Number(l.grand_amount || 0), 0);
  const expensePostedTotal = expenseLines
    .filter((l: any) => l.posting_status === "posted")
    .reduce((s: number, l: any) => s + Number(l.grand_amount || 0), 0);

  const lines: ShippingJobCostExpenseLine[] = expenseLines.map((l: any) => {
    const claim = claimsByLineId.get(l.id);
    return {
      id: l.id,
      expenseType: l.expense_type,
      grandAmount: Number(l.grand_amount),
      currency: l.currency,
      postingStatus: l.posting_status,
      countryId: l.country_id,
      countryBranchId: l.country_branch_id,
      cityBranchId: l.city_branch_id,
      countryName: l.country_name,
      branchName: l.branch_name,
      billNo: l.bill_no,
      claim: claim
        ? {
            id: claim.id,
            status: claim.status,
            amount: Number(claim.amount),
            originCountryName: claim.origin_country_name,
            destCountryName: claim.dest_country_name,
            decidedAt: claim.decided_at
          }
        : null
    };
  });

  return {
    orderId,
    orderNo: order.order_no,
    customerName: order.customer_name,
    orderScope: {
      countryId: order.country_id,
      countryBranchId: order.country_branch_id,
      cityBranchId: order.city_branch_id,
      countryName: order.country_name
    },
    customerCharges: { total: chargesTotal, postedTotal: chargesPostedTotal, currency, count: charges.length },
    jobExpenses: { total: expenseTotal, postedTotal: expensePostedTotal, currency, lines },
    interBranchClaims: claims.map((c: any) => ({
      id: c.id,
      status: c.status,
      amount: Number(c.amount),
      currencyCode: c.currency_code,
      originCountryName: c.origin_country_name,
      originBranchName: c.origin_branch_name,
      destCountryName: c.dest_country_name,
      destBranchName: c.dest_branch_name,
      category: c.category,
      createdAt: c.created_at,
      decidedAt: c.decided_at
    })),
    profit: {
      revenue: chargesPostedTotal,
      expense: expensePostedTotal,
      net: chargesPostedTotal - expensePostedTotal,
      currency
    }
  };
}
