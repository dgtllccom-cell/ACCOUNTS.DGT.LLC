import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { CountryTaxManagementView } from "@/features/settings/components/country-tax-management";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Country Tax Settings — Master Forms",
  description: "Master form settings for multi-country tax rates and registration numbers."
};

export default async function SettingsTaxPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  const primaryCountryId = session.countryIds[0] ?? undefined;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <CountryTaxManagementView lang={lang} initialCountryId={primaryCountryId} />
      </div>
    </div>
  );
}
