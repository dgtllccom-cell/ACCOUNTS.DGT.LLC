"use client";

import { useEffect, useMemo, useState } from "react";
import { LifeBuoy, Mail, ShieldCheck, Search, SlidersHorizontal, Plus, Download, KeyRound, Clock, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type GuidanceTip = { icon: typeof Search; key: string; fallback: string };

const GENERIC_TIPS: GuidanceTip[] = [
  { icon: Search, key: "support.tip_search", fallback: "Use the search and filter bar at the top of a list to narrow results." },
  { icon: Plus, key: "support.tip_create", fallback: "A \"New\" or \"+\" button on a list screen starts a fresh entry." },
  { icon: SlidersHorizontal, key: "support.tip_scope", fallback: "Your Country / Branch scope is shown near the top — it limits what you can see and edit." },
  { icon: Download, key: "support.tip_export", fallback: "Most reports have a Print / PDF / Export action in their action menu." }
];

const ALLOW_ONCE_TEXT = {
  en: {
    sectionTitle: "One-Time Support Inspection (Allow Once)",
    sectionDesc: "Grant a temporary 15-minute read-only inspection token to support for troubleshooting this screen. All actions are logged.",
    reasonPlaceholder: "Reason for access (e.g., Ledger balance mismatch on voucher #104)",
    grantBtn: "Grant Temporary Access (15 Min)",
    granting: "Granting...",
    revokeBtn: "Revoke Access Immediately",
    revoking: "Revoking...",
    statusActive: "Temporary Support Access Active",
    expiresAt: "Expires at:",
    tokenLabel: "Grant Token:",
    durationLabel: "Duration: 15 Minutes",
    safetyBadge: "Time-Bounded & Audited"
  },
  ur: {
    sectionTitle: "ایک وقتی سپورٹ رسائی (صرف ایک بار)",
    sectionDesc: "اس اسکرین پر خرابی دور کرنے کے لیے سپورٹ عملے کو 15 منٹ کا عارضی ریڈ اونلی ٹوکن دیں۔ تمام کارروائیاں لاگ ہوتی ہیں۔",
    reasonPlaceholder: "رسائی کی وجہ (مثلاً واؤچر #104 پر لیجر کا بقایا فرق)",
    grantBtn: "عارضی رسائی دیں (15 منٹ)",
    granting: "رسائی دی جا رہی ہے...",
    revokeBtn: "رسائی فوری منسوخ کریں",
    revoking: "منسوخ کیا جا رہا ہے...",
    statusActive: "سپورٹ رسائی فعال ہے",
    expiresAt: "میعاد ختم ہوگی:",
    tokenLabel: "گرانٹ ٹوکن:",
    durationLabel: "مدت: 15 منٹ",
    safetyBadge: "وقت محدود اور آڈٹ شدہ"
  },
  ar: {
    sectionTitle: "فحص الدعم لمرة واحدة (السماح لمرة واحدة)",
    sectionDesc: "منح رمز وصول مؤقت للقراءة فقط لمدة 15 دقيقة لفريق الدعم لاستكشاف أخطاء هذه الشاشة. يتم تسجيل جميع الإجراءات.",
    reasonPlaceholder: "سبب الوصول (مثال: عدم تطابق رصيد دفتر الأستاذ في السند #104)",
    grantBtn: "منح وصول مؤقت (15 دقيقة)",
    granting: "جاري المنح...",
    revokeBtn: "إلغاء الوصول فوراً",
    revoking: "جاري الإلغاء...",
    statusActive: "وصول الدعم نشط",
    expiresAt: "ينتهي في:",
    tokenLabel: "رمز المنح:",
    durationLabel: "المدة: 15 دقيقة",
    safetyBadge: "محدد بوقت ومُدقق"
  },
  fa: {
    sectionTitle: "بررسی یک‌باره پشتیبانی (مجوز یک‌باره)",
    sectionDesc: "اعطای توکن موقت ۱۵ دقیقه‌ای فقط‌خواندنی به پشتیبانی برای عیب‌یابی این صفحه. تمامی فعالیت‌ها ثبت می‌شوند.",
    reasonPlaceholder: "دلیل دسترسی (مثلاً عدم تطابق تراز دفتر در سند ۱۰۴)",
    grantBtn: "اعطای دسترسی موقت (۱۵ دقیقه)",
    granting: "در حال اعطا...",
    revokeBtn: "لغو فوری دسترسی",
    revoking: "در حال لغو...",
    statusActive: "دسترسی پشتیبانی فعال است",
    expiresAt: "انقضا در:",
    tokenLabel: "توکن دسترسی:",
    durationLabel: "مدت: ۱۵ دقیقه",
    safetyBadge: "زمان‌دار و حسابرسی‌شده"
  },
  ps: {
    sectionTitle: "یو ځل ملاتړ کتنه (یو ځل اجازه)",
    sectionDesc: "د دې پاڼې ستونزې حل کولو لپاره ملاتړ ډلې ته د ۱۵ دقیقو لنډمهاله لوستلو ټوکن ورکړئ. ټول فعالیتونه ثبت کیږي.",
    reasonPlaceholder: "د لاسرسي لامل (لکه د سنډ #۱۰۴ حساب نابرابري)",
    grantBtn: "لنډمهاله لاسرسی ورکړئ (۱۵ دقیقې)",
    granting: "ورکول روان دي...",
    revokeBtn: "لاسرسی سمدستي لغوه کړئ",
    revoking: "لغوه کول روان دي...",
    statusActive: "د ملاتړ لاسرسی فعال دی",
    expiresAt: "د پای ته رسېدو وخت:",
    tokenLabel: "د اجازې ټوکن:",
    durationLabel: "موده: ۱۵ دقیقې",
    safetyBadge: "وخت پورې تړلی او ثبت شوی"
  }
} as const;

async function logSupportAccess(
  action: "guidance_opened" | "contact_support_clicked" | "allow_once_requested" | "allow_once_granted" | "allow_once_revoked",
  pathname: string,
  extra?: { reason?: string; durationMinutes?: number; recordId?: string | null }
) {
  try {
    const res = await fetch("/api/erp/support/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, pathname, ...extra })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface ActiveGrant {
  grantToken: string;
  expiresAt: string;
  reason?: string;
}

export function SafeSupportAssistant({
  lang,
  pathname,
  currentPageLabel
}: {
  lang: SupportedLanguage | string;
  pathname: string;
  currentPageLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [allowOnceReason, setAllowOnceReason] = useState("");
  const [activeGrant, setActiveGrant] = useState<ActiveGrant | null>(null);
  const [loadingAction, setLoadingAction] = useState<"grant" | "revoke" | null>(null);

  const safeLang = (["en", "ur", "ar", "fa", "ps"].includes(lang) ? lang : "en") as keyof typeof ALLOW_ONCE_TEXT;
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";
  const tr = ALLOW_ONCE_TEXT[safeLang];

  // Restore stored active grant on mount if still valid
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("erp_support_allow_once");
      if (stored) {
        const parsed: ActiveGrant = JSON.parse(stored);
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setActiveGrant(parsed);
        } else {
          sessionStorage.removeItem("erp_support_allow_once");
        }
      }
    } catch {
      // sessionStorage unavailable or parse error
    }
  }, []);

  const tips = useMemo(() => GENERIC_TIPS, []);

  function handleOpen() {
    setOpen(true);
    void logSupportAccess("guidance_opened", pathname);
  }

  async function handleContactSupport() {
    await logSupportAccess("contact_support_clicked", pathname);
    window.open("mailto:support@dgt.llc?subject=ERP%20Support%20Request", "_blank");
  }

  async function handleGrantAllowOnce() {
    setLoadingAction("grant");
    try {
      const res = await logSupportAccess("allow_once_granted", pathname, {
        reason: allowOnceReason.trim() || undefined,
        durationMinutes: 15
      });
      if (res?.data?.grantToken && res?.data?.expiresAt) {
        const grant: ActiveGrant = {
          grantToken: res.data.grantToken,
          expiresAt: res.data.expiresAt,
          reason: allowOnceReason.trim() || undefined
        };
        setActiveGrant(grant);
        sessionStorage.setItem("erp_support_allow_once", JSON.stringify(grant));
        setAllowOnceReason("");
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRevokeAllowOnce(reason: string) {
    setLoadingAction("revoke");
    try {
      await logSupportAccess("allow_once_revoked", pathname, { reason });
      setActiveGrant(null);
      sessionStorage.removeItem("erp_support_allow_once");
    } finally {
      setLoadingAction(null);
    }
  }

  // The spec requires the grant to expire on modal close, not just on an explicit
  // Revoke click or the 15-minute timer — closing the assistant ends the support
  // session, so any temporary access it opened should end with it.
  function handleCloseModal() {
    setOpen(false);
    if (activeGrant) void handleRevokeAllowOnce("Support modal closed");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="relative mx-3 mb-2 flex items-center justify-center gap-1.5 rounded-xl border border-blue-100/80 bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#2563eb] transition-colors hover:bg-blue-100/70"
        aria-label={t(lang, "support.open_button", "Support")}
      >
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
        {t(lang, "support.open_button", "Support")}
        {activeGrant ? (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        ) : null}
      </button>

      {open ? (
        <SimpleModal
          title={t(lang, "support.modal_title", "Support")}
          onClose={handleCloseModal}
          className="w-[95vw] max-w-lg rounded-3xl font-sans shadow-2xl"
        >
          <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 p-5 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t(lang, "support.guidance_only_badge", "Guidance Only — no records are read")}
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {tr.safetyBadge}
              </span>
            </div>

            {currentPageLabel ? (
              <p className="text-slate-500 dark:text-slate-400">
                {t(lang, "support.current_page_label", "You are on:")} <span className="font-bold text-slate-800 dark:text-slate-100">{currentPageLabel}</span>
              </p>
            ) : null}

            {/* General Guidance Tips */}
            <div className="space-y-2">
              {tips.map((tip) => {
                const Icon = tip.icon;
                return (
                  <div key={tip.key} className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden />
                    <p className="text-slate-700 dark:text-slate-300">{t(lang, tip.key, tip.fallback)}</p>
                  </div>
                );
              })}
            </div>

            {/* Approved Allow-Once Flow Section */}
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-3.5 space-y-3 dark:border-blue-900/60 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100">{tr.sectionTitle}</h4>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {tr.sectionDesc}
              </p>

              {activeGrant ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 space-y-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      {tr.statusActive}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <Clock className="h-3.5 w-3.5" />
                      {tr.durationLabel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                    <p>
                      <span className="font-semibold">{tr.expiresAt}</span>{" "}
                      {new Date(activeGrant.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                    <p className="font-mono text-[10px] break-all text-slate-500 dark:text-slate-400">
                      <span className="font-sans font-semibold">{tr.tokenLabel}</span> {activeGrant.grantToken}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeAllowOnce("User manually revoked temporary grant")}
                    disabled={loadingAction === "revoke"}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {loadingAction === "revoke" ? tr.revoking : tr.revokeBtn}
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={allowOnceReason}
                    onChange={(e) => setAllowOnceReason(e.target.value)}
                    placeholder={tr.reasonPlaceholder}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleGrantAllowOnce}
                    disabled={loadingAction === "grant"}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {loadingAction === "grant" ? tr.granting : tr.grantBtn}
                  </button>
                </div>
              )}
            </div>

            <p className="text-[10.5px] leading-relaxed text-slate-400">
              {t(
                lang,
                "support.safety_note",
                "This assistant only shows general guidance and never bypasses your access rules or reads a specific record without your explicit one-time permission. Every support interaction is logged."
              )}
            </p>

            <button
              type="button"
              onClick={handleContactSupport}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-xs font-bold text-[#2563eb] shadow-xs transition-colors hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {t(lang, "support.contact_team_button", "Contact Support Team")}
            </button>
          </div>
        </SimpleModal>
      ) : null}
    </>
  );
}

