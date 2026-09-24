import { getRequestLanguage } from "@/lib/i18n/server";
import { CashEntryForm } from "@/features/roznamcha/components/cash-entry-form";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Roznamcha — Cash Entry" };

export default async function CashEntryPage() {
  const lang = await getRequestLanguage();

  return (
    <CashEntryForm
      lang={lang}
      pageTitle={t(lang, "nav.cash_entry", "Cash & Journal Entry (Roznamcha Bill)")}
      scopeMode="auto"
    />
  );
}
