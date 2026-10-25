import { NextResponse } from "next/server";
import { getCurrentErpSession } from "@/lib/auth/session";
import type { ErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";
import { withLocalPg } from "@/lib/db/local-postgres";
import { withKeyedLock } from "@/lib/db/keyed-lock";
import { ApiClientError } from "@/lib/api/response";
import { canAccessCityBranch } from "@/lib/permissions/middleware";
import { shippingAccountingDenied } from "@/lib/permissions/shipping-explicit-gate";
import { expensesDenied } from "@/lib/permissions/expenses-access";
import { expenseBillTitleAllowed } from "@/lib/permissions/bill-expense-domain";
import { z } from "zod";

import { SHIPPING_EXPENSE_BILL_TITLES as SHIPPING_TITLES_FOR_GATE } from "@/lib/permissions/bill-expense-domain";

// Narrations written into the books (data, not screen text).
const LEDGER_NARRATION_DEBIT = "Expense booking";
const LEDGER_NARRATION_CREDIT = "Expense payment";

const transferPayloadSchema = z.object({
  billId: z.string().uuid(),
  debitLedgerId: z.string().uuid(),
  creditLedgerId: z.string().uuid()
});

/**
 * POST /api/erp/expenses/transfer — books ONE stand-alone expense bill (expenses_bills) into Roznamcha/Journal/Ledger.
 *
 * Exactly-once rules:
 *  - the whole read → check → post → mark sequence runs under a per-bill database advisory lock, so two simultaneous
 *    transfers (double click, two users) can never both pass the "already transferred" check;
 *  - the bill is flagged with the posted entry id straight after posting (retried once); a unique index on
 *    expenses_bills.roznamcha_entry_id (migration 20261240) makes a second bill pointing at the same entry impossible.
 */
export async function POST(req: Request) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Same rule as creating an expense bill: financial access + expenses / cash-book permission.
    if (expensesDenied(session, "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = transferPayloadSchema.parse(await req.json());

    return await withKeyedLock(
      `expense-bill-transfer:${parsed.billId}`,
      () => transferBill(session, parsed),
      { busyMessage: "This expenses bill is being transferred right now. Please wait a moment and refresh before trying again." }
    );
  } catch (err: any) {
    if (err instanceof ApiClientError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status ?? 400 });
    }
    console.error("Expenses Transfer POST Error:", err);
    return NextResponse.json({ error: err.message || "Failed to transfer expenses bill" }, { status: 500 });
  }
}

