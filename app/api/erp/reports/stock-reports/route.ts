import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  countryId: z.string().uuid().optional().or(z.literal("all")),
  branchId: z.string().uuid().optional().or(z.literal("all")),
  salesmanId: z.string().uuid().optional().or(z.literal("all")),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const { searchParams } = request.nextUrl;
    const parsed = querySchema.parse({
      countryId: searchParams.get("countryId") ?? "all",
      branchId: searchParams.get("branchId") ?? "all",
      salesmanId: searchParams.get("salesmanId") ?? "all",
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    const admin = createSupabaseAdminClient();

    // Query active profiles to build salesman ID map
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .is("deleted_at", null);

    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) ?? []);

    // Query real purchase orders
    let query = admin
      .from("purchase_orders")
      .select(`
        id,
        purchase_order_no,
        purchase_contract_no,
        created_at,
        order_total,
        advance_paid,
        remaining_paid,
        remaining_due,
        currency_code,
        purchase_currency,
        exchange_rate,
        country_id,
        city_branch_id,
        form_data,
        created_by,
        countries!purchase_orders_country_id_fkey(id, name),
        city_branches!purchase_orders_city_branch_id_fkey(id, name)
      `)
      .eq("ledger_posting_status", "posted")
      .is("deleted_at", null);

    const reportScope = resolveReportScope(session);
    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      reportScope,
      parsed.countryId && parsed.countryId !== "all" ? parsed.countryId : null,
      parsed.branchId && parsed.branchId !== "all" ? parsed.branchId : null
    );

    if (effectiveCountryId) {
      query = query.eq("country_id", effectiveCountryId);
    }
    if (effectiveBranchId) {
      query = query.eq("city_branch_id", effectiveBranchId);
    }
    if (parsed.salesmanId && parsed.salesmanId !== "all") {
      query = query.eq("created_by", parsed.salesmanId);
    }

    const { data: dbData, error } = await query;
    if (error) throw error;

    interface GoodsEntry {
      netWeight?: string | number;
      net_weight?: string | number;
      grossWeight?: string | number;
      gross_weight?: string | number;
      tareWeight?: string | number;
      emptyWeight?: string | number;
      qtyNo?: string | number;
      quantity?: string | number;
      quantityName?: string;
      goodsName?: string;
    }

    interface FormPayload {
      form?: {
        netWeight?: string | number;
        net_weight?: string | number;
        grossWeight?: string | number;
        tareWeight?: string | number;
        qtyNo?: string | number;
        quantity?: string | number;
        quantityName?: string;
        userName?: string;
        purchaseDate?: string;
        goodsName?: string;
        supplierName?: string;
        purchaseAccountName?: string;
        salesAccountName?: string;
        journalSerialNo?: string;
        countrySerialNo?: string;
        branchSerialNo?: string;
        invoicePaidAmount?: string | number;
      };
      goodsEntries?: GoodsEntry[];
    }

    // Map database data into the report format
    const dbReportRecords = (dbData ?? []).map(row => {
      const fd = (row.form_data as unknown as FormPayload) ?? {};
      const form = fd.form ?? {};
      const goods = fd.goodsEntries ?? [];

      const netWeight = goods.reduce((sum: number, item: GoodsEntry) => sum + Number(item.netWeight || item.net_weight || 0), 0) || Number(form.netWeight || form.net_weight || 0);
      const grossWeight = goods.reduce((sum: number, item: GoodsEntry) => sum + Number(item.grossWeight || item.gross_weight || 0), 0) || Number(form.grossWeight || 0);
      const tareWeight = goods.reduce((sum: number, item: GoodsEntry) => sum + Number(item.tareWeight || item.emptyWeight || 0), 0) || Number(form.tareWeight || 0);
      const emptyKgs = tareWeight || Math.max(0, grossWeight - netWeight);
      const dc = goods.reduce((sum: number, item: GoodsEntry) => sum + Number(item.qtyNo || item.quantity || 0), 0) || Number(form.qtyNo || form.quantity || 0);

      const purchaseAmount = Number(row.order_total || 0);
      const purchasePayment = Number(row.advance_paid || 0) + Number(row.remaining_paid || 0);

      // Invoice payment comes from the record only — never a fabricated percentage.
      const invoicePayment = Number((row as any).invoice_paid_amount ?? form.invoicePaidAmount ?? 0);
      const remainingPayment = Number(row.remaining_due ?? Math.max(0, purchaseAmount - purchasePayment));

      const salesmanName = (row.created_by ? profileMap.get(row.created_by) : null) || String(form.userName || "—");

      const countriesData = row.countries as unknown as { name: string } | null;
      const branchesData = row.city_branches as unknown as { name: string } | null;
      const countryName = countriesData?.name || "—";
      const branchName = branchesData?.name || "—";

      // Currency + FX from the actual purchase order, never guessed from the country name.
      const pCurrency = String((row as any).currency_code || (row as any).purchase_currency || form.quantityName || "").toUpperCase() || "";
      const exRate = Number((row as any).exchange_rate || 0);
      const pCurrencyAdv = exRate ? Math.round(Number(row.advance_paid || 0) / exRate) : 0;
      const pCurrencyRem = exRate ? Math.round(remainingPayment / exRate) : 0;

      return {
        id: row.id,
        purchase_order_no: row.purchase_order_no,
        purchase_contract_no: row.purchase_contract_no || "—",
        date: String(form.purchaseDate || row.created_at || "").slice(0, 10),
        journalSerial: form.journalSerialNo || "—",
        countrySerial: form.countrySerialNo || "—",
        branchSerial: form.branchSerialNo || "—",
        purchaseAccount: form.purchaseAccountName || "—",
        salesAccount: form.salesAccountName || "—",
        salesman: salesmanName,
        salesmanId: row.created_by,
        country: countryName,
        countryId: row.country_id || "",
        branch: branchName,
        branchId: row.city_branch_id || "",
        goodsName: goods.map((g: GoodsEntry) => g.goodsName).filter(Boolean).join(", ") || String(form.goodsName || "—"),
        quantity: dc,
        qtyNumber: dc ? String(dc) : "—",
        qtyName: goods[0]?.quantityName || form.quantityName || "",
        grossWeight: grossWeight || 0,
        emptyKgs: emptyKgs || 0,
        netWeight: netWeight || 0,
        dc,
        purchaseCurrency: pCurrency,
        purchaseCurrencyAdvance: pCurrencyAdv,
        purchaseCurrencyRemaining: pCurrencyRem,
        finalCurrencyTotal: purchaseAmount,
        finalCurrencyAdvance: purchasePayment,
        finalCurrencyRemaining: remainingPayment,
        purchaseAmount,
        purchasePayment,
        invoicePayment,
        remainingPayment,
        supplier: String(form.supplierName || "—")
      };
    });

    // Real purchase-order data only — never fabricated / sample rows.
    const finalRecords = dbReportRecords;

    // Compute aggregations
    const summary = finalRecords.reduce(
      (acc, r) => {
        acc.totalNetWeight += r.netWeight;
        acc.totalDC += r.dc;
        acc.totalPurchaseAmount += r.purchaseAmount;
        acc.totalPurchasePayment += r.purchasePayment;
        acc.totalInvoicePayment += r.invoicePayment;
        acc.remainingPayment += r.remainingPayment;
        acc.totalBills += 1;
        return acc;
      },
      {
        totalNetWeight: 0,
        totalDC: 0,
        totalPurchaseAmount: 0,
        totalPurchasePayment: 0,
        totalInvoicePayment: 0,
        remainingPayment: 0,
        totalBills: 0,
      }
    );

    return apiOk({
      records: finalRecords,
      summary,
      filters: parsed,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("STOCK_REPORTS_API_ERROR:", error);
    return handleApiError(error);
  }
}
