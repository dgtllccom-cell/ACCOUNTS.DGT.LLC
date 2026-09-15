"use client";

import { useMemo, useState } from "react";
import { LifeBuoy, Mail, ShieldCheck, Search, SlidersHorizontal, Plus, Download } from "lucide-react";
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

async function logSupportAccess(action: "guidance_opened" | "contact_support_clicked", pathname: string) {
  try {
    await fetch("/api/erp/support/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, pathname })
    });
  } catch {
    // Audit logging must never block the support UI itself.
  }
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
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";

  const tips = useMemo(() => GENERIC_TIPS, []);

  function handleOpen() {
    setOpen(true);
    void logSupportAccess("guidance_opened", pathname);
  }

  async function handleContactSupport() {
    // Await the audit write before opening the mail client — window.open("mailto:...")
    // can abort an in-flight fetch on some browsers if it's treated as a navigation,
    // which was silently dropping this specific audit entry.
    await logSupportAccess("contact_support_clicked", pathname);
    window.open("mailto:support@dgt.llc?subject=ERP%20Support%20Request", "_blank");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="mx-3 mb-2 flex items-center justify-center gap-1.5 rounded-xl border border-blue-100/80 bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#2563eb] transition-colors hover:bg-blue-100/70"
        aria-label={t(lang, "support.open_button", "Support")}
      >
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
        {t(lang, "support.open_button", "Support")}
      </button>

      {open ? (
        <SimpleModal
          title={t(lang, "support.modal_title", "Support")}
          onClose={() => setOpen(false)}
          className="w-[95vw] max-w-md rounded-3xl font-sans shadow-2xl"
        >
          <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 p-5 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t(lang, "support.guidance_only_badge", "Guidance Only — no records are read")}
            </div>

            {currentPageLabel ? (
              <p className="text-slate-500 dark:text-slate-400">
                {t(lang, "support.current_page_label", "You are on:")} <span className="font-bold text-slate-800 dark:text-slate-100">{currentPageLabel}</span>
              </p>
            ) : null}

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
