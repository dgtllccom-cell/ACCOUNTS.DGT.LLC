import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ProductBrandsManagementView } from "@/features/settings/components/product-brands-management";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Product Brands — Master Forms",
  description: "Create and manage product brands with five-language support.",
};

export default async function ProductBrandsSettingsPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl">
        <ProductBrandsManagementView lang={lang} />
      </div>
    </div>
  );
}
