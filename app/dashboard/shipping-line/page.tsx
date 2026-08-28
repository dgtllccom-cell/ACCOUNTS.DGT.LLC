import { redirect } from "next/navigation";

export const metadata = { title: "Shipping Line" };


export default function ShippingLineDashboardPage() {
  redirect("/dashboard/logistics" as any);
}

