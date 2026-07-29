"use client";

import { useState, useCallback } from "react";
import {
  MessageSquare,
  CheckCircle2,
  Send,
  Loader2,
  ShieldCheck,
  Check,
  Smartphone,
  Building2,
  Globe2,
  FileText,
  Bot,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  defaultPhoneNumber?: string;
  defaultScope?: string;
  onConnected?: (account: any) => void;
};

export function WhatsAppWizardModal({
  isOpen,
  onClose,
  defaultPhoneNumber = "00971544816664",
  defaultScope = "super_admin",
  onConnected
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [scope, setScope] = useState(defaultScope);
  const [displayName, setDisplayName] = useState("Super Admin Dubai WhatsApp Business");
  const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber || "00971544816664");

  // Live Meta verification state
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<any>(null);

  // Test Send State (Step 2)
  const [testRecipient, setTestRecipient] = useState(defaultPhoneNumber || "00971544816664");
  const [testMessage, setTestMessage] = useState("Hello from Digital Dock ERP! Official Meta WhatsApp connection is live.");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Handle Branch Scope Selection
  const handleScopeChange = (val: string) => {
    setScope(val);
    if (val === "super_admin") {
      setDisplayName("Super Admin Dubai Main Line");
      setPhoneNumber("00971544816664");
      setTestRecipient("00971544816664");
    } else if (val === "uae") {
      setDisplayName("UAE Branch Official WhatsApp");
      setPhoneNumber("00971544816664");
      setTestRecipient("00971544816664");
    } else if (val === "pakistan") {
      setDisplayName("Pakistan Branch Official WhatsApp");
      setPhoneNumber("00923009876543");
      setTestRecipient("00923009876543");
    } else if (val === "afghanistan") {
      setDisplayName("Afghanistan Branch Official WhatsApp");
      setPhoneNumber("0093700123456");
      setTestRecipient("0093700123456");
    } else if (val === "turkey") {
      setDisplayName("Turkey Branch Official WhatsApp");
      setPhoneNumber("00905301234567");
      setTestRecipient("00905301234567");
    }
  };

  // ── Verify & Activate Official Meta Line ─────────────────────────────────
  async function handleVerifyAndConnect() {
    const cleanPhone = (phoneNumber || "").trim();
    if (!cleanPhone) {
      setVerifyError("Please enter a valid WhatsApp phone number.");
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    setVerifiedData(null);

    try {
      // Call verify endpoint which tests server Meta credentials against Graph API
      const res = await fetch("/api/erp/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: cleanPhone })
      });
      const json = await res.json();
      const data = json.data || json;

      if (data.verified || data.display_phone_number || data.verified_name) {
        // Save connected account to DB
        const accRes = await fetch("/api/erp/whatsapp/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            displayName: displayName || data.verified_name || `WhatsApp (${cleanPhone})`,
            phoneNumber: cleanPhone
          })
        });
        const accJson = await accRes.json();
        const accData = accJson.data || accJson;

        setVerifiedData(data);
        setStep(2);

        if (onConnected) {
          onConnected({
            accountId: accData.accountId,
            phoneNumber: cleanPhone,
            displayName,
            status: "CONNECTED"
          });
        }
      } else {
        const errText = typeof data.error === "string"
          ? data.error
          : data.error?.message || "Server Meta Access Token or Phone Number ID is unverified. Please configure META_WHATSAPP_TOKEN in server env.";
        setVerifyError(errText);
      }
    } catch (e: any) {
      setVerifyError(e?.message || "Failed to verify Meta WhatsApp connection.");
    } finally {
      setVerifying(false);
    }
  }

  // ── Send Live Test Message via Meta Cloud API ────────────────────────────
  async function handleSendTestMessage() {
    const cleanRecipient = (testRecipient || "").trim();
    if (!cleanRecipient) return;
    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/erp/whatsapp/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderNumber: phoneNumber,
          recipientNumber: testRecipient,
          messageText: testMessage,
          scope
        })
      });
      const json = await res.json();
      setTestResult(json.data || json);
    } catch (e: any) {
      setTestResult({ success: false, status: "NETWORK_ERROR", details: e?.message });
    } finally {
      setSendingTest(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                Connect Official Meta WhatsApp
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Direct Cloud API Integration — Multi-Branch Enterprise Connection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-bold">
          {[
            { n: 1, label: "Select Branch Line & Verify" },
            { n: 2, label: "Live Connection & Send Test Message" }
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black",
                step >= s.n ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
              )}>
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className={cn(step >= s.n ? "text-emerald-600 font-extrabold" : "text-slate-400")}>{s.label}</span>
              {s.n < 2 && <span className="text-slate-300 dark:text-slate-700">→</span>}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Select Branch Line & Verify Meta API ────────────────── */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <p className="font-black text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm">
                <Globe2 className="h-4 w-4 text-emerald-600" />
                Multi-Branch Official Meta WhatsApp
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11.5px]">
                Select your branch line below. The system automatically connects directly to the server&apos;s verified Meta Cloud API pipeline.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Select Branch / Country Line</label>
                <select
                  value={scope}
                  onChange={(e) => handleScopeChange(e.target.value)}
                  className="w-full font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none text-xs"
                >
                  <option value="super_admin">🌐 Global Head Office (Dubai)</option>
                  <option value="uae">🇦🇪 UAE Branch (Dubai Line)</option>
                  <option value="pakistan">🇵🇰 Pakistan Branch (Karachi / Chaman)</option>
                  <option value="afghanistan">🇦🇫 Afghanistan Branch (Kabul)</option>
                  <option value="turkey">🇹🇷 Turkey Branch (Istanbul)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Display Line Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp Phone Number</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="00971544816664"
                className="w-full font-mono font-bold p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10.5px] text-slate-400">Enter your branch WhatsApp phone number e.g. 00971544816664</p>
            </div>

            {verifyError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-mono text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  Meta Connection Error:
                </p>
                <p>{typeof verifyError === "string" ? verifyError : JSON.stringify(verifyError)}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
              <p className="text-[10.5px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Server Meta Credentials Protected
              </p>
              <button
                onClick={handleVerifyAndConnect}
                disabled={verifying || !phoneNumber.trim()}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {verifying ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verifying Meta Credentials...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Connect & Verify WhatsApp Line</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Connection Active & Send Test Message ───────────────── */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <p className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5" /> Official Meta WhatsApp Line Connected & Active!
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11.5px]">
                Your branch line (<strong className="text-emerald-600 font-bold">{phoneNumber}</strong>) is verified and linked. The ERP can now automatically process messages, AI auto-replies, payment reminders, and PDF reports.
              </p>
            </div>

            {/* Messaging Feature Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10.5px] font-bold">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex flex-col items-center gap-1">
                <Bot className="h-4 w-4 text-emerald-500" />
                AI Auto-Replies
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex flex-col items-center gap-1">
                <FileText className="h-4 w-4 text-emerald-500" />
                Invoices & PDFs
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex flex-col items-center gap-1">
                <Building2 className="h-4 w-4 text-emerald-500" />
                Branch Isolation
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex flex-col items-center gap-1">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
                Unified Inbox
              </div>
            </div>

            {/* Send Live Test Message Panel */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-600" /> Send Live Test WhatsApp Message
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Sender Line</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    readOnly
                    className="w-full font-mono p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 outline-none text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Recipient Phone Number</label>
                  <input
                    type="text"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="00971544816664"
                    className="w-full font-mono p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Message Content</label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <button
                onClick={handleSendTestMessage}
                disabled={sendingTest || !testRecipient.trim()}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {sendingTest ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending via Meta Cloud API...</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Test Message Now</>
                )}
              </button>

              {testResult && (
                <div className={cn(
                  "p-3.5 rounded-xl border font-mono text-[11px] space-y-1.5",
                  testResult.metaSuccess || testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200"
                )}>
                  <p className="font-black text-sm">
                    {testResult.metaSuccess ? "✓ Message Delivered to WhatsApp Network" : `Result: ${testResult.status || "SENT"}`}
                  </p>
                  {testResult.wamid && (
                    <p>WAMID: <span className="font-bold text-emerald-600">{testResult.wamid}</span></p>
                  )}
                  {testResult.details && (
                    <p className="text-[10.5px] opacity-90">
                      {typeof testResult.details === "string" ? testResult.details : JSON.stringify(testResult.details)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-xs"
              >
                ← Change Line / Branch
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md cursor-pointer"
              >
                Done — Close Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
