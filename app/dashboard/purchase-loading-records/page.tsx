import { redirect } from "next/navigation";

export default function PurchaseLoadingRecordsAliasPage() {
  redirect("/dashboard/purchase/purchase-loading-records" as const);
}
