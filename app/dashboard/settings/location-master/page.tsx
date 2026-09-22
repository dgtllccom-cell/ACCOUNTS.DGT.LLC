import { requireErpSession } from "@/lib/auth/session";
import { LocationMasterView } from "@/features/location-master/components/location-master-view";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export async function generateMetadata() {
  const lang = await getRequestLanguage();
  return {
    title: `${t(lang, "locmaster.title", "Central Location Master")} — Dynamic Location & Route Management`,
    description: t(lang, "locmaster.subtitle", "Seaports, Airports, Land Borders, Railway Terminals, Warehouses and Cross-Stuffing locations used across Shipping, Clearing and Route Management")
  };
}

export default async function LocationMasterPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <LocationMasterView lang={lang} />
      </div>
    </div>
  );
}
