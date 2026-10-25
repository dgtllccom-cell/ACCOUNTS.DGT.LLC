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

export interface ShippingJobCostPartnerBill {
  id: string;
  billNo: string;
  legId: string | null;
  legNo: number | null;
  fromLocation: string | null;
  toLocation: string | null;
  countryOfService: string | null;
  providerName: string;
  providerAccountCode: string | null;
  providerAccountName: string | null;
  invoiceRef: string | null;
  expenseCategory: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  currencyCode: string;
  postingStatus: "draft" | "unposted" | "posted" | "void";
  paymentStatus: "pending" | "partially_paid" | "paid";
  postedAt: string | null;
  payments: Array<{
    id: string;
    paymentNo: string;
    paymentDate: string;
    amount: number;
    paymentAccountCode: string | null;
    paymentAccountName: string | null;
    referenceNo: string | null;
    narration: string | null;
  }>;
}

export interface ShippingJobCostReport {
  orderId: string;
  orderNo: string | null;
  customerName: string | null;
  orderScope: { countryId: string | null; countryBranchId: string | null; cityBranchId: string | null; countryName: string | null };
  /** totals are null when the order mixes currencies — use `byCurrency` then (money is never added across currencies) */
  customerCharges: { total: number | null; postedTotal: number | null; currency: string | null; count: number };
  jobExpenses: { total: number | null; postedTotal: number | null; currency: string | null; lines: ShippingJobCostExpenseLine[] };
  byCurrency: ShippingJobCostCurrencyRow[];
  mixedCurrency: boolean;
  partnerBills: ShippingJobCostPartnerBill[];
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
  profit: { revenue: number | null; expense: number | null; net: number | null; currency: string | null };
}

/** Revenue / expense / profit of ONE currency. A job whose bills are in several currencies has one row per currency. */
export interface ShippingJobCostCurrencyRow {
  currency: string;
  revenue: number;
  revenuePosted: number;
  expense: number;
  expensePosted: number;
  net: number;
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
             c.name AS country_name, cb.name AS branch_name,
             upper(coalesce(nullif(cb.local_currency, ''), c.currency_code)) AS base_currency
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

    // Query external partner bills directly linked to order legs
    const partnerBillRows = await sql`
      SELECT b.*,
             l.leg_no, l.from_location_text, l.to_location_text,
             p_acc.code AS provider_account_code, p_acc.name AS provider_account_name
      FROM public.clearing_payment_bills b
      LEFT JOIN public.clearing_customer_order_legs l ON l.id = b.leg_id
      LEFT JOIN public.ledgers p_acc ON p_acc.id = b.provider_account_id
      WHERE b.order_id = ${orderId}::uuid AND b.deleted_at IS NULL
      ORDER BY b.created_at ASC
    `;

    const partnerBillIds = partnerBillRows.map((b: any) => b.id);
    let partnerPayments: any[] = [];
    if (partnerBillIds.length > 0) {
      partnerPayments = await sql`
        SELECT p.*,
               pay_acc.code AS payment_account_code, pay_acc.name AS payment_account_name
        FROM public.clearing_payment_bill_payments p
        LEFT JOIN public.ledgers pay_acc ON pay_acc.id = p.payment_account_id
        WHERE p.bill_id = ANY(${partnerBillIds}::uuid[]) AND p.deleted_at IS NULL
        ORDER BY p.payment_date ASC, p.payment_serial ASC
      `;
    }

