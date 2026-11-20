import { getRequestLanguage } from "@/lib/i18n/server";
import { CashEntryForm } from "@/features/roznamcha/components/cash-entry-form";
import { IntakeDraftPickerBar } from "@/features/document-intelligence/components/intake-draft-picker";
import { t } from "@/lib/i18n/ui";
import { CashEntryStyleScope } from "@/features/roznamcha/components/cash-entry-style-scope";

export const metadata = { title: "Roznamcha — Cash Entry" };

export default async function CashEntryPage() {
  const lang = await getRequestLanguage();

  return (
    <CashEntryStyleScope lang={lang}>
      <CashEntryForm
        lang={lang}
        pageTitle={t(lang, "nav.cash_entry", "Cash & Journal Entry (Roznamcha Bill)")}
        scopeMode="auto"
      />
    </CashEntryStyleScope>
  );
}
