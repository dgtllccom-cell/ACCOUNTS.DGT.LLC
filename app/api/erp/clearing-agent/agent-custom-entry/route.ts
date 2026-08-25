import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

// withLocalPg, not the RLS-gated Supabase admin client — createSupabaseAdminClient() has no
// real service-role key configured on DEV (falls back to the anon key), so inserts into a
// table with RLS enabled and no policy get rejected. Same root cause already fixed for
// warehouses/roznamcha/purchase-payments elsewhere in this codebase.

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select id, country_id, country_branch_id, city_branch_id, entry_no, customs_declaration_no,
               declaration_type, agent_name, agent_id, customs_station, consignee_name, consignee_person_id,
               consignor_name, consignor_person_id, hscode, goods_description, assessed_value, duty_paid,
               currency_code, clearance_status, remarks, status, is_active, created_at, updated_at
        from public.clearing_agent_custom_entries
        where deleted_at is null
          and (${status && status !== "all" ? sql`clearance_status = ${status}` : sql`true`})
          and (${session.isSuperAdmin ? sql`true` : sql`(country_id = any(${session.countryIds}) or country_id is null)`})
        order by created_at desc
      `;
    });

    return NextResponse.json({ success: true, data: rows || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to load custom entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();

    const countryId = body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);
    const countryBranchId = body.country_branch_id ?? session.countryBranchIds?.[0] ?? null;
    const cityBranchId = body.city_branch_id ?? session.cityBranchIds?.[0] ?? null;

    const data = await withLocalPg(async (sql) => {
      const countRows = await sql`select count(*)::int as c from public.clearing_agent_custom_entries`;
      const year = new Date().getFullYear();
      const serial = String((countRows[0]?.c || 0) + 1).padStart(4, "0");
      const autoEntryNo = body.entry_no || `CUST-DEC-${year}-${serial}`;

      const rows = await sql`
        insert into public.clearing_agent_custom_entries (
          country_id, country_branch_id, city_branch_id, entry_no, customs_declaration_no,
          declaration_type, agent_name, agent_id, customs_station, consignee_name, consignee_person_id,
          consignor_name, consignor_person_id, hscode, goods_description, assessed_value, duty_paid,
          currency_code, clearance_status, remarks, status, is_active, created_by
        ) values (
          ${countryId}, ${countryBranchId}, ${cityBranchId}, ${autoEntryNo}, ${body.customs_declaration_no || null},
          ${body.declaration_type || "import"}, ${body.agent_name ? String(body.agent_name).trim() : "Default Clearing Agent"},
          ${body.agent_id || null}, ${body.customs_station ? String(body.customs_station).trim() : "Karachi Customs House"},
          ${body.consignee_name ? String(body.consignee_name).trim() : null}, ${body.consignee_person_id || null},
          ${body.consignor_name ? String(body.consignor_name).trim() : null}, ${body.consignor_person_id || null},
          ${body.hscode ? String(body.hscode).trim() : null}, ${body.goods_description ? String(body.goods_description).trim() : null},
          ${Number(body.assessed_value || 0)}, ${Number(body.duty_paid || 0)},
          ${body.currency_code || "USD"}, ${body.clearance_status || "submitted"}, ${body.remarks ? String(body.remarks).trim() : null},
          'active', true, ${session.userId}
        )
        returning id, country_id, country_branch_id, city_branch_id, entry_no, customs_declaration_no,
                  declaration_type, agent_name, agent_id, customs_station, consignee_name, consignee_person_id,
                  consignor_name, consignor_person_id, hscode, goods_description, assessed_value, duty_paid,
                  currency_code, clearance_status, remarks, status, is_active, created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) {
      return NextResponse.json({ success: false, error: "Insert failed." }, { status: 500 });
    }

    await syncRecordTranslations({
      table: "clearing_agent_custom_entries",
      recordId: (data as any).id,
      record: data,
    }).catch(() => null);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