    return { order, charges, expenseLines, claims, partnerBillRows, partnerPayments };
  });

  if (!data) throw new Error("Job cost report needs a direct database connection.");
  const { order, charges, expenseLines, claims, partnerBillRows, partnerPayments } = data;

  const claimsByLineId = new Map<string, any>();
  for (const c of claims) {
    if (c.source_table === "bill_expense_lines" && c.source_id) claimsByLineId.set(c.source_id, c);
  }

  // Money is never added across currencies: every figure below is totalled PER currency. Expense lines are stored in the BASE currency of
  // their bill's branch / country (not in the currency of the original invoice), charges and partner bills in their own currency.
  const cur = (v: unknown) => String(v || "").trim().toUpperCase() || "—";
  const rows = new Map<string, ShippingJobCostCurrencyRow>();
  const rowFor = (currency: string) => {
    const hit = rows.get(currency) ?? { currency, revenue: 0, revenuePosted: 0, expense: 0, expensePosted: 0, net: 0 };
    rows.set(currency, hit);
    return hit;
  };
  for (const c of charges) {
    const r = rowFor(cur(c.currency_code));
    r.revenue += Number(c.amount || 0);
    if (c.posting_status === "posted") r.revenuePosted += Number(c.amount || 0);
  }
  for (const l of expenseLines) {
    const r = rowFor(cur(l.base_currency));
    r.expense += Number(l.grand_amount || 0);
    if (l.posting_status === "posted") r.expensePosted += Number(l.grand_amount || 0);
  }
  for (const b of partnerBillRows) {
    const r = rowFor(cur(b.currency_code));
    r.expense += Number(b.total_amount || 0);
    if ((b.posting_status || "unposted") === "posted") r.expensePosted += Number(b.total_amount || 0);
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const byCurrency = [...rows.values()]
    .map((r) => ({ currency: r.currency, revenue: round2(r.revenue), revenuePosted: round2(r.revenuePosted), expense: round2(r.expense), expensePosted: round2(r.expensePosted), net: round2(r.revenuePosted - r.expensePosted) }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
  const mixedCurrency = byCurrency.length > 1;
  const only = byCurrency.length === 1 ? byCurrency[0] : null;
  const noRows = byCurrency.length === 0;
  const single = (pick: (r: ShippingJobCostCurrencyRow) => number): number | null => (mixedCurrency ? null : only ? pick(only) : noRows ? 0 : null);
  const currency: string | null = only ? only.currency : null;

  // Partner bills mapping
  const partnerBills: ShippingJobCostPartnerBill[] = partnerBillRows.map((b: any) => ({
    id: b.id,
    billNo: b.bill_no,
    legId: b.leg_id,
    legNo: b.leg_no ?? null,
    fromLocation: b.from_location_text ?? null,
    toLocation: b.to_location_text ?? null,
    countryOfService: b.country_of_service ?? null,
    providerName: b.agent_name,
    providerAccountCode: b.provider_account_code ?? null,
    providerAccountName: b.provider_account_name ?? null,
    invoiceRef: b.invoice_ref ?? null,
    expenseCategory: b.expense_category ?? null,
    totalAmount: Number(b.total_amount || 0),
    paidAmount: Number(b.paid_amount || 0),
    remainingBalance: Number(b.remaining_balance ?? (Number(b.total_amount || 0) - Number(b.paid_amount || 0))),
    currencyCode: b.currency_code || "USD",
    postingStatus: b.posting_status || "unposted",
    paymentStatus: b.payment_status || "pending",
    postedAt: b.posted_at ? new Date(b.posted_at).toISOString() : null,
    payments: partnerPayments
      .filter((p: any) => p.bill_id === b.id)
      .map((p: any) => ({
        id: p.id,
        paymentNo: p.payment_no,
        paymentDate: p.payment_date,
        amount: Number(p.amount),
        paymentAccountCode: p.payment_account_code ?? null,
        paymentAccountName: p.payment_account_name ?? null,
        referenceNo: p.reference_no ?? null,
        narration: p.narration ?? null
      }))
  }));

  const lines: ShippingJobCostExpenseLine[] = expenseLines.map((l: any) => {
    const claim = claimsByLineId.get(l.id);
    return {
      id: l.id,
      expenseType: l.expense_type,
      grandAmount: Number(l.grand_amount),
      // grand_amount is in the base currency of the bill's branch / country, so that is the label (never the original invoice currency)
      currency: cur(l.base_currency),
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
    customerCharges: { total: single((r) => r.revenue), postedTotal: single((r) => r.revenuePosted), currency, count: charges.length },
    jobExpenses: { total: single((r) => r.expense), postedTotal: single((r) => r.expensePosted), currency, lines },
    byCurrency,
    mixedCurrency,
    partnerBills,
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
      revenue: single((r) => r.revenuePosted),
      expense: single((r) => r.expensePosted),
      net: single((r) => r.net),
      currency
    }
  };
}
