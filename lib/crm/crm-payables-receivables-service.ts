import { withLocalPg } from "@/lib/db/local-postgres";
import { ErpSession } from "@/lib/auth/session";
import { calculatePaymentDueTracking, PaymentDueTrackingResult } from "@/lib/services/payment-due-tracking";

export interface DayForecastSummary {
  date: string; // YYYY-MM-DD
  dayLabel: "today" | "tomorrow" | "day2" | "day3" | "day4" | "day5";
  payableAmount: number;
  payableCount: number;
  receivableAmount: number;
  receivableCount: number;
  netCashFlow: number;
  payablesByCurrency: Record<string, number>;
  receivablesByCurrency: Record<string, number>;
}

export interface CategoryBreakdown {
  categoryKey: string;
  categoryLabelEn: string;
  count: number;
  totalOutstanding: number;
  dueToday: number;
  overdue: number;
  forecast5Days: number;
  byCurrency: Record<string, number>;
}

export interface CrmPayablesReceivablesPayload {
  forecastRange: {
    startDate: string;
    endDate: string;
    label: string;
  };
  summaryCards: {
    purchaseDueToday: number;
    salesExpectedToday: number;
    purchaseDue5Days: number;
    salesExpected5Days: number;
    overduePurchase: number;
    overdueSales: number;
    totalOutstandingPurchase: number;
    totalOutstandingSales: number;
    netExpectedCashFlow: number;
    // Multi-currency details
    purchaseDueTodayByCurrency: Record<string, number>;
    salesExpectedTodayByCurrency: Record<string, number>;
    purchaseDue5DaysByCurrency: Record<string, number>;
    salesExpected5DaysByCurrency: Record<string, number>;
    overduePurchaseByCurrency: Record<string, number>;
    overdueSalesByCurrency: Record<string, number>;
    totalOutPurchaseByCurrency: Record<string, number>;
    totalOutSalesByCurrency: Record<string, number>;
  };
  dailyForecast: DayForecastSummary[];
  purchaseCategories: CategoryBreakdown[];
  salesCategories: CategoryBreakdown[];
  purchaseItems: (PaymentDueTrackingResult & {
    id: string;
    sourceType: "purchase_order" | "local_purchase";
    countryName?: string;
    branchName?: string;
    orderDate?: string;
  })[];
  salesItems: (PaymentDueTrackingResult & {
    id: string;
    sourceType: "sales_order";
    countryName?: string;
    branchName?: string;
    orderDate?: string;
  })[];
  recentHistory: {
    id: string;
    module: "purchase" | "sales";
    billOrInvoiceNumber: string;
    partyName: string;
    paymentKind: string;
    amount: number;
    currency: string;
    paymentDate: string;
    agreedDueDate: string | null;
    status: string;
  }[];
}

