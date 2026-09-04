"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Bell,
  Users,
  Settings,
  ShieldCheck,
  Zap,
  Globe,
  RefreshCw,
  LogOut
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { MobileDashboardView } from "./mobile-dashboard-view";
import { MobileInboxView } from "./mobile-inbox-view";
import { ReminderSettingsView } from "@/features/return-sms-reply/components/reminder-settings-view";
import { TemplateManagerView } from "@/features/return-sms-reply/components/template-manager-view";
import type { MobileSyncPayload } from "@/lib/services/mobile-sync-service";

type Props = {
  lang: SupportedLanguage;
};

export function MobileAppContainer({ lang }: Props) {
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const [activeTab, setActiveTab] = useState<"dashboard" | "inbox" | "reminders" | "contacts" | "settings">("dashboard");
  const [syncData, setSyncData] = useState<MobileSyncPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Perform Mobile Auto-Sync upon mount
  const handleAutoSync = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/mobile/sync");
      const json = await res.json();
      if (json.ok && json.data) {
        setSyncData(json.data);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleAutoSync();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans" dir={isRTL ? "rtl" : "ltr"}>
      
      {/* Top Mobile Application Header */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white p-3.5 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-2">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-white leading-tight">
              {tt("mac.title", "AI Mobile – Return WhatsApp Reply")}
            </h1>
            <p className="text-[9px] text-emerald-300 font-mono">
              {tt("mac.subtitle", "Digital Dock ERP Live Extension")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoSync}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            title={tt("mbl.sync_now", "Auto-Sync Now")}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 p-3.5 max-w-lg mx-auto w-full">
        {activeTab === "dashboard" && (
          <MobileDashboardView lang={lang} syncData={syncData} onNavigateTab={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === "inbox" && <MobileInboxView lang={lang} />}
        {activeTab === "reminders" && <ReminderSettingsView lang={lang} />}
        {activeTab === "contacts" && <TemplateManagerView lang={lang} />}
        {activeTab === "settings" && (
          <div className="space-y-4 p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs">
            <h3 className="text-sm font-black text-slate-900 dark:text-white border-b pb-2">{tt("mac.settings_title", "AI Mobile App Settings")}</h3>
            <div className="space-y-2 text-slate-600 dark:text-slate-400">
              <p>• {tt("mac.connected_profile", "Connected ERP Profile:")} <strong className="text-slate-900 dark:text-white">{syncData?.user.fullName}</strong></p>
              <p>• {tt("mac.role_scope", "Role & Scope:")} <strong className="text-emerald-600">{syncData?.scope.scopeLabel}</strong></p>
              <p>• {tt("mac.push_notifications", "Push Notifications:")} <strong className="text-emerald-600">{tt("mac.active_fcm_apns", "Active (FCM / APNs)")}</strong></p>
              <p>• {tt("mac.five_lang_engine", "5-Language AI Engine:")} <strong className="text-indigo-600">EN, UR, PS, FA, AR</strong></p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Native Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-2 flex items-center justify-around max-w-lg mx-auto shadow-lg">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black transition-all",
            activeTab === "dashboard" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          {tt("mbl.nav_dashboard", "Dashboard")}
        </button>

        <button
          onClick={() => setActiveTab("inbox")}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black transition-all relative",
            activeTab === "inbox" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
          )}
        >
          <MessageSquare className="h-5 w-5" />
          {tt("mbl.nav_inbox", "Inbox")}
          {(syncData?.stats.newMessages || 0) > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-black text-white">
              {syncData?.stats.newMessages}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("reminders")}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black transition-all",
            activeTab === "reminders" ? "text-purple-600 dark:text-purple-400" : "text-slate-400"
          )}
        >
          <Bell className="h-5 w-5" />
          {tt("mbl.nav_reminders", "Reminders")}
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black transition-all",
            activeTab === "contacts" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
          )}
        >
          <Users className="h-5 w-5" />
          {tt("mbl.nav_templates", "Templates")}
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black transition-all",
            activeTab === "settings" ? "text-slate-900 dark:text-white" : "text-slate-400"
          )}
        >
          <Settings className="h-5 w-5" />
          {tt("mbl.nav_settings", "Settings")}
        </button>
      </nav>

    </div>
  );
}
