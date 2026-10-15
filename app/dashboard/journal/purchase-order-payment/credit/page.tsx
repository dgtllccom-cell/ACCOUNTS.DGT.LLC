export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Journal — Purchase Order Payment — Credit" };

export default async function PurchaseOrderCreditPaymentPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">{t(lang, "pojp.loading_charges", "Loading Credit Payment Journal...")}</div>}>
      <PurchaseOrderPaymentJournal mode="credit" paymentPage />
    </Suspense>
  );
}
