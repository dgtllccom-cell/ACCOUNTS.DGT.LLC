"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { VoiceContext } from "@/lib/services/voice-context-interpreter";
import { getSpeechRecognitionCtor, resolveVoiceSupport, isIOS } from "@/lib/voice/voice-support";

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
  // "ready" = voice can be attempted in this context (secure + supported browser).
  const [ready, setReady] = useState(false);
  const [blockReason, setBlockReason] = useState<"insecure" | "unsupported" | null>(null);
  const [processing, setProcessing] = useState(false);
  const recRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    const cap = resolveVoiceSupport({ requireSpeechRecognition: true });
    setReady(cap.ok);
    setBlockReason(cap.reason);
  }, []);

  function blockedMessage(reason: "insecure" | "unsupported"): string {
    return reason === "insecure"
      ? s.t(
          "insecure_context",
          "Voice needs a secure (HTTPS) connection. Please open the ERP through the secure https link instead of the http IP address, then try again.",
        )
      : s.t("unsupported", "Voice is not supported in this browser. Please try Chrome, Edge, or Safari.");
  }

  function toggleListen() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }

    // Re-check at click time: the secure-context / API state is authoritative here.
    const cap = resolveVoiceSupport({ requireSpeechRecognition: true });
    if (!cap.ok) {
      setReady(false);
      setBlockReason(cap.reason);
      onError?.(blockedMessage(cap.reason || "unsupported"));
      return;
    }

    const SR = getSpeechRecognitionCtor();
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
      const errType = e?.error || "unknown";
      let msg = `${s.t("error", "Voice input error")}: ${errType}`;
      if (errType === "not-allowed" || errType === "service-not-allowed") {
        // On an insecure (http LAN) origin the browser reports this even though
        // the user cannot grant permission — point them at the https link instead.
        msg = resolveVoiceSupport({ requireSpeechRecognition: true }).reason === "insecure"
          ? blockedMessage("insecure")
          : isIOS()
            ? s.t("permission_denied_ios", "Microphone access was denied. On iPhone/iPad, open this page in Safari (tap the compass icon at the bottom if it opened inside another app), then allow the microphone in Settings → Safari → Microphone and turn on Settings → General → Keyboard → Enable Dictation. Then press Retry.")
            : s.t("permission_denied", "Microphone access was denied. Click the microphone/lock icon in the address bar to allow it, then press Retry.");
      } else if (errType === "no-speech") {
        msg = s.t("no_speech", "No speech detected. Please speak clearly into your microphone and try again.");
      } else if (errType === "network") {
        msg = s.t("network", "Speech recognition network error. Please check your connection and try again.");
      }
      onError?.(msg);
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
        }, 300);
      }
      setListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (err: any) {
      onError?.(err?.message || "Could not start voice recognition");
      setListening(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleListen}
      disabled={disabled || processing}
      className={`gap-2 ${className}`}
      aria-label={s.t("label", "Voice")}
      title={
        ready
          ? s.t("tooltip", "Click to speak")
          : blockReason
            ? blockedMessage(blockReason)
            : s.t("tooltip", "Click to speak")
      }
    >
      {processing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : listening ? (
        <MicOff className="h-4 w-4 text-red-500 animate-pulse" />
      ) : ready ? (
        <Mic className="h-4 w-4" />
      ) : (
        <MicOff className="h-4 w-4 text-amber-500" />
      )}
      {s.t("label", "Voice")}
    </Button>
  );
}
