"use client";

import React from "react";
import {
  Building2,
  User,
  FileText,
  CreditCard,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Globe2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Layers,
  Landmark,
  BadgePercent,
  Compass
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
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

  // Payment Details
  paymentTerms?: string;
  paymentMethod?: string;
  paymentCurrency?: string;

  // Shipping Details
  shippingMode?: string;
  shippingLine?: string;
  loadingPort?: string;
  receivingPort?: string;
  containerInfo?: string;

  // Purchase Account
  purchaseAccountName?: string;
  purchaseAccountCode?: string;
  purchaseTotalCredit?: string | number;
  purchaseTotalDebit?: string | number;
  purchaseBalance?: string | number;
  purchaseCompanyName?: string;
  purchaseBranch?: string;
  purchaseCountry?: string;
  purchaseCompanyCode?: string;
  purchaseLegalType?: string;
  purchaseLicenseNo?: string;
  purchaseTaxRegNo?: string;
  purchaseVatRegNo?: string;
  purchaseCompanyEstDate?: string;
  purchaseCompanyEmail?: string;
  purchaseCompanyPhone?: string;
  purchaseCompanyWebsite?: string;
  purchaseCompanyAddress?: string;
  purchaseBankName?: string;
  purchaseBankAccountName?: string;
  purchaseBankAccountNo?: string;
  purchaseIban?: string;
  purchaseSwiftCode?: string;
  purchaseCurrencyLabel?: string;
  purchaseCurrencyCode?: string;

  // Sales Account
  salesAccountName?: string;
  salesAccountCode?: string;
  salesTotalCredit?: string | number;
  salesTotalDebit?: string | number;
  salesBalance?: string | number;
  salesCompanyName?: string;
  salesBranch?: string;
  salesCountry?: string;
  salesCompanyCode?: string;
  salesLegalType?: string;
  salesLicenseNo?: string;
  salesTaxRegNo?: string;
  salesVatRegNo?: string;
  salesCompanyEstDate?: string;
  salesCompanyEmail?: string;
  salesCompanyPhone?: string;
  salesCompanyWebsite?: string;
  salesCompanyAddress?: string;
  salesBankName?: string;
  salesBankAccountName?: string;
  salesBankAccountNo?: string;
  salesIban?: string;
  salesSwiftCode?: string;
  salesCurrencyLabel?: string;
  salesCurrencyCode?: string;
}

