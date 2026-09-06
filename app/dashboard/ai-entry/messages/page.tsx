"use client";

import { useState, useRef, useEffect } from "react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Mic } from "lucide-react";
import { ErpVoiceInputButton, type VoiceTranscriptionResult } from "@/components/erp-voice-input-button";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type Message = {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  language: SupportedLanguage;
};

export default function AIMessagesPage({ lang: initialLang }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("ait", initialLang);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
      language: s.lang as SupportedLanguage
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/erp/ai/voice-text/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: input,
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
      }
    } catch (error) {
      console.error("Failed to get AI reply:", error);
      const errorMessage: Message = {
        id: Date.now().toString() + "error",
        type: "ai",
        content: s.t("error_getting_reply", "Sorry, I couldn't process that. Please try again."),
        timestamp: new Date(),
        language: s.lang as SupportedLanguage
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900" dir={s.dir}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <h1 className="text-2xl font-bold">{s.t("ai_messages", "AI Messages")}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {s.t("message_desc", "Chat with AI to get help with business operations")}
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-slate-500 dark:text-slate-400">
                {s.t("start_conversation", "Start a conversation with AI")}
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                  msg.type === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {msg.timestamp.toLocaleTimeString(s.lang)}
                </p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-200 dark:bg-slate-700 px-4 py-3 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={s.t("message_placeholder", "Type your message or question...")}
            className="flex-1 resize-none p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              className="h-full"
            >
              <Send className="h-4 w-4" />
            </Button>
            <ErpVoiceInputButton
              context="search"
              onTranscribed={handleVoiceTranscribed}
              lang={s.lang as SupportedLanguage}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {s.t("message_hint", "Press Shift+Enter for new line")}
        </p>
      </div>
    </div>
  );
}
