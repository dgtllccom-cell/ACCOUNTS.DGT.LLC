import { requireErpSession } from "@/lib/auth/session";
import { CrmReportsView } from "@/features/crm/components/crm-reports-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CrmReportsPage() {
  const session = await requireErpSession();
  return <CrmReportsView session={session} />;
}
