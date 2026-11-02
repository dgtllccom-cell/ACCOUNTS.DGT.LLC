export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function RemainingPaymentAliasPage() {
  redirect("/dashboard/journal/purchase-order-payment/remaining");
}
