"use client";

/**
 * DigitalDockPremiumSidebar
 * -------------------------------------------------------------
 * Custom Sidebar precisely matching Daman Business Group visual specification:
 * - Pure white aesthetic with deep navy typography
 * - Top-level categories match user's screenshot exactly
 * - Nested sub-menus for Purchase (including Local Purchase), Sales, Trade, Reports, etc.
 * - Dynamic multi-tier accordions with active blue styling
 * - "Need Help?" support card with "Get Support" button
 * - "<< Collapse Menu" footer
 */
import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  Banknote,
  BarChart3,
  BookOpen,
  BookOpenText,
  Boxes,
  Building2,
  CalendarCheck,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Container,
  CreditCard,
  Database,
  FileBarChart,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Globe,
  Globe2,
  Headphones,
  Home,
  Landmark,
  Layers,
  ListPlus,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  Package,
  PhoneCall,
  Receipt,
  RefreshCw,
  ScanLine,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Ship,
  ShoppingCart,
  Sliders,
  Sparkles,
  Split,
  Star,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { fetchBranding, brandingName } from "@/lib/branding/client";

/* ---------------- Types ---------------- */
export type SidebarDeepChild = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
};

export type SidebarSubItem = {
  key?: string;
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  children?: SidebarDeepChild[];
};

export type SidebarMenuItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  defaultOpen?: boolean;
  children?: SidebarSubItem[];
};

