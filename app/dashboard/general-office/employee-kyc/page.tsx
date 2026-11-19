import { requireErpSession } from "@/lib/auth/session";
import { EmployeeKycView } from "@/features/hrm/components/employee-kyc-view";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Employee KYC / QVC — HRM" };

export default async function EmployeeKycPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : undefined;
  // The report entry is the cross-entity completion queue (branches, users and
  // accounts), not the employee-only KYC register.
  if (sp?.tab === "report") redirect("/dashboard/kyc-reports");

  return (
    <EntryMethodSelector targetModule="employees" domain="business" lang={session.preferredLanguage ?? "en"}>
      <EmployeeKycView lang={session.preferredLanguage ?? "en"} />
    </EntryMethodSelector>
  );
}

