import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "CRM — New Customer" };

export default async function NewCustomerPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading customer setup...</div>}>
      <EntryMethodSelector
        targetModule="customers"
        domain="business"
        lang={lang}
        skipGate={Boolean(params?.customerId)}
      >
        <CustomerForm lang={lang} initialCustomerId={params?.customerId} />
      </EntryMethodSelector>
    </Suspense>
  );
}
