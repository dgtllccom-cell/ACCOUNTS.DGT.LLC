import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { purchaseOrderPaymentPostSchema, uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
async function assertLedgerMatchesPurchaseScope(supabase: any, ledgerId: string, orderRow: any, label: string) {
  const { data: ledger, error } = await supabase
    .from("ledgers")
    .select("id, code, name, country_id, country_branch_id, city_branch_id")
    .eq("id", ledgerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !ledger) {
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

    const supabase = await createApiSupabaseClient();
    const order = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .select("id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, currency_code, exchange_rate, order_total, advance_paid, remaining_paid, credit_amount, remaining_due, form_data, ledger_posting_status, payment_status")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null
    });

    const rows = await requireSupabaseData(
      supabase
        .from("purchase_order_payments")
        .select(`
          id, purchase_order_id, kind, entry_date, amount, currency_code, exchange_rate, 
          debit_ledger_id, credit_ledger_id, roznamcha_entry_id, status, reference_no, 
          narration, source_module, source_transaction_type, source_reference_no, original_currency_code, currency_name, base_currency_amount, created_at,
          roznamcha_entries (
            id,
            super_admin_serial_number,
            country_transaction_serial_number,
            branch_transaction_serial_number,
            profiles!roznamcha_entries_created_by_fkey ( full_name )
          )
        `)
        .eq("purchase_order_id", params.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200)
    );

    return apiOk({ payments: rows ?? [], limit: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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


    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured. Purchase posting requires a real Supabase login.");
    }

    const supabase = await createApiSupabaseClient();
    const order = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .select("id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, currency_code, exchange_rate, order_total, advance_paid, remaining_paid, credit_amount, remaining_due, form_data, ledger_posting_status, payment_status")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "purchases",
      action: "post",
      countryId: (order as any)?.country_id ?? null,
      countryBranchId: (order as any)?.country_branch_id ?? null,
      cityBranchId: (order as any)?.city_branch_id ?? null
    });

    const orderRow = order as any;
    const form = orderRow.form_data?.form || {};
    let exchangeRate = Number(orderRow.exchange_rate || 0);
    if (exchangeRate <= 1) {
      exchangeRate = Number(form.exchangeRate || 1);
    }
    if (exchangeRate <= 0) exchangeRate = 1;

    const orderTotalUSD = Number(orderRow.order_total || 0) / exchangeRate;
    const advancePaidUSD = Number(orderRow.advance_paid || 0);
    const remainingPaidUSD = Number(orderRow.remaining_paid || 0);
    const creditAmountUSD = Number(orderRow.credit_amount || 0);
    
    let remainingDueUSD = 0;
    if (orderRow.remaining_due != null) {
      remainingDueUSD = Number(orderRow.remaining_due);
    } else {
      remainingDueUSD = Math.max(0, orderTotalUSD - advancePaidUSD - remainingPaidUSD - creditAmountUSD);
    }


    const goodsEntries = Array.isArray(orderRow.form_data?.goodsEntries) ? orderRow.form_data.goodsEntries : [];
    const formTotalUSD = goodsEntries.length
      ? goodsEntries.reduce((sum: number, item: any) => sum + Number(item.totalAmount || 0), 0)
      : Number(form.totalAmount || orderTotalUSD);
      
    const advancePercent = Number(form.advancePercent || 0);
    const requiredAdvanceUSD = advancePercent > 0 ? (formTotalUSD * advancePercent) / 100 : 0;
    const remainingAdvanceUSD = Math.max(0, requiredAdvanceUSD - advancePaidUSD);
    const tolerance = 0.01;

    if (body.debitLedgerId === body.creditLedgerId) {
      throw new Error("Debit and credit ledgers must be different for purchase payment posting.");
    }

    const debitLedger = await assertLedgerMatchesPurchaseScope(supabase, body.debitLedgerId, orderRow, "Debit");
    const creditLedger = await assertLedgerMatchesPurchaseScope(supabase, body.creditLedgerId, orderRow, "Credit");
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

    const isForeignCurrency = body.currencyCode?.toUpperCase() === (orderRow.currency_code?.toUpperCase() || "USD");
    const bodyAmountUSD = isForeignCurrency ? Number(body.amount) : Number(body.amount) / Number(body.exchangeRate || 1);

    if (body.kind === "advance" && advancePercent > 0) {
      const maxAllowedAdvanceUSD = Math.max(remainingAdvanceUSD, remainingDueUSD);
      if (remainingDueUSD <= tolerance) {
        throw new Error("This purchase order is already fully paid. Duplicate posting is not allowed.");
      }
      if (bodyAmountUSD > maxAllowedAdvanceUSD + tolerance) {
        throw new Error(`Payment amount cannot exceed remaining purchase order balance (${remainingDueUSD.toFixed(2)} USD).`);
      }
    }

    if ((body.kind === "remaining" || body.kind === "credit") && remainingDueUSD <= tolerance) {
      throw new Error("This purchase order has no remaining payable balance. Duplicate posting is not allowed.");
    }

    if ((body.kind === "remaining" || body.kind === "credit") && bodyAmountUSD > remainingDueUSD + tolerance) {
      throw new Error(`Payment amount cannot exceed remaining payable balance (${remainingDueUSD.toFixed(2)} USD).`);
    }

    const effectiveRoznamchaExchangeRate = isForeignCurrency ? Number(body.exchangeRate || 1) : 1;

    // Transaction-safe posting via RPC using the security definer wrapper post_purchase_booking_transfer.
    // This wrapper sets config('request.jwt.claims', ...) so audit log triggers find auth.uid().
    const { data, error } = await supabase.rpc("post_purchase_booking_transfer", {
      p_actor_id: session.userId,
      p_purchase_order_id: params.id,
      p_kind: body.kind,
      p_entry_date: body.entryDate,
      p_amount: body.amount,
      p_currency_code: body.currencyCode,
      p_exchange_rate: effectiveRoznamchaExchangeRate,
      p_debit_ledger_id: body.debitLedgerId,
      p_credit_ledger_id: body.creditLedgerId,
      p_reference_no: postingReferenceNo,
      p_narration: postingNarration || null
    });

    if (error) {
      throw new Error(error.message);
    }

    const paymentId = data as string;

    if (body.typeDetails?.sourceRecordId) {
      await supabase
        .from("purchase_order_payments")
        .update({ source_reference_no: String(body.typeDetails.sourceRecordId) })
        .eq("id", paymentId);
    }

    const paymentRecord = await requireSupabaseData(
      supabase
        .from("purchase_order_payments")
        .select("id, purchase_order_id, kind, amount, currency_code, exchange_rate, debit_ledger_id, credit_ledger_id, roznamcha_entry_id, status, source_module, source_transaction_type, source_reference_no, original_currency_code, currency_name, base_currency_amount")
        .eq("id", paymentId)
        .eq("purchase_order_id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    ) as any;

    if (!paymentRecord?.roznamcha_entry_id) {
      throw new Error("Purchase payment was created but the linked Journal/Roznamcha entry is missing.");
    }

    // Fix: Ensure the roznamcha entry has the correct branch and country scopes assigned
    // so it shows up in branch-specific Roznamcha reports.
    let rozType = "super_admin";
    if (orderRow.city_branch_id) rozType = "branch";
    else if (orderRow.country_branch_id || orderRow.country_id) rozType = "country";

    const adminSupabase = createSupabaseAdminClient();
    const { error: updateError } = await adminSupabase.from("roznamcha_entries").update({
      country_id: orderRow.country_id || null,
      country_branch_id: orderRow.country_branch_id || null,
      city_branch_id: orderRow.city_branch_id || null,
      type: rozType
    }).eq("id", paymentRecord.roznamcha_entry_id);

    if (updateError) {
      console.error("Failed to update roznamcha entry scopes:", updateError.message);
    }

    const journalRecord = await requireSupabaseData(
      supabase
        .from("roznamcha_entries")
        .select("id, source_module, source_transaction_type, source_transaction_id, source_reference_no, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, original_currency_code, currency_name, base_currency_amount")
        .eq("id", paymentRecord.roznamcha_entry_id)
        .maybeSingle()
    ) as any;

    const journalLines = await requireSupabaseData(
      supabase
        .from("roznamcha_lines")
        .select("id, ledger_id, debit, credit, currency, usd_rate, usd_amount")
        .eq("roznamcha_entry_id", paymentRecord.roznamcha_entry_id)
    ) as any[];

    const debitLine = (journalLines || []).find((line) => line.ledger_id === body.debitLedgerId && Number(line.debit || 0) > 0);
    const creditLine = (journalLines || []).find((line) => line.ledger_id === body.creditLedgerId && Number(line.credit || 0) > 0);

    if (!debitLine || !creditLine) {
      throw new Error("Purchase payment posted, but Debit/Credit ledger lines were not created correctly.");
    }

    if (!journalRecord?.super_admin_serial_number || !journalRecord?.country_transaction_serial_number || !journalRecord?.branch_transaction_serial_number) {
      throw new Error("Purchase payment posted, but Journal serial traceability is incomplete.");
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

    await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .update({
          form_data: {
            ...(orderRow.form_data || {}),
            workflow: postedWorkflow,
            lastPaymentTrace: {
              paymentId,
              roznamchaEntryId: paymentRecord.roznamcha_entry_id,
              debitLedgerId: body.debitLedgerId,
              creditLedgerId: body.creditLedgerId,
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
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", params.id)
        .select("id")
        .single()
    );

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
        debitLedgerId: body.debitLedgerId,
        creditLedgerId: body.creditLedgerId,
        systemBillNumber: trace.systemBillNumber,
        manualBillNumber: trace.manualBillNumber,
        partyName: trace.partyName,
        referenceNo: postingReferenceNo
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    // Check if the advance payment is completed and auto-move to Loading Module
    try {
      const { data: updatedOrder, error: orderError } = await supabase
        .from("purchase_orders")
        .select("id, purchase_order_no, country_id, country_branch_id, city_branch_id, order_total, advance_paid, remaining_due, form_data")
        .eq("id", params.id)
        .is("deleted_at", null)
        .single();

      if (orderError) throw orderError;

      if (updatedOrder) {
        const updated = updatedOrder as any;
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

          await supabase
            .from("purchase_orders")
            .update({
              payment_status: "completed",
              remaining_due: 0,
              form_data: {
                ...(updated.form_data || {}),
                workflow: completedWorkflow
              },
              updated_at: new Date().toISOString()
            })
            .eq("id", params.id);
        }

        if (isAdvanceCompleted && !isFullyPaid) {
          const { data: existingLoading } = await supabase
            .from("purchase_loading_records")
            .select("id")
            .eq("purchase_order_id", params.id)
            .is("deleted_at", null)
            .limit(1);

          if (!existingLoading || existingLoading.length === 0) {
            const containerNumber = String(form.containerNo || form.containerNumber || `CONT-${updated.purchase_order_no}`).trim();
            const containerType = form.containerType || null;
            const plrNo = `PLR-${Date.now().toString(36).toUpperCase()}`;

            await supabase
              .from("purchase_loading_records")
              .insert({
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
              });
          }
        }
      }
    } catch (err: any) {
      console.error("Error in post payment completion check:", err);
    }

    return apiCreated({ paymentId });
  } catch (error) {
    return handleApiError(error);
  }
}
