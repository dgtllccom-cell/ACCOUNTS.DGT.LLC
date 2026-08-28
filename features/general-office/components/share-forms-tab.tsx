"use client";

/**
 * ShareFormsTab — rendered inside General Office Management
 *
 * Allows staff to:
 * 1. Generate secure external form links (Customer / Employee / Company / Agent)
 * 2. Copy the link or share directly via WhatsApp
 * 3. View all generated links with live status tracking
 * 4. Revoke links they no longer need
 *
 * Supports all 5 ERP languages.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Link2, Copy, MessageCircle, Plus, Trash2, CheckCircle2,
  Clock, XCircle, RefreshCcw, ChevronDown, Eye, Shield,
  Users, Building2, Briefcase, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SupportedLanguage } from "@/lib/i18n/languages";

// ─── Dictionary ───────────────────────────────────────────────────────────────

type Lang = SupportedLanguage;

const dict: Record<string, Record<string, string>> = {
  title: { en: "Share Form / External Form Link", ur: "فارم شیئر / بیرونی فارم لنک", ar: "مشاركة النموذج / رابط النموذج الخارجي", fa: "اشتراک فرم / لینک فرم خارجی", ps: "فورم شریکول / بهرنی فورم لینک" },
  subtitle: { en: "Generate secure links to share ERP forms with external recipients — no login required on their end.", ur: "ERP فارم بیرونی وصول کنندگان کے ساتھ شیئر کرنے کے لیے محفوظ لنک بنائیں — انہیں لاگ اِن کی ضرورت نہیں۔", ar: "أنشئ روابط آمنة لمشاركة نماذج ERP مع المستلمين الخارجيين — لا يلزمهم تسجيل دخول.", fa: "لینک‌های امن برای اشتراک فرم‌های ERP با گیرندگان خارجی ایجاد کنید — بدون نیاز به ورود.", ps: "د بیرونی ترلاسه کونکو سره د ERP فورمونو شریکولو لپاره خوندي لینکونه جوړ کړئ — د ورود اړتیا نشته." },
  generateTitle: { en: "Generate New Form Link", ur: "نیا فارم لنک بنائیں", ar: "إنشاء رابط نموذج جديد", fa: "ایجاد لینک فرم جدید", ps: "نوی فورم لینک جوړ کړئ" },
  selectFormType: { en: "Select Form Type", ur: "فارم کی قسم منتخب کریں", ar: "اختر نوع النموذج", fa: "نوع فرم را انتخاب کنید", ps: "د فورم ډول وټاکئ" },
  customer: { en: "Customer Registration", ur: "کسٹمر رجسٹریشن", ar: "تسجيل العميل", fa: "ثبت مشتری", ps: "د پیرودونکي ثبت" },
  employee: { en: "Employee Registration", ur: "ملازم رجسٹریشن", ar: "تسجيل الموظف", fa: "ثبت کارمند", ps: "د کارمند ثبت" },
  company: { en: "Company Registration", ur: "کمپنی رجسٹریشن", ar: "تسجيل الشركة", fa: "ثبت شرکت", ps: "د شرکت ثبت" },
  agent: { en: "Agent Registration", ur: "ایجنٹ رجسٹریشن", ar: "تسجيل الوكيل", fa: "ثبت نماینده", ps: "د ایجنټ ثبت" },
  expiryLabel: { en: "Link Expiry", ur: "لنک کی میعاد", ar: "صلاحية الرابط", fa: "انقضای لینک", ps: "د لینک پای" },
  expiry24h: { en: "24 Hours", ur: "24 گھنٹے", ar: "24 ساعة", fa: "۲۴ ساعت", ps: "۲۴ ساعتونه" },
  expiry48h: { en: "48 Hours", ur: "48 گھنٹے", ar: "48 ساعة", fa: "۴۸ ساعت", ps: "۴۸ ساعتونه" },
  expiry7d: { en: "7 Days (Default)", ur: "7 دن (ڈیفالٹ)", ar: "7 أيام (افتراضي)", fa: "۷ روز (پیش‌فرض)", ps: "۷ ورځې (ډیفالټ)" },
  expiry14d: { en: "14 Days", ur: "14 دن", ar: "14 يوماً", fa: "۱۴ روز", ps: "۱۴ ورځې" },
  expiry30d: { en: "30 Days", ur: "30 دن", ar: "30 يوماً", fa: "۳۰ روز", ps: "۳۰ ورځې" },
  expiryNever: { en: "Never Expires", ur: "کبھی ختم نہ ہو", ar: "بدون انتهاء صلاحية", fa: "بدون انقضا", ps: "هیڅکله پای نه رسیږي" },
  notesLabel: { en: "Notes (optional)", ur: "نوٹس (اختیاری)", ar: "ملاحظات (اختياري)", fa: "یادداشت (اختیاری)", ps: "نوټونه (اختیاري)" },
  generateBtn: { en: "Generate Secure Link", ur: "محفوظ لنک بنائیں", ar: "إنشاء رابط آمن", fa: "ایجاد لینک امن", ps: "خوندي لینک جوړ کړئ" },
  generatedLink: { en: "Your Secure Link", ur: "آپ کا محفوظ لنک", ar: "الرابط الآمن الخاص بك", fa: "لینک امن شما", ps: "ستاسو خوندی لینک" },
  copyLink: { en: "Copy Link", ur: "لنک کاپی کریں", ar: "نسخ الرابط", fa: "کپی لینک", ps: "لینک کاپي کړئ" },
  copied: { en: "Copied!", ur: "کاپی ہو گیا!", ar: "تم النسخ!", fa: "کپی شد!", ps: "کاپي شو!" },
  whatsappShare: { en: "WhatsApp Share", ur: "واٹس ایپ پر بھیجیں", ar: "مشاركة عبر واتساب", fa: "اشتراک در واتساپ", ps: "واټساپ کې شریک کړئ" },
  linksRegistry: { en: "Generated Links Registry", ur: "بنائے گئے لنکس کا رجسٹر", ar: "سجل الروابط المُنشأة", fa: "رجیستری لینک‌های ایجاد شده", ps: "جوړ شوي لینکونو ثبت" },
  colSerial: { en: "#", ur: "#", ar: "#", fa: "#", ps: "#" },
  colFormType: { en: "Form Type", ur: "فارم کی قسم", ar: "نوع النموذج", fa: "نوع فرم", ps: "د فورم ډول" },
  colStatus: { en: "Status", ur: "حیثیت", ar: "الحالة", fa: "وضعیت", ps: "حالت" },
  colCreatedBy: { en: "Created By", ur: "بنانے والا", ar: "أنشأ بواسطة", fa: "ایجاد کننده", ps: "جوړونکی" },
  colCreatedAt: { en: "Created", ur: "تاریخِ تخلیق", ar: "تاريخ الإنشاء", fa: "تاریخ ایجاد", ps: "جوړیدو نیټه" },
  colExpiry: { en: "Expires", ur: "میعاد", ar: "تاريخ الانتهاء", fa: "انقضا", ps: "پای" },
  colSubmission: { en: "Submission", ur: "جمع کروائی", ar: "التقديم", fa: "ارسال", ps: "وسپارنه" },
  colActions: { en: "Actions", ur: "اقدامات", ar: "الإجراءات", fa: "عملیات", ps: "کړنې" },
  statusActive: { en: "Active", ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" },
  statusUsed: { en: "Submitted", ur: "جمع شدہ", ar: "مُقدَّم", fa: "ارسال شده", ps: "وسپارل شوی" },
  statusExpired: { en: "Expired", ur: "میعاد ختم", ar: "منتهي الصلاحية", fa: "منقضی", ps: "پای شوی" },
  statusRevoked: { en: "Revoked", ur: "منسوخ", ar: "ملغى", fa: "لغو شده", ps: "لغو شوی" },
  revokeBtn: { en: "Revoke", ur: "منسوخ کریں", ar: "إلغاء", fa: "لغو", ps: "لغو کړئ" },
  copyShort: { en: "Copy", ur: "کاپی", ar: "نسخ", fa: "کپی", ps: "کاپي" },
  noLinks: { en: "No links generated yet. Use the form above to create your first link.", ur: "ابھی کوئی لنک نہیں بنایا گیا۔ اوپر فارم استعمال کر کے پہلا لنک بنائیں۔", ar: "لم يتم إنشاء أي روابط بعد. استخدم النموذج أعلاه لإنشاء أول رابط.", fa: "هنوز لینکی ایجاد نشده. از فرم بالا برای ایجاد اولین لینک استفاده کنید.", ps: "تر اوسه هیڅ لینک نه دی جوړ شوی. لومړی لینک جوړولو لپاره پورته فورم وکاروئ." },
  refreshBtn: { en: "Refresh", ur: "ریفریش", ar: "تحديث", fa: "تازه‌سازی", ps: "تازه کړئ" },
  whatsappMsg: { en: "Please fill this secure form to register your information", ur: "براہ کرم اپنی معلومات درج کرانے کے لیے یہ محفوظ فارم بھریں", ar: "يرجى ملء هذا النموذج الآمن لتسجيل معلوماتك", fa: "لطفاً این فرم امن را برای ثبت اطلاعات خود پر کنید", ps: "مهرباني وکړئ خپل معلومات ثبتولو لپاره دا خوندی فورم ډک کړئ" },
  never: { en: "Never", ur: "کبھی نہیں", ar: "أبداً", fa: "هرگز", ps: "هیڅکله" },
  pending: { en: "Pending", ur: "زیر التواء", ar: "معلق", fa: "در انتظار", ps: "پاتې" },
  selectFormFirst: { en: "Please select a form type first", ur: "پہلے فارم کی قسم منتخب کریں", ar: "يرجى اختيار نوع النموذج أولاً", fa: "لطفاً ابتدا نوع فرم را انتخاب کنید", ps: "لومړی د فورم ډول وټاکئ" },
};

function tx(key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? dict[key]?.["en"] ?? key;
}

// ─── Status badge component ───────────────────────────────────────────────────

function StatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const cfg: Record<string, { bg: string; color: string; icon: React.ReactNode; key: string }> = {
    active:  { bg: "rgba(34,197,94,0.15)",  color: "#4ade80", icon: <CheckCircle2 size={12} />, key: "statusActive" },
    used:    { bg: "rgba(99,102,241,0.15)", color: "#a5b4fc", icon: <Eye size={12} />,          key: "statusUsed" },
    expired: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", icon: <Clock size={12} />,        key: "statusExpired" },
    revoked: { bg: "rgba(239,68,68,0.15)",  color: "#f87171", icon: <XCircle size={12} />,      key: "statusRevoked" },
  };
  const c = cfg[status] ?? cfg.expired;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color,
    }}>
      {c.icon} {tx(c.key, lang)}
    </span>
  );
}

// ─── Form type icon ───────────────────────────────────────────────────────────

function FormTypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    customer: <Users size={14} />,
    employee: <UserCheck size={14} />,
    company:  <Building2 size={14} />,
    agent:    <Briefcase size={14} />,
  };
  return <>{icons[type] ?? <Link2 size={14} />}</>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ShareFormsTabProps {
  lang: Lang;
}

interface LinkRecord {
  id: string;
  token: string;
  form_type: string;
  status: string;
  created_by_name: string | null;
  created_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  submitted_record_id: string | null;
  notes: string | null;
}

export function ShareFormsTab({ lang }: ShareFormsTabProps) {
  const [formType, setFormType] = useState("");
  const [expiryHours, setExpiryHours] = useState(168);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedFormType, setGeneratedFormType] = useState("");
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch("/api/erp/general-office/share-links", { credentials: "include" });
      const json = await res.json();
      if (json.ok) setLinks(json.data?.links ?? []);
    } catch { /* silent */ } finally {
      setLoadingLinks(false);
    }
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const handleGenerate = useCallback(async () => {
    if (!formType) {
      setGenerateError(tx("selectFormFirst", lang));
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    setGeneratedUrl(null);
    try {
      const res = await fetch("/api/erp/general-office/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ formType, expiryHours, notes }),
      });
      const json = await res.json();
      if (json.ok) {
        setGeneratedUrl(json.data?.publicUrl ?? "");
        setGeneratedFormType(formType);
        setFormType("");
        setNotes("");
        await loadLinks();
      } else {
        setGenerateError(json.error ?? "Failed to generate link");
      }
    } catch {
      setGenerateError("Network error");
    } finally {
      setGenerating(false);
    }
  }, [formType, expiryHours, notes, lang, loadLinks]);

  const handleCopy = useCallback(async (url: string, rowId?: string) => {
    await navigator.clipboard.writeText(url).catch(() => {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    if (rowId) {
      setCopiedRowId(rowId);
      setTimeout(() => setCopiedRowId(null), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, []);

  const handleWhatsapp = useCallback((url: string) => {
    const msg = encodeURIComponent(`${tx("whatsappMsg", lang)}:\n${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }, [lang]);

  const handleRevoke = useCallback(async (id: string) => {
    if (!confirm("Revoke this link? The recipient will no longer be able to open it.")) return;
    setRevoking(id);
    try {
      await fetch("/api/erp/general-office/share-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      await loadLinks();
    } catch { /* silent */ } finally {
      setRevoking(null);
    }
  }, [loadLinks]);

  const getPublicUrl = (token: string) =>
    `${window.location.origin}/ext/form/${token}`;

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(
      lang === "ar" ? "ar-SA" : lang === "ur" ? "ur-PK" : "en-GB",
      { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    );
  };

  const formTypes = [
    { value: "customer", label: tx("customer", lang), icon: <Users size={16} /> },
    { value: "employee", label: tx("employee", lang), icon: <UserCheck size={16} /> },
    { value: "company",  label: tx("company",  lang), icon: <Building2 size={16} /> },
    { value: "agent",    label: tx("agent",    lang), icon: <Briefcase size={16} /> },
  ];

  const expiryOptions = [
    { value: 24,   label: tx("expiry24h", lang) },
    { value: 48,   label: tx("expiry48h", lang) },
    { value: 168,  label: tx("expiry7d",  lang) },
    { value: 336,  label: tx("expiry14d", lang) },
    { value: 720,  label: tx("expiry30d", lang) },
    { value: 0,    label: tx("expiryNever", lang) },
  ];

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Link2 size={20} color="#a5b4fc" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
              {tx("title", lang)}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", marginTop: 2 }}>
              {tx("subtitle", lang)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Generate Section ─────────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 16, padding: "24px 28px", marginBottom: 32,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Shield size={16} color="#6366f1" />
          <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>
            {tx("generateTitle", lang)}
          </span>
        </div>

        {/* Form type selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {tx("selectFormType", lang)}
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {formTypes.map((ft) => (
              <button
                key={ft.value}
                type="button"
                onClick={() => { setFormType(ft.value); setGenerateError(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 16px", borderRadius: 10,
                  border: formType === ft.value
                    ? "1.5px solid #6366f1"
                    : "1.5px solid rgba(255,255,255,0.1)",
                  background: formType === ft.value
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(255,255,255,0.04)",
                  color: formType === ft.value ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer", fontSize: 13, fontWeight: formType === ft.value ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                {ft.icon} {ft.label}
              </button>
            ))}
          </div>
        </div>

        {/* Expiry + notes row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {tx("expiryLabel", lang)}
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                style={{
                  width: "100%", padding: "9px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e2e8f0", fontSize: 13, appearance: "none", cursor: "pointer",
                }}
              >
                {expiryOptions.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: "#1e293b" }}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {tx("notesLabel", lang)}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. For Karachi customer onboarding"
              style={{
                width: "100%", padding: "9px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0", fontSize: 13, boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {generateError && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 6, border: "1px solid rgba(248,113,113,0.2)" }}>
            ⚠️ {generateError}
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: generating ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px",
            fontWeight: 600, fontSize: 14, cursor: generating ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
          }}
        >
          <Plus size={16} />
          {generating ? "Generating..." : tx("generateBtn", lang)}
        </Button>
      </div>

      {/* ── Generated URL display ─────────────────────────────────────────────── */}
      {generatedUrl && (
        <div style={{
          background: "rgba(34,197,94,0.08)",
          border: "1.5px solid rgba(34,197,94,0.3)",
          borderRadius: 14, padding: "20px 24px", marginBottom: 32,
          animation: "fadeIn 0.4s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <CheckCircle2 size={18} color="#4ade80" />
            <span style={{ color: "#4ade80", fontWeight: 600, fontSize: 15 }}>
              {tx("generatedLink", lang)} — {tx(generatedFormType, lang)}
            </span>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 14px",
            marginBottom: 14, border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <Link2 size={14} color="#6366f1" style={{ flexShrink: 0 }} />
            <span style={{
              color: "#a5b4fc", fontSize: 13, wordBreak: "break-all",
              flex: 1, userSelect: "all",
            }}>
              {generatedUrl}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => handleCopy(generatedUrl)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 18px", borderRadius: 8,
                background: copied ? "rgba(34,197,94,0.2)" : "rgba(99,102,241,0.2)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: copied ? "#4ade80" : "#a5b4fc",
                cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s",
              }}
            >
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? tx("copied", lang) : tx("copyLink", lang)}
            </button>
            <button
              type="button"
              onClick={() => handleWhatsapp(generatedUrl)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 18px", borderRadius: 8,
                background: "rgba(34,197,94,0.15)",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#4ade80",
                cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s",
              }}
            >
              <MessageCircle size={14} />
              {tx("whatsappShare", lang)}
            </button>
          </div>
        </div>
      )}

      {/* ── Links Registry ────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link2 size={16} color="#6366f1" />
            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>
              {tx("linksRegistry", lang)}
            </span>
            <span style={{
              background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
              borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600,
            }}>
              {links.length}
            </span>
          </div>
          <button
            type="button"
            onClick={loadLinks}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#64748b", cursor: "pointer", fontSize: 12,
            }}
          >
            <RefreshCcw size={13} /> {tx("refreshBtn", lang)}
          </button>
        </div>

        {loadingLinks ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#475569" }}>
            <RefreshCcw size={20} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : links.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "48px 24px",
            background: "rgba(15,23,42,0.4)", borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.08)",
            color: "#475569", fontSize: 14,
          }}>
            <Link2 size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div>{tx("noLinks", lang)}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {[
                    tx("colSerial", lang),
                    tx("colFormType", lang),
                    tx("colStatus", lang),
                    tx("colCreatedBy", lang),
                    tx("colCreatedAt", lang),
                    tx("colExpiry", lang),
                    tx("colSubmission", lang),
                    tx("colActions", lang),
                  ].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", color: "#64748b", fontSize: 11, fontWeight: 600, textAlign: "left", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {links.map((link, idx) => {
                  const url = typeof window !== "undefined" ? getPublicUrl(link.token) : "";
                  return (
                    <tr
                      key={link.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          color: "#94a3b8", fontSize: 12, fontWeight: 500,
                        }}>
                          <FormTypeIcon type={link.form_type} />
                          {tx(link.form_type, lang)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <StatusBadge status={link.status} lang={lang} />
                      </td>
                      <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 12 }}>
                        {link.created_by_name ?? "—"}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#64748b", fontSize: 12 }}>
                        {formatDate(link.created_at)}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#64748b", fontSize: 12 }}>
                        {link.expires_at ? formatDate(link.expires_at) : tx("never", lang)}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12 }}>
                        {link.submitted_at ? (
                          <span style={{ color: "#4ade80" }}>
                            <CheckCircle2 size={12} style={{ marginRight: 4 }} />
                            {formatDate(link.submitted_at)}
                          </span>
                        ) : (
                          <span style={{ color: "#475569" }}>{tx("pending", lang)}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {/* Copy */}
                          {link.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleCopy(url, link.id)}
                              title={tx("copyLink", lang)}
                              style={{
                                padding: "5px 10px", borderRadius: 6, fontSize: 11,
                                background: copiedRowId === link.id ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.15)",
                                border: "1px solid rgba(99,102,241,0.2)",
                                color: copiedRowId === link.id ? "#4ade80" : "#a5b4fc",
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                              }}
                            >
                              {copiedRowId === link.id ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                              {copiedRowId === link.id ? tx("copied", lang) : tx("copyShort", lang)}
                            </button>
                          )}
                          {/* WhatsApp */}
                          {link.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleWhatsapp(url)}
                              title={tx("whatsappShare", lang)}
                              style={{
                                padding: "5px 8px", borderRadius: 6,
                                background: "rgba(34,197,94,0.1)",
                                border: "1px solid rgba(34,197,94,0.2)",
                                color: "#4ade80", cursor: "pointer",
                                display: "flex", alignItems: "center",
                              }}
                            >
                              <MessageCircle size={12} />
                            </button>
                          )}
                          {/* Revoke */}
                          {(link.status === "active") && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(link.id)}
                              disabled={revoking === link.id}
                              title={tx("revokeBtn", lang)}
                              style={{
                                padding: "5px 8px", borderRadius: 6,
                                background: "rgba(239,68,68,0.1)",
                                border: "1px solid rgba(239,68,68,0.2)",
                                color: "#f87171", cursor: "pointer",
                                display: "flex", alignItems: "center",
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
