import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { CustomerStatementView } from "@/features/shipping/components/customer-statement-view";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Combined Customer Statement" };

export default async function CustomerStatementPage() {
  const session = await requireErpSession();
  const lang = (session?.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <CustomerStatementView lang={lang} />
      </div>
    </div>
  );
}
