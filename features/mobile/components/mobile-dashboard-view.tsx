"use client";

import {
  MessageSquare,
  Mail,
  Sparkles,
  Clock,
  Users,
  Building2,
  Bell,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Activity,
  ShieldCheck,
  Zap,
  Globe
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import type { MobileSyncPayload } from "@/lib/services/mobile-sync-service";

type Props = {
  lang: SupportedLanguage;
  syncData: MobileSyncPayload | null;
  onNavigateTab: (tab: "inbox" | "reminders" | "contacts" | "settings") => void;
};

export function MobileDashboardView({ lang, syncData, onNavigateTab }: Props) {
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const stats = syncData?.stats || {
    newMessages: 0,
    pendingReplies: 0,
    aiRepliesReady: 0,
    todayPaymentReminders: 0,
    activeCustomers: 0,
    activeSuppliers: 0,
    unreadNotifications: 0
  };

  const user = syncData?.user || { fullName: tt("mbl.default_user_name", "ERP Mobile User"), role: tt("mbl.default_role", "Manager") };
  const company = syncData?.companyProfile || { name: tt("acct.brand_short", "Digital Dock ERP") };

  return (
    <div className="space-y-4 pb-20" dir={isRTL ? "rtl" : "ltr"}>
      
      {/* Mobile Profile & Connection Card */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-white/90">
              {syncData?.scope?.scopeLabel || tt("mbl.live_sync_active", "LIVE SYNC ACTIVE")}
            </span>
            <h2 className="text-xl font-black text-white mt-1">{user.fullName}</h2>
            <p className="text-xs text-white/80">{company.name} • {user.role.toUpperCase()}</p>
          </div>
          <div className="rounded-2xl p-3 bg-white/20 backdrop-blur-sm border border-white/30">
            <Zap className="h-6 w-6 text-amber-300 animate-pulse" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/90">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <span>{tt("mobiledash.secure_encryption", "Secure Encryption Active")}</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-200">{tt("mobiledash.five_lang_ai_ready", "5-Lang AI Ready")}</span>
        </div>
      </div>

      {/* Primary KPI Grid Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* New Messages */}
        <div
          onClick={() => onNavigateTab("inbox")}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm cursor-pointer hover:border-emerald-500 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500">{tt("mbl.new_messages", "New Messages")}</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{stats.newMessages}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
            {tt("mbl.tap_inbox", "Tap to open inbox")} <ChevronRight className="h-3 w-3" />
          </p>
        </div>

        {/* AI Replies Ready */}
        <div
          onClick={() => onNavigateTab("inbox")}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm cursor-pointer hover:border-amber-500 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500">{tt("mbl.ai_drafts", "AI Drafts Ready")}</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{stats.aiRepliesReady}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{tt("mbl.live_db_verified", "Live ERP DB Verified")}</p>
        </div>

        {/* Today's Payment Reminders */}
        <div
          onClick={() => onNavigateTab("reminders")}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm cursor-pointer hover:border-purple-500 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500">{tt("mbl.reminders_today", "Reminders Today")}</span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/40">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">{stats.todayPaymentReminders}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{tt("mbl.auto_halt_paid", "Auto-halt when paid")}</p>
        </div>

        {/* Active Contacts */}
        <div
          onClick={() => onNavigateTab("contacts")}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-500 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500">{tt("mbl.erp_contacts", "ERP Contacts")}</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{stats.activeCustomers}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{tt("mbl.cust_suppliers", "Customers & Suppliers")}</p>
        </div>
      </div>

      {/* Live Activity Stream */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
          <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-emerald-500" /> {tt("mobiledash.activity_title", "Live ERP Communication Activity")}
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">{tt("mobiledash.real_time", "Real-time")}</span>
        </div>

        <div className="space-y-2.5 text-xs">
          {syncData?.recentActivity?.length ? (
            syncData.recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950">
                {item.channel === "whatsapp" ? (
                  <MessageSquare className="h-4 w-4 text-emerald-600 mt-0.5" />
                ) : (
                  <Mail className="h-4 w-4 text-blue-600 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{item.title}</p>
                  <p className="text-[10px] text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-slate-400">{tt("mobiledash.no_activity", "No recent activity yet.")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
