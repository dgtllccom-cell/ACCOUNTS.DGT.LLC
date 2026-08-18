"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Printer,
  Download,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  Building2,
  Users,
  CreditCard,
  Truck,
  BookOpen,
  Settings,
  ShieldCheck,
  Globe,
  ExternalLink,
  Clock,
  Database,
  ArrowRight,
  Sparkles,
  BarChart3,
  Filter
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openJournalReportWindow } from "@/lib/reports/open-journal-report-window";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ErpFormItem {
  id: string;
  name: string;
  nameUrdu?: string;
  category: "Dashboard" | "New Entry" | "Accounting & Roznamcha" | "Trade & Purchase" | "Shipping & Clearing" | "Communication" | "Administration & Settings";
  route: string;
  roles: string[];
  description: string;
  status: "Active" | "Production Ready" | "Enhanced";
}

export const ERP_FORMS_CATALOG: ErpFormItem[] = [
  // 1. Dashboards
  {
    id: "dash-overview",
    name: "Dashboard Overview (Main Landing)",
    nameUrdu: "مین ڈیش بورڈ اوور ویو",
    category: "Dashboard",
    route: "/dashboard",
    roles: ["All Roles"],
    description: "Core operational summary with real-time KPI metrics, active branches, multi-currency balances, and quick actions.",
    status: "Production Ready"
  },
  {
    id: "dash-super",
    name: "Super Admin Dashboard",
    nameUrdu: "سپر ایڈمن ڈیش بورڈ",
    category: "Dashboard",
    route: "/dashboard/super-admin",
    roles: ["Super Admin"],
    description: "Global enterprise command center across all countries, master accounts, branch networks, and high-level financial metrics.",
    status: "Production Ready"
  },
  {
    id: "dash-country",
    name: "Country Admin Dashboard",
    nameUrdu: "ملکی ایڈمن ڈیش بورڈ",
    category: "Dashboard",
    route: "/dashboard/country",
    roles: ["Super Admin", "Country Admin", "Country User"],
    description: "Country-level consolidated overview managing regional branch operations, local currency flows, and tax compliance.",
    status: "Production Ready"
  },
  {
    id: "dash-city",
    name: "City Branch Dashboard",
    nameUrdu: "شہری برانچ ڈیش بورڈ",
    category: "Dashboard",
    route: "/dashboard/city",
    roles: ["Super Admin", "Country Admin", "Main Branch Admin", "City Branch Admin", "Accountant", "Cashier"],
    description: "Branch-specific operational interface tracking daily cash drawers, customer transactions, and local postings.",
    status: "Production Ready"
  },
  {
    id: "dash-logistics",
    name: "Logistics & Shipping Dashboard",
    nameUrdu: "لاجسٹکس اور شپنگ ڈیش بورڈ",
    category: "Dashboard",
    route: "/dashboard/logistics",
    roles: ["Super Admin", "Agent User"],
    description: "Fleet logistics, port shipments, truck movement tracking, and customs clearance statistics.",
    status: "Production Ready"
  },

  // 2. New Entry Forms & Master Setups
  {
    id: "entry-user-all",
    name: "Users Directory & Global Roster",
    nameUrdu: "صارفین کی ڈائرکٹری",
    category: "New Entry",
    route: "/dashboard/new-entry/users/all",
    roles: ["Super Admin", "Country Admin", "Main Branch Admin"],
    description: "Full directory list of all system users across country and city branches with role badges and status filters.",
    status: "Production Ready"
  },
  {
    id: "entry-user-reg",
    name: "User Registration & Permission Form",
    nameUrdu: "صارف کے اندراج کا فارم",
    category: "New Entry",
    route: "/dashboard/new-entry/users/registration",
    roles: ["Super Admin", "Country Admin", "Main Branch Admin", "City Branch Admin"],
    description: "Form for creating new employee logins, role scope assignment, password credentials, and granular permission sets.",
    status: "Production Ready"
  },
  {
    id: "entry-user-journal",
    name: "User Activity Journal Report",
    nameUrdu: "صارفین کی سرگرمی کا جرنل",
    category: "New Entry",
    route: "/dashboard/new-entry/users/journal-report",
    roles: ["Super Admin", "Country Admin", "Auditor"],
    description: "Comprehensive audit trail logging all user actions, entry creations, updates, and login timestamps.",
    status: "Production Ready"
  },
  {
    id: "entry-branch-super",
    name: "Super Admin Branch Registry",
    nameUrdu: "برانچ رجسٹری فارم",
    category: "New Entry",
    route: "/dashboard/new-entry/branches/super-admin",
    roles: ["Super Admin"],
    description: "Master creation form for establishing new country hubs, main branches, and allocating branch codes.",
    status: "Production Ready"
  },
  {
    id: "entry-branch-country",
    name: "Country Branch Setup Form",
    nameUrdu: "ملکی برانچ سیٹ اپ فارم",
    category: "New Entry",
    route: "/dashboard/new-entry/branch-entry/country-branch",
    roles: ["Super Admin", "Country Admin"],
    description: "Setup and configuration for country-level administrative headquarters and regional settings.",
    status: "Production Ready"
  },
  {
    id: "entry-branch-city",
    name: "City Branch Setup Form",
    nameUrdu: "شہری برانچ سیٹ اپ فارم",
    category: "New Entry",
    route: "/dashboard/new-entry/branch-entry/city-branch",
    roles: ["Super Admin", "Country Admin", "Main Branch Admin"],
    description: "Form to register individual city branches, sub-offices, and link them to parent main branches.",
    status: "Production Ready"
  },
  {
    id: "entry-branch-report",
    name: "Branch General Report & Hierarchy View",
    nameUrdu: "برانچ جنرل رپورٹ اور تنظیم چارٹ",
    category: "New Entry",
    route: "/dashboard/branch-management/general-report",
    roles: ["Super Admin", "Country Admin", "Branch Admin"],
    description: "Deduplicated organizational summary cards, multi-level hierarchy breakdown, and active user metrics.",
    status: "Enhanced"
  },
  {
    id: "entry-account-setup",
    name: "Account Setup Form (Chart of Accounts)",
    nameUrdu: "نیا کھاتہ بنانے کا فارم",
    category: "New Entry",
    route: "/dashboard/accounts/setup",
    roles: ["Super Admin", "Country Admin", "Main Branch Admin"],
    description: "Create ledger accounts with account categories (Asset, Liability, Equity, Revenue, Expense) and currency mapping.",
    status: "Production Ready"
  },
  {
    id: "entry-customer-setup",
    name: "Customer Profile Setup Form",
    nameUrdu: "کسٹمر پروفائل فارم",
    category: "New Entry",
    route: "/dashboard/settings/customers/setup",
    roles: ["Super Admin", "Branch Admin", "Accountant"],
    description: "Register trade clients, contact details, tax identifiers, credit limits, and linked ledger accounts.",
    status: "Production Ready"
  },
  {
    id: "entry-goods-master",
    name: "Goods Master Data & Product Catalog",
    nameUrdu: "سامان اور پروڈکٹ ماسٹر",
    category: "New Entry",
    route: "/dashboard/new-entry/goods-master",
    roles: ["Super Admin", "Branch Admin"],
    description: "Manage product commodities, HS codes, standard measurement units (PCS, KG, TONS), and pricing tiers.",
    status: "Production Ready"
  },

  // 3. Accounting & Roznamcha
  {
    id: "acc-cash-entry",
    name: "Credit & Debit Cash Entry (Roznamcha)",
    nameUrdu: "روزنامچہ کیش انٹری فارم",
    category: "Accounting & Roznamcha",
    route: "/dashboard/roznamcha/cash-entry",
    roles: ["Super Admin", "Main Branch Admin", "City Branch Admin", "Accountant", "Cashier"],
    description: "High-speed double-entry cash posting form with real-time exchange rates, multi-currency ledger, and auto serial generation.",
    status: "Enhanced"
  },
  {
    id: "acc-expenses-bill",
    name: "Expenses Bill Entry Form",
    nameUrdu: "اخراجات کا بل فارم",
    category: "Accounting & Roznamcha",
    route: "/dashboard/roznamcha/expenses-bill",
    roles: ["Super Admin", "Branch Admin", "Accountant"],
    description: "Record operating expenses, utility bills, office rentals, tax invoices, and vendor disbursements.",
    status: "Production Ready"
  },
  {
    id: "acc-money-exchange",
    name: "Money Changer (Currency Exchange Matrix)",
    nameUrdu: "منی ایکسچینج اور کرنسی ڈیلنگ",
    category: "Accounting & Roznamcha",
    route: "/dashboard/roznamcha/money-exchange",
    roles: ["Super Admin", "Branch Admin", "Accountant", "Cashier"],
    description: "Foreign currency purchase and sale calculator tracking spread margins, realized profit/loss, and currency drawers.",
    status: "Production Ready"
  },
  {
    id: "acc-bank-cheque",
    name: "Bank Cheque Management & Clearing",
    nameUrdu: "بینک چیک انٹری اور کلیئرنگ",
    category: "Accounting & Roznamcha",
    route: "/dashboard/banks",
    roles: ["Super Admin", "Branch Admin", "Accountant"],
    description: "Manage issued and received post-dated cheques, bank reconciliation, clearing status, and bounced cheque alerts.",
    status: "Production Ready"
  },
  {
    id: "acc-roznamcha-all",
    name: "Roznamcha All Postings Ledger Report",
    nameUrdu: "روزنامچہ کی تمام پوسٹنگز رپورٹ",
    category: "Accounting & Roznamcha",
    route: "/dashboard/roznamcha/all",
    roles: ["Super Admin", "Country Admin", "Branch Admin", "Auditor"],
    description: "Master chronological ledger report displaying all posted debit and credit vouchers with filterable date presets.",
    status: "Production Ready"
  },
  {
    id: "acc-ledger-statement",
    name: "Ledger Statement General Report",
    nameUrdu: "لیجر اسٹیٹمنٹ جنرل رپورٹ",
    category: "Accounting & Roznamcha",
    route: "/dashboard/ledger/general-report",
    roles: ["Super Admin", "Country Admin", "Branch Admin", "Accountant"],
    description: "Formal balance sheet statements, party running balances, printable statements, and exportable PDF ledgers.",
    status: "Production Ready"
  },
  {
    id: "acc-daily-rate",
    name: "Daily Exchange Rate Manager",
    nameUrdu: "روزانہ ایکسچینج ریٹ مینیجر",
    category: "Accounting & Roznamcha",
    route: "/dashboard/reports/exchange-rate",
    roles: ["Super Admin", "Country Admin", "Accountant"],
    description: "Set and update daily official exchange rates for USD, AFN, PKR, AED, EUR across all branch jurisdictions.",
    status: "Production Ready"
  },

  // 4. Commercial & Trade
  {
    id: "trade-po-wizard",
    name: "New Purchase Booking Order Wizard",
    nameUrdu: "خریداری کا بکنگ آرڈر فارم",
    category: "Trade & Purchase",
    route: "/dashboard/purchase/new-purchase-booking-order",
    roles: ["Super Admin", "Branch Admin", "Accountant"],
    description: "Step-by-step commercial purchasing workflow covering item selection, supplier terms, customs duty, and freight costs.",
    status: "Production Ready"
  },
  {
    id: "trade-po-confirm",
    name: "Purchase Booking Confirmation & Approval",
    nameUrdu: "خریداری بکنگ کی تصدیق",
    category: "Trade & Purchase",
    route: "/dashboard/purchase/purchase-confirm",
    roles: ["Super Admin", "Branch Admin"],
    description: "Order verification, proforma validation, stock allotment, and authorization before financial commitment.",
    status: "Production Ready"
  },
  {
    id: "trade-po-advance",
    name: "Purchase Order Advance Payment Entry",
    nameUrdu: "خریداری کے ایڈوانس ادائیگی کی انٹری",
    category: "Trade & Purchase",
    route: "/dashboard/journal/purchase-order-payment/advance",
    roles: ["Super Admin", "Branch Admin", "Accountant"],
    description: "Record advance down-payments against pending purchase orders with automated receipt voucher generation.",
    status: "Production Ready"
  },
  {
    id: "trade-po-remaining",
    name: "Purchase Order Remaining Payment Entry",
    nameUrdu: "بقایا ادائیگی کی انٹری",
    category: "Trade & Purchase",
    route: "/dashboard/journal/purchase-order-payment/remaining",
    roles: ["Super Admin", "Branch Admin", "Accountant"],
    description: "Final settlement postings for delivered purchase shipments tracking remaining liabilities.",
    status: "Production Ready"
  },
  {
    id: "trade-local-purchase",
    name: "Local Purchase Orders & Cash Invoices",
    nameUrdu: "مقامی خریداری کے آرڈرز",
    category: "Trade & Purchase",
    route: "/dashboard/purchase/local-purchases",
    roles: ["Super Admin", "Branch Admin", "Accountant"],
    description: "Quick domestic buying invoices with instant cash settlement and local inventory ingestion.",
    status: "Production Ready"
  },

  // 5. Shipping & Clearing Agent
  {
    id: "ship-transit-entry",
    name: "Transit Entry Form & Public Check Report",
    nameUrdu: "ٹرانزٹ انٹری اور پبلک چیک رپورٹ",
    category: "Shipping & Clearing",
    route: "/dashboard/clearing-agent/transit-entry",
    roles: ["Super Admin", "Agent User", "Branch Admin"],
    description: "Comprehensive 7-section Transit Entry form with live calculation, documents upload, and A4 Public Check Report with verified QR Code.",
    status: "Production Ready"
  },
  {
    id: "ship-custom-declaration",
    name: "Agent Customs Declaration (GD Entry)",
    nameUrdu: "کسٹمز ڈیکلیئریشن انٹری فارم",
    category: "Shipping & Clearing",
    route: "/dashboard/clearing-agent/agent-custom-entry",
    roles: ["Super Admin", "Agent User"],
    description: "Customs declaration entry for Import, Export, and Transit goods at Karachi, Chaman, Torkham and border stations.",
    status: "Production Ready"
  },
  {
    id: "ship-transit-loading",
    name: "Transit Truck Loading Management",
    nameUrdu: "ٹرانزٹ ٹرک لوڈنگ مینیجر",
    category: "Shipping & Clearing",
    route: "/dashboard/clearing-agent/transit-loading",
    roles: ["Super Admin", "Agent User"],
    description: "Manage transit shipments loaded on cross-border trucks with container serials, seal numbers, and border routes.",
    status: "Production Ready"
  },
  {
    id: "ship-truck-reg",
    name: "Clearing Agent Truck Registration",
    nameUrdu: "ٹرک رجسٹریشن فارم",
    category: "Shipping & Clearing",
    route: "/dashboard/clearing-agent/truck-registration",
    roles: ["Super Admin", "Agent User"],
    description: "Register commercial fleet trucks, driver CNIC/passports, phone numbers, and transport vendor contracts.",
    status: "Production Ready"
  },
  {
    id: "ship-truck-wizard",
    name: "Truck Recreation Wizard & Manifest",
    nameUrdu: "ٹرک مینی فیسٹ وزرڈ",
    category: "Shipping & Clearing",
    route: "/dashboard/clearing-agent/truck-recreation",
    roles: ["Super Admin", "Agent User"],
    description: "Multi-stage wizard to re-allocate cargo shipments, generate road freight manifests, and assign border clearances.",
    status: "Production Ready"
  },
  {
    id: "ship-clearing-bill",
    name: "Clearing Agent Service Bill Entry",
    nameUrdu: "کلیئرنگ ایجنٹ بلنگ فارم",
    category: "Shipping & Clearing",
    route: "/dashboard/clearing-agent/bill-entry",
    roles: ["Super Admin", "Agent User"],
    description: "Bill of services for customs handling, border duties, demurrage charges, port wharfage, and agency commissions.",
    status: "Production Ready"
  },
  {
    id: "ship-payment-bill",
    name: "Clearing Payment & Bill Settlement",
    nameUrdu: "کلیئرنگ ادائیگی کا اندراج",
    category: "Shipping & Clearing",
    route: "/dashboard/clearing-agent/payment-bill-entry",
    roles: ["Super Admin", "Agent User"],
    description: "Record clearing agent payments, tax deductions, supplier reimbursements, and receipt acknowledgments.",
    status: "Production Ready"
  },

  // 6. Communication & Logs
  {
    id: "comm-whatsapp",
    name: "WhatsApp Multi-Branch Team Inbox",
    nameUrdu: "واٹس ایپ ٹیم ان باکس",
    category: "Communication",
    route: "/dashboard/communication/whatsapp",
    roles: ["Super Admin", "Country Admin", "Branch Admin"],
    description: "Real-time WhatsApp chat and business messaging portal connected to branches for client communication and invoice sharing.",
    status: "Production Ready"
  },
  {
    id: "comm-email",
    name: "Enterprise Email Center & Dispatch",
    nameUrdu: "ای میل مینیجمنٹ سنٹر",
    category: "Communication",
    route: "/dashboard/communication/email",
    roles: ["Super Admin", "Country Admin", "Branch Admin"],
    description: "Integrated email composer with branch-specific SMTP accounts, automated payment receipts, and statement dispatch.",
    status: "Production Ready"
  },
  {
    id: "comm-sms",
    name: "SMS Dispatch & Return Reply Service",
    nameUrdu: "ایس ایم ایس میسجنگ سنٹر",
    category: "Communication",
    route: "/dashboard/communication/sms",
    roles: ["Super Admin", "Branch Admin"],
    description: "Automated SMS notification engine alerting customers of goods delivery, transaction confirmations, and balances.",
    status: "Production Ready"
  },

  // 7. Administration & Settings
  {
    id: "admin-company",
    name: "Enterprise Company Master Profile",
    nameUrdu: "کمپنی پروفائل اور برانڈنگ",
    category: "Administration & Settings",
    route: "/dashboard/settings/company",
    roles: ["Super Admin"],
    description: "Configure corporate name (DAMAAN BUSINESS GROUP), owner identity (Asmat Abdullah), tax registration, and logos.",
    status: "Production Ready"
  },
  {
    id: "admin-location",
    name: "Location Hierarchy Setup (Country/State/City)",
    nameUrdu: "مقام اور لوکیشن سیٹ اپ",
    category: "Administration & Settings",
    route: "/dashboard/settings/location",
    roles: ["Super Admin", "Country Admin"],
    description: "4-level administrative geographical nodes (Country -> State/Province -> District -> City/Area) with master maps.",
    status: "Production Ready"
  },
  {
    id: "admin-ports",
    name: "Ports & Border Crossing Customs Master",
    nameUrdu: "بندرگاہ اور بارڈر کسٹمز ماسٹر",
    category: "Administration & Settings",
    route: "/dashboard/settings/ports",
    roles: ["Super Admin", "Agent User"],
    description: "Register sea ports, dry ports, airport terminals, and international land border checkpoints.",
    status: "Production Ready"
  },
  {
    id: "admin-profile",
    name: "User Profile & Security Settings",
    nameUrdu: "صارف پروفائل اور سیکیورٹی",
    category: "Administration & Settings",
    route: "/dashboard/settings/profile",
    roles: ["All Roles"],
    description: "Personal account manager for credential updates, password security, email verification, and assigned role badges.",
    status: "Production Ready"
  }
];

