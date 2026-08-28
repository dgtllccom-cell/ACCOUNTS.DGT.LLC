import { SettlementModuleView } from "@/features/settlement/components/settlement-module-view";

export const dynamic = "force-dynamic";

export default function BankSettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementModuleView
        title="Bank & Cheque Settlement"
        subtitle="Match and reconcile bank accounts, uncleared cheques, and deposit vouchers"
        defaultModule="bank"
      />
    </div>
  );
}
