import { redirect } from "next/navigation";

export default function StockAliasPage() {
  redirect("/dashboard/inventory" as const);
}
