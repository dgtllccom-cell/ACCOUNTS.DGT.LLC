import { redirect } from "next/navigation";

export default function StockReportsAliasPage() {
  redirect("/dashboard/inventory/stock-reports/branch" as const);
}
