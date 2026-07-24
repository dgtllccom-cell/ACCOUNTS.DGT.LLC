import { getRequestLanguage } from "@/lib/i18n/server";
import { CustomerProfile } from "@/features/customers/components/customer-profile";

export default async function CustomerViewPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;
  return <CustomerProfile lang={lang} customerId={params?.customerId ?? ""} />;
}
