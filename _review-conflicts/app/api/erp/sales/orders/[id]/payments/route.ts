import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: uuidSchema
});

const salesOrderPaymentPostSchema = z.object({
  kind: z.string(),
  entryDate: z.string(),
  amount: z.coerce.number().min(0.01),
  currencyCode: z.string(),
  exchangeRate: z.coerce.number().min(0.000001),
  debitLedgerId: z.string(),
  creditLedgerId: z.string(),
  referenceNo: z.string().optional().nullable(),
  narration: z.string().optional().nullable(),
  typeDetails: z.object({
    sourceRecordId: z.string().optional().nullable()
  }).optional().nullable()
});

function buildSalesTrace(orderRow: any, fallbackReference?: string | null) {
  const data = orderRow.form_data ?? {};
  const form = data.form ?? {};
  const systemBillNumber = String(orderRow.sales_order_no || form.salesOrderNo || "").trim();
  const manualBillNumber = String(
    form.manualBillNumber ||
      form.manual_bill_number ||
      form.billNo ||
      form.salesContractNo ||
      orderRow.sales_contract_no ||
      fallbackReference ||
      ""
  ).trim();
  const partyName = String(
    form.purchaseAccountName || form.customerName || form.salesAccountName || "Sales Party"
  ).trim();
  const countryName = String(form.branchCountry || form.countryName || "").trim();
  const branchName = String(form.branchName || form.cityBranchName || "").trim();
  const referenceNo = [systemBillNumber, manualBillNumber].filter(Boolean).join(" / ") || fallbackReference || null;
  const narrationPrefix = [
    systemBillNumber ? "System Bill: " + systemBillNumber : null,
    manualBillNumber ? "Manual Bill: " + manualBillNumber : null,
    partyName ? "Party: " + partyName : null,
    countryName ? "Country: " + countryName : null,
    branchName ? "Branch: " + branchName : null
  ].filter(Boolean).join(" | ");

  return { systemBillNumber, manualBillNumber, partyName, countryName, branchName, referenceNo, narrationPrefix };
}

function formatAuditNumber(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function buildSalesGoodsAuditRemark(orderRow: any, fallbackReference?: string | null) {
  const data = orderRow.form_data ?? {};
  const form = data.form ?? {};
  const totals = data.totals ?? {};
  const goodsEntries = Array.isArray(data.goodsEntries) && data.goodsEntries.length
    ? data.goodsEntries
    : form.goodsName
      ? [form]
      : [];
  const billNo = String(form.manualBillNumber || form.manual_bill_number || form.billNo || form.salesContractNo || orderRow.sales_contract_no || orderRow.sales_order_no || fallbackReference || "Sales Bill").trim();
  const goodsName = goodsEntries.map((item: any) => item.goodsName || item.name || item.productName).filter(Boolean).join(", ") || form.goodsName || "Sales Goods";
  const totalQty = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.qtyNo ?? item.quantity ?? item.qty ?? 0), 0) || Number(form.qtyNo || form.quantity || 0);
  const unit = String(goodsEntries[0]?.qtyName || goodsEntries[0]?.unit || form.qtyName || form.quantityUnit || "").trim();
  const grossWeight = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.grossWeight ?? item.gross_weight ?? 0), 0) || Number(form.grossWeight || totals.totalGross || 0);
  const netWeight = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? item.net_weight ?? 0), 0) || Number(form.netWeight || totals.totalNet || 0);
  const salesAmount = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.totalAmount ?? item.salesAmount ?? 0), 0) || Number(form.totalAmount || totals.grandPrimaryFinal || orderRow.order_total || 0);
  const salesCurrency = String(goodsEntries[0]?.salesCurrency || goodsEntries[0]?.pricingCurrency || form.salesCurrency || form.pricingCurrency || orderRow.currency_code || "USD").toUpperCase();
  return `Sales Bill: ${billNo} | Goods: ${goodsName} | Qty: ${formatAuditNumber(totalQty)}${unit ? ` ${unit}` : ""} | Gross WT: ${formatAuditNumber(grossWeight)} KG | Net WT: ${formatAuditNumber(netWeight)} KG | Sales Price: ${formatAuditNumber(salesAmount)} ${salesCurrency}`;
}

