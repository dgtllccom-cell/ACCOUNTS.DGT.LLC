"use client";

import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { 
  Ban,
  ChevronRight, 
  Eye,
  Expand,
  Download,
  FileSpreadsheet, 
  KeyRound,
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
  Users,
  X
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  ownerName?: string | null;
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
            <div className="text-[9px] font-black uppercase text-slate-400">Total Users</div>
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
                  <th className="border-r p-2">SR.</th>
                  <th className="border-r p-2">Country</th>
                  <th className="border-r p-2">City</th>
                  <th className="border-r p-2">Branch</th>
                  <th className="border-r p-2 text-left">User Name</th>
                  <th className="border-r p-2">Login ID</th>
                  <th className="border-r p-2">Temp Password</th>
                  <th className="border-r p-2">Email</th>
                  <th className="border-r p-2">Role</th>
                  <th className="border-r p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user.id} className="border-b text-center text-slate-700 hover:bg-indigo-50/30">
                    <td className="border-r p-2 font-bold">{index + 1}</td>
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
                            <PencilLine className="h-3 w-3" /> Edit
                          </button>
                          <button onClick={() => alert(`Block User: ${user.username}`)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700">
                            <Ban className="h-3 w-3" /> Block
                          </button>
                          <button onClick={() => openUserProfile(user.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700">
                            <Eye className="h-3 w-3" /> Open
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
          No users are assigned to this hierarchy level yet.
        </div>
      )}
    </div>
  );
}

