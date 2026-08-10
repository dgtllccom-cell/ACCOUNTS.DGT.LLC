import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { CashEntryForm } from "@/features/roznamcha/components/cash-entry-form";
import { RoznamchaReportsDropdown } from "@/features/roznamcha/components/roznamcha-reports-dropdown";

export default async function CashEntryPage() {
  const lang = await getRequestLanguage();

  return (
    <div className="w-full px-2 py-4">
      <div className="mb-3 flex items-center justify-between">
        <RoznamchaReportsDropdown lang={lang} />
      </div>
      <CashEntryForm
        lang={lang}
        pageTitle={t(lang, "nav.cash_entry")}
        scopeMode="auto"
      />
    </div>
  );
}
