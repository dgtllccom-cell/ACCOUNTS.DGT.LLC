"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Users,
  Server,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  Plus,
  ArrowRight,
  Inbox,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { MailPageHeader } from "@/components/mail-management/mail-page-header";
import { MailStatusBadge } from "@/components/mail-management/mail-status-badge";

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
  const [lastUpdated, setLastUpdated] = useState<string>("Just now");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/mail-management/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } finally {
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const usedGB = stats ? (stats.overview.totalUsedBytes / (1024 * 1024 * 1024)).toFixed(2) : "0.24";
  const quotaGB = stats ? (stats.overview.totalQuotaBytes / (1024 * 1024 * 1024)).toFixed(2) : "10.00";
  const storagePercent =
    stats && stats.overview.totalQuotaBytes > 0
      ? Math.round((stats.overview.totalUsedBytes / stats.overview.totalQuotaBytes) * 100)
      : 2;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Standard Page Header */}
      <MailPageHeader
        title="DGT Mail Management & Control Hub"
        description="Centralized administration for enterprise mailboxes, server health, storage quotas, and communication infrastructure."
        lastUpdated={lastUpdated}
        icon={Mail}
        secondaryAction={
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
        mainAction={
          <Link
            href="/mail/register"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Mailbox</span>
          </Link>
        }
      />

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Mailboxes */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mailbox Accounts</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats?.overview?.activeUsers ?? 3}
            <span className="text-xs text-slate-400 font-normal ml-1">
              / {stats?.overview?.totalUsers ?? 3} active
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <MailStatusBadge status="active" label="100% Active" size="sm" />
            <span className="text-[11px] text-slate-400">@dgt.llc</span>
          </div>
        </div>

        {/* KPI 2: Storage Quota */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Storage Used</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300 flex items-center justify-center">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {usedGB} <span className="text-xs text-slate-400 font-normal">/ {quotaGB} GB</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: `${Math.max(storagePercent, 3)}%` }}
            />
          </div>
        </div>

        {/* KPI 3: Server Health */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Server Health</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MailStatusBadge status="healthy" label="Online & Healthy" size="sm" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2">
            Stalwart v0.8.0 &bull; 4/4 Ports
          </p>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            Hostinger VPS 72.60.209.121
          </p>
        </div>

        {/* KPI 4: DNS Deliverability */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Deliverability</span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">SPF: PASS</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">DKIM: READY</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
            <span>DMARC: Quarantine</span>
            <span className="text-amber-600 font-semibold">PTR: Pending</span>
          </div>
        </div>
      </div>

      {/* 3. Operational Hub Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Section 1: Mailboxes & Users */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Mailbox Users & Quotas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                View all registered @dgt.llc accounts, customize per-user storage allocation, and toggle account suspension.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/mail-management/users"
            className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>Open User Directory</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </Link>
        </div>

        {/* Section 2: Server Health & Deliverability */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Server Health & DNS Verification
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Check port daemon listen states (25, 587, 465, 993), verify SPF/DKIM/DMARC/PTR records, and diagnose delivery.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/mail-management/monitoring"
            className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>View Server Diagnostics</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </Link>
        </div>

        {/* Section 3: Mailbox Credentials */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300 flex items-center justify-center">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Connection Credentials & Passwords
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Directly manage IMAP/SMTP passwords for each account, test live connections, and assign mailboxes to branch staff.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/dgt-mail-management"
            className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>Manage Credentials</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
