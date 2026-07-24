import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";

const paramsSchema = z.object({
  id: uuidSchema
});

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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const body = await request.json().catch(() => ({}));

    const supabase = await createApiSupabaseClient();
    const order = await requireSupabaseData(
      supabase
        .from("sales_orders")
        .select("id, country_id, country_branch_id, city_branch_id, order_total, currency_code, exchange_rate, sales_order_no, sales_contract_no, form_data, ledger_posting_status, payment_status, is_edited_since_transfer")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "sales",
      action: "post",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null,
    });

    const orderRow = order as any;
    const formData = orderRow.form_data || {};
    const form = formData.form || {};
    const workflow = formData.workflow || {};

    const alreadyTransferred =
      orderRow.ledger_posting_status === "transferred" ||
      orderRow.ledger_posting_status === "posted" ||
      workflow.transferStatus === "transferred" ||
      Boolean(form.transferAudit);

    if (alreadyTransferred && !orderRow.is_edited_since_transfer) {
      return handleApiError(new Error("This booking has already been transferred to Sales Transfer Payment and cannot be transferred again."));
    }

    const rawTotal = String(orderRow.order_total || formData.totals?.grandFinal || "0").replace(/,/g, "");
    const totalSalesAmount = Number(rawTotal);
    if (!Number.isFinite(totalSalesAmount) || totalSalesAmount <= 0) {
      throw new Error("Sales order total must be a valid number greater than zero to transfer.");
    }

    if (!form.purchaseAccountNo) {
      throw new Error("Customer Account is required before transfer to payment.");
    }
    if (!form.salesAccountNo) {
      throw new Error("Sales Account is required before transfer to payment.");
    }

    const systemBillNumber = String(orderRow.sales_order_no || form.salesOrderNo || "").trim();
    const manualBillNumber = String(
      form.manualBillNumber || form.manual_bill_number || form.billNo || form.salesContractNo || orderRow.sales_contract_no || ""
    ).trim();
    const partyName = String(form.purchaseAccountName || form.customerName || form.salesAccountName || "Sales Party").trim();
    const referenceNo = [systemBillNumber, manualBillNumber].filter(Boolean).join(" / ") || systemBillNumber || manualBillNumber || null;
    const now = new Date().toISOString();

    const updatedFormData = {
      ...formData,
      form: {
        ...form,
        transferAudit: {
          userId: session.userId,
          userName: session.fullName || session.email || "User",
          transferDate: now,
          transferOnly: true,
          systemBillNumber,
          manualBillNumber,
          referenceNo,
          remarks: typeof body?.remarks === "string" ? body.remarks : null
        }
      },
      workflow: {
        ...workflow,
        transferStatus: "transferred",
        invoiceStatus: workflow.invoiceStatus || "available",
        paymentStatus: "pending",
        journalStatus: "posted",
        ledgerStatus: "posted",
        currentStep: "sales_transfer_payment",
        currentStepName: "Sales Transfer Payment",
        nextStepName: "Post Payment",
        transferredAt: now,
        transferredBy: session.userId,
        systemBillNumber,
        manualBillNumber,
        partyName,
        referenceNo,
        sourceModule: "sales",
        sourceTransactionType: "sales_transfer_to_payment"
      },
      transferTrace: {
        transferOnly: true,
        salesOrderId: params.id,
        systemBillNumber,
        manualBillNumber,
        partyName,
        referenceNo,
        countryId: orderRow.country_id,
        countryBranchId: orderRow.country_branch_id,
        cityBranchId: orderRow.city_branch_id,
        currencyCode: orderRow.currency_code || form.currencyType || "USD",
        exchangeRate: orderRow.exchange_rate || form.exchangeRate || 1,
        amount: totalSalesAmount,
        purchaseAccountNo: form.purchaseAccountNo,
        salesAccountNo: form.salesAccountNo,
        transferredAt: now,
        transferredBy: session.userId
      }
    };

    const debitLedgerId = form.customerAccountLedgerId || orderRow.customer_ledger_id;
    const creditLedgerId = form.salesAccountLedgerId || orderRow.customer_account_id;

    if (!debitLedgerId) {
      throw new Error("Customer Account Ledger ID is required before transfer to payment.");
    }
    if (!creditLedgerId) {
      throw new Error("Sales Account Ledger ID is required before transfer to payment.");
    }

    const goodsAuditRemark = buildSalesGoodsAuditRemark(orderRow, referenceNo);
    const postingNarration = [
      goodsAuditRemark,
      body?.remarks?.trim() ? "Notes: " + body.remarks.trim() : null,
      "Transfer Currency: " + (orderRow.currency_code || form.currencyType || "USD"),
      "Exchange Rate: " + (orderRow.exchange_rate || form.exchangeRate || 1),
      "Amount: " + totalSalesAmount
    ].filter(Boolean).join(" | ");

    const { data: paymentId, error: rpcError } = await supabase.rpc("post_sales_booking_transfer", {
      p_actor_id: session.userId,
      p_sales_order_id: params.id,
      p_payment_kind: "advance",
      p_entry_date: new Date().toISOString().slice(0, 10),
      p_amount: totalSalesAmount,
      p_currency_code: orderRow.currency_code || form.currencyType || "USD",
      p_exchange_rate: orderRow.exchange_rate || form.exchangeRate || 1,
      p_debit_ledger_id: debitLedgerId,
      p_credit_ledger_id: creditLedgerId,
      p_reference_no: referenceNo,
      p_narration: postingNarration || null
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    const paymentRecord = await requireSupabaseData(
      supabase
        .from("sales_order_payments")
        .select("id, roznamcha_entry_id")
        .eq("id", paymentId)
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

    const patch = {
      ledger_posting_status: "posted",
      payment_status: "completed",
      paid_amount: totalSalesAmount,
      remaining_amount: 0,
      updated_at: now,
      form_data: {
        ...updatedFormData,
        workflow: {
          ...updatedFormData.workflow,
          journalStatus: "posted",
          ledgerStatus: "posted",
          lastPaymentId: paymentId,
          lastRoznamchaEntryId: paymentRecord.roznamcha_entry_id,
          lastPaymentPostedAt: now
        },
        lastPaymentTrace: {
          paymentId,
          roznamchaEntryId: paymentRecord.roznamcha_entry_id,
          debitLedgerId: debitLedgerId,
          creditLedgerId: creditLedgerId,
          superAdminSerialNumber: journalRecord.super_admin_serial_number,
          countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
          branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number,
          systemBillNumber,
          manualBillNumber,
          partyName,
          referenceNo,
          narration: postingNarration
        }
      }
    };

    const updatedOrder = await requireSupabaseData(
      supabase
        .from("sales_orders")
        .update(patch)
        .eq("id", params.id)
        .select("id, sales_order_no, sales_contract_no, ledger_posting_status, payment_status")
        .maybeSingle()
    );

    await writeAuditLog({
      action: "transfer_to_sales_payment",
      entityTable: "sales_orders",
      entityId: params.id,
      before: order,
      after: patch,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiOk({
      success: true,
      salesOrderId: params.id,
      salesOrderNo: (updatedOrder as any).sales_order_no,
      systemBillNumber,
      manualBillNumber,
      referenceNo,
      transferOnly: true,
      ledgerPostingStatus: "posted",
      paymentStatus: "completed",
      paidAmount: totalSalesAmount,
      remainingAmount: 0
    });
  } catch (error) {
    console.error("SALES_TRANSFER_TO_PAYMENT_ERROR:", error);
    return handleApiError(error);
  }
}
