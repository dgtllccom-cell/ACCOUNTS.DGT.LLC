"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { 
  Users, 
  Search, 
  Printer, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Building2, 
  Globe, 
  KeyRound, 
  UserPlus, 
  FileText,
  FileSpreadsheet,
  Lock,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/use-language";
import { t, type UiKey } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";

interface UserDirectoryItem {
  userId: string;
  userCode: string;
  fullName: string;
  email: string;
  phone?: string;
  countryId: string | null;
  countryName: string;
  branchId: string | null;
  branchName: string;
  role: string;
  roleLabel: string;
  isActive: boolean;
  permissionsCount?: number;
  passwordVaultRef: string;
  passwordKey?: string;
  loginUrl: string;
  createdAt: string;
  updatedAt?: string;
}

export default function SuperAdminAllUsersDirectoryPage() {
  const { lang, isRTL } = useLanguage();
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // UI state
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [printModalUser, setPrintModalUser] = useState<UserDirectoryItem | null>(null);
  const [showBatchPrint, setShowBatchPrint] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/users/journal-report?limit=1000", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        const mapped: UserDirectoryItem[] = json.data.map((u: any, idx: number) => {
          const userCode = u.userCode || `USR-${String(idx + 1).padStart(4, "0")}`;
          // Generate initial access password key format for staff onboarding
          const passwordKey = u.rawPassword || `Dgt@${u.userCode || userCode.replace(/[^A-Za-z0-9]/g, "")}#2026`;
          
          let loginUrl = "/login";
          if (u.role === "super_admin") {
            loginUrl = "/login";
          } else if (u.branchId) {
            loginUrl = `/login?scope=branch&branchId=${u.branchId}`;
          } else if (u.countryId) {
            loginUrl = `/login?scope=country&countryId=${u.countryId}`;
          }

          return {
            userId: u.userId || u.id || `u-${idx}`,
            userCode,
            fullName: u.fullName || u.name || "System User",
            email: u.email || `${(u.userCode || `user${idx}`).toLowerCase()}@dgt.llc`,
            phone: u.phone || "—",
            countryId: u.countryId || null,
            countryName: u.countryName || "Global / All",
            branchId: u.branchId || null,
            branchName: u.branchName || "Main Headquarters",
            role: u.role || "staff_user",
            roleLabel: u.roleLabel || u.role || "Staff User",
            isActive: u.isActive ?? true,
            permissionsCount: u.permissionsCount || 12,
            passwordVaultRef: u.passwordVaultRef || `VAULT-DGT-${userCode}`,
            passwordKey,
            loginUrl,
            createdAt: u.createdAt || new Date().toISOString(),
            updatedAt: u.updatedAt
          };
        });
        setUsers(mapped);
      } else {
        setError(json.error?.message || "Failed to load user directory");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const togglePassword = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const countriesList = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.countryName && u.countryName !== "—") set.add(u.countryName);
    });
    return Array.from(set).sort();
  }, [users]);

  const rolesList = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.role) set.add(u.role);
    });
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        u.fullName.toLowerCase().includes(q) ||
        u.userCode.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.countryName.toLowerCase().includes(q) ||
        u.branchName.toLowerCase().includes(q) ||
        u.passwordVaultRef.toLowerCase().includes(q);

      const matchesCountry = countryFilter === "all" || u.countryName === countryFilter;
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? u.isActive : !u.isActive);

      return matchesSearch && matchesCountry && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, countryFilter, roleFilter, statusFilter]);

  const handleExportCsv = () => {
    const headers = ["Sr #", "User Code", "Full Name", "Role", "Country", "Branch", "Login URL", "Username / Email", "Password / Key", "Vault ID", "Status"];
    const rows = filteredUsers.map((u, i) => [
      i + 1,
      `"${u.userCode}"`,
      `"${u.fullName}"`,
      `"${u.roleLabel}"`,
      `"${u.countryName}"`,
      `"${u.branchName}"`,
      `"${window.location.origin}${u.loginUrl}"`,
      `"${u.email}"`,
      `"${u.passwordKey || ""}"`,
      `"${u.passwordVaultRef}"`,
      `"${u.isActive ? "Active" : "Inactive"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Super_Admin_All_Users_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintA4 = () => {
    window.print();
  };

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => u.role.includes("admin")).length;
    const branches = new Set(users.map((u) => u.branchName)).size;
    return { total, active, admins, branches };
  }, [users]);

  return (
    <div className={cn("p-4 sm:p-6 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0 print:max-w-none", isRTL && "rtl")}>
      
      {/* ─── SCREEN HEADER & ACTIONS (Hidden in Print) ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Super Admin Credential Register
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-400" />
            Super Admin / All Users Directory
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-3xl leading-relaxed">
            Centralized register of all country & branch users, direct login URLs, and access credentials. View and print official A4 handover sheets for staff onboarding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => { setPrintModalUser(null); setShowBatchPrint(true); }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all h-9 px-3.5"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print A4 Handover Sheet
          </Button>

          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-xs h-9 px-3.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Export CSV
          </Button>

          <Link href="/dashboard/new-entry/users/registration">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all h-9 px-3.5">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              New User Form
            </Button>
          </Link>

          <Button
            onClick={() => void fetchUsers()}
            disabled={loading}
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-9 px-2.5"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ─── METRIC TILES (Hidden in Print) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 print:hidden">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">{stats.total}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">Total System Users</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-emerald-600 font-mono">{stats.active}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">Active Logins</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-blue-600 font-mono">{stats.admins}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">Admin & Managers</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-purple-600 font-mono">{stats.branches}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">Covered Branches</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ─── FILTERS BAR (Hidden in Print) ─── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between print:hidden">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search User, Code, Email, Branch, Vault ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-300 font-semibold"
          >
            <option value="all">All Countries</option>
            {countriesList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-300 font-semibold"
          >
            <option value="all">All Roles</option>
            {rolesList.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-300 font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {(searchQuery || countryFilter !== "all" || roleFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setCountryFilter("all");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 h-8 px-2"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* ─── DATA DIRECTORY TABLE ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:border-none print:shadow-none">
        
        {/* Printable Header (Visible ONLY when printing) */}
        <div className="hidden print:block p-6 border-b-2 border-slate-900 mb-4">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">ACCOUNTS.DGT.LLC • ERP SYSTEM</h1>
              <p className="text-xs font-bold text-slate-600">CONFIDENTIAL • SUPER ADMIN USER CREDENTIAL & ACCESS DIRECTORY</p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-500">
              <div>Generated: {new Date().toLocaleString()}</div>
              <div>Scope: Global Enterprise Register</div>
            </div>
          </div>
          <div className="bg-slate-100 p-2.5 rounded text-[10px] text-slate-700 font-medium">
            <strong>Security Notice:</strong> This document contains official system access credentials. Handle strictly in accordance with company confidentiality policy. Do not duplicate or leave unattended.
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 flex items-center gap-3 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 uppercase font-black text-[11px] tracking-wider print:bg-slate-100 print:text-slate-900">
              <tr>
                <th className="p-3 text-center w-12">Sr #</th>
                <th className="p-3">User & Code</th>
                <th className="p-3">Role & Level</th>
                <th className="p-3">Country & Branch</th>
                <th className="p-3">Login Portal URL</th>
                <th className="p-3">Username / Email</th>
                <th className="p-3">Password Key / Vault</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 print:divide-slate-300">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading user directory & access register...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No users matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, index) => {
                  const isRevealed = revealedPasswords[u.userId];
                  
                  let roleColor = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
                  if (u.role.includes("super_admin")) {
                    roleColor = "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300";
                  } else if (u.role.includes("country_admin")) {
                    roleColor = "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300";
                  } else if (u.role.includes("branch_admin")) {
                    roleColor = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300";
                  } else if (u.role.includes("cashier") || u.role.includes("accountant")) {
                    roleColor = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300";
                  }

                  return (
                    <tr 
                      key={u.userId}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors print:hover:bg-transparent"
                    >
                      {/* Sr # */}
                      <td className="p-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                        {index + 1}
                      </td>

                      {/* User & Code */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{u.fullName}</div>
                        <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{u.userCode}</div>
                      </td>

                      {/* Role */}
                      <td className="p-3">
                        <span className={cn("px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider border", roleColor)}>
                          {u.roleLabel}
                        </span>
                      </td>

                      {/* Country & Branch */}
                      <td className="p-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                          {u.countryName}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          {u.branchName}
                        </div>
                      </td>

                      {/* Login URL */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/40 truncate max-w-[170px] inline-block" title={u.loginUrl}>
                            {u.loginUrl}
                          </span>
                          <button
                            onClick={() => copyToClipboard(`${window.location.origin}${u.loginUrl}`, `url-${u.userId}`)}
                            title="Copy Direct Login URL"
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 print:hidden"
                          >
                            {copiedKey === `url-${u.userId}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={u.loginUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open Login Page in New Tab"
                            className="text-slate-400 hover:text-blue-600 print:hidden"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* Username / Email */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                            {u.email}
                          </span>
                          <button
                            onClick={() => copyToClipboard(u.email, `email-${u.userId}`)}
                            title="Copy Username / Email"
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 print:hidden"
                          >
                            {copiedKey === `email-${u.userId}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Password Key / Vault */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] tracking-wide">
                            {isRevealed ? (u.passwordKey || "••••••••") : (u.passwordVaultRef || "••••••••")}
                          </span>
                          <button
                            onClick={() => togglePassword(u.userId)}
                            title={isRevealed ? "Hide Password Key" : "Reveal Password Key"}
                            className="text-slate-400 hover:text-indigo-600 print:hidden"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(isRevealed ? (u.passwordKey || "") : u.passwordVaultRef, `pwd-${u.userId}`)}
                            title="Copy Password / Vault Key"
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 print:hidden"
                          >
                            {copiedKey === `pwd-${u.userId}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider",
                          u.isActive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        )}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions (Screen only) */}
                      <td className="p-3 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setPrintModalUser(u); setShowBatchPrint(false); }}
                            title="Generate Individual A4 Onboarding Handover Form"
                            className="h-7 px-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          >
                            <Printer className="w-3 h-3 mr-1" />
                            A4 Slip
                          </Button>
                          <Link href={`/dashboard/new-entry/users/registration?userId=${u.userId}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700"
                            >
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Footer (Visible ONLY in print) */}
        <div className="hidden print:grid grid-cols-3 gap-8 p-6 mt-8 border-t-2 border-slate-900 text-xs">
          <div className="space-y-4">
            <div className="font-bold text-slate-800 uppercase">Super Admin Authorization</div>
            <div className="border-b border-slate-400 h-8"></div>
            <div className="text-[10px] text-slate-500">Signature & Stamp</div>
          </div>
          <div className="space-y-4">
            <div className="font-bold text-slate-800 uppercase">Country / Branch Manager</div>
            <div className="border-b border-slate-400 h-8"></div>
            <div className="text-[10px] text-slate-500">Received By & Date</div>
          </div>
          <div className="space-y-4">
            <div className="font-bold text-slate-800 uppercase">System Security Verification</div>
            <div className="border-b border-slate-400 h-8"></div>
            <div className="text-[10px] text-slate-500">IT / Security Operations Seal</div>
          </div>
        </div>
      </div>

      {/* ─── A4 HANDOVER MODAL PREVIEW (Batch or Single User) ─── */}
      {(showBatchPrint || printModalUser) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-sm">
                <Printer className="w-4 h-4 text-indigo-600" />
                {printModalUser ? `Official A4 Handover Slip: ${printModalUser.fullName}` : "A4 Batch Credential Handover Sheet"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePrintA4}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8 px-3"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print Now
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowBatchPrint(false); setPrintModalUser(null); }}
                  className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-900"
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Modal Body: A4 Sheet Preview */}
            <div className="p-6 overflow-y-auto bg-slate-100 dark:bg-slate-950 flex justify-center">
              <div className="bg-white text-slate-900 w-full max-w-2xl p-8 rounded-lg shadow-lg border border-slate-300 font-sans space-y-6">
                
                {/* Header */}
                <div className="border-b-2 border-indigo-900 pb-4 flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">ACCOUNTS.DGT.LLC</h2>
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Enterprise ERP System Access & Credential Handover Form</p>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 font-mono">
                    <div>Date: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                    <div>Doc ID: A4-HANDOVER-{new Date().getFullYear()}</div>
                  </div>
                </div>

                {printModalUser ? (
                  /* Single User Onboarding Card */
                  <div className="space-y-6 text-xs">
                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg space-y-2">
                      <div className="font-bold text-indigo-900 text-sm">EMPLOYEE & ASSIGNED BRANCH DETAILS</div>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div><strong className="text-slate-600">Employee Name:</strong> <span className="font-bold text-slate-900">{printModalUser.fullName}</span></div>
                        <div><strong className="text-slate-600">User Code:</strong> <span className="font-mono font-bold text-indigo-700">{printModalUser.userCode}</span></div>
                        <div><strong className="text-slate-600">Country Scope:</strong> <span className="font-bold">{printModalUser.countryName}</span></div>
                        <div><strong className="text-slate-600">Assigned Branch:</strong> <span className="font-bold">{printModalUser.branchName}</span></div>
                        <div><strong className="text-slate-600">Designated Role:</strong> <span className="font-bold uppercase text-indigo-800">{printModalUser.roleLabel}</span></div>
                        <div><strong className="text-slate-600">Vault Reference:</strong> <span className="font-mono">{printModalUser.passwordVaultRef}</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-3">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-emerald-600" />
                        DIRECT PORTAL LOGIN CREDENTIALS
                      </div>
                      <div className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-slate-500">Login Portal URL:</span>
                          <span className="font-bold text-blue-700">{window.location.origin}{printModalUser.loginUrl}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-slate-500">Login Username / Email:</span>
                          <span className="font-bold text-slate-900">{printModalUser.email}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-slate-500">Initial Access Password Key:</span>
                          <span className="font-bold text-rose-700">{printModalUser.passwordKey || printModalUser.passwordVaultRef}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 space-y-1 leading-relaxed">
                      <strong>Security Policy & Instructions:</strong>
                      <p>
                        1. Navigate to the portal URL specified above using Google Chrome or Microsoft Edge.
                        <br />
                        2. Login using your assigned username and initial password key.
                        <br />
                        3. You will be prompted to verify your session and access permissions.
                        <br />
                        4. Do not share your credentials with any unauthorized person.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Batch Summary Table */
                  <div className="space-y-4">
                    <table className="w-full text-[11px] border border-slate-300 text-left">
                      <thead className="bg-slate-100 font-bold border-b border-slate-300">
                        <tr>
                          <th className="p-2">Sr #</th>
                          <th className="p-2">User / Code</th>
                          <th className="p-2">Country & Branch</th>
                          <th className="p-2">Login URL</th>
                          <th className="p-2">Username</th>
                          <th className="p-2">Initial Key / Vault</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredUsers.slice(0, 15).map((u, i) => (
                          <tr key={u.userId}>
                            <td className="p-2 font-bold font-mono">{i + 1}</td>
                            <td className="p-2">
                              <div className="font-bold">{u.fullName}</div>
                              <div className="text-[9px] text-slate-500 font-mono">{u.userCode}</div>
                            </td>
                            <td className="p-2">{u.countryName} • {u.branchName}</td>
                            <td className="p-2 font-mono text-[10px] text-blue-700 truncate max-w-[130px]">{u.loginUrl}</td>
                            <td className="p-2 font-mono text-[10px]">{u.email}</td>
                            <td className="p-2 font-mono font-bold text-[10px] text-indigo-700">{u.passwordKey || u.passwordVaultRef}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredUsers.length > 15 && (
                      <p className="text-[10px] text-slate-500 italic text-center">
                        Showing first 15 of {filteredUsers.length} users. Use the Print button to produce full document.
                      </p>
                    )}
                  </div>
                )}

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
                  <div className="space-y-4">
                    <div className="font-bold text-slate-800">Issued By (Super Admin):</div>
                    <div className="border-b border-slate-400 h-6"></div>
                    <div className="text-[10px] text-slate-500">Authorized Signature & Date</div>
                  </div>
                  <div className="space-y-4">
                    <div className="font-bold text-slate-800">Received By (Employee / Manager):</div>
                    <div className="border-b border-slate-400 h-6"></div>
                    <div className="text-[10px] text-slate-500">Employee Signature & Date</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
