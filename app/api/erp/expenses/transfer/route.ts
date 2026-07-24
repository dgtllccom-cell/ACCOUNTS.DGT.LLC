import { NextResponse } from "next/server";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/route";
import { z } from "zod";

const transferPayloadSchema = z.object({
  billId: z.string().uuid(),
  debitLedgerId: z.string().uuid(),
  creditLedgerId: z.string().uuid()
});

export async function POST(req: Request) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = transferPayloadSchema.parse(body);

    const supabase = createSupabaseAdminClient() as any;

    const { data: bill, error: billError } = await supabase
      .from("expenses_bills")
      .select("*, city_branches(country_id, country_branch_id, id, countries(currency_code)), expenses_bill_lines(*)")
      .eq("id", parsed.billId)
      .single();

    if (billError) throw new Error("Failed to fetch bill: " + billError.message);
    if (!bill) throw new Error("Bill not found");
    if (bill.transferred_to_roznamcha) throw new Error("Bill is already transferred");

    const totalAmount = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.grand_amount), 0) || 0;
    if (totalAmount <= 0) throw new Error("Bill amount must be greater than zero");

    // `grand_amount` in expenses_bill_lines is already converted to the base currency
    // so we must post it to Roznamcha using the base currency and an exchange rate of 1.
    const baseCurrency = bill.city_branches?.countries?.currency_code || "USD";

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
      lines: [
        {
          ledgerId: parsed.debitLedgerId,
          debit: totalAmount,
          credit: 0,
          currency: baseCurrency,
          exchangeRate: 1,
          description: "Expense booking",
          paymentEntryType: "transfer"
        },
        {
          ledgerId: parsed.creditLedgerId,
          debit: 0,
          credit: totalAmount,
          currency: baseCurrency,
          exchangeRate: 1,
          description: "Expense payment",
          paymentEntryType: "transfer"
        }
      ]
    };

    // Post to Roznamcha
    const { entryId } = await postRoznamchaWithErpSession({
      sessionUserId: session.userId,
      body: roznamchaPayload as any
    });

    // Mark as transferred
    const { error: updateError } = await supabase
      .from("expenses_bills")
      .update({
        transferred_to_roznamcha: true,
        roznamcha_entry_id: entryId,
        updated_at: new Date().toISOString()
      })
      .eq("id", parsed.billId);

    if (updateError) throw new Error("Failed to update bill status: " + updateError.message);

    return NextResponse.json({ success: true, entryId });
  } catch (err: any) {
    console.error("Expenses Transfer POST Error:", err);
    return NextResponse.json({ error: err.message || "Failed to transfer expenses bill" }, { status: 500 });
  }
}
