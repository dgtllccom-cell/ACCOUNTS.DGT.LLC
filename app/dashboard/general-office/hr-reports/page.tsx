import { requireErpSession } from "@/lib/auth/session";
import { HrReportsHub } from "@/features/hrm/components/hr-reports-hub";

export const dynamic = "force-dynamic";

export const metadata = { title: "HRM Reports — HRM" };

export default async function HrReportsPage() {
  const session = await requireErpSession();
  return <HrReportsHub lang={session.preferredLanguage ?? "en"} />;
}
