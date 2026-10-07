"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Check,
  X,
  Languages,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import type { VoiceContext } from "@/lib/services/voice-context-interpreter";
import { cn } from "@/lib/utils";
import { getSpeechRecognitionCtor, resolveVoiceSupport, isIOS } from "@/lib/voice/voice-support";

const SPEECH_LANG_MAP: Record<SupportedLanguage, string> = {
  en: "en-US",
  ur: "ur-PK",
  ps: "ps-AF",
  fa: "fa-IR",
  ar: "ar-SA",
};

export interface VoiceRemarksMicProps {
  context?: VoiceContext;
  lang?: SupportedLanguage;
  language?: SupportedLanguage;
  value?: string | null;
  currentValue?: string | null;
  onChange?: (nextValue: string) => void;
  onTranscribed?: (transcript: string, mode: "append" | "replace") => void;
  label?: string;
  title?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function VoiceRemarksMic({
  context = "accounts",
  lang: langProp,
  language: languageProp,
  value: valueProp,
  currentValue,
  onChange,
  onTranscribed,
  label,
  title,
  placeholder = "Spoken text will appear here...",
  className = "",
  disabled = false,
}: VoiceRemarksMicProps) {
  const value = valueProp ?? currentValue ?? "";
  const effectiveLabel = label ?? title ?? "Voice Entry";
  const activeLangProp = langProp ?? languageProp;
  const s = useErpScreen("voice", activeLangProp);
  const activeLang = (activeLangProp || s.lang || "en") as SupportedLanguage;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(activeLang);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [insertMode, setInsertMode] = useState<"append" | "replace">(value?.trim() ? "append" : "replace");
  const [error, setError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [translating, setTranslating] = useState(false);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPausedRef = useRef(false);

  const isRtl = selectedLang === "ur" || selectedLang === "ps" || selectedLang === "ar" || selectedLang === "fa";

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  function startRecording() {
    setError(null);
    setTranscript("");
    setInterimText("");
    setDurationSec(0);
    setIsPaused(false);
    isPausedRef.current = false;

    // Gate on secure context + API support BEFORE touching the mic, so an http LAN
    // origin shows the actionable "open the https link" message rather than a
    // misleading "permission denied".
    const cap = resolveVoiceSupport({ requireSpeechRecognition: true });
    if (!cap.ok) {
      setError(
        cap.reason === "insecure"
          ? s.t(
              "insecure_context",
              "Voice needs a secure (HTTPS) connection. Please open the ERP through the secure https link instead of the http IP address, then try again.",
            )
          : s.t(
              "unsupported",
              "Voice is not supported in this browser. Please try Chrome, Edge, or Safari.",
            ),
      );
      return;
    }

    const SR = getSpeechRecognitionCtor();

    try {
      const rec = new SR();
      rec.lang = SPEECH_LANG_MAP[selectedLang] || "en-US";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsRecording(true);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          if (!isPausedRef.current) {
            setDurationSec((d) => d + 1);
          }
        }, 1000);
      };

      rec.onresult = (e: any) => {
        if (isPausedRef.current) return;
        let finalStr = "";
        let interimStr = "";

        for (let i = 0; i < e.results.length; i++) {
          const item = e.results[i];
          if (item.isFinal) {
            finalStr += item[0].transcript + " ";
          } else {
            interimStr += item[0].transcript;
          }
        }

        if (finalStr) {
          setTranscript((prev) => {
            const combined = `${prev} ${finalStr}`.trim();
            return Array.from(new Set(combined.split(/\s+/))).join(" ");
          });
        }
        setInterimText(interimStr);
      };

      rec.onerror = (e: any) => {
        const errType = e?.error || "unknown";
        if (errType === "not-allowed" || errType === "service-not-allowed") {
          // On an insecure (http LAN) origin the browser blocks the mic and cannot
          // be granted — steer the user to the https link instead.
          setError(
            resolveVoiceSupport({ requireSpeechRecognition: true }).reason === "insecure"
              ? s.t(
                  "insecure_context",
                  "Voice needs a secure (HTTPS) connection. Please open the ERP through the secure https link instead of the http IP address, then try again.",
                )
              : isIOS()
                ? s.t(
                    "permission_denied_ios",
                    "Microphone access was denied. On iPhone/iPad, open this page in Safari (tap the compass icon at the bottom if it opened inside another app), then allow the microphone in Settings → Safari → Microphone and turn on Settings → General → Keyboard → Enable Dictation. Then press Retry.",
                  )
                : s.t(
                    "permission_denied",
                    "Microphone access was denied. Click the microphone/lock icon in the address bar to allow it, then press Retry.",
                  ),
          );
        } else if (errType === "no-speech") {
          // Non-fatal: keep waiting for speech
        } else if (errType === "network") {
          setError(s.t("network", "Speech recognition network error. Please check your connection and try again."));
        } else {
          setError(`${s.t("error", "Voice input error")}: ${errType}`);
        }
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      rec.onend = () => {
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err: any) {
      setError(err?.message || "Failed to initiate microphone audio.");
      setIsRecording(false);
    }
  }

  function pauseRecording() {
    setIsPaused(true);
    isPausedRef.current = true;
  }

  function resumeRecording() {
    setIsPaused(false);
    isPausedRef.current = false;
  }

  function stopRecording() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    setIsPaused(false);
    isPausedRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function handleOpen() {
    setIsOpen(true);
    setError(null);
    setInsertMode(value?.trim() ? "append" : "replace");
    // Auto-start recording
    setTimeout(() => {
      startRecording();
    }, 150);
  }

  function handleClose() {
    stopRecording();
    setIsOpen(false);
    setError(null);
  }

  function handleApply() {
    stopRecording();
    const cleanText = transcript.trim();
    if (!cleanText) {
      handleClose();
      return;
    }

    if (onTranscribed) {
      onTranscribed(cleanText, insertMode);
    } else if (onChange) {
      const currentVal = (value || "").trim();
      let finalVal = cleanText;

      if (insertMode === "append" && currentVal) {
        finalVal = `${currentVal}\n${cleanText}`;
      }

      onChange(finalVal);
    }
    handleClose();
  }

  function handleRetry() {
    stopRecording();
    setTranscript("");
    setInterimText("");
    setError(null);
    setTimeout(() => {
      startRecording();
    }, 100);
  }

  // Format MM:SS timer
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const timeDisplay = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <>
      {/* Trigger Button: Clean, compact microphone icon */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        title={`${label} (${selectedLang.toUpperCase()})`}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white p-1 text-slate-500 shadow-2xs transition-all hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-cyan-500/60 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300 disabled:opacity-50 cursor-pointer",
          className
        )}
      >
        <Mic className="h-3.5 w-3.5" />
      </button>

