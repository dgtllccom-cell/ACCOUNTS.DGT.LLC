import { ExpensesBillEntryForm } from "@/features/roznamcha/components/expenses-bill-entry-form";
import { getRequestLanguage } from "@/lib/i18n/server";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Clearing Agent — Truck Freight / Rent Bill" };

export default async function TruckFreightRentBillPage() {
  const lang = await getRequestLanguage();

  return (
    <EntryMethodSelector targetModule="expenses" domain="business" lang={lang} skipGate>
      <ExpensesBillEntryForm lang={lang} initialBillCategory="truck_freight_rent" />
    </EntryMethodSelector>
  );
}
