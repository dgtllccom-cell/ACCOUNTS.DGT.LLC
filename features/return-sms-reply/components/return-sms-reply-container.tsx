"use client";

import { useState } from "react";
import { MessageSquare, Bell, FileText, BarChart3, Bot, Globe } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { UnifiedInboxView } from "./unified-inbox-view";
import { ReminderSettingsView } from "./reminder-settings-view";
import { TemplateManagerView } from "./template-manager-view";
import { CommunicationReportsView } from "./communication-reports-view";

type Props = {
  lang: SupportedLanguage;
  scopeLevel: "global" | "country" | "branch";
};

export function ReturnSmsReplyContainer({ lang, scopeLevel }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [activeTab, setActiveTab] = useState<"inbox" | "reminders" | "templates" | "reports">("inbox");

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>

      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl bg-white p-6 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 text-white shadow-md">
            <Bot className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {_("sms_reply.title", "Return SMS Reply — AI Communication Centre")}
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {_("sms_reply.subtitle", "Centralized WhatsApp & Email AI communication center for multi-country, automated business replies and payment reminders")}
            </p>
          </div>
        </div>

        {/* Scope Badge & Sub-Tab Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Globe className="h-3.5 w-3.5 text-emerald-500" />
            <span className="uppercase text-[10px] tracking-wider">{scopeLevel} SCOPE</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab("inbox")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "inbox" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {_("sms_reply.inbox", "Unified Inbox")}
            </button>

            <button
              onClick={() => setActiveTab("reminders")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "reminders" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <Bell className="h-3.5 w-3.5" />
              {_("sms_reply.reminders", "Payment Reminders")}
            </button>

            <button
              onClick={() => setActiveTab("templates")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "templates" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              {_("sms_reply.templates", "Reply Templates")}
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "reports" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {_("sms_reply.reports", "Audit Reports")}
            </button>
          </div>
        </div>
      </div>

      {/* Render Active View */}
      {activeTab === "inbox" && <UnifiedInboxView lang={lang} />}
      {activeTab === "reminders" && <ReminderSettingsView lang={lang} />}
      {activeTab === "templates" && <TemplateManagerView lang={lang} />}
      {activeTab === "reports" && <CommunicationReportsView lang={lang} />}

    </div>
  );
}
