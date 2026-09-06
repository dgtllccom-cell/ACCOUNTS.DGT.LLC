"use client";

import { useState } from "react";
import { Sparkles, Check, X, AlertTriangle, Pencil } from "lucide-react";
import { ErpVoiceInputButton, type VoiceTranscriptionResult } from "@/components/erp-voice-input-button";
import { VoiceContextInterpreter, type VoiceContext, type VoiceInterpretationResult } from "@/lib/services/voice-context-interpreter";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "rounded-2xl border border-blue-900/40 bg-gradient-to-r from-[#071329] via-[#0b1d3d] to-[#071329] p-3.5 text-white shadow-md",
        compact ? "text-xs" : "text-sm"
      )}
      dir={s.dir}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div>
            <span className="font-black text-xs tracking-wide text-white flex items-center gap-1.5">
              <span>{s.t("speak_to_fill", "AI Voice Form Assistant")}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-[9px] font-black text-cyan-300">
                <span className="h-1 w-1 rounded-full bg-cyan-400 animate-pulse" />
                MIC READY
              </span>
            </span>
            <p className="text-[10px] text-slate-400">
              Speak amounts, parties, accounts, and references in 5 languages
            </p>
          </div>
        </div>

        <ErpVoiceInputButton context={context} onTranscribed={handleTranscribed} onError={setError} lang={langProp} />
      </div>

      {error && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-rose-400 font-semibold bg-rose-950/30 border border-rose-900/50 px-3 py-1.5 rounded-lg">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-2.5 pt-2 border-t border-blue-900/40">
          {/* original transcript — preserved verbatim */}
          <div className="rounded-xl bg-[#070f21] border border-blue-900/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {s.t("original_transcript", "Original transcript")} ·
              <span className="ml-1 rounded bg-blue-950 border border-blue-800/40 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 uppercase">{s.lang}</span>
            </p>
            <p className="mt-1 text-xs text-slate-100 font-medium">{result.originalTranscript}</p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="font-bold text-slate-300">{s.t("understood_as", "Understood as")}:</span>
            <span className="rounded-md bg-cyan-500/10 border border-cyan-400/20 px-2 py-0.5 font-mono text-[10px] font-black text-cyan-300">
              {result.interpretedAction}
            </span>
            <span>· {s.t("confidence", "Confidence")} {(result.confidence * 100).toFixed(0)}%</span>
          </div>

          {/* proposed fields — editable */}
          {Object.keys(edited).length > 0 ? (
            <div className="space-y-1.5 rounded-xl bg-[#070f21] border border-blue-900/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Pencil className="h-3 w-3 text-cyan-400" /> {s.t("proposed_fields", "Proposed values — correct before applying")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {Object.entries(edited).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2 bg-[#0a152e] px-2.5 py-1.5 rounded-lg border border-blue-800/30">
                    <span className="w-24 shrink-0 text-[10px] font-bold text-slate-400 uppercase">{label(k)}</span>
                    <input
                      value={v}
                      onChange={(e) => setEdited((prev) => ({ ...prev, [k]: e.target.value }))}
                      className="flex-1 rounded border border-blue-700/40 bg-[#050b17] px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-amber-400">
              {s.t("nothing_extracted", "Nothing could be mapped to a field — please type the details into the form directly.")}
            </p>
          )}

          {result.warnings.length > 0 && (
            <ul className="space-y-0.5 rounded-lg bg-amber-950/30 border border-amber-900/50 p-2 text-[11px] text-amber-300">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />{w}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setResult(null); setEdited({}); }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              <span>{s.t("discard", "Discard")}</span>
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={Object.keys(edited).length === 0}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-xs font-black text-white shadow-md shadow-blue-600/20 disabled:opacity-40 transition flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{s.t("apply_to_form", "Apply to form")}</span>
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
