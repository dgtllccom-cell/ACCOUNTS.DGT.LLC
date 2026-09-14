"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { ErpVoiceInputButton } from "@/components/erp-voice-input-button";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { InquiryDraft } from "../lib/shared";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedVoice, setUsedVoice] = useState(false);

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
      onDraft(data.data.draft as InquiryDraft, raw, usedVoice ? "ai_voice" : "ai_text");
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
        <ErpVoiceInputButton
          context="customer"
          lang={s.lang as SupportedLanguage}
          className="h-7 text-[11px]"
          onTranscribed={(result) => {
            setUsedVoice(true);
            setError(null);
            setText((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript).trim());
          }}
          onError={(msg) => setError(msg)}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        dir="auto"
        placeholder={s.t("ai_placeholder", "e.g. Met Mr Ahmed Khan from ABC Trading LLC. Importer of rice and sugar. Mobile 0300 1234567. Needs a quote for 2 containers basmati. Follow up next week.")}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
      />

      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}

      <Button type="button" onClick={prepare} disabled={busy || text.trim().length < 4} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {s.t("ai_prepare", "Prepare Form — Preview & Confirm")}
      </Button>
    </div>
  );
}
