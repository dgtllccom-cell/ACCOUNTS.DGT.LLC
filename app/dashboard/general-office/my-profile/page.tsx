import { requireErpSession } from "@/lib/auth/session";
import { EmployeeSelfServiceView } from "@/features/hrm/components/employee-self-service-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Employee Profile — HRM" };

export default async function MyProfilePage() {
  const session = await requireErpSession();
  return <EmployeeSelfServiceView lang={session.preferredLanguage ?? "en"} />;
}
