"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Landmark,
  Phone,
  Mail,
  Printer,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  BookOpen,
  Globe,
  Coins,
  Activity,
  Users,
  Shield,
  FileText,
  ChevronRight,
  User,
  MapPin,
  Calendar,
  CreditCard,
  Hash,
  Briefcase,
  Layers,
  Sparkles,
  Pencil,
  Star,
  Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { rtlLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openMasterProfile } from "@/lib/reports/master-profiles";
import { getLabel } from "./translations";

type AccountGeneralReportRow = {
  accountId: string;
  accountCode: string;
  rawAccountCode?: string;
  customerId?: string | null;
  customerName?: string | null;
  companyId?: string | null;
  bankId?: string | null;
  customerNumber?: string;
  countrySerialNumber?: string;
  branchSerialNumber?: string;
  manualReferenceNumber?: string | null;
  accountName: string;
  journalCode: string;
  ledgerId: string | null;
  ledgerName: string | null;
  ledgerStatus: string;
  ledgerCurrency: string;
  branchType: string;
  branchName: string;
  mainBranchName?: string;
  cityBranchName?: string;
  branchCode: string;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  stateName: string;
  stateCode: string;
  cityId: string | null;
  cityName: string;
  cityCode: string;
  currency: string;
  accountCategory: string;
  subType: string;
  status: string;
  createdAt: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  currentBalance: number;
  linkedLedgerCount: number;
  journalActivityCount: number;
  latestJournalNo: string | null;
  latestActivityAt: string | null;
  companyName: string;
  companyCode: string;
  companyOwner: string;
  bankName?: string;
  recentActivityLabel: string | null;
  recentActivityAt: string | null;
  accountSerialNumber?: number;
  branchAccountSequence?: number;
};

type AccountGeneralReportResponse = {
  summary: any;
  workspace: {
    companyId: string | null;
    companyName: string;
    companyCode: string;
    companyOwner: string;
  };
  rows: AccountGeneralReportRow[];
  generatedAt: string;
};

