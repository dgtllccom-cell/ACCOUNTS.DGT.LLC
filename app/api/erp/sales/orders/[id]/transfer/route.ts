import { convertedSalesAmount, getBookingCurrencies } from "@/lib/sales/booking-currencies";
import { NextRequest } from "next/server";
import { issueForSalesOrder } from "@/lib/services/stock-journal-service";
import { assertReservationsReady, usesManagedLots } from "@/lib/sales/managed-lot-sales";
import { finalizeSaleStock } from "@/lib/services/goods-transfer-service";
import { z } from "zod";
import { ApiClientError, apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { assertFinancialAccess } from "@/lib/permissions/middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { withLocalPg } from "@/lib/db/local-postgres";
import { assertBalancedPostedLines, assertDistinctBookingLedgers, assertPostedRoznamchaTrace } from "@/lib/services/posting-verification";
import { resolveSalesBookingPaymentRoute } from "@/lib/services/sales-booking-routing";
import { normalizeLegacySalesPaymentSources } from "@/lib/sales/legacy-payment-sources";
import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";

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
  const canonicalOriginalTotal = Number(orderRow.total_goods_original || orderRow.total_goods_usd || 0);
  const salesAmount = canonicalOriginalTotal > 0
    ? canonicalOriginalTotal
    : (goodsEntries.reduce((sum: number, item: any) => sum + Number(item.totalAmount ?? item.salesAmount ?? 0), 0) || Number(form.totalAmount || totals.grandPrimaryFinal || orderRow.order_total || 0));
  const salesCurrency = String(orderRow.currency_code || goodsEntries[0]?.salesCurrency || goodsEntries[0]?.pricingCurrency || form.salesCurrency || form.pricingCurrency || "USD").toUpperCase();
  return `Sales Bill: ${billNo} | Goods: ${goodsName} | Qty: ${formatAuditNumber(totalQty)}${unit ? ` ${unit}` : ""} | Gross WT: ${formatAuditNumber(grossWeight)} KG | Net WT: ${formatAuditNumber(netWeight)} KG | Sales Price: ${formatAuditNumber(salesAmount)} ${salesCurrency}`;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let idempotencyKey = "";
  let tenantHash = "";
  // exactly-once claim on the order (set just before posting, released if posting has NOT happened)
  let claimedOrder: { id: string; at: string } | null = null;
  let paymentPosted = false;
  try {
    const session = await requireErpSession();
    assertFinancialAccess(session);
    const params = paramsSchema.parse(await context.params);
    const body = await request.json().catch(() => ({}));

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "SALES_TRANSFER",
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] ?? null,
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

    const supabase = (await createApiSupabaseClient()) as any;
    // Root-cause bypass (see app/api/erp/sales/orders/route.ts GET handler for the same note):
    // sales_orders' RLS policies gate on is_super_admin()/can_access_country(), both keyed off
    // auth.uid(), which is always NULL under this app's temp-session bootstrap login — so the
    // Supabase-client read below silently returns null even for orders that exist. Try a
    // direct-Postgres read first (bypasses RLS via DATABASE_URL); fall back to the Supabase-client
    // path only when DATABASE_URL isn't configured.
    const orderColumns = "id, country_id, country_branch_id, city_branch_id, updated_at, customer_account_id, customer_ledger_id, order_total, total_goods_original, total_goods_local, total_goods_usd, currency_code, exchange_rate, sales_order_no, sales_contract_no, form_data, sales_status, ledger_posting_status, payment_status";
    const viaPgOrder = await withLocalPg(async (sql) => {
      const rows = await sql`select ${sql.unsafe(orderColumns)}, updated_at::text as order_version from sales_orders where id = ${params.id} and deleted_at is null limit 1`;
      return rows[0] ?? null;
    });
    const order = viaPgOrder ?? await requireSupabaseData(
      supabase
        .from("sales_orders")
        .select(orderColumns)
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "sales",
      action: "post",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null,
    });

    if (!order) {
      throw new Error("Sales order not found.");
    }
    const orderRow = order as any;
    const formData = orderRow.form_data || {};
    const form = formData.form || {};
    const workflow = formData.workflow || {};
    const paymentRoute = resolveSalesBookingPaymentRoute(body?.paymentKind ?? body?.paymentType ?? form.paymentType ?? "Advance Payment");

    const alreadyTransferred =
      orderRow.ledger_posting_status === "transferred" ||
      orderRow.ledger_posting_status === "posted" ||
      workflow.transferStatus === "transferred" ||
      Boolean(form.transferAudit);

    if (alreadyTransferred) {
      throw new ApiClientError("This booking has already been transferred to Sales Transfer Payment and cannot be transferred again.", { status: 409, code: "ALREADY_TRANSFERRED" });
    }

    const bookingStatus = String(orderRow.sales_status || "").trim().toLowerCase();
    if (!bookingStatus || ["draft", "cancelled", "canceled", "void"].includes(bookingStatus)) {
      throw new ApiClientError("Complete New Sales Booking before posting its transfer.", { status: 409, code: "SALES_BOOKING_INCOMPLETE" });
    }

    // post_sales_order_payment expects p_amount in the order's OWN currency
    // (currency_code) and converts to the base currency exactly once. order_total /
    // totals.grandFinal are already converted to the local/base currency by the booking
    // wizard — passing either as p_amount here, alongside currency_code (still the
    // ORIGINAL currency), would double the conversion (the same bug already fixed on
    // the Purchase Order side). total_goods_original/total_goods_usd hold the true
    // original-currency total the wizard saves alongside order_total.
    const rawOriginalTotal = String(orderRow.total_goods_original || orderRow.total_goods_usd || "").replace(/,/g, "");
    let totalSalesAmount = Number(rawOriginalTotal);
    if (!Number.isFinite(totalSalesAmount) || totalSalesAmount <= 0) {
      // Legacy order predating total_goods_original: un-convert order_total by the
      // order's own exchange rate.
      const rawTotal = String(orderRow.order_total || formData.totals?.grandFinal || "0").replace(/,/g, "");
      const legacyTotal = Number(rawTotal);
      const legacyRate = Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1;
      totalSalesAmount = legacyRate > 1 ? legacyTotal / legacyRate : legacyTotal;
    }
    if (!Number.isFinite(totalSalesAmount) || totalSalesAmount <= 0) {
      throw new Error("Sales order total must be a valid number greater than zero to transfer.");
    }

    let postingCurrency = String(orderRow.currency_code || form.currencyType || "USD");
    let postingRate = Number(orderRow.exchange_rate || form.exchangeRate || 1);
    let postingAmount = totalSalesAmount;
    let settlement: { originalCurrency: string; originalAmount: number; finalCurrency: string; finalAmount: number; exchangeRate: number; operator: "*" | "/" } | null = null;
    if (form.bookingCurrencyConfigured === true) {
      const currency = getBookingCurrencies(form);
      const converted = convertedSalesAmount(totalSalesAmount, currency.rate);
      if (currency.final !== String(orderRow.currency_code ?? "").toUpperCase() || converted == null
        || Math.abs(converted - Number(orderRow.order_total)) > 0.01) {
        throw new ApiClientError("Sales amount, final currency and exchange rate do not match this booking.", {
          status: 409, code: "SALES_BOOKING_FX_MISMATCH"
        });
      }
      postingCurrency = currency.final;
      postingAmount = Number(orderRow.order_total);
      postingRate = 1;
      settlement = {
        originalCurrency: currency.sales, originalAmount: totalSalesAmount,
        finalCurrency: postingCurrency, finalAmount: postingAmount,
        exchangeRate: currency.rate.rate, operator: currency.rate.operator,
      };
    }

    // The Sales wizard's own form state names this field customerAccountNo, not
    // purchaseAccountNo (that name is only correct in the Purchase wizard's own
    // form_data, which this check was originally copied from) — checking the
    // wrong name meant this validation failed on every real Sales transfer.
    if (!form.customerAccountNo) {
      throw new Error("Customer Account is required before transfer to payment.");
    }
    if (!form.salesAccountNo) {
      throw new Error("Sales Account is required before transfer to payment.");
    }

    const systemBillNumber = String(orderRow.sales_order_no || form.salesOrderNo || "").trim();
    const manualBillNumber = String(
      form.manualBillNumber || form.manual_bill_number || form.billNo || form.salesContractNo || orderRow.sales_contract_no || ""
    ).trim();
    const partyName = String(form.purchaseAccountName || form.customerName || form.salesAccountName || "Sales Party").trim();
    const referenceNo = [systemBillNumber, manualBillNumber].filter(Boolean).join(" / ") || systemBillNumber || manualBillNumber || null;
    const now = new Date().toISOString();

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
        paymentKind: paymentRoute.paymentKind,
        paymentRouteLabel: paymentRoute.paymentLabel,
        journalStatus: "posted",
        ledgerStatus: "posted",
        currentStep: "sales_transfer_payment",
        currentStepName: "Sales Transfer Payment",
        nextStepName: "Post Payment",
        transferredAt: now,
        transferredBy: session.userId,
        systemBillNumber,
        manualBillNumber,
        partyName,
        referenceNo,
        sourceModule: "sales",
        sourceTransactionType: "sales_transfer_to_payment"
      },
      transferTrace: {
        transferOnly: true,
        salesOrderId: params.id,
        paymentKind: paymentRoute.paymentKind,
        systemBillNumber,
        manualBillNumber,
        partyName,
        referenceNo,
        countryId: orderRow.country_id,
        countryBranchId: orderRow.country_branch_id,
        cityBranchId: orderRow.city_branch_id,
        currencyCode: postingCurrency,
        exchangeRate: postingRate,
        amount: postingAmount,
        settlement,
        customerAccountNo: form.customerAccountNo,
        purchaseAccountNo: form.purchaseAccountNo,
        salesAccountNo: form.salesAccountNo,
        transferredAt: now,
        transferredBy: session.userId
      }
    };

    // The Sales wizard's account picker only ever resolves an enterprise_accounts.id
    // for the account the user clicked (form.customerAccountLedgerId /
    // form.salesAccountLedgerId, despite the "Ledger" in their names) — never a real
    // ledgers.id, because the bulk accounts list it searches (GET
    // /api/erp/accounting/accounts) doesn't return one. Resolve the real ledgers row
    // here via ledgers.enterprise_account_id, the same 1:1 link the DB already
    // enforces, instead of posting against whatever id happened to be on the form.
    const ledgerUuid = z.string().uuid();
    const debitCandidates = [orderRow.customer_ledger_id, orderRow.customer_account_id, form.customerAccountId, form.customerAccountLedgerId]
      .map(value => ledgerUuid.safeParse(String(value ?? ""))).flatMap(parsed => parsed.success ? [parsed.data] : []);
    const creditCandidates = [form.salesAccountId, form.salesAccountLedgerId]
      .map(value => ledgerUuid.safeParse(String(value ?? ""))).flatMap(parsed => parsed.success ? [parsed.data] : []);
    async function resolveBusinessLedger(candidates: string[]) {
      if (!candidates.length) return null;
      const rows = await withLocalPg(sql => sql`
        select l.id, l.code, l.name, l.country_id, l.country_branch_id, l.city_branch_id
        from public.ledgers l
        left join public.enterprise_accounts ea on ea.id = l.enterprise_account_id
        where l.deleted_at is null and l.is_active and (l.id = any(${candidates}::uuid[]) or l.enterprise_account_id = any(${candidates}::uuid[]) or l.account_id = any(${candidates}::uuid[]))
          and (ea.id is null or (ea.deleted_at is null and coalesce(ea.operational_domain, 'business') in ('business', 'both')))
          and (${orderRow.country_id || null}::uuid is null or l.country_id is null or l.country_id = ${orderRow.country_id || null}::uuid)
          and (${orderRow.country_branch_id || null}::uuid is null or l.country_branch_id is null or l.country_branch_id = ${orderRow.country_branch_id || null}::uuid)
          and (${orderRow.city_branch_id || null}::uuid is null or l.city_branch_id is null or l.city_branch_id = ${orderRow.city_branch_id || null}::uuid)
        order by l.id = any(${candidates}::uuid[]) desc, l.id
        limit 2
      `);
      if (!rows?.length) return null;
      if (rows.length === 2) {
        throw new ApiClientError("This booking account resolves to more than one ledger.", { status: 409, code: "SALES_LEDGER_AMBIGUOUS" });
      }
      return rows[0];
    }
    const debitLedger = await resolveBusinessLedger(debitCandidates);
    const creditLedger = await resolveBusinessLedger(creditCandidates);
    if (!debitLedger || !creditLedger) {
      throw new ApiClientError("Both booking accounts must resolve to ledgers in the booking's scope.", { status: 409, code: "SALES_LEDGER_NOT_FOUND" });
    }
    const debitLedgerId = String(debitLedger.id);
    const creditLedgerId = String(creditLedger.id);
    assertDistinctBookingLedgers(debitLedgerId, creditLedgerId, "Sales booking");

    // Managed lots: the full quantity must be reserved BEFORE any money is posted, so a short reservation
    // fails cleanly instead of posting a sale whose stock cannot be deducted.
    await assertReservationsReady(params.id, formData);

    const goodsAuditRemark = buildSalesGoodsAuditRemark(orderRow, referenceNo);
    const postingNarration = [
      goodsAuditRemark,
      body?.remarks?.trim() ? "Notes: " + body.remarks.trim() : null,
      "Transfer Currency: " + postingCurrency,
      settlement ? `Original: ${settlement.originalAmount} ${settlement.originalCurrency} ${settlement.operator} ${settlement.exchangeRate}` : "Exchange Rate: " + postingRate,
      "Amount: " + postingAmount
    ].filter(Boolean).join(" | ");

    // EXACTLY-ONCE GUARD (database-level). The status check above reads a snapshot; two requests that both pass it would both post.
    // This single conditional UPDATE is atomic in Postgres: only ONE request can take the claim for an order that is not yet
    // transferred; every other request gets 0 rows and is refused with 409. A claim older than 3 minutes (crashed request that never
    // posted) can be taken again; once the payment is posted the order carries transferPostedPaymentId and can never be claimed again
    // until the final status update. Editing a posted booking must never repost the complete sale.
    const claimRows = await withLocalPg(async (sql) => {
      const rows = await sql`
        update sales_orders set
          form_data = coalesce(form_data, '{}'::jsonb) || jsonb_build_object(
            'workflow', coalesce(form_data->'workflow', '{}'::jsonb) || jsonb_build_object('transferClaimAt', now()::text)
          )
        where id = ${params.id} and deleted_at is null
          and updated_at is not distinct from ${orderRow.order_version ?? orderRow.updated_at ?? null}::timestamptz
          and coalesce(ledger_posting_status, '') not in ('transferred', 'posted')
          and coalesce(form_data->'workflow'->>'transferStatus', '') <> 'transferred'
          and coalesce(form_data->'form'->'transferAudit', 'null'::jsonb) = 'null'::jsonb
          and coalesce(form_data->'workflow'->>'transferPostedPaymentId', '') = ''
          and (
            coalesce(form_data->'workflow'->>'transferClaimAt', '') = ''
            or (form_data->'workflow'->>'transferClaimAt')::timestamptz < now() - interval '3 minutes'
          )
        returning id, form_data->'workflow'->>'transferClaimAt' as claim_at
      `;
      return rows;
    });
    if (claimRows !== null) {
      if (claimRows.length !== 1) {
        throw new ApiClientError("This booking has already been transferred or is being transferred right now.", { status: 409, code: "ALREADY_TRANSFERRED" });
      }
      claimedOrder = { id: params.id, at: String(claimRows[0].claim_at) };
    }

    // ONE database transaction for the posting AND its stock: the payment, roznamcha, ledger lines, stock deduction and the
    // order status are written together or not at all. A stock refusal posts nothing; a posting refusal moves no stock.
    const core = await withLocalPg((db) => db.begin(async (tx: any) => {
      const pg = (fn: (sql: any) => Promise<any>) => fn(tx);
      const balances = await tx`select o.paid_amount, c.currency_code as country_currency
        from public.sales_orders o left join public.countries c on c.id = o.country_id
        where o.id = ${params.id}::uuid and o.deleted_at is null
        and o.form_data->'workflow'->>'transferClaimAt' = ${claimedOrder?.at ?? ""} for update of o`;
      if (balances.length !== 1) throw new Error("Sales booking was not found before posting.");
      const existingPaid = Number(balances[0]?.paid_amount || 0);
      if (!Number.isFinite(existingPaid) || existingPaid < 0) throw new Error("The stored sales receipt balance is invalid.");
      if (settlement && String(balances[0].country_currency || "").toUpperCase() !== settlement.finalCurrency) {
        throw new ApiClientError("Final currency is not the booking country's current accounting currency.", {
          status: 409, code: "SALES_BOOKING_FX_MISMATCH",
        });
      }
      await normalizeLegacySalesPaymentSources(tx, params.id, debitLedgerId);
      const priorEntry = await tx`
        select id from public.roznamcha_entries where source_module = 'sales'
          and source_transaction_type in ('sales_transfer_to_payment', 'sales_booking_transfer')
          and source_transaction_id = ${params.id}::uuid and deleted_at is null and status <> 'cancelled' limit 1
      `;
      if (priorEntry.length) throw new ApiClientError("This booking already has a transfer posting or requires legacy reconciliation.", {
        status: 409, code: "ALREADY_TRANSFERRED",
      });
      const rpcRows = await tx`
        select public.post_sales_booking_transfer(
          ${session.userId}::uuid,
          ${params.id}::uuid,
          'booking'::text,
          ${new Date().toISOString().slice(0, 10)}::date,
          ${postingAmount}::numeric,
          ${postingCurrency}::text,
          ${postingRate}::numeric,
          ${debitLedgerId}::uuid,
          ${creditLedgerId}::uuid,
          ${referenceNo}::text,
          ${postingNarration || null}::text
        ) as payment_id
      `;
      const paymentId = rpcRows[0]?.payment_id ? String(rpcRows[0].payment_id) : null;
      if (!paymentId) throw new Error("Sales posting did not return a payment id.");
      await pg(async (sql) => {
        await sql`
          update sales_orders set form_data = coalesce(form_data, '{}'::jsonb) || jsonb_build_object(
            'workflow', coalesce(form_data->'workflow', '{}'::jsonb) || jsonb_build_object('transferPostedPaymentId', ${String(paymentId)}::text)
          ) where id = ${params.id}
        `;
      });

      // sales_order_payments reads can hit the same RLS gap as sales_orders under the temp-session
      // bootstrap login; try direct-Postgres first.
      const viaPgPayment = await pg(async (sql) => {
        const rows = await sql`select id, roznamcha_entry_id from sales_order_payments where id = ${paymentId as string} limit 1`;
        return rows[0] ?? null;
      });
      const paymentRecord = (viaPgPayment ?? await requireSupabaseData(
        supabase
          .from("sales_order_payments")
          .select("id, roznamcha_entry_id")
          .eq("id", paymentId as string)
          .maybeSingle()
      )) as any;
      if (!paymentRecord) {
        throw new Error("Sales order payment record not found after posting.");
      }

      let rozType = "super_admin";
      if (orderRow.city_branch_id) rozType = "branch";
      else if (orderRow.country_branch_id || orderRow.country_id) rozType = "country";

      await tx`
        update public.roznamcha_entries set
          country_id = ${orderRow.country_id || null}::uuid,
          country_branch_id = ${orderRow.country_branch_id || null}::uuid,
          city_branch_id = ${orderRow.city_branch_id || null}::uuid,
          type = ${rozType}::roznamcha_type,
          entry_category = 'business',
          operational_domain = 'business',
          source_module = 'sales',
          source_transaction_type = 'sales_transfer_to_payment',
          source_transaction_id = ${params.id}::uuid
        where id = ${paymentRecord.roznamcha_entry_id}::uuid
      `;

      const viaPgLines = await pg(async (sql) => {
        return await sql`select ledger_id, debit, credit, currency, entry_serial_number from roznamcha_lines where roznamcha_entry_id = ${paymentRecord.roznamcha_entry_id}`;
      });
      const postedLines = (viaPgLines && viaPgLines.length > 0 ? viaPgLines : await requireSupabaseData(
        supabase
          .from("roznamcha_lines")
          .select("ledger_id, debit, credit, currency, entry_serial_number")
          .eq("roznamcha_entry_id", paymentRecord.roznamcha_entry_id)
      )) as any[];

      const exRate = settlement ? 1 : postingRate;
      // Internal posting-integrity assertion tag (developer diagnostics only, embedded in an
      // exception message if these checks ever fail — not user-facing UI copy).
      const postingAssertionLabel = "Sales booking";
      assertDistinctBookingLedgers(debitLedgerId, creditLedgerId, postingAssertionLabel);
      assertBalancedPostedLines({
        label: postingAssertionLabel,
        lines: postedLines,
        expectedDebitLedgerId: debitLedgerId,
        expectedCreditLedgerId: creditLedgerId,
        expectedAmount: form.bookingCurrencyConfigured === true ? Number(orderRow.order_total) : totalSalesAmount,
        expectedBaseAmount: form.bookingCurrencyConfigured === true ? Number(orderRow.order_total) : undefined,
        expectedExchangeRate: exRate
      });

      if (settlement && postedLines.some(line => String(line.currency || "").toUpperCase() !== settlement.finalCurrency)) {
        throw new Error("Posted Roznamcha currency does not match the approved Sales Booking final currency.");
      }

      const journalColumns = "id, journal_no, voucher_no, status, posted_at, country_id, country_branch_id, city_branch_id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number";
      const viaPgJournal = await pg(async (sql) => {
        const rows = await sql`select ${sql.unsafe(journalColumns)} from roznamcha_entries where id = ${paymentRecord.roznamcha_entry_id} limit 1`;
        return rows[0] ?? null;
      });
      const journalRecord = (viaPgJournal ?? await requireSupabaseData(
        supabase
          .from("roznamcha_entries")
          .select(journalColumns)
          .eq("id", paymentRecord.roznamcha_entry_id)
          .maybeSingle()
      )) as any;

      assertPostedRoznamchaTrace({
        label: postingAssertionLabel,
        entry: journalRecord
      });

      const newRemainingSales = Math.max(0, totalSalesAmount - existingPaid);
      const salesPaymentStatus = newRemainingSales <= 0.01 && existingPaid > 0 ? "completed" : existingPaid > 0 ? "partial" : "pending";

      // Stock deduction handling for Stock Sale vs Endorse Sale
      const saleType = String(form.saleType || form.saleSource || "").toLowerCase();
      const isEndorse = saleType === "endorse" || Boolean(form.isEndorseSale);
      // Stock lines the wizard saved from warehouse / local / in-transit stock. The wizard clears the form-level pick
      // (stockLotNo / selectedLotId / warehouseId / qtyNo) after every line, so the deduction must read each goods line.
      const LEGACY_STOCK_SOURCES = ["warehouse", "local", "in_transit"];
      const legacyStockLines: any[] = (Array.isArray(formData?.goodsEntries) ? formData.goodsEntries : []).filter((g: any) => {
        if (!g || g.managedLotId) return false;
        const lot = String(g.stockLotNo || g.lotNo || "").trim();
        const src = String(g.saleSource || g.stockSource || "").toLowerCase();
        return Boolean(lot) && (LEGACY_STOCK_SOURCES.includes(src) || /^(WH-|LP-|PLR-)/.test(lot));
      });
      const isStockSale = saleType === "stock" || (!isEndorse && (Boolean(form.stockLotNo) || Boolean(form.selectedLotId) || legacyStockLines.length > 0));
      const alreadyDeducted = Boolean(formData.stockDeducted || form.stockDeducted || orderRow.stock_deducted);

      let stockDeductionAudit: any = null;

      // Goods picked from managed lots: the reservation is deducted exactly once here (reserved -> sold / exported).
      const managedDeduction = usesManagedLots(formData);
      if (managedDeduction) {
        const finalized = await finalizeSaleStock(tx, { salesOrderId: params.id, salesOrderNo: orderRow.sales_order_no ?? null, userId: session.userId });
        stockDeductionAudit = {
          deducted: true,
          managedLots: true,
          deductedAt: now,
          deductedBy: session.userId,
          transfers: finalized.map((f: any) => ({ transferNo: f.transfer_no, lotId: f.lot_id, qty: Number(f.qty), purpose: f.purpose })),
        };
      }

      // Stock Journal: confirmed allocations linked to THIS sales booking leave the warehouse exactly once, here (Goods Issue / Delivery).
      // Reserved stock is hidden from the normal warehouse sale source (quantity_available), so it can never be deducted twice.
      // Inside this transaction a refusal rolls back the posting too: nothing is posted without its stock.
      const journalIssued = await issueForSalesOrder(tx, { salesOrderId: params.id, salesOrderNo: orderRow.sales_order_no ?? null, userId: session.userId });
      if (journalIssued && journalIssued.length > 0) {
        stockDeductionAudit = {
          ...(stockDeductionAudit ?? {}),
          deducted: true,
          stockJournal: true,
          deductedAt: now,
          deductedBy: session.userId,
          journalTransfers: journalIssued.map((t: any) => ({ transferNo: t.transfer_no, qty: Number(t.quantity), destination: t.destination_type })),
        };
      }

      if (isStockSale && !alreadyDeducted && !managedDeduction) {
        // Legacy stock: one deduction per saved goods line (its own lot, quantity and source). A booking that carries no goods-line
        // stock falls back to the form-level pick, as before.
        const stockLines = legacyStockLines.length > 0
          ? legacyStockLines.map((g: any) => ({
              soldQty: Number(g.qtyNo ?? g.quantity ?? 0),
              lotNo: String(g.stockLotNo || g.lotNo || "").trim(),
              lotId: g.selectedLotId ? String(g.selectedLotId).trim() : null,
              saleSource: String(g.saleSource || g.stockSource || "").toLowerCase(),
              warehouseId: g.warehouseId || null,
            }))
          : [{
              soldQty: Number(form.qtyNo || form.quantity || 1),
              lotNo: String(form.stockLotNo || form.allotName || "").trim(),
              lotId: form.selectedLotId ? String(form.selectedLotId).trim() : null,
              saleSource: String(form.saleSource || "").toLowerCase(),
              warehouseId: form.warehouseId || null,
            }];

        for (const line of stockLines) {
          const soldQty = line.soldQty;
          const lotNo = line.lotNo;
          const lotId = line.lotId;
          const saleSource = line.saleSource;
          if (!(soldQty > 0)) continue;

          // One transaction per line: the on-hand decrement and its stock_movements row are written together or not at all.
          await pg(async (sql: any) => {
            // the line's own source decides; a warehouse id alone only counts when the line names no source
            const isWarehouseLine = lotNo.startsWith("WH-") || saleSource === "warehouse" || (saleSource === "" && Boolean(line.warehouseId));
            if (isWarehouseLine) {
              let updatedBalances: any[] = [];
              // quantity_available is a Postgres GENERATED ALWAYS AS (quantity_on_hand -
              // quantity_reserved) STORED column (see supabase/production-schema.sql) —
              // it recomputes itself the instant quantity_on_hand changes and cannot be
              // assigned directly; Postgres rejects any UPDATE that tries to SET it.
              if (lotId) {
                updatedBalances = await sql`
                  UPDATE public.product_inventory_balances
                  SET quantity_on_hand = GREATEST(0, quantity_on_hand - ${soldQty}),
                      updated_at = ${now}
                  WHERE id = ${lotId}::uuid
                  RETURNING id, product_id, warehouse_id, quantity_on_hand
                `;
              } else if (lotNo.startsWith("WH-")) {
                const shortId = lotNo.replace(/^WH-/, "");
                updatedBalances = await sql`
                  UPDATE public.product_inventory_balances
                  SET quantity_on_hand = GREATEST(0, quantity_on_hand - ${soldQty}),
                      updated_at = ${now}
                  WHERE id::text LIKE ${shortId + '%'}
                  RETURNING id, product_id, warehouse_id, quantity_on_hand
                `;
              }

              if (updatedBalances.length > 0) {
                const b = updatedBalances[0];
                await sql`
                  INSERT INTO public.stock_movements (
                    movement_type,
                    goods_id,
                    warehouse_id,
                    country_id,
                    city_branch_id,
                    quantity,
                    reference_no,
                    notes,
                    movement_date,
                    created_by,
                    created_at,
                    updated_at
                  ) VALUES (
                    'STOCK_OUT',
                    ${b.product_id},
                    ${b.warehouse_id},
                    ${orderRow.country_id ?? null},
                    ${orderRow.city_branch_id ?? null},
                    ${soldQty},
                    ${referenceNo},
                    ${'Sales Booking Posting - Bill: ' + (referenceNo || 'Direct')},
                    ${now},
                    ${session.userId ? sql`${session.userId}::uuid` : null},
                    ${now},
                    ${now}
                  )
                `;
              }
            } else if (lotNo.startsWith("LP-") || saleSource === "local") {
              if (lotId) {
                await sql`
                  UPDATE public.local_purchases
                  SET numbers = GREATEST(0, numbers - ${soldQty}),
                      status = CASE WHEN (numbers - ${soldQty}) <= 0 THEN 'sold' ELSE status END,
                      updated_at = ${now}
                  WHERE id = ${lotId}::uuid
                `;
              } else {
                const shortId = lotNo.replace(/^LP-/, "");
                await sql`
                  UPDATE public.local_purchases
                  SET numbers = GREATEST(0, numbers - ${soldQty}),
                      status = CASE WHEN (numbers - ${soldQty}) <= 0 THEN 'sold' ELSE status END,
                      updated_at = ${now}
                  WHERE id::text LIKE ${shortId + '%'} OR lot_no = ${lotNo}
                `;
              }
            } else if (saleSource === "in_transit" || lotNo.startsWith("PLR-")) {
              const cleanPlrNo = lotNo.split("#")[0];
              await sql`
                UPDATE public.purchase_loading_records
                SET loaded_quantity = GREATEST(0, loaded_quantity - ${soldQty}),
                    updated_at = ${now}
                WHERE loading_record_no = ${cleanPlrNo}
              `;
            }
          });
        }

        stockDeductionAudit = {
          deducted: true,
          deductedAt: now,
          deductedBy: session.userId,
          soldQty: stockLines.reduce((s, l) => s + (l.soldQty > 0 ? l.soldQty : 0), 0),
          lotNo: stockLines.map((l) => l.lotNo).join(","),
          lotId: null,
          lines: stockLines.map((l) => ({ lotNo: l.lotNo, lotId: l.lotId, qty: l.soldQty, source: l.saleSource })),
        };
      }

      const debitLine = postedLines.find((line) => line.ledger_id === debitLedgerId && Number(line.debit) > 0);
      const creditLine = postedLines.find((line) => line.ledger_id === creditLedgerId && Number(line.credit) > 0);
      const transferVerification = {
        journalId: journalRecord.id,
        voucherNo: journalRecord.voucher_no,
        debitSerial: debitLine?.entry_serial_number,
        creditSerial: creditLine?.entry_serial_number,
        debitAmount: debitLine?.debit,
        creditAmount: creditLine?.credit,
        debitCurrency: debitLine?.currency,
        creditCurrency: creditLine?.currency,
        postedAt: journalRecord.posted_at ?? now,
        userName: updatedFormData.form.transferAudit.userName,
      };

      const patch = {
        ledger_posting_status: "posted",
        payment_status: salesPaymentStatus,
        paid_amount: existingPaid,
        remaining_amount: newRemainingSales,
        updated_at: now,
        form_data: {
          ...updatedFormData,
          transferVerification,
          transferTrace: {
            ...updatedFormData.transferTrace,
            paymentId,
            roznamchaEntryId: journalRecord.id,
            journalNo: journalRecord.journal_no,
            voucherNo: journalRecord.voucher_no,
            debitLedgerId,
            creditLedgerId,
            debitLedgerCode: debitLedger.code,
            creditLedgerCode: creditLedger.code,
            lines: postedLines.map(line => ({
              ledgerId: line.ledger_id, debit: line.debit, credit: line.credit, currency: line.currency,
            })),
          },
          stockDeducted: (isStockSale || managedDeduction) ? true : (alreadyDeducted ? true : false),
          isEndorseSale: isEndorse,
          stockDeductionAudit: stockDeductionAudit || formData.stockDeductionAudit || null,
          endorseFulfillment: isEndorse ? {
            saleQty: Number(form.qtyNo || form.quantity || 0),
            purchasedQty: Number(form.endorseQtyPurchased || 0),
            allocatedQty: Number(form.endorseQtyAllocated || 0),
            outstandingQty: Math.max(0, Number(form.qtyNo || form.quantity || 0) - Number(form.endorseQtyAllocated || 0)),
            linkedLotNo: form.endorseLinkedLotNo || null
          } : (formData.endorseFulfillment || null),
          form: {
            ...updatedFormData.form,
            stockDeducted: isStockSale ? true : (alreadyDeducted ? true : false),
            isEndorseSale: isEndorse
          },
          workflow: {
            ...updatedFormData.workflow,
            journalStatus: "posted",
            ledgerStatus: "posted",
            paymentKind: paymentRoute.paymentKind,
            paymentStatus: salesPaymentStatus,
            lastPaymentId: paymentId,
            lastRoznamchaEntryId: paymentRecord.roznamcha_entry_id,
            lastPaymentPostedAt: now
          },
          lastPaymentTrace: {
            paymentId,
            roznamchaEntryId: paymentRecord.roznamcha_entry_id,
            debitLedgerId: debitLedgerId,
            creditLedgerId: creditLedgerId,
            paymentKind: paymentRoute.paymentKind,
            superAdminSerialNumber: journalRecord.super_admin_serial_number,
            countryTransactionSerialNumber: journalRecord.country_transaction_serial_number,
            branchTransactionSerialNumber: journalRecord.branch_transaction_serial_number,
            systemBillNumber,
            manualBillNumber,
            partyName,
            referenceNo,
            narration: postingNarration
          }
        }
      };

      // Same RLS bypass as the read above — sales_orders writes are blocked under the temp-session
      // bootstrap login just like reads are.
      const viaPgUpdate = await pg(async (sql) => {
        const rows = await sql`
          update sales_orders set
            ledger_posting_status = ${patch.ledger_posting_status},
            payment_status = ${patch.payment_status},
            paid_amount = ${patch.paid_amount},
            remaining_amount = ${patch.remaining_amount},
            updated_at = ${patch.updated_at},
            form_data = ${sql.json(patch.form_data as any)}
          where id = ${params.id}
          returning id, sales_order_no, sales_contract_no, ledger_posting_status, payment_status
        `;
        return rows[0] ?? null;
      });
      const updatedOrder = (viaPgUpdate ?? await requireSupabaseData(
        supabase
          .from("sales_orders")
          .update(patch)
          .eq("id", params.id)
          .select("id, sales_order_no, sales_contract_no, ledger_posting_status, payment_status")
          .maybeSingle()
      )) as any;

    return { paymentId, updatedOrder, patch, existingPaid, newRemainingSales, salesPaymentStatus };
    }));
    paymentPosted = true;
    if (!core) throw new Error("The sales transfer did not complete.");
    const { updatedOrder, patch, existingPaid, newRemainingSales, salesPaymentStatus } = core;

    await writeAuditLog({
      action: "transfer_to_sales_payment",
      entityTable: "sales_orders",
      entityId: params.id,
      before: order,
      after: patch,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    const resPayload = {
      success: true,
      salesOrderId: params.id,
      salesOrderNo: updatedOrder?.sales_order_no,
      systemBillNumber,
      manualBillNumber,
      referenceNo,
      transferOnly: true,
      ledgerPostingStatus: "posted",
      paymentStatus: salesPaymentStatus,
      paymentKind: paymentRoute.paymentKind,
      paidAmount: existingPaid,
      remainingAmount: newRemainingSales,
      transferVerification: patch.form_data.transferVerification,
    };

    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, resPayload);
    }

    return apiOk(resPayload);
  } catch (error) {
    if (claimedOrder && !paymentPosted) {
      try {
        const failedClaim = claimedOrder;
        await withLocalPg(async (sql) => {
          await sql`
            update sales_orders set form_data = jsonb_set(form_data, '{workflow}', (coalesce(form_data->'workflow', '{}'::jsonb) - 'transferClaimAt'))
            where id = ${failedClaim.id} and coalesce(form_data->'workflow'->>'transferPostedPaymentId', '') = ''
              and form_data->'workflow'->>'transferClaimAt' = ${failedClaim.at}
          `;
        });
      } catch (releaseErr) {
        console.warn("[sales-transfer] could not release the transfer claim:", releaseErr instanceof Error ? releaseErr.message : releaseErr);
      }
    }
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    console.error("SALES_TRANSFER_TO_PAYMENT_ERROR:", error);
    return handleApiError(error);
  }
}
