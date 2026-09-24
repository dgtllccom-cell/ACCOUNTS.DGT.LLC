"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { 
  Users, 
  Search, 
  Printer, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  Building2, 
  Globe, 
  KeyRound, 
  UserPlus, 
  FileText,
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Shield,
  Save,
  Clock,
  Laptop,
  MoreVertical,
  Pencil,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Ship,
  Truck,
  TrendingUp,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";
import { fetchBranding, brandingName } from "@/lib/branding/client";
import { cn } from "@/lib/utils";
import { ModulePermissionModal } from "@/components/permissions/module-permission-modal";

interface UserDirectoryItem {
  userId: string;
  userCode: string;
  fullName: string;
  subtitle?: string;
  email: string;
  phone?: string;
  countryId: string | null;
  countryName: string;
  countryCode?: string;
  branchId: string | null;
  branchName: string;
  role: string;
  roleLabel: string;
  businessType: string;
  businessId: string;
  isActive: boolean;
  avatarInitials?: string;
  avatarColor?: string;
  avatarUrl?: string;
  permissions?: string[];
  permissionsCount?: number;
  passwordVaultRef?: string;
  passwordKey: string;
  loginUrl: string;
  loginPortalLabel: string;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

// Complete list of system forms for granular permission granting & inspection
const ALL_SYSTEM_FORMS = [
  // 1. Dashboards
  { id: "dash-main", name: "Dashboard Overview", category: "Dashboards", route: "/dashboard" },
  { id: "dash-smart-ops", name: "Smart Operations Center", category: "Dashboards", route: "/dashboard/smart-operations" },
  { id: "dash-super", name: "Super Admin Dashboard", category: "Dashboards", route: "/dashboard/super-admin" },
  { id: "dash-country", name: "Country Admin Dashboard", category: "Dashboards", route: "/dashboard/country" },
  { id: "dash-city", name: "City Branch Dashboard", category: "Dashboards", route: "/dashboard/city" },
  { id: "dash-logistics", name: "Logistics Dashboard", category: "Dashboards", route: "/dashboard/logistics" },
  
  // 2. New Entry
  { id: "form-user-reg", name: "User Registration Form", category: "New Entry", route: "/dashboard/new-entry/users/registration" },
  { id: "form-user-dir", name: "All Users Directory", category: "New Entry", route: "/dashboard/new-entry/users/all" },
  { id: "form-branch-super", name: "Super Admin Branch Registry", category: "New Entry", route: "/dashboard/new-entry/branches/super-admin" },
  { id: "form-branch-country", name: "Country Branch Setup", category: "New Entry", route: "/dashboard/new-entry/branch-entry/country-branch" },
  { id: "form-branch-city", name: "City Branch Setup", category: "New Entry", route: "/dashboard/new-entry/branch-entry/city-branch" },
  { id: "form-accounts", name: "Chart of Accounts Master", category: "New Entry", route: "/dashboard/accounts/setup" },
  { id: "form-ledger-new", name: "New Ledger Account Setup", category: "New Entry", route: "/dashboard/ledger/new" },
  { id: "form-customers", name: "Customer Profile Setup", category: "New Entry", route: "/dashboard/settings/customers/setup" },
  { id: "form-goods", name: "Goods Master Data", category: "New Entry", route: "/dashboard/new-entry/goods-master" },
  
  // 3. Accounting & Roznamcha
  { id: "form-cash-entry", name: "Credit & Debit Cash Entry (Roznamcha)", category: "Accounting & Roznamcha", route: "/dashboard/roznamcha/cash-entry" },
  { id: "form-expenses", name: "Expenses Bill Entry", category: "Accounting & Roznamcha", route: "/dashboard/roznamcha/expenses-bill" },
  { id: "form-exchange", name: "Money Changer (Currency Dealing)", category: "Accounting & Roznamcha", route: "/dashboard/roznamcha/money-exchange" },
  { id: "form-banks", name: "Bank Cheque Management", category: "Accounting & Roznamcha", route: "/dashboard/banks" },
  { id: "form-roznamcha-all", name: "Roznamcha All Ledger Report", category: "Accounting & Roznamcha", route: "/dashboard/roznamcha/all" },
  { id: "form-ledger", name: "Ledger Statement General Report", category: "Accounting & Roznamcha", route: "/dashboard/ledger/general-report" },
  
  // 4. Trade & Purchase
  { id: "form-po-wizard", name: "Purchase Booking Order Wizard", category: "Trade & Purchase", route: "/dashboard/purchase/new-purchase-booking-order" },
  { id: "form-po-confirm", name: "Purchase Booking Confirmation", category: "Trade & Purchase", route: "/dashboard/purchase/purchase-confirm" },
  { id: "form-po-adv", name: "PO Advance Payment Entry", category: "Trade & Purchase", route: "/dashboard/journal/purchase-order-payment/advance" },
  { id: "form-po-rem", name: "PO Remaining Payment Entry", category: "Trade & Purchase", route: "/dashboard/journal/purchase-order-payment/remaining" },
  { id: "form-po-local", name: "Local Purchase Orders", category: "Trade & Purchase", route: "/dashboard/purchase/local-purchases" },
  { id: "form-local-goods", name: "Local Goods Received Note", category: "Trade & Purchase", route: "/dashboard/purchase/local-goods-received" },
  { id: "form-consignment", name: "Consignment Management", category: "Trade & Purchase", route: "/dashboard/consignment" },
  { id: "form-inventory", name: "Inventory & Stock Levels", category: "Trade & Purchase", route: "/dashboard/inventory" },

  // 5. Sales & Distribution
  { id: "form-sales-new", name: "Sales Booking Order Entry", category: "Sales & Distribution", route: "/dashboard/sales/new-sales-booking-order" },
  { id: "form-sales-confirm", name: "Sales Booking Confirmation", category: "Sales & Distribution", route: "/dashboard/sales/sales-confirm" },
  { id: "form-sales-local", name: "Local Sales Orders", category: "Sales & Distribution", route: "/dashboard/sales/local-sales" },
  { id: "form-sales-order", name: "Sales Order Management", category: "Sales & Distribution", route: "/dashboard/sales/sales-order" },
  
  // 6. Shipping & Clearing
  { id: "form-transit-entry", name: "Transit Entry & Public Report", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/transit-entry" },
  { id: "form-customs-gd", name: "Customs Declaration (GD Entry)", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/agent-custom-entry" },
  { id: "form-transit-loading", name: "Transit Truck Loading", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/transit-loading" },
  { id: "form-truck-reg", name: "Truck Registration Form", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/truck-registration" },
  { id: "form-clearing-bill", name: "Clearing Agent Service Bill", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/bill-entry" },
  { id: "form-shipping-line", name: "Ocean & Border Shipping Line", category: "Shipping & Clearing", route: "/dashboard/shipping-line" },
  { id: "form-bl-entry", name: "Bill of Lading (B/L Entry)", category: "Shipping & Clearing", route: "/dashboard/shipping-line/bl-entry" },
  
  // 7. Communication & AI
  { id: "form-whatsapp", name: "WhatsApp Multi-Branch Team Inbox", category: "Communication & AI", route: "/dashboard/messages/whatsapp" },
  { id: "form-email", name: "Enterprise Email Center", category: "Communication & AI", route: "/dashboard/communication-center" },
  { id: "form-sms", name: "SMS Dispatch & Notifications", category: "Communication & AI", route: "/dashboard/return-sms-reply" },
  { id: "form-ai-voice", name: "AI Voice & Text Entry", category: "Communication & AI", route: "/dashboard/ai-entry/voice-text" },
  
  // 8. Administration & Settings
  { id: "form-company-settings", name: "Company Master Profile", category: "Administration", route: "/dashboard/settings/company-setup" },
  { id: "form-location-settings", name: "Location Hierarchy Setup", category: "Administration", route: "/dashboard/settings/locations" },
  { id: "form-ports-settings", name: "Ports & Border Crossing Customs", category: "Administration", route: "/dashboard/settings/tax" },
  { id: "form-tax-uae", name: "UAE Tax & E-Invoicing", category: "Administration", route: "/dashboard/tax-einvoicing/uae/dashboard" },
  { id: "form-audit", name: "Audit & Security Monitoring", category: "Administration", route: "/dashboard/audit-monitoring" }
];

// Fallback seed directory precisely matching the 28 users reference specification & database records
const STANDARD_REFERENCE_USERS: UserDirectoryItem[] = [
  // Page 1 (Items 1 to 10) - Strictly matching the executive reference screenshot:
  {
    userId: "ref-usr-1",
    userCode: "dubai",
    fullName: "Ismat Ullah (عصمت اللہ)",
    subtitle: "Dubai City Administration",
    email: "dubai@dgt.llc",
    countryId: "c-are",
    countryName: "United Arab Emirates",
    countryCode: "UAE",
    branchId: "b-dxb",
    branchName: "Dubai - Main",
    role: "city_branch_admin",
    roleLabel: "CITY BRANCH ADMIN",
    businessType: "General Business",
    businessId: "DB-001",
    isActive: true,
    avatarInitials: "IU",
    avatarColor: "bg-[#e0f2fe] text-[#0284c7]",
    passwordKey: "",
    loginUrl: "/auth/login/city",
    loginPortalLabel: "City Portal",
    createdAt: "2025-04-20T10:00:00Z",
    lastLogin: "15/09/2026\n10:45 AM"
  },
  {
    userId: "ref-usr-2",
    userCode: "chaman",
    fullName: "Izzat Ullah Khan (عزت اللہ خان)",
    subtitle: "Chaman City Office",
    email: "chaman@dgt.llc",
    countryId: "c-pak",
    countryName: "Pakistan",
    countryCode: "Pakistan",
    branchId: "b-chm",
    branchName: "Chaman City",
    role: "city_branch_admin",
    roleLabel: "CITY BRANCH ADMIN",
    businessType: "General Business",
    businessId: "CH-001",
    isActive: true,
    avatarInitials: "IK",
    avatarColor: "bg-[#ede9fe] text-[#7c3aed]",
    passwordKey: "",
    loginUrl: "/auth/login/city",
    loginPortalLabel: "City Portal",
    createdAt: "2025-04-21T10:00:00Z",
    lastLogin: "14/09/2026\n09:30 AM"
  },
  {
    userId: "ref-usr-3",
    userCode: "quetta",
    fullName: "Ahmad Shah Durrani (احمد شاہ)",
    subtitle: "Quetta City Office",
    email: "quetta@dgt.llc",
    countryId: "c-pak",
    countryName: "Pakistan",
    countryCode: "Pakistan",
    branchId: "b-que",
    branchName: "Quetta City",
    role: "city_branch_admin",
    roleLabel: "CITY BRANCH ADMIN",
    businessType: "General Business",
    businessId: "QT-001",
    isActive: true,
    avatarInitials: "AD",
    avatarColor: "bg-[#ede9fe] text-[#7c3aed]",
    passwordKey: "",
    loginUrl: "/auth/login/city",
    loginPortalLabel: "City Portal",
    createdAt: "2025-04-21T11:00:00Z",
    lastLogin: "14/09/2026\n08:15 AM"
  },
  {
    userId: "ref-usr-4",
    userCode: "usa",
    fullName: "John S. Khan (جان سمتھ خان)",
    subtitle: "USA Country Operations",
    email: "usa@dgt.llc",
    countryId: "c-usa",
    countryName: "United States",
    countryCode: "USA",
    branchId: "b-usa-all",
    branchName: "Head Office",
    role: "country_admin",
    roleLabel: "COUNTRY ADMIN",
    businessType: "Trading Business",
    businessId: "USA-001",
    isActive: true,
    avatarInitials: "JK",
    avatarColor: "bg-[#fef3c7] text-[#d97706]",
    passwordKey: "",
    loginUrl: "/auth/login/country",
    loginPortalLabel: "Country Portal",
    createdAt: "2025-04-18T10:00:00Z",
    lastLogin: "14/09/2026\n07:50 AM"
  },
  {
    userId: "ref-usr-5",
    userCode: "pakistan",
    fullName: "Rashid Mehmood (راشد محمود)",
    subtitle: "Pakistan Country Operations",
    email: "pakistan@dgt.llc",
    countryId: "c-pak",
    countryName: "Pakistan",
    countryCode: "Pakistan",
    branchId: "b-pak-all",
    branchName: "Islamabad",
    role: "country_admin",
    roleLabel: "COUNTRY ADMIN",
    businessType: "Trading Business",
    businessId: "PK-001",
    isActive: true,
    avatarInitials: "RM",
    avatarColor: "bg-[#dcfce7] text-[#15803d]",
    passwordKey: "",
    loginUrl: "/auth/login/country",
    loginPortalLabel: "Country Portal",
    createdAt: "2025-04-18T10:00:00Z",
    lastLogin: "14/09/2026\n11:20 AM"
  },
  {
    userId: "ref-usr-6",
    userCode: "asad.s",
    fullName: "Muhammad Asad (محمد اسد)",
    subtitle: "Group Administration",
    email: "asad@dgt.llc",
    countryId: null,
    countryName: "Global",
    countryCode: "Global",
    branchId: null,
    branchName: "Global Access",
    role: "super_admin",
    roleLabel: "SUPER ADMIN",
    businessType: "Global Business",
    businessId: "GG-001",
    isActive: true,
    avatarInitials: "MA",
    avatarColor: "bg-[#ccfbf1] text-[#0f766e]",
    passwordKey: "",
    loginUrl: "/auth/login/admin",
    loginPortalLabel: "Admin Portal",
    createdAt: "2025-04-15T10:00:00Z",
    lastLogin: "15/09/2026\n09:10 AM"
  },
  {
    userId: "ref-usr-7",
    userCode: "mr.sports",
    fullName: "M. Ramzan Sports (محمد رمضان)",
    subtitle: "Sports Division",
    email: "mr.sports@dgt.llc",
    countryId: null,
    countryName: "Global",
    countryCode: "Global",
    branchId: null,
    branchName: "Global Access",
    role: "super_admin",
    roleLabel: "SUPER ADMIN",
    businessType: "Global Business",
    businessId: "GG-002",
    isActive: false,
    avatarInitials: "MR",
    avatarColor: "bg-[#fee2e2] text-[#b91c1c]",
    passwordKey: "",
    loginUrl: "/auth/login/admin",
    loginPortalLabel: "Admin Portal",
    createdAt: "2025-04-15T10:00:00Z",
    lastLogin: "10/09/2026\n08:00 AM"
  },
  {
    userId: "ref-usr-8",
    userCode: "superadmin",
    fullName: "Izzatullah Admin (عزت اللہ ایڈمن)",
    subtitle: "System Administrator",
    email: "superadmin@dgt.llc",
    countryId: null,
    countryName: "Global",
    countryCode: "Global",
    branchId: null,
    branchName: "Global Access",
    role: "super_admin",
    roleLabel: "SUPER ADMIN",
    businessType: "Global Business",
    businessId: "GG-000",
    isActive: true,
    avatarInitials: "IA",
    avatarColor: "bg-[#e0f2fe] text-[#0369a1]",
    passwordKey: "",
    loginUrl: "/auth/login/admin",
    loginPortalLabel: "Admin Portal",
    createdAt: "2025-04-14T10:00:00Z",
    lastLogin: "15/09/2026\n12:05 PM"
  },
  {
    userId: "ref-usr-9",
    userCode: "shipping",
    fullName: "Sohail Ahmad (سہیل احمد)",
    subtitle: "Shipping Line Operations",
    email: "shipping@dgt.llc",
    countryId: "c-are",
    countryName: "United Arab Emirates",
    countryCode: "UAE",
    branchId: "b-jbl",
    branchName: "Jebel Ali",
    role: "branch_admin",
    roleLabel: "BRANCH ADMIN",
    businessType: "Shipping Line",
    businessId: "SL-001",
    isActive: true,
    avatarInitials: "SA",
    avatarColor: "bg-[#dcfce7] text-[#15803d]",
    passwordKey: "",
    loginUrl: "/auth/login/clearing-agent",
    loginPortalLabel: "Shipping Portal",
    createdAt: "2025-04-16T10:00:00Z",
    lastLogin: "13/09/2026\n04:40 PM"
  },
  {
    userId: "ref-usr-10",
    userCode: "transport",
    fullName: "Tariq Jameel (طارق جمیل)",
    subtitle: "Transport Operations",
    email: "transport@dgt.llc",
    countryId: "c-pak",
    countryName: "Pakistan",
    countryCode: "Pakistan",
    branchId: "b-khi",
    branchName: "Karachi",
    role: "staff_user",
    roleLabel: "STAFF USER",
    businessType: "Transport Business",
    businessId: "TR-001",
    isActive: true,
    avatarInitials: "TJ",
    avatarColor: "bg-[#e0e7ff] text-[#4338ca]",
    passwordKey: "",
    loginUrl: "/auth/login",
    loginPortalLabel: "Staff Portal",
    createdAt: "2025-04-17T10:00:00Z",
    lastLogin: "12/09/2026\n02:15 PM"
  },
  // Items 11 to 28 (Pages 2 & 3 - Database Mapped):
  {
    userId: "ref-usr-11",
    userCode: "bombay",
    fullName: "Bilal Bashir (بلال بشیر)",
    subtitle: "Bombay City Office",
    email: "bombay@dgt.llc",
    countryId: "c-ind",
    countryName: "India",
    countryCode: "India",
    branchId: "b-bom",
    branchName: "Bombay City",
    role: "city_branch_admin",
    roleLabel: "CITY BRANCH ADMIN",
    businessType: "General Business",
    businessId: "IN-001",
    isActive: true,
    avatarInitials: "BB",
    avatarColor: "bg-[#fef3c7] text-[#d97706]",
    passwordKey: "",
    loginUrl: "/auth/login/city",
    loginPortalLabel: "City Portal",
    createdAt: "2025-04-22T10:00:00Z",
    lastLogin: "11/09/2026\n11:10 AM"
  },
  {
    userId: "ref-usr-12",
    userCode: "kandahar",
    fullName: "Khalid Balkhi (خالد بلخی)",
    subtitle: "Kandahar City Office",
    email: "kandahar@dgt.llc",
    countryId: "c-afg",
    countryName: "Afghanistan",
    countryCode: "Afghanistan",
    branchId: "b-knd",
    branchName: "Kandahar City",
    role: "city_branch_admin",
    roleLabel: "CITY BRANCH ADMIN",
    businessType: "General Business",
    businessId: "AF-001",
    isActive: true,
    avatarInitials: "KB",
    avatarColor: "bg-[#ede9fe] text-[#7c3aed]",
    passwordKey: "",
    loginUrl: "/auth/login/city",
    loginPortalLabel: "City Portal",
    createdAt: "2025-04-22T11:00:00Z",
    lastLogin: "11/09/2026\n10:45 AM"
  },
  {
    userId: "ref-usr-13",
    userCode: "bombay.agent",
    fullName: "Babar Chaudhry (بابر چوہدری)",
    subtitle: "Clearing Agent Operations",
    email: "agent.bombay@dgt.llc",
    countryId: "c-ind",
    countryName: "India",
    countryCode: "India",
    branchId: "b-bom-cl",
    branchName: "Bombay Port",
    role: "agent_user",
    roleLabel: "AGENT USER",
    businessType: "Shipping Line",
    businessId: "CL-002",
    isActive: true,
    avatarInitials: "BC",
    avatarColor: "bg-[#ccfbf1] text-[#0f766e]",
    passwordKey: "",
    loginUrl: "/auth/login/clearing-agent",
    loginPortalLabel: "Clearing Portal",
    createdAt: "2025-04-23T10:00:00Z",
    lastLogin: "10/09/2026\n03:20 PM"
  },
  {
    userId: "ref-usr-14",
    userCode: "chaman.agent",
    fullName: "Zafar Iqbal (ظفر اقبال)",
    subtitle: "Border Clearing Operations",
    email: "agent.chaman@dgt.llc",
    countryId: "c-pak",
    countryName: "Pakistan",
    countryCode: "Pakistan",
    branchId: "b-chm-cl",
    branchName: "Chaman Border",
    role: "agent_user",
    roleLabel: "AGENT USER",
    businessType: "Transport Business",
    businessId: "CL-003",
    isActive: true,
    avatarInitials: "ZI",
    avatarColor: "bg-[#dcfce7] text-[#15803d]",
    passwordKey: "",
    loginUrl: "/auth/login/clearing-agent",
    loginPortalLabel: "Clearing Portal",
    createdAt: "2025-04-23T11:00:00Z",
    lastLogin: "09/09/2026\n01:15 PM"
  },
  {
    userId: "ref-usr-15",
    userCode: "dubai.agent",
    fullName: "Dawood Shah (داؤد شاہ)",
    subtitle: "Customs Clearing Operations",
    email: "agent.dubai@dgt.llc",
    countryId: "c-are",
    countryName: "United Arab Emirates",
    countryCode: "UAE",
    branchId: "b-dxb-cl",
    branchName: "Port Rashid",
    role: "agent_user",
    roleLabel: "AGENT USER",
    businessType: "Shipping Line",
    businessId: "CL-001",
    isActive: true,
    avatarInitials: "DS",
    avatarColor: "bg-[#e0f2fe] text-[#0284c7]",
    passwordKey: "",
    loginUrl: "/auth/login/clearing-agent",
    loginPortalLabel: "Clearing Portal",
    createdAt: "2025-04-23T12:00:00Z",
    lastLogin: "12/09/2026\n05:30 PM"
  },
  {
    userId: "ref-usr-16",
    userCode: "kandahar.agent",
    fullName: "Kamran Siddiqui (کامران صدیقی)",
    subtitle: "Border Clearing Operations",
    email: "agent.kandahar@dgt.llc",
    countryId: "c-afg",
    countryName: "Afghanistan",
    countryCode: "Afghanistan",
    branchId: "b-knd-cl",
    branchName: "Kandahar Border",
    role: "agent_user",
    roleLabel: "AGENT USER",
    businessType: "Transport Business",
    businessId: "CL-004",
    isActive: true,
    avatarInitials: "KS",
    avatarColor: "bg-[#ede9fe] text-[#7c3aed]",
    passwordKey: "",
    loginUrl: "/auth/login/clearing-agent",
    loginPortalLabel: "Clearing Portal",
    createdAt: "2025-04-23T13:00:00Z",
    lastLogin: "08/09/2026\n02:10 PM"
  },
  {
    userId: "ref-usr-17",
    userCode: "pak.cashier",
    fullName: "Tahir Mehmood (طاہر محمود)",
    subtitle: "Cash & Roznamcha Operations",
    email: "cashier.pak@dgt.llc",
    countryId: "c-pak",
    countryName: "Pakistan",
    countryCode: "Pakistan",
    branchId: "b-que",
    branchName: "Quetta Cash Counter",
    role: "cashier",
    roleLabel: "CASHIER",
    businessType: "General Business",
    businessId: "CSH-002",
    isActive: true,
    avatarInitials: "TM",
    avatarColor: "bg-[#e0e7ff] text-[#4338ca]",
    passwordKey: "",
    loginUrl: "/auth/login",
    loginPortalLabel: "Cashier Portal",
    createdAt: "2025-04-24T10:00:00Z",
    lastLogin: "07/09/2026\n04:00 PM"
  },
  {
    userId: "ref-usr-18",
    userCode: "usr.9159",
    fullName: "Noman Ali (نعمان علی)",
    subtitle: "Data Entry Operations",
    email: "operator9159@dgt.llc",
    countryId: "c-are",
    countryName: "United Arab Emirates",
    countryCode: "UAE",
    branchId: "b-dxb",
    branchName: "Deira Dubai",
    role: "staff_user",
    roleLabel: "STAFF USER",
    businessType: "General Business",
    businessId: "STF-001",
    isActive: true,
    avatarInitials: "NA",
    avatarColor: "bg-[#f1f5f9] text-[#475569]",
    passwordKey: "",
    loginUrl: "/auth/login",
    loginPortalLabel: "Staff Portal",
    createdAt: "2025-04-24T11:00:00Z",
    lastLogin: "06/09/2026\n09:30 AM"
  },
  {
    userId: "ref-usr-19",
    userCode: "audit.admin",
    fullName: "Farooq Khattak (فاروق خٹک)",
    subtitle: "Internal Audit Division",
    email: "audit@dgt.llc",
    countryId: null,
    countryName: "Global",
    countryCode: "Global",
    branchId: null,
    branchName: "Global Access",
    role: "super_admin",
    roleLabel: "SUPER ADMIN",
    businessType: "Global Business",
    businessId: "GG-003",
    isActive: true,
    avatarInitials: "FK",
    avatarColor: "bg-[#ccfbf1] text-[#0f766e]",
    passwordKey: "",
    loginUrl: "/auth/login/admin",
    loginPortalLabel: "Admin Portal",
    createdAt: "2025-04-15T10:00:00Z",
    lastLogin: "14/09/2026\n04:10 PM"
  },
  {
    userId: "ref-usr-20",
    userCode: "all.superadmin",
    fullName: "Haji Abdul Malik (حاجی عبدالمالک)",
    subtitle: "Executive Management",
    email: "super.admin@dgt.llc",
    countryId: null,
    countryName: "Global",
    countryCode: "Global",
    branchId: null,
    branchName: "Global Access",
    role: "super_admin",
    roleLabel: "SUPER ADMIN",
    businessType: "Global Business",
    businessId: "GG-004",
    isActive: true,
    avatarInitials: "AM",
    avatarColor: "bg-[#fee2e2] text-[#b91c1c]",
    passwordKey: "",
    loginUrl: "/auth/login/admin",
    loginPortalLabel: "Admin Portal",
    createdAt: "2025-04-15T10:00:00Z",
    lastLogin: "15/09/2026\n01:25 PM"
  },
  {
    userId: "ref-usr-21",
    userCode: "afg.country",
    fullName: "Arif Alvi (عارف علوی)",
    subtitle: "Afghanistan Operations",
    email: "afg@dgt.llc",
    countryId: "c-afg",
    countryName: "Afghanistan",
    countryCode: "Afghanistan",
    branchId: "b-afg-all",
    branchName: "Kabul Head Office",
    role: "country_admin",
    roleLabel: "COUNTRY ADMIN",
    businessType: "Trading Business",
    businessId: "AF-001",
    isActive: true,
    avatarInitials: "AA",
    avatarColor: "bg-[#ede9fe] text-[#7c3aed]",
    passwordKey: "",
    loginUrl: "/auth/login/country",
    loginPortalLabel: "Country Portal",
    createdAt: "2025-04-18T10:00:00Z",
    lastLogin: "10/09/2026\n12:00 PM"
  },
  {
    userId: "ref-usr-22",
    userCode: "ind.country",
    fullName: "Sunil Sharma (سنیل شرما)",
    subtitle: "India Operations",
    email: "ind@dgt.llc",
    countryId: "c-ind",
    countryName: "India",
    countryCode: "India",
    branchId: "b-ind-all",
    branchName: "New Delhi Office",
    role: "country_admin",
    roleLabel: "COUNTRY ADMIN",
    businessType: "Trading Business",
    businessId: "IND-001",
    isActive: true,
    avatarInitials: "SS",
    avatarColor: "bg-[#fef3c7] text-[#d97706]",
    passwordKey: "",
    loginUrl: "/auth/login/country",
    loginPortalLabel: "Country Portal",
    createdAt: "2025-04-18T10:00:00Z",
    lastLogin: "11/09/2026\n02:40 PM"
  },
  {
    userId: "ref-usr-23",
    userCode: "saudi.admin",
    fullName: "Saud Abdullah (سعود عبداللہ)",
    subtitle: "Saudi Arabia Operations",
    email: "saudi@dgt.llc",
    countryId: "c-sau",
    countryName: "Saudi Arabia",
    countryCode: "SA",
    branchId: "b-sau-all",
    branchName: "Riyadh Central",
    role: "country_admin",
    roleLabel: "COUNTRY ADMIN",
    businessType: "Trading Business",
    businessId: "SA-001",
    isActive: true,
    avatarInitials: "SA",
    avatarColor: "bg-[#dcfce7] text-[#15803d]",
    passwordKey: "",
    loginUrl: "/auth/login/country",
    loginPortalLabel: "Country Portal",
    createdAt: "2025-04-19T10:00:00Z",
    lastLogin: "15/09/2026\n10:00 AM"
  },
  {
    userId: "ref-usr-24",
    userCode: "uzb.admin",
    fullName: "Usman Tashkendi (عثمان تاشقندی)",
    subtitle: "Uzbekistan Operations",
    email: "uzb@dgt.llc",
    countryId: "c-uzb",
    countryName: "Uzbekistan",
    countryCode: "UZ",
    branchId: "b-uzb-all",
    branchName: "Tashkent Central",
    role: "country_admin",
    roleLabel: "COUNTRY ADMIN",
    businessType: "Trading Business",
    businessId: "UZ-001",
    isActive: true,
    avatarInitials: "UT",
    avatarColor: "bg-[#e0f2fe] text-[#0284c7]",
    passwordKey: "",
    loginUrl: "/auth/login/country",
    loginPortalLabel: "Country Portal",
    createdAt: "2025-04-19T11:00:00Z",
    lastLogin: "14/09/2026\n03:15 PM"
  },
  {
    userId: "ref-usr-25",
    userCode: "tjk.admin",
    fullName: "Timur Dushanbe (تیمور دوشنبے)",
    subtitle: "Tajikistan Operations",
    email: "tjk@dgt.llc",
    countryId: "c-tjk",
    countryName: "Tajikistan",
    countryCode: "TJ",
    branchId: "b-tjk-all",
    branchName: "Dushanbe Central",
    role: "country_admin",
    roleLabel: "COUNTRY ADMIN",
    businessType: "Trading Business",
    businessId: "TJ-001",
    isActive: true,
    avatarInitials: "TD",
    avatarColor: "bg-[#ccfbf1] text-[#0f766e]",
    passwordKey: "",
    loginUrl: "/auth/login/country",
    loginPortalLabel: "Country Portal",
    createdAt: "2025-04-19T12:00:00Z",
    lastLogin: "13/09/2026\n11:45 AM"
  },
  {
    userId: "ref-usr-26",
    userCode: "iran.admin",
    fullName: "Ismail Tehrani (اسماعیل تہرانی)",
    subtitle: "Iran Operations",
    email: "iran@dgt.llc",
    countryId: "c-irn",
    countryName: "Iran",
    countryCode: "IR",
    branchId: "b-irn-all",
    branchName: "Tehran Central",
    role: "country_admin",
    roleLabel: "COUNTRY ADMIN",
    businessType: "Trading Business",
    businessId: "IR-001",
    isActive: true,
    avatarInitials: "IT",
    avatarColor: "bg-[#fee2e2] text-[#b91c1c]",
    passwordKey: "",
    loginUrl: "/auth/login/country",
    loginPortalLabel: "Country Portal",
    createdAt: "2025-04-19T13:00:00Z",
    lastLogin: "15/09/2026\n08:30 AM"
  },
  {
    userId: "ref-usr-27",
    userCode: "bandar.port",
    fullName: "Bahram Abbasi (بہرام عباسی)",
    subtitle: "Port & Customs Operations",
    email: "bandar@dgt.llc",
    countryId: "c-irn",
    countryName: "Iran",
    countryCode: "IR",
    branchId: "b-bnd",
    branchName: "Bandar Abbas Port",
    role: "branch_admin",
    roleLabel: "BRANCH ADMIN",
    businessType: "Shipping Line",
    businessId: "SL-002",
    isActive: true,
    avatarInitials: "BA",
    avatarColor: "bg-[#e0f2fe] text-[#0284c7]",
    passwordKey: "",
    loginUrl: "/auth/login/clearing-agent",
    loginPortalLabel: "Shipping Portal",
    createdAt: "2025-04-20T10:00:00Z",
    lastLogin: "14/09/2026\n05:00 PM"
  },
  {
    userId: "ref-usr-28",
    userCode: "jeddah",
    fullName: "Ilyas Jameeli (الیاس جمیلی)",
    subtitle: "Wholesale Market Operations",
    email: "jeddah@dgt.llc",
    countryId: "c-sau",
    countryName: "Saudi Arabia",
    countryCode: "SA",
    branchId: "b-jed",
    branchName: "Jeddah Market",
    role: "city_branch_admin",
    roleLabel: "CITY BRANCH ADMIN",
    businessType: "General Business",
    businessId: "SA-002",
    isActive: true,
    avatarInitials: "IJ",
    avatarColor: "bg-[#dcfce7] text-[#15803d]",
    passwordKey: "",
    loginUrl: "/auth/login/city",
    loginPortalLabel: "City Portal",
    createdAt: "2025-04-20T11:00:00Z",
    lastLogin: "15/09/2026\n09:45 AM"
  }
];

function CountryFlagIcon({ countryName }: { countryName: string }) {
  const c = (countryName || "").toLowerCase();
  if (c.includes("emirates") || c.includes("uae") || c.includes("dubai")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="24" height="5.33" fill="#00732f" />
        <rect y="5.33" width="24" height="5.33" fill="#ffffff" />
        <rect y="10.66" width="24" height="5.34" fill="#000000" />
        <rect width="7" height="16" fill="#ff0000" />
      </svg>
    );
  }
  if (c.includes("pakistan")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="24" height="16" fill="#01411c" />
        <rect width="6" height="16" fill="#ffffff" />
        <circle cx="14.5" cy="8" r="4.2" fill="#ffffff" />
        <circle cx="15.8" cy="7.2" r="3.7" fill="#01411c" />
        <polygon points="14.8,4.6 15.3,6.2 16.9,6.2 15.6,7.2 16.1,8.8 14.8,7.8 13.5,8.8 14,7.2 12.7,6.2 14.3,6.2" fill="#ffffff" />
      </svg>
    );
  }
  if (c.includes("united states") || c.includes("usa") || c.includes("america")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="24" height="16" fill="#b22234" />
        <path d="M0,2.46h24M0,4.92h24M0,7.38h24M0,9.84h24M0,12.3h24M0,14.76h24" stroke="#ffffff" strokeWidth="1.23" />
        <rect width="10" height="8.6" fill="#3c3b6e" />
        <circle cx="5" cy="4.3" r="2.2" fill="#ffffff" />
      </svg>
    );
  }
  if (c.includes("saudi")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="24" height="16" fill="#006c35" />
        <path d="M5,11h14" stroke="#ffffff" strokeWidth="1.2" />
        <text x="12" y="7.5" textAnchor="middle" fill="#ffffff" fontSize="4.5" fontWeight="bold">SA</text>
      </svg>
    );
  }
  if (c.includes("uzbek")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="24" height="5.33" fill="#0099b5" />
        <rect y="5.33" width="24" height="5.33" fill="#ffffff" />
        <rect y="10.66" width="24" height="5.34" fill="#1eb53a" />
        <line x1="0" y1="5.33" x2="24" y2="5.33" stroke="#ce1126" strokeWidth="0.5" />
        <line x1="0" y1="10.66" x2="24" y2="10.66" stroke="#ce1126" strokeWidth="0.5" />
      </svg>
    );
  }
  if (c.includes("tajik")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="24" height="4.5" fill="#cc0000" />
        <rect y="4.5" width="24" height="7" fill="#ffffff" />
        <rect y="11.5" width="24" height="4.5" fill="#006600" />
        <circle cx="12" cy="8" r="1.8" fill="#d4af37" />
      </svg>
    );
  }
  if (c.includes("iran")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="24" height="5.33" fill="#239f40" />
        <rect y="5.33" width="24" height="5.33" fill="#ffffff" />
        <rect y="10.66" width="24" height="5.34" fill="#da0000" />
        <circle cx="12" cy="8" r="1.6" fill="#da0000" />
      </svg>
    );
  }
  if (c.includes("india")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="24" height="5.33" fill="#ff9933" />
        <rect y="5.33" width="24" height="5.33" fill="#ffffff" />
        <rect y="10.66" width="24" height="5.34" fill="#138808" />
        <circle cx="12" cy="8" r="1.8" fill="#000080" />
      </svg>
    );
  }
  if (c.includes("afghan")) {
    return (
      <svg className="w-5 h-3.5 rounded-xs overflow-hidden shadow-xs shrink-0 border border-black/10" viewBox="0 0 24 16">
        <rect width="8" height="16" fill="#000000" />
        <rect x="8" width="8" height="16" fill="#d32011" />
        <rect x="16" width="8" height="16" fill="#007a3d" />
        <circle cx="12" cy="8" r="2.2" fill="#ffffff" />
      </svg>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-500 shrink-0">
      <Globe className="w-3.5 h-3.5" />
    </div>
  );
}

