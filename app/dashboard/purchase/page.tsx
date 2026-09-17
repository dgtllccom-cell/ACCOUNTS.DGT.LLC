import { redirect } from "next/navigation";

export const metadata = { title: "Purchase" };


export default function PurchasePage() {
  redirect("/dashboard/purchase/purchase-booking-journal-report");
}
