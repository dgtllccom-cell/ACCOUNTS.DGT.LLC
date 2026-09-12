import { NewPurchaseBookingEntry } from "@/features/purchases/components/new-purchase-booking-entry";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — New Purchase Booking Order" };


export const dynamic = "force-dynamic";

export default async function NewPurchaseBookingOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ purchaseId?: string; orderId?: string; id?: string; purchaseOrderId?: string; purchaseOrderNo?: string }>;
}) {
  // requireErpSession() redirects unauthenticated users to /auth/login — let it.
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : {};
  const purchaseId = sp.purchaseId || sp.orderId || sp.id || sp.purchaseOrderId || sp.purchaseOrderNo || null;
  return (
    <NewPurchaseBookingEntry
      session={session}
      lang={session?.preferredLanguage ?? "en"}
      skipGate={Boolean(purchaseId)}
    />
  );
}
