import { assertPayableBankId } from "@/lib/services/payment-bank-guard";
import { billFxOperator, effectiveFxRate } from "@/lib/purchases/fx-operator";
import { NextRequest } from "next/server";
import type postgres from "postgres";
import { z } from "zod";
import { apiCreated, apiOk, apiError, handleApiError, ApiClientError } from "@/lib/api/response";
import { parseJsonish } from "@/lib/stock-journal/model";
import { resolvePaymentCondition, resolvePurchaseAmounts } from "@/lib/services/purchase-calculation-service";
import { advanceClearance, loadedPayable, paymentInPurchaseCurrency } from "@/lib/purchases/loaded-payable";
import { exactBookingPaymentQuote, purchaseBaseUnits } from "@/lib/purchases/booking-payment-allocation";
import { comparePurchasePaymentToLimit, isPurchaseBalanceCleared } from "@/lib/purchases/payment-precision";
import { contractLines, loadingGoodsValue } from "@/lib/purchases/loading-value";
import { purchaseOrderPaymentPostSchema, uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { writeAuditLog } from "@/lib/api/supabase";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { withKeyedLock } from "@/lib/db/keyed-lock";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { assertBalancedPostedLines, assertDistinctBookingLedgers, assertPostedRoznamchaTrace } from "@/lib/services/posting-verification";
import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse, generateTenantHash, getIdempotencyKey, hashPayload } from "@/lib/api/idempotency";
import { allowedPaymentKindsForCondition } from "@/lib/purchases/local-purchase-payment-routing";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { getRequestLanguage } from "@/lib/i18n/server";

const paramsSchema = z.object({
  id: uuidSchema
});

type BookingTransaction = postgres.TransactionSql;
type PurchasePaymentSql = postgres.Sql | BookingTransaction;
type SavedPurchasePayment = {
  responseData: { paymentId: string; status?: "posted" };
  audit?: Parameters<typeof writeAuditLog>[0];
};

function selectLockedPurchaseBooking(sql: BookingTransaction, id: string) {
  return sql`
    select id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
           currency_code, exchange_rate, order_total, total_goods_original, total_goods_usd, advance_paid, remaining_paid, credit_amount,
           remaining_due, form_data, ledger_posting_status, payment_status, 'purchase_booking' as order_type
    from purchase_orders where id = ${id}::uuid and deleted_at is null
    limit 1 for update
  `;
}

const purchasePaymentScope = "PURCHASE_PAYMENT";

async function claimBookingPayment(tx: BookingTransaction, key: {
  key: string; tenantHash: string; requestHash: string; userId: string; countryId: string | null; cityBranchId: string | null; orderId: string;
}): Promise<{ claimId: string } | { paymentId: string }> {
  const inserted = await tx`
    insert into public.idempotency_keys (
      idempotency_key, tenant_hash, scope_module, user_id, country_id, city_branch_id,
      business_reference, request_hash, status, expires_at
    ) values (${key.key}, ${key.tenantHash}, ${purchasePaymentScope}, ${key.userId}::uuid,
      ${key.countryId}::uuid, ${key.cityBranchId}::uuid, ${key.orderId}, ${key.requestHash}, 'PROCESSING', now() + interval '90 seconds')
    on conflict (tenant_hash, idempotency_key) do nothing
    returning id::text
  `;
  if (inserted[0]?.id) return { claimId: inserted[0].id };

  const existing = await tx`
    select status, request_hash, response_body
    from public.idempotency_keys
    where tenant_hash = ${key.tenantHash} and idempotency_key = ${key.key}
      and scope_module = ${purchasePaymentScope} and business_reference = ${key.orderId}
      and user_id = ${key.userId}::uuid
    for update
  `;
  const saved = existing[0];
  if (!saved || saved.request_hash !== key.requestHash) {
    throw new ApiClientError("This payment retry key was used with a different request. Check the payment history before starting a new entry.", { status: 409, code: "IDEMPOTENCY_MISMATCH" });
  }
  // A pre-fix PROCESSING row might already represent a partial payment that
  // the old handler committed. Never guess by stealing it after its expiry.
  if (saved.status !== "COMPLETED") {
    throw new ApiClientError("This payment needs reconciliation before retrying. Check its payment history first.", { status: 409, code: "IDEMPOTENCY_UNCERTAIN" });
  }
  const id = uuidSchema.safeParse(saved.response_body?.data?.paymentId ?? saved.response_body?.paymentId);
  if (id.success) {
    const replayPayment = await tx`
      select p.id from public.purchase_order_payments p
      join public.roznamcha_entries j on j.id = p.roznamcha_entry_id
      where p.id = ${id.data}::uuid and p.purchase_order_id = ${key.orderId}::uuid
        and p.created_by = ${key.userId}::uuid and p.deleted_at is null and p.status = 'posted'
        and j.deleted_at is null and j.status = 'posted' and j.posted_at is not null
    `;
    if (replayPayment[0]) return { paymentId: id.data };
  }
  throw new ApiClientError("The recorded payment could not be verified. Check this order's payment history.", { status: 409, code: "IDEMPOTENCY_UNCERTAIN" });
}

async function completeBookingPayment(tx: BookingTransaction, claimId: string, responseData: SavedPurchasePayment["responseData"]) {
  const completed = await tx`
    update public.idempotency_keys set status = 'COMPLETED', response_code = 201,
      response_body = ${tx.json({ ok: true, data: responseData, isReplayed: true })},
      updated_at = now(), expires_at = now() + interval '30 days'
    where id = ${claimId}::uuid and status = 'PROCESSING'
    returning id
  `;
  if (!completed[0]) throw new Error("Could not confirm this payment for safe retry.");
}

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
  // the amount above is in the bill's PRICING currency (`currencyType`); `purchaseCurrency` on a goods line holds the branch currency, so it must not label a USD price as AED
  const purchaseCurrency = String(goodsEntries[0]?.currencyType || goodsEntries[0]?.pricingCurrency || form.currencyType || form.pricingCurrency || orderRow.purchase_currency || orderRow.currency_code || goodsEntries[0]?.purchaseCurrency || form.purchaseCurrency || "USD").toUpperCase();
  return `Purchase Bill: ${billNo} | Goods: ${goodsName} | Qty: ${formatAuditNumber(totalQty)}${unit ? ` ${unit}` : ""} | Gross WT: ${formatAuditNumber(grossWeight)} KG | Net WT: ${formatAuditNumber(netWeight)} KG | Purchase Price: ${formatAuditNumber(purchaseAmount)} ${purchaseCurrency}`;
}

