import { SimpleModal } from "@/components/ui/simple-modal";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";

export type PersonDuplicateCandidate = {
  id: string;
  personCode?: string | null;
  name: string;
  fatherName?: string | null;
  mobile?: string | null;
  email?: string | null;
};

export function PersonDuplicateWarningModal({
  lang,
  searchedName,
  candidates,
  onUseExisting,
  onCreateAnyway,
  onCancel
}: {
  lang: SupportedLanguage;
  searchedName: string;
  candidates: PersonDuplicateCandidate[];
  onUseExisting: (personId: string) => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <SimpleModal
      title={t(lang, "erp.person_dup_title", "Possible Duplicate Person")}
      onClose={onCancel}
      className="w-[96vw] max-w-xl rounded-3xl font-sans shadow-2xl"
    >
      <div className="p-5 space-y-4 text-xs text-slate-800 dark:text-slate-200">
        <p className="text-slate-600 dark:text-slate-300">
          {t(lang, "erp.person_dup_desc", "We found existing person record(s) that may match")}{" "}
          <strong className="text-slate-900 dark:text-white">"{searchedName}"</strong>.{" "}
          {t(lang, "erp.person_dup_desc2", "Use the existing Person ID instead of creating a duplicate, or continue if this is genuinely a different person.")}
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-3"
            >
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-white truncate">
                  {transliterateProperNoun(c.name, lang)}
                  {c.personCode ? (
                    <span className="ms-2 font-mono text-[10px] font-black text-amber-700 dark:text-amber-400">{c.personCode}</span>
                  ) : null}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 mt-0.5">
                  {c.fatherName ? <span>{t(lang, "erp.person_dup_father", "Father")}: {transliterateProperNoun(c.fatherName, lang)}</span> : null}
                  {c.mobile ? <span dir="ltr">{t(lang, "erp.person_dup_mobile", "Mobile")}: {c.mobile}</span> : null}
                  {c.email ? <span dir="ltr">{t(lang, "erp.person_dup_email", "Email")}: {c.email}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUseExisting(c.id)}
                className="shrink-0 px-3 py-2 text-[11px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
              >
                {t(lang, "erp.person_dup_use_existing", "Use This Person")}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
          >
            {t(lang, "common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onCreateAnyway}
            className="px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-xl transition"
          >
            {t(lang, "erp.person_dup_create_new", "Create New Anyway")}
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}
