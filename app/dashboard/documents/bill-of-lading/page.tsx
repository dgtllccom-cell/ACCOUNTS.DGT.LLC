import { redirect } from "next/navigation";

export const metadata = { title: "Documents — Bill Of Lading" };

export const dynamic = "force-dynamic";

/**
 * This route previously served a static B/L layout with placeholder data
 * ("TB JINJIANG" / "BANDAR ABBAS" / "YOUR COMPANY / SHIPPER NAME"). It was not
 * linked from anywhere. Bills of Lading are captured and rendered by the real
 * Shipping Line B/L module, so send the user there.
 */
export default function DocumentsBillOfLadingPage() {
  redirect("/dashboard/shipping-line/bl-entry");
}
