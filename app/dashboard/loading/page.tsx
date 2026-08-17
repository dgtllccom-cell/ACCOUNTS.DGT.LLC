import { redirect } from "next/navigation";

export default function LoadingAliasPage() {
  redirect("/dashboard/purchase/purchase-loading-records" as const);
}
