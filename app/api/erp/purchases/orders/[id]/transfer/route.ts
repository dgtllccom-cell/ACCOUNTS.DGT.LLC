import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDbUrl } from "@/lib/db/local-postgres";
import { ensurePurchaseSchemaAndEnums } from "@/lib/services/purchase-table-manager";
import { isPurchaseBookingTransferLocked, resolvePurchaseBookingTransferDestination } from "@/lib/services/purchase-booking-transfer-routing";
import { assertBalancedPostedLines, assertDistinctBookingLedgers, assertPostedRoznamchaTrace } from "@/lib/services/posting-verification";
import { transferPurchaseBookingViaLocalPg } from "@/lib/services/purchase-booking-transfer-local-pg";

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

async function resolveLedgerOrAccount(adminSupabase: any, term: string | null | undefined) {
  if (!term || typeof term !== "string") return null;
  const cleanTerm = term.trim();
  if (!cleanTerm) return null;

  const ledgerColumns = "id, code, name, country_id, country_branch_id, city_branch_id, enterprise_account_id, account_id";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanTerm);

  if (isUuid) {
    const { data: directLedger } = await adminSupabase
      .from("ledgers").select(ledgerColumns).eq("id", cleanTerm).is("deleted_at", null).maybeSingle();
    if (directLedger) return directLedger;

    const { data: linkedLedger } = await adminSupabase
      .from("ledgers").select(ledgerColumns)
      .or(`enterprise_account_id.eq.${cleanTerm},account_id.eq.${cleanTerm}`)
      .is("deleted_at", null).limit(1).maybeSingle();
    if (linkedLedger) return linkedLedger;
  }

  const { data: ledgerByCode } = await adminSupabase
    .from("ledgers").select(ledgerColumns).eq("code", cleanTerm)
    .is("deleted_at", null).limit(1).maybeSingle();
  if (ledgerByCode) return ledgerByCode;

  // The booking picker stores an enterprise-account id/code. Resolve that
  // selection to its linked ledger; never post directly to an accounts row.
  let { data: enterpriseAccount } = await adminSupabase
    .from("enterprise_accounts").select("id").eq("code", cleanTerm)
    .is("deleted_at", null).limit(1).maybeSingle();
  if (!enterpriseAccount) {
    const byName = await adminSupabase
      .from("enterprise_accounts").select("id").ilike("name", cleanTerm)
      .is("deleted_at", null).limit(1).maybeSingle();
    enterpriseAccount = byName.data;
  }
  if (enterpriseAccount?.id) {
    const { data: enterpriseLedger } = await adminSupabase
      .from("ledgers").select(ledgerColumns).eq("enterprise_account_id", enterpriseAccount.id)
      .is("deleted_at", null).limit(1).maybeSingle();
    if (enterpriseLedger) return enterpriseLedger;
  }

  let { data: legacyAccount } = await adminSupabase
    .from("accounts").select("id").eq("code", cleanTerm)
    .is("deleted_at", null).limit(1).maybeSingle();
  if (!legacyAccount) {
    const byName = await adminSupabase
      .from("accounts").select("id").ilike("name", cleanTerm)
      .is("deleted_at", null).limit(1).maybeSingle();
    legacyAccount = byName.data;
  }
  if (legacyAccount?.id) {
    const { data: accountLedger } = await adminSupabase
      .from("ledgers").select(ledgerColumns).eq("account_id", legacyAccount.id)
      .is("deleted_at", null).limit(1).maybeSingle();
    if (accountLedger) return accountLedger;
  }

  return null;
}

