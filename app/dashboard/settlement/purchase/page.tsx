import { SettlementModuleView } from "@/features/settlement/components/settlement-module-view";

export const metadata = { title: "Settlement — Purchase" };


export const dynamic = "force-dynamic";

export default function PurchaseSettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementModuleView
        title="Purchase Bill Settlement"
        subtitle="Match supplier bills, advances, and payment roznamcha vouchers"
        defaultModule="purchase"
        defaultDirection="dr"
      />
    </div>
  );
}
