"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ErpVoiceInputButton, type VoiceTranscriptionResult } from "@/components/erp-voice-input-button";
import type { VoiceContext } from "@/lib/services/voice-context-interpreter";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

/**
 * VoiceDictateButton — lightweight "dictate into one plain field" control.
 *
 * Unlike VoiceFormFill (which interprets speech into several structured fields),
 * this is for a single remarks/notes/narration/description textarea or input:
 * it appends the verbatim transcript (native script, no translation — see
 * SPEECH_LANG_MAP in erp-voice-input-button.tsx) to the field's current value.
 *
 * It never submits anything — the caller's onChange just updates local form
 * state exactly like typing would, so the user still reviews/edits and the
 * existing Save button/validation is unchanged.
 */
export function VoiceDictateButton({
  context,
  lang: langProp,
  value,
  onChange,
  className = "",
  disabled = false,
}: {
  context: VoiceContext;
  lang?: SupportedLanguage;
  value: string | null | undefined;
  onChange: (next: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const s = useErpScreen("voice", langProp);
  const [error, setError] = useState<string | null>(null);

  const handleTranscribed = (r: VoiceTranscriptionResult) => {
    setError(null);
    const current = (value ?? "").trim();
    onChange(current ? `${current} ${r.transcript}` : r.transcript);
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <ErpVoiceInputButton
        context={context}
        lang={langProp}
        disabled={disabled}
        onError={setError}
        onTranscribed={handleTranscribed}
        className={className || "h-7 px-2 text-[11px]"}
      />
      {error && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500" role="alert">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
    </span>
  );
}
