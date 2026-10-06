import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { CountryTaxManagementView } from "@/features/settings/components/country-tax-management";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tax Setup & Rates — ERP",
  description: "Configure multi-country tax rates, VAT/GST registration numbers, and defaults per country."
};

export default async function TaxPage() {
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
