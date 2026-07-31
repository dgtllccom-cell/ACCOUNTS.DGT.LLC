import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ImportLoadingManagementView } from "@/features/clearing-agent/components/import-loading-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Import Loading — Clearing Agent",
  description: "Record import truck loadings with customs, border and clearing-agent details.",
};

export default async function ImportLoadingPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <ImportLoadingManagementView lang={lang} />
      </div>
    </div>
  );
}