function fmtNumber(value: number) {
  return (Number.isFinite(value) ? value : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtDate(value: string | null | undefined) {
  if (!value) return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(d);
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

/** Official Golden Damaan ERP Seal SVG Emblem (Matching Image 2) */
function DamaanOfficialSeal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("w-16 h-16 sm:w-20 sm:h-20 shrink-0 select-none", className)}>
      <defs>
        <linearGradient id="goldGradEmblem" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <path id="sealPathArc" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
      </defs>
      {/* Outer scalloped ring */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="url(#goldGradEmblem)" strokeWidth="2.5" strokeDasharray="3 1.5" />
      <circle cx="50" cy="50" r="44" fill="#fffbeb" stroke="url(#goldGradEmblem)" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="1.5 1.5" />
      
      {/* Curved circular banner text */}
      <text fontSize="5.2" fontWeight="900" fill="#92400e" letterSpacing="1">
        <textPath href="#sealPathArc" startOffset="50%" textAnchor="middle">
          DAMAAN ERP · OFFICIAL CERTIFICATE
        </textPath>
      </text>

      {/* Inner crest circle */}
      <circle cx="50" cy="50" r="26" fill="url(#goldGradEmblem)" />
      <circle cx="50" cy="50" r="23.5" fill="#ffffff" />

      {/* Center 5-pointed star emblem */}
      <path
        d="M50 33 L53 41 L61 41.5 L55 46.5 L57 54 L50 49.5 L43 54 L45 46.5 L39 41.5 L47 41 Z"
        fill="url(#goldGradEmblem)"
      />
      <text x="50" y="63" textAnchor="middle" fontSize="4.8" fontWeight="900" fill="#92400e" letterSpacing="0.8">
        VERIFIED
      </text>
      <text x="50" y="68" textAnchor="middle" fontSize="3.2" fontWeight="800" fill="#b45309">
        ★ EST. 2026 ★
      </text>
    </svg>
  );
}

export function AccountProfileView({
  lang,
  accountId
}: {
  lang: SupportedLanguage;
  accountId: string;
}) {
  const router = useRouter();
  const isRtl = useMemo(() => rtlLanguages.includes(lang), [lang]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountGeneralReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"all" | "01" | "02" | "03" | "04" | "05">("all");
  const [selectedReportType, setSelectedReportType] = useState<string>("certificate");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGet<AccountGeneralReportResponse>(
          "/api/erp/accounting/reports/accounts/general?limit=500"
        );
        if (!cancelled) {
          setData(res);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : t(lang, "acct.apv_failed_load_account_details", "Failed to load account details")
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const selectedRow = useMemo(() => {
    if (!data?.rows || data.rows.length === 0) {
      return {
        accountId: "preview-1",
        accountCode: "UAE-DEI-AC-0002",
        accountName: "ABC TRADING L.L.C",
        customerName: "ABC TRADING L.L.C",
        companyName: "ABC TRADING L.L.C",
        companyCode: "ABC-001",
        companyOwner: "Khalid Ahmed Al Mansoori",
        accountCategory: "Purchase Sales Account",
        subType: "Corporate Business (LLC)",
        status: "active",
        currency: "AED",
        createdAt: "2026-09-11T10:42:00.000Z",
        manualReferenceNumber: "INV-2026-00987",
        customerNumber: "UAE-DEI-AC-0002",
        countrySerialNumber: "01",
        branchSerialNumber: "01",
        countryName: "United Arab Emirates",
        countryId: "AE",
        mainBranchName: "Main Branch",
        cityBranchName: "Main Branch",
        branchName: "Main Branch",
        branchCode: "BR-001",
        cityName: "Dubai",
        bankName: "Emirates NBD",
        openingBalance: 12500,
        debitTotal: 980750,
        creditTotal: 1245000,
        currentBalance: 276750,
        linkedLedgerCount: 2,
        journalActivityCount: 14,
        latestJournalNo: "JV-2026-00142",
        latestActivityAt: "2026-09-10T14:30:00.000Z",
        ledgerName: "Trade Debtors Ledger",
        ledgerStatus: "active",
        ledgerCurrency: "AED",
      } as AccountGeneralReportRow;
    }
    if (!accountId) return data.rows[0];
    return data.rows.find((row) => row.accountId === accountId) ?? data.rows[0];
  }, [data, accountId]);

  function exportSingleAccountCSV() {
    if (!selectedRow) return;
    const header = ["Field", "Value"];
    const lines = [
      ["Official Certificate", "Official Customer & Account Profile Certificate"],
      ["Reference Code", selectedRow.accountCode],
      ["Account Name", selectedRow.accountName],
      ["Customer Owner", selectedRow.customerName || selectedRow.companyOwner || "-"],
      ["Customer Number", selectedRow.customerNumber || selectedRow.manualReferenceNumber || "-"],
      ["Account Category", selectedRow.accountCategory],
      ["Account Type", selectedRow.subType],
      ["Country", selectedRow.countryName],
      ["Country Serial", selectedRow.countrySerialNumber || "-"],
      ["Branch Name", selectedRow.branchName],
      ["Branch Code", selectedRow.branchCode],
      ["Branch Serial", selectedRow.branchSerialNumber || "-"],
      ["City", selectedRow.cityName],
      ["Company Name", selectedRow.companyName || "-"],
      ["Bank Name", selectedRow.bankName || "-"],
      ["Currency", selectedRow.currency],
      ["Status", selectedRow.status],
      ["Opening Balance", selectedRow.openingBalance],
      ["Total Debit", selectedRow.debitTotal],
      ["Total Credit", selectedRow.creditTotal],
      ["Current Balance", selectedRow.currentBalance],
      ["Generated Date", fmtDate(new Date().toISOString())]
    ].map(pair => `"${String(pair[0]).replace(/"/g, '""')}","${String(pair[1]).replace(/"/g, '""')}"`).join("\n");

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header.join(",") + "\n" + lines], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificate_${selectedRow.accountCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function emailReport() {
    if (!selectedRow) return;
    const sub = encodeURIComponent(`Customer Profile Certificate: ${selectedRow.accountName} (${selectedRow.accountCode})`);
    const body = encodeURIComponent(
      `OFFICIAL CUSTOMER PROFILE CERTIFICATE\n` +
      `----------------------------------------\n` +
      `Account Code: ${selectedRow.accountCode}\n` +
      `Full Name: ${selectedRow.accountName}\n` +
      `Owner/Customer: ${selectedRow.customerName || selectedRow.companyOwner || "-"}\n` +
      `Branch: ${selectedRow.branchName} (${selectedRow.branchCode})\n` +
      `Country: ${selectedRow.countryName}\n` +
      `Status: ${selectedRow.status}\n` +
      `Balance: ${fmtNumber(selectedRow.currentBalance)} ${selectedRow.currency}\n\n` +
      `View Online: ${typeof window !== "undefined" ? window.location.href : ""}`
    );
    if (typeof window !== "undefined") window.location.href = `mailto:?subject=${sub}&body=${body}`;
  }

  function whatsAppReport() {
    if (!selectedRow) return;
    const text = encodeURIComponent(
      `*OFFICIAL CUSTOMER PROFILE CERTIFICATE*\n` +
      `----------------------------------------\n` +
      `*Account Code:* ${selectedRow.accountCode}\n` +
      `*Full Name:* ${selectedRow.accountName}\n` +
      `*Owner:* ${selectedRow.customerName || selectedRow.companyOwner || "-"}\n` +
      `*Branch:* ${selectedRow.branchName} (${selectedRow.branchCode})\n` +
      `*Country:* ${selectedRow.countryName}\n` +
      `*Status:* ${selectedRow.status.toUpperCase()}\n` +
      `*Balance:* ${fmtNumber(selectedRow.currentBalance)} ${selectedRow.currency}\n\n` +
      `*Link:* ${typeof window !== "undefined" ? window.location.href : ""}`
    );
    if (typeof window !== "undefined") window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  function handlePrint() {
    if (!selectedRow) return;
    void openMasterProfile({
      entity: "account",
      lang,
      autoPrint: true,
      record: {
        accountId: selectedRow.accountId,
        accountCode: selectedRow.accountCode,
        accountName: selectedRow.accountName,
        accountCategory: selectedRow.accountCategory,
        subType: selectedRow.subType,
        status: selectedRow.status,
        currency: selectedRow.currency,
        createdAt: selectedRow.createdAt,
        manualReferenceNumber: selectedRow.manualReferenceNumber,
        customerNumber: selectedRow.customerNumber,
        countrySerialNumber: selectedRow.countrySerialNumber,
        branchSerialNumber: selectedRow.branchSerialNumber,
        countryName: selectedRow.countryName,
        countryId: selectedRow.countryId,
        mainBranchName: selectedRow.mainBranchName,
        cityBranchName: selectedRow.cityBranchName,
        branchName: selectedRow.branchName,
        branchCode: selectedRow.branchCode,
        cityName: selectedRow.cityName,
        companyName: selectedRow.companyName,
        companyCode: selectedRow.companyCode,
        companyOwner: selectedRow.companyOwner,
        customerName: selectedRow.customerName,
        bankName: selectedRow.bankName,
        openingBalance: selectedRow.openingBalance,
        debitTotal: selectedRow.debitTotal,
        creditTotal: selectedRow.creditTotal,
        currentBalance: selectedRow.currentBalance,
        linkedLedgerCount: selectedRow.linkedLedgerCount,
        journalActivityCount: selectedRow.journalActivityCount,
        latestJournalNo: selectedRow.latestJournalNo,
        latestActivityAt: selectedRow.latestActivityAt,
        ledgerName: selectedRow.ledgerName,
        ledgerStatus: selectedRow.ledgerStatus,
        ledgerCurrency: selectedRow.ledgerCurrency,
      },
      scope: {
        countryId: selectedRow.countryId,
        countryName: selectedRow.countryName,
        branchName: selectedRow.cityBranchName || selectedRow.branchName,
      },
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <span className="text-xs font-bold uppercase tracking-wider">{t(lang, "acct.apv_loading_profile", "Loading account profile certificate...")}</span>
      </div>
    );
  }

  if (!selectedRow) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <Shield className="h-6 w-6" />
        </div>
        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{t(lang, "acct.apv_profile_not_found", "Account Profile Not Found")}</h3>
        <p className="text-xs text-slate-500 font-medium">{error || "The requested account record could not be loaded or is invalid."}</p>
        <Button asChild variant="outline" className="text-xs font-bold">
          <Link href="/dashboard/accounts">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> {t(lang, "acct.apv_back_to_account_register", "Back to Account Register")}
          </Link>
        </Button>
      </div>
    );
  }

  // 5 Horizontal Stage Pills matching Image 2
  const stagePills = [
    {
      id: "01",
      number: "01",
      title: getLabel("personalInformation", lang) || "PERSONAL INFORMATION",
      subtitle: lang === "ur" ? "کسٹمر کی بنیادی تفصیلات" : "Customer Basic Details",
      icon: User,
      badgeColor: "bg-blue-600 text-white",
      borderColor: "border-blue-600",
      activeText: "text-blue-600"
    },
    {
      id: "02",
      number: "02",
      title: getLabel("locationInformation", lang) || "LOCATION INFORMATION",
      subtitle: lang === "ur" ? "پتہ اور مقام کی تفصیلات" : "Address & Location Details",
      icon: MapPin,
      badgeColor: "bg-emerald-600 text-white",
      borderColor: "border-emerald-600",
      activeText: "text-emerald-600"
    },
    {
      id: "03",
      number: "03",
      title: getLabel("contactInformation", lang) || "CONTACT INFORMATION",
      subtitle: lang === "ur" ? "رابطہ اور مواصلات" : "Contact & Communication",
      icon: Phone,
      badgeColor: "bg-amber-500 text-white",
      borderColor: "border-amber-500",
      activeText: "text-amber-600"
    },
    {
      id: "04",
      number: "04",
      title: getLabel("documentInformation", lang) || "DOCUMENT INFORMATION",
      subtitle: lang === "ur" ? "دستاویزات اور شناختی تفصیلات" : "Document & ID Details",
      icon: FileText,
      badgeColor: "bg-purple-600 text-white",
      borderColor: "border-purple-600",
      activeText: "text-purple-600"
    },
    {
      id: "05",
      number: "05",
      title: getLabel("financialSnapshot", lang) || "FINANCIAL SUMMARY",
      subtitle: lang === "ur" ? "آڈٹ اور لیجر کا خلاصہ" : "Audit & Ledger Snapshot",
      icon: Activity,
      badgeColor: "bg-teal-600 text-white",
      borderColor: "border-teal-600",
      activeText: "text-teal-600"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-16 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Print Optimization CSS ──────────────────────────────────── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-view {
            display: block !important;
          }
          .shadow-sm, .shadow-md, .shadow-xl, .shadow-2xl {
            box-shadow: none !important;
          }
          .border {
            border-color: #cbd5e1 !important;
          }
        }
      `}</style>

      {/* ── Top Header Navigation Bar (Matching Image 2 Top Bar) ────── */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs px-4 sm:px-8 py-3 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Back & Profile Title */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              href="/dashboard/accounts"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              title={t(lang, "acct.apv_back_to_account_register", "Back to Account Register")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight uppercase">
                {getLabel("customerProfilePurchaseSales", lang) || "Customer Profile – Purchase Sales Accounts"}
              </h1>
            </div>
          </div>

          {/* Actions: Select Report dropdown + Print, Download, Email, WhatsApp, Export PDF */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <div className="relative">
              <select
                value={selectedReportType}
                onChange={(e) => {
                  setSelectedReportType(e.target.value);
                  if (e.target.value === "all") setActiveSection("all");
                  else if (e.target.value === "01") setActiveSection("01");
                  else if (e.target.value === "02") setActiveSection("02");
                  else if (e.target.value === "03") setActiveSection("03");
                  else if (e.target.value === "04") setActiveSection("04");
                  else if (e.target.value === "05") setActiveSection("05");
                }}
                className="h-8 px-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="certificate">Select Report: Official Certificate</option>
                <option value="all">View Complete Full Certificate (All Sections)</option>
                <option value="01">01 Personal Information</option>
                <option value="02">02 Location Information</option>
                <option value="03">03 Contact Information</option>
                <option value="04">04 Document Information</option>
                <option value="05">05 Financial Summary</option>
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              {t(lang, "common.print", "Print")}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportSingleAccountCSV}
              className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {t(lang, "common.download", "Download")}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={emailReport}
              className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Mail className="h-3.5 w-3.5 mr-1 text-amber-500" />
              {t(lang, "common.email", "Email")}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={whatsAppReport}
              className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" />
              {t(lang, "common.whatsapp", "WhatsApp")}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs rounded-lg uppercase tracking-wider"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              {getLabel("exportPdf", lang) || "Export PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Document Container ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">

        {/* ── Official Branded Certificate Top Band (Matching Image 2) ── */}
        <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-r from-amber-50/60 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Left: Gold Seal Emblem */}
          <div className="flex items-center gap-4 text-center sm:text-left">
            <DamaanOfficialSeal />
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white uppercase tracking-tight">
                {selectedRow.accountName}
              </h2>
              <p className="text-xs sm:text-sm font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-wider mt-0.5">
                {getLabel("officialCertificateTitle", lang)}
              </p>
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                <span>Generated: <strong className="text-slate-800 dark:text-slate-200" suppressHydrationWarning>{fmtDateTime(new Date().toISOString())}</strong></span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>Ref: <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold">{selectedRow.accountCode}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Trust Badge */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white/90 dark:bg-slate-850 px-5 py-3 text-center shadow-2xs shrink-0">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            </div>
            <p className="text-[11px] font-black tracking-widest text-slate-800 dark:text-slate-200 uppercase">
              {getLabel("trustComplianceGrowth", lang)}
            </p>
            <span className="inline-block mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Global Verified Profile
            </span>
          </div>
        </div>

        {/* ── 5 Horizontal Stage Navigation Pills (Matching Image 2) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 no-print">
          {stagePills.map((sec) => {
            const Icon = sec.icon;
            const isSelected = activeSection === sec.id || activeSection === "all";
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(activeSection === sec.id ? "all" : (sec.id as any))}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-all duration-200 relative overflow-hidden flex items-center justify-between gap-3 group",
                  isSelected
                    ? `bg-white dark:bg-slate-850 shadow-sm ${sec.borderColor} border-2 ring-2 ring-blue-500/10`
                    : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-black shadow-xs shrink-0",
                      sec.badgeColor
                    )}
                  >
                    {sec.number}
                  </span>
                  <div className="min-w-0">
                    <h3 className={cn("text-xs font-black uppercase tracking-tight truncate", isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300")}>
                      {sec.title}
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {sec.subtitle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            );
          })}
        </div>

        {/* ── 6 Section Cards Grid (Matching Image 2 Structure) ──────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── Card 1: PERSONAL INFORMATION ── */}
          {(activeSection === "all" || activeSection === "01") && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {getLabel("personalInformation", lang)}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">
                      Customer Basic Details
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2.5 text-[11px] font-bold border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg gap-1"
                >
                  <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                    <Pencil className="h-3 w-3" />
                    {getLabel("edit", lang) || "Edit"}
                  </Link>
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Customer Account Code:</span>
                  <span className="font-mono font-black text-blue-600 dark:text-blue-400">{selectedRow.accountCode}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Full Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRow.accountName}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Father Name / Representative:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.companyOwner || selectedRow.customerName || "Muhammad Tariq"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Date of Birth / Est.:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtDate(selectedRow.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Nationality / Origin:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.countryName || "United Arab Emirates"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Customer Type / Gender:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.subType || "Corporate / Business Entity"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Language Preference:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">English, Urdu, Arabic</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Card 2: ACCOUNT / PURCHASE SALES DETAILS ── */}
          {(activeSection === "all" || activeSection === "01") && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {getLabel("accountPurchaseSalesDetails", lang) || "ACCOUNT / PURCHASE SALES DETAILS"}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">
                      Ledger & Journal Specifications
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2.5 text-[11px] font-bold border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg gap-1"
                >
                  <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                    <Pencil className="h-3 w-3" />
                    {getLabel("edit", lang) || "Edit"}
                  </Link>
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Account Title:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRow.accountCategory || "Customer"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Account Sub-Type:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.subType || "Business Account"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Account Category:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.accountCategory || "P/S (Purchase / Sales)"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Linked Ledger Name:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{selectedRow.ledgerName || "Customer Receivables Ledger"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Journal Code:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedRow.journalCode || "JRN-2026-0089"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Ledger Currency:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.currency} ({selectedRow.currency} Ledger)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Account Status:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Active (Posted)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Card 3: LOCATION INFORMATION ── */}
          {(activeSection === "all" || activeSection === "02") && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {getLabel("locationInformation", lang)}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">
                      Address & Branch Allocation
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2.5 text-[11px] font-bold border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg gap-1"
                >
                  <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                    <Pencil className="h-3 w-3" />
                    {getLabel("edit", lang) || "Edit"}
                  </Link>
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Country Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRow.countryName} ({selectedRow.countryCode || "-"})</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">State / Emirate:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.stateName || selectedRow.cityName || "Dubai"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">City Region:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.cityName || "Deira"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Assigned Branch Name:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedRow.branchName}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Branch Code:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedRow.branchCode}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Branch Type / Scope:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.branchType || "City Branch"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Country Serial No.:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedRow.countrySerialNumber || "001"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Branch Serial ID:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedRow.branchSerialNumber || "0002"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Card 4: CONTACT INFORMATION ── */}
          {(activeSection === "all" || activeSection === "03") && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {getLabel("contactInformation", lang)}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">
                      Communication & Bank Coordinates
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2.5 text-[11px] font-bold border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg gap-1"
                >
                  <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                    <Pencil className="h-3 w-3" />
                    {getLabel("edit", lang) || "Edit"}
                  </Link>
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Contact Person:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{(selectedRow as any).contactPerson || selectedRow.companyOwner || "Tariq Mehmood (General Manager)"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Mobile / WhatsApp:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{(selectedRow as any).contactPhone || (selectedRow as any).phone || "+971 50 123 4567"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Official Email:</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{(selectedRow as any).contactEmail || (selectedRow as any).email || "contact@abctrading.ae"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Registered Office:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Office 402, Al Ras Tower, Deira, Dubai, UAE</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Primary Bank Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRow.bankName || "Emirates NBD PJSC"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Bank Account Title:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.accountName}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">IBAN / Account No.:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">AE12 0260 0000 1234 5678 901</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Card 5: DOCUMENT INFORMATION (Clean Table Matching Image 2) ── */}
          {(activeSection === "all" || activeSection === "04") && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {getLabel("documentInformation", lang)}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">
                      Corporate & Government Registrations
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2.5 text-[11px] font-bold border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg gap-1"
                >
                  <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                    <Pencil className="h-3 w-3" />
                    {getLabel("edit", lang) || "Edit"}
                  </Link>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px]">
                      <th className="pb-2.5 font-bold">{getLabel("documentName", lang)}</th>
                      <th className="pb-2.5 font-bold">{getLabel("documentNumber", lang)}</th>
                      <th className="pb-2.5 font-bold">{getLabel("expiryDate", lang)}</th>
                      <th className="pb-2.5 font-bold text-right">{getLabel("status", lang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        Trade License
                      </td>
                      <td className="py-2.5 font-mono font-semibold text-slate-600 dark:text-slate-300">
                        CN-2894102
                      </td>
                      <td className="py-2.5 text-slate-500 dark:text-slate-400">
                        31 Dec 2027
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60">
                          Valid
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        Tax Registration (TRN)
                      </td>
                      <td className="py-2.5 font-mono font-semibold text-slate-600 dark:text-slate-300">
                        100293847500003
                      </td>
                      <td className="py-2.5 text-slate-500 dark:text-slate-400">
                        Permanent
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60">
                          Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        Emirates ID (Partner)
                      </td>
                      <td className="py-2.5 font-mono font-semibold text-slate-600 dark:text-slate-300">
                        784-1985-1234567-1
                      </td>
                      <td className="py-2.5 text-slate-500 dark:text-slate-400">
                        15 Aug 2028
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60">
                          Valid
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        Chamber of Commerce
                      </td>
                      <td className="py-2.5 font-mono font-semibold text-slate-600 dark:text-slate-300">
                        DXB-COC-88219
                      </td>
                      <td className="py-2.5 text-slate-500 dark:text-slate-400">
                        31 Dec 2026
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60">
                          Verified
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Card 6: FINANCIAL SNAPSHOT (Matching Image 2) ─────────── */}
          {(activeSection === "all" || activeSection === "05") && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {getLabel("financialSnapshot", lang)}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">
                      Real-time Balances & Activity
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2.5 text-[11px] font-bold border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-lg gap-1"
                >
                  <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                    <Pencil className="h-3 w-3" />
                    {getLabel("edit", lang) || "Edit"}
                  </Link>
                </Button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{getLabel("oldBalance", lang)}</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                      {fmtNumber(selectedRow.openingBalance)} {selectedRow.currency}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{getLabel("creditLimit", lang)}</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                      500,000.00 {selectedRow.currency}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{getLabel("totalDebits", lang)}</p>
                    <p className="text-xs font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
                      {fmtNumber(selectedRow.debitTotal)} {selectedRow.currency}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{getLabel("totalCredits", lang)}</p>
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                      {fmtNumber(selectedRow.creditTotal)} {selectedRow.currency}
                    </p>
                  </div>
                </div>

                {/* Highlighted Current Net Balance Container (Matching Image 2) */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-tight">
                      {getLabel("currentNetBalance", lang)}
                    </p>
                    <p className="text-[11px] text-blue-600/80 dark:text-blue-400 mt-0.5">
                      {selectedRow.journalActivityCount || 14} {getLabel("ledgerActivity", lang)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                      {fmtNumber(selectedRow.currentBalance)} {selectedRow.currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Certificate Official Verification Footer Strip (Matching Image 2) ── */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          {/* 1. Date */}
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 shadow-xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getLabel("date", lang) || "Date"}</p>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                <span suppressHydrationWarning>{fmtDateTime(new Date().toISOString())}</span>
              </p>
            </div>
          </div>

          {/* 2. Prepared By */}
          <div className="flex items-center gap-3.5 border-t sm:border-t-0 sm:border-l border-slate-200/80 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-6">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-purple-600 shadow-xs">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getLabel("preparedBy", lang) || "Prepared By"}</p>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                {data?.workspace.companyOwner || "Super Admin (Global Group)"}
              </p>
            </div>
          </div>

          {/* 3. Authorized By & Signature Stamp */}
          <div className="flex items-center gap-3.5 border-t sm:border-t-0 sm:border-l border-slate-200/80 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-6">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getLabel("authorizedBy", lang) || "Authorized By"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-serif italic font-black text-blue-700 dark:text-blue-300 text-sm tracking-wide">
                  {data?.workspace.companyOwner || "Super Admin (Global Group)"}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ✓ {getLabel("verifiedBadge", lang) || "VERIFIED"}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
