import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ledgerReportService } from "@/lib/services/ledger-report-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordGroups } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";

// Journal Reporting — filter dropdown option lists. Session-scoped (never a global list for a
// non-super-admin), and every "type" list is read as DISTINCT values that actually exist in the
// data rather than a hard-coded/guessed enum, per the "never fabricate" rule — the only two
// exceptions are `statuses` (document_status: draft|posted|cancelled — a real fixed Postgres
// enum, not invented) and `approvalStatuses` (approved|pending — the same derived binary
// classification journal-report-service.ts computes for every row).

export async function GET() {
  try {
    const session = await requireErpSession();
    const language = await getRequestLanguage();

    // ONE database connection for all the small lookups (they used to open seven connections at once, on top of the ledger lookup's
    // pooled connections - on the 15-slot pooler that starved the pool and the endpoint hung for minutes). The ledger lookup runs in
    // parallel on its own pooled connection.
    const [base, accounts] = await Promise.all([
      withLocalPg(async (sql) => {
        const countries = session.isSuperAdmin
          ? await sql`select id::text as id, name from public.countries where deleted_at is null order by name`
          : await sql`select id::text as id, name from public.countries where deleted_at is null and id = any(${session.countryIds}::uuid[]) order by name`;
        const countryBranches = session.isSuperAdmin
          ? await sql`select id::text as id, name, code from public.country_branches where deleted_at is null order by name`
          : await sql`select id::text as id, name, code from public.country_branches where deleted_at is null and id = any(${session.countryBranchIds}::uuid[]) order by name`;
        const cityBranches = session.isSuperAdmin
          ? await sql`select id::text as id, name, code from public.city_branches where deleted_at is null order by name limit 500`
          : await sql`select id::text as id, name, code from public.city_branches where deleted_at is null and id = any(${session.cityBranchIds}::uuid[]) order by name`;
        const companies = session.isSuperAdmin
          ? await sql`select distinct c.id::text as id, c.name from public.companies c
                join public.enterprise_accounts ea on ea.company_id = c.id
                where c.deleted_at is null order by c.name limit 500`
          : await sql`select distinct c.id::text as id, c.name from public.companies c
                join public.enterprise_accounts ea on ea.company_id = c.id
                where c.deleted_at is null
                  and (ea.city_branch_id = any(${session.cityBranchIds}::uuid[])
                    or ea.country_branch_id = any(${session.countryBranchIds}::uuid[])
                    or ea.country_id = any(${session.countryIds}::uuid[]))
                order by c.name limit 500`;
        const customers = session.isSuperAdmin
          ? await sql`select id::text as id, customer_name as name from public.customers where deleted_at is null order by customer_name limit 500`
          : await sql`select id::text as id, customer_name as name from public.customers where deleted_at is null and country_id = any(${session.countryIds}::uuid[]) order by customer_name limit 500`;
        const journalTypes = await sql`select distinct payment_entry_type as value from public.roznamcha_lines where payment_entry_type is not null order by value limit 50`;
        const voucherTypes = await sql`select distinct transaction_type as value from public.ledger_posting_batches where transaction_type is not null order by value limit 50`;
        const currencies = await sql`select distinct currency as value from (
                select currency from public.roznamcha_lines where currency is not null
                union
                select currency from public.ledger_posting_lines where currency is not null
              ) x order by value limit 50`;
        const users = await sql`select id::text as id, full_name as name from public.profiles where deleted_at is null order by full_name limit 500`;
        return { countries, countryBranches, cityBranches, companies, customers, distinctValues: { journalTypes, voucherTypes, currencies, users } };
      }),
      // Account/Ledger options - reuse the already scope-filtered ledger lookup instead of re-deriving RBAC scope logic here.
      ledgerReportService.listLedgers({ session, reportScope: "super_admin", includeAllScopes: true, limit: 1000, language })
    ]);
    const { countries, countryBranches, cityBranches, companies, customers, distinctValues } = base ?? { countries: [], countryBranches: [], cityBranches: [], companies: [], customers: [], distinctValues: { journalTypes: [], voucherTypes: [], currencies: [], users: [] } };

    const accountOptions = (accounts ?? []).map((a) => ({
      id: a.ledgerId,
      name: a.accountName || a.ledgerName || a.accountCode || a.ledgerCode,
      code: a.accountCode || a.ledgerCode
    }));

    // Resolve every dropdown label into the viewer's language — same central per-language
    // resolver (record_translations + approved dictionary) journal-report-service.ts uses for
    // the register itself, one shared connection for all four lookup groups at once.
    const [localizedCountries, localizedCountryBranches, localizedCityBranches, localizedCompanies, localizedCustomers] = language
      ? await localizeRecordGroups(
          [
            { records: (countries ?? []) as any[], table: "countries", fields: ["name"] },
            { records: (countryBranches ?? []) as any[], table: "country_branches", fields: ["name"] },
            { records: (cityBranches ?? []) as any[], table: "city_branches", fields: ["name"] },
            { records: (companies ?? []) as any[], table: "companies", fields: ["name"] },
            { records: (customers ?? []) as any[], table: "customers", fields: ["name"] }
          ],
          language
        )
      : [countries ?? [], countryBranches ?? [], cityBranches ?? [], companies ?? [], customers ?? []];

    return apiOk({
      countries: localizedCountries,
      countryBranches: localizedCountryBranches,
      cityBranches: localizedCityBranches,
      accounts: accountOptions,
      companies: localizedCompanies,
      customers: localizedCustomers,
      journalTypes: (distinctValues?.journalTypes ?? []).map((r: any) => r.value),
      voucherTypes: (distinctValues?.voucherTypes ?? []).map((r: any) => r.value),
      currencies: (distinctValues?.currencies ?? []).map((r: any) => r.value),
      users: distinctValues?.users ?? [],
      statuses: ["draft", "posted", "cancelled"],
      approvalStatuses: ["approved", "pending"]
    });
  } catch (error) {
    return handleApiError(error);
  }
}