      {/* Interactive Modal / Popover Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* Header: Title, Active Language Selector, Close */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
                  <Mic className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {s.t("voice_remarks_title", "Voice Entry — Notes & Remarks")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Verbatim speech in 5 languages · No automatic changes
                  </p>
                </div>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedLang}
                  disabled={isRecording}
                  onChange={(e) => {
                    const l = e.target.value as SupportedLanguage;
                    setSelectedLang(l);
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 outline-none"
                >
                  <option value="en">English (US)</option>
                  <option value="ur">اردو (Urdu)</option>
                  <option value="ps">پښتو (Pashto)</option>
                  <option value="fa">فارسی (Farsi)</option>
                  <option value="ar">العربية (Arabic)</option>
                </select>

                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Recording Status & Waveform Bar */}
            <div className="my-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                    </span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      {isPaused ? "Paused" : "Listening..."}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {transcript ? "Ready for review" : "Microphone stopped"}
                    </span>
                  </div>
                )}
                <span className="font-mono text-xs font-bold text-slate-400">
                  ⏱ {timeDisplay}
                </span>
              </div>

              {/* Pause / Resume / Record buttons */}
              <div className="flex items-center gap-1.5">
                {isRecording ? (
                  <>
                    {isPaused ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={resumeRecording}
                        className="h-7 px-2.5 text-xs font-bold text-cyan-600"
                      >
                        <Play className="h-3 w-3 mr-1" /> Resume
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={pauseRecording}
                        className="h-7 px-2.5 text-xs font-bold text-amber-600"
                      >
                        <Pause className="h-3 w-3 mr-1" /> Pause
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={stopRecording}
                      className="h-7 px-2.5 text-xs font-bold"
                    >
                      <MicOff className="h-3 w-3 mr-1" /> Stop
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={startRecording}
                    className="h-7 bg-cyan-600 hover:bg-cyan-500 px-3 text-xs font-bold text-white shadow-2xs"
                  >
                    <Mic className="h-3 w-3 mr-1" /> Speak Again
                  </Button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Live Transcript Preview (Editable Textarea) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {s.t("transcript_preview", "Transcript Preview (editable before inserting):")}
                </label>
                {interimText && (
                  <span className="text-[10px] font-semibold text-cyan-500 italic animate-pulse">
                    Live: {interimText}
                  </span>
                )}
              </div>
              <textarea
                rows={4}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-800 shadow-2xs outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                dir={isRtl ? "rtl" : "ltr"}
              />
            </div>

            {/* Options Bar: Append vs Replace */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600 dark:text-slate-300">
                  <input
                    type="radio"
                    name="insertMode"
                    value="append"
                    checked={insertMode === "append"}
                    onChange={() => setInsertMode("append")}
                    className="text-cyan-600"
                  />
                  <span>{s.t("mode_append", "Append to existing notes")}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600 dark:text-slate-300">
                  <input
                    type="radio"
                    name="insertMode"
                    value="replace"
                    checked={insertMode === "replace"}
                    onChange={() => setInsertMode("replace")}
                    className="text-cyan-600"
                  />
                  <span>{s.t("mode_replace", "Replace entirely")}</span>
                </label>
              </div>

              {/* Retry button */}
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <RotateCcw className="h-3 w-3" /> Retry
              </button>
            </div>

            {/* Footer Action Buttons */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                {s.t("cancel", "Cancel")}
              </button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleApply}
                  disabled={!transcript.trim()}
                  className="h-8 bg-cyan-600 hover:bg-cyan-500 px-4 text-xs font-black text-white shadow-md disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {s.t("insert_into_field", "Insert into Field")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
