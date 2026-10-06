import { LocalPurchaseTransferPaymentView } from "@/features/purchases/components/local-purchase-transfer-payment-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Local Purchase Transfer Payment" };


export const dynamic = "force-dynamic";

export default async function LocalPurchaseTransferPaymentPage() {
  const session = await requireErpSession();
  return <LocalPurchaseTransferPaymentView session={session} />;
}
