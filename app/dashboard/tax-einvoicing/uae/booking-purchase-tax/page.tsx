import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxLinesView } from "@/features/uae-tax/components/uae-tax-lines-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "UAE Tax — Booking Purchase Input VAT" };

export default async function TaxUaeBookingPurchaseTaxPage() {
  const session = await requireErpSession();
  return (
    <UaeTaxLinesView
      lang={session.preferredLanguage ?? "en"}
      titleKey="tax_einv.nav_booking_purchase_tax"
      category="booking_purchase"
    />
  );
}
