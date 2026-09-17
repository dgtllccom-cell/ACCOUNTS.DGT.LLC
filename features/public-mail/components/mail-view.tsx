"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Download,
  KeyRound,
  Paperclip,
  Reply,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import type { MailMessage } from "@/lib/public-mail/webmail-service";

interface MailViewProps {
  message: MailMessage;
  onBack: () => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string, isStarred: boolean) => void;
  onReply: (message: MailMessage) => void;
}

export function MailView({
  message,
  onBack,
  onDelete,
  onToggleStar,
  onReply,
}: MailViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (message.extracted_code) {
      navigator.clipboard.writeText(message.extracted_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const formattedDate = new Date(message.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Back to list"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggleStar(message.id, !message.is_starred)}
            className={`p-1.5 rounded-lg transition-colors ${
              message.is_starred
                ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            title="Star message"
          >
            <Star className={`h-4 w-4 ${message.is_starred ? "fill-amber-500" : ""}`} />
          </button>
          <button
            onClick={() => onDelete(message.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Delete / Move to Trash"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onReply(message)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 shadow-sm"
          >
            <Reply className="h-3.5 w-3.5" />
            <span>Reply</span>
          </button>
        </div>
      </div>

      {/* Email Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          {message.subject || "(No Subject)"}
        </h1>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              {(message.sender_name || message.sender_email)[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {message.sender_name || message.sender_email}
                </span>
                {message.sender_verified && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                <span>From: &lt;{message.sender_email}&gt;</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                <span>To: {message.recipient_email}</span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formattedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Verification Code Highlight Card (For TikTok, Instagram, Facebook, Google OTPs) */}
      {message.is_verification_code && message.extracted_code && (
        <div className="m-6 p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Verification Code Detected
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                Use this one-time code to complete your authentication or account confirmation:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
            <span className="font-mono text-2xl font-black tracking-widest text-slate-900 dark:text-white">
              {message.extracted_code}
            </span>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 transition-all shadow"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Attachments Section */}
      {message.has_attachments && message.attachments_json && message.attachments_json.length > 0 && (
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
            Attachments ({message.attachments_json.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {message.attachments_json.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-xs"
              >
                <Paperclip className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                  {att.name}
                </span>
                <span className="text-[10px] text-slate-400">({(att.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Download attachment"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Body Content */}
      <div className="p-6 flex-1">
        {message.body_html ? (
          <div
            className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: message.body_html }}
          />
        ) : (
          <div className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {message.body_text || "(No message body content)"}
          </div>
        )}
      </div>
    </div>
  );
}
