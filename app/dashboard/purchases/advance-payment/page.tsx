export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function AdvancePaymentAliasPage() {
  redirect("/dashboard/journal/purchase-order-payment/advance");
}
