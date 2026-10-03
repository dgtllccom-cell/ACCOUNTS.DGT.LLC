"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Download,
  FileText,
  ShieldCheck,
  Lock,
  Users,
  Radio,
  ExternalLink,
  Printer,
  RefreshCw,
  CheckCircle2,
  Building2,
  Globe2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export function UserCredentialsPdfView() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => setDownloading(false), 2500);
  };

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Security Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            <Lock className="h-3.5 w-3.5" />
            <span>{tt("super_admin_exclusive", "Super Admin Exclusive • Confidential Clearance")}</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {tt("user_credentials_pdf_title", "Enterprise User Accounts & Credentials PDF")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {tt("user_credentials_pdf_sub", "Standardized logins, verified passwords (Chaman@9090) and live monitoring directory for all 30 users.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/users/live">
            <Button variant="outline" size="sm" className="gap-2 border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40">
              <Radio className="h-4 w-4 text-cyan-600 animate-pulse" />
              <span>{tt("live_users_monitoring", "Live Users Monitoring")}</span>
            </Button>
          </Link>

          <Link href="/dashboard/new-entry/users/all">
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <span>{tt("all_users_directory", "All Users Directory")}</span>
            </Button>
          </Link>

          <a
            href="/api/erp/users/credentials-pdf/download"
            download="ACCOUNTS_DGT_LLC_USERS_CREDENTIALS.pdf"
            onClick={handleDownload}
          >
            <Button
              size="sm"
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-600/20 px-5"
            >
              <Download className={`h-4 w-4 ${downloading ? "animate-bounce" : ""}`} />
              <span>{tt("download_pdf_now", "Download PDF File")}</span>
            </Button>
          </a>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{tt("total_system_users", "Total System Users")}</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">30 Users</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">✓ 100% Tested & Verified</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{tt("master_password", "Master Password")}</span>
            <Lock className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-rose-600 dark:text-rose-400">Chaman@9090</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Applied to all 30 test accounts</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{tt("scope_coverage", "Operational Coverage")}</span>
            <Globe2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">4 Levels</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Global, Country, Branch, Logistics</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{tt("live_monitoring", "Real-Time Tracking")}</span>
            <Radio className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-600 dark:text-cyan-400">15s Auto-Sync</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Online, Idle, and Task Presence</p>
        </div>
      </div>

      {/* Embedded PDF Viewer */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-rose-600" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              ACCOUNTS_DGT_LLC_USERS_CREDENTIALS_AND_LIVE_MONITORING.pdf
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/erp/users/credentials-pdf/download"
              download="ACCOUNTS_DGT_LLC_USERS_CREDENTIALS.pdf"
            >
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-semibold">
                <Download className="h-3.5 w-3.5" />
                <span>{tt("download", "Download")}</span>
              </Button>
            </a>
          </div>
        </div>

        <div className="p-2 bg-slate-100 dark:bg-slate-950 flex justify-center">
          <iframe
            src="/api/erp/users/credentials-pdf/download#toolbar=1"
            className="w-full h-[850px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-xs"
            title="User Credentials and Live Monitoring PDF Document"
          />
        </div>
      </div>
    </div>
  );
}
