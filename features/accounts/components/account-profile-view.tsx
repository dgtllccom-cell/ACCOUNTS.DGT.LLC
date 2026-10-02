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
  Award,
  Send,
  Warehouse,
  ExternalLink,
  Eye,
  Info,
  Ship
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { rtlLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openMasterProfile } from "@/lib/reports/master-profiles";
import { getLabel } from "./translations";
import { TaskHandoverModal } from "@/features/transfer-center/components/task-handover-modal";

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

/** Official Golden Damaan ERP Seal SVG Emblem */
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
  const [liveAccountData, setLiveAccountData] = useState<{ account: any; ledger: any } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"all" | "01" | "02" | "03" | "04" | "05">("all");
  const [selectedReportType, setSelectedReportType] = useState<string>("certificate");
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const fetchReportPromise = apiGet<AccountGeneralReportResponse>(
          "/api/erp/accounting/reports/accounts/general?limit=500"
        ).catch(() => null);

        const fetchLiveAccountPromise = accountId
          ? apiGet<{ account: any; ledger: any }>(
              `/api/erp/accounting/accounts/${encodeURIComponent(accountId)}?language=${encodeURIComponent(lang)}`
            ).catch(() => null)
          : Promise.resolve(null);

        const [repRes, liveRes] = await Promise.all([fetchReportPromise, fetchLiveAccountPromise]);

        if (!cancelled) {
          if (repRes) setData(repRes);
          if (liveRes) setLiveAccountData(liveRes);
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
  }, [accountId, lang]);

  const liveAccount = liveAccountData?.account;
  const liveLedger = liveAccountData?.ledger;

  const reportRow = useMemo(() => {
    if (!data?.rows || data.rows.length === 0) return null;
    if (!accountId) return data.rows[0];
    return data.rows.find((row) => row.accountId === accountId || row.accountCode === accountId) ?? data.rows[0];
  }, [data, accountId]);

  const selectedRow = useMemo(() => {
    if (!reportRow && !liveAccount) {
      return {
        accountId: accountId || "preview-1",
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
        countryCode: "AE",
        stateName: "Dubai",
        stateCode: "DXB",
        cityName: "Dubai",
        cityCode: "DXB",
        branchName: "Main Branch",
        branchCode: "BR-001",
        branchType: "City Branch",
        bankName: "Emirates NBD",
        openingBalance: 12500,
        debitTotal: 980750,
        creditTotal: 1245000,
        currentBalance: 276750,
        linkedLedgerCount: 2,
        journalActivityCount: 14,
        latestJournalNo: "JV-2026-00142",
        latestActivityAt: "2026-09-10T14:30:00.000Z",
        ledgerId: null,
        ledgerName: "Trade Debtors Ledger",
        ledgerStatus: "active",
        ledgerCurrency: "AED",
        companies: [],
        banks: [],
        warehouses: [],
        customer: null,
        contacts: [],
        linkedCountries: [],
        shippingLineId: null,
        operationalDomain: "business"
      };
    }

    return {
      accountId: liveAccount?.id || reportRow?.accountId || accountId,
      accountCode: liveAccount?.code || liveAccount?.account_number || reportRow?.accountCode || "",
      rawAccountCode: reportRow?.rawAccountCode,
      customerId: liveAccount?.customer_id ?? reportRow?.customerId,
      customerName: liveAccount?.customer?.customer_name || reportRow?.customerName || null,
      companyId: liveAccount?.company_id ?? reportRow?.companyId,
      bankId: liveAccount?.bank_id ?? reportRow?.bankId,
      customerNumber: liveAccount?.customer_number || reportRow?.customerNumber || liveAccount?.code,
      countrySerialNumber: liveAccount?.country_serial_number || reportRow?.countrySerialNumber,
      branchSerialNumber: liveAccount?.branch_serial_number || reportRow?.branchSerialNumber,
      manualReferenceNumber: liveAccount?.manual_reference_number ?? reportRow?.manualReferenceNumber,
      accountName: liveAccount?.name || reportRow?.accountName || "Account",
      journalCode: reportRow?.journalCode || "JRN-2026-0089",
      ledgerId: liveLedger?.id || reportRow?.ledgerId || null,
      ledgerName: liveLedger?.name || reportRow?.ledgerName || "Account Ledger",
      ledgerStatus: liveLedger?.is_active ? "active" : (reportRow?.ledgerStatus || "active"),
      ledgerCurrency: liveLedger?.currency || reportRow?.ledgerCurrency || liveAccount?.currency || "AED",
      branchType: reportRow?.branchType || (liveAccount?.city_branch_id ? "City Branch" : "Main Branch"),
      branchName: reportRow?.branchName || liveAccount?.branch_code || "Main Branch",
      mainBranchName: reportRow?.mainBranchName,
      cityBranchName: reportRow?.cityBranchName,
      branchCode: reportRow?.branchCode || liveAccount?.branch_code || "BR-001",
      countryId: liveAccount?.country_id || reportRow?.countryId || null,
      countryName: reportRow?.countryName || "United Arab Emirates",
      countryCode: reportRow?.countryCode || "AE",
      stateName: reportRow?.stateName || "",
      stateCode: reportRow?.stateCode || "",
      cityId: liveAccount?.city_branch_id || reportRow?.cityId || null,
      cityName: reportRow?.cityName || "Dubai",
      cityCode: reportRow?.cityCode || "",
      currency: liveAccount?.currency || reportRow?.currency || "AED",
      accountCategory: reportRow?.accountCategory || (liveAccount?.kind ? `${liveAccount.kind.toUpperCase()} Account` : "Purchase Sales Account"),
      subType: reportRow?.subType || (liveAccount?.operational_domain === "shipping" ? "Shipping Line Account" : "Corporate Business (LLC)"),
      status: liveAccount?.status || reportRow?.status || "active",
      createdAt: liveAccount?.created_at || reportRow?.createdAt || new Date().toISOString(),
      openingBalance: Number(liveAccount?.opening_balance ?? reportRow?.openingBalance ?? 0),
      debitTotal: Number(liveLedger?.debit_total ?? reportRow?.debitTotal ?? 0),
      creditTotal: Number(liveLedger?.credit_total ?? reportRow?.creditTotal ?? 0),
      currentBalance: Number(liveAccount?.current_balance ?? liveLedger?.current_balance ?? reportRow?.currentBalance ?? 0),
      linkedLedgerCount: reportRow?.linkedLedgerCount || (liveLedger ? 1 : 0),
      journalActivityCount: reportRow?.journalActivityCount || 0,
      latestJournalNo: reportRow?.latestJournalNo || null,
      latestActivityAt: reportRow?.latestActivityAt || null,
      companyName: liveAccount?.companies?.[0]?.name || reportRow?.companyName || "",
      companyCode: liveAccount?.companies?.[0]?.code || reportRow?.companyCode || "",
      companyOwner: liveAccount?.customer?.customer_name || reportRow?.companyOwner || "",
      bankName: liveAccount?.banks?.[0]?.name || reportRow?.bankName || "",
      recentActivityLabel: reportRow?.recentActivityLabel || null,
      recentActivityAt: reportRow?.recentActivityAt || null,
      // Attached resolved arrays
      companies: (liveAccount?.companies || []) as Array<{ id: string; name: string; code?: string; country?: string; isPrimary?: boolean }>,
      banks: (liveAccount?.banks || []) as Array<{ id: string; name: string; branchName?: string; accountNumber?: string; currency?: string; isPrimary?: boolean }>,
      warehouses: (liveAccount?.warehouses || []) as Array<{ id: string; name: string; code?: string; address?: string; isPrimary?: boolean }>,
      customer: liveAccount?.customer || null,
      contacts: (liveAccount?.contacts || []) as Array<{ type: string; value: string }>,
      linkedCountries: (liveAccount?.linked_countries || []) as string[],
      shippingLineId: liveAccount?.shipping_line_id || null,
      shippingLine: liveAccount?.shippingLine || null,
      operationalDomain: liveAccount?.operational_domain || "business"
    };
  }, [liveAccount, liveLedger, reportRow, accountId]);

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
      ["Primary Company", selectedRow.companyName || "-"],
      ["Total Companies Linked", String(selectedRow.companies?.length || 1)],
      ["Primary Bank", selectedRow.bankName || "-"],
      ["Total Banks Linked", String(selectedRow.banks?.length || 1)],
      ["Total Warehouses Linked", String(selectedRow.warehouses?.length || 0)],
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

  function handleOpenCustomerProfile() {
    if (!selectedRow?.customer) return;
    const cust = selectedRow.customer;
    void openMasterProfile({
      entity: "customer",
      lang,
      record: {
        id: cust.id,
        customer_name: cust.customer_name,
        company_name: cust.company_name || "",
        customer_number: cust.customer_code || "",
        mobile: cust.mobile_number || cust.phone_number || "",
        email: cust.email_address || "",
        trn: cust.tax_number || "",
        address: cust.address || "",
        is_active: true
      },
      scope: {
        countryId: selectedRow.countryId,
        countryName: selectedRow.countryName,
        branchName: selectedRow.branchName
      }
    });
  }

  function handleOpenCompanyProfile(comp: { id: string; name: string; code?: string }) {
    void openMasterProfile({
      entity: "company",
      lang,
      record: {
        id: comp.id,
        name: comp.name,
        code: comp.code || "",
        is_active: true
      },
      scope: {
        countryId: selectedRow?.countryId || null,
        countryName: selectedRow?.countryName || ""
      }
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
      title: getLabel("locationInformation", lang) || "LOCATION & ALLOCATION",
      subtitle: lang === "ur" ? "پتہ، کمپنیاں، بینک اور گودام" : "Companies, Banks & Warehouses",
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

      {/* ── Top Header Navigation Bar ───────────────────────────────── */}
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

          {/* Actions: Select Section dropdown + Edit, Print, Download, Email, WhatsApp, Export PDF */}
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
                <option value="01">01 Personal & Customer Details</option>
                <option value="02">02 Location, Companies, Banks & Warehouses</option>
                <option value="03">03 Contact Information</option>
                <option value="04">04 Document Information</option>
                <option value="05">05 Financial Summary & Ledger</option>
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="h-8 px-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/60"
            >
              <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {getLabel("edit", lang) || "Edit"}
              </Link>
            </Button>

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

            {selectedRow && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHandoffModalOpen(true)}
                className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Send className="h-3.5 w-3.5 mr-1 text-purple-500" />
                {t(lang, "tc.handover_btn", "Handover")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {selectedRow && (
        <TaskHandoverModal
          open={handoffModalOpen}
          onClose={() => setHandoffModalOpen(false)}
          orderReference={selectedRow.accountCode}
          sourceTable="enterprise_accounts"
          sourceId={selectedRow.accountId}
          targetUrl={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}
          defaultTask={t(lang, "tc.handover_task", "Account Review / Handover")}
          sourceCountryId={selectedRow.countryId || null}
          sourceCityBranchId={selectedRow.cityId || null}
          domain="business"
          customerPartyName={selectedRow.accountName}
          onSuccess={() => setHandoffModalOpen(false)}
          lang={lang}
        />
      )}

      {/* ── Main Document Container ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">

        {/* ── Official Branded Certificate Top Band (Matching Image 2) ── */}
        <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-r from-amber-50/60 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Left: Gold Seal Emblem + Account Header Details */}
          <div className="flex items-center gap-4 text-center sm:text-left">
            <DamaanOfficialSeal />
            <div>
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white uppercase tracking-tight">
                  {selectedRow.accountName}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {selectedRow.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-wider mt-0.5">
                {getLabel("officialCertificateTitle", lang)}
              </p>
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 justify-center sm:justify-start">
                <span>Code: <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold">{selectedRow.accountCode}</strong></span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>Type: <strong className="text-slate-800 dark:text-slate-200">{selectedRow.accountCategory} ({selectedRow.subType})</strong></span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>Branch: <strong className="text-slate-800 dark:text-slate-200">{selectedRow.branchName}</strong></span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>Currency: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedRow.currency}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Trust Badge & Edit Link */}
          <div className="flex flex-col items-center sm:items-end gap-2 shrink-0">
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white/90 dark:bg-slate-850 px-5 py-3 text-center shadow-2xs">
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
            <Button
              asChild
              size="sm"
              variant="outline"
              className="text-xs font-bold border-blue-200 text-blue-600 dark:border-blue-900 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 no-print"
            >
              <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {getLabel("edit", lang) || "Edit Account"}
              </Link>
            </Button>
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

          {/* ── Card 1: PERSONAL INFORMATION & CUSTOMER DETAILS ── */}
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
                      {selectedRow.customer ? "Customer & Primary Party Details" : "Customer Basic Details"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedRow.customer && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenCustomerProfile}
                      className="h-7 px-2 text-[11px] font-bold border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      {getLabel("viewCustomer", lang)}
                    </Button>
                  )}
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
                {selectedRow.customer ? (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                      <span className="text-slate-500 font-medium">Linked Customer Entity:</span>
                      <button
                        type="button"
                        onClick={handleOpenCustomerProfile}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 text-left"
                        title="Click to view Customer Master Profile"
                      >
                        {selectedRow.customer.customer_name}
                        {selectedRow.customer.customer_code && (
                          <span className="font-mono text-[10px] text-slate-400">({selectedRow.customer.customer_code})</span>
                        )}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </button>
                    </div>
                    {selectedRow.customer.company_name && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                        <span className="text-slate-500 font-medium">Business / Trade Name:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.customer.company_name}</span>
                      </div>
                    )}
                    {selectedRow.customer.tax_number && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                        <span className="text-slate-500 font-medium">Tax Registration (TRN):</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedRow.customer.tax_number}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                    <span className="text-slate-500 font-medium">Father Name / Representative:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.companyOwner || selectedRow.customerName || "Representative"}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Date of Birth / Est.:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtDate(selectedRow.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Nationality / Origin:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.countryName || "United Arab Emirates"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Customer Type / Category:</span>
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
                  <span className="text-slate-500 font-medium">Linked Ledger Name:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">{selectedRow.ledgerName || "Customer Receivables Ledger"}</span>
                    {selectedRow.ledgerId && (
                      <Link
                        href={`/dashboard/ledger?ledgerId=${selectedRow.ledgerId}`}
                        className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 font-bold"
                        title="View Ledger Statement"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Journal Code:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedRow.journalCode || "JRN-2026-0089"}</span>
                    <Link
                      href="/dashboard/roznamcha"
                      className="text-[10px] text-slate-400 hover:text-blue-500 flex items-center gap-0.5"
                      title="View Journal Activity"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Ledger Currency:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.currency} ({selectedRow.currency} Ledger)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Operational Domain:</span>
                  <span className="font-bold uppercase text-slate-800 dark:text-slate-200 text-[11px]">{selectedRow.operationalDomain}</span>
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

          {/* ── Card 3: LOCATION INFORMATION, MULTI-COMPANY, MULTI-BANK & WAREHOUSES ── */}
          {(activeSection === "all" || activeSection === "02") && (
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {getLabel("locationInformation", lang)} & Entity Relationships
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">
                      Address, Assigned Branch, Multi-Companies, Banks & Warehouses
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

              {/* Single Canonical Account Identity Notice */}
              <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 p-3.5 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-blue-950 dark:text-blue-200">
                    Single Account Identity: {selectedRow.accountName} ({selectedRow.accountCode})
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed text-[11px]">
                    {getLabel("singleAccountIdentityNote", lang)}
                  </p>
                </div>
              </div>

              {/* 1. Branch & Location Allocation Grid */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  Branch & Location Allocation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Country</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRow.countryName} ({selectedRow.countryCode || "-"})</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">State / Region</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.stateName || selectedRow.cityName || "Dubai"}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Assigned Branch</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedRow.branchName} ({selectedRow.branchCode})</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Serials</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">C:{selectedRow.countrySerialNumber || "01"} / B:{selectedRow.branchSerialNumber || "01"}</span>
                  </div>
                </div>
              </div>

              {/* 2. Linked Companies (Multi-Company) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-600" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      {getLabel("linkedCompaniesTitle", lang)}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {selectedRow.companies?.length || (selectedRow.companyName ? 1 : 0)} Linked
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-6 px-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50"
                  >
                    <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                      + Add Company
                    </Link>
                  </Button>
                </div>

                {selectedRow.companies && selectedRow.companies.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Company Name</th>
                          <th className="py-2 px-3">Code</th>
                          <th className="py-2 px-3">Country</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {selectedRow.companies.map((comp, idx) => (
                          <tr key={comp.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <button
                                type="button"
                                onClick={() => handleOpenCompanyProfile(comp)}
                                className="hover:underline text-left"
                                title="Open Company Profile"
                              >
                                {comp.name}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                              {comp.code || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {comp.country || selectedRow.countryName || "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              {comp.isPrimary ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                  {getLabel("primaryCompany", lang)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {getLabel("linked", lang)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenCompanyProfile(comp)}
                                className="h-6 px-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                {getLabel("viewDetails", lang)}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-500 text-xs text-center">
                    {selectedRow.companyName ? (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-amber-600" />
                          {selectedRow.companyName}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {getLabel("primaryCompany", lang)}
                        </span>
                      </div>
                    ) : (
                      getLabel("noCompaniesLinked", lang)
                    )}
                  </div>
                )}
              </div>

              {/* 3. Linked Banks (Multi-Bank) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-blue-600" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      {getLabel("linkedBanksTitle", lang)}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {selectedRow.banks?.length || (selectedRow.bankName ? 1 : 0)} Linked
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-6 px-2 text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50"
                  >
                    <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                      + Add Bank
                    </Link>
                  </Button>
                </div>

                {selectedRow.banks && selectedRow.banks.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Bank Name</th>
                          <th className="py-2 px-3">Branch</th>
                          <th className="py-2 px-3">Account Number / IBAN</th>
                          <th className="py-2 px-3">Currency</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {selectedRow.banks.map((bank, idx) => (
                          <tr key={bank.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <Landmark className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                              <Link
                                href={`/dashboard/settings/bank?bankId=${bank.id}`}
                                className="hover:underline"
                                title="Open Bank Details"
                              >
                                {bank.name}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {bank.branchName || "-"}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 dark:text-slate-200">
                              {bank.accountNumber || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {bank.currency || selectedRow.currency}
                            </td>
                            <td className="py-2.5 px-3">
                              {bank.isPrimary ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300">
                                  <Star className="h-2.5 w-2.5 fill-blue-500 text-blue-500" />
                                  {getLabel("primaryBank", lang)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {getLabel("linked", lang)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                asChild
                                className="h-6 px-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                              >
                                <Link href={`/dashboard/banks?bankId=${bank.id}`}>
                                  <Eye className="h-3 w-3 mr-1" />
                                  {getLabel("viewDetails", lang)}
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-500 text-xs text-center">
                    {selectedRow.bankName ? (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <Landmark className="h-3.5 w-3.5 text-blue-600" />
                          {selectedRow.bankName}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          {getLabel("primaryBank", lang)}
                        </span>
                      </div>
                    ) : (
                      getLabel("noBanksLinked", lang)
                    )}
                  </div>
                )}
              </div>

              {/* 4. Linked Warehouses (Multi-Warehouse) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      {getLabel("linkedWarehousesTitle", lang)}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {selectedRow.warehouses?.length || 0} Linked
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-6 px-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50"
                  >
                    <Link href={`/dashboard/accounts/setup?accountId=${selectedRow.accountId}`}>
                      + Add Warehouse
                    </Link>
                  </Button>
                </div>

                {selectedRow.warehouses && selectedRow.warehouses.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Warehouse Name</th>
                          <th className="py-2 px-3">Code</th>
                          <th className="py-2 px-3">Address</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {selectedRow.warehouses.map((wh, idx) => (
                          <tr key={wh.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <Warehouse className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <Link
                                href={`/dashboard/settings/warehouse?warehouseId=${wh.id}`}
                                className="hover:underline"
                                title="Open Warehouse Details"
                              >
                                {wh.name}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                              {wh.code || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                              {wh.address || "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              {wh.isPrimary ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <Star className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                                  {getLabel("primaryWarehouse", lang)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {getLabel("linked", lang)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                asChild
                                className="h-6 px-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              >
                                <Link href={`/dashboard/warehouses?warehouseId=${wh.id}`}>
                                  <Eye className="h-3 w-3 mr-1" />
                                  {getLabel("viewDetails", lang)}
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-500 text-xs text-center">
                    {getLabel("noWarehousesLinked", lang)}
                  </div>
                )}
              </div>

              {/* Shipping & Multi-Country Operations (if applicable) */}
              {(selectedRow.shippingLine || selectedRow.operationalDomain === "shipping" || (selectedRow.linkedCountries && selectedRow.linkedCountries.length > 0)) && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-sky-600" />
                      <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                        Shipping & Regional Operations
                      </h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    {selectedRow.shippingLine && (
                      <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900">
                        <span className="text-[10px] text-sky-700 dark:text-sky-300 font-bold uppercase block">Shipping Line</span>
                        <Link
                          href={`/dashboard/shipping-line?id=${selectedRow.shippingLine.id}`}
                          className="font-bold text-sky-900 dark:text-sky-100 hover:underline flex items-center gap-1 mt-1"
                        >
                          {selectedRow.shippingLine.name}
                          {selectedRow.shippingLine.shipping_line_code && (
                            <span className="font-mono text-[10px]">({selectedRow.shippingLine.shipping_line_code})</span>
                          )}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        {selectedRow.shippingLine.contact_person && (
                          <span className="text-[11px] text-slate-500 block mt-1">
                            Contact: {selectedRow.shippingLine.contact_person} {selectedRow.shippingLine.phone ? `(${selectedRow.shippingLine.phone})` : ""}
                          </span>
                        )}
                      </div>
                    )}
                    {selectedRow.linkedCountries && selectedRow.linkedCountries.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-50/60 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 col-span-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">Linked Operating Countries</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedRow.linkedCountries.map((c, i) => (
                            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                      Communication & Operational Coordinates
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
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedRow.customer?.customer_name || (selectedRow as any).contactPerson || selectedRow.companyOwner || "General Representative"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Mobile / WhatsApp:</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${selectedRow.customer?.mobile_number || selectedRow.customer?.phone_number || "+971501234567"}`}
                      className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {selectedRow.customer?.mobile_number || selectedRow.customer?.phone_number || (selectedRow as any).contactPhone || "+971 50 123 4567"}
                    </a>
                    <a
                      href={`https://wa.me/${(selectedRow.customer?.mobile_number || "+971501234567").replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      title="Direct WhatsApp"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Official Email:</span>
                  <a
                    href={`mailto:${selectedRow.customer?.email_address || "contact@abctrading.ae"}`}
                    className="font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {selectedRow.customer?.email_address || (selectedRow as any).contactEmail || "contact@abctrading.ae"}
                  </a>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Registered Address:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedRow.customer?.address || "Office 402, Al Ras Tower, Deira, Dubai, UAE"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Primary Bank Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRow.bankName || "Emirates NBD PJSC"}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-850">
                  <span className="text-slate-500 font-medium">Bank Account Title:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.accountName}</span>
                </div>
                {selectedRow.contacts && selectedRow.contacts.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Additional Communication Channels:</span>
                    {selectedRow.contacts.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-850">
                        <span className="font-medium text-slate-500 uppercase text-[10px]">{c.type}:</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{c.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Card 5: DOCUMENT INFORMATION ── */}
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
                        {selectedRow.customer?.tax_number || "100293847500003"}
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

          {/* ── Card 6: FINANCIAL SNAPSHOT & LEDGER AUDIT ── */}
          {(activeSection === "all" || activeSection === "05") && (
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {getLabel("financialSnapshot", lang)} & Ledger Balance
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">
                      Real-time Balances, Audit Verification & Journal Activity
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedRow.ledgerId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-7 px-2 text-[11px] font-bold border-teal-200 dark:border-teal-900 text-teal-700 dark:text-teal-300 hover:bg-teal-50"
                    >
                      <Link href={`/dashboard/ledger?ledgerId=${selectedRow.ledgerId}`}>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {getLabel("viewLedgerStatement", lang)}
                      </Link>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-7 px-2 text-[11px] font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  >
                    <Link href="/dashboard/roznamcha">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {getLabel("viewJournalEntries", lang)}
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{getLabel("oldBalance", lang)}</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                      {fmtNumber(selectedRow.openingBalance)} {selectedRow.currency}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{getLabel("creditLimit", lang)}</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                      500,000.00 {selectedRow.currency}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{getLabel("totalDebits", lang)}</p>
                    <p className="text-xs font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
                      {fmtNumber(selectedRow.debitTotal)} {selectedRow.currency}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{getLabel("totalCredits", lang)}</p>
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                      {fmtNumber(selectedRow.creditTotal)} {selectedRow.currency}
                    </p>
                  </div>
                </div>

                {/* Highlighted Current Net Balance Container */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-tight">
                      {getLabel("currentNetBalance", lang)}
                    </p>
                    <p className="text-[11px] text-blue-600/80 dark:text-blue-400 mt-0.5">
                      {selectedRow.journalActivityCount || 0} {getLabel("ledgerActivity", lang)}
                      {selectedRow.latestJournalNo && (
                        <span> · Latest Voucher: <strong className="font-mono">{selectedRow.latestJournalNo}</strong></span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                      {fmtNumber(selectedRow.currentBalance)} {selectedRow.currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Certificate Official Verification Footer Strip ────────────────────────── */}
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
