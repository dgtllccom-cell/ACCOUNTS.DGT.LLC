"use client";

/**
 * "Scan / Upload" + "Continue saved draft" for REGISTER screens (a list whose create form opens
 * inside the page), where the full-page Entry Method Selector gate would hide the register.
 * Picking a reviewed draft stashes it exactly like the selector does (DRAFT_PREFILL_KEY) and calls
 * onPicked() so the register opens its own create form, which reads it via useIntakeDraft().
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FileClock, Loader2, ScanLine } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { DRAFT_PREFILL_KEY, type EntryDraft } from "@/features/document-intelligence/components/entry-method-selector";

export function IntakeDraftPicker({
  targetModule,
  domain = "business",
  lang,
  onPicked,
  showScan = true,
}: {
  targetModule: string;
  domain?: "business" | "shipping";
  lang?: string;
  onPicked: () => void;
  showScan?: boolean;
}) {
  const s = useErpScreen("dintake", lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<EntryDraft[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && drafts === null) {
      setLoading(true);
      try {
        const r = await apiGet<{ rows: EntryDraft[] }>(`/api/erp/document-intelligence/drafts?targetModule=${encodeURIComponent(targetModule)}&status=prepared`);
        setDrafts(r.rows ?? []);
      } catch {
        setDrafts([]);
      } finally {
        setLoading(false);
      }
    }
  }

  function pick(d: EntryDraft) {
    try {
      sessionStorage.setItem(
        DRAFT_PREFILL_KEY,
        JSON.stringify({ targetModule, draftId: d.id, draftNo: d.draft_no, payload: d.draft_payload, goodsEntries: d.line_items, linkMode: d.link_mode, linkedSourceId: d.linked_source_id })
      );
    } catch {
      /* storage blocked — the form simply opens empty */
    }
    setOpen(false);
    onPicked();
  }

  return (
    <div dir={s.dir} className="relative inline-flex items-center gap-2">
      {showScan && (
        <button
          type="button"
          data-testid="intake-scan"
          onClick={() => router.push(`/dashboard/document-intelligence?domain=${domain}&module=${targetModule}` as Route)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-300 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
        >
          <ScanLine className="h-4 w-4" /> {s.t("em_scan", "Scan / Upload Document")}
        </button>
      )}
      <button
        type="button"
        data-testid="intake-drafts"
        onClick={() => void toggle()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <FileClock className="h-4 w-4" /> {s.t("em_continue", "Continue Saved Draft")}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-10 z-50 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {loading ? (
              <div className="flex items-center gap-2 p-3 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : !drafts?.length ? (
              <div className="p-3 text-xs text-slate-500">{s.t("em_no_drafts", "No prepared drafts for this screen yet.")}</div>
            ) : (
              drafts.map((d) => (
                <button key={d.id} type="button" data-testid="intake-draft-option" onClick={() => pick(d)} className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-start hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="font-mono text-xs font-bold">{d.draft_no}</span>
                  <span className="text-[11px] text-slate-500">{[d.job_no, d.country_name, d.currency].filter(Boolean).join(" · ")}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Server-page friendly bar: after a draft is picked the page reloads so the form (which reads the
 *  stashed draft on mount via useIntakeDraft) opens pre-filled. */
export function IntakeDraftPickerBar({ targetModule, domain = "business", lang }: { targetModule: string; domain?: "business" | "shipping"; lang?: string }) {
  return (
    <div className="flex justify-end">
      <IntakeDraftPicker targetModule={targetModule} domain={domain} lang={lang} onPicked={() => window.location.reload()} />
    </div>
  );
}
