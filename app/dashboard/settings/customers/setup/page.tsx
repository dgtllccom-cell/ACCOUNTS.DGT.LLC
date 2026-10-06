import { getRequestLanguage } from "@/lib/i18n/server";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Settings — Customers — Setup" };

export default async function CustomerSetupPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;
  return (
    <EntryMethodSelector
      targetModule="customers"
      domain="business"
      lang={lang}
      skipGate={Boolean(params?.customerId)}
    >
      <CustomerForm lang={lang} initialCustomerId={params?.customerId} />
    </EntryMethodSelector>
  );
}