export function PurchaseBookingReportGrid({
  data = {},
  isCompact = false,
  className = ""
}: {
  data?: Partial<PurchaseBookingReportData>;
  isCompact?: boolean;
  className?: string;
}) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  // Defaults aligned with the complete report blueprint
  const branchName = data.branchName || "Dubai Main Branch";
  const branchCode = data.branchCode || "BR-DXB-001";
  const branchType = data.branchType || "Main Branch";
  const parentBranch = data.parentBranch || "Global System";
  const branchAddress = data.branchAddress || "Office No. 05, 3rd Floor, Al Saqr Business Tower, Sheikh Zayed Road, Dubai, United Arab Emirates";
  const branchCity = data.branchCity || "Dubai";
  const branchState = data.branchState || "Dubai";
  const branchCountry = data.branchCountry || "United Arab Emirates";
  const branchPostalCode = data.branchPostalCode || "00000";
  const branchPhone = data.branchPhone || "+971 4 123 4567";
  const branchEmail = data.branchEmail || "dubai.branch@dgt.llc";
  const branchEstablishedDate = data.branchEstablishedDate || "2015-03-15";
  const branchStatus = data.branchStatus || "Active";

  const userName = data.userName || "Admin User";
  const userCode = data.userCode || "SA-0001";
  const userRole = data.userRole || "Super Admin";
  const userDepartment = data.userDepartment || "Administration";
  const userEmail = data.userEmail || "admin@dgt.llc";
  const userPhone = data.userPhone || "+971 50 123 4567";
  const userStatus = data.userStatus || "Active";
  const userJoiningDate = data.userJoiningDate || "—";
  const userPasswordExpiry = data.userPasswordExpiry || "—";
  const userLastLogin = data.userLastLogin || (data.bookingDate ? `${data.bookingDate} 10:25 AM English` : "—");

  const bookingDate = data.bookingDate || "—";
  const fiscalYear = data.fiscalYear || "—";
  const bookingBranch = data.bookingBranch || "—";
  const status = data.status || "DRAFT";
  const systemSerialNo = data.systemSerialNo || "—";
  const countrySerialNo = data.countrySerialNo || "—";
  const superAdminSerialNo = data.superAdminSerialNo || "—";
  const branchSerialNo = data.branchSerialNo || "—";
  const billContractNo = data.billContractNo || "—";
  const paymentType = data.paymentType || "—";
  const shipType = data.shipType || "—";
  const loadingMode = data.loadingMode || "—";
  const originCountry = data.originCountry || "—";

  const paymentTerms = data.paymentTerms || "—";
  const paymentMethod = data.paymentMethod || "—";
  const paymentCurrency = data.paymentCurrency || "—";

  const shippingMode = data.shippingMode || "—";
  const shippingLine = data.shippingLine || "—";
  const loadingPort = data.loadingPort || "—";
  const receivingPort = data.receivingPort || "—";
  const containerInfo = data.containerInfo || "—";

  // Purchase Account
  const purchaseAccountName = data.purchaseAccountName || "—";
  const purchaseAccountCode = data.purchaseAccountCode || "—";
  const purchaseTotalCredit = data.purchaseTotalCredit !== undefined && data.purchaseTotalCredit !== "" ? (typeof data.purchaseTotalCredit === "number" ? data.purchaseTotalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.purchaseTotalCredit) : "0.00";
  const purchaseTotalDebit = data.purchaseTotalDebit !== undefined && data.purchaseTotalDebit !== "" ? (typeof data.purchaseTotalDebit === "number" ? data.purchaseTotalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.purchaseTotalDebit) : "0.00";
  const purchaseBalance = data.purchaseBalance !== undefined && data.purchaseBalance !== "" ? (typeof data.purchaseBalance === "number" ? data.purchaseBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.purchaseBalance) : "0.00";
  const purchaseCompanyName = data.purchaseCompanyName || "—";
  const purchaseBranch = data.purchaseBranch || "—";
  const purchaseCountry = data.purchaseCountry || "—";
  const purchaseCompanyCode = data.purchaseCompanyCode || "—";
  const purchaseLegalType = data.purchaseLegalType || "—";
  const purchaseLicenseNo = data.purchaseLicenseNo || "—";
  const purchaseTaxRegNo = data.purchaseTaxRegNo || "—";
  const purchaseVatRegNo = data.purchaseVatRegNo || "—";
  const purchaseCompanyEstDate = data.purchaseCompanyEstDate || "—";
  const purchaseCompanyEmail = data.purchaseCompanyEmail || "—";
  const purchaseCompanyPhone = data.purchaseCompanyPhone || "—";
  const purchaseCompanyWebsite = data.purchaseCompanyWebsite || "—";
  const purchaseCompanyAddress = data.purchaseCompanyAddress || "—";
  const purchaseBankName = data.purchaseBankName || "—";
  const purchaseBankAccountName = data.purchaseBankAccountName || "—";
  const purchaseBankAccountNo = data.purchaseBankAccountNo || "—";
  const purchaseIban = data.purchaseIban || "—";
  const purchaseSwiftCode = data.purchaseSwiftCode || "—";
  const userLanguage = data.userLanguage || "English";
  const purchaseCurrencyLabel = data.purchaseCurrencyLabel || "—";
  const purchaseCurrencyCode = data.purchaseCurrencyCode || (data.purchaseCurrencyLabel ? data.purchaseCurrencyLabel.split(" ")[0] : "");

  // Sales Account
  const salesAccountName = data.salesAccountName || "—";
  const salesAccountCode = data.salesAccountCode || "—";
  const salesTotalCredit = data.salesTotalCredit !== undefined && data.salesTotalCredit !== "" ? (typeof data.salesTotalCredit === "number" ? data.salesTotalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.salesTotalCredit) : "0.00";
  const salesTotalDebit = data.salesTotalDebit !== undefined && data.salesTotalDebit !== "" ? (typeof data.salesTotalDebit === "number" ? data.salesTotalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.salesTotalDebit) : "0.00";
  const salesBalance = data.salesBalance !== undefined && data.salesBalance !== "" ? (typeof data.salesBalance === "number" ? data.salesBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.salesBalance) : "0.00";
  const salesCompanyName = data.salesCompanyName || "—";
  const salesBranch = data.salesBranch || "—";
  const salesCountry = data.salesCountry || "—";
  const salesCompanyCode = data.salesCompanyCode || "—";
  const salesLegalType = data.salesLegalType || "—";
  const salesLicenseNo = data.salesLicenseNo || "—";
  const salesTaxRegNo = data.salesTaxRegNo || "—";
  const salesVatRegNo = data.salesVatRegNo || "—";
  const salesCompanyEstDate = data.salesCompanyEstDate || "—";
  const salesCompanyEmail = data.salesCompanyEmail || "—";
  const salesCompanyPhone = data.salesCompanyPhone || "—";
  const salesCompanyWebsite = data.salesCompanyWebsite || "—";
  const salesCompanyAddress = data.salesCompanyAddress || "—";
  const salesBankName = data.salesBankName || "—";
  const salesBankAccountName = data.salesBankAccountName || "—";
  const salesBankAccountNo = data.salesBankAccountNo || "—";
  const salesIban = data.salesIban || "—";
  const salesSwiftCode = data.salesSwiftCode || "—";
  const salesCurrencyLabel = data.salesCurrencyLabel || "—";
  const salesCurrencyCode = data.salesCurrencyCode || (data.salesCurrencyLabel ? data.salesCurrencyLabel.split(" ")[0] : "");
  const showExtendedDetails = !isCompact;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className={`w-full ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        
        {/* ================= CARD 1: BRANCH & USER INFORMATION ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
          {/* Card Header */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <span className="grid h-5 w-5 place-items-center rounded bg-blue-600 text-white font-black text-xs">
              1
            </span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
              {t(lang, "pbr.branch_user_info", "BRANCH & USER INFORMATION")}
            </h3>
          </div>

          {/* Section 1.1: Branch Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Building2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {t(lang, "pbr.branch_details_booking", "BRANCH DETAILS (Booking Branch)")}
              </span>
            </div>

            <div className="space-y-1 text-[10.5px]">
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.branch_name", "BRANCH NAME")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-right">{branchName}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.branch_code", "BRANCH CODE")}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-right">{branchCode}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.branch_type", "BRANCH TYPE")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{branchType}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.parent_branch", "PARENT BRANCH")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{parentBranch}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.city", "CITY")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{branchCity}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.country", "COUNTRY")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{branchCountry}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-1">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.status", "STATUS")}</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  {branchStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1.2: User Details (Compact) */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <User className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {t(lang, "pbr.user_details_booking", "USER DETAILS (Booking User)")}
              </span>
            </div>

            <div className="space-y-1 text-[10.5px]">
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.user_name", "USER NAME")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-right">{userName}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.user_code", "USER CODE")}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-right">{userCode}</span>
              </div>
              <div className="flex justify-between items-start gap-2 pt-0.5">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.role", "ROLE")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{userRole}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= CARD 2: BILL DETAILS ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
          {/* Card Header */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <span className="grid h-5 w-5 place-items-center rounded bg-blue-600 text-white font-black text-xs">
              2
            </span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
              {t(lang, "pbr.bill_details", "BILL DETAILS")}
            </h3>
          </div>

          {/* Top Key-Values */}
          <div className="space-y-1 text-[10.5px]">
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.booking_date", "BOOKING DATE")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-right">{bookingDate}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.fiscal_year", "FISCAL YEAR")}</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-right">{fiscalYear}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.booking_branch", "BOOKING BRANCH")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-right">{bookingBranch}</span>
            </div>
            <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.status", "STATUS")}</span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                {status}
              </span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.system_serial_no", "SYSTEM SERIAL NO.")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-right">{systemSerialNo}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.country_serial_no", "COUNTRY SERIAL NO.")}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-right">{countrySerialNo}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.super_admin_serial_no", "SUPER ADMIN SERIAL NO.")}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-right">{superAdminSerialNo}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.branch_serial_no", "BRANCH SERIAL NO.")}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-right">{branchSerialNo}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.bill_contract_no", "BILL / CONTRACT NO.")}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-right">{billContractNo}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.payment_type", "PAYMENT TYPE")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{paymentType}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.ship_type", "SHIP TYPE")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{shipType}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.loading_mode", "LOADING MODE")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{loadingMode}</span>
            </div>
            <div className="flex justify-between items-start gap-2 pt-0.5">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.origin_country", "ORIGIN COUNTRY")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-right">{originCountry}</span>
            </div>
          </div>

          {/* Card 2 is kept compact and aligned with adjacent cards */}
        </div>

        {/* ================= CARD 3: PURCHASE ACCOUNT DETAILS ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
          {/* Card Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded bg-blue-600 text-white font-black text-xs">
                3
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                {t(lang, "pbr.purchase_account_details", "PURCHASE ACCOUNT DETAILS")}
              </h3>
            </div>
            <span className="text-[9px] font-mono font-black text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
              {purchaseAccountCode}
            </span>
          </div>

          {/* Account Key Info */}
          <div className="space-y-1 text-[10.5px]">
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.account_name", "ACCOUNT NAME")}</span>
              <span className="font-black text-blue-600 dark:text-blue-400 text-right truncate max-w-[160px]" title={purchaseAccountName}>{purchaseAccountName}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.account_code", "ACCOUNT CODE")}</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-right">{purchaseAccountCode}</span>
            </div>
          </div>

          {/* Financial KPI 3-Box Strip */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-50/80 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
            <div>
              <span className="block text-[8px] font-black uppercase text-emerald-700 dark:text-emerald-400">{t(lang, "pbr.total_credit", "TOTAL CREDIT")} ({purchaseCurrencyCode})</span>
              <span className="block text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{purchaseTotalCredit}</span>
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-rose-700 dark:text-rose-400">{t(lang, "pbr.total_debit", "TOTAL DEBIT")} ({purchaseCurrencyCode})</span>
              <span className="block text-[11px] font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">{purchaseTotalDebit}</span>
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-blue-700 dark:text-blue-400">{t(lang, "pbr.balance", "BALANCE")} ({purchaseCurrencyCode})</span>
              <span className="block text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">{purchaseBalance}</span>
            </div>
          </div>

          {/* 3 Columns Sub-Strip */}
          <div className="grid grid-cols-3 gap-1 text-[9.5px] border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <span className="block text-[8px] font-bold uppercase text-slate-400">{t(lang, "pbr.company", "COMPANY")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block" title={purchaseCompanyName}>{purchaseCompanyName}</span>
            </div>
            <div>
              <span className="block text-[8px] font-bold uppercase text-slate-400">{t(lang, "pbr.branch", "BRANCH")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block" title={purchaseBranch}>{purchaseBranch}</span>
            </div>
            <div>
              <span className="block text-[8px] font-bold uppercase text-slate-400">{t(lang, "pbr.country", "COUNTRY")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block" title={purchaseCountry}>{purchaseCountry}</span>
            </div>
          </div>

          {showExtendedDetails && (
            /* Section 3.1: Company Complete Details */
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {t(lang, "pbr.company_complete_details", "COMPANY COMPLETE DETAILS")}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                {/* Left Column */}
                <div className="space-y-1">
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.company_code", "COMPANY CODE")}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{purchaseCompanyCode}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.legal_type", "LEGAL TYPE")}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{purchaseLegalType}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.license_no", "LICENSE NO.")}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{purchaseLicenseNo}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.tax_reg_no", "TAX REGISTRATION NO.")}</span>
                    <span className="font-mono text-[9px] text-slate-800 dark:text-slate-200 truncate block" title={purchaseTaxRegNo}>{purchaseTaxRegNo}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.vat_reg_no", "VAT REGISTRATION NO.")}</span>
                    <span className="font-mono text-[9px] text-slate-800 dark:text-slate-200 truncate block" title={purchaseVatRegNo}>{purchaseVatRegNo}</span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-1">
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.established_date", "ESTABLISHED DATE")}</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{purchaseCompanyEstDate}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.registered_address", "REGISTERED ADDRESS")}</span>
                    <span className="text-[9px] font-medium text-slate-700 dark:text-slate-300 leading-snug block">{purchaseCompanyAddress}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.registered_email", "REGISTERED EMAIL")}</span>
                    <span className="font-mono text-[9px] text-blue-600 dark:text-blue-400 truncate block" title={purchaseCompanyEmail}>{purchaseCompanyEmail}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.phone_mobile", "PHONE / MOBILE")}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{purchaseCompanyPhone}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.website", "WEBSITE")}</span>
                    <span className="font-mono text-[9px] text-blue-600 dark:text-blue-400 truncate block" title={purchaseCompanyWebsite}>{purchaseCompanyWebsite}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= CARD 4: SALES ACCOUNT DETAILS ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
          {/* Card Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded bg-blue-600 text-white font-black text-xs">
                4
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                {t(lang, "pbr.sales_account_details", "SALES ACCOUNT DETAILS")}
              </h3>
            </div>
            <span className="text-[9px] font-mono font-black text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
              {salesAccountCode}
            </span>
          </div>

          {/* Account Key Info */}
          <div className="space-y-1 text-[10.5px]">
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.account_name", "ACCOUNT NAME")}</span>
              <span className="font-black text-blue-600 dark:text-blue-400 text-right truncate max-w-[160px]" title={salesAccountName}>{salesAccountName}</span>
            </div>
            <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.account_code", "ACCOUNT CODE")}</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-right">{salesAccountCode}</span>
            </div>
          </div>

          {/* Financial KPI 3-Box Strip */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-50/80 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
            <div>
              <span className="block text-[8px] font-black uppercase text-emerald-700 dark:text-emerald-400">{t(lang, "pbr.total_credit", "TOTAL CREDIT")} ({salesCurrencyCode})</span>
              <span className="block text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{salesTotalCredit}</span>
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-rose-700 dark:text-rose-400">{t(lang, "pbr.total_debit", "TOTAL DEBIT")} ({salesCurrencyCode})</span>
              <span className="block text-[11px] font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">{salesTotalDebit}</span>
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-blue-700 dark:text-blue-400">{t(lang, "pbr.balance", "BALANCE")} ({salesCurrencyCode})</span>
              <span className="block text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">{salesBalance}</span>
            </div>
          </div>

          {/* 3 Columns Sub-Strip */}
          <div className="grid grid-cols-3 gap-1 text-[9.5px] border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <span className="block text-[8px] font-bold uppercase text-slate-400">{t(lang, "pbr.company", "COMPANY")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block" title={salesCompanyName}>{salesCompanyName}</span>
            </div>
            <div>
              <span className="block text-[8px] font-bold uppercase text-slate-400">{t(lang, "pbr.branch", "BRANCH")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block" title={salesBranch}>{salesBranch}</span>
            </div>
            <div>
              <span className="block text-[8px] font-bold uppercase text-slate-400">{t(lang, "pbr.country", "COUNTRY")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block" title={salesCountry}>{salesCountry}</span>
            </div>
          </div>

          {showExtendedDetails && (
            /* Section 4.1: Company Complete Details */
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {t(lang, "pbr.company_complete_details", "COMPANY COMPLETE DETAILS")}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                {/* Left Column */}
                <div className="space-y-1">
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.company_code", "COMPANY CODE")}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{salesCompanyCode}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.legal_type", "LEGAL TYPE")}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{salesLegalType}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.license_no", "LICENSE NO.")}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{salesLicenseNo}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.tax_reg_no", "TAX REGISTRATION NO.")}</span>
                    <span className="font-mono text-[9px] text-slate-800 dark:text-slate-200 truncate block" title={salesTaxRegNo}>{salesTaxRegNo}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.vat_reg_no", "VAT REGISTRATION NO.")}</span>
                    <span className="font-mono text-[9px] text-slate-800 dark:text-slate-200 truncate block" title={salesVatRegNo}>{salesVatRegNo}</span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-1">
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.established_date", "ESTABLISHED DATE")}</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{salesCompanyEstDate}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.registered_address", "REGISTERED ADDRESS")}</span>
                    <span className="text-[9px] font-medium text-slate-700 dark:text-slate-300 leading-snug block">{salesCompanyAddress}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.registered_email", "REGISTERED EMAIL")}</span>
                    <span className="font-mono text-[9px] text-blue-600 dark:text-blue-400 truncate block" title={salesCompanyEmail}>{salesCompanyEmail}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.phone_mobile", "PHONE / MOBILE")}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{salesCompanyPhone}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.website", "WEBSITE")}</span>
                    <span className="font-mono text-[9px] text-blue-600 dark:text-blue-400 truncate block" title={salesCompanyWebsite}>{salesCompanyWebsite}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
