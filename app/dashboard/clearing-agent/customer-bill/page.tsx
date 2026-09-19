import { CustomerBillManagementView } from "@/features/clearing-agent/components/customer-bill-management-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Clearing Agent — Customer Bills" };

export default async function CustomerBillsPage() {
  const lang = await getRequestLanguage();

  return (
    <EntryMethodSelector targetModule="customer_orders" domain="shipping" lang={lang}>
      <CustomerBillManagementView />
    </EntryMethodSelector>
  );
}
