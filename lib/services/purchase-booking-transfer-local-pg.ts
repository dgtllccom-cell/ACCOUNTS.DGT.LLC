import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { assertBalancedPostedLines, assertDistinctBookingLedgers } from "@/lib/services/posting-verification";
import { resolvePurchaseBookingTransferDestination } from "@/lib/services/purchase-booking-transfer-routing";

function money(value: unknown) {
  const numeric = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, any>;
    } catch {
      return {};
    }
  }
  return {};
}

function buildPurchaseGoodsAuditRemark(orderRow: any, fallbackReference?: string | null) {
  const data = normalizeJsonObject(orderRow.form_data);
  const form = data.form ?? {};
  const totals = data.totals ?? {};
  const billNo = String(form.manualBillNumber || form.manual_bill_number || form.billNo || form.purchaseContractNo || orderRow.purchase_contract_no || orderRow.purchase_order_no || fallbackReference || "Purchase Bill").trim();
  const goodsName = String(form.goodsName || form.productName || "Purchase Goods").trim();
  const totalQty = money(form.qtyNo || form.quantity || 0);
  const unit = String(form.qtyName || form.quantityUnit || "").trim();
  const grossWeight = money(form.grossWeight || totals.totalGross || 0);
  const netWeight = money(form.netWeight || totals.totalNet || 0);
  const purchaseAmount = money(form.totalAmount || totals.grandPrimaryFinal || orderRow.order_total || 0);
  const purchaseCurrency = String(form.purchaseCurrency || orderRow.currency_code || "USD").toUpperCase();
  return `Purchase Bill: ${billNo} | Goods: ${goodsName} | Qty: ${totalQty}${unit ? ` ${unit}` : ""} | Gross WT: ${grossWeight} KG | Net WT: ${netWeight} KG | Purchase Price: ${purchaseAmount} ${purchaseCurrency}`;
}

async function resolveLedgerOrAccount(tx: any, term: string | null | undefined) {
  const clean = String(term ?? "").trim();
  if (!clean) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean);

  if (isUuid) {
    const byLedger = await tx`select id, code, name, country_id, country_branch_id, city_branch_id, enterprise_account_id, account_id from ledgers where id = ${clean}::uuid and deleted_at is null limit 1`;
    if (byLedger[0]) return byLedger[0];

    const byLinked = await tx`select id, code, name, country_id, country_branch_id, city_branch_id, enterprise_account_id, account_id from ledgers where deleted_at is null and (enterprise_account_id = ${clean}::uuid or account_id = ${clean}::uuid) limit 1`;
    if (byLinked[0]) return byLinked[0];
  }

  const byCode = await tx`select id, code, name, country_id, country_branch_id, city_branch_id, enterprise_account_id, account_id from ledgers where code = ${clean} and deleted_at is null limit 1`;
  if (byCode[0]) return byCode[0];

  const enterpriseAccount = await tx`select id, code, name, country_id from enterprise_accounts where (code = ${clean} or manual_reference_number = ${clean} or account_number = ${clean}) and deleted_at is null limit 1`;
  if (enterpriseAccount[0]?.id) {
    const byEnterprise = await tx`select id, code, name, country_id, country_branch_id, city_branch_id, enterprise_account_id, account_id from ledgers where enterprise_account_id = ${enterpriseAccount[0].id}::uuid and deleted_at is null limit 1`;
    if (byEnterprise[0]) return byEnterprise[0];
  }

  const legacyAccount = await tx`select id, code, name, country_id from accounts where (code = ${clean} or manual_reference_number = ${clean} or account_number = ${clean}) and deleted_at is null limit 1`;
  if (legacyAccount[0]?.id) {
    const byAccount = await tx`select id, code, name, country_id, country_branch_id, city_branch_id, enterprise_account_id, account_id from ledgers where account_id = ${legacyAccount[0].id}::uuid and deleted_at is null limit 1`;
    if (byAccount[0]) return byAccount[0];
  }

  return null;
}

