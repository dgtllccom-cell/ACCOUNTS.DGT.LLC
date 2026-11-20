"use client";

/**
 * Posting Details — shown at the side of the screen after "Transfer / Post to Roznamcha":
 *   posted  → Roznamcha serial, date / time, posted by, the Debit account and the Credit account with their amounts
 *             (base currency and the bill's own currency with its ÷ / × rate), balanced ✓;
 *   stopped → the reason in plain figures, and the planned Debit / Credit marked "not posted".
 * Data: the `posting` summary the transfer API returns (lib/purchases/posting-summary.ts). Account names, codes and
 * amounts are business data and are not translated.
 */
import React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { PostingSide, PostingSummary } from "@/lib/purchases/posting-summary";

const RTL = new Set(["ur", "ar", "fa", "ps"]);
const money = (v: number) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PostingDetailsPanel({
  posting,
  error,
  onClose,
  action,
}: {
  posting?: PostingSummary | null;
  /** error message when the API returned no posting summary */
  error?: string | null;
  onClose: () => void;
  /** e.g. "Proceed to Loading" */
  action?: React.ReactNode;
}) {
  const lang = useActiveLanguage();
  const tt = (k: string, fb: string) => t(lang, `pterv2.pd_${k}`, fb);
  if (!posting && !error) return null;
  const posted = posting?.status === "posted";
  const reason = posting?.reason || error || "";
  const sign = posting?.op === "/" ? "÷" : "×";

  const Side = ({ kind, s }: { kind: "debit" | "credit"; s: PostingSide }) => (
    <div className={`rounded-lg border p-2.5 ${kind === "debit" ? "border-sky-200 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30" : "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-black uppercase tracking-wider ${kind === "debit" ? "text-sky-700 dark:text-sky-300" : "text-amber-700 dark:text-amber-300"}`}>
          {kind === "debit" ? tt("debit", "Debit (Dr)") : tt("credit", "Credit (Cr)")}
        </span>
        {!posted && <span className="text-[10px] font-bold text-rose-600">{tt("not_posted", "Not posted")}</span>}
      </div>
      <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100 break-words" dir="ltr">
        {s.code ? <span className="font-mono">{s.code}</span> : null} {s.name}
      </div>
      <div className="mt-1 text-sm font-black text-slate-900 dark:text-white font-mono" dir="ltr">
        {money(s.amount)} {posting?.baseCurrency}
      </div>
      {s.originalAmount > 0 && posting && posting.rate > 0 && (
        <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
          {money(s.originalAmount)} {s.currency} {sign} {posting.rate}
        </div>
      )}
    </div>
  );

  const panel = (
    <aside
      role="status"
      aria-live="polite"
      data-testid="posting-details-panel"
      dir={RTL.has(String(lang)) ? "rtl" : "ltr"}
      className="fixed z-[260] inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-auto sm:top-20 sm:end-4 sm:w-80 max-h-[80vh] overflow-y-auto rounded-2xl border bg-white shadow-2xl dark:bg-slate-900 print:hidden
        border-slate-200 dark:border-slate-700"
    >
      <div className={`flex items-start justify-between gap-2 rounded-t-2xl px-3 py-2.5 ${posted ? "bg-emerald-600" : "bg-rose-600"} text-white`}>
        <div className="flex items-center gap-2 min-w-0">
          {posted ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider">{tt("title", "Posting Details")}</div>
            <div className="text-[11px] font-semibold opacity-90">{posted ? tt("posted", "Posted to Business Roznamcha") : tt("stopped", "Transfer stopped — nothing was posted")}</div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={t(lang, "common.close", "Close")} className="rounded p-0.5 hover:bg-white/20">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 p-3">
        {posted && posting && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-slate-500">{tt("serial", "Roznamcha No.")}</dt>
            <dd className="font-mono font-bold text-slate-800 dark:text-slate-100 break-all" dir="ltr">{posting.roznamchaSerialNo || "—"}</dd>
            <dt className="text-slate-500">{tt("date", "Date / time")}</dt>
            <dd className="font-mono text-slate-800 dark:text-slate-100" dir="ltr">{posting.postedAt ? new Date(posting.postedAt).toLocaleString() : posting.entryDate || "—"}</dd>
            <dt className="text-slate-500">{tt("posted_by", "Posted by")}</dt>
            <dd className="font-bold text-slate-800 dark:text-slate-100 break-words" dir="ltr">{posting.postedBy?.name || "—"}</dd>
          </dl>
        )}

        {!posted && reason && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 break-words" data-testid="posting-details-reason">
            {reason}
          </p>
        )}

        {posting && (
          <>
            <Side kind="debit" s={posting.debit} />
            <Side kind="credit" s={posting.credit} />
            {posted && (
              <div className={`text-[11px] font-bold ${posting.balanced ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}`}>
                {posting.balanced ? `✓ ${tt("balanced", "Debit = Credit (balanced)")}` : tt("unbalanced", "Debit and Credit differ")}
              </div>
            )}
          </>
        )}

        {action}
      </div>
    </aside>
  );
  // portal: a parent with backdrop-filter / transform (the sticky toolbars) would otherwise trap the fixed panel
  return typeof document !== "undefined" ? createPortal(panel, document.body) : panel;
}
