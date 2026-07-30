import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ProductUnitsManagementView } from "@/features/settings/components/product-units-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Product Units — Master Forms",
  description: "Create and manage product measurement units with five-language support.",
};

export default async function ProductUnitsSettingsPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl">
        <ProductUnitsManagementView lang={lang} />
      </div>
    </div>
  );
}
