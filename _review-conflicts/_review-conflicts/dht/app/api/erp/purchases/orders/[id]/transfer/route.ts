import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { ensurePurchaseSchemaAndEnums } from "@/lib/services/purchase-table-manager";

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

function buildPurchaseGoodsAuditRemark(orderRow: any, fallbackReference?: string | null) {
  const data = orderRow.form_data ?? {};
  const form = data.form ?? {};
  const totals = data.totals ?? {};
  const goodsEntries = Array.isArray(data.goodsEntries) && data.goodsEntries.length
    ? data.goodsEntries
    : form.goodsName
      ? [form]
      : [];
  const billNo = String(form.manualBillNumber || form.manual_bill_number || form.billNo || form.purchaseContractNo || orderRow.purchase_contract_no || orderRow.purchase_order_no || fallbackReference || "Purchase Bill").trim();
  const goodsName = goodsEntries.map((item: any) => item.goodsName || item.name || item.productName).filter(Boolean).join(", ") || form.goodsName || "Purchase Goods";
  const totalQty = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.qtyNo ?? item.quantity ?? item.qty ?? 0), 0) || Number(form.qtyNo || form.quantity || 0);
  const unit = String(goodsEntries[0]?.qtyName || goodsEntries[0]?.unit || form.qtyName || form.quantityUnit || "").trim();
  const grossWeight = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.grossWeight ?? item.gross_weight ?? 0), 0) || Number(form.grossWeight || totals.totalGross || 0);
  const netWeight = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? item.net_weight ?? 0), 0) || Number(form.netWeight || totals.totalNet || 0);
  const purchaseAmount = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.totalAmount ?? item.purchaseAmount ?? 0), 0) || Number(form.totalAmount || totals.grandPrimaryFinal || orderRow.order_total || 0);
  const purchaseCurrency = String(goodsEntries[0]?.purchaseCurrency || goodsEntries[0]?.pricingCurrency || form.purchaseCurrency || form.pricingCurrency || orderRow.currency_code || "USD").toUpperCase();
  return `Purchase Bill: ${billNo} | Goods: ${goodsName} | Qty: ${formatAuditNumber(totalQty)}${unit ? ` ${unit}` : ""} | Gross WT: ${formatAuditNumber(grossWeight)} KG | Net WT: ${formatAuditNumber(netWeight)} KG | Purchase Price: ${formatAuditNumber(purchaseAmount)} ${purchaseCurrency}`;
}
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensurePurchaseSchemaAndEnums();
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const body = await request.json().catch(() => ({}));

    const supabase = await createApiSupabaseClient();
    const order = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .select("id, country_id, country_branch_id, city_branch_id, order_total, currency_code, exchange_rate, purchase_order_no, purchase_contract_no, form_data, ledger_posting_status, payment_status, is_edited_since_transfer")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "purchases",
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
      return handleApiError(new Error("This booking has already been transferred to Purchase Transfer Payment and cannot be transferred again."));
    }

    const rawTotal = String(orderRow.order_total || formData.totals?.grandFinal || "0").replace(/,/g, "");
    const totalPurchaseAmount = Number(rawTotal);
    if (!Number.isFinite(totalPurchaseAmount) || totalPurchaseAmount <= 0) {
      throw new Error("Purchase order total must be a valid number greater than zero to transfer.");
    }

    if (!form.purchaseAccountNo) {
      throw new Error("Purchase Account is required before transfer to payment.");
    }
    if (!form.salesAccountNo) {
      throw new Error("Sales/Payable Account is required before transfer to payment.");
    }

    const systemBillNumber = String(orderRow.purchase_order_no || form.purchaseOrderNo || "").trim();
    const manualBillNumber = String(
      form.manualBillNumber || form.manual_bill_number || form.billNo || form.purchaseContractNo || orderRow.purchase_contract_no || ""
    ).trim();
    const partyName = String(form.purchaseAccountName || form.supplierName || form.salesAccountName || form.customerName || "Purchase Party").trim();
    const referenceNo = [systemBillNumber, manualBillNumber].filter(Boolean).join(" / ") || systemBillNumber || manualBillNumber || null;
    const now = new Date().toISOString();
    const goodsAuditRemark = buildPurchaseGoodsAuditRemark(orderRow, referenceNo);

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
        currentStep: "purchase_transfer_payment",
        currentStepName: "Purchase Transfer Payment",
        nextStepName: "Post Payment",
        transferredAt: now,
        transferredBy: session.userId,
        systemBillNumber,
        manualBillNumber,
        partyName,
        referenceNo,
        sourceModule: "purchase",
        sourceTransactionType: "purchase_transfer_to_payment"
      },
      transferTrace: {
        transferOnly: true,
        purchaseOrderId: params.id,
        systemBillNumber,
        manualBillNumber,
        partyName,
        referenceNo,
        countryId: orderRow.country_id,
        countryBranchId: orderRow.country_branch_id,
        cityBranchId: orderRow.city_branch_id,
        currencyCode: orderRow.currency_code || form.currencyType || "USD",
        exchangeRate: orderRow.exchange_rate || form.exchangeRate || 1,
        amount: totalPurchaseAmount,
        purchaseAccountNo: form.purchaseAccountNo,
        salesAccountNo: form.salesAccountNo,
        transferredAt: now,
        transferredBy: session.userId
      }
    };


    const existingAdvance = Number(orderRow.advance_paid) || 0;
    const newRemainingDue = totalPurchaseAmount - existingAdvance;
    
    let newPaymentStatus = "pending";
    if (newRemainingDue <= 0) newPaymentStatus = "completed";
    else if (existingAdvance > 0) newPaymentStatus = "partial";

    const patch = {
      ledger_posting_status: "posted",
      payment_status: newPaymentStatus,
      is_edited_since_transfer: false,
      advance_paid: existingAdvance,
      remaining_due: newRemainingDue,
      updated_at: now,
      form_data: updatedFormData
    };

    const updatedOrder = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .update(patch)
        .eq("id", params.id)
        .select("id, purchase_order_no, purchase_contract_no, ledger_posting_status, payment_status")
        .maybeSingle()
    );

    await writeAuditLog({
      action: "transfer_to_purchase_payment",
      entityTable: "purchase_orders",
      entityId: params.id,
      before: order,
      after: patch,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiOk({
      success: true,
      purchaseOrderId: params.id,
      purchaseOrderNo: (updatedOrder as any).purchase_order_no,
      systemBillNumber,
      manualBillNumber,
      referenceNo,
      transferOnly: true,
      ledgerPostingStatus: "posted",
      paymentStatus: "pending",
      advancePaid: 0,
      remainingDue: orderRow.order_total
    });
  } catch (error) {
    console.error("PURCHASE_TRANSFER_TO_PAYMENT_ERROR:", error);
    return handleApiError(error);
  }
}


