import { LocalPurchaseDestinationQueueView } from "@/features/purchases/components/local-purchase-destination-queue-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Local Purchase Export Handover Queue" };

export const dynamic = "force-dynamic";

export default async function LocalPurchaseExportPage() {
  const session = await requireErpSession();
  return <LocalPurchaseDestinationQueueView stage="export" session={session} />;
}
