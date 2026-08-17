import { redirect } from "next/navigation";

export default function ShippingLinesAliasPage() {
  redirect("/dashboard/shipping-line" as const);
}
