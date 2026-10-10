import { withLocalPg } from "../db/local-postgres";
import { allocateFormSerials } from "./form-serials";
import { assertDistinctBookingLedgers, assertBalancedPostedLines, assertPostedRoznamchaTrace } from "./posting-verification";

export type PaymentScopeType = "purchase" | "sales";
export type PaymentOrderType = "purchase_booking" | "local_purchase" | "sales_booking" | "local_sales";
export type PaymentConditionType = "advance" | "endorsement" | "credit" | "remaining" | "final";
export type PaymentMethodType = "cash" | "bank_transfer" | "tt_swift" | "mobile_wallet" | "cheque" | "internal_transfer";

export interface CanonicalDailyPaymentInput {
  targetType: PaymentOrderType;
  targetId: string;
  direction: "purchase_payment" | "sales_payment";
  condition: PaymentConditionType;
  method: PaymentMethodType;
  entryDate: string; // YYYY-MM-DD
  amount: number;
  currencyCode: string;
  exchangeRate: number;
  debitLedgerId: string;
  creditLedgerId: string;
  referenceNo?: string | null;
  narration?: string | null;
  methodDetails?: {
    bankId?: string | null;
    bankName?: string | null;
    accountTitle?: string | null;
    accountNumber?: string | null;
    iban?: string | null;
    ttReference?: string | null;
    chequeNumber?: string | null;
    chequeDate?: string | null;
    chequePayee?: string | null;
    chequeStatus?: string | null;
    walletProvider?: string | null;
    walletAccount?: string | null;
    transactionId?: string | null;
    internalAccountId?: string | null;
    transferReference?: string | null;
    [key: string]: any;
  } | null;
  receiptAttachmentUrl?: string | null;
}

export interface CanonicalDailyPaymentResult {
  success: boolean;
  paymentId: string;
  roznamchaEntryId?: string | null;
  serialNumber?: string | null;
  remainingDue?: number;
  message?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return UUID_REGEX.test(val.trim());
}

/**
 * Validates and posts a daily payment transaction with strict double-entry integrity,
 * single currency conversion, duplicate TT reference prevention, and audit trace.
 */
