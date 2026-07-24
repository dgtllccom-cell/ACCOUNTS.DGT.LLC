import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensurePurchaseSchemaAndEnums } from "@/lib/services/purchase-table-manager";

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
  const data = row.form_data ?? {};
  const form = data.form ?? {};
  const totals = data.totals ?? {};
  const goods = Array.isArray(data.goodsEntries) && data.goodsEntries.length ? data.goodsEntries : form.goodsName ? [form] : [];
  const purchaseBooking = data.purchaseBooking ?? {};
  const workflow = data.workflow ?? {};
  const quantity = goods.reduce((sum: number, item: any) => sum + Number(item.qtyNo ?? item.quantity ?? 0), 0);
  const totalWeight = goods.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? item.grossWeight ?? 0), 0);
  const totalAmount = goods.reduce((sum: number, item: any) => sum + Number(item.totalAmount ?? 0), 0) || Number(totals.grandPrimaryFinal ?? row.order_total ?? 0);
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
        status: workflow.lifecycleStatus ?? purchaseBooking.loadingStatus ?? row.payment_status ?? form.salesStatus ?? "Draft",
        currentStep: workflow.currentStepName ?? "Booking Purchase Order",
        nextStep: workflow.nextStepName ?? "Booking Confirm",
        bookingStatus: workflow.bookingStatus ?? form.salesStatus ?? "Draft",
        confirmationStatus: workflow.confirmationStatus ?? (purchaseBooking.totalContainersBooked ? "Booking Confirmed" : "Awaiting Containers"),
        journalStatus: workflow.journalStatus ?? row.ledger_posting_status ?? "Draft",
        paymentStatus: workflow.paymentStatus ?? row.payment_status ?? form.paymentType ?? "-",
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

      const supabase = createSupabaseAdminClient() as any;
      let requestQuery = supabase
        .from("purchase_orders")
        .select(
          "id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, supplier_company_id, companies(name), purchase_currency, payment_currency, currency_code, exchange_rate, order_total, payment_status, ledger_posting_status, is_edited_since_transfer, form_data, created_at, countries(name, iso2), country_branches(name, code), city_branches(name, code, city_name), advance_paid, remaining_paid, credit_amount, remaining_due, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (query.purchaseOrderNo || query.q) {
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
      if (query.dateFrom) requestQuery = requestQuery.gte("created_at", `${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) {
        // Add a 24 hour buffer to the toDate to account for potential timezone differences
        // between the client generating the date and the Supabase database's local time.
        const toDateObj = new Date(query.dateTo);
        toDateObj.setDate(toDateObj.getDate() + 2); // 2 day buffer to be absolutely safe
        const bufferedDateStr = toDateObj.toISOString().slice(0, 10);
        requestQuery = requestQuery.lte("created_at", `${bufferedDateStr}T23:59:59.999Z`);
      }

      // Enforce strict scope isolation: city branch first, then main branch, then country.
      if (query.cityBranchId) {
        requestQuery = requestQuery.eq("city_branch_id", query.cityBranchId);
      } else if (!session.isSuperAdmin && session.cityBranchIds.length) {
        requestQuery = requestQuery.or(`city_branch_id.in.(${session.cityBranchIds.join(",")}),city_branch_id.is.null`);
        if (session.countryIds.length) {
          requestQuery = requestQuery.in("country_id", session.countryIds);
        }
      } else if (query.countryBranchId) {
        requestQuery = requestQuery.eq("country_branch_id", query.countryBranchId);
      } else if (!session.isSuperAdmin && session.countryBranchIds.length) {
        requestQuery = requestQuery.in("country_branch_id", session.countryBranchIds);
      } else if (query.countryId) {
        requestQuery = requestQuery.eq("country_id", query.countryId);
      } else if (!session.isSuperAdmin) {
        requestQuery = requestQuery.in("country_id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);
      }

      let { data, error } = await withTimeout<any>(requestQuery.limit(query.limit), "purchase booking journal report");
      if (error) {
        const errMsg = String(error.message || error);
        if (errMsg.includes("column") || errMsg.includes("does not exist") || errMsg.includes("schema cache") || errMsg.includes("relation")) {
          await ensurePurchaseSchemaAndEnums();
          const retryRes = await withTimeout<any>(requestQuery.limit(query.limit), "purchase booking journal report");
          data = retryRes.data;
          error = retryRes.error;
        }
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
      let reports = (data ?? []).map(normalizeOrder).filter((report: any) => {
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
      let usdRates: Record<string, number> = {};
      let lastExchangeRateUpdate = null;
      try {
        const { data: ratesData } = await supabase
          .from("daily_usd_rates")
          .select("currency_code, exchange_rate, updated_at")
          .order("updated_at", { ascending: false });
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

      return apiOk({
        reports,
        selected: reports[0] ?? null,
        summary: {
          total: reports.length,
          totalAmount: reports.reduce((sum: number, report: any) => sum + Number(report.totalPurchaseAmount || 0), 0),
          totalQuantity: reports.reduce((sum: number, report: any) => sum + Number(report.quantity || 0), 0),
          totalContainers: reports.reduce((sum: number, report: any) => sum + Number(report.containerCount || 0), 0)
        },
        usdRates,
        lastExchangeRateUpdate,
        scope: effectiveScope
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
