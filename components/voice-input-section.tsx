"use client";

import { useState } from "react";
import { ErpVoiceInputButton, type VoiceTranscriptionResult } from "@/components/erp-voice-input-button";
import { VoiceContextInterpreter, type VoiceContext, type VoiceInterpretationResult } from "@/lib/services/voice-context-interpreter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";

function Alert({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`flex gap-2 rounded-lg border p-3 text-sm ${className}`}>{children}</div>;
}
function AlertDescription({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

/**
 * Voice Input Section Component
 *
 * Add to any form to enable voice input. Shows:
 * 1. Voice button
 * 2. Transcribed text
 * 3. Interpreted fields with confidence
 * 4. Warnings for fields needing review
 * 5. Actions to apply or clear
 */

export function VoiceInputSection({
  context,
  onApplyFields,
  lang: langProp,
}: {
  context: VoiceContext;
  onApplyFields: (fields: Record<string, any>) => void;
  lang?: SupportedLanguage;
}) {
  const s = useErpScreen("voice", langProp);
  const [transcript, setTranscript] = useState("");
  const [interpretation, setInterpretation] = useState<VoiceInterpretationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTranscribed = (result: VoiceTranscriptionResult) => {
    setTranscript(result.transcript);
    setError(null);

    try {
      const interp = VoiceContextInterpreter.interpret(result.transcript, context, result.language);
      setInterpretation(interp);

      if (interp.confidence < 0.6) {
        setError(s.t("low_confidence", "Low confidence interpretation. Please review extracted fields."));
      }
    } catch (e) {
      setError(s.t("error", "Could not interpret voice input."));
    }
  };

  const handleApply = () => {
    if (interpretation?.extractedFields) {
      onApplyFields(interpretation.extractedFields);
      setTranscript("");
      setInterpretation(null);
    }
  };

  const handleClear = () => {
    setTranscript("");
    setInterpretation(null);
    setError(null);
  };

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          {s.t("section_title", "AI Voice Input")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Voice Button */}
        <div className="flex gap-2">
          <ErpVoiceInputButton context={context} onTranscribed={handleTranscribed} onError={setError} lang={langProp} />
          {transcript && (
            <Button variant="outline" size="sm" onClick={handleClear}>
              {s.t("clear", "Clear")}
            </Button>
          )}
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {s.t("transcript", "Transcript")}
            </p>
            <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{transcript}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {/* Interpretation Results */}
        {interpretation && (
          <>
            {/* Confidence */}
            <div className="flex items-center gap-2 rounded-lg bg-white p-3 dark:bg-slate-900">
              <CheckCircle2
                className={`h-4 w-4 ${interpretation.confidence >= 0.7 ? "text-green-600" : "text-yellow-600"}`}
              />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {s.t("confidence", "Confidence")}
                </p>
                <p className="text-sm text-slate-900 dark:text-slate-100">{(interpretation.confidence * 100).toFixed(0)}%</p>
              </div>
            </div>

            {/* Extracted Fields */}
            {Object.keys(interpretation.extractedFields).length > 0 && (
              <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {s.t("extracted_fields", "Extracted Fields")}
                </p>
                <div className="mt-2 space-y-1">
                  {Object.entries(interpretation.extractedFields).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">{key}:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {interpretation.warnings.length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  <ul className="space-y-1">
                    {interpretation.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Apply Button */}
            <Button onClick={handleApply} className="w-full" variant="default">
              {s.t("apply_fields", "Apply Extracted Fields to Form")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