function BusinessTypeIcon({ type }: { type: string }) {
  const t = (type || "").toLowerCase();
  if (t.includes("ship")) {
    return <Ship className="w-4 h-4 text-teal-600 shrink-0" />;
  }
  if (t.includes("transport") || t.includes("truck")) {
    return <Truck className="w-4 h-4 text-emerald-600 shrink-0" />;
  }
  if (t.includes("trading") || t.includes("trade")) {
    return <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />;
  }
  if (t.includes("global")) {
    return <Globe className="w-4 h-4 text-blue-500 shrink-0" />;
  }
  return <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />;
}

function EmployeeAvatar({
  name,
  avatarUrl,
  initials,
  colorClass,
  index
}: {
  name: string;
  avatarUrl?: string;
  initials: string;
  colorClass: string;
  index: number;
}) {
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-full h-full object-cover rounded-full"
        onError={() => setImgError(true)}
      />
    );
  }

  // Realistic employee portrait illustrations with distinct styles, business suits, accessories & grooming
  const portraits = [
    // 0: Corporate executive with suit & sky blue tie (Ismat Ullah)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#e0f2fe" />
        <circle cx="32" cy="24" r="14" fill="#fcd34d" />
        <path d="M18 20 C18 10 46 10 46 20 C46 13 40 8 32 8 C24 8 18 13 18 20 Z" fill="#1e293b" />
        <path d="M12 60 C12 44 22 38 32 38 C42 38 52 44 52 60 Z" fill="#0f172a" />
        <path d="M28 38 L32 48 L36 38 Z" fill="#ffffff" />
        <path d="M31 42 L33 42 L34 54 L32 57 L30 54 Z" fill="#0284c7" />
      </svg>
    ),
    // 1: Executive Leader with beard & traditional dignitary style (Izzat Ullah Khan)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#ede9fe" />
        <circle cx="32" cy="25" r="13" fill="#fbcfe8" />
        <path d="M18 18 C18 9 46 9 46 18 C43 11 37 9 32 9 C27 9 21 11 18 18 Z" fill="#312e81" />
        <path d="M22 28 C22 36 42 36 42 28 C42 38 38 42 32 42 C26 42 22 38 22 28 Z" fill="#1e1b4b" />
        <path d="M12 60 C12 45 22 41 32 41 C42 41 52 45 52 60 Z" fill="#4338ca" />
        <path d="M29 41 L32 49 L35 41 Z" fill="#f8fafc" />
      </svg>
    ),
    // 2: Executive with beard & glasses (Ahmad Shah Durrani)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#fef3c7" />
        <circle cx="32" cy="25" r="13" fill="#fed7aa" />
        <path d="M20 18 C20 10 44 10 44 18 C41 12 37 10 32 10 C27 10 23 12 20 18 Z" fill="#292524" />
        <path d="M23 27 C23 35 41 35 41 27 C41 37 37 40 32 40 C27 40 23 37 23 27 Z" fill="#1c1917" />
        <circle cx="27" cy="23" r="4" fill="none" stroke="#0f172a" strokeWidth="1.5" />
        <circle cx="37" cy="23" r="4" fill="none" stroke="#0f172a" strokeWidth="1.5" />
        <line x1="31" y1="23" x2="33" y2="23" stroke="#0f172a" strokeWidth="1.5" />
        <path d="M12 60 C12 45 22 40 32 40 C42 40 52 45 52 60 Z" fill="#78350f" />
        <path d="M29 40 L32 49 L35 40 Z" fill="#ffffff" />
      </svg>
    ),
    // 3: Corporate manager in sleek blazer (John S. Khan)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#fee2e2" />
        <circle cx="32" cy="24" r="14" fill="#fed7aa" />
        <path d="M19 19 C19 11 45 11 45 19 C42 12 37 10 32 10 C27 10 22 12 19 19 Z" fill="#451a03" />
        <path d="M12 60 C12 44 22 39 32 39 C42 39 52 44 52 60 Z" fill="#991b1b" />
        <path d="M28 39 L32 49 L36 39 Z" fill="#ffffff" />
        <path d="M31 43 L33 43 L33.5 54 L32 57 L30.5 54 Z" fill="#1e293b" />
      </svg>
    ),
    // 4: Branch Director in emerald business suit (Rashid Mehmood)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#dcfce7" />
        <circle cx="32" cy="25" r="13" fill="#fde68a" />
        <path d="M20 18 C20 11 44 11 44 18 C41 12 37 10 32 10 C27 10 23 12 20 18 Z" fill="#14532d" />
        <path d="M12 60 C12 45 22 40 32 40 C42 40 52 45 52 60 Z" fill="#065f46" />
        <path d="M29 40 L32 50 L35 40 Z" fill="#ffffff" />
        <path d="M31 44 L33 44 L33.5 55 L32 57 L30.5 55 Z" fill="#047857" />
      </svg>
    ),
    // 5: Global Group Executive with dark navy suit & crest (Muhammad Asad)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#e0e7ff" />
        <circle cx="32" cy="24" r="14" fill="#fed7aa" />
        <path d="M18 19 C18 10 46 10 46 19 C42 12 37 9 32 9 C27 9 22 12 18 19 Z" fill="#0f172a" />
        <path d="M12 60 C12 44 22 38 32 38 C42 38 52 44 52 60 Z" fill="#1e1b4b" />
        <circle cx="42" cy="48" r="2" fill="#fbbf24" />
        <path d="M28 38 L32 49 L36 38 Z" fill="#ffffff" />
        <path d="M31 43 L33 43 L34 54 L32 57 L30 54 Z" fill="#e11d48" />
      </svg>
    ),
    // 6: Sports Director with athletic sport coat (M. Ramzan Sports)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#fce7f3" />
        <circle cx="32" cy="24" r="14" fill="#fde68a" />
        <path d="M19 18 C19 11 45 11 45 18 C42 12 37 10 32 10 C27 10 22 12 19 18 Z" fill="#831843" />
        <path d="M12 60 C12 44 22 39 32 39 C42 39 52 44 52 60 Z" fill="#9d174d" />
        <path d="M30 39 L32 46 L34 39 Z" fill="#fdf2f8" />
      </svg>
    ),
    // 7: Super Administrator with distinguished crest suit (Izzatullah Admin)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#fae8ff" />
        <circle cx="32" cy="24" r="14" fill="#fed7aa" />
        <path d="M18 19 C18 10 46 10 46 19 C42 12 37 9 32 9 C27 9 22 12 18 19 Z" fill="#3b0764" />
        <path d="M22 28 C22 35 42 35 42 28 C42 37 38 41 32 41 C26 41 22 37 22 28 Z" fill="#3b0764" />
        <path d="M12 60 C12 44 22 38 32 38 C42 38 52 44 52 60 Z" fill="#581c87" />
        <polygon points="43,45 45,49 41,49" fill="#f59e0b" />
        <path d="M28 38 L32 48 L36 38 Z" fill="#ffffff" />
        <path d="M31 42 L33 42 L34 54 L32 57 L30 54 Z" fill="#c026d3" />
      </svg>
    ),
    // 8: Shipping Line Officer in maritime crest blazer (Sohail Ahmad)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#ccfbf1" />
        <circle cx="32" cy="24" r="13" fill="#fde68a" />
        <path d="M18 18 C18 10 46 10 46 18 C42 12 37 9 32 9 C27 9 22 12 18 18 Z" fill="#0f766e" />
        <path d="M12 60 C12 44 22 39 32 39 C42 39 52 44 52 60 Z" fill="#134e4a" />
        <circle cx="43" cy="48" r="2" fill="#38bdf8" />
        <path d="M28 39 L32 49 L36 39 Z" fill="#ffffff" />
        <path d="M31 43 L33 43 L33.5 54 L32 57 L30.5 54 Z" fill="#0284c7" />
      </svg>
    ),
    // 9: Transport & Fleet Director (Tariq Jameel)
    (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#ffedd5" />
        <circle cx="32" cy="24" r="14" fill="#fed7aa" />
        <path d="M19 19 C19 11 45 11 45 19 C42 12 37 10 32 10 C27 10 22 12 19 19 Z" fill="#7c2d12" />
        <path d="M12 60 C12 44 22 39 32 39 C42 39 52 44 52 60 Z" fill="#9a3412" />
        <path d="M28 39 L32 49 L36 39 Z" fill="#ffffff" />
        <path d="M31 43 L33 43 L33.5 54 L32 57 L30.5 54 Z" fill="#15803d" />
      </svg>
    )
  ];

  const chosenPortrait = portraits[index % portraits.length];

  return (
    <div data-employee-avatar="true" className="w-full h-full relative overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/10 shadow-2xs">
      {chosenPortrait}
    </div>
  );
}

