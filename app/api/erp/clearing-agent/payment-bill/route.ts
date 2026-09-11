import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";

// withLocalPg, not the RLS-gated Supabase admin client — see agent-custom-entry/route.ts for
// the root cause (no real service-role key on DEV, so RLS rejects the admin-client insert).

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select b.id, b.country_id, b.country_branch_id, b.city_branch_id, b.bill_no, b.order_no, b.order_id, b.customer_id,
               c.customer_name, b.bl_number, b.gd_number,
               b.agent_name, b.agent_id, b.port_name, b.customs_duty, b.port_charges, b.demurrage_charges, b.clearance_fee,
               b.freight_charges, b.other_charges, b.total_amount, b.currency_code, b.payment_status, b.payment_method,
               b.remarks, b.status, b.is_active, b.created_at, b.updated_at
        from public.clearing_payment_bills b
        left join public.customers c on c.id = b.customer_id
        where b.deleted_at is null
          and (${status && status !== "all" ? sql`b.payment_status = ${status}` : sql`true`})
          and (${session.isSuperAdmin ? sql`true` : sql`(b.country_id = any(${session.countryIds}) or (b.country_id is null and b.customer_id is null))`})
        order by b.created_at desc
      `;
    });

    return NextResponse.json({ success: true, data: rows || [] });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load payment bills" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();

    const customsDuty = Number(body.customs_duty || 0);
    const portCharges = Number(body.port_charges || 0);
    const demurrageCharges = Number(body.demurrage_charges || 0);
    const clearanceFee = Number(body.clearance_fee || 0);
    const freightCharges = Number(body.freight_charges || 0);
    const otherCharges = Number(body.other_charges || 0);
    const totalAmount = customsDuty + portCharges + demurrageCharges + clearanceFee + freightCharges + otherCharges;

    // Never leave scope null "because Super Admin doesn't have one" when a
    // real customer is on the bill — a null country_id reads as an unscoped
    // legacy row and every country admin's GET filter lets it through.
    let countryId = body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);
    const countryBranchId = body.country_branch_id ?? session.countryBranchIds?.[0] ?? null;
    const cityBranchId = body.city_branch_id ?? session.cityBranchIds?.[0] ?? null;
    if (!countryId && body.customer_id) {
      const customerRow = await withLocalPg((sql) => sql`SELECT country_id FROM public.customers WHERE id = ${body.customer_id} LIMIT 1`);
      countryId = customerRow?.[0]?.country_id ?? null;
    }

    const data = await withLocalPg(async (sql) => {
      const countRows = await sql`select count(*)::int as c from public.clearing_payment_bills`;
      const year = new Date().getFullYear();
      const serial = String((countRows[0]?.c || 0) + 1).padStart(4, "0");
      const autoBillNo = body.bill_no || `CL-BILL-${year}-${serial}`;

      const rows = await sql`
        insert into public.clearing_payment_bills (
          country_id, country_branch_id, city_branch_id, bill_no, order_no, order_id, customer_id, bl_number, gd_number,
          agent_name, agent_id, port_name, customs_duty, port_charges, demurrage_charges, clearance_fee,
          freight_charges, other_charges, total_amount, currency_code, payment_status, payment_method,
          remarks, status, is_active, created_by
        ) values (
          ${countryId}, ${countryBranchId}, ${cityBranchId}, ${autoBillNo}, ${body.order_no || null}, ${body.order_id || null}, ${body.customer_id || null}, ${body.bl_number || null}, ${body.gd_number || null},
          ${body.agent_name ? String(body.agent_name).trim() : "Default Clearing Agent"}, ${body.agent_id || null},
          ${body.port_name ? String(body.port_name).trim() : "Karachi Port"},
          ${customsDuty}, ${portCharges}, ${demurrageCharges}, ${clearanceFee}, ${freightCharges}, ${otherCharges}, ${totalAmount},
          ${body.currency_code || "USD"}, ${body.payment_status || "pending"}, ${body.payment_method || "bank_transfer"},
          ${body.remarks ? String(body.remarks).trim() : null}, 'active', true, ${session.userId}
        )
        returning id, country_id, country_branch_id, city_branch_id, bill_no, order_no, order_id, customer_id, bl_number, gd_number,
                  agent_name, agent_id, port_name, customs_duty, port_charges, demurrage_charges, clearance_fee,
                  freight_charges, other_charges, total_amount, currency_code, payment_status, payment_method,
                  remarks, status, is_active, created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) {
      return NextResponse.json({ success: false, error: "Insert failed." }, { status: 500 });
    }

    await syncRecordTranslations({
      table: "clearing_payment_bills",
      recordId: (data as any).id,
      record: data,
    }).catch(() => null);

    void writeRecordChangeHistory({
      recordTable: "clearing_payment_bills",
      recordId: (data as any).id,
      action: "create",
      actorId: session.userId,
      countryId: (data as any).country_id ?? null,
      cityBranchId: (data as any).city_branch_id ?? null,
      afterData: data
    }).catch(() => {});

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
