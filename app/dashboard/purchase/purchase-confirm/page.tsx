import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Purchase — Purchase Confirm" };


export const dynamic = "force-dynamic";

export default async function PurchaseConfirmPage() {
  const lang = await getRequestLanguage();
  return (
    <PurchaseModuleWorkspace
      title="Booking Confirm"
      displayTitle={t(lang, "pmw.booking_confirm_title", "Booking Confirm")}
      description={t(lang, "pmw.booking_confirm_desc", "Review booking-confirmed purchase orders with invoice, account, goods, payment, and transfer status in the approved spreadsheet dashboard layout.")}
    />
  );
}
