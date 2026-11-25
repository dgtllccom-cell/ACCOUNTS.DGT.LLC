import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiClientError, apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { assertFinancialAccess } from "@/lib/permissions/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { withLocalPg } from "@/lib/db/local-postgres";
import { withKeyedLock } from "@/lib/db/keyed-lock";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { assertBalancedPostedLines, assertDistinctBookingLedgers, assertPostedRoznamchaTrace } from "@/lib/services/posting-verification";
import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { getBookingCurrencies } from "@/lib/sales/booking-currencies";
import { configuredSalesReceipt, salesReceiptBalances } from "@/lib/sales/payment-settlement";
import { normalizeLegacySalesPaymentSources } from "@/lib/sales/legacy-payment-sources";

const paramsSchema = z.object({
  id: uuidSchema
});

const salesOrderPaymentPostSchema = z.object({
  kind: z.enum(["advance", "remaining", "credit", "cash", "receipt", "invoice"]),
  entryDate: z.string(),
  amount: z.coerce.number().min(0.01),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  exchangeRate: z.coerce.number().min(0.000001),
  debitLedgerId: uuidSchema,
  creditLedgerId: uuidSchema,
  referenceNo: z.string().optional().nullable(),
  narration: z.string().optional().nullable(),
  typeDetails: z.record(z.string(), z.unknown()).optional().nullable()
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

async function assertLedgerMatchesSalesScope(sql: any, ledgerId: string, orderRow: any, label: string) {
  const rows = await sql`
    select l.id, l.code, l.name, l.country_id, l.country_branch_id, l.city_branch_id
    from public.ledgers l
    left join public.enterprise_accounts ea on ea.id = l.enterprise_account_id
    where l.deleted_at is null and l.is_active and (l.id = ${ledgerId}::uuid or l.account_id = ${ledgerId}::uuid
      or l.enterprise_account_id = ${ledgerId}::uuid)
      and (ea.id is null or (ea.deleted_at is null and coalesce(ea.operational_domain, 'business') in ('business', 'both')))
    order by (l.id = ${ledgerId}::uuid) desc, l.id
    limit 2
  `;
  const ledger = rows[0];
  if (rows.length > 1 && ledger?.id !== ledgerId) throw new Error(label + " ledger is ambiguous.");

  if (!ledger) {
    throw new Error(label + " ledger was not found.");
  }

  if (orderRow.country_id && ledger.country_id && ledger.country_id !== orderRow.country_id) {
    throw new Error(label + " ledger belongs to a different country and cannot be used for this sales booking.");
  }

  if (orderRow.country_branch_id && ledger.country_branch_id && ledger.country_branch_id !== orderRow.country_branch_id) {
    throw new Error(label + " ledger belongs to a different main branch and cannot be used for this sales booking.");
  }

  if (orderRow.city_branch_id && ledger.city_branch_id && ledger.city_branch_id !== orderRow.city_branch_id) {
    throw new Error(label + " ledger belongs to a different city branch and cannot be used for this sales booking.");
  }

  return ledger;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    assertFinancialAccess(session);
    const params = paramsSchema.parse(await context.params);
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    // withLocalPg, not the RLS-gated Supabase client — see the POST handler for why.
    const { order, rows } = (await withLocalPg(async (sql) => {
      const orderRows = await sql`
        select id, sales_order_no, sales_contract_no, country_id, country_branch_id, city_branch_id,
               currency_code, exchange_rate, order_total, total_goods_original, total_goods_usd,
               customer_ledger_id, customer_account_id, paid_amount, remaining_amount, form_data,
               ledger_posting_status, payment_status
        from sales_orders where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      const paymentRows = await sql`
        select
          p.id, p.sales_order_id, p.payment_kind, p.payment_date, p.amount, p.currency_code, p.exchange_rate,
          p.roznamcha_entry_id, p.status, p.remarks, p.created_at, p.base_currency_amount,
          re.status as journal_status, re.operational_domain, re.deleted_at as journal_deleted_at,
          case when re.id is not null then jsonb_build_object(
            'id', re.id,
            'super_admin_serial_number', re.super_admin_serial_number,
            'country_transaction_serial_number', re.country_transaction_serial_number,
            'branch_transaction_serial_number', re.branch_transaction_serial_number,
            'profiles', case when pr.id is not null then jsonb_build_object('full_name', pr.full_name) else null end
          ) else null end as roznamcha_entries
        from sales_order_payments p
        left join roznamcha_entries re on re.id = p.roznamcha_entry_id
        left join profiles pr on pr.id = re.created_by
        join public.sales_orders o on o.id = p.sales_order_id and o.deleted_at is null
        where p.sales_order_id = ${params.id}::uuid and p.deleted_at is null
          and p.id::text is distinct from o.form_data->'transferTrace'->>'paymentId'
          and p.roznamcha_entry_id::text is distinct from o.form_data->'transferVerification'->>'journalId'
          and p.payment_kind <> 'booking'
        order by p.created_at desc
        limit 200
      `;
      return { order: orderRows[0] ?? null, rows: paymentRows };
    }))!;

    authorizeApiScope(session, {
      resource: "sales",
      action: "read",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null
    });

    const localizedRows = await localizeRecordNames(
      (rows ?? []) as unknown as Array<{ id: string; remarks?: string | null }>,
      "sales_order_payments",
      "remarks",
      lang
    );

    const mapped = localizedRows.map((row: any) => ({
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

async function postPaymentHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    assertFinancialAccess(session);
    const params = paramsSchema.parse(await context.params);
    const body = salesOrderPaymentPostSchema.parse(await request.json());

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "SALES_PAYMENT",
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
      throw new Error("Supabase is not configured. Sales posting requires a real Supabase login.");
    }

    // withLocalPg, not the RLS-gated Supabase client (createApiSupabaseClient falls back to a
    // session-cookie client when no real service-role secret is configured, and the dev
    // bootstrap login has no real Supabase JWT for RLS to authorize against — same root cause
    // as the purchase order payments route, same fix). post_sales_booking_transfer is
    // SECURITY DEFINER and already bypasses RLS internally by design.
    const order = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, sales_order_no, sales_contract_no, country_id, country_branch_id, city_branch_id,
               currency_code, exchange_rate, order_total, total_goods_original, total_goods_usd,
               customer_ledger_id, customer_account_id, paid_amount, remaining_amount, form_data,
               ledger_posting_status, payment_status
        from sales_orders where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    });

    authorizeApiScope(session, {
      resource: "sales",
      action: "post",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null
    });

    if (!order) {
      throw new ApiClientError("Sales order not found.", { status: 404, code: "NOT_FOUND" });
    }

    const orderRow = order as any;
    const form = orderRow.form_data?.form || {};
    const currency = getBookingCurrencies(form);
    const configured = form.bookingCurrencyConfigured === true;
    const legacyExchangeRate = Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1;
    // Balances on sales_orders are saved in the original Sales Booking currency.
    const totalOriginal = Number(orderRow.total_goods_original || orderRow.total_goods_usd || (
      configured && currency.rate.ok
        ? (currency.rate.operator === "/" ? Number(orderRow.order_total) * currency.rate.rate : Number(orderRow.order_total) / currency.rate.rate)
        : Number(orderRow.order_total || 0) / Math.max(1, legacyExchangeRate)
    ));
    const advancePercent = Number(form.advancePercent || 0);
    const requiredAdvance = totalOriginal * Math.max(0, advancePercent) / 100;
    const configuredReceipt = configured && currency.rate.ok ? configuredSalesReceipt({
      amount: body.amount, currency: body.currencyCode, salesCurrency: currency.sales, finalCurrency: currency.final,
      rate: currency.rate.rate, operator: currency.rate.operator,
    }) : null;
    if (configured && (!configuredReceipt || currency.final !== orderRow.currency_code)) {
      throw new ApiClientError("The final currency does not match the approved Sales Booking.", { status: 409, code: "SALES_BOOKING_FX_MISMATCH" });
    }

    const debitLedger = await withLocalPg((sql) => assertLedgerMatchesSalesScope(sql, body.debitLedgerId, orderRow, "Debit")) as any;
    const creditLedger = await withLocalPg((sql) => assertLedgerMatchesSalesScope(sql, body.creditLedgerId, orderRow, "Credit")) as any;
    const resolvedDebitLedgerId = debitLedger.id;
    const resolvedCreditLedgerId = creditLedger.id;
    const postingLabel = t(session.preferredLanguage, "nav.sales_transfer_payment");
    assertDistinctBookingLedgers(resolvedDebitLedgerId, resolvedCreditLedgerId, postingLabel);

    const customerLedgerIds = [orderRow.form_data?.transferTrace?.debitLedgerId,
      orderRow.customer_ledger_id, orderRow.customer_account_id, form.customerAccountLedgerId, form.customerAccountId]
      .map(id => uuidSchema.safeParse(id)).flatMap(id => id.success ? [id.data] : []);
    const customerMatch = customerLedgerIds.length ? await withLocalPg(async (sql) => {
      const rows = await sql`select id from public.ledgers where id = ${resolvedCreditLedgerId}::uuid and deleted_at is null
        and (id = any(${customerLedgerIds}::uuid[]) or account_id = any(${customerLedgerIds}::uuid[])
          or enterprise_account_id = any(${customerLedgerIds}::uuid[])) limit 1`;
      return rows[0];
    }) : null;
    if (!customerMatch) throw new ApiClientError("The receipt credit must be the booking’s customer ledger.", { status: 409, code: "SALES_RECEIPT_CUSTOMER_LEDGER" });

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

    const isOrderCurrency = body.currencyCode === (orderRow.currency_code || "USD").toUpperCase();
    const originalReceipt = configuredReceipt?.originalAmount ?? (isOrderCurrency ? body.amount : body.amount / body.exchangeRate);
    const postingAmount = configuredReceipt?.finalAmount ?? body.amount;
    const postingCurrency = configuredReceipt?.finalCurrency ?? body.currencyCode;
    const postingRate = configuredReceipt ? 1 : (isOrderCurrency ? body.exchangeRate : 1);

    // Lock the same order as the booking transfer. Assert and update the actual receipt balance in
    // this transaction, so the transfer voucher can never be counted as cash received.
    const core = await withLocalPg((sqlConn) => sqlConn.begin(async (sql: any) => {
      const lockedRows = await sql`
        select o.paid_amount, o.form_data, o.order_total, o.currency_code, o.total_goods_original, o.exchange_rate,
               c.currency_code as country_currency
        from public.sales_orders o left join public.countries c on c.id = o.country_id
        where o.id = ${params.id}::uuid and o.deleted_at is null for update of o
      `;
      if (lockedRows.length !== 1) throw new Error("The sales order was not found before posting the receipt.");
      const locked = lockedRows[0];
      if (String(locked.order_total) !== String(orderRow.order_total)
        || String(locked.total_goods_original) !== String(orderRow.total_goods_original)
        || String(locked.currency_code) !== String(orderRow.currency_code)
        || String(locked.exchange_rate) !== String(orderRow.exchange_rate)
        || Number(locked.form_data?.form?.advancePercent || 0) !== advancePercent) {
        throw new ApiClientError("The Sales Booking was edited before the receipt posted. Refresh and try again.", { status: 409, code: "SALES_BOOKING_CHANGED" });
      }
      if (configuredReceipt && String(locked.country_currency || "").toUpperCase() !== configuredReceipt.finalCurrency) {
        throw new ApiClientError("Final currency is not the booking country's current accounting currency.", {
          status: 409, code: "SALES_BOOKING_FX_MISMATCH",
        });
      }
      const trace = locked.form_data?.transferTrace;
      const transferJournalId = trace?.roznamchaEntryId || locked.form_data?.transferVerification?.journalId || null;
      await normalizeLegacySalesPaymentSources(sql, params.id, resolvedCreditLedgerId, transferJournalId);

      let previouslyReceived: number | undefined;
      if (configuredReceipt) {
        const funds = await sql`
          select count(*)::int as receipt_count, count(received)::int as priced_count, coalesce(sum(received),0) as total
          from (
            select case when upper(p.currency_code) = ${configuredReceipt.finalCurrency} then p.amount
                        else p.base_currency_amount end as received
            from public.sales_order_payments p
            join public.roznamcha_entries re on re.id = p.roznamcha_entry_id
            where p.sales_order_id = ${params.id}::uuid and p.deleted_at is null and p.status = 'posted'
              and re.status = 'posted' and re.deleted_at is null and coalesce(re.operational_domain, 'business') = 'business'
              and p.payment_kind <> 'booking'
              and re.source_transaction_type is distinct from 'sales_transfer_to_payment'
              and p.id::text is distinct from ${trace?.paymentId ?? null}
              and re.id::text is distinct from ${transferJournalId}
          ) receipts
        `;
        const sum = funds[0];
        if (sum?.receipt_count > 0) {
          if (sum.priced_count !== sum.receipt_count) throw new Error("An earlier sales receipt is missing its final currency amount.");
          previouslyReceived = Number(sum.total);
          if (currency.rate.ok) {
            const factor = currency.rate.operator === "/" ? 1 / currency.rate.rate : currency.rate.rate;
            const impliedOriginal = Math.round(previouslyReceived / factor * 100) / 100;
            if (Number(locked.paid_amount || 0) > impliedOriginal + 0.01) {
              throw new ApiClientError("The saved receipt balance exceeds the linked posted receipts. Reconcile the booking before posting another.", {
                status: 409, code: "SALES_LEGACY_POSTING_REVIEW",
              });
            }
          }
        } else if (Number(locked.paid_amount || 0) > 0) {
          throw new ApiClientError("The saved receipt balance has no linked posted receipt. Reconcile the booking before posting another.", {
            status: 409, code: "SALES_LEGACY_POSTING_REVIEW",
          });
        }
      }
      const balance = salesReceiptBalances(totalOriginal, Number(locked.paid_amount || 0), originalReceipt, body.kind, requiredAdvance,
        configuredReceipt && currency.rate.ok ? {
          booked: Number(orderRow.order_total), received: configuredReceipt.finalAmount, rate: currency.rate.rate,
          operator: currency.rate.operator, previouslyReceived,
        } : undefined);
      const idRows = await sql`
        select post_sales_booking_transfer(
          p_actor_id => ${session.userId}::uuid,
          p_sales_order_id => ${params.id}::uuid,
          p_payment_kind => ${body.kind},
          p_entry_date => ${body.entryDate}::date,
          p_amount => ${postingAmount},
          p_currency_code => ${postingCurrency},
          p_exchange_rate => ${postingRate},
          p_debit_ledger_id => ${resolvedDebitLedgerId}::uuid,
          p_credit_ledger_id => ${resolvedCreditLedgerId}::uuid,
          p_reference_no => ${postingReferenceNo},
          p_narration => ${postingNarration || null}
        ) as id
      `;
      const paymentId = idRows[0]?.id as string;
      if (!paymentId) throw new Error("Sales receipt did not return a payment ID.");

      // 4-level serial (Global/Country/Branch/Entry) — additive metadata only, applied
      // AFTER the atomic posting RPC. Does NOT touch the posting/ledger/roznamcha logic.
      try {
        const s = await allocateFormSerials("payment_sales", { countryId: orderRow.country_id, branchKey: orderRow.country_branch_id ?? orderRow.city_branch_id ?? null });
        // savepoint: a failure here must not abort the surrounding posting transaction
        await sql.savepoint(async (sp: any) => {
          await sp`update sales_order_payments set super_admin_serial = ${s.superAdminSerial}, country_serial = ${s.countrySerial}, branch_serial = ${s.branchSerial}, entry_serial = ${s.entrySerial} where id = ${paymentId}::uuid`;
        });
      } catch { /* non-fatal — never affects posting */ }

      const paymentRows = await sql`
        select id, sales_order_id, payment_kind, amount, currency_code, exchange_rate, roznamcha_entry_id, status
        from sales_order_payments where id = ${paymentId}::uuid and sales_order_id = ${params.id}::uuid
        limit 1
      `;
      const paymentRecord = paymentRows[0] as any;
      if (!paymentRecord?.roznamcha_entry_id || paymentRecord.status !== "posted") throw new Error("The posted sales receipt is missing its Roznamcha entry.");

      let rozType = "super_admin";
      if (orderRow.city_branch_id) rozType = "branch";
      else if (orderRow.country_branch_id || orderRow.country_id) rozType = "country";

      await sql`
        update roznamcha_entries set
          country_id = ${orderRow.country_id || null}::uuid,
          country_branch_id = ${orderRow.country_branch_id || null}::uuid,
          city_branch_id = ${orderRow.city_branch_id || null}::uuid,
          type = ${rozType},
          bank_id = coalesce(${(body.typeDetails as any)?.bankId || null}::uuid, bank_id),
          -- a sales payment is a Business posting: never leave it unclassified (Shipping logins would see it)
          operational_domain = 'business',
          entry_category = 'business',
          source_module = 'sales',
          source_transaction_type = 'sales_payment',
          source_transaction_id = id
        where id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      const journalRows = await sql`
        select id, status, posted_at, country_id, country_branch_id, city_branch_id,
               super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number
        from roznamcha_entries where id = ${paymentRecord.roznamcha_entry_id}::uuid
        limit 1
      `;
      const journalRecord = journalRows[0] as any;

      const journalLines = await sql`
        select ledger_id, debit, credit, currency from roznamcha_lines where roznamcha_entry_id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      assertBalancedPostedLines({
        label: postingLabel, lines: journalLines, expectedDebitLedgerId: resolvedDebitLedgerId,
        expectedCreditLedgerId: resolvedCreditLedgerId, expectedAmount: postingAmount,
        expectedExchangeRate: postingRate,
      });
      if (configuredReceipt && journalLines.some((line: { currency?: string }) => line.currency?.toUpperCase() !== postingCurrency)) {
        throw new Error("The posted sales receipt does not use the booking's final currency.");
      }
      assertPostedRoznamchaTrace({ label: postingLabel, entry: journalRecord });

      const data = locked.form_data || {};
      const nextFormData = {
        ...data,
        workflow: {
          ...(data.workflow || {}),
          invoiceStatus: data.workflow?.invoiceStatus || "available",
          paymentStatus: balance.status,
          currentStep: "payment_posted",
          lastPaymentId: paymentId,
          lastRoznamchaEntryId: paymentRecord.roznamcha_entry_id,
          lastPaymentPostedAt: new Date().toISOString(),
        },
        lastPaymentTrace: {
          paymentId, roznamchaEntryId: paymentRecord.roznamcha_entry_id,
          debitLedgerId: resolvedDebitLedgerId, creditLedgerId: resolvedCreditLedgerId,
          originalCurrencyCode: body.currencyCode, currencyName: postingCurrency, exchangeRate: body.exchangeRate,
          superAdminSerialNumber: journalRecord.super_admin_serial_number,
          countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
          branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number,
          systemBillNumber: trace.systemBillNumber, manualBillNumber: trace.manualBillNumber,
          partyName: trace.partyName, referenceNo: postingReferenceNo, narration: postingNarration,
          debitLedgerCode: debitLedger.code, creditLedgerCode: creditLedger.code
        }
      };
      await sql`
        update public.sales_orders set paid_amount = ${balance.paid}, remaining_amount = ${balance.remaining},
          payment_status = ${balance.status}, form_data = ${sql.json(nextFormData)}, updated_at = now()
        where id = ${params.id}::uuid
      `;
      return { paymentId, paymentRecord, journalRecord };
    }));
    if (!core) throw new Error("The sales receipt could not be posted.");
    const { paymentId, paymentRecord, journalRecord } = core;

    const resPayload = {
      paymentId,
      roznamchaEntryId: paymentRecord.roznamcha_entry_id,
      superAdminSerialNumber: journalRecord.super_admin_serial_number,
      countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
      branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number
    };

    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 201, resPayload);
    }

    return apiCreated(resPayload);
  } catch (error) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    console.error("SALES_PAYMENT_POST_ERROR:", error);
    return handleApiError(error);
  }
}

/**
 * Money-moving request: serialised PER ORDER. Two simultaneous payments for the same order run one after the other, so the second
 * validates against the balance the first one produced and the order can never be over-paid (found 2026-10-19: four parallel
 * payments of 100,000 against a 220,500 balance all posted).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return await withKeyedLock("sales-payment:" + id, () => postPaymentHandler(request, context));
  } catch (error) {
    return handleApiError(error);
  }
}
