"use client";
import React, { useState } from "react";
import {
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  Calendar,
  Hash,
  CreditCard,
  Ship,
  Globe2,
  User,
  MapPin,
  FileText,
  Eye
} from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { AccountDetailsModal } from "./account-details-modal";

export function getCurrencyFlag(currency) {
  const c = String(currency || "").toUpperCase();
  if (c.includes("AED")) return "🇦🇪";
  if (c.includes("USD")) return "🇺🇸";
  if (c.includes("EUR")) return "🇪🇺";
  if (c.includes("GBP")) return "🇬🇧";
  if (c.includes("PKR")) return "🇵🇰";
  if (c.includes("AFN")) return "🇦🇫";
  if (c.includes("INR")) return "🇮🇳";
  if (c.includes("CNY")) return "🇨🇳";
  if (c.includes("SAR")) return "🇸🇦";
  return "🌐";
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return "16 Oct 2026";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/**
 * Three upper cards matching the approved ERP design:
 * Card 1: Booking Details & Branch Information (Blue)
 * Card 2: Sales Account (CR) & Company Details (Green)
 * Card 3: Customer Account (DR) & Company Details (Orange)
 */
export function SalesBookingUpperCards({
  form = {},
  setForm,
  lang = "en",
  showBadges = false,
  mode = "all", // "all" | "customer" | "sales" | "booking"
  readOnly = false,
  dbCompanies = [],
  dbAccounts = [],
  currencyOptions = ["AED", "USD", "EUR", "GBP", "PKR", "SAR", "INR"]
}) {
  const [salesCompOpen, setSalesCompOpen] = useState(false);
  const [customerCompOpen, setCustomerCompOpen] = useState(false);
  const [viewModalAccount, setViewModalAccount] = useState(null);
  const [viewModalType, setViewModalType] = useState("customer");

  const bookingDateFormatted = formatDisplayDate(form.salesDate || form.bookingDate);
  const bookingNo = form.salesOrderNo || "SB-2026-0001";
  const serialNo = form.billNo || "SV-0001";
  const paymentType = form.paymentType || "Cash";
  const shippingType = form.shippingMode || form.shipmentType || "By Sea";
  const country = form.branchCountry || "United Arab Emirates";
  const branch = form.branchName || "Dubai Main Branch";
  const createdBy = form.userName || "Admin User";
  const operationType = form.saleMode === "export" ? "Export" : (form.operationType || "Export");

  const handleOpenAccountModal = (type) => {
    if (type === "sales") {
      const codeToMatch = String(salesAccountCode || "").trim().toLowerCase();
      const acc = dbAccounts.find(
        (a) => (a.accountCode || a.code || "").trim().toLowerCase() === codeToMatch
      ) || {
        accountCode: salesAccountCode,
        accountName: salesAccountName,
        cityBranchName: salesBranch,
        kind: salesBusinessName,
        currency: salesCurrency,
        companyName: salesCompany,
        address: salesAddress,
        licenseNo: salesLicense,
        gstTrn: salesGst,
        currentBalance: form.salesAccountCurrentBalance ?? 0,
        manualReferenceNumber: form.salesAccountManualReferenceNumber ?? ""
      };
      setViewModalAccount(acc);
      setViewModalType("sales");
    } else {
      const codeToMatch = String(customerAccountCode || "").trim().toLowerCase();
      const acc = dbAccounts.find(
        (a) => (a.accountCode || a.code || "").trim().toLowerCase() === codeToMatch
      ) || {
        accountCode: customerAccountCode,
        accountName: customerAccountName,
        cityBranchName: customerBranch,
        kind: customerBusinessName,
        currency: customerCurrency,
        companyName: customerCompany,
        address: customerAddress,
        licenseNo: customerLicense,
        gstTrn: customerGst,
        currentBalance: form.customerAccountCurrentBalance ?? 0,
        manualReferenceNumber: form.customerAccountManualReferenceNumber ?? ""
      };
      setViewModalAccount(acc);
      setViewModalType("customer");
    }
  };

  // Sales Account (CR)
  const salesAccountCode = form.salesAccountNo || "SA-001";
  const salesAccountName = form.salesAccountName || "Global Trading LLC";
  const salesBranch = form.salesAccountBranch || branch;
  const salesBusinessName = form.salesAccountKind || "General Trading";
  const salesCurrency = form.salesCurrency || form.currencyType || "AED";
  const salesCompany = form.salesCompanyName || salesAccountName;
  const salesAddress = form.salesCompanyAddress || "Office 101, Business Bay, Dubai, UAE";
  const salesLicense = form.salesLicenseNo || "TRN1234567890";
  const salesGst = form.salesGstTrn || "100123456789003";

  // Customer Account (DR)
  const customerAccountCode = form.customerAccountNo || "CU-001";
  const customerAccountName = form.customerAccountName || "Al Noor Imports";
  const customerBranch = form.customerAccountBranch || branch;
  const customerBusinessName = form.customerAccountKind || "Import & Export";
  const customerCurrency = form.customerAccountCurrency || form.salesCurrency || "AED";
  const customerCompany = form.customerCompanyName || customerAccountName;
  const customerAddress = form.customerCompanyAddress || "Warehouse 5, Jebel Ali, Dubai, UAE";
  const customerLicense = form.customerLicenseNo || "TRN0987654321";
  const customerGst = form.customerGstTrn || "100987654321003";

  // Handle currency change
  const handleCurrencyChange = (newCurr) => {
    if (readOnly || !setForm) return;
    setForm((prev) => ({
      ...prev,
      salesCurrency: newCurr,
      customerAccountCurrency: newCurr,
      currencyType: newCurr === "USD" ? "USD" : prev.currencyType
    }));
  };

  // Handle company change
  const handleCompanySelect = (type, comp) => {
    if (readOnly || !setForm || !comp) return;
    if (type === "sales") {
      setForm((prev) => ({
        ...prev,
        salesCompanyId: comp.id,
        salesCompanyName: comp.name,
        salesCompanyCode: "COM-" + comp.name.slice(0, 3).toUpperCase()
      }));
      setSalesCompOpen(false);
    } else {
      setForm((prev) => ({
        ...prev,
        customerCompanyId: comp.id,
        customerCompanyName: comp.name,
        customerCompanyCode: "COM-" + comp.name.slice(0, 3).toUpperCase()
      }));
      setCustomerCompOpen(false);
    }
  };

  /* ---------------- Card 1: Booking Details & Branch Info ---------------- */
  const renderBookingCard = () => (
    <div className="bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/60 rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
      {/* Header */}
      <div className="bg-blue-600 dark:bg-blue-700 text-white px-3 py-2 flex items-center gap-2">
        {showBadges && (
          <span className="w-4 h-4 rounded bg-white text-blue-700 text-[11px] font-black flex items-center justify-center shrink-0 leading-none">
            1
          </span>
        )}
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <h4 className="text-[11px] font-black uppercase tracking-wider truncate">
          {tUi(lang, "sales.booking_details_branch", "BOOKING DETAILS & BRANCH INFORMATION")}
        </h4>
      </div>

      {/* Content */}
      <div className="p-3 text-[11px] space-y-1.5 leading-tight text-slate-700 dark:text-slate-300">
        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            {tUi(lang, "sales.booking_date_lbl", "Booking Date")}
          </span>
          <span className="font-bold text-slate-900 dark:text-slate-100">: {bookingDateFormatted}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Hash className="w-3 h-3 text-slate-400" />
            {tUi(lang, "sales.booking_no_lbl", "Booking No.")}
          </span>
          <span className="font-bold font-mono text-slate-900 dark:text-slate-100">: {bookingNo}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <FileText className="w-3 h-3 text-slate-400" />
            {tUi(lang, "sales.serial_no_lbl", "Serial No.")}
          </span>
          <span className="font-bold font-mono text-slate-900 dark:text-slate-100">: {serialNo}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <CreditCard className="w-3 h-3 text-slate-400" />
            {tUi(lang, "sales.payment_type_lbl", "Payment Type")}
          </span>
          <span className="font-bold flex items-center gap-1">
            : <span className="inline-block px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 font-bold text-[11px]">{paymentType}</span>
          </span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Ship className="w-3 h-3 text-slate-400" />
            {tUi(lang, "sales.shipping_type_lbl", "Shipping Type")}
          </span>
          <span className="font-bold flex items-center gap-1">
            : <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[11px]">{shippingType}</span>
          </span>
        </div>

        {showBadges && (
          <div className="grid grid-cols-[90px_1fr] items-center gap-1">
            <span className="text-slate-500 font-semibold">{tUi(lang, "sales.operation_type_lbl", "Operation Type")}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">: {operationType}</span>
          </div>
        )}

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Globe2 className="w-3 h-3 text-slate-400" />
            {tUi(lang, "sales.country_lbl", "Country")}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">: {country}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            {tUi(lang, "sales.branch_lbl", "Branch")}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">: {branch}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" />
            {tUi(lang, "sales.created_by_lbl", "Created By")}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">: {createdBy}</span>
        </div>
      </div>
    </div>
  );

  /* ---------------- Card 2: Sales Account (CR) ---------------- */
  const renderSalesCard = () => (
    <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
      {/* Header */}
      <div className="bg-emerald-600 dark:bg-emerald-700 text-white px-3 py-2 flex items-center gap-2">
        {showBadges && (
          <span className="w-4 h-4 rounded bg-white text-emerald-700 text-[11px] font-black flex items-center justify-center shrink-0 leading-none">
            2
          </span>
        )}
        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
        <h4 className="text-[11px] font-black uppercase tracking-wider truncate">
          {tUi(lang, "sales.sales_account_cr", "SALES ACCOUNT (CR)")}
        </h4>
      </div>

      {/* Account Info */}
      <div className="p-3 text-[11px] space-y-1.5 leading-tight text-slate-700 dark:text-slate-300">
        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.account_code_lbl", "Account Code")}</span>
          <div className="flex items-center justify-between gap-1">
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">: {salesAccountCode}</span>
            <button
              type="button"
              onClick={() => handleOpenAccountModal("sales")}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 transition-colors shadow-2xs cursor-pointer ml-auto"
              title="View Sales Account Details"
            >
              <Eye className="w-2.5 h-2.5" />
              <span>View</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.account_name_lbl", "Account Name")}</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 truncate">: {salesAccountName}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.branch_lbl", "Branch")}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">: {salesBranch}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.business_name_lbl", "Business Name")}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">: {salesBusinessName}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.currency_lbl", "Currency")}</span>
          <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-slate-100">
            : <span className="text-base leading-none">{getCurrencyFlag(salesCurrency)}</span>
            <span>{salesCurrency}</span>
            {!readOnly && (
              <select
                value={salesCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="ms-1 bg-transparent border-none text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer outline-none"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Subcard: Company Details */}
      <div className="mx-2 mb-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 text-[11px]">
        <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/40 pb-1 mb-1">
          <span className="font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider text-[11px] flex items-center gap-1">
            <Building2 className="w-2.5 h-2.5" />
            {tUi(lang, "sales.company_details", "COMPANY DETAILS")}
          </span>
          <div className="relative">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setSalesCompOpen(!salesCompOpen)}
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-0.5 truncate max-w-[120px]"
            >
              <span className="truncate">{salesCompany}</span>
              {!readOnly && <ChevronDown className="w-2.5 h-2.5 shrink-0" />}
            </button>
            {salesCompOpen && dbCompanies.length > 0 && (
              <div className="absolute right-0 top-5 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 p-1 space-y-0.5">
                {dbCompanies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCompanySelect("sales", c)}
                    className="w-full text-left px-2 py-1 rounded text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 truncate"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1 text-slate-600 dark:text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">CO :</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{salesCompany}</span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="truncate">Country : {country}</span>
            <span className="truncate">State : Dubai</span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="truncate">City : Dubai</span>
            <span className="truncate font-mono">City Code : DXB</span>
          </div>
          <div className="truncate">
            <span className="text-slate-400 font-medium">Address : </span>
            <span className="font-medium text-slate-700 dark:text-slate-200" title={salesAddress}>
              {salesAddress}
            </span>
          </div>
          <div className="flex justify-between font-mono text-[11px]">
            <span>License No. : {salesLicense}</span>
          </div>
          <div className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
            GST / TRN : {salesGst}
          </div>
        </div>
      </div>
    </div>
  );

  /* ---------------- Card 3: Customer Account (DR) ---------------- */
  const renderCustomerCard = () => (
    <div className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
      {/* Header */}
      <div className="bg-amber-600 dark:bg-amber-700 text-white px-3 py-2 flex items-center gap-2">
        {showBadges && (
          <span className="w-4 h-4 rounded bg-white text-amber-700 text-[11px] font-black flex items-center justify-center shrink-0 leading-none">
            3
          </span>
        )}
        <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
        <h4 className="text-[11px] font-black uppercase tracking-wider truncate">
          {tUi(lang, "sales.customer_account_dr", "CUSTOMER ACCOUNT (DR)")}
        </h4>
      </div>

      {/* Account Info */}
      <div className="p-3 text-[11px] space-y-1.5 leading-tight text-slate-700 dark:text-slate-300">
        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.account_code_lbl", "Account Code")}</span>
          <div className="flex items-center justify-between gap-1">
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">: {customerAccountCode}</span>
            <button
              type="button"
              onClick={() => handleOpenAccountModal("customer")}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-700 transition-colors shadow-2xs cursor-pointer ml-auto"
              title="View Customer Account Details"
            >
              <Eye className="w-2.5 h-2.5" />
              <span>View</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.account_name_lbl", "Account Name")}</span>
          <span className="font-bold text-amber-700 dark:text-amber-400 truncate">: {customerAccountName}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.branch_lbl", "Branch")}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">: {customerBranch}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.business_name_lbl", "Business Name")}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">: {customerBusinessName}</span>
        </div>

        <div className="grid grid-cols-[90px_1fr] items-center gap-1">
          <span className="text-slate-500 font-semibold">{tUi(lang, "sales.currency_lbl", "Currency")}</span>
          <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-slate-100">
            : <span className="text-base leading-none">{getCurrencyFlag(customerCurrency)}</span>
            <span>{customerCurrency}</span>
            {!readOnly && (
              <select
                value={customerCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="ms-1 bg-transparent border-none text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer outline-none"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Subcard: Company Details */}
      <div className="mx-2 mb-2 p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-[11px]">
        <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-800/40 pb-1 mb-1">
          <span className="font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1">
            <Building2 className="w-2.5 h-2.5" />
            {tUi(lang, "sales.company_details", "COMPANY DETAILS")}
          </span>
          <div className="relative">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setCustomerCompOpen(!customerCompOpen)}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-0.5 truncate max-w-[120px]"
            >
              <span className="truncate">{customerCompany}</span>
              {!readOnly && <ChevronDown className="w-2.5 h-2.5 shrink-0" />}
            </button>
            {customerCompOpen && dbCompanies.length > 0 && (
              <div className="absolute right-0 top-5 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 p-1 space-y-0.5">
                {dbCompanies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCompanySelect("customer", c)}
                    className="w-full text-left px-2 py-1 rounded text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 truncate"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1 text-slate-600 dark:text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">CO :</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{customerCompany}</span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="truncate">Country : {country}</span>
            <span className="truncate">State : Dubai</span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="truncate">City : Dubai</span>
            <span className="truncate font-mono">City Code : DXB</span>
          </div>
          <div className="truncate">
            <span className="text-slate-400 font-medium">Address : </span>
            <span className="font-medium text-slate-700 dark:text-slate-200" title={customerAddress}>
              {customerAddress}
            </span>
          </div>
          <div className="flex justify-between font-mono text-[11px]">
            <span>License No. : {customerLicense}</span>
          </div>
          <div className="font-mono text-[11px] text-amber-800 dark:text-amber-300 font-bold">
            GST / TRN : {customerGst}
          </div>
        </div>
      </div>
    </div>
  );

  const modalNode = (
    <AccountDetailsModal
      isOpen={Boolean(viewModalAccount)}
      onClose={() => setViewModalAccount(null)}
      account={viewModalAccount}
      accountType={viewModalType}
      lang={lang}
    />
  );

  if (mode === "customer") {
    return (
      <>
        {renderCustomerCard()}
        {modalNode}
      </>
    );
  }
  if (mode === "sales") {
    return (
      <>
        {renderSalesCard()}
        {modalNode}
      </>
    );
  }
  if (mode === "booking") {
    return renderBookingCard();
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {renderBookingCard()}
        {renderSalesCard()}
        {renderCustomerCard()}
      </div>
      {modalNode}
    </>
  );
}
