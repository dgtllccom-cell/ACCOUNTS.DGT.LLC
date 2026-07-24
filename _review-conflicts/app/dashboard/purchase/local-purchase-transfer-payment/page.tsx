import { LocalPurchaseTransferPaymentView } from "@/features/purchases/components/local-purchase-transfer-payment-view";
import { requireErpSession } from "@/lib/auth/session";

export default async function LocalPurchaseTransferPaymentPage() {
  const session = await requireErpSession();
  return <LocalPurchaseTransferPaymentView session={session} />;
}
