import { SalesBookingGlobalRegisterView } from "@/features/sales/components/sales-booking-global-register-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Sales — Sales Booking" };

export const dynamic = "force-dynamic";

export default async function NewSalesBookingOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{
    lotId?: string;
    salesOrderId?: string;
    salesId?: string;
    orderId?: string;
    id?: string;
    salesOrderNo?: string;
    source?: string;
    mode?: string;
  }>;
}) {
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : {};
  const orderId = sp.salesOrderId || sp.salesId || sp.orderId || sp.id || sp.salesOrderNo || null;
  return (
    <SalesBookingGlobalRegisterView
      session={session}
      lang={session?.preferredLanguage ?? "en"}
      initialOrderId={orderId}
      initialLotId={sp.lotId || null}
      initialSource={sp.source || null}
    />
  );
}