/* ---------------- Menu Items Exactly As In Specification ---------------- */
export const DAMAN_SIDEBAR_ITEMS: SidebarMenuItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: Home,
    href: "/dashboard",
  },
  {
    key: "new-entry",
    label: "New Entry",
    icon: ScanLine,
    children: [
      {
        key: "ne-branch",
        label: "Branch & Network",
        icon: Building2,
        children: [
          { label: "Country Branch Entry", href: "/dashboard/new-entry/branch-entry/country-branch", icon: Globe2 },
          { label: "City Branch Entry", href: "/dashboard/new-entry/branch-entry/city-branch", icon: Building2 },
          { label: "Super Admin Branch", href: "/dashboard/new-entry/branches/super-admin", icon: Building2 },
          { label: "Branch General Report", href: "/dashboard/branch-management/general-report", icon: FileBarChart },
          { label: "Locations Management", href: "/dashboard/settings/locations", icon: Globe },
        ],
      },
      {
        key: "ne-users",
        label: "User Accounts",
        icon: Users,
        children: [
          { label: "User Registration", href: "/dashboard/new-entry/users/registration", icon: Users },
          { label: "All Users Report", href: "/dashboard/new-entry/users/all", icon: FileText },
          { label: "Super Admin User", href: "/dashboard/new-entry/users/super-admin", icon: Users },
          { label: "Country User", href: "/dashboard/new-entry/users/country", icon: Users },
          { label: "Branch User", href: "/dashboard/new-entry/users/branch", icon: Users },
        ],
      },
      {
        key: "ne-accounts",
        label: "Accounts & Ledger Setup",
        icon: BookOpen,
        children: [
          { label: "New Account Setup", href: "/dashboard/accounts/setup", icon: BookOpen },
          { label: "New Ledger Account", href: "/dashboard/ledger/new", icon: BookOpenText },
          { label: "Accounts General Report", href: "/dashboard/new-entry/accounts/general-report", icon: FileBarChart },
        ],
      },
      { label: "Register Employee", href: "/dashboard/general-office/employees", icon: Users },
      { label: "Share Form External Links", href: "/dashboard/general-office/employees?tab=share-forms", icon: ArrowRightLeft },
      { label: "New Entry Hub", href: "/dashboard/new-entry", icon: ListPlus },
    ],
  },
  {
    key: "ledgers",
    label: "Ledgers",
    icon: BookOpen,
    children: [
      { label: "New Ledger Account", href: "/dashboard/ledger/new", icon: BookOpen },
      { label: "Super Admin Detailed Ledger", href: "/dashboard/ledger/super-admin/detailed", icon: FileText },
      { label: "Country Detailed Ledger", href: "/dashboard/ledger/country/detailed", icon: FileText },
      { label: "Branch Detailed Ledger", href: "/dashboard/ledger/detailed", icon: FileText },
      { label: "Ledger General Report", href: "/dashboard/ledger/general-report", icon: FileBarChart },
      { label: "Outstanding Ledgers Report", href: "/dashboard/ledger/outstanding", icon: FileSpreadsheet },
    ],
  },
  {
    key: "daily-payment",
    label: "Daily Payment Entry",
    icon: FileText,
    children: [
      { label: "Daily Cash Entry (Roznamcha)", href: "/dashboard/roznamcha/cash-entry", icon: Wallet },
      { label: "Purchase Order Payment (Advance)", href: "/dashboard/journal/purchase-order-payment/advance", icon: Receipt },
      { label: "Purchase Order Payment (Remaining)", href: "/dashboard/journal/purchase-order-payment/remaining", icon: CreditCard },
      { label: "Purchase Payment History", href: "/dashboard/journal/purchase-order-payment/history", icon: Clock },
      { label: "Sales Order Payment", href: "/dashboard/journal/sales-order-payment/advance", icon: CircleDollarSign },
      { label: "Daily Operational Expenses", href: "/dashboard/roznamcha/daily-expenses-bill", icon: Banknote },
      { label: "Office / Home Expenses Bill", href: "/dashboard/roznamcha/expenses-bill", icon: FileSpreadsheet },
      { label: "Money Exchange (Currency Changer)", href: "/dashboard/roznamcha/money-exchange", icon: RefreshCw },
    ],
  },
  {
    key: "purchase-sales-trade",
    label: "Purchase, Sales & Trade",
    icon: ShoppingCart,
    defaultOpen: true,
    children: [
      {
        key: "sub-purchase-booking",
        label: "Purchase Booking",
        icon: ClipboardList,
        children: [
          { label: "New Purchase Booking Order", href: "/dashboard/purchase/new-purchase-booking-order", icon: ClipboardList },
          { label: "Booking Purchase Confirmation", href: "/dashboard/purchase/purchase-confirm", icon: CheckSquare },
          { label: "Purchase Booking Journal Report", href: "/dashboard/purchase/purchase-booking-journal-report", icon: FileBarChart },
          { label: "Purchase Order & Payment", href: "/dashboard/purchase/purchase-order", icon: CreditCard },
          { label: "Purchase Order Tracking", href: "/dashboard/purchase/purchase-order-tracking", icon: Clock },
          { label: "Completed Purchase Bills", href: "/dashboard/purchase/completed-purchase-bills", icon: FileCheck2 },
          { label: "Purchase Loading Records", href: "/dashboard/purchase/purchase-loading-records", icon: Truck },
        ],
      },
      {
        key: "sub-local-purchase",
        label: "Local Purchase",
        icon: ShoppingCart,
        children: [
          { label: "Local Purchase Order", href: "/dashboard/purchase/local-purchase", icon: ShoppingCart },
          { label: "Local Goods Received", href: "/dashboard/purchase/local-goods-received", icon: Package },
          { label: "Local Purchase Payment / Transfer", href: "/dashboard/purchase/local-purchase-transfer-payment", icon: Receipt },
          { label: "Local Purchase Journal Report", href: "/dashboard/purchase/local-purchase-journal-report", icon: FileBarChart },
        ],
      },
      {
        key: "sub-sales-booking",
        label: "Sales Booking",
        icon: ClipboardList,
        children: [
          { label: "New Sales Booking Order", href: "/dashboard/sales/new-sales-booking-order", icon: ClipboardList },
          { label: "Confirmed Sales Orders", href: "/dashboard/sales/sales-confirm", icon: CheckSquare },
          { label: "Sales Booking Journal Report", href: "/dashboard/sales/sales-booking-journal-report", icon: FileBarChart },
        ],
      },
      {
        key: "sub-local-sales",
        label: "Local Sales",
        icon: TrendingUp,
        children: [
          { label: "Local Sales Order", href: "/dashboard/sales/local-sales", icon: ShoppingCart },
          { label: "Sales Order & Payment Transfer", href: "/dashboard/sales/sales-order", icon: Receipt },
        ],
      },
      {
        key: "sub-trade",
        label: "Other Country Trade",
        icon: Globe,
        children: [
          { label: "Country-to-Country Transfer", href: "/dashboard/purchase/country-transfer", icon: Globe },
          { label: "Inter-Country Transfers", href: "/dashboard/inter-country-transfers", icon: ArrowRightLeft },
          { label: "Country Purchase Reports", href: "/dashboard/purchase/country-purchase-reports", icon: FileBarChart },
          { label: "Country Purchase Timeline", href: "/dashboard/purchase/country-purchase-reports", icon: Clock },
        ],
      },
      {
        key: "sub-bcp",
        label: "Bill Cost, Expenses & Profit",
        icon: FileSpreadsheet,
        children: [
          { label: "Bill Cost & Profit Overview", href: "/dashboard/bill-cost-profit", icon: BarChart3 },
          { label: "Bill Expenses Entry", href: "/dashboard/expenses/bill-expenses", icon: Banknote },
          { label: "Business Edit Invoice", href: "/dashboard/business-edit-invoice", icon: FileText },
          { label: "BCP Purchase Cost Audit", href: "/dashboard/bill-cost-profit/purchase", icon: ShoppingCart },
          { label: "BCP Sales Profit Analytics", href: "/dashboard/bill-cost-profit/sales", icon: TrendingUp },
          { label: "BCP Operational Expenses", href: "/dashboard/bill-cost-profit/expenses", icon: Receipt },
          { label: "BCP Universal Reports", href: "/dashboard/bill-cost-profit/reports", icon: FileBarChart },
        ],
      },
    ],
  },
  {
    key: "journal-stock",
    label: "Journal Stock",
    icon: Boxes,
    children: [
      { label: "Stock Register / Inventory", href: "/dashboard/inventory", icon: Package },
      { label: "Stock Reports (Branch)", href: "/dashboard/inventory/stock-reports/branch", icon: BarChart3 },
      { label: "Stock Reports (Country)", href: "/dashboard/inventory/stock-reports/country", icon: Globe },
      { label: "Stock Reports (Salesman)", href: "/dashboard/inventory/stock-reports/salesman", icon: Users },
      { label: "Warehouse Stock", href: "/dashboard/purchase/stock/warehouse", icon: Boxes },
      { label: "Booking Stock", href: "/dashboard/purchase/stock/booking", icon: ClipboardList },
      { label: "Confirmed Stock", href: "/dashboard/purchase/stock/confirmed", icon: CheckSquare },
      { label: "Import Stock", href: "/dashboard/purchase/stock/import", icon: Ship },
      { label: "In-Transit Stock", href: "/dashboard/purchase/stock/in-transit", icon: Truck },
      { label: "Journal Stock Checking Report", href: "/dashboard/inventory/journal-report/branch", icon: FileBarChart },
    ],
  },
  {
    key: "shipping-cleaning",
    label: "Shipping & Cleaning",
    icon: Ship,
    children: [
      { label: "Shipping Lines", href: "/dashboard/shipping-line", icon: Ship },
      { label: "Clearing Agents", href: "/dashboard/clearing-agent", icon: Truck },
      { label: "Containers Register", href: "/dashboard/shipping-line", icon: Container },
      { label: "Clearing Order Trucks", href: "/dashboard/shipping-line", icon: Truck },
      { label: "Shipping Handovers", href: "/dashboard/purchase/purchase-loading-records", icon: ClipboardList },
      { label: "Consignment Register", href: "/dashboard/consignment", icon: Package },
      { label: "Logistics Tracking Dashboard", href: "/dashboard/logistics", icon: BarChart3 },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: ShieldCheck,
    children: [
      { label: "Banks & Bank Accounts", href: "/dashboard/settings/bank", icon: Landmark },
      { label: "Bank Cheque Roznamcha", href: "/dashboard/roznamcha/reports/bank", icon: Receipt },
      { label: "Money Exchange (Currency Changer)", href: "/dashboard/roznamcha/money-exchange", icon: ArrowRightLeft },
      { label: "Daily Exchange Rates (Intraday)", href: "/dashboard/reports/exchange-rate", icon: RefreshCw },
      { label: "Country Investments", href: "/dashboard/super-admin/investments", icon: TrendingUp },
      { label: "Daily Operational Expenses", href: "/dashboard/roznamcha/daily-expenses-bill", icon: Banknote },
      { label: "Office / Home Expenses Bill", href: "/dashboard/roznamcha/expenses-bill", icon: FileSpreadsheet },
    ],
  },
  {
    key: "general-office",
    label: "General Office",
    icon: Settings,
    children: [
      { label: "Customer Management", href: "/dashboard/settings/customers", icon: Users },
      { label: "Customer Management Journal", href: "/dashboard/settings/customers?view=journal", icon: FileSpreadsheet },
      { label: "Employees Directory", href: "/dashboard/general-office/employees", icon: Users },
      { label: "Employee KYC & Documents", href: "/dashboard/general-office/employee-kyc", icon: FileText },
      { label: "Attendance & Leave Management", href: "/dashboard/general-office/leave-attendance", icon: CalendarCheck },
      { label: "Payroll Runs & Salary Slips", href: "/dashboard/general-office/payroll", icon: Banknote },
      { label: "Departments & Designations", href: "/dashboard/general-office/departments", icon: Building2 },
      { label: "Gratuity & End-of-Service", href: "/dashboard/general-office/gratuity", icon: Receipt },
      { label: "Share External Forms", href: "/dashboard/general-office/employees?tab=share-forms", icon: ArrowRightLeft },
    ],
  },
  {
    key: "settlement-reconciliation",
    label: "Settlement & Reconciliation",
    icon: Layers,
    children: [
      { label: "Settlement & Reconciliation Engine", href: "/dashboard/settlement", icon: Layers },
      { label: "Tax & Ledger Reconciliation", href: "/dashboard/tax-einvoicing/uae/vat-control", icon: Split },
      { label: "Payments Reconciliation", href: "/dashboard/reports/payments", icon: Receipt },
    ],
  },
  {
    key: "reports-all",
    label: "Reports and All Reporting Page",
    icon: BarChart3,
    defaultOpen: true,
    children: [
      {
        key: "sub-kyc",
        label: "KYC Reports",
        icon: FileText,
        children: [
          { label: "Customer KYC Reports", href: "/dashboard/reports/kyc", icon: FileText },
          { label: "Employee KYC Verification", href: "/dashboard/general-office/employees", icon: Users },
          { label: "Compliance & Audit Monitoring", href: "/dashboard/audit-monitoring", icon: ShieldAlert },
        ],
      },
      {
        key: "sub-tasks",
        label: "User Tasks",
        icon: CheckSquare,
        children: [
          { label: "Active User Tasks", href: "/dashboard/user-tasks", icon: CheckSquare },
          { label: "CRM Today Action Center", href: "/dashboard/crm?tab=today", icon: CalendarCheck },
          { label: "Smart Due & Follow-Up", href: "/dashboard/smart-due", icon: Clock },
        ],
      },
      {
        key: "sub-reports",
        label: "Reports",
        icon: CheckSquare,
        children: [
          { label: "All Reports Hub", href: "/dashboard/reports", icon: BarChart3 },
          { label: "Super Admin Reports", href: "/dashboard/reports/super-admin", icon: FileBarChart },
          { label: "Country Admin Reports", href: "/dashboard/reports/country", icon: Globe },
          { label: "Branch Reports", href: "/dashboard/reports/branch", icon: Building2 },
          { label: "Payments & Settlements Report", href: "/dashboard/reports/payments", icon: Receipt },
          { label: "Shipping & Clearing Reports", href: "/dashboard/reports/shipping", icon: Ship },
          { label: "Ledgers Universal Report", href: "/dashboard/ledger/general-report", icon: BookOpen },
          { label: "Financial Statements", href: "/dashboard/reports/financial-statements", icon: FileSpreadsheet },
          { label: "Daily Exchange Rates Report", href: "/dashboard/reports/exchange-rate", icon: RefreshCw },
          { label: "Journal Report PDF ERP", href: "/dashboard/reports/handover", icon: FileText },
          { label: "System Forms Directory", href: "/dashboard/reports/system-forms-directory", icon: ListPlus },
        ],
      },
      {
        key: "sub-docs",
        label: "Document Management",
        icon: FileText,
        children: [
          { label: "Document Intake Center", href: "/dashboard/documents", icon: FileText },
          { label: "Intake Drafts & Uploads", href: "/dashboard/document-intelligence", icon: ClipboardList },
          { label: "Document Roznamcha Entries", href: "/dashboard/roznamcha", icon: ScrollText },
          { label: "Document Intelligence AI", href: "/dashboard/document-intelligence", icon: Sparkles },
        ],
      },
    ],
  },
  {
    key: "ai-voice-messaging",
    label: "AI Voice Messaging",
    icon: Mic,
    children: [
      { label: "AI Voice Messaging Hub", href: "/dashboard/ai-entry/messages", icon: Mic },
      { label: "AI Voice & Text Entry", href: "/dashboard/ai-entry/voice-text", icon: Sparkles },
      { label: "AI Approvals & Workflow", href: "/dashboard/ai-entry/approvals", icon: CheckSquare },
    ],
  },
  {
    key: "ai-calls-inquiries",
    label: "AI Calls",
    icon: PhoneCall,
    children: [
      { label: "AI Calls Center", href: "/dashboard/customer-inquiries/calls", icon: PhoneCall },
      { label: "Customer Inquiries", href: "/dashboard/customer-inquiries", icon: Users },
      { label: "Inquiry Follow-ups", href: "/dashboard/customer-inquiries/follow-ups", icon: Clock },
    ],
  },
  {
    key: "crm-control",
    label: "CRM Control Center",
    icon: CalendarCheck,
    children: [
      { label: "CRM Dashboard", href: "/dashboard/crm", icon: BarChart3 },
      { label: "Today's Action Center", href: "/dashboard/crm?tab=today", icon: CalendarCheck },
      { label: "Due & Follow-Up", href: "/dashboard/smart-due", icon: Clock },
      { label: "Cheques Reminders", href: "/dashboard/crm?tab=cheques", icon: CreditCard },
      { label: "Purchase Payments Due", href: "/dashboard/crm?tab=purchases", icon: ShoppingCart },
      { label: "Sales Recovery Due", href: "/dashboard/crm?tab=sales", icon: CircleDollarSign },
      { label: "Shipping / Clearing Due", href: "/dashboard/crm?tab=shipping", icon: Ship },
      { label: "Customer Follow-Up", href: "/dashboard/crm?tab=customers", icon: Users },
      { label: "New Customer Registration", href: "/dashboard/crm/customers/new", icon: ListPlus },
      { label: "CRM Reports", href: "/dashboard/crm/reports", icon: FileBarChart },
    ],
  },
  {
    key: "tax-einvoicing",
    label: "UAE Tax & E-Invoicing",
    icon: Landmark,
    children: [
      { label: "UAE Tax Dashboard", href: "/dashboard/tax-einvoicing/uae/dashboard", icon: BarChart3 },
      { label: "VAT Return 201", href: "/dashboard/tax-einvoicing/uae/vat-return", icon: FileSpreadsheet },
      { label: "E-Invoices Center", href: "/dashboard/tax-einvoicing/uae/e-invoices", icon: FileText },
      { label: "ASP / FTA Compliance Status", href: "/dashboard/tax-einvoicing/uae/asp-fta-status", icon: ShieldCheck },
      { label: "VAT Control & Reconciliation", href: "/dashboard/tax-einvoicing/uae/vat-control", icon: Split },
      { label: "Tax Reports & Audit", href: "/dashboard/tax-einvoicing/uae/tax-reports", icon: FileBarChart },
    ],
  },
  {
    key: "master-data",
    label: "Master Data",
    icon: BookOpenText,
    children: [
      { label: "Goods Master & Category", href: "/dashboard/settings/goods-master", icon: Package },
      { label: "Almond Kernel Parameters", href: "/dashboard/settings/goods-master?tab=parameters", icon: Database },
      { label: "Product Reorder Barcodes", href: "/dashboard/settings/goods-master?tab=barcodes", icon: ScanLine },
      { label: "Product Categories & Brands", href: "/dashboard/settings/product-categories", icon: Boxes },
      { label: "Warehouses Management", href: "/dashboard/settings/warehouse", icon: Building2 },
      { label: "Country & City Locations", href: "/dashboard/settings/locations", icon: Globe2 },
      { label: "Country Tax & Currency Settings", href: "/dashboard/settings/tax", icon: Landmark },
    ],
  },
  {
    key: "messages-comms",
    label: "Messages & WhatsApp",
    icon: MessageSquare,
    children: [
      { label: "WhatsApp Center", href: "/dashboard/messages/whatsapp", icon: MessageCircle },
      { label: "Communication Center", href: "/dashboard/communication-center", icon: MessageSquare },
      { label: "Customer Inquiries & Calls", href: "/dashboard/customer-inquiries", icon: PhoneCall },
      { label: "SMS & Customer Responses", href: "/dashboard/return-sms-reply", icon: FileText },
    ],
  },
  {
    key: "settings-menu",
    label: "Settings",
    icon: Settings,
    children: [
      { label: "System Settings Hub", href: "/dashboard/settings", icon: Settings },
      { label: "Dashboard Settings", href: "/dashboard/settings/dashboard-settings", icon: Sliders },
      { label: "Banks & Accounts Setup", href: "/dashboard/settings/bank", icon: Landmark },
      { label: "Warehouses Setup", href: "/dashboard/settings/warehouse", icon: Building2 },
      { label: "Company Setup", href: "/dashboard/settings/company-setup", icon: Building2 },
      { label: "Account Types Setup", href: "/dashboard/settings/account-type", icon: BookOpen },
      { label: "Locations & Cities", href: "/dashboard/settings/locations", icon: Globe2 },
      { label: "Country Tax & Currency", href: "/dashboard/settings/tax", icon: Landmark },
      { label: "Email Accounts", href: "/dashboard/settings/email-accounts", icon: Mail },
      { label: "ERP Translations & Languages", href: "/dashboard/settings/translations", icon: Globe },
      { label: "Profile & Security", href: "/dashboard/settings/profile", icon: ShieldCheck },
    ],
  },
  {
    key: "all-ai",
    label: "All AI Page",
    icon: Star,
    children: [
      { label: "AI Voice Messaging", href: "/dashboard/ai-entry/messages", icon: Mic },
      { label: "AI Voice & Text Entry", href: "/dashboard/ai-entry/voice-text", icon: Sparkles },
      { label: "AI Calls Center", href: "/dashboard/customer-inquiries/calls", icon: PhoneCall },
      { label: "AI Approvals", href: "/dashboard/ai-entry/approvals", icon: CheckSquare },
      { label: "Document Intelligence & Extraction", href: "/dashboard/document-intelligence", icon: FileText },
      { label: "Smart CRM Control Center", href: "/dashboard/crm", icon: CalendarCheck },
    ],
  },
];

