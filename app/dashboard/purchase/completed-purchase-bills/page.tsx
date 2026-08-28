import { CompletedPurchaseBillsView } from "@/features/purchases/components/completed-purchase-bills-view";

export const metadata = { title: "Purchase — Completed Purchase Bills" };


export const dynamic = "force-dynamic";

export default function CompletedPurchaseBillsPage() {
  return <CompletedPurchaseBillsView />;
}
