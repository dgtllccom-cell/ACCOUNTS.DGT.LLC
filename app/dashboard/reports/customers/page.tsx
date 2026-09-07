import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportContext } from "@/lib/reports/resolve-report-context";
import { withLocalPg } from "@/lib/db/local-postgres";
import { CustomerReportView } from "@/features/reports/components/customer-report-view";
import type { ReportMetaOption } from "@/features/reports/components/universal-report-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer Report — ERP" };

export default async function CustomerReportPage() {
  const session = await requireErpSession();
  const context = await resolveReportContext(session);

  let countries: ReportMetaOption[] = [];
  try {
    countries = (await withLocalPg<ReportMetaOption[]>(async (sql) => {
      const r = session.isSuperAdmin
        ? await sql`select id::text as id, name from public.countries where deleted_at is null order by name`
        : await sql`select id::text as id, name from public.countries where deleted_at is null and id = any(${session.countryIds}::uuid[]) order by name`;
      return (r as unknown as Array<{ id: string; name: string }>).map((c) => ({ id: c.id, name: c.name }));
    })) ?? [];
  } catch {
    countries = [];
  }

  return <CustomerReportView context={context} countries={countries} />;
}
