import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ShippingAgentEntryView } from "@/features/shipping/components/shipping-agent-entry-view";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping Agent Entry — Shipping Line",
  description: "Register and manage shipping line agents and port representatives.",
};

export default async function ShippingAgentEntryPage() {
  const session = await requireErpSession();
  const lang = (session?.preferredLanguage ?? "en") as SupportedLanguage;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <ShippingAgentEntryView lang={lang} />
      </div>
    </div>
  );
}
