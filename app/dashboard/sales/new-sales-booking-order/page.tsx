import { SalesOrderWizard } from "@/features/sales/components/sales-order-wizard.jsx";
import { requireErpSession } from "@/lib/auth/session";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Sales — New Sales Booking Order" };


export default async function NewSalesBookingOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ lotId?: string; salesOrderId?: string; salesId?: string; orderId?: string; id?: string; salesOrderNo?: string }>;
}) {
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : {};
  const orderId = sp.salesOrderId || sp.salesId || sp.orderId || sp.id || sp.salesOrderNo || null;
  return (
    <div className="w-full px-2 sm:px-4 lg:px-6 py-2">
      <EntryMethodSelector
        targetModule="sales_orders"
        domain="business"
        lang={session.preferredLanguage ?? "en"}
        skipGate={Boolean(orderId) || Boolean(sp.lotId)}
      >
        <SalesOrderWizard session={session} />
      </EntryMethodSelector>
    </div>
  );
}
