import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { purchaseOrderPaymentPostSchema, uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const paramsSchema = z.object({
  id: uuidSchema,
  paymentId: uuidSchema
});

// Since there is no `edit_purchase_booking_transfer` RPC yet, we simulate an edit by:
// 1. Reversing the old roznamcha entry.
// 2. Soft-deleting the old purchase_order_payments record.
// 3. Posting a new purchase_order_payment and roznamcha entry using `post_purchase_booking_transfer`.
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string, paymentId: string }> }) {
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
    
    // 1. Get the existing payment to verify and find the roznamcha_entry_id
    const existingPayment = await requireSupabaseData(
      supabase
        .from("purchase_order_payments")
        .select("*")
        .eq("id", params.paymentId)
        .eq("purchase_order_id", params.id)
        .is("deleted_at", null)
        .single()
    ) as any;

    // 2. Get the purchase order for scope checking
    const order = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .select("id, country_id, country_branch_id, city_branch_id, order_total, advance_paid, remaining_paid, credit_amount, remaining_due, form_data, ledger_posting_status, payment_status")
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

    if (body.debitLedgerId === body.creditLedgerId) {
      throw new Error("Debit and credit ledgers must be different for purchase payment posting.");
    }

    // 3. Reverse the old Roznamcha Entry using the admin RPC
    // Function signature: reverse_roznamcha_entry(p_original_entry_id uuid, p_reason text, p_approval_request_id uuid default null)
    const adminSupabase = createSupabaseAdminClient() as any;
    const { error: reverseError } = await adminSupabase.rpc("reverse_roznamcha_entry", {
      p_original_entry_id: existingPayment.roznamcha_entry_id,
      p_reason: "Edited Payment Journal Entry",
      p_approval_request_id: null
    });
    if (reverseError) {
      throw new Error(`Failed to reverse existing journal entry: ${reverseError.message}`);
    }

    // 4. Soft-delete the old payment record
    const { error: deleteError } = await supabase
      .from("purchase_order_payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.paymentId);
    
    if (deleteError) {
      throw new Error(`Failed to remove old payment record: ${deleteError.message}`);
    }

    const isForeignCurrency = body.currencyCode?.toUpperCase() === ((order as any)?.currency_code?.toUpperCase() || "USD");
    const amountUSD = isForeignCurrency ? Number(body.amount) : Number(body.amount) / Number(body.exchangeRate || 1);

    // 5. Post the new edited payment using the existing RPC
    const { data: newPaymentId, error: postError } = await supabase.rpc("post_purchase_booking_transfer", {
      p_actor_id: session.userId,
      p_purchase_order_id: params.id,
      p_kind: body.kind,
      p_entry_date: body.entryDate,
      p_amount: amountUSD,
      p_currency_code: body.currencyCode,
      p_exchange_rate: Number(body.exchangeRate || 1),
      p_debit_ledger_id: body.debitLedgerId,
      p_credit_ledger_id: body.creditLedgerId,
      p_reference_no: body.referenceNo ?? null,
      p_narration: body.narration ?? null
    });

    if (postError) {
      throw new Error(`Failed to post edited payment: ${postError.message}`);
    }

    await writeAuditLog({
      supabase,
      userId: session.userId,
      action: "UPDATE",
      entity: "purchase_order_payments",
      entityId: params.paymentId,
      details: { message: "Edited purchase order payment via reversal and reposting", newPaymentId }
    });

    return apiOk({ id: newPaymentId, message: "Payment updated successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
