import { requireErpSession } from "@/lib/auth/session";
import { PayrollReconciliationView } from "@/features/hrm/components/payroll-reconciliation-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payroll Reconciliation — HRM" };

export default async function PayrollReconciliationPage() {
  const session = await requireErpSession();
  return <PayrollReconciliationView lang={session.preferredLanguage ?? "en"} />;
}
