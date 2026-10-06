import { CustomerBillRegister } from "@/features/clearing-agent/components/customer-bill-register";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Clearing Agent — Customer Bills" };

export default async function CustomerBillsPage() {
  const lang = await getRequestLanguage();

  return <CustomerBillRegister lang={lang} />;
}
