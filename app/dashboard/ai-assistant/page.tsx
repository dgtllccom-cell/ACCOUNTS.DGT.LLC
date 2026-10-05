"use client";

import { useState, useEffect, useRef } from "react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import {
  Bot,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  FileText,
  Database,
  Mic,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  RefreshCw,
  Send,
  Globe,
  Building,
  Truck,
  CreditCard,
  UserCheck,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceRemarksMic } from "@/components/erp/voice-remarks-mic";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";

type ChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  answerType?: "erp_record" | "public_external" | "permission_denied" | "write_refused" | "no_record";
  scope?: string;
  sourceRecord?: {
    table: string;
    id: string;
    title: string;
    ref?: string;
    status?: string;
    details?: Record<string, any>;
  } | null;
  sources?: Array<{
    title: string;
    url: string;
    domain?: string;
    summary?: string;
  }>;
  action?: {
    label: string;
    url: string;
  } | null;
  refusalReason?: string | null;
};

type AuditLogRow = {
  id: string;
  user_name: string;
  query: string;
  detected_language: string;
  query_type: string;
  permission_decision: string;
  refusal_reason: string | null;
  created_at: string;
};

export default function AiAssistantPage() {
  const s = useErpScreen("aiassist");
  const [activeTab, setActiveTab] = useState<"chat" | "guidance" | "remarks" | "audit">("chat");

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Remarks dictation state
  const [demoRemarks, setDemoRemarks] = useState("Customer requested expedited customs clearance for Karachi transit.");

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Quick Prompts
  const quickPrompts = [
    { label: "Find Customer Al-Farooq", query: "find customer Al-Farooq", type: "erp" },
    { label: "Check Account 1010-DEV-TEST", query: "check account 1010-DEV-TEST", type: "erp" },
    { label: "Where is BL-DEV-TEST-999?", query: "where is BL-DEV-TEST-999", type: "erp" },
    { label: "FOB Incoterms Rules (Urdu)", query: "FOB انکوٹرمز کے کیا اصول ہیں؟", type: "public" },
    { label: "Container Sizes (English)", query: "What are standard container dimensions?", type: "public" },
    { label: "Test Sensitive Refusal", query: "how much money does customer Al-Farooq have in their bank balance?", type: "refusal" },
    { label: "Test Write Refusal", query: "delete customer Al-Farooq immediately", type: "refusal" }
  ];

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch("/api/erp/ai/audit");
      if (res.ok) {
        const json = await res.json();
        setAuditLogs(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          sender: "ai",
          text: s.lang === "ur"
            ? "السلام علیکم! میں آپ کا ڈیجیٹل ڈوک ERP بزنس اسسٹنٹ ہوں۔ آپ مجھ سے اپنے مجاز کھاتے، کسٹمرز، کنٹینرز، بلز، ٹاسکس، یا پبلک امپورٹ/ایکسپورٹ گائیڈنس کے متعلق 5 زبانوں (انگریزی، اردو، پشتو، فارسی، عربی) میں بول کر یا لکھ کر پوچھ سکتے ہیں۔"
            : s.lang === "ar"
            ? "مرحباً بك! أنا المساعد الذكي لنظام Digital Dock ERP. يمكنك سؤالي عن السجلات المعتمدة، الحسابات، الحاويات، أو استشارات التجارة الدولية بخمس لغات."
            : s.lang === "fa"
            ? "سلام! من دستیار تجاری هوشمند Digital Dock ERP هستم. می‌توانید سوالات خود را درباره حساب‌ها، مشتریان، بارنامه‌ها و مسیرهای ترانزیتی بپرسید."
            : s.lang === "ps"
            ? "سلامونه! زه ستاسو د Digital Dock ERP هوښیار همکار یم. تاسو کولی شئ د خپلو حسابونو، پیرودونکو، کانټینرونو، او سوداګریزو پوښتنو په اړه پوښتنه وکړئ."
            : "Welcome to DGT ERP AI Business Assistant! You can ask questions about authorized customers, accounts, shipments, customer orders, tasks, or international trade research across 5 languages (English, Urdu, Pashto, Farsi, Arabic).",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          scope: "Verified ERP Security Guarded"
        }
      ]);
    }
  }, [s.lang]);

  const handleSend = async (queryText?: string) => {
    const text = (queryText || inputQuery).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputQuery("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/erp/ai/voice-text/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: text,
          language: s.lang,
          pageContext: "ai_assistant_page"
        })
      });

      const data = await response.json();
      if (data.ok) {
        const aiMsg: ChatMessage = {
          id: "ai-" + Date.now(),
          sender: "ai",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          answerType: data.answerType,
          scope: data.scope,
          sourceRecord: data.sourceRecord,
          sources: data.sources,
          action: data.action,
          refusalReason: data.refusalReason
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || "Failed to process AI query");
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "ai",
          text: `⚠️ Query processing error: ${err.message || "Network / API failure"}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          answerType: "no_record"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 font-sans" dir={s.dir}>
      {/* Top Banner */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="h-full w-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                <Bot className="h-6 w-6 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  DGT ERP AI Business Assistant
                </h1>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  RBAC & Isolation Protected
                </span>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-400/30 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                  DEV TEST ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connected to real DEV database • Context-isolated Voice Entry • Strict field-level access • Real-time audit trail
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "chat" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Enterprise Assistant
            </button>
            <button
              onClick={() => setActiveTab("guidance")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "guidance" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Visual Form Guidance
            </button>
            <button
              onClick={() => setActiveTab("remarks")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "remarks" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Voice Remarks Mic
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                activeTab === "audit" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Security Audit Logs
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col">
        {/* TAB 1: CHAT & RECORD DISCOVERY */}
        {activeTab === "chat" && (
          <div className="flex flex-col flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Quick Prompt Pills */}
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/40 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
              <span className="text-slate-400 flex items-center gap-1 shrink-0 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                Quick Queries:
              </span>
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p.query)}
                  className={`px-2.5 py-1 rounded-lg border text-xs whitespace-nowrap transition-all ${
                    p.type === "refusal"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                      : p.type === "public"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                      : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-cyan-500 hover:text-cyan-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Messages Thread */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((m) => {
                const isAi = m.sender === "ai";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl p-4 shadow-md ${
                        isAi
                          ? "bg-slate-900 border border-slate-800 text-slate-100"
                          : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                      }`}
                    >
                      {/* Header with Badges */}
                      {isAi && (
                        <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-slate-800/80">
                          {m.answerType === "erp_record" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              ERP Record (Verified)
                            </span>
                          )}
                          {m.answerType === "public_external" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                              <Globe className="h-3 w-3" />
                              Public / External Information
                            </span>
                          )}
                          {m.answerType === "permission_denied" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                              <Lock className="h-3 w-3" />
                              Permission Denied (Logged)
                            </span>
                          )}
                          {m.answerType === "write_refused" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                              <ShieldAlert className="h-3 w-3" />
                              Read-Only Guard
                            </span>
                          )}
                          {m.answerType === "no_record" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 border border-slate-600 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                              <Search className="h-3 w-3" />
                              No Record Found
                            </span>
                          )}
                          {m.scope && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              • {m.scope}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Message Text */}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {m.text}
                      </div>

                      {/* Source Record Card & Open Action */}
                      {m.sourceRecord && (
                        <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-xs flex flex-col gap-2">
                          <div className="flex items-center justify-between text-emerald-400 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Database className="h-3.5 w-3.5" />
                              Source Table: {m.sourceRecord.table}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              ID: {m.sourceRecord.id.slice(0, 8)}...
                            </span>
                          </div>
                          <div className="text-slate-300 font-medium">
                            {m.sourceRecord.title} {m.sourceRecord.ref ? `(${m.sourceRecord.ref})` : ""}
                          </div>
                          {m.action && (
                            <a
                              href={m.action.url}
                              className="mt-1 inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition text-xs shadow-md"
                            >
                              <span>{m.action.label}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Public Sources Card */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-blue-500/30 text-xs flex flex-col gap-2">
                          <span className="font-semibold text-blue-400 flex items-center gap-1">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Verified Public Reference Sources:
                          </span>
                          <div className="space-y-1.5">
                            {m.sources.map((src, sIdx) => (
                              <div key={sIdx} className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:underline font-semibold flex items-center gap-1"
                                >
                                  {src.title}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                                {src.summary && <p className="text-[11px] text-slate-400 mt-0.5">{src.summary}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 text-[10px] text-slate-400 flex justify-end">
                        {m.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900 border border-slate-800 p-3 rounded-2xl w-fit animate-pulse">
                  <Bot className="h-4 w-4 text-cyan-400 animate-spin" />
                  <span>Checking authorized ERP records and public knowledge...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center gap-2">
              <VoiceRemarksMic
                onTranscribed={(transcript, mode) => {
                  if (mode === "replace") {
                    setInputQuery(transcript);
                  } else {
                    setInputQuery(prev => prev ? `${prev} ${transcript}` : transcript);
                  }
                }}
                currentValue={inputQuery}
                language={s.lang}
                title="Speak to Assistant"
              />
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  s.lang === "ur"
                    ? "کسٹمر، کھاتہ، بل، کنٹینر، یا تجارتی معلومات لکھیں یا بولیں..."
                    : s.lang === "ar"
                    ? "ابحث عن عميل، حساب، شحنة، أو اسأل عن الشحن والتجارة..."
                    : "Ask about a customer, account, shipment, task, or public trade guidelines..."
                }
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
              <Button
                onClick={() => handleSend()}
                disabled={!inputQuery.trim() || isLoading}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-md shadow-cyan-600/20"
              >
                <span>Send</span>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: VISUAL FORM GUIDANCE */}
        {activeTab === "guidance" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-cyan-400" />
                Phase 6 — Visual Form Guidance Engine
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Context-aware step-by-step guidance overlays dynamically built from active form schemas (New Account, Cash Entry, Purchase Orders).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                  <Building className="h-4 w-4" />
                  New Account Setup Guidance
                </div>
                <p className="text-xs text-slate-300">
                  When a user asks "United branch mein ek achcha sa code banana hai kis tarah banaa", the assistant provides structured step-by-step guidance rather than creating an unrelated purchase order draft.
                </p>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 text-slate-300">
                  <div className="font-semibold text-cyan-300">Steps Prepared:</div>
                  <div>1. Select United Branch</div>
                  <div>2. Choose Account Classification (Asset/Liability)</div>
                  <div>3. Generate Recommended Code (e.g. 1010-001)</div>
                  <div>4. Specify Title & Base Currency</div>
                  <div>5. Review & Confirm before save</div>
                </div>
                <a
                  href="/dashboard/accounts/setup"
                  className="mt-auto inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  Open New Account Setup
                </a>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                  <CreditCard className="h-4 w-4" />
                  Cash & Journal Entry Guidance
                </div>
                <p className="text-xs text-slate-300">
                  Ensures debit/credit balancing, party ledger selection, and required narration without guessing missing fields.
                </p>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 text-slate-300">
                  <div className="font-semibold text-cyan-300">Steps Prepared:</div>
                  <div>1. Select Cash Account or Vault</div>
                  <div>2. Select Opposing Party / Ledger</div>
                  <div>3. Enter Amount & Currency</div>
                  <div>4. Record Narration via Voice Dictation</div>
                  <div>5. Verify Balance = 0 before post</div>
                </div>
                <a
                  href="/dashboard/roznamcha"
                  className="mt-auto inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  Open Daily Roznamcha
                </a>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                  <Truck className="h-4 w-4" />
                  Customer Order & Route Legs
                </div>
                <p className="text-xs text-slate-300">
                  Validates multimodal transit legs (Sea, Road, Customs Border) and prevents cross-module schema drift.
                </p>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 text-slate-300">
                  <div className="font-semibold text-cyan-300">Steps Prepared:</div>
                  <div>1. Select Registered Customer</div>
                  <div>2. Choose Corridor (e.g. Karachi → Quetta)</div>
                  <div>3. Enter Cargo & Packaging Description</div>
                  <div>4. Allocate Transit Route Legs & BL</div>
                  <div>5. Confirm Dispatch</div>
                </div>
                <a
                  href="/dashboard/smart-operations"
                  className="mt-auto inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  Open Customer Orders
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VOICE REMARKS MIC */}
        {activeTab === "remarks" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Mic className="h-5 w-5 text-cyan-400" />
                Phase 7 — Reusable Voice-to-Text for Notes & Remarks
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                One standardized, secure microphone component connected across all ERP Notes, Remarks, Description, and Narration fields.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 max-w-2xl flex flex-col gap-4">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Demo Remarks Field (Interactive Verification):</span>
                <span className="text-[11px] text-slate-500">Live preview & Append/Replace toggle</span>
              </label>

              <div className="relative">
                <textarea
                  rows={4}
                  value={demoRemarks}
                  onChange={(e) => setDemoRemarks(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  placeholder="Notes, Narration, Description, or Handover instructions..."
                />
                <div className="absolute bottom-3 right-3">
                  <VoiceRemarksMic
                    onTranscribed={(transcript, mode) => {
                      if (mode === "replace") {
                        setDemoRemarks(transcript);
                      } else {
                        setDemoRemarks(prev => prev ? `${prev} ${transcript}` : transcript);
                      }
                    }}
                    currentValue={demoRemarks}
                    language={s.lang}
                    title="Dictate Remarks"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-400 bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="font-semibold text-cyan-400">Guaranteed Safeguards:</div>
                <div>• Start, Pause, Resume, Stop controls with MM:SS audio timer.</div>
                <div>• Verbatim transcription in 5 languages (English, Urdu, Pashto, Farsi, Arabic).</div>
                <div>• NEVER silently rewrites, translates, or alters spoken text without user intent.</div>
                <div>• User reviews transcript in modal and decides to "Append" or "Replace".</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LOGS */}
        {activeTab === "audit" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="h-5 w-5 text-cyan-400" />
                  Phase 9 — Real-Time AI Security Audit Trail
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Immutable database audit history stored in public.ai_assistant_audit_logs recording queries, language, permission decisions, and refusals.
                </p>
              </div>
              <Button
                onClick={fetchAuditLogs}
                disabled={loadingAudit}
                variant="outline"
                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingAudit ? "animate-spin" : ""}`} />
                Refresh Logs
              </Button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <Th className="px-4 py-3">Timestamp</Th>
                    <Th className="px-4 py-3">User</Th>
                    <Th className="px-4 py-3">Lang</Th>
                    <Th className="px-4 py-3">Query Type</Th>
                    <Th className="px-4 py-3">Decision</Th>
                    <Th className="px-4 py-3">Query</Th>
                    <Th className="px-4 py-3">Refusal Reason</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        {loadingAudit ? "Loading audit records..." : "No AI audit records found."}
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/60 transition">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-white whitespace-nowrap">
                          {log.user_name}
                        </td>
                        <td className="px-4 py-2.5 uppercase font-mono text-[10px]">
                          {log.detected_language}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono border border-slate-700">
                            {log.query_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {log.permission_decision === "allowed" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="h-3 w-3" />
                              Allowed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                              <Lock className="h-3 w-3" />
                              Refused
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-xs truncate" title={log.query}>
                          {log.query}
                        </td>
                        <td className="px-4 py-2.5 max-w-xs truncate text-rose-300 text-[11px]" title={log.refusal_reason || "None"}>
                          {log.refusal_reason || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
