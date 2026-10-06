import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Journal — Purchase Order Payment — History" };


export default async function PurchaseOrderPaymentHistoryPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">{t(lang, "pojp.loading_history", "Loading Payment History Journal...")}</div>}>
      <PurchaseOrderPaymentJournal mode="history" />
    </Suspense>
  );
}
