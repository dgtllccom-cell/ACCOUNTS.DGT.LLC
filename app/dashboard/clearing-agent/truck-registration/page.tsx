import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { TruckRegistrationManagementView } from "@/features/clearing-agent/components/truck-registration-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Truck Registration — Clearing Agent",
  description: "Central truck master: registration, owner, driver, insurance and expiry tracking.",
};

export default async function TruckRegistrationPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <TruckRegistrationManagementView lang={lang} />
      </div>
    </div>
  );
}
