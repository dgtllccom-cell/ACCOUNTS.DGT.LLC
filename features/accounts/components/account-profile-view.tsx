"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
  Search,
  MoreVertical,
  MessageCircle,
  Share2,
  ShieldCheck,
  ClipboardList,
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
  Check,
  Layers,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openMasterProfile } from "@/lib/reports/master-profiles";

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
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

export function AccountProfileView({
  lang,
  accountId
}: {
  lang: SupportedLanguage;
  accountId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountGeneralReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"all" | "01" | "02" | "03" | "04">("01");
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
    if (!data?.rows || !accountId) return null;
    return data.rows.find((row) => row.accountId === accountId) ?? null;
  }, [data, accountId]);

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [titlePortalNode, setTitlePortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalNode(document.getElementById("erp-page-actions-slot"));
    setTitlePortalNode(document.getElementById("erp-page-title-slot"));
  }, []);

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
      `View Online: ${window.location.href}`
    );
    window.location.href = `mailto:?subject=${sub}&body=${body}`;
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
      `*Link:* ${window.location.href}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  function handlePrint() {
    // The whole toolbar only renders once a row is resolved (see the `!selectedRow`
    // early-return above), so this is a defensive guard — never a raw window.print()
    // of the dashboard shell.
    if (!selectedRow) return;
    // Professional A4 Account Master Profile via the shared engine (real record
    // data + dynamic branding for this account's country/branch).
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

  if (error || !selectedRow) {
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

  const sections = [
    {
      id: "01",
      number: "01",
      title: "PERSONAL INFORMATION",
      subtitle: "Customer Basic Details",
      icon: User,
      badgeColor: "bg-blue-600 text-white",
      borderColor: "border-blue-600",
      activeText: "text-blue-600",
      contentHeader: "Customer basic identity and personal details",
      fields: [
        { label: "Customer Account Code", value: selectedRow.accountCode, highlight: true, icon: CreditCard },
        { label: "Date of Birth / Est.", value: fmtDate(selectedRow.createdAt), icon: Calendar },
        { label: "Customer Type / Gender", value: selectedRow.subType || "—", icon: User },
        { label: "Nationality / Origin", value: selectedRow.countryName || "—", icon: Globe },
        { label: "Full Name", value: selectedRow.accountName, highlight: true, icon: User },
        { label: "Account Category", value: selectedRow.accountCategory || "—", icon: Briefcase },
        { label: "Father Name / Representative", value: selectedRow.companyOwner || selectedRow.customerName || "—", icon: Users },
        { label: "Language Preference", value: (selectedRow as any).languagePreference || "—", icon: Globe }
      ]
    },
    {
      id: "02",
      number: "02",
      title: "LOCATION INFORMATION",
      subtitle: "Address & Location Details",
      icon: MapPin,
      badgeColor: "bg-emerald-600 text-white",
      borderColor: "border-emerald-600",
      activeText: "text-emerald-600",
      contentHeader: "Branch geographic location and territorial details",
      fields: [
        { label: "Country Name", value: `${selectedRow.countryName} (${selectedRow.countryCode})`, highlight: true, icon: Globe },
        { label: "Country Serial No.", value: selectedRow.countrySerialNumber || "—", icon: Hash },
        { label: "State / Emirate", value: selectedRow.stateName || selectedRow.cityName || "—", icon: MapPin },
        { label: "City Region", value: selectedRow.cityName || "—", icon: Landmark },
        { label: "Assigned Branch Name", value: selectedRow.branchName, highlight: true, icon: Building2 },
        { label: "Branch Code", value: selectedRow.branchCode, icon: Hash },
        { label: "Branch Type / Scope", value: selectedRow.branchType || "—", icon: Layers },
        { label: "Branch Serial ID", value: selectedRow.branchSerialNumber || "—", icon: Hash }
      ]
    },
    {
      id: "03",
      number: "03",
      title: "CONTACT INFORMATION",
      subtitle: "Contact & Communication",
      icon: Phone,
      badgeColor: "bg-amber-500 text-white",
      borderColor: "border-amber-500",
      activeText: "text-amber-600",
      contentHeader: "Registered company, owner director & bank clearing info",
      fields: [
        { label: "Registered Company", value: selectedRow.companyName || "—", highlight: true, icon: Building2 },
        { label: "Company Code", value: selectedRow.companyCode || "—", icon: Hash },
        { label: "Company Owner / Director", value: selectedRow.companyOwner || selectedRow.customerName || "—", icon: User },
        { label: "Operational Currency", value: selectedRow.currency ? `${selectedRow.currency} (Local Currency)` : "—", highlight: true, icon: Coins },
        { label: "Registered Bank Name", value: selectedRow.bankName || "—", icon: Landmark },
        { label: "Bank Account Title", value: selectedRow.companyName || selectedRow.accountName || "—", icon: CreditCard },
        { label: "Contact Phone / Mobile", value: (selectedRow as any).contactPhone || (selectedRow as any).phone || "—", icon: Phone },
        { label: "Official Email Address", value: (selectedRow as any).contactEmail || (selectedRow as any).email || "—", icon: Mail }
      ]
    },
    {
      id: "04",
      number: "04",
      title: "DOCUMENT INFORMATION",
      subtitle: "Document & ID Details",
      icon: FileText,
      badgeColor: "bg-purple-600 text-white",
      borderColor: "border-purple-600",
      activeText: "text-purple-600",
      contentHeader: "Master ledger specifications and financial audit identity",
      fields: [
        { label: "Linked Ledger Name", value: selectedRow.ledgerName || "—", highlight: true, icon: BookOpen },
        { label: "Journal Code", value: selectedRow.journalCode || "—", icon: Hash },
        { label: "Ledger Currency", value: selectedRow.ledgerCurrency || selectedRow.currency, icon: Coins },
        { label: "Ledger Operational Status", value: selectedRow.ledgerStatus === "active" ? "Active (Posted)" : "Verified", icon: CheckCircle2 },
        { label: "Opening Balance", value: `${fmtNumber(selectedRow.openingBalance)} ${selectedRow.currency}`, icon: Activity },
        { label: "Total Debits (DR)", value: `${fmtNumber(selectedRow.debitTotal)} ${selectedRow.currency}`, icon: Activity },
        { label: "Total Credits (CR)", value: `${fmtNumber(selectedRow.creditTotal)} ${selectedRow.currency}`, icon: Activity },
        { label: "Current Net Balance", value: `${fmtNumber(selectedRow.currentBalance)} ${selectedRow.currency}`, highlight: true, icon: ShieldCheck }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-16 font-sans">
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

      {/* ── Top Header Navigation Bar (Image 2 Top Bar) ──────────────── */}
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
                Customer Profile – <span className="text-blue-600 dark:text-blue-400">{selectedRow.accountName}</span>
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
                }}
                className="h-8 px-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="certificate">{t(lang, "acct.apv_rpt_certificate", "Select Report: Official Certificate")}</option>
                <option value="all">{t(lang, "acct.apv_rpt_all", "View Complete Full Certificate (All Sections)")}</option>
                <option value="01">01 {t(lang, "acct.apv_rpt_01", "Personal & Account Info")}</option>
                <option value="02">02 {t(lang, "acct.apv_rpt_02", "Location & Branch Info")}</option>
                <option value="03">03 {t(lang, "acct.apv_rpt_03", "Contact & Company Info")}</option>
                <option value="04">04 {t(lang, "acct.apv_rpt_04", "Document & Ledger Info")}</option>
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
              {t(lang, "acct.apv_export_pdf", "Export PDF")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Document Container (Matches Image 2 Style) ─────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">

          {/* Certificate Main Title & Header Metadata */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              OFFICIAL CUSTOMER PROFILE CERTIFICATE
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Generated On: <strong className="text-slate-800 dark:text-slate-200" suppressHydrationWarning>{fmtDate(new Date().toISOString())}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>Ref: <strong className="font-mono text-blue-600 dark:text-blue-400">{selectedRow.accountCode || "—"}</strong></span>
            </div>
          </div>

          {/* ── 4 Top Category Cards (Interactive Stage Selectors) ───── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isSelected = activeSection === sec.id || activeSection === "all";
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id as any)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all duration-200 relative overflow-hidden flex flex-col justify-between group",
                    isSelected
                      ? `bg-white dark:bg-slate-850 shadow-md ${sec.borderColor} border-2 ring-2 ring-blue-500/10`
                      : "bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-black shadow-xs",
                        sec.badgeColor
                      )}
                    >
                      {sec.number}
                    </span>
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform group-hover:scale-110",
                        isSelected ? sec.activeText : "text-slate-400"
                      )}
                    />
                  </div>
                  <div>
                    <h3 className={cn("text-xs font-black uppercase tracking-tight", isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300")}>
                      {sec.title}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                      {sec.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Active Section / Full Certificate Content Panel ───────── */}
          {(activeSection === "all" ? sections : sections.filter(s => s.id === activeSection)).map((sec) => {
            const Icon = sec.icon;
            return (
              <div
                key={sec.id}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs space-y-4 p-5 sm:p-6 mb-6"
              >
                {/* Section Sub-header */}
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className={cn("p-2 rounded-xl text-white shadow-xs", sec.badgeColor)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {sec.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {sec.contentHeader}
                    </p>
                  </div>
                </div>

                {/* 2-Column Clean Key-Value Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 pt-1">
                  {sec.fields.map((f, fIdx) => {
                    const FieldIcon = f.icon;
                    return (
                      <div
                        key={fIdx}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition text-xs"
                      >
                        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                          <span className="p-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-400">
                            <FieldIcon className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-semibold">{f.label}</span>
                        </div>
                        <span
                          className={cn(
                            "font-bold text-right truncate max-w-[240px]",
                            f.highlight
                              ? "text-blue-600 dark:text-blue-400 font-extrabold"
                              : "text-slate-900 dark:text-slate-100"
                          )}
                          title={String(f.value || "-")}
                        >
                          {f.value || "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Certificate Official Footer Banner (Image 2 Footer) ──── */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            {/* 1. Date */}
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 shadow-xs">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                  <span suppressHydrationWarning>{fmtDate(new Date().toISOString())}</span>
                </p>
              </div>
            </div>

            {/* 2. Prepared By */}
            <div className="flex items-center gap-3.5 border-t sm:border-t-0 sm:border-l border-slate-200/80 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-6">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-purple-600 shadow-xs">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prepared By</p>
                <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                  {data?.workspace.companyOwner || "—"}
                </p>
              </div>
            </div>

            {/* 3. Authorized By & Signature Stamp */}
            <div className="flex items-center gap-3.5 border-t sm:border-t-0 sm:border-l border-slate-200/80 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-6">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Authorized By</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Handwritten-like digital signature mark */}
                  <span className="font-serif italic font-black text-blue-700 dark:text-blue-300 text-sm tracking-wide">
                    {data?.workspace.companyOwner || "—"}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
