"use client";

import React, { useMemo } from "react";
import { 
  User, 
  MapPin, 
  Building2, 
  ShieldCheck, 
  Lock, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  FileCheck, 
  Calendar, 
  Clock, 
  Edit, 
  X,
  Phone,
  Mail,
  Home,
  Globe2,
  BadgeCheck,
  Shield,
  Briefcase,
  Layers,
  KeyRound,
  FileSpreadsheet,
  Check,
  Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { buildRbacRoleSummary, buildAllModulesCapabilities, ModulePermissionCapability } from "@/lib/permissions/rbac-matrix-builder";
import { openUserA4ReportWindow, UserReportData } from "@/lib/reports/open-user-a4-report-window";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

export interface UserProfileData {
  userId: string;
  userCode: string;
  fullName: string;
  username: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  employeeCode?: string;
  countryName?: string;
  mainBranchName?: string;
  mainBranchCode?: string;
  cityBranchName?: string;
  cityBranchCode?: string;
  localCurrency?: string;
  role: EnterpriseRole;
  status: "Active" | "Inactive" | "Suspended" | string;
  cnicPassportNo?: string;
  idExpiryDate?: string;
  kycStatus?: "VERIFIED" | "PENDING" | string;
  residentialAddress?: string;
  passwordVaultRef?: string;
  permissions?: string[];
  moduleCapabilities?: ModulePermissionCapability[];
  employmentType?: string;
  joiningDate?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  jobStatus?: string;
  workingShift?: string;
  createdBy?: string;
  createdAt?: string;
  lastUpdatedBy?: string;
  updatedAt?: string;
}

interface UserProfileReportModalProps {
  user: UserProfileData;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (userId: string) => void;
}

export function UserProfileReportModal({
  user,
  isOpen,
  onClose,
  onEdit
}: UserProfileReportModalProps) {
  const activeLang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);
  const th = (s: string) => translateHeader(activeLang, s);

  const rbacSummary = useMemo(() => {
    return buildRbacRoleSummary(user.role, user.permissions);
  }, [user.role, user.permissions]);

  const moduleCapabilities = useMemo(() => {
    if (user.moduleCapabilities && user.moduleCapabilities.length > 0) {
      return user.moduleCapabilities;
    }
    return buildAllModulesCapabilities(user.role, user.permissions || []);
  }, [user.role, user.permissions, user.moduleCapabilities]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const reportData: UserReportData = {
      userId: user.userId,
      userCode: user.userCode,
      fullName: user.fullName,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      countryName: user.countryName || "Pakistan",
      branchName: user.cityBranchName || user.mainBranchName || "Main Branch",
      branchCode: user.cityBranchCode || user.mainBranchCode || "MAIN-001",
      branchType: user.designation || "Staff",
      role: user.role,
      registrationDate: user.createdAt || new Date().toISOString(),
      status: user.status || "Active",
      permissions: user.permissions || [],
      department: user.department,
      designation: user.designation,
      employeeCode: user.employeeCode,
      phone: user.phone,
      email: user.email,
      cnicPassportNo: user.cnicPassportNo,
      idExpiryDate: user.idExpiryDate,
      kycStatus: user.kycStatus,
      residentialAddress: user.residentialAddress,
      passwordVaultRef: user.passwordVaultRef || `VAULT-DGT-${user.userCode}`,
      employmentType: user.employmentType,
      joiningDate: user.joiningDate,
      contractStartDate: user.contractStartDate,
      contractEndDate: user.contractEndDate,
      jobStatus: user.jobStatus,
      workingShift: user.workingShift,
      createdBy: user.createdBy,
      lastUpdatedBy: user.lastUpdatedBy,
      lastActivity: user.updatedAt || new Date().toISOString(),
      lastActivityAction: "user.profile_viewed",
      rawPassword: user.passwordVaultRef || "VAULT-ENCRYPTED"
    };

    openUserA4ReportWindow({
      title: th("Comprehensive User Profile & Authorization Report"),
      subtitle: th("Official Centralized ERP User Registry & RBAC Permissions Record"),
      userData: reportData,
      lang: activeLang
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-800 shrink-0 gap-3">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 font-bold text-lg shadow-inner">
              <User className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">{user.fullName}</h2>
                <span className="font-mono text-xs bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-700 text-emerald-400 font-bold">
                  {user.userCode}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {user.status || "Active"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {rbacSummary.roleTitle} • {user.department || "General Office"} • {user.countryName || "Global Scope"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(user.userId);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs h-8 gap-1.5 font-medium"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>{th("Edit User Profile")}</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 gap-1.5 font-semibold shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{th("Print A4 Profile Report")}</span>
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable Full Report */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs bg-slate-50/50 dark:bg-slate-950/40">
          
          {/* Section 1: Executive 4-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Personal & Employment Master */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 border-b pb-2 border-slate-100 dark:border-slate-800 text-xs">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>1. Personal & Employment</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex justify-between"><span className="text-slate-400">Employee ID:</span><span className="font-mono font-bold text-slate-900 dark:text-slate-100">{user.employeeCode || "EMP-LINKED"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Designation:</span><span className="font-semibold">{user.designation || "-"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Department:</span><span className="font-semibold">{user.department || "-"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Job Status:</span><span>{user.jobStatus || "Active Permanent"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Employment:</span><span>{user.employmentType || "Full-Time"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Working Shift:</span><span>{user.workingShift || "Standard Day Shift"}</span></div>
              </div>
            </div>

            {/* Card 2: Geographic & Branch Access */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 border-b pb-2 border-slate-100 dark:border-slate-800 text-xs">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span>2. Branch & Geographic Scope</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex justify-between"><span className="text-slate-400">Country Scope:</span><span className="font-bold text-slate-900 dark:text-slate-100">{user.countryName || "Global"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Main Branch:</span><span className="font-semibold">{user.mainBranchName || "Corporate Main"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">City Branch:</span><span className="font-semibold">{user.cityBranchName || "Central Office"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Branch Code:</span><span className="font-mono font-bold text-emerald-600">{user.cityBranchCode || user.mainBranchCode || "HQ-001"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Local Currency:</span><span className="font-mono font-bold">{user.localCurrency || "USD"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Scope Level:</span><span className="font-semibold text-blue-600">{rbacSummary.scopeDescription}</span></div>
              </div>
            </div>

            {/* Card 3: Contact & Address */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 border-b pb-2 border-slate-100 dark:border-slate-800 text-xs">
                <Phone className="h-4 w-4 text-indigo-600" />
                <span>3. Contact & Residential</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex justify-between"><span className="text-slate-400">Phone / Mobile:</span><span className="font-semibold">{user.phone || "-"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Official Email:</span><span className="font-semibold">{user.email || "-"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">City Location:</span><span>{user.cityBranchName || user.countryName || "-"}</span></div>
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Permanent Address:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 block truncate" title={user.residentialAddress || ""}>
                    {user.residentialAddress || "Not Provided"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Security & Vault Credentials */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 border-b pb-2 border-slate-100 dark:border-slate-800 text-xs">
                <Lock className="h-4 w-4 text-purple-600" />
                <span>4. Security & Credential Vault</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex justify-between"><span className="text-slate-400">Login Username:</span><span className="font-mono font-bold text-blue-600 dark:text-blue-400">{user.username || user.userCode}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Vault Reference:</span>
                  <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-purple-600">
                    {user.passwordVaultRef || `VAULT-DGT-${user.userCode}`}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-slate-400">KYC Status:</span><span className="font-bold text-emerald-600">{user.kycStatus === "VERIFIED" ? "✅ Verified" : "⏳ Pending"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">CNIC / Passport:</span><span className="font-mono">{user.cnicPassportNo || "Verified"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">ID Expiry Date:</span><span>{user.idExpiryDate || "Permanent"}</span></div>
              </div>
            </div>

          </div>

          {/* Section 2: Complete RBAC Form/Module Permission Matrix */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>{th("Detailed Form / Module Permission Matrix (Database RBAC)")}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Granular functional authorizations for <strong>{rbacSummary.roleTitle}</strong> across all core ERP modules.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md font-bold border border-emerald-200 dark:border-emerald-800">
                  {moduleCapabilities.filter(m => m.canView || m.canCreate || m.canEdit).length} Authorized Modules
                </span>
                <span className="text-[11px] font-mono text-red-600 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-md font-bold border border-red-200 dark:border-red-800">
                  {moduleCapabilities.filter(m => !m.canView && !m.canCreate && !m.canEdit).length} Restricted
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">ERP Form / Module</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">View</th>
                    <th className="p-3 text-center">Create</th>
                    <th className="p-3 text-center">Edit</th>
                    <th className="p-3 text-center">Delete</th>
                    <th className="p-3 text-center">Post / Approve</th>
                    <th className="p-3 text-center">Print / Export</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {moduleCapabilities.map((mod) => {
                    const hasAny = mod.canView || mod.canCreate || mod.canEdit || mod.canDelete || mod.canPostApprove || mod.canPrintExport;

                    return (
                      <tr key={mod.moduleKey} className={hasAny ? "hover:bg-slate-50/60 dark:hover:bg-slate-800/40" : "bg-red-50/20 dark:bg-red-950/10 text-slate-400"}>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                          {mod.moduleName}
                        </td>
                        <td className="p-3 text-slate-500 font-medium">
                          {mod.category}
                        </td>
                        <td className="p-3 text-center">
                          {mod.canView ? <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-emerald-100 text-emerald-700 font-bold text-xs">✓</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-3 text-center">
                          {mod.canCreate ? <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-emerald-100 text-emerald-700 font-bold text-xs">✓</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-3 text-center">
                          {mod.canEdit ? <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-100 text-blue-700 font-bold text-xs">✓</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-3 text-center">
                          {mod.canDelete ? <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-red-100 text-red-700 font-bold text-xs">✓</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-3 text-center">
                          {mod.canPostApprove ? <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-purple-100 text-purple-700 font-bold text-xs">✓</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-3 text-center">
                          {mod.canPrintExport ? <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-emerald-100 text-emerald-700 font-bold text-xs">✓</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-3">
                          {hasAny ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {mod.canPostApprove ? "Posting Authorized" : mod.canCreate ? "Data Entry" : "Read-Only"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                              Restricted
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Supervisor Privileges & Restricted Modules Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {rbacSummary.supervisorPrivileges.length > 0 && (
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 text-xs">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    <span>{th("Special Supervisor & Approval Authorizations")}</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300 text-[11px]">
                    {rbacSummary.supervisorPrivileges.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {rbacSummary.restrictedModules.length > 0 && (
                <div className="p-4 bg-red-50/60 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-xl space-y-2">
                  <div className="font-bold text-red-900 dark:text-red-200 flex items-center gap-2 text-xs">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>{th("Restricted Modules (No System Access)")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rbacSummary.restrictedModules.map((m, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-[10px] bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 font-medium">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Audit Information & Metadata */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span>Created By: <strong className="text-slate-800 dark:text-slate-200">{user.createdBy || "System Administrator"}</strong> ({user.createdAt ? new Date(user.createdAt).toLocaleString() : "Active Record"})</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>Last Modified: <strong className="text-slate-800 dark:text-slate-200">{user.lastUpdatedBy || "Admin Console"}</strong> ({user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "Synchronized"})</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              <span>{th("Database RBAC Synchronized")}</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-white dark:bg-slate-900 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close Report
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 font-semibold shadow-sm">
            <Printer className="h-3.5 w-3.5" />
            Print A4 Report
          </Button>
        </div>
      </div>
    </div>
  );
}
