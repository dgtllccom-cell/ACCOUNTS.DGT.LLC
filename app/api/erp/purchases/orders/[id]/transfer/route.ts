import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDbUrl } from "@/lib/db/local-postgres";
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
  // Prefer the canonical, always-consistent original-currency total the order itself
  // stores (total_goods_original, paired with its own currency_code) over the fragile
  // per-item/form fallback chain below — that chain was the source of a currency-label
  // mismatch (e.g. showing the true USD amount tagged "AED") that made the audit
  // narration self-contradictory, separate from (but adjacent to) the double-conversion
  // posting bug this same amount/currency pairing is used to fix.
  const canonicalOriginalTotal = Number(orderRow.total_goods_original ?? orderRow.total_goods_usd ?? 0);
  const purchaseAmount = canonicalOriginalTotal > 0
    ? canonicalOriginalTotal
    : (goodsEntries.reduce((sum: number, item: any) => sum + Number(item.totalAmount ?? item.purchaseAmount ?? 0), 0) || Number(form.totalAmount || totals.grandPrimaryFinal || orderRow.order_total || 0));
  const purchaseCurrency = String(orderRow.currency_code || goodsEntries[0]?.purchaseCurrency || goodsEntries[0]?.pricingCurrency || form.purchaseCurrency || form.pricingCurrency || "USD").toUpperCase();
  return `Purchase Bill: ${billNo} | Goods: ${goodsName} | Qty: ${formatAuditNumber(totalQty)}${unit ? ` ${unit}` : ""} | Gross WT: ${formatAuditNumber(grossWeight)} KG | Net WT: ${formatAuditNumber(netWeight)} KG | Purchase Price: ${formatAuditNumber(purchaseAmount)} ${purchaseCurrency}`;
}

async function resolveLedgerOrAccount(
  adminSupabase: any,
  terms: (string | null | undefined)[],
  fallbackName?: string,
  defaultNormalBalance: "debit" | "credit" = "debit"
) {
  const candidateTerms = terms.map(t => String(t ?? "").trim()).filter(Boolean);
  if (candidateTerms.length === 0) return null;

  const ledgerColumns = "id, code, name, country_id, country_branch_id, city_branch_id, enterprise_account_id, account_id";

  for (const cleanTerm of candidateTerms) {
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

    const { data: ledgerByName } = await adminSupabase
      .from("ledgers").select(ledgerColumns).ilike("name", cleanTerm)
      .is("deleted_at", null).limit(1).maybeSingle();
    if (ledgerByName) return ledgerByName;

    // Look up the account by code/name too (an existing, already-authorized enterprise
    // account or legacy account), but never CREATE a ledger/account here — a required
    // account/ledger link that is missing must stop the transfer with a clear message,
    // not be silently invented on the fly during a financial posting. Set up the ledger
    // link on the Account Setup screen first, then retry the transfer.
    let { data: enterpriseAccount } = await adminSupabase
      .from("enterprise_accounts").select("id, code, name").eq("code", cleanTerm)
      .is("deleted_at", null).limit(1).maybeSingle();
    if (!enterpriseAccount) {
      const byName = await adminSupabase
        .from("enterprise_accounts").select("id, code, name").ilike("name", cleanTerm)
        .is("deleted_at", null).limit(1).maybeSingle();
      enterpriseAccount = byName.data;
    }
    if (enterpriseAccount?.id) {
      const { data: enterpriseLedger } = await adminSupabase
        .from("ledgers").select(ledgerColumns).eq("enterprise_account_id", enterpriseAccount.id)
        .is("deleted_at", null).limit(1).maybeSingle();
      if (enterpriseLedger) return enterpriseLedger;
      throw new Error(
        `Account "${enterpriseAccount.name || enterpriseAccount.code}" (${enterpriseAccount.code}) has no ledger set up yet. ` +
        `Set up its ledger on the Account Setup screen before transferring this bill.`
      );
    }

    let { data: legacyAccount } = await adminSupabase
      .from("accounts").select("id, code, name").eq("code", cleanTerm)
      .is("deleted_at", null).limit(1).maybeSingle();
    if (!legacyAccount) {
      const byName = await adminSupabase
        .from("accounts").select("id, code, name").ilike("name", cleanTerm)
        .is("deleted_at", null).limit(1).maybeSingle();
      legacyAccount = byName.data;
    }
    if (legacyAccount?.id) {
      const { data: accountLedger } = await adminSupabase
        .from("ledgers").select(ledgerColumns).eq("account_id", legacyAccount.id)
        .is("deleted_at", null).limit(1).maybeSingle();
      if (accountLedger) return accountLedger;
      throw new Error(
        `Account "${legacyAccount.name || legacyAccount.code}" (${legacyAccount.code}) has no ledger set up yet. ` +
        `Set up its ledger on the Account Setup screen before transferring this bill.`
      );
    }
  }

  // No existing ledger or account matched any of the supplied terms — do not invent one.
  return null;
}

