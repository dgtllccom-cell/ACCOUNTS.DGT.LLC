import { redirect } from "next/navigation";

export const metadata = { title: "Loading" };


export default function LoadingAliasPage() {
  redirect("/dashboard/purchase/purchase-loading-records" as const);
}
