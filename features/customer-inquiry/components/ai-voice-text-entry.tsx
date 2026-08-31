"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, Loader2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { SPEECH_LANG, type InquiryDraft } from "../lib/shared";

/**
 * AI voice/text entry for a Customer Inquiry. The user speaks (Web Speech API,
 * client-side, 5 ERP languages) or types free-form meeting notes; on "Prepare
 * Form" the text is sent to /api/erp/customer-inquiries/ai-draft which runs a
 * 100% local heuristic extractor and returns the structured draft the parent
 * shows in Preview/Confirm. Nothing is saved here.
 */
export function AiVoiceTextEntry({
  lang: langProp,
  onDraft,
}: {
  lang?: string;
  onDraft: (draft: InquiryDraft, rawText: string, mode: "ai_text" | "ai_voice") => void;
}) {
  const s = useErpScreen("cinq", langProp);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usedVoice = useRef(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    setSupported(Boolean(SR));
  }, []);

  function toggleListen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = SPEECH_LANG[s.lang] || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    let finalChunk = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setText((prev) => {
        const base = prev.endsWith(finalChunk.trim()) ? prev : (prev + " " + finalChunk).trim();
        return (base + (interim ? " " + interim : "")).trim();
      });
    };
    rec.onerror = (e: any) => { setError(String(e?.error || "voice error")); setListening(false); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    usedVoice.current = true;
    setError(null);
    setListening(true);
    rec.start();
  }

  async function prepare() {
    const raw = text.trim();
    if (raw.length < 4) { setError(s.t("ai_need_more", "Please type or speak the meeting details first.")); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/customer-inquiries/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error?.message || data?.error || "AI draft failed");
      onDraft(data.data.draft as InquiryDraft, raw, usedVoice.current ? "ai_voice" : "ai_text");
    } catch (e: any) {
      setError(e?.message || "Could not prepare the form.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" dir={s.dir}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          {s.t("ai_entry_title", "AI Voice / Text Entry")}
        </span>
        {supported && (
          <Button
            type="button"
            size="sm"
            variant={listening ? "destructive" : "outline"}
            className="h-7 gap-1 text-[11px]"
            onClick={toggleListen}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {listening ? s.t("ai_stop", "Stop") : s.t("ai_speak", "Speak")}
          </Button>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        dir="auto"
        placeholder={s.t("ai_placeholder", "e.g. Met Mr Ahmed Khan from ABC Trading LLC. Importer of rice and sugar. Mobile 0300 1234567. Needs a quote for 2 containers basmati. Follow up next week.")}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
      />

      {!supported && (
        <p className="flex items-center gap-1 text-[10.5px] text-slate-400">
          <Type className="h-3 w-3" /> {s.t("ai_voice_unsupported", "Voice is not available in this browser — type the notes instead.")}
        </p>
      )}
      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}

      <Button type="button" onClick={prepare} disabled={busy || text.trim().length < 4} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {s.t("ai_prepare", "Prepare Form — Preview & Confirm")}
      </Button>
    </div>
  );
}
