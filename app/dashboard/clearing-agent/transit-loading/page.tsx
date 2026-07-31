import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { TransitLoadingManagementView } from "@/features/clearing-agent/components/transit-loading-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Transit Loading — Clearing Agent",
  description: "Record transit truck loadings with route, border, container, seal and destination.",
};

export default async function TransitLoadingPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <TransitLoadingManagementView lang={lang} />
      </div>
    </div>
  );
}
