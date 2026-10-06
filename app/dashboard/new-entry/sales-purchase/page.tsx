import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { PlaceholderScreenNotice } from "@/components/layout/placeholder-screen-notice";

export const metadata = { title: "New Entry — Sales Purchase" };

export default function SalesPurchaseEntryPage() {
  return (
    <div className="space-y-4">
      <DashboardPageHeader
        titleKey="dph.sales_purchase_title"
        titleFallback="Sales & Purchase"
        descKey="dph.sales_purchase_desc"
        descFallback="Sales orders, purchase orders, confirmations, and local market entries will live here."
      />
      <PlaceholderScreenNotice
        noteKey="dph.sales_purchase_note"
        noteFallback="APIs and posting services will be connected next."
      />
    </div>
  );
}