import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    await ensurePurchaseSchemaAndEnums();
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const body = await request.json().catch(() => ({}));

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "PURCHASE_TRANSFER",
      userId: session.userId,
      countryId: session.countryIds[0] ?? null,
      cityBranchId: session.cityBranchIds[0] ?? null,
      businessReference: params.id,
      payload: body
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 200, lockRes.responseBody);
    }

    if (!lockRes.acquired) {
      return handleApiError(new Error("A request with this idempotency key is currently being processed or duplicate submission detected. Please wait."));
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    if (getDbUrl()) {
      const responsePayload = await transferPurchaseBookingViaLocalPg({
        session,
        orderId: params.id,
        body
      });
      if (idempotencyKey && tenantHash) {
        await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, responsePayload);
      }
      return apiOk(responsePayload);
    }

    const supabase = (await createApiSupabaseClient()) as any;
    const adminSupabase = createSupabaseAdminClient() as any;

    const { data: order, error: orderErr } = await adminSupabase
      .from("purchase_orders")
      .select("*")
      .eq("id", params.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (orderErr || !order) {
      throw new Error(`Purchase order '${params.id}' was not found.`);
    }

    authorizeApiScope(session, {
      resource: "purchases",
      action: "update",
      countryId: order.country_id,
      countryBranchId: order.country_branch_id,
      cityBranchId: order.city_branch_id
    });

    const orderRow = order as any;
    const formData = orderRow.form_data || {};
    const form = formData.form || {};
    const workflow = formData.workflow || {};

    const systemBillNumber = String(orderRow.purchase_order_no || form.purchaseOrderNo || "").trim();
    const manualBillNumber = String(
      form.manualBillNumber || form.manual_bill_number || form.billNo || form.purchaseContractNo || orderRow.purchase_contract_no || ""
    ).trim();

    const rawTotal = String(orderRow.order_total || formData.totals?.grandFinal || "0").replace(/,/g, "");
    const totalPurchaseAmount = Number(rawTotal);
    if (!Number.isFinite(totalPurchaseAmount) || totalPurchaseAmount <= 0) {
      throw new Error("Purchase order total must be a valid number greater than zero to transfer.");
    }

    const partyName = String(form.purchaseAccountName || form.supplierName || form.salesAccountName || form.customerName || "Purchase Party").trim();
    const referenceNo = [systemBillNumber, manualBillNumber].filter(Boolean).join(" / ") || systemBillNumber || manualBillNumber || null;
    const now = new Date().toISOString();
    const goodsAuditRemark = buildPurchaseGoodsAuditRemark(orderRow, referenceNo);

    // Resolve Account IDs for Debit (Purchase) & Credit (Supplier/Payable)
    const purchaseAccountTerm = form.purchaseAccountLedgerId || form.purchaseAccountId || form.purchaseAccountNo || form.purchaseAccountNumber;
    const creditAccountTerm = form.salesAccountLedgerId || form.salesAccountId || form.supplierAccountId || form.salesAccountNo || form.salesAccountNumber || form.supplierAccountNo;

    const debitAccountObj = await resolveLedgerOrAccount(adminSupabase, purchaseAccountTerm);
    const creditAccountObj = await resolveLedgerOrAccount(adminSupabase, creditAccountTerm);

    if (!debitAccountObj || !creditAccountObj) {
      throw new Error("The selected Purchase (DR) and Sales/Payable (CR) accounts must each have a linked ledger before transfer.");
    }
    if (debitAccountObj.id === creditAccountObj.id) {
      throw new Error("Purchase (DR) and Sales/Payable (CR) must be different ledgers.");
    }

    // ── Rule 1: Country Scope Validation ──
    const { validateLedgerCountryScope } = await import("@/lib/api/country-scope-validator");
    await validateLedgerCountryScope(session, debitAccountObj.id, orderRow.country_id, adminSupabase);
    await validateLedgerCountryScope(session, creditAccountObj.id, orderRow.country_id, adminSupabase);

    const currencyCode = orderRow.currency_code || form.currencyType || "USD";
    const exRate = Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1;

    let roznamchaEntryId: string | null = null;
    let paymentId: string | null = null;

    // Reconcile an earlier RPC success whose final order update was interrupted.
    const { data: existingPayment, error: existingPaymentError } = await adminSupabase
      .from("purchase_order_payments")
      .select("id, roznamcha_entry_id, amount, debit_ledger_id, credit_ledger_id")
      .eq("purchase_order_id", params.id)
      .eq("kind", "booking")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingPaymentError) throw existingPaymentError;
    if (existingPayment) {
      if (isPurchaseBookingTransferLocked(orderRow)) {
        throw new Error("This booking has already been transferred.");
      }
      paymentId = String(existingPayment.id);
      roznamchaEntryId = existingPayment.roznamcha_entry_id;
      if (
        Number(existingPayment.amount) !== totalPurchaseAmount ||
        existingPayment.debit_ledger_id !== debitAccountObj.id ||
        existingPayment.credit_ledger_id !== creditAccountObj.id
      ) {
        throw new Error("An existing booking posting does not match this order's amount or selected DR/CR ledgers. Transfer was stopped for reconciliation.");
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Post to purchase_order_payments (RPC or direct insert)
    // ─────────────────────────────────────────────────────────────
    try {
      if (paymentId) {
        if (!roznamchaEntryId) throw new Error("The existing booking payment is missing its Roznamcha entry.");
      } else {
      const { data: rpcPaymentId, error: rpcErr } = await supabase.rpc("post_purchase_booking_transfer", {
        p_actor_id: session.userId,
        p_purchase_order_id: params.id,
        p_kind: "booking",
        p_entry_date: now.slice(0, 10),
        p_amount: totalPurchaseAmount,
        p_currency_code: currencyCode,
        p_exchange_rate: exRate,
        p_debit_ledger_id: debitAccountObj.id,
        p_credit_ledger_id: creditAccountObj.id,
        p_reference_no: referenceNo,
        p_narration: goodsAuditRemark
      });

      if (rpcErr) throw new Error(`Business Roznamcha posting failed: ${rpcErr.message}`);
      if (!rpcPaymentId) throw new Error("Business Roznamcha posting did not return a payment id.");
      paymentId = String(rpcPaymentId);
      const { data: pRec, error: paymentRecordError } = await adminSupabase
        .from("purchase_order_payments")
        .select("roznamcha_entry_id")
        .eq("id", paymentId)
        .maybeSingle();
      if (paymentRecordError || !pRec?.roznamcha_entry_id) {
        throw new Error("Business Roznamcha posting completed without a linked Roznamcha entry.");
      }
      roznamchaEntryId = pRec.roznamcha_entry_id;
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error("Business Roznamcha posting failed.");
    }

    if (!paymentId || !roznamchaEntryId) {
      throw new Error("Business Roznamcha transfer did not create a complete booking payment.");
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Post to Roznamcha Entries & Roznamcha Lines
    // ─────────────────────────────────────────────────────────────
    const effectiveCountryId = orderRow.country_id || debitAccountObj?.country_id || creditAccountObj?.country_id || null;
    const effectiveCountryBranchId = orderRow.country_branch_id || debitAccountObj?.country_branch_id || creditAccountObj?.country_branch_id || null;
    const effectiveCityBranchId = orderRow.city_branch_id || debitAccountObj?.city_branch_id || creditAccountObj?.city_branch_id || null;

    let rozType = "super_admin";
    if (effectiveCityBranchId) rozType = "branch";
    else if (effectiveCountryBranchId || effectiveCountryId) rozType = "country";

    // The RPC is the sole transactional posting path. Only enrich its canonical
    // Business Roznamcha entry with the booking's exact country/branch scope.
    const { error: scopeUpdateError } = await adminSupabase.from("roznamcha_entries").update({
      country_id: effectiveCountryId,
      country_branch_id: effectiveCountryBranchId,
      city_branch_id: effectiveCityBranchId,
      type: rozType,
      status: "posted",
      entry_category: "business"
    }).eq("id", roznamchaEntryId);
    if (scopeUpdateError) throw scopeUpdateError;

    const { data: postedLines, error: postedLinesError } = await adminSupabase
      .from("roznamcha_lines")
      .select("ledger_id, debit, credit")
      .eq("roznamcha_entry_id", roznamchaEntryId);
    if (postedLinesError) throw postedLinesError;
    assertDistinctBookingLedgers(debitAccountObj.id, creditAccountObj.id, "Business Roznamcha");
    assertBalancedPostedLines({
      label: "Business Roznamcha",
      lines: postedLines,
      expectedDebitLedgerId: debitAccountObj.id,
      expectedCreditLedgerId: creditAccountObj.id,
      expectedAmount: totalPurchaseAmount,
      expectedExchangeRate: exRate
    });
    assertPostedRoznamchaTrace({
      label: "Business Roznamcha",
      entry: (await requireSupabaseData(
        supabase
          .from("roznamcha_entries")
          .select("country_id, country_branch_id, city_branch_id, status, posted_at, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number")
          .eq("id", roznamchaEntryId)
          .maybeSingle()
      )) as any
    });

    // NOTE: A separate journal_entries/journal_lines posting used to be written here for the same
    // bill. That duplicated the debit/credit already posted to roznamcha_entries/roznamcha_lines
    // above via the RPC, doubling every purchase transfer's ledger impact.
    // roznamcha_entries/roznamcha_lines is the single authoritative posting for this transfer,
    // matching how the Sales Order transfer route already works.

    // ─────────────────────────────────────────────────────────────
    // 4. Create purchase_order_payments record if still missing
    // ─────────────────────────────────────────────────────────────
    // Update order status in purchase_orders table
    const existingAdvance = Number(orderRow.advance_paid) || 0;
    const newRemainingDue = totalPurchaseAmount - existingAdvance;
    let newPaymentStatus = "pending";
    if (newRemainingDue <= 0) newPaymentStatus = "completed";
    else if (existingAdvance > 0) newPaymentStatus = "partial";
    const selectedPaymentType = form.paymentType || body?.paymentType || "";
    const destination = resolvePurchaseBookingTransferDestination(selectedPaymentType);

    const updatedFormData = {
      ...formData,
      form: {
        ...form,
        roznamchaEntryId,
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
        paymentStatus: newPaymentStatus,
        journalStatus: "posted",
        ledgerStatus: "posted",
        currentStep: destination.currentStep,
        currentStepName: destination.currentStepName,
        transferredAt: now,
        transferredBy: session.userId,
        systemBillNumber,
        manualBillNumber,
        partyName,
        referenceNo,
        sourceModule: "purchase",
        sourceTransactionType: "purchase_transfer_to_payment"
      }
    };

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

    const resPayload = {
      success: true,
      purchaseOrderId: params.id,
      purchaseOrderNo: (updatedOrder as any).purchase_order_no,
      systemBillNumber,
      manualBillNumber,
      referenceNo,
      transferOnly: true,
      roznamchaEntryId,
      paymentId,
      ledgerPostingStatus: "posted",
      paymentStatus: newPaymentStatus,
      advancePaid: existingAdvance,
      remainingDue: newRemainingDue,
      paymentFlow: destination.flow,
      destinationPath: destination.path
    };

    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, resPayload);
    }

    return apiOk(resPayload);
  } catch (error) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    console.error("PURCHASE_TRANSFER_TO_PAYMENT_ERROR:", error);
    return handleApiError(error);
  }
}


