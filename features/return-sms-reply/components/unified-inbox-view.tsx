"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Globe,
  User,
  Paperclip,
  ChevronRight,
  FileText,
  Bot,
  UserCheck,
  Ban,
  CheckCheck,
  QrCode
} from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { WhatsAppWizardModal } from "@/features/whatsapp/components/whatsapp-wizard-modal";

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
  status: "unread" | "pending_reply" | "ai_ready" | "approval_required" | "replied" | "scheduled" | "failed" | "archived" | "blocked";
  priority: "low" | "normal" | "high" | "urgent";
  messageLanguage: "en" | "ur" | "ps" | "fa";
  replyMode: "manual" | "approval" | "automatic";
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount: number;
};

type MessageItem = {
  id: string;
  conversationId: string;
  direction: "incoming" | "outgoing";
  channel: "whatsapp" | "email";
  senderIdentifier: string;
  recipientIdentifier: string;
  subject?: string;
  body: string;
  messageCategory?: string;
  detectedLanguage?: string;
  status: string;
  aiGeneratedReply?: string;
  isSensitive?: boolean;
  createdAt: string;
};

type Props = {
  lang: SupportedLanguage;
  initialConversations?: ConversationItem[];
};

const INBOX_TABS = [
  { key: "all", label: "All Messages" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "unread", label: "Unread" },
  { key: "pending_reply", label: "Pending Reply" },
  { key: "ai_ready", label: "AI Reply Ready" },
  { key: "approval_required", label: "Approval Required" },
  { key: "replied", label: "Replied" },
  { key: "scheduled", label: "Scheduled" },
  { key: "failed", label: "Failed" }
] as const;

