import { FxSettlementView } from "@/features/settlement/components/fx-settlement-view";

export const metadata = { title: "Settlement — Fx" };


export const dynamic = "force-dynamic";

export default function FxSettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <FxSettlementView />
    </div>
  );
}
