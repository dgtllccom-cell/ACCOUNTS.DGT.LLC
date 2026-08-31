import { NextRequest } from "next/server";
import { apiOk, handleApiError, rethrowIfNextControlFlow } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { TRANSLATABLE_FIELDS } from "@/lib/i18n/translatable-fields";
import { sidebarTree } from "@/lib/navigation/sidebar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Live ERP inventory + verification evidence for the "ERP System Documentation
 * Report" (print-reports hub). Read-only. super_admin scope only.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin")) {
      return apiOk({ restricted: true });
    }

    const data = await withLocalPg(async (sql) => {
      const [{ tables }] = (await sql`
        select count(*)::int as tables from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`) as unknown as Array<{ tables: number }>;

      const [{ views }] = (await sql`
        select count(*)::int as views from information_schema.tables
        where table_schema = 'public' and table_type = 'VIEW'`) as unknown as Array<{ views: number }>;

      const [{ functions }] = (await sql`
        select count(*)::int as functions from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`) as unknown as Array<{ functions: number }>;

      const tableGroups = (await sql`
        select
          case
            when table_name ~ 'roznamcha|ledger|journal|account|financial|voucher|posting|reconcil|settlement' then 'Accounting / Ledger / Roznamcha'
            when table_name ~ 'purchase|supplier|procurement|goods|loading' then 'Purchase / Goods'
            when table_name ~ 'sales|customer_order|quotation' then 'Sales'
            when table_name ~ 'expense|bill' then 'Expenses / Bills'
            when table_name ~ 'hr_|employee|payroll|attendance|leave|designation|department|gratuity|kyc|onboard' then 'HR / Payroll'
            when table_name ~ 'crm|communication|lead|inquir|followup|reminder' then 'CRM / Communication'
            when table_name ~ 'shipping|shipment|clearing|transit|truck|container|bl_|handover|port' then 'Shipping / Clearing'
            when table_name ~ 'bank|cheque|currency|usd_rate|exchange' then 'Bank / Currency / FX'
            when table_name ~ 'inventory|stock|warehouse|product|brand|categor' then 'Inventory / Stock'
            when table_name ~ 'translation|dictionary|record_translations|erp_translation' then 'Multilingual / Translation'
            when table_name ~ 'user|role|permission|profile|assignment|session|auth' then 'Users / Roles / Permissions'
            when table_name ~ 'country|branch|city|company|district|state|area' then 'Org / Countries / Branches'
            when table_name ~ 'tax|vat|fbr|einvoic' then 'Tax / e-Invoicing'
            when table_name ~ 'audit|activity|event|version|history' then 'Audit / History'
            when table_name ~ 'task|assignment|work_order' then 'User Tasks / Work Orders'
            when table_name ~ 'document|office_document|attachment|filing' then 'Documents'
            else 'Other'
          end as grp,
          count(*)::int as n
        from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        group by 1 order by 2 desc`) as unknown as Array<{ grp: string; n: number }>;

      const migrations = (await sql`
        select name, status, applied_at from erp_schema_migrations order by applied_at`.catch(() => [])) as unknown as Array<{ name: string; status: string; applied_at: string }>;

      const [{ rt_rows }] = (await sql`select count(*)::int as rt_rows from record_translations`) as unknown as Array<{ rt_rows: number }>;

      const trByLang = (await sql`
        select
          count(*) filter (where coalesce(english_text,'') <> '')::int as en,
          count(*) filter (where coalesce(urdu_text,'') <> '')::int as ur,
          count(*) filter (where coalesce(arabic_text,'') <> '')::int as ar,
          count(*) filter (where coalesce(persian_text,'') <> '')::int as fa,
          count(*) filter (where coalesce(pashto_text,'') <> '')::int as ps,
          count(*) filter (where translation_status = 'complete')::int as complete,
          count(*) filter (where translation_status = 'needs_review')::int as needs_review,
          count(*) filter (where translation_status = 'pending')::int as pending
        from record_translations`) as unknown as Array<Record<string, number>>;

      const trByEngine = (await sql`
        select translated_by_engine as engine, count(*)::int as n from record_translations
        group by 1 order by 2 desc limit 12`) as unknown as Array<{ engine: string; n: number }>;

      const [{ tm_rows }] = (await sql`select count(*)::int as tm_rows from erp_translation_memory`.catch(() => [{ tm_rows: 0 }])) as unknown as Array<{ tm_rows: number }>;
      const tmByStatus = (await sql`select status, count(*)::int as n from erp_translation_memory group by 1 order by 2 desc`.catch(() => [])) as unknown as Array<{ status: string; n: number }>;

      const [{ countries }] = (await sql`select count(*)::int as countries from countries where deleted_at is null`) as unknown as Array<{ countries: number }>;
      const [{ country_branches }] = (await sql`select count(*)::int as country_branches from country_branches where deleted_at is null`.catch(() => [{ country_branches: 0 }])) as unknown as Array<{ country_branches: number }>;
      const [{ city_branches }] = (await sql`select count(*)::int as city_branches from city_branches where deleted_at is null`.catch(() => [{ city_branches: 0 }])) as unknown as Array<{ city_branches: number }>;
      const [{ roles }] = (await sql`select count(*)::int as roles from roles where deleted_at is null`.catch(() => [{ roles: 0 }])) as unknown as Array<{ roles: number }>;
      const [{ permissions }] = (await sql`select count(*)::int as permissions from permissions`.catch(() => [{ permissions: 0 }])) as unknown as Array<{ permissions: number }>;
      const [{ profiles }] = (await sql`select count(*)::int as profiles from profiles`) as unknown as Array<{ profiles: number }>;

      const recursiveJunk = (await sql`
        select count(*)::int as n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
        where ns.nspname = 'public' and c.relkind = 'r'
          and c.relname ~ '_(en|ur|ar|fa|ps)(_(en|ur|ar|fa|ps))?$'
          and c.relname not in ('translations_english','translations_urdu','translations_arabic','translations_persian','translations_pashto')
          and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')`) as unknown as Array<{ n: number }>;

      return {
        tables, views, functions, tableGroups, migrations,
        translation: {
          record_translations_rows: rt_rows,
          by_language: trByLang[0] ?? {},
          by_engine: trByEngine,
          translation_memory_rows: tm_rows,
          translation_memory_by_status: tmByStatus,
          registered_translatable_tables: Object.keys(TRANSLATABLE_FIELDS).length,
          recursive_or_per_module_junk_tables: recursiveJunk[0]?.n ?? 0,
        },
        org: { countries, country_branches, city_branches, roles, permissions, profiles },
      };
    });

    // module inventory from the sidebar tree
    const modules: Array<{ label: string; routes: number }> = [];
    for (const node of sidebarTree) {
      const count = (function walk(n: typeof node): number {
        let c = n.href ? 1 : 0;
        for (const ch of n.children ?? []) c += walk(ch);
        return c;
      })(node);
      modules.push({ label: node.labelKey, routes: count });
    }

    return apiOk({
      generatedAt: new Date().toISOString(),
      environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "unknown",
      db: data,
      modules,
      moduleCount: modules.length,
      totalRoutes: modules.reduce((a, m) => a + m.routes, 0),
    });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    return handleApiError(error);
  }
}
