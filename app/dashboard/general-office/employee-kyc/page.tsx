import { requireErpSession } from "@/lib/auth/session";
import { EmployeeKycView } from "@/features/hrm/components/employee-kyc-view";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const dynamic = "force-dynamic";

export const metadata = { title: "Employee KYC / QVC — HRM" };

export default async function EmployeeKycPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : undefined;
  // the report tab is a read-only compliance register: it opens straight away (the entry gateway is for creating a record)
  return (
    <EntryMethodSelector targetModule="employees" domain="business" lang={session.preferredLanguage ?? "en"} skipGate={sp?.tab === "report"}>
      <EmployeeKycView lang={session.preferredLanguage ?? "en"} />
    </EntryMethodSelector>
  );
}
