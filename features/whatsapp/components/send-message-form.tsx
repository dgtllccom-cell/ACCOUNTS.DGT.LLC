"use client";

import { useState, useRef, useCallback } from "react";
import { Send, StickyNote, Paperclip, Smile, X, FileText, Image } from "lucide-react";
import type { SendMessagePayload, ConversationStatus } from "../types";
import { cn } from "@/lib/utils";

type Props = {
  onSend: (payload: SendMessagePayload) => Promise<void>;
  isSending: boolean;
  conversationStatus: ConversationStatus;
  windowExpiresAt: string | null;
};

type Mode = "text" | "note";

export function SendMessageForm({ onSend, isSending, conversationStatus, windowExpiresAt }: Props) {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isResolved = conversationStatus === "resolved";
  const windowExpired = windowExpiresAt ? new Date(windowExpiresAt) < new Date() : false;

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const payload: SendMessagePayload =
      mode === "note"
        ? { type: "internal_note", body: trimmed }
        : { type: "text", body: trimmed };

    try {
      await onSend(payload);
      setText("");
      textareaRef.current?.focus();
    } catch {
      // Error displayed by parent
    }
  }, [text, mode, isSending, onSend]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  return (
    <div className="px-3 py-2.5">
      {/* Mode toggle */}
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => setMode("text")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
            mode === "text"
              ? "bg-[#25D366]/15 text-[#25D366]"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Send className="h-2.5 w-2.5" />
          Reply
        </button>
        <button
          onClick={() => setMode("note")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
            mode === "note"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <StickyNote className="h-2.5 w-2.5" />
          Internal Note
        </button>
      </div>

      {/* Window warning */}
      {windowExpired && mode === "text" && (
        <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[10px] text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-400">
          ⚠️ The 24-hour messaging window has expired. You can only send template messages or internal notes.
        </div>
      )}

      {/* Compose area */}
      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border transition-colors",
          mode === "note"
            ? "border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10"
            : "border-border bg-background"
        )}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={autoResize}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "note"
              ? "Add an internal note (not visible to customer)…"
              : isResolved
              ? "Conversation resolved — type to reopen…"
              : "Type a message… (Enter to send, Shift+Enter for newline)"
          }
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none min-h-[40px]"
          style={{ maxHeight: "120px" }}
          disabled={isSending}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          className={cn(
            "me-2 mb-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all",
            text.trim() && !isSending
              ? mode === "note"
                ? "bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                : "bg-[#25D366] text-white shadow-sm hover:bg-[#20ba59]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
          title="Send (Enter)"
        >
          {isSending ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <p className="mt-1 text-[9px] text-muted-foreground/50 text-end">
        {mode === "note" ? "Only visible to your team" : "Sent via WhatsApp"}
      </p>
    </div>
  );
}
