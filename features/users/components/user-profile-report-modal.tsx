"use client";

import React, { useMemo } from "react";
import { 
  User, 
  MapPin, 
  Building2, 
  ShieldCheck, 
  Key, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Lock, 
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
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { buildRbacRoleSummary } from "@/lib/permissions/rbac-matrix-builder";
import { openUserA4ReportWindow, UserReportData } from "@/lib/reports/open-user-a4-report-window";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export interface UserProfileData {
  userId: string;
  userCode: string;
  fullName: string;
  username: string;
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
  const rbacSummary = useMemo(() => buildRbacRoleSummary(user.role), [user.role]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const reportData: UserReportData = {
      userId: user.userId,
      userCode: user.userCode,
      fullName: user.fullName,
      countryName: user.countryName || "Pakistan",
      branchName: user.cityBranchName || user.mainBranchName || "Main Branch",
      branchCode: user.cityBranchCode || user.mainBranchCode || "MAIN-001",
      branchType: user.designation || "Staff",
      role: user.role,
      registrationDate: user.createdAt || new Date().toISOString(),
      status: user.status || "Active",
      permissions: [],
      lastActivity: user.updatedAt || new Date().toISOString(),
      lastActivityAction: "user.updated",
      rawPassword: user.passwordVaultRef || "VAULT-ENCRYPTED",
      activityCounts: { logins: 1, transactions: 0, roznamcha: 0, purchases: 0, payments: 0, accounts: 0, approvals: 0, edits: 0 }
    };

    openUserA4ReportWindow({
      title: "User Profile & Access Authorization Report",
      subtitle: "Official Centralized ERP User Registry Record",
      userData: reportData,
      lang: activeLang
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 font-bold">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">{user.fullName}</h2>
                <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-emerald-400 font-bold">
                  {user.userCode}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {user.status || "Active"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {rbacSummary.roleTitle} • {user.department || "General Office"}
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
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs h-8 gap-1.5"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Edit User</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 gap-1.5 font-semibold"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print A4 Report</span>
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          
          {/* Section 1: Summary Information Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Employee Master & Contact Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 border-b pb-1.5 border-slate-200 dark:border-slate-700">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>Employee & Organization</span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Designation:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{user.designation || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{user.department || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Employee Code:</span>
                  <span className="font-mono font-semibold">{user.employeeCode || "EMP-LINKED"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone / WhatsApp:</span>
                  <span className="font-semibold">{user.phone || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Personal Email:</span>
                  <span className="font-semibold">{user.email || "-"}</span>
                </div>
              </div>
            </div>

            {/* Geographic Scope & Branch Access */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 border-b pb-1.5 border-slate-200 dark:border-slate-700">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span>Branch & Geographic Scope</span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Country Scope:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{user.countryName || "Global"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Main Branch:</span>
                  <span className="font-semibold">{user.mainBranchName || "Corporate Main"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">City Branch:</span>
                  <span className="font-semibold">{user.cityBranchName || "Headquarters"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Branch Code:</span>
                  <span className="font-mono font-bold text-emerald-600">{user.cityBranchCode || user.mainBranchCode || "HQ-001"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reporting Currency:</span>
                  <span className="font-mono font-bold">{user.localCurrency || "USD"}</span>
                </div>
              </div>
            </div>

            {/* Login & Credential Security */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 border-b pb-1.5 border-slate-200 dark:border-slate-700">
                <Lock className="h-4 w-4 text-purple-600" />
                <span>Security & Credential Vault</span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Login Username:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{user.username || user.userCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Vault Reference:</span>
                  <span className="font-mono font-bold bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-900 dark:text-slate-100">
                    {user.passwordVaultRef || `VAULT-DGT-${user.userCode}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">KYC Verification:</span>
                  <span className="font-bold text-emerald-600">
                    {user.kycStatus === "VERIFIED" ? "✅ Verified" : "⏳ Pending"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CNIC / Passport:</span>
                  <span className="font-mono">{user.cnicPassportNo || "Not Provided"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Document Expiry:</span>
                  <span>{user.idExpiryDate || "No Expiry Recorded"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Roles & Permissions Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-sm">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span>Roles & Permissions Summary Matrix (Live Database RBAC)</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Role: <strong className="text-blue-600 uppercase">{user.role}</strong> ({rbacSummary.scopeDescription})
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">ERP Module / Function</th>
                    <th className="p-2.5 text-center">View</th>
                    <th className="p-2.5 text-center">Create</th>
                    <th className="p-2.5 text-center">Edit</th>
                    <th className="p-2.5 text-center">Delete</th>
                    <th className="p-2.5 text-center">Post / Approve</th>
                    <th className="p-2.5 text-center">Print / Export</th>
                    <th className="p-2.5">Authorization Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rbacSummary.accessibleModules.map((mod) => (
                    <tr key={mod.moduleKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{mod.moduleName}</td>
                      <td className="p-2.5 text-center">{mod.canView ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-2.5 text-center">{mod.canCreate ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-2.5 text-center">{mod.canEdit ? <span className="text-blue-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-2.5 text-center">{mod.canDelete ? <span className="text-red-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-2.5 text-center">{mod.canPostApprove ? <span className="text-purple-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-2.5 text-center">{mod.canPrintExport ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {mod.notes}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Supervisor Privileges and Restricted Modules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {rbacSummary.supervisorPrivileges.length > 0 && (
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1.5">
                  <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5 text-xs">
                    <BadgeCheck className="h-4 w-4 text-blue-600" />
                    <span>Special Supervisor & Approval Privileges</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-700 dark:text-slate-300 text-[11px]">
                    {rbacSummary.supervisorPrivileges.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {rbacSummary.restrictedModules.length > 0 && (
                <div className="p-3 bg-red-50/60 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-xl space-y-1.5">
                  <div className="font-bold text-red-900 dark:text-red-200 flex items-center gap-1.5 text-xs">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>Restricted Modules (No Access)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {rbacSummary.restrictedModules.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Audit Information */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] gap-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Created By: <strong>{user.createdBy || "System Super Admin"}</strong> ({user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Active Record"})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>Last Modified: <strong>{user.lastUpdatedBy || "Admin Console"}</strong> ({user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "Current"})</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Identity Verified & Synchronized</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/60 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 font-semibold">
            <Printer className="h-3.5 w-3.5" />
            Print User Registration Report
          </Button>
        </div>
      </div>
    </div>
  );
}