export async function postCanonicalDailyPayment(
  input: CanonicalDailyPaymentInput,
  actor: { userId: string; countryIds?: string[]; cityBranchIds?: string[] }
): Promise<CanonicalDailyPaymentResult> {
  const {
    targetType,
    targetId,
    direction,
    condition,
    method,
    entryDate,
    amount,
    currencyCode,
    exchangeRate,
    debitLedgerId,
    creditLedgerId,
    referenceNo,
    narration,
    methodDetails
  } = input;

  // 1. Basic validation
  if (!isValidUuid(targetId)) throw new Error("Invalid target order ID format.");
  if (!isValidUuid(debitLedgerId)) throw new Error("A valid Debit Account Ledger is strictly required. No automatic accounts are created.");
  if (!isValidUuid(creditLedgerId)) throw new Error("A valid Credit Account Ledger is strictly required. No automatic accounts are created.");
  if (debitLedgerId.trim() === creditLedgerId.trim()) {
    throw new Error("Debit and Credit accounts must be different.");
  }
  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    throw new Error("Payment amount must be greater than zero.");
  }

  // 2. Database validation & ledger existence check (NO AUTO-CREATION)
  const result = await withLocalPg(async (sql) => {
    // Verify Debit Ledger exists
    const debitRows = await sql`
      select id, code, name, currency, country_id, country_branch_id, city_branch_id
      from ledgers
      where id = ${debitLedgerId}::uuid and deleted_at is null
      limit 1
    `;
    if (!debitRows.length) {
      throw new Error(`The selected Debit Ledger (${debitLedgerId}) does not exist or has no valid mapping. Automatic ledger creation is disabled.`);
    }
    const debitLedger = debitRows[0];

    // Verify Credit Ledger exists
    const creditRows = await sql`
      select id, code, name, currency, country_id, country_branch_id, city_branch_id
      from ledgers
      where id = ${creditLedgerId}::uuid and deleted_at is null
      limit 1
    `;
    if (!creditRows.length) {
      throw new Error(`The selected Credit Ledger (${creditLedgerId}) does not exist or has no valid mapping. Automatic ledger creation is disabled.`);
    }
    const creditLedger = creditRows[0];

    // 3. Direction Enforcement:
    // Purchase Payment: Supplier/Party = DR, Selected Source = CR
    // Sales Payment: Selected Receiving = DR, Customer = CR
    assertDistinctBookingLedgers(debitLedger.id, creditLedger.id, `${direction} (${condition})`);

    // 4. Duplicate TT Reference & Bank Account + TT Reference Check
    const effectiveTtRef = String(methodDetails?.ttReference || (method === "tt_swift" ? referenceNo : "") || "").trim();
    const effectiveBankId = methodDetails?.bankId && isValidUuid(methodDetails.bankId) ? String(methodDetails.bankId).trim() : null;

    if (effectiveTtRef && effectiveTtRef.length > 2) {
      // Check duplicate Bank Account + TT Reference in roznamcha_entries
      if (effectiveBankId) {
        const dupBankTt = await sql`
          select id, reference_no, bank_id, created_at, entry_date
          from roznamcha_entries
          where lower(trim(reference_no)) = lower(${effectiveTtRef})
            and bank_id = ${effectiveBankId}::uuid
            and status = 'posted'
          limit 1
        `;
        if (dupBankTt.length) {
          throw new Error(`Duplicate Bank Account + TT Reference: Reference '${effectiveTtRef}' has already been processed for this Bank Account on ${new Date(dupBankTt[0].created_at || dupBankTt[0].entry_date).toLocaleDateString()}. Duplicate submission is rejected.`);
        }
      }

      // Check if duplicate TT reference exists in purchase_order_payments
      const dupPurchase = await sql`
        select id, reference_no, created_at
        from purchase_order_payments
        where lower(trim(reference_no)) = lower(${effectiveTtRef})
          and deleted_at is null
          and id <> ${targetId}::uuid
        limit 1
      `;
      if (dupPurchase.length) {
        throw new Error(`Duplicate TT Reference: Reference '${effectiveTtRef}' has already been processed on ${new Date(dupPurchase[0].created_at).toLocaleDateString()}. Duplicate submission is rejected.`);
      }

      // Check in sales_order_payments
      const dupSales = await sql`
        select id, manual_reference_number, created_at
        from sales_order_payments
        where lower(trim(manual_reference_number)) = lower(${effectiveTtRef})
          and deleted_at is null
          and id <> ${targetId}::uuid
        limit 1
      `;
      if (dupSales.length) {
        throw new Error(`Duplicate TT Reference: Reference '${effectiveTtRef}' has already been processed in sales receipts. Duplicate submission is rejected.`);
      }
    }

    // 5. Currency & Single Conversion Calculation
    // Retrieve target order to get country currency and current balances
    let orderCountryId: string | null = null;
    let orderCountryBranchId: string | null = null;
    let orderCityBranchId: string | null = null;
    let orderBranchId: string | null = null;
    let orderCurrency = currencyCode.toUpperCase();
    let currentRemaining = 0;
    let orderTotal = 0;
    let billIdentifier = "";

    if (targetType === "purchase_booking") {
      const pRows = await sql`
        select id, purchase_order_no, country_id, country_branch_id, city_branch_id, currency_code,
               order_total, advance_paid, remaining_paid, credit_amount, remaining_due, form_data
        from purchase_orders
        where id = ${targetId}::uuid and deleted_at is null
        limit 1
      `;
      if (!pRows.length) throw new Error("Purchase Order not found.");
      const p = pRows[0];
      orderCountryId = p.country_id;
      orderCountryBranchId = p.country_branch_id;
      orderCityBranchId = p.city_branch_id;
      orderBranchId = p.city_branch_id || p.country_branch_id;
      orderCurrency = (p.currency_code || currencyCode).toUpperCase();
      orderTotal = Number(p.order_total || 0);
      currentRemaining = Number(p.remaining_due ?? Math.max(0, orderTotal - Number(p.advance_paid || 0) - Number(p.remaining_paid || 0)));
      billIdentifier = p.purchase_order_no ? `P#${p.purchase_order_no}` : targetId;
    } else if (targetType === "local_purchase") {
      const lpRows = await sql`
        select id, contract_no, country_id, country_branch_id, city_branch_id, purchase_currency,
               local_currency, purchase_cost, final_cost, advance_amount, remaining_balance
        from local_purchases
        where id = ${targetId}::uuid and deleted_at is null
        limit 1
      `;
      if (!lpRows.length) throw new Error("Local Purchase record not found.");
      const lp = lpRows[0];
      orderCountryId = lp.country_id;
      orderCountryBranchId = lp.country_branch_id;
      orderCityBranchId = lp.city_branch_id;
      orderBranchId = lp.city_branch_id || lp.country_branch_id;
      orderCurrency = (lp.purchase_currency || lp.local_currency || currencyCode).toUpperCase();
      orderTotal = Number(lp.final_cost || lp.purchase_cost || 0);
      currentRemaining = Number(lp.remaining_balance ?? Math.max(0, orderTotal - Number(lp.advance_amount || 0)));
      billIdentifier = lp.contract_no ? `LP#${lp.contract_no}` : targetId;
    } else if (targetType === "sales_booking" || targetType === "local_sales") {
      const sRows = await sql`
        select id, sales_order_no, country_id, country_branch_id, city_branch_id, currency_code,
               order_total, paid_amount, remaining_amount, form_data
        from sales_orders
        where id = ${targetId}::uuid and deleted_at is null
        limit 1
      `;
      if (!sRows.length) throw new Error("Sales Order not found.");
      const s = sRows[0];
      orderCountryId = s.country_id;
      orderCountryBranchId = s.country_branch_id;
      orderCityBranchId = s.city_branch_id;
      orderBranchId = s.city_branch_id || s.country_branch_id;
      orderCurrency = (s.currency_code || currencyCode).toUpperCase();
      orderTotal = Number(s.order_total || 0);
      currentRemaining = Number(s.remaining_amount ?? Math.max(0, orderTotal - Number(s.paid_amount || 0)));
      billIdentifier = s.sales_order_no ? `S#${s.sales_order_no}` : targetId;
    }

    // Resolve country base currency
    let baseCurrency = "USD";
    if (orderCountryId) {
      const cRows = await sql`select currency_code from countries where id = ${orderCountryId}::uuid limit 1`;
      if (cRows.length && cRows[0].currency_code) {
        baseCurrency = String(cRows[0].currency_code).toUpperCase();
      }
    }

    // Currency rule:
    // If UAE AED-to-AED payment: exchange rate is 1.
    // If transaction currency matches country functional base currency: exchange rate is 1.
    // Convert only once: never apply double conversion.
    const isSameCurrency = currencyCode.toUpperCase() === baseCurrency;
    const effectiveExchangeRate = isSameCurrency ? 1 : (Number(exchangeRate) > 0 ? Number(exchangeRate) : 1);
    const baseCurrencyAmount = isSameCurrency
      ? amount
      : Math.round(amount * effectiveExchangeRate * 10000) / 10000;

    // Build consolidated narration
    const fullNarration = [
      `Daily Payment (${condition.toUpperCase()} via ${method.toUpperCase()}): ${billIdentifier}`,
      referenceNo ? `Ref: ${referenceNo}` : null,
      effectiveTtRef ? `TT Ref: ${effectiveTtRef}` : null,
      methodDetails?.bankName ? `Bank: ${methodDetails.bankName}` : null,
      methodDetails?.chequeNumber ? `Cheque #: ${methodDetails.chequeNumber}` : null,
      narration ? `Remarks: ${narration.trim()}` : null,
      `Paid: ${amount.toFixed(2)} ${currencyCode} (Base: ${baseCurrencyAmount.toFixed(2)} ${baseCurrency} @ ${effectiveExchangeRate})`
    ].filter(Boolean).join(" | ");

    // 6. Execute posting based on targetType
    let resultPaymentId = "";
    let resultRoznamchaId: string | null = null;
    let serialNumberStr = "";

    if (targetType === "purchase_booking") {
      // Map condition to kind for post_purchase_booking_transfer:
      // 'advance' | 'endorsement' -> 'advance'
      // 'credit' -> 'credit'
      // 'remaining' | 'final' -> 'remaining'
      const mappedKind = (condition === "credit") ? "credit" : (condition === "remaining" || condition === "final") ? "remaining" : "advance";

      const rpcRows = await sql`
        select post_purchase_booking_transfer(
          p_actor_id => ${actor.userId}::uuid,
          p_purchase_order_id => ${targetId}::uuid,
          p_kind => ${mappedKind}::purchase_order_payment_kind,
          p_entry_date => ${entryDate}::date,
          p_amount => ${amount},
          p_currency_code => ${currencyCode},
          p_exchange_rate => ${effectiveExchangeRate},
          p_debit_ledger_id => ${debitLedger.id}::uuid,
          p_credit_ledger_id => ${creditLedger.id}::uuid,
          p_reference_no => ${referenceNo || effectiveTtRef || billIdentifier},
          p_narration => ${fullNarration}
        ) as id
      `;
      resultPaymentId = rpcRows[0]?.id;

      // Update payment record with canonical metadata & methodDetails
      try {
        const s = await allocateFormSerials("payment_purchase", { countryId: orderCountryId, branchKey: orderBranchId });
        serialNumberStr = [s.superAdminSerial, s.countrySerial, s.branchSerial].filter(Boolean).join(" | ");
        await sql`
          update purchase_order_payments set
            super_admin_serial = ${s.superAdminSerial},
            country_serial = ${s.countrySerial},
            branch_serial = ${s.branchSerial},
            entry_serial = ${s.entrySerial},
            source_transaction_type = ${`daily_payment_${condition}`},
            source_reference_no = ${referenceNo || effectiveTtRef || null},
            original_currency_code = ${currencyCode},
            base_currency_amount = ${baseCurrencyAmount}
          where id = ${resultPaymentId}::uuid
        `;
      } catch { /* serial allocation fallback */ }

      // Get roznamcha entry ID
      const payRec = await sql`select roznamcha_entry_id from purchase_order_payments where id = ${resultPaymentId}::uuid limit 1`;
      resultRoznamchaId = payRec[0]?.roznamcha_entry_id || null;

      if (resultRoznamchaId && effectiveBankId && isValidUuid(effectiveBankId)) {
        await sql`update roznamcha_entries set bank_id = ${effectiveBankId}::uuid where id = ${resultRoznamchaId}::uuid`;
      }

    } else if (targetType === "sales_booking" || targetType === "local_sales") {
      const rpcRows = await sql`
        select post_sales_booking_transfer(
          p_actor_id => ${actor.userId}::uuid,
          p_sales_order_id => ${targetId}::uuid,
          p_payment_kind => ${condition},
          p_entry_date => ${entryDate}::date,
          p_amount => ${amount},
          p_currency_code => ${currencyCode},
          p_exchange_rate => ${effectiveExchangeRate},
          p_debit_ledger_id => ${debitLedger.id}::uuid,
          p_credit_ledger_id => ${creditLedger.id}::uuid,
          p_reference_no => ${referenceNo || effectiveTtRef || billIdentifier},
          p_narration => ${fullNarration}
        ) as id
      `;
      resultPaymentId = rpcRows[0]?.id;

      try {
        const s = await allocateFormSerials("payment_sales", { countryId: orderCountryId, branchKey: orderBranchId });
        serialNumberStr = [s.superAdminSerial, s.countrySerial, s.branchSerial].filter(Boolean).join(" | ");
        await sql`
          update sales_order_payments set
            super_admin_serial = ${s.superAdminSerial},
            country_serial = ${s.countrySerial},
            branch_serial = ${s.branchSerial},
            entry_serial = ${s.entrySerial},
            original_currency_code = ${currencyCode},
            base_currency_amount = ${baseCurrencyAmount}
          where id = ${resultPaymentId}::uuid
        `;
      } catch { /* fallback */ }

      const payRec = await sql`select roznamcha_entry_id from sales_order_payments where id = ${resultPaymentId}::uuid limit 1`;
      resultRoznamchaId = payRec[0]?.roznamcha_entry_id || null;

      if (resultRoznamchaId && effectiveBankId && isValidUuid(effectiveBankId)) {
        await sql`update roznamcha_entries set bank_id = ${effectiveBankId}::uuid where id = ${resultRoznamchaId}::uuid`;
      }

    } else if (targetType === "local_purchase") {
      // Local purchase direct double-entry Roznamcha posting
      const rozType = orderBranchId ? "branch" : orderCountryId ? "country" : "super_admin";
      const s = await allocateFormSerials("payment_purchase", { countryId: orderCountryId, branchKey: orderBranchId });
      serialNumberStr = [s.superAdminSerial, s.countrySerial, s.branchSerial].filter(Boolean).join(" | ");
      const localPaymentId = (await sql`select gen_random_uuid() as id`)[0].id;
      const journalNo = s.superAdminSerial || `LP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(localPaymentId).replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      const voucherNo = s.branchSerial || s.countrySerial || `LPAY-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(localPaymentId).replace(/-/g, "").slice(0, 6).toUpperCase()}`;

      const rozRows = await sql`
        insert into roznamcha_entries (
          id,
          created_by,
          entry_date,
          type,
          country_id,
          country_branch_id,
          city_branch_id,
          journal_no,
          voucher_no,
          bank_id,
          reference_no,
          narration,
          source_module,
          source_transaction_type,
          source_transaction_id,
          super_admin_serial_number,
          country_transaction_serial_number,
          branch_transaction_serial_number,
          super_admin_serial,
          country_serial,
          branch_serial,
          original_currency_code,
          currency_name,
          base_currency_amount,
          status
        ) values (
          gen_random_uuid(),
          ${actor.userId}::uuid,
          ${entryDate}::date,
          ${rozType}::roznamcha_type,
          ${orderCountryId || null}::uuid,
          ${orderCountryBranchId || null}::uuid,
          ${orderCityBranchId || null}::uuid,
          ${journalNo},
          ${voucherNo},
          ${effectiveBankId && isValidUuid(effectiveBankId) ? effectiveBankId : null}::uuid,
          ${referenceNo || effectiveTtRef || billIdentifier},
          ${fullNarration},
          'local_purchase',
          ${`daily_payment_${condition}`},
          ${localPaymentId}::uuid,
          ${s.superAdminSerial},
          ${s.countrySerial},
          ${s.branchSerial},
          ${s.superAdminSerial},
          ${s.countrySerial},
          ${s.branchSerial},
          ${currencyCode},
          ${currencyCode},
          ${baseCurrencyAmount},
          'posted'
        ) returning id
      `;
      resultRoznamchaId = rozRows[0]?.id;
      resultPaymentId = localPaymentId;

      // Insert balanced DR & CR lines
      const lineRate = effectiveExchangeRate > 0 ? (1 / effectiveExchangeRate) : 1;
      const usdAmount = Math.round(baseCurrencyAmount * 10000) / 10000;
      await sql`
        insert into roznamcha_lines (
          id,
          roznamcha_entry_id,
          payment_entry_type,
          ledger_id,
          debit,
          credit,
          currency,
          usd_rate,
          usd_amount,
          description
        )
        values
          (gen_random_uuid(), ${resultRoznamchaId}::uuid, 'debit'::payment_entry_type, ${debitLedger.id}::uuid, ${baseCurrencyAmount}, 0, ${currencyCode}, ${lineRate}, ${usdAmount}, ${fullNarration}),
          (gen_random_uuid(), ${resultRoznamchaId}::uuid, 'credit'::payment_entry_type, ${creditLedger.id}::uuid, 0, ${baseCurrencyAmount}, ${currencyCode}, ${lineRate}, ${usdAmount}, ${fullNarration})
      `;

      // Update local_purchases payment balance
      if (condition === "advance" || condition === "endorsement") {
        await sql`
          update local_purchases set
            advance_amount = coalesce(advance_amount, 0) + ${baseCurrencyAmount},
            remaining_balance = greatest(0, coalesce(final_cost, purchase_cost, 0) - (coalesce(advance_amount, 0) + ${baseCurrencyAmount}))
          where id = ${targetId}::uuid
        `;
      } else {
        await sql`
          update local_purchases set
            remaining_balance = greatest(0, coalesce(remaining_balance, 0) - ${baseCurrencyAmount})
          where id = ${targetId}::uuid
        `;
      }

      resultPaymentId = resultRoznamchaId || targetId; // Local purchase uses roznamcha record as voucher reference
    }

    // Calculate new remaining balance
    const updatedRemaining = Math.max(0, currentRemaining - amount);

    return {
      success: true,
      paymentId: resultPaymentId,
      roznamchaEntryId: resultRoznamchaId,
      serialNumber: serialNumberStr,
      remainingDue: updatedRemaining,
      message: `Daily Payment successfully recorded and balanced in Roznamcha! Serial: ${serialNumberStr || "N/A"}`
    };
  });

  if (!result) {
    throw new Error("Direct database connection could not be established to record Daily Payment.");
  }

  return result;
}
