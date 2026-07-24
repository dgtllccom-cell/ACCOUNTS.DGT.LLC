"use client";

import { useRef, useEffect } from "react";
import {
  UserCircle, Info, ChevronLeft, CheckCheck, Check,
  Clock, AlertCircle, FileText, Mic, Image, Video
} from "lucide-react";
import type { WhatsAppConversation, WhatsAppMessage, ConversationDetail, SendMessagePayload } from "../types";
import { SendMessageForm } from "./send-message-form";
import { MessageBubble } from "./message-bubble";
import { StatusBadge } from "./status-badge";
import { updateConversation } from "../api";

type Props = {
  conversation: WhatsAppConversation | null;
  detail: ConversationDetail;
  messages: WhatsAppMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  onSend: (payload: SendMessagePayload) => Promise<void>;
  onLoadMore: () => void;
  onToggleContact: () => void;
  showContact: boolean;
};

function getContactLabel(detail: ConversationDetail): string {
  const c = detail.conversation.contact;
  if (!c) return "Unknown Contact";
  return (
    c.displayName ??
    c.waProfileName ??
    detail.erpCustomer?.customerName ??
    c.phoneNumber ??
    "Unknown"
  );
}

async function handleStatusChange(conversationId: string, status: string) {
  await updateConversation(conversationId, { status });
}

export function ChatPanel({
  conversation,
  detail,
  messages,
  isLoading,
  isSending,
  error,
  onSend,
  onLoadMore,
  onToggleContact,
  showContact
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const contactLabel = getContactLabel(detail);
  const conv = detail.conversation;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366] font-bold text-sm">
            {contactLabel[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{contactLabel}</p>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground">
                {conv.contact?.phoneNumber ?? ""}
              </p>
              <StatusBadge status={conv.status} tiny />
              {conv.assignedUser && (
                <span className="text-[10px] text-muted-foreground">
                  → {conv.assignedUser.fullName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick status actions */}
          {conv.status !== "resolved" && (
            <button
              onClick={() => handleStatusChange(conv.id, "resolved")}
              className="rounded-md border border-emerald-300 px-2.5 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            >
              ✓ Resolve
            </button>
          )}
          {conv.status === "resolved" && (
            <button
              onClick={() => handleStatusChange(conv.id, "open")}
              className="rounded-md border border-sky-300 px-2.5 py-1 text-[10px] font-medium text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
            >
              Reopen
            </button>
          )}
          <button
            onClick={onToggleContact}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              showContact ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Toggle contact panel"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[url('/whatsapp-bg.svg')] bg-repeat bg-[length:400px]">
        {/* Load more */}
        {messages.length > 0 && (
          <div className="flex justify-center pb-2">
            <button
              onClick={onLoadMore}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Load older messages
            </button>
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#25D366] border-t-transparent" />
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              prevMessage={messages[idx - 1] ?? null}
            />
          ))
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm">
        <SendMessageForm
          onSend={onSend}
          isSending={isSending}
          conversationStatus={conv.status}
          windowExpiresAt={conv.windowExpiresAt}
        />
      </div>
    </div>
  );
}