export const DEVELOPMENT_MILESTONES = [
  {
    phase: "Phase 1: Architecture Foundation & Multi-Tenant Core",
    date: "June 2026",
    summary: "Established Supabase PostgreSQL foundation, multi-tenant workspace architecture, high-security RLS policies, dynamic role scoping (Super Admin, Country Admin, Branch Admin, Accountant, Cashier, Agent), and Next.js App Router engine."
  },
  {
    phase: "Phase 2: Multi-Country & Branch Hierarchy Network",
    date: "Late June – July 2026",
    summary: "Constructed comprehensive organizational nodes: Super Admin hubs, Country headquarters (Pakistan, Afghanistan, UAE), Main Branches, and City Branch networks. Built automated user registration with deduplicated branch user counts and location trees."
  },
  {
    phase: "Phase 3: Core Accounting & Roznamcha Double-Entry Ledger",
    date: "July 2026",
    summary: "Implemented high-performance Roznamcha posting engine, instant Credit & Debit cash vouchers, daily USD exchange rate manager, automated account master chart, and multi-currency currency dealer spread calculator (Money Changer)."
  },
  {
    phase: "Phase 4: Commercial Trade & Purchase Booking Engine",
    date: "Early August 2026",
    summary: "Engineered step-by-step Purchase Booking Order Wizard, proforma confirmation workflow, Advance and Remaining payment processing, customs duty allocations, and supplier ledger synchronizations."
  },
  {
    phase: "Phase 5: Clearing Agent, Customs GD & Truck Fleet Logistics",
    date: "Mid August 2026",
    summary: "Developed complete clearing agent subsystem: Customs Declaration (GD Entry), Truck Registration, Truck Recreation Manifest Wizard, Transit Loading, Service Billing, and Payment Bill settlement."
  },
  {
    phase: "Phase 6: Transit Entry & Public Verification Report (Current)",
    date: "August 17, 2026",
    summary: "Built the comprehensive 7-section Transit Entry Form, dedicated database migration (`transit_entries`), live auto-calculation, and the official A4 Transit Entry Report (Public Check) with live QR Code verification."
  }
];

