import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, apiError, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
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

const salesOrderPaymentPostSchema = z.object({
  kind: z.string(),
  entryDate: z.string(),
  amount: z.coerce.number().min(0.01),
  currencyCode: z.string(),
  exchangeRate: z.coerce.number().min(0.000001),
  debitLedgerId: z.string(),
  creditLedgerId: z.string(),
  referenceNo: z.string().optional().nullable(),
  narration: z.string().optional().nullable(),
  typeDetails: z.object({
    sourceRecordId: z.string().optional().nullable()
  }).optional().nullable()
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
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    // withLocalPg, not the RLS-gated Supabase client — see the POST handler for why.
    const { order, rows } = (await withLocalPg(async (sql) => {
      const orderRows = await sql`
        select id, sales_order_no, sales_contract_no, country_id, country_branch_id, city_branch_id,
               currency_code, exchange_rate, order_total, paid_amount, remaining_amount, form_data,
               ledger_posting_status, payment_status
        from sales_orders where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      const paymentRows = await sql`
        select
          p.id, p.sales_order_id, p.payment_kind, p.payment_date, p.amount, p.currency_code, p.exchange_rate,
          p.roznamcha_entry_id, p.status, p.remarks, p.created_at,
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
        where p.sales_order_id = ${params.id}::uuid and p.deleted_at is null
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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
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
               currency_code, exchange_rate, order_total, paid_amount, remaining_amount, form_data,
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
    if (resolvedDebitLedgerId === resolvedCreditLedgerId) {
      throw new Error("Debit and credit ledgers must be different for sales payment posting.");
    }

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

    const isForeignCurrency = body.currencyCode?.toUpperCase() === (orderRow.currency_code?.toUpperCase() || "USD");
    const bodyAmountUSD = isForeignCurrency ? Number(body.amount) : Number(body.amount) / Number(body.exchangeRate || 1);

    if (body.kind === "advance" && advancePercent > 0) {
      if (remainingAdvanceUSD <= tolerance) {
        throw new Error(`Advance payment is already fully received (Required: ${requiredAdvanceUSD.toFixed(2)}, Paid: ${paidAmountUSD.toFixed(2)}). Duplicate posting is not allowed.`);
      }
      if (bodyAmountUSD > remainingAdvanceUSD + tolerance) {
        throw new Error(`Advance receipt amount cannot exceed remaining advance balance (${remainingAdvanceUSD.toFixed(2)}).`);
      }
    }

    if ((body.kind === "remaining" || body.kind === "credit") && remainingAmountUSD <= tolerance) {
      throw new Error("This sales order has no remaining receivable balance. Duplicate posting is not allowed.");
    }

    if ((body.kind === "remaining" || body.kind === "credit") && bodyAmountUSD > remainingAmountUSD + tolerance) {
      throw new Error(`Receipt amount cannot exceed remaining receivable balance (${remainingAmountUSD.toFixed(2)}).`);
    }

    const effectiveRoznamchaExchangeRate = isForeignCurrency ? Number(body.exchangeRate || 1) : 1;

    // Transaction-safe posting via the SECURITY DEFINER wrapper post_sales_booking_transfer,
    // called directly over the raw Postgres connection (equivalent to, and more reliable
    // than, the Supabase RPC call).
    const { paymentId, paymentRecord, journalRecord, journalLines } = await withLocalPg(async (sql) => {
      const idRows = await sql`
        select post_sales_booking_transfer(
          p_actor_id => ${session.userId}::uuid,
          p_sales_order_id => ${params.id}::uuid,
          p_payment_kind => ${body.kind},
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

      // 4-level serial (Global/Country/Branch/Entry) — additive metadata only, applied
      // AFTER the atomic posting RPC. Does NOT touch the posting/ledger/roznamcha logic.
      try {
        const s = await allocateFormSerials("payment_sales", { countryId: orderRow.country_id, branchKey: orderRow.country_branch_id ?? orderRow.city_branch_id ?? null });
        await sql`update sales_order_payments set super_admin_serial = ${s.superAdminSerial}, country_serial = ${s.countrySerial}, branch_serial = ${s.branchSerial}, entry_serial = ${s.entrySerial} where id = ${paymentId}::uuid`;
      } catch { /* non-fatal — never affects posting */ }

      const paymentRows = await sql`
        select id, sales_order_id, payment_kind, amount, currency_code, exchange_rate, roznamcha_entry_id, status
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
          type = ${rozType}
        where id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      const journalRows = await sql`
        select id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number
        from roznamcha_entries where id = ${paymentRecord.roznamcha_entry_id}::uuid
        limit 1
      `;
      const journalRecord = journalRows[0] as any;

      const journalLines = await sql`
        select ledger_id, debit, credit from roznamcha_lines where roznamcha_entry_id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      return { paymentId, paymentRecord, journalRecord, journalLines };
    }) as any;

    const exRate = Number(body.exchangeRate || (orderRow as any)?.exchange_rate || 1) || 1;
    assertDistinctBookingLedgers(resolvedDebitLedgerId, resolvedCreditLedgerId, "Sales payment");
    assertBalancedPostedLines({
      label: "Sales payment",
      lines: journalLines,
      expectedDebitLedgerId: resolvedDebitLedgerId,
      expectedCreditLedgerId: resolvedCreditLedgerId,
      expectedAmount: Number(body.amount),
      expectedExchangeRate: exRate
    });
    assertPostedRoznamchaTrace({
      label: "Sales payment",
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
          originalCurrencyCode: body.currencyCode,
          currencyName: body.currencyCode,
          exchangeRate: body.exchangeRate,
          superAdminSerialNumber: journalRecord.super_admin_serial_number,
          countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
          branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number,
          systemBillNumber: trace.systemBillNumber,
          manualBillNumber: trace.manualBillNumber,
          partyName: trace.partyName,
          referenceNo: postingReferenceNo,
          narration: postingNarration,
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
