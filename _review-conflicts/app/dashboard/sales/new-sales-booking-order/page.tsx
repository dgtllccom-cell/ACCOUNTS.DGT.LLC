import { SalesOrderWizard } from "@/features/sales/components/sales-order-wizard.jsx";
import { requireErpSession } from "@/lib/auth/session";

export default async function NewSalesBookingOrderPage() {
  const session = await requireErpSession();
  return (
    <div className="container mx-auto px-4 py-3">
      <SalesOrderWizard session={session} />
    </div>
  );
}

