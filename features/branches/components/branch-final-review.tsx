"use client";

import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Landmark,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  Printer,
  Eye,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Users,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BranchLevelType = "city" | "country" | "administrative";

export interface BranchReviewDocumentItem {
  id: string;
  name: string;
  type: string;
  size?: string;
  isRequired?: boolean;
  isUploaded: boolean;
  uploadedAt?: string;
}

export interface BranchUserPermissionItem {
  id: string;
  userName: string;
  role: string;
  operationalDomain: string;
  countryScope: string;
  branchScope: string;
  permissionGroup: string;
  ledgerVisibility: string;
  status: "Active" | "Pending" | "Warning";
  statusReason?: string;
}

export interface BranchChecklistStatus {
  countrySelected?: boolean;
  mainBranchSelected?: boolean;
  branchNameCodeGenerated?: boolean;
  branchCategoryType?: boolean;
  ownerResponsiblePerson?: boolean;
  companyLinked?: boolean;
  businessShippingDomain?: boolean;
  fullAddressLocation?: boolean;
  mobileEmail?: boolean;
  currencySelected?: boolean;
  bankAccountSetup?: boolean;
  userAdminAssigned?: boolean;
  rolePermissions?: boolean;
  requiredDocumentsUploaded?: boolean;
  serialNumbersGenerated?: boolean;
  approvalStatusReady?: boolean;
  businessAdminAssigned?: boolean;
  shippingClearingAdminAssigned?: boolean;
  operationsAdminAssigned?: boolean;
  ledgerScopeConfirmed?: boolean;
}

export interface BranchFinalReviewProps {
  branchLevel: BranchLevelType;
  branchLevelTitle?: string; // e.g. "City Branch", "Country Branch", "Administrative Branch"
  branchName: string;
  branchCode: string;
  branchType: string;
  category: string;
  
  // Location
  country: string;
  stateProvince: string;
  city: string;
  fullAddress: string;

  // Company / Account
  companyName: string;
  businessDomain?: string;
  shippingDomain?: string;
  currency: string;
  mainBranchName?: string;

  // Documents
  documents?: BranchReviewDocumentItem[];
  
  // Users & Permissions
  usersAndPermissions?: BranchUserPermissionItem[];

  // Custom / Overridden checklist status
  checklistStatus?: BranchChecklistStatus;

  // Timestamp
  lastSavedText?: string;
  isSaving?: boolean;

  // Actions
  onBack?: () => void;
  onGoToStep?: (stepNumber: number) => void;
  onEditSection?: (section: "branch_info" | "location" | "company" | "documents" | "roles" | "business") => void;
  onApproveAndActivate?: (note: string) => Promise<void> | void;
  onSendBackForEdit?: (note: string) => void;
  onRequestChanges?: (note: string) => void;
  onViewSummary?: () => void;
  onPrint?: () => void;
}

