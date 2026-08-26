import { requireErpSession } from "@/lib/auth/session";
import { SmartDueView } from "@/features/smart-due/components/smart-due-view";

export const dynamic = "force-dynamic";

export default async function SmartDuePage() {
  await requireErpSession();
  return <SmartDueView />;
}
