"use client";

import { useMemo } from "react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import {
  FileText,
  User,
  Building2,
  Landmark,
  Package,
  Clock,
  CheckCircle2,
  FolderPlus
} from "lucide-react";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";
import { getLabel } from "./translations";

export type AccountLiveReportProps = {
  // Wizard States
  accountName: string;
  accountCode: string;
  accountTitle: string;
  subType: string;
  category: string;
  manualReferenceNumber?: string;
  currency: string;
  status?: string;
  lang?: SupportedLanguage;
  contacts?: Array<{ type: string; value: string }>;

  // Connected Master details
  customerDetail?: any;
  companyDetail?: any;
  bankDetail?: any;
  warehouseDetail?: any;
  shippingLineDetail?: any;
  linkedCountries?: string[];
  countriesList?: Array<{ id: string; name: string; iso2?: string | null }>;

  // Context metadata
  selectedCountryName?: string;
  selectedCountryCode?: string;
  selectedBranchName?: string;
  selectedBranchCode?: string;

  // Step navigation callbacks
  onEditStep?: (step: number) => void;

  // Audit Info
  auditCreatedBy?: string;
  auditCreatedOn?: string;
  auditLastModifiedBy?: string;
  auditLastModifiedOn?: string;

  // Actions
  onBack?: () => void;
  onPrint?: () => void;
  onPdf?: () => void;
  onExcel?: () => void;
  onEmail?: () => void;
  onWhatsApp?: () => void;
};

export function AccountLiveReportPanel({
  accountName,
  accountCode,
  accountTitle,
  subType,
  category,
  manualReferenceNumber,
  currency,
  status = "In Progress",
  lang = "en",
  contacts,
  customerDetail,
  companyDetail,
  bankDetail,
  warehouseDetail,
  selectedCountryName,
  selectedBranchName,
  onEditStep,
  auditCreatedBy = "Super Admin",
  auditCreatedOn,
  auditLastModifiedBy,
  auditLastModifiedOn
}: AccountLiveReportProps) {
  const trName = (val: string | null | undefined) => (val ? transliterateProperNoun(val, lang) : "-");
  const trTerm = (val: string | null | undefined) => (val ? localizeTerm(val, lang) : "-");

  const now = useMemo(() => new Date(), []);
  const defaultCreatedOn = useMemo(
    () =>
      now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      ", " +
      now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    [now]
  );

  const displayCreatedOn = auditCreatedOn || defaultCreatedOn;

  // Contact resolution
  const primaryPhone =
    contacts?.find((c) => c.type?.toLowerCase().includes("mobile") || c.type?.toLowerCase().includes("phone"))?.value ||
    customerDetail?.mobile ||
    customerDetail?.phone ||
    companyDetail?.phone ||
    "-";

  const primaryEmail =
    contacts?.find((c) => c.type?.toLowerCase().includes("email"))?.value ||
    customerDetail?.email ||
    companyDetail?.email ||
    "-";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs">
            <FolderPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {getLabel("liveSummaryTitle", lang)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {getLabel("liveSummarySubtitle", lang)}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {getLabel("inProgress", lang)}
        </span>
      </div>

      {/* ── 6 Cards Structured Grid ── */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Account Information */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <User className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {getLabel("step1Label", lang)}
              </h3>
            </div>
            {onEditStep && (
              <button
                type="button"
                onClick={() => onEditStep(1)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
              >
                {getLabel("edit", lang)}
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("accountCode", lang)}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{accountCode || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("accountName", lang)}</span>
              <span className="font-bold text-slate-900 dark:text-white max-w-[150px] truncate">{trName(accountName) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("accountType", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{trTerm(accountTitle) || "Customer"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("subType", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{trTerm(subType) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("category", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{trTerm(category) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("country", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{trTerm(selectedCountryName) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("branch", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">{trName(selectedBranchName) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("referenceNo", lang)}</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{manualReferenceNumber || "-"}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Customer Information */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <User className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {getLabel("customerInformation", lang)}
              </h3>
            </div>
            {onEditStep && (
              <button
                type="button"
                onClick={() => onEditStep(2)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
              >
                {getLabel("edit", lang)}
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("customerName", lang)}</span>
              <span className="font-bold text-slate-900 dark:text-white max-w-[150px] truncate">{trName(customerDetail?.customer_name) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("customerType", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{trTerm(customerDetail?.gender || subType) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("industry", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{trTerm(customerDetail?.industry) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("contactPerson", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">{trName(customerDetail?.contact_person) || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("phone", lang)}</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{primaryPhone || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("email", lang)}</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 max-w-[150px] truncate">{primaryEmail || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("address", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">{customerDetail?.address || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("taxNumber", lang)}</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{customerDetail?.tax_number || "-"}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Company Details */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {getLabel("step3Label", lang)}
              </h3>
            </div>
            {onEditStep && (
              <button
                type="button"
                onClick={() => onEditStep(3)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
              >
                {getLabel("edit", lang)}
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("companyName", lang)}</span>
              <span className="font-bold text-slate-900 dark:text-white max-w-[150px] truncate">
                {trName(companyDetail?.companyName || companyDetail?.name || companyDetail?.legal_name) || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("registrationNo", lang)}</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {companyDetail?.registration_no || companyDetail?.registration_number || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("businessType", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {trTerm(companyDetail?.company_type) || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("industry", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {trTerm(companyDetail?.industry) || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("registeredAddress", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">
                {companyDetail?.address || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("branch", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">
                {trName(companyDetail?.city_name || selectedBranchName) || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Bank Details */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Landmark className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {getLabel("step4Label", lang)}
              </h3>
            </div>
            {onEditStep && (
              <button
                type="button"
                onClick={() => onEditStep(4)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
              >
                {getLabel("edit", lang)}
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("bankName", lang)}</span>
              <span className="font-bold text-slate-900 dark:text-white max-w-[150px] truncate">
                {trName(bankDetail?.bank_name || bankDetail?.bankName || bankDetail?.name) || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("accountTitle", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">
                {trName(bankDetail?.account_title || accountName) || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("accountNumber", lang)}</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {bankDetail?.account_number || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("iban", lang)}</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 max-w-[150px] truncate">
                {bankDetail?.iban_number || bankDetail?.iban || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("bankBranch", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">
                {trName(bankDetail?.branch_name || selectedBranchName) || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("swiftCode", lang)}</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {bankDetail?.swift_bic || bankDetail?.swift_code || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Warehouse Details */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Package className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {getLabel("warehouseDetails", lang)}
              </h3>
            </div>
            {onEditStep && (
              <button
                type="button"
                onClick={() => onEditStep(5)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
              >
                {getLabel("edit", lang)}
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("warehouse", lang)}</span>
              <span className="font-bold text-slate-900 dark:text-white max-w-[150px] truncate">
                {warehouseDetail?.warehouse_name || warehouseDetail?.name || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("location", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">
                {warehouseDetail?.city_name || warehouseDetail?.location || warehouseDetail?.full_address || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("defaultStock", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {warehouseDetail?.is_default ? "Yes" : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("remarks", lang)}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 max-w-[150px] truncate">
                {warehouseDetail?.description || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 6: Audit Information */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {getLabel("auditInformation", lang)}
              </h3>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("createdBy", lang)}</span>
              <span className="font-medium text-slate-900 dark:text-white">{auditCreatedBy}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("createdOn", lang)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{displayCreatedOn}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("lastModifiedBy", lang)}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{auditLastModifiedBy || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("lastModifiedOn", lang)}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{auditLastModifiedOn || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-500 dark:text-slate-400">{getLabel("status", lang)}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                {getLabel("inProgress", lang)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
