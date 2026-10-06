import { SettlementReportsView } from "@/features/settlement/components/settlement-reports-view";

export const metadata = { title: "Settlement — Reports" };


export const dynamic = "force-dynamic";

export default function SettlementReportsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementReportsView />
    </div>
  );
}
