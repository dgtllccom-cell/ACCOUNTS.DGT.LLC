import { requireErpSession } from "@/lib/auth/session";
import { EmployeeKycView } from "@/features/hrm/components/employee-kyc-view";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const dynamic = "force-dynamic";

export const metadata = { title: "Employee KYC / QVC — HRM" };

export default async function EmployeeKycPage() {
  const session = await requireErpSession();
  return (
    <EntryMethodSelector targetModule="kyc_document" domain="business" lang={session.preferredLanguage ?? "en"}>
      <EmployeeKycView lang={session.preferredLanguage ?? "en"} />
    </EntryMethodSelector>
  );
}