/* ---------------- Helper to check path matches ---------------- */
function isPathActive(href: string | undefined, currentPath: string): boolean {
  if (!href) return false;
  if (currentPath === href) return true;
  if (href !== "/dashboard" && currentPath.startsWith(href)) return true;
  return false;
}

function hasActiveDescendant(
  item: SidebarMenuItem | SidebarSubItem | SidebarDeepChild,
  currentPath: string,
): boolean {
  if (item.href && isPathActive(item.href, currentPath)) return true;
  if ("children" in item && item.children) {
    return item.children.some((c) => hasActiveDescendant(c, currentPath));
  }
  return false;
}

/* ---------------- Component Props ---------------- */
export interface DigitalDockPremiumSidebarProps {
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  brandTitle?: string;
}

export function DigitalDockPremiumSidebar({
  onNavigate,
  onToggleCollapse,
  brandTitle,
}: DigitalDockPremiumSidebarProps = {}) {
  const pathname = usePathname() ?? "";
  const lang = useActiveLanguage();
  const tr = (s: string) => translateHeader(lang, s);

  const [companyName, setCompanyName] = useState<string>("Daman Business Group");

  useEffect(() => {
    let alive = true;
    fetchBranding(null).then((b) => {
      if (!alive) return;
      const resolved = brandingName(b, lang);
      if (resolved) setCompanyName(resolved);
    });
    return () => { alive = false; };
  }, [lang]);

  // Track expanded accordion keys (Level 1 and Level 2)
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of DAMAN_SIDEBAR_ITEMS) {
      if (item.defaultOpen || hasActiveDescendant(item, pathname)) {
        initial.add(item.key);
      }
      if (item.children) {
        for (const sub of item.children) {
          if (sub.key && hasActiveDescendant(sub, pathname)) {
            initial.add(sub.key);
          }
        }
      }
    }
    return initial;
  });

  // Auto-expand when navigating to a deep route
  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      for (const item of DAMAN_SIDEBAR_ITEMS) {
        if (hasActiveDescendant(item, pathname)) {
          next.add(item.key);
        }
        if (item.children) {
          for (const sub of item.children) {
            if (sub.key && hasActiveDescendant(sub, pathname)) {
              next.add(sub.key);
            }
          }
        }
      }
      return next;
    });
  }, [pathname]);

  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const displayBrand = brandTitle || companyName || "Daman Business Group";

  return (
    <div className="flex h-full w-full flex-col bg-white text-[#0f172a] select-none font-sans overflow-hidden">
      {/* 1. Header: Daman Business Group */}
      <div className="px-5 pt-5 pb-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="block group"
        >
          <h1 className="text-[17px] font-extrabold tracking-tight text-[#0a192f] group-hover:text-[#2563eb] transition-colors leading-snug">
            {displayBrand}
          </h1>
        </Link>
      </div>

      {/* 2. Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-1 [scrollbar-width:thin]">
        {DAMAN_SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const hasChildren = Boolean(item.children?.length);
          const isOpen = hasChildren && openKeys.has(item.key);
          const isDirectActive = isPathActive(item.href, pathname);
          const isDescActive = hasChildren && hasActiveDescendant(item, pathname);
          const isHighlighted = isOpen || isDirectActive || isDescActive;

          return (
            <div key={item.key} className="relative">
              {hasChildren ? (
                /* Level 1: Accordion Parent Item */
                <div>
                  <button
                    type="button"
                    onClick={() => toggleKey(item.key)}
                    className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13.5px] transition-all duration-150 cursor-pointer ${
                      isHighlighted
                        ? "bg-[#edf5ff] text-[#2563eb] font-bold"
                        : "text-[#0f172a] hover:bg-slate-50 font-medium hover:text-[#2563eb]"
                    }`}
                  >
                    {/* Left vertical blue accent indicator bar when highlighted/open */}
                    {isHighlighted && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] bg-[#2563eb] rounded-r-md" />
                    )}

                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        isHighlighted ? "text-[#2563eb]" : "text-[#0f172a]"
                      }`} />
                      <span className="truncate text-left tracking-tight">
                        {tr(item.label)}
                      </span>
                    </div>

                    {isOpen ? (
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                        isHighlighted ? "text-[#2563eb]" : "text-[#0f172a]"
                      }`} />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#0f172a] transition-transform duration-200" />
                    )}
                  </button>

                  {/* Level 2 Sub-items list */}
                  {isOpen && item.children && (
                    <div className="mt-1 ps-2 pe-1 space-y-0.5 animate-in fade-in-50 duration-150">
                      {item.children.map((sub) => {
                        const SubIcon = sub.icon;
                        const subHasChildren = Boolean(sub.children?.length);
                        const subKey = sub.key || `${item.key}-${sub.label}`;
                        const isSubOpen = subHasChildren && openKeys.has(subKey);
                        const isSubDirectActive = isPathActive(sub.href, pathname);
                        const isSubDescActive = subHasChildren && hasActiveDescendant(sub, pathname);
                        const isSubActive = isSubDirectActive || isSubDescActive;

                        if (subHasChildren) {
                          return (
                            <div key={subKey} className="space-y-0.5">
                              {/* Level 2 with Level 3 children (e.g. Purchase -> Purchase Booking, Local Purchase...) */}
                              <button
                                type="button"
                                onClick={() => toggleKey(subKey)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all duration-150 cursor-pointer ${
                                  isSubActive || isSubOpen
                                    ? "text-[#2563eb] font-bold bg-blue-50/70"
                                    : "text-[#0f172a] font-semibold hover:text-[#2563eb] hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <SubIcon className={`h-4 w-4 shrink-0 transition-colors ${
                                    isSubActive || isSubOpen ? "text-[#2563eb]" : "text-[#0f172a]"
                                  }`} />
                                  <span className="truncate text-left tracking-tight">
                                    {tr(sub.label)}
                                  </span>
                                </div>
                                {isSubOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                )}
                              </button>

                              {/* Level 3 Deep Children (e.g. Local Purchase, Completed Bills...) */}
                              {isSubOpen && sub.children && (
                                <div className="ms-5 ps-3 pe-1 py-1 space-y-0.5 border-l-2 border-blue-200/60 my-0.5 animate-in fade-in-50 duration-150">
                                  {sub.children.map((leaf) => {
                                    const LeafIcon = leaf.icon;
                                    const isLeafActive = isPathActive(leaf.href, pathname);
                                    return (
                                      <Link
                                        key={leaf.label + leaf.href}
                                        href={leaf.href}
                                        onClick={onNavigate}
                                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] transition-all duration-150 ${
                                          isLeafActive
                                            ? "text-[#2563eb] font-bold bg-blue-50/90"
                                            : "text-slate-600 font-medium hover:text-[#2563eb] hover:bg-slate-50"
                                        }`}
                                      >
                                        {LeafIcon ? (
                                          <LeafIcon className={`h-3.5 w-3.5 shrink-0 ${
                                            isLeafActive ? "text-[#2563eb]" : "text-slate-400"
                                          }`} />
                                        ) : (
                                          <span className={`h-1.5 w-1.5 rounded-full ${
                                            isLeafActive ? "bg-[#2563eb]" : "bg-slate-300"
                                          }`} />
                                        )}
                                        <span className="truncate tracking-tight">
                                          {tr(leaf.label)}
                                        </span>
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        /* Level 2 Direct Link */
                        return (
                          <Link
                            key={sub.label + (sub.href || "")}
                            href={sub.href || "/dashboard"}
                            onClick={onNavigate}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                              isSubDirectActive
                                ? "text-[#2563eb] font-bold bg-blue-50/70"
                                : "text-[#0f172a] font-medium hover:text-[#2563eb] hover:bg-slate-50"
                            }`}
                          >
                            <SubIcon className={`h-4 w-4 shrink-0 transition-colors ${
                              isSubDirectActive ? "text-[#2563eb]" : "text-[#0f172a]"
                            }`} />
                            <span className="truncate tracking-tight">
                              {tr(sub.label)}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Level 1: Standalone Direct Link Item */
                <Link
                  href={item.href || "/dashboard"}
                  onClick={onNavigate}
                  className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition-all duration-150 ${
                    isDirectActive
                      ? "bg-[#edf5ff] text-[#2563eb] font-bold"
                      : "text-[#0f172a] hover:bg-slate-50 font-medium hover:text-[#2563eb]"
                  }`}
                >
                  {isDirectActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] bg-[#2563eb] rounded-r-md" />
                  )}
                  <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isDirectActive ? "text-[#2563eb]" : "text-[#0f172a]"
                  }`} />
                  <span className="truncate tracking-tight flex-1">
                    {tr(item.label)}
                  </span>
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* 3. Need Help? Card */}
      <div className="p-3 pt-2">
        <div className="rounded-2xl bg-[#eff6ff] p-3.5 border border-blue-100/70">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#2563eb]">
              <Headphones className="h-5 w-5 text-[#2563eb]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-[#0a192f] leading-tight">
                {tr("Need Help?")}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                {tr("Contact our support team")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              window.open("mailto:support@dgt.llc?subject=ERP%20Support%20Request", "_blank");
            }}
            className="mt-3 w-full py-2 px-3 bg-white text-[#2563eb] font-bold text-xs rounded-xl shadow-xs border border-blue-200/80 hover:bg-blue-50 transition-colors text-center cursor-pointer"
          >
            {tr("Get Support")}
          </button>
        </div>
      </div>

      {/* 4. Collapse Menu Footer */}
      <div className="border-t border-slate-100 px-4 py-2.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-2 py-1.5 text-xs font-bold text-[#0a192f] hover:text-[#2563eb] transition-colors cursor-pointer"
        >
          <ChevronsLeft className="h-4 w-4 text-[#0a192f]" />
          <span>{tr("Collapse Menu")}</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- Drawer Wrapper for Mobile/Tablet ---------------- */
export interface DigitalDockPremiumSidebarWithDrawerProps extends DigitalDockPremiumSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DigitalDockPremiumSidebarWithDrawer({
  open = false,
  onOpenChange = () => {},
  ...sidebarProps
}: DigitalDockPremiumSidebarWithDrawerProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
            onClick={() => onOpenChange(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[275px] max-w-[85vw] flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-250">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <DigitalDockPremiumSidebar
              {...sidebarProps}
              onNavigate={() => {
                sidebarProps.onNavigate?.();
                onOpenChange(false);
              }}
              onToggleCollapse={() => onOpenChange(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}

export default DigitalDockPremiumSidebar;
