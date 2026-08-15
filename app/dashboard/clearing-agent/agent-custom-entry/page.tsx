import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { AgentCustomEntryManagementView } from "@/features/clearing-agent/components/agent-custom-entry-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent Custom Entry — Clearing Agent",
  description: "Record agent custom entry declarations, customs station GDs and duties.",
};

export default async function AgentCustomEntryPage() {
  const session = await requireErpSession();
  const lang = (session?.preferredLanguage ?? "en") as SupportedLanguage;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <AgentCustomEntryManagementView lang={lang} />
      </div>
    </div>
  );
}