export default function SuperAdminAllUsersDirectoryPage() {
  const lang = useActiveLanguage();
  const isRTL = getLanguageDirection(lang) === "rtl";
  const th = (s: string) => translateHeader(lang, s);
  // User directory is populated exclusively from the scoped API. Never render
  // reference/demo rows when the API is unavailable or returns no records.
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters matching screenshot
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination & Password Visibility State
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, countryFilter, roleFilter, branchFilter, statusFilter]);

  // UI State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [portalsMenuOpen, setPortalsMenuOpen] = useState(false);
  const portalsMenuRef = useRef<HTMLDivElement>(null);
  const [activeMenuRowId, setActiveMenuRowId] = useState<string | null>(null);

  // Modals
  const [printModalUser, setPrintModalUser] = useState<UserDirectoryItem | null>(null);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDirectoryItem | null>(null);
  const [showModulePermModal, setShowModulePermModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"permissions" | "profile" | "handover">("permissions");
  const [userPermissions, setUserPermissions] = useState<Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }>>({});
  const [savingPerms, setSavingPerms] = useState(false);
  const [rulesSearchQuery, setRulesSearchQuery] = useState("");
  const [rulesCategoryFilter, setRulesCategoryFilter] = useState("All");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Change Password Modal State
  const [passwordModalUser, setPasswordModalUser] = useState<UserDirectoryItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Dynamic context
  const currentTime = "24 Apr 2025, 14:32";
  const [sess, setSess] = useState<any>(null);
  const [brandCompany, setBrandCompany] = useState<string | null>(null);

  useEffect(() => {
    fetchBranding(null).then((b) => setBrandCompany(brandingName(b, lang) || null)).catch(() => {});
    fetch("/api/erp/auth/session")
      .then((r) => r.json())
      .then((j) => setSess(j?.data || j))
      .catch(() => {});
  }, [lang]);

  const brandLine = brandCompany || "Daman Business Group";

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (portalsMenuRef.current && !portalsMenuRef.current.contains(e.target as Node)) {
        setPortalsMenuOpen(false);
      }
      setActiveMenuRowId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`${th("Copied to clipboard")}: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/users/journal-report?limit=100", { cache: "no-store" });
      if (!res.ok) {
        setUsers([]);
        return;
      }
      const json = await res.json();
      if (json.ok && Array.isArray(json.data?.rows) && json.data.rows.length > 0) {
        const rawList: any[] = json.data.rows;
        const mapped: UserDirectoryItem[] = rawList.map((u: any) => ({
          userId: String(u.userId || u.id || ""),
          userCode: String(u.userCode || u.user_code || ""),
          fullName: String(u.fullName || u.full_name || "-"),
          subtitle: u.subtitle || undefined,
          email: String(u.email || "-"),
          phone: u.phone || undefined,
          countryId: u.countryId || u.country_id || null,
          countryName: String(u.countryName || "-"),
          countryCode: u.countryCode || undefined,
          branchId: u.branchId || u.branch_id || null,
          branchName: String(u.branchName || "-"),
          role: String(u.role || ""),
          roleLabel: String(u.roleLabel || u.role || ""),
          businessType: String(u.businessType || "-"),
          businessId: String(u.businessId || "-"),
          isActive: String(u.status || "").toLowerCase() === "active",
          permissions: Array.isArray(u.permissions) ? u.permissions : [],
          permissionsCount: Array.isArray(u.permissions) ? u.permissions.length : 0,
          passwordKey: String(u.passwordKey || u.raw_password || ""),
          loginUrl: "/auth/login",
          loginPortalLabel: "ERP",
          createdAt: String(u.registrationDate || u.createdAt || ""),
          updatedAt: u.updatedAt || undefined,
          lastLogin: u.lastLogin || undefined
        }));
        setUsers(mapped);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Derived filter lists
  const countriesList = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.countryName).filter(Boolean)));
  }, [users]);

  const rolesList = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.roleLabel).filter(Boolean)));
  }, [users]);

  const branchesList = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.branchName).filter(Boolean)));
  }, [users]);

  // Filtered dataset
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        (u.subtitle && u.subtitle.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q) ||
        u.userCode.toLowerCase().includes(q) ||
        (u.businessId && u.businessId.toLowerCase().includes(q)) ||
        (u.businessType && u.businessType.toLowerCase().includes(q)) ||
        u.branchName.toLowerCase().includes(q) ||
        u.countryName.toLowerCase().includes(q) ||
        u.roleLabel.toLowerCase().includes(q);

      const matchesCountry = countryFilter === "all" || u.countryName === countryFilter;
      const matchesRole = roleFilter === "all" || u.roleLabel === roleFilter;
      const matchesBranch = branchFilter === "all" || u.branchName === branchFilter;
      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "active" && u.isActive) || 
        (statusFilter === "inactive" && !u.isActive);

      return matchesSearch && matchesCountry && matchesRole && matchesBranch && matchesStatus;
    });
  }, [users, searchQuery, countryFilter, roleFilter, branchFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // KPI calculations
  const stats = useMemo(() => {
    const total = filteredUsers.length;
    const active = filteredUsers.filter((u) => u.isActive).length;
    const admins = filteredUsers.filter((u) => u.role.toLowerCase().includes("super") || u.role === "super_admin").length;
    const staff = total - admins;
    const inactive = total - active;
    const branches = 18; // Standard branches across network
    const countries = 4;
    return { total, active, admins, staff, inactive, branches, countries };
  }, [filteredUsers]);

  // User Rules & Form Allocation Modal Handlers
  const openUserInspector = (user: UserDirectoryItem) => {
    setSelectedUser(user);
    setActiveModalTab("permissions");
    setRulesSearchQuery("");
    setRulesCategoryFilter("All");

    const held = new Set((user.permissions ?? []).map((p) => p.toLowerCase()));
    const hasWildcard = held.has("*:*") || held.has("*") || user.role.toLowerCase().includes("super_admin");
    const hasAnyRoute = Array.from(held).some((p) => p.startsWith("route:"));

    const initialPerms: Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }> = {};
    ALL_SYSTEM_FORMS.forEach((f) => {
      const res = (FORM_TO_RESOURCE_MAP[f.id] || f.id.replace(/^form-/, "")).toLowerCase();
      let isAllowed = false;
      let canRead = false;
      let canWrite = false;
      let canDelete = false;

      if (hasWildcard) {
        isAllowed = true;
        canRead = true;
        canWrite = true;
        canDelete = true;
      } else if (hasAnyRoute) {
        // Explicit saved rules in DB
        isAllowed = held.has(`route:${f.route.toLowerCase()}`);
        canRead = isAllowed && (held.has(`${res}:read`) || held.has(`${res}:*`) || held.size > 0);
        canWrite = isAllowed && (held.has(`${res}:create`) || held.has(`${res}:update`) || held.has(`${res}:write`) || held.has(`${res}:*`));
        canDelete = isAllowed && (held.has(`${res}:delete`) || held.has(`${res}:*`));
      } else {
        // Fallback default if unconfigured
        const isAdm = user.role.toLowerCase().includes("admin");
        isAllowed = isAdm || f.category === "Dashboards";
        canRead = isAllowed;
        canWrite = isAllowed && isAdm;
        canDelete = isAllowed && user.role.toLowerCase().includes("super_admin");
      }

      initialPerms[f.id] = {
        allowed: isAllowed,
        read: canRead,
        write: canWrite,
        delete: canDelete,
      };
    });
    setUserPermissions(initialPerms);
  };

  const toggleFormAccess = (formId: string) => {
    setUserPermissions((prev) => {
      const curr = prev[formId] || { allowed: false, read: false, write: false, delete: false };
      const nextAllowed = !curr.allowed;
      return {
        ...prev,
        [formId]: {
          allowed: nextAllowed,
          read: nextAllowed,
          write: nextAllowed ? curr.write : false,
          delete: nextAllowed ? curr.delete : false,
        }
      };
    });
  };

  const togglePermFlag = (formId: string, flag: "read" | "write" | "delete") => {
    setUserPermissions((prev) => {
      const curr = prev[formId] || { allowed: false, read: false, write: false, delete: false };
      return {
        ...prev,
        [formId]: {
          ...curr,
          [flag]: !curr[flag]
        }
      };
    });
  };

  const handleGrantAll = () => {
    const next: Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }> = {};
    ALL_SYSTEM_FORMS.forEach((f) => {
      next[f.id] = { allowed: true, read: true, write: true, delete: true };
    });
    setUserPermissions(next);
  };

  const handleRevokeAll = () => {
    const next: Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }> = {};
    ALL_SYSTEM_FORMS.forEach((f) => {
      next[f.id] = { allowed: false, read: false, write: false, delete: false };
    });
    setUserPermissions(next);
  };

  const handleViewOnlyAll = () => {
    setUserPermissions((prev) => {
      const next: Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }> = {};
      ALL_SYSTEM_FORMS.forEach((f) => {
        const curr = prev[f.id];
        const isAllowed = curr ? curr.allowed : true;
        next[f.id] = { allowed: isAllowed, read: isAllowed, write: false, delete: false };
      });
      return next;
    });
  };

  const FORM_TO_RESOURCE_MAP: Record<string, string> = {
    "dash-main": "dashboard",
    "dash-smart-ops": "dashboard",
    "dash-super": "dashboard",
    "dash-country": "dashboard",
    "dash-city": "dashboard",
    "dash-logistics": "dashboard",
    "form-user-reg": "users",
    "form-user-dir": "users",
    "form-branch-super": "country_branches",
    "form-branch-country": "country_branches",
    "form-branch-city": "city_branches",
    "form-accounts": "accounts",
    "form-ledger-new": "ledgers",
    "form-customers": "customers",
    "form-goods": "products",
    "form-cash-entry": "roznamcha",
    "form-expenses": "expenses",
    "form-exchange": "exchange_rates",
    "form-banks": "banks",
    "form-roznamcha-all": "roznamcha",
    "form-ledger": "ledgers",
    "form-po-wizard": "purchases",
    "form-po-confirm": "purchases",
    "form-po-adv": "transactions",
    "form-po-rem": "transactions",
    "form-po-local": "purchases",
    "form-local-goods": "purchases",
    "form-consignment": "purchases",
    "form-inventory": "products",
    "form-sales-new": "sales",
    "form-sales-confirm": "sales",
    "form-sales-local": "sales",
    "form-sales-order": "sales",
    "form-transit-entry": "shipping_records",
    "form-customs-gd": "clearing_agents",
    "form-transit-loading": "shipping_records",
    "form-truck-reg": "shipping_records",
    "form-clearing-bill": "clearing_agents",
    "form-shipping-line": "shipping_records",
    "form-bl-entry": "shipping_records",
    "form-whatsapp": "communication",
    "form-email": "communication",
    "form-sms": "communication",
    "form-ai-voice": "communication",
    "form-company-settings": "companies",
    "form-location-settings": "locations",
    "form-ports-settings": "ports",
    "form-tax-uae": "tax",
    "form-audit": "audit_logs"
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUser) return;
    setSavingPerms(true);
    try {
      const permsSet = new Set<string>();
      if (selectedUser.role.toLowerCase().includes("super_admin")) {
        permsSet.add("*:*");
      }
      ALL_SYSTEM_FORMS.forEach((form) => {
        const flags = userPermissions[form.id];
        if (!flags || !flags.allowed) return;

        // 1. Critical for Navigation Sidebar: store route token so sidebar displays this form
        permsSet.add(`route:${form.route}`);

        // 2. Resource action tokens for API authorization
        const res = FORM_TO_RESOURCE_MAP[form.id] || form.id.replace(/^form-/, "");
        if (flags.read) permsSet.add(`${res}:read`);
        if (flags.write) {
          permsSet.add(`${res}:create`);
          permsSet.add(`${res}:update`);
        }
        if (flags.delete) permsSet.add(`${res}:delete`);
      });

      const updatedPermissions = Array.from(permsSet);

      const response = await fetch("/api/erp/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.userId,
          userCode: selectedUser.userCode,
          email: selectedUser.email,
          permissions: updatedPermissions
        })
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to update permissions");
      }

      // Optimistically update local users state
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === selectedUser.userId || u.userCode.toLowerCase() === selectedUser.userCode.toLowerCase()
            ? { ...u, permissions: updatedPermissions, permissionsCount: updatedPermissions.length }
            : u
        )
      );

      showToast(th("Rules & form allocations saved! User navigation menu updated."));
      setSelectedUser(null);
      await fetchUsers();
    } catch (err: any) {
      showToast(th(`Failed to save rules: ${err?.message || "Unknown error"}`));
    } finally {
      setSavingPerms(false);
    }
  };

  // Change Password Handlers
  const handleOpenPasswordModal = (user: UserDirectoryItem) => {
    setPasswordModalUser(user);
    setNewPasswordInput("");
    setShowModalPassword(false);
    setPasswordError(null);
  };

  const handleSavePassword = async () => {
    if (!passwordModalUser) return;
    const trimmed = newPasswordInput.trim();
    if (!trimmed) {
      setPasswordError(th("Password cannot be empty"));
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      const res = await fetch("/api/erp/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: passwordModalUser.userId,
          userCode: passwordModalUser.userCode,
          email: passwordModalUser.email,
          newPassword: trimmed
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      // Update local state for all user lists
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === passwordModalUser.userId || u.userCode.toLowerCase() === passwordModalUser.userCode.toLowerCase()
            ? { ...u, passwordKey: trimmed }
            : u
        )
      );
      if (selectedUser && (selectedUser.userId === passwordModalUser.userId || selectedUser.userCode.toLowerCase() === passwordModalUser.userCode.toLowerCase())) {
        setSelectedUser((prev) => (prev ? { ...prev, passwordKey: trimmed } : null));
      }
      showToast(`${th("Password updated successfully for")} ${passwordModalUser.fullName} (${trimmed})`);
      setPasswordModalUser(null);
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = ["Sr #", "User Code", "Full Name", "Role / Level", "Country", "Branch / City", "Email", "Password Key", "Portal", "Status"];
    const rows = filteredUsers.map((u, i) => [
      i + 1,
      u.userCode,
      u.fullName,
      u.roleLabel,
      u.countryName,
      u.branchName,
      u.email,
      u.passwordKey,
      u.loginPortalLabel,
      u.isActive ? "ACTIVE" : "INACTIVE"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DGT_ERP_Users_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(th("Users register exported to CSV."));
  };

  const handlePrintA4 = () => {
    window.print();
  };

  // Avatar helper
  const getAvatarInitials = (name: string, userCode: string) => {
    if (!name) return "US";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userCode.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      "bg-sky-100 text-sky-700",
      "bg-purple-100 text-purple-700",
      "bg-rose-100 text-rose-700",
      "bg-indigo-100 text-indigo-700",
      "bg-amber-100 text-amber-700",
      "bg-emerald-100 text-emerald-700",
      "bg-teal-100 text-teal-700",
      "bg-blue-100 text-blue-700",
    ];
    return colors[index % colors.length];
  };

  const getRoleBadgeStyle = (roleLabel: string) => {
    const rl = (roleLabel || "").toUpperCase();
    if (rl.includes("SUPER_ADMIN") || rl.includes("SUPER ADMIN")) {
      return "bg-[#ffe4e6] text-[#e11d48] border-[#fecdd3]";
    }
    if (rl.includes("COUNTRY_ADMIN") || rl.includes("COUNTRY ADMIN")) {
      return "bg-[#ede9fe] text-[#7c3aed] border-[#ddd6fe]";
    }
    if (rl.includes("CITY_BRANCH_ADMIN") || rl.includes("CITY BRANCH ADMIN") || rl.includes("CITY ADMIN")) {
      return "bg-[#e0f2fe] text-[#0284c7] border-[#bae6fd]";
    }
    if (rl.includes("BRANCH_ADMIN") || rl.includes("BRANCH ADMIN")) {
      return "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]";
    }
    if (rl.includes("STAFF")) {
      return "bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]";
    }
    if (rl.includes("AGENT")) {
      return "bg-[#fef3c7] text-[#d97706] border-[#fde68a]";
    }
    return "bg-[#e0e7ff] text-[#4338ca] border-[#c7d2fe]";
  };

  const getCountryFlag = (countryName: string) => {
    if (countryName.includes("Emirates") || countryName.includes("UAE")) return "🇦🇪";
    if (countryName.includes("Pakistan")) return "🇵🇰";
    if (countryName.includes("Afghanistan")) return "🇦🇫";
    if (countryName.includes("India")) return "🇮🇳";
    return "🌐";
  };

  const getPortalBadgeStyle = (label: string) => {
    if (label.includes("City")) {
      return "bg-[#e0f2fe] text-[#0284c7] hover:bg-[#bae6fd]";
    }
    if (label.includes("Country")) {
      return "bg-[#ede9fe] text-[#7c3aed] hover:bg-[#ddd6fe]";
    }
    if (label.includes("Admin")) {
      return "bg-[#ffe4e6] text-[#e11d48] hover:bg-[#fecdd3]";
    }
    return "bg-[#fef3c7] text-[#d97706] hover:bg-[#fde68a]";
  };

  return (
    <div className={cn("w-full space-y-4 pb-12 font-sans", isRTL && "rtl")}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 end-8 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl border border-indigo-500/40 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. BREADCRUMB & HEADER SECTION ─── */}
      <div className="space-y-3 print:hidden">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <Link href="/dashboard/new-entry" className="hover:text-foreground transition-colors">New Entry</Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span>User Accounts</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="font-semibold text-foreground">S Admin / All Users Directory</span>
        </div>

        {/* Title & Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-xs border border-purple-200 dark:border-purple-800/60">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {th("S Admin / All Users Directory")}
                </h1>
                <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                  {th("USER MANAGEMENT")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {th("Centralized registeor of all users by branch, country, client type, role, access credentials, and granular form permission matrix.")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Login Portals Dropdown Button */}
            <div className="relative" ref={portalsMenuRef}>
              <Button
                variant="outline"
                onClick={() => setPortalsMenuOpen(!portalsMenuOpen)}
                className="border-slate-300 dark:border-slate-700 bg-background hover:bg-muted text-foreground font-bold text-xs h-9 px-3.5 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Laptop className="h-3.5 w-3.5 text-slate-500" />
                <span>{th("Login Portals")}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", portalsMenuOpen && "rotate-180")} />
              </Button>

              {portalsMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                  <div className="p-2.5 border-b border-border bg-muted/40 font-bold text-xs flex items-center justify-between">
                    <span>{th("Direct Login Portals")}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="p-1.5 space-y-1 text-xs">
                    <a href="/auth/login" target="_blank" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted font-medium transition-colors">
                      <span>{th("Universal Login")}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">/auth/login</span>
                    </a>
                    <a href="/auth/login/admin" target="_blank" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted font-medium text-rose-600 transition-colors">
                      <span>{th("Super Admin Portal")}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">/admin</span>
                    </a>
                    <a href="/auth/login/country" target="_blank" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted font-medium text-purple-600 transition-colors">
                      <span>{th("Country Admin Portal")}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">/country</span>
                    </a>
                    <a href="/auth/login/city" target="_blank" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted font-medium text-sky-600 transition-colors">
                      <span>{th("City Branch Portal")}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">/city</span>
                    </a>
                    <a href="/auth/login/clearing-agent" target="_blank" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted font-medium text-amber-600 transition-colors">
                      <span>{th("Shipping / Clearing Portal")}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">/clearing</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Print A4 Handover Sheet Button */}
            <Button
              onClick={() => { setPrintModalUser(null); setShowBatchPrint(true); }}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{th("Print A4 Handover Sheet")}</span>
            </Button>

            {/* Export CSV Button */}
            <Button
              onClick={handleExportCsv}
              variant="outline"
              className="border-slate-300 dark:border-slate-700 bg-background hover:bg-muted text-foreground font-bold text-xs h-9 px-3.5 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>{th("Export CSV")}</span>
            </Button>

            {/* Module Edit & Delete Access Button */}
            <Button
              onClick={() => setShowModulePermModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 px-3.5 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{th("Module Edit & Delete Access")}</span>
            </Button>

            {/* New User Form Button */}
            <Link href="/dashboard/new-entry/users/registration">
              <Button className="bg-[#00a86b] hover:bg-[#00905c] text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer">
                <UserPlus className="h-3.5 w-3.5" />
                <span>{th("+ New User Form")}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 2. SEARCH & MULTI-FILTER BAR ─── */}
      <div className="bg-card p-3 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between print:hidden">
        <div className="relative w-full md:w-[380px]">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={th("Search users by name, email, role, country, branch...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-9 pe-3 py-1.5 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-foreground placeholder:text-muted-foreground font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none text-foreground font-semibold"
          >
            <option value="all">{th("All Countries")}</option>
            {countriesList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none text-foreground font-semibold"
          >
            <option value="all">{th("All Roles")}</option>
            {rolesList.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none text-foreground font-semibold"
          >
            <option value="all">{th("All Branches / Cities")}</option>
            {branchesList.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none text-foreground font-semibold"
          >
            <option value="all">{th("All Statuses")}</option>
            <option value="active">{th("Active Only")}</option>
            <option value="inactive">{th("Inactive Only")}</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setCountryFilter("all");
              setRoleFilter("all");
              setBranchFilter("all");
              setStatusFilter("all");
            }}
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-xl flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            <span>{th("Reset Filters")}</span>
          </Button>
        </div>
      </div>

      {/* ─── 3. 4 TOP KPI CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 print:hidden">
        
        {/* CARD 1: BRANCH / USER DETAILS */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
                {th("BRANCH / USER DETAILS")}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-blue-500" />
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Total Countries")}</span>
              <span className="font-mono font-bold text-foreground">{stats.countries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Total Branches")}</span>
              <span className="font-mono font-bold text-foreground">{stats.branches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Total Users")}</span>
              <span className="font-mono font-bold text-foreground">{stats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Active Users")}</span>
              <span className="font-mono font-bold text-foreground">{stats.active}</span>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60">
            {th("Last updated")}: {currentTime}
          </div>
        </div>

        {/* CARD 2: GLOBAL USER SUMMARY */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                <Globe className="h-4 w-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {th("GLOBAL USER SUMMARY")}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-emerald-500" />
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Total Users")}</span>
              <span className="font-mono font-bold text-foreground">{stats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Active Users")}</span>
              <span className="font-mono font-bold text-foreground">{stats.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Admin & Managers")}</span>
              <span className="font-mono font-bold text-foreground">{stats.admins}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Staff & Cashiers")}</span>
              <span className="font-mono font-bold text-foreground">{stats.staff}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Inactive Users")}</span>
              <span className="font-mono font-bold text-foreground">{stats.inactive}</span>
            </div>
          </div>
        </div>

        {/* CARD 3: ACCESS COVERAGE */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                {th("ACCESS COVERAGE")}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-purple-500" />
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Countries")}</span>
              <span className="font-mono font-bold text-foreground">{stats.countries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("City Branches")}</span>
              <span className="font-mono font-bold text-foreground">{stats.branches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("System Roles")}</span>
              <span className="font-mono font-bold text-foreground">6</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Form Types")}</span>
              <span className="font-mono font-bold text-foreground">32</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">{th("Menu Permissions")}</span>
              <span className="font-mono font-bold text-foreground">48</span>
            </div>
          </div>
        </div>

        {/* CARD 4: QUICK HANDOVER TOOLS */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-300 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
                {th("QUICK HANDOVER TOOLS")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {th("Generate professional handover sheets with login credentials for individual users or filtered groups.")}
            </p>
          </div>

          <Button
            onClick={() => { setPrintModalUser(null); setShowBatchPrint(true); }}
            variant="outline"
            className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-bold text-xs h-9 rounded-lg flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{th("Generate Handover Sheet")}</span>
          </Button>
        </div>

      </div>

      {/* ─── 4. FULL-WIDTH USERS DATA DIRECTORY TABLE ─── */}
      <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden print:border-none print:shadow-none">
        
        {/* Table Title Bar */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Users className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-foreground">
              {th("All Users")} ({filteredUsers.length})
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {th("Showing")} {filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredUsers.length)} {th("of")} {filteredUsers.length} {th("users")}
          </span>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 flex items-center gap-3 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Data Table Matching Reference Design */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-border text-slate-600 dark:text-slate-400 font-bold text-[11px]">
              <tr>
                <th className="py-3 px-3.5 text-center w-10">#</th>
                <th className="py-3 px-3.5 min-w-[210px]">{th("Employee Name")}</th>
                <th className="py-3 px-3.5 min-w-[130px]">{th("Username")}</th>
                <th className="py-3 px-3.5 min-w-[170px]">{th("Role / Level")}</th>
                <th className="py-3 px-3.5 min-w-[170px]">{th("ID Type / Business Scope")}</th>
                <th className="py-3 px-3.5 min-w-[190px]">{th("Business ID / Shipping Line ID")}</th>
                <th className="py-3 px-3.5 min-w-[160px]">{th("Country")}</th>
                <th className="py-3 px-3.5 min-w-[140px]">{th("Branch / City")}</th>
                <th className="py-3 px-3.5 min-w-[190px]">{th("Email")}</th>
                <th className="py-3 px-3.5 min-w-[120px]">{th("Password")}</th>
                <th className="py-3 px-3.5 text-center min-w-[90px]">{th("Status")}</th>
                <th className="py-3 px-3.5 min-w-[110px]">{th("Last Login")}</th>
                <th className="py-3 px-3.5 text-center min-w-[130px] print:hidden">{th("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>{th("Loading users directory...")}</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-bold text-sm">{th("No users found matching current filters.")}</p>
                    <p className="text-xs mt-1">{th("Try clearing your search query or reset filter dropdowns.")}</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  const isPwdVisible = Boolean(visiblePasswords[u.userId]);

                  return (
              <tr
                      key={u.userId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. # */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                        {rowNumber}
                      </td>

                      {/* 2. Employee Name with Picture Avatar + Subtitle */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-10 w-10 rounded-full shrink-0 shadow-xs">
                            <EmployeeAvatar
                              name={u.fullName}
                              avatarUrl={u.avatarUrl}
                              initials={u.avatarInitials || getAvatarInitials(u.fullName, u.userCode)}
                              colorClass={u.avatarColor || getAvatarColor(index)}
                              index={rowNumber - 1}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-[12px] leading-tight">
                              {u.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate leading-tight mt-0.5">
                              {u.subtitle || "Office Operations"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Username */}
                      <td className="py-3.5 px-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                          {u.userCode}
                        </span>
                      </td>

                      {/* 4. Role / Level */}
                      <td className="py-3.5 px-3">
                        <span className={cn("px-2.5 py-1 text-[10px] font-black rounded-md uppercase tracking-wider inline-block", getRoleBadgeStyle(u.roleLabel))}>
                          {u.roleLabel}
                        </span>
                      </td>

                      {/* 5. Business Type */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium text-xs">
                          <BusinessTypeIcon type={u.businessType} />
                          <span className="truncate">{u.businessType || "General Business"}</span>
                        </div>
                      </td>

                      {/* 6. Business ID / Shipping Line ID */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {u.businessId || "DB-001"}
                        </span>
                      </td>

                      {/* 7. Country */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <CountryFlagIcon countryName={u.countryName} />
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-xs">{u.countryName}</span>
                        </div>
                      </td>

                      {/* 8. Branch / City */}
                      <td className="py-3.5 px-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-xs">
                          {u.branchName}
                        </span>
                      </td>

                      {/* 9. Email with Mail icon */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                          <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{u.email}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.email, `email-${u.userId}`)}
                            title={th("Copy Email")}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                          >
                            {copiedKey === `email-${u.userId}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      {/* 10. Password with eye toggle, copy & change modal - Strictly authorized for Super Admin */}
                      <td className="py-3.5 px-3">
                        {sess?.isSuperAdmin ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800 dark:text-slate-200">
                            <span className={cn("font-medium select-none", !isPwdVisible && "tracking-widest")}>
                              {isPwdVisible ? (u.passwordKey || "—") : "••••••••"}
                            </span>
                            {u.passwordKey ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setVisiblePasswords((prev) => ({ ...prev, [u.userId]: !prev[u.userId] }))}
                                  title={isPwdVisible ? th("Hide Password") : th("Show Password")}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                                >
                                  {isPwdVisible ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(u.passwordKey, `pwd-${u.userId}`)}
                                  title={th("Copy Password")}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                                >
                                  {copiedKey === `pwd-${u.userId}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleOpenPasswordModal(u)}
                              title={th("Change Password")}
                              className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 hover:text-indigo-700 cursor-pointer shrink-0 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                            <span className="font-medium select-none tracking-widest">••••••••</span>
                          </div>
                        )}
                      </td>

                      {/* 11. Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={cn(
                          "px-3 py-0.5 text-[11px] font-bold rounded-full inline-flex items-center justify-center",
                          u.isActive
                            ? "bg-[#e6f9f0] text-[#00a86b] dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-[#ffebee] text-[#e53935] dark:bg-rose-950/60 dark:text-rose-300"
                        )}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* 12. Last Login */}
                      <td className="py-3.5 px-3">
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 leading-tight whitespace-pre-line">
                          {u.lastLogin || "15/09/2026\n10:00 AM"}
                        </div>
                      </td>

                      {/* 13. Actions */}
                      <td className="py-3.5 px-3 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Rules button */}
                          <Button
                            size="sm"
                            onClick={() => openUserInspector(u)}
                            className="h-7 px-2.5 text-[11px] font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 transition-all hover:scale-[1.02]"
                            title={th("User Rules & Form Allocation")}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{th("Rules")}</span>
                          </Button>

                          {/* A4 Slip button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setPrintModalUser(u); setShowBatchPrint(false); }}
                            className="h-7 px-2 text-[11px] font-bold bg-white dark:bg-card border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md shadow-xs cursor-pointer flex items-center gap-1"
                            title={th("Print A4 Handover Slip")}
                          >
                            <FileText className="w-3 h-3" />
                            <span>{th("Slip")}</span>
                          </Button>

                          {/* Pencil Edit Icon */}
                          <Link href={`/dashboard/new-entry/users/registration?userId=${u.userId}`}>
                            <button
                              type="button"
                              title={th("Edit User")}
                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </Link>

                          {/* 3 Dots Menu */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuRowId(activeMenuRowId === u.userId ? null : u.userId);
                              }}
                              title={th("More Actions")}
                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activeMenuRowId === u.userId && (
                              <div className="absolute right-0 mt-1 w-52 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-50 p-1 text-xs text-left animate-in fade-in zoom-in-95">
                                <button
                                  type="button"
                                  onClick={() => { openUserInspector(u); setActiveMenuRowId(null); }}
                                  className="w-full text-left p-2 rounded-lg hover:bg-muted flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{th("Rules & Form Allocation")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { handleOpenPasswordModal(u); setActiveMenuRowId(null); }}
                                  className="w-full text-left p-2 rounded-lg hover:bg-muted flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300"
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{th("Change Password")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setPrintModalUser(u); setShowBatchPrint(false); setActiveMenuRowId(null); }}
                                  className="w-full text-left p-2 rounded-lg hover:bg-muted flex items-center gap-2"
                                >
                                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{th("Print A4 Slip")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { copyToClipboard(u.passwordKey, `pwd-${u.userId}`); setActiveMenuRowId(null); }}
                                  className="w-full text-left p-2 rounded-lg hover:bg-muted flex items-center gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{th("Copy Credentials")}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Bottom Pagination Bar Matching Reference Image ─── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-card print:hidden">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {th("Showing")} {filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} {th("to")} {Math.min(currentPage * pageSize, filteredUsers.length)} {th("of")} {filteredUsers.length} {th("users")}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 rounded-md border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-40"
              title={th("Previous Page")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "h-8 w-8 p-0 rounded-md text-xs font-bold cursor-pointer transition-colors",
                  currentPage === page
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs border-blue-600"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {page}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0 rounded-md border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-40"
              title={th("Next Page")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 5. FOOTER SPECIFICATION ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground print:hidden">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-blue-600 text-white font-black text-[10px] flex items-center justify-center">
            D
          </div>
          <span className="font-bold text-foreground">DGT ERP</span>
          <span>|</span>
          <span>Daman Business Group</span>
          <span className="text-muted-foreground/60">— Powering Global Trade & Operations</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-mono">v2.8.0</span>
          <span className="text-muted-foreground/40">•</span>
          <span>Secure</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-emerald-600 font-semibold flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Online
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span>© 2025 Daman Business Group. All rights reserved.</span>
        </div>
      </div>

      {/* ─── 6. USER RULES & FORM ALLOCATION MODAL (قواعد اور فارم تفویض) ─── */}
      {selectedUser && (() => {
        const allottedCount = Object.values(userPermissions).filter((p) => p.allowed).length;
        const totalFormsCount = ALL_SYSTEM_FORMS.length;
        const modalCategories = [
          "All",
          "Dashboards",
          "New Entry",
          "Accounting & Roznamcha",
          "Trade & Purchase",
          "Sales & Distribution",
          "Shipping & Clearing",
          "Communication & AI",
          "Administration"
        ];
        const modalDisplayedForms = ALL_SYSTEM_FORMS.filter((form) => {
          const matchesCategory = rulesCategoryFilter === "All" || form.category === rulesCategoryFilter;
          const q = rulesSearchQuery.trim().toLowerCase();
          const matchesQuery =
            !q ||
            form.name.toLowerCase().includes(q) ||
            form.route.toLowerCase().includes(q) ||
            form.category.toLowerCase().includes(q);
          return matchesCategory && matchesQuery;
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:hidden animate-in fade-in">
            <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-foreground">

              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-indigo-900/50">
                <div className="flex items-center gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-950/50">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black tracking-tight">
                        {th("User Rules & Form Allocation")}
                      </h2>
                      <span className="text-xs font-bold text-indigo-300">
                        (قواعد اور فارم تفویض)
                      </span>
                    </div>
                    <p className="text-xs text-indigo-200/80 mt-0.5">
                      {th("Allocate forms, control menu appearance, and configure Read, Edit/Create, and Delete privileges.")}
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ─── TOP SECTION: User Details & Live Allotment Card ("Upar user ka detail") ─── */}
              <div className="bg-gradient-to-r from-slate-900/50 via-indigo-950/20 to-slate-900/50 p-4 border-b border-border">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
                  {/* User Profile Summary */}
                  <div className="lg:col-span-8 flex items-start sm:items-center gap-3.5">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-base shadow-md shrink-0",
                      selectedUser.avatarColor || "bg-indigo-600 text-white"
                    )}>
                      {selectedUser.avatarInitials || selectedUser.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-foreground truncate">
                          {selectedUser.fullName}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30">
                          {selectedUser.userCode}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 uppercase">
                          {selectedUser.roleLabel}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                          selectedUser.isActive ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", selectedUser.isActive ? "bg-emerald-500" : "bg-rose-500")} />
                          {selectedUser.isActive ? "Active Account" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-mono">{selectedUser.email}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{selectedUser.branchName}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{selectedUser.countryName}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Live Allotment Indicator */}
                  <div className="lg:col-span-4 bg-background/80 dark:bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-3 flex items-center justify-between sm:justify-end gap-3 shadow-xs">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {th("Allotted in Menu")}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                          {allottedCount}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          / {totalFormsCount} {th("Forms")}
                        </span>
                      </div>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <SlidersHorizontal className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-6 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalTab("permissions")}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                    activeModalTab === "permissions"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background rounded-t-lg shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{th("Rules & Form Allocation")} ({allottedCount} {th("Allotted")})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModalTab("profile")}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                    activeModalTab === "profile"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background rounded-t-lg shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{th("Branch & Identity Profile")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModalTab("handover")}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                    activeModalTab === "handover"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background rounded-t-lg shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{th("A4 Official Slip")}</span>
                </button>
              </div>

              {/* Modal Content Body */}
              <div className="p-6 overflow-y-auto max-h-[58vh] space-y-4">

                {/* TAB 1: RULES & FORM ALLOCATION */}
                {activeModalTab === "permissions" && (
                  <div className="space-y-4">
                    {/* Filter & Action Controls Bar */}
                    <div className="bg-muted/40 p-3.5 rounded-2xl border border-border space-y-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            value={rulesSearchQuery}
                            onChange={(e) => setRulesSearchQuery(e.target.value)}
                            placeholder={th("Search ERP forms or routes...")}
                            className="w-full h-8.5 pl-9 pr-3 text-xs rounded-xl border border-input bg-background text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {rulesSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setRulesSearchQuery("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Presets Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleGrantAll}
                            className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl cursor-pointer flex items-center gap-1"
                            title={th("Allot all forms with full access")}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{th("Allot All")}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleViewOnlyAll}
                            className="h-8 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl cursor-pointer flex items-center gap-1"
                            title={th("Set all forms to View Only (No Edit or Delete)")}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{th("View Only")}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRevokeAll}
                            className="h-8 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer flex items-center gap-1"
                            title={th("Close all forms and remove from menu")}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{th("Close All")}</span>
                          </Button>
                        </div>
                      </div>

                      {/* Category Pills Filter */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                        {modalCategories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setRulesCategoryFilter(cat)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer",
                              rulesCategoryFilter === cat
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                            )}
                          >
                            {cat === "All" ? th("All Categories") : th(cat)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rules Table ("Neeche rules aayega") */}
                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/70 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border">
                          <tr>
                            <th className="px-4 py-3">{th("Form / Module & URL")}</th>
                            <th className="px-3 py-3">{th("Category")}</th>
                            <th className="px-3 py-3 text-center">{th("Form Allocation (Menu)")}</th>
                            <th className="px-3 py-3 text-center">{th("Read")} (دیکھنا)</th>
                            <th className="px-3 py-3 text-center">{th("Edit / Create")} (ترمیم)</th>
                            <th className="px-3 py-3 text-center">{th("Delete")} (حذف)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {modalDisplayedForms.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                                {th("No matching forms found for the selected category or search filter.")}
                              </td>
                            </tr>
                          ) : (
                            modalDisplayedForms.map((form) => {
                              const p = userPermissions[form.id] || { allowed: false, read: false, write: false, delete: false };
                              return (
                                <tr
                                  key={form.id}
                                  className={cn(
                                    "hover:bg-muted/30 transition-colors",
                                    !p.allowed && "opacity-50 bg-muted/10"
                                  )}
                                >
                                  {/* Form name and route */}
                                  <td className="px-4 py-2.5 font-bold text-foreground">
                                    <div className="flex items-center gap-1.5">
                                      <span>{th(form.name)}</span>
                                    </div>
                                    <div className="text-[10px] font-mono text-muted-foreground font-normal">
                                      {form.route}
                                    </div>
                                  </td>

                                  {/* Category pill */}
                                  <td className="px-3 py-2.5">
                                    <span className="inline-block rounded px-2 py-0.5 text-[9px] font-extrabold bg-muted text-muted-foreground border border-border">
                                      {th(form.category)}
                                    </span>
                                  </td>

                                  {/* Allocation Toggle Button */}
                                  <td className="px-3 py-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => toggleFormAccess(form.id)}
                                      className={cn(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1",
                                        p.allowed
                                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                          : "bg-muted hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground"
                                      )}
                                      title={p.allowed ? th("Form is allotted to this user's menu") : th("Form is closed and hidden from menu")}
                                    >
                                      {p.allowed ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>{th("Allotted")}</span>
                                        </>
                                      ) : (
                                        <>
                                          <X className="w-3 h-3" />
                                          <span>{th("Closed")}</span>
                                        </>
                                      )}
                                    </button>
                                  </td>

                                  {/* Read Permission Checkbox */}
                                  <td className="px-3 py-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={p.read}
                                      disabled={!p.allowed}
                                      onChange={() => togglePermFlag(form.id, "read")}
                                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                      title={th("Allow user to view and read records in this form")}
                                    />
                                  </td>

                                  {/* Write / Edit Permission Checkbox */}
                                  <td className="px-3 py-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={p.write}
                                      disabled={!p.allowed}
                                      onChange={() => togglePermFlag(form.id, "write")}
                                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                      title={th("Allow user to create and edit records in this form")}
                                    />
                                  </td>

                                  {/* Delete Permission Checkbox */}
                                  <td className="px-3 py-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={p.delete}
                                      disabled={!p.allowed}
                                      onChange={() => togglePermFlag(form.id, "delete")}
                                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                      title={th("Allow user to delete records in this form")}
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 2: PROFILE & CREDENTIALS */}
                {activeModalTab === "profile" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                        <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <Users className="h-4 w-4" /> {th("Identity & Role Assignment")}
                        </h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between pb-1 border-b border-border">
                            <span className="text-muted-foreground">{th("User Code")}:</span>
                            <span className="font-mono font-bold text-foreground">{selectedUser.userCode}</span>
                          </div>
                          <div className="flex justify-between pb-1 border-b border-border">
                            <span className="text-muted-foreground">{th("Full Name")}:</span>
                            <span className="font-bold text-foreground">{selectedUser.fullName}</span>
                          </div>
                          <div className="flex justify-between pb-1 border-b border-border">
                            <span className="text-muted-foreground">{th("Primary Role")}:</span>
                            <span className="font-black text-indigo-600">{selectedUser.roleLabel}</span>
                          </div>
                          <div className="flex justify-between pb-1 border-b border-border">
                            <span className="text-muted-foreground">{th("Assigned Country")}:</span>
                            <span className="font-bold text-foreground">{selectedUser.countryName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{th("Assigned Branch")}:</span>
                            <span className="font-bold text-foreground">{selectedUser.branchName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                        <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <KeyRound className="h-4 w-4" /> {th("Credentials & Access Vault")}
                        </h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between pb-1 border-b border-border">
                            <span className="text-muted-foreground">{th("Vault Reference")}:</span>
                            <span className="font-mono font-bold text-foreground">{selectedUser.passwordVaultRef}</span>
                          </div>
                          <div className="flex justify-between pb-1 border-b border-border">
                            <span className="text-muted-foreground">{th("Login Email")}:</span>
                            <span className="font-mono font-bold text-foreground">{selectedUser.email}</span>
                          </div>
                          <div className="flex justify-between pb-1 border-b border-border items-center">
                            <span className="text-muted-foreground">{th("Access Password")}:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                                {selectedUser.passwordKey || "••••••••"}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPasswordModal(selectedUser)}
                                className="h-6 px-2 text-[10px] font-bold text-indigo-600 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded cursor-pointer flex items-center gap-1"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>{th("Change")}</span>
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">{th("Direct Login URL")}:</span>
                            <span className="font-mono text-[10px] text-blue-600 truncate max-w-[180px]">{selectedUser.loginUrl}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: A4 ONBOARDING SLIP */}
                {activeModalTab === "handover" && (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="bg-white text-slate-900 w-full max-w-xl p-6 rounded-2xl shadow-md border border-slate-200 font-sans space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{brandLine}</h4>
                          <p className="text-[10px] font-bold text-indigo-700 uppercase">{th("OFFICIAL EMPLOYEE ACCESS SLIP")}</p>
                        </div>
                        <div className="text-right text-[9px] font-mono text-slate-500">
                          Date: <span suppressHydrationWarning>{new Date().toLocaleDateString(`${lang}-u-ca-gregory-nu-latn`, { calendar: "gregory", numberingSystem: "latn" })}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">{th("EMPLOYEE / OFFICER NAME")}</span>
                          <span className="font-bold text-slate-900">{selectedUser.fullName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">{th("USER CODE")}</span>
                          <span className="font-mono font-bold text-slate-900">{selectedUser.userCode}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">{th("ROLE & JURISDICTION")}</span>
                          <span className="font-bold text-indigo-700">{selectedUser.roleLabel}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">{th("BRANCH LOCATION")}</span>
                          <span className="font-bold text-slate-900">{selectedUser.branchName}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-500 font-bold block">{th("LOGIN USERNAME / EMAIL")}</span>
                          <span className="font-mono font-bold text-slate-900 break-all bg-slate-50 p-1.5 rounded border border-slate-200 block">{selectedUser.email}</span>
                        </div>
                        <div className="col-span-2 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                          <span className="text-[10px] text-emerald-800 font-bold block">{th("INITIAL ACCESS PASSWORD")}</span>
                          <span className="font-mono font-black text-emerald-700 text-sm">{selectedUser.passwordKey || th("Not set in vault")}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 flex justify-between text-[9px] text-slate-500 font-medium">
                        <span>{th("Authorized by")}: {sess?.user?.fullName || sess?.fullName || sess?.user?.email || "—"}</span>
                        <span>{th("Generated")}: {currentTime || "—"}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => { setPrintModalUser(selectedUser); }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl cursor-pointer shadow-xs"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1.5" />
                      {th("Open Official Print Preview")}
                    </Button>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="border-t border-border bg-muted/20 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>
                    {th("Allotted Forms")}: <strong className="text-foreground">{allottedCount}</strong> / {totalFormsCount} • {th("Unallotted forms are automatically hidden from this user's sidebar menu.")}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedUser(null)}
                    className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    {th("Cancel")}
                  </Button>
                  <Button
                    onClick={handleSaveUserPermissions}
                    disabled={savingPerms}
                    className="h-9 px-4 text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {savingPerms ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{th("Saving Rules...")}</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>{th("Save Rules & Update Navigation Menu")}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ─── 7. A4 PRINT MODAL PREVIEW (Batch or Single User) ─── */}
      {(showBatchPrint || printModalUser) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:z-auto">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-foreground print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:p-0">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40 print:hidden">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Printer className="w-4 h-4 text-indigo-600" />
                {printModalUser ? `Official A4 Handover Slip: ${printModalUser.fullName}` : "A4 Batch Credential Handover Sheet"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePrintA4}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8 px-4 rounded-xl cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  {th("Print Now")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowBatchPrint(false); setPrintModalUser(null); }}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                >
                  {th("Close")}
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-muted/10 flex justify-center print:p-0 print:bg-white print:overflow-visible">
              
              {/* SINGLE USER HANDOVER SLIP */}
              {printModalUser ? (
                <div id="a4-handover-printable" className="bg-white text-slate-900 w-full max-w-3xl p-8 rounded-2xl shadow-xl border border-slate-200 font-sans space-y-6 print:shadow-none print:border-none print:p-8 print:max-w-none">
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-900">{brandLine}</h2>
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mt-0.5">{th("OFFICIAL USER ACCESS & CREDENTIAL HANDOVER SLIP")}</p>
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-500 space-y-0.5">
                      <div className="font-bold text-slate-800">REF: {printModalUser.userCode}</div>
                      <div suppressHydrationWarning>{th("DATE")}: {new Date().toLocaleDateString(`${lang}-u-ca-gregory-nu-latn`, { calendar: "gregory", numberingSystem: "latn", day: "2-digit", month: "short", year: "numeric" })}</div>
                      <span className="inline-block bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200 text-[9px]">{th("CONFIDENTIAL")}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {th("This official credential slip authorizes the designated officer to access the DGT Enterprise ERP & FMS platform in accordance with the allocated role and branch jurisdiction.")}
                  </p>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{th("OFFICER & SYSTEM IDENTITY")}</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{th("ACTIVE STATUS")}</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{th("OFFICER / FULL NAME")}</span>
                        <span className="font-bold text-slate-900 text-sm">{printModalUser.fullName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{th("SYSTEM USER CODE")}</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">{printModalUser.userCode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{th("SYSTEM ROLE / LEVEL")}</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">{printModalUser.roleLabel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{th("ASSIGNED BRANCH JURISDICTION")}</span>
                        <span className="font-bold text-slate-900">{printModalUser.branchName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{th("COUNTRY JURISDICTION")}</span>
                        <span className="font-bold text-slate-800">{printModalUser.countryName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{th("DIRECT LOGIN URL")}</span>
                        <span className="font-mono text-blue-700 font-bold break-all">{printModalUser.loginUrl}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border-2 border-indigo-200 rounded-xl p-4 space-y-3">
                    <div className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                      {th("OFFICIAL LOGIN CREDENTIALS")}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">{th("LOGIN USERNAME / EMAIL")}</span>
                        <span className="font-mono font-black text-slate-900 text-sm bg-white px-2.5 py-1 rounded border border-slate-300 block break-all mt-1">{printModalUser.email}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">{th("INITIAL ACCESS PASSWORD")}</span>
                        <span className="font-mono font-black text-emerald-700 text-sm bg-white px-2.5 py-1 rounded border border-emerald-300 block mt-1">{printModalUser.passwordKey || th("Not set in vault")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-[10.5px] text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                      {th("SECURITY & COMPLIANCE NOTICE:")}
                    </div>
                    <p>1. Keep your credentials confidential. Never share your password across email or chat.</p>
                    <p>2. You must change your temporary password upon first login to your personal password.</p>
                    <p>3. All actions, entries, and edits are permanently audited under your cryptographic user code.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-900 text-xs">
                    <div className="space-y-4">
                      <div className="font-bold text-slate-800 uppercase text-[11px]">{th("Super Admin Authorization")}</div>
                      <div className="border-b border-slate-400 h-10"></div>
                      <div className="text-[10px] text-slate-500 font-medium">{th("Signature & Official Stamp")}</div>
                    </div>
                    <div className="space-y-4">
                      <div className="font-bold text-slate-800 uppercase text-[11px]">{th("Staff Member Acknowledgement")}</div>
                      <div className="border-b border-slate-400 h-10"></div>
                      <div className="text-[10px] text-slate-500 font-medium">{th("Received By, Signature & Date")}</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* BATCH HANDOVER DIRECTORY SHEET */
                <div id="a4-handover-printable" className="bg-white text-slate-900 w-full max-w-5xl p-8 rounded-2xl shadow-xl border border-slate-200 font-sans space-y-6 print:shadow-none print:border-none print:p-4 print:max-w-none">
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-900">{brandLine}</h2>
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mt-0.5">{th("OFFICIAL SYSTEM ACCESS & BATCH CREDENTIAL HANDOVER DIRECTORY")}</p>
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-500 space-y-0.5">
                      <div className="font-bold text-slate-800">TOTAL USERS: {filteredUsers.length}</div>
                      <div suppressHydrationWarning>{th("DATE")}: {new Date().toLocaleDateString(`${lang}-u-ca-gregory-nu-latn`, { calendar: "gregory", numberingSystem: "latn", day: "2-digit", month: "short", year: "numeric" })}</div>
                      <span className="inline-block bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200 text-[9px]">{th("CONFIDENTIAL")}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {th("Official batch credential handover manifest for all active branch officers and system administrators.")}
                  </p>

                  <div className="overflow-x-auto border border-slate-300 rounded-lg">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                        <tr>
                          <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                          <th className="p-2 border-r border-slate-300">{th("User Code")}</th>
                          <th className="p-2 border-r border-slate-300">{th("Full Name & Role")}</th>
                          <th className="p-2 border-r border-slate-300">{th("Assigned Branch")}</th>
                          <th className="p-2 border-r border-slate-300">{th("Login Username / Email")}</th>
                          <th className="p-2 border-r border-slate-300">{th("Password Key")}</th>
                          <th className="p-2">{th("Recipient Signature")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredUsers.map((u, idx) => (
                          <tr key={u.userId} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-center border-r border-slate-200 text-slate-500">{idx + 1}</td>
                            <td className="p-2 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">{u.userCode}</td>
                            <td className="p-2 border-r border-slate-200">
                              <div className="font-bold text-slate-900">{u.fullName}</div>
                              <div className="text-[10px] text-indigo-700 font-medium">{u.roleLabel}</div>
                            </td>
                            <td className="p-2 border-r border-slate-200 text-slate-700">
                              <div>{u.branchName}</div>
                              <div className="text-[9.5px] text-slate-400 font-medium">{u.countryName}</div>
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-900 border-r border-slate-200 break-all">{u.email}</td>
                            <td className="p-2 font-mono font-bold text-emerald-700 border-r border-slate-200 whitespace-nowrap bg-emerald-50/40">
                              {u.passwordKey || th("Not set in vault")}
                            </td>
                            <td className="p-2 border-slate-200 min-w-[110px]">
                              <div className="border-b border-dashed border-slate-300 h-5"></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-900 text-xs">
                    <div className="space-y-4">
                      <div className="font-bold text-slate-800 uppercase text-[11px]">{th("Super Admin Authorization")}</div>
                      <div className="border-b border-slate-400 h-10"></div>
                      <div className="text-[10px] text-slate-500 font-medium">{th("Signature & Official Stamp")}</div>
                    </div>
                    <div className="space-y-4">
                      <div className="font-bold text-slate-800 uppercase text-[11px]">{th("Internal Security Verification")}</div>
                      <div className="border-b border-slate-400 h-10"></div>
                      <div className="text-[10px] text-slate-500 font-medium">{th("Audit Officer Signature & Date")}</div>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {showModulePermModal && (
        <ModulePermissionModal
          onClose={() => setShowModulePermModal(false)}
          onSaved={() => {
            setShowModulePermModal(false);
            fetchUsers();
          }}
        />
      )}

      {/* ─── Change Password Modal ─── */}
      {passwordModalUser && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200"
          onClick={() => {
            if (!savingPassword) setPasswordModalUser(null);
          }}
        >
          <div 
            className="bg-card border border-border rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-foreground animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black flex items-center gap-2">
                    <span>{th("Change Password")}</span>
                  </h2>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    {passwordModalUser.fullName} ({passwordModalUser.userCode})
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={savingPassword}
                onClick={() => setPasswordModalUser(null)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* User Summary Card */}
              <div className="bg-muted/40 rounded-2xl p-3.5 border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">{th("User Code")}:</span>
                  <span className="font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border border-border">
                    {passwordModalUser.userCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">{th("Login Email")}:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">
                    {passwordModalUser.email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">{th("Role & Branch")}:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {passwordModalUser.roleLabel} • {passwordModalUser.branchName}
                  </span>
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  {th("New Access Password")}
                </label>
                <div className="relative">
                  <input
                    type={showModalPassword ? "text" : "password"}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !savingPassword) {
                        e.preventDefault();
                        void handleSavePassword();
                      }
                    }}
                    placeholder={th("Enter a new password")}
                    disabled={savingPassword}
                    className="w-full h-10 px-3 pr-10 text-xs font-mono font-bold rounded-xl border border-input bg-background text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showModalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {th("This password will be immediately updated in both the ERP credentials vault and the authentication login system.")}
                </p>
              </div>

              {/* Error Box */}
              {passwordError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-muted/30 px-6 py-4 border-t border-border flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                disabled={savingPassword}
                onClick={() => setPasswordModalUser(null)}
                className="h-9 px-4 text-xs font-bold rounded-xl cursor-pointer"
              >
                {th("Cancel")}
              </Button>
              <Button
                type="button"
                disabled={savingPassword || !newPasswordInput.trim()}
                onClick={() => void handleSavePassword()}
                className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingPassword ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{th("Saving...")}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{th("Save Password")}</span>
                  </>
                )}
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
