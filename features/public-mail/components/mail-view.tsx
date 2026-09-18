"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Download,
  Forward,
  KeyRound,
  MailCheck,
  MailOpen,
  Paperclip,
  RefreshCw,
  Reply,
  ReplyAll,
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
  onToggleRead?: (id: string, isRead: boolean) => void;
  onReply: (message: MailMessage) => void;
  onReplyAll?: (message: MailMessage) => void;
  onForward?: (message: MailMessage) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
}

export function MailView({
  message,
  onBack,
  onDelete,
  onToggleStar,
  onToggleRead,
  onReply,
  onReplyAll,
  onForward,
  onRestore,
  onPermanentDelete,
}: MailViewProps) {
  const [copied, setCopied] = useState(false);

  const isTrash = message.folder === "trash";

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

          {onToggleRead && (
            <button
              onClick={() => onToggleRead(message.id, !message.is_read)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title={message.is_read ? "Mark as unread" : "Mark as read"}
            >
              {message.is_read ? <MailOpen className="h-4 w-4" /> : <MailCheck className="h-4 w-4" />}
            </button>
          )}

          {isTrash ? (
            <>
              {onRestore && (
                <button
                  onClick={() => onRestore(message.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                  title="Restore to Inbox"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Restore</span>
                </button>
              )}
              {onPermanentDelete && (
                <button
                  onClick={() => onPermanentDelete(message.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 flex items-center gap-1"
                  title="Delete permanently"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Forever</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => onDelete(message.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Delete / Move to Trash"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Actions: Reply, Reply All, Forward */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReply(message)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 shadow-sm transition-colors"
            title="Reply to sender"
          >
            <Reply className="h-3.5 w-3.5 text-blue-500" />
            <span>Reply</span>
          </button>

          {onReplyAll && (
            <button
              onClick={() => onReplyAll(message)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 shadow-sm transition-colors"
              title="Reply to all recipients"
            >
              <ReplyAll className="h-3.5 w-3.5 text-indigo-500" />
              <span>Reply All</span>
            </button>
          )}

          {onForward && (
            <button
              onClick={() => onForward(message)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 shadow-sm transition-colors"
              title="Forward message"
            >
              <Forward className="h-3.5 w-3.5 text-slate-500" />
              <span>Forward</span>
            </button>
          )}
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
                <span className="mx-1">&bull;</span>
                <span>To: &lt;{message.recipient_email}&gt;</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 shrink-0 text-right flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Verification Code Box (Auto-Extracted OTP) */}
      {message.is_verification_code && message.extracted_code && (
        <div className="m-6 p-5 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-blue-500/5 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Online Verification Code Detected
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Use this single-use code to complete verification for your account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <span className="font-mono text-2xl font-black tracking-widest text-slate-900 dark:text-white px-4 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner">
              {message.extracted_code}
            </span>
            <button
              onClick={handleCopyCode}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied" : "Copy Code"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Email Body */}
      <div className="p-6 flex-1 text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-sans">
        {message.body_html ? (
          <div
            className="prose dark:prose-invert max-w-none break-words"
            dangerouslySetInnerHTML={{ __html: message.body_html }}
          />
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.body_text}</div>
        )}
      </div>

      {/* Attachments Section */}
      {message.has_attachments && message.attachments_json && message.attachments_json.length > 0 && (
        <div className="m-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Paperclip className="h-4 w-4 text-blue-500" />
            <span>Attachments ({message.attachments_json.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {message.attachments_json.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-sm hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                    <Paperclip className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                      {att.name}
                    </p>
                    <p className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>

                <a
                  href={att.url || "#"}
                  download={att.name}
                  onClick={(e) => {
                    if (!att.url) {
                      e.preventDefault();
                      alert(`Attachment "${att.name}" is stored in mail storage.`);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Download attachment"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
