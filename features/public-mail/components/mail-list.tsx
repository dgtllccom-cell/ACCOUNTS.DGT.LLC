"use client";

import { KeyRound, Mail, Paperclip, Star } from "lucide-react";
import type { MailMessage } from "@/lib/public-mail/webmail-service";

interface MailListProps {
  messages: MailMessage[];
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
  onToggleStar: (id: string, isStarred: boolean) => void;
  folderName: string;
}

export function MailList({
  messages,
  selectedMessageId,
  onSelectMessage,
  onToggleStar,
  folderName,
}: MailListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white dark:bg-slate-900">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <Mail className="h-8 w-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 capitalize">
          No emails in {folderName}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          When external senders, social platforms, or services send you emails, they will appear right here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto h-full bg-white dark:bg-slate-900">
      {messages.map((msg) => {
        const isSelected = selectedMessageId === msg.id;
        const formattedTime = new Date(msg.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        return (
          <div
            key={msg.id}
            onClick={() => onSelectMessage(msg.id)}
            className={`cursor-pointer group relative flex items-start gap-3 p-4 transition-all hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${
              isSelected
                ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-blue-600"
                : msg.is_read
                ? "bg-white dark:bg-slate-900"
                : "bg-slate-50/70 dark:bg-slate-800/40 font-semibold"
            }`}
          >
            {/* Star toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(msg.id, !msg.is_starred);
              }}
              className={`p-1 rounded transition-colors shrink-0 mt-0.5 ${
                msg.is_starred
                  ? "text-amber-500"
                  : "text-slate-300 dark:text-slate-600 hover:text-slate-500"
              }`}
            >
              <Star className={`h-4 w-4 ${msg.is_starred ? "fill-amber-500" : ""}`} />
            </button>

            {/* Content preview */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs truncate ${
                    msg.is_read
                      ? "text-slate-600 dark:text-slate-300 font-normal"
                      : "text-slate-900 dark:text-white font-bold"
                  }`}
                >
                  {msg.sender_name || msg.sender_email}
                </span>

                <span className="text-[11px] text-slate-400 shrink-0">{formattedTime}</span>
              </div>

              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`text-xs truncate ${
                    msg.is_read
                      ? "text-slate-700 dark:text-slate-300 font-medium"
                      : "text-slate-900 dark:text-white font-bold"
                  }`}
                >
                  {msg.subject || "(No Subject)"}
                </span>

                {msg.has_attachments && (
                  <Paperclip className="h-3 w-3 text-slate-400 shrink-0" />
                )}
              </div>

              {/* OTP Pill if detected */}
              {msg.is_verification_code && msg.extracted_code && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <KeyRound className="h-3 w-3" />
                  <span>Code: {msg.extracted_code}</span>
                </div>
              )}

              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate line-clamp-1">
                {msg.snippet || msg.body_text?.slice(0, 80) || "No preview"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
