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
  const userJoiningDate = data.userJoiningDate || "2020-01-01";
  const userPasswordExpiry = data.userPasswordExpiry || "2026-12-31";
  const userLastLogin = data.userLastLogin || `${data.bookingDate || "2026-08-27"} 10:25 AM English`;

  const bookingDate = data.bookingDate || "2026-08-27";
  const fiscalYear = data.fiscalYear || "2025-26";
  const bookingBranch = data.bookingBranch || "Global System";
  const status = data.status || "DRAFT";
  const systemSerialNo = data.systemSerialNo || "PO-2026-2837";
  const countrySerialNo = data.countrySerialNo || "CS-1837";
  const superAdminSerialNo = data.superAdminSerialNo || "SA-2026-5567";
  const branchSerialNo = data.branchSerialNo || "DUBAI-25837";
  const billContractNo = data.billContractNo || "052-25837";
  const paymentType = data.paymentType || "Advance Payment";
  const shipType = data.shipType || "Sea Freight";
  const loadingMode = data.loadingMode || "By Sea";
  const originCountry = data.originCountry || "China";

  const paymentTerms = data.paymentTerms || "45 Days After B/L Date";
  const paymentMethod = data.paymentMethod || "Bank Transfer";
  const paymentCurrency = data.paymentCurrency || "AED - UAE Dirham";

  const shippingMode = data.shippingMode || "By Sea";
  const shippingLine = data.shippingLine || "WAN HAI LINES LTD.";
  const loadingPort = data.loadingPort || "NINGBO PORT, CHINA";
  const receivingPort = data.receivingPort || "JEBEL ALI PORT, DUBAI";
  const containerInfo = data.containerInfo || "1x 40HQ (WHLU-982341-0)";

  // Purchase Account
  const purchaseAccountName = data.purchaseAccountName || "United Arab Emirates Main Country Clearing";
  const purchaseAccountCode = data.purchaseAccountCode || "UAE-CORP-GEN-001";
  const purchaseTotalCredit = data.purchaseTotalCredit !== undefined && data.purchaseTotalCredit !== "" ? (typeof data.purchaseTotalCredit === "number" ? data.purchaseTotalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.purchaseTotalCredit) : "125,000.00";
  const purchaseTotalDebit = data.purchaseTotalDebit !== undefined && data.purchaseTotalDebit !== "" ? (typeof data.purchaseTotalDebit === "number" ? data.purchaseTotalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.purchaseTotalDebit) : "85,000.00";
  const purchaseBalance = data.purchaseBalance !== undefined && data.purchaseBalance !== "" ? (typeof data.purchaseBalance === "number" ? data.purchaseBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.purchaseBalance) : "40,000.00";
  const purchaseCompanyName = data.purchaseCompanyName || "da Consolidated General Trading FZE";
  const purchaseBranch = data.purchaseBranch || "Dubai Main Branch";
  const purchaseCountry = data.purchaseCountry || "United Arab Emirates";
  const purchaseCompanyCode = data.purchaseCompanyCode || "DA-CONSOLIDATED-001";
  const purchaseLegalType = data.purchaseLegalType || "Free Zone Company";
  const purchaseLicenseNo = data.purchaseLicenseNo || "1234567";
  const purchaseTaxRegNo = data.purchaseTaxRegNo || "DA40225334449000003";
  const purchaseVatRegNo = data.purchaseVatRegNo || "AE10022534449000003";
  const purchaseCompanyEstDate = data.purchaseCompanyEstDate || "2018-05-12";
  const purchaseCompanyEmail = data.purchaseCompanyEmail || "info@da-consolidated.ae";
  const purchaseCompanyPhone = data.purchaseCompanyPhone || "+971 50 123 4567";
  const purchaseCompanyWebsite = data.purchaseCompanyWebsite || "www.da-consolidated.ae";
  const purchaseCompanyAddress = data.purchaseCompanyAddress || "SAIF Zone, PO BOX 12345, Sharjah, United Arab Emirates";
  const purchaseBankName = data.purchaseBankName || "Emirates NBD";
  const purchaseBankAccountName = data.purchaseBankAccountName || "da Consolidated FZE";
  const purchaseBankAccountNo = data.purchaseBankAccountNo || "1012345678901";
  const purchaseIban = data.purchaseIban || "AE020260001012345678901";
  const purchaseSwiftCode = data.purchaseSwiftCode || "EBILAEAD";
  const purchaseCurrencyLabel = data.purchaseCurrencyLabel || "AED - UAE Dirham";

  // Sales Account
  const salesAccountName = data.salesAccountName || "United Arab Emirates Main Country Clearing Ledger";
  const salesAccountCode = data.salesAccountCode || "UAE-CORP-GEN-001";
  const salesTotalCredit = data.salesTotalCredit !== undefined && data.salesTotalCredit !== "" ? (typeof data.salesTotalCredit === "number" ? data.salesTotalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.salesTotalCredit) : "210,000.00";
  const salesTotalDebit = data.salesTotalDebit !== undefined && data.salesTotalDebit !== "" ? (typeof data.salesTotalDebit === "number" ? data.salesTotalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.salesTotalDebit) : "150,000.00";
  const salesBalance = data.salesBalance !== undefined && data.salesBalance !== "" ? (typeof data.salesBalance === "number" ? data.salesBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.salesBalance) : "60,000.00";
  const salesCompanyName = data.salesCompanyName || "da Consolidated General Trading FZE";
  const salesBranch = data.salesBranch || "Dubai Main Branch";
  const salesCountry = data.salesCountry || "United Arab Emirates";
  const salesCompanyCode = data.salesCompanyCode || "DA-CONSOLIDATED-001";
  const salesLegalType = data.salesLegalType || "Free Zone Company";
  const salesLicenseNo = data.salesLicenseNo || "1234567";
  const salesTaxRegNo = data.salesTaxRegNo || "DA40225334449000003";
  const salesVatRegNo = data.salesVatRegNo || "AE10022534449000003";
  const salesCompanyEstDate = data.salesCompanyEstDate || "2018-05-12";
  const salesCompanyEmail = data.salesCompanyEmail || "info@da-consolidated.ae";
  const salesCompanyPhone = data.salesCompanyPhone || "+971 50 123 4567";
  const salesCompanyWebsite = data.salesCompanyWebsite || "www.da-consolidated.ae";
  const salesCompanyAddress = data.salesCompanyAddress || "SAIF Zone, PO BOX 12345, Sharjah, United Arab Emirates";
  const salesBankName = data.salesBankName || "Emirates NBD";
  const salesBankAccountName = data.salesBankAccountName || "da Consolidated FZE";
  const salesBankAccountNo = data.salesBankAccountNo || "1012345678901";
  const salesIban = data.salesIban || "AE020260001012345678901";
  const salesSwiftCode = data.salesSwiftCode || "EBILAEAD";
  const salesCurrencyLabel = data.salesCurrencyLabel || "AED - UAE Dirham";

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className={`w-full ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        
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
              <div className="flex flex-col gap-0.5 py-1 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.address", "ADDRESS")}</span>
                <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 leading-snug">{branchAddress}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.city", "CITY")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{branchCity}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.state_emirate", "STATE / EMIRATE")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{branchState}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.country", "COUNTRY")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{branchCountry}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.postal_code", "POSTAL CODE")}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-right">{branchPostalCode}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.phone", "PHONE")}</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-right">{branchPhone}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.email", "EMAIL")}</span>
                <span className="font-mono text-[9.5px] text-blue-600 dark:text-blue-400 text-right truncate max-w-[140px]" title={branchEmail}>{branchEmail}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.established_date", "ESTABLISHED DATE")}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-right">{branchEstablishedDate}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-1">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.status", "STATUS")}</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  {branchStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1.2: User Details */}
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
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.role", "ROLE")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{userRole}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.department", "DEPARTMENT")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{userDepartment}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.email", "EMAIL")}</span>
                <span className="font-mono text-[9.5px] text-blue-600 dark:text-blue-400 text-right truncate max-w-[140px]" title={userEmail}>{userEmail}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.phone_mobile", "PHONE / MOBILE")}</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-right">{userPhone}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.status", "STATUS")}</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  {userStatus}
                </span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.joining_date", "JOINING DATE")}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-right">{userJoiningDate}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.password_expiry", "PASSWORD EXPIRY")}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-right">{userPasswordExpiry}</span>
              </div>
              <div className="flex justify-between items-start gap-2 pt-1">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.last_login", "LAST LOGIN")}</span>
                <span className="font-mono text-[9px] text-slate-600 dark:text-slate-400 text-right">{userLastLogin}</span>
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

          {/* Section 2.1: Payment Information */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <CreditCard className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {t(lang, "pbr.payment_info", "PAYMENT INFORMATION")}
              </span>
            </div>
            <div className="space-y-1 text-[10.5px]">
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.payment_type", "PAYMENT TYPE")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{paymentType}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.payment_terms", "PAYMENT TERMS")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{paymentTerms}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.payment_method", "PAYMENT METHOD")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{paymentMethod}</span>
              </div>
              <div className="flex justify-between items-start gap-2 pt-0.5">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.payment_currency", "PAYMENT CURRENCY")}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">{paymentCurrency}</span>
              </div>
            </div>
          </div>

          {/* Section 2.2: Shipping Information */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Truck className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {t(lang, "pbr.shipping_info", "SHIPPING INFORMATION")}
              </span>
            </div>
            <div className="space-y-1 text-[10.5px]">
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.shipping_mode", "SHIPPING MODE")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{shippingMode}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.shipping_line_agent", "SHIPPING LINE")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[130px]" title={shippingLine}>{shippingLine}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.loading_port", "LOADING PORT")}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-right truncate max-w-[130px]" title={loadingPort}>{loadingPort}</span>
              </div>
              <div className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.receiving_port", "RECEIVING PORT")}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-right truncate max-w-[130px]" title={receivingPort}>{receivingPort}</span>
              </div>
              <div className="flex justify-between items-start gap-2 pt-0.5">
                <span className="text-[9.5px] font-bold uppercase text-slate-500">{t(lang, "pbr.container_count_no", "CONTAINER")}</span>
                <span className="font-mono text-[9.5px] font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[130px]" title={containerInfo}>{containerInfo}</span>
              </div>
            </div>
          </div>
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
              <span className="block text-[8px] font-black uppercase text-emerald-700 dark:text-emerald-400">{t(lang, "pbr.total_credit", "TOTAL CREDIT")}</span>
              <span className="block text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{purchaseTotalCredit}</span>
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-rose-700 dark:text-rose-400">{t(lang, "pbr.total_debit", "TOTAL DEBIT")}</span>
              <span className="block text-[11px] font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">{purchaseTotalDebit}</span>
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-blue-700 dark:text-blue-400">{t(lang, "pbr.balance", "BALANCE")}</span>
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

          {/* Section 3.1: Company Complete Details */}
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
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.established_date", "ESTABLISHED DATE")}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{purchaseCompanyEstDate}</span>
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

              {/* Right Column */}
              <div className="space-y-1">
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.registered_address", "REGISTERED ADDRESS")}</span>
                  <span className="text-[9px] font-medium text-slate-700 dark:text-slate-300 leading-snug block">{purchaseCompanyAddress}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.bank_name", "BANK NAME")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{purchaseBankName}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.bank_ac_name", "BANK A/C NAME")}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block" title={purchaseBankAccountName}>{purchaseBankAccountName}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.bank_account_no", "BANK ACCOUNT NO.")}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{purchaseBankAccountNo}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.iban_no", "IBAN NO.")}</span>
                  <span className="font-mono text-[9px] font-bold text-slate-800 dark:text-slate-200 truncate block" title={purchaseIban}>{purchaseIban}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.swift_code", "SWIFT CODE")}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{purchaseSwiftCode}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.currency", "CURRENCY")}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{purchaseCurrencyLabel}</span>
                </div>
              </div>
            </div>
          </div>
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
              <span className="block text-[8px] font-black uppercase text-emerald-700 dark:text-emerald-400">{t(lang, "pbr.total_credit", "TOTAL CREDIT")}</span>
              <span className="block text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{salesTotalCredit}</span>
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-rose-700 dark:text-rose-400">{t(lang, "pbr.total_debit", "TOTAL DEBIT")}</span>
              <span className="block text-[11px] font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">{salesTotalDebit}</span>
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-blue-700 dark:text-blue-400">{t(lang, "pbr.balance", "BALANCE")}</span>
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

          {/* Section 4.1: Company Complete Details */}
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
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.established_date", "ESTABLISHED DATE")}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{salesCompanyEstDate}</span>
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

              {/* Right Column */}
              <div className="space-y-1">
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.registered_address", "REGISTERED ADDRESS")}</span>
                  <span className="text-[9px] font-medium text-slate-700 dark:text-slate-300 leading-snug block">{salesCompanyAddress}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.bank_name", "BANK NAME")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{salesBankName}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.bank_ac_name", "BANK A/C NAME")}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block" title={salesBankAccountName}>{salesBankAccountName}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.bank_account_no", "BANK ACCOUNT NO.")}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{salesBankAccountNo}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.iban_no", "IBAN NO.")}</span>
                  <span className="font-mono text-[9px] font-bold text-slate-800 dark:text-slate-200 truncate block" title={salesIban}>{salesIban}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.swift_code", "SWIFT CODE")}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{salesSwiftCode}</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{t(lang, "pbr.currency", "CURRENCY")}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{salesCurrencyLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
