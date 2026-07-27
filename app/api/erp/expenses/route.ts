import { NextResponse } from "next/server";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const expensesBillLineSchema = z.object({
  rowSerial: z.number(),
  details: z.string().min(1),
  qty: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  amount: z.number(),
  currency: z.string().min(2).max(10),
  operation: z.string(),
  exchangeRate: z.number().nonnegative(),
  finalAmount: z.number(),
  taxOn: z.boolean(),
  taxPct: z.number().nonnegative(),
  taxAmt: z.number().nonnegative(),
  grandAmount: z.number()
});

const expensesBillPayloadSchema = z.object({
  header: z.object({
    id: z.string().uuid().optional(),
    billSerial: z.string().min(1),
    branch: z.string().min(1),
    billDate: z.string().date(),
    billMode: z.string(),
    billTitle: z.string(),
    referenceNo: z.string().nullable().optional(),
    debitLedgerId: z.string().uuid().nullable().optional(),
    creditLedgerId: z.string().uuid().nullable().optional()
  }),
  entries: z.array(expensesBillLineSchema).min(1)
});

import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = expensesBillPayloadSchema.parse(body);
    const { header, entries } = parsed;

    const lockRes = await acquireIdempotencyLock({
      req,
      scopeModule: "EXPENSES",
      userId: session.userId,
      countryId: session.countryId,
      cityBranchId: session.cityBranchId || header.branch,
      businessReference: header.billNo || header.referenceNo,
      payload: body
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 200, lockRes.responseBody);
    }

    if (!lockRes.acquired) {
      return NextResponse.json(
        { error: "A request with this idempotency key is currently being processed or duplicate submission detected. Please wait." },
        { status: 409 }
      );
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    const supabase = createSupabaseAdminClient() as any;

    // ── Rule 1: Country Scope Validation for Expense Ledgers ──
    const { validateLedgerCountryScope } = await import("@/lib/api/country-scope-validator");
    if (header.debitLedgerId) {
      await validateLedgerCountryScope(session, header.debitLedgerId, null, supabase);
    }
    if (header.creditLedgerId) {
      await validateLedgerCountryScope(session, header.creditLedgerId, null, supabase);
    }

    let billId = header.id;

    if (billId) {
      // Check if bill exists and is not transferred
      const { data: existing, error: fetchErr } = await supabase.from("expenses_bills").select("transferred_to_roznamcha").eq("id", billId).single();
      if (fetchErr) throw new Error("Failed to fetch bill: " + fetchErr.message);
      if (existing?.transferred_to_roznamcha) throw new Error("Cannot edit a bill that has already been transferred to Roznamcha.");

      const { error: updateErr } = await supabase
        .from("expenses_bills")
        .update({
          branch_id: header.branch,
          bill_date: header.billDate,
          bill_mode: header.billMode,
          bill_title: header.billTitle,
          reference_no: header.referenceNo || null,
          debit_ledger_id: header.debitLedgerId || null,
          credit_ledger_id: header.creditLedgerId || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", billId);
      
      if (updateErr) throw new Error("Failed to update bill header: " + updateErr.message);

      // Delete old lines
      await supabase.from("expenses_bill_lines").delete().eq("bill_id", billId);
    } else {
      // Insert new
      const { data: billData, error: billError } = await supabase
        .from("expenses_bills")
        .insert({
          serial_no: header.billSerial,
          branch_id: header.branch,
          bill_date: header.billDate,
          bill_mode: header.billMode,
          bill_title: header.billTitle,
          reference_no: header.referenceNo || null,
          debit_ledger_id: header.debitLedgerId || null,
          credit_ledger_id: header.creditLedgerId || null,
          created_at: new Date().toISOString(),
          created_by: session.userId || null
        })
        .select("id")
        .single();

      if (billError) throw new Error("Failed to insert bill header: " + billError.message);
      billId = billData.id;
    }

    const linesToInsert = entries.map((e) => ({
      bill_id: billId,
      row_serial: e.rowSerial,
      details: e.details,
      qty: e.qty,
      unit_price: e.unitPrice,
      amount: e.amount,
      currency: e.currency,
      operation: e.operation,
      exchange_rate: e.exchangeRate,
      final_amount: e.finalAmount,
      tax_on: e.taxOn,
      tax_pct: e.taxPct,
      tax_amt: e.taxAmt,
      grand_amount: e.grandAmount,
      created_at: new Date().toISOString()
    }));

    const { error: linesError } = await supabase.from("expenses_bill_lines").insert(linesToInsert);
    if (linesError) throw new Error("Failed to insert bill lines: " + linesError.message);

    const resPayload = { success: true, billId };
    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, resPayload);
    }
    return NextResponse.json(resPayload);
  } catch (err: any) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    console.error("Expenses POST Error:", err);
    return NextResponse.json({ error: err.message || "Failed to save expenses bill" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createSupabaseAdminClient() as any;
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 50);

    const { data, error } = await supabase
      .from("expenses_bills")
      .select(`
        *,
        expenses_bill_lines(*),
        profiles!expenses_bills_created_by_fkey(full_name),
        city_branches!expenses_bills_branch_id_fkey(
          name,
          country_id,
          countries(name, currency_code)
        )
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return NextResponse.json({ bills: data });
  } catch (err: any) {
    console.error("Expenses GET Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch expenses bills" }, { status: 500 });
  }
}
