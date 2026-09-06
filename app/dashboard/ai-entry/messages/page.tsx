"use client";

import { useState, useRef, useEffect } from "react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Button } from "@/components/ui/button";
import {
  Send,
  Loader2,
  Mic,
  Sparkles,
  Bot,
  User,
  Volume2,
  Globe2,
  ShieldCheck,
  CheckCircle2,
  CornerDownLeft,
  Flame,
  HelpCircle,
  Clock
} from "lucide-react";
import { ErpVoiceInputButton, type VoiceTranscriptionResult } from "@/components/erp-voice-input-button";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  language: SupportedLanguage;
  audioDuration?: number;
};

const SUGGESTED_PROMPTS = [
  "Check today's net cash position across UAE & Pakistan",
  "Show active branch performance summary",
  "List pending purchase order approvals",
  "What is the total credit balance in USD?"
];

export default function AIMessagesPage() {
  const s = useErpScreen("ait");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleVoiceTranscribed = (result: VoiceTranscriptionResult) => {
    setInput(result.transcript);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: text,
      timestamp: new Date(),
      language: s.lang as SupportedLanguage
    };

    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/erp/ai/voice-text/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: text,
          language: s.lang,
          conversationHistory: messages
        })
      });

      const data = await response.json();

      if (data.ok) {
        const aiMessage: Message = {
          id: Date.now().toString() + "ai",
          type: "ai",
          content: data.reply,
          timestamp: new Date(),
          language: s.lang as SupportedLanguage
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || "Failed to get reply");
      }
    } catch (error) {
      console.error("Failed to get AI reply:", error);
      const errorMessage: Message = {
        id: Date.now().toString() + "error",
        type: "ai",
        content: s.t("error_getting_reply", "Sorry, I couldn't process that query against the ERP database. Please verify your connection or try again."),
        timestamp: new Date(),
        language: s.lang as SupportedLanguage
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#070f21] text-slate-100 font-sans" dir={s.dir}>
      {/* 1. Cybernetic Hero Header */}
      <div className="relative border-b border-blue-900/40 bg-gradient-to-r from-[#071329] via-[#0c1f42] to-[#08152e] px-6 py-4 shadow-lg shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-md shadow-cyan-500/20">
              <div className="h-full w-full rounded-[10px] bg-[#071329] flex items-center justify-center">
                <Bot className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">
                  {s.t("ai_messages", "AI Voice & Chat Messaging")}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 px-2 py-0.5 text-[10px] font-extrabold text-cyan-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  ERP CO-PILOT
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Multilingual Speech-to-Text & Intelligent Operations Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-blue-800/50 bg-blue-950/40 px-3 py-1.5 text-[11px] font-bold text-blue-200">
              <Globe2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>EN • UR • AR • FA • PS</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-extrabold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>LIVE AI SYNC</span>
            </div>
          </div>
        </div>

        {/* Quick Suggested Prompts Bar */}
        <div className="mt-3.5 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 shrink-0">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Quick Prompts:
          </span>
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInput(prompt);
                handleSendMessage(prompt);
              }}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/40 text-[11px] font-medium text-slate-300 hover:text-white transition"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-radial from-[#0c1b3b]/40 via-[#070f21] to-[#050b18]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto p-6 space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center shadow-lg shadow-cyan-500/10 animate-pulse">
                <Sparkles className="h-8 w-8 text-cyan-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white">
                How can I assist your business today?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You can speak naturally in English, Urdu, Pashto, Persian, or Arabic, or type your operational queries regarding accounts, roznamcha, currencies, and branches.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
              <div className="p-3 rounded-xl border border-blue-900/40 bg-blue-950/20 text-left space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">🎙️ Voice Enabled</span>
                <p className="text-[11px] text-slate-300 font-medium">Click the microphone below and speak your daily financial instructions.</p>
              </div>
              <div className="p-3 rounded-xl border border-blue-900/40 bg-blue-950/20 text-left space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">⚡ Live ERP Intelligence</span>
                <p className="text-[11px] text-slate-300 font-medium">Instant queries on branch cash positions, bills, and payment vouchers.</p>
              </div>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.type === "user" ? "justify-end" : "justify-start")}
            >
              {msg.type === "ai" && (
                <div className="h-8 w-8 rounded-lg bg-blue-950 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-cyan-400" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-xl rounded-2xl px-4 py-3 shadow-md text-xs leading-relaxed",
                  msg.type === "user"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-br-none shadow-blue-600/20 font-medium"
                    : "bg-[#0c1a38] border border-blue-900/50 text-slate-200 rounded-bl-none shadow-black/40"
                )}
              >
                <div className="flex items-center justify-between gap-4 mb-1.5 opacity-60 text-[10px] font-bold">
                  <span>{msg.type === "user" ? "You" : "ERP Assistant"}</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="h-2.5 w-2.5" />
                    {msg.timestamp.toLocaleTimeString(s.lang, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
              </div>

              {msg.type === "user" && (
                <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-blue-400" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-3 justify-start">
            <div className="h-8 w-8 rounded-lg bg-blue-950 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="rounded-2xl rounded-bl-none bg-[#0c1a38] border border-blue-900/50 px-4 py-3 shadow-md flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
              <span className="text-xs font-semibold text-slate-400">AI is analyzing operations...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Floating Bottom Command Deck */}
      <div className="p-4 sm:p-5 border-t border-blue-900/40 bg-[#071228] shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-3 rounded-2xl border border-blue-800/40 bg-[#091733] p-2 shadow-xl focus-within:border-cyan-500/60 transition">
          {/* Voice Input Button */}
          <div className="shrink-0 pl-1">
            <ErpVoiceInputButton
              context="search"
              onTranscribed={handleVoiceTranscribed}
              lang={s.lang as SupportedLanguage}
            />
          </div>

          {/* Text Input */}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={s.t("message_placeholder", "Speak via microphone or type your message... (Enter to send)")}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 outline-none resize-none py-2 px-1 max-h-24 font-medium"
            rows={1}
          />

          {/* Send Button */}
          <Button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={loading || !input.trim()}
            className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black shadow-md shadow-blue-600/20 disabled:opacity-30 transition shrink-0 gap-1.5"
          >
            <span className="hidden sm:inline text-xs">Send</span>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
