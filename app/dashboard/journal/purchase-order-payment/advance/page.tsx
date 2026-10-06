export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Journal — Purchase Order Payment — Advance" };


export default async function PurchaseOrderAdvancePaymentPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">{t(lang, "pojp.loading_advance", "Loading Purchase Advance Payment Journal...")}</div>}>
      <PurchaseOrderPaymentJournal mode="advance" />
    </Suspense>
  );
}
