"use client";

import { useCallback, useState } from "react";
import { VoiceContextInterpreter, type VoiceContext, type VoiceInterpretationResult } from "@/lib/services/voice-context-interpreter";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Hook for integrating voice input into any ERP form.
 *
 * Usage:
 * const voice = useErpVoiceInput("purchase", (fields) => {
 *   setFormValues(fields);
 * });
 *
 * Then render: <voice.Button />
 */

export function useErpVoiceInput(
  context: VoiceContext,
  onInterpretedFields: (fields: Record<string, any>, interpretation: VoiceInterpretationResult) => void,
  lang?: SupportedLanguage,
) {
  const s = useErpScreen("voice", lang);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVoiceTranscribed = useCallback(
    async (result: {
      transcript: string;
      language: SupportedLanguage;
      confidence: number;
      durationSeconds: number;
    }) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Interpret the voice input based on form context
        const interpretation = VoiceContextInterpreter.interpret(result.transcript, context, result.language);

        // Check confidence - warn if too low
        if (interpretation.confidence < 0.6) {
          setError(
            s.t("voice.low_confidence", "Low confidence in interpretation. Please review the extracted fields."),
          );
        }

        // Pass extracted fields to form
        onInterpretedFields(interpretation.extractedFields, interpretation);

        // Show warnings
        if (interpretation.warnings.length > 0) {
          console.warn("Voice interpretation warnings:", interpretation.warnings);
        }
      } catch (e) {
        setError(s.t("voice.interpretation_error", "Could not interpret voice input. Please try again."));
        console.error("Voice interpretation error:", e);
      } finally {
        setIsProcessing(false);
      }
    },
    [context, lang, onInterpretedFields, s],
  );

  return {
    isProcessing,
    error,
    handleVoiceTranscribed,
  };
}
