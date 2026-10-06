import { LocalPurchaseDestinationQueueView } from "@/features/purchases/components/local-purchase-destination-queue-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Local Purchase Loading Queue" };

export const dynamic = "force-dynamic";

export default async function LocalPurchaseLoadingPage() {
  const session = await requireErpSession();
  return <LocalPurchaseDestinationQueueView stage="loading" session={session} />;
}
