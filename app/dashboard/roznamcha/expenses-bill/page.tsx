import { ExpensesBillEntryForm } from "@/features/roznamcha/components/expenses-bill-entry-form";
import { getRequestLanguage } from "@/lib/i18n/server";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Roznamcha — Expenses Bill" };


export default async function ExpensesBillPage() {
  const lang = await getRequestLanguage();

  return (
    <EntryMethodSelector targetModule="expenses" domain="business" lang={lang}>
      <ExpensesBillEntryForm lang={lang} initialBillCategory="office_home" />
    </EntryMethodSelector>
  );
}
