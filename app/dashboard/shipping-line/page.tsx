import { redirect } from "next/navigation";

export default function ShippingLineDashboardPage() {
  redirect("/dashboard/logistics" as any);
}

