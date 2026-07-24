import { NextResponse } from "next/server";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const moneyExchangePayloadSchema = z.object({
  serialNo: z.string().min(1),
  branchId: z.string().min(1),
  entryDate: z.string().date(),
  transactionType: z.enum(["Purchase", "Sale"]),
  accountNo: z.string().nullable().optional(),
  qtyCurrency: z.string().min(2),
  exCurrency: z.string().min(2),
  operation: z.enum(["multiply", "divide"]),
  rate: z.number().positive(),
  quantity: z.number().positive(),
  finalAmount: z.number().positive(),
  receiptName: z.string().nullable().optional(),
  receivedFrom: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
  profitBaseCurrency: z.number(),
  receivedType: z.string().nullable().optional(),
  purchaseCountry: z.string().nullable().optional(),
  purchaseCity: z.string().nullable().optional(),
  purchasedFrom: z.string().nullable().optional(),
  receivedCountry: z.string().nullable().optional(),
  receivedCity: z.string().nullable().optional(),
  receivedOfficeName: z.string().nullable().optional(),
  receivedOfficeNumbers: z.string().nullable().optional()
});

export async function POST(req: Request) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = moneyExchangePayloadSchema.parse(body);

    const supabase = createSupabaseAdminClient() as any;

    const { data, error } = await supabase
      .from("money_exchange_entries")
      .insert({
        serial_no: parsed.serialNo,
        branch_id: parsed.branchId,
        entry_date: parsed.entryDate,
        transaction_type: parsed.transactionType,
        account_no: parsed.accountNo || null,
        qty_currency: parsed.qtyCurrency,
        ex_currency: parsed.exCurrency,
        operation: parsed.operation,
        rate: parsed.rate,
        quantity: parsed.quantity,
        final_amount: parsed.finalAmount,
        receipt_name: parsed.receiptName || null,
        received_from: parsed.receivedFrom || null,
        mobile: parsed.mobile || null,
        details: parsed.details || null,
        profit_base_currency: parsed.profitBaseCurrency,
        received_type: parsed.receivedType || null,
        purchase_country: parsed.purchaseCountry || null,
        purchase_city: parsed.purchaseCity || null,
        purchased_from: parsed.purchasedFrom || null,
        received_country: parsed.receivedCountry || null,
        received_city: parsed.receivedCity || null,
        received_office_name: parsed.receivedOfficeName || null,
        received_office_numbers: parsed.receivedOfficeNumbers || null,
        created_at: new Date().toISOString(),
        created_by: session.userId || null
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: any) {
    console.error("Money Exchange POST Error:", err);
    return NextResponse.json({ error: err.message || "Failed to save exchange entry" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createSupabaseAdminClient() as any;
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 100);
    const branchId = searchParams.get("branchId");

    let query = supabase
      .from("money_exchange_entries")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({ entries: data });
  } catch (err: any) {
    console.error("Money Exchange GET Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch exchange entries" }, { status: 500 });
  }
}
