import { requireErpSession } from "@/lib/auth/session";
import { HrMastersManager } from "@/features/hrm/components/hr-masters-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Designations — HRM" };

export default async function DesignationsPage() {
  const session = await requireErpSession();
  return <HrMastersManager kind="designation" lang={session.preferredLanguage ?? "en"} />;
}