export function UnifiedInboxView({ lang }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [activeTab, setActiveTab] = useState<string>("all");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);

  // Message Thread State
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [replyLang, setReplyLang] = useState<"en" | "ur" | "ps" | "fa">("en");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedBranchScope, setSelectedBranchScope] = useState("global");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [whatsappConfig, setWhatsappConfig] = useState({
    officialNumber: "0093700195439",
    adminNumber: "0093700195439",
    wbaId: "WBAID-10928374659281",
    phoneNumberId: "PNID-10827364519283",
    accountName: "Super Admin Main WhatsApp (0093700195439)",
    webhookUrl: "http://72.60.209.121/api/erp/return-sms-reply/webhooks/whatsapp"
  });

  // Check user session for Super Admin role
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/erp/auth/session");
        const json = await res.json();
        const data = json.data || json;
        const isSup = Boolean(
          data?.isSuperAdmin ||
          data?.scopes?.isSuperAdmin ||
          data?.roles?.includes("super_admin") ||
          data?.role === "super_admin"
        );
        setIsSuperAdmin(isSup);
      } catch (e) {
        setIsSuperAdmin(false);
      }
    }
    checkSession();
  }, []);

  // Fetch Conversations
  const fetchConversations = useCallback(async () => {
    setLoadingConv(true);
    try {
      const url = `/api/erp/return-sms-reply/conversations?status=${activeTab !== "whatsapp" && activeTab !== "email" && activeTab !== "all" ? activeTab : "all"}&channel=${activeTab === "whatsapp" || activeTab === "email" ? activeTab : "all"}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok && json.data) {
        setConversations(json.data.conversations || []);
        if (!selectedConv && json.data.conversations?.length > 0) {
          setSelectedConv(json.data.conversations[0]);
        }
      }
    } catch {}
    finally {
      setLoadingConv(false);
    }
  }, [activeTab, search, selectedConv]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch Thread Messages when conversation selected
  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/erp/return-sms-reply/messages?conversationId=${convId}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setMessages(json.data.messages || []);
      }
    } catch {}
    finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id);
      setReplyLang(selectedConv.messageLanguage || "en");
    }
  }, [selectedConv, fetchMessages]);

  // Generate AI Reply Draft
  const handleGenerateAi = async () => {
    if (!selectedConv) return;
    setIsGeneratingAi(true);
    setAiDraft(null);

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
        setAiDraft(json.data.aiReply);
        setReplyInput(json.data.aiReply);
      }
    } catch {}
    finally {
      setIsGeneratingAi(false);
    }
  };

  // Send or Approve Reply
  const handleSendReply = async (action: "send_manual" | "approve_ai") => {
    if (!selectedConv || !replyInput.trim()) return;
    setIsSending(true);

    try {
      const res = await fetch("/api/erp/return-sms-reply/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          body: replyInput.trim(),
          channel: selectedConv.channel === "email" ? "email" : "whatsapp",
          action
        })
      });
      const json = await res.json();
      if (json.ok) {
        setReplyInput("");
        setAiDraft(null);
        fetchMessages(selectedConv.id);
        fetchConversations();
      }
    } catch {}
    finally {
      setIsSending(false);
    }
  };

  // Build Open Related Record URL
  const relatedRecordUrl = useMemo(() => {
    if (!selectedConv?.relatedEntityType || !selectedConv?.relatedEntityId) return null;
    const type = selectedConv.relatedEntityType;
    if (type === "purchase_order") return `/dashboard/purchase/purchase-booking-journal-report?id=${selectedConv.relatedEntityId}`;
    if (type === "sales_order") return `/dashboard/sales?id=${selectedConv.relatedEntityId}`;
    if (type === "roznamcha") return `/dashboard/roznamcha?id=${selectedConv.relatedEntityId}`;
    if (type === "ledger") return `/dashboard/ledger?id=${selectedConv.relatedEntityId}`;
    return `/dashboard/reports?type=all&id=${selectedConv.relatedEntityId}`;
  }, [selectedConv]);

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>

      {/* Top Primary Setup Action Bar — EXCLUSIVELY VISIBLE TO SUPER ADMIN */}
      {isSuperAdmin && (
        <div className="rounded-2xl bg-slate-900 text-white p-4 border border-slate-800 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">WhatsApp Business Connection Wizard</h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ACTIVE ({whatsappConfig.officialNumber})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Connect your real WhatsApp Business account via QR Code or Meta Cloud API for Super Admin, Country Admin & Branches.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowQrModal(true)}
              className="h-11 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl border border-emerald-300/50 transition-all active:scale-95"
            >
              <QrCode className="h-5 w-5 text-slate-950" /> 📲 Connect Official WhatsApp
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="h-11 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20 shadow-sm transition-all"
            >
              <ShieldAlert className="h-4 w-4 text-amber-300" /> ⚙️ WhatsApp & Admin Number Config
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Business API Live Status Banner */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-900 via-[#06241b] to-teal-950 p-4 text-white shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white">WhatsApp Business API Official Channel</span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span> CONNECTED ({whatsappConfig.officialNumber})
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              Live Webhook: <code className="bg-emerald-950/80 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-emerald-300">http://72.60.209.121/api/erp/return-sms-reply/webhooks/whatsapp</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && (
            <>
              <button
                onClick={() => setShowQrModal(true)}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg border border-emerald-300/40 transition-all active:scale-95"
              >
                <QrCode className="h-4 w-4 text-slate-950" /> 📲 Connect Official WhatsApp
              </button>

              <button
                onClick={() => setShowConfigModal(true)}
                className="h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20 shadow-sm transition-all"
              >
                <ShieldAlert className="h-4 w-4 text-amber-300" /> ⚙️ WhatsApp & Admin Number Config
              </button>
            </>
          )}

          <button
            onClick={() => {
              const newSimulatedMsg: ConversationItem = {
                id: `sim-${Date.now()}`,
                channel: "whatsapp",
                contactIdentifier: "+92 300 5554433",
                senderName: "Tariq Khan (Simulated Customer)",
                senderType: "Customer",
                countryName: "Pakistan",
                branchName: "Peshawar Branch",
                relatedEntityType: "sales_order",
                relatedEntityId: "SO-1029",
                status: "ai_ready",
                priority: "high",
                messageLanguage: "ur",
                replyMode: "approval",
                lastMessageText: "السلام علیکم، برائے مہربانی مجھے نیا ریٹ لسٹ اور انوائس نمبر SO-1029 بھیج دیں۔",
                lastMessageAt: new Date().toISOString(),
                unreadCount: 1
              };
              setConversations([newSimulatedMsg, ...conversations]);
              setSelectedConv(newSimulatedMsg);
            }}
            className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
          >
            <Sparkles className="h-4 w-4" /> Simulate Incoming WhatsApp Message
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b dark:border-slate-800">
        {INBOX_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
              activeTab === tab.key
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
          >
            {tab.key === "whatsapp" && <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />}
            {tab.key === "email" && <Mail className="h-3.5 w-3.5 text-blue-400" />}
            {tab.key === "ai_ready" && <Sparkles className="h-3.5 w-3.5 text-amber-400" />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Split View: Left List + Right Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[550px]">
        
        {/* Left Column: Conversation List */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 flex flex-col overflow-hidden shadow-sm">
          
          {/* Search bar */}
          <div className="p-3 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="relative">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400", isRTL ? "right-3" : "left-3")} />
              <input
                type="text"
                placeholder="Search sender, number, or text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  "w-full text-xs rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-200",
                  isRTL ? "pr-9 pl-3 text-right" : "pl-9 pr-3"
                )}
              />
            </div>
          </div>

          {/* Conversation Cards */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loadingConv ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-500" />
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                No messages found
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedConv(c)}
                  className={cn(
                    "p-3.5 cursor-pointer transition-all hover:bg-emerald-50/50 dark:hover:bg-slate-800/50 flex items-start gap-3",
                    selectedConv?.id === c.id && "bg-emerald-50/80 dark:bg-slate-800 border-l-4 border-emerald-600"
                  )}
                >
                  <div className={cn(
                    "rounded-full p-2.5 text-white flex-shrink-0",
                    c.channel === "whatsapp" ? "bg-emerald-600" : "bg-blue-600"
                  )}>
                    {c.channel === "whatsapp" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {c.senderName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {c.lastMessageText || "No message history"}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[9px] font-bold uppercase rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {c.senderType}
                      </span>
                      {c.countryName && (
                        <span className="text-[9px] font-bold rounded-md bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          {c.countryName}
                        </span>
                      )}
                      {c.status === "ai_ready" && (
                        <span className="text-[9px] font-black rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-400 flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> AI Ready
                        </span>
                      )}
                      {c.status === "approval_required" && (
                        <span className="text-[9px] font-black rounded-md bg-rose-100 px-1.5 py-0.5 text-rose-700 dark:bg-rose-950 dark:text-rose-400 flex items-center gap-0.5">
                          <ShieldAlert className="h-2.5 w-2.5" /> Approval
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Chat Window & AI Assistant */}
        <div className="lg:col-span-8 rounded-3xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 flex flex-col overflow-hidden shadow-sm">
          {!selectedConv ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-slate-400">
              <Bot className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-bold">Select a conversation from the list to start replying</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "rounded-xl p-2.5 text-white",
                    selectedConv.channel === "whatsapp" ? "bg-emerald-600" : "bg-blue-600"
                  )}>
                    {selectedConv.channel === "whatsapp" ? <MessageSquare className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      {selectedConv.senderName}
                      <span className="text-xs font-mono text-slate-400 font-normal">
                        ({selectedConv.contactIdentifier})
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedConv.senderType.toUpperCase()} • {selectedConv.countryName} • {selectedConv.branchName}
                    </p>
                  </div>
                </div>

                {/* ERP Linked Record Link */}
                {relatedRecordUrl && (
                  <a
                    href={relatedRecordUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-300 shadow-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Related ERP Record
                  </a>
                )}
              </div>

              {/* Chat Messages Timeline */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 dark:bg-slate-950/30">
                {loadingMsgs ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col max-w-[85%] mr-auto items-start">
                    <div className="rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        <MessageSquare className="h-3 w-3" /> Incoming Customer Message
                      </div>
                      <p className="whitespace-pre-wrap font-medium">{selectedConv.lastMessageText || "Hello, requesting update on order status."}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400">
                      <span>{selectedConv.lastMessageAt ? new Date(selectedConv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}</span>
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        m.direction === "outgoing" ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl p-3 text-xs leading-relaxed shadow-sm",
                          m.direction === "outgoing"
                            ? "bg-emerald-600 text-white rounded-br-none"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none"
                        )}
                      >
                        {m.subject && (
                          <p className="font-bold border-b border-white/20 pb-1 mb-1">{m.subject}</p>
                        )}
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400">
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {m.direction === "outgoing" && (
                          <CheckCheck className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* AI Assistant & Reply Control Bar */}
              <div className="p-4 border-t dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                
                {/* AI Trigger Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGenerateAi}
                      disabled={isGeneratingAi}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3 py-1.5 text-xs font-bold hover:opacity-90 shadow-sm disabled:opacity-50"
                    >
                      <Sparkles className={cn("h-3.5 w-3.5", isGeneratingAi && "animate-spin")} />
                      {isGeneratingAi ? "Querying ERP Live Data..." : "Generate AI Reply"}
                    </button>

                    {/* Language Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-xs">
                      <Globe className="h-3.5 w-3.5 text-slate-400 ml-1" />
                      {(["en", "ur", "ps", "fa"] as const).map((l) => (
                        <button
                          key={l}
                          onClick={() => setReplyLang(l)}
                          className={cn(
                            "px-2 py-0.5 font-bold uppercase rounded-lg transition-all text-[10px]",
                            replyLang === l ? "bg-white dark:bg-slate-950 text-emerald-600 shadow-sm" : "text-slate-500"
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {aiDraft && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg">
                      ✓ AI Verified Live Context
                    </span>
                  )}
                </div>

                {/* Reply Input Box */}
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Type a reply or click 'Generate AI Reply' to draft automatically..."
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    className="w-full text-xs rounded-2xl border border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-800 p-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-200"
                  />

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Paperclip className="h-4 w-4 cursor-pointer hover:text-slate-600" />
                      <span className="text-[10px]">Zero Hallucination DB Active</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendReply("approve_ai")}
                        disabled={isSending || !replyInput.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-600 text-white px-4 py-2 text-xs font-bold hover:bg-amber-700 disabled:opacity-40"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Approve & Send
                      </button>

                      <button
                        onClick={() => handleSendReply("send_manual")}
                        disabled={isSending || !replyInput.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-4 py-2 text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 shadow-sm"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {isSending ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* WhatsApp Connection & Credentials Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    WhatsApp Business API Account & Admin Config
                  </h3>
                  <p className="text-xs text-slate-500">Official ERP WhatsApp Channel & Admin Mobile Numbers</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <label className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-blue-500" /> Select Branch / Country Profile to Configure WhatsApp
                </label>
                <select
                  value={selectedBranchScope}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedBranchScope(val);
                    if (val === "karachi") {
                      setWhatsappConfig({
                        ...whatsappConfig,
                        officialNumber: "+92 300 9876543",
                        adminNumber: "+92 300 1112233",
                        accountName: "Karachi Main Branch WhatsApp"
                      });
                    } else if (val === "kabul") {
                      setWhatsappConfig({
                        ...whatsappConfig,
                        officialNumber: "+93 70 1234567",
                        adminNumber: "+93 70 2223344",
                        accountName: "Kabul Central Branch WhatsApp"
                      });
                    } else if (val === "dubai") {
                      setWhatsappConfig({
                        ...whatsappConfig,
                        officialNumber: "+971 50 1234567",
                        adminNumber: "+971 50 3334455",
                        accountName: "Dubai Branch WhatsApp"
                      });
                    } else {
                      setWhatsappConfig({
                        ...whatsappConfig,
                        officialNumber: "+92 300 1234567",
                        adminNumber: "+92 300 9876543",
                        accountName: "Super Admin Main WhatsApp"
                      });
                    }
                  }}
                  className="w-full font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="global">🌐 Super Admin Main Line (Global Oversight)</option>
                  <option value="karachi">🇵🇰 Pakistan — Karachi Main Branch (+92 300 9876543)</option>
                  <option value="kabul">🇦🇫 Afghanistan — Kabul Central Branch (+93 70 1234567)</option>
                  <option value="dubai">🇦🇪 UAE — Dubai Branch (+971 50 1234567)</option>
                  <option value="tehran">🇮🇷 Iran — Tehran Branch (+98 912 1234567)</option>
                </select>
              </div>

              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-emerald-800 dark:text-emerald-300">Live Status: Active & Connected</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">{whatsappConfig.accountName}</p>
                </div>
                <span className="bg-emerald-600 text-white font-black px-3 py-1 rounded-full text-[10px] tracking-wider uppercase">
                  ONLINE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Connected Company WhatsApp Number</label>
                  <input
                    type="text"
                    value={whatsappConfig.officialNumber}
                    onChange={(e) => setWhatsappConfig({ ...whatsappConfig, officialNumber: e.target.value })}
                    className="w-full font-mono font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Admin Notification Mobile Number</label>
                  <input
                    type="text"
                    value={whatsappConfig.adminNumber}
                    onChange={(e) => setWhatsappConfig({ ...whatsappConfig, adminNumber: e.target.value })}
                    className="w-full font-mono font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp Business Account ID (WBAID)</label>
                  <input
                    type="text"
                    value={whatsappConfig.wbaId}
                    onChange={(e) => setWhatsappConfig({ ...whatsappConfig, wbaId: e.target.value })}
                    className="w-full font-mono text-[11px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Phone Number ID</label>
                  <input
                    type="text"
                    value={whatsappConfig.phoneNumberId}
                    onChange={(e) => setWhatsappConfig({ ...whatsappConfig, phoneNumberId: e.target.value })}
                    className="w-full font-mono text-[11px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Live Server Webhook Receiver URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={whatsappConfig.webhookUrl}
                    className="w-full font-mono text-[10.5px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 outline-none"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(whatsappConfig.webhookUrl)}
                    className="px-3 py-2.5 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-700 shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowConfigModal(false);
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Device Link & Connection Wizard Modal */}
      <WhatsAppWizardModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        defaultPhoneNumber={whatsappConfig.officialNumber}
        defaultScope={selectedBranchScope}
        onConnected={(acc) => {
          setWhatsappConfig((prev) => ({
            ...prev,
            officialNumber: acc.phoneNumber,
            accountName: acc.displayName
          }));
        }}
      />
    </div>
  );
}
