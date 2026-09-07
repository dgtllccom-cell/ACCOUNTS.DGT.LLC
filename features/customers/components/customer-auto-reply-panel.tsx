"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, Sparkles, Send, History, Loader2, Languages, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api/client";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type ReplyLang = "en" | "ur" | "ps" | "fa" | "ar";
const REPLY_LANGS: { code: ReplyLang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ur", label: "اردو" },
  { code: "ps", label: "پښتو" },
  { code: "fa", label: "فارسی" },
  { code: "ar", label: "العربية" },
];
const RTL = new Set<ReplyLang>(["ur", "ps", "fa", "ar"]);

type TemplateRow = {
  code: string;
  title: string;
  category: string;
  subject: Record<string, string>;
  body: Record<string, string>;
};
type ReplyRow = {
  id: string;
  subject: string | null;
  body: string | null;
  channel: string;
  status: string;
  detail: string | null;
  language: string | null;
  wasEdited: boolean;
  sentByName: string;
  sentAt: string | null;
  createdAt: string;
};
type LoadPayload = {
  customer: { id: string; name: string | null; email: string | null; whatsapp: string | null; defaultLanguage: ReplyLang };
  templates: TemplateRow[];
  replies: ReplyRow[];
};

function tr(lang: SupportedLanguage, key: string, fb: string) {
  return t(lang, ("custreply." + key) as never, fb);
}

