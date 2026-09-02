import { CompletedPurchaseBillsView } from "@/features/purchases/components/completed-purchase-bills-view";
import { getCurrentErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Completed Purchase Bills" };


export const dynamic = "force-dynamic";

export default async function CompletedPurchaseBillsPage() {
  const session = await getCurrentErpSession();
  return (
    <CompletedPurchaseBillsView
      sessionInfo={{
        userId: session?.userId ?? "",
        userName: session?.fullName ?? session?.email ?? "",
        role: (session?.roles && session.roles[0]) ?? "",
      }}
    />
  );
}
