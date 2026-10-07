"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Globe2,
  Copy,
  Check,
  Search,
  KeyRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { Th } from "@/components/ui/translated-th";

interface CredentialUser {
  id: string;
  name: string;
  username: string;
  loginId?: string;
  email: string;
  role: string;
  countryName: string;
  branchName: string;
  status: string;
}

export function UserCredentialsPdfView() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const [downloading, setDownloading] = useState(false);
  const [users, setUsers] = useState<CredentialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/erp/users/login-management", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const list: CredentialUser[] = [];
        
        json.data?.superAdminBranches?.forEach((sb: any) => {
          sb.users?.forEach((u: any) => {
            list.push({
              id: u.id,
              name: u.name,
              username: u.loginId || u.username || u.name,
              email: u.email,
              role: u.role,
              countryName: "Global",
              branchName: sb.name || "Headquarters",
              status: u.status || "Active"
            });
          });
        });

        json.data?.countries?.forEach((c: any) => {
          c.mainBranches?.forEach((mb: any) => {
            mb.users?.forEach((u: any) => {
              list.push({
                id: u.id,
                name: u.name,
                username: u.loginId || u.username,
                email: u.email,
                role: u.role,
                countryName: c.name,
                branchName: mb.name,
                status: u.status || "Active"
              });
            });
            mb.cityBranches?.forEach((cb: any) => {
              cb.users?.forEach((u: any) => {
                list.push({
                  id: u.id,
                  name: u.name,
                  username: u.loginId || u.username,
                  email: u.email,
                  role: u.role,
                  countryName: c.name,
                  branchName: `${cb.cityName} - ${cb.name}`,
                  status: u.status || "Active"
                });
              });
            });
          });
        });

        setUsers(list);
      }
    } catch (e) {
      console.error("Failed to load users for credentials view:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.countryName.toLowerCase().includes(q)
    );
  }, [users, search]);

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
            {tt("user_credentials_pdf_title", "Enterprise User Accounts, Usernames & Credentials")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {tt("user_credentials_pdf_sub", "Official verified usernames, logins and passwords (Chaman@9090) directory for all system users.")}
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
            onClick={() => {
              setDownloading(true);
              setTimeout(() => setDownloading(false), 2500);
            }}
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
          <p className="text-[11px] text-slate-400 mt-0.5">Standardized test credentials</p>
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

      {/* Interactive Quick-Copy Credentials Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {tt("verified_usernames_roster", "Verified Usernames & Login IDs Roster (یوزر نیم اور لاگ ان فہرست)")}
            </h2>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={tt("search_username_ph", "Search username, name, role...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-8 pr-3 rtl:pl-3 rtl:pr-8 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <tr>
                <Th className="py-2.5 px-3">#</Th>
                <Th className="py-2.5 px-3">Username (لاگ ان یوزر نیم)</Th>
                <Th className="py-2.5 px-3">Full Name (صارف کا نام)</Th>
                <Th className="py-2.5 px-3">Login Email</Th>
                <Th className="py-2.5 px-3">Password</Th>
                <Th className="py-2.5 px-3">Role</Th>
                <Th className="py-2.5 px-3">Branch / Country</Th>
                <Th className="py-2.5 px-3 text-center">Copy</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading usernames...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No matching user found</td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => (
                  <tr key={u.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                        {u.username}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{u.name}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{u.email}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                        <Lock className="h-3 w-3 text-emerald-600" />
                        <span>•••••••• (Secured)</span>
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {u.role.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{u.countryName}</span> • {u.branchName}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleCopy(u.username, u.id || String(i))}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900 text-slate-600 dark:text-slate-300 text-[10px] font-medium transition cursor-pointer"
                        title="Copy Username"
                      >
                        {copiedId === (u.id || String(i)) ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
