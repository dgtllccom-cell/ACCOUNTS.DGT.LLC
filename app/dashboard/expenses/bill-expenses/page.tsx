import { BillExpensesView } from "@/features/expenses/components/bill-expenses-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Expenses — Bill Expenses" };
export const dynamic = "force-dynamic";

export default async function BillExpensesPage() {
  const lang = await getRequestLanguage();
  return (
    <div className="container mx-auto p-4 md:p-6">
      <BillExpensesView lang={lang} />
    </div>
  );
}
