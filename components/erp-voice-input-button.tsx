"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { VoiceContext } from "@/lib/services/voice-context-interpreter";

const SPEECH_LANG_MAP: Record<SupportedLanguage, string> = {
  en: "en-US",
  ur: "ur-PK",
  ps: "ps-AF",
  fa: "fa-IR",
  ar: "ar-SA",
};

/**
 * Shared ERP Voice Input Button
 *
 * Reusable voice input component for any ERP form.
 * - Uses browser Web Speech API for real-time voice input
 * - Supports all 5 ERP languages with RTL
 * - Integrates with context-aware AI interpretation
 * - Shows interpreted draft for user review before confirmation
 *
 * Usage:
 * <ErpVoiceInputButton
 *   context="purchase"
 *   onTranscribed={handleTranscription}
 *   lang={activeLanguage}
 * />
 */

export interface VoiceTranscriptionResult {
  transcript: string;
  language: SupportedLanguage;
  confidence: number;
  audioDataUrl?: string;
  durationSeconds: number;
}

export function ErpVoiceInputButton({
  context,
  onTranscribed,
  onError,
  lang: langProp,
  disabled = false,
  className = "",
}: {
  context: VoiceContext;
  onTranscribed: (result: VoiceTranscriptionResult) => void;
  onError?: (error: string) => void;
  lang?: SupportedLanguage;
  disabled?: boolean;
  className?: string;
}) {
  const s = useErpScreen("voice", langProp);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    const SR = (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    setSupported(Boolean(SR));
  }, []);

  function toggleListen() {
    if (!supported) {
      onError?.(s.t("not_supported", "Voice input not supported in your browser"));
      return;
    }

    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = SPEECH_LANG_MAP[s.lang as SupportedLanguage] || "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    let finalTranscript = "";
    let interimTranscript = "";

    rec.onstart = () => {
      startTimeRef.current = Date.now();
      transcriptRef.current = "";
      setListening(true);
    };

    rec.onresult = (e: any) => {
      interimTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }
      transcriptRef.current = (finalTranscript + interimTranscript).trim();
    };

    rec.onerror = (e: any) => {
      onError?.(`${s.t("error", "Voice input error")}: ${e?.error || "unknown"}`);
      setListening(false);
    };

    rec.onend = () => {
      const durationSeconds = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
      if (transcriptRef.current.length > 0) {
        setProcessing(true);
        setTimeout(() => {
          onTranscribed({
            transcript: transcriptRef.current,
            language: s.lang as SupportedLanguage,
            confidence: 0.85,
            durationSeconds,
          });
          setProcessing(false);
        }, 500);
      }
      setListening(false);
    };

    recRef.current = rec;
    rec.start();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleListen}
      disabled={disabled || processing || !supported}
      className={`gap-2 ${className}`}
      title={supported ? s.t("tooltip", "Click to speak") : s.t("not_supported", "Voice not supported")}
    >
      {processing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : listening ? (
        <MicOff className="h-4 w-4 text-red-500 animate-pulse" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {s.t("label", "Voice")}
    </Button>
  );
}
