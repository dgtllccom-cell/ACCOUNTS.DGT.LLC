import { requireErpSession } from "@/lib/auth/session";
import { HrMastersManager } from "@/features/hrm/components/hr-masters-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Departments — HRM" };

export default async function DepartmentsPage() {
  const session = await requireErpSession();
  return <HrMastersManager kind="department" lang={session.preferredLanguage ?? "en"} />;
}