async function assertLedgerMatchesPurchaseScope(
  sql: any,
  ledgerId: string,
  orderRow: any,
  label: string,
  extraHints: { code?: string; name?: string } = {}
) {
  let ledger: any = null;

  const isUuid = (val: any) =>
    typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

  // 1. Direct match by ledgers.id
  if (isUuid(ledgerId)) {
    const rows = await sql`
      select id, code, name, country_id, country_branch_id, city_branch_id
      from ledgers where id = ${ledgerId}::uuid and deleted_at is null
      limit 1
    `;
    if (rows[0]) ledger = rows[0];
  }

  // 2. Match by ledgers.account_id
  if (!ledger && isUuid(ledgerId)) {
    const byAccount = await sql`
      select id, code, name, country_id, country_branch_id, city_branch_id
      from ledgers where account_id = ${ledgerId}::uuid and deleted_at is null
      limit 1
    `;
    if (byAccount[0]) ledger = byAccount[0];
  }

  // 3. Match if ledgerId is enterprise_accounts.id (map by account_code or id)
  if (!ledger && isUuid(ledgerId)) {
    const eaRows = await sql`
      select l.id, l.code, l.name, l.country_id, l.country_branch_id, l.city_branch_id
      from enterprise_accounts ea
      join ledgers l on (l.code = ea.account_code or l.account_id = ea.id) and l.deleted_at is null
      where ea.id = ${ledgerId}::uuid
      limit 1
    `;
    if (eaRows[0]) ledger = eaRows[0];
  }

  // 4. Match if ledgerId is accounts.id (map by account_code or id)
  if (!ledger && isUuid(ledgerId)) {
    const accRows = await sql`
      select l.id, l.code, l.name, l.country_id, l.country_branch_id, l.city_branch_id
      from accounts a
      join ledgers l on (l.code = a.account_code or l.code = a.code or l.account_id = a.id) and l.deleted_at is null
      where a.id = ${ledgerId}::uuid
      limit 1
    `;
    if (accRows[0]) ledger = accRows[0];
  }

  // 5. Match by explicit candidate code from hint or if ledgerId itself is a code string
  const candidateCode = (extraHints.code || (!isUuid(ledgerId) ? ledgerId : ""))?.trim();
  if (!ledger && candidateCode) {
    const byCode = await sql`
      select id, code, name, country_id, country_branch_id, city_branch_id
      from ledgers
      where (code = ${candidateCode} or code ilike ${candidateCode}) and deleted_at is null
      order by case when country_id = ${orderRow.country_id || null} then 0 else 1 end
      limit 1
    `;
    if (byCode[0]) ledger = byCode[0];
  }

  // 6. Match by order supplier / payable account if label is Debit
  if (!ledger && label.toLowerCase() === "debit") {
    const form = orderRow.form_data?.form || {};
    const orderSupplierCode = (
      orderRow.sales_account_no ||
      orderRow.supplier_account_no ||
      form.salesAccountNo ||
      form.supplierAccountNo ||
      form.supplierAccountCode ||
      ""
    ).trim();

    if (orderSupplierCode) {
      const byOrderCode = await sql`
        select id, code, name, country_id, country_branch_id, city_branch_id
        from ledgers
        where (code ilike ${orderSupplierCode} or code ilike ${'%' + orderSupplierCode + '%'})
          and deleted_at is null
        order by case when country_id = ${orderRow.country_id || null} then 0 else 1 end
        limit 1
      `;
      if (byOrderCode[0]) ledger = byOrderCode[0];
    }

    if (!ledger) {
      const orderSupplierName = (
        orderRow.supplier_name ||
        form.supplierName ||
        form.salesAccountName ||
        extraHints.name ||
        ""
      ).trim();
      if (orderSupplierName) {
        const byOrderName = await sql`
          select id, code, name, country_id, country_branch_id, city_branch_id
          from ledgers
          where name ilike ${'%' + orderSupplierName + '%'}
            and deleted_at is null
          order by case when country_id = ${orderRow.country_id || null} then 0 else 1 end
          limit 1
        `;
        if (byOrderName[0]) ledger = byOrderName[0];
      }
    }
  }

  // 7. Match by name hint if provided
  if (!ledger && extraHints.name) {
    const byName = await sql`
      select id, code, name, country_id, country_branch_id, city_branch_id
      from ledgers
      where name ilike ${'%' + extraHints.name.trim() + '%'} and deleted_at is null
      order by case when country_id = ${orderRow.country_id || null} then 0 else 1 end
      limit 1
    `;
    if (byName[0]) ledger = byName[0];
  }

  if (!ledger) {
    throw new Error(label + " ledger was not found.");
  }

  if (orderRow.country_id && ledger.country_id && ledger.country_id !== orderRow.country_id) {
    throw new Error(label + " ledger belongs to a different country and cannot be used for this purchase.");
  }

  return ledger;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    // Register summaries need only saved numeric fields. Reuse the read pool and
    // avoid localizing narration for every visible bill; authorization is identical.
    const summaryOnly = request.nextUrl.searchParams.get("summary") === "1";
    const readPayments = summaryOnly ? withReadPg : withLocalPg;

    // withLocalPg, not the RLS-gated Supabase client — see the POST handler below for why.
    const { order, rows } = (await readPayments(async (sql) => {
      let orderRows = await sql`
        select id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
               currency_code, exchange_rate, order_total, total_goods_original, total_goods_usd, advance_paid, remaining_paid, credit_amount,
               remaining_due, form_data, ledger_posting_status, payment_status, 'purchase_booking' as order_type
        from purchase_orders where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      if (!orderRows[0]) {
        orderRows = await sql`
          select id, coalesce(manual_bill_no, 'LP-' || substring(id::text, 1, 8)) as purchase_order_no,
                 contract_no as purchase_contract_no,
                 country_id, country_branch_id, city_branch_id,
                 purchase_currency as currency_code, exchange_rate,
                 coalesce(final_cost, purchase_cost, 0) as order_total,
                 coalesce(advance_amount, 0) as advance_paid,
                 0 as remaining_paid,
                  case when lower(coalesce(payment_mode, '')) like '%credit%'
                       then coalesce(final_cost, purchase_cost, 0)
                       else 0 end as credit_amount,
                  case when lower(coalesce(payment_mode, '')) like '%credit%' and coalesce(remaining_balance, 0) <= 0
                       then coalesce(final_cost, purchase_cost, 0)
                       when coalesce(remaining_balance, 0) > 0 then remaining_balance
                       else greatest(0, coalesce(final_cost, purchase_cost, 0) - coalesce(advance_amount, 0))
                  end as remaining_due,
                 'posted' as ledger_posting_status,
                 case when coalesce(remaining_balance, 0) <= 0 and coalesce(advance_amount, 0) > 0 then 'Paid'
                      when coalesce(advance_amount, 0) > 0 then 'Partial'
                      else 'Pending' end as payment_status,
                 'local_purchase' as order_type,
                 supplier_name, purchase_account_no, sales_account_no, broker_account_no,
                 goods_name, payment_mode, advance_percentage
          from local_purchases where id = ${params.id}::uuid and deleted_at is null
          limit 1
        `;
      }
      const paymentRows = await sql`
        select
          p.id, coalesce(p.purchase_order_id, p.local_purchase_id) as purchase_order_id, p.local_purchase_id,
          p.kind, p.entry_date, p.amount, p.currency_code, p.exchange_rate,
          p.debit_ledger_id, p.credit_ledger_id, p.roznamcha_entry_id, p.status, p.reference_no,
          p.narration, p.source_module, p.source_transaction_type, p.source_reference_no,
          p.original_currency_code, p.currency_name, p.base_currency_amount,
          to_jsonb(p)->>'applied_purchase_amount' as applied_purchase_amount, p.created_at,
          p.loading_record_id,
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
        where (p.purchase_order_id = ${params.id}::uuid or p.local_purchase_id = ${params.id}::uuid)
          and p.deleted_at is null
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

    if (summaryOnly) {
      return apiOk({ payments: rows.map((payment: any) => ({
        id: payment.id, purchase_order_id: payment.purchase_order_id,
        local_purchase_id: payment.local_purchase_id, kind: payment.kind,
        entry_date: payment.entry_date, created_at: payment.created_at,
        amount: payment.amount, currency_code: payment.currency_code,
        exchange_rate: payment.exchange_rate, status: payment.status,
      })), limit: 200 });
    }

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

async function postPaymentHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    await assertPayableBankId(body.typeDetails?.bankId);

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
               currency_code, exchange_rate, order_total, total_goods_original, total_goods_usd, advance_paid, remaining_paid, credit_amount,
               remaining_due, form_data, ledger_posting_status, payment_status, 'purchase_booking' as order_type
        from purchase_orders where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      if (rows[0]) return rows[0];

      const lpRows = await sql`
        select id, coalesce(manual_bill_no, 'LP-' || substring(id::text, 1, 8)) as purchase_order_no,
               contract_no as purchase_contract_no,
               country_id, country_branch_id, city_branch_id, company_id,
               purchase_currency as currency_code, exchange_rate,
               coalesce(final_cost, purchase_cost, 0) as order_total,
               coalesce(advance_amount, 0) as advance_paid,
               0 as remaining_paid,
                case when lower(coalesce(payment_mode, '')) like '%credit%'
                     then coalesce(final_cost, purchase_cost, 0)
                     else 0 end as credit_amount,
                case when lower(coalesce(payment_mode, '')) like '%credit%' and coalesce(remaining_balance, 0) <= 0
                          and exists (select 1 from purchase_order_payments p0 where p0.local_purchase_id = local_purchases.id and p0.deleted_at is null)
                     then 0
                     when lower(coalesce(payment_mode, '')) like '%credit%' and coalesce(remaining_balance, 0) <= 0
                     then coalesce(final_cost, purchase_cost, 0)
                     when coalesce(remaining_balance, 0) > 0 then remaining_balance
                     else greatest(0, coalesce(final_cost, purchase_cost, 0) - coalesce(advance_amount, 0))
                end as remaining_due,
               'posted' as ledger_posting_status,
               supplier_name, purchase_account_no, sales_account_no, broker_account_no,
               goods_name, payment_mode, advance_percentage,
               'local_purchase' as order_type
        from local_purchases where id = ${params.id}::uuid and deleted_at is null
        limit 1
      `;
      return lpRows[0] ?? null;
    });

    authorizeApiScope(session, {
      resource: "purchases",
      action: "post",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null
    });

    if (!order) {
      return apiError("NOT_FOUND", "Purchase bill or order not found.", 404);
    }

    async function postForOrder(orderRow: any, bookingTx?: BookingTransaction): Promise<SavedPurchasePayment> {
      const paymentDb = bookingTx
        ? <T>(fn: (sql: PurchasePaymentSql) => Promise<T>) => fn(bookingTx)
        : withLocalPg;
      // A Local Purchase is paid only through the workflow its saved condition routes to (Credit page = credit, Advance page =
      // advance, Remaining/Invoice/Cash/Bank = remaining). Any other kind is an incorrect route and is refused.
      if (orderRow.order_type === "local_purchase") {
        const allowedKinds = allowedPaymentKindsForCondition(orderRow.payment_mode);
        if (!allowedKinds.includes(body.kind)) {
          throw new ApiClientError(
            `This bill's payment condition is '${orderRow.payment_mode || "Cash"}'. Pay it from its own workflow (${allowedKinds.join(" / ") || "none"}), not '${body.kind}'.`,
            { status: 409, code: "WRONG_PAYMENT_WORKFLOW" },
          );
        }
      }
      // many bookings hold form_data as a JSON string inside the jsonb column — read it as an object so the payment condition,
      // advance percent and booked quantity below are the real ones
      orderRow.form_data = parseJsonish(orderRow.form_data);
      const form = orderRow.form_data?.form || {};

      // Currency model (see 20261001_multicurrency_purchase_payment_fix.sql):
      //  - order_total is in base currency. Paid totals and remaining_due are in purchase currency.
      //  - orderRate = base-currency units per 1 purchase-currency unit.
      //  - body.exchangeRate = base-currency units per 1 body.currencyCode unit
      //    (the historical FX rate for this payment).
      // All balance validation below is done in the PURCHASE currency.
      const orderCcy = (orderRow.currency_code || orderRow.purchase_currency || "USD").toUpperCase();
      // the bill's own ÷ / × operator: a "÷ 77.2" bill means 1 purchase unit = 1/77.2 base units
      const orderRate = effectiveFxRate(Number(orderRow.exchange_rate || form.exchangeRate || 1), billFxOperator(orderRow.form_data));
      const bodyCcy = (body.currencyCode || orderCcy).toUpperCase();
      let bodyRate = Number(body.exchangeRate || 0);
      if (bodyRate <= 0) bodyRate = bodyCcy === orderCcy ? orderRate : 1;

      // the payment amount expressed in the order's (purchase) currency
      const toPurchaseCcy = (amt: number, ccy: string, rate: number) =>
        ccy === orderCcy ? amt : (amt * rate) / (orderRate || 1);

      // order_total is stored in the LOCAL/base currency by the booking wizard (see the
      // Roznamcha double-conversion fix in the transfer route/local-pg service) — it is
      // NOT in the purchase currency despite this function's own long-standing comment
      // above. total_goods_original/total_goods_usd hold the true purchase-currency total.
      const orderTotalPur = Number(orderRow.total_goods_original || orderRow.total_goods_usd || 0) ||
        Number(orderRow.order_total || 0) / orderRate;
      const advancePaidPur = Number(orderRow.advance_paid || 0);
      const remainingPaidPur = Number(orderRow.remaining_paid || 0);
      const creditAmountPur = Number(orderRow.credit_amount || 0);

      let remainingDuePur = 0;
      if (orderRow.remaining_due != null) {
        remainingDuePur = Number(orderRow.remaining_due);
      } else {
        remainingDuePur = Math.max(0, orderTotalPur - advancePaidPur - remainingPaidPur - creditAmountPur);
      }
      if (orderRow.order_type === "local_purchase") {
        // The stored remaining_balance column is not reduced by a Cash / Bank / Invoice / Final payment, so the balance read from it
        // stayed at the full amount and the same balance could be paid twice. For a Local Purchase the balance is also the total less
        // the ledger-verified posted payments in the purchase currency (the register and the loading gate use the same rows). Read
        // inside the payment lock; the lower of the two values is used, so this never relaxes the existing check.
        const [verified] = await paymentDb((sql) => sql`
          select coalesce(sum(p.amount), 0)::float8 as paid
          from public.purchase_order_payments p
          where p.local_purchase_id = ${params.id}::uuid
            and p.deleted_at is null
            and p.status = 'posted'
            and p.kind <> 'booking'
            and p.currency_code = ${orderCcy}
            and p.posted_to_journal = true
            and p.roznamcha_entry_id is not null
            and p.debit_ledger_id is not null
            and p.credit_ledger_id is not null
        `) as any[];
        remainingDuePur = Math.min(remainingDuePur, Math.max(0, orderTotalPur - Number(verified?.paid ?? 0)));
      }

      const goodsEntries = Array.isArray(orderRow.form_data?.goodsEntries) ? orderRow.form_data.goodsEntries : [];
      const formTotalPur = goodsEntries.length
        ? goodsEntries.reduce((sum: number, item: any) => sum + Number(item.totalAmount || 0), 0)
        : Number(form.totalAmount || orderTotalPur);

      const advancePercent = Number(form.endorsementPercent || form.endorsement_percent || form.advancePercent || form.advance_percent || 0);
      const requiredAdvancePur = advancePercent > 0 ? (formTotalPur * advancePercent) / 100 : 0;
      const remainingAdvancePur = Math.max(0, requiredAdvancePur - advancePaidPur);
      const tolerance = 0.01;

      const debitLedger = await paymentDb((sql) => assertLedgerMatchesPurchaseScope(
        sql,
        body.debitLedgerId,
        orderRow,
        "Debit",
        {
          code: (body as any).debitLedgerCode || (body as any).doubleEntry?.debitCode,
          name: (body as any).doubleEntry?.debitName
        }
      )) as any;
      const creditLedger = await paymentDb((sql) => assertLedgerMatchesPurchaseScope(
        sql,
        body.creditLedgerId,
        orderRow,
        "Credit",
        {
          code: (body as any).creditLedgerCode || (body as any).doubleEntry?.creditCode,
          name: (body as any).doubleEntry?.creditName
        }
      )) as any;
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

      // payment amount, expressed in the order's purchase currency, for validation.
      // When the payment is entered in the branch country's LOCAL currency (the form's default: Final Local Amount = purchase amount × rate)
      // the amount is already local — post_purchase_* treats it as base (rate 1) — so converting it again with the USD→local rate (as if it were a
      // foreign-currency amount) overstated it by exactly that rate and rejected valid payments ("cannot exceed remaining payable").
      // Convert local → purchase currency by DIVIDING by the rate. The client's rate is only honoured within ±10% of the order's own rate, so
      // it can never be used to understate the amount and slip past the overpayment check.
      const localCcyRows = orderRow.country_id
        ? ((await paymentDb((sql) => sql`select upper(currency_code) as c from countries where id = ${orderRow.country_id}::uuid limit 1`)) as any[])
        : [];
      const localCcy = String(localCcyRows[0]?.c || "").toUpperCase();
      const explicitApplied = body.purchaseAppliedAmount;
      const exactQuote = explicitApplied != null && orderRow.order_type === "purchase_booking" && body.kind !== "booking"
        ? exactBookingPaymentQuote({
            applied: explicitApplied, tender: Number(body.amount), billCurrency: orderCcy,
            baseCurrency: localCcy, tenderCurrency: bodyCcy, rateToBase: bodyRate
          })
        : null;
      if (explicitApplied != null && !exactQuote) {
        throw new ApiClientError("The bill amount, payment currency and manual exchange rate do not match.", {
          status: 422, code: "PURCHASE_PAYMENT_QUOTE_MISMATCH"
        });
      }
      let bodyAmountPur: number;
      if (exactQuote) {
        for (const ledger of [debitLedger, creditLedger]) {
          const sameScope = ledger.country_id === orderRow.country_id
            && (ledger.country_branch_id || null) === (orderRow.country_branch_id || null)
            && (ledger.city_branch_id || null) === (orderRow.city_branch_id || null);
          if (!sameScope) {
            throw new ApiClientError("Use debit and credit accounts from the branch that owns this purchase bill.", {
              status: 409, code: "PURCHASE_PAYMENT_WRONG_LEDGER_BRANCH"
            });
          }
        }
        bodyAmountPur = exactQuote.applied;
      } else if (bodyCcy !== orderCcy && localCcy && bodyCcy === localCcy) {
        const bodyLocalRate = Number(body.exchangeRate || 0);
        const usable = bodyLocalRate > 0 && orderRate > 0 && Math.abs(bodyLocalRate / orderRate - 1) <= 0.1 ? bodyLocalRate : orderRate || 1;
        bodyAmountPur = Number(body.amount) / usable;
      } else {
        bodyAmountPur = toPurchaseCcy(Number(body.amount), bodyCcy, bodyRate);
      }

      const exactBillSettlement = Boolean(exactQuote) || (bodyCcy === orderCcy && body.kind !== "booking");
      const compareLimit = (limit: number, fxTolerance: number) => exactBillSettlement
        ? comparePurchasePaymentToLimit(bodyAmountPur, limit)
        : limit <= fxTolerance ? "settled" : bodyAmountPur > limit + fxTolerance ? "exceeds" : "allowed";
      if (exactBillSettlement && compareLimit(remainingDuePur, 0) === "invalid") {
        throw new ApiClientError("Use a valid purchase payment amount.", { status: 422, code: "INVALID_PAYMENT_AMOUNT" });
      }
      if (body.kind === "advance" && advancePercent > 0 && !exactBillSettlement) {
        const maxAllowedAdvancePur = Math.max(remainingAdvancePur, remainingDuePur);
        if (remainingDuePur <= tolerance) {
          throw new Error("This purchase order is already fully paid. Duplicate posting is not allowed.");
        }
        if (bodyAmountPur > maxAllowedAdvancePur + tolerance) {
          throw new Error(`Payment amount cannot exceed remaining purchase order balance (${remainingDuePur.toFixed(2)} ${orderCcy}).`);
        }
      }

      if (exactBillSettlement || body.kind === "remaining" || body.kind === "credit") {
        const result = compareLimit(remainingDuePur, tolerance);
        if (result === "settled") {
          throw new Error("This purchase order has no remaining payable balance. Duplicate posting is not allowed.");
        }
        if (result === "exceeds") {
          throw new Error(`Payment amount cannot exceed remaining payable balance (${remainingDuePur.toFixed(2)} ${orderCcy}).`);
        }
      }

      // ── Remaining payment ↔ loaded quantity ──
      // A Remaining payment is due only against goods that have actually been loaded: an Advance / Endorsement purchase owes nothing as
      // "remaining" until a quantity is loaded, then only that loaded share (less the advance already paid for it). When the payment is for
      // one loading (container), that loading must belong to this order and the payment may not exceed what that loading still owes.
      // The payment is then recorded against that loading so the Remaining Payment screen and the loading balances stay in step.
      let linkedLoadingId: string | null = null;
      if (orderRow.order_type !== "local_purchase" && body.kind === "remaining") {
        const requestedLoadingId = String((body.typeDetails as any)?.loadingRecordId || "").trim();
        if (requestedLoadingId && !uuidSchema.safeParse(requestedLoadingId).success) {
          throw new ApiClientError("Loading record id is not valid.", { status: 422, code: "INVALID_ID" });
        }
        const condition = resolvePaymentCondition(orderRow);
        const mustFollowLoading = condition === "advance" || condition === "endorsement";
        const rateToBase = orderCcy === localCcy ? 1 : orderRate || 1;
        const loadedState = await paymentDb(async (sql) => ({
          loadingRows: (await sql`
            select id::text as id, loaded_quantity, net_weight, report_payload
            from purchase_loading_records
            where purchase_order_id = ${params.id}::uuid and deleted_at is null
            order by created_at asc, id asc
          `) as any[],
          remainingRows: (await sql`
            select amount, currency_code, exchange_rate, base_currency_amount, loading_record_id::text as loading_record_id,
                   to_jsonb(p)->>'applied_purchase_amount' as applied_purchase_amount
            from purchase_order_payments p
            where purchase_order_id = ${params.id}::uuid and deleted_at is null and status = 'posted' and kind::text = 'remaining'
          `) as any[]
        }));
        if (!loadedState) throw new Error("Database connection is not configured for payment validation.");
        const { loadingRows, remainingRows } = loadedState;
        const toPur = (r: any) => paymentInPurchaseCurrency(r, orderCcy, rateToBase);
        const goodsLines = contractLines(parseJsonish(orderRow.form_data)?.goodsEntries);
        // only loadings that really carry a quantity count (the pending record opened after the advance holds the whole order form, not a truck)
        const loadings = loadingRows.filter((r: any) => Number(r.loaded_quantity || parseJsonish(r.report_payload)?.loadedQuantity || 0) > 0).map((r: any) => {
          const payload = parseJsonish(r.report_payload) || {};
          // the loading's own value: priced from the goods, quantity and weight it really carries at the contract price (not an equal share)
          const reported = Number(payload.totalPurchase || payload.purchaseAmount || 0) || (loadingGoodsValue(goodsLines, r) ?? 0);
          return { id: r.id as string, quantity: Number(r.loaded_quantity || payload.loadedQuantity || 0), reportedValueFC: Number.isFinite(reported) ? reported : 0 };
        });
        if (requestedLoadingId && !loadings.some((l: any) => l.id === requestedLoadingId)) {
          const pendingOnly = loadingRows.some((r: any) => r.id === requestedLoadingId);
          throw new ApiClientError(
            pendingOnly ? "No quantity has been loaded in this loading record yet, so nothing is payable for it." : "This loading record does not belong to the purchase order being paid.",
            { status: 409, code: "BUSINESS_RULE" }
          );
        }
        const payable = loadedPayable({
          orderTotalFC: orderTotalPur,
          advancePaidFC: advancePaidPur,
          totalQuantity: resolvePurchaseAmounts(orderRow).totalQuantity,
          loadings,
          remainingPaidAllFC: remainingRows.reduce((s: number, r: any) => s + toPur(r), 0),
          loadingId: requestedLoadingId || null,
          remainingPaidThisLoadingFC: remainingRows.filter((r: any) => r.loading_record_id === requestedLoadingId).reduce((s: number, r: any) => s + toPur(r), 0)
        });
        const capTol = 0.05; // quantity shares are fractions of the total; a few cents of rounding must not block an exact settlement
        if (mustFollowLoading && payable.loadedQuantity <= 0) {
          throw new ApiClientError("No quantity has been loaded for this purchase order yet. A Remaining payment is due only against loaded quantity.", { status: 409, code: "BUSINESS_RULE" });
        }
        const exceedsLoadingLimit = (limit: number) => exactBillSettlement
          ? comparePurchasePaymentToLimit(bodyAmountPur, limit) !== "allowed"
          : bodyAmountPur > limit + capTol;
        if (mustFollowLoading && exceedsLoadingLimit(payable.loadedOutstandingFC)) {
          throw new ApiClientError(`Payment amount cannot exceed the remaining payable for the loaded quantity (${payable.loadedOutstandingFC.toFixed(2)} ${orderCcy}).`, { status: 409, code: "BUSINESS_RULE" });
        }
        if (requestedLoadingId && payable.loadingOutstandingFC != null && exceedsLoadingLimit(payable.loadingOutstandingFC)) {
          throw new ApiClientError(`Payment amount cannot exceed what this loading still owes (${payable.loadingOutstandingFC.toFixed(2)} ${orderCcy}).`, { status: 409, code: "BUSINESS_RULE" });
        }
        linkedLoadingId = requestedLoadingId || null;
      }

      // Pass the raw payment facts straight through — post_purchase_order_payment
      // owns all the currency logic (transaction ccy vs base ccy vs order ccy) and
      // freezes the real historical rate on the payment row.
      const effectiveRoznamchaExchangeRate = bodyRate;

      if (orderRow.order_type === "local_purchase") {
        // The bill conversion rate is used above to apply the payment to the
        // bill. Tender already in the branch's base currency posts at rate 1.
        const journalRate = localCcy && bodyCcy === localCcy ? 1 : effectiveRoznamchaExchangeRate;
        // ONE transaction: journal entry + payment row + balance update succeed or fail together (they used to be three separate auto-commits,
        // so a failure midway could leave a posted journal with no payment record).
        const { paymentId } = (await withLocalPg(async (pg) => pg.begin(async (sql) => {
          let rozType = "super_admin";
          if (orderRow.city_branch_id) rozType = "branch";
          else if (orderRow.country_branch_id || orderRow.country_id) rozType = "country";

          const baseAmount = Number(body.amount) * journalRate;
          const lines = [
            {
              ledgerId: resolvedDebitLedgerId,
              paymentEntryType: "debit",
              description: `DR: Supplier Payable - ${orderRow.supplier_name || "Supplier"}`,
              debit: Number(body.amount),
              credit: 0,
              currency: bodyCcy,
              exchangeRate: journalRate
            },
            {
              ledgerId: resolvedCreditLedgerId,
              paymentEntryType: "credit",
              description: `CR: Payment Source - ${creditLedger.name || "Cash/Bank"}`,
              debit: 0,
              credit: Number(body.amount),
              currency: bodyCcy,
              exchangeRate: journalRate
            }
          ];

          const createdRozRows = await sql`
            select post_roznamcha_entry(
              ${rozType}::roznamcha_type,
              ${orderRow.country_id || null}::uuid,
              ${orderRow.country_branch_id || null}::uuid,
              ${orderRow.city_branch_id || null}::uuid,
              ${'JV-PAY-LP-' + Date.now().toString().slice(-6)},
              ${'LP-PAY-' + Date.now().toString().slice(-6)},
              ${body.entryDate}::date,
              ${null},
              ${postingReferenceNo},
              ${postingNarration || null},
              ${sql.json(lines)},
              true
            ) as id
          `;
          const roznamchaEntryId = createdRozRows[0]?.id;
          // local purchase is a Business posting: post_roznamcha_entry leaves the entry unclassified (Shipping logins would see it)
          if (roznamchaEntryId) {
            await sql`
              update roznamcha_entries
              set operational_domain = coalesce(
                (select cb.operational_domain from city_branches cb where cb.id = ${orderRow.city_branch_id || null}::uuid and cb.operational_domain in ('business', 'shipping')),
                'business')
              where id = ${roznamchaEntryId}::uuid and operational_domain is null
            `;
          }

          const idRows = await sql`
            insert into purchase_order_payments (
              local_purchase_id,
              kind,
              entry_date,
              amount,
              currency_code,
              exchange_rate,
              debit_ledger_id,
              credit_ledger_id,
              roznamcha_entry_id,
              status,
              reference_no,
              narration,
              source_module,
              source_transaction_type,
              source_reference_no,
              original_currency_code,
              currency_name,
              base_currency_amount,
              posted_to_journal,
              created_by
            ) values (
              ${params.id}::uuid,
              ${body.kind}::purchase_order_payment_kind,
              ${body.entryDate}::date,
              ${body.amount},
              ${body.currencyCode},
              ${journalRate},
              ${resolvedDebitLedgerId}::uuid,
              ${resolvedCreditLedgerId}::uuid,
              ${roznamchaEntryId}::uuid,
              'posted'::document_status,
              ${postingReferenceNo},
              ${postingNarration},
              'local_purchase',
              'local_purchase_payment',
              ${postingReferenceNo},
              ${body.currencyCode},
              ${body.currencyCode},
              ${baseAmount},
              true,
              ${session.userId}::uuid
            )
            returning id;
          `;
          const paymentId = idRows[0]?.id;


          // Reduce the balance by the payment expressed in the bill's own currency (bodyAmountPur, already computed for the overpayment check) —
          // for a same-currency payment this equals body.amount; for a local-currency payment on a foreign-currency bill the raw amount was wrong.
          const paidAmt = Math.round(bodyAmountPur * 10000) / 10000;
          const isAdvance = body.kind === "advance";
          await sql`
            update local_purchases
            set
              advance_amount = case when ${isAdvance} then coalesce(advance_amount, 0) + ${paidAmt} else advance_amount end,
              remaining_balance = greatest(0, (
                case when lower(coalesce(payment_mode, '')) like '%credit%' and coalesce(remaining_balance, 0) <= 0
                          and exists (select 1 from purchase_order_payments p0 where p0.local_purchase_id = local_purchases.id and p0.deleted_at is null and p0.id <> ${paymentId}::uuid)
                     then 0
                     when lower(coalesce(payment_mode, '')) like '%credit%' and coalesce(remaining_balance, 0) <= 0
                     then coalesce(final_cost, purchase_cost, 0)
                     when coalesce(remaining_balance, 0) > 0
                     then remaining_balance
                     else coalesce(final_cost, purchase_cost, 0) - coalesce(advance_amount, 0)
                end
              ) - ${paidAmt}),
              updated_at = now()
            where id = ${params.id}::uuid;
          `;

          return { paymentId };
        }))) as { paymentId: string };

        // 4-level serial: non-fatal and outside the posting transaction, so it can never abort or roll back the posting
        try {
          const s = await allocateFormSerials("payment_purchase", { countryId: orderRow.country_id, branchKey: orderRow.country_branch_id ?? orderRow.city_branch_id ?? null });
          await withLocalPg((sql2) => sql2`update purchase_order_payments set super_admin_serial = ${s.superAdminSerial}, country_serial = ${s.countrySerial}, branch_serial = ${s.branchSerial}, entry_serial = ${s.entrySerial} where id = ${paymentId}::uuid`);
        } catch { /* non-fatal */ }

        await writeAuditLog({
          action: "create",
          entityTable: "purchase_order_payments",
          entityId: paymentId,
          before: null,
          after: {
            localPurchaseId: params.id,
            kind: body.kind,
            amount: body.amount,
            currency: body.currencyCode,
            referenceNo: postingReferenceNo
          }
        });

        if (idempotencyKey) {
          await commitIdempotencySuccess(idempotencyKey, tenantHash, 201, {
            ok: true,
            data: { paymentId, status: "posted" },
          });
        }

        return { responseData: { paymentId, status: "posted" } };
      }

      // Posted journal, loading linkage, verification and workflow state must all
      // commit together; the RPC by itself is not a sufficient success boundary.
      if (!bookingTx) throw new Error("Purchase Booking transaction is missing.");
      const sql = bookingTx;
      const idRows = await sql`
        select post_purchase_booking_transfer(
          p_actor_id => ${session.userId}::uuid,
          p_purchase_order_id => ${params.id}::uuid,
          p_kind => ${body.kind}::purchase_order_payment_kind,
          p_entry_date => ${body.entryDate}::date,
          -- An exact quote already computed the branch amount. Pass the actual
          -- base currency explicitly so the posting routine never converts twice.
          p_amount => ${exactQuote?.baseAmount ?? body.amount},
          p_currency_code => ${exactQuote?.baseCurrency ?? body.currencyCode},
          p_exchange_rate => ${effectiveRoznamchaExchangeRate},
          p_debit_ledger_id => ${resolvedDebitLedgerId}::uuid,
          p_credit_ledger_id => ${resolvedCreditLedgerId}::uuid,
          p_reference_no => ${postingReferenceNo},
          p_narration => ${postingNarration || null}
        ) as id
      `;
      const paymentId = uuidSchema.parse(idRows[0]?.id);

      // Optional serial metadata must not poison the transaction if unavailable.
      await sql.savepoint(async (savepoint) => {
        const [serial] = await savepoint`
          select allocate_4level_serials('payment_purchase', ${orderRow.country_id || "GLOBAL"},
            ${orderRow.country_branch_id || orderRow.city_branch_id || "GLOBAL"}, 'PAYM') as res
        `;
        const s = serial?.res;
        if (!s) return;
        await savepoint`update purchase_order_payments set super_admin_serial = ${s.super_admin_serial}, country_serial = ${s.country_serial}, branch_serial = ${s.branch_serial}, entry_serial = ${s.entry_serial} where id = ${paymentId}::uuid`;
      }).catch((error) => console.error("Non-fatal purchase payment serial allocation:", error));

      if (body.typeDetails?.sourceRecordId) {
        await sql`update purchase_order_payments set source_reference_no = ${String(body.typeDetails.sourceRecordId)} where id = ${paymentId}::uuid`;
      }

      if (exactQuote) {
        const applied = await sql`
          update purchase_order_payments set applied_purchase_amount = ${exactQuote.applied}
          where id = ${paymentId}::uuid and purchase_order_id = ${params.id}::uuid and deleted_at is null
          returning id
        `;
        if (!applied[0]) throw new Error("The payment's exact purchase amount was not saved.");
      }

      // Record which loading (container) this Remaining payment settles, then let the database refresh the loading balances from it.
      if (linkedLoadingId) {
        const linked = await sql`
          update purchase_order_payments set loading_record_id = ${linkedLoadingId}::uuid
          where id = ${paymentId}::uuid and purchase_order_id = ${params.id}::uuid
          returning id
        `;
        if (!linked[0]) throw new Error("Purchase payment was not linked to the selected loading record.");
      }
      if (linkedLoadingId || exactQuote) {
        await sql`select recalc_purchase_order_payment_totals(${params.id}::uuid)`;
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
          bank_id = coalesce(${(body.typeDetails as any)?.bankId || null}::uuid, bank_id),
          -- a purchase payment is a Business posting: never leave it unclassified (Shipping logins would see it)
          operational_domain = coalesce(operational_domain, 'business')
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

      // Internal posting-integrity assertion tag (developer diagnostics only, embedded in an
      // exception message if these checks ever fail — not user-facing UI copy).
      const postingAssertionLabel = "Purchase payment";
      assertDistinctBookingLedgers(resolvedDebitLedgerId, resolvedCreditLedgerId, postingAssertionLabel);
      assertBalancedPostedLines({
        label: postingAssertionLabel,
        lines: journalLines,
        expectedDebitLedgerId: resolvedDebitLedgerId,
        expectedCreditLedgerId: resolvedCreditLedgerId,
        expectedAmount: Number(body.amount),
        // the posted lines are in the base currency; base = amount × frozen rate
        expectedExchangeRate: bodyRate,
        expectedBaseAmount: Number(paymentRecord.base_currency_amount ?? Number(body.amount) * bodyRate)
      });
      assertPostedRoznamchaTrace({
        label: postingAssertionLabel,
        entry: journalRecord
      });

      if (exactQuote) {
        const expectedUnits = purchaseBaseUnits(exactQuote.baseAmount);
        if (String(paymentRecord.currency_code || "").trim().toUpperCase() !== exactQuote.baseCurrency
          || purchaseBaseUnits(Number(paymentRecord.base_currency_amount)) !== expectedUnits
          || journalLines.some((line) => String(line.currency || "").trim().toUpperCase() !== exactQuote.baseCurrency
            || purchaseBaseUnits(Number(line.debit || 0) + Number(line.credit || 0)) !== expectedUnits)) {
          throw new ApiClientError("The purchase payment did not post in the confirmed branch currency.", {
            status: 409, code: "PURCHASE_PAYMENT_SETTLEMENT_MISMATCH"
          });
        }
      }

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

      {
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
            ...(exactQuote ? { appliedPurchaseAmount: exactQuote.applied, appliedPurchaseCurrency: orderCcy } : {}),
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
      }

      const audit: SavedPurchasePayment["audit"] = {
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
      };

      // Persist the final/partial state in the same transaction as the ledger.
      {
        const updatedRows = await sql`
          select id, purchase_order_no, country_id, country_branch_id, city_branch_id, order_total,
                 advance_paid, remaining_due, form_data
          from purchase_orders where id = ${params.id}::uuid and deleted_at is null
          limit 1
        `;
        const updated = updatedRows[0] as any;
        if (!updated) throw new Error("Posted purchase order disappeared before completion verification.");

        // form_data is often a JSON string inside the jsonb column: spreading it as-is would scatter its characters into the saved object
        const updatedForm = parseJsonish(updated.form_data) || {};
        const form = updatedForm.form ?? {};
        const endorsementPercent = Number(form.endorsementPercent ?? form.endorsement_percent ?? form.advancePercent ?? form.advance_percent ?? 0);
        // The required advance is taken from the bill in its PURCHASE currency (the currency of advance_paid / remaining_due). It used to be
        // taken from order_total, which is in the LOCAL currency, so a USD bill whose advance was fully paid kept showing "advance not
        // fulfilled" and the loading placeholder was never created.
        const clearance = advanceClearance({ totalPurchaseFC: formTotalPur, advancePercent: endorsementPercent, advancePaidFC: Number(updated.advance_paid || 0) });
        const requiredAdvance = clearance.requiredFC;
        const advancePaid = clearance.paidFC;
        const remainingDue = Number(updated.remaining_due || 0);

        const isAdvanceCompleted = requiredAdvance > 0 && clearance.cleared;
        const isFullyPaid = isPurchaseBalanceCleared(remainingDue);

        if (isFullyPaid) {
          const completedWorkflow = {
            ...(updatedForm.workflow || {}),
            lifecycleStatus: "Completed",
            paymentStatus: "completed",
            completedAt: new Date().toISOString(),
            completedBy: session.userId,
            completedByName: session.fullName || session.email || "User"
          };
          const nextFormData = { ...updatedForm, workflow: completedWorkflow };
          await sql`
            update purchase_orders set payment_status = 'completed', remaining_due = 0,
              form_data = ${sql.json(nextFormData)}, updated_at = now()
            where id = ${params.id}::uuid
          `;
        } else {
          // Partial payment - never mark bill as fully paid prematurely
          const partialWorkflow = {
            ...(updatedForm.workflow || {}),
            paymentStatus: "partial",
            endorsementRequirement: requiredAdvance,
            endorsementPaid: advancePaid,
            endorsementRemaining: clearance.remainingFC,
            endorsementCurrency: orderCcy,
            isEndorsementFulfilled: isAdvanceCompleted
          };
          const nextFormData = { ...updatedForm, workflow: partialWorkflow };
          await sql`
            update purchase_orders set payment_status = 'partial',
              form_data = ${sql.json(nextFormData)}, updated_at = now()
            where id = ${params.id}::uuid
          `;
        }

        // The historical placeholder is optional and has no posted quantity.
        // A failure is isolated by a savepoint; the actual selected loading link above is required.
        if (isAdvanceCompleted && !isFullyPaid) await sql.savepoint(async (optionalSql) => {
          const existingLoading = await optionalSql`
            select id from purchase_loading_records
            where purchase_order_id = ${params.id}::uuid and deleted_at is null
            limit 1
          `;

          if (existingLoading.length === 0) {
            // the container number the user entered — never an invented "CONT-<order no>" (the column is NOT NULL, so an empty value
            // means "not entered yet"; the Loading screen asks for it)
            const containerNumber = String(form.containerNo || form.containerNumber || "").trim();
            const containerType = form.containerType || null;
            const plrNo = `PLR-${Date.now().toString(36).toUpperCase()}`;

            await optionalSql`
              insert into purchase_loading_records ${optionalSql({
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
                report_payload: updatedForm,
                created_by: session.userId
              } as any)}
            `;
          }
        }).catch((error) => console.error("Non-fatal purchase loading placeholder:", error));
      }

      return { responseData: { paymentId }, audit };
    }

    const orderRow = order as any;
    const scope = {
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] ?? null,
      scopeModule: purchasePaymentScope,
      businessReference: params.id,
    };

    if (orderRow.order_type === "local_purchase") {
      const lock = await acquireIdempotencyLock({ req: request, ...scope, payload: body });
      if (lock.isReplayed) return buildReplayedResponse(lock.responseCode || 201, lock.responseBody);
      if (!lock.acquired) {
        throw new ApiClientError("Another request with this payment key is still being processed.", { status: 409, code: "IDEMPOTENCY_CONFLICT" });
      }
      idempotencyKey = lock.idempotencyKey;
      tenantHash = lock.tenantHash;
      return apiCreated((await postForOrder(orderRow)).responseData);
    }

    // The payment screen generates and retains this key after uncertain/failed
    // responses. A keyless Booking POST cannot be retried safely.
    const key = getIdempotencyKey(request);
    if (!key || key.length > 200) {
      throw new ApiClientError("A valid idempotency key is required for a Purchase Booking payment.", { status: 400, code: "IDEMPOTENCY_KEY_REQUIRED" });
    }
    const saved = await withLocalPg((pg) => pg.begin(async (tx) => {
      const [lockedOrder] = await selectLockedPurchaseBooking(tx, params.id);
      if (!lockedOrder) throw new ApiClientError("Purchase order not found.", { status: 404, code: "NOT_FOUND" });
      authorizeApiScope(session, {
        resource: "purchases", action: "post", countryId: lockedOrder.country_id ?? null,
        countryBranchId: lockedOrder.country_branch_id ?? null, cityBranchId: lockedOrder.city_branch_id ?? null,
      });
      const claim = await claimBookingPayment(tx, { ...scope, key, tenantHash: generateTenantHash(scope), requestHash: hashPayload(body), orderId: params.id });
      if ("paymentId" in claim) return { replay: true, responseData: { paymentId: claim.paymentId } } as const;
      const result = await postForOrder(lockedOrder, tx);
      await completeBookingPayment(tx, claim.claimId, result.responseData);
      return { replay: false, ...result } as const;
    }));
    if (!saved) throw new Error("Database connection is not configured for this payment.");
    if (saved.replay) return buildReplayedResponse(201, { ok: true, data: saved.responseData, isReplayed: true });
    // The posting RPC already includes its own transactional audit. This
    // supplemental audit cannot turn a committed payment back into a failure.
    if (saved.audit) await writeAuditLog(saved.audit).catch((error) => console.error("Non-fatal purchase payment audit:", error));
    return apiCreated(saved.responseData);
  } catch (error) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
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
    return await withKeyedLock("purchase-payment:" + id, () => postPaymentHandler(request, context));
  } catch (error) {
    return handleApiError(error);
  }
}