import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    // Schema is applied via supabase/migrations, not per-request — running the
    // full ~23-statement ensure-schema DDL block on every transfer added
    // 15-20s of pure catalog-lock overhead to a request that never needed it
    // (confirmed: every purchase_orders column/table it creates already exists).
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

    // The Roznamcha posting engine (post_purchase_order_payment) expects p_amount in the
    // order's OWN currency (currency_code) and multiplies it by the exchange rate exactly
    // once to get the base-currency posting amount. order_total / totals.grandFinal are
    // already converted into the local/base currency by the booking wizard — passing
    // either of those here as p_amount, alongside currency_code (still the ORIGINAL
    // currency), causes the exchange rate to be applied a SECOND time (e.g. 126,500 USD
    // correctly becomes 464,887.50 AED once, then wrongly becomes 1,708,461.56 AED here).
    // total_goods_original / total_goods_usd hold the true original-currency total the
    // wizard already computed and saved alongside order_total — use that instead.
    const rawOriginalTotal = String(
      orderRow.total_goods_original || orderRow.total_goods_usd || ""
    ).replace(/,/g, "");
    let totalPurchaseAmount = Number(rawOriginalTotal);
    if (!Number.isFinite(totalPurchaseAmount) || totalPurchaseAmount <= 0) {
      // Legacy order predating total_goods_original: fall back to un-converting
      // order_total by the order's own exchange rate, the same defensive heuristic
      // lib/services/purchase-calculation-service.ts already uses for display.
      const rawTotal = String(orderRow.order_total || formData.totals?.grandFinal || "0").replace(/,/g, "");
      const legacyTotal = Number(rawTotal);
      const legacyRate = Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1;
      totalPurchaseAmount = legacyRate > 1 ? legacyTotal / legacyRate : legacyTotal;
    }
    if (!Number.isFinite(totalPurchaseAmount) || totalPurchaseAmount <= 0) {
      throw new Error("Purchase order total must be a valid number greater than zero to transfer.");
    }

    const partyName = String(form.purchaseAccountName || form.supplierName || form.salesAccountName || form.customerName || "Purchase Party").trim();
    const referenceNo = [systemBillNumber, manualBillNumber].filter(Boolean).join(" / ") || systemBillNumber || manualBillNumber || null;
    const now = new Date().toISOString();
    const goodsAuditRemark = buildPurchaseGoodsAuditRemark(orderRow, referenceNo);

    const purchaseTerms = [
      form.purchaseAccountId,
      form.purchaseAccountNo,
      form.purchaseAccountName,
      form.purchaseAccountLedgerId,
      form.supplierId,
      form.supplierName
    ];
    const creditTerms = [
      form.salesAccountId,
      form.salesAccountNo,
      form.salesAccountName,
      form.salesAccountLedgerId,
      form.supplierAccountId,
      form.supplierAccountNo,
      form.supplierId,
      form.supplierName,
      form.customerId,
      form.customerName
    ];

    const debitAccountObj = await resolveLedgerOrAccount(adminSupabase, purchaseTerms, form.purchaseAccountName || "Purchase Account", "debit");
    const creditAccountObj = await resolveLedgerOrAccount(adminSupabase, creditTerms, form.salesAccountName || form.supplierName || "Payable Account", "credit");

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
      .select("id, roznamcha_entry_id, amount, base_currency_amount, debit_ledger_id, credit_ledger_id")
      .eq("purchase_order_id", params.id)
      .eq("kind", "booking")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingPaymentError) throw existingPaymentError;
    const expectedFinalAmount = Number(orderRow.order_total || 0) > 0 ? Number(orderRow.order_total) : (totalPurchaseAmount * exRate);
    if (existingPayment) {
      if (isPurchaseBookingTransferLocked(orderRow)) {
        throw new Error("This booking has already been transferred.");
      }
      paymentId = String(existingPayment.id);
      roznamchaEntryId = existingPayment.roznamcha_entry_id;
      const recordedAmount = Number(existingPayment.base_currency_amount || existingPayment.amount || 0);
      const amountMatches =
        Math.abs(recordedAmount - expectedFinalAmount) < 0.05 ||
        Math.abs(recordedAmount - totalPurchaseAmount) < 0.05 ||
        Math.abs(Number(existingPayment.amount) - totalPurchaseAmount) < 0.05;
      if (
        !amountMatches ||
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
    // Internal posting-integrity assertion tag (developer diagnostics only, embedded in an
    // exception message if these checks ever fail — not user-facing UI copy).
    const postingAssertionLabel = "Business Roznamcha";
    assertDistinctBookingLedgers(debitAccountObj.id, creditAccountObj.id, postingAssertionLabel);
    assertBalancedPostedLines({
      label: postingAssertionLabel,
      lines: postedLines,
      expectedDebitLedgerId: debitAccountObj.id,
      expectedCreditLedgerId: creditAccountObj.id,
      expectedAmount: totalPurchaseAmount,
      expectedExchangeRate: exRate
    });
    assertPostedRoznamchaTrace({
      label: postingAssertionLabel,
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
    const selectedPaymentType = form.paymentType || body?.paymentType || "";
    const destination = resolvePurchaseBookingTransferDestination(selectedPaymentType);
    const isCreditBooking = destination.flow === "credit" || String(selectedPaymentType || form.paymentCondition || "").toLowerCase().includes("credit");

    const existingAdvance = isCreditBooking ? 0 : (Number(orderRow.advance_paid) || 0);
    const newRemainingDue = isCreditBooking ? expectedFinalAmount : Math.max(0, expectedFinalAmount - existingAdvance);
    let newPaymentStatus = "pending";
    if (newRemainingDue <= 0.01 && existingAdvance > 0) newPaymentStatus = "completed";
    else if (existingAdvance > 0) newPaymentStatus = "partial";

    const updatedFormData = {
      ...formData,
      form: {
        ...form,
        ...(isCreditBooking ? { advancePercent: 0, advanceAmount: 0 } : {}),
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


