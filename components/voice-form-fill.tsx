"use client";

import { useState } from "react";
import { Sparkles, Check, X, AlertTriangle, Pencil, Volume2 } from "lucide-react";
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
 * Upgraded to the ultra-modern Cyber ERP design language.
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
        "relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#070e28] via-[#0c1a45] to-[#11276b] text-white p-3.5 sm:p-4 shadow-xl",
        compact ? "text-xs" : "text-sm"
      )}
      dir={s.dir}
    >
      {/* Background cyber grid accents */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm">
            <Sparkles className="h-4 w-4 animate-pulse text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                {s.t("ai_voice_assistant", "AI Voice Form Fill")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-950/80 px-2 py-0.5 text-[9px] font-bold text-cyan-400 border border-cyan-500/40">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Live Speech
              </span>
            </div>
            <p className="text-[10.5px] text-slate-300 font-medium">
              {s.t("speak_to_fill", "Speak to fill this form")} • <span className="text-slate-400">Urdu / English / Pashto / Arabic / Farsi</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ErpVoiceInputButton
            context={context}
            onTranscribed={handleTranscribed}
            onError={setError}
            lang={langProp}
            className="rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold hover:from-cyan-500 hover:to-blue-500 shadow-md transition"
          />
        </div>
      </div>

      {error && (
        <p className="relative z-10 mt-3 flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="relative z-10 mt-3 space-y-3 pt-2 border-t border-cyan-500/20">
          {/* Original transcript — preserved verbatim */}
          <div className="rounded-xl border border-cyan-500/20 bg-slate-900/80 p-3 backdrop-blur-md">
            <p className="text-[9.5px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Volume2 className="h-3 w-3" />
              {s.t("original_transcript", "Original transcript")}
              <span className="ml-1 rounded bg-cyan-950 px-1.5 py-0.5 text-cyan-300 border border-cyan-800 text-[8.5px] font-mono">{s.lang}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-100">{result.originalTranscript}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-medium">
            <span className="text-slate-400">{s.t("understood_as", "Understood as")}:</span>
            <span className="rounded-md bg-cyan-950 px-2 py-0.5 font-mono font-bold text-cyan-300 border border-cyan-800">
              {result.interpretedAction}
            </span>
            <span className="text-slate-400">•</span>
            <span>{s.t("confidence", "Confidence")} <strong className="text-emerald-400">{(result.confidence * 100).toFixed(0)}%</strong></span>
          </div>

          {/* Proposed fields — editable */}
          {Object.keys(edited).length > 0 ? (
            <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-slate-900/80 p-3.5 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Pencil className="h-3 w-3" /> {s.t("proposed_fields", "Proposed values — correct before applying")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(edited).map(([k, v]) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label(k)}</span>
                    <input
                      value={v}
                      onChange={(e) => setEdited((prev) => ({ ...prev, [k]: e.target.value }))}
                      className="h-8 rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 text-xs font-semibold text-cyan-200 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-amber-300">
              {s.t("nothing_extracted", "Nothing could be mapped to a field — please type the details into the form directly.")}
            </p>
          )}

          {result.warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-950/30 p-2.5 text-[11px] font-medium text-amber-300">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />{w}</li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={apply}
              disabled={Object.keys(edited).length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-black text-white hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 shadow-sm transition"
            >
              <Check className="h-3.5 w-3.5" /> {s.t("apply_to_form", "Apply to form")}
            </button>
            <button
              type="button"
              onClick={() => { setResult(null); setEdited({}); }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
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