const STATUS_STYLE: Record<string, { cls: string; icon: typeof CheckCircle2 }> = {
  sent: { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  failed: { cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300", icon: AlertTriangle },
  no_channel: { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: Clock },
  queued: { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: Clock },
};

export function CustomerAutoReplyPanel({
  customerId,
  lang,
  countryId,
}: {
  customerId: string;
  lang: SupportedLanguage;
  countryId?: string | null;
}) {
  const panelRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoadPayload | null>(null);

  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [targetLang, setTargetLang] = useState<ReplyLang>("en");
  const [templateCode, setTemplateCode] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [aiDraftBody, setAiDraftBody] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const q = countryId ? `?countryId=${encodeURIComponent(countryId)}` : "";
      const res = await apiGet<LoadPayload>(`/api/erp/customers/${customerId}/auto-reply${q}`);
      setData(res);
      setTargetLang(res.customer.defaultLanguage || "en");
    } catch {
      setFlash({ kind: "err", text: tr(lang, "load_failed", "Could not load reply history.") });
    } finally {
      setLoading(false);
    }
  }, [customerId, countryId, lang]);

  useEffect(() => {
    if (open && !data) void reload();
  }, [open, data, reload]);

  const generateDraft = useCallback(async () => {
    setDrafting(true);
    setFlash(null);
    try {
      if (templateCode) {
        const res = await apiPost<{ subject: string; body: string }>(`/api/erp/customers/${customerId}/auto-reply`, {
          action: "draft",
          templateCode,
          targetLang,
        });
        setSubject(res.subject || "");
        setBody(res.body || "");
        setAiDraftBody(res.body || "");
      } else if (body.trim()) {
        // translate whatever is currently typed into the target language
        const res = await apiPost<{ body: string; engine: string; confidence?: number }>(
          `/api/erp/customers/${customerId}/auto-reply`,
          { action: "draft", sourceText: body, sourceLang: "en", targetLang },
        );
        setBody(res.body || body);
        setAiDraftBody(res.body || body);
        // Only "template" / "approved" / "memory" / "glossary" are human-quality.
        // Everything else is best-effort machine output the operator MUST rewrite.
        const trusted = ["identity", "approved", "memory", "glossary"];
        if (targetLang !== "en" && !trusted.includes(res.engine)) {
          setFlash({
            kind: "warn",
            text: tr(
              lang,
              "machine_warn",
              "Auto-translation is machine-generated and may be inaccurate — review and correct it before sending, or pick a ready template.",
            ),
          });
        }
      }
    } catch {
      setFlash({ kind: "err", text: tr(lang, "draft_failed", "Draft generation failed.") });
    } finally {
      setDrafting(false);
    }
  }, [templateCode, targetLang, body, customerId, lang]);

  const send = useCallback(async () => {
    if (!subject.trim() || !body.trim()) {
      setFlash({ kind: "warn", text: tr(lang, "need_subject_body", "Enter a subject and message before sending.") });
      return;
    }
    setSending(true);
    setFlash(null);
    try {
      const res = await apiPost<{ status: string; detail: string | null }>(`/api/erp/customers/${customerId}/auto-reply`, {
        action: "send",
        channel,
        targetLang,
        subject,
        body,
        templateCode: templateCode || undefined,
        aiDraftBody: aiDraftBody || undefined,
      });
      if (res.status === "sent") {
        setFlash({ kind: "ok", text: tr(lang, "sent_ok", "Reply sent to the customer.") });
        setSubject("");
        setBody("");
        setAiDraftBody(null);
        setTemplateCode("");
      } else if (res.status === "no_channel") {
        setFlash({
          kind: "warn",
          text: res.detail || tr(lang, "no_channel", "No delivery channel is configured. The reply was saved for later sending."),
        });
      } else {
        setFlash({ kind: "err", text: res.detail || tr(lang, "send_failed", "Sending failed.") });
      }
      await reload();
    } catch {
      setFlash({ kind: "err", text: tr(lang, "send_failed", "Sending failed.") });
    } finally {
      setSending(false);
    }
  }, [subject, body, channel, targetLang, templateCode, aiDraftBody, customerId, lang, reload]);

  const dir = panelRtl ? "rtl" : "ltr";
  const fieldDir = RTL.has(targetLang) ? "rtl" : "ltr";

  return (
    <div
      dir={dir}
      className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-850/60"
      >
        <span className="flex items-center gap-1.5">
          <MessageSquareText className="h-3.5 w-3.5 text-teal-600" />
          {tr(lang, "title", "Customer Auto-Reply")}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
              <Loader2 className="h-4 w-4 animate-spin" /> {tr(lang, "loading", "Loading…")}
            </div>
          )}

          {data && (
            <>
              {/* recipient line */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-3">
                {tr(lang, "to", "To")}:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {channel === "email" ? data.customer.email || tr(lang, "no_email", "no email on file") : data.customer.whatsapp || tr(lang, "no_wa", "no number on file")}
                </span>
              </p>

              {/* controls row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 space-y-1">
                  <span>{tr(lang, "channel", "Channel")}</span>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as "email" | "whatsapp")}
                    className="w-full h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  >
                    <option value="email">{tr(lang, "email", "Email")}</option>
                    <option value="whatsapp">{tr(lang, "whatsapp", "WhatsApp")}</option>
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 space-y-1">
                  <span className="flex items-center gap-1">
                    <Languages className="h-3 w-3" /> {tr(lang, "reply_language", "Reply language")}
                  </span>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value as ReplyLang)}
                    className="w-full h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  >
                    {REPLY_LANGS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                        {l.code === data.customer.defaultLanguage ? ` · ${tr(lang, "customer_lang", "customer language")}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 space-y-1">
                  <span>{tr(lang, "template", "Template")}</span>
                  <select
                    value={templateCode}
                    onChange={(e) => setTemplateCode(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  >
                    <option value="">{tr(lang, "free_compose", "Free compose")}</option>
                    {data.templates.map((tp) => (
                      <option key={tp.code} value={tp.code}>
                        {tp.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={generateDraft}
                  disabled={drafting || (!templateCode && !body.trim())}
                  className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 rounded-lg"
                >
                  {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {templateCode
                    ? tr(lang, "generate_from_template", "Generate draft")
                    : tr(lang, "translate_text", "Translate to reply language")}
                </Button>
              </div>

              {/* editable draft */}
              <div className="space-y-2">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={tr(lang, "subject_ph", "Subject")}
                  dir={fieldDir}
                  className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={tr(lang, "body_ph", "Write your reply — you can edit every word before sending")}
                  dir={fieldDir}
                  rows={8}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm leading-relaxed"
                />
                {aiDraftBody && aiDraftBody !== body && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    {tr(lang, "edited_note", "Edited from the generated draft — your version will be sent and logged.")}
                  </p>
                )}
              </div>

              {flash && (
                <div
                  className={
                    "text-[11px] font-semibold rounded-lg px-3 py-2 " +
                    (flash.kind === "ok"
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : flash.kind === "warn"
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300")
                  }
                >
                  {flash.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={send}
                  disabled={sending || !subject.trim() || !body.trim()}
                  className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 rounded-lg shadow-xs"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {tr(lang, "send", "Send reply")}
                </Button>
              </div>

              {/* history */}
              <div className="pt-2">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-1.5">
                  <History className="h-3 w-3" /> {tr(lang, "history", "Reply history")}
                </h4>
                {data.replies.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-2">{tr(lang, "no_history", "No replies sent yet.")}</p>
                ) : (
                  <div className="border rounded-xl overflow-x-auto dark:border-slate-800">
                    <table className="w-full text-[11px] text-start">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase font-bold">
                        <tr>
                          <th className="px-2.5 py-1.5 text-start">{tr(lang, "col_when", "When")}</th>
                          <th className="px-2.5 py-1.5 text-start">{tr(lang, "col_by", "Sent by")}</th>
                          <th className="px-2.5 py-1.5 text-start">{tr(lang, "col_lang", "Language")}</th>
                          <th className="px-2.5 py-1.5 text-start">{tr(lang, "col_channel", "Channel")}</th>
                          <th className="px-2.5 py-1.5 text-start">{tr(lang, "col_status", "Status")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.replies.map((r) => {
                          const st = STATUS_STYLE[r.status] || STATUS_STYLE.queued;
                          const Icon = st.icon;
                          const langLabel = REPLY_LANGS.find((l) => l.code === r.language)?.label || r.language || "—";
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 align-top">
                              <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                              </td>
                              <td className="px-2.5 py-1.5 font-semibold text-slate-700 dark:text-slate-200">
                                {r.sentByName}
                                {r.wasEdited && (
                                  <span className="ms-1 text-[9px] text-amber-600 dark:text-amber-400">
                                    ({tr(lang, "edited_badge", "edited")})
                                  </span>
                                )}
                              </td>
                              <td className="px-2.5 py-1.5">{langLabel}</td>
                              <td className="px-2.5 py-1.5">{r.channel}</td>
                              <td className="px-2.5 py-1.5">
                                <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold " + st.cls}>
                                  <Icon className="h-3 w-3" />
                                  {tr(lang, "status_" + r.status, r.status)}
                                </span>
                                {r.detail && (
                                  <span className="block text-[10px] text-slate-400 mt-0.5 max-w-[260px]">{r.detail}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
