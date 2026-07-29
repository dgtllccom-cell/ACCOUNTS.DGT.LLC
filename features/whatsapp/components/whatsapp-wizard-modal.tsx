"use client";

import { useState, useCallback } from "react";
import {
  MessageSquare,
  CheckCircle2,
  Send,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  XCircle,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Lock
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scope, setScope] = useState(defaultScope);
  const [displayName, setDisplayName] = useState("Super Admin Dubai WhatsApp Business");
  const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber);

  // 6-Digit OTP State
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSentStatus, setOtpSentStatus] = useState<any>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Advanced Developer Mode Toggle & Custom Credentials State
  const [showAdvancedMeta, setShowAdvancedMeta] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("digitaldock_webhook_2026");
  const [verifyingMeta, setVerifyingMeta] = useState(false);
  const [metaResult, setMetaResult] = useState<any>(null);

  // Test Send State (Step 3)
  const [testRecipient, setTestRecipient] = useState(defaultPhoneNumber);
  const [testMessage, setTestMessage] = useState("Hello from Digital Dock ERP! Your official Meta WhatsApp connection is live.");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const webhookUrl = "http://72.60.209.121/api/erp/return-sms-reply/webhooks/whatsapp";

  // ── Send 6-Digit Verification Code via Official Meta WhatsApp ─────────────
  async function handleSendOtp() {
    if (!phoneNumber.trim()) {
      setOtpError("Please enter a valid WhatsApp phone number.");
      return;
    }
    setSendingOtp(true);
    setOtpError(null);
    setOtpSentStatus(null);

    try {
      const res = await fetch("/api/erp/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim(), scope })
      });
      const json = await res.json();
      const data = json.data || json;

      setOtpSentStatus(data);
      if (data.otpCode) {
        setOtpCode(data.otpCode); // Auto-fill generated OTP for instant verification
      }
    } catch (e: any) {
      setOtpError(e?.message || "Failed to send verification code");
    } finally {
      setSendingOtp(false);
    }
  }

  // ── Verify 6-Digit Code & Link WhatsApp ────────────────────────────────────
  async function handleVerifyOtp() {
    if (!otpCode.trim()) {
      setOtpError("Please enter the 6-digit verification code.");
      return;
    }
    setVerifyingOtp(true);
    setOtpError(null);

    try {
      const res = await fetch("/api/erp/whatsapp/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          otpCode: otpCode.trim(),
          scope,
          displayName: displayName || `WhatsApp (${phoneNumber})`
        })
      });
      const json = await res.json();
      const data = json.data || json;

      if (data.success || data.accountId) {
        setStep(3);
        if (onConnected) {
          onConnected({
            accountId: data.accountId,
            phoneNumber,
            displayName,
            status: "CONNECTED"
          });
        }
      } else {
        setOtpError(data.error || "Verification failed. Check the 6-digit code.");
      }
    } catch (e: any) {
      setOtpError(e?.message || "Verification error");
    } finally {
      setVerifyingOtp(false);
    }
  }

  // ── Advanced Meta Manual Verification ─────────────────────────────────────
  async function handleVerifyMetaManual() {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setOtpError("Phone Number ID and Access Token are required in Developer mode.");
      return;
    }
    setVerifyingMeta(true);
    setMetaResult(null);

    try {
      const res = await fetch("/api/erp/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId: phoneNumberId.trim(), accessToken: accessToken.trim() })
      });
      const json = await res.json();
      const result = json.data || json;
      setMetaResult(result);

      if (result.verified) {
        // Save account
        const saveRes = await fetch("/api/erp/whatsapp/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            displayName: displayName || result.verifiedName || phoneNumber,
            phoneNumber: phoneNumber || result.displayPhoneNumber || "",
            phoneNumberId: phoneNumberId.trim(),
            wabaId: wabaId.trim() || "WABAID-CUSTOM",
            accessToken: accessToken.trim(),
            verifyToken: verifyToken.trim()
          })
        });
        const saveJson = await saveRes.json();
        const saveData = saveJson.data || saveJson;
        if (saveData.accountId) {
          setStep(3);
          if (onConnected) onConnected({ accountId: saveData.accountId, phoneNumber, status: "CONNECTED" });
        }
      }
    } catch (e: any) {
      setMetaResult({ error: { message: e?.message || "Network error" } });
    } finally {
      setVerifyingMeta(false);
    }
  }

  // ── Send Test Message (Step 3) ─────────────────────────────────────────────
  async function handleSendTestMessage() {
    if (!testRecipient.trim()) return;
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
                Connect Official WhatsApp
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official Meta WhatsApp Cloud API — Direct & Secure Connection
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
            { n: 1, label: "Enter Number" },
            { n: 2, label: "6-Digit Code Verification" },
            { n: 3, label: "Live Connection Ready" }
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black",
                step >= s.n ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
              )}>
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className={cn(step >= s.n ? "text-emerald-600 font-extrabold" : "text-slate-400")}>{s.label}</span>
              {s.n < 3 && <span className="text-slate-300 dark:text-slate-700">→</span>}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Enter Number & Scope ─────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <p className="font-black text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm">
                <Smartphone className="h-4 w-4 text-emerald-600" />
                Meta Cloud API Verification Flow
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11.5px]">
                Enter your WhatsApp phone number below. The system will dispatch an official 6-digit Meta verification code directly to your WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Account Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none text-xs"
                >
                  <option value="super_admin">🌐 Super Admin (Global Dubai Main Line)</option>
                  <option value="country">🏳️ Country Level</option>
                  <option value="country_branch">🏢 Country Branch</option>
                  <option value="city_branch">🏙️ City Branch</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Display Account Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Super Admin Dubai WhatsApp"
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
              <p className="text-[10.5px] text-slate-400">Must be your registered WhatsApp line e.g. 00971544816664</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md cursor-pointer transition-all flex items-center gap-2"
              >
                Proceed to Verification Code →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: 6-Digit Code Verification ───────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            {/* Standard Official Verification Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Step 1: Request 6-Digit Verification Code
              </h4>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="font-mono font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex-1 outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send 6-Digit Code
                </button>
              </div>

              {otpSentStatus && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 space-y-1 font-mono text-[11px]">
                  <p className="font-bold">✓ {otpSentStatus.message}</p>
                  {otpSentStatus.formattedE164 && (
                    <p>Recipient: {otpSentStatus.formattedE164}</p>
                  )}
                  {otpSentStatus.otpCode && (
                    <p className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                      Generated Code: {otpSentStatus.otpCode}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Enter 6-Digit Code */}
              <div className="space-y-1.5 pt-2 border-t dark:border-slate-800">
                <label className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  Step 2: Enter the 6-Digit Code Received on WhatsApp
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono text-center text-lg font-black tracking-widest p-2.5 rounded-xl border border-emerald-500/40 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 w-44 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || !otpCode.trim()}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-lg transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2"
                  >
                    {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Verify Code & Link WhatsApp
                  </button>
                </div>
              </div>

              {otpError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-mono text-[11px]">
                  ❌ {otpError}
                </div>
              )}
            </div>

            {/* Optional Collapsible Advanced Meta Manual Token Entry */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedMeta(!showAdvancedMeta)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {showAdvancedMeta ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                ⚙️ Advanced Meta Developer Setup (Manual Credentials Override)
              </button>

              {showAdvancedMeta && (
                <div className="mt-3 p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <p className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Optional Developer Token Override
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-600">Phone Number ID</label>
                      <input
                        type="text"
                        value={phoneNumberId}
                        onChange={(e) => setPhoneNumberId(e.target.value)}
                        placeholder="e.g. 123456789012345"
                        className="w-full font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600">WABA ID</label>
                      <input
                        type="text"
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        placeholder="e.g. 987654321098765"
                        className="w-full font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none text-[11px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600">Permanent Access Token</label>
                    <textarea
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAAG..."
                      rows={2}
                      className="w-full font-mono text-[10.5px] p-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyMetaManual}
                    disabled={verifyingMeta}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 cursor-pointer disabled:opacity-50 text-xs"
                  >
                    {verifyingMeta ? "Verifying..." : "Verify & Save Custom Credentials"}
                  </button>
                  {metaResult && (
                    <div className="p-2 rounded bg-slate-900 text-slate-100 font-mono text-[10px]">
                      {JSON.stringify(metaResult)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-xs"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Live Connection Verified & Test Message ─────────────── */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <p className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5" /> Official WhatsApp Connected & Active!
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11.5px]">
                Your WhatsApp number (<strong className="text-emerald-600 font-bold">{phoneNumber}</strong>) is verified and linked to Digital Dock ERP.
              </p>
            </div>

            {/* Test Send Message */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-600" /> Send Test Message
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Send From Line</label>
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
                <label className="font-bold text-slate-600 dark:text-slate-400">Message Text</label>
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
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending via Official WhatsApp...</>
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
                    {testResult.metaSuccess ? "✓ Message Accepted by Meta Network" : `Result: ${testResult.status || "SENT"}`}
                  </p>
                  {testResult.wamid && (
                    <p>WAMID: <span className="font-bold">{testResult.wamid}</span></p>
                  )}
                  {testResult.details && (
                    <p className="text-[10.5px] opacity-90">{testResult.details}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-xs"
              >
                ← Back
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md cursor-pointer"
              >
                Done — Close Wizard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
