import { redirect } from "next/navigation";

export const metadata = { title: "Shipping Lines" };


export default function ShippingLinesAliasPage() {
  redirect("/dashboard/shipping-line" as const);
}
