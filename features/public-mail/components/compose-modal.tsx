"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, Send, Save, X, AlertCircle } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { rtlLanguages } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

export interface ComposeInitialData {
  to?: string;
  subject?: string;
  body?: string;
  attachments?: Array<{ name: string; size: number; type: string }>;
  draftId?: string;
  mode?: "new" | "reply" | "replyAll" | "forward";
}

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
  senderEmail: string;
  availableStorageBytes: number;
  initialData?: ComposeInitialData | null;
}

export function ComposeModal({
  isOpen,
  onClose,
  onSent,
  senderEmail,
  availableStorageBytes,
  initialData,
}: ComposeModalProps) {
  const lang = useActiveLanguage();
  const isRtl = rtlLanguages.includes(lang);
  const tt = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; size: number; type: string }>>([]);
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSavedMessage, setDraftSavedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialData when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTo(initialData.to || "");
        setSubject(initialData.subject || "");
        setBody(initialData.body || "");
        setAttachments(initialData.attachments || []);
        setDraftId(initialData.draftId);
      } else {
        setTo("");
        setSubject("");
        setBody("");
        setAttachments([]);
        setDraftId(undefined);
      }
      setError(null);
      setDraftSavedMessage(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const totalAttachmentBytes = attachments.reduce((acc, a) => acc + a.size, 0);
  const messageSizeBytes = Buffer.byteLength(body, "utf8") + totalAttachmentBytes;
  const isOverQuota = messageSizeBytes > availableStorageBytes;

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles: Array<{ name: string; size: number; type: string }> = [];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      newFiles.push({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      });
    }
    setAttachments((prev) => [...prev, ...newFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDraft = async () => {
    setDraftSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          draftId,
          to: to.trim(),
          subject: subject.trim(),
          body,
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save draft");
      }
      if (data.draftId) {
        setDraftId(data.draftId);
      }
      setDraftSavedMessage(tt("mail.draft_saved_badge", "Draft saved"));
      setTimeout(() => setDraftSavedMessage(null), 2500);
      onSent(); // Refresh message lists
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDraftSaving(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      setError(tt("mail.err_recipient_required", "Please specify a recipient email address"));
      return;
    }
    if (!subject.trim()) {
      setError(tt("mail.err_subject_required", "Please specify a subject for the email"));
      return;
    }
    if (isOverQuota) {
      setError(tt("mail.err_over_quota", "Message size exceeds your remaining storage quota. Upgrade your plan or delete old messages."));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/mail/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body,
          attachments,
          draftId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message");
      }

      onSent();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (initialData?.mode === "reply") return tt("mail.compose_reply_title", "Reply");
    if (initialData?.mode === "replyAll") return tt("mail.compose_reply_all_title", "Reply All");
    if (initialData?.mode === "forward") return tt("mail.compose_forward_title", "Forward");
    return tt("mail.compose_new_title", "New Message");
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:pe-6 sm:pb-0 bg-slate-900/50 backdrop-blur-sm"
    >
      <div className="relative w-full sm:max-w-2xl h-full sm:h-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col sm:max-h-[85vh] sm:mb-6">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide">{getTitle()}</span>
            {draftSavedMessage && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium animate-pulse">
                {draftSavedMessage}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* From */}
          <div className="flex items-center px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span className="w-16 font-semibold shrink-0">{tt("mail.from_field", "From:")}</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono font-medium truncate">{senderEmail}</span>
          </div>

          {/* To */}
          <div className="flex items-center px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
            <span className="w-16 font-semibold text-slate-500 shrink-0">{tt("mail.to_field", "To:")}</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={tt("mail.recipient_placeholder", "recipient@example.com, gmail.com, etc.")}
              className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 text-xs min-w-0"
              required
            />
          </div>

          {/* Subject */}
          <div className="flex items-center px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
            <span className="w-16 font-semibold text-slate-500 shrink-0">{tt("mail.subject_field", "Subject:")}</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={tt("mail.subject_placeholder", "Email subject...")}
              className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-white font-medium placeholder:text-slate-400 text-xs min-w-0"
              required
            />
          </div>

          {/* Body */}
          <div className="p-5 flex-1 flex flex-col min-h-[220px]">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={tt("mail.body_placeholder", "Type your message here...")}
              className="w-full flex-1 bg-transparent border-none outline-none resize-none text-slate-800 dark:text-slate-100 text-sm leading-relaxed placeholder:text-slate-400 font-sans"
            />
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-200 shadow-sm"
                >
                  <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="max-w-[150px] truncate">{att.name}</span>
                  <span className="text-[10px] text-slate-400 tabular-nums">({(att.size / 1024).toFixed(1)} {tt("mail.kb_size", "KB")})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-slate-400 hover:text-red-500 ms-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer Bar */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleAddFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title={tt("mail.attach_files", "Attach Files")}
              >
                <Paperclip className="h-4 w-4" />
                <span>{tt("mail.attach", "Attach")}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={draftSaving}
                className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{draftSaving ? tt("mail.saving", "Saving...") : tt("mail.save_draft", "Save Draft")}</span>
              </button>

              <span className="text-[11px] text-slate-400 tabular-nums">
                {(messageSizeBytes / 1024).toFixed(1)} {tt("mail.kb_size", "KB")}
              </span>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {tt("mail.discard", "Discard")}
              </button>
              <button
                type="submit"
                disabled={loading || isOverQuota}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {loading ? (
                  <span>{tt("mail.sending", "Sending...")}</span>
                ) : (
                  <>
                    <Send className={`h-3.5 w-3.5 ${isRtl ? "scale-x-[-1]" : ""}`} />
                    <span>{tt("mail.send", "Send")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
