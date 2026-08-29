import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, apiError, handleApiError } from "@/lib/api/response";
import { purchaseOrderPaymentPostSchema, uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { writeAuditLog } from "@/lib/api/supabase";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { withLocalPg } from "@/lib/db/local-postgres";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { assertBalancedPostedLines, assertDistinctBookingLedgers, assertPostedRoznamchaTrace } from "@/lib/services/posting-verification";
import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";

const paramsSchema = z.object({
  id: uuidSchema
});

function buildPurchaseTrace(orderRow: any, fallbackReference?: string | null) {
  const data = orderRow.form_data ?? {};
  const form = data.form ?? {};
  const systemBillNumber = String(orderRow.purchase_order_no || form.purchaseOrderNo || "").trim();
  const manualBillNumber = String(
    form.manualBillNumber ||
      form.manual_bill_number ||
      form.billNo ||
      form.purchaseContractNo ||
      orderRow.purchase_contract_no ||
      fallbackReference ||
      ""
  ).trim();
  const partyName = String(
    form.purchaseAccountName || form.supplierName || form.salesAccountName || form.customerName || "Purchase Party"
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

async function assertLedgerMatchesPurchaseScope(sql: any, ledgerId: string, orderRow: any, label: string) {
  let rows = await sql`
    select id, code, name, country_id, country_branch_id, city_branch_id
    from ledgers where id = ${ledgerId}::uuid and deleted_at is null
  `;
  let ledger = rows[0];

  if (!ledger && ledgerId) {
    // Compatibility fallback: some callers pass an accounts.id instead of the ledger's own id
    // (ledgers.account_id is a separate FK, not the same UUID as ledgers.id). Resolve the
    // ledger linked to that account rather than failing outright.
    const byAccount = await sql`
      select id, code, name, country_id, country_branch_id, city_branch_id
      from ledgers where account_id = ${ledgerId}::uuid and deleted_at is null
    `;
    if (byAccount[0]) ledger = byAccount[0];
  }

  if (!ledger) {
    throw new Error(label + " ledger was not found.");
  }

  if (orderRow.country_id && ledger.country_id && ledger.country_id !== orderRow.country_id) {
    throw new Error(label + " ledger belongs to a different country and cannot be used for this purchase.");
  }

  if (orderRow.city_branch_id && ledger.city_branch_id && ledger.city_branch_id !== orderRow.city_branch_id) {
    throw new Error(label + " ledger belongs to a different city branch and cannot be used for this purchase.");
  }

  if (!orderRow.city_branch_id && orderRow.country_branch_id && ledger.country_branch_id && ledger.country_branch_id !== orderRow.country_branch_id) {
    throw new Error(label + " ledger belongs to a different main branch and cannot be used for this purchase.");
  }

  return ledger;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    // withLocalPg, not the RLS-gated Supabase client — see the POST handler below for why.
    const { order, rows } = (await withLocalPg(async (sql) => {
      const orderRows = await sql`
        select id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
               currency_code, exchange_rate, order_total, advance_paid, remaining_paid, credit_amount,
               remaining_due, form_data, ledger_posting_status, payment_status
        from purchase_orders where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      const paymentRows = await sql`
        select
          p.id, p.purchase_order_id, p.kind, p.entry_date, p.amount, p.currency_code, p.exchange_rate,
          p.debit_ledger_id, p.credit_ledger_id, p.roznamcha_entry_id, p.status, p.reference_no,
          p.narration, p.source_module, p.source_transaction_type, p.source_reference_no,
          p.original_currency_code, p.currency_name, p.base_currency_amount, p.created_at,
          case when re.id is not null then jsonb_build_object(
            'id', re.id,
            'super_admin_serial_number', re.super_admin_serial_number,
            'country_transaction_serial_number', re.country_transaction_serial_number,
            'branch_transaction_serial_number', re.branch_transaction_serial_number,
            'profiles', case when pr.id is not null then jsonb_build_object('full_name', pr.full_name) else null end
          ) else null end as roznamcha_entries
        from purchase_order_payments p
        left join roznamcha_entries re on re.id = p.roznamcha_entry_id
        left join profiles pr on pr.id = re.created_by
        where p.purchase_order_id = ${params.id}::uuid and p.deleted_at is null
        order by p.created_at desc
        limit 200
      `;
      return { order: orderRows[0] ?? null, rows: paymentRows };
    }))!;

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null
    });

    const localizedPayments = await localizeRecordNames(
      (rows ?? []) as unknown as Array<{ id: string; narration?: string | null }>,
      "purchase_order_payments",
      "narration",
      lang
    );

    return apiOk({ payments: localizedPayments, limit: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const contentType = request.headers.get("content-type") || "";
    let body: any;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const payloadStr = formData.get("payload");
      if (!payloadStr) {
        throw new Error("Missing payload in multipart request.");
      }
      body = purchaseOrderPaymentPostSchema.parse(JSON.parse(String(payloadStr)));
    } else {
      body = purchaseOrderPaymentPostSchema.parse(await request.json());
    }

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "PURCHASE_PAYMENT",
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] ?? null,
      businessReference: params.id || body?.referenceNo || (body as any)?.roznamchaNumber,
      payload: body
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 201, lockRes.responseBody);
    }

    if (!lockRes.acquired) {
      return handleApiError(new Error("A request with this idempotency key is currently being processed or duplicate submission detected. Please wait."));
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured. Purchase posting requires a real Supabase login.");
    }

    // withLocalPg, not the RLS-gated Supabase client (createApiSupabaseClient falls back to a
    // session-cookie client when no real service-role secret is configured — see
    // hasRealServiceRoleKey in lib/api/supabase.ts — and the dev bootstrap login has no real
    // Supabase JWT, so that fallback has no identity for RLS to authorize). Every read/write in
    // this handler below now goes through the same withLocalPg connection. The core posting
    // itself (post_purchase_booking_transfer) is SECURITY DEFINER and already bypasses RLS
    // internally by design — it's only the setup/bookkeeping reads and writes around it that
    // were failing.
    const order = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
               currency_code, exchange_rate, order_total, advance_paid, remaining_paid, credit_amount,
               remaining_due, form_data, ledger_posting_status, payment_status
        from purchase_orders where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    });

    authorizeApiScope(session, {
      resource: "purchases",
      action: "post",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null
    });

    if (!order) {
      return apiError("NOT_FOUND", "Purchase order not found.", 404);
    }

    const orderRow = order as any;
    const form = orderRow.form_data?.form || {};

    // Currency model (see 20261001_multicurrency_purchase_payment_fix.sql):
    //  - order_total / advance_paid / remaining_paid / credit_amount / remaining_due
    //    are all in the PURCHASE currency (orderRow.currency_code).
    //  - orderRate = base-currency units per 1 purchase-currency unit.
    //  - body.exchangeRate = base-currency units per 1 body.currencyCode unit
    //    (the historical FX rate for this payment).
    // All balance validation below is done in the PURCHASE currency.
    const orderCcy = (orderRow.currency_code || orderRow.purchase_currency || "USD").toUpperCase();
    let orderRate = Number(orderRow.exchange_rate || 0);
    if (orderRate <= 0) orderRate = Number(form.exchangeRate || 1) || 1;
    const bodyCcy = (body.currencyCode || orderCcy).toUpperCase();
    let bodyRate = Number(body.exchangeRate || 0);
    if (bodyRate <= 0) bodyRate = bodyCcy === orderCcy ? orderRate : 1;

    // the payment amount expressed in the order's (purchase) currency
    const toPurchaseCcy = (amt: number, ccy: string, rate: number) =>
      ccy === orderCcy ? amt : (amt * rate) / (orderRate || 1);

    const orderTotalPur = Number(orderRow.order_total || 0);
    const advancePaidPur = Number(orderRow.advance_paid || 0);
    const remainingPaidPur = Number(orderRow.remaining_paid || 0);
    const creditAmountPur = Number(orderRow.credit_amount || 0);

    let remainingDuePur = 0;
    if (orderRow.remaining_due != null) {
      remainingDuePur = Number(orderRow.remaining_due);
    } else {
      remainingDuePur = Math.max(0, orderTotalPur - advancePaidPur - remainingPaidPur - creditAmountPur);
    }

    const goodsEntries = Array.isArray(orderRow.form_data?.goodsEntries) ? orderRow.form_data.goodsEntries : [];
    const formTotalPur = goodsEntries.length
      ? goodsEntries.reduce((sum: number, item: any) => sum + Number(item.totalAmount || 0), 0)
      : Number(form.totalAmount || orderTotalPur);

    const advancePercent = Number(form.advancePercent || 0);
    const requiredAdvancePur = advancePercent > 0 ? (formTotalPur * advancePercent) / 100 : 0;
    const remainingAdvancePur = Math.max(0, requiredAdvancePur - advancePaidPur);
    const tolerance = 0.01;

    const debitLedger = await withLocalPg((sql) => assertLedgerMatchesPurchaseScope(sql, body.debitLedgerId, orderRow, "Debit")) as any;
    const creditLedger = await withLocalPg((sql) => assertLedgerMatchesPurchaseScope(sql, body.creditLedgerId, orderRow, "Credit")) as any;
    // Use the resolved ledger rows' own ids from here on — the client may have sent an
    // accounts.id (see the compatibility fallback above), which is a different UUID.
    const resolvedDebitLedgerId = debitLedger.id;
    const resolvedCreditLedgerId = creditLedger.id;
    if (resolvedDebitLedgerId === resolvedCreditLedgerId) {
      throw new Error("Debit and credit ledgers must be different for purchase payment posting.");
    }
    const trace = buildPurchaseTrace(orderRow, body.referenceNo ?? null);
    const postingReferenceNo = body.referenceNo?.trim() || trace.referenceNo;
    const goodsAuditRemark = buildPurchaseGoodsAuditRemark(orderRow, postingReferenceNo);
    const postingNarration = [
      goodsAuditRemark,
      body.narration?.trim() ? "Notes: " + body.narration.trim() : null,
      trace.narrationPrefix,
      "Payment Currency: " + body.currencyCode,
      "Exchange Rate: " + body.exchangeRate,
      "Paid Amount: " + body.amount
    ].filter(Boolean).join(" | ");

    // payment amount, expressed in the order's purchase currency, for validation
    const bodyAmountPur = toPurchaseCcy(Number(body.amount), bodyCcy, bodyRate);

    if (body.kind === "advance" && advancePercent > 0) {
      const maxAllowedAdvancePur = Math.max(remainingAdvancePur, remainingDuePur);
      if (remainingDuePur <= tolerance) {
        throw new Error("This purchase order is already fully paid. Duplicate posting is not allowed.");
      }
      if (bodyAmountPur > maxAllowedAdvancePur + tolerance) {
        throw new Error(`Payment amount cannot exceed remaining purchase order balance (${remainingDuePur.toFixed(2)} ${orderCcy}).`);
      }
    }

    if ((body.kind === "remaining" || body.kind === "credit") && remainingDuePur <= tolerance) {
      throw new Error("This purchase order has no remaining payable balance. Duplicate posting is not allowed.");
    }

    if ((body.kind === "remaining" || body.kind === "credit") && bodyAmountPur > remainingDuePur + tolerance) {
      throw new Error(`Payment amount cannot exceed remaining payable balance (${remainingDuePur.toFixed(2)} ${orderCcy}).`);
    }

    // Pass the raw payment facts straight through — post_purchase_order_payment
    // owns all the currency logic (transaction ccy vs base ccy vs order ccy) and
    // freezes the real historical rate on the payment row.
    const effectiveRoznamchaExchangeRate = bodyRate;

    // Transaction-safe posting via the security definer wrapper post_purchase_booking_transfer —
    // calling it directly over the raw Postgres connection is equivalent to (and more reliable
    // than) the Supabase RPC call, since the function is SECURITY DEFINER either way.
    const { paymentId, paymentRecord, journalRecord, journalLines } = await withLocalPg(async (sql) => {
      const idRows = await sql`
        select post_purchase_booking_transfer(
          p_actor_id => ${session.userId}::uuid,
          p_purchase_order_id => ${params.id}::uuid,
          p_kind => ${body.kind}::purchase_order_payment_kind,
          p_entry_date => ${body.entryDate}::date,
          p_amount => ${body.amount},
          p_currency_code => ${body.currencyCode},
          p_exchange_rate => ${effectiveRoznamchaExchangeRate},
          p_debit_ledger_id => ${resolvedDebitLedgerId}::uuid,
          p_credit_ledger_id => ${resolvedCreditLedgerId}::uuid,
          p_reference_no => ${postingReferenceNo},
          p_narration => ${postingNarration || null}
        ) as id
      `;
      const paymentId = idRows[0]?.id as string;

      // 4-level serial (Global/Country/Branch/Entry)
      try {
        const s = await allocateFormSerials("payment_purchase", { countryId: orderRow.country_id, branchKey: orderRow.country_branch_id ?? orderRow.city_branch_id ?? null });
        await sql`update purchase_order_payments set super_admin_serial = ${s.superAdminSerial}, country_serial = ${s.countrySerial}, branch_serial = ${s.branchSerial}, entry_serial = ${s.entrySerial} where id = ${paymentId}::uuid`;
      } catch { /* non-fatal — never affects posting */ }

      if (body.typeDetails?.sourceRecordId) {
        await sql`update purchase_order_payments set source_reference_no = ${String(body.typeDetails.sourceRecordId)} where id = ${paymentId}::uuid`;
      }

      const paymentRows = await sql`
        select id, purchase_order_id, kind, amount, currency_code, exchange_rate, debit_ledger_id,
               credit_ledger_id, roznamcha_entry_id, status, source_module, source_transaction_type,
               source_reference_no, original_currency_code, currency_name, base_currency_amount
        from purchase_order_payments
        where id = ${paymentId}::uuid and purchase_order_id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      const paymentRecord = paymentRows[0] as any;

      if (!paymentRecord?.roznamcha_entry_id) {
        throw new Error("Purchase payment was created but the linked Journal/Roznamcha entry is missing.");
      }

      let rozType = "super_admin";
      if (orderRow.city_branch_id) rozType = "branch";
      else if (orderRow.country_branch_id || orderRow.country_id) rozType = "country";

      await sql`
        update roznamcha_entries set
          country_id = ${orderRow.country_id || null}::uuid,
          country_branch_id = ${orderRow.country_branch_id || null}::uuid,
          city_branch_id = ${orderRow.city_branch_id || null}::uuid,
          type = ${rozType},
          bank_id = coalesce(${(body.typeDetails as any)?.bankId || null}::uuid, bank_id)
        where id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      const journalRows = await sql`
        select id, source_module, source_transaction_type, source_transaction_id, source_reference_no,
               status, posted_at, country_id, country_branch_id, city_branch_id,
               super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number,
               original_currency_code, currency_name, base_currency_amount
        from roznamcha_entries where id = ${paymentRecord.roznamcha_entry_id}::uuid
        limit 1
      `;
      const journalRecord = journalRows[0] as any;

      const journalLines = await sql`
        select id, ledger_id, debit, credit, currency, usd_rate, usd_amount
        from roznamcha_lines where roznamcha_entry_id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      return { paymentId, paymentRecord, journalRecord, journalLines };
    }) as any;

    assertDistinctBookingLedgers(resolvedDebitLedgerId, resolvedCreditLedgerId, "Purchase payment");
    assertBalancedPostedLines({
      label: "Purchase payment",
      lines: journalLines,
      expectedDebitLedgerId: resolvedDebitLedgerId,
      expectedCreditLedgerId: resolvedCreditLedgerId,
      expectedAmount: Number(body.amount),
      // the posted lines are in the base currency; base = amount × frozen rate
      expectedExchangeRate: bodyRate,
      expectedBaseAmount: Number(paymentRecord.base_currency_amount ?? Number(body.amount) * bodyRate)
    });
    assertPostedRoznamchaTrace({
      label: "Purchase payment",
      entry: journalRecord
    });

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
      sourceModule: "purchase",
      sourceTransactionType: paymentRecord.source_transaction_type || (body.kind === "booking" ? "purchase_booking_transfer" : "purchase_payment"),
      systemBillNumber: trace.systemBillNumber,
      manualBillNumber: trace.manualBillNumber,
      partyName: trace.partyName,
      referenceNo: postingReferenceNo
    };

    await withLocalPg(async (sql) => {
      const nextFormData = {
        ...(orderRow.form_data || {}),
        workflow: postedWorkflow,
        lastPaymentTrace: {
          paymentId,
          roznamchaEntryId: paymentRecord.roznamcha_entry_id,
          debitLedgerId: resolvedDebitLedgerId,
          creditLedgerId: resolvedCreditLedgerId,
          originalCurrencyCode: paymentRecord.original_currency_code || body.currencyCode,
          currencyName: paymentRecord.currency_name || body.currencyCode,
          exchangeRate: paymentRecord.exchange_rate || body.exchangeRate,
          baseCurrencyAmount: paymentRecord.base_currency_amount,
          superAdminSerialNumber: journalRecord.super_admin_serial_number,
          countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
          branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number,
          systemBillNumber: trace.systemBillNumber,
          manualBillNumber: trace.manualBillNumber,
          debitLedgerCode: debitLedger.code,
          creditLedgerCode: creditLedger.code
        }
      };
      await sql`
        update purchase_orders set form_data = ${sql.json(nextFormData)}, updated_at = now()
        where id = ${params.id}::uuid
      `;
    });

    await writeAuditLog({
      action: "post_payment",
      entityTable: "purchase_order_payments",
      entityId: paymentId,
      before: null,
      after: {
        purchaseOrderId: params.id,
        kind: body.kind,
        amount: body.amount,
        currencyCode: body.currencyCode,
        exchangeRate: body.exchangeRate,
        debitLedgerId: resolvedDebitLedgerId,
        creditLedgerId: resolvedCreditLedgerId,
        systemBillNumber: trace.systemBillNumber,
        manualBillNumber: trace.manualBillNumber,
        partyName: trace.partyName,
        referenceNo: postingReferenceNo
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    // Check if advance payment is completed
    try {
      await withLocalPg(async (sql) => {
        const updatedRows = await sql`
          select id, purchase_order_no, country_id, country_branch_id, city_branch_id, order_total,
                 advance_paid, remaining_due, form_data
          from purchase_orders where id = ${params.id}::uuid and deleted_at is null
          limit 1
        `;
        const updated = updatedRows[0] as any;
        if (!updated) return;

        const form = updated.form_data?.form ?? {};
        const advancePercent = Number(form.advancePercent ?? 10);
        const orderTotal = Number(updated.order_total || 0);
        const requiredAdvance = (orderTotal * advancePercent) / 100;
        const advancePaid = Number(updated.advance_paid || 0);
        const remainingDue = Number(updated.remaining_due || 0);

        const isAdvanceCompleted = requiredAdvance > 0 && advancePaid >= requiredAdvance;
        const isFullyPaid = remainingDue <= 0.01;

        if (isFullyPaid) {
          const completedWorkflow = {
            ...(updated.form_data?.workflow || {}),
            lifecycleStatus: "Completed",
            paymentStatus: "completed",
            completedAt: new Date().toISOString(),
            completedBy: session.userId,
            completedByName: session.fullName || session.email || "User"
          };
          const nextFormData = { ...(updated.form_data || {}), workflow: completedWorkflow };
          await sql`
            update purchase_orders set payment_status = 'completed', remaining_due = 0,
              form_data = ${sql.json(nextFormData)}, updated_at = now()
            where id = ${params.id}::uuid
          `;
        }

        if (isAdvanceCompleted && !isFullyPaid) {
          const existingLoading = await sql`
            select id from purchase_loading_records
            where purchase_order_id = ${params.id}::uuid and deleted_at is null
            limit 1
          `;

          if (existingLoading.length === 0) {
            const containerNumber = String(form.containerNo || form.containerNumber || `CONT-${updated.purchase_order_no}`).trim();
            const containerType = form.containerType || null;
            const plrNo = `PLR-${Date.now().toString(36).toUpperCase()}`;

            await sql`
              insert into purchase_loading_records ${sql({
                country_id: updated.country_id,
                country_branch_id: updated.country_branch_id,
                city_branch_id: updated.city_branch_id,
                purchase_order_id: updated.id,
                purchase_order_no: updated.purchase_order_no,
                loading_record_no: plrNo,
                container_number: containerNumber,
                container_type: containerType,
                loading_status: "pending",
                loading_location: form.loadingPort || null,
                receiving_location: form.receivedPort || form.exitPort || null,
                shipment_status: "pending",
                carrier_name: form.vesselName || form.shipName || null,
                remarks: `Automatically moved to loading module after 100% advance completion of PO ${updated.purchase_order_no}`,
                report_payload: updated.form_data ?? {},
                created_by: session.userId
              } as any)}
            `;
          }
        }
      });
    } catch (err: any) {
      console.error("Error in post payment completion check:", err);
    }

    const resPayload = { paymentId };
    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 201, resPayload);
    }
    return apiCreated(resPayload);
  } catch (error) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    return handleApiError(error);
  }
}
