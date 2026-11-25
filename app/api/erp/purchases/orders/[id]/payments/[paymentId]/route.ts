import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { purchaseOrderPaymentPostSchema, uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { withLocalPg } from "@/lib/db/local-postgres";
import { postedPaymentVoucherSides, type PostedVoucherLine } from "@/lib/reports/payment-voucher-data";

const paramsSchema = z.object({
  id: uuidSchema,
  paymentId: uuidSchema
});

type ReceiptRecord = {
  source: "purchase_booking" | "local_purchase";
  bill: string | null;
  journal_serial_no: string | null;
  manual_bill_no: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  party: string | null;
  goods_lines: unknown;
  header_goods_name: string | null;
  voucher_no: string | null;
  journal_serial: string | null;
  date: string | null;
  reference: string | null;
  lines: PostedVoucherLine[] | null;
};

function savedGoodsNames(lines: unknown, header: string | null): string[] | undefined {
  if (typeof lines === "string") {
    try { lines = JSON.parse(lines); } catch { lines = null; }
  }
  const text = (value: unknown) => typeof value === "string" && !/^[\s—-]*$/.test(value) ? value.trim() : "";
  const names = Array.isArray(lines) ? lines.flatMap((line) => {
    if (!line || typeof line !== "object") return [];
    const name = [line.goodsName, line.goods_name, line.productName, line.name, line.item].map(text).find(Boolean);
    return name ? [name] : [];
  }) : [];
  // Header name is only for older, single-item bills without usable saved lines.
  return names.length ? names : text(header) ? [text(header)] : undefined;
}

/** Print only the payment identified by BOTH IDs, with its original posted journal lines. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const session = await requireErpSession();
    const { id, paymentId } = paramsSchema.parse(await context.params);
    if (!(session.isSuperAdmin || session.canViewFinancials)) {
      return apiError("FORBIDDEN", "Financial permission is required to print the payment voucher.", 403);
    }
    const rows = await withLocalPg(async (sql) => sql<ReceiptRecord[]>`
      select
        case when lp.id is not null then 'local_purchase' else 'purchase_booking' end as source,
        po.purchase_order_no as bill, lp.journal_serial_no, lp.manual_bill_no,
        coalesce(po.country_id, lp.country_id) as country_id,
        coalesce(po.country_branch_id, lp.country_branch_id) as country_branch_id,
        coalesce(po.city_branch_id, lp.city_branch_id) as city_branch_id,
        coalesce(lp.supplier_name, nullif(po.form_data->'form'->>'supplierName', ''),
                 nullif(po.form_data->'form'->>'salesAccountName', '')) as party,
        case when lp.id is not null then to_jsonb(lp)->'line_items' else po.form_data->'goodsEntries' end as goods_lines,
        case when lp.id is not null then lp.goods_name else po.form_data->'form'->>'goodsName' end as header_goods_name,
        j.voucher_no, j.super_admin_serial_number as journal_serial, j.entry_date::text as date,
        coalesce(nullif(j.source_reference_no, ''), nullif(j.reference_no, ''), p.reference_no) as reference,
        (select jsonb_agg(jsonb_build_object(
          'ledger_id', l.ledger_id, 'ledger_name', a.name, 'ledger_code', a.code,
          'account_number', coalesce(nullif(btrim(l.account_number), ''), nullif(btrim(ea.account_number), '')),
          'debit', l.debit, 'credit', l.credit, 'currency', l.currency
        )) from public.roznamcha_lines l
        left join public.ledgers a on a.id = l.ledger_id
        left join public.enterprise_accounts ea on ea.id = coalesce(l.enterprise_account_id, a.enterprise_account_id)
        where l.roznamcha_entry_id = j.id) as lines
      from public.purchase_order_payments p
      join public.roznamcha_entries j on j.id = p.roznamcha_entry_id and j.status = 'posted'
        and j.posted_at is not null and j.deleted_at is null
      left join public.purchase_orders po on po.id = p.purchase_order_id and po.deleted_at is null
        and p.local_purchase_id is null
      left join public.local_purchases lp on lp.id = p.local_purchase_id and lp.deleted_at is null
        and p.purchase_order_id is null
      where p.id = ${paymentId}::uuid and (po.id = ${id}::uuid or lp.id = ${id}::uuid)
        and p.status = 'posted' and p.kind <> 'booking' and p.deleted_at is null
      limit 1
    `);
    const row = rows?.[0];
    if (!row) return apiError("VOUCHER_NOT_FOUND", "No posted payment voucher was found for this purchase.", 404);
    authorizeApiScope(session, { resource: "purchases", action: "read", countryId: row.country_id, countryBranchId: row.country_branch_id, cityBranchId: row.city_branch_id });
    const sides = postedPaymentVoucherSides(row.lines);
    const number = row.voucher_no?.trim() || row.journal_serial?.trim();
    const bill = row.source === "local_purchase" ? row.journal_serial_no?.trim() || row.manual_bill_no?.trim() : row.bill?.trim();
    if (!sides || !number || !bill || !row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      return apiError("VOUCHER_NOT_PRINTABLE", "The posted voucher is missing a verified debit or credit side.", 409);
    }
    return apiOk({
      ...sides, number, bill, date: row.date, party: row.party || "",
      source: row.source, reference: row.reference || undefined, goodsNames: savedGoodsNames(row.goods_lines, row.header_goods_name),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}

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
    // the Roznamcha domain of the entry being replaced (business / shipping) - the reversal and the re-posted entry must carry it too,
    // otherwise they are stamped with no domain and drop out of (or leak into) the domain-filtered Roznamcha views
    const { data: originalEntry } = await adminSupabase.from("roznamcha_entries").select("operational_domain").eq("id", existingPayment.roznamcha_entry_id).maybeSingle();
    const entryDomain: string = originalEntry?.operational_domain || "business";
    const { data: reversalEntryId, error: reverseError } = await adminSupabase.rpc("reverse_roznamcha_entry", {
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

    // 5. Post the new edited payment using the existing RPC. Pass the raw payment
    //    facts — post_purchase_order_payment owns all the currency conversion and
    //    freezes the real historical rate (see 20261001 migration).
    const { data: newPaymentId, error: postError } = await supabase.rpc("post_purchase_booking_transfer", {
      p_actor_id: session.userId,
      p_purchase_order_id: params.id,
      p_kind: body.kind,
      p_entry_date: body.entryDate,
      p_amount: Number(body.amount),
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

    // carry over what the posting function does not know: the domain of the Roznamcha entries and the loading a Remaining payment belongs to
    const { data: newPayment } = await adminSupabase.from("purchase_order_payments").select("roznamcha_entry_id").eq("id", newPaymentId).maybeSingle();
    const entryIds = [reversalEntryId, newPayment?.roznamcha_entry_id].filter(Boolean);
    if (entryIds.length) {
      await adminSupabase.from("roznamcha_entries").update({ operational_domain: entryDomain }).in("id", entryIds).is("operational_domain", null);
    }
    if (existingPayment.loading_record_id) {
      await adminSupabase.from("purchase_order_payments").update({ loading_record_id: existingPayment.loading_record_id }).eq("id", newPaymentId);
      await adminSupabase.rpc("recalc_purchase_order_payment_totals", { p_purchase_order_id: params.id });
    }

    await writeAuditLog({
      action: "update",
      entityTable: "purchase_order_payments",
      entityId: params.paymentId,
      after: { message: "Edited purchase order payment via reversal and reposting", newPaymentId }
    });

    return apiOk({ id: newPaymentId, message: "Payment updated successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
