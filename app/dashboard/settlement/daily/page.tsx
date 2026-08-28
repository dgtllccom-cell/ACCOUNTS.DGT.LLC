import { DailySettlementView } from "@/features/settlement/components/daily-settlement-view";

export const dynamic = "force-dynamic";

export default function DailySettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <DailySettlementView />
    </div>
  );
}
