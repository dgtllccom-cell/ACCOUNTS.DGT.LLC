import { SettlementModuleView } from "@/features/settlement/components/settlement-module-view";

export const dynamic = "force-dynamic";

export default function PartySettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementModuleView
        title="Party / Account Settlement"
        subtitle="Consolidated reconciliation by customer, supplier, and broker account"
      />
    </div>
  );
}
