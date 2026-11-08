import { ConfirmPurchaseBillsView } from "@/features/purchases/components/confirm-purchase-bills-view";
import { getCurrentErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Confirm Purchase Bills" };

export const dynamic = "force-dynamic";

export default async function ConfirmPurchasePage() {
  const session = await getCurrentErpSession();
  return (
    <ConfirmPurchaseBillsView
      sessionInfo={{
        userId: session?.userId ?? "",
        userName: session?.fullName ?? session?.email ?? "",
        role: (session?.roles && session.roles[0]) ?? "",
      }}
    />
  );
}

