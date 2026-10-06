"use client";

import {
  AlertTriangle,
  Database,
  FileText,
  HardDrive,
  Inbox,
  PenSquare,
  Send,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { rtlLanguages } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

interface MailSidebarProps {
  activeFolder: string;
  onSelectFolder: (folder: string) => void;
  onOpenCompose: () => void;
  onOpenUpgrade: () => void;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  storageWarningLevel: number;
  unreadCount: number;
  /** Mobile-only: whether the sidebar overlay is currently shown. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function MailSidebar({
  activeFolder,
  onSelectFolder,
  onOpenCompose,
  onOpenUpgrade,
  storageUsedBytes,
  storageQuotaBytes,
  storageWarningLevel,
  unreadCount,
  mobileOpen,
  onCloseMobile,
}: MailSidebarProps) {
  const lang = useActiveLanguage();
  const isRtl = rtlLanguages.includes(lang);
  const tt = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);

  const folders = [
    { id: "inbox", label: tt("mail.inbox", "Inbox"), icon: Inbox, count: unreadCount },
    { id: "starred", label: tt("mail.starred", "Starred"), icon: Star },
    { id: "sent", label: tt("mail.sent", "Sent"), icon: Send },
    { id: "drafts", label: tt("mail.drafts", "Drafts"), icon: FileText },
    { id: "spam", label: tt("mail.spam", "Spam"), icon: ShieldAlert },
    { id: "trash", label: tt("mail.trash", "Trash"), icon: Trash2 },
  ];

  const usedMB = (storageUsedBytes / (1024 * 1024)).toFixed(1);
  const quotaGB = (storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(1);
  const percentUsed = Math.min(100, Math.round((storageUsedBytes / (storageQuotaBytes || 1)) * 100));

  const isWarning = percentUsed >= 80 || storageWarningLevel >= 1;
  const isCritical = percentUsed >= 95 || storageWarningLevel >= 3;

  const content = (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="w-64 border-e border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col justify-between h-full p-4 shrink-0"
    >
      {/* Mobile close button */}
      <button
        type="button"
        onClick={onCloseMobile}
        className="lg:hidden self-end mb-1 p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Top Section */}
      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* Compose Button */}
        <button
          onClick={() => {
            onOpenCompose();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
        >
          <PenSquare className="h-4 w-4" />
          <span>{tt("mail.compose", "Compose")}</span>
        </button>

        {/* Folder List */}
        <nav className="space-y-1">
          {folders.map((f) => {
            const Icon = f.icon;
            const isActive = activeFolder === f.id;

            return (
              <button
                key={f.id}
                onClick={() => {
                  onSelectFolder(f.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all border-s-[3px] ${
                  isActive
                    ? "bg-blue-600 text-white font-semibold shadow-sm border-s-blue-800"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 border-s-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                  <span>{f.label}</span>
                </div>

                {f.count && f.count > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-white text-blue-600"
                        : "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {f.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Storage Quota Meter */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3.5 shadow-sm space-y-2.5 mt-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <HardDrive className="h-4 w-4 text-blue-600" />
            <span>{tt("mail.storage", "Storage")}</span>
          </div>

          <span
            className={`text-[11px] font-bold ${
              isCritical
                ? "text-rose-600 dark:text-rose-400"
                : isWarning
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {percentUsed}%
          </span>
        </div>

        {/* Bar */}
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isCritical
                ? "bg-rose-500"
                : isWarning
                ? "bg-amber-500"
                : "bg-blue-600"
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          <span>{usedMB} MB {tt("mail.used_of_plan", "used")}</span>
          <span>{quotaGB} GB {tt("mail.plan_suffix", "plan")}</span>
        </div>

        {isWarning && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{tt("mail.approaching_quota", "Approaching quota limit")}</span>
          </div>
        )}

        <button
          onClick={onOpenUpgrade}
          className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center justify-center gap-1.5"
        >
          <Database className="h-3 w-3" />
          <span>{tt("mail.get_more_storage", "Get More Storage")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: static sidebar */}
      <div className="hidden lg:flex h-full">{content}</div>

      {/* Mobile: overlay drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onCloseMobile} />
          <div className="relative h-full z-10">{content}</div>
        </div>
      )}
    </>
  );
}
