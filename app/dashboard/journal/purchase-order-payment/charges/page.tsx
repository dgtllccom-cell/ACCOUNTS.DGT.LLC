import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Journal — Purchase Order Payment — Charges" };


export default async function PurchaseOrderChargesPaymentPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">{t(lang, "pojp.loading_charges", "Loading Credit / Charges Payment Journal...")}</div>}>
      <PurchaseOrderPaymentJournal mode="credit" />
    </Suspense>
  );
}
