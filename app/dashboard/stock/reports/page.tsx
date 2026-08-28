import { redirect } from "next/navigation";

export const metadata = { title: "Stock — Reports" };


export default function StockReportsAliasPage() {
  redirect("/dashboard/inventory/stock-reports/branch" as const);
}
