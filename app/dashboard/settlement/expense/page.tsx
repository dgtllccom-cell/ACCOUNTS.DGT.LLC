import { SettlementModuleView } from "@/features/settlement/components/settlement-module-view";

export const metadata = { title: "Settlement — Expense" };


export const dynamic = "force-dynamic";

export default function ExpenseSettlementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementModuleView
        title="Expense & Office Bill Settlement"
        subtitle="Match operational expenses, salary advances, and vendor utility bills"
        defaultModule="expense"
      />
    </div>
  );
}