export async function getCrmPayablesReceivablesData(params: {
  session: ErpSession;
  referenceDate?: string | null;
  countryId?: string | null;
  cityBranchId?: string | null;
  search?: string | null;
  categoryFilter?: string | null;
}): Promise<CrmPayablesReceivablesPayload> {
  const payload = await withLocalPg(async (sql) => {
    // 1. Establish reference date (Today) and 5-day calendar window (Today -> Day 5 = 6 days total)
    const todayStr = params.referenceDate || new Date().toISOString().slice(0, 10);
    const todayObj = new Date(`${todayStr}T00:00:00Z`);

    const days: string[] = [];
    for (let i = 0; i <= 5; i++) {
      const d = new Date(todayObj.getTime() + i * 24 * 60 * 60 * 1000);
      days.push(d.toISOString().slice(0, 10));
    }
    const end5DayStr = days[5];

    // Format human date range label e.g. "19 Oct 2026 – 24 Oct 2026"
    const fmtShort = (s: string) => {
      const [y, m, d] = s.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${d} ${monthNames[parseInt(m, 10) - 1]} ${y}`;
    };
    const forecastRangeLabel = `${fmtShort(todayStr)} – ${fmtShort(end5DayStr)}`;

    // 2. Permission Scoping
    let allowedCountryIds: string[] = [];
    let allowedBranchIds: string[] = [];
    if (!params.session.isSuperAdmin && !params.session.roles?.includes("super_admin")) {
      allowedCountryIds = params.session.countryIds || [];
      allowedBranchIds = params.session.cityBranchIds || [];
    }

    // 3. Fetch Real Purchase Orders & Local Purchases
    const poRows = await sql`
      SELECT 
        po.id,
        po.purchase_order_no,
        po.currency_code,
        po.order_total,
        po.advance_paid,
        po.remaining_due,
        po.payment_status,
        po.form_data,
        po.created_at,
        c.name as country_name,
        cb.name as branch_name
      FROM public.purchase_orders po
      LEFT JOIN public.countries c ON c.id = po.country_id
      LEFT JOIN public.city_branches cb ON cb.id = po.city_branch_id
      WHERE po.deleted_at IS NULL
        ${params.countryId ? sql`AND po.country_id = ${params.countryId}::uuid` : sql``}
        ${params.cityBranchId ? sql`AND po.city_branch_id = ${params.cityBranchId}::uuid` : sql``}
        ${allowedCountryIds.length > 0 ? sql`AND po.country_id = ANY(${allowedCountryIds}::uuid[])` : sql``}
        ${allowedBranchIds.length > 0 ? sql`AND po.city_branch_id = ANY(${allowedBranchIds}::uuid[])` : sql``}
      ORDER BY po.created_at DESC
      LIMIT 1000;
    `;

    const lpRows = await sql`
      SELECT 
        lp.id,
        lp.manual_bill_no,
        lp.contract_no,
        lp.purchase_currency as currency_code,
        lp.final_cost as order_total,
        lp.advance_amount as advance_paid,
        lp.remaining_balance as remaining_due,
        lp.status as payment_status,
        lp.supplier_name,
        lp.loading_date,
        lp.loading_details,
        lp.advance_percentage,
        lp.created_at,
        c.name as country_name,
        cb.name as branch_name
      FROM public.local_purchases lp
      LEFT JOIN public.countries c ON c.id = lp.country_id
      LEFT JOIN public.city_branches cb ON cb.id = lp.city_branch_id
      WHERE lp.deleted_at IS NULL
        ${params.countryId ? sql`AND lp.country_id = ${params.countryId}::uuid` : sql``}
        ${params.cityBranchId ? sql`AND lp.city_branch_id = ${params.cityBranchId}::uuid` : sql``}
        ${allowedCountryIds.length > 0 ? sql`AND lp.country_id = ANY(${allowedCountryIds}::uuid[])` : sql``}
        ${allowedBranchIds.length > 0 ? sql`AND lp.city_branch_id = ANY(${allowedBranchIds}::uuid[])` : sql``}
      ORDER BY lp.created_at DESC
      LIMIT 1000;
    `;

    // 4. Fetch Real Sales Orders
    const soRows = await sql`
      SELECT 
        so.id,
        so.sales_order_no,
        so.currency_code,
        so.order_total,
        so.paid_amount,
        so.remaining_amount,
        so.payment_status,
        so.customer_name,
        so.form_data,
        so.order_date,
        so.created_at,
        c.name as country_name,
        cb.name as branch_name
      FROM public.sales_orders so
      LEFT JOIN public.countries c ON c.id = so.country_id
      LEFT JOIN public.city_branches cb ON cb.id = so.city_branch_id
      WHERE so.deleted_at IS NULL
        ${params.countryId ? sql`AND so.country_id = ${params.countryId}::uuid` : sql``}
        ${params.cityBranchId ? sql`AND so.city_branch_id = ${params.cityBranchId}::uuid` : sql``}
        ${allowedCountryIds.length > 0 ? sql`AND so.country_id = ANY(${allowedCountryIds}::uuid[])` : sql``}
        ${allowedBranchIds.length > 0 ? sql`AND so.city_branch_id = ANY(${allowedBranchIds}::uuid[])` : sql``}
      ORDER BY so.created_at DESC
      LIMIT 1000;
    `;

    // 5. Process Purchase Items
    const purchaseItems: CrmPayablesReceivablesPayload["purchaseItems"] = [];

    for (const r of poRows as any[]) {
      const calc = calculatePaymentDueTracking({
        module: "purchase",
        record: r,
        referenceDate: todayStr
      });
      purchaseItems.push({
        ...calc,
        id: r.id,
        sourceType: "purchase_order",
        countryName: r.country_name || "—",
        branchName: r.branch_name || "—",
        orderDate: r.created_at ? String(r.created_at).slice(0, 10) : undefined
      });
    }

    for (const r of lpRows as any[]) {
      const calc = calculatePaymentDueTracking({
        module: "purchase",
        record: {
          ...r,
          purchase_order_no: r.manual_bill_no || r.contract_no,
          form_data: {
            form: {
              supplierName: r.supplier_name,
              dueDate: r.loading_details?.dueDate || r.loading_details?.paymentDueDate || null,
              totalAmount: r.order_total,
              advanceAmount: r.advance_paid,
              remainingBalance: r.remaining_due
            }
          }
        },
        referenceDate: todayStr
      });
      purchaseItems.push({
        ...calc,
        id: r.id,
        sourceType: "local_purchase",
        countryName: r.country_name || "—",
        branchName: r.branch_name || "—",
        orderDate: r.created_at ? String(r.created_at).slice(0, 10) : undefined
      });
    }

    // 6. Process Sales Items
    const salesItems: CrmPayablesReceivablesPayload["salesItems"] = [];
    for (const r of soRows as any[]) {
      const calc = calculatePaymentDueTracking({
        module: "sales",
        record: r,
        referenceDate: todayStr
      });
      salesItems.push({
        ...calc,
        id: r.id,
        sourceType: "sales_order",
        countryName: r.country_name || "—",
        branchName: r.branch_name || "—",
        orderDate: r.order_date ? String(r.order_date).slice(0, 10) : (r.created_at ? String(r.created_at).slice(0, 10) : undefined)
      });
    }

    // Filter by search query if provided
    const term = (params.search || "").trim().toLowerCase();
    const filterItem = (item: any) => {
      if (!term) return true;
      return (
        item.billOrInvoiceNumber.toLowerCase().includes(term) ||
        item.supplierOrCustomerName.toLowerCase().includes(term) ||
        (item.countryName && item.countryName.toLowerCase().includes(term)) ||
        (item.branchName && item.branchName.toLowerCase().includes(term)) ||
        item.currency.toLowerCase().includes(term) ||
        item.paymentStatus.toLowerCase().includes(term)
      );
    };

    const filteredPurchaseItems = purchaseItems.filter(filterItem);
    const filteredSalesItems = salesItems.filter(filterItem);

    // 7. Aggregate Summary Cards (9 Totals)
    const addCurrency = (map: Record<string, number>, curr: string, amt: number) => {
      map[curr] = (map[curr] || 0) + amt;
    };

    const summaryCards = {
      purchaseDueToday: 0,
      salesExpectedToday: 0,
      purchaseDue5Days: 0,
      salesExpected5Days: 0,
      overduePurchase: 0,
      overdueSales: 0,
      totalOutstandingPurchase: 0,
      totalOutstandingSales: 0,
      netExpectedCashFlow: 0,
      purchaseDueTodayByCurrency: {} as Record<string, number>,
      salesExpectedTodayByCurrency: {} as Record<string, number>,
      purchaseDue5DaysByCurrency: {} as Record<string, number>,
      salesExpected5DaysByCurrency: {} as Record<string, number>,
      overduePurchaseByCurrency: {} as Record<string, number>,
      overdueSalesByCurrency: {} as Record<string, number>,
      totalOutPurchaseByCurrency: {} as Record<string, number>,
      totalOutSalesByCurrency: {} as Record<string, number>
    };

    // Calculate Purchase Totals
    for (const item of purchaseItems) {
      if (item.outstandingBalance > 0.01) {
        summaryCards.totalOutstandingPurchase += item.outstandingBalance;
        addCurrency(summaryCards.totalOutPurchaseByCurrency, item.currency, item.outstandingBalance);

        if (item.isDueToday) {
          summaryCards.purchaseDueToday += item.outstandingBalance;
          addCurrency(summaryCards.purchaseDueTodayByCurrency, item.currency, item.outstandingBalance);
        }

        if (item.isOverdue) {
          summaryCards.overduePurchase += item.outstandingBalance;
          addCurrency(summaryCards.overduePurchaseByCurrency, item.currency, item.outstandingBalance);
        }

        // Within 5 days forecast (Today to Day 5)
        if (item.agreedDueDate && item.agreedDueDate >= todayStr && item.agreedDueDate <= end5DayStr) {
          summaryCards.purchaseDue5Days += item.outstandingBalance;
          addCurrency(summaryCards.purchaseDue5DaysByCurrency, item.currency, item.outstandingBalance);
        }
      }
    }

    // Calculate Sales Totals
    for (const item of salesItems) {
      if (item.outstandingBalance > 0.01) {
        summaryCards.totalOutstandingSales += item.outstandingBalance;
        addCurrency(summaryCards.totalOutSalesByCurrency, item.currency, item.outstandingBalance);

        if (item.isDueToday) {
          summaryCards.salesExpectedToday += item.outstandingBalance;
          addCurrency(summaryCards.salesExpectedTodayByCurrency, item.currency, item.outstandingBalance);
        }

        if (item.isOverdue) {
          summaryCards.overdueSales += item.outstandingBalance;
          addCurrency(summaryCards.overdueSalesByCurrency, item.currency, item.outstandingBalance);
        }

        // Within 5 days forecast (Today to Day 5)
        if (item.agreedDueDate && item.agreedDueDate >= todayStr && item.agreedDueDate <= end5DayStr) {
          summaryCards.salesExpected5Days += item.outstandingBalance;
          addCurrency(summaryCards.salesExpected5DaysByCurrency, item.currency, item.outstandingBalance);
        }
      }
    }

    // Net expected cash flow over the next 5 days
    summaryCards.netExpectedCashFlow = summaryCards.salesExpected5Days - summaryCards.purchaseDue5Days;

    // 8. Calculate Daily 5-Day Forecast (Today + 5 Days = 6 daily slots)
    const daySlotLabels: DayForecastSummary["dayLabel"][] = [
      "today",
      "tomorrow",
      "day2",
      "day3",
      "day4",
      "day5"
    ];

    const dailyForecast: DayForecastSummary[] = days.map((date, idx) => {
      const dayLabel = daySlotLabels[idx];
      let payableAmount = 0;
      let payableCount = 0;
      let receivableAmount = 0;
      let receivableCount = 0;
      const payablesByCurrency: Record<string, number> = {};
      const receivablesByCurrency: Record<string, number> = {};

      for (const p of purchaseItems) {
        if (p.outstandingBalance > 0.01 && p.agreedDueDate === date) {
          payableAmount += p.outstandingBalance;
          payableCount++;
          payablesByCurrency[p.currency] = (payablesByCurrency[p.currency] || 0) + p.outstandingBalance;
        }
      }

      for (const s of salesItems) {
        if (s.outstandingBalance > 0.01 && s.agreedDueDate === date) {
          receivableAmount += s.outstandingBalance;
          receivableCount++;
          receivablesByCurrency[s.currency] = (receivablesByCurrency[s.currency] || 0) + s.outstandingBalance;
        }
      }

      return {
        date,
        dayLabel,
        payableAmount,
        payableCount,
        receivableAmount,
        receivableCount,
        netCashFlow: receivableAmount - payableAmount,
        payablesByCurrency,
        receivablesByCurrency
      };
    });

    // 9. Category Breakdowns
    const purchaseCatsDef = [
      { key: "advance", label: "Advance Payment" },
      { key: "endorsement", label: "Endorsement Payment" },
      { key: "credit", label: "Credit Payment" },
      { key: "remaining", label: "Remaining Payment" },
      { key: "final", label: "Final Payment" }
    ];

    const purchaseCategories: CategoryBreakdown[] = purchaseCatsDef.map((def) => {
      const items = purchaseItems.filter((i) => i.category === def.key);
      let totalOutstanding = 0;
      let dueToday = 0;
      let overdue = 0;
      let forecast5Days = 0;
      const byCurrency: Record<string, number> = {};

      for (const i of items) {
        if (i.outstandingBalance > 0.01) {
          totalOutstanding += i.outstandingBalance;
          byCurrency[i.currency] = (byCurrency[i.currency] || 0) + i.outstandingBalance;
          if (i.isDueToday) dueToday += i.outstandingBalance;
          if (i.isOverdue) overdue += i.outstandingBalance;
          if (i.agreedDueDate && i.agreedDueDate >= todayStr && i.agreedDueDate <= end5DayStr) {
            forecast5Days += i.outstandingBalance;
          }
        }
      }

      return {
        categoryKey: def.key,
        categoryLabelEn: def.label,
        count: items.length,
        totalOutstanding,
        dueToday,
        overdue,
        forecast5Days,
        byCurrency
      };
    });

    const salesCatsDef = [
      { key: "advance", label: "Advance Payment / Receipt" },
      { key: "credit", label: "Credit Payment / Receipt" },
      { key: "remaining", label: "Remaining Payment / Receipt" },
      { key: "final", label: "Final Payment" }
    ];

    const salesCategories: CategoryBreakdown[] = salesCatsDef.map((def) => {
      const items = salesItems.filter((i) => i.category === def.key);
      let totalOutstanding = 0;
      let dueToday = 0;
      let overdue = 0;
      let forecast5Days = 0;
      const byCurrency: Record<string, number> = {};

      for (const i of items) {
        if (i.outstandingBalance > 0.01) {
          totalOutstanding += i.outstandingBalance;
          byCurrency[i.currency] = (byCurrency[i.currency] || 0) + i.outstandingBalance;
          if (i.isDueToday) dueToday += i.outstandingBalance;
          if (i.isOverdue) overdue += i.outstandingBalance;
          if (i.agreedDueDate && i.agreedDueDate >= todayStr && i.agreedDueDate <= end5DayStr) {
            forecast5Days += i.outstandingBalance;
          }
        }
      }

      return {
        categoryKey: def.key,
        categoryLabelEn: def.label,
        count: items.length,
        totalOutstanding,
        dueToday,
        overdue,
        forecast5Days,
        byCurrency
      };
    });

    // 10. Recent Payment History (for reference without duplicating balances)
    const recentPurchasePayments = await sql`
      SELECT 
        p.id,
        'purchase' as module,
        coalesce(po.purchase_order_no, lp.manual_bill_no, 'PO-REF') as bill_or_inv,
        coalesce(po.form_data->'form'->>'supplierName', lp.supplier_name, 'Supplier') as party_name,
        p.kind as payment_kind,
        p.amount,
        p.currency_code,
        p.entry_date as payment_date,
        coalesce(po.form_data->'form'->>'dueDate', lp.loading_details->>'dueDate') as agreed_due_date,
        p.status
      FROM public.purchase_order_payments p
      LEFT JOIN public.purchase_orders po ON po.id = p.purchase_order_id
      LEFT JOIN public.local_purchases lp ON lp.id = p.local_purchase_id
      WHERE p.deleted_at IS NULL AND p.kind <> 'booking'
      ORDER BY p.created_at DESC
      LIMIT 15;
    `;

    const recentSalesPayments = await sql`
      SELECT 
        p.id,
        'sales' as module,
        so.sales_order_no as bill_or_inv,
        so.customer_name as party_name,
        p.payment_kind,
        p.amount,
        p.currency_code,
        p.payment_date,
        so.form_data->'form'->>'dueDate' as agreed_due_date,
        p.status
      FROM public.sales_order_payments p
      LEFT JOIN public.sales_orders so ON so.id = p.sales_order_id
      WHERE p.deleted_at IS NULL AND p.payment_kind <> 'booking'
      ORDER BY p.created_at DESC
      LIMIT 15;
    `;

    const recentHistory = [
      ...(recentPurchasePayments as any[]).map((r) => ({
        id: r.id,
        module: "purchase" as const,
        billOrInvoiceNumber: r.bill_or_inv,
        partyName: r.party_name,
        paymentKind: r.payment_kind,
        amount: Number(r.amount || 0),
        currency: r.currency_code,
        paymentDate: r.payment_date ? String(r.payment_date).slice(0, 10) : "—",
        agreedDueDate: r.agreed_due_date ? String(r.agreed_due_date).slice(0, 10) : null,
        status: r.status || "Posted"
      })),
      ...(recentSalesPayments as any[]).map((r) => ({
        id: r.id,
        module: "sales" as const,
        billOrInvoiceNumber: r.bill_or_inv,
        partyName: r.party_name,
        paymentKind: r.payment_kind,
        amount: Number(r.amount || 0),
        currency: r.currency_code,
        paymentDate: r.payment_date ? String(r.payment_date).slice(0, 10) : "—",
        agreedDueDate: r.agreed_due_date ? String(r.agreed_due_date).slice(0, 10) : null,
        status: r.status || "Posted"
      }))
    ].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)).slice(0, 20);

    return {
      forecastRange: {
        startDate: todayStr,
        endDate: end5DayStr,
        label: forecastRangeLabel
      },
      summaryCards,
      dailyForecast,
      purchaseCategories,
      salesCategories,
      purchaseItems: filteredPurchaseItems,
      salesItems: filteredSalesItems,
      recentHistory
    };
  });

  if (!payload) {
    throw new Error("Unable to load CRM Payables & Receivables dataset.");
  }
  return payload;
}
