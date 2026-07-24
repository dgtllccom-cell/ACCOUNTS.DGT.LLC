"use client";

import type { ReactNode } from "react";
import { ClipboardList, Check, X, ShieldAlert, Building2, User2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BranchReportData } from "@/lib/reports/open-a4-report-window";
import { cn } from "@/lib/utils";

export type BranchLiveReportField = {
  label: string;
  value: string;
};

export type BranchLiveReportStep = {
  title: string;
  rows: BranchLiveReportField[];
};

function renderValue(value: string | null | undefined, prefix: string = "", fallback: string = "[Not Configured]") {
  const isBlank = !value || value.trim() === "" || value.trim() === "-" || value.trim().toLowerCase() === "undefined";
  if (isBlank) {
    return <span className="inline-flex max-w-full items-center rounded-md border border-rose-200/60 bg-rose-50 px-2 py-0.5 text-[10px] font-bold leading-4 text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">{fallback}</span>;
  }
  return <span className="block max-w-full break-words text-slate-900 dark:text-slate-100 font-semibold leading-5">{prefix}{value}</span>;
}

export function BranchLiveReportRow({ label, value }: BranchLiveReportField) {
  const blank = !value || value === "-" || value.trim() === "";

  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-dashed py-2 text-sm last:border-b-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={blank ? "font-semibold text-rose-600 dark:text-rose-400" : "font-semibold text-foreground"}>
        {blank ? "[Not Configured]" : value}
      </span>
    </div>
  );
}

function pillClassName() {
  return "inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-slate-700 dark:text-slate-200";
}

type BranchLiveReportPanelProps = {
  title: string;
  status: string;
  summary?: BranchLiveReportField[];
  steps?: BranchLiveReportStep[];
  actions?: ReactNode;
  footer?: ReactNode;
  branchData?: BranchReportData;
};

const PERMISSIONS_MAP = [
  { key: "dashboard.access", label: "Dashboard Access" },
  { key: "branch.new_entry", label: "Branch Entry (New)" },
  { key: "branch.edit", label: "Branch Edit / Update" },
  { key: "branch.delete", label: "Branch Delete" },
  { key: "users.access", label: "Users Access" },
  { key: "users.create", label: "Users Create / Invite" },
  { key: "users.edit", label: "Users Edit / Update" },
  { key: "accounts.access", label: "Accounts Access" },
  { key: "accounts.new_entry", label: "Accounts Create" },
  { key: "accounts.master", label: "Accounts Edit / Update" },
  { key: "ledgers.general", label: "Ledger Access" },
  { key: "journal.roznamcha.general", label: "Journal Entry" },
  { key: "journal.daily_payment.add_new", label: "Daily Payment" },
  { key: "purchase.entry", label: "Purchase Entry" },
  { key: "sales.entry", label: "Sales Entry" },
  { key: "reports.view", label: "Reports Access" },
  { key: "reports.export", label: "Reports Export (PDF/Excel)" },
  { key: "settings.access", label: "Settings Access" },
  { key: "settings.user_permissions", label: "User Permission Manage" },
  { key: "branches.manage", label: "Branch Permission Manage" },
  { key: "reports.roznamcha.bulk", label: "Bulk Operations" },
  { key: "inventory.access", label: "Inventory Access" },
  { key: "inventory.stock", label: "Stock Management" },
  { key: "masters.access", label: "Suppliers Access" },
  { key: "masters.customers", label: "Customers Access" },
  { key: "finance.access", label: "Bank Management" },
  { key: "finance.cheque", label: "Cheque Management" },
  { key: "settings.system", label: "All Modules Access" }
];

