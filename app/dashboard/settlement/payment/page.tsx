import { SettlementModuleView } from "@/features/settlement/components/settlement-module-view";

export const metadata = { title: "Settlement — Payment" };


export const dynamic = "force-dynamic";

export default function PaymentSettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementModuleView
        title="Payment & Transfer Settlement"
        subtitle="Match vendor payments, branch transfers, and clearing accounts"
      />
    </div>
  );
}
