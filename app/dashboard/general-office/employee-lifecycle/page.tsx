import { requireErpSession } from "@/lib/auth/session";
import { EmployeeLifecycleView } from "@/features/hrm/components/employee-lifecycle-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Employee Lifecycle & History — HRM" };

export default async function EmployeeLifecyclePage() {
  const session = await requireErpSession();
  return <EmployeeLifecycleView lang={session.preferredLanguage ?? "en"} />;
}