export function BranchLiveReportPanel({
  title,
  status,
  summary = [],
  steps = [],
  actions,
  footer,
  branchData
}: BranchLiveReportPanelProps) {
  const hasLiveReport = Boolean(branchData);

  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  if (hasLiveReport && branchData) {
    const b = branchData;
    const allowedSet = new Set(b.allowedPermissions || []);

    return (
      <Card className="border-slate-200/80 shadow-md dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
        {/* Actions header bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Corporate Preview</span>
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>

        <div className="p-4 md:p-6 space-y-5">
          {/* Header Branding */}
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.5fr] gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            {/* Logo details */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 leading-tight">ACCOUNTS.DGT.LLC</h4>
                <p className="text-[9px] font-semibold text-slate-400">Enterprise ERP / FMS</p>
                <p className="text-[8px] font-medium text-slate-400/90 leading-tight">Multi-Country Branch Management</p>
              </div>
            </div>

            {/* Document Title */}
            <div className="flex flex-col items-center justify-center text-center">
              <h1 className="text-sm font-black text-blue-900 dark:text-blue-400 tracking-wide uppercase leading-tight">
                {b.branchType === "MAIN" ? "Country Main Branch" : b.branchType === "CITY" ? "City Branch Report" : "Super Admin Branch"}
              </h1>
              <span className="mt-1 text-[8px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-600/30 rounded-full px-2 py-0.5 uppercase bg-blue-50/50 dark:bg-blue-950/30">
                {b.branchStatus || status || "Draft"}
              </span>
            </div>

            {/* Metadata Box */}
            <div className="flex flex-col justify-start md:items-end text-left md:text-right text-[9px] text-slate-600 dark:text-slate-400 leading-normal font-medium">
              <div><span className="text-slate-400">Generated On:</span> {stampDate}</div>
              <div><span className="text-slate-400">Generated Time:</span> {stampTime}</div>
              <div><span className="text-slate-400">Report By:</span> {b.createdBy || "Super Admin"}</div>
              <div><span className="text-slate-400">Report Type:</span> Branch Detail</div>
            </div>
          </div>

          {/* Parent Scope Hierarchy Context */}
          {(b.parentBranch || b.grandparentBranch) && (
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-lg p-3 space-y-2">
              <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Parent Scope Security Hierarchy Context</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {b.grandparentBranch && (
                  <>
                    <div className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded px-2.5 py-1.5 flex flex-col min-w-[150px]">
                      <span className="text-[7px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{b.grandparentBranch.type}</span>
                      <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">{b.grandparentBranch.name}</span>
                      <span className="text-[8px] font-semibold text-slate-400">Code: {b.grandparentBranch.code} ({b.grandparentBranch.status})</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700 text-sm font-bold">➔</span>
                  </>
                )}
                {b.parentBranch && (
                  <>
                    <div className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded px-2.5 py-1.5 flex flex-col min-w-[150px]">
                      <span className="text-[7px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{b.parentBranch.type}</span>
                      <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">{b.parentBranch.name}</span>
                      <span className="text-[8px] font-semibold text-slate-400">Code: {b.parentBranch.code} ({b.parentBranch.status})</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700 text-sm font-bold">➔</span>
                  </>
                )}
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/30 dark:border-blue-900/40 rounded px-2.5 py-1.5 flex flex-col min-w-[150px] shadow-sm">
                  <span className="text-[7px] font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wider">{b.branchType || "NEW"}</span>
                  <span className="text-[10px] font-black text-blue-900 dark:text-blue-200 truncate">{b.branchName || "Creating branch..."}</span>
                  <span className="text-[8px] font-semibold text-blue-500/80">Code: {b.branchCode || "-"} (CREATING)</span>
                </div>
              </div>
            </div>
          )}

          {/* KPI Cards Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/20 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">✓</div>
              <div className="flex flex-col">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{(b.branchStatus || "Active").toUpperCase()}</span>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/20 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/50">📌</div>
              <div className="flex flex-col">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Code</span>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{b.branchCode || "-"}</span>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/20 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400 border border-pink-200/50">🏢</div>
              <div className="flex flex-col">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Type</span>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{(b.branchType || "MAIN").toUpperCase()}</span>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/20 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200/50">🌍</div>
              <div className="flex flex-col">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Country</span>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{(b.country || "-").toUpperCase()}</span>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/20 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">💵</div>
              <div className="flex flex-col">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Currency</span>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{(b.currency || "USD").toUpperCase()}</span>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/20 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/50">#</div>
              <div className="flex flex-col">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Serial</span>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{b.serialNumber || "0001"}</span>
              </div>
            </div>
          </div>

          {/* Grid Layout (2 columns for details) */}
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            {/* Column Left */}
            <div className="space-y-4">
              {/* Section 1: Branch Information */}
              <div>
                <div className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-t-lg flex items-center gap-2">
                  <span className="h-4 w-4 bg-white/20 rounded-full flex items-center justify-center text-[8px]">1</span>
                  <span>Branch Information</span>
                </div>
                <div className="border border-t-0 border-slate-100 dark:border-slate-800 rounded-b-lg p-3.5 bg-white dark:bg-slate-950/40 space-y-2">
                  <table className="w-full table-fixed text-[12px]">
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Serial Number</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.serialNumber || "0001")}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Branch Code</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.branchCode)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Branch Name</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.branchName)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Branch Type</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.branchType)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Country</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.country)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Currency</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.currency)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Created Date</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.createdDate || stampDate)}</td>
                      </tr>
                      <tr>
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Updated Date</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.updatedDate || stampDate)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Branch Details */}
              <div>
                <div className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-t-lg flex items-center gap-2">
                  <span className="h-4 w-4 bg-white/20 rounded-full flex items-center justify-center text-[8px]">2</span>
                  <span>Branch Details & Address</span>
                </div>
                <div className="border border-t-0 border-slate-100 dark:border-slate-800 rounded-b-lg p-3.5 bg-white dark:bg-slate-950/40 space-y-2">
                  <table className="w-full table-fixed text-[12px]">
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Branch Code</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.branchCode)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">City / Region</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.city)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">City Code</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.cityCode)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">State / Province</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.stateProvince)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Area / District</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.areaRegion)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Postal / Zip Code</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.zipCode)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Mobile Number</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.phone, "Tel: ")}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Email Address</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.email, "Email: ")}</td>
                      </tr>
                      <tr>
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Full Address</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.fullAddress)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Column Right */}
            <div className="space-y-4">
              {/* Section 3: Owner Details */}
              <div>
                <div className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-t-lg flex items-center gap-2">
                  <span className="h-4 w-4 bg-white/20 rounded-full flex items-center justify-center text-[8px]">3</span>
                  <span>Owner Details</span>
                </div>
                <div className="border border-t-0 border-slate-100 dark:border-slate-800 rounded-b-lg p-3.5 bg-white dark:bg-slate-950/40 space-y-3">
                  {/* Owner avatar card */}
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-2.5 rounded-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
                      <User2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-black text-slate-800 dark:text-slate-200">{renderValue(b.ownerName)}</h5>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Code: {renderValue(b.ownerCode)}</p>
                      <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Designation: {renderValue(b.designation)}</p>
                    </div>
                  </div>

                  <table className="w-full table-fixed text-[12px]">
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Father / Husband Name</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.fatherHusbandName)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">CNIC / ID Number</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.cnicId)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Nationality</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.nationality)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Ownership Type</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.ownershipType)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Ownership Percentage</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.ownershipPercent)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Mobile / Phone</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.ownerPhone, "Tel: ")}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">WhatsApp</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.ownerWhatsApp, "WhatsApp: ")}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Email</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.ownerEmail, "Email: ")}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Country</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.ownerCountry)}</td>
                      </tr>
                      <tr>
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Address / Website</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.ownerWebsite)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4: Company Details */}
              <div>
                <div className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-t-lg flex items-center gap-2">
                  <span className="h-4 w-4 bg-white/20 rounded-full flex items-center justify-center text-[8px]">4</span>
                  <span>Company Details</span>
                </div>
                <div className="border border-t-0 border-slate-100 dark:border-slate-800 rounded-b-lg p-3.5 bg-white dark:bg-slate-950/40 space-y-2">
                  <table className="w-full table-fixed text-[12px]">
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Company Name</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.companyName)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Company Code</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.companyCode)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Company Type</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.companyType)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Office Phone</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.companyPhone, "Tel: ")}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Office Email</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.companyEmail, "Email: ")}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-900/50">
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Office Address</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.companyOfficeAddress)}</td>
                      </tr>
                      <tr>
                        <td className="w-[42%] py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 dark:text-slate-400">Company Status</td>
                        <td className="py-2 align-top text-left text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-right">{renderValue(b.companyStatus)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Permissions Grid */}
          <div>
            <div className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-t-lg flex items-center gap-2">
              <span className="h-4 w-4 bg-white/20 rounded-full flex items-center justify-center text-[8px]">5</span>
              <span>Branch Permissions & Access Rights</span>
            </div>
            <div className="border border-t-0 border-slate-100 dark:border-slate-800 rounded-b-md p-4 bg-slate-50/30 dark:bg-slate-950/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {PERMISSIONS_MAP.map((item) => {
                  const isAllowed = allowedSet.has(item.key) || allowedSet.has("settings.access") || allowedSet.has("branch.super_admin");
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "flex items-center gap-2 p-1.5 rounded-md border text-[11px] font-medium transition-all",
                        isAllowed
                          ? "border-emerald-100 bg-emerald-50/40 text-emerald-800 dark:border-emerald-950/20 dark:bg-emerald-950/10 dark:text-emerald-300"
                          : "border-slate-100 bg-slate-50/50 text-slate-400 dark:border-slate-900 dark:bg-slate-900/40"
                      )}
                    >
                      {isAllowed ? (
                        <div className="h-4.5 w-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center p-0.5 shadow-sm">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="h-4.5 w-4.5 rounded-full bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500 flex items-center justify-center p-0.5">
                          <X className="h-2.5 w-2.5" strokeWidth={3} />
                        </div>
                      )}
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer block: Signatures, Seal and Remarks */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Remarks */}
            <div className="w-full md:w-5/12 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 p-3 rounded-lg text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
              <strong className="block text-slate-700 dark:text-slate-300 text-xs mb-1">Remarks / Notes</strong>
              <span>{b.remarks || "This is the branch profile summary report. All operations are managed under this branch's authorized scopes."}</span>
            </div>

            {/* Verification Seal */}
            <div className="flex justify-center items-center">
              <svg width="75" height="75" viewBox="0 0 100 100" className="drop-shadow-md">
                {/* Ribbon */}
                <path d="M35 50 L25 88 L50 78 L75 88 L65 50 Z" fill="#d97706" className="dark:opacity-90" />
                <path d="M45 50 L40 92 L50 84 L60 92 L55 50 Z" fill="#b45309" className="dark:opacity-90" />
                {/* Outer Ring */}
                <circle cx="50" cy="45" r="35" fill="url(#goldGrad)" stroke="#f59e0b" strokeWidth="2.5" />
                <circle cx="50" cy="45" r="30" fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="3,3" />
                {/* Typography */}
                <text x="50" y="38" fontFamily="'Inter', sans-serif" fontSize="7.5" fontWeight="900" textAnchor="middle" fill="#78350f" letterSpacing="0.2">VERIFIED</text>
                <text x="50" y="46" fontFamily="'Inter', sans-serif" fontSize="5.5" fontWeight="800" textAnchor="middle" fill="#92400e">VERIFIED</text>
                <text x="50" y="55" fontFamily="'Inter', sans-serif" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="#78350f" letterSpacing="0.2">AUTHORIZED</text>
                
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef3c7" />
                    <stop offset="50%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Signature Block */}
            <div className="w-full md:w-3/12 flex flex-col items-center justify-center text-center">
              <div className="border-b border-slate-300 dark:border-slate-700 w-full h-8 flex items-end justify-center pb-1 text-slate-800 dark:text-slate-200 font-serif italic text-sm font-semibold select-none">
                {b.createdBy || "Super Admin"}
              </div>
              <p className="text-[10px] font-extrabold text-slate-500 mt-1 uppercase">Approved Authority</p>
              <p className="text-[8px] text-slate-400 font-medium leading-none">ACCOUNTS.DGT.LLC</p>
            </div>
          </div>
        </div>

        {/* Outer Card Footer info */}
        {footer ? <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 p-4">{footer}</div> : null}
      </Card>
    );
  }

  // Fallback View (Legacy List style)
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle>{title}</CardTitle>
          </div>
          <span className={pillClassName()}>
            <b>Status:</b> <span>{status}</span>
          </span>
        </div>

        {summary.length ? (
          <div className="mt-3 rounded-lg border bg-muted/25 p-3">
            <div className="flex flex-wrap gap-2">
              {summary.map((item) => (
                <span key={`${item.label}-${item.value}`} className={pillClassName()}>
                  <b>{item.label}:</b> <span>{item.value || "-"}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {actions ? <div className="mt-3 flex justify-end gap-2">{actions}</div> : null}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-3">
          {steps.map((step) => (
            <section key={step.title} className="rounded-lg border bg-background p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{step.title}</p>
              <div className="mt-2 space-y-1">
                {step.rows.map((row) => (
                  <BranchLiveReportRow key={`${step.title}-${row.label}`} label={row.label} value={row.value} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {footer ? <div className="border-t pt-2">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}


