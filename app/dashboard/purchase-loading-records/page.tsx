import { redirect } from "next/navigation";

export const metadata = { title: "Purchase Loading Records" };


export default function PurchaseLoadingRecordsAliasPage() {
  redirect("/dashboard/purchase/purchase-loading-records" as const);
}
