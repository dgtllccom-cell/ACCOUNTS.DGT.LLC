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
  receiptPersonId: z.string().uuid().nullable().optional(),
  receiptBankId: z.string().uuid().nullable().optional(),
  receivedFrom: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
  profitBaseCurrency: z.number(),
  receivedType: z.string().nullable().optional(),
  purchaseCountry: z.string().nullable().optional(),
  purchaseCity: z.string().nullable().optional(),
  purchasedFrom: z.string().nullable().optional(),
  purchasedFromPersonId: z.string().uuid().nullable().optional(),
  receivedCountry: z.string().nullable().optional(),
  receivedCity: z.string().nullable().optional(),
  receivedOfficeName: z.string().nullable().optional(),
  receivedOfficeNumbers: z.string().nullable().optional()
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
    const parsed = moneyExchangePayloadSchema.parse(body);

    const lockRes = await acquireIdempotencyLock({
      req,
      scopeModule: "MONEY_EXCHANGE",
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] || parsed.branchId,
      businessReference: parsed.serialNo,
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
        receipt_person_id: parsed.receiptPersonId || null,
        receipt_bank_id: parsed.receiptBankId || null,
        received_from: parsed.receivedFrom || null,
        mobile: parsed.mobile || null,
        details: parsed.details || null,
        profit_base_currency: parsed.profitBaseCurrency,
        received_type: parsed.receivedType || null,
        purchase_country: parsed.purchaseCountry || null,
        purchase_city: parsed.purchaseCity || null,
        purchased_from: parsed.purchasedFrom || null,
        purchased_from_person_id: parsed.purchasedFromPersonId || null,
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

    const resPayload = { success: true, id: data.id };
    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, resPayload);
    }
    return NextResponse.json(resPayload);
  } catch (err: any) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    console.error("Money Exchange POST Error:", err);
    return NextResponse.json({ error: err.message || "Failed to save exchange entry" }, { status: 500 });
  }
}

import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(req: Request) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 100);
    const branchId = searchParams.get("branchId");

    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        select
          m.*,
          case when cp.id is not null then jsonb_build_object('full_name', cp.full_name) else null end as profiles
        from public.money_exchange_entries m
        left join public.profiles cp on cp.id = m.created_by
        where m.deleted_at is null
          and (${branchId ? sql`m.branch_id = ${branchId}` : sql`true`})
        order by m.created_at desc
        limit ${limit}
      `;
      return rows;
    });

    if (viaPg !== undefined) {
      return NextResponse.json({ entries: viaPg });
    }

    const supabase = createSupabaseAdminClient() as any;

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
