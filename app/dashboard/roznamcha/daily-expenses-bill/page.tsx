import { ExpensesBillEntryForm } from "@/features/roznamcha/components/expenses-bill-entry-form";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Roznamcha — Daily Expenses Bill" };


export default async function DailyExpensesBillPage() {
  const lang = await getRequestLanguage();

  return <ExpensesBillEntryForm lang={lang} initialBillCategory="daily_expenses" />;
}
