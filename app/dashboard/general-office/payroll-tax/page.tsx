import { requireErpSession } from "@/lib/auth/session";
import { PayrollTaxConfigView } from "@/features/hrm/components/payroll-tax-config-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payroll Tax Configuration — HRM" };

export default async function PayrollTaxPage() {
  const session = await requireErpSession();
  return <PayrollTaxConfigView lang={session.preferredLanguage ?? "en"} />;
}