async function assertLedgerMatchesSalesScope(supabase: any, ledgerId: string, orderRow: any, label: string) {
  const { data: ledger, error } = await supabase
    .from("ledgers")
    .select("id, code, name, country_id, country_branch_id, city_branch_id")
    .eq("id", ledgerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !ledger) {
    throw new Error(label + " ledger was not found.");
  }

  if (orderRow.country_id && ledger.country_id && ledger.country_id !== orderRow.country_id) {
    throw new Error(label + " ledger belongs to a different country and cannot be used for this sales booking.");
  }

  if (orderRow.city_branch_id && ledger.city_branch_id && ledger.city_branch_id !== orderRow.city_branch_id) {
    throw new Error(label + " ledger belongs to a different city branch and cannot be used for this sales booking.");
  }

  if (!orderRow.city_branch_id && orderRow.country_branch_id && ledger.country_branch_id && ledger.country_branch_id !== orderRow.country_branch_id) {
    throw new Error(label + " ledger belongs to a different main branch and cannot be used for this sales booking.");
  }

  return ledger;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);

    const supabase = await createApiSupabaseClient();
    const order = await requireSupabaseData(
      supabase
        .from("sales_orders")
        .select("id, sales_order_no, sales_contract_no, country_id, country_branch_id, city_branch_id, currency_code, exchange_rate, order_total, paid_amount, remaining_amount, form_data, ledger_posting_status, payment_status")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "sales",
      action: "read",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      city_branch_id: (order as any)?.city_branch_id ?? null
    });

    const rows = await requireSupabaseData(
      supabase
        .from("sales_order_payments")
        .select(`
          id, sales_order_id, payment_kind, payment_date, amount, currency_code, exchange_rate, 
          roznamcha_entry_id, status, remarks, created_at,
          roznamcha_entries (
            id,
            super_admin_serial_number,
            country_transaction_serial_number,
            branch_transaction_serial_number,
            profiles!roznamcha_entries_created_by_fkey ( full_name )
          )
        `)
        .eq("sales_order_id", params.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200)
    );

    // Format fields to match UI expectations
    const mapped = (rows ?? []).map((row: any) => ({
      ...row,
      kind: row.payment_kind,
      entry_date: row.payment_date,
      reference_no: row.remarks,
      narration: row.remarks
    }));

    return apiOk({ payments: mapped, limit: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const body = salesOrderPaymentPostSchema.parse(await request.json());

    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured. Sales posting requires a real Supabase login.");
    }

    const supabase = await createApiSupabaseClient();
    const order = await requireSupabaseData(
      supabase
        .from("sales_orders")
        .select("id, sales_order_no, sales_contract_no, country_id, country_branch_id, city_branch_id, currency_code, exchange_rate, order_total, paid_amount, remaining_amount, form_data, ledger_posting_status, payment_status")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "sales",
      action: "post",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null
    });

    const orderRow = order as any;
    const form = orderRow.form_data?.form || {};
    let exchangeRate = Number(orderRow.exchange_rate || 0);
    if (exchangeRate <= 1) {
      exchangeRate = Number(form.exchangeRate || 1);
    }
    if (exchangeRate <= 0) exchangeRate = 1;

    const orderTotalUSD = Number(orderRow.order_total || 0) / exchangeRate;
    const paidAmountUSD = Number(orderRow.paid_amount || 0);
    const remainingAmountUSD = Number(orderRow.remaining_amount || 0);

    const goodsEntries = Array.isArray(orderRow.form_data?.goodsEntries) ? orderRow.form_data.goodsEntries : [];
    const formTotalUSD = goodsEntries.length
      ? goodsEntries.reduce((sum: number, item: any) => sum + Number(item.totalAmount || 0), 0)
      : Number(form.totalAmount || orderTotalUSD);
      
    const advancePercent = Number(form.advancePercent || 0);
    const requiredAdvanceUSD = advancePercent > 0 ? (formTotalUSD * advancePercent) / 100 : 0;
    const remainingAdvanceUSD = Math.max(0, requiredAdvanceUSD - paidAmountUSD);
    const tolerance = 0.01;

    if (body.debitLedgerId === body.creditLedgerId) {
      throw new Error("Debit and credit ledgers must be different for sales payment posting.");
    }

    const debitLedger = await assertLedgerMatchesSalesScope(supabase, body.debitLedgerId, orderRow, "Debit");
    const creditLedger = await assertLedgerMatchesSalesScope(supabase, body.creditLedgerId, orderRow, "Credit");
    
    const trace = buildSalesTrace(orderRow, body.referenceNo ?? null);
    const postingReferenceNo = body.referenceNo?.trim() || trace.referenceNo;
    const goodsAuditRemark = buildSalesGoodsAuditRemark(orderRow, postingReferenceNo);
    const postingNarration = [
      goodsAuditRemark,
      body.narration?.trim() ? "Notes: " + body.narration.trim() : null,
      trace.narrationPrefix,
      "Payment Currency: " + body.currencyCode,
      "Exchange Rate: " + body.exchangeRate,
      "Receipt Amount: " + body.amount
    ].filter(Boolean).join(" | ");

    const isForeignCurrency = body.currencyCode?.toUpperCase() === (orderRow.currency_code?.toUpperCase() || "USD");
    const bodyAmountUSD = isForeignCurrency ? Number(body.amount) : Number(body.amount) / Number(body.exchangeRate || 1);

    if (body.kind === "advance" && advancePercent > 0) {
      if (remainingAdvanceUSD <= tolerance) {
        throw new Error(`Advance payment is already fully received (Required: ${requiredAdvanceUSD.toFixed(2)}, Paid: ${paidAmountUSD.toFixed(2)}). Duplicate posting is not allowed.`);
      }
      if (bodyAmountUSD > remainingAdvanceUSD + tolerance) {
        throw new Error(`Advance receipt amount cannot exceed remaining advance balance (${remainingAdvanceUSD.toFixed(2)}).`);
      }
    }

    if ((body.kind === "remaining" || body.kind === "credit") && remainingAmountUSD <= tolerance) {
      throw new Error("This sales order has no remaining receivable balance. Duplicate posting is not allowed.");
    }

    if ((body.kind === "remaining" || body.kind === "credit") && bodyAmountUSD > remainingAmountUSD + tolerance) {
      throw new Error(`Receipt amount cannot exceed remaining receivable balance (${remainingAmountUSD.toFixed(2)}).`);
    }

    const effectiveRoznamchaExchangeRate = isForeignCurrency ? Number(body.exchangeRate || 1) : 1;

    // Transaction-safe posting via RPC using the wrapper post_sales_booking_transfer
    const { data, error } = await supabase.rpc("post_sales_booking_transfer", {
      p_actor_id: session.userId,
      p_sales_order_id: params.id,
      p_payment_kind: body.kind,
      p_entry_date: body.entryDate,
      p_amount: body.amount,
      p_currency_code: body.currencyCode,
      p_exchange_rate: effectiveRoznamchaExchangeRate,
      p_debit_ledger_id: body.debitLedgerId,
      p_credit_ledger_id: body.creditLedgerId,
      p_reference_no: postingReferenceNo,
      p_narration: postingNarration || null
    });

    if (error) {
      throw new Error(error.message);
    }

    const paymentId = data as string;

    // Retrieve ledger entry to extract serial numbers and profile information
    const paymentRecord = await requireSupabaseData(
      supabase
        .from("sales_order_payments")
        .select("id, sales_order_id, payment_kind, amount, currency_code, exchange_rate, roznamcha_entry_id, status")
        .eq("id", paymentId)
        .eq("sales_order_id", params.id)
        .maybeSingle()
    ) as any;

    let rozType = "super_admin";
    if (orderRow.city_branch_id) rozType = "branch";
    else if (orderRow.country_branch_id || orderRow.country_id) rozType = "country";

    const adminSupabase = createSupabaseAdminClient();
    await adminSupabase.from("roznamcha_entries").update({
      country_id: orderRow.country_id || null,
      country_branch_id: orderRow.country_branch_id || null,
      city_branch_id: orderRow.city_branch_id || null,
      type: rozType
    }).eq("id", paymentRecord.roznamcha_entry_id);

    const journalRecord = await requireSupabaseData(
      supabase
        .from("roznamcha_entries")
        .select("id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number")
        .eq("id", paymentRecord.roznamcha_entry_id)
        .maybeSingle()
    ) as any;

    const postedWorkflow = {
      ...(orderRow.form_data?.workflow || {}),
      invoiceStatus: "available",
      paymentStatus: "posted",
      journalStatus: "posted",
      ledgerStatus: "posted",
      currentStep: "payment_posted",
      lastPaymentId: paymentId,
      lastRoznamchaEntryId: paymentRecord.roznamcha_entry_id,
      lastPaymentPostedAt: new Date().toISOString(),
      sourceModule: "sales",
      sourceTransactionType: "sales_payment",
      systemBillNumber: trace.systemBillNumber,
      manualBillNumber: trace.manualBillNumber,
      partyName: trace.partyName,
      referenceNo: postingReferenceNo
    };

    // Update order row details
    await requireSupabaseData(
      supabase
        .from("sales_orders")
        .update({
          form_data: {
            ...(orderRow.form_data || {}),
            workflow: postedWorkflow,
            lastPaymentTrace: {
              paymentId,
              roznamchaEntryId: paymentRecord.roznamcha_entry_id,
              debitLedgerId: body.debitLedgerId,
              creditLedgerId: body.creditLedgerId,
              originalCurrencyCode: body.currencyCode,
              currencyName: body.currencyCode,
              exchangeRate: body.exchangeRate,
              superAdminSerialNumber: journalRecord.super_admin_serial_number,
              countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
              branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number,
              systemBillNumber: trace.systemBillNumber,
              manualBillNumber: trace.manualBillNumber,
              partyName: trace.partyName,
              referenceNo: postingReferenceNo,
              narration: postingNarration,
              debitLedgerCode: debitLedger.code,
              creditLedgerCode: creditLedger.code
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", params.id)
        .select("id")
        .single()
    );

    return apiCreated({
      paymentId,
      roznamchaEntryId: paymentRecord.roznamcha_entry_id,
      superAdminSerialNumber: journalRecord.super_admin_serial_number,
      countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
      branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number
    });
  } catch (error) {
    console.error("SALES_PAYMENT_POST_ERROR:", error);
    return handleApiError(error);
  }
}
