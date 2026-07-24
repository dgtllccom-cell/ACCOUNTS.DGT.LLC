import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

async function resolveLedgerOrAccount(adminSupabase: any, term: string | null | undefined) {
  if (!term || typeof term !== "string") return null;
  const cleanTerm = term.trim();
  if (!cleanTerm) return null;

  // 1. Try ledgers table by id or code
  const { data: ledger } = await adminSupabase
    .from("ledgers")
    .select("id, code, name, country_id, country_branch_id, city_branch_id")
    .or(`id.eq.${cleanTerm},code.eq.${cleanTerm}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (ledger) return ledger;

  // 2. Try accounts table by id or code
  const { data: account } = await adminSupabase
    .from("accounts")
    .select("id, code, name, country_id, country_branch_id, city_branch_id")
    .or(`id.eq.${cleanTerm},code.eq.${cleanTerm}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (account) return account;

  // 3. Try ledgers by name search (ilike)
  const { data: ledgerByName } = await adminSupabase
    .from("ledgers")
    .select("id, code, name, country_id, country_branch_id, city_branch_id")
    .ilike("name", `%${cleanTerm}%`)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (ledgerByName) return ledgerByName;

  // 4. Try accounts by name search (ilike)
  const { data: accountByName } = await adminSupabase
    .from("accounts")
    .select("id, code, name, country_id, country_branch_id, city_branch_id")
    .ilike("name", `%${cleanTerm}%`)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (accountByName) return accountByName;

  return null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensurePurchaseSchemaAndEnums();
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const body = await request.json().catch(() => ({}));

    const supabase = await createApiSupabaseClient();
    const adminSupabase = createSupabaseAdminClient();

    const order = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .select("id, country_id, country_branch_id, city_branch_id, order_total, currency_code, exchange_rate, purchase_order_no, purchase_contract_no, form_data, ledger_posting_status, payment_status, advance_paid, remaining_paid, credit_amount, remaining_due, roznamcha_entry_id, is_edited_since_transfer")
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
    const purchaseAccountTerm = form.purchaseAccountNo || form.purchaseAccountNumber || form.purchaseAccountId || "UAE-001-AC-0001";
    const creditAccountTerm = form.salesAccountNo || form.salesAccountNumber || form.supplierAccountNo || form.supplierAccountId || "UAE-001-AC-0005";

    let debitAccountObj = await resolveLedgerOrAccount(adminSupabase, purchaseAccountTerm);
    let creditAccountObj = await resolveLedgerOrAccount(adminSupabase, creditAccountTerm);

    if (!debitAccountObj) {
      const { data: defaultDebit } = await adminSupabase.from("ledgers").select("id, code, name").is("deleted_at", null).limit(1).maybeSingle();
      debitAccountObj = defaultDebit;
    }

    if (!creditAccountObj) {
      const { data: defaultCredit } = await adminSupabase.from("ledgers").select("id, code, name").is("deleted_at", null).limit(1).maybeSingle();
      creditAccountObj = defaultCredit;
    }

    if (!debitAccountObj || !creditAccountObj) {
      throw new Error("Failed to resolve Purchase Account or Payable Account ledgers in the database.");
    }

    const currencyCode = orderRow.currency_code || form.currencyType || "USD";
    const exRate = Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1;
    const localAmount = totalPurchaseAmount * exRate;

    let roznamchaEntryId: string | null = (orderRow as any)?.roznamcha_entry_id || null;
    let paymentId: string | null = null;

    // Check if an existing Roznamcha entry exists for this transaction
    if (!roznamchaEntryId) {
      const { data: existingRoz } = await adminSupabase
        .from("roznamcha_entries")
        .select("id")
        .or(`source_transaction_id.eq.${params.id},reference_no.ilike.%${systemBillNumber}%`)
        .maybeSingle();

      if (existingRoz?.id) {
        roznamchaEntryId = existingRoz.id;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Post to purchase_order_payments (RPC or direct insert)
    // ─────────────────────────────────────────────────────────────
    try {
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

      if (!rpcErr && rpcPaymentId) {
        paymentId = String(rpcPaymentId);
        const { data: pRec } = await adminSupabase
          .from("purchase_order_payments")
          .select("roznamcha_entry_id")
          .eq("id", paymentId)
          .maybeSingle();
        if (pRec?.roznamcha_entry_id) {
          roznamchaEntryId = pRec.roznamcha_entry_id;
        }
      }
    } catch (err) {
      console.warn("post_purchase_booking_transfer RPC skipped/fallback:", err);
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

    if (!roznamchaEntryId) {
      const { data: newRoz, error: rozErr } = await adminSupabase
        .from("roznamcha_entries")
        .insert({
          country_id: effectiveCountryId,
          country_branch_id: effectiveCountryBranchId,
          city_branch_id: effectiveCityBranchId,
          type: rozType,
          journal_no: `JO-PURCHASE-${systemBillNumber}`,
          voucher_no: `VO-PURCHASE-${systemBillNumber}`,
          entry_date: now.slice(0, 10),
          reference_no: referenceNo,
          narration: goodsAuditRemark,
          status: "posted",
          source_module: "purchase",
          source_transaction_type: "purchase_booking_transfer",
          source_transaction_id: params.id,
          created_by: session.userId,
          created_at: now,
          updated_at: now
        })
        .select("id")
        .single();

      if (!rozErr && newRoz?.id) {
        roznamchaEntryId = newRoz.id;

        // Post Debit & Credit Lines
        await adminSupabase.from("roznamcha_lines").insert([
          {
            roznamcha_entry_id: roznamchaEntryId,
            ledger_id: debitAccountObj.id,
            debit: localAmount,
            credit: 0,
            currency: currencyCode,
            exchange_rate: exRate,
            usd_rate: exRate,
            usd_amount: totalPurchaseAmount,
            description: `DR: Purchase Account (${systemBillNumber}) - ${goodsAuditRemark}`
          },
          {
            roznamcha_entry_id: roznamchaEntryId,
            ledger_id: creditAccountObj.id,
            debit: 0,
            credit: localAmount,
            currency: currencyCode,
            exchange_rate: exRate,
            usd_rate: exRate,
            usd_amount: totalPurchaseAmount,
            description: `CR: Payable Account (${systemBillNumber}) - ${goodsAuditRemark}`
          }
        ]);
      }
    } else {
      // Ensure scope and type are updated on existing roznamcha_entries
      await adminSupabase.from("roznamcha_entries").update({
        country_id: effectiveCountryId,
        country_branch_id: effectiveCountryBranchId,
        city_branch_id: effectiveCityBranchId,
        type: rozType,
        status: "posted"
      }).eq("id", roznamchaEntryId);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Post to Journal Entries & Journal Lines (General Ledger)
    // ─────────────────────────────────────────────────────────────
    try {
      const { data: existingJE } = await adminSupabase
        .from("journal_entries")
        .select("id")
        .eq("source_id", params.id)
        .maybeSingle();

      if (!existingJE) {
        const { data: newJE } = await adminSupabase
          .from("journal_entries")
          .insert({
            entry_no: `JV-PURCHASE-${systemBillNumber}`,
            entry_date: now.slice(0, 10),
            status: "posted",
            memo: `Purchase Transfer - ${systemBillNumber} (${goodsAuditRemark})`,
            source_type: "purchase_order",
            source_id: params.id,
            posted_at: now,
            posted_by: session.userId,
          })
          .select("id")
          .single();

        if (newJE?.id) {
          await adminSupabase.from("journal_lines").insert([
            {
              journal_entry_id: newJE.id,
              account_id: debitAccountObj.id,
              description: `DR: Purchase Account (${systemBillNumber}) - ${goodsAuditRemark}`,
              debit: localAmount,
              credit: 0,
            },
            {
              journal_entry_id: newJE.id,
              account_id: creditAccountObj.id,
              description: `CR: Payable Account (${systemBillNumber}) - ${goodsAuditRemark}`,
              debit: 0,
              credit: localAmount,
            }
          ]);
        }
      }
    } catch (jeErr) {
      console.warn("Journal entry creation fallback notice:", jeErr);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Create purchase_order_payments record if still missing
    // ─────────────────────────────────────────────────────────────
    if (!paymentId) {
      const { data: existingPay } = await adminSupabase
        .from("purchase_order_payments")
        .select("id")
        .eq("purchase_order_id", params.id)
        .maybeSingle();

      if (!existingPay) {
        const { data: newPay } = await adminSupabase
          .from("purchase_order_payments")
          .insert({
            purchase_order_id: params.id,
            kind: "booking",
            entry_date: now.slice(0, 10),
            amount: totalPurchaseAmount,
            currency_code: currencyCode,
            exchange_rate: exRate,
            debit_ledger_id: debitAccountObj.id,
            credit_ledger_id: creditAccountObj.id,
            roznamcha_entry_id: roznamchaEntryId,
            status: "posted",
            reference_no: referenceNo,
            narration: goodsAuditRemark,
            source_module: "purchase",
            source_transaction_type: "purchase_booking_transfer",
            created_at: now,
            updated_at: now
          })
          .select("id")
          .single();

        if (newPay?.id) paymentId = newPay.id;
      }
    }

    // Update order status in purchase_orders table
    const existingAdvance = Number(orderRow.advance_paid) || 0;
    const newRemainingDue = totalPurchaseAmount - existingAdvance;
    let newPaymentStatus = "pending";
    if (newRemainingDue <= 0) newPaymentStatus = "completed";
    else if (existingAdvance > 0) newPaymentStatus = "partial";

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
        currentStep: "purchase_transfer_payment",
        currentStepName: "Purchase Transfer Payment",
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
      roznamcha_entry_id: roznamchaEntryId,
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
      roznamchaEntryId,
      paymentId,
      ledgerPostingStatus: "posted",
      paymentStatus: newPaymentStatus,
      advancePaid: existingAdvance,
      remainingDue: newRemainingDue
    });
  } catch (error) {
    console.error("PURCHASE_TRANSFER_TO_PAYMENT_ERROR:", error);
    return handleApiError(error);
  }
}


