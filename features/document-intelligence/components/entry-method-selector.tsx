"use client";

/**
 * Reusable "Select Entry Method" gate for every data-entry screen that supports
 * scan-assisted intake (New Purchase Booking, New Sales Booking, Purchase
 * Loading, Shipping / BL Entry, Clearing Document Entry, Contract Control,
 * KYC / QVC, Cash / Bank Roznamcha).
 *
 *   Manual Entry            — always available; renders {children} unchanged
 *   Scan / Upload Document  — opens the AI Document Intake Center
 *   Continue Saved Draft    — lists reviewed drafts prepared for this module;
 *                             picking one stashes it for the form to pre-fill
 *   Cancel                  — router.back()
 *
 * Both paths end in the SAME form → validation → approval → database → audit
 * workflow. The AI never posts; a saved draft is only a pre-fill.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, ScanLine, FileClock, X, Loader2, ChevronRight, Sparkles, ShieldCheck, ArrowRight, Zap } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";

export type EntryDraft = Record<string, any>;

/** sessionStorage key a form reads on mount to pre-fill from a chosen draft. */
export const DRAFT_PREFILL_KEY = "di_draft_prefill";

export function readDraftPrefill(targetModule: string): EntryDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFILL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.targetModule !== targetModule) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraftPrefill() {
  try { sessionStorage.removeItem(DRAFT_PREFILL_KEY); } catch { /* ignore */ }
}

