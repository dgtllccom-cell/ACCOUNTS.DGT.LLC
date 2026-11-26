"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Calculator, X } from "lucide-react";

/** Shared entry shell. The caller owns all validation and posting. */
export function RoznamchaEntryDialog({ title, description, closeLabel, onClose, children, busy }: {
  title: string;
  description: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-5 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={busy ? undefined : onClose}>
      <div id="new-roznamcha-entry-card" role="dialog" aria-modal="true" aria-labelledby="roznamcha-entry-title"
        className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-all my-auto"
        onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 shrink-0">
              <Calculator className="h-4 w-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 id="roznamcha-entry-title" className="text-base font-black text-slate-900 dark:text-white tracking-tight">{title}</h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{description}</p>
            </div>
          </div>
          <button type="button" disabled={busy} onClick={onClose} aria-label={closeLabel} title={closeLabel}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50">
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
