import { requireErpSession } from "@/lib/auth/session";
import { GratuitySettlementView } from "@/features/hrm/components/gratuity-settlement-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gratuity & Final Settlement — HRM" };

export default async function GratuityPage() {
  const session = await requireErpSession();
  return <GratuitySettlementView lang={session.preferredLanguage ?? "en"} />;
}
