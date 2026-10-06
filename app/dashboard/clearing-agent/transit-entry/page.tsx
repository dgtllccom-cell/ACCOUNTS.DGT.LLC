import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { TransitEntryManagementView } from "@/features/clearing-agent/components/transit-entry-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Transit Entry & Public Report — Clearing Agent",
  description: "Create and manage Transit Entries and Public Check Reports for customs and border clearances.",
};

export default async function TransitEntryPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;

  return (
    <div className="w-full">
      <TransitEntryManagementView lang={lang} />
    </div>
  );
}
