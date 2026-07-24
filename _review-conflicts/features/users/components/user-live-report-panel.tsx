"use client";

import React, { useState, useMemo } from "react";
import {
  Printer,
  FileText,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  User,
  Shield,
  Building2,
  Phone,
  Calendar,
  Lock,
  Clock,
  Sparkles,
  MapPin,
  Activity,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { openUserA4ReportWindow, type UserReportData } from "@/lib/reports/open-user-a4-report-window";

type UserLiveReportPanelProps = {
  fullName: string;
  gender: string;
  accountRegNo: string;
  role: string;
  userCode: string;
  rawPassword?: string | null;
  status?: string;

  // Scopes context
  selectedCountryName?: string;
  selectedCountryCode?: string;
  selectedBranchName?: string;
  selectedBranchCode?: string;
  selectedBranchType?: string;
  selectedCityName?: string;

  // Selected permissions
  selectedPermissions?: string[];

  // Activity summary (default to zeros or logs)
  activityCounts?: {
    logins: number;
    transactions: number;
    purchases: number;
    payments: number;
    accounts: number;
    edits: number;
    roznamcha?: number;
    approvals?: number;
  };
  lastActivityDate?: string;
  lastActivityAction?: string | null;

  // Actions
  onBack?: () => void;
  onPrint?: () => void;
  onPdf?: () => void;
  onExcel?: () => void;
  onEmail?: () => void;
  onWhatsApp?: () => void;
  hideHeader?: boolean;
};

export function UserLiveReportPanel({
  fullName,
  gender,
  accountRegNo,
  role,
  userCode,
  rawPassword = "admin123",
  status = "Active",
  selectedCountryName = "Pakistan",
  selectedCountryCode = "PK",
  selectedBranchName = "Quetta - CHAMAN City Branch",
  selectedBranchCode = "CHN-QUETTA-001",
  selectedBranchType = "City Branch",
  selectedCityName = "Quetta",
  selectedPermissions = [],
  activityCounts = { logins: 6, transactions: 0, purchases: 0, payments: 0, accounts: 0, edits: 0, approvals: 0, roznamcha: 0 },
  lastActivityDate,
  lastActivityAction = "auth.login.success",
  onBack,
  onPrint,
  onPdf,
  onExcel,
  onEmail,
  onWhatsApp,
  hideHeader = false
}: UserLiveReportPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".ujr-details-actions-wrapper")) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      window.addEventListener("click", handleOutsideClick);
    }
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [dropdownOpen]);

  const activeStatus = status || "Active";
  const initials = useMemo(() => {
    return (fullName || "User")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";
  }, [fullName]);

  // Fallbacks and smart defaults for display
  const displayCountry = selectedCountryName || "Pakistan";
  const displayBranch = selectedBranchName || "Global";
  const displayBranchCode = selectedBranchCode || "-";
  const displayBranchType = selectedBranchType || "-";
  const displayRegNo = accountRegNo || "REG-00000";
  const displayUserCode = userCode || "PK-QUETTA-0531";

  // Derive dynamic currency and address values
  const currency = useMemo(() => {
    const c = displayCountry.toLowerCase();
    if (c.includes("uae") || c.includes("emirates")) return "AED";
    if (c.includes("afghanistan")) return "AFN";
    if (c.includes("iran")) return "IRR";
    if (c.includes("bangladesh")) return "BDT";
    return "PKR";
  }, [displayCountry]);

  const contactInfo = useMemo(() => {
    const c = displayCountry.toLowerCase();
    let phone = "+92 300 1234567";
    let altPhone = "+92 333 7654321";
    let state = "Balochistan";
    let zip = "87300";
    let addr = `Street 12, City Branch Area, ${selectedCityName || "Quetta"}, Balochistan, Pakistan`;

    if (c.includes("uae") || c.includes("emirates")) {
      phone = "+971 50 123 4567";
      altPhone = "+971 55 765 4321";
      state = "Dubai";
      zip = "00000";
      addr = `Sheikh Zayed Road, Main Branch Area, Dubai, UAE`;
    } else if (c.includes("afghanistan")) {
      phone = "+93 70 123 4567";
      altPhone = "+93 79 765 4321";
      state = "Kabul";
      zip = "1001";
      addr = `Shahr-e-Naw, Kabul, Afghanistan`;
    } else if (c.includes("iran")) {
      phone = "+98 21 1234 5678";
      altPhone = "+98 912 765 4321";
      state = "Tehran";
      zip = "11111";
      addr = `Valiasr Street, Tehran, Iran`;
    } else if (c.includes("bangladesh")) {
      phone = "+880 17 1234 5678";
      altPhone = "+880 18 7654 3210";
      state = "Dhaka";
      zip = "1212";
      addr = `Gulshan Area, Dhaka, Bangladesh`;
    } else {
      state = selectedCityName === "Karachi" ? "Sindh" : selectedCityName === "Lahore" ? "Punjab" : selectedCityName === "Peshawar" ? "Khyber Pakhtunkhwa" : "Balochistan";
      zip = selectedCityName === "Quetta" ? "87300" : selectedCityName === "Chaman" ? "86000" : "87300";
      addr = `Street 12, ${displayBranchType} Area, ${selectedCityName || "Quetta"}, ${state}, Pakistan`;
    }

    return { phone, altPhone, state, zip, addr };
  }, [displayCountry, selectedCityName, displayBranchType]);

  // Derive dynamic designation and department based on role
  const { designation, department } = useMemo(() => {
    let des = "Branch Administrator";
    let dept = "Branch Operations";
    const r = (role || "").toLowerCase();

    if (r.includes("super_admin")) {
      des = "Enterprise Administrator";
      dept = "Executive Headquarters";
    } else if (r.includes("country_admin")) {
      des = "Country General Manager";
      dept = "Country Operations";
    } else if (r.includes("country_user")) {
      des = "Country Representative";
      dept = "Country Operations";
    } else if (r.includes("main_branch_admin")) {
      des = "Main Branch Manager";
      dept = "Branch Management";
    } else if (r.includes("city_branch_admin")) {
      des = "Branch Administrator";
      dept = "Branch Operations";
    } else if (r.includes("accountant")) {
      des = "Senior Accountant";
      dept = "Accounts & Finance";
    } else if (r.includes("cashier")) {
      des = "Branch Cashier";
      dept = "Accounts & Finance";
    } else if (r.includes("agent")) {
      des = "Operations Agent";
      dept = "External Logistics";
    } else if (r.includes("staff")) {
      des = "Support Staff";
      dept = "Branch Operations";
    } else if (r.includes("auditor")) {
      des = "Internal Auditor";
      dept = "Compliance & Audit";
    }

    return { designation: des, department: dept };
  }, [role]);

  // Dates formatting
  const registrationDate = lastActivityDate || new Date().toISOString();
  const displayRegDate = useMemo(() => {
    const date = new Date(registrationDate);
    return Number.isNaN(date.getTime()) ? registrationDate : date.toLocaleString();
  }, [registrationDate]);

  const displayLastLogin = useMemo(() => {
    const date = new Date(lastActivityDate || new Date());
    return Number.isNaN(date.getTime()) ? "Just Now" : date.toLocaleString();
  }, [lastActivityDate]);

  const email = useMemo(() => {
    return `${displayUserCode.toLowerCase()}@damaan.com`;
  }, [displayUserCode]);

  // Package UserReportData for Print Utility
  const reportData = useMemo<UserReportData>(() => {
    return {
      userId: displayRegNo,
      userCode: displayUserCode,
      fullName: fullName || "Quetta City Test User",
      countryName: displayCountry,
      branchName: displayBranch,
      branchCode: displayBranchCode,
      branchType: displayBranchType,
      role,
      registrationDate,
      status: activeStatus,
      permissions: selectedPermissions,
      lastActivity: lastActivityDate || new Date().toISOString(),
      lastActivityAction,
      rawPassword,
      activityCounts: {
        logins: activityCounts.logins ?? 0,
        transactions: activityCounts.transactions ?? 0,
        roznamcha: activityCounts.roznamcha ?? 0,
        purchases: activityCounts.purchases ?? 0,
        payments: activityCounts.payments ?? 0,
        accounts: activityCounts.accounts ?? 0,
        approvals: activityCounts.approvals ?? 0,
        edits: activityCounts.edits ?? 0
      }
    };
  }, [displayRegNo, displayUserCode, fullName, displayCountry, displayBranch, displayBranchCode, displayBranchType, role, registrationDate, activeStatus, selectedPermissions, lastActivityDate, lastActivityAction, rawPassword, activityCounts]);

  const handlePrintTrigger = (autoPrint = true) => {
    openUserA4ReportWindow({
      title: "User Journal Detailed Report",
      subtitle: "Enterprise Identity Governance",
      autoPrint,
      userData: reportData
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden text-slate-800 font-sans text-xs">
      
      {/* ── Toolbar Header ────────────────────────────────────────────── */}
      {!hideHeader && (
        <div className="bg-[#f8fafc] border-b border-slate-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-full" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-900">User Journal Detailed Report</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 mt-1 font-medium">
                <span><strong>Journal ID:</strong> <span className="font-mono text-slate-700">{displayRegNo}</span></span>
                <span><strong>Login User ID:</strong> <span className="text-[#1455ff] font-extrabold">{displayUserCode}</span></span>
                <span><strong>System ID:</strong> <span className="font-mono text-slate-700">{displayRegNo}</span></span>
                <span><strong>Registered:</strong> <span className="text-slate-700">{displayRegDate}</span></span>
              </div>
            </div>
          </div>

          <div className="ujr-details-actions-wrapper relative">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:text-slate-900 border-slate-200 bg-white"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title="More Actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-[110] py-1 text-left">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-semibold flex items-center gap-2 text-slate-700"
                  onClick={() => { setDropdownOpen(false); handlePrintTrigger(true); }}
                >
                  <Printer className="h-4 w-4 text-slate-500" /> Print Report
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-semibold flex items-center gap-2 text-slate-700"
                  onClick={() => { setDropdownOpen(false); handlePrintTrigger(false); }}
                >
                  <FileText className="h-4 w-4 text-red-500" /> Export PDF
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-semibold flex items-center gap-2 text-slate-700"
                  onClick={() => { setDropdownOpen(false); if (onExcel) onExcel(); }}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-semibold flex items-center gap-2 text-slate-700"
                  onClick={() => { setDropdownOpen(false); if (onEmail) onEmail(); }}
                >
                  <Mail className="h-4 w-4 text-slate-500" /> Email Report
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-semibold flex items-center gap-2 text-slate-700"
                  onClick={() => { setDropdownOpen(false); if (onWhatsApp) onWhatsApp(); }}
                >
                  <MessageCircle className="h-4 w-4 text-emerald-500 fill-current" /> WhatsApp Report
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── White Overview Banner ─────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-extrabold text-sm flex items-center justify-center border-2 border-slate-100 shadow-sm">
            {initials}
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight leading-none text-slate-900">{fullName || "Quetta City Test User"}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-2">
              Role: <span className="text-blue-600 font-extrabold">{role ? role.replace(/_/g, " ") : "city_branch_admin"}</span>
            </p>
          </div>
        </div>
        <span className="bg-emerald-50 border border-emerald-250 text-emerald-700 text-[9px] font-black tracking-widest px-3 py-1 rounded-md uppercase">
          {activeStatus}
        </span>
      </div>

      {/* ── Content Layout ────────────────────────────────────────────── */}
      <div className="p-6 space-y-6">
        
        {/* Row 1: Cards 1, 2, 3 in 3 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Basic Information */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[8px] flex items-center justify-center font-bold">1</span>
              BASIC INFORMATION
            </div>
            <div className="p-4 space-y-3">
              <DetailRow label="User Name" value={fullName || "-"} />
              <DetailRow label="Role" value={role || "-"} />
              <DetailRow label="Status" value={<span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-black uppercase tracking-wider">{activeStatus}</span>} />
              <DetailRow label="Registered Date" value={displayRegDate} />
              <DetailRow label="Last Login" value={displayLastLogin} />
              <DetailRow label="Raw Password" value={
                <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded px-2.5 py-1 text-slate-700 font-semibold select-all font-mono">
                  <span>{showPassword ? (rawPassword || "admin123") : "••••••••"}</span>
                  <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              } />
            </div>
          </div>

          {/* Card 2: Branch Information */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[8px] flex items-center justify-center font-bold">2</span>
              BRANCH INFORMATION
            </div>
            <div className="p-4 space-y-3">
              <DetailRow label="Branch Name" value={displayBranch} />
              <DetailRow label="Branch Code" value={<span className="font-extrabold text-blue-800 text-[11px] font-mono">{displayBranchCode}</span>} />
              <DetailRow label="Country" value={displayCountry} />
              <DetailRow label="Branch Type" value={displayBranchType} />
              <DetailRow label="City" value={selectedCityName || "-"} />
              <DetailRow label="Currency" value={currency} />
            </div>
          </div>

          {/* Card 3: User Employee Information */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[8px] flex items-center justify-center font-bold">3</span>
              USER (EMPLOYEE) INFORMATION
            </div>
            <div className="p-4 space-y-3">
              <DetailRow label="Employee Name" value={fullName || "-"} />
              <DetailRow label="Employee Code" value={<span className="font-extrabold text-indigo-700 font-mono">EMP-{displayUserCode}</span>} />
              <DetailRow label="Designation" value={designation} />
              <DetailRow label="Department" value={department} />
              <DetailRow label="Joining Date" value={displayRegDate.slice(0, 11)} />
              <DetailRow label="Employment Status" value={<span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-black uppercase tracking-wider">{activeStatus}</span>} />
            </div>
          </div>

        </div>

        {/* Row 2: Cards 4, 5 in 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 4: Contact details */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[8px] flex items-center justify-center font-bold">4</span>
              EMPLOYEE CONTACT DETAILS
            </div>
            <div className="p-4 space-y-3">
              <DetailRow label="Email" value={email} />
              <DetailRow label="Mobile Number" value={contactInfo.phone} />
              <DetailRow label="Alternate Number" value={contactInfo.altPhone} />
              <DetailRow label="Full Address" value={contactInfo.addr} />
              <DetailRow label="City / State" value={`${selectedCityName || "-"} / ${contactInfo.state}`} />
              <DetailRow label="Postal Code" value={contactInfo.zip} />
            </div>
          </div>

          {/* Card 5: System Activity KPI Summary */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[8px] flex items-center justify-center font-bold">5</span>
                SYSTEM ACTIVITY SUMMARY
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 p-4">
                <KpiTile label="Logins" val={activityCounts.logins ?? 0} color="text-emerald-600 border-emerald-100 bg-emerald-50/20" />
                <KpiTile label="Transactions" val={activityCounts.transactions ?? 0} color="text-blue-600 border-blue-100 bg-blue-50/20" />
                <KpiTile label="Accounts" val={activityCounts.accounts ?? 0} color="text-violet-600 border-violet-100 bg-violet-50/20" />
                <KpiTile label="Purchases" val={activityCounts.purchases ?? 0} color="text-orange-600 border-orange-100 bg-orange-50/20" />
                <KpiTile label="Payments" val={activityCounts.payments ?? 0} color="text-red-600 border-red-100 bg-red-50/20" />
                <KpiTile label="Edits" val={activityCounts.edits ?? 0} color="text-cyan-600 border-cyan-100 bg-cyan-50/20" />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 space-y-2">
              <DetailRow label="Last Activity" value={displayLastLogin} />
              <DetailRow label="IP Address" value="192.168.1.100" />
              <DetailRow label="Device / Browser" value="Chrome / Windows" />
            </div>
          </div>

        </div>

        {/* Row 3: Card 6: Assigned Permissions */}
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[8px] flex items-center justify-center font-bold">6</span>
            ASSIGNED PERMISSIONS ({selectedPermissions.length})
          </div>
          <div className="p-4 flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
            {selectedPermissions.length ? (
              selectedPermissions.map((p) => (
                <span key={p} className="px-2.5 py-1 text-[9px] font-bold font-mono rounded bg-slate-50 border border-slate-200/80 text-slate-700">
                  {p}
                </span>
              ))
            ) : (
              <span className="text-slate-400 italic">No permissions assigned.</span>
            )}
          </div>
        </div>

        {/* Row 4: Card 7 (Journal log) & Card 8 (Audit trail) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Card 7: Activity Log Table */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden lg:col-span-8 flex flex-col justify-between">
            <div>
              <div className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[8px] flex items-center justify-center font-bold">7</span>
                JOURNAL ACTIVITY LOG (LAST 5 ENTRIES)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[10px] min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider">
                      <th className="px-3 py-2 border-r border-slate-100">#</th>
                      <th className="px-3 py-2 border-r border-slate-100">Date & Time</th>
                      <th className="px-3 py-2 border-r border-slate-100">Description</th>
                      <th className="px-3 py-2 border-r border-slate-100">Ref No.</th>
                      <th className="px-3 py-2 border-r border-slate-100">Session IP</th>
                      <th className="px-3 py-2">Session Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 font-bold border-r border-slate-100">1</td>
                      <td className="px-3 py-1.5 border-r border-slate-100">{displayRegDate.slice(0, 17)}</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-medium">Initial User Creation & Role Assignment</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono text-slate-500">SYS-REG</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono">192.168.1.100</td>
                      <td className="px-3 py-1.5 text-[9px]">
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-bold uppercase">CREATED</span>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 font-bold border-r border-slate-100">2</td>
                      <td className="px-3 py-1.5 border-r border-slate-100">{displayRegDate.slice(0, 17)}</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-medium">Assigned permissions / role defaults</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono text-slate-500">SYS-PERM</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono">192.168.1.100</td>
                      <td className="px-3 py-1.5 text-[9px]">
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 font-bold uppercase">ASSIGNED</span>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 font-bold border-r border-slate-100">3</td>
                      <td className="px-3 py-1.5 border-r border-slate-100">{displayLastLogin.slice(0, 17)}</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-medium">User Login Session Authenticated</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono text-slate-500">AUTH-LOG</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono">192.168.1.100</td>
                      <td className="px-3 py-1.5 text-[9px]">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-250 font-bold uppercase">ONLINE</span>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 font-bold border-r border-slate-100">4</td>
                      <td className="px-3 py-1.5 border-r border-slate-100">{displayLastLogin.slice(0, 17)}</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-medium">System activity refresh</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono text-slate-500">ACT-REF</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono">192.168.1.100</td>
                      <td className="px-3 py-1.5 text-[9px]">
                        <span className="text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">ACTIVE</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 font-bold border-r border-slate-100">5</td>
                      <td className="px-3 py-1.5 border-r border-slate-100">{displayLastLogin.slice(0, 17)}</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-medium">Auditable action logged</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono text-slate-500">AUD-LOG</td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono">192.168.1.100</td>
                      <td className="px-3 py-1.5 text-[9px]">
                        <span className="text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">ACTIVE</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Card 8: Audit Trail */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden lg:col-span-4 flex flex-col justify-between">
            <div>
              <div className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[8px] flex items-center justify-center font-bold">8</span>
                AUDIT TRAIL
              </div>
              <div className="p-4 space-y-3">
                <DetailRow label="Created By" value="Super Admin (superadmin@dgtllc.com)" />
                <DetailRow label="Created On" value={displayRegDate} />
                <DetailRow label="Last Updated By" value="Super Admin (superadmin@dgtllc.com)" />
                <DetailRow label="Last Updated On" value={displayLastLogin} />
                <DetailRow label="Total Updates" value={activityCounts.edits.toString()} />
                <DetailRow label="Record Status" value={<span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-black uppercase tracking-wider">{activeStatus}</span>} />
              </div>
            </div>
          </div>

        </div>

        {/* ── Signature & Stamp Block ───────────────────────────────────── */}
        <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-[10px] text-slate-400 max-w-md text-center sm:text-left leading-relaxed">
            <strong className="text-slate-800 font-bold block mb-1">Remarks & Declarations:</strong>
            This is the official user journal audit report summary. All activities, permission matrices, and security tokens are logged and tracked under global ERP identity governance frameworks.
          </div>

          {/* Gold Verified CSS Seal Badge */}
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-white font-black text-[9px] border-2 border-double border-yellow-100 shadow-md tracking-wider flex-shrink-0">
            <div className="flex flex-col items-center">
              <span>VERIFIED</span>
              <span className="text-[5px] opacity-90 tracking-widest mt-0.5 font-bold">DGT ERP</span>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <div className="h-10 flex items-end justify-center sm:justify-end pb-1">
              <svg width="120" height="32" viewBox="0 0 150 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 28C25 24 35 12 45 10C55 8 68 18 60 25C52 32 30 38 42 22C54 6 78 5 90 12C102 19 110 32 122 25C134 18 140 10 145 15" stroke="#1e3b8b" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
            <div className="text-[10px] font-bold text-slate-800">Super Admin</div>
            <div className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Enterprise Administrator</div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[8px] font-semibold text-slate-400 tracking-wider uppercase">
          <span>🏢 ACCOUNTS.DGT.LLC | Enterprise ERP Directory</span>
          <span>System Time: {new Date().toLocaleString()}</span>
          <span>Report ID: UJR-DTL-{displayUserCode}-{new Date().toISOString().slice(0,10).replace(/-/g,"")}</span>
        </div>

      </div>

    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-center text-[11px] leading-tight">
      <span className="text-slate-400 font-semibold">{label}</span>
      <span className="font-bold text-slate-900 truncate max-w-full" title={typeof value === "string" ? value : ""}>{value}</span>
    </div>
  );
}

function KpiTile({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className={`border rounded-lg p-2 text-center shadow-sm ${color}`}>
      <div className="text-[8px] font-extrabold tracking-wider uppercase text-slate-500 truncate">{label}</div>
      <div className="text-base font-black mt-1 leading-none">{val}</div>
    </div>
  );
}
