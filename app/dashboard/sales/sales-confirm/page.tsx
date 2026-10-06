import { SalesModuleWorkspace } from "@/features/sales/components/sales-module-workspace";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Sales — Sales Confirm" };


export default async function ConfirmedSalesPage() {
  const lang = await getRequestLanguage();
  return (
    <SalesModuleWorkspace
      title="Sales Booking Confirm"
      displayTitle={t(lang, "smw.sales_booking_confirm_title", "Sales Booking Confirm")}
      description={t(lang, "smw.sales_booking_confirm_desc", "Review booking-confirmed sales orders with invoice, account, goods, payment, and transfer status in the approved spreadsheet dashboard layout.")}
    />
  );
}
