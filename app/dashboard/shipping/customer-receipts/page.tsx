import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { CustomerReceiptsManagementView } from "@/features/shipping/components/customer-receipts-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer Receipts — Shipping / Clearing" };

export default async function CustomerReceiptsPage() {
  const session = await requireErpSession();
  const lang = (session?.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <CustomerReceiptsManagementView lang={lang} />
      </div>
    </div>
  );
}
