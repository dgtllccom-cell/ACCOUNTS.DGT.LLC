import { ExpensesBillEntryForm } from "@/features/roznamcha/components/expenses-bill-entry-form";
import { getRequestLanguage } from "@/lib/i18n/server";

export default async function ExpensesBillPage() {
  const lang = await getRequestLanguage();

  return <ExpensesBillEntryForm lang={lang} />;
}
