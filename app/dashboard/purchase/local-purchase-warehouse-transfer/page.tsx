import { LocalPurchaseDestinationQueueView } from "@/features/purchases/components/local-purchase-destination-queue-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Warehouse Transfer Queue" };

export const dynamic = "force-dynamic";

export default async function LocalPurchaseWarehouseTransferPage() {
  const session = await requireErpSession();
  return <LocalPurchaseDestinationQueueView stage="warehouse_transfer" session={session} />;
}
