"use client";

import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { ERP_ACTION_KEYS, type ErpActionKey } from "@/lib/permissions/rbac-matrix-builder";
import {
  EXPENSE_BILL_SECTION_KEY,
  authorityTierLabel,
  rightsActionLabel,
  rightsCategoryName,
  rightsFormName,
  rightsModuleName,
  rightsSectionName,
  type RightsFormRow,
  type UserRightsList,
} from "@/lib/permissions/user-rights-list";

const ACTION_TONE: Record<ErpActionKey, string> = {
  view: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  create: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800",
  edit: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800",
  delete: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800",
  submit_transfer: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800",
  approve: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800",
  print: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800",
  export: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800",
};

/**
 * The COMPLETE rights list of one user, as readable chips and cards (no table, so it never scrolls sideways on a phone).
 * Every granted form is listed with each granted action; nothing is cut off or collapsed behind a scroll box.
 */
export function UserRightsListPanel({ rights, lang }: { rights: UserRightsList; lang: string }) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const L = (key: string, fallback: string) => t(lang, `udr.r.${key}`, fallback);

  const summary: Array<[string, number]> = [
    [L("c_modules", "Modules"), rights.counts.modules],
    [L("c_forms", "Forms"), rights.counts.forms],
    [L("c_actions", "Actions"), rights.counts.actions],
    [L("c_other", "Other rights"), rights.counts.otherTokens],
  ];

  const ActionChips = ({ granted }: { granted: readonly ErpActionKey[] }) => (
    <div className="flex flex-wrap gap-1">
      {ERP_ACTION_KEYS.filter((a) => granted.includes(a)).map((a) => (
        <span key={a} className={`rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${ACTION_TONE[a]}`}>
          {rightsActionLabel(lang, a)}
        </span>
      ))}
    </div>
  );

  const BillRow = ({ form }: { form: RightsFormRow }) => (
    <li className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-xs font-semibold text-slate-900 dark:text-slate-100">{rightsFormName(lang, form.key, form.name)}</span>
        {form.granted.length ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </div>
      <div className="mt-1.5">
        {form.granted.length ? (
          <ActionChips granted={form.granted} />
        ) : (
          <span className="text-[11px] font-semibold text-slate-500">{L("no_access", "No access")}</span>
        )}
      </div>
    </li>
  );

  return (
    <section dir={isRtl ? "rtl" : "ltr"} className="min-w-0 space-y-4" aria-label={L("sec_rights", "Granted module rights (every form)")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {authorityTierLabel(lang, rights.authorityTier)}
        </span>
        {summary.map(([label, value]) => (
          <span key={label} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {label}: <strong className="font-mono">{value}</strong>
          </span>
        ))}
      </div>

      {rights.fullAuthority && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {L("full_authority", "Full authority: every form and action in the ERP is granted to this user.")}
        </div>
      )}

      <div className="space-y-3">
        {rights.modules.length === 0 && (
          <p className="text-xs text-slate-500">{L("no_forms", "No form is granted.")}</p>
        )}
        {rights.modules.map((mod) => {
          const sections = mod.sections.filter((sec) => sec.key !== EXPENSE_BILL_SECTION_KEY);
          if (!sections.length) return null;
          return (
            <div key={mod.key} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 px-3 py-2 text-white dark:bg-slate-800">
                <span className="min-w-0 break-words text-xs font-bold">{rightsModuleName(lang, mod.key, mod.name)}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">{rightsCategoryName(lang, mod.category)}</span>
              </div>
              {sections.map((sec) => (
                <div key={sec.key} className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">{rightsSectionName(lang, sec.key, sec.name)}</div>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {sec.forms.map((form) => (
                      <li key={form.key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="break-words text-xs font-semibold text-slate-900 dark:text-slate-100">{rightsFormName(lang, form.key, form.name)}</div>
                        <div className="mt-1.5">
                          <ActionChips granted={form.granted} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <h4 className="mb-2 text-xs font-bold text-slate-900 dark:text-slate-100">{L("sec_expense", "Expense bill types")}</h4>
        <ul className="grid gap-2 sm:grid-cols-2">
          {rights.expenseBillTypes.map((form) => (
            <BillRow key={form.key} form={form} />
          ))}
        </ul>
      </div>

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <h4 className="mb-2 text-xs font-bold text-slate-900 dark:text-slate-100">{L("sec_other", "Other granted rights")}</h4>
        {rights.otherRights.length ? (
          <ul className="space-y-1.5">
            {rights.otherRights.map((group) => (
              <li key={group.resource} className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 text-xs">
                <span className="break-all font-mono font-bold text-slate-900 dark:text-slate-100">{group.resource}</span>
                <span className="min-w-0 break-all font-mono text-slate-600 dark:text-slate-300">{group.actions.join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">{L("no_other", "No other rights beyond the form matrix.")}</p>
        )}
      </div>

      <div className="min-w-0 rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/20">
        <h4 className="mb-2 text-xs font-bold text-red-900 dark:text-red-200">{L("sec_restricted", "Restricted modules (no access)")}</h4>
        {rights.restrictedModules.length ? (
          <div className="flex flex-wrap gap-1.5">
            {rights.restrictedModules.map((m) => (
              <span key={m.key} className="rounded-md border border-red-200 bg-white px-2 py-0.5 text-[11px] font-medium text-red-800 dark:border-red-800 dark:bg-slate-900 dark:text-red-200">
                {rightsModuleName(lang, m.key, m.name)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-300">{L("none_restricted", "None. Every module has at least one granted form.")}</p>
        )}
      </div>
    </section>
  );
}
