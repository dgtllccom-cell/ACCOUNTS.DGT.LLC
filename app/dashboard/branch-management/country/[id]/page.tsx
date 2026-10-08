import { CountryOperationsView } from "@/features/branch-management/components/network-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Country Operations" };

export default async function CountryOperationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getRequestLanguage();
  return <CountryOperationsView countryId={id} lang={lang} />;
}
