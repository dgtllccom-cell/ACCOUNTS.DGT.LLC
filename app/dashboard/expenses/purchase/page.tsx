import { BillExpensesView } from "@/features/expenses/components/bill-expenses-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Expenses — Purchase Expenses" };
export const dynamic = "force-dynamic";

export default async function PurchaseExpensesPage() {
  const lang = await getRequestLanguage();
  return (
    <div className="w-full min-w-0 p-2 sm:p-4">
      <BillExpensesView lang={lang} section="purchase" />
    </div>
  );
}

