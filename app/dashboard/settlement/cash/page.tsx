import { SettlementModuleView } from "@/features/settlement/components/settlement-module-view";

export const metadata = { title: "Settlement — Cash" };


export const dynamic = "force-dynamic";

export default function CashSettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementModuleView
        title="Cash / Roznamcha Settlement"
        subtitle="Reconciliation of cash register movements, petty cash, and daily roznamcha postings"
        defaultModule="roznamcha"
      />
    </div>
  );
}
