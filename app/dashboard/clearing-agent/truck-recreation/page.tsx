import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { TruckRecreationWizard } from "@/features/clearing-agent/components/truck-recreation-wizard";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Loading Order Entry (لوڈنگ آرڈر) — Clearing Agent ERP",
  description: "Create Loading Order (لوڈنگ آرڈر), auto-select cargo owner, receiver, notify party, shipment category, and registered truck details.",
};

export default async function TruckRecreationPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <TruckRecreationWizard lang={lang} />
      </div>
    </div>
  );
}
