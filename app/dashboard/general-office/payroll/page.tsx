import { requireErpSession } from "@/lib/auth/session";
import { PayrollRunView } from "@/features/hrm/components/payroll-run-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payroll Runs — HRM" };

export default async function PayrollRunsPage() {
  const session = await requireErpSession();
  return <PayrollRunView lang={session.preferredLanguage ?? "en"} />;
}