function LoginListPanel({ users, onClose }: { users: BranchUserDetail[]; onClose?: () => void }) {
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
            Login Access List
          </div>
          <div className="mt-1 text-[10px] font-bold text-slate-500">
            Country, main branch, city branch and user login details for Super Admin review.
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
            Open Login Page
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
                <th className="border-r p-2 text-left">Country Login</th>
                <th className="border-r p-2 text-left">Main Branch Login</th>
                <th className="border-r p-2 text-left">City Branch Login</th>
                <th className="border-r p-2">Username</th>
                <th className="border-r p-2">Password</th>
                <th className="border-r p-2">Role</th>
                <th className="border-r p-2">User Name</th>
                <th className="border-r p-2">Email</th>
                <th className="border-r p-2">Status</th>
                <th className="p-2">Action</th>
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
                      Login
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-[10px] font-bold text-slate-400">
          No login users found.
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
            Actions
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
  tone = "indigo"
}: {
  title: string;
  value: ReactNode;
  subtitle: string;
  icon: ReactNode;
  tone?: "indigo" | "emerald" | "sky" | "amber" | "rose" | "slate";
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
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] ring-1 ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_24px_46px_-30px_rgba(79,70,229,0.45)]">
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
      openA4ReportWindow({
        title: "Country Main Branch Report",
        subtitle: "Branch Profile Report (A4)",
        autoPrint: false,
        lang: activeLang,
        branchData: {
          serialNumber: row.id.slice(0, 4).toUpperCase(),
          branchStatus: row.status || "Active",
          branchCode: row.code || "-",
          branchType: "MAIN",
          country: countryName,
          currency: row.local_currency || "USD",
          
          branchName: row.name || `${countryName} Main Branch`,
          createdDate: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined,
          updatedDate: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : undefined,
          createdBy: "Super Admin",
          updatedBy: "Super Admin",
          establishedOn: "-",
          taxRegNo: "-",
          ntnGstNo: "-",

          city: "-",
          cityCode: "-",
          stateProvince: "-",
          areaRegion: "-",
          zipCode: "-",
          fullAddress: row.address || "-",

          ownerName: row.owner_name || "-",
          ownerCode: "OWN-0001",
          fatherHusbandName: "-",
          cnicId: "-",
          nationality: "Pakistani",
          designation: "Country Admin",
          ownershipType: "Individual",
          ownershipPercent: "100%",
          ownerPhone: phoneVal || "-",
          ownerWhatsApp: whatsappVal || "-",
          ownerEmail: emailVal || "-",
          ownerAltEmail: "-",
          ownerLandline: "-",
          ownerWebsite: "-",

          companyName: "Asmat & Brothers (Pvt) Ltd.",
          companyCode: "COMP-001",
          companyType: "Private Limited",
          companyRegNo: "-",
          companyIncDate: "-",
          companyTaxRegNo: "-",
          companyNtnGstNo: "-",
          companyStatus: "Active",
          companyPhone: phoneVal || "-",
          companyEmail: emailVal || "-",
          companyWebsite: "-",
          companyOfficeAddress: row.address || "-",

          allowedPermissions: row.permission_grants || [],
          remarks: "Country Main Branch details profile."
        }
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
      openA4ReportWindow({
        title: "City Branch Report",
        subtitle: "Branch Profile Report (A4)",
        autoPrint: false,
        lang: activeLang,
        branchData: {
          serialNumber: row.id.slice(0, 4).toUpperCase(),
          branchStatus: row.status || "Active",
          branchCode: row.code || "-",
          branchType: "CITY",
          country: countryName,
          currency: row.local_currency || "USD",
          
          branchName: row.name || `${cityName} City Branch`,
          createdDate: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined,
          updatedDate: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : undefined,
          createdBy: "Super Admin",
          updatedBy: "Super Admin",
          establishedOn: "-",
          taxRegNo: "-",
          ntnGstNo: "-",

          city: cityName,
          cityCode: row.code?.split("-")?.[1] || "-",
          stateProvince: "-",
          areaRegion: "-",
          zipCode: "-",
          fullAddress: row.address || "-",

          ownerName: row.owner_name || "-",
          ownerCode: "OWN-0001",
          fatherHusbandName: "-",
          cnicId: "-",
          nationality: "Pakistani",
          designation: "Branch Manager",
          ownershipType: "Individual",
          ownershipPercent: "100%",
          ownerPhone: phoneVal || "-",
          ownerWhatsApp: whatsappVal || "-",
          ownerEmail: emailVal || "-",
          ownerAltEmail: "-",
          ownerLandline: "-",
          ownerWebsite: "-",

          companyName: "Asmat & Brothers (Pvt) Ltd.",
          companyCode: "COMP-001",
          companyType: "Private Limited",
          companyRegNo: "-",
          companyIncDate: "-",
          companyTaxRegNo: "-",
          companyNtnGstNo: "-",
          companyStatus: "Active",
          companyPhone: phoneVal || "-",
          companyEmail: emailVal || "-",
          companyWebsite: "-",
          companyOfficeAddress: row.address || "-",

          allowedPermissions: row.permission_grants || [],
          remarks: "City Branch details profile."
        }
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
        (b.companyName || "").toLowerCase().includes(q) ||
        (b.ownerName || "").toLowerCase().includes(q)
      );
    });
  }, [data?.superAdminBranches, searchQuery, searchType]);

  const filteredCountries = useMemo(() => {
    if (!data?.countries) return [];
    const q = searchQuery.toLowerCase().trim();

    return data.countries
      .map((country) => {
        const countryMatches = q ? matchesText(`${country.name} ${country.code} ${country.currency} ${country.status}`, q) : true;

        const mainBranches = country.mainBranches
          .map((branch) => {
            const branchMatches = q ? matchesText(`${branch.name} ${branch.code} ${branch.localCurrency} ${branch.status}`, q) : true;

            const cityBranches = branch.cityBranches.filter((city) => {
              if (searchType === "branch") return false;
              if (!q) return true;
              return matchesText(`${city.cityName} ${city.name} ${city.code} ${city.localCurrency} ${city.status}`, q);
            });

            if (searchType === "city" && !cityBranches.length) return null;
            if (searchType === "branch" && !branchMatches) return null;

            if (q && !countryMatches && !branchMatches && !cityBranches.length) return null;

            return {
              ...branch,
              cityBranches: countryMatches || branchMatches ? branch.cityBranches : cityBranches
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
  }, [data?.countries, searchQuery, searchType]);

  const visibleSummary = useMemo(() => {
    const totalCountries = filteredCountries.length;
    const totalMainBranches = filteredCountries.reduce((sum, country) => sum + country.mainBranches.length, 0);
    const totalCityBranches = filteredCountries.reduce(
      (sum, country) => sum + country.mainBranches.reduce((branchSum, branch) => branchSum + branch.cityBranches.length, 0),
      0
    );
    const activeBranches = filteredCountries.reduce(
      (sum, country) =>
        sum +
        country.mainBranches.filter((branch) => branch.status?.toLowerCase() === "active").length +
        country.mainBranches.reduce(
          (branchSum, branch) => branchSum + branch.cityBranches.filter((city) => city.status?.toLowerCase() === "active").length,
          0
        ),
      0
    );
    const totalUsers = filteredCountries.reduce(
      (sum, country) =>
        sum +
        (country.users?.length ?? 0) +
        country.mainBranches.reduce(
          (branchSum, branch) =>
            branchSum +
            (branch.users?.length ?? 0) +
            branch.cityBranches.reduce((citySum, city) => citySum + (city.users?.length ?? 0), 0),
          0
        ),
      0
    );
    const currencies = new Set<string>();
    filteredCountries.forEach((country) => {
      if (country.currency) currencies.add(country.currency);
      country.mainBranches.forEach((branch) => {
        if (branch.localCurrency) currencies.add(branch.localCurrency);
        branch.cityBranches.forEach((city) => {
          if (city.localCurrency) currencies.add(city.localCurrency);
        });
      });
    });

    return {
      totalCountries,
      totalMainBranches,
      totalCityBranches,
      activeBranches,
      totalUsers: totalUsers || data?.summary?.totalActiveUsers || 0,
      totalCurrencies: currencies.size
    };
  }, [data?.summary?.totalActiveUsers, filteredCountries]);

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
    <div className={containerClassName}>
      
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
            <option value="">Category</option>
            <option value="branch">Branch</option>
            <option value="country">Country</option>
            <option value="city">City</option>
          </select>

          {/* Search Bar */}
          <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-2 h-7 shadow-sm w-36">
            <Search className="h-3 w-3 text-slate-400 mr-1.5 flex-shrink-0" />
            <input
              type="text"
              id="branchSearch"
              placeholder="Search..."
              className="w-full bg-transparent border-none outline-none text-[9px] font-semibold placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="border-l border-slate-200 h-5 mx-0.5"></div>

          {/* Interactive Metric Filter Buttons */}
          <button
            type="button"
            className={cn(
              "h-7 px-2 rounded-lg border text-[9px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              searchType === "country"
                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            )}
            onClick={() => setSearchType(searchType === "country" ? "" : "country")}
          >
            <span>Countries</span>
            <span className={cn(
              "px-1 py-0.2 rounded font-mono text-[8px] font-extrabold leading-none",
              searchType === "country" ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {visibleSummary.totalCountries}
            </span>
          </button>

          <button
            type="button"
            className={cn(
              "h-7 px-2 rounded-lg border text-[9px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              searchType === "branch"
                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            )}
            onClick={() => setSearchType(searchType === "branch" ? "" : "branch")}
          >
            <span>Branches</span>
            <span className={cn(
              "px-1 py-0.2 rounded font-mono text-[8px] font-extrabold leading-none",
              searchType === "branch" ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {visibleSummary.totalMainBranches + visibleSummary.totalCityBranches}
            </span>
          </button>

          <button
            type="button"
            className={cn(
              "h-7 px-2 rounded-lg border text-[9px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              expandedUserScope === "all-users"
                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            )}
            onClick={() => toggleUserScope("all-users")}
          >
            <span>Users</span>
            <span className={cn(
              "px-1 py-0.2 rounded font-mono text-[8px] font-extrabold leading-none",
              expandedUserScope === "all-users" ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {data?.summary?.totalActiveUsers ?? "95+"}
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
            <span>Login</span>
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
            <span>Reports</span>
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
              <span>+ New Setup</span>
              <ChevronRight className={cn("h-2.5 w-2.5 transition-transform duration-200", newMenuOpen ? "rotate-90" : "")} />
            </Button>
            
            {newMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)}></div>
                <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in slide-in-from-top-1 duration-150 font-sans">
                  <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                    Select Hierarchy Level
                  </div>
                  <button
                    onClick={() => {
                      setNewMenuOpen(false);
                      window.location.href = "/dashboard/new-entry/branches/super-admin";
                    }}
                    className="flex w-full items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    1. Create Country (Super Admin)
                  </button>
                  <button
                    onClick={() => {
                      setNewMenuOpen(false);
                      window.location.href = "/dashboard/new-entry/branch-entry/country-branch";
                    }}
                    className="flex w-full items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    2. Create Main Branch (Country)
                  </button>
                  <button
                    onClick={() => {
                      setNewMenuOpen(false);
                      window.location.href = "/dashboard/new-entry/branch-entry/city-branch";
                    }}
                    className="flex w-full items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    3. Create City Branch (City)
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
            Print
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
            PDF
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[9px] font-bold gap-1 bg-white border-slate-300 hover:bg-slate-50 focus:ring-1 focus:ring-indigo-500 py-0 px-2"
            onClick={() => setExpandedView((current) => !current)}
          >
            {expandedView ? <Minimize2 className="h-3 w-3" /> : <Expand className="h-3 w-3" />}
            {expandedView ? "Shrink" : "Expand"}
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <ReportMetricCard
          title="Countries"
          value={visibleSummary.totalCountries}
          subtitle="Filtered country network"
          icon={<Shield className="h-5 w-5" />}
          tone="indigo"
        />
        <ReportMetricCard
          title="Main Branches"
          value={visibleSummary.totalMainBranches}
          subtitle="Country-level operating branches"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="emerald"
        />
        <ReportMetricCard
          title="City Branches"
          value={visibleSummary.totalCityBranches}
          subtitle="Local branch hierarchy"
          icon={<ChevronRight className="h-5 w-5" />}
          tone="sky"
        />
        <ReportMetricCard
          title="Active Branches"
          value={visibleSummary.activeBranches}
          subtitle="Currently active operating units"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="amber"
        />
        <ReportMetricCard
          title="Users"
          value={visibleSummary.totalUsers}
          subtitle="Assigned ERP users"
          icon={<Users className="h-5 w-5" />}
          tone="rose"
        />
        <ReportMetricCard
          title="Currencies"
          value={visibleSummary.totalCurrencies}
          subtitle="Branch reporting currencies"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          tone="slate"
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)] ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
          <span className="rounded-full bg-indigo-600 px-3 py-1 text-white shadow-sm ring-1 ring-indigo-200">Hierarchy</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">Main Branch</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 ring-1 ring-sky-100">City Branch</span>
          <span className="ml-auto rounded-full bg-slate-50 px-3 py-1 text-[10px] font-bold normal-case tracking-normal text-slate-500 ring-1 ring-slate-100">Use user count or Actions for details</span>
        </div>
      </div>
      {/* Main Report Table Container */}
      <div className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)] ring-1 ring-slate-100">
        
        {/* Table 1: Super Admin Row */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/50">
          <h3 className="text-xs font-black text-slate-950 mb-3 uppercase tracking-[0.16em] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Super Admin Branch
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left bg-white">
              <thead>
                <tr className="sticky top-0 z-10 bg-slate-950 text-white font-black text-[10px] tracking-[0.14em] text-center uppercase shadow-sm">
                  <th className="p-2.5 border-r border-slate-200 text-left">Super Code</th>
                  <th className="p-2.5 border-r border-slate-200">Main Branch</th>
                  <th className="p-2.5 border-r border-slate-200">Company</th>
                  <th className="p-2.5 border-r border-slate-200">Owner</th>
                  <th className="p-2.5 border-r border-slate-700/70">Countries</th>
                  <th className="p-2.5 border-r border-slate-200">Curr</th>
                  <th className="p-2.5 border-r border-slate-200">Main Acc</th>
                  <th className="p-2.5 border-r border-slate-700/70">Code</th>
                  <th className="p-2.5 border-r border-slate-200">City</th>
                  <th className="p-2.5 border-r border-slate-200">User</th>
                  <th className="p-2.5 border-r border-slate-200">Contacts</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-slate-400">Loading hierarchy...</td>
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
                            Edit
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
              <h3 className="text-xs font-black text-slate-950 uppercase tracking-[0.16em]">Country Report</h3>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Expandable country, main branch, city branch and user hierarchy</p>
            </div>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left bg-white">
              <thead>
                <tr className="sticky top-0 z-10 bg-slate-950 text-white font-black text-[10px] tracking-[0.14em] text-center uppercase shadow-sm">
                  <th className="p-2.5 border-r border-slate-700/70">Code</th>
                  <th className="p-2.5 border-r border-slate-200 text-left">Country</th>
                  <th className="p-2.5 border-r border-slate-200">SA Code</th>
                  <th className="p-2.5 border-r border-slate-200">Branch Code</th>
                  <th className="p-2.5 border-r border-slate-200 text-left">Branch Name</th>
                  <th className="p-2.5 border-r border-slate-200">Company</th>
                  <th className="p-2.5 border-r border-slate-200">Owner</th>
                  <th className="p-2.5 border-r border-slate-200">Curr</th>
                  <th className="p-2.5 border-r border-slate-200">Acc</th>
                  <th className="p-2.5 border-r border-slate-200">City</th>
                  <th className="p-2.5 border-r border-slate-200">User</th>
                  <th className="p-2.5 border-r border-slate-200">Contacts</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} className="p-6 text-center text-slate-400">Loading branch lists...</td>
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
                        
                        {/* Parent Row */}
                        <tr className="border-b border-slate-100 text-[10px] text-center text-slate-700 odd:bg-white even:bg-slate-50/60 hover:bg-indigo-50/70 transition-colors">
                          <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{country.code}</td>
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
                          <td className="p-2 border-r border-slate-200 font-medium">
                            {mainBranch ? (mainBranch.companyId ? "ABC Pvt Ltd" : "ABC Pvt Ltd") : "-"}
                          </td>
                          <td className="p-2 border-r border-slate-200">{mainBranch?.ownerName || "Mr. Ahmed"}</td>
                          <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{country.currency}</td>
                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-500">ACC-2001</td>
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
                              {mainBranch && typeof phoneContact === "string" && phoneContact ? (
                                <div className="relative popup-trigger">
                                  <button
                                    onClick={() => setActiveContactPopup(activeContactPopup?.id === country.id && activeContactPopup.type === "phone" ? null : { id: country.id, type: "phone" })}
                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                  >
                                    <PhoneCall className="h-2.5 w-2.5" />
                                  </button>
                                  {activeContactPopup?.id === country.id && activeContactPopup.type === "phone" && (
                                    <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                      {phoneContact}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="relative popup-trigger">
                                  <button
                                    onClick={() => setActiveContactPopup(activeContactPopup?.id === country.id && activeContactPopup.type === "phone" ? null : { id: country.id, type: "phone" })}
                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                  >
                                    <PhoneCall className="h-2.5 w-2.5" />
                                  </button>
                                  {activeContactPopup?.id === country.id && activeContactPopup.type === "phone" && (
                                    <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                      +92-300-1234567
                                    </div>
                                  )}
                                </div>
                              )}
                              {mainBranch && typeof emailContact === "string" && emailContact ? (
                                <div className="relative popup-trigger">
                                  <button
                                    onClick={() => setActiveContactPopup(activeContactPopup?.id === country.id && activeContactPopup.type === "email" ? null : { id: country.id, type: "email" })}
                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                  >
                                    <Mail className="h-2.5 w-2.5" />
                                  </button>
                                  {activeContactPopup?.id === country.id && activeContactPopup.type === "email" && (
                                    <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                      {emailContact}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="relative popup-trigger">
                                  <button
                                    onClick={() => setActiveContactPopup(activeContactPopup?.id === country.id && activeContactPopup.type === "email" ? null : { id: country.id, type: "email" })}
                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                  >
                                    <Mail className="h-2.5 w-2.5" />
                                  </button>
                                  {activeContactPopup?.id === country.id && activeContactPopup.type === "email" && (
                                    <div className="absolute top-6 left-0 z-50 bg-slate-900 text-white border border-slate-800 rounded-md p-1.5 text-[9px] shadow-lg whitespace-nowrap popup-content font-semibold">
                                      main.pk@abc.com
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 relative">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={(e) => openActionDropdown(country.id, e.currentTarget)}
                                className="action-dropdown-trigger inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-bold text-slate-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              >
                                Actions
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
                                  label={isExpanded ? "Hide City Branches" : "Show City Branches"}
                                  onClick={() => { toggleCountryRow(country.id); setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                                />
                                {mainBranch ? (
                                  <>
                                    <ActionItem
                                      icon={<Eye className="h-3.5 w-3.5" />}
                                      label={viewLoadingId === mainBranch.id ? "Loading..." : "View Main Branch"}
                                      color="emerald"
                                      onClick={() => { viewCountryBranch(mainBranch.id, country.name); setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                                      disabled={viewLoadingId !== null}
                                    />
                                    <ActionItem
                                      icon={<PencilLine className="h-3.5 w-3.5" />}
                                      label="Edit Main Branch"
                                      color="indigo"
                                      onClick={() => { openCountryBranchEdit(mainBranch.id); setActiveActionDropdownId(null); setActiveActionAnchorRect(null); }}
                                    />
                                  </>
                                ) : (
                                  <ActionItem
                                    icon={<PencilLine className="h-3.5 w-3.5" />}
                                    label="Edit"
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
                            <td colSpan={13} className="p-3">
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
                                      <th className="p-2 border-r border-slate-200 text-left">Country</th>
                                      <th className="p-2 border-r border-slate-200 text-left">Main Branch</th>
                                      <th className="p-2 border-r border-slate-200 text-left">City Branch</th>
                                      <th className="p-2 border-r border-slate-200 text-left">Branch Code</th>
                                      <th className="p-2 border-r border-slate-200">Currency</th>
                                      <th className="p-2 border-r border-slate-200 text-left">Country User</th>
                                      <th className="p-2 border-r border-slate-200 text-left">Branch User</th>
                                      <th className="p-2">Contact / Action</th>
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
                                                    {viewLoadingId === cityBranch.id ? "..." : "View"}
                                                  </button>
                                                  <button
                                                    onClick={() => openCityBranchEdit(cityBranch.id)}
                                                    className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[8px] font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all"
                                                  >
                                                    Edit
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
                                          No city branches configured under this main branch.
                                        </td>
                                      </tr>
                                    )}
                                    
                                    {/* Default mockup sub-rows for fallback representation if data is empty */}
                                    {(!mainBranch || !mainBranch.cityBranches.length) && country.name.toLowerCase().includes("pakistan") && (
                                      <>
                                        <tr className="border-b text-[9px] text-center text-slate-700 hover:bg-slate-50/50">
                                          <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{country.code}</td>
                                          <td className="p-2 border-r border-slate-200 text-left">{country.name}</td>
                                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-500">PK-MAIN-001</td>
                                          <td className="p-2 border-r border-slate-200 font-bold text-slate-800 text-left">PK-LHE-001</td>
                                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-800 text-left">Lahore Branch</td>
                                          <td className="p-2 border-r border-slate-200">ABC Pvt Ltd</td>
                                          <td className="p-2 border-r border-slate-200">Asmat Super Admin</td>
                                          <td className="p-2 border-r border-slate-200">Lahore</td>
                                          <td className="p-2 border-r border-slate-200 tabular-nums">3</td>
                                          <td className="p-2">
                                            <button className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all">
                                              Edit
                                            </button>
                                          </td>
                                        </tr>
                                        <tr className="border-b text-[9px] text-center text-slate-700 hover:bg-slate-50/50">
                                          <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{country.code}</td>
                                          <td className="p-2 border-r border-slate-200 text-left">{country.name}</td>
                                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-500">PK-MAIN-001</td>
                                          <td className="p-2 border-r border-slate-200 font-bold text-slate-800 text-left">PK-KHI-002</td>
                                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-800 text-left">Karachi Branch</td>
                                          <td className="p-2 border-r border-slate-200">ABC Pvt Ltd</td>
                                          <td className="p-2 border-r border-slate-200">Asmat Super Admin</td>
                                          <td className="p-2 border-r border-slate-200">Karachi</td>
                                          <td className="p-2 border-r border-slate-200 tabular-nums">6</td>
                                          <td className="p-2">
                                            <button className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all">
                                              Edit
                                            </button>
                                          </td>
                                        </tr>
                                      </>
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
                    <td colSpan={13} className="p-6 text-center text-slate-400">No country records matched search query.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}




