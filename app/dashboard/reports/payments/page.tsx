import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportContext } from "@/lib/reports/resolve-report-context";
import { withLocalPg } from "@/lib/db/local-postgres";
import { PaymentReportView } from "@/features/reports/components/payment-report-view";
import type { ReportMetaOption } from "@/features/reports/components/universal-report-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment Report — ERP" };

type FilterLists = { countries: ReportMetaOption[]; branches: ReportMetaOption[] };

export default async function PaymentReportPage() {
  const session = await requireErpSession();
  const context = await resolveReportContext(session);

  let lists: FilterLists = { countries: [], branches: [] };
  try {
    lists = (await withLocalPg<FilterLists>(async (sql) => {
      const countryRows = session.isSuperAdmin
        ? await sql`select id::text as id, name from public.countries where deleted_at is null order by name`
        : await sql`select id::text as id, name from public.countries where deleted_at is null and id = any(${session.countryIds}::uuid[]) order by name`;
      const branchRows = session.isSuperAdmin
        ? await sql`select id::text as id, name, code from public.city_branches where deleted_at is null order by name limit 300`
        : await sql`select id::text as id, name, code from public.city_branches where deleted_at is null and id = any(${session.cityBranchIds}::uuid[]) order by name`;
      return {
        countries: (countryRows as unknown as Array<{ id: string; name: string }>).map((c) => ({ id: c.id, name: c.name })),
        branches: (branchRows as unknown as Array<{ id: string; name: string; code: string | null }>).map((b) => ({ id: b.id, name: b.name, code: b.code })),
      };
    })) ?? lists;
  } catch {
    lists = { countries: [], branches: [] };
  }

  return <PaymentReportView context={context} countries={lists.countries} branches={lists.branches} />;
}
