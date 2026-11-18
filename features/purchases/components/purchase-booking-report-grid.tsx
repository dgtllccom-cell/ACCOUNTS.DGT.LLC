"use client";

import React from "react";
import {
  Building2,
  User,
  Eye,
  ShieldCheck,
  MapPin,
  Calendar,
  Layers,
  FileText
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/ui";

export interface PurchaseBookingReportData {
  // Branch Info
  branchName?: string;
  branchCode?: string;
  branchType?: string;
  parentBranch?: string;
  branchAddress?: string;
  branchCity?: string;
  branchState?: string;
  branchCountry?: string;
  branchPostalCode?: string;
  branchPhone?: string;
  branchEmail?: string;
  branchEstablishedDate?: string;
  branchStatus?: string;

  // User Info
  userName?: string;
  userCode?: string;
  userRole?: string;
  userDepartment?: string;
  userEmail?: string;
  userPhone?: string;
  userStatus?: string;
  userJoiningDate?: string;
  userPasswordExpiry?: string;
  userLastLogin?: string;
  userLanguage?: string;

  // Bill Info
  bookingDate?: string;
  fiscalYear?: string;
  bookingBranch?: string;
  status?: string;
  systemSerialNo?: string;
  countrySerialNo?: string;
  superAdminSerialNo?: string;
  branchSerialNo?: string;
  billContractNo?: string;
  paymentType?: string;
  shipType?: string;
  loadingMode?: string;
  originCountry?: string;

  // Purchase Account
  purchaseAccountName?: string;
  purchaseAccountCode?: string;
  purchaseCompanyName?: string;
  purchaseBusinessName?: string;
  purchaseBranch?: string;
  purchaseCountry?: string;
  purchaseCity?: string;

  // Sales Account
  salesAccountName?: string;
  salesAccountCode?: string;
  salesCompanyName?: string;
  salesBusinessName?: string;
  salesBranch?: string;
  salesCountry?: string;
  salesCity?: string;

  onViewPurchaseAccount?: () => void;
  onViewSalesAccount?: () => void;
}

export function PurchaseBookingReportGrid({
  data = {},
  isCompact = false,
  className = "",
  fullWidth = false,
}: {
  data?: Partial<PurchaseBookingReportData>;
  isCompact?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  // Card 1 Defaults
  const branchName = data.branchName || "—";
  const branchCode = data.branchCode || "—";
  const branchType = data.branchType || "—";
  const parentBranch = data.parentBranch || "—";
  const branchCountry = data.branchCountry || "—";
  const branchCity = data.branchCity || "—";

  const userName = data.userName || "—";
  const userRole = data.userRole || "—";
  const userStatus = data.userStatus || "—";

  // Card 2 Defaults
  const bookingDate = data.bookingDate || "—";
  const fiscalYear = data.fiscalYear || "—";
  const bookingBranch = data.bookingBranch || "—";
  const status = data.status || "—";
  const systemSerialNo = data.systemSerialNo || "—";
  const countrySerialNo = data.countrySerialNo || "—";
  const superAdminSerialNo = data.superAdminSerialNo || "—";
  const branchSerialNo = data.branchSerialNo || "—";
  const billContractNo = data.billContractNo || "—";
  const paymentType = data.paymentType || "—";
  const shipType = data.shipType || "—";
  const loadingMode = data.loadingMode || "—";
  const originCountry = data.originCountry || "—";

  // Card 3 Defaults
  const purchaseAccountName = data.purchaseAccountName || "—";
  const purchaseAccountCode = data.purchaseAccountCode || "—";
  const purchaseCompanyName = data.purchaseCompanyName || "—";
  const purchaseBusinessName = data.purchaseBusinessName || "—";
  const purchaseCountry = data.purchaseCountry || "—";
  const purchaseCity = data.purchaseCity || "—";
  const purchaseBranch = data.purchaseBranch || "—";

  // Card 4 Defaults
  const salesAccountName = data.salesAccountName || "—";
  const salesAccountCode = data.salesAccountCode || "—";
  const salesCompanyName = data.salesCompanyName || "—";
  const salesBusinessName = data.salesBusinessName || "—";
  const salesCountry = data.salesCountry || "—";
  const salesCity = data.salesCity || "—";
  const salesBranch = data.salesBranch || "—";

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className={`w-full ${className}`}>
      <div
        className={cn(
          "grid gap-3.5 items-stretch w-full",
          // Do not squeeze four rich account panels into a narrow wizard
          // right column. Only use four columns in the wider final report.
          fullWidth
            ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-4"
            : "grid-cols-1 md:grid-cols-2"
        )}
      >
        {/* ================= CARD 1: BRANCH & USER INFORMATION ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-3 hover:shadow-xs transition-shadow flex flex-col">
          <div>
            {/* Card Header */}
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <span className="grid h-5 w-5 place-items-center rounded bg-blue-600 text-white font-black text-xs shadow-2xs">
                1
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {t(lang, "pbr.branch_user_info", "Branch & User Information")}
              </h3>
            </div>

            {/* Branch Details */}
            <div className="space-y-1.5 text-xs pt-2">
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.branch_name", "Branch Name")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-end text-xs break-words min-w-0">{branchName}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.branch_code", "Branch Code")}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-end text-xs break-words min-w-0">{branchCode}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.branch_type", "Branch Type")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{branchType}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.parent_branch", "Parent Branch")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{parentBranch}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.country", "Country")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{branchCountry}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.city", "City")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{branchCity}</span>
              </div>
            </div>
          </div>

          {/* User Details (Bottom strip) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between items-center gap-2 py-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 uppercase tracking-wide">
                <User className="h-3 w-3 text-blue-500" />
                {t(lang, "pbr.user_name", "User Name")}
              </span>
              <span className="font-bold uppercase text-slate-900 dark:text-slate-100 text-end text-xs break-words min-w-0">{userName}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 uppercase tracking-wide">
                <ShieldCheck className="h-3 w-3 text-blue-500" />
                {t(lang, "pbr.role", "Role")}
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{userRole}</span>
            </div>
            <div className="flex justify-end pt-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
                {userStatus}
              </span>
            </div>
          </div>
        </div>

        {/* ================= CARD 2: BILL DETAILS ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-3 hover:shadow-xs transition-shadow">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded bg-emerald-600 text-white font-black text-xs shadow-2xs">
                2
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {t(lang, "pbr.bill_details", "Bill Details")}
              </h3>
            </div>
            <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap">
              {status}
            </span>
          </div>

          {/* Key-Values */}
          <div className="space-y-1.5 text-xs pt-2">
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.booking_date", "Booking Date")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-end text-xs break-words min-w-0">{bookingDate}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.fiscal_year", "Fiscal Year")}</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{fiscalYear}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.booking_branch", "Booking Branch")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{bookingBranch}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.system_serial_no", "System Serial No.")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-end text-xs break-words min-w-0">{systemSerialNo}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.country_serial_no", "Country Serial No.")}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-end text-xs break-words min-w-0">{countrySerialNo}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.super_admin_serial_no", "Super Admin Serial No.")}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-end text-xs break-words min-w-0">{superAdminSerialNo}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.branch_serial_no", "Branch Serial No.")}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-end text-xs break-words min-w-0">{branchSerialNo}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.bill_contract_no", "Bill / Contract No.")}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-end text-xs break-words min-w-0">{billContractNo}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.payment_type", "Payment Type")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{paymentType}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.ship_type", "Ship Type")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{shipType}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.loading_mode", "Loading Mode")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{loadingMode}</span>
            </div>
            <div className="flex justify-between items-center gap-2 pt-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.origin_country", "Origin Country")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-end text-xs break-words min-w-0">{originCountry}</span>
            </div>
          </div>
        </div>

        {/* ================= CARD 3: PURCHASE ACCOUNT DETAILS ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-3 hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded bg-purple-600 text-white font-black text-xs shadow-2xs">
                  3
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  {t(lang, "pbr.purchase_account_details", "Purchase Account Details")}
                </h3>
              </div>
            </div>

            {/* Key Info */}
            <div className="space-y-1.5 text-xs pt-2">
              <div className="pb-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wide mb-0.5">{t(lang, "pbr.account_name", "Account Name")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 leading-snug block text-end text-xs break-words min-w-0">
                  {purchaseAccountName}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.account_code", "Account Code")}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-end text-xs break-words min-w-0">{purchaseAccountCode}</span>
              </div>
              <div className="pb-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wide mb-0.5">{t(lang, "pbr.company", "Company")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug block text-end text-xs break-words min-w-0">
                  {purchaseCompanyName}
                </span>
              </div>
              <div className="pb-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wide mb-0.5">{t(lang, "pbr.business_name", "Business Name")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug block text-end text-xs break-words min-w-0">
                  {purchaseBusinessName}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.country", "Country")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{purchaseCountry}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.city", "City")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{purchaseCity}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-0.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.branch", "Branch")}</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{purchaseBranch}</span>
              </div>
            </div>
          </div>

          {/* Bottom Button */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={data.onViewPurchaseAccount}
              disabled={!data.onViewPurchaseAccount}
              className="disabled:cursor-not-allowed disabled:opacity-50 w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              <span>{t(lang, "pbr.view_account_details", "View Account Details")}</span>
            </button>
          </div>
        </div>

        {/* ================= CARD 4: SALES ACCOUNT DETAILS ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-3 hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded bg-amber-500 text-white font-black text-xs shadow-2xs">
                  4
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  {t(lang, "pbr.sales_account_details", "Sales Account Details")}
                </h3>
              </div>
            </div>

            {/* Key Info */}
            <div className="space-y-1.5 text-xs pt-2">
              <div className="pb-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wide mb-0.5">{t(lang, "pbr.account_name", "Account Name")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 leading-snug block text-end text-xs break-words min-w-0">
                  {salesAccountName}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.account_code", "Account Code")}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-end text-xs break-words min-w-0">{salesAccountCode}</span>
              </div>
              <div className="pb-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wide mb-0.5">{t(lang, "pbr.company", "Company")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug block text-end text-xs break-words min-w-0">
                  {salesCompanyName}
                </span>
              </div>
              <div className="pb-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wide mb-0.5">{t(lang, "pbr.business_name", "Business Name")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug block text-end text-xs break-words min-w-0">
                  {salesBusinessName}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.country", "Country")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{salesCountry}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.city", "City")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{salesCity}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-0.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t(lang, "pbr.branch", "Branch")}</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-end text-xs break-words min-w-0">{salesBranch}</span>
              </div>
            </div>
          </div>

          {/* Bottom Button */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={data.onViewSalesAccount}
              disabled={!data.onViewSalesAccount}
              className="disabled:cursor-not-allowed disabled:opacity-50 w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              <span>{t(lang, "pbr.view_account_details", "View Account Details")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
