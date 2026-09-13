import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { TruckRecreationWizard } from "@/features/clearing-agent/components/truck-recreation-wizard";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Clearing Truck Registration — Clearing Agent ERP",
  description: "Truck master, owner, transporter, driver and reporting — table-first with a live report summary.",
};

export default async function TruckRegistrationPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <TruckRecreationWizard
          lang={lang}
          userName={session.fullName || session.email || null}
          isSuperAdmin={session.isSuperAdmin}
        />
      </div>
    </div>
  );
}
