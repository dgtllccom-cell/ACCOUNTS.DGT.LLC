import { requireErpSession } from "@/lib/auth/session";
import { EmployeeKycView } from "@/features/hrm/components/employee-kyc-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Employee KYC / QVC — HRM" };

export default async function EmployeeKycPage() {
  const session = await requireErpSession();
  return <EmployeeKycView lang={session.preferredLanguage ?? "en"} />;
}
