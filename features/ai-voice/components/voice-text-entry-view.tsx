"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Loader2, Send, Volume2, History, Trash2, Languages, RefreshCw } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";

const LANG_CODES = supportedLanguages.map((l) => l.code) as SupportedLanguage[];
import { Button } from "@/components/ui/button";

const SPEECH_LANG: Record<SupportedLanguage, string> = {
  en: "en-US", ur: "ur-PK", ps: "ps-AF", fa: "fa-IR", ar: "ar-SA",
};
const LANG_LABEL: Record<SupportedLanguage, string> = {
  en: "English", ur: "اردو", ps: "پښتو", fa: "فارسی", ar: "العربية",
};
const RTL = new Set<SupportedLanguage>(["ur", "ar", "fa", "ps"]);

type HistoryItem = {
  id: string;
  job_no: string;
  source_type: "voice" | "text";
  original_language: SupportedLanguage;
  operational_domain: "business" | "shipping";
  transcript: string;
  audio_duration_seconds: number | null;
  has_audio: boolean;
  status: string;
  target_module: string | null;
  created_at: string;
};

export function VoiceTextEntryView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("ait", langProp);

  const [sourceType, setSourceType] = useState<"voice" | "text">("voice");
  const [domain, setDomain] = useState<"business" | "shipping">("business");
  const [spokenLang, setSpokenLang] = useState<SupportedLanguage>((s.lang as SupportedLanguage) || "en");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [playing, setPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ jobNo: string; nextStep: string; transcriptSource: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const finalisedRef = useRef<string>("");

  const spokenRtl = RTL.has(spokenLang);
  const spokenDir = spokenRtl ? "rtl" : "ltr";

  useEffect(() => {
    const SR = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setSttSupported(Boolean(SR));
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/erp/voice-messages?limit=25", { credentials: "include" });
      const json = await res.json();
      const items = json?.data?.messages ?? json?.messages ?? [];
      setHistory(Array.isArray(items) ? items : []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // ── Recording ──
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    setTranscript("");
    setInterim("");
    finalisedRef.current = "";
    setAudioUrl(null);
    setAudioBlob(null);
    setDurationMs(0);

    // 1. Audio capture (real MediaRecorder)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecRef.current = rec;
      rec.start();
    } catch (err: any) {
      setError(
        err?.name === "NotAllowedError"
          ? s.t("mic_denied", "Microphone permission was denied. Allow microphone access and retry.")
          : s.t("mic_error", "Could not access the microphone: ") + (err?.message || String(err))
      );
      return;
    }

    // 2. Speech-to-text (Web Speech API — browser native, all 5 ERP languages)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const recog = new SR();
      recog.lang = SPEECH_LANG[spokenLang] || "en-US";
      recog.continuous = true;
      recog.interimResults = true;
      recog.onresult = (e: any) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalisedRef.current += r[0].transcript + " ";
          else live += r[0].transcript;
        }
        setTranscript(finalisedRef.current.trim());
        setInterim(live);
      };
      recog.onerror = (e: any) => {
        if (e.error !== "no-speech" && e.error !== "aborted") {
          setError(s.t("stt_error", "Speech recognition error: ") + e.error);
        }
      };
      recognitionRef.current = recog;
      try { recog.start(); } catch { /* already started */ }
    }

    startTimeRef.current = Date.now();
    stopTimer();
    timerRef.current = setInterval(() => setDurationMs(Date.now() - startTimeRef.current), 200);
    setRecording(true);
  }, [s, spokenLang]);

  const stopRecording = useCallback(() => {
    stopTimer();
    setRecording(false);
    setInterim("");
    try { mediaRecRef.current?.stop(); } catch { /* noop */ }
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    if (finalisedRef.current.trim()) setTranscript(finalisedRef.current.trim());
  }, []);

  useEffect(() => () => {
    stopTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  // ── Playback ──
  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { void el.play(); setPlaying(true); }
  };

  // ── Text-to-speech (reviewer aid) ──
  const speak = (text: string, langCode: SupportedLanguage) => {
    if (!ttsSupported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG[langCode] || "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const fmtDuration = (ms: number) => {
    const total = Math.round(ms / 1000);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const canSubmit = useMemo(() => {
    if (submitting || !transcript.trim()) return false;
    if (sourceType === "voice" && !audioBlob) return false;
    return true;
  }, [submitting, transcript, sourceType, audioBlob]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      let res: Response;
      if (sourceType === "voice" && audioBlob) {
        const fd = new FormData();
        fd.append("sourceType", "voice");
        fd.append("transcript", transcript.trim());
        fd.append("originalLanguage", spokenLang);
        fd.append("operationalDomain", domain);
        fd.append("durationSeconds", String(Math.max(1, Math.round(durationMs / 1000))));
        fd.append("audio", audioBlob, `voice.${(audioBlob.type.split("/")[1] || "webm").split(";")[0]}`);
        res = await fetch("/api/erp/voice-messages/upload", { method: "POST", body: fd, credentials: "include" });
      } else {
        res = await fetch("/api/erp/voice-messages/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sourceType: "text",
            transcript: transcript.trim(),
            originalLanguage: spokenLang,
            operationalDomain: domain,
          }),
        });
      }
      const json = await res.json();
      const data = json?.data ?? json;
      if (!res.ok || data?.error) {
        throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      }
      setResult({ jobNo: data.jobNo, nextStep: data.nextStep, transcriptSource: data.transcriptSource || "browser" });
      if (data.transcript && data.transcriptSource === "server") setTranscript(data.transcript);
      setAudioBlob(null);
      void loadHistory();
    } catch (err: any) {
      setError(err?.message || s.t("submit_failed", "Submission failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-5" dir={s.dir}>
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {s.t("title", "Voice or Text Entry")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {s.t("subtitle", "Speak or type an instruction. The AI prepares a reviewed draft — nothing posts until an authorized person approves it.")}
        </p>
      </header>

      {/* Scope row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 space-y-1">
          <span className="flex items-center gap-1"><Languages className="h-3.5 w-3.5" /> {s.t("spoken_language", "Spoken / input language")}</span>
          <select
            value={spokenLang}
            onChange={(e) => setSpokenLang(e.target.value as SupportedLanguage)}
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm"
          >
            {LANG_CODES.map((l) => (
              <option key={l} value={l}>{LANG_LABEL[l]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 space-y-1">
          <span>{s.t("domain_required", "Operational domain")}</span>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as any)}
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm"
          >
            <option value="business">{s.t("domain_business", "Business")}</option>
            <option value="shipping">{s.t("domain_shipping", "Shipping / Clearing")}</option>
          </select>
        </label>
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 space-y-1">
          <span>{s.t("source_type", "Input method")}</span>
          <div className="flex h-9 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setSourceType("voice")}
              className={`flex-1 ${sourceType === "voice" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900"}`}
            >
              🎤 {s.t("type_voice", "Voice")}
            </button>
            <button
              type="button"
              onClick={() => setSourceType("text")}
              className={`flex-1 ${sourceType === "text" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900"}`}
            >
              ⌨️ {s.t("type_text", "Text")}
            </button>
          </div>
        </div>
      </div>

      {/* Recorder */}
      {sourceType === "voice" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
          {!sttSupported && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              {s.t("stt_unsupported", "Live transcription is not supported in this browser — the recording is still captured; you can type or edit the transcript below.")}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {!recording ? (
              <Button onClick={startRecording} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Mic className="h-4 w-4" /> {s.t("record", "Record")}
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> {s.t("stop", "Stop")}
              </Button>
            )}
            <span className="font-mono text-sm text-slate-700 dark:text-slate-300 tabular-nums">
              {fmtDuration(durationMs)}
            </span>
            {recording && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" /> {s.t("recording", "Recording…")}
              </span>
            )}
            {audioUrl && !recording && (
              <>
                <audio ref={audioElRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={togglePlay} className="gap-1.5">
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {s.t("playback", "Play recording")}
                </Button>
              </>
            )}
          </div>
          {interim && (
            <p className="text-xs text-slate-400 italic" dir={spokenDir}>{interim}</p>
          )}
        </div>
      )}

      {/* Transcript editor */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {sourceType === "voice" ? s.t("transcription", "Transcript (review & correct)") : s.t("text_instruction", "Instruction")}
          </label>
          {ttsSupported && transcript.trim() && (
            <button
              type="button"
              onClick={() => speak(transcript, spokenLang)}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
            >
              <Volume2 className="h-3.5 w-3.5" /> {s.t("read_aloud", "Read aloud")}
            </button>
          )}
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          dir={spokenDir}
          rows={4}
          placeholder={sourceType === "voice"
            ? s.t("placeholder_voice", "Your speech appears here — edit any misheard words before submitting.")
            : s.t("placeholder_text", "e.g. Received AED 3,000 cash from Ahmed Traders today against invoice INV-90.")}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 p-3 text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
          <p className="font-bold">✓ {s.t("submitted_ok", "Submitted for AI review")}</p>
          <p>{s.t("job_no", "Reference")}: <span className="font-mono">{result.jobNo}</span></p>
          <p className="text-xs">
            {s.t("transcript_source", "Transcript source")}: {result.transcriptSource === "server" ? s.t("src_server", "server (Whisper)") : s.t("src_browser", "browser speech recognition")}
          </p>
          <p className="text-xs">{s.t("next_review", "Next: an authorized reviewer checks the extracted fields, corrects, and approves before any ERP record is created.")}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? s.t("processing", "Submitting…") : s.t("submit", "Submit for AI review")}
        </Button>
        <button
          type="button"
          onClick={() => { setShowHistory((v) => !v); if (!showHistory) void loadHistory(); }}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
        >
          <History className="h-4 w-4" /> {s.t("history", "History")} ({history.length})
        </button>
      </div>

      {showHistory && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{s.t("recent_submissions", "Recent submissions")}</span>
            <button type="button" onClick={() => void loadHistory()} className="text-slate-400 hover:text-slate-600"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
          {history.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">{s.t("no_history", "No voice or text submissions yet.")}</p>
          ) : history.map((h) => (
            <div key={h.id} className="px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{h.job_no}</span>
                <span className="text-[10px] rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 font-semibold">
                  {h.source_type === "voice" ? "🎤" : "⌨️"} {LANG_LABEL[h.original_language] || h.original_language}
                </span>
                <span className="text-[10px] rounded px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">{h.status}</span>
                <span className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleString(s.lang)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2" dir={RTL.has(h.original_language) ? "rtl" : "ltr"}>
                {h.transcript}
              </p>
              <div className="mt-1 flex items-center gap-3">
                {h.has_audio && (
                  <audio controls src={`/api/erp/voice-messages/${h.id}/audio`} className="h-7 max-w-[220px]" preload="none" />
                )}
                {ttsSupported && (
                  <button
                    type="button"
                    onClick={() => speak(h.transcript, h.original_language)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    <Volume2 className="h-3 w-3" /> {s.t("read_aloud", "Read aloud")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