export function BranchFinalReview({
  branchLevel,
  branchLevelTitle,
  branchName,
  branchCode,
  branchType,
  category,
  country,
  stateProvince,
  city,
  fullAddress,
  companyName,
  businessDomain = "Trading & Distribution",
  shippingDomain = "Import & Export",
  currency,
  mainBranchName = "Head Office (DXB-001)",
  documents = [],
  usersAndPermissions = [],
  checklistStatus = {},
  lastSavedText = "28 Oct 2024, 10:24 AM",
  isSaving = false,
  onBack,
  onGoToStep,
  onEditSection,
  onApproveAndActivate,
  onSendBackForEdit,
  onRequestChanges,
  onViewSummary,
  onPrint
}: BranchFinalReviewProps) {
  const [approvalNote, setApprovalNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayTitle = branchLevelTitle || (
    branchLevel === "city"
      ? "City Branch"
      : branchLevel === "country"
      ? "Country Branch"
      : "Administrative Branch"
  );

  // Default document metrics if none provided
  const docList = useMemo(() => {
    if (documents.length > 0) return documents;
    return [
      { id: "d1", name: "Trade License / Commercial Reg", type: "PDF", isRequired: true, isUploaded: true },
      { id: "d2", name: "Tax Registration Certificate", type: "PDF", isRequired: true, isUploaded: true },
      { id: "d3", name: "Branch Lease Agreement", type: "PDF", isRequired: true, isUploaded: true },
      { id: "d4", name: "Board Resolution for Branch Opening", type: "PDF", isRequired: true, isUploaded: true },
      { id: "d5", name: "NOC from Local Authority", type: "PDF", isRequired: true, isUploaded: true },
      { id: "d6", name: "Bank Account Verification Letter", type: "PDF", isRequired: true, isUploaded: true },
      { id: "d7", name: "Identity Proof of Branch Manager", type: "PDF", isRequired: true, isUploaded: false },
      { id: "d8", name: "Customs & Clearing Authorization", type: "PDF", isRequired: true, isUploaded: false }
    ];
  }, [documents]);

  const totalDocs = docList.length;
  const requiredDocs = docList.filter((d) => d.isRequired).length;
  const uploadedDocs = docList.filter((d) => d.isUploaded).length;
  const pendingDocs = totalDocs - uploadedDocs;

  // Default users & permissions if none provided
  const userPermsList = useMemo(() => {
    if (usersAndPermissions.length > 0) return usersAndPermissions;
    return [
      {
        id: "u1",
        userName: "Amrullah Abdullah",
        role: "Branch Manager / Operations Admin",
        operationalDomain: "Operations & Administration",
        countryScope: country || "Afghanistan",
        branchScope: branchName || "Kabul City Branch",
        permissionGroup: "Full Branch Admin",
        ledgerVisibility: "All Branch Ledgers",
        status: "Active" as const
      },
      {
        id: "u2",
        userName: "Farooq Siddiqui",
        role: "Branch Accountant",
        operationalDomain: "Finance & Accounting",
        countryScope: country || "Afghanistan",
        branchScope: branchName || "Kabul City Branch",
        permissionGroup: "Finance Read & Write",
        ledgerVisibility: "Cash & Bank Ledgers",
        status: "Active" as const
      },
      {
        id: "u3",
        userName: "Nisar Ahmad",
        role: "Business Admin",
        operationalDomain: "Sales & Distribution",
        countryScope: country || "Afghanistan",
        branchScope: branchName || "Kabul City Branch",
        permissionGroup: "Commercial Access",
        ledgerVisibility: "Customer Accounts",
        status: "Active" as const
      },
      {
        id: "u4",
        userName: "Shipping Desk Agent",
        role: "Shipping / Clearing Admin",
        operationalDomain: "Logistics & Clearance",
        countryScope: country || "Afghanistan",
        branchScope: branchName || "Kabul City Branch",
        permissionGroup: "Customs Clearance Group",
        ledgerVisibility: "Logistics Expenses",
        status: "Pending" as const,
        statusReason: "Required verification document pending"
      }
    ];
  }, [usersAndPermissions, country, branchName]);

  // Evaluate the 20 checklist items
  const evaluatedChecklist = useMemo(() => {
    const raw: Array<{
      id: number;
      title: string;
      isCompleted: boolean;
      stepNumber: number;
      sectionKey: "branch_info" | "location" | "company" | "documents" | "roles" | "business";
    }> = [
      {
        id: 1,
        title: "Country selected",
        isCompleted: checklistStatus.countrySelected ?? Boolean(country && country !== "-"),
        stepNumber: 3,
        sectionKey: "location"
      },
      {
        id: 2,
        title: "Main Branch selected",
        isCompleted: checklistStatus.mainBranchSelected ?? Boolean(branchLevel === "country" || mainBranchName),
        stepNumber: 1,
        sectionKey: "branch_info"
      },
      {
        id: 3,
        title: `${displayTitle} name/code`,
        isCompleted: checklistStatus.branchNameCodeGenerated ?? Boolean(branchName && branchCode),
        stepNumber: 1,
        sectionKey: "branch_info"
      },
      {
        id: 4,
        title: "Branch category/type",
        isCompleted: checklistStatus.branchCategoryType ?? Boolean(branchType && category),
        stepNumber: 1,
        sectionKey: "branch_info"
      },
      {
        id: 5,
        title: "Owner / Responsible Person",
        isCompleted: checklistStatus.ownerResponsiblePerson ?? true,
        stepNumber: 2,
        sectionKey: "company"
      },
      {
        id: 6,
        title: "Company linked",
        isCompleted: checklistStatus.companyLinked ?? Boolean(companyName && companyName !== "-"),
        stepNumber: 2,
        sectionKey: "company"
      },
      {
        id: 7,
        title: "Business / Shipping domain selected",
        isCompleted: checklistStatus.businessShippingDomain ?? Boolean(businessDomain && shippingDomain),
        stepNumber: 4,
        sectionKey: "business"
      },
      {
        id: 8,
        title: "Address / Country / State / City",
        isCompleted: checklistStatus.fullAddressLocation ?? Boolean(country && stateProvince && city && fullAddress),
        stepNumber: 3,
        sectionKey: "location"
      },
      {
        id: 9,
        title: "Mobile / Email",
        isCompleted: checklistStatus.mobileEmail ?? true,
        stepNumber: 3,
        sectionKey: "location"
      },
      {
        id: 10,
        title: "Currency selected",
        isCompleted: checklistStatus.currencySelected ?? Boolean(currency && currency !== "-"),
        stepNumber: 2,
        sectionKey: "company"
      },
      {
        id: 11,
        title: "Bank / Account setup",
        isCompleted: checklistStatus.bankAccountSetup ?? true,
        stepNumber: 2,
        sectionKey: "company"
      },
      {
        id: 12,
        title: "User/Admin assigned",
        isCompleted: checklistStatus.userAdminAssigned ?? (userPermsList.length > 0),
        stepNumber: 5,
        sectionKey: "roles"
      },
      {
        id: 13,
        title: "Role & Permissions",
        isCompleted: checklistStatus.rolePermissions ?? (userPermsList.some(u => u.status === "Active")),
        stepNumber: 5,
        sectionKey: "roles"
      },
      {
        id: 14,
        title: "Required documents uploaded",
        isCompleted: checklistStatus.requiredDocumentsUploaded ?? (pendingDocs === 0),
        stepNumber: 6,
        sectionKey: "documents"
      },
      {
        id: 15,
        title: "Serial numbers generated",
        isCompleted: checklistStatus.serialNumbersGenerated ?? true,
        stepNumber: 4,
        sectionKey: "business"
      },
      {
        id: 16,
        title: "Approval status ready",
        isCompleted: checklistStatus.approvalStatusReady ?? true,
        stepNumber: 7,
        sectionKey: "branch_info"
      },
      {
        id: 17,
        title: "Business Admin assigned",
        isCompleted: checklistStatus.businessAdminAssigned ?? (userPermsList.some(u => u.role.toLowerCase().includes("business"))),
        stepNumber: 5,
        sectionKey: "roles"
      },
      {
        id: 18,
        title: "Shipping/Clearing Admin assigned",
        isCompleted: checklistStatus.shippingClearingAdminAssigned ?? (
          branchLevel === "administrative"
            ? true
            : userPermsList.some(u => u.role.toLowerCase().includes("shipping") && u.status === "Active")
        ),
        stepNumber: 5,
        sectionKey: "roles"
      },
      {
        id: 19,
        title: "Operations Admin assigned",
        isCompleted: checklistStatus.operationsAdminAssigned ?? (userPermsList.some(u => u.role.toLowerCase().includes("operations") || u.role.toLowerCase().includes("manager"))),
        stepNumber: 5,
        sectionKey: "roles"
      },
      {
        id: 20,
        title: "Ledger scope confirmed",
        isCompleted: checklistStatus.ledgerScopeConfirmed ?? true,
        stepNumber: 4,
        sectionKey: "business"
      }
    ];

    return raw;
  }, [
    checklistStatus,
    country,
    branchLevel,
    mainBranchName,
    displayTitle,
    branchName,
    branchCode,
    branchType,
    category,
    companyName,
    businessDomain,
    shippingDomain,
    stateProvince,
    city,
    fullAddress,
    currency,
    userPermsList,
    pendingDocs
  ]);

  const completedCount = evaluatedChecklist.filter((item) => item.isCompleted).length;
  const totalCount = evaluatedChecklist.length;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);

  const missingItems = evaluatedChecklist.filter((item) => !item.isCompleted);
  const hasPendingPermissions = userPermsList.some(u => u.status !== "Active");
  const isApprovalReady = missingItems.length === 0 && !hasPendingPermissions;

  async function handleApprove() {
    if (!isApprovalReady || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (onApproveAndActivate) {
        await onApproveAndActivate(approvalNote);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 w-full max-w-[1600px] mx-auto text-slate-800 dark:text-slate-100">
      
      {/* ── BREADCRUMB & TOP HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-9 px-3 text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          )}
          <div>
            <nav className="text-[10px] font-semibold text-slate-400 mb-0.5 flex items-center gap-1.5">
              <span>New Entry</span>
              <span>›</span>
              <span>Branch Entry</span>
              <span>›</span>
              <span className="text-slate-600 dark:text-slate-300 font-bold">{displayTitle}</span>
            </nav>
            <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {displayTitle} — Final Review & Approval
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review all information below and ensure all checklist items are completed before approving this {displayTitle.toLowerCase()}.
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2">
          {onViewSummary && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewSummary}
              className="h-9 px-3 text-xs font-semibold gap-1.5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
            >
              <Eye className="h-4 w-4 text-slate-500" />
              <span>View</span>
            </Button>
          )}

          {onPrint && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="h-9 px-3 text-xs font-semibold gap-1.5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-500" />
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            disabled={!isApprovalReady || isSubmitting || isSaving}
            onClick={handleApprove}
            className="h-9 px-4 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 disabled:bg-slate-400 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Approve & Activate</span>
          </Button>
        </div>
      </div>

      {/* ── 7-STEP PROGRESS WIZARD TRACKER ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-950 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[760px] gap-2 px-2">
          {[
            { n: 1, label: "Basic Information", done: true },
            { n: 2, label: "Company & Account", done: true },
            { n: 3, label: "Location & Address", done: true },
            { n: 4, label: "Business Setup", done: true },
            { n: 5, label: "Roles & Users", done: true },
            { n: 6, label: "Documents", done: true },
            { n: 7, label: "Final Review", done: false, active: true }
          ].map((step, idx) => (
            <React.Fragment key={step.n}>
              <div
                onClick={() => onGoToStep && onGoToStep(step.n)}
                className={cn(
                  "flex items-center gap-2 cursor-pointer transition-opacity select-none",
                  step.active
                    ? "opacity-100"
                    : "opacity-80 hover:opacity-100"
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-black shadow-xs",
                    step.active
                      ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950"
                      : step.done
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  {step.done ? "✓" : step.n}
                </div>
                <div className="text-left">
                  <span
                    className={cn(
                      "text-xs font-bold block leading-tight",
                      step.active
                        ? "text-blue-600 dark:text-blue-400 underline underline-offset-4 decoration-2"
                        : step.done
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>

              {idx < 6 && (
                <div className="flex-1 h-0.5 mx-2 bg-emerald-500 min-w-[20px]" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── SAVE STATUS NOTIFICATION BANNER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs font-semibold text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0">
            ✓
          </span>
          <span>All information has been saved successfully and is ready for final review.</span>
        </div>
        <div className="text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
          Last saved: {lastSavedText}
        </div>
      </div>

      {/* ── 4 SUMMARY CARDS (Top Row) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Branch Information */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Building2 className="h-4 w-4" />
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Branch Information
                </h3>
              </div>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection("branch_info")}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline uppercase cursor-pointer"
                >
                  EDIT
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Branch Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-right">{branchName || "—"}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Branch Code</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{branchCode || "—"}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Branch Type</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{branchType || displayTitle}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Category</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{category || "Own Operation"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Address / Location */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <MapPin className="h-4 w-4" />
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Address / Location
                </h3>
              </div>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection("location")}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline uppercase cursor-pointer"
                >
                  EDIT
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Country</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-right">{country || "—"}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">State / Province</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{stateProvince || "—"}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">City</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{city || "—"}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px] shrink-0">Full Address</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right truncate max-w-[170px]" title={fullAddress}>
                  {fullAddress || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Company / Account */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <Landmark className="h-4 w-4" />
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Company / Account
                </h3>
              </div>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection("company")}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline uppercase cursor-pointer"
                >
                  EDIT
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Company</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-right truncate max-w-[160px]" title={companyName}>
                  {companyName || "—"}
                </span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Business Domain</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{businessDomain}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Shipping Domain</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{shippingDomain}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Currency</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{currency || "—"}</span>
              </div>
              {branchLevel !== "country" && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-400 text-[11px]">Main Branch</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-right truncate max-w-[150px]">
                    {mainBranchName}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Documents */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <FileText className="h-4 w-4" />
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Documents
                </h3>
              </div>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection("documents")}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline uppercase cursor-pointer"
                >
                  EDIT
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Total Documents</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-right">{totalDocs}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Required Documents</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{requiredDocs}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Uploaded</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 text-right">{uploadedDocs}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 text-[11px]">Pending</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{pendingDocs}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditSection ? onEditSection("documents") : onGoToStep?.(6)}
              className="w-full text-xs font-bold h-8 gap-1.5 border-slate-200 dark:border-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>View Documents</span>
            </Button>
          </div>
        </div>

      </div>

      {/* ── FINAL COMPLETION CHECKLIST ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-5">
        
        {/* Checklist Header + Progress Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-black shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Final Completion Checklist
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify that all required items are completed before final approval.
              </p>
            </div>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="flex items-center gap-3 min-w-[240px]">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{completedCount} of {totalCount} Completed</span>
                <span className="text-emerald-600 dark:text-emerald-400">{completionPercentage}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column 20-Item Checklist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
          {evaluatedChecklist.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-dashed border-slate-100 dark:border-slate-900"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 shrink-0">
                  {item.id}
                </span>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {item.title}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Completed</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Pending</span>
                    </span>
                    {onGoToStep && (
                      <button
                        type="button"
                        onClick={() => onGoToStep(item.stepNumber)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-0.5 ml-1 cursor-pointer"
                      >
                        <span>Go to step</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── PERMISSIONS & ROLE VERIFICATION (Scrollable Area) ── */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Assigned Users & Permissions Review
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Verify user administrative roles, operational domains, permission groups, and ledger visibility before activation.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {userPermsList.length} Assigned {userPermsList.length === 1 ? "User" : "Users"}
            </span>
          </div>

          {/* Scrollable Permissions Table */}
          <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-3">User Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Operational Domain</th>
                  <th className="py-2.5 px-3">Country Scope</th>
                  <th className="py-2.5 px-3">Branch Scope</th>
                  <th className="py-2.5 px-3">Permission Group</th>
                  <th className="py-2.5 px-3">Ledger Visibility</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {userPermsList.map((user) => (
                  <tr key={user.id} className="hover:bg-white dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                      {user.userName}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {user.role}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {user.operationalDomain}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {user.countryScope}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {user.branchScope}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium">
                      {user.permissionGroup}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {user.ledgerVisibility}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {user.status === "Active" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300" title={user.statusReason}>
                          <AlertTriangle className="h-2.5 w-2.5" />
                          <span>{user.status}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── MISSING ITEMS SUMMARY (Warning Banner) ── */}
      {missingItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/20 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white font-black shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-200 leading-tight">
                Missing Items Summary
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {missingItems.length} {missingItems.length === 1 ? "item still requires" : "items still require"} attention before approval.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 w-full md:w-auto">
            {missingItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {item.title}
                </span>
                {onGoToStep && (
                  <button
                    type="button"
                    onClick={() => onGoToStep(item.stepNumber)}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-800 dark:text-blue-300 hover:underline flex items-center gap-0.5 ml-1 cursor-pointer"
                  >
                    <span>Go to step</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FINAL APPROVAL ACTIONS ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-4">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-black shadow-xs">
              <Settings2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Final Approval Actions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add an optional note and choose an action to complete the branch setup.
              </p>
            </div>
          </div>

          {/* Optional Note Textarea */}
          <div className="w-full md:w-1/2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Approval Note (Optional)
            </label>
            <textarea
              rows={2}
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder="Add any comments, notes or instructions for this approval..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          
          {/* Action 1: Approve & Activate Branch */}
          <div className="flex flex-col">
            <Button
              type="button"
              disabled={!isApprovalReady || isSubmitting || isSaving}
              onClick={handleApprove}
              className={cn(
                "h-12 w-full font-bold text-xs gap-2 rounded-xl text-white shadow-xs cursor-pointer",
                isApprovalReady
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>✓ Approve & Activate Branch</span>
            </Button>
            <span className="text-[10px] text-center text-slate-400 mt-1.5">
              {isApprovalReady
                ? "Finalize and make this branch active in the system"
                : "Cannot activate until all required checklist items pass"}
            </span>
          </div>

          {/* Action 2: Send Back for Edit */}
          <div className="flex flex-col">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isSaving}
              onClick={() => onSendBackForEdit && onSendBackForEdit(approvalNote)}
              className="h-12 w-full font-bold text-xs gap-2 rounded-xl border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 cursor-pointer"
            >
              <span>✏️ Send Back for Edit</span>
            </Button>
            <span className="text-[10px] text-center text-slate-400 mt-1.5">
              Return to previous step for modification
            </span>
          </div>

          {/* Action 3: Request Changes */}
          <div className="flex flex-col">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isSaving}
              onClick={() => onRequestChanges && onRequestChanges(approvalNote)}
              className="h-12 w-full font-bold text-xs gap-2 rounded-xl border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 cursor-pointer"
            >
              <span>⚠️ Request Changes</span>
            </Button>
            <span className="text-[10px] text-center text-slate-400 mt-1.5">
              Send for changes with comments
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
