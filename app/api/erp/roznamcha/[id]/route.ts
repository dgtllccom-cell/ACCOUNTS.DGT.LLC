import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uuidSchema } from "@/lib/api/erp-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { revalidatePath } from "next/cache";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";

type RoznamchaHeader = {
  id: string;
  type: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  journal_no: string;
  voucher_no: string;
  entry_date: string;
  payment_method_id: string | null;
  reference_no: string | null;
  narration: string | null;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

type RoznamchaLine = {
  id: string;
  payment_entry_type: string;
  account_id: string | null;
  enterprise_account_id: string | null;
  account_number: string | null;
  manual_reference_number: string | null;
  customer_number: string | null;
  country_serial_number: string | null;
  branch_serial_number: string | null;
  ledger_id: string | null;
  description: string | null;
  debit: number;
  credit: number;
  currency: string;
  usd_rate: number;
  usd_amount: number;
  accounts?: { id: string; code: string; name: string } | null;
  ledgers?: { id: string; code: string; name: string } | null;
};

import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    // Try direct PostgreSQL first for maximum performance and schema resilience
    const viaPg = await withLocalPg(async (sql) => {
      const headerRows = await sql`
        select
          e.id, e.type, e.entry_category, e.country_id, e.country_branch_id, e.city_branch_id,
          e.journal_no, e.voucher_no, e.entry_date, e.payment_method_id, e.reference_no,
          e.narration, e.status, e.created_by, e.approved_by, e.approved_at, e.posted_at,
          e.created_at, e.updated_at, e.source_module, e.source_transaction_type,
          e.source_transaction_id, e.source_reference_no,
          case when c.id is not null then jsonb_build_object('name', c.name, 'currency_code', c.currency_code) else null end as countries,
          case when cb.id is not null then jsonb_build_object('name', cb.name, 'code', cb.code) else null end as country_branches,
          case when cib.id is not null then jsonb_build_object('name', cib.name, 'code', cib.code) else null end as city_branches,
          case when cp.id is not null then jsonb_build_object('full_name', cp.full_name) else null end as profiles,
          case when ap.id is not null then jsonb_build_object('full_name', ap.full_name) else null end as approver_profile
        from public.roznamcha_entries e
        left join public.countries c on c.id = e.country_id
        left join public.country_branches cb on cb.id = e.country_branch_id
        left join public.city_branches cib on cib.id = e.city_branch_id
        left join public.profiles cp on cp.id = e.created_by
        left join public.profiles ap on ap.id = e.approved_by
        where e.id = ${id} and e.deleted_at is null
        limit 1
      `;

      if (!headerRows || headerRows.length === 0) {
        return null;
      }

      const header = headerRows[0];

      const lineRows = await sql`
        select
          l.id, l.payment_entry_type, l.account_id, l.enterprise_account_id,
          l.account_number, l.manual_reference_number, l.customer_number,
          l.country_serial_number, l.branch_serial_number, l.ledger_id,
          l.description, l.debit, l.credit, l.currency, l.usd_rate, l.usd_amount,
          case when led.id is not null then jsonb_build_object('id', led.id, 'code', led.code, 'name', led.name) else null end as ledgers,
          case when acc.id is not null then jsonb_build_object('id', acc.id, 'code', acc.code, 'name', acc.name) else null end as accounts
        from public.roznamcha_lines l
        left join public.ledgers led on led.id = l.ledger_id
        left join public.accounts acc on acc.id = l.account_id
        where l.roznamcha_entry_id = ${id}
        order by l.id asc
      `;

      const translationRows = await sql`
        select field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
        from public.record_translations
        where record_table = 'roznamcha_entries' and record_id = ${id} and deleted_at is null
      `;

      const translations = Object.fromEntries(
        (translationRows || []).map((r: any) => [
          r.field_name,
          { en: r.english_text, ur: r.urdu_text, ar: r.arabic_text, fa: r.persian_text, ps: r.pashto_text }
        ])
      );

      return { header, lines: lineRows, translations };
    });

    if (viaPg !== undefined) {
      if (!viaPg) {
        return apiOk({
          found: false,
          id,
          header: null,
          lines: [],
          totals: { debit: 0, credit: 0, lines: 0 }
        });
      }

      authorizeApiScope(session, {
        resource: "roznamcha",
        action: "read",
        countryId: (viaPg.header.country_id as string | null) ?? null,
        countryBranchId: (viaPg.header.country_branch_id as string | null) ?? null,
        cityBranchId: (viaPg.header.city_branch_id as string | null) ?? null
      });

      const totals = (viaPg.lines as any[]).reduce(
        (acc, row) => {
          acc.lines += 1;
          acc.debit += Number(row.debit || 0);
          acc.credit += Number(row.credit || 0);
          return acc;
        },
        { lines: 0, debit: 0, credit: 0 }
      );

      const [localizedHeader] = await localizeRecordNames([viaPg.header as { id: string; narration?: string | null }], "roznamcha_entries", "narration", lang);
      const localizedLines = await localizeRecordNames(viaPg.lines as unknown as Array<{ id: string; description?: string | null }>, "roznamcha_lines", "description", lang);

      return apiOk({
        found: true,
        id,
        header: { ...localizedHeader, translations: viaPg.translations },
        lines: localizedLines,
        totals
      });
    }

    // Fallback: Supabase Client
    const supabase = createSupabaseAdminClient() as any;

    const { data: header, error: headerError } = await supabase
      .from("roznamcha_entries")
      .select("id, type, entry_category, country_id, country_branch_id, city_branch_id, journal_no, voucher_no, entry_date, payment_method_id, reference_no, narration, status, created_by, approved_by, approved_at, posted_at, created_at, updated_at, source_module, source_transaction_type, source_transaction_id, source_reference_no")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (headerError) throw new Error(headerError.message);

    if (!header) {
      return apiOk({
        found: false,
        id,
        header: null,
        lines: [],
        totals: { debit: 0, credit: 0, lines: 0 }
      });
    }

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "read",
      countryId: (header.country_id as string | null) ?? null,
      countryBranchId: (header.country_branch_id as string | null) ?? null,
      cityBranchId: (header.city_branch_id as string | null) ?? null
    });

    const { data: lines, error: linesError } = await supabase
      .from("roznamcha_lines")
      .select("id, payment_entry_type, account_id, enterprise_account_id, account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number, ledger_id, description, debit, credit, currency, usd_rate, usd_amount")
      .eq("roznamcha_entry_id", id)
      .order("id", { ascending: true });

    if (linesError) throw new Error(linesError.message);

    const safeLines = (lines ?? []) as RoznamchaLine[];
    const { data: translationRows } = await supabase
      .from("record_translations")
      .select("field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text")
      .eq("record_table", "roznamcha_entries")
      .eq("record_id", id)
      .is("deleted_at", null);

    const translations = Object.fromEntries(
      (translationRows || []).map((row: any) => [
        row.field_name,
        {
          en: row.english_text,
          ur: row.urdu_text,
          ar: row.arabic_text,
          fa: row.persian_text,
          ps: row.pashto_text
        }
      ])
    );

    const totals = safeLines.reduce(
      (acc, row) => {
        acc.lines += 1;
        acc.debit += Number(row.debit || 0);
        acc.credit += Number(row.credit || 0);
        return acc;
      },
      { lines: 0, debit: 0, credit: 0 }
    );

    const [localizedHeader] = await localizeRecordNames([header as RoznamchaHeader], "roznamcha_entries", "narration", lang);
    const localizedLines = await localizeRecordNames(safeLines, "roznamcha_lines", "description", lang);

    return apiOk({
      found: true,
      id,
      header: { ...localizedHeader, translations },
      lines: localizedLines,
      totals
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const params = await context.params;
    const id = uuidSchema.parse(params.id);

    const adminSupabase = createSupabaseAdminClient() as any;

    const { data: header, error: headerError } = await adminSupabase
      .from("roznamcha_entries")
      .select("country_id, country_branch_id, city_branch_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (headerError) throw new Error(headerError.message);
    if (!header) {
      return apiOk({ success: false, message: "Entry not found" });
    }

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "post",
      countryId: (header.country_id as string | null) ?? null,
      countryBranchId: (header.country_branch_id as string | null) ?? null,
      cityBranchId: (header.city_branch_id as string | null) ?? null
    });

    // Inject the authenticated user's UUID into the Postgres session so that
    // auth.uid() returns a valid value inside the security-definer RPC.
    // The service-role admin client does not carry a Supabase Auth JWT, so
    // auth.uid() would otherwise be null, causing assert_enterprise_scope_access
    // to throw "Authentication is required".
    const actorId = session.userId ?? null;
    if (actorId) {
      const claimsJson = JSON.stringify({ sub: actorId, role: "authenticated" });
      try {
        await adminSupabase.rpc("set_config", {
          setting: "request.jwt.claims",
          value: claimsJson,
          is_local: true
        });
      } catch (e) {
        // best-effort - fallback if set_config not exposed
      }
    }

    const { data, error } = await adminSupabase.rpc("reverse_roznamcha_entry", {
      p_original_entry_id: id,
      p_reason: "Deleted or edited from cash entry page",
      p_approval_request_id: null
    });

    if (error) throw new Error(error.message);

    // Requirement 9 & 11: Real-time Synchronization
    revalidatePath("/dashboard/roznamcha", "layout");
    revalidatePath("/dashboard/reports", "layout");
    revalidatePath("/dashboard/journal", "layout");

    return apiOk({ success: true, reversalId: data });
  } catch (error) {
    return handleApiError(error);
  }
}


