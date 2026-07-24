import { getRequestLanguage } from "@/lib/i18n/server";
import { CustomerList } from "@/features/customers/components/customer-list";

export default async function CustomersManagementPage() {
  const lang = await getRequestLanguage();
  return <CustomerList lang={lang} />;
}