export function EntryMethodSelector({
  targetModule,
  domain,
  lang,
  title,
  children,
  onDraftChosen,
  onScanClick,
  skipGate = false,
}: {
  targetModule: string;
  domain: "business" | "shipping";
  lang?: string;
  title?: string;
  children: ReactNode;
  onDraftChosen?: (draft: EntryDraft) => void;
  /** Override the "Scan / Upload Document" card — e.g. account_master shows an
   *  in-page multi-account bulk importer instead of the single-doc intake center. */
  onScanClick?: () => void;
  /** Render the form directly, no method gate (e.g. editing an existing record). */
  skipGate?: boolean;
}) {
  const s = useErpScreen("dintake", lang);
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "manual" | "drafts">(skipGate ? "manual" : "choose");
  const [drafts, setDrafts] = useState<EntryDraft[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiGet<{ rows: EntryDraft[] }>(`/api/erp/document-intelligence/drafts?targetModule=${encodeURIComponent(targetModule)}&status=prepared`);
      setDrafts(r.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [targetModule]);

  useEffect(() => {
    // Skip the gate entirely if a draft was already chosen for this module.
    if (readDraftPrefill(targetModule)) setMode("manual");
  }, [targetModule]);

  if (mode === "manual") return <>{children}</>;

  if (mode === "drafts") {
    return (
      <section dir={s.dir} className="relative mx-auto flex min-h-[75vh] w-full max-w-4xl flex-col justify-center px-4 py-8 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl dark:border-slate-800/90 dark:bg-slate-900/95 sm:p-10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            ← {s.t("cancel", "Back to Selection")}
          </button>

          <div className="mb-6">
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {s.t("em_draft", "Continue Saved Draft")}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {s.t("em_draft_desc", "A reviewed draft prepared by the Document Intake Center. It pre-fills this form — you still complete, validate and post it.")}
            </p>
          </div>

          {error ? (
            <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
              {error}
            </p>
          ) : null}

          <div className="mt-4 space-y-2.5">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" />
                <p className="mt-2 text-xs font-medium text-slate-400">Loading saved drafts...</p>
              </div>
            ) : (drafts ?? []).length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                <FileClock className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {s.t("em_no_drafts", "No saved drafts found for this screen.")}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Use "Scan / Upload Document" to create automated drafts from files.
                </p>
              </div>
            ) : (
              (drafts ?? []).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.setItem(
                        DRAFT_PREFILL_KEY,
                        JSON.stringify({
                          targetModule,
                          draftId: d.id,
                          draftNo: d.draft_no,
                          payload: d.draft_payload,
                          goodsEntries: d.line_items,
                          linkMode: d.link_mode,
                          linkedSourceId: d.linked_source_id,
                        })
                      );
                    } catch {
                      /* ignore */
                    }
                    onDraftChosen?.(d);
                    setMode("manual");
                  }}
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 text-start transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-indigo-500/60 dark:hover:bg-slate-800/80"
                >
                  <div className="space-y-1">
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {d.draft_no} · {d.job_no}
                    </span>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {[d.country_name, d.city_branch_name || d.country_branch_name].filter(Boolean).join(" / ")}
                      {d.currency ? ` · ${d.currency}` : ""}
                      {d.original_filename ? ` · ${d.original_filename}` : ""}
                    </span>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-slate-800 dark:group-hover:bg-indigo-950/60 dark:group-hover:text-indigo-300">
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section dir={s.dir} className="relative mx-auto flex min-h-[75vh] w-full max-w-5xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-16 left-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl filter dark:bg-blue-600/15" />
        <div className="absolute -bottom-16 right-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl filter dark:bg-emerald-600/15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl filter dark:bg-indigo-600/10" />
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl transition-all dark:border-slate-800/90 dark:bg-slate-900/95 sm:p-10">
        {/* Accent top gradient stripe */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-600" />

        {/* Header section */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 mb-3 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
              <span>{s.t("em_badge", "Enterprise Intake Gateway")}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {title || s.t("em_title", "Select Entry Method")}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {s.t("em_subtitle", "Choose your preferred workflow to initiate this record. All routes guarantee complete validation, audit tracking, and role-based authorization.")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            aria-label={s.t("cancel", "Cancel")}
            className="self-start rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 3 Interactive Cards */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* Card 1: Manual Entry */}
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="group relative flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-6 text-start shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-900 dark:hover:border-emerald-500/70"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 transition-transform duration-300 group-hover:scale-110">
                  <FilePlus2 className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                  {s.t("em_manual_badge", "Instant Form")}
                </span>
              </div>
              
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {s.t("em_manual", "Manual Entry")}
              </h3>
              
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {s.t("em_manual_desc", "Fill the standard interactive form directly with real-time field validation, smart autosave, and multi-currency support.")}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {s.t("em_start_manual", "Open Form")}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950/60 dark:text-emerald-300 dark:group-hover:bg-emerald-500">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </button>

          {/* Card 2: AI Document Intake / Scan */}
          <button
            type="button"
            onClick={() => onScanClick ? onScanClick() : router.push(`/dashboard/document-intelligence?domain=${domain}&module=${encodeURIComponent(targetModule)}`)}
            className="group relative flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-6 text-start shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-900 dark:hover:border-blue-500/70"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transition-transform duration-300 group-hover:scale-110">
                  <ScanLine className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  {s.t("em_ai_badge", "AI Powered")}
                </span>
              </div>
              
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {s.t("em_scan", "Scan / Upload Document")}
              </h3>
              
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {s.t("em_scan_desc", "Upload PDF invoices, registration forms or ledger files. Local OCR & AI extract and map all fields automatically.")}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {s.t("em_start_scan", "Scan & Extract")}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:group-hover:bg-blue-500">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </button>

          {/* Card 3: Continue Saved Draft */}
          <button
            type="button"
            onClick={() => { setMode("drafts"); void loadDrafts(); }}
            className="group relative flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-6 text-start shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-900 dark:hover:border-indigo-500/70"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 transition-transform duration-300 group-hover:scale-110">
                  <FileClock className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                  {s.t("em_draft_badge", "Queue")}
                </span>
              </div>
              
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {s.t("em_draft", "Continue Saved Draft")}
              </h3>
              
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {s.t("em_draft_desc", "Resume a staged draft previously extracted by the Document Intake Center. Review, adjust and approve with one click.")}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {s.t("em_start_draft", "Browse Drafts")}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/60 dark:text-indigo-300 dark:group-hover:bg-indigo-500">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </button>
        </div>

        {/* Footer info bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>{s.t("em_security_note", "Role-based verification and automated audit trails are active on all entry methods.")}</span>
          </div>
          
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ← {s.t("em_cancel_footer", "Cancel and go back")}
          </button>
        </div>
      </div>
    </section>
  );
}
