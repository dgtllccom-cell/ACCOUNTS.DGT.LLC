import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { PlaceholderScreenNotice } from "@/components/layout/placeholder-screen-notice";

export const metadata = { title: "New Entry — Shipping Line" };

export default function ShippingLineEntryPage() {
  return (
    <div className="space-y-4">
      <DashboardPageHeader
        titleKey="dph.shipping_line_title"
        titleFallback="Shipping Line"
        descKey="dph.shipping_line_desc"
        descFallback="Shipping line forms (BL, containers, vessels, freight, invoices) will be available here."
      />
      <PlaceholderScreenNotice
        noteKey="dph.shipping_line_note"
        noteFallback="Document templates and attachments will connect to Supabase Storage later."
      />
    </div>
  );
}
