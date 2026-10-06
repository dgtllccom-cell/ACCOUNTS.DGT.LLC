import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { canUseBusinessEditInvoice } from "@/lib/business-edit-invoice/access";
import { BusinessEditInvoiceView } from "@/features/business-edit-invoice/components/business-edit-invoice-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata: Metadata = { title: "Business Edit Invoice" };
export const dynamic = "force-dynamic";

export default async function BusinessEditInvoicePage() {
  const session = await requireErpSession();
  const lang = await getRequestLanguage();
  if (!canUseBusinessEditInvoice(session)) {
    return (
      <div className="p-8 text-sm text-slate-500">
        {t(lang, "bei.access_denied", "You do not have access to Business Edit Invoice.")}
      </div>
    );
  }
  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
      <BusinessEditInvoiceView lang={lang} />
    </div>
  );
}
