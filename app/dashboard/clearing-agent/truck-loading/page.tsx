import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { TruckLoadingManagementView } from "@/features/clearing-agent/components/truck-loading-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Truck Loading — Clearing Agent",
  description: "Record truck loadings; select a registered truck to auto-fill its details.",
};

export default async function TruckLoadingPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <TruckLoadingManagementView lang={lang} />
      </div>
    </div>
  );
}
