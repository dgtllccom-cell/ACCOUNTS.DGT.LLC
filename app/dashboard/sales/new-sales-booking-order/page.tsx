import { SalesOrderWizard } from "@/features/sales/components/sales-order-wizard.jsx";
import { requireErpSession } from "@/lib/auth/session";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Sales — New Sales Booking Order" };


export default async function NewSalesBookingOrderPage() {
  const session = await requireErpSession();
  return (
    <div className="container mx-auto px-4 py-3">
      <EntryMethodSelector targetModule="sales_orders" domain="business" lang={session.preferredLanguage ?? "en"}>
        <SalesOrderWizard session={session} />
      </EntryMethodSelector>
    </div>
  );
}
