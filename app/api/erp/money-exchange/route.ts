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
  receivedOfficeNumbers: z.string().nullable().optional(),
  purchaseAccountId: z.string().uuid().nullable().optional(),
  salesAccountId: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "posted"]).optional()
});

import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { NextRequest } from "next/server";
import { withLocalPg } from "@/lib/db/local-postgres";

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

    const now = new Date().toISOString();
    let insertedId: string | null = null;

    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        insert into public.money_exchange_entries (
          serial_no, branch_id, entry_date, transaction_type, account_no,
          qty_currency, ex_currency, operation, rate, quantity, final_amount,
          receipt_name, receipt_person_id, receipt_bank_id, received_from, mobile,
          details, profit_base_currency, received_type,
          purchase_country, purchase_city, purchased_from, purchased_from_person_id,
          received_country, received_city, received_office_name, received_office_numbers,
          purchase_account_id, sales_account_id, status,
          created_at, created_by
        ) values (
          ${parsed.serialNo}, ${parsed.branchId}, ${parsed.entryDate}, ${parsed.transactionType},
          ${parsed.accountNo || null}, ${parsed.qtyCurrency}, ${parsed.exCurrency},
          ${parsed.operation}, ${parsed.rate}, ${parsed.quantity}, ${parsed.finalAmount},
          ${parsed.receiptName || null}, ${parsed.receiptPersonId || null},
          ${parsed.receiptBankId || null}, ${parsed.receivedFrom || null},
          ${parsed.mobile || null}, ${parsed.details || null}, ${parsed.profitBaseCurrency},
          ${parsed.receivedType || null}, ${parsed.purchaseCountry || null},
          ${parsed.purchaseCity || null}, ${parsed.purchasedFrom || null},
          ${parsed.purchasedFromPersonId || null}, ${parsed.receivedCountry || null},
          ${parsed.receivedCity || null}, ${parsed.receivedOfficeName || null},
          ${parsed.receivedOfficeNumbers || null},
          ${parsed.purchaseAccountId || null}, ${parsed.salesAccountId || null}, ${parsed.status || "posted"},
          ${now}, ${session.userId || null}
        )
        returning id
      `;
      return rows[0]?.id ?? null;
    });

    if (viaPg) {
      insertedId = viaPg;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("money_exchange_entries")
        .insert({
          serial_no: parsed.serialNo, branch_id: parsed.branchId, entry_date: parsed.entryDate,
          transaction_type: parsed.transactionType, account_no: parsed.accountNo || null,
          qty_currency: parsed.qtyCurrency, ex_currency: parsed.exCurrency,
          operation: parsed.operation, rate: parsed.rate, quantity: parsed.quantity,
          final_amount: parsed.finalAmount, receipt_name: parsed.receiptName || null,
          receipt_person_id: parsed.receiptPersonId || null, receipt_bank_id: parsed.receiptBankId || null,
          received_from: parsed.receivedFrom || null, mobile: parsed.mobile || null,
          details: parsed.details || null, profit_base_currency: parsed.profitBaseCurrency,
          received_type: parsed.receivedType || null, purchase_country: parsed.purchaseCountry || null,
          purchase_city: parsed.purchaseCity || null, purchased_from: parsed.purchasedFrom || null,
          purchased_from_person_id: parsed.purchasedFromPersonId || null,
          received_country: parsed.receivedCountry || null, received_city: parsed.receivedCity || null,
          received_office_name: parsed.receivedOfficeName || null,
          received_office_numbers: parsed.receivedOfficeNumbers || null,
          purchase_account_id: parsed.purchaseAccountId || null,
          sales_account_id: parsed.salesAccountId || null,
          status: parsed.status || "posted",
          created_at: now, created_by: session.userId || null
        })
        .select("id").single();
      if (error) throw new Error(error.message);
      insertedId = data?.id ?? null;
    }

    if (!insertedId) throw new Error("Failed to insert money exchange entry");

    const resPayload = { success: true, id: insertedId };
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

export async function GET(req: Request) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 100);
    const branchId = searchParams.get("branchId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const transactionType = searchParams.get("transactionType");

    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        select
          m.*,
          case when cp.id is not null then jsonb_build_object('full_name', cp.full_name) else null end as profiles,
          pa.code as purchase_account_code, pa.name as purchase_account_name,
          sa.code as sales_account_code, sa.name as sales_account_name
        from public.money_exchange_entries m
        left join public.profiles cp on cp.id = m.created_by
        left join public.enterprise_accounts pa on pa.id = m.purchase_account_id
        left join public.enterprise_accounts sa on sa.id = m.sales_account_id
        where m.deleted_at is null
          and (${branchId ? sql`m.branch_id = ${branchId}` : sql`true`})
          and (${dateFrom ? sql`m.entry_date >= ${dateFrom}` : sql`true`})
          and (${dateTo ? sql`m.entry_date <= ${dateTo}` : sql`true`})
          and (${transactionType && transactionType !== "all" ? sql`m.transaction_type = ${transactionType}` : sql`true`})
        order by m.created_at desc
        limit ${limit}
      `;
      return rows;
    });

    if (viaPg !== undefined) {
      const stock = await withLocalPg(async (sql) => {
        if (!branchId) return [];
        return sql`
          select
            qty_currency as currency,
            sum(case when transaction_type = 'Purchase' and (${dateFrom ? sql`entry_date >= ${dateFrom}` : sql`false`}) then quantity else 0 end) as purchased_in_range,
            sum(case when transaction_type = 'Sale' and (${dateFrom ? sql`entry_date >= ${dateFrom}` : sql`false`}) then quantity else 0 end) as sold_in_range,
            sum(case when transaction_type = 'Purchase' and not (${dateFrom ? sql`entry_date >= ${dateFrom}` : sql`false`}) then quantity else 0 end) as opening_purchased,
            sum(case when transaction_type = 'Sale' and not (${dateFrom ? sql`entry_date >= ${dateFrom}` : sql`false`}) then quantity else 0 end) as opening_sold,
            sum(case when transaction_type = 'Purchase' then quantity * rate else 0 end) / nullif(sum(case when transaction_type = 'Purchase' then quantity else 0 end), 0) as avg_purchase_rate
          from public.money_exchange_entries
          where deleted_at is null and status = 'posted' and branch_id = ${branchId}
            and (${dateTo ? sql`entry_date <= ${dateTo}` : sql`true`})
          group by qty_currency
          order by qty_currency
        `;
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      const kpis = await withLocalPg(async (sql) => {
        if (!branchId) return { todaysPurchases: 0, todaysPurchasesCount: 0, todaysSales: 0, todaysSalesCount: 0 };
        const rows = await sql`
          select
            sum(case when transaction_type = 'Purchase' and entry_date = ${todayStr} then final_amount else 0 end) as todays_purchases,
            count(*) filter (where transaction_type = 'Purchase' and entry_date = ${todayStr}) as todays_purchases_count,
            sum(case when transaction_type = 'Sale' and entry_date = ${todayStr} then final_amount else 0 end) as todays_sales,
            count(*) filter (where transaction_type = 'Sale' and entry_date = ${todayStr}) as todays_sales_count
          from public.money_exchange_entries
          where deleted_at is null and status = 'posted' and branch_id = ${branchId}
        `;
        const r: any = rows[0] || {};
        return {
          todaysPurchases: Number(r.todays_purchases) || 0,
          todaysPurchasesCount: Number(r.todays_purchases_count) || 0,
          todaysSales: Number(r.todays_sales) || 0,
          todaysSalesCount: Number(r.todays_sales_count) || 0
        };
      });

      const stockRows = (stock as any[]).map((r) => {
        const opening = (Number(r.opening_purchased) || 0) - (Number(r.opening_sold) || 0);
        const purchased = Number(r.purchased_in_range) || 0;
        const sold = Number(r.sold_in_range) || 0;
        const available = opening + purchased - sold;
        return {
          currency: r.currency,
          opening,
          purchased,
          sold,
          available,
          avgRate: Number(r.avg_purchase_rate) || 0
        };
      });

      return NextResponse.json({ entries: viaPg, stock: stockRows, kpis });
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

    return NextResponse.json({ entries: data, stock: [], kpis: { todaysPurchases: 0, todaysPurchasesCount: 0, todaysSales: 0, todaysSalesCount: 0 } });
  } catch (err: any) {
    console.error("Money Exchange GET Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch exchange entries" }, { status: 500 });
  }
}
