import { requireErpSession } from "@/lib/auth/session";
import { CrossStuffingManagement } from "@/features/clearing-agent/components/cross-stuffing-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export async function generateMetadata() {
  const lang = await getRequestLanguage();
  return {
    title: `${t(lang, "cs.title", "Cross-Stuffing")} — Clearing Agent`,
    description: t(lang, "cs.subtitle", "Record goods transferred from trucks into a container at a warehouse"),
  };
}

export default async function CrossStuffingPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <CrossStuffingManagement lang={lang} />
      </div>
    </div>
  );
}
