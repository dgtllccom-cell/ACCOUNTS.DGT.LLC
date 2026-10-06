import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { TranslatedNoteSection } from "@/components/layout/translated-note-section";

export const metadata = { title: "Purchases" };

export default function PurchasesPage() {
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        titleKey="dph.purchases_title"
        titleFallback="Purchases"
        descKey="dph.purchases_desc"
        descFallback="Purchase documents will be added after journal posting and account controls are connected."
      />
      <TranslatedNoteSection
        textKey="dph.purchases_note"
        textFallback="Planned flow: draft purchase, validate goods and supplier account, generate balanced journal, post to ledger."
      />
    </div>
  );
}
