import { redirect } from "next/navigation";

export const metadata = { title: "Purchase — Bill Of Lading" };


export const dynamic = "force-dynamic";

export default function PurchaseBillOfLadingPage() {
  redirect("/dashboard/shipping-line/bl-entry");
}
