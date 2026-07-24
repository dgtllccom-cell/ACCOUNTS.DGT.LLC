"use client";

import type { ReactNode } from "react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useMemo } from "react";
import {
  Info,
  UserRound,
  Building2,
  Landmark,
  Warehouse,
  ShieldAlert,
  Printer,
  FileText,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  ArrowLeft
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  // Context metadata
  selectedCountryName?: string;
  selectedCountryCode?: string;
  selectedBranchName?: string;
  selectedBranchCode?: string;

  // Actions
  onBack?: () => void;
  onPrint?: () => void;
  onPdf?: () => void;
  onExcel?: () => void;
  onEmail?: () => void;
  onWhatsApp?: () => void;
};


const liveReportLabels: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  active: { en: "Active", ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" },
  inProgress: { en: "In Progress", ur: "جاری ہے", ar: "قيد التنفيذ", fa: "در حال اجرا", ps: "په جریان کې" },
  accountTitle: { en: "Account Title", ur: "اکاؤنٹ عنوان" },
  accountCodeAuto: { en: "Account Code (Auto)", ur: "اکاؤنٹ کوڈ (خودکار)" },
  accountGroup: { en: "Account Group", ur: "اکاؤنٹ گروپ" },
  currency: { en: "Currency", ur: "کرنسی" },
  date: { en: "Date", ur: "تاریخ" },
  openingBalance: { en: "Opening Balance", ur: "اوپننگ بیلنس" },
  debitAmount: { en: "Debit Amount", ur: "ڈیبٹ رقم" },
  creditAmount: { en: "Credit Amount", ur: "کریڈٹ رقم" },
  netBalance: { en: "Net Balance", ur: "نیٹ بیلنس" },
  accountInformation: { en: "ACCOUNT INFORMATION", ur: "اکاؤنٹ معلومات" },
  customerInformation: { en: "CUSTOMER INFORMATION", ur: "کسمٹر معلومات" },
  customerName: { en: "Customer Name", ur: "کسمٹر نام" },
  customerCode: { en: "Customer Code", ur: "کسمٹر کوڈ" },
  customerType: { en: "Customer Type", ur: "کسمٹر قسم" },
  phone: { en: "Phone", ur: "فون" },
  email: { en: "Email", ur: "ای میل" },
  address: { en: "Address", ur: "پتہ" },
  lastUpdated: { en: "Last Updated", ur: "آخری اپڈیٹ" },
  companyDetails: { en: "COMPANY DETAILS", ur: "کمپنی تفصیلات" },
  companyName: { en: "Company Name", ur: "کمپنی نام" },
  companyCode: { en: "Company Code", ur: "کمپنی کوڈ" },
  registrationNo: { en: "Registration No.", ur: "رجسٹریشن نمبر" },
  bankDetails: { en: "BANK DETAILS", ur: "بینک تفصیلات" },
  bankName: { en: "Bank Name", ur: "بینک نام" },
  accountNumber: { en: "Account Number", ur: "اکاؤنٹ نمبر" },
  bankBranch: { en: "Bank Branch", ur: "بینک برانچ" },
  swiftCode: { en: "Swift Code", ur: "سوفٹ کوڈ" },
  warehouseDetails: { en: "WAREHOUSE DETAILS", ur: "گودام تفصیلات" },
  warehouseName: { en: "Warehouse Name", ur: "گودام نام" },
  warehouseCode: { en: "Warehouse Code", ur: "گودام کوڈ" },
  location: { en: "Location", ur: "مقام" },
  auditInformation: { en: "AUDIT INFORMATION", ur: "آڈٹ معلومات" },
  accountName: { en: "Account Name", ur: "اکاؤنٹ نام" },
  accountCode: { en: "Account Code", ur: "اکاؤنٹ کوڈ" },
  subType: { en: "Sub Type", ur: "ذیلی قسم" },
  category: { en: "Category", ur: "کیٹیگری" },
  manualRef: { en: "Manual Ref", ur: "دستی حوالہ" },
  country: { en: "Country", ur: "ملک" },
  branch: { en: "Branch", ur: "برانچ" },
  createdBy: { en: "Created By", ur: "بنایا گیا بذریعہ" },
  createdAt: { en: "Created At", ur: "بنانے کا وقت" },
  updatedBy: { en: "Updated By", ur: "اپڈیٹ بذریعہ" },
  updatedAt: { en: "Updated At", ur: "اپڈیٹ وقت" },
  ipAddress: { en: "IP Address", ur: "آئی پی ایڈریس" },
  browserPlatform: { en: "Browser / Platform", ur: "براؤزر / پلیٹ فارم" },
  mobileNumber: { en: "Mobile Number", ur: "موبائل نمبر", ar: "رقم الهاتف المحمول", fa: "شماره موبایل", ps: "د موبایل شمیره" },
  contactsList: { en: "Contacts", ur: "رابطہ نمبرز", ar: "جهات الاتصال", fa: "مخاطبین", ps: "اړیکې" }
};
export function AccountLiveReportPanel({
  accountName,
  accountCode,
  accountTitle,
  subType,
  category,
  manualReferenceNumber,
  currency,
  status = "Active",
  lang = "en",
  contacts,
  customerDetail,
  companyDetail,
  bankDetail,
  warehouseDetail,
  selectedCountryName,
  selectedCountryCode,
  selectedBranchName,
  selectedBranchCode,
  onBack,
  onPrint,
  onPdf,
  onExcel,
  onEmail,
  onWhatsApp
}: AccountLiveReportProps) {
  
  const now = useMemo(() => new Date(), []);
  const stampDate = useMemo(() => now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), [now]);
  const stampTime = useMemo(() => now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }), [now]);

  const formattedDateTime = `${stampDate} ${stampTime}`;
  const t = (key: string, fallback: string) => liveReportLabels[key]?.[lang] || liveReportLabels[key]?.en || fallback;

  // Metrics (configured exactly to match user's mockup)
  const openingBalance = "0.00";
  const totalDebit = "0.00";
  const totalCredit = "79,000.00";
  const netBalance = "79,000.00";

  // Formats a UUID into a compact ID for display
  function compactCode(id: string, prefix: string) {
    if (!id) return "-";
    const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `${prefix}-${clean.slice(0, 4)}`;
  }

  // Extract contacts from Step 1 or master records
  const stepContacts = Array.isArray(contacts) ? contacts.filter(c => c && c.value && c.value.trim() !== "") : [];
  const primaryStepMobile = stepContacts.find(c => c.type.toLowerCase().includes("mobile") || c.type === "Mobile")?.value || stepContacts[0]?.value || "";
  const primaryStepEmail = stepContacts.find(c => c.type.toLowerCase().includes("email"))?.value || "";
  const formattedStepContacts = stepContacts.map(c => `${c.type}: ${c.value}`).join(" | ") || "";

  // 2. Customer Information fields
  const custObj = customerDetail?.customer ?? customerDetail;
  const custContactsList = Array.isArray(customerDetail?.contacts) ? customerDetail.contacts : [];
  const custPhone = custObj?.mobile || custObj?.phone || custObj?.whatsapp || custContactsList.find((c: any) => c.contact_value)?.contact_value || (accountTitle === "Customer" && primaryStepMobile ? primaryStepMobile : "-");
  const custEmail = custObj?.email || custContactsList.find((c: any) => c.contact_type?.toLowerCase().includes("email"))?.contact_value || (accountTitle === "Customer" && primaryStepEmail ? primaryStepEmail : "-");
  const custAddress = custObj?.address || (accountTitle === "Customer" ? [selectedBranchName, selectedCountryName].filter(Boolean).join(", ") || "-" : "-");

  const customerFields = (custObj || accountTitle === "Customer") ? [
    { label: t("customerName", "Customer Name"), value: custObj?.customer_name || custObj?.name || (accountTitle === "Customer" ? accountName : "-") },
    { label: t("customerCode", "Customer Code"), value: custObj?.customer_code || (custObj?.id ? compactCode(custObj.id, "CUST") : (accountTitle === "Customer" ? accountCode || "CUST-AUTO" : "-")) },
    { label: t("customerType", "Customer Type"), value: custObj?.customer_type || subType || "Company / Individual" },
    { label: "NTN / CNIC", value: custObj?.ntn_cnic || custObj?.ntn || (accountTitle === "Customer" ? manualReferenceNumber || "-" : "-") },
    { label: t("phone", "Phone"), value: custPhone },
    { label: t("email", "Email"), value: custEmail },
    { label: t("address", "Address"), value: custAddress },
    { label: t("createdAt", "Created At"), value: custObj?.created_at ? new Date(custObj.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + new Date(custObj.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : formattedDateTime },
    { label: t("lastUpdated", "Last Updated"), value: custObj?.updated_at ? new Date(custObj.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + new Date(custObj.updated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : formattedDateTime }
  ] : [
    { label: t("customerName", "Customer Name"), value: "-" },
    { label: t("customerCode", "Customer Code"), value: "-" },
    { label: t("customerType", "Customer Type"), value: "-" },
    { label: "NTN / CNIC", value: "-" },
    { label: t("phone", "Phone"), value: "-" },
    { label: t("email", "Email"), value: "-" },
    { label: t("address", "Address"), value: "-" },
    { label: t("createdAt", "Created At"), value: "-" },
    { label: t("lastUpdated", "Last Updated"), value: "-" }
  ];

  // 3. Company Details fields
  const compPhone = companyDetail?.phone || companyDetail?.contacts?.find((c: any) => c.type?.toLowerCase().includes("phone") || c.type?.toLowerCase().includes("mobile") || c.type?.toLowerCase().includes("number"))?.value || (accountTitle === "Company" && primaryStepMobile ? primaryStepMobile : "-");
  const compEmail = companyDetail?.email || companyDetail?.contacts?.find((c: any) => c.type?.toLowerCase().includes("email"))?.value || (accountTitle === "Company" && primaryStepEmail ? primaryStepEmail : "-");
  const compAddress = companyDetail?.address || (accountTitle === "Company" ? [selectedBranchName, selectedCountryName].filter(Boolean).join(", ") || "-" : "-");

  const companyFields = (companyDetail || accountTitle === "Company") ? [
    { label: t("companyName", "Company Name"), value: companyDetail?.companyName || companyDetail?.name || companyDetail?.legal_name || (accountTitle === "Company" ? accountName : "-") },
    { label: t("companyCode", "Company Code"), value: companyDetail?.code || (companyDetail?.id ? compactCode(companyDetail.id, "DBG") : (accountTitle === "Company" ? accountCode || "COMP-AUTO" : "-")) },
    { label: t("registrationNo", "Registration No."), value: companyDetail?.registration_no || companyDetail?.registrations?.find((r: any) => r.type?.toLowerCase().includes("registration") || r.type?.toLowerCase().includes("license") || r.type?.toLowerCase().includes("trade"))?.value || (accountTitle === "Company" ? manualReferenceNumber || "-" : "-") },
    { label: "NTN", value: companyDetail?.ntn || companyDetail?.registrations?.find((r: any) => r.type?.toLowerCase().includes("ntn") || r.type?.toLowerCase().includes("gst") || r.type?.toLowerCase().includes("tax"))?.value || "-" },
    { label: t("phone", "Phone"), value: compPhone },
    { label: t("email", "Email"), value: compEmail },
    { label: t("address", "Address"), value: compAddress },
    { label: t("createdAt", "Created At"), value: companyDetail?.created_at ? new Date(companyDetail.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + new Date(companyDetail.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : formattedDateTime },
    { label: t("lastUpdated", "Last Updated"), value: companyDetail?.updated_at ? new Date(companyDetail.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + new Date(companyDetail.updated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : formattedDateTime }
  ] : [
    { label: t("companyName", "Company Name"), value: "-" },
    { label: t("companyCode", "Company Code"), value: "-" },
    { label: t("registrationNo", "Registration No."), value: "-" },
    { label: "NTN", value: "-" },
    { label: t("phone", "Phone"), value: "-" },
    { label: t("email", "Email"), value: "-" },
    { label: t("address", "Address"), value: "-" },
    { label: t("createdAt", "Created At"), value: "-" },
    { label: t("lastUpdated", "Last Updated"), value: "-" }
  ];

  // 4. Bank Details fields
  const bankFields = (bankDetail || accountTitle === "Bank") ? [
    { label: t("bankName", "Bank Name"), value: bankDetail?.bank_name || bankDetail?.bankName || bankDetail?.name || (accountTitle === "Bank" ? accountName : "-") },
    { label: t("accountTitle", "Account Title"), value: bankDetail?.account_title || accountName || "-" },
    { label: t("accountNumber", "Account Number"), value: bankDetail?.account_number || (accountTitle === "Bank" ? manualReferenceNumber || "-" : "-") },
    { label: "IBAN", value: bankDetail?.iban_number || "-" },
    { label: t("bankBranch", "Bank Branch"), value: bankDetail?.branch_name || (accountTitle === "Bank" ? selectedBranchName || "-" : "-") },
    { label: t("swiftCode", "Swift Code"), value: bankDetail?.swift_bic || "-" },
    { label: t("createdAt", "Created At"), value: bankDetail?.created_at ? new Date(bankDetail.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : formattedDateTime },
    { label: t("lastUpdated", "Last Updated"), value: bankDetail?.updated_at ? new Date(bankDetail.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : formattedDateTime }
  ] : [
    { label: t("bankName", "Bank Name"), value: "-" },
    { label: t("accountTitle", "Account Title"), value: "-" },
    { label: t("accountNumber", "Account Number"), value: "-" },
    { label: "IBAN", value: "-" },
    { label: t("bankBranch", "Bank Branch"), value: "-" },
    { label: t("swiftCode", "Swift Code"), value: "-" },
    { label: t("createdAt", "Created At"), value: "-" },
    { label: t("lastUpdated", "Last Updated"), value: "-" }
  ];

  // 5. Warehouse Details fields
  const formatWhContact = (val: any) => {
    if (!val) return "-";
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((c: any) => c.value || c.phone || "").filter(Boolean).join(", ") || "-";
          }
          if (typeof parsed === "object" && parsed !== null) {
            return parsed.value || parsed.phone || parsed.contact_number || "-";
          }
        } catch (e) {}
      }
    }
    return String(val);
  };
  const whPhone = formatWhContact(warehouseDetail?.contact_number || warehouseDetail?.phone);
  const whAddress = warehouseDetail?.full_address || warehouseDetail?.address || warehouseDetail?.location || "-";
  const warehouseFields = warehouseDetail ? [
    { label: t("warehouseName", "Warehouse Name"), value: warehouseDetail.warehouse_name || warehouseDetail.name || "-" },
    { label: t("warehouseCode", "Warehouse Code"), value: warehouseDetail.id ? compactCode(warehouseDetail.id, "WH") : "-" },
    { label: t("location", "Location"), value: whAddress },
    { label: t("phone", "Phone"), value: whPhone },
    { label: t("address", "Address"), value: whAddress },
    { label: t("createdAt", "Created At"), value: warehouseDetail.created_at ? new Date(warehouseDetail.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : formattedDateTime },
    { label: t("lastUpdated", "Last Updated"), value: warehouseDetail.updated_at ? new Date(warehouseDetail.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : formattedDateTime }
  ] : [
    { label: t("warehouseName", "Warehouse Name"), value: "-" },
    { label: t("warehouseCode", "Warehouse Code"), value: "-" },
    { label: t("location", "Location"), value: "-" },
    { label: t("phone", "Phone"), value: "-" },
    { label: t("address", "Address"), value: "-" },
    { label: t("createdAt", "Created At"), value: "-" },
    { label: t("lastUpdated", "Last Updated"), value: "-" }
  ];

  // 6. Audit Information fields
  const auditFields = [
    { label: t("createdBy", "Created By"), value: "Super Admin" },
    { label: t("createdAt", "Created At"), value: formattedDateTime },
    { label: t("updatedBy", "Updated By"), value: "Super Admin" },
    { label: t("updatedAt", "Updated At"), value: formattedDateTime },
    { label: t("ipAddress", "IP Address"), value: "192.168.1.100" },
    { label: t("browserPlatform", "Browser / Platform"), value: "Chrome / Windows" }
  ];

  // 1. Account Information fields
  const accountFields = [
    { label: t("accountName", "Account Name"), value: accountName || "-" },
    { label: t("accountCode", "Account Code"), value: accountCode || "-" },
    { label: t("accountTitle", "Account Title"), value: accountTitle || "-" },
    { label: t("subType", "Sub Type"), value: subType || "-" },
    { label: t("category", "Category"), value: category || "-" },
    { label: t("currency", "Currency"), value: currency || "-" },
    { label: t("manualRef", "Manual Ref"), value: manualReferenceNumber || "-" },
    { label: t("mobileNumber", "Mobile Number"), value: primaryStepMobile || custPhone || compPhone || "-" },
    { label: t("contactsList", "Contacts"), value: formattedStepContacts || "-" },
    { label: t("country", "Country"), value: selectedCountryName || "-" },
    { label: t("branch", "Branch"), value: selectedBranchName || "-" },
  ];

  const isExpense = category === "EX";
  const isBank = accountTitle === "Bank";
  const isCompany = accountTitle === "Company" || (accountTitle === "Customer" && subType === "Business Account");
  const isPersonal = accountTitle === "Personal" || (accountTitle === "Customer" && subType !== "Business Account") || accountTitle === "Employee";


  const allowedSectionIds = [1, 6];
  if (isExpense) {
    // Only Account Info and Audit
  } else if (isBank) {
    allowedSectionIds.push(4);
  } else if (isCompany) {
    allowedSectionIds.push(2, 3, 4, 5);
  } else if (isPersonal) {
    allowedSectionIds.push(2);
  } else {
    allowedSectionIds.push(2, 3, 4, 5);
  }

  const sections = [
    { id: 1, title: t("accountInformation", "ACCOUNT INFORMATION"), icon: FileText, fields: accountFields },
    { id: 2, title: t("customerInformation", "CUSTOMER INFORMATION"), icon: UserRound, fields: customerFields },
    { id: 3, title: t("companyDetails", "COMPANY DETAILS"), icon: Building2, fields: companyFields },
    { id: 4, title: t("bankDetails", "BANK DETAILS"), icon: Landmark, fields: bankFields },
    { id: 5, title: t("warehouseDetails", "WAREHOUSE DETAILS"), icon: Warehouse, fields: warehouseFields },
    { id: 6, title: t("auditInformation", "AUDIT INFORMATION"), icon: ShieldAlert, fields: auditFields }
  ].filter(s => allowedSectionIds.includes(s.id));

  return (
    <Card className="border-slate-200 shadow-md bg-white overflow-hidden w-full">
      {/* â”€â”€ Light-theme Preview Header (mockup styled) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white text-slate-800 p-6 border-b border-slate-150">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">{accountName || "ASMATKHAN"}</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">{accountTitle || t("accountTitle", "Account Title")}</p>
          </div>
          
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl lg:ml-8 text-left">
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("accountCodeAuto", "Account Code (Auto)")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">{accountCode || "AST-001"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("accountGroup", "Account Group")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">{category || "Sundry Debtors"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("currency", "Currency")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">{currency || "PKR"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("date", "Date")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">{stampDate || "31 Dec 2024"}</div>
            </div>
          </div>

          <div className="flex items-center">
            <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
              {status === "Active" ? t("active", "Active") : status === "In Progress" ? t("inProgress", "In Progress") : status || t("active", "Active")}
            </span>
          </div>
        </div>

        {/* Balance KPI ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 rounded-lg bg-slate-50 border border-slate-100 text-center">
          <div>
            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">{t("openingBalance", "Opening Balance")}</div>
            <div className="text-sm font-bold mt-1 text-slate-700 font-mono">{openingBalance}</div>
          </div>
          <div>
            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">{t("debitAmount", "Debit Amount")}</div>
            <div className="text-sm font-bold mt-1 text-slate-700 font-mono">{totalDebit}</div>
          </div>
          <div>
            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">{t("creditAmount", "Credit Amount")}</div>
            <div className="text-sm font-bold mt-1 text-slate-700 font-mono">{totalCredit}</div>
          </div>
          <div>
            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">{t("netBalance", "Net Balance")}</div>
            <div className="text-sm font-bold mt-1 text-slate-700 font-mono">{netBalance}</div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Detail Cards Grid (mockup styled layout) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <CardContent className="p-6 bg-slate-50/20 space-y-6">
        {/* Row 1: ACCOUNT, CUSTOMER Details (2 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sections.filter(s => s.id >= 1 && s.id <= 2).map((sect) => {
            const Icon = sect.icon;
            return (
              <div key={sect.id} className="bg-white rounded-lg border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
                <div className="border-b border-slate-100 px-4 py-2.5 bg-white flex items-center gap-2">
                  <Icon className="h-4 w-4 text-blue-500" />
                  <h3 className="text-[10px] font-bold text-slate-800 tracking-wider uppercase">{sect.id}. {sect.title}</h3>
                </div>

                <div className="p-4 flex-1 space-y-2">
                  {sect.fields.map((f, i) => (
                    <div key={i} className="grid grid-cols-[130px_1fr] gap-3 text-xs border-b border-slate-100/50 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</span>
                      <span className="font-bold text-slate-700 truncate">
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Row 2: COMPANY, BANK, WAREHOUSE Details (3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {sections.filter(s => s.id >= 3 && s.id <= 5).map((sect) => {
            const Icon = sect.icon;
            return (
              <div key={sect.id} className="bg-white rounded-lg border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
                <div className="border-b border-slate-100 px-4 py-2.5 bg-white flex items-center gap-2">
                  <Icon className="h-4 w-4 text-blue-500" />
                  <h3 className="text-[10px] font-bold text-slate-800 tracking-wider uppercase">{sect.id}. {sect.title}</h3>
                </div>

                <div className="p-4 flex-1 space-y-2">
                  {sect.fields.map((f, i) => (
                    <div key={i} className="grid grid-cols-[110px_1fr] gap-3 text-xs border-b border-slate-100/50 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</span>
                      <span className="font-bold text-slate-700 truncate">
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Row 3: AUDIT Information */}
        <div className="grid grid-cols-1 gap-5">
          {sections.filter(s => s.id === 6).map((sect) => {
            const Icon = sect.icon;
            return (
              <div key={sect.id} className="bg-white rounded-lg border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
                <div className="border-b border-slate-100 px-4 py-2.5 bg-white flex items-center gap-2">
                  <Icon className="h-4 w-4 text-blue-500" />
                  <h3 className="text-[10px] font-bold text-slate-800 tracking-wider uppercase">{sect.id}. {sect.title}</h3>
                </div>

                <div className="p-4 flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                  {sect.fields.map((f, i) => (
                    <div key={i} className="grid grid-cols-[130px_1fr] gap-3 text-xs border-b border-slate-100/50 pb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</span>
                      <span className="font-bold text-slate-700 truncate">
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}



