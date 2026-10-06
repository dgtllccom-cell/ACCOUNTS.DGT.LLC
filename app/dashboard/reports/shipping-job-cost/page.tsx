import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ShippingJobCostView } from "@/features/shipping/components/shipping-job-cost-view";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shipping Job Cost & Claims" };

export default async function ShippingJobCostPage() {
  const session = await requireErpSession();
  const lang = (session?.preferredLanguage ?? "en") as SupportedLanguage;
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <ShippingJobCostView lang={lang} />
      </div>
    </div>
  );
}
