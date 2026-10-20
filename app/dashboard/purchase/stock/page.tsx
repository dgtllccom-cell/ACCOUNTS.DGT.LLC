import { redirect } from "next/navigation";

export default function StockRootPage() {
  redirect("/dashboard/purchase/stock/journal");
}
