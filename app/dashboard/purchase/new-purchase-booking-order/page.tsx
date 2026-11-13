import { PurchaseBookingGlobalRegisterView } from "@/features/purchases/components/purchase-booking-global-register-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Purchase Booking" };


export const dynamic = "force-dynamic";

export default async function NewPurchaseBookingOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ purchaseId?: string; orderId?: string; id?: string; purchaseOrderId?: string; purchaseOrderNo?: string; mode?: string }>;
}) {
  // requireErpSession() redirects unauthenticated users to /auth/login — let it.
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : {};
  const purchaseId = sp.purchaseId || sp.orderId || sp.id || sp.purchaseOrderId || sp.purchaseOrderNo || null;
  return (
    <PurchaseBookingGlobalRegisterView
      session={session}
      lang={session?.preferredLanguage ?? "en"}
      initialPurchaseId={purchaseId}
    />
  );
}
