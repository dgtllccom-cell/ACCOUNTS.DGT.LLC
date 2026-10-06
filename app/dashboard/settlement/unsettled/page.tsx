import { SettlementModuleView } from "@/features/settlement/components/settlement-module-view";

export const metadata = { title: "Settlement — Unsettled" };


export const dynamic = "force-dynamic";

export default function UnsettledSettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementModuleView
        title="Unsettled & Partial Settlements"
        subtitle="Priority queue of open, partially settled, and discrepancy transactions requiring reconciliation"
      />
    </div>
  );
}
