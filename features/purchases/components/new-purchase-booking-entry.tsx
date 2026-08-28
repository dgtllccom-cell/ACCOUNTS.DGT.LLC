"use client";

import { Suspense } from "react";
import { PurchaseOrderWizard } from "@/features/purchases/components/purchase-order-wizard.jsx";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

/**
 * New Purchase Booking — Entry Method gate (Manual / Scan-Upload / Continue
 * Saved Draft / Cancel) in front of the existing PurchaseOrderWizard. The
 * wizard is rendered unchanged for Manual Entry; a chosen draft is stashed in
 * sessionStorage (`di_draft_prefill`) for the wizard to read.
 */
export function NewPurchaseBookingEntry({ session, lang }: { session: any; lang?: string }) {
  return (
    <EntryMethodSelector targetModule="purchase_orders" domain="business" lang={lang}>
      <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Purchase Booking Order Form...</div>}>
        <PurchaseOrderWizard session={session} />
      </Suspense>
    </EntryMethodSelector>
  );
}
