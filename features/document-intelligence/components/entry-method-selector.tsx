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
import { FilePlus2, ScanLine, FileClock, X, Loader2, ChevronRight } from "lucide-react";
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
  skipGate = false,
}: {
  targetModule: string;
  domain: "business" | "shipping";
  lang?: string;
  title?: string;
  children: ReactNode;
  onDraftChosen?: (draft: EntryDraft) => void;
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
      <section dir={s.dir} className="mx-auto max-w-3xl p-4 sm:p-6">
        <button type="button" onClick={() => setMode("choose")} className="mb-3 text-xs font-bold text-slate-500 hover:text-slate-700">
          ← {s.t("cancel", "Cancel")}
        </button>
        <h1 className="text-base font-black text-slate-900 dark:text-slate-50">{s.t("em_draft", "Continue Saved Draft")}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{s.t("em_draft_desc", "A reviewed draft prepared by the Document Intake Center. It pre-fills this form — you still complete, validate and post it.")}</p>
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></div>
          ) : (drafts ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400 dark:border-slate-700">{s.t("em_no_drafts", "No saved drafts for this screen.")}</p>
          ) : (
            (drafts ?? []).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  try { sessionStorage.setItem(DRAFT_PREFILL_KEY, JSON.stringify({ targetModule, draftId: d.id, draftNo: d.draft_no, payload: d.draft_payload, goodsEntries: d.line_items, linkMode: d.link_mode, linkedSourceId: d.linked_source_id })); } catch { /* ignore */ }
                  onDraftChosen?.(d);
                  setMode("manual");
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-start hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-700 dark:hover:bg-emerald-950/20"
              >
                <span>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{d.draft_no} · {d.job_no}</span>
                  <span className="block text-[11px] text-slate-500">
                    {[d.country_name, d.city_branch_name || d.country_branch_name].filter(Boolean).join(" / ")}
                    {d.currency ? ` · ${d.currency}` : ""}
                    {d.original_filename ? ` · ${d.original_filename}` : ""}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <section dir={s.dir} className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col justify-center p-4 sm:p-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{title || s.t("em_title", "Select Entry Method")}</h1>
            <p className="mt-1 text-xs text-slate-500">{s.t("em_subtitle", "Choose how you want to start. Both paths end in the same form, validation and approval.")}</p>
          </div>
          <button type="button" onClick={() => router.back()} aria-label={s.t("cancel", "Cancel")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Choice icon={FilePlus2} label={s.t("em_manual", "Manual Entry")} desc={s.t("em_manual_desc", "Fill the form yourself. Always available.")} tone="emerald" onClick={() => setMode("manual")} />
          <Choice icon={ScanLine} label={s.t("em_scan", "Scan / Upload Document")} desc={s.t("em_scan_desc", "Upload a PDF or photo — local OCR extracts the fields for your review.")} tone="blue" onClick={() => router.push(`/dashboard/document-intelligence?domain=${domain}&module=${encodeURIComponent(targetModule)}`)} />
          <Choice icon={FileClock} label={s.t("em_draft", "Continue Saved Draft")} desc={s.t("em_draft_desc", "A reviewed draft prepared by the Document Intake Center pre-fills this form.")} tone="slate" onClick={() => { setMode("drafts"); void loadDrafts(); }} />
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {s.t("em_cancel_footer", "Cancel and go back")}
          </button>
        </div>
      </div>
    </section>
  );
}

function Choice({ icon: Icon, label, desc, tone, onClick }: { icon: any; label: string; desc: string; tone: "emerald" | "blue" | "slate"; onClick: () => void }) {
  const ring =
    tone === "emerald" ? "hover:border-emerald-400 hover:shadow-md focus-visible:border-emerald-500" :
    tone === "blue" ? "hover:border-blue-400 hover:shadow-md focus-visible:border-blue-500" :
    "hover:border-slate-400 hover:shadow-md focus-visible:border-slate-500";
  const iconWrap =
    tone === "emerald" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" :
    tone === "blue" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300" :
    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-start outline-none transition-all dark:border-slate-700 dark:bg-slate-900 ${ring}`}
    >
      <span className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconWrap}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{label}</span>
      <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{desc}</span>
    </button>
  );
}
