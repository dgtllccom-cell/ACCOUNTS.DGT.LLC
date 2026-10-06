import { SalesOrderWizard } from "@/features/sales/components/sales-order-wizard.jsx";
import { requireErpSession } from "@/lib/auth/session";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Sales — New Sales Booking Order" };


export default async function NewSalesBookingOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ salesOrderId?: string; salesId?: string; orderId?: string; id?: string; salesOrderNo?: string }>;
}) {
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : {};
  const orderId = sp.salesOrderId || sp.salesId || sp.orderId || sp.id || sp.salesOrderNo || null;
  return (
    <div className="container mx-auto px-4 py-3">
      <EntryMethodSelector
        targetModule="sales_orders"
        domain="business"
        lang={session.preferredLanguage ?? "en"}
        skipGate={Boolean(orderId)}
      >
        <SalesOrderWizard session={session} />
      </EntryMethodSelector>
    </div>
  );
}
