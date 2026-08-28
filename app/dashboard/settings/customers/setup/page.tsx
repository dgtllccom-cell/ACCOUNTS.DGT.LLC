import { getRequestLanguage } from "@/lib/i18n/server";
import { CustomerForm } from "@/features/customers/components/customer-form";

export const metadata = { title: "Settings — Customers — Setup" };


export default async function CustomerSetupPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;
  return <CustomerForm lang={lang} initialCustomerId={params?.customerId} />;
}
