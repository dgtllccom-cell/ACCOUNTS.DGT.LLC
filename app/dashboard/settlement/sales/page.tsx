import { SettlementModuleView } from "@/features/settlement/components/settlement-module-view";

export const dynamic = "force-dynamic";

export default function SalesSettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementModuleView
        title="Sales & Customer Settlement"
        subtitle="Match customer invoices, receivables, and receipt roznamcha vouchers"
        defaultModule="sales"
        defaultDirection="cr"
      />
    </div>
  );
}
