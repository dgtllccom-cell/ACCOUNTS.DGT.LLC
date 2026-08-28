import { SettlementDashboardView } from "@/features/settlement/components/settlement-dashboard-view";

export const dynamic = "force-dynamic";

export default function SettlementDashboardPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <SettlementDashboardView />
    </div>
  );
}
