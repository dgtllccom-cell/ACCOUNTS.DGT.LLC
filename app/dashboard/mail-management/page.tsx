"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Globe,
  HardDrive,
  Mail,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { DashboardFrame } from "@/components/layout/dashboard-frame";

interface MailStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    totalUsedBytes: number;
    totalQuotaBytes: number;
    quotaWarningsCount: number;
    totalMessages: number;
  };
  server: {
    online: boolean;
    version: string;
    hostname: string;
    ip: string;
    totalMailboxes: number;
    storageUsedBytes: number;
    inboundQueueCount: number;
    outboundQueueCount: number;
    blockedSpamCount: number;
    ports: {
      smtp: number;
      smtps: number;
      submission: number;
      imaps: number;
    };
  };
}

export default function DgtMailManagementOverviewPage() {
  const [stats, setStats] = useState<MailStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/mail-management/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const usedGB = stats ? (stats.overview.totalUsedBytes / (1024 * 1024 * 1024)).toFixed(2) : "0.00";
  const quotaGB = stats ? (stats.overview.totalQuotaBytes / (1024 * 1024 * 1024)).toFixed(2) : "0.00";
  const storagePercent =
    stats && stats.overview.totalQuotaBytes > 0
      ? Math.round((stats.overview.totalUsedBytes / stats.overview.totalQuotaBytes) * 100)
      : 0;

  return (
    <DashboardFrame>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <Mail className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                DGT Mail Management & Control Hub
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Independent self-hosted mail platform (username@dgt.llc) &bull; Hostinger VPS 72.60.209.121
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchStats}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Stats</span>
            </button>

            <Link
              href="/mail"
              target="_blank"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
            >
              <span>Open Public Webmail</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Mailboxes
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.overview.totalUsers ?? 0}
              </span>
              <span className="text-xs text-emerald-600 font-semibold">
                {stats?.overview.activeUsers ?? 0} active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {stats?.overview.suspendedUsers ?? 0} suspended accounts
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Storage Allocation
              </span>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
                <HardDrive className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {usedGB} GB
              </span>
              <span className="text-xs text-slate-400 font-medium">/ {quotaGB} GB allocated</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${storagePercent}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Quota Warnings
              </span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.overview.quotaWarningsCount ?? 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">mailboxes &gt;80%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Automated upgrade alerts sent to users
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Server Status
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                <Server className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                Online &bull; Stalwart
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Ports 25, 465, 587, 993 Active
            </p>
          </div>
        </div>

        {/* Action Cards & Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Section 1: User Management */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mb-3">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Mail Users & Storage Quotas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Inspect all registered public users, expand or reduce individual user storage limits, reset passwords, or suspend abusers.
              </p>
            </div>

            <Link
              href="/dashboard/mail-management/users"
              className="mt-5 w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <span>Manage User Accounts</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Section 2: Server Monitoring */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center mb-3">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Mail Infrastructure & Deliverability
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Monitor SPF, DKIM, DMARC validation, queue volume, and server health. Instructions for Hostinger rDNS and block storage expansion.
              </p>
            </div>

            <Link
              href="/dashboard/mail-management/monitoring"
              className="mt-5 w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <span>Server Monitoring & DNS</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Section 3: Storage Plans & Expansion */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-3">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Storage Plans & Expansion
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Configure Free (1GB), Pro (10GB), and Business (50GB) tiers. Connect external block storage volumes or S3 object storage for heavy attachments.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
              <span>Default Free: 1.0 GB</span>
              <span className="font-semibold text-emerald-600">Auto-Enforced</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardFrame>
  );
}
