"use client";

import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { 
  Ban,
  BarChart3,
  ChevronRight, 
  Eye,
  Expand,
  Download,
  FileSpreadsheet, 
  Info,
  KeyRound,
  Landmark,
  LogIn,
  Minimize2, 
  MoreHorizontal,
  PencilLine,
  Printer, 
  Search, 
  Mail, 
  PhoneCall,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
  X,
  XCircle
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { openBranchProfileReport } from "@/lib/reports/build-branch-profile-report";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type CityBranchNode = {
  id: string;
  cityName: string;
  name: string;
  code: string;
  localCurrency: string;
  status: string;
  address?: string | null;
  companyId?: string | null;
  ownerName?: string | null;
  managerName?: string | null;
  accountsCount?: number;
  email?: string | null;
  phone?: string | null;
  contacts?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
  userCount?: number;
  users?: BranchUserDetail[];
};

type MainBranchNode = {
  id: string;
  name: string;
  code: string;
  localCurrency: string;
  status: string;
  isMain: boolean;
  address?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  ownerName?: string | null;
  email?: string | null;
  accountCode?: string | null;
  contacts?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
  cityBranches: CityBranchNode[];
  userCount?: number;
  users?: BranchUserDetail[];
};

type CountryNode = {
  id: string;
  name: string;
  code: string;
  currency: string;
  status: string;
  totalMainBranches: number;
  totalCityBranches: number;
  totalActiveMainBranches: number;
  totalActiveCityBranches: number;
  mainBranches: MainBranchNode[];
  userCount?: number;
  users?: BranchUserDetail[];
};

type SuperAdminBranchNode = {
  id: string;
  name: string;
  code: string;
  currency: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  ownerName?: string | null;
  contacts?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
  companyName?: string | null;
};

type BranchGeneralReportResponse = {
  summary: {
    superAdminName: string;
    totalCountries: number;
    totalMainBranches: number;
    totalCityBranches: number;
    totalActiveUsers: number;
    totalActiveBranches: number;
    totalInactiveBranches: number;
    totalMainAccounts: number;
    users?: BranchUserDetail[];
  };
  superAdminBranches: SuperAdminBranchNode[];
  countries: CountryNode[];
  generatedAt: string;
};

type BranchUserDetail = {
  id: string;
  name: string;
  username: string;
  temporaryPassword: string | null;
  mobile: string;
  email: string;
  role: string;
  classification: string;
  mainUser: boolean;
  countryName: string;
  cityName: string;
  branchName: string;
  branchCode: string;
  department: string;
  permissions: string[];
  status: string;
  createdDate: string | null;
};

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesText(haystack: string, query: string) {
  if (!query) return true;
  return normalizeSearch(haystack).includes(normalizeSearch(query));
}

function csvEscape(value: string) {
  const v = (value ?? "").toString();
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadTextFile(filename: string, contents: string, mime = "text/plain") {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getCountryTags(countryName: string) {
  const name = countryName.toLowerCase();
  if (name.includes("pakistan")) {
    return ["Electronics", "Mobile Devices", "Import Products"];
  } else if (name.includes("india")) {
    return ["Software Tech", "Customer Services", "Outsourcing Center"];
  } else if (name.includes("afghanistan")) {
    return ["Transit Trade", "Agricultural Goods", "Border Cargo"];
  } else if (name.includes("dubai") || name.includes("emirates")) {
    return ["Logistic Hub", "Corporate Services", "Regional HQ"];
  }
  return ["General Operations", "Import / Export", "Local Branch Office"];
}

function findContactValue(value: unknown, key: string): string {
  if (!value) return "";
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return "";
    }
  }
  if (!Array.isArray(arr)) return "";
  const row = arr.find((item) => {
    if (item && typeof item === "object" && "type" in item && "value" in item) {
      const contact = item as { type?: string; value?: string };
      return String(contact.type ?? "").toLowerCase().includes(key.toLowerCase());
    }
    return false;
  }) as { value?: string } | undefined;
  return row?.value ?? "";
}

function openCountryBranchEdit(branchId: string) {
  window.location.href = `/dashboard/new-entry/branch-entry/country-branch?editId=${encodeURIComponent(branchId)}`;
}

function openCityBranchEdit(branchId: string) {
  window.location.href = `/dashboard/new-entry/branch-entry/city-branch?editId=${encodeURIComponent(branchId)}`;
}

function openSuperAdminBranchEdit(branchId: string) {
  window.location.href = `/dashboard/new-entry/branches/super-admin?editId=${encodeURIComponent(branchId)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function openUserProfile(userId: string) {
  window.location.href = `/dashboard/new-entry/users/journal-report?userId=${encodeURIComponent(userId)}`;
}

function openUserEdit(userId: string) {
  window.location.href = `/dashboard/new-entry/users/registration?userId=${encodeURIComponent(userId)}`;
}

function UserCountButton({
  count,
  expanded,
  onClick,
  title
}: {
  count: number;
  expanded: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black tabular-nums transition-all",
        expanded
          ? "border-indigo-300 bg-indigo-600 text-white shadow-sm"
          : "border-indigo-100 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100"
      )}
    >
      <Users className="h-3 w-3" />
      {count}
      <span className="text-[10px] leading-none">{expanded ? "-" : "+"}</span>
    </button>
  );
}

function BranchUsersPanel({
  title,
  hierarchy,
  users,
  onClose
}: {
  title: string;
  hierarchy: string[];
  users: BranchUserDetail[];
  onClose?: () => void;
}) {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const grouped = users.reduce<Record<string, BranchUserDetail[]>>((acc, user) => {
    const key = user.classification || "Staff User";
    acc[key] = acc[key] ?? [];
    acc[key].push(user);
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 text-left shadow-inner">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">
            <Users className="h-4 w-4" />
            {title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-bold text-slate-500">
            {hierarchy.map((item, index) => (
              <span key={`${item}-${index}`} className="inline-flex items-center gap-1">
                <span className="rounded bg-white px-1.5 py-0.5 text-slate-700 ring-1 ring-slate-200">{item || "-"}</span>
                {index < hierarchy.length - 1 ? <ChevronRight className="h-3 w-3 text-slate-400" /> : null}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-right shadow-sm">
            <div className="text-[9px] font-black uppercase text-slate-400">{tt("bgr.total_users", "Total Users")}</div>
            <div className="text-sm font-black text-indigo-700">{users.length}</div>
          </div>
          {onClose ? (
            <button
              type="button"
              title="Close user details"
              aria-label="Close user details"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm hover:bg-rose-50 hover:text-rose-600"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {users.length ? (
        <>
          <div className="mb-2 grid gap-2 md:grid-cols-3">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">{group}</div>
                <div className="mt-1 text-sm font-black text-slate-900">{list.length}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="border-b bg-slate-50 text-center font-black uppercase tracking-wide text-slate-500">
                  <Th className="border-r p-2">SR.</Th>
                  <Th className="border-r p-2 text-left">User ID</Th>
                  <Th className="border-r p-2">Country</Th>
                  <Th className="border-r p-2">City</Th>
                  <Th className="border-r p-2">Branch</Th>
                  <Th className="border-r p-2 text-left">User Name</Th>
                  <Th className="border-r p-2">Login ID</Th>
                  <Th className="border-r p-2">Temp Password</Th>
                  <Th className="border-r p-2">Email</Th>
                  <Th className="border-r p-2">Role</Th>
                  <Th className="border-r p-2">Status</Th>
                  <Th className="p-2">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user.id} className="border-b text-center text-slate-700 hover:bg-indigo-50/30">
                    <td className="border-r p-2 font-bold">{index + 1}</td>
                    <td className="border-r p-2 text-left font-mono font-bold text-indigo-800 bg-indigo-50/50">{user.id?.slice(0, 8).toUpperCase() || `USR-${index + 1}`}</td>
                    <td className="border-r p-2">{user.countryName || "-"}</td>
                    <td className="border-r p-2">{user.cityName || "-"}</td>
                    <td className="border-r p-2">{user.branchName || "-"}</td>
                    <td className="border-r p-2 text-left font-bold text-slate-900">{user.name || "-"}</td>
                    <td className="border-r p-2 font-mono font-black text-indigo-700">{user.username || "-"}</td>
                    <td className="border-r p-2 font-mono">{user.temporaryPassword || "-"}</td>
                    <td className="border-r p-2">{user.email || "-"}</td>
                    <td className="border-r p-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-700">{user.role || "-"}</span>
                    </td>
                    <td className="border-r p-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-black",
                          user.status === "Active" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                        )}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="p-2 relative text-center">
                      <div className="inline-block relative text-left">
                        <button
                          type="button"
                          className="action-dropdown-trigger flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 mx-auto"
                          onClick={(e) => {
                            const btn = e.currentTarget;
                            const panel = btn.nextElementSibling as HTMLElement;
                            if (panel) panel.classList.toggle("hidden");
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4 text-slate-600" />
                        </button>
                        <div className="action-dropdown-content hidden absolute right-0 z-50 mt-1 w-32 rounded-md bg-white p-1 shadow-lg ring-1 ring-black ring-opacity-5">
                          <button onClick={() => openUserEdit(user.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">
                            <PencilLine className="h-3 w-3" /> {tt("bgr.edit", "Edit")}
                          </button>
                          <button onClick={() => alert(`Block User: ${user.username}`)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700">
                            <Ban className="h-3 w-3" /> {tt("bgr.block", "Block")}
                          </button>
                          <button onClick={() => openUserProfile(user.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700">
                            <Eye className="h-3 w-3" /> {tt("bgr.open_btn", "Open")}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-[10px] font-bold text-slate-400">
          {tt("bgr.no_users", "No users are assigned to this hierarchy level yet.")}
        </div>
      )}
    </div>
  );
}

function LoginListPanel({ users, onClose }: { users: BranchUserDetail[]; onClose?: () => void }) {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const sortedUsers = [...users].sort((a, b) => {
    const countryCompare = (a.countryName || "").localeCompare(b.countryName || "");
    if (countryCompare) return countryCompare;
    const branchCompare = (a.branchName || "").localeCompare(b.branchName || "");
    if (branchCompare) return branchCompare;
    return (a.username || "").localeCompare(b.username || "");
  });

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 text-left shadow-inner">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
            <LogIn className="h-4 w-4" />
            {tt("bgr.login_access_list", "Login Access List")}
          </div>
          <div className="mt-1 text-[10px] font-bold text-slate-500">
            {tt("bgr.login_desc", "Country, main branch, city branch and user login details for Super Admin review.")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Open Login Page"
            aria-label="Open Login Page"
            onClick={() => {
              window.location.href = "/auth/login";
            }}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-black text-blue-700 shadow-sm hover:bg-blue-50"
          >
            {tt("bgr.open_login", "Open Login Page")}
          </button>
          {onClose ? (
            <button
              type="button"
              title="Close login list"
              aria-label="Close login list"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm hover:bg-rose-50 hover:text-rose-600"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {sortedUsers.length ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1250px] w-full border-collapse text-[9px]">
            <thead>
              <tr className="border-b bg-slate-50 text-center font-black uppercase tracking-wide text-slate-500">
                <Th className="border-r p-2 text-left">Country Login</Th>
                <Th className="border-r p-2 text-left">Main Branch Login</Th>
                <Th className="border-r p-2 text-left">City Branch Login</Th>
                <Th className="border-r p-2">Username</Th>
                <Th className="border-r p-2">Password</Th>
                <Th className="border-r p-2">Role</Th>
                <Th className="border-r p-2">User Name</Th>
                <Th className="border-r p-2">Email</Th>
                <Th className="border-r p-2">Status</Th>
                <Th className="p-2">Action</Th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={`login-${user.id}`} className="border-b text-center text-slate-700 hover:bg-blue-50/40">
                  <td className="border-r p-2 text-left font-bold">{user.countryName || "-"}</td>
                  <td className="border-r p-2 text-left">{user.branchName || "-"}</td>
                  <td className="border-r p-2 text-left">{user.cityName || "-"}</td>
                  <td className="border-r p-2 font-mono font-black text-blue-700">{user.username || "-"}</td>
                  <td className="border-r p-2 font-mono">{user.temporaryPassword || "-"}</td>
                  <td className="border-r p-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-700">{user.role || "-"}</span>
                  </td>
                  <td className="border-r p-2 text-left font-bold text-slate-900">{user.name || "-"}</td>
                  <td className="border-r p-2">{user.email || "-"}</td>
                  <td className="border-r p-2">
                    <span className={cn("rounded-full px-2 py-0.5 font-black", user.status === "Active" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-1 ring-rose-100")}>
                      {user.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      title="Open Login"
                      aria-label="Open Login"
                      onClick={() => {
                        window.location.href = `/auth/login?username=${encodeURIComponent(user.username || "")}`;
                      }}
                      className="rounded border border-blue-200 bg-white px-2 py-1 text-[9px] font-black text-blue-700 hover:bg-blue-50"
                    >
                      {tt("bgr.login_btn", "Login")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-[10px] font-bold text-slate-400">
          {tt("bgr.no_login_users", "No login users found.")}
        </div>
      )}
    </div>
  );
}

/**
 * ActionDropdownMenu - portal-based floating menu anchored to a button rect.
 * Renders at document.body level (z-[9999]) so it's never clipped by
 * overflow:hidden containers such as scrollable tables.
 * Auto-flips upward when there is insufficient space below the button.
 */
function ActionDropdownMenu({
  anchorRect,
  onClose,
  children
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  children: ReactNode;
}) {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const MENU_HEIGHT_ESTIMATE = 160;
  const MENU_WIDTH = 200;
  const OFFSET = 6;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;

  const spaceBelow = viewportH - anchorRect.bottom;
  const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE + OFFSET && anchorRect.top > MENU_HEIGHT_ESTIMATE;

  const top = openUpward
    ? anchorRect.top + window.scrollY - MENU_HEIGHT_ESTIMATE - OFFSET
    : anchorRect.bottom + window.scrollY + OFFSET;

  // Align right edge with button, but clamp to viewport
  let left = anchorRect.right + window.scrollX - MENU_WIDTH;
  if (left < 8) left = 8;
  if (left + MENU_WIDTH > viewportW - 8) left = viewportW - MENU_WIDTH - 8;

  return (
    <div
      className="bgr-action-portal fixed z-[9999] pointer-events-none"
      style={{ top: 0, left: 0, width: 0, height: 0 }}
    >
      <div
        className="bgr-action-portal absolute pointer-events-auto"
        style={{ top, left, width: MENU_WIDTH }}
      >
        {/* Backdrop for easy close */}
        <div className="fixed inset-0 z-[-1]" onClick={onClose} />
        {/* Menu panel */}
        <div className={cn(
          "rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xl ring-1 ring-black/5",
          "animate-in fade-in slide-in-from-top-1 duration-100"
        )}>
          <div className="px-3 pb-1.5 pt-0.5 text-[8px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 mb-1">
            {tt("bgr.actions", "Actions")}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ActionItem({
  icon,
  label,
  onClick,
  color = "default",
  disabled = false
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  color?: "default" | "emerald" | "indigo" | "rose";
  disabled?: boolean;
}) {
  const colorMap = {
    default: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
    emerald: "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800",
    indigo: "text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800",
    rose: "text-rose-700 hover:bg-rose-50 hover:text-rose-800"
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-[10px] font-semibold text-left transition-colors rounded-none first:rounded-t-lg last:rounded-b-lg disabled:opacity-40 disabled:cursor-not-allowed",
        colorMap[color]
      )}
    >
      <span className="flex-shrink-0 opacity-75">{icon}</span>
      {label}
    </button>
  );
}


function ReportMetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "indigo",
  tooltip
}: {
  title: string;
  value: ReactNode;
  subtitle: string;
  icon: ReactNode;
  tone?: "indigo" | "emerald" | "sky" | "amber" | "rose" | "slate";
  tooltip?: string;
}) {
  const toneClasses: Record<string, string> = {
    indigo: "from-indigo-500/10 to-indigo-50 text-indigo-700 ring-indigo-100",
    emerald: "from-emerald-500/10 to-emerald-50 text-emerald-700 ring-emerald-100",
    sky: "from-sky-500/10 to-sky-50 text-sky-700 ring-sky-100",
    amber: "from-amber-500/10 to-amber-50 text-amber-700 ring-amber-100",
    rose: "from-rose-500/10 to-rose-50 text-rose-700 ring-rose-100",
    slate: "from-slate-500/10 to-slate-50 text-slate-700 ring-slate-100"
  };

  return (
    <div
      title={tooltip || title}
      className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] ring-1 ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_24px_46px_-30px_rgba(79,70,229,0.45)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{title}</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</div>
        </div>
        <div className={cn("rounded-2xl bg-gradient-to-br p-2.5 shadow-sm ring-1 transition-transform duration-200 group-hover:scale-105", toneClasses[tone])}>
          {icon}
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] font-semibold leading-snug text-slate-500">{subtitle}</div>
    </div>
  );
}
export function BranchGeneralReportView({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string | null;
}) {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [loading, setLoading] = useState(true);
  const [expandedView, setExpandedView] = useState(false);
  const [data, setData] = useState<BranchGeneralReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState(""); // "", "branch", "country", "city"
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [expandedUserScope, setExpandedUserScope] = useState<string | null>(null);
  
  const [activeContactPopup, setActiveContactPopup] = useState<{ id: string; type: "phone" | "email" } | null>(null);
  const [activeProductPopup, setActiveProductPopup] = useState<string | null>(null);
  const [activeActionDropdownId, setActiveActionDropdownId] = useState<string | null>(null);
  const [activeActionAnchorRect, setActiveActionAnchorRect] = useState<DOMRect | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [branchDetailModal, setBranchDetailModal] = useState<{ country: CountryNode; branch: MainBranchNode } | null>(null);

  function openActionDropdown(id: string, btn: HTMLButtonElement) {
    if (activeActionDropdownId === id) {
      setActiveActionDropdownId(null);
      setActiveActionAnchorRect(null);
    } else {
      setActiveActionDropdownId(id);
      setActiveActionAnchorRect(btn.getBoundingClientRect());
    }
  }

  const [viewLoadingId, setViewLoadingId] = useState<string | null>(null);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTitleSlot(document.getElementById("erp-page-title-slot"));
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
  }, []);

  async function viewCountryBranch(branchId: string, countryName: string) {
    try {
      setViewLoadingId(branchId);
      const res = await fetch(`/api/branch-management/country-branches?id=${encodeURIComponent(branchId)}`, {
        cache: "no-store"
      });
      const json = await res.json();
      const row = json.countryBranches?.[0];
      if (!row) throw new Error("Main branch not found.");
      
      const phoneVal = findContactValue(row.contacts, "phone") || findContactValue(row.contacts, "mobile") || row.phone || "";
      const emailVal = findContactValue(row.contacts, "email") || row.email || "";
      const whatsappVal = findContactValue(row.contacts, "whatsapp") || "";

      const activeLang = typeof document !== "undefined" ? document.documentElement.lang : "en";
      openBranchProfileReport({
        kind: "country",
        lang: activeLang,
        autoPrint: false,
        data: {
          serialNumber: row.id.slice(0, 4).toUpperCase(),
          branchStatus: row.status || "Active",
          branchCode: row.code || null,
          branchType: "MAIN",
          country: countryName,
          currency: row.local_currency || "USD",
          branchName: row.name || `${countryName} Main Branch`,
          createdDate: row.created_at ? new Date(row.created_at).toLocaleDateString() : null,
          updatedDate: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : null,
          createdBy: row.created_by_name || "Super Admin",
          fullAddress: row.address || null,
          ownerName: row.owner_name || null,
          ownerPhone: phoneVal || null,
          ownerWhatsApp: whatsappVal || null,
          ownerEmail: emailVal || null,
          companyName: row.company_name || null,
          companyStatus: "Active",
          companyOfficeAddress: row.address || null,
          allowedPermissions: row.permission_grants || [],
          permissionTemplate: row.permission_template || null,
          remarks: null,
        },
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load branch details.");
    } finally {
      setViewLoadingId(null);
    }
  }

  async function viewCityBranch(branchId: string, countryName: string, cityName: string) {
    try {
      setViewLoadingId(branchId);
      const res = await fetch(`/api/branch-management/city-branches?id=${encodeURIComponent(branchId)}`, {
        cache: "no-store"
      });
      const json = await res.json();
      const row = json.cityBranches?.[0];
      if (!row) throw new Error("City branch not found.");
      
      const phoneVal = findContactValue(row.contacts, "phone") || findContactValue(row.contacts, "mobile") || row.phone || "";
      const emailVal = findContactValue(row.contacts, "email") || row.email || "";
      const whatsappVal = findContactValue(row.contacts, "whatsapp") || "";

      const activeLang = typeof document !== "undefined" ? document.documentElement.lang : "en";
      openBranchProfileReport({
        kind: "city",
        lang: activeLang,
        autoPrint: false,
        data: {
          serialNumber: row.id.slice(0, 4).toUpperCase(),
          branchStatus: row.status || "Active",
          branchCode: row.code || null,
          branchType: "CITY",
          country: countryName,
          city: cityName,
          currency: row.local_currency || "USD",
          branchName: row.name || `${cityName} City Branch`,
          createdDate: row.created_at ? new Date(row.created_at).toLocaleDateString() : null,
          updatedDate: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : null,
          createdBy: row.created_by_name || "Super Admin",
          fullAddress: row.address || null,
          ownerName: row.owner_name || null,
          ownerPhone: phoneVal || null,
          ownerWhatsApp: whatsappVal || null,
          ownerEmail: emailVal || null,
          companyName: row.company_name || null,
          companyStatus: "Active",
          companyOfficeAddress: row.address || null,
          allowedPermissions: row.permission_grants || [],
          permissionTemplate: row.permission_template || null,
          remarks: null,
        },
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load branch details.");
    } finally {
      setViewLoadingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGet<BranchGeneralReportResponse>("/api/branch-management/general-report");
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".popup-trigger") && !target.closest(".popup-content") &&
          !target.closest(".action-dropdown-trigger") && !target.closest(".bgr-action-portal")) {
        setActiveContactPopup(null);
        setActiveProductPopup(null);
        setActiveActionDropdownId(null);
        setActiveActionAnchorRect(null);
      }
    }
    function handleScroll() {
      setActiveActionDropdownId(null);
      setActiveActionAnchorRect(null);
    }
    document.addEventListener("mousedown", handleGlobalClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const filteredSuperAdminBranches = useMemo(() => {
    if (!data?.superAdminBranches) return [];
    const q = searchQuery.toLowerCase().trim();
    return data.superAdminBranches.filter((b) => {
      if (searchType === "country" || searchType === "city") return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.ownerName || "").toLowerCase().includes(q)
      );
    });
  }, [data?.superAdminBranches, searchQuery, searchType]);

  const operatingCountries = useMemo(() => {
    if (!data?.countries) return [];
    return data.countries.filter((country) => country.mainBranches && country.mainBranches.length > 0);
  }, [data?.countries]);

  const filteredCountries = useMemo(() => {
    if (!data?.countries) return [];
    const q = searchQuery.toLowerCase().trim();

    if (!q && searchType === "all") {
      return operatingCountries;
    }

    return data.countries
      .map((country) => {
        const countryMatches = q ? matchesText(`${country.name} ${country.code} ${country.currency} ${country.status}`, q) : true;

        const mainBranches = (country.mainBranches || [])
          .map((branch) => {
            const branchMatches = q ? matchesText(`${branch.name} ${branch.code} ${branch.localCurrency} ${branch.status}`, q) : true;

            const cityBranches = (branch.cityBranches || []).filter((city) => {
              if (searchType === "branch") return false;
              if (!q) return true;
              return matchesText(`${city.cityName} ${city.name} ${city.code} ${city.localCurrency} ${city.status}`, q);
            });

            if (searchType === "city" && !cityBranches.length) return null;
            if (searchType === "branch" && !branchMatches) return null;

            if (q && !countryMatches && !branchMatches && !cityBranches.length) return null;

            return {
              ...branch,
              cityBranches
            };
          })
          .filter((branch): branch is MainBranchNode => branch !== null);

        if (searchType === "country" && !countryMatches) return null;
        if (q && !countryMatches && !mainBranches.length) return null;

        return {
          ...country,
          mainBranches
        };
      })
      .filter((country): country is CountryNode => country !== null && country.mainBranches.length > 0);
  }, [data?.countries, operatingCountries, searchQuery, searchType]);

  const visibleSummary = useMemo(() => {
    const sourceCountries = searchQuery.trim() ? filteredCountries : operatingCountries;
    const totalCountries = sourceCountries.length || data?.summary?.totalCountries || 0;
    const totalMainBranches = sourceCountries.reduce((sum, country) => sum + (country.mainBranches?.length || 0), 0) || data?.summary?.totalMainBranches || 0;
    const totalCityBranches = sourceCountries.reduce(
      (sum, country) => sum + (country.mainBranches || []).reduce((branchSum, branch) => branchSum + (branch.cityBranches?.length || 0), 0),
      0
    ) || data?.summary?.totalCityBranches || 0;
    const activeBranches = sourceCountries.reduce(
      (sum, country) =>
        sum +
        (country.mainBranches || []).filter((branch) => branch.status?.toLowerCase() === "active").length +
        (country.mainBranches || []).reduce(
          (branchSum, branch) => branchSum + (branch.cityBranches || []).filter((city) => city.status?.toLowerCase() === "active").length,
          0
        ),
      0
    ) || data?.summary?.totalActiveBranches || 0;

    // Deduplicate user IDs across the hierarchy to avoid double/triple counting between city, main branch, and country
    const userMap = new Map<string, BranchUserDetail>();
    sourceCountries.forEach((country) => {
      (country.users || []).forEach((u) => {
        if (u?.id) userMap.set(u.id, u);
      });
      (country.mainBranches || []).forEach((branch) => {
        (branch.users || []).forEach((u) => {
          if (u?.id) userMap.set(u.id, u);
        });
        (branch.cityBranches || []).forEach((city) => {
          (city.users || []).forEach((u) => {
            if (u?.id) userMap.set(u.id, u);
          });
        });
      });
    });
    const totalUsers = userMap.size || (searchQuery.trim() ? 0 : data?.summary?.totalActiveUsers || 0);

    const currencies = new Set<string>();
    sourceCountries.forEach((country) => {
      if (country.currency) currencies.add(country.currency);
      (country.mainBranches || []).forEach((branch) => {
        if (branch.localCurrency) currencies.add(branch.localCurrency);
        (branch.cityBranches || []).forEach((city) => {
          if (city.localCurrency) currencies.add(city.localCurrency);
        });
      });
    });

    return {
      totalCountries,
      totalMainBranches,
      totalCityBranches,
      activeBranches,
      inactiveBranches: (totalMainBranches + totalCityBranches) - activeBranches,
      totalUsers,
      totalMainAccounts: data?.summary?.totalMainAccounts ?? 0,
      totalCurrencies: currencies.size || 4
    };
  }, [data?.summary, filteredCountries, operatingCountries, searchQuery]);

  function exportCsv() {
    if (!data) return;

    const rows: string[][] = [
      ["Level", "Country", "Country Code", "Main Branch", "Main Branch Code", "City", "City Branch", "City Branch Code", "Status", "Currency"]
    ];

    for (const country of filteredCountries) {
      rows.push(["Country", country.name, country.code, "", "", "", "", "", country.status, country.currency]);
      for (const branch of country.mainBranches) {
        rows.push([
          "Main Branch",
          country.name,
          country.code,
          branch.name,
          branch.code,
          "",
          "",
          "",
          branch.status,
          branch.localCurrency
        ]);
        for (const city of branch.cityBranches) {
          rows.push([
            "City Branch",
            country.name,
            country.code,
            branch.name,
            branch.code,
            city.cityName,
            city.name,
            city.code,
            city.status,
            city.localCurrency
          ]);
        }
      }
    }

    const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\r\n");
    downloadTextFile(`branch-general-report_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  }

  function toggleCountryRow(countryId: string) {
    setExpandedCountries((prev) => ({
      ...prev,
      [countryId]: !prev[countryId]
    }));
  }

  function toggleUserScope(scopeId: string) {
    setExpandedUserScope((current) => (current === scopeId ? null : scopeId));
  }

  const containerClassName = expandedView 
    ? "fixed inset-0 z-50 overflow-auto bg-slate-50 p-4 md:p-6 font-sans text-xs text-slate-800" 
    : "space-y-4 font-sans text-xs text-slate-800 bg-gradient-to-b from-slate-50 to-white p-4 rounded-2xl border border-slate-200";

  return (
    <div className={containerClassName} dir={isRtl ? "rtl" : "ltr"}>

      {/* Title Slot Portal */}
      {titleSlot && createPortal(
        <div className="min-w-[120px]">
          <div className="text-[8px] font-black uppercase tracking-wider text-slate-400 leading-none">
            Super Admin
          </div>
          <h1 className="text-xs font-black tracking-tight text-slate-900 dark:text-slate-100 leading-none mt-0.5">
            {title}
          </h1>
        </div>,
        titleSlot
      )}

      {/* Actions Slot Portal */}
      {actionsSlot && createPortal(
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Category Selector */}
          <select
            id="searchType"
            className="h-7 rounded-lg border border-slate-300 bg-white px-2 text-[9px] font-extrabold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
          >
            <option value="">{tt("bgr.filter_all", "Category")}</option>
            <option value="branch">{tt("bgr.filter_branch", "Branch")}</option>
            <option value="country">{tt("bgr.filter_country", "Country")}</option>
            <option value="city">{tt("bgr.filter_city", "City")}</option>
          </select>

          {/* Search Bar */}
          <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-2 h-7 shadow-sm w-36">
            <Search className="h-3 w-3 text-slate-400 mr-1.5 flex-shrink-0" />
            <input
              type="text"
              id="branchSearch"
              placeholder={tt("bgr.search_ph", "Search...")}
              className="w-full bg-transparent border-none outline-none text-[9px] font-semibold placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="border-l border-slate-200 h-5 mx-0.5"></div>

          {/* Interactive Metric Filter Buttons */}
          <button
            type="button"
            title={`Operating Countries: ${visibleSummary.totalCountries}`}
            className={cn(
              "h-7 px-2 rounded-lg border text-[9px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              searchType === "country"
                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            )}
            onClick={() => setSearchType(searchType === "country" ? "" : "country")}
          >
            <span>{tt("bgr.countries_btn", "Countries")}</span>
            <span className={cn(
              "px-1 py-0.2 rounded font-mono text-[8px] font-extrabold leading-none",
              searchType === "country" ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {visibleSummary.totalCountries}
            </span>
          </button>

          <button
            type="button"
            title={`Total Branches: ${visibleSummary.totalMainBranches + visibleSummary.totalCityBranches} (${visibleSummary.totalMainBranches} Main + ${visibleSummary.totalCityBranches} City)`}
            className={cn(
              "h-7 px-2 rounded-lg border text-[9px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              searchType === "branch"
                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            )}
            onClick={() => setSearchType(searchType === "branch" ? "" : "branch")}
          >
            <span>{tt("bgr.branches_btn", "Branches")}</span>
            <span className={cn(
              "px-1 py-0.2 rounded font-mono text-[8px] font-extrabold leading-none",
              searchType === "branch" ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {visibleSummary.totalMainBranches + visibleSummary.totalCityBranches}
            </span>
          </button>

          <button
            type="button"
            title={`Assigned ERP Users: ${visibleSummary.totalUsers}`}
            className={cn(
              "h-7 px-2 rounded-lg border text-[9px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              expandedUserScope === "all-users"
                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            )}
            onClick={() => toggleUserScope("all-users")}
          >
            <span>{tt("bgr.users_btn", "Users")}</span>
            <span className={cn(
              "px-1 py-0.2 rounded font-mono text-[8px] font-extrabold leading-none",
              expandedUserScope === "all-users" ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {visibleSummary.totalUsers}
            </span>
          </button>

          <button
            type="button"
            className={cn(
              "h-7 px-2 rounded-lg border text-[9px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-blue-500",
              expandedUserScope === "login-list"
                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            )}
            onClick={() => toggleUserScope("login-list")}
          >
            <LogIn className="h-3 w-3" />
            <span>{tt("bgr.login_toggle", "Login")}</span>
          </button>

          <button
            type="button"
            className={cn(
              "h-7 px-2 rounded-lg border text-[9px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-emerald-500",
              (!searchType && !searchQuery)
                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/80"
            )}
            onClick={() => {
              setSearchType("");
              setSearchQuery("");
            }}
          >
            <span>{tt("bgr.reports_btn", "Reports")}</span>
          </button>

          <div className="border-l border-slate-200 h-5 mx-0.5"></div>

          {/* Action Buttons */}
          <div className="relative">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 text-[9px] font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs focus:ring-1 focus:ring-indigo-500 transition-colors py-0 px-2"
              onClick={() => setNewMenuOpen(prev => !prev)}
            >
              <span>{tt("bgr.new_setup", "+ New Setup")}</span>
              <ChevronRight className={cn("h-2.5 w-2.5 transition-transform duration-200", newMenuOpen ? "rotate-90" : "")} />
            </Button>
            
            {newMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)}></div>
                <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in slide-in-from-top-1 duration-150 font-sans">
                  <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                    {tt("bgr.select_level", "Select Hierarchy Level")}
                  </div>
                  <button
                    onClick={() => {
                      setNewMenuOpen(false);
                      window.location.href = "/dashboard/new-entry/branches/super-admin";
                    }}
                    className="flex w-full items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    {tt("bgr.create_country", "1. Create Country (Super Admin)")}
                  </button>
                  <button
                    onClick={() => {
                      setNewMenuOpen(false);
                      window.location.href = "/dashboard/new-entry/branch-entry/country-branch";
                    }}
                    className="flex w-full items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    {tt("bgr.create_main", "2. Create Main Branch (Country)")}
                  </button>
                  <button
                    onClick={() => {
                      setNewMenuOpen(false);
                      window.location.href = "/dashboard/new-entry/branch-entry/city-branch";
                    }}
                    className="flex w-full items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    {tt("bgr.create_city", "3. Create City Branch (City)")}
                  </button>
                </div>
              </>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[9px] font-bold gap-1 bg-white border-slate-300 hover:bg-slate-50 focus:ring-1 focus:ring-indigo-500 py-0 px-2"
            onClick={() => window.print()}
          >
            <Printer className="h-3 w-3" />
            {tt("bgr.print", "Print")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[9px] font-bold gap-1 bg-white border-slate-300 hover:bg-slate-50 focus:ring-1 focus:ring-indigo-500 py-0 px-2"
            onClick={() => {
              const link = document.createElement("a");
              link.href = "/exports/DGT_Standard_Branch_Users.pdf";
              link.download = "DGT_Standard_Branch_Users.pdf";
              link.click();
            }}
          >
            <Download className="h-3 w-3 text-blue-600" />
            {tt("bgr.pdf_btn", "PDF")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[9px] font-bold gap-1 bg-white border-slate-300 hover:bg-slate-50 focus:ring-1 focus:ring-indigo-500 py-0 px-2"
            onClick={() => setExpandedView((current) => !current)}
          >
            {expandedView ? <Minimize2 className="h-3 w-3" /> : <Expand className="h-3 w-3" />}
            {expandedView ? tt("bgr.shrink", "Shrink") : tt("bgr.expand", "Expand")}
          </Button>
        </div>,
        actionsSlot
      )}

      {/* Fallback Header (Only shown while slot/portal is loading on initial render) */}
      {!actionsSlot && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs mb-4">
          <div className="min-w-[180px]">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              Super Admin
            </div>
            <h1 className="text-sm font-black tracking-tight text-slate-900 leading-none mt-0.5">
              {title}
            </h1>
            <div className="text-[9px] font-bold text-slate-500 mt-1">
              {subtitle || "Super Admin - Countries - Main Branches - City Branches"}
            </div>
          </div>
        </div>
      )}

      {error ? (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="p-4 text-xs text-rose-800 font-semibold">{error}</CardContent>
        </Card>
      ) : null}

      {expandedUserScope === "all-users" ? (
        <BranchUsersPanel
          title="All ERP Users"
          hierarchy={["Super Admin", "All Countries", "All Branches", "All Users"]}
          users={data?.summary?.users ?? []}
          onClose={() => setExpandedUserScope(null)}
        />
      ) : null}

      {expandedUserScope === "login-list" ? (
        <LoginListPanel users={data?.summary?.users ?? []} onClose={() => setExpandedUserScope(null)} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <ReportMetricCard
          title={tt("bgr.total_countries", "Total Countries")}
          value={visibleSummary.totalCountries}
          subtitle={tt("bgr.operating_network", "Operating country network")}
          icon={<Shield className="h-5 w-5" />}
          tone="indigo"
          tooltip={`${tt("bgr.operating_network", "Operating country network")} (${visibleSummary.totalCountries})`}
        />
        <ReportMetricCard
          title={tt("bgr.total_main_branches", "Total Main Branches")}
          value={visibleSummary.totalMainBranches}
          subtitle={`${tt("bgr.filter_country", "Country")}-level (${visibleSummary.totalMainBranches} of ${visibleSummary.totalMainBranches + visibleSummary.totalCityBranches} total)`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="emerald"
          tooltip={`${tt("bgr.total_main_branches", "Total Main Branches")}: ${visibleSummary.totalMainBranches}`}
        />
        <ReportMetricCard
          title={tt("bgr.total_city_branches", "Total City Branches")}
          value={visibleSummary.totalCityBranches}
          subtitle={`${tt("bgr.filter_city", "City")}-level (${visibleSummary.totalCityBranches} of ${visibleSummary.totalMainBranches + visibleSummary.totalCityBranches} total)`}
          icon={<Landmark className="h-5 w-5" />}
          tone="sky"
          tooltip={`${tt("bgr.total_city_branches", "Total City Branches")}: ${visibleSummary.totalCityBranches}`}
        />
        <ReportMetricCard
          title={tt("bgr.total_users", "Total Users")}
          value={visibleSummary.totalUsers}
          subtitle={tt("bgr.active_users_sub", "Active assigned ERP users")}
          icon={<Users className="h-5 w-5" />}
          tone="rose"
          tooltip={`${tt("bgr.total_users", "Total Users")}: ${visibleSummary.totalUsers}`}
        />
        <ReportMetricCard
          title={tt("bgr.total_main_accounts", "Total Main Accounts")}
          value={visibleSummary.totalMainAccounts}
          subtitle={tt("bgr.reg_accounts_sub", "Number of registered main accounts")}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="amber"
          tooltip={`${tt("bgr.total_main_accounts", "Total Main Accounts")}: ${visibleSummary.totalMainAccounts}`}
        />
        <ReportMetricCard
          title={tt("bgr.active_branches", "Active Branches")}
          value={visibleSummary.activeBranches}
          subtitle={`All ${visibleSummary.activeBranches} units active (${visibleSummary.totalMainBranches} Main + ${visibleSummary.totalCityBranches} City)`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="emerald"
          tooltip={`Active branches breakdown: ${visibleSummary.totalMainBranches} Main Branches + ${visibleSummary.totalCityBranches} City Branches = ${visibleSummary.activeBranches} Active of ${visibleSummary.totalMainBranches + visibleSummary.totalCityBranches} Total`}
        />
        <ReportMetricCard
          title={tt("bgr.inactive_branches", "Inactive Branches")}
          value={visibleSummary.inactiveBranches}
          subtitle={`${visibleSummary.inactiveBranches} suspended or closed units`}
          icon={<XCircle className="h-5 w-5" />}
          tone="slate"
          tooltip={tt("bgr.inactive_branches", "Inactive Branches")}
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)] ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
          <span className="rounded-full bg-indigo-600 px-3 py-1 text-white shadow-sm ring-1 ring-indigo-200">{tt("bgr.hierarchy_label", "Hierarchy")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">{tt("bgr.total_main_branches", "Main Branch")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 ring-1 ring-sky-100">{tt("bgr.city_branches_section", "City Branch")}</span>
          <span className="ml-auto rounded-full bg-slate-50 px-3 py-1 text-[10px] font-bold normal-case tracking-normal text-slate-500 ring-1 ring-slate-100">{tt("bgr.hint", "Use user count or Actions for details")}</span>
        </div>
      </div>
      {/* Main Report Table Container */}
      <div className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)] ring-1 ring-slate-100">
        
        {/* Table 1: Super Admin Row */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/50">
          <h3 className="text-xs font-black text-slate-950 mb-3 uppercase tracking-[0.16em] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            {tt("bgr.super_admin_branch", "Super Admin Branch")}
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left bg-white">
              <thead>
                <tr className="sticky top-0 z-10 bg-slate-950 text-white font-black text-[10px] tracking-[0.14em] text-center uppercase shadow-sm">
                  <Th className="p-2.5 border-r border-slate-200 text-left">Super Code</Th>
                  <Th className="p-2.5 border-r border-slate-200">Main Branch</Th>
                  <Th className="p-2.5 border-r border-slate-200">Company</Th>
                  <Th className="p-2.5 border-r border-slate-200">Owner</Th>
                  <Th className="p-2.5 border-r border-slate-700/70">Countries</Th>
                  <Th className="p-2.5 border-r border-slate-200">Curr</Th>
                  <Th className="p-2.5 border-r border-slate-200">Main Acc</Th>
                  <Th className="p-2.5 border-r border-slate-700/70">Code</Th>
                  <Th className="p-2.5 border-r border-slate-200">City</Th>
                  <Th className="p-2.5 border-r border-slate-200">User</Th>
                  <Th className="p-2.5 border-r border-slate-200">Contacts</Th>
                  <Th className="p-2.5">Action</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-slate-400">{tt("bgr.loading", "Loading hierarchy...")}</td>
                  </tr>
                ) : filteredSuperAdminBranches.length ? (
                  filteredSuperAdminBranches.map((branch) => {
                    const phoneContact = findContactValue(branch.contacts, "phone") || branch.phone;
                    const emailContact = findContactValue(branch.contacts, "email") || branch.email;

                    const scopeId = `super-admin-users-${branch.id}`;
                    const users = data?.summary?.users ?? [];

                    return (
                      <Fragment key={branch.id}>
                      <tr className="border-b border-slate-100 text-[10px] text-center text-slate-700 odd:bg-white even:bg-slate-50/60 hover:bg-indigo-50/70 transition-colors">
                        <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900 text-left">{branch.code}</td>
                        <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-800">{branch.name}</td>
                        <td className="p-2.5 border-r border-slate-200">{branch.companyName}</td>
                        <td className="p-2.5 border-r border-slate-200 font-medium">{branch.ownerName || "-"}</td>
                        <td className="p-2.5 border-r border-slate-200">{data?.summary?.totalCountries || 0} Country</td>
                        <td className="p-2.5 border-r border-slate-200 font-semibold">{branch.currency}</td>
                        <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-500">SA-1000</td>
                        <td className="p-2.5 border-r border-slate-200 tabular-nums">{data?.summary?.totalCountries || 0}</td>
                        <td className="p-2.5 border-r border-slate-200 tabular-nums">{data?.summary?.totalCityBranches || 0}</td>
                        <td className="p-2.5 border-r border-slate-200 tabular-nums">
                          <UserCountButton
                            count={users.length || data?.summary?.totalActiveUsers || 0}
                            expanded={expandedUserScope === scopeId}
                            onClick={() => toggleUserScope(scopeId)}
                            title="Show all ERP users under Super Admin"
                          />
                        </td>
                        <td className="p-2.5 border-r border-slate-200">
                          <div className="flex items-center justify-center gap-1.5">
                            {phoneContact ? (
                              <div className="relative popup-trigger">
                                <button
                                  onClick={() => setActiveContactPopup(activeContactPopup?.id === branch.id && activeContactPopup.type === "phone" ? null : { id: branch.id, type: "phone" })}
                                  className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                >
                                  <PhoneCall className="h-2.5 w-2.5" />
                                </button>
                                {activeContactPopup?.id === branch.id && activeContactPopup.type === "phone" && (
                                  <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                    {phoneContact}
                                  </div>
                                )}
                              </div>
                            ) : null}
                            {emailContact ? (
                              <div className="relative popup-trigger">
                                <button
                                  onClick={() => setActiveContactPopup(activeContactPopup?.id === branch.id && activeContactPopup.type === "email" ? null : { id: branch.id, type: "email" })}
                                  className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                >
                                  <Mail className="h-2.5 w-2.5" />
                                </button>
                                {activeContactPopup?.id === branch.id && activeContactPopup.type === "email" && (
                                  <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                    {emailContact}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <button
                            onClick={() => openSuperAdminBranchEdit(branch.id)}
                            className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all"
                          >
                            {tt("bgr.edit", "Edit")}
                          </button>
                        </td>
                      </tr>
                      {expandedUserScope === scopeId ? (
                        <tr className="border-b bg-indigo-50/20">
                          <td colSpan={12} className="p-3">
                            <BranchUsersPanel
                              title="Super Admin User Directory"
                              hierarchy={["Super Admin", "All Countries", "All Branches", "Users"]}
                              users={users}
                              onClose={() => setExpandedUserScope(null)}
                            />
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr className="border-b border-slate-100 text-[10px] text-center text-slate-700 odd:bg-white even:bg-slate-50/60 hover:bg-indigo-50/70 transition-colors">
                    <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900 text-left">SA-001</td>
                    <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-800">Super Admin</td>
                    <td className="p-2.5 border-r border-slate-200">Global Group</td>
                    <td className="p-2.5 border-r border-slate-200 font-medium">Mr. Admin</td>
                    <td className="p-2.5 border-r border-slate-200">4 Country</td>
                    <td className="p-2.5 border-r border-slate-200 font-semibold">USD</td>
                    <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-500">SA-1000</td>
                    <td className="p-2.5 border-r border-slate-200 tabular-nums">4</td>
                    <td className="p-2.5 border-r border-slate-200 tabular-nums">12</td>
                    <td className="p-2.5 border-r border-slate-200 tabular-nums">95+</td>
                    <td className="p-2.5 border-r border-slate-200">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="relative popup-trigger">
                          <button
                            onClick={() => setActiveContactPopup(activeContactPopup?.id === "static-sa" && activeContactPopup.type === "phone" ? null : { id: "static-sa", type: "phone" })}
                            className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                          >
                            <PhoneCall className="h-2.5 w-2.5" />
                          </button>
                          {activeContactPopup?.id === "static-sa" && activeContactPopup.type === "phone" && (
                            <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                              +971-50-1112222
                            </div>
                          )}
                        </div>
                        <div className="relative popup-trigger">
                          <button
                            onClick={() => setActiveContactPopup(activeContactPopup?.id === "static-sa" && activeContactPopup.type === "email" ? null : { id: "static-sa", type: "email" })}
                            className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                          >
                            <Mail className="h-2.5 w-2.5" />
                          </button>
                          {activeContactPopup?.id === "static-sa" && activeContactPopup.type === "email" && (
                            <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                              superadmin@globalgroup.com
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <button className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all">
                        Edit
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Country / Collapsible Reports */}
        <div className="p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-950 uppercase tracking-[0.16em]">{tt("bgr.country_report", "Country Report")}</h3>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{tt("bgr.country_report_desc", "Expandable country, main branch, city branch and user hierarchy")}</p>
            </div>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              {tt("bgr.export", "Export")}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left bg-white">
              <thead>
                <tr className="sticky top-0 z-10 bg-slate-950 text-white font-black text-[10px] tracking-[0.14em] text-center uppercase shadow-sm">
                  <Th className="p-2.5 border-r border-slate-700/70">Main Branch Code</Th>
                  <Th className="p-2.5 border-r border-slate-200 text-left">Country Name</Th>
                  <Th className="p-2.5 border-r border-slate-200">SA Code</Th>
                  <Th className="p-2.5 border-r border-slate-200">Branch Code</Th>
                  <Th className="p-2.5 border-r border-slate-200 text-left">Branch Name</Th>
                  <Th className="p-2.5 border-r border-slate-200">Company Name</Th>
                  <Th className="p-2.5 border-r border-slate-200">Owner Name</Th>
                  <Th className="p-2.5 border-r border-slate-200">Currency</Th>
                  <Th className="p-2.5 border-r border-slate-200">Main Branch Acc</Th>
                  <Th className="p-2.5 border-r border-slate-200">City Branches</Th>
                  <Th className="p-2.5 border-r border-slate-200">Users</Th>
                  <Th className="p-2.5 border-r border-slate-200">Email / WhatsApp</Th>
                  <Th className="p-2.5 border-r border-slate-200">Status</Th>
                  <Th className="p-2.5">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} className="p-6 text-center text-slate-400">{tt("bgr.loading_branches", "Loading branch lists...")}</td>
                  </tr>
                ) : filteredCountries.length ? (
                  filteredCountries.map((country) => {
                    // Find main branch details
                    const mainBranch = country.mainBranches[0] || null;
                    const phoneContact = mainBranch ? (findContactValue(mainBranch.contacts, "phone") || findContactValue(mainBranch.contacts, "mobile") || "") : "";
                    const emailContact = mainBranch ? (findContactValue(mainBranch.contacts, "email") || "") : "";
                    const isExpanded = expandedCountries[country.id] || false;
                    const countryUserScopeId = `country-users-${country.id}`;
                    const countryUsers = country.users ?? [];
                    const tags = getCountryTags(country.name);

                    return (
                      <Fragment key={country.id}>
                        
                        {/* Parent Row — 14 columns */}
                        <tr className="border-b border-slate-100 text-[10px] text-center text-slate-700 odd:bg-white even:bg-slate-50/60 hover:bg-indigo-50/70 transition-colors">
                          <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{mainBranch?.code || country.code}</td>
                          <td className="p-2 border-r border-slate-200 text-left">
                            <div className="relative popup-trigger inline-block">
                              <div
                                onClick={() => setActiveProductPopup(activeProductPopup === country.id ? null : country.id)}
                                className="inline-flex items-center gap-1 bg-indigo-50/60 border border-indigo-100/80 px-2 py-0.5 rounded-full font-bold text-indigo-700 cursor-pointer text-[9px] hover:bg-indigo-100 hover:text-indigo-800 transition-all"
                              >
                                {country.name} <ChevronRight className="h-2 w-2 rotate-90" />
                              </div>
                              {activeProductPopup === country.id && (
                                <div className="absolute top-6 left-0 z-50 bg-white border border-slate-200 rounded-lg p-2.5 shadow-xl popup-content min-w-[150px] text-left">
                                  <div className="text-[10px] font-bold text-slate-950 border-b pb-1 mb-1">Branch Services</div>
                                  <ul className="space-y-1 font-semibold text-[9px] text-slate-600">
                                    {tags.map((tag) => (
                                      <li key={tag} className="flex items-center gap-1">
                                        <span className="h-1 w-1 rounded-full bg-indigo-500"></span>
                                        {tag}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-500">SA-001</td>
                          <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{mainBranch?.code || "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-left font-semibold text-slate-800">
                            {mainBranch?.name || `${country.name} Main Branch`}
                          </td>
                          <td className="p-2 border-r border-slate-200 font-medium">{mainBranch?.companyName || "Global Group"}</td>
                          <td className="p-2 border-r border-slate-200">{mainBranch?.ownerName || "-"}</td>
                          <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{country.currency}</td>
                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-500">{mainBranch?.accountCode || "-"}</td>
                          <td className="p-2 border-r border-slate-200 tabular-nums font-semibold">{country.totalCityBranches}</td>
                          <td className="p-2 border-r border-slate-200 tabular-nums font-semibold">
                            <UserCountButton
                              count={countryUsers.length}
                              expanded={expandedUserScope === countryUserScopeId}
                              onClick={() => toggleUserScope(countryUserScopeId)}
                              title={`Show users for ${country.name}`}
                            />
                          </td>
                          <td className="p-2 border-r border-slate-200">
                            <div className="flex items-center justify-center gap-1.5">
                              {(mainBranch?.email || emailContact) ? (
                                <div className="relative popup-trigger">
                                  <button
                                    onClick={() => setActiveContactPopup(activeContactPopup?.id === country.id && activeContactPopup.type === "email" ? null : { id: country.id, type: "email" })}
                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                  >
                                    <Mail className="h-2.5 w-2.5" />
                                  </button>
                                  {activeContactPopup?.id === country.id && activeContactPopup.type === "email" && (
                                    <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                      {mainBranch?.email || emailContact}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[8px] text-slate-400">—</span>
                              )}
                              {phoneContact ? (
                                <div className="relative popup-trigger">
                                  <button
                                    onClick={() => setActiveContactPopup(activeContactPopup?.id === country.id && activeContactPopup.type === "phone" ? null : { id: country.id, type: "phone" })}
                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                  >
                                    <PhoneCall className="h-2.5 w-2.5" />
                                  </button>
                                  {activeContactPopup?.id === country.id && activeContactPopup.type === "phone" && (
                                    <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                      {phoneContact}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-2 border-r border-slate-200">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[8px] font-black",
                              (mainBranch?.status || "active").toLowerCase() === "active"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                            )}>
                              {(mainBranch?.status || "Active").charAt(0).toUpperCase() + (mainBranch?.status || "Active").slice(1)}
                            </span>
                          </td>
                          <td className="p-2 relative">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setBranchDetailModal({ country, branch: mainBranch || { id: country.id, name: `${country.name} Main Branch`, code: country.code, localCurrency: country.currency, status: country.status, isMain: true, cityBranches: [] } })}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700 shadow-xs hover:bg-emerald-100 hover:border-emerald-400 transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                title="View Country Main Branch & City Branches"
                              >
                                <Eye className="h-3 w-3" />
                                {tt("bgr.view", "View")}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => openActionDropdown(country.id, e.currentTarget)}
                                className="action-dropdown-trigger inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 shadow-xs hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              >
                                {tt("bgr.actions", "Actions")}
                                <ChevronRight className={cn("h-2.5 w-2.5 transition-transform duration-150", activeActionDropdownId === country.id ? "rotate-90" : "")} />
                              </button>
                            </div>
                            {/* Portal dropdown - rendered at body level to escape table overflow:hidden */}
                            {activeActionDropdownId === country.id && activeActionAnchorRect && createPortal(
                              <ActionDropdownMenu
                                anchorRect={activeActionAnchorRect}
                                onClose={() => { setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                              >
                                <ActionItem
                                  icon={<ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded ? "rotate-90" : "")} />}
                                  label={isExpanded ? tt("bgr.hide_city", "Hide City Branches") : tt("bgr.show_city", "Show City Branches")}
                                  onClick={() => { toggleCountryRow(country.id); setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                                />
                                <ActionItem
                                  icon={<UserPlus className="h-3.5 w-3.5" />}
                                  label={tt("bgr.create_user", "Create User for Country")}
                                  color="indigo"
                                  onClick={() => {
                                    window.location.href = `/dashboard/users/new?countryId=${encodeURIComponent(country.id)}`;
                                    setActiveActionDropdownId(null);
                                    setActiveActionAnchorRect(null);
                                  }}
                                />
                                {mainBranch ? (
                                  <>
                                    <ActionItem
                                      icon={<Eye className="h-3.5 w-3.5" />}
                                      label={viewLoadingId === mainBranch.id ? "..." : tt("bgr.view_main", "View Main Branch")}
                                      color="emerald"
                                      onClick={() => { viewCountryBranch(mainBranch.id, country.name); setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                                      disabled={viewLoadingId !== null}
                                    />
                                    <ActionItem
                                      icon={<PencilLine className="h-3.5 w-3.5" />}
                                      label={tt("bgr.edit_main", "Edit Main Branch")}
                                      color="indigo"
                                      onClick={() => { openCountryBranchEdit(mainBranch.id); setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                                    />
                                    <ActionItem
                                      icon={<Info className="h-3.5 w-3.5" />}
                                      label={tt("bgr.branch_details", "Branch Details")}
                                      color="indigo"
                                      onClick={() => { setBranchDetailModal({ country, branch: mainBranch }); setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                                    />
                                  </>
                                ) : (
                                  <ActionItem
                                    icon={<PencilLine className="h-3.5 w-3.5" />}
                                    label={tt("bgr.edit", "Edit")}
                                    color="indigo"
                                    onClick={() => { setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                                  />
                                )}
                              </ActionDropdownMenu>,
                              document.body
                            )}
                          </td>
                        </tr>

                        {expandedUserScope === countryUserScopeId ? (
                          <tr className="bg-indigo-50/20">
                            <td colSpan={14} className="p-3">
                              <BranchUsersPanel
                                title={`${country.name} Users`}
                                hierarchy={[country.name, mainBranch?.name || "Main Branch", "All City Branches", "User List"]}
                                users={countryUsers}
                                onClose={() => setExpandedUserScope(null)}
                              />
                            </td>
                          </tr>
                        ) : null}

                        {/* Collapsible Child Sub-Table */}
                        {isExpanded && (
                          <tr className="bg-gradient-to-r from-indigo-50/40 to-slate-50">
                            <td colSpan={13} className="p-3">
                              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm ring-1 ring-slate-100">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100 border-b text-slate-600 font-black text-[9px] text-center tracking-[0.14em] uppercase">
                                      <Th className="p-2 border-r border-slate-200 text-left">Country</Th>
                                      <Th className="p-2 border-r border-slate-200 text-left">Main Branch</Th>
                                      <Th className="p-2 border-r border-slate-200 text-left">City Branch</Th>
                                      <Th className="p-2 border-r border-slate-200 text-left">Branch Code</Th>
                                      <Th className="p-2 border-r border-slate-200">Currency</Th>
                                      <Th className="p-2 border-r border-slate-200 text-left">Country User</Th>
                                      <Th className="p-2 border-r border-slate-200 text-left">Branch User</Th>
                                      <Th className="p-2">Contact / Action</Th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {mainBranch && mainBranch.cityBranches.length ? (
                                      mainBranch.cityBranches.map((cityBranch) => {
                                        const cityUserScopeId = `city-users-${cityBranch.id}`;
                                        const cityUsers = cityBranch.users ?? [];
                                        const countryAdminUser = country.users?.find((u) => u.role === "country_admin");
                                        const branchAdminUser = cityBranch.users?.find((u) => u.role === "city_branch_admin") || cityBranch.users?.[0];
                                        const phoneContact = findContactValue(cityBranch.contacts, "phone") || findContactValue(cityBranch.contacts, "mobile") || cityBranch.phone || branchAdminUser?.mobile || "";
                                        const emailContact = findContactValue(cityBranch.contacts, "email") || cityBranch.email || branchAdminUser?.email || "";

                                        return (
                                          <Fragment key={cityBranch.id}>
                                            <tr className="border-b border-slate-100 text-[9px] text-slate-700 odd:bg-white even:bg-slate-50/50 hover:bg-sky-50/70">
                                              <td className="p-2 border-r border-slate-200 text-left font-semibold">{country.name}</td>
                                              <td className="p-2 border-r border-slate-200 text-left font-semibold text-slate-500">{mainBranch.name}</td>
                                              <td className="p-2 border-r border-slate-200 text-left font-bold text-slate-800">{cityBranch.cityName} ({cityBranch.name})</td>
                                              <td className="p-2 border-r border-slate-200 text-left font-mono font-bold text-slate-900">{cityBranch.code}</td>
                                              <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-600">{cityBranch.localCurrency}</td>
                                              <td className="p-2 border-r border-slate-200 text-left">
                                                {countryAdminUser ? (
                                                  <div>
                                                    <div className="font-bold text-slate-800">{countryAdminUser.name}</div>
                                                    <div className="text-[7.5px] text-slate-400 font-medium font-mono">{countryAdminUser.email}</div>
                                                  </div>
                                                ) : (
                                                  <span className="text-slate-400 font-medium">-</span>
                                                )}
                                              </td>
                                              <td className="p-2 border-r border-slate-200 text-left">
                                                {branchAdminUser ? (
                                                  <div>
                                                    <div className="font-bold text-slate-800">{branchAdminUser.name}</div>
                                                    <div className="text-[7.5px] text-slate-400 font-medium font-mono">{branchAdminUser.email}</div>
                                                  </div>
                                                ) : (
                                                  <span className="text-slate-400 font-medium">-</span>
                                                )}
                                              </td>
                                              <td className="p-2">
                                                <div className="flex items-center justify-center gap-2">
                                                  {phoneContact ? (
                                                    <div className="relative popup-trigger">
                                                      <button
                                                        onClick={() => setActiveContactPopup(activeContactPopup?.id === cityBranch.id && activeContactPopup.type === "phone" ? null : { id: cityBranch.id, type: "phone" })}
                                                        className="w-4.5 h-4.5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                                      >
                                                        <PhoneCall className="h-2 w-2" />
                                                      </button>
                                                      {activeContactPopup?.id === cityBranch.id && activeContactPopup.type === "phone" && (
                                                        <div className="absolute top-5 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[8px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                                          {phoneContact}
                                                        </div>
                                                      )}
                                                    </div>
                                                  ) : null}
                                                  {emailContact ? (
                                                    <div className="relative popup-trigger">
                                                      <button
                                                        onClick={() => setActiveContactPopup(activeContactPopup?.id === cityBranch.id && activeContactPopup.type === "email" ? null : { id: cityBranch.id, type: "email" })}
                                                        className="w-4.5 h-4.5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                                      >
                                                        <Mail className="h-2 w-2" />
                                                      </button>
                                                      {activeContactPopup?.id === cityBranch.id && activeContactPopup.type === "email" && (
                                                        <div className="absolute top-5 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[8px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                                          {emailContact}
                                                        </div>
                                                      )}
                                                    </div>
                                                  ) : null}
                                                  <button
                                                    onClick={() => viewCityBranch(cityBranch.id, country.name, cityBranch.cityName)}
                                                    disabled={viewLoadingId !== null}
                                                    className="rounded border border-emerald-200 bg-white px-2 py-0.5 text-[8px] font-bold text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 shadow-sm transition-all"
                                                  >
                                                    {viewLoadingId === cityBranch.id ? "..." : tt("bgr.view", "View")}
                                                  </button>
                                                  <button
                                                    onClick={() => openCityBranchEdit(cityBranch.id)}
                                                    className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[8px] font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all"
                                                  >
                                                    {tt("bgr.edit", "Edit")}
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      window.location.href = `/dashboard/users/new?cityBranchId=${encodeURIComponent(cityBranch.id)}&countryId=${encodeURIComponent(country.id)}`;
                                                    }}
                                                    className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[8px] font-bold text-indigo-700 hover:bg-indigo-100 shadow-sm transition-all inline-flex items-center gap-0.5"
                                                    title={`Create new user for ${cityBranch.name}`}
                                                  >
                                                    <UserPlus className="h-2.5 w-2.5" />
                                                    {tt("bgr.create_user", "Create User")}
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                            {expandedUserScope === cityUserScopeId ? (
                                              <tr className="bg-indigo-50/20">
                                                <td colSpan={8} className="p-3">
                                                  <BranchUsersPanel
                                                    title={`${cityBranch.name} Users`}
                                                    hierarchy={[country.name, mainBranch.name, cityBranch.name, "User List"]}
                                                    users={cityUsers}
                                                    onClose={() => setExpandedUserScope(null)}
                                                  />
                                                </td>
                                              </tr>
                                            ) : null}
                                          </Fragment>
                                        );
                                      })
                                    ) : (
                                      <tr>
                                        <td colSpan={8} className="p-3 text-center text-slate-400">
                                          {tt("bgr.no_city_in_branch", "No city branches configured under this main branch.")}
                                        </td>
                                      </tr>
                                    )}
                                    
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={14} className="p-6 text-center text-slate-400">{tt("bgr.no_country_match", "No country records matched search query.")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══ BRANCH DETAILS MODAL ═══ */}
      {branchDetailModal && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-start justify-end">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setBranchDetailModal(null)} />
          <div className="relative z-10 h-full w-full max-w-4xl overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="sticky top-0 z-20 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-6 py-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.24em] text-indigo-300">{tt("bgr.branch_details_report", "Branch Details Report")}</div>
                  <h2 className="mt-1 text-lg font-black text-white tracking-tight">{branchDetailModal.branch.name}</h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{branchDetailModal.country.name} &bull; {branchDetailModal.branch.code}</p>
                </div>
                <button onClick={() => setBranchDetailModal(null)} className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Main Branch Summary */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm ring-1 ring-slate-100">
                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> {tt("bgr.main_branch_info", "Main Branch Information")}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: tt("ulrp.branch_name", "Branch Name"), value: branchDetailModal.branch.name },
                    { label: tt("ulrp.branch_code", "Branch Code"), value: branchDetailModal.branch.code },
                    { label: tt("ulrp.country", "Country"), value: branchDetailModal.country.name },
                    { label: tt("ulrp.currency", "Currency"), value: branchDetailModal.country.currency || branchDetailModal.branch.localCurrency },
                    { label: tt("bgr.lbl_owner", "Owner Name"), value: branchDetailModal.branch.ownerName || "-" },
                    { label: tt("bgr.lbl_company", "Company Name"), value: branchDetailModal.branch.companyName || "Global Group" },
                    { label: tt("bgr.lbl_accode", "Account Code"), value: branchDetailModal.branch.accountCode || "-" },
                    { label: tt("bgr.lbl_status", "Status"), value: branchDetailModal.branch.status || "Active" },
                    { label: tt("ulrp.address", "Address"), value: branchDetailModal.branch.address || "-" },
                    { label: tt("ulrp.email", "Email"), value: branchDetailModal.branch.email || findContactValue(branchDetailModal.branch.contacts, "email") || "-" },
                    { label: tt("bgr.lbl_phone", "Phone"), value: findContactValue(branchDetailModal.branch.contacts, "phone") || findContactValue(branchDetailModal.branch.contacts, "mobile") || "-" },
                    { label: tt("bgr.lbl_whatsapp", "WhatsApp"), value: findContactValue(branchDetailModal.branch.contacts, "whatsapp") || "-" },
                    { label: tt("bgr.total_city_branches", "Total City Branches"), value: String(branchDetailModal.branch.cityBranches?.length ?? 0) },
                    { label: tt("bgr.total_users", "Total Users"), value: String(branchDetailModal.branch.users?.length ?? branchDetailModal.branch.userCount ?? 0) },
                    { label: tt("bgr.lbl_created", "Created"), value: branchDetailModal.branch.createdAt ? new Date(branchDetailModal.branch.createdAt).toLocaleDateString() : "-" },
                  ].map(({ label, value }, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</div>
                      <div className="mt-1 text-[11px] font-bold text-slate-900 break-all">
                        {label === "Status" ? (
                          <span className={cn("rounded-full px-2.5 py-0.5 text-[9px] font-black",
                            (value || "active").toLowerCase() === "active"
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                              : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                          )}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>
                        ) : value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* City Branches Table */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 mb-4 flex items-center gap-2">
                  <Landmark className="h-4 w-4" /> {tt("bgr.city_branches_section", "City Branches")} ({branchDetailModal.branch.cityBranches?.length ?? 0})
                </h3>
                {branchDetailModal.branch.cityBranches?.length ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left bg-white">
                      <thead>
                        <tr className="sticky top-0 z-10 bg-slate-900 text-white font-black text-[9px] tracking-[0.14em] text-center uppercase shadow-sm">
                          <Th className="p-2.5 border-r border-slate-700/70">SR.</Th>
                          <Th className="p-2.5 border-r border-slate-200">City Branch Code</Th>
                          <Th className="p-2.5 border-r border-slate-200 text-left">City Branch Name</Th>
                          <Th className="p-2.5 border-r border-slate-200">Manager</Th>
                          <Th className="p-2.5 border-r border-slate-200">Users</Th>
                          <Th className="p-2.5 border-r border-slate-200">Accounts</Th>
                          <Th className="p-2.5 border-r border-slate-200">Status</Th>
                          <Th className="p-2.5">Contact Information</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchDetailModal.branch.cityBranches.map((cityBranch, idx) => {
                          const cbPhone = findContactValue(cityBranch.contacts, "phone") || findContactValue(cityBranch.contacts, "mobile") || cityBranch.phone || "";
                          const cbEmail = findContactValue(cityBranch.contacts, "email") || cityBranch.email || "";
                          const cbWhatsApp = findContactValue(cityBranch.contacts, "whatsapp") || "";
                          const managerUser = cityBranch.users?.find(u => u.role === "city_branch_admin") || cityBranch.users?.[0];
                          return (
                            <tr key={cityBranch.id} className="border-b border-slate-100 text-[10px] text-center text-slate-700 odd:bg-white even:bg-slate-50/60 hover:bg-sky-50/70 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 font-bold">{idx + 1}</td>
                              <td className="p-2.5 border-r border-slate-200 font-mono font-bold text-slate-900">{cityBranch.code}</td>
                              <td className="p-2.5 border-r border-slate-200 text-left">
                                <div className="font-bold text-slate-900">{cityBranch.name}</div>
                                <div className="text-[8px] text-slate-500 font-medium">{cityBranch.cityName}</div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-bold text-slate-800">{cityBranch.managerName || managerUser?.name || "-"}</div>
                                {managerUser?.email && <div className="text-[7.5px] text-slate-400 font-mono mt-0.5">{managerUser.email}</div>}
                              </td>
                              <td className="p-2.5 border-r border-slate-200 tabular-nums font-bold">{cityBranch.users?.length ?? cityBranch.userCount ?? 0}</td>
                              <td className="p-2.5 border-r border-slate-200 tabular-nums font-bold">{cityBranch.accountsCount ?? 0}</td>
                              <td className="p-2.5 border-r border-slate-200">
                                <span className={cn("rounded-full px-2 py-0.5 text-[8px] font-black",
                                  (cityBranch.status || "active").toLowerCase() === "active"
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                    : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                                )}>{(cityBranch.status || "Active").charAt(0).toUpperCase() + (cityBranch.status || "Active").slice(1)}</span>
                              </td>
                              <td className="p-2.5">
                                <div className="flex flex-col items-center gap-1 text-[8px]">
                                  {cbEmail && <div className="flex items-center gap-1 text-indigo-700"><Mail className="h-2.5 w-2.5" /><span className="font-semibold">{cbEmail}</span></div>}
                                  {cbPhone && <div className="flex items-center gap-1 text-emerald-700"><PhoneCall className="h-2.5 w-2.5" /><span className="font-semibold">{cbPhone}</span></div>}
                                  {cbWhatsApp && <div className="flex items-center gap-1 text-green-700"><PhoneCall className="h-2.5 w-2.5" /><span className="font-semibold">WA: {cbWhatsApp}</span></div>}
                                  {!cbEmail && !cbPhone && !cbWhatsApp && <span className="text-slate-400">&mdash;</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <Landmark className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-slate-400">{tt("bgr.no_city_in_branch", "No city branches configured under this main branch.")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
