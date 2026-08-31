import { NewPurchaseBookingEntry } from "@/features/purchases/components/new-purchase-booking-entry";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — New Purchase Booking Order" };


export const dynamic = "force-dynamic";

export default async function NewPurchaseBookingOrderPage() {
  // requireErpSession() redirects unauthenticated users to /auth/login — let it.
  const session = await requireErpSession();
  return <NewPurchaseBookingEntry session={session} lang={session?.preferredLanguage ?? "en"} />;
}
