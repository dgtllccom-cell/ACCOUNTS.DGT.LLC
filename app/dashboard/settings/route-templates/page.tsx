import { requireErpSession } from "@/lib/auth/session";
import { RouteTemplatesView } from "@/features/location-master/components/route-templates-view";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export async function generateMetadata() {
  const lang = await getRequestLanguage();
  return {
    title: `${t(lang, "rtpl.title", "Reusable Route Templates")} — Dynamic Location & Route Management`,
    description: t(lang, "rtpl.subtitle", "Save common multi-country routes once, then apply and edit them per Customer Order")
  };
}

export default async function RouteTemplatesPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <RouteTemplatesView lang={lang} />
      </div>
    </div>
  );
}
