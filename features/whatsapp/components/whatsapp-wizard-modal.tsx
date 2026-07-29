"use client";

import { useState, useCallback } from "react";
import {
  MessageSquare,
  CheckCircle2,
  Send,
  Loader2,
  Globe,
  ShieldCheck,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  XCircle,
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

type VerifyState = "idle" | "loading" | "success" | "error";

export function WhatsAppWizardModal({
  isOpen,
  onClose,
  defaultPhoneNumber = "",
  defaultScope = "super_admin",
  onConnected
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scope, setScope] = useState(defaultScope);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber);

  // Real Meta Cloud API Credentials — all empty by default, user must fill in
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("digitaldock_webhook_2026");

  // Live verification state
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Test send state
  const [testRecipient, setTestRecipient] = useState(defaultPhoneNumber);
  const [testMessage, setTestMessage] = useState("Hello! This is a real test message from Digital Dock ERP.");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Save to DB state
  const [saving, setSaving] = useState(false);
  const [savedAccountId, setSavedAccountId] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const webhookUrl = "http://72.60.209.121/api/erp/return-sms-reply/webhooks/whatsapp";

  // ── STEP 2: Verify real Meta credentials live ────────────────────────────
  async function handleVerifyCredentials() {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setVerifyState("error");
      setVerifyResult({ error: { message: "Phone Number ID and Access Token are both required." } });
      return;
    }
    setVerifyState("loading");
    setVerifyResult(null);

    try {
      const res = await fetch("/api/erp/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId: phoneNumberId.trim(), accessToken: accessToken.trim() })
      });
      const json = await res.json();
      const result = json.data || json;

      if (result.verified) {
        setVerifyState("success");
        setVerifyResult(result);
        // Auto-fill phone number from Meta if user didn't fill it
        if (!phoneNumber && result.displayPhoneNumber) {
          setPhoneNumber(result.displayPhoneNumber.replace(/\s/g, ""));
        }
        if (!displayName && result.verifiedName) {
          setDisplayName(result.verifiedName);
        }
      } else {
        setVerifyState("error");
        setVerifyResult(result);
      }
    } catch (e: any) {
      setVerifyState("error");
      setVerifyResult({ error: { code: "NETWORK_ERROR", message: e?.message || "Network error" } });
    }
  }

  // ── Save verified account to database ─────────────────────────────────────
  async function handleSaveAccount() {
    if (verifyState !== "success") return;
    setSaving(true);

    try {
      const res = await fetch("/api/erp/whatsapp/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          displayName: displayName || verifyResult?.verifiedName || phoneNumber,
          phoneNumber: phoneNumber || verifyResult?.displayPhoneNumber || "",
          phoneNumberId: phoneNumberId.trim(),
          wabaId: wabaId.trim() || "NOT_PROVIDED",
          accessToken: accessToken.trim(),
          verifyToken: verifyToken.trim()
        })
      });
      const json = await res.json();
      const result = json.data || json;

      if (result.accountId) {
        setSavedAccountId(result.accountId);
        setStep(3);
        if (onConnected) {
          onConnected({
            accountId: result.accountId,
            phoneNumber,
            displayName,
            phoneNumberId,
            wabaId,
            verifiedName: verifyResult?.verifiedName
          });
        }
      } else {
        alert("Failed to save account: " + (result.error || JSON.stringify(result)));
      }
    } catch (e: any) {
      alert("Save error: " + e?.message);
    } finally {
      setSaving(false);
    }
  }

  // ── STEP 3: Send real test message ────────────────────────────────────────
  async function handleSendTestMessage() {
    if (!testRecipient.trim()) return;
    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/erp/whatsapp/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderNumber: phoneNumber || verifyResult?.displayPhoneNumber,
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
                Connect WhatsApp via Meta Cloud API
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real production integration — requires Meta Business Manager credentials
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
            { n: 1, label: "Scope & Setup" },
            { n: 2, label: "Verify Credentials" },
            { n: 3, label: "Test & Confirm" }
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black",
                step >= s.n ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
              )}>
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className={cn(step >= s.n ? "text-emerald-600" : "text-slate-400")}>{s.label}</span>
              {s.n < 3 && <span className="text-slate-300 dark:text-slate-700">→</span>}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Scope & Basic Info ─────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-amber-500/8 border border-amber-500/25 space-y-2">
              <p className="font-black text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Before you begin — you need these from Meta
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1">
                <li>
                  <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-blue-500 underline inline-flex items-center gap-0.5">
                    developers.facebook.com <ExternalLink className="h-3 w-3" />
                  </a> → Create App → Add WhatsApp product
                </li>
                <li>Add and verify your phone number in WhatsApp → API Setup</li>
                <li>Copy your <strong>Phone Number ID</strong> and <strong>WABA ID</strong></li>
                <li>Go to Meta Business Manager → System Users → Generate Permanent Token</li>
                <li>Permissions required: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">whatsapp_business_messaging</code> + <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">whatsapp_business_management</code></li>
              </ol>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Account Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none text-xs"
                >
                  <option value="super_admin">🌐 Super Admin (Global)</option>
                  <option value="country">🏳️ Country Level</option>
                  <option value="country_branch">🏢 Country Branch</option>
                  <option value="city_branch">🏙️ City Branch</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Account Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Dubai Main Office WhatsApp"
                  className="w-full font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp Phone Number (international format)</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +971544816664"
                className="w-full font-mono font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
              />
              <p className="text-[10.5px] text-slate-400">Must match the number registered in your Meta WhatsApp Business Account</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md cursor-pointer transition-all"
              >
                Next: Enter Meta Credentials →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Real Meta Credentials & Live Verification ─────────────── */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Phone Number ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={phoneNumberId}
                  onChange={(e) => { setPhoneNumberId(e.target.value); setVerifyState("idle"); setVerifyResult(null); }}
                  placeholder="e.g. 123456789012345"
                  className="w-full font-mono p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                />
                <p className="text-[10px] text-slate-400">From Meta App → WhatsApp → API Setup</p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp Business Account ID (WABA ID)</label>
                <input
                  type="text"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder="e.g. 987654321098765"
                  className="w-full font-mono p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                />
                <p className="text-[10px] text-slate-400">From WhatsApp Manager → Business Info</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Permanent System User Access Token <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={accessToken}
                onChange={(e) => { setAccessToken(e.target.value); setVerifyState("idle"); setVerifyResult(null); }}
                placeholder="EAAGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..."
                rows={3}
                className="w-full font-mono text-[10.5px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none resize-none"
              />
              <p className="text-[10px] text-slate-400">
                Generate in Meta Business Manager → System Users → Your System User → Generate Token.
                Must have <code>whatsapp_business_messaging</code> permission. Use a <strong>Permanent Token</strong>, not a temporary test token.
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Webhook Verify Token</label>
              <input
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="e.g. digitaldock_webhook_2026"
                className="w-full font-mono p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
              />
              <p className="text-[10px] text-slate-400">
                Register this exact string in Meta App → WhatsApp → Configuration → Webhook Verify Token.
                Also set <code>WHATSAPP_VERIFY_TOKEN=digitaldock_webhook_2026</code> in your VPS <code>.env.local</code>.
              </p>
            </div>

            {/* Webhook URL info */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-600 dark:text-slate-400">Webhook Callback URL (register in Meta)</p>
                <code className="text-[10.5px] text-emerald-600 dark:text-emerald-400 break-all">{webhookUrl}</code>
              </div>
              <button
                onClick={() => copyToClipboard(webhookUrl, "webhook")}
                className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0"
              >
                {copied === "webhook" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
              </button>
            </div>

            {/* Live Verification Button */}
            <button
              type="button"
              onClick={handleVerifyCredentials}
              disabled={verifyState === "loading" || !phoneNumberId.trim() || !accessToken.trim()}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {verifyState === "loading" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Verifying with Meta Graph API...</>
              ) : (
                <><ShieldCheck className="h-4 w-4" /> Verify Credentials with Meta Graph API</>
              )}
            </button>

            {/* Verification Result */}
            {verifyState === "success" && verifyResult && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <p className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Meta Credentials Verified Successfully
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500">Display Phone:</span>
                  <span className="font-bold">{verifyResult.displayPhoneNumber || "—"}</span>
                  <span className="text-slate-500">Verified Name:</span>
                  <span className="font-bold">{verifyResult.verifiedName || "—"}</span>
                  <span className="text-slate-500">Verification Status:</span>
                  <span className="font-bold text-emerald-600">{verifyResult.verificationStatus || "VERIFIED"}</span>
                  <span className="text-slate-500">Quality Rating:</span>
                  <span className="font-bold">{verifyResult.qualityRating || "—"}</span>
                  <span className="text-slate-500">HTTP Code:</span>
                  <span className="font-bold text-emerald-600">{verifyResult.httpCode}</span>
                </div>
              </div>
            )}

            {verifyState === "error" && verifyResult && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1.5">
                <p className="font-black text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <XCircle className="h-5 w-5" /> Meta Credential Verification Failed
                </p>
                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5">
                  <p><span className="text-slate-500">HTTP Code:</span> <span className="font-bold text-rose-600">{verifyResult.httpCode || "—"}</span></p>
                  <p><span className="text-slate-500">Error Code:</span> <span className="font-bold">{verifyResult.error?.code || "—"}</span></p>
                  <p><span className="text-slate-500">Error Type:</span> <span className="font-bold">{verifyResult.error?.type || "—"}</span></p>
                  <p><span className="text-slate-500">Message:</span> <span className="font-bold text-rose-600">{verifyResult.error?.message || "Unknown error"}</span></p>
                </div>
                <p className="text-[10.5px] text-slate-500 pt-1">
                  {verifyResult.httpCode === 401 || verifyResult.error?.code === 190
                    ? "Your Access Token is invalid or expired. Generate a new Permanent System User Token in Meta Business Manager."
                    : verifyResult.error?.code === 100
                    ? "The Phone Number ID is incorrect. Copy it exactly from Meta App → WhatsApp → API Setup."
                    : "Check your Meta Business Manager dashboard for more details."}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800 gap-2 flex-wrap">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-xs"
              >
                ← Back
              </button>

              <button
                onClick={handleSaveAccount}
                disabled={verifyState !== "success" || saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-lg text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <>✓ Save Verified Account & Activate →</>
                )}
              </button>
            </div>

            {verifyState !== "success" && (
              <p className="text-center text-[10.5px] text-slate-400 italic">
                You must verify your Meta credentials before saving. The Save button is disabled until verification succeeds.
              </p>
            )}
          </div>
        )}

        {/* ── STEP 3: Test & Confirm Real Message ──────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <p className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> WhatsApp Account Saved Successfully
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Your Meta credentials have been verified and saved. The status badge will now show{" "}
                <strong className="text-emerald-600">CONNECTED</strong>.
              </p>
              {savedAccountId && (
                <p className="font-mono text-[10px] text-slate-400">Account DB ID: {savedAccountId}</p>
              )}
            </div>

            {/* Important: Webhook Registration Reminder */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1.5">
              <p className="font-extrabold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Webhook Registration Required in Meta</p>
              <ol className="list-decimal list-inside space-y-1 text-[11px]">
                <li>Go to <strong>Meta App → WhatsApp → Configuration → Webhooks</strong></li>
                <li>Set Callback URL: <code className="bg-amber-100 dark:bg-amber-950/50 px-1 rounded text-[10px]">{webhookUrl}</code></li>
                <li>Set Verify Token: <code className="bg-amber-100 dark:bg-amber-950/50 px-1 rounded text-[10px]">{verifyToken}</code></li>
                <li>Subscribe to fields: <code>messages</code>, <code>message_deliveries</code>, <code>message_reads</code></li>
                <li>Also set <code>WHATSAPP_VERIFY_TOKEN={verifyToken}</code> in your VPS <code>.env.local</code></li>
              </ol>
            </div>

            {/* HTTPS warning */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
              <strong className="text-slate-800 dark:text-slate-200">⚠️ HTTPS Required:</strong> The current webhook URL uses HTTP. Meta requires HTTPS for production webhooks. Configure an SSL certificate (e.g. Let&apos;s Encrypt) and a domain name pointing to your VPS for full production use.
            </div>

            {/* Send Test Message */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-600" /> Send Real Test Message
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Send From</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    readOnly
                    className="w-full font-mono p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 outline-none text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Recipient WhatsApp Number</label>
                  <input
                    type="text"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="+971501234567"
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
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending via Meta Cloud API...</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Real WhatsApp Message Now</>
                )}
              </button>

              {/* Test Result — Real data only, no fake success */}
              {testResult && (
                <div className={cn(
                  "p-3.5 rounded-xl border font-mono text-[11px] space-y-1.5",
                  testResult.metaSuccess
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200"
                )}>
                  <p className="font-black text-sm">
                    {testResult.metaSuccess ? "✓ Message Sent via Meta Network" : `✗ ${testResult.status || "FAILED"}`}
                  </p>
                  {testResult.wamid && (
                    <p>Real WAMID: <span className="font-bold">{testResult.wamid}</span></p>
                  )}
                  {testResult.formattedE164 && (
                    <p>Recipient E.164: <span className="font-bold">{testResult.formattedE164}</span></p>
                  )}
                  <p className="text-[10.5px] opacity-80">{testResult.details || ""}</p>
                  {testResult.metaError && (
                    <div className="mt-2 p-2 rounded bg-rose-950/60 border border-rose-700 space-y-0.5 text-[10px]">
                      <p className="font-bold">❌ Meta Error Log:</p>
                      <p>Code: {testResult.metaError.code}</p>
                      <p>Type: {testResult.metaError.type}</p>
                      <p>Message: {testResult.metaError.message}</p>
                      {testResult.action && <p className="text-amber-300 mt-1">💡 {testResult.action}</p>}
                    </div>
                  )}
                  {testResult.status === "NO_REAL_CREDENTIALS" && (
                    <p className="text-amber-700 dark:text-amber-300 mt-1">💡 {testResult.action}</p>
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
