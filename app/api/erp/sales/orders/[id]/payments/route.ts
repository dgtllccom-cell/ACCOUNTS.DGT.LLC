import { issuedSalesPaymentReceipt } from "@/lib/sales/payment-receipt";
import { convertReviewedSalesReceipt, linkedSalesAdvanceReceipt, linkedSalesBalanceReceipt, matchesSalesReceiptQueue, planSalesWorkflowReceipt, reviewedSalesSettlement, salesReceiptPaymentKind, SALES_RECEIPT_INVOICE_TYPES } from "@/lib/sales/payment-workflow";
import { isLocalSalesFormData } from "@/lib/sales/local-sales-source";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiClientError, apiCreated, apiOk, apiError, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { withLocalPg } from "@/lib/db/local-postgres";
import { withKeyedLock } from "@/lib/db/keyed-lock";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { assertBalancedPostedLines, assertDistinctBookingLedgers, assertPostedRoznamchaTrace } from "@/lib/services/posting-verification";
import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { getRequestLanguage } from "@/lib/i18n/server";

const paramsSchema = z.object({
  id: uuidSchema
});

const salesOrderPaymentPostSchema = z.object({
  kind: z.string(),
  salesWorkflowQueue: z.enum(["cash","account-transfer"]).optional(),
  linkedBalanceReceipt: z.literal(true).optional(),
  salesInvoiceId: uuidSchema.optional(),
  receiptInput: z.object({ currency: z.string().trim().regex(/^[A-Za-z]{3}$/), amount: z.number().positive().max(1_000_000_000_000) }).optional(),
  receiptDetails: z.discriminatedUnion("channel", [
    z.object({ channel: z.literal("cash"), partyName: z.string().trim().min(1).max(120),
      mobile: z.string().trim().max(32).regex(/^[+\d\s().-]+$/).refine(v => v.replace(/\D/g, "").length >= 5),
      idTail: z.string().trim().max(4).optional() }),
    z.object({ channel: z.literal("bank"), bankId: uuidSchema, mode: z.string().trim().max(100).optional() }),
  ]).optional(),
  entryDate: z.string(),
  amount: z.coerce.number().min(0.01),
  currencyCode: z.string(),
  exchangeRate: z.coerce.number().min(0.000001),
  debitLedgerId: z.string(),
  creditLedgerId: z.string(),
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
    select id, code, name, currency, is_active, country_id, country_branch_id, city_branch_id
    from ledgers where id = ${ledgerId}::uuid and deleted_at is null
  `;
  let ledger = rows[0];

  if (!ledger && ledgerId) {
    // Compatibility fallback: some callers pass an accounts.id instead of the ledger's own id
    // (ledgers.account_id is a separate FK, not the same UUID as ledgers.id). Resolve the
    // ledger linked to that account rather than failing outright.
    const byAccount = await sql`
      select id, code, name, currency, is_active, country_id, country_branch_id, city_branch_id
      from ledgers where account_id = ${ledgerId}::uuid and deleted_at is null
    `;
    if (byAccount[0]) ledger = byAccount[0];
  }

  if (!ledger) {
    throw new Error(label + " ledger was not found.");
  }

  if (orderRow.country_id && ledger.country_id && ledger.country_id !== orderRow.country_id) {
    throw new Error(label + " ledger belongs to a different country and cannot be used for this sales booking.");
  }

  if (orderRow.city_branch_id && ledger.city_branch_id && ledger.city_branch_id !== orderRow.city_branch_id) {
    throw new Error(label + " ledger belongs to a different city branch and cannot be used for this sales booking.");
  }

  return ledger;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const canViewFinancials = session.isSuperAdmin || session.canViewFinancials;

    // withLocalPg, not the RLS-gated Supabase client — see the POST handler for why.
    const { order, rows } = (await withLocalPg(async (sql) => {
      const orderRows = await sql`
        select id, sales_order_no, sales_contract_no, customer_name, country_id, country_branch_id, city_branch_id,
               currency_code, exchange_rate, order_total, paid_amount, remaining_amount, form_data,
               ledger_posting_status, payment_status
        from sales_orders where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      const paymentRows = await sql`
        with recent_payments as materialized (
          select * from sales_order_payments
          where sales_order_id = ${params.id}::uuid and deleted_at is null
          order by created_at desc
          limit 200
        ), voucher_lines as (
          select rl.roznamcha_entry_id, jsonb_agg(jsonb_build_object(
            'ledger_id', rl.ledger_id, 'debit', rl.debit, 'credit', rl.credit, 'currency', rl.currency,
            'ledger_name', l.name, 'ledger_code', l.code,
            'account_number', coalesce(nullif(btrim(rl.account_number), ''), nullif(btrim(ea.account_number), ''))
          )) as lines
          from roznamcha_lines rl
          left join ledgers l on l.id = rl.ledger_id
          left join enterprise_accounts ea on ea.id = coalesce(rl.enterprise_account_id, l.enterprise_account_id)
          where ${canViewFinancials}::boolean and rl.roznamcha_entry_id in (
            select journal.id from recent_payments eligible
            join roznamcha_entries journal on journal.id = eligible.roznamcha_entry_id
            where eligible.status = 'posted' and eligible.payment_kind <> 'booking'
              and journal.status = 'posted' and journal.deleted_at is null
          )
          group by rl.roznamcha_entry_id
          having count(*) = 2
        )
        select
          p.id, p.sales_order_id, p.payment_kind, p.payment_date, p.amount, p.currency_code, p.exchange_rate,
          p.roznamcha_entry_id, p.status, p.remarks, p.created_at,
          case when re.id is not null then jsonb_build_object(
            'id', re.id,
            'status', re.status,
            'voucher_no', re.voucher_no,
            'source_reference_no', re.source_reference_no,
            'entry_category', re.entry_category,
            'deleted_at', re.deleted_at,
            'super_admin_serial_number', re.super_admin_serial_number,
            'country_transaction_serial_number', re.country_transaction_serial_number,
            'branch_transaction_serial_number', re.branch_transaction_serial_number,
            'profiles', case when pr.id is not null then jsonb_build_object('full_name', pr.full_name) else null end
          ) else null end as roznamcha_entries,
          voucher_lines.lines as voucher_lines
        from recent_payments p
        left join roznamcha_entries re on re.id = p.roznamcha_entry_id
        left join profiles pr on pr.id = re.created_by
        left join voucher_lines on voucher_lines.roznamcha_entry_id = re.id
        order by p.created_at desc
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

    const mapped = localizedRows.map(({ voucher_lines, ...row }: any) => ({
      ...row,
      receipt: order ? issuedSalesPaymentReceipt(order, row, row.roznamcha_entries, canViewFinancials, voucher_lines) : null,
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
    const params = paramsSchema.parse(await context.params);
    let input: unknown;
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const formData = await request.formData();
      if (formData.has("attachment")) {
        return apiError("SALES_RECEIPT_ATTACHMENT_UNAVAILABLE", "Remove the attachment before posting. Sales receipt attachments are not supported here.", 422);
      }
      const raw = formData.get("payload");
      if (typeof raw !== "string") return apiError("VALIDATION", "Sales receipt payload is missing.", 400);
      try { input = JSON.parse(raw); } catch { return apiError("VALIDATION", "Sales receipt payload is invalid.", 400); }
    } else input = await request.json();
    const body = salesOrderPaymentPostSchema.parse(input);

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
        select id, sales_order_no, sales_contract_no, customer_name, country_id, country_branch_id, city_branch_id,
               currency_code, exchange_rate, order_total, paid_amount, remaining_amount, form_data, customer_ledger_id, customer_account_id,
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
      return apiError("NOT_FOUND", "Sales order not found.", 404);
    }

    const orderRow = order as any;
    const form = orderRow.form_data?.form || {};
    const receiptDetails = body.linkedBalanceReceipt ? body.receiptDetails : undefined;
    let receiptBankId: string | null = null;
    let receiptDetailSummary: string | null = null;
    const cleanDetail = (value: string) => value.replace(/[|\r\n]/g, " ").trim();
    if (body.linkedBalanceReceipt && (!receiptDetails ||
        (body.salesWorkflowQueue === "cash" && receiptDetails.channel !== "cash") ||
        (body.salesWorkflowQueue === "account-transfer" && receiptDetails.channel !== "bank"))) {
      throw new ApiClientError("Enter the details for the selected Cash or Bank receipt.", { status: 422, code: "SALES_RECEIPT_DETAILS_REQUIRED" });
    }
    if (receiptDetails?.channel === "cash") {
      receiptDetailSummary = `Cash | Receiver/Sender: ${cleanDetail(receiptDetails.partyName)} | Mobile: ${cleanDetail(receiptDetails.mobile)}` +
        (receiptDetails.idTail ? ` | ID: •••• ${cleanDetail(receiptDetails.idTail)}` : "");
    }
    if (receiptDetails?.channel === "bank") {
      // Take bank identity from the existing master, never from a client-supplied name or account number.
      const bank = orderRow.country_id ? await withLocalPg(async sql => {
        const rows = await sql`select id, bank_name, account_number, iban_number from public.banks
          where id = ${receiptDetails.bankId}::uuid and country_id = ${orderRow.country_id}::uuid
            and is_active = true and deleted_at is null limit 1`;
        return rows[0] ?? null;
      }) : null;
      if (!bank || !String(bank.account_number || bank.iban_number || "").trim()) {
        throw new ApiClientError("Select an active bank with an account number in the sales country.", { status: 409, code: "SALES_RECEIPT_BANK_MISMATCH" });
      }
      receiptBankId = bank.id;
      const ending = String(bank.account_number || bank.iban_number).trim().slice(-4);
      receiptDetailSummary = `Bank: ${cleanDetail(bank.bank_name)} | Bank Account: •••• ${cleanDetail(ending)}` +
        (receiptDetails.mode ? ` | Transfer Type: ${cleanDetail(receiptDetails.mode)}` : "");
    }
    const reviewedSettlement = orderRow.form_data?.transferTrace?.settlement;
    const reviewedReceipt = Boolean(body.linkedBalanceReceipt || body.salesWorkflowQueue || (body.kind === "credit" && reviewedSettlement));
    if (body.salesWorkflowQueue) {
      const method = body.typeDetails?.paymentMethod;
      if (!matchesSalesReceiptQueue(orderRow, body.salesWorkflowQueue) || body.kind !== "remaining"
        || !(body.salesWorkflowQueue === "cash" ? method === "cash" : method === "bank" || method === "transfer")) {
        throw new ApiClientError("This sale does not match the selected receipt queue.", { status: 409, code: "SALES_RECEIPT_QUEUE_MISMATCH" });
      }
    }
    if (body.salesInvoiceId && !body.linkedBalanceReceipt) {
      throw new ApiClientError("An invoice receipt must use the linked sales payment form.", { status: 409, code: "SALES_INVOICE_RECEIPT_MISMATCH" });
    }
    if (reviewedReceipt) {
      if (!reviewedSalesSettlement(reviewedSettlement)) {
        throw new ApiClientError("Receipt paused: ask Accounts to verify the original bill and its posted settlement before recording payment.", {
          status: 409, code: "SALES_RECEIPT_SETTLEMENT_UNVERIFIED",
        });
      }
      const expected = orderRow.form_data?.transferTrace?.debitLedgerId || orderRow.customer_ledger_id || form.customerAccountLedgerId
        || orderRow.customer_account_id || form.customerAccountId;
      if (!expected) throw new ApiClientError("The original sale has no linked receivable account.", { status: 409, code: "SALES_CUSTOMER_LEDGER_MISSING" });
      const expectedLedger = await withLocalPg(sql => assertLedgerMatchesSalesScope(sql, expected, orderRow, "Credit"));
      const selectedLedger = await withLocalPg(sql => assertLedgerMatchesSalesScope(sql, body.creditLedgerId, orderRow, "Credit"));
      if (!expectedLedger || !selectedLedger || expectedLedger.id !== selectedLedger.id) {
        throw new ApiClientError("Use the original sale's receivable account.", { status: 409, code: "SALES_CUSTOMER_LEDGER_MISMATCH" });
      }
    }
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

    const debitLedger = await withLocalPg((sql) => assertLedgerMatchesSalesScope(sql, body.debitLedgerId, orderRow, "Debit")) as any;
    const creditLedger = await withLocalPg((sql) => assertLedgerMatchesSalesScope(sql, body.creditLedgerId, orderRow, "Credit")) as any;
    // Use the resolved ledger rows' own ids from here on — the client may have sent an
    // accounts.id (see the compatibility fallback above), which is a different UUID.
    const resolvedDebitLedgerId = debitLedger.id;
    const resolvedCreditLedgerId = creditLedger.id;
    if (body.linkedBalanceReceipt && (
      debitLedger.is_active !== true || String(debitLedger.currency).toUpperCase() !== String(body.currencyCode).toUpperCase() ||
      (orderRow.country_branch_id && debitLedger.country_branch_id && orderRow.country_branch_id !== debitLedger.country_branch_id)
    )) {
      throw new ApiClientError("Select an active receiving account in the approved currency and sales branch.", {
        status: 409, code: "SALES_RECEIVING_ACCOUNT_MISMATCH",
      });
    }
    if (resolvedDebitLedgerId === resolvedCreditLedgerId) {
      throw new Error("Debit and credit ledgers must be different for sales payment posting.");
    }

    const trace = buildSalesTrace(orderRow, body.referenceNo ?? null);
    const postingReferenceNo = body.referenceNo?.trim() || trace.referenceNo;
    const goodsAuditRemark = buildSalesGoodsAuditRemark(orderRow, postingReferenceNo);
    const postingNarration = [
      goodsAuditRemark,
      receiptDetailSummary,
      body.narration?.trim() ? "Notes: " + body.narration.trim() : null,
      trace.narrationPrefix,
      "Payment Currency: " + body.currencyCode,
      "Exchange Rate: " + (body.receiptInput ? 1 : body.exchangeRate),
      "Receipt Amount: " + body.amount
    ].filter(Boolean).join(" | ");

    const isForeignCurrency = body.currencyCode?.toUpperCase() === (orderRow.currency_code?.toUpperCase() || "USD");
    const bodyAmountUSD = isForeignCurrency ? Number(body.amount) : Number(body.amount) / Number(body.exchangeRate || 1);

    if (!reviewedReceipt && body.kind === "advance" && advancePercent > 0) {
      if (remainingAdvanceUSD <= tolerance) {
        throw new Error(`Advance payment is already fully received (Required: ${requiredAdvanceUSD.toFixed(2)}, Paid: ${paidAmountUSD.toFixed(2)}). Duplicate posting is not allowed.`);
      }
      if (bodyAmountUSD > remainingAdvanceUSD + tolerance) {
        throw new Error(`Advance receipt amount cannot exceed remaining advance balance (${remainingAdvanceUSD.toFixed(2)}).`);
      }
    }

    if (!reviewedReceipt && (body.kind === "remaining" || body.kind === "credit") && remainingAmountUSD <= tolerance) {
      throw new Error("This sales order has no remaining receivable balance. Duplicate posting is not allowed.");
    }

    if (!reviewedReceipt && (body.kind === "remaining" || body.kind === "credit") && bodyAmountUSD > remainingAmountUSD + tolerance) {
      throw new Error(`Receipt amount cannot exceed remaining receivable balance (${remainingAmountUSD.toFixed(2)}).`);
    }

    const postingAssertionLabel = "Sales payment";
    const effectiveRoznamchaExchangeRate = reviewedReceipt ? 1 : isForeignCurrency ? Number(body.exchangeRate || 1) : 1;

    // Transaction-safe posting via the SECURITY DEFINER wrapper post_sales_booking_transfer,
    // called directly over the raw Postgres connection (equivalent to, and more reliable
    // than, the Supabase RPC call).
    // ONE database transaction: the order row is locked (FOR UPDATE) and the balance is re-checked on the locked row before posting,
    // so simultaneous receipts are serialised and can never together exceed the receivable (found 2026-10-19: three parallel receipts
    // of 6,000 against 9,000 all posted). If anything fails the whole receipt rolls back - no half-posted voucher.
    const { paymentId, paymentRecord, journalRecord, journalLines, inputConversion, postedNarration } = await withLocalPg((sqlConn) => sqlConn.begin(async (sql: any) => {
      const lockedRows = await sql`
        select paid_amount, remaining_amount, form_data, payment_status, ledger_posting_status from sales_orders where id = ${params.id}::uuid and deleted_at is null for update
      `;
      const paidLocked = Number(lockedRows[0]?.paid_amount ?? 0);
      const remainingLocked = Number(lockedRows[0]?.remaining_amount ?? 0);
      if (!reviewedReceipt && body.kind === "advance" && advancePercent > 0) {
        const remAdv = Math.max(0, requiredAdvanceUSD - paidLocked);
        if (remAdv <= tolerance) throw new Error(`Advance payment is already fully received (Required: ${requiredAdvanceUSD.toFixed(2)}, Paid: ${paidLocked.toFixed(2)}). Duplicate posting is not allowed.`);
        if (bodyAmountUSD > remAdv + tolerance) throw new Error(`Advance receipt amount cannot exceed remaining advance balance (${remAdv.toFixed(2)}).`);
      }
      const locked = lockedRows[0];
      if (body.linkedBalanceReceipt) {
        const advance = body.kind === "advance" && locked ? linkedSalesAdvanceReceipt(locked) : null;
        const stage = body.kind === "advance" ? advance : locked && linkedSalesBalanceReceipt(locked);
        if (!stage || stage.kind !== body.kind || stage.queue !== body.salesWorkflowQueue) {
          throw new ApiClientError("Receipt is not available for this sales bill and payment stage.", { status: 409, code: "SALES_RECEIPT_QUEUE_MISMATCH" });
        }
        if (advance && body.amount > advance.limit) {
          throw new ApiClientError("Receipt exceeds the outstanding advance amount.", { status: 409, code: "SALES_ADVANCE_RECEIPT_LIMIT" });
        }
        const invoiceSale = salesReceiptPaymentKind(locked) === "invoice";
        if (invoiceSale || body.salesInvoiceId) {
          // Match the original UUID, not the displayed number or a second invoice's amount.
          const invoices = invoiceSale ? await sql`
            select i.id from public.business_edit_invoices i
            where i.source_id = ${params.id}::uuid and i.source_table = 'sales_orders'
              and i.txn_kind = 'sales' and i.source_module = ${isLocalSalesFormData(locked.form_data) ? 'local_sales' : 'sales_booking'}
              and i.status = 'finalized' and i.deleted_at is null
              and i.doc_type = any(${[...SALES_RECEIPT_INVOICE_TYPES]}::text[])
              and (${body.salesInvoiceId ?? null}::uuid is null or i.id = ${body.salesInvoiceId ?? null}::uuid)
            order by i.id limit 1 for share
          ` : [];
          if (!invoices.length) {
            throw new ApiClientError("A finalized invoice linked to the original sales bill is required.", { status: 409, code: "SALES_INVOICE_RECEIPT_MISMATCH" });
          }
        }
      }
      const inputConversion = body.linkedBalanceReceipt && body.receiptInput
        ? convertReviewedSalesReceipt(locked?.form_data?.transferTrace?.settlement, body.receiptInput) : null;
      if (body.receiptInput && (!inputConversion || inputConversion.currency !== body.currencyCode.trim().toUpperCase() ||
        Math.abs(inputConversion.amount - body.amount) > 0.000001)) {
        throw new ApiClientError("Receipt conversion does not match the approved sales rate.", { status: 409, code: "SALES_RECEIPT_FX_MISMATCH" });
      }
      const postedNarration = inputConversion && inputConversion.inputCurrency !== inputConversion.currency
        ? postingNarration + ` | Receipt FX: ${inputConversion.inputAmount} ${inputConversion.inputCurrency} ${inputConversion.operator} ${inputConversion.rate} = ${inputConversion.amount} ${inputConversion.currency}`
        : postingNarration;
      const plannedReceipt = reviewedReceipt ? planSalesWorkflowReceipt(locked?.form_data?.transferTrace?.settlement, {
        currency: body.currencyCode, amount: body.amount, paidOriginal: paidLocked, remainingOriginal: remainingLocked,
      }) : null;
      if (reviewedReceipt && (!plannedReceipt || !locked
        || (body.salesWorkflowQueue && !matchesSalesReceiptQueue(locked, body.salesWorkflowQueue)))) {
        throw new ApiClientError("Receipt must match the approved final currency and outstanding amount.", { status: 409, code: "SALES_RECEIPT_SETTLEMENT_MISMATCH" });
      }
      if (plannedReceipt) {
        const receiptReference = body.referenceNo?.trim();
        if (!receiptReference) throw new ApiClientError("A receipt reference is required.", { status: 400, code: "SALES_RECEIPT_REFERENCE_REQUIRED" });
        const duplicates = await sql`select p.id from public.sales_order_payments p
          join public.roznamcha_entries r on r.id = p.roznamcha_entry_id
          where p.sales_order_id = ${params.id}::uuid and p.deleted_at is null
            and p.status = 'posted' and p.payment_kind <> 'booking'
            and r.deleted_at is null and lower(r.source_reference_no) = lower(${receiptReference}) limit 1`;
        if (duplicates.length) throw new ApiClientError("A receipt already uses this reference for this sales bill.", { status: 409, code: "SALES_RECEIPT_REFERENCE_EXISTS" });
      }
      if (!reviewedReceipt && (body.kind === "remaining" || body.kind === "credit")) {
        if (remainingLocked <= tolerance) throw new Error("This sales order has no remaining receivable balance. Duplicate posting is not allowed.");
        if (bodyAmountUSD > remainingLocked + tolerance) throw new Error(`Receipt amount cannot exceed remaining receivable balance (${remainingLocked.toFixed(2)}).`);
      }
      const idRows = await sql`
        select post_sales_booking_transfer(
          p_actor_id => ${session.userId}::uuid,
          p_sales_order_id => ${params.id}::uuid,
          p_payment_kind => ${body.kind},
          p_entry_date => ${body.entryDate}::date,
          p_amount => ${plannedReceipt?.postingAmount ?? body.amount},
          p_currency_code => ${body.currencyCode},
          p_exchange_rate => ${effectiveRoznamchaExchangeRate},
          p_debit_ledger_id => ${resolvedDebitLedgerId}::uuid,
          p_credit_ledger_id => ${resolvedCreditLedgerId}::uuid,
          p_reference_no => ${postingReferenceNo},
          p_narration => ${postedNarration || null}
        ) as id
      `;
      const paymentId = idRows[0]?.id as string;

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
        select id, sales_order_id, payment_kind, payment_date, amount, currency_code, exchange_rate, roznamcha_entry_id, status
        from sales_order_payments where id = ${paymentId}::uuid and sales_order_id = ${params.id}::uuid
        limit 1
      `;
      const paymentRecord = paymentRows[0] as any;

      let rozType = "super_admin";
      if (orderRow.city_branch_id) rozType = "branch";
      else if (orderRow.country_branch_id || orderRow.country_id) rozType = "country";

      await sql`
        update roznamcha_entries set
          country_id = ${orderRow.country_id || null}::uuid,
          country_branch_id = ${orderRow.country_branch_id || null}::uuid,
          city_branch_id = ${orderRow.city_branch_id || null}::uuid,
          type = ${rozType},
          bank_id = coalesce(${receiptBankId || (!body.linkedBalanceReceipt ? (body.typeDetails as any)?.bankId : null) || null}::uuid, bank_id),
          entry_category = coalesce(${receiptDetails?.channel ?? null}, entry_category),
          -- a sales payment is a Business posting: never leave it unclassified (Shipping logins would see it)
          operational_domain = coalesce(operational_domain, 'business')
        where id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      const journalRows = await sql`
        select id, status, voucher_no, source_reference_no, entry_category, deleted_at, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number
        from roznamcha_entries where id = ${paymentRecord.roznamcha_entry_id}::uuid
        limit 1
      `;
      const journalRecord = journalRows[0] as any;

      const journalLines = await sql`
        select rl.ledger_id, rl.debit, rl.credit, rl.currency, l.name as ledger_name, l.code as ledger_code,
          coalesce(nullif(btrim(rl.account_number), ''), nullif(btrim(ea.account_number), '')) as account_number
        from roznamcha_lines rl
        left join ledgers l on l.id = rl.ledger_id
        left join enterprise_accounts ea on ea.id = coalesce(rl.enterprise_account_id, l.enterprise_account_id)
        where rl.roznamcha_entry_id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      if (plannedReceipt) {
        // Verify the persisted journal and both currencies inside the posting
        // transaction. Equal numbers on different or missing currencies are
        // not a balanced receipt, and an unposted journal cannot issue a copy.
        if (!journalRecord || journalRecord.status !== "posted" || journalRecord.deleted_at) {
          throw new ApiClientError("The linked Roznamcha receipt is not posted.", { status: 409, code: "SALES_RECEIPT_JOURNAL_UNVERIFIED" });
        }
        assertBalancedPostedLines({
          label: postingAssertionLabel, lines: journalLines, expectedDebitLedgerId: resolvedDebitLedgerId,
          expectedCreditLedgerId: resolvedCreditLedgerId, expectedAmount: plannedReceipt.postingAmount, expectedExchangeRate: 1,
        });
        if (paymentRecord?.status !== "posted" || String(paymentRecord.currency_code).toUpperCase() !== plannedReceipt.currency
          || Number(paymentRecord.amount) !== plannedReceipt.postingAmount
          || journalLines.some((line: { debit: unknown; credit: unknown; currency?: unknown }) =>
            String(line.currency || "").trim().toUpperCase() !== plannedReceipt.currency
            || Number(line.debit || 0) + Number(line.credit || 0) !== plannedReceipt.postingAmount)) {
          throw new ApiClientError("Receipt did not post in the approved final currency.", { status: 409, code: "SALES_RECEIPT_SETTLEMENT_MISMATCH" });
        }
        await sql`update public.sales_orders set paid_amount = ${plannedReceipt.paid}, remaining_amount = ${plannedReceipt.remaining},
          payment_status = ${plannedReceipt.remaining > 0 ? "partially_paid" : "completed"}, updated_at = now() where id = ${params.id}::uuid`;
      }
      return { paymentId, paymentRecord, journalRecord, journalLines, inputConversion, postedNarration };
    })) as any;

    const exRate = reviewedReceipt ? 1 : Number(body.exchangeRate || (orderRow as any)?.exchange_rate || 1) || 1;
    assertDistinctBookingLedgers(resolvedDebitLedgerId, resolvedCreditLedgerId, "Sales payment");
    assertBalancedPostedLines({
      label: postingAssertionLabel,
      lines: journalLines,
      expectedDebitLedgerId: resolvedDebitLedgerId,
      expectedCreditLedgerId: resolvedCreditLedgerId,
      expectedAmount: Number(body.amount),
      expectedExchangeRate: exRate
    });
    assertPostedRoznamchaTrace({
      label: postingAssertionLabel,
      entry: {
        ...journalRecord,
        status: "posted",
        posted_at: journalRecord?.posted_at ?? new Date().toISOString(),
        country_id: orderRow.country_id || null,
        country_branch_id: orderRow.country_branch_id || null,
        city_branch_id: orderRow.city_branch_id || null
      }
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
      sourceModule: "sales",
      sourceTransactionType: "sales_payment",
      systemBillNumber: trace.systemBillNumber,
      manualBillNumber: trace.manualBillNumber,
      partyName: trace.partyName,
      referenceNo: postingReferenceNo
    };

    // Update order row details
    await withLocalPg(async (sql) => {
      const nextFormData = {
        ...(orderRow.form_data || {}),
        workflow: postedWorkflow,
        lastPaymentTrace: {
          paymentId,
          roznamchaEntryId: paymentRecord.roznamcha_entry_id,
          debitLedgerId: resolvedDebitLedgerId,
          creditLedgerId: resolvedCreditLedgerId,
          originalCurrencyCode: inputConversion?.inputCurrency ?? body.currencyCode,
          currencyName: body.currencyCode,
          exchangeRate: inputConversion?.rate ?? body.exchangeRate,
          ...(inputConversion ? { originalAmount: inputConversion.inputAmount, conversionOperator: inputConversion.operator } : {}),
          superAdminSerialNumber: journalRecord.super_admin_serial_number,
          countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
          branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number,
          systemBillNumber: trace.systemBillNumber,
          manualBillNumber: trace.manualBillNumber,
          partyName: trace.partyName,
          referenceNo: postingReferenceNo,
          narration: postedNarration,
          debitLedgerCode: debitLedger.code,
          creditLedgerCode: creditLedger.code
        }
      };
      await sql`
        update sales_orders set form_data = ${sql.json(nextFormData)}, updated_at = now()
        where id = ${params.id}::uuid
      `;
    });

    const resPayload = {
      paymentId,
      receipt: issuedSalesPaymentReceipt(orderRow, paymentRecord, journalRecord, session.isSuperAdmin || session.canViewFinancials,
        journalLines),
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