async function transferBill(session: ErpSession, parsed: z.infer<typeof transferPayloadSchema>): Promise<Response> {
  let bill: any = null;
  const viaPg = await withLocalPg(async (sql) => {
    const rows = await sql`
      select
        b.*,
        cb.country_id,
        cb.country_branch_id,
        cb.id as city_branch_id,
        c.currency_code,
        upper(coalesce(b.base_currency, nullif(cb.local_currency, ''), c.currency_code)) as resolved_base_currency,
        coalesce(
          (select jsonb_agg(l order by l.row_serial asc) from public.expenses_bill_lines l where l.bill_id = b.id),
          '[]'::jsonb
        ) as expenses_bill_lines
      from public.expenses_bills b
      left join public.city_branches cb on cb.id = b.branch_id
      left join public.countries c on c.id = cb.country_id
      where b.id = ${parsed.billId} and b.deleted_at is null
      limit 1
    `;
    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        ...r,
        city_branches: {
          country_id: r.country_id,
          country_branch_id: r.country_branch_id,
          id: r.city_branch_id,
          countries: { currency_code: r.currency_code }
        }
      };
    }
    return null;
  });

  const admin = createSupabaseAdminClient() as any;
  if (viaPg !== undefined) {
    bill = viaPg;
  } else {
    const { data: billData, error: billError } = await admin
      .from("expenses_bills")
      .select("*, expenses_bill_lines(*)")
      .eq("id", parsed.billId)
      .single();
    if (billError) throw new Error("Failed to fetch bill: " + billError.message);
    bill = billData;
  }

  if (!bill) throw new ApiClientError("Bill not found", { status: 404, code: "NOT_FOUND" });
  if (bill.transferred_to_roznamcha) throw new ApiClientError("Bill is already transferred", { status: 409, code: "ALREADY_TRANSFERRED" });
  if (!canAccessCityBranch(session, bill.city_branches?.id)) {
    throw new ApiClientError("This bill belongs to a branch outside your assigned scope.", { status: 403, code: "FORBIDDEN" });
  }
  // Business and Shipping Line expenses stay separated, in both directions.
  if (!expenseBillTitleAllowed(session, bill.bill_title)) {
    throw new ApiClientError("This bill belongs to a different operational section than your login (Business vs Shipping Line).", { status: 403, code: "DOMAIN_FORBIDDEN" });
  }
  {
    const denied = shippingAccountingDenied(session);
    if (denied && SHIPPING_TITLES_FOR_GATE.has(String(bill.bill_title || ""))) return denied;
  }

  const { validateLedgerCountryScope } = await import("@/lib/api/country-scope-validator");
  await validateLedgerCountryScope(session, parsed.debitLedgerId, null, admin);
  await validateLedgerCountryScope(session, parsed.creditLedgerId, null, admin);
  if (parsed.debitLedgerId === parsed.creditLedgerId) {
    throw new ApiClientError("The debit and credit accounts must be different.", { status: 400, code: "SAME_ACCOUNT" });
  }

  const totalAmount = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.grand_amount), 0) || 0;
  if (totalAmount <= 0) throw new ApiClientError("Bill amount must be greater than zero", { status: 400, code: "ZERO_AMOUNT" });

  // `grand_amount` in expenses_bill_lines is already converted to the branch's base currency
  // so we must post it to Roznamcha using the base currency and an exchange rate of 1.
  // The currency the bill was calculated in (saved with the bill). There is deliberately no "USD" fallback: a bill without a
  // known base currency is refused instead of being posted in the wrong currency.
  const baseCurrency = String(bill.resolved_base_currency || "").toUpperCase();
  if (!baseCurrency) throw new ApiClientError("The base currency of this bill is not known. Open and save the bill again so it is recalculated.", { status: 422, code: "NO_BASE_CURRENCY" });

  const roznamchaPayload = {
    type: "branch",
    countryId: bill.city_branches?.country_id,
    countryBranchId: bill.city_branches?.country_branch_id,
    cityBranchId: bill.city_branches?.id,
    entryDate: bill.bill_date,
    journalNo: `EXP-${bill.serial_no}`,
    voucherNo: `VCH-${bill.serial_no}`,
    narration: `Expenses Bill Transfer: ${bill.bill_title} - ${bill.serial_no}`,
    referenceNo: bill.reference_no,
    sourceModule: "expenses_bills",
    sourceTransactionType: String(bill.bill_title || "expense_bill"),
    sourceTransactionId: bill.id,
    sourceReferenceNo: bill.serial_no,
    lines: [
      {
        ledgerId: parsed.debitLedgerId,
        debit: totalAmount,
        credit: 0,
        currency: baseCurrency,
        exchangeRate: 1,
        description: LEDGER_NARRATION_DEBIT,
        paymentEntryType: "transfer"
      },
      {
        ledgerId: parsed.creditLedgerId,
        debit: 0,
        credit: totalAmount,
        currency: baseCurrency,
        exchangeRate: 1,
        description: LEDGER_NARRATION_CREDIT,
        paymentEntryType: "transfer"
      }
    ]
  };

  const { entryId } = await postRoznamchaWithErpSession({
    sessionUserId: session.userId,
    body: roznamchaPayload as any,
    requireBalanced: true
  });

  // Mark as transferred immediately; one retry so a transient failure cannot leave a posted entry on an untransferred bill.
  let updateError: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await admin
      .from("expenses_bills")
      .update({
        transferred_to_roznamcha: true,
        roznamcha_entry_id: entryId,
        updated_at: new Date().toISOString()
      })
      .eq("id", parsed.billId)
      .eq("transferred_to_roznamcha", false);
    updateError = res.error;
    if (!updateError) break;
  }
  if (updateError) {
    throw new Error(`The ledger entry ${entryId} was posted but the bill could not be marked as transferred (${updateError.message}). Do NOT transfer it again — contact an administrator.`);
  }

  return NextResponse.json({ success: true, entryId });
}
