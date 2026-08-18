import { NextResponse } from "next/server";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/route";
import { withLocalPg } from "@/lib/db/local-postgres";
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

    let bill: any = null;
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        select
          b.*,
          cb.country_id,
          cb.country_branch_id,
          cb.id as city_branch_id,
          c.currency_code,
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

    if (viaPg !== undefined) {
      bill = viaPg;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data: billData, error: billError } = await supabase
        .from("expenses_bills")
        .select("*, expenses_bill_lines(*)")
        .eq("id", parsed.billId)
        .single();
      if (billError) throw new Error("Failed to fetch bill: " + billError.message);
      bill = billData;
    }

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
    const adminSupabase = createSupabaseAdminClient() as any;
    const { error: updateError } = await adminSupabase
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
