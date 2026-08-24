import fs from 'fs';

const filePath = 'features/accounts/components/account-live-report-panel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Ensure transliteration is imported
const oldTop = `"use client";

import type { ReactNode } from "react";
import type { SupportedLanguage } from "@/lib/i18n/languages";`;

const newTop = `"use client";

import type { ReactNode } from "react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";`;

content = content.replace(oldTop, newTop);

// Replace liveReportLabels with complete authentic Urdu translation
const oldLabelsBlock = `const liveReportLabels: Record<string, Partial<Record<SupportedLanguage, string>>> = {
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
};`;

const newLabelsBlock = `const liveReportLabels: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  active: { en: "Active", ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" },
  inProgress: { en: "In Progress", ur: "جاری ہے", ar: "قيد التنفيذ", fa: "در حال اجرا", ps: "په جریان کې" },
  accountTitle: { en: "Account Title", ur: "اکاؤنٹ عنوان" },
  accountCodeAuto: { en: "Account Code (Auto)", ur: "اکاؤنٹ کوڈ (خودکار)" },
  accountGroup: { en: "Account Group", ur: "اکاؤنٹ گروپ" },
  currency: { en: "Currency", ur: "کرنسی" },
  date: { en: "Date", ur: "تاریخ" },
  openingBalance: { en: "Opening Balance", ur: "ابتدائی بیلنس" },
  debitAmount: { en: "Debit Amount", ur: "ڈیبٹ رقم" },
  creditAmount: { en: "Credit Amount", ur: "کریڈٹ رقم" },
  netBalance: { en: "Net Balance", ur: "نیٹ بیلنس" },
  accountInformation: { en: "ACCOUNT INFORMATION", ur: "اکاؤنٹ کی معلومات" },
  customerInformation: { en: "CUSTOMER INFORMATION", ur: "کسٹمر کی معلومات" },
  customerName: { en: "Customer Name", ur: "کسٹمر کا نام" },
  customerCode: { en: "Customer Code", ur: "کسٹمر کوڈ" },
  customerType: { en: "Customer Type", ur: "کسٹمر کی قسم" },
  phone: { en: "Phone", ur: "فون نمبر" },
  email: { en: "Email", ur: "ای میل" },
  address: { en: "Address", ur: "پتہ" },
  lastUpdated: { en: "Last Updated", ur: "آخری اپ ڈیٹ" },
  companyDetails: { en: "COMPANY DETAILS", ur: "کمپنی کی تفصیلات" },
  companyName: { en: "Company Name", ur: "کمپنی کا نام" },
  companyCode: { en: "Company Code", ur: "کمپنی کوڈ" },
  registrationNo: { en: "Registration No.", ur: "رجسٹریشن نمبر" },
  bankDetails: { en: "BANK DETAILS", ur: "بینک کی تفصیلات" },
  bankName: { en: "Bank Name", ur: "بینک کا نام" },
  accountNumber: { en: "Account Number", ur: "اکاؤنٹ نمبر" },
  bankBranch: { en: "Bank Branch", ur: "بینک برانچ" },
  swiftCode: { en: "Swift Code", ur: "سوئفٹ کوڈ" },
  warehouseDetails: { en: "WAREHOUSE DETAILS", ur: "گودام کی تفصیلات" },
  warehouseName: { en: "Warehouse Name", ur: "گودام کا نام" },
  warehouseCode: { en: "Warehouse Code", ur: "گودام کوڈ" },
  location: { en: "Location", ur: "مقام" },
  auditInformation: { en: "AUDIT INFORMATION", ur: "آڈٹ معلومات" },
  accountName: { en: "Account Name", ur: "اکاؤنٹ کا نام" },
  accountCode: { en: "Account Code", ur: "اکاؤنٹ کوڈ" },
  subType: { en: "Sub Type", ur: "ذیلی قسم" },
  category: { en: "Category", ur: "کیٹیگری" },
  manualRef: { en: "Manual Ref", ur: "دستی حوالہ" },
  country: { en: "Country", ur: "ملک" },
  branch: { en: "Branch", ur: "برانچ" },
  createdBy: { en: "Created By", ur: "بنایا گیا بذریعہ" },
  createdAt: { en: "Created At", ur: "تخلیق کی تاریخ" },
  updatedBy: { en: "Updated By", ur: "اپ ڈیٹ بذریعہ" },
  updatedAt: { en: "Updated At", ur: "اپ ڈیٹ کا وقت" },
  ipAddress: { en: "IP Address", ur: "آئی پی ایڈریس" },
  browserPlatform: { en: "Browser / Platform", ur: "براؤزر / پلیٹ فارم" },
  mobileNumber: { en: "Mobile Number", ur: "موبائل نمبر", ar: "رقم الهاتف المحمول", fa: "شماره موبایل", ps: "د موبایل شمیره" },
  contactsList: { en: "Contacts", ur: "رابطہ نمبرز", ar: "جهات الاتصال", fa: "مخاطبین", ps: "اړیکې" }
};`;

