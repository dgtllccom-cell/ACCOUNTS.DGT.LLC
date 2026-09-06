"use client";

import { useState } from "react";
import { Sparkles, Check, X, AlertTriangle, Pencil } from "lucide-react";
import { ErpVoiceInputButton, type VoiceTranscriptionResult } from "@/components/erp-voice-input-button";
import { VoiceContextInterpreter, type VoiceContext, type VoiceInterpretationResult } from "@/lib/services/voice-context-interpreter";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * VoiceFormFill — the shared, reusable "speak to fill this form" control.
 *
 *   speak → transcript (verbatim, original language preserved)
 *        → interpret for THIS form's context
 *        → show: original transcript · what was understood · proposed fields (EDITABLE) · warnings
 *        → user corrects → "Apply to form"  → onApply(fields)
 *
 * It NEVER submits. The parent form maps the fields into its own state, the user
 * reviews the real form, and the form's own validation + save posts the record
 * through the existing ERP workflow. AI never posts.
 */
export function VoiceFormFill({
  context,
  onApply,
  fieldLabels,
  lang: langProp,
  compact = false,
}: {
  context: VoiceContext;
  onApply: (fields: Record<string, string | number | null>, interpretation: VoiceInterpretationResult) => void;
  /** optional friendly labels: { supplierName: "Supplier", ... } */
  fieldLabels?: Record<string, string>;
  lang?: SupportedLanguage;
  compact?: boolean;
}) {
  const s = useErpScreen("voice", langProp);
  const [result, setResult] = useState<VoiceInterpretationResult | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleTranscribed = (r: VoiceTranscriptionResult) => {
    setError(null);
    try {
      const interp = VoiceContextInterpreter.interpret(r.transcript, context, r.language);
      setResult(interp);
      const seed: Record<string, string> = {};
      for (const [k, v] of Object.entries(interp.extractedFields)) {
        if (k === "rawTranscript") continue;
        seed[k] = v == null ? "" : String(v);
      }
      setEdited(seed);
    } catch {
      setError(s.t("interpret_failed", "Could not interpret the voice input. Please try again or type the details."));
    }
  };

  const apply = () => {
    if (!result) return;
    const out: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(edited)) {
      if (v === "") { out[k] = null; continue; }
      out[k] = /amount|total|rate|qty|quantity|price/i.test(k) && !Number.isNaN(Number(v)) ? Number(v) : v;
    }
    onApply(out, result);
    setResult(null);
    setEdited({});
  };

  const label = (k: string) => fieldLabels?.[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

  return (
    <div className={`rounded-xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-900 dark:bg-violet-950/20 ${compact ? "text-xs" : "text-sm"}`} dir={s.dir}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-violet-800 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5" />
          {s.t("speak_to_fill", "Speak to fill this form")}
        </span>
        <ErpVoiceInputButton context={context} onTranscribed={handleTranscribed} onError={setError} lang={langProp} />
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          {/* original transcript — preserved verbatim */}
          <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {s.t("original_transcript", "Original transcript")} · {result.originalTranscript ? "" : ""}
              <span className="ml-1 rounded bg-slate-100 px-1 dark:bg-slate-800">{s.lang}</span>
            </p>
            <p className="mt-0.5 text-slate-700 dark:text-slate-200">{result.originalTranscript}</p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{s.t("understood_as", "Understood as")}:</span>
            <span className="rounded bg-violet-100 px-1.5 py-0.5 font-mono text-violet-800 dark:bg-violet-900 dark:text-violet-200">
              {result.interpretedAction}
            </span>
            <span>· {s.t("confidence", "Confidence")} {(result.confidence * 100).toFixed(0)}%</span>
          </div>

          {/* proposed fields — editable */}
          {Object.keys(edited).length > 0 ? (
            <div className="space-y-1.5 rounded-lg bg-white p-2 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                <Pencil className="h-3 w-3" /> {s.t("proposed_fields", "Proposed values — correct before applying")}
              </p>
              {Object.entries(edited).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-[11px] font-semibold text-slate-500">{label(k)}</span>
                  <input
                    value={v}
                    onChange={(e) => setEdited((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              {s.t("nothing_extracted", "Nothing could be mapped to a field — please type the details into the form directly.")}
            </p>
          )}

          {result.warnings.length > 0 && (
            <ul className="space-y-0.5 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />{w}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={Object.keys(edited).length === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" /> {s.t("apply_to_form", "Apply to form")}
            </button>
            <button
              type="button"
              onClick={() => { setResult(null); setEdited({}); }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              <X className="h-3.5 w-3.5" /> {s.t("discard", "Discard")}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            {s.t("voice_safety_note", "Applying only fills the form. You still review every field and press Save — nothing posts until you confirm.")}
          </p>
        </div>
      )}
    </div>
  );
}
