import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { assertBalancedPostedLines, assertDistinctBookingLedgers, assertPostedRoznamchaTrace } from "@/lib/services/posting-verification";
import { resolveSalesBookingPaymentRoute } from "@/lib/services/sales-booking-routing";
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
  try {
    const session = await requireErpSession();
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
    const orderColumns = "id, country_id, country_branch_id, city_branch_id, order_total, total_goods_original, total_goods_local, total_goods_usd, currency_code, exchange_rate, sales_order_no, sales_contract_no, form_data, ledger_posting_status, payment_status, is_edited_since_transfer";
    const viaPgOrder = await withLocalPg(async (sql) => {
      const rows = await sql`select ${sql.unsafe(orderColumns)} from sales_orders where id = ${params.id} and deleted_at is null limit 1`;
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

    if (alreadyTransferred && !orderRow.is_edited_since_transfer) {
      return handleApiError(new Error("This booking has already been transferred to Sales Transfer Payment and cannot be transferred again."));
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
        currencyCode: orderRow.currency_code || form.currencyType || "USD",
        exchangeRate: orderRow.exchange_rate || form.exchangeRate || 1,
        amount: totalSalesAmount,
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
    const debitAccountId = orderRow.customer_account_id || form.customerAccountId || null;
    const creditAccountId = form.salesAccountLedgerId || null;
    const acctIdsToResolve = [debitAccountId, creditAccountId].filter(Boolean);
    const resolvedLedgerByAccountId: Record<string, string> = {};
    if (acctIdsToResolve.length > 0) {
      const ledgerRows = await withLocalPg((sql) =>
        sql`select id, enterprise_account_id from ledgers where enterprise_account_id = any(${acctIdsToResolve}::uuid[])`
      );
      for (const row of (ledgerRows ?? []) as any[]) {
        if (row.enterprise_account_id) resolvedLedgerByAccountId[row.enterprise_account_id] = row.id;
      }
    }

    const debitLedgerId =
      (debitAccountId && resolvedLedgerByAccountId[debitAccountId]) ||
      form.customerAccountLedgerId ||
      orderRow.customer_ledger_id;
    const creditLedgerId =
      (creditAccountId && resolvedLedgerByAccountId[creditAccountId]) ||
      form.salesAccountLedgerId;

    if (!debitLedgerId) {
      throw new Error("Customer Account Ledger ID is required before transfer to payment.");
    }
    if (!creditLedgerId) {
      throw new Error("Sales Account Ledger ID is required before transfer to payment.");
    }

    const goodsAuditRemark = buildSalesGoodsAuditRemark(orderRow, referenceNo);
    const postingNarration = [
      goodsAuditRemark,
      body?.remarks?.trim() ? "Notes: " + body.remarks.trim() : null,
      "Transfer Currency: " + (orderRow.currency_code || form.currencyType || "USD"),
      "Exchange Rate: " + (orderRow.exchange_rate || form.exchangeRate || 1),
      "Amount: " + totalSalesAmount
    ].filter(Boolean).join(" | ");

    const { data: paymentId, error: rpcError } = await supabase.rpc("post_sales_booking_transfer", {
      p_actor_id: session.userId,
      p_sales_order_id: params.id,
      p_payment_kind: paymentRoute.paymentKind,
      p_entry_date: new Date().toISOString().slice(0, 10),
      p_amount: totalSalesAmount,
      p_currency_code: orderRow.currency_code || form.currencyType || "USD",
      p_exchange_rate: orderRow.exchange_rate || form.exchangeRate || 1,
      p_debit_ledger_id: debitLedgerId,
      p_credit_ledger_id: creditLedgerId,
      p_reference_no: referenceNo,
      p_narration: postingNarration || null
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    // sales_order_payments reads can hit the same RLS gap as sales_orders under the temp-session
    // bootstrap login; try direct-Postgres first.
    const viaPgPayment = await withLocalPg(async (sql) => {
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

    const adminSupabase = createSupabaseAdminClient() as any;
    await adminSupabase.from("roznamcha_entries").update({
      country_id: orderRow.country_id || null,
      country_branch_id: orderRow.country_branch_id || null,
      city_branch_id: orderRow.city_branch_id || null,
      type: rozType,
      entry_category: "business"
    }).eq("id", paymentRecord.roznamcha_entry_id);

    const viaPgLines = await withLocalPg(async (sql) => {
      return await sql`select ledger_id, debit, credit from roznamcha_lines where roznamcha_entry_id = ${paymentRecord.roznamcha_entry_id}`;
    });
    const postedLines = (viaPgLines && viaPgLines.length > 0 ? viaPgLines : await requireSupabaseData(
      supabase
        .from("roznamcha_lines")
        .select("ledger_id, debit, credit")
        .eq("roznamcha_entry_id", paymentRecord.roznamcha_entry_id)
    )) as any[];

    const exRate = Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1;
    // Internal posting-integrity assertion tag (developer diagnostics only, embedded in an
    // exception message if these checks ever fail — not user-facing UI copy).
    const postingAssertionLabel = "Sales booking";
    assertDistinctBookingLedgers(debitLedgerId, creditLedgerId, postingAssertionLabel);
    assertBalancedPostedLines({
      label: postingAssertionLabel,
      lines: postedLines,
      expectedDebitLedgerId: debitLedgerId,
      expectedCreditLedgerId: creditLedgerId,
      expectedAmount: totalSalesAmount,
      expectedExchangeRate: exRate
    });

    const journalColumns = "id, status, posted_at, country_id, country_branch_id, city_branch_id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number";
    const viaPgJournal = await withLocalPg(async (sql) => {
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

    const isCreditSales = paymentRoute.paymentKind === "credit" || String(form.paymentType || form.paymentCondition || "").toLowerCase().includes("credit");
    const existingPaid = isCreditSales ? 0 : Number(orderRow.paid_amount || 0);
    const newRemainingSales = isCreditSales ? totalSalesAmount : Math.max(0, totalSalesAmount - existingPaid);
    const salesPaymentStatus = isCreditSales ? "pending" : (newRemainingSales <= 0.01 && existingPaid > 0 ? "completed" : (existingPaid > 0 ? "partial" : "pending"));

    const patch = {
      ledger_posting_status: "posted",
      payment_status: salesPaymentStatus,
      paid_amount: existingPaid,
      remaining_amount: newRemainingSales,
      updated_at: now,
      form_data: {
        ...updatedFormData,
        form: {
          ...updatedFormData.form,
          ...(isCreditSales ? { advancePercent: 0, advanceAmount: 0 } : {})
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
    const viaPgUpdate = await withLocalPg(async (sql) => {
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
      remainingAmount: newRemainingSales
    };

    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, resPayload);
    }

    return apiOk(resPayload);
  } catch (error) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    console.error("SALES_TRANSFER_TO_PAYMENT_ERROR:", error);
    return handleApiError(error);
  }
}