content = content.replace(oldLabelsBlock, newLabelsBlock);

// Add helper functions
const helperCode = `
  const trName = (val: string | null | undefined) => {
    if (!val || val === "-") return "-";
    return lang === "ur" ? transliterateProperNoun(val, "ur") : val;
  };

  const trTerm = (val: string | null | undefined) => {
    if (!val || val === "-") return "-";
    return localizeTerm(val, lang);
  };
`;

content = content.replace('  const t = (key: string, fallback: string) => liveReportLabels[key]?.[lang] || liveReportLabels[key]?.en || fallback;', '  const t = (key: string, fallback: string) => liveReportLabels[key]?.[lang] || liveReportLabels[key]?.en || fallback;\n' + helperCode);

// Apply trName / trTerm to values
content = content.replace(
  `{ label: t("customerName", "Customer Name"), value: custObj?.customer_name || custObj?.name || (accountTitle === "Customer" ? accountName : "-") },`,
  `{ label: t("customerName", "Customer Name"), value: trName(custObj?.customer_name || custObj?.name || (accountTitle === "Customer" ? accountName : "-")) },`
);

content = content.replace(
  `{ label: t("customerType", "Customer Type"), value: custObj?.customer_type || subType || "Company / Individual" },`,
  `{ label: t("customerType", "Customer Type"), value: trTerm(custObj?.customer_type || subType || "Company / Individual") },`
);

content = content.replace(
  `{ label: t("companyName", "Company Name"), value: companyDetail?.companyName || companyDetail?.name || companyDetail?.legal_name || (accountTitle === "Company" ? accountName : "-") },`,
  `{ label: t("companyName", "Company Name"), value: trName(companyDetail?.companyName || companyDetail?.name || companyDetail?.legal_name || (accountTitle === "Company" ? accountName : "-")) },`
);

content = content.replace(
  `{ label: t("bankName", "Bank Name"), value: bankDetail?.bank_name || bankDetail?.bankName || bankDetail?.name || (accountTitle === "Bank" ? accountName : "-") },`,
  `{ label: t("bankName", "Bank Name"), value: trName(bankDetail?.bank_name || bankDetail?.bankName || bankDetail?.name || (accountTitle === "Bank" ? accountName : "-")) },`
);

content = content.replace(
  `{ label: t("accountTitle", "Account Title"), value: bankDetail?.account_title || accountName || "-" },`,
  `{ label: t("accountTitle", "Account Title"), value: trName(bankDetail?.account_title || accountName || "-") },`
);

content = content.replace(
  `{ label: t("accountName", "Account Name"), value: accountName || "-" },`,
  `{ label: t("accountName", "Account Name"), value: trName(accountName || "-") },`
);

content = content.replace(
  `{ label: t("accountTitle", "Account Title"), value: accountTitle || "-" },`,
  `{ label: t("accountTitle", "Account Title"), value: trTerm(accountTitle || "-") },`
);

content = content.replace(
  `{ label: t("subType", "Sub Type"), value: subType || "-" },`,
  `{ label: t("subType", "Sub Type"), value: trTerm(subType || "-") },`
);

content = content.replace(
  `{ label: t("category", "Category"), value: category || "-" },`,
  `{ label: t("category", "Category"), value: trTerm(category || "-") },`
);

content = content.replace(
  `{ label: t("country", "Country"), value: selectedCountryName || "-" },`,
  `{ label: t("country", "Country"), value: trTerm(selectedCountryName || "-") },`
);

content = content.replace(
  `{ label: t("branch", "Branch"), value: selectedBranchName || "-" },`,
  `{ label: t("branch", "Branch"), value: trName(selectedBranchName || "-") },`
);

// Header title localization
content = content.replace(
  `<h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">{accountName || "ASMATKHAN"}</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">{accountTitle || t("accountTitle", "Account Title")}</p>`,
  `<h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">{trName(accountName || "ASMATKHAN")}</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">{trTerm(accountTitle || t("accountTitle", "Account Title"))}</p>`
);

content = content.replace(
  `<div className="text-xs font-bold mt-1 text-slate-700">{category || "Sundry Debtors"}</div>`,
  `<div className="text-xs font-bold mt-1 text-slate-700">{trTerm(category || "Sundry Debtors")}</div>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Clean patch applied to account-live-report-panel.tsx!');