export function SystemAuditAndFormsDirectoryView({ lang = "en" }: { lang?: SupportedLanguage }) {
  const dir = getLanguageDirection(lang);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["All", "Dashboard", "New Entry", "Accounting & Roznamcha", "Trade & Purchase", "Shipping & Clearing", "Communication", "Administration & Settings"];

  const filteredForms = useMemo(() => {
    return ERP_FORMS_CATALOG.filter((item) => {
      const matchCat = selectedCategory === "All" || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.nameUrdu && item.nameUrdu.includes(q)) ||
        item.route.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.roles.some((r) => r.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  const handlePrint = () => {
    const tt = (key: string, fallback: string) => t(lang as never, key as never, fallback);
    openJournalReportWindow({
      lang,
      autoPrint: true,
      title: tt("nav.forms_directory_audit", "Forms Directory Audit"),
      subtitle: tt("jrn.roznamcha_journal", "System Report"),
      overviewLabel: tt("jrn.overview", "Report Overview"),
      scopeName: tt("nav.forms_directory_audit", "Forms Directory Audit"),
      reportIdPrefix: "SYSAUDIT",
      reportIdValue: "forms",
      chips: [
        { label: tt("jrn.entry_count", "Total"), value: String(filteredForms.length) }
      ],
      kpis: [],
      columns: [
        { key: "sno", label: tt("rozrep.sno", "S.No") },
        { key: "name", label: tt("sys.form_name", "Form Name") },
        { key: "route", label: tt("sys.route", "Route") },
        { key: "category", label: tt("sys.category", "Category") }
      ],
      rows: (filteredForms as any[]).map((item, index) => ({
        sno: String(index + 1),
        name: item.name,
        route: item.route,
        category: item.category
      }))
    });
  };

  return (
    <div dir={dir} className="w-full space-y-6 pb-16 font-sans">
      {/* Printable CSS Hook */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-audit-report, #printable-audit-report * {
            visibility: visible;
          }
          #printable-audit-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Header Card */}
      <div className="no-print rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-black text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              OFFICIAL SYSTEM AUDIT & DIRECTORY
            </span>
            <span className="rounded-full bg-blue-500/20 px-3 py-0.5 text-xs font-bold text-blue-300 border border-blue-500/30">
              Active: August 17, 2026
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            ERP Master Forms Directory & Project Progress Report
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            DAMAAN BUSINESS GROUP Complete ERP System Portfolio. Comprehensive inventory of all active modules, forms, routes, and development milestones from inception to date.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={handlePrint}
            className="h-11 px-5 rounded-2xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30 cursor-pointer flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>Download PDF / Print</span>
          </Button>
        </div>
      </div>

      {/* Audit & Report Printable Body */}
      <div id="printable-audit-report" className="space-y-8 bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-md">
        
        {/* Document Header */}
        <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/icons/digital-dock-icon.svg" alt="DAMAAN" className="h-12 w-12 object-contain" />
            <div>
              <h2 className="text-xl font-black text-foreground">DAMAAN BUSINESS GROUP</h2>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Owner / Sponsor: Asmat Abdullah</p>
              <p className="text-[11px] text-muted-foreground">Multi-Country Branch ERP, Commercial Trade, Customs Clearing & Financial Core</p>
            </div>
          </div>

          <div className="text-start sm:text-end text-xs space-y-0.5">
            <p className="font-extrabold text-foreground">REPORT DATE: 17-AUGUST-2026</p>
            <p className="text-muted-foreground font-mono text-[11px]">Total Registered Forms: {ERP_FORMS_CATALOG.length}</p>
            <p className="text-muted-foreground font-mono text-[11px]">Status: Production Ready / Audited</p>
          </div>
        </div>

        {/* SECTION 1: SYSTEM EXECUTIVE SUMMARY STATS */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            1. Executive System Statistics & Modules Breakdown
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Modules & Forms</span>
              <p className="text-2xl font-black text-foreground mt-1">{ERP_FORMS_CATALOG.length}</p>
              <span className="text-[10px] font-semibold text-emerald-600">100% Operational</span>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">System Categories</span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">7 Core Sectors</p>
              <span className="text-[10px] font-semibold text-muted-foreground">Full ERP Scope</span>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Database Migrations</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">119+ SQL Schemas</p>
              <span className="text-[10px] font-semibold text-muted-foreground">PostgreSQL & Supabase</span>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Role Scopes</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">6 Hierarchy Levels</p>
              <span className="text-[10px] font-semibold text-muted-foreground">Super to Cashier</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: CHRONOLOGICAL DEVELOPMENT TIMELINE (Start to Date) */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            2. Project Development Timeline & Milestones (From Start to Present)
          </h3>

          <div className="space-y-3">
            {DEVELOPMENT_MILESTONES.map((m, idx) => (
              <div key={idx} className="rounded-2xl border border-border/80 bg-muted/10 p-4 hover:bg-muted/20 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <span className="font-black text-xs sm:text-sm text-foreground flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-extrabold text-white">
                      {idx + 1}
                    </span>
                    {m.phase}
                  </span>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 font-mono">
                    {m.date}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed ps-7">
                  {m.summary}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: COMPLETE ERP FORMS & MODULES DIRECTORY */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              3. Complete Master Forms & Menu Directory (Live Inventory)
            </h3>
            <span className="text-xs font-bold text-muted-foreground font-mono">
              Showing {filteredForms.length} of {ERP_FORMS_CATALOG.length} Forms
            </span>
          </div>

          {/* Interactive Filters (Hidden in print) */}
          <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/30 p-3 rounded-2xl border border-border">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1 rounded-xl font-bold transition-all cursor-pointer",
                    selectedCategory === cat
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search form by name or route..."
                className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Forms Directory Table */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-3.5 py-3">#</th>
                  <th className="px-3.5 py-3">Form / Module Name</th>
                  <th className="px-3.5 py-3">Category</th>
                  <th className="px-3.5 py-3">System Route</th>
                  <th className="px-3.5 py-3">Accessible Roles</th>
                  <th className="px-3.5 py-3">Description / Purpose</th>
                  <th className="px-3.5 py-3 text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredForms.map((item, index) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3.5 py-3 font-mono font-bold text-muted-foreground text-[11px]">
                      {index + 1}
                    </td>
                    <td className="px-3.5 py-3 font-bold text-foreground">
                      <div>{item.name}</div>
                      {item.nameUrdu && (
                        <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{item.nameUrdu}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="inline-block rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[9px] font-extrabold text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate max-w-[180px]">
                      {item.route}
                    </td>
                    <td className="px-3.5 py-3 text-[10px] text-muted-foreground font-medium">
                      {item.roles.join(", ")}
                    </td>
                    <td className="px-3.5 py-3 text-xs text-muted-foreground leading-relaxed max-w-xs">
                      {item.description}
                    </td>
                    <td className="px-3.5 py-3 text-center no-print">
                      <Link
                        href={item.route as any}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-600 dark:text-blue-300 px-2.5 py-1 text-[11px] font-bold transition-colors"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: SIGNATURES & VERIFICATION */}
        <div className="pt-6 border-t border-border mt-8">
          <div className="grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <p className="font-black text-foreground mb-8">System Engineering Team</p>
              <div className="border-t border-muted-foreground/40 pt-1 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Prepared By (Technical Lead)
              </div>
            </div>

            <div>
              <div className="h-10 mb-2" />
              <div className="border-t border-muted-foreground/40 pt-1 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Audited & Checked By
              </div>
            </div>

            <div>
              <p className="font-black text-foreground mb-8">Asmat Abdullah</p>
              <div className="border-t border-muted-foreground/40 pt-1 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Approved By (System Owner)
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between text-[10px] text-muted-foreground">
            <p>© 2026 DAMAAN BUSINESS GROUP ERP System. All Rights Reserved.</p>
            <p className="font-mono">Generated: 17-08-2026 14:00 | Document Version 3.4.0-PROD</p>
          </div>
        </div>
      </div>
    </div>
  );
}
