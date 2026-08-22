import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensurePurchaseSchemaAndEnums } from "@/lib/services/purchase-table-manager";
import { withLocalPg } from "@/lib/db/local-postgres";

const querySchema = z.object({
  purchaseOrderNo: z.string().trim().max(140).optional(),
  purchaseAccountNo: z.string().trim().max(140).optional(),
  salesAccountNo: z.string().trim().max(140).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(80),
  q: z.string().optional()
});

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

function getEffectiveScope(session: Awaited<ReturnType<typeof requireErpSession>>, query: z.infer<typeof querySchema>) {
  const scopeType = session.isSuperAdmin
    ? "super_admin"
    : session.cityBranchIds.length
      ? "city_branch"
      : session.countryBranchIds.length
        ? "main_branch"
        : "country";

  return {
    type: scopeType,
    countryIds: query.countryId ? [query.countryId] : session.isSuperAdmin ? [] : session.countryIds,
    countryBranchIds: query.countryBranchId ? [query.countryBranchId] : session.isSuperAdmin ? [] : session.countryBranchIds,
    cityBranchIds: query.cityBranchId ? [query.cityBranchId] : session.isSuperAdmin ? [] : session.cityBranchIds,
    isGlobal: session.isSuperAdmin && !query.countryId && !query.countryBranchId && !query.cityBranchId
  };
}

