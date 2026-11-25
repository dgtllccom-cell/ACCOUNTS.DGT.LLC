import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { canUseBusinessEditInvoice } from "@/lib/business-edit-invoice/access";
import { BusinessEditInvoiceView } from "@/features/business-edit-invoice/components/business-edit-invoice-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata: Metadata = { title: "Business Edit Invoice" };
export const dynamic = "force-dynamic";

export default async function BusinessEditInvoicePage({ searchParams }: { searchParams: Promise<{ sourceId?: string; module?: string; billNo?: string }> }) {
  const session = await requireErpSession();
  const lang = await getRequestLanguage();
  if (!canUseBusinessEditInvoice(session)) {
    return (
      <div className="p-8 text-sm text-slate-500">
        {t(lang, "bei.access_denied", "You do not have access to Business Edit Invoice.")}
      </div>
    );
  }
  const params = await searchParams;
  const sourceId = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(params.sourceId ?? "") ? params.sourceId : undefined;
  const source = sourceId && (params.module === "sales_booking" || params.module === "local_sales")
    ? { id: sourceId as string, module: params.module, billNo: typeof params.billNo === "string" ? params.billNo.slice(0, 140) : "" } : undefined;
  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
      <BusinessEditInvoiceView lang={lang} salesBill={source} />
    </div>
  );
}
