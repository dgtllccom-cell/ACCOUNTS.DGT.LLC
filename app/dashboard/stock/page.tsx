import { redirect } from "next/navigation";

export const metadata = { title: "Stock" };


export default function StockAliasPage() {
  redirect("/dashboard/inventory" as const);
}