async function withTimeout<T>(query: PromiseLike<QueryResult<T>>, label: string, ms = 15000): Promise<QueryResult<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(query),
      new Promise<QueryResult<T>>((resolve) => {
        timeout = setTimeout(() => resolve({ data: [], error: { message: `${label} timed out` } }), ms);
      })
    ]);
  } catch (error) {
    return {
      data: [],
      error: { message: error instanceof Error ? error.message : `${label} failed` }
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function normalizeOrder(row: any) {
  let rawData = row.form_data ?? {};
  if (typeof rawData === "string") {
    try {
      rawData = JSON.parse(rawData);
    } catch (_) {}
  }
  const data = typeof rawData === "object" && rawData !== null ? rawData : {};
  const form = data.form ?? {};
  const totals = data.totals ?? {};
  const goods = Array.isArray(data.goodsEntries) && data.goodsEntries.length ? data.goodsEntries : form.goodsName ? [form] : [];
  const purchaseBooking = data.purchaseBooking ?? {};
  const workflow = data.workflow ?? {};
  const quantity = goods.reduce((sum: number, item: any) => sum + Number(item.qtyNo ?? item.quantity ?? 0), 0);
  const totalWeight = goods.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? item.grossWeight ?? 0), 0);
  const systemBillNumber = row.purchase_order_no ?? form.purchaseOrderNo ?? "-";
  const manualBillNumber =
    form.manualBillNumber ??
    form.manual_bill_number ??
    form.billNo ??
    form.purchaseContractNo ??
    row.purchase_contract_no ??
    "-";
  const displayBillNumber = [systemBillNumber, manualBillNumber].filter((value) => value && value !== "-").join(" / ") || "-";
  
  const totalGrossWeight = goods.reduce((sum: number, item: any) => sum + (Number(item.grossWeight) || (Number(item.qtyNo || 0) * Number(item.qtyKgs || 0))), 0) || Number(totals.totalGross ?? 0);
  const totalNetWeight = goods.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? 0), 0) || Number(totals.totalNet ?? 0);
  const purchaseAmount = goods.reduce((sum: number, item: any) => sum + Number(item.totalAmount ?? 0), 0) || Number(totals.grandPrimaryFinal ?? row.order_total ?? 0);
  const finalAmount = goods.reduce((sum: number, item: any) => sum + Number(item.finalAmount ?? 0), 0) || Number(totals.grandFinal ?? row.order_total ?? 0);

  const countryIso = String(row.countries?.iso2 || "").toUpperCase();
  const countryName = String(row.countries?.name || form.countryName || "").toUpperCase();
  const baseCurrency = countryIso === "AE" || countryName.includes("EMIRATES") || countryName.includes("DUBAI")
    ? "AED"
    : countryIso === "PK" || countryName.includes("PAKISTAN")
      ? "PKR"
      : countryIso === "AF" || countryName.includes("AFGHANISTAN")
        ? "AFN"
        : countryIso === "IN" || countryName.includes("INDIA")
          ? "INR"
          : countryIso === "IR" || countryName.includes("IRAN")
            ? "IRR"
            : "USD";
  const purchCurRaw = row.purchase_currency ?? form.currencyType ?? form.purchaseCurrency ?? row.currency_code ?? baseCurrency;
  const purchCur = String(purchCurRaw || baseCurrency).split(" ")[0].toUpperCase();
  const finalCurRaw = row.payment_currency ?? form.secondaryCurrency?.split(" ")[0] ?? form.baseCurrency ?? baseCurrency;
  const finalCur = String(finalCurRaw || baseCurrency).split(" ")[0].toUpperCase();
  const normalizeStatusText = (...values: Array<unknown>) => {
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (!text || text === "-" || text.toLowerCase() === "n/a" || text.toLowerCase() === "na") continue;
      return text;
    }
    return "-";
  };

  const extractedBranchCode = typeof form.branchName === "string" ? (form.branchName.match(/\(([^)]+)\)$/)?.[1] || null) : null;
  const extractedCountryCode = typeof form.countryName === "string" ? (form.countryName.match(/\(([^)]+)\)$/)?.[1] || null) : null;

  const finalBranchName = form.branchName ?? form.purchaseAccountBranch ?? form.salesAccountBranch ?? row.country_branches?.name ?? row.city_branches?.name ?? "-";
  const finalBranchCode = form.branchCode ?? row.country_branches?.code ?? row.city_branches?.code ?? extractedBranchCode ?? "-";
  const finalCountryName = form.branchCountry ?? form.countryName ?? form.destinationCountry ?? form.originCountry ?? row.countries?.name ?? "-";
  const finalCountryCode = form.countryCode ?? row.countries?.iso2 ?? extractedCountryCode ?? "-";

  return {
    id: row.id,
    purchase_order_no: row.purchase_order_no ?? "-",
    purchase_contract_no: row.purchase_contract_no ?? "-",
    purchaseBookingOrderNumber: systemBillNumber,
    systemBillNumber,
    manualBillNumber,
    billNumber: displayBillNumber,
    displayBillNumber,
    referenceNo: displayBillNumber,
    purchaseDate: form.purchaseDate ?? row.created_at,
    bookingDate: row.created_at,
    purchaseAccountName: form.purchaseAccountName ?? "-",
    purchaseAccountNumber: form.purchaseAccountNo ?? "-",
    salesAccountName: form.salesAccountName ?? "-",
    salesAccountNumber: form.salesAccountNo ?? "-",
    supplierName: form.supplierName ?? row.companies?.name ?? "-",
    buyerName: form.customerName ?? "-",
    productName: goods.map((item: any) => item.goodsName).filter(Boolean).join(", ") || "-",
    goodsDescription: goods
      .map((item: any) => [item.goodsName, item.size, item.brand, item.origin, item.hsCode ? `HS ${item.hsCode}` : ""].filter(Boolean).join(" / "))
      .filter(Boolean)
      .join("; ") || "-",
    // Only persisted, verified target-language values are exposed. Unknown target
    // text stays pending instead of being copied from the source language.
    translations: row.form_data?.translations ?? {},
    translationStatus: row.form_data?.translationStatus ?? { status: "pending", fields: {} },
    quantity,
        unit: form.qtyName ?? goods[0]?.qtyName ?? "-",
        totalWeight,
        totalGrossWeight,
        totalNetWeight,
        purchaseAmount,
        finalAmount,
        containerCount: Number(purchaseBooking.totalContainersBooked ?? form.bookedContainerCount ?? 0),
        purchaseRate: Number(goods[0]?.coursePrice ?? goods[0]?.rateOriginal ?? form.coursePrice ?? (quantity > 0 ? purchaseAmount / quantity : 0)),
        totalPurchaseAmount: purchaseAmount,
        currency: purchCur,
        finalCurrency: finalCur,
        exchange_rate: Number(row.exchange_rate ?? form.exchangeRate ?? 1),
        status: normalizeStatusText(workflow.lifecycleStatus, purchaseBooking.loadingStatus, row.payment_status, form.salesStatus, "Draft"),
        currentStep: workflow.currentStepName ?? "Booking Purchase Order",
        nextStep: workflow.nextStepName ?? "Booking Confirm",
        bookingStatus: normalizeStatusText(workflow.bookingStatus, form.salesStatus, "Draft"),
        confirmationStatus: workflow.confirmationStatus ?? (purchaseBooking.totalContainersBooked ? "Booking Confirmed" : "Awaiting Containers"),
        journalStatus: normalizeStatusText(workflow.journalStatus, row.ledger_posting_status, "Draft"),
        paymentStatus: normalizeStatusText(workflow.paymentStatus, row.payment_status, form.paymentType, "pending"),
        containerStatus: workflow.containerStatus ?? purchaseBooking.loadingStatus ?? "Draft",
        inventoryStatus: workflow.inventoryStatus ?? "Inventory Pending",
        deliveryStatus: workflow.deliveryStatus ?? workflow.finalDeliveryStatus ?? "Pending",
        finalDeliveryStatus: workflow.finalDeliveryStatus ?? workflow.deliveryStatus ?? "Pending",
        workflowDates: workflow.workflowDates ?? {},
        workflowTotals: workflow.workflowTotals ?? {},
        workflowAuditTrail: Array.isArray(workflow.workflowAuditTrail) ? workflow.workflowAuditTrail : [],
        workflow,
        form_data: row.form_data ?? {},
        superAdminSerialNo: row.super_admin_serial_number ?? null,
        countrySerialNo: row.country_transaction_serial_number ?? null,
        branchSerialNo: row.branch_transaction_serial_number ?? null,
        advance_paid: Number(row.advance_paid || 0),
        remaining_paid: Number(row.remaining_paid || 0),
        credit_amount: Number(row.credit_amount || 0),
        remaining_due: Number(row.remaining_due || 0),
        is_edited_since_transfer: row.is_edited_since_transfer ?? false,
        branchName: finalBranchName,
        branchCode: finalBranchCode,
        countryName: finalCountryName,
        countryCode: finalCountryCode,
        cityName: form.cityName ?? row.city_branches?.city_name ?? "-",
        cityCode: form.cityCode ?? row.city_branches?.code ?? "-",
        cityBranchId: row.city_branch_id ?? null,
        countryBranchId: row.country_branch_id ?? null,
        createdByName: form.userName ?? "-",
        createdAt: row.created_at,
        ledger_posting_status: row.ledger_posting_status,
        audit: {
          userName: form.userName ?? "-",
          userId: form.userId ?? "-",
          branchCode: finalBranchCode
        }
      };
  }

  export async function GET(request: NextRequest) {
    try {
      const session = await requireErpSession();
      const query = querySchema.parse({
        purchaseOrderNo: request.nextUrl.searchParams.get("purchaseOrderNo") ?? undefined,
        purchaseAccountNo: request.nextUrl.searchParams.get("purchaseAccountNo") ?? undefined,
        salesAccountNo: request.nextUrl.searchParams.get("salesAccountNo") ?? undefined,
        dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
        dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
        countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
        countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
        cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
        limit: request.nextUrl.searchParams.get("limit") ?? undefined,
        q: request.nextUrl.searchParams.get("q") ?? request.nextUrl.searchParams.get("search") ?? undefined
      });

      authorizeApiScope(session, {
        resource: "purchases",
        action: "read",
        countryId: query.countryId ?? null,
        countryBranchId: query.countryBranchId ?? null,
        cityBranchId: query.cityBranchId ?? null
      });
      const effectiveScope = getEffectiveScope(session, query);

      // purchase_orders has scoped RLS and this app's Supabase client is not guaranteed to
      // carry a real service-role key that bypasses RLS on its own - reads through it can
      // silently return an empty array. Prefer a direct Postgres read first (same proven
      // bypass as app/api/erp/purchases/orders/route.ts) whenever DATABASE_URL is present,
      // then feed those rows into the SAME downstream dedup/filter/summary logic below
      // instead of duplicating it. Falls back to the existing path otherwise.
      let viaPgData: any[] | null = null;
      if (process.env.DATABASE_URL) {
        viaPgData = await withLocalPg(async (sql) => {
          const rows = await sql`
            SELECT po.id, po.purchase_order_no, po.purchase_contract_no, po.country_id, po.country_branch_id,
              po.city_branch_id, po.supplier_company_id, po.purchase_currency, po.payment_currency, po.currency_code,
              po.exchange_rate, po.order_total, po.payment_status, po.ledger_posting_status, po.is_edited_since_transfer,
              po.form_data, po.created_at, po.advance_paid, po.remaining_paid, po.credit_amount, po.remaining_due,
              po.super_admin_serial_number, po.country_transaction_serial_number, po.branch_transaction_serial_number,
              CASE WHEN comp.id IS NULL THEN NULL ELSE jsonb_build_object('name', comp.name) END as companies,
              CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name', c.name, 'iso2', c.iso2) END as countries,
              CASE WHEN cb.id IS NULL THEN NULL ELSE jsonb_build_object('name', cb.name, 'code', cb.code) END as country_branches,
              CASE WHEN cib.id IS NULL THEN NULL ELSE jsonb_build_object('name', cib.name, 'code', cib.code, 'city_name', cib.city_name) END as city_branches
            FROM public.purchase_orders po
            LEFT JOIN public.companies comp ON comp.id = po.supplier_company_id
            LEFT JOIN public.countries c ON c.id = po.country_id
            LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
            LEFT JOIN public.city_branches cib ON cib.id = po.city_branch_id
            WHERE po.deleted_at IS NULL
              AND (${query.cityBranchId ? sql`po.city_branch_id = ${query.cityBranchId}::uuid` : sql`true`})
              AND (${!query.cityBranchId && query.countryBranchId ? sql`po.country_branch_id = ${query.countryBranchId}::uuid` : sql`true`})
              AND (${!query.cityBranchId && !query.countryBranchId && query.countryId ? sql`po.country_id = ${query.countryId}::uuid` : sql`true`})
            ORDER BY po.created_at DESC
            LIMIT ${query.limit}
          `;
          return rows as any[];
        });
      }

      const supabase = (() => {
        try {
          return createSupabaseAdminClient() as any;
        } catch {
          return null;
        }
      })();
      let requestQuery = supabase
        ? supabase
            .from("purchase_orders")
            .select(
              "id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, supplier_company_id, companies(name), purchase_currency, payment_currency, currency_code, exchange_rate, order_total, payment_status, ledger_posting_status, is_edited_since_transfer, form_data, created_at, countries(name, iso2), country_branches(name, code), city_branches(name, code, city_name), advance_paid, remaining_paid, credit_amount, remaining_due, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number"
            )
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
        : null;

      if (requestQuery && (query.purchaseOrderNo || query.q)) {
        const rawTerm = query.purchaseOrderNo || query.q || "";
        const term = rawTerm.trim().replace(/[%_]/g, "");
        requestQuery = requestQuery.or(
          `purchase_order_no.ilike.%${term}%,` +
          `purchase_contract_no.ilike.%${term}%,` +
          `form_data->form->>manualBillNo.ilike.%${term}%,` +
          `form_data->form->>manual_bill_no.ilike.%${term}%,` +
          `form_data->form->>billNo.ilike.%${term}%,` +
          `form_data->form->>invoiceNo.ilike.%${term}%,` +
          `form_data->form->>purchaseContractNo.ilike.%${term}%,` +
          `form_data->form->>supplierName.ilike.%${term}%,` +
          `form_data->form->>customerName.ilike.%${term}%,` +
          `form_data->form->>goodsName.ilike.%${term}%,` +
          `form_data->form->>productName.ilike.%${term}%,` +
          `form_data->form->>purchaseAccountName.ilike.%${term}%,` +
          `form_data->form->>salesAccountName.ilike.%${term}%`
        );
      }
      if (requestQuery && query.dateFrom) requestQuery = requestQuery.gte("created_at", `${query.dateFrom}T00:00:00.000Z`);
      if (requestQuery && query.dateTo) {
        // Add a 24 hour buffer to the toDate to account for potential timezone differences
        // between the client generating the date and the Supabase database's local time.
        const toDateObj = new Date(query.dateTo);
        toDateObj.setDate(toDateObj.getDate() + 2); // 2 day buffer to be absolutely safe
        const bufferedDateStr = toDateObj.toISOString().slice(0, 10);
        requestQuery = requestQuery.lte("created_at", `${bufferedDateStr}T23:59:59.999Z`);
      }

      // Enforce strict scope isolation: city branch first, then main branch, then country.
      if (requestQuery && query.cityBranchId) {
        requestQuery = requestQuery.eq("city_branch_id", query.cityBranchId);
      } else if (requestQuery && !session.isSuperAdmin && session.cityBranchIds.length) {
        requestQuery = requestQuery.or(`city_branch_id.in.(${session.cityBranchIds.join(",")}),city_branch_id.is.null`);
        if (session.countryIds.length) {
          requestQuery = requestQuery.in("country_id", session.countryIds);
        }
      } else if (requestQuery && query.countryBranchId) {
        requestQuery = requestQuery.eq("country_branch_id", query.countryBranchId);
      } else if (requestQuery && !session.isSuperAdmin && session.countryBranchIds.length) {
        requestQuery = requestQuery.in("country_branch_id", session.countryBranchIds);
      } else if (requestQuery && query.countryId) {
        requestQuery = requestQuery.eq("country_id", query.countryId);
      } else if (requestQuery && !session.isSuperAdmin) {
        requestQuery = requestQuery.in("country_id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);
      }

      let data: any = viaPgData;
      let dataAlreadyNormalized = false;
      let error: any = null;
      if (!viaPgData && requestQuery) {
        const res = await withTimeout<any>(requestQuery.limit(query.limit), "purchase booking journal report");
        data = res.data;
        error = res.error;
        if (error) {
          const errMsg = String(error.message || error);
          if (errMsg.includes("column") || errMsg.includes("does not exist") || errMsg.includes("schema cache") || errMsg.includes("relation")) {
            await ensurePurchaseSchemaAndEnums();
            const retryRes = await withTimeout<any>(requestQuery.limit(query.limit), "purchase booking journal report");
            data = retryRes.data;
            error = retryRes.error;
          }
        }
      }
      if (viaPgData) {
        let localReports = viaPgData.map(normalizeOrder);
        if (query.purchaseOrderNo || query.q) {
          const rawTerm = query.purchaseOrderNo || query.q || "";
          const term = rawTerm.trim().toLowerCase();
          localReports = localReports.filter((report: any) =>
            [
              report.purchaseOrderNo,
              report.systemBillNumber,
              report.manualBillNumber,
              report.billNumber,
              report.referenceNo,
              report.purchaseAccountNumber,
              report.salesAccountNumber,
              report.supplierName,
              report.buyerName,
              report.productName,
              report.goodsDescription
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(term))
          );
        }
        if (query.dateFrom) {
          const from = new Date(`${query.dateFrom}T00:00:00.000Z`).getTime();
          localReports = localReports.filter((report: any) => {
            const created = new Date(report.createdAt || report.bookingDate || 0).getTime();
            return created >= from;
          });
        }
        if (query.dateTo) {
          const to = new Date(query.dateTo);
          to.setDate(to.getDate() + 2);
          const toMs = to.getTime();
          localReports = localReports.filter((report: any) => {
            const created = new Date(report.createdAt || report.bookingDate || 0).getTime();
            return created <= toMs;
          });
        }
        data = localReports;
        dataAlreadyNormalized = true;
      }
      if (error) {
        return apiOk({
          reports: [],
          selected: null,
          summary: {
            total: 0,
            totalAmount: 0,
            totalQuantity: 0,
            totalContainers: 0
          },
          scope: effectiveScope,
          warning: error.message
        });
      }

      const seenPo = new Set<string>();
      let reports = (dataAlreadyNormalized ? (data ?? []) : (data ?? []).map(normalizeOrder)).filter((report: any) => {
        const poNo = report.purchaseBookingOrderNumber || report.systemBillNumber || report.id;
        if (poNo && poNo !== "-" && poNo !== "PO-0000" && seenPo.has(poNo)) return false;
        if (poNo && poNo !== "-" && poNo !== "PO-0000") seenPo.add(poNo);
        return true;
      });
      if (query.purchaseAccountNo) {
        const term = query.purchaseAccountNo.toLowerCase();
        reports = reports.filter((report: any) => String(report.purchaseAccountNumber).toLowerCase().includes(term));
      }
      if (query.salesAccountNo) {
        const term = query.salesAccountNo.toLowerCase();
        reports = reports.filter((report: any) => String(report.salesAccountNumber).toLowerCase().includes(term));
      }

      // Fetch latest USD rates
      const usdRates: Record<string, number> = {};
      let lastExchangeRateUpdate = null;
      try {
        const ratesData = supabase
          ? (await supabase
              .from("daily_usd_rates")
              .select("currency_code, exchange_rate, updated_at")
              .order("updated_at", { ascending: false })).data
          : await withLocalPg(async (sql) => sql`
              select currency_code, exchange_rate, updated_at
              from public.daily_usd_rates
              order by updated_at desc
            `);
        if (ratesData && ratesData.length > 0) {
          lastExchangeRateUpdate = ratesData[0].updated_at;
          ratesData.forEach((row: any) => {
            if (row.currency_code && !usdRates[row.currency_code]) {
              usdRates[row.currency_code] = Number(row.exchange_rate || 1);
            }
          });
        }
      } catch (e) {
        console.warn("Could not fetch daily USD rates", e);
      }

      // --- Compute live status breakdown ---
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);
      const monthStartIso = firstDayOfMonth.toISOString();

      const statusCounts = { draft: 0, accepted: 0, transferred: 0, completed: 0, cancelled: 0 };
      let thisMonthCreated = 0;
      let thisMonthAmount = 0;
      let thisMonthTransferred = 0;
      let thisMonthCompleted = 0;
      let totalAcceptedAmount = 0;
      let totalTransferredAmount = 0;
      let totalCompletedAmount = 0;
      let totalExchangeRateSum = 0;
      let totalExchangeRateCount = 0;

      const branchIds = new Set<string>();
      const activeBranchIds = new Set<string>();

      for (const r of reports) {
        const st = String(r.status || "Draft");
        const amt = Number(r.totalPurchaseAmount || 0);
        const isThisMonth = r.createdAt && r.createdAt >= monthStartIso;

        // Status counts
        if (/draft/i.test(st)) { statusCounts.draft++; }
        else if (/accept/i.test(st)) { statusCounts.accepted++; totalAcceptedAmount += amt; }
        else if (/transfer/i.test(st)) { statusCounts.transferred++; totalTransferredAmount += amt; }
        else if (/complet/i.test(st)) { statusCounts.completed++; totalCompletedAmount += amt; }
        else if (/cancel/i.test(st)) { statusCounts.cancelled++; }
        else { statusCounts.draft++; } // fallback

        // This month
        if (isThisMonth) {
          thisMonthCreated++;
          thisMonthAmount += amt;
          if (/transfer/i.test(st)) thisMonthTransferred++;
          if (/complet/i.test(st)) thisMonthCompleted++;
        }

        // Branch tracking
        const bid = r.countryBranchId || r.cityBranchId;
        if (bid) {
          branchIds.add(bid);
          if (!/cancel|inactive/i.test(st)) activeBranchIds.add(bid);
        }

        // Exchange rate averaging
        const exr = Number((r as any).exchange_rate || 0);
        if (exr > 0) { totalExchangeRateSum += exr; totalExchangeRateCount++; }
      }

      const avgExchangeRate = totalExchangeRateCount > 0
        ? (totalExchangeRateSum / totalExchangeRateCount).toFixed(4)
        : "1.0000";

      // Fetch company name and financial year from session/data
      const companyName = (data?.[0] as any)?.companies?.name ?? "DGT LLC";
      const now = new Date();
      const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const financialYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

      // Currency from most common in reports
      const currencyFreq: Record<string, number> = {};
      for (const r of reports) {
        const c = String(r.currency || r.finalCurrency || "AED").toUpperCase();
        currencyFreq[c] = (currencyFreq[c] ?? 0) + 1;
      }
      const topCurrency = Object.entries(currencyFreq).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "AED";

      // Query record_translations database table for returned order IDs
      const orderIds = reports.map((r: any) => r.id).filter(Boolean);
      if (orderIds.length > 0) {
        try {
          const recTrans = supabase
            ? (await supabase
                .from("record_translations")
                .select("record_id, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text, language_texts, translation_status, original_language_code")
                .in("record_id", orderIds)
                .eq("record_table", "purchase_orders")
                .is("deleted_at", null)).data
            : await withLocalPg(async (sql) => sql`
                select record_id, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text, language_texts, translation_status, original_language_code
                from public.record_translations
                where record_table = 'purchase_orders'
                  and deleted_at is null
                  and record_id = any(${orderIds})
              `);

          if (recTrans && recTrans.length > 0) {
            const transMapByOrder: Record<string, Record<string, any>> = {};
            for (const row of recTrans) {
              if (!transMapByOrder[row.record_id]) transMapByOrder[row.record_id] = {};
              const fName = row.field_name === "product_name" ? "productName"
                : row.field_name === "goods_description" ? "goodsDescription"
                : row.field_name === "purchase_account_name" ? "purchaseAccountName"
                : row.field_name === "sales_account_name" ? "salesAccountName"
                : row.field_name === "supplier_name" ? "supplierName"
                : row.field_name === "buyer_name" ? "buyerName"
                : row.field_name === "remarks" ? "remarks"
                : row.field_name === "branch_name" ? "branchName"
                : row.field_name === "country_name" ? "countryName"
                : row.field_name;

              const tObj = row.language_texts || {
                en: row.english_text,
                ur: row.urdu_text,
                ar: row.arabic_text,
                fa: row.persian_text,
                ps: row.pashto_text
              };
              transMapByOrder[row.record_id][fName] = tObj;
            }

            for (const report of reports) {
              if (transMapByOrder[report.id]) {
                report.translations = {
                  ...report.translations,
                  ...transMapByOrder[report.id]
                };
              }
            }
          }
        } catch (dbTransErr) {
          console.warn("Non-fatal: Error querying record_translations:", dbTransErr);
        }
      }

      return apiOk({
        reports,
        selected: reports[0] ?? null,
        summary: {
          total: reports.length,
          totalAmount: reports.reduce((sum: number, report: any) => sum + Number(report.totalPurchaseAmount || 0), 0),
          totalQuantity: reports.reduce((sum: number, report: any) => sum + Number(report.quantity || 0), 0),
          totalContainers: reports.reduce((sum: number, report: any) => sum + Number(report.containerCount || 0), 0),
          // --- Status breakdown (live) ---
          draft: statusCounts.draft,
          accepted: statusCounts.accepted,
          transferred: statusCounts.transferred,
          completed: statusCounts.completed,
          cancelled: statusCounts.cancelled,
          // --- Amount breakdown by status ---
          acceptedAmount: totalAcceptedAmount,
          transferredAmount: totalTransferredAmount,
          completedAmount: totalCompletedAmount,
          // --- Branches ---
          totalBranches: branchIds.size,
          activeBranches: activeBranchIds.size,
          inactiveBranches: Math.max(0, branchIds.size - activeBranchIds.size),
          // --- This Month ---
          thisMonth: {
            created: thisMonthCreated,
            amount: thisMonthAmount,
            transferred: thisMonthTransferred,
            completed: thisMonthCompleted
          },
          // --- Quick Info ---
          quickInfo: {
            currency: topCurrency,
            exchangeRate: avgExchangeRate,
            company: companyName,
            financialYear
          }
        },
        usdRates,
        lastExchangeRateUpdate,
        scope: effectiveScope
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
