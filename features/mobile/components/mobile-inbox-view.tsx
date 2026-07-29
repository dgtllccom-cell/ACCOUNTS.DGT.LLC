"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Mail,
  Send,
  Sparkles,
  Search,
  ExternalLink,
  ShieldAlert,
  Globe,
  Bot,
  UserCheck,
  CheckCheck,
  ArrowLeft,
  ChevronRight
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

type ConversationItem = {
  id: string;
  channel: "whatsapp" | "email" | "both";
  contactIdentifier: string;
  senderName: string;
  senderType: string;
  countryName?: string;
  branchName?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  status: string;
  messageLanguage: "en" | "ur" | "ps" | "fa" | "ar";
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount: number;
};

type MessageItem = {
  id: string;
  direction: "incoming" | "outgoing";
  body: string;
  createdAt: string;
};

type Props = {
  lang: SupportedLanguage;
};

export function MobileInboxView({ lang }: Props) {
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [search, setSearch] = useState("");

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [replyInput, setReplyInput] = useState("");
  const [replyLang, setReplyLang] = useState<"en" | "ur" | "ps" | "fa" | "ar">("en");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/return-sms-reply/conversations?search=${encodeURIComponent(search)}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setConversations(json.data.conversations || []);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/erp/return-sms-reply/messages?conversationId=${convId}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setMessages(json.data.messages || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id);
      setReplyLang(selectedConv.messageLanguage || "en");
    }
  }, [selectedConv, fetchMessages]);

  const handleGenerateAi = async () => {
    if (!selectedConv) return;
    setIsGeneratingAi(true);
    const lastMsg = messages[messages.length - 1]?.body || selectedConv.lastMessageText || "Inquiry";

    try {
      const res = await fetch("/api/erp/return-sms-reply/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          body: lastMsg,
          action: "generate_ai",
          overrideLanguage: replyLang
        })
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setReplyInput(json.data.aiReply);
      }
    } catch {}
    finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSend = async () => {
    if (!selectedConv || !replyInput.trim()) return;
    try {
      const res = await fetch("/api/erp/return-sms-reply/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          body: replyInput.trim(),
          channel: selectedConv.channel === "email" ? "email" : "whatsapp",
          action: "send_manual"
        })
      });
      if (res.ok) {
        setReplyInput("");
        fetchMessages(selectedConv.id);
        fetchConversations();
      }
    } catch {}
  };

  return (
    <div className="space-y-3 pb-20" dir={isRTL ? "rtl" : "ltr"}>
      
      {/* Search Input */}
      {!selectedConv && (
        <div className="relative">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400", isRTL ? "right-3" : "left-3")} />
          <input
            type="text"
            placeholder="Search contact, number, or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full text-xs rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-200 shadow-sm",
              isRTL ? "pr-9 pl-3 text-right" : "pl-9 pr-3"
            )}
          />
        </div>
      )}

      {/* Main View: List or Active Thread */}
      {!selectedConv ? (
        <div className="rounded-3xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading messages...</div>
          ) : conversations.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <Bot className="h-8 w-8 text-slate-300 mx-auto mb-2" /> No messages found
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedConv(c)}
                className="p-3.5 cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("rounded-full p-2.5 text-white flex-shrink-0", c.channel === "whatsapp" ? "bg-emerald-600" : "bg-blue-600")}>
                    {c.channel === "whatsapp" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">{c.senderName}</h4>
                    <p className="text-[11px] text-slate-500 truncate">{c.lastMessageText || "No history"}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
              </div>
            ))
          )}
        </div>
      ) : (
        /* Mobile Chat Thread */
        <div className="rounded-3xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 flex flex-col overflow-hidden shadow-sm h-[calc(100vh-210px)] min-h-[480px]">
          {/* Thread Header */}
          <div className="p-3.5 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedConv(null)} className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">{selectedConv.senderName}</h4>
                <p className="text-[10px] text-slate-500">{selectedConv.contactIdentifier}</p>
              </div>
            </div>

            {selectedConv.relatedEntityId && (
              <a
                href={`/dashboard/reports?id=${selectedConv.relatedEntityId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200"
              >
                <ExternalLink className="h-3 w-3" /> ERP Record
              </a>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50 dark:bg-slate-950/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "p-2.5 rounded-2xl text-xs max-w-[85%] shadow-sm",
                  m.direction === "outgoing" ? "ml-auto bg-emerald-600 text-white rounded-br-none" : "mr-auto bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none"
                )}
              >
                {m.body}
              </div>
            ))}
          </div>

          {/* Mobile AI Reply Bar */}
          <div className="p-3 border-t dark:border-slate-800 space-y-2 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between gap-1">
              <button
                onClick={handleGenerateAi}
                disabled={isGeneratingAi}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2.5 py-1 text-[10px] font-bold disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {isGeneratingAi ? "Querying ERP..." : "AI Draft"}
              </button>

              <div className="flex items-center gap-1 text-[10px] font-bold">
                {(["en", "ur", "ps", "fa", "ar"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setReplyLang(l)}
                    className={cn("px-1.5 py-0.5 rounded uppercase font-mono", replyLang === l ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Reply message..."
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                className="flex-1 text-xs rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-800 px-3 py-2 outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!replyInput.trim()}
                className="rounded-xl bg-emerald-600 text-white p-2 text-xs font-bold disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
