import { redirect } from "next/navigation";

export const metadata = { title: "Sales" };

// Mirror the Purchase module: the Sales index is a grouping node in the sidebar,
// so land the user on the first operational Sales workflow rather than a
// placeholder page.
export default function SalesPage() {
  redirect("/dashboard/sales/new-sales-booking-order");
}