export async function transferPurchaseBookingViaLocalPg(input: {
  session: Pick<ErpSession, "userId" | "fullName" | "email">;
  orderId: string;
  body: any;
}) {
  const { session, orderId, body } = input;
  return await withLocalPg(async (sql) => {
    return await sql.begin(async (tx) => {
      await tx`
        select set_config(
          'request.jwt.claims',
          ${JSON.stringify({ sub: session.userId, role: "authenticated" })},
          true
        );
      `;

      const orders = await tx`
        select *
        from purchase_orders
        where id = ${orderId}::uuid
          and deleted_at is null
        limit 1
        for update
      `;
      const orderRow = orders[0];
      if (!orderRow) throw new Error(`Purchase order '${orderId}' was not found.`);

      const formData = normalizeJsonObject(orderRow.form_data);
      const form = formData.form || {};
      const workflow = formData.workflow || {};
      const systemBillNumber = String(orderRow.purchase_order_no || form.purchaseOrderNo || "").trim();
      const manualBillNumber = String(form.manualBillNumber || form.manual_bill_number || form.billNo || form.purchaseContractNo || orderRow.purchase_contract_no || "").trim();
      const rawTotal = String(orderRow.order_total || formData.totals?.grandFinal || "0").replace(/,/g, "");
      const totalPurchaseAmount = Number(rawTotal);
      if (!Number.isFinite(totalPurchaseAmount) || totalPurchaseAmount <= 0) {
        throw new Error("Purchase order total must be a valid number greater than zero to transfer.");
      }

      const partyName = String(form.purchaseAccountName || form.supplierName || form.salesAccountName || form.customerName || "Purchase Party").trim();
      const referenceNo = [systemBillNumber, manualBillNumber].filter(Boolean).join(" / ") || systemBillNumber || manualBillNumber || null;
      const now = new Date().toISOString();
      const goodsAuditRemark = buildPurchaseGoodsAuditRemark(orderRow, referenceNo);

      const purchaseAccountTerm = form.purchaseAccountLedgerId || form.purchaseAccountId || form.purchaseAccountNo || form.purchaseAccountNumber;
      const creditAccountTerm = form.salesAccountLedgerId || form.salesAccountId || form.supplierAccountId || form.salesAccountNo || form.salesAccountNumber || form.supplierAccountNo;
      const debitAccountObj = await resolveLedgerOrAccount(tx, purchaseAccountTerm);
      const creditAccountObj = await resolveLedgerOrAccount(tx, creditAccountTerm);
      if (!debitAccountObj || !creditAccountObj) {
        throw new Error("The selected Purchase (DR) and Sales/Payable (CR) accounts must each have a linked ledger before transfer.");
      }
      if (debitAccountObj.id === creditAccountObj.id) {
        throw new Error("Purchase (DR) and Sales/Payable (CR) must be different ledgers.");
      }

      const effectiveCountryId = orderRow.country_id || debitAccountObj?.country_id || creditAccountObj?.country_id || null;
      const effectiveCountryBranchId = orderRow.country_branch_id || debitAccountObj?.country_branch_id || creditAccountObj?.country_branch_id || null;
      const effectiveCityBranchId = orderRow.city_branch_id || debitAccountObj?.city_branch_id || creditAccountObj?.city_branch_id || null;

      if ((!orderRow.country_branch_id && effectiveCountryBranchId) || (!orderRow.city_branch_id && effectiveCityBranchId)) {
        await tx`
          update purchase_orders
          set country_id = coalesce(country_id, ${effectiveCountryId}::uuid),
              country_branch_id = coalesce(country_branch_id, ${effectiveCountryBranchId}::uuid),
              city_branch_id = coalesce(city_branch_id, ${effectiveCityBranchId}::uuid),
              updated_at = now()
          where id = ${orderId}::uuid
        `;
        orderRow.country_id = effectiveCountryId;
        orderRow.country_branch_id = effectiveCountryBranchId;
        orderRow.city_branch_id = effectiveCityBranchId;
      }

      const existingPaymentRows = await tx`
        select id, roznamcha_entry_id, amount, debit_ledger_id, credit_ledger_id
        from purchase_order_payments
        where purchase_order_id = ${orderId}::uuid
          and kind = 'booking'
          and deleted_at is null
        order by created_at desc
        limit 1
      `;
      const existingPayment = existingPaymentRows[0] ?? null;

      let paymentId: string | null = null;
      let roznamchaEntryId: string | null = null;
      if (existingPayment) {
        paymentId = String(existingPayment.id);
        roznamchaEntryId = existingPayment.roznamcha_entry_id;
        if (
          Number(existingPayment.amount) !== totalPurchaseAmount ||
          existingPayment.debit_ledger_id !== debitAccountObj.id ||
          existingPayment.credit_ledger_id !== creditAccountObj.id
        ) {
          throw new Error("An existing booking posting does not match this order's amount or selected DR/CR ledgers. Transfer was stopped for reconciliation.");
        }
        if (!roznamchaEntryId) {
          throw new Error("The existing booking payment is missing its Roznamcha entry.");
        }
      } else {
        const rpcRows = await tx`
          select post_purchase_booking_transfer(
            ${session.userId}::uuid,
            ${orderId}::uuid,
            ${"booking"}::purchase_order_payment_kind,
            ${now.slice(0, 10)}::date,
            ${totalPurchaseAmount},
            ${String(orderRow.currency_code || form.currencyType || "USD")},
            ${Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1},
            ${debitAccountObj.id}::uuid,
            ${creditAccountObj.id}::uuid,
            ${referenceNo},
            ${goodsAuditRemark}
          ) as payment_id
        `;
        paymentId = rpcRows[0]?.payment_id ? String(rpcRows[0].payment_id) : null;
        if (!paymentId) throw new Error("Business Roznamcha posting did not return a payment id.");
        const pRows = await tx`
          select roznamcha_entry_id
          from purchase_order_payments
          where id = ${paymentId}::uuid
          limit 1
        `;
        roznamchaEntryId = pRows[0]?.roznamcha_entry_id ?? null;
      }

      if (!paymentId || !roznamchaEntryId) {
        throw new Error("Business Roznamcha transfer did not create a complete booking payment.");
      }

      let rozType = "super_admin";
      if (effectiveCityBranchId) rozType = "branch";
      else if (effectiveCountryBranchId || effectiveCountryId) rozType = "country";

      await tx`
        update roznamcha_entries
        set country_id = ${effectiveCountryId}::uuid,
            country_branch_id = ${effectiveCountryBranchId}::uuid,
            city_branch_id = ${effectiveCityBranchId}::uuid,
            type = ${rozType},
            status = 'posted',
            entry_category = 'business'
        where id = ${roznamchaEntryId}::uuid
      `;

      const postedLines = await tx`
        select ledger_id, debit, credit
        from roznamcha_lines
        where roznamcha_entry_id = ${roznamchaEntryId}::uuid
      `;
      const exRate = Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1;
      assertDistinctBookingLedgers(debitAccountObj.id, creditAccountObj.id, "Business Roznamcha");
      assertBalancedPostedLines({
        label: "Business Roznamcha",
        lines: postedLines,
        expectedDebitLedgerId: debitAccountObj.id,
        expectedCreditLedgerId: creditAccountObj.id,
        expectedAmount: totalPurchaseAmount,
        expectedExchangeRate: exRate
      });

      const journalRecordRows = await tx`
        select id, source_module, source_transaction_type, source_transaction_id, source_reference_no, status, posted_at, country_id, country_branch_id, city_branch_id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number
        from roznamcha_entries
        where id = ${roznamchaEntryId}::uuid
        limit 1
      `;
      const journalRecord = journalRecordRows[0];
      if (!journalRecord) {
        throw new Error("Business Roznamcha posting verification failed: linked Roznamcha entry is missing.");
      }
      if (journalRecord.status !== "posted" || !journalRecord.posted_at) {
        throw new Error("Business Roznamcha posting verification failed: linked Roznamcha entry is not posted.");
      }
      if (!journalRecord.super_admin_serial_number || !journalRecord.country_transaction_serial_number) {
        throw new Error("Business Roznamcha posting verification failed: linked Roznamcha entry is missing authoritative serials.");
      }
      if ((effectiveCountryBranchId || effectiveCityBranchId) && !journalRecord.branch_transaction_serial_number) {
        throw new Error("Business Roznamcha posting verification failed: linked Roznamcha entry is missing branch serial.");
      }

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

      await tx`
        update purchase_orders
        set ledger_posting_status = 'posted',
            payment_status = ${newPaymentStatus},
            is_edited_since_transfer = false,
            advance_paid = ${existingAdvance},
            remaining_due = ${newRemainingDue},
            updated_at = ${now},
            form_data = ${tx.json(updatedFormData)}
        where id = ${orderId}::uuid
      `;

      return {
        success: true,
        purchaseOrderId: orderId,
        purchaseOrderNo: orderRow.purchase_order_no,
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
    });
  });
}
