import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Purchase — Confirmed Booking" };

export const dynamic = "force-dynamic";

export default async function PurchaseConfirmPage() {
  const lang = await getRequestLanguage();
  return (
    <PurchaseModuleWorkspace
      title="Confirmed Booking"
      displayTitle={t(lang, "pmw.booking_confirm_title", "Confirmed Booking")}
      description={t(lang, "pmw.booking_confirm_desc", "Review confirmed purchase booking orders with invoice, account, goods, payment status (Red for Outstanding, Black for Fully Paid), and operational status.")}
    />
  );
}
