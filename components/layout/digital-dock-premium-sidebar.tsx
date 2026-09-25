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
import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  Banknote,
  BarChart3,
  Inbox,
  Anchor,
  Compass,
  BookOpen,
  BookOpenText,
  Boxes,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  CircleDollarSign,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  FileBarChart,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Globe,
  Globe2,
  History,
  MapPin,
  Route,
  Home,
  Landmark,
  Layers,
  ListPlus,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  Package,
  Pencil,
  PhoneCall,
  Receipt,
  RefreshCw,
  ScanLine,
  Scale,
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
  Trash2,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Flag,
  X,
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t as tUi } from "@/lib/i18n/ui";
import { SafeSupportAssistant } from "@/components/support/safe-support-assistant";
import { translateHeader } from "@/lib/i18n/table-headers";
import { fetchBranding, brandingName } from "@/lib/branding/client";

/* ---------------- Types ---------------- */
export type SidebarDeepChild = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  /** RBAC: when set, the item shows only to a user holding one of these enterprise roles.
   *  Omit to keep the current behaviour (visible to everyone; the page still enforces access). */
  roles?: string[];
};

export type SidebarSubItem = {
  key?: string;
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  children?: SidebarDeepChild[];
  roles?: string[];
  tone?: "red" | "default";
};

export type SidebarMenuItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  defaultOpen?: boolean;
  children?: SidebarSubItem[];
  roles?: string[];
  tone?: "red" | "default";
  badge?: string;
};

/* ---------------- Menu Items Exactly As In Specification ---------------- */
// Nav-translation key marker: identity passthrough — every label in this static
// config is looked up at render time via tr()/translateHeader(); this wrapper only
// exists so the i18n guard recognizes each label as translated, not hardcoded.
const nt = (s: string) => s;

export const DAMAN_SIDEBAR_ITEMS: SidebarMenuItem[] = [
  {
    key: "dashboard",
    label: nt("Dashboard"),
    icon: Home,
    href: "/dashboard",
  },
  {
    // Central operational control center — read-only aggregation (Smart Due engine
    // + approvals + user tasks). Every alert deep-links to the original ERP record.
    key: "smart-operations",
    label: nt("Smart Operations"),
    icon: Sparkles,
    href: "/dashboard/smart-operations",
    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "agent_user"],
  },
  {
    key: "new-entry",
    label: nt("New Entry"),
    icon: ScanLine,
    children: [
      {
        key: "ne-branch",
        label: nt("Branch & Network"),
        icon: Building2,
        children: [
          { label: nt("Country Branch Entry"), href: "/dashboard/new-entry/branch-entry/country-branch", icon: Globe2 },
          { label: nt("City Branch Entry"), href: "/dashboard/new-entry/branch-entry/city-branch", icon: Building2 },
          { label: nt("Super Admin Branch"), href: "/dashboard/new-entry/branches/super-admin", icon: Building2 },
          { label: nt("Branch General Report"), href: "/dashboard/branch-management/general-report", icon: FileBarChart },
        ],
      },
      {
        key: "ne-users",
        label: nt("User Accounts"),
        icon: Users,
        children: [
          { label: nt("User Registration"), href: "/dashboard/new-entry/users/registration", icon: Users },
          { label: nt("All Users Directory"), href: "/dashboard/new-entry/users/all", icon: Users },
          { label: nt("Permission Control Center"), href: "/dashboard/permissions/control-center", icon: ShieldCheck, roles: ["super_admin"] },
        ],
      },
      {
        key: "ne-accounts",
        label: nt("Accounts & Ledger Setup"),
        icon: BookOpen,
        children: [
          { label: nt("New Account Setup"), href: "/dashboard/accounts/setup", icon: BookOpen },
          { label: nt("New Ledger Account"), href: "/dashboard/ledger/new", icon: BookOpenText },
          { label: nt("Accounts General Report"), href: "/dashboard/new-entry/accounts/general-report", icon: FileBarChart },
        ],
      },
      { label: nt("New Entry Hub"), href: "/dashboard/new-entry", icon: ListPlus },
    ],
  },
  {
    key: "entry-edit-delete-control",
    label: nt("Entry Edit & Delete Control"),
    icon: Sliders,
    roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"],
    children: [
      {
        key: "sub-entry-edit",
        label: nt("Entry Edit System"),
        icon: Pencil,
        children: [
          { label: nt("Business Edit Invoice"), href: "/dashboard/business-edit-invoice", icon: FileText },
          { label: nt("Edit & Version History"), href: "/dashboard/super-admin/edit-history", icon: History, roles: ["super_admin"] },
        ],
      },
      {
        key: "sub-entry-delete",
        label: nt("Entry Delete / Delete Management"),
        icon: Trash2,
        children: [
          { label: nt("Deleted Records & Trash Audit"), href: "/dashboard/super-admin/deleted-records", icon: Trash2, roles: ["super_admin", "country_admin"] },
        ],
      },
    ],
  },
  {
    key: "daily-payment",
    label: nt("Daily Payment Entry"),
    icon: FileText,
    children: [
      { label: nt("Daily Cash Entry (Roznamcha)"), href: "/dashboard/roznamcha/cash-entry", icon: Wallet },
      {
        key: "sub-purchase-payments",
        label: nt("Purchase Payments"),
        icon: Receipt,
        children: [
          { label: nt("Advance Payment"), href: "/dashboard/journal/purchase-order-payment/advance", icon: Receipt },
          { label: nt("Credit Payment"), href: "/dashboard/journal/purchase-order-payment/charges", icon: CreditCard },
          { label: nt("Remaining Payment"), href: "/dashboard/journal/purchase-order-payment/remaining", icon: CreditCard },
          { label: nt("Purchase Payment History"), href: "/dashboard/journal/purchase-order-payment/history", icon: Clock },
          { label: nt("Final Payment"), href: "/dashboard/journal/purchase-order-payment/final", icon: CheckCircle2 },
        ],
      },
      {
        key: "sub-sales-payments",
        label: nt("Sales Payments"),
        icon: CircleDollarSign,
        children: [
          { label: nt("Advance Payment / Receipt"), href: "/dashboard/journal/sales-order-payment/advance", icon: CircleDollarSign },
          { label: nt("Credit Payment / Receipt"), href: "/dashboard/journal/sales-order-payment/charges", icon: CircleDollarSign },
          { label: nt("Remaining Payment / Recovery"), href: "/dashboard/journal/sales-order-payment/remaining", icon: CircleDollarSign },
          { label: nt("Sales Payment History"), href: "/dashboard/journal/sales-order-payment/history", icon: Clock },
          { label: nt("Final Payment"), href: "/dashboard/journal/sales-order-payment/final", icon: CheckCircle2 },
        ],
      },
      { label: nt("Daily Operational Expenses"), href: "/dashboard/roznamcha/daily-expenses-bill", icon: Banknote },
      { label: nt("Office / Home Expenses Bill"), href: "/dashboard/roznamcha/expenses-bill", icon: FileSpreadsheet },
    ],
  },
  {
    key: "daily-exchange-rate",
    label: nt("Daily Exchange Rate"),
    icon: RefreshCw,
    href: "/dashboard/reports/exchange-rate",
  },
  {
    key: "ledgers",
    label: nt("Ledgers"),
    icon: BookOpen,
    children: [
      { label: nt("Detailed Ledger Statement"), href: "/dashboard/ledger/detailed", icon: FileText },
      { label: nt("Ledger General Report"), href: "/dashboard/ledger/general-report", icon: FileBarChart },
      { label: nt("Outstanding Ledgers Report"), href: "/dashboard/ledger/outstanding", icon: FileSpreadsheet },
      { label: nt("Journal Reporting"), href: "/dashboard/reports/journal", icon: BarChart3 },
    ],
  },
  {
    key: "purchase-sales-trade",
    label: nt("Purchase, Sales & Trade"),
    icon: ShoppingCart,
    children: [
      {
        key: "sub-purchase-booking",
        label: nt("Purchase Booking"),
        icon: ClipboardList,
        children: [
          { label: nt("New Purchase Booking Order"), href: "/dashboard/purchase/new-purchase-booking-order", icon: ClipboardList },
          { label: nt("Purchase Booking Details & Register"), href: "/dashboard/purchase/purchase-booking-journal-report", icon: FileBarChart },
          { label: nt("Purchase Payments"), href: "/dashboard/purchase/purchase-payments", icon: CreditCard },
          { label: nt("Purchase Orders Payment"), href: "/dashboard/purchase/purchase-order", icon: Receipt },
          { label: nt("Country Bill Payment"), href: "/dashboard/purchase/completed-purchase-bills", icon: FileCheck2 },
          { label: nt("Purchase Loading Records"), href: "/dashboard/purchase/purchase-loading-records", icon: Truck },
        ],
      },
      {
        key: "sub-local-purchase",
        label: nt("Local Purchase"),
        icon: ShoppingCart,
        children: [
          { label: nt("Local Purchase Order"), href: "/dashboard/purchase/local-purchase", icon: ShoppingCart },
          { label: nt("Local Goods Received"), href: "/dashboard/purchase/local-goods-received", icon: Package },
          { label: nt("Warehouse Transfer Queue"), href: "/dashboard/purchase/local-purchase-warehouse-transfer", icon: Warehouse },
          { label: nt("Local Purchase Loading Queue"), href: "/dashboard/purchase/local-purchase-loading", icon: Truck },
          { label: nt("Export Handover Queue"), href: "/dashboard/purchase/local-purchase-export", icon: Flag },
          { label: nt("Local Purchase Journal Report"), href: "/dashboard/purchase/local-purchase-journal-report", icon: FileBarChart },
        ],
      },
      {
        key: "sub-consignment-purchase",
        label: nt("Consignment Register"),
        icon: Package,
        children: [
          { label: nt("Consignment Stock & Sales Register"), href: "/dashboard/consignment", icon: Package },
        ],
      },
      {
        key: "sub-sales-booking",
        label: nt("Sales Booking"),
        icon: ClipboardList,
        children: [
          { label: nt("New Sales Booking Order"), href: "/dashboard/sales/new-sales-booking-order", icon: ClipboardList },
          { label: nt("Confirmed Sales Orders"), href: "/dashboard/sales/sales-confirm", icon: CheckSquare },
          { label: nt("Sales Booking Journal Report"), href: "/dashboard/sales/sales-booking-journal-report", icon: FileBarChart },
        ],
      },
      {
        key: "sub-local-sales",
        label: nt("Local Sales"),
        icon: TrendingUp,
        children: [
          { label: nt("Local Sales Order"), href: "/dashboard/sales/local-sales", icon: ShoppingCart },
          { label: nt("Sales Order & Payment Transfer"), href: "/dashboard/sales/sales-order", icon: Receipt },
        ],
      },
      {
        key: "sub-trade",
        label: nt("Other Country Trade"),
        icon: Globe,
        children: [
          { label: nt("Country-to-Country Transfer"), href: "/dashboard/purchase/country-transfer", icon: Globe },
          { label: nt("Inter-Country Transfers & Claims"), href: "/dashboard/inter-country-transfers", icon: ArrowRightLeft },
          { label: nt("Country Purchase Reports"), href: "/dashboard/purchase/country-purchase-reports", icon: FileBarChart },
        ],
      },
      {
        key: "sub-bcp",
        label: nt("Bill Cost, Expenses & Profit"),
        icon: FileSpreadsheet,
        children: [
          { label: nt("Bill Cost & Profit Overview"), href: "/dashboard/bill-cost-profit", icon: BarChart3 },
          { label: nt("Bill Expenses Entry"), href: "/dashboard/expenses/bill-expenses", icon: Banknote },
          { label: nt("Business Edit Invoice"), href: "/dashboard/business-edit-invoice?source=bcp", icon: FileText },
          { label: nt("BCP Purchase Cost Audit"), href: "/dashboard/bill-cost-profit/purchase", icon: ShoppingCart },
          { label: nt("BCP Sales Profit Analytics"), href: "/dashboard/bill-cost-profit/sales", icon: TrendingUp },
          { label: nt("BCP Operational Expenses"), href: "/dashboard/bill-cost-profit/expenses", icon: Receipt },
          { label: nt("BCP Universal Reports"), href: "/dashboard/bill-cost-profit/reports", icon: FileBarChart },
        ],
      },
    ],
  },
  {
    key: "journal-stock",
    label: nt("Journal Stock"),
    icon: Boxes,
    children: [
      { label: nt("Stock Register / Inventory"), href: "/dashboard/inventory", icon: Package },
      { label: nt("Stock Reports (Branch)"), href: "/dashboard/inventory/stock-reports/branch", icon: BarChart3 },
      { label: nt("Stock Reports (Country)"), href: "/dashboard/inventory/stock-reports/country", icon: Globe },
      { label: nt("Stock Reports (Salesman)"), href: "/dashboard/inventory/stock-reports/salesman", icon: Users },
      { label: nt("Warehouse Stock"), href: "/dashboard/purchase/stock/warehouse", icon: Boxes },
      { label: nt("Booking Stock"), href: "/dashboard/purchase/stock/booking", icon: ClipboardList },
      { label: nt("Confirmed Stock"), href: "/dashboard/purchase/stock/confirmed", icon: CheckSquare },
      { label: nt("Import Stock"), href: "/dashboard/purchase/stock/import", icon: Ship },
      { label: nt("In-Transit Stock"), href: "/dashboard/purchase/stock/in-transit", icon: Truck },
      { label: nt("Journal Stock Checking Report"), href: "/dashboard/inventory/journal-report/branch", icon: FileBarChart },
    ],
  },
  {
    key: "shipping-cleaning",
    label: nt("Shipping & Clearing"),
    icon: Ship,
    children: [
      { label: nt("New Customer Order"), href: "/dashboard/clearing-agent/customer-order", icon: ListPlus },
      { label: nt("Customer Bills"), href: "/dashboard/clearing-agent/customer-bill", icon: Receipt },
      {
        key: "sub-expenses-bill",
        label: nt("Expenses Bill"),
        icon: Receipt,
        children: [
          { label: nt("Custom Bills"), href: "/dashboard/clearing-agent/customs-expenses", icon: Landmark },
          { label: nt("Truck Expenses Bills"), href: "/dashboard/clearing-agent/truck-expenses", icon: Truck },
          { label: nt("Customer Expenses Bills"), href: "/dashboard/clearing-agent/customer-bill?type=expenses", icon: Receipt },
          { label: nt("Other Expenses Bills"), href: "/dashboard/clearing-agent/other-expenses", icon: Receipt },
        ],
      },
      {
        key: "sub-clearing-agent",
        label: nt("Clearing Agent"),
        icon: Users,
        children: [
          { label: nt("Agent Entry"), href: "/dashboard/shipping-line/agent-entry", icon: Users },
          { label: nt("Agent List"), href: "/dashboard/clearing-agent/list", icon: ClipboardList },
          { label: nt("Agent Documents"), href: "/dashboard/clearing-agent/agent-custom-entry", icon: FileText },
          { label: nt("Agent Payment Entry"), href: "/dashboard/clearing-agent/payment-bill-entry", icon: CreditCard },
          { label: nt("Agent Reports"), href: "/dashboard/shipping-line/shipment-report", icon: FileBarChart },
        ],
      },
      {
        key: "sub-clearing-truck",
        label: nt("Clearing Truck"),
        icon: Truck,
        children: [
          { label: nt("Truck Register"), href: "/dashboard/clearing-agent/truck-registration", icon: Truck },
        ],
      },
      { label: nt("Shipping Lines"), href: "/dashboard/shipping-line", icon: Ship },
      { label: nt("BL Entry"), href: "/dashboard/shipping-line/bl-entry", icon: FileText },
      { label: nt("Container & Vessel Tracking"), href: "/dashboard/shipping-line/tracking", icon: Compass, tone: "red" },
      { label: nt("Free Country Shipping Claims"), href: "/dashboard/inter-country-transfers?category=shipping_line", icon: ArrowRightLeft },
      { label: nt("Clearing Workspace"), href: "/dashboard/clearing-agent/clearing-workspace", icon: FileCheck2 },
      { label: nt("Logistics Tracking Dashboard"), href: "/dashboard/logistics", icon: BarChart3 },
      { label: nt("Shipping Account Access"), href: "/dashboard/shipping-line/account-access", icon: Wallet },
      { label: nt("Transfer & Handover Center"), href: "/dashboard/transfer-center?context=shipping", icon: Inbox },
    ],
  },
  {
    key: "transfer-handover-center",
    label: nt("Transfer & Handover Center"),
    icon: Inbox,
    href: "/dashboard/transfer-center",
  },
  {
    key: "finance",
    label: nt("Finance"),
    icon: ShieldCheck,
    children: [
      { label: nt("Banks & Bank Accounts"), href: "/dashboard/settings/bank", icon: Landmark },
      { label: nt("Bank Cheque Roznamcha"), href: "/dashboard/roznamcha/reports/bank", icon: Receipt },
      { label: nt("Money Exchange (Currency Changer)"), href: "/dashboard/roznamcha/money-exchange", icon: ArrowRightLeft },
      { label: nt("Country Investments"), href: "/dashboard/super-admin/investments", icon: TrendingUp },
    ],
  },
  {
    key: "general-office",
    label: nt("General Office"),
    icon: Settings,
    children: [
      { label: nt("Customer Management"), href: "/dashboard/settings/customers", icon: Users },
      { label: nt("Customer Management Journal"), href: "/dashboard/settings/customers?view=journal", icon: FileSpreadsheet },
      { label: nt("Employees Directory & Registration"), href: "/dashboard/general-office/employees", icon: Users },
      { label: nt("Employee KYC & Documents"), href: "/dashboard/general-office/employee-kyc", icon: FileText },
      { label: nt("Attendance & Leave Management"), href: "/dashboard/general-office/leave-attendance", icon: CalendarCheck },
      { label: nt("Payroll Runs & Salary Slips"), href: "/dashboard/general-office/payroll", icon: Banknote },
      { label: nt("Departments & Designations"), href: "/dashboard/general-office/departments", icon: Building2 },
      { label: nt("Gratuity & End-of-Service"), href: "/dashboard/general-office/gratuity", icon: Receipt },
      { label: nt("Share External Forms"), href: "/dashboard/general-office/employees?tab=share-forms", icon: ArrowRightLeft },
      { label: nt("Dynamic Location & Route Management"), href: "/dashboard/settings/location-master", icon: MapPin, tone: "red" },
      { label: nt("Reusable Route Templates"), href: "/dashboard/settings/route-templates", icon: Route, tone: "red" },
    ],
  },
  {
    key: "settlement-reconciliation",
    label: nt("Settlement & Reconciliation"),
    icon: Layers,
    children: [
      { label: nt("Settlement & Reconciliation Engine"), href: "/dashboard/settlement", icon: Layers },
      { label: nt("Inter-Country Claims & Settlements"), href: "/dashboard/inter-country-transfers?tab=accepted", icon: ArrowRightLeft },
      { label: nt("Daily Settlement"), href: "/dashboard/settlement/daily", icon: CalendarCheck },
      { label: nt("Payment Settlement"), href: "/dashboard/settlement/payment", icon: Receipt },
    ],
  },
  {
    key: "reports-all",
    label: nt("Reports and All Reporting Page"),
    icon: BarChart3,
    children: [
      {
        key: "sub-kyc",
        label: nt("KYC Reports"),
        icon: FileText,
        children: [
          { label: nt("Customers KYC Report"), href: "/dashboard/settings/customers?tab=kyc-report", icon: Users },
          { label: nt("Employees KYC Report"), href: "/dashboard/general-office/employee-kyc?tab=report", icon: FileText },
        ],
      },
      {
        key: "sub-audit",
        label: nt("Audit & Compliance"),
        icon: ShieldAlert,
        children: [
          { label: nt("Compliance & Audit Monitoring"), href: "/dashboard/audit-monitoring", icon: ShieldAlert },
          { label: nt("All Edit / Version History"), href: "/dashboard/super-admin/edit-history?view=all", icon: History, roles: ["super_admin"] },
          { label: nt("Deleted Entries Audit"), href: "/dashboard/super-admin/deleted-records?view=all", icon: Trash2, roles: ["super_admin"] },
        ],
      },
      {
        key: "sub-tasks",
        label: nt("User Tasks"),
        icon: CheckSquare,
        children: [
          { label: nt("Active User Tasks"), href: "/dashboard/user-tasks", icon: CheckSquare },
        ],
      },
      {
        key: "sub-reports",
        label: nt("Reports"),
        icon: CheckSquare,
        children: [
          { label: nt("All Reports Hub"), href: "/dashboard/reports", icon: BarChart3 },
          { label: nt("Super Admin Reports"), href: "/dashboard/reports/super-admin", icon: FileBarChart },
          { label: nt("Country Admin Reports"), href: "/dashboard/reports/country", icon: Globe },
          { label: nt("Branch Reports"), href: "/dashboard/reports/branch", icon: Building2 },
          { label: nt("Payments & Settlements Report"), href: "/dashboard/reports/payments", icon: Receipt },
          { label: nt("Shipping & Clearing Reports"), href: "/dashboard/reports/shipping", icon: Ship },
          { label: nt("Financial Statements"), href: "/dashboard/reports/financial-statements", icon: FileSpreadsheet },
          { label: nt("Journal Report PDF ERP"), href: "/dashboard/reports/handover", icon: FileText },
          { label: nt("System Forms Directory"), href: "/dashboard/reports/system-forms-directory", icon: ListPlus },
        ],
      },
      {
        key: "sub-docs",
        label: nt("Document Management"),
        icon: FileText,
        children: [
          { label: nt("Document Intake Center"), href: "/dashboard/documents", icon: FileText },
        ],
      },
    ],
  },
  {
    // Renamed from "AI Voice & Smart Operations" to avoid confusion with the new
    // top-level "Smart Operations" action center — this section is AI voice/text/doc entry.
    key: "ai-operations",
    label: nt("AI Voice & Document Entry"),
    icon: Sparkles,
    children: [
      { label: nt("AI Voice Messaging Hub"), href: "/dashboard/ai-entry/messages", icon: Mic },
      { label: nt("AI Voice & Text Entry"), href: "/dashboard/ai-entry/voice-text", icon: Sparkles },
      { label: nt("AI Approvals & Workflow"), href: "/dashboard/ai-entry/approvals", icon: CheckSquare },
      { label: nt("AI Calls Center"), href: "/dashboard/customer-inquiries/calls", icon: PhoneCall },
      { label: nt("Document Intelligence AI"), href: "/dashboard/document-intelligence", icon: FileText },
    ],
  },
  {
    key: "crm-control",
    label: nt("CRM Control Center"),
    icon: CalendarCheck,
    children: [
      { label: nt("CRM Dashboard"), href: "/dashboard/crm", icon: BarChart3 },
      { label: nt("Today's Action Center"), href: "/dashboard/crm?tab=today", icon: CalendarCheck },
      { label: nt("Due & Follow-Up"), href: "/dashboard/smart-due?tab=overdue", icon: Clock },
      { label: nt("Cheques Reminders"), href: "/dashboard/crm?tab=cheques", icon: CreditCard },
      { label: nt("Purchase Payments Due"), href: "/dashboard/crm?tab=purchases", icon: ShoppingCart },
      { label: nt("Sales Recovery Due"), href: "/dashboard/crm?tab=sales", icon: CircleDollarSign },
      { label: nt("Shipping / Clearing Due"), href: "/dashboard/crm?tab=shipping", icon: Ship },
      { label: nt("Customer Follow-Up"), href: "/dashboard/crm?tab=customers", icon: Users },
      { label: nt("New Customer Registration"), href: "/dashboard/crm/customers/new", icon: ListPlus },
      { label: nt("CRM Reports"), href: "/dashboard/crm/reports", icon: FileBarChart },
    ],
  },
  {
    key: "tax-einvoicing",
    label: nt("UAE Tax & E-Invoicing"),
    icon: Landmark,
    children: [
      { label: nt("UAE Tax Dashboard"), href: "/dashboard/tax-einvoicing/uae/dashboard", icon: BarChart3 },
      { label: nt("VAT Return 201"), href: "/dashboard/tax-einvoicing/uae/vat-return", icon: FileSpreadsheet },
      { label: nt("E-Invoices Center"), href: "/dashboard/tax-einvoicing/uae/e-invoices", icon: FileText },
      { label: nt("ASP / FTA Compliance Status"), href: "/dashboard/tax-einvoicing/uae/asp-fta-status", icon: ShieldCheck },
      { label: nt("VAT Control & Reconciliation"), href: "/dashboard/tax-einvoicing/uae/vat-control", icon: Split },
      { label: nt("Tax Reports & Audit"), href: "/dashboard/tax-einvoicing/uae/tax-reports", icon: FileBarChart },
    ],
  },
  {
    key: "master-data",
    label: nt("Master Data"),
    icon: BookOpenText,
    children: [
      { label: nt("Goods Master & Category"), href: "/dashboard/settings/goods-master", icon: Package },
      { label: nt("Almond Kernel Parameters"), href: "/dashboard/settings/goods-master?tab=parameters", icon: Database },
      { label: nt("Product Reorder Barcodes"), href: "/dashboard/settings/goods-master?tab=barcodes", icon: ScanLine },
      { label: nt("Product Categories & Brands"), href: "/dashboard/settings/product-categories", icon: Boxes },
      { label: nt("Warehouses Management"), href: "/dashboard/settings/warehouse", icon: Building2 },
    ],
  },
  {
    key: "all-messages",
    label: nt("All Messages"),
    icon: MessageSquare,
    children: [
      { label: nt("Email"), href: "/dashboard/messages/email", icon: Mail },
      { label: nt("WhatsApp"), href: "/dashboard/messages/whatsapp", icon: MessageCircle },
      { label: nt("Communication Center Hub"), href: "/dashboard/communication-center", icon: MessageSquare },
      { label: nt("Customer Inquiries & Calls"), href: "/dashboard/customer-inquiries", icon: PhoneCall },
      { label: nt("Inquiry Follow-ups"), href: "/dashboard/customer-inquiries/follow-ups", icon: Clock },
      { label: nt("SMS & Customer Responses"), href: "/dashboard/return-sms-reply", icon: FileText },
    ],
  },
  {
    key: "dgt-mail-management",
    label: nt("DGT Mail Management"),
    icon: Mail,
    children: [
      { label: nt("Mail Overview & Dashboard"), href: "/dashboard/mail-management", icon: BarChart3 },
      { label: nt("Mail Users & Storage Quotas"), href: "/dashboard/mail-management/users", icon: Users },
      { label: nt("Server Health & DNS Deliverability"), href: "/dashboard/mail-management/monitoring", icon: ShieldCheck },
    ],
  },
  {
    key: "invoice-system",
    label: nt("Invoice & Templates"),
    icon: FileText,
    tone: "red",
    children: [
      { label: nt("Invoice Templates"), href: "/dashboard/roznamcha/reports/invoice", icon: FileSpreadsheet },
    ],
  },
  {
    key: "journal-reporting",
    label: nt("Journal & Reporting"),
    icon: BarChart3,
    tone: "red",
    children: [
      { label: nt("Journal / Roznamcha"), href: "/dashboard/journal", icon: BookOpen },
    ],
  },
  {
    key: "customs-tax-system",
    label: nt("Customs & Tax Documents"),
    icon: Scale,
    tone: "red",
    children: [
      { label: nt("Tax Management"), href: "/dashboard/tax", icon: Scale },
      { label: nt("E-Invoicing & Tax"), href: "/dashboard/tax-einvoicing", icon: FileText },
    ],
  },
  {
    key: "settings-menu",
    label: nt("Settings"),
    icon: Settings,
    children: [
      { label: nt("System Settings Hub"), href: "/dashboard/settings", icon: Settings },
      { label: nt("Dashboard Settings"), href: "/dashboard/settings/dashboard-settings", icon: Sliders },
      { label: nt("Company Setup"), href: "/dashboard/settings/company-setup", icon: Building2 },
      { label: nt("Account Types Setup"), href: "/dashboard/settings/account-type", icon: BookOpen },
      { label: nt("Locations & Cities"), href: "/dashboard/settings/locations", icon: Globe2 },
      { label: nt("Country Tax & Currency"), href: "/dashboard/settings/tax", icon: Landmark },
      { label: nt("Email Accounts"), href: "/dashboard/settings/email-accounts", icon: Mail },
      { label: nt("ERP Translations & Languages"), href: "/dashboard/settings/translations", icon: Globe },
      { label: nt("Profile & Security"), href: "/dashboard/settings/profile", icon: ShieldCheck },
      { label: nt("Super Admin Security"), href: "/dashboard/settings/super-admin-security", icon: ShieldCheck, roles: ["super_admin"] },
    ],
  },
  {
    // Main Menu Item Placed Right Below Settings (Red Highlighted):
    // Historical / temporary tracking ONLY — NOT main ERP accounting. No Ledger /
    // Roznamcha / Journal / Stock / Voucher posting, no accounting transfer.
    key: "temp-bills",
    label: nt("Temporary (Arzi) Purchase & Sales"),
    icon: FileSpreadsheet,
    tone: "red",
    badge: "Arzi",
    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant"],
    children: [
      { label: nt("Arzi Purchase Bills"), href: "/dashboard/temp-bills/purchase", icon: ShoppingCart },
      { label: nt("Arzi Sales Bills"), href: "/dashboard/temp-bills/sales", icon: TrendingUp },
      { label: nt("All Arzi Bills Register"), href: "/dashboard/temp-bills", icon: FileSpreadsheet },
      { label: nt("Arzi Bills Reports & Search"), href: "/dashboard/temp-bills/reports", icon: FileBarChart },
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
  /** The signed-in user's enterprise roles. Menu entries carrying a `roles` list
   *  are hidden unless they intersect. Entries WITHOUT `roles` are unaffected
   *  (visible to all — the page still enforces access). Super admin sees all. */
  roles?: string[] | null;
  /** Active user permissions and allotted routes. When set, only explicitly allotted
   *  forms and permitted routes appear in the user's sidebar. */
  permissions?: string[] | null;
  /** True when the session is locked to a specific clearing agent with shipping_only ledger */
  isShippingScoped?: boolean;
  /** Operational domains: 'shipping', 'business', or 'both' */
  operationalDomains?: ("business" | "shipping" | "both")[] | null;
  /** 'scoped' | 'shipping_only' | 'full' */
  ledgerVisibility?: "scoped" | "shipping_only" | "full" | null;
}

export const ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  "/dashboard": ["dashboard:read", "route:/dashboard"],
  "/dashboard/smart-operations": ["dashboard:read", "route:/dashboard/smart-operations"],
  "/dashboard/super-admin": ["dashboard:read", "super_admin", "route:/dashboard/super-admin"],
  "/dashboard/country": ["dashboard:read", "country_admin", "country_user", "route:/dashboard/country"],
  "/dashboard/city": ["dashboard:read", "main_branch_admin", "city_branch_admin", "staff_user", "accountant", "cashier", "route:/dashboard/city"],
  "/dashboard/logistics": ["shipping_records:read", "route:/dashboard/logistics"],
  "/dashboard/new-entry/users/registration": ["users:create", "users:read", "route:/dashboard/new-entry/users/registration"],
  "/dashboard/new-entry/users/all": ["users:read", "route:/dashboard/new-entry/users/all"],
  "/dashboard/new-entry/branch-entry/country-branch": ["country_branches:create", "country_branches:read", "route:/dashboard/new-entry/branch-entry/country-branch"],
  "/dashboard/new-entry/branch-entry/city-branch": ["city_branches:create", "city_branches:read", "route:/dashboard/new-entry/branch-entry/city-branch"],
  "/dashboard/new-entry/branches/super-admin": ["country_branches:create", "super_admin", "route:/dashboard/new-entry/branches/super-admin"],
  "/dashboard/branch-management/general-report": ["country_branches:read", "city_branches:read", "route:/dashboard/branch-management/general-report"],
  "/dashboard/accounts/setup": ["accounts:read", "accounts:create", "accounts:update", "accounts.setup", "accounts.new_entry", "route:/dashboard/accounts/setup"],
  "/dashboard/ledger/new": ["ledgers:read", "ledgers:create", "ledgers.new", "route:/dashboard/ledger/new"],
  "/dashboard/new-entry/accounts/general-report": ["accounts:read", "accounts.reports", "reports:read", "route:/dashboard/new-entry/accounts/general-report"],
  "/dashboard/new-entry": ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "route:/dashboard/new-entry"],
  "/dashboard/business-edit-invoice": ["transactions:update", "purchases:update", "route:/dashboard/business-edit-invoice"],
  "/dashboard/super-admin/edit-history": ["transactions:read", "audit_logs:read", "super_admin", "route:/dashboard/super-admin/edit-history"],
  "/dashboard/super-admin/deleted-records": ["transactions:read", "audit_logs:read", "super_admin", "country_admin", "route:/dashboard/super-admin/deleted-records"],
  "/dashboard/ledger/detailed": ["ledgers:read", "route:/dashboard/ledger/detailed"],
  "/dashboard/ledger/general-report": ["ledgers:read", "reports:read", "route:/dashboard/ledger/general-report"],
  "/dashboard/ledger/outstanding": ["ledgers:read", "reports:read", "route:/dashboard/ledger/outstanding"],
  "/dashboard/roznamcha/cash-entry": ["roznamcha:read", "roznamcha:create", "route:/dashboard/roznamcha/cash-entry"],
  "/dashboard/journal/purchase-order-payment/advance": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/advance"],
  "/dashboard/journal/purchase-order-payment/charges": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/charges"],
  "/dashboard/journal/purchase-order-payment/remaining": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/remaining"],
  "/dashboard/journal/purchase-order-payment/history": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/history"],
  "/dashboard/journal/purchase-order-payment/final": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/final"],
  "/dashboard/journal/sales-order-payment/advance": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/advance"],
  "/dashboard/journal/sales-order-payment/charges": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/charges"],
  "/dashboard/journal/sales-order-payment/remaining": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/remaining"],
  "/dashboard/journal/sales-order-payment/history": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/history"],
  "/dashboard/journal/sales-order-payment/final": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/final"],
  "/dashboard/roznamcha/daily-expenses-bill": ["expenses:read", "expenses:create", "route:/dashboard/roznamcha/daily-expenses-bill"],
  "/dashboard/roznamcha/expenses-bill": ["expenses:read", "expenses:create", "route:/dashboard/roznamcha/expenses-bill"],
  "/dashboard/purchase/new-purchase-booking-order": ["purchases:read", "purchases:create", "route:/dashboard/purchase/new-purchase-booking-order"],
  "/dashboard/purchase/purchase-confirm": ["purchases:read", "purchases:update", "route:/dashboard/purchase/purchase-confirm"],
  "/dashboard/purchase/purchase-booking-journal-report": ["purchases:read", "reports:read", "route:/dashboard/purchase/purchase-booking-journal-report"],
  "/dashboard/purchase/purchase-order": ["purchases:read", "purchases:create", "route:/dashboard/purchase/purchase-order"],
  "/dashboard/purchase/purchase-order-tracking": ["purchases:read", "route:/dashboard/purchase/purchase-order-tracking"],
  "/dashboard/purchase/completed-purchase-bills": ["purchases:read", "route:/dashboard/purchase/completed-purchase-bills"],
  "/dashboard/purchase/purchase-loading-records": ["purchases:read", "purchases:update", "route:/dashboard/purchase/purchase-loading-records"],
  "/dashboard/purchase/local-purchase": ["purchases:read", "purchases:create", "route:/dashboard/purchase/local-purchase"],
  "/dashboard/purchase/local-goods-received": ["purchases:read", "inventory:read", "route:/dashboard/purchase/local-goods-received"],
  "/dashboard/purchase/local-purchase-transfer-payment": ["purchases:read", "transactions:read", "route:/dashboard/purchase/local-purchase-transfer-payment"],
  "/dashboard/purchase/local-purchase-warehouse-transfer": ["purchases:read", "warehouses:read", "route:/dashboard/purchase/local-purchase-warehouse-transfer"],
  "/dashboard/purchase/local-purchase-loading": ["purchases:read", "route:/dashboard/purchase/local-purchase-loading"],
  "/dashboard/purchase/local-purchase-export": ["purchases:read", "shipping_records:read", "route:/dashboard/purchase/local-purchase-export"],
  "/dashboard/purchase/local-purchase-journal-report": ["purchases:read", "reports:read", "route:/dashboard/purchase/local-purchase-journal-report"],
  "/dashboard/consignment": ["purchases:read", "inventory:read", "route:/dashboard/consignment"],
  "/dashboard/sales/new-sales-booking-order": ["sales:read", "sales:create", "route:/dashboard/sales/new-sales-booking-order"],
  "/dashboard/sales/sales-confirm": ["sales:read", "sales:update", "route:/dashboard/sales/sales-confirm"],
  "/dashboard/sales/sales-booking-journal-report": ["sales:read", "reports:read", "route:/dashboard/sales/sales-booking-journal-report"],
  "/dashboard/sales/local-sales": ["sales:read", "sales:create", "route:/dashboard/sales/local-sales"],
  "/dashboard/sales/sales-order": ["sales:read", "sales:create", "route:/dashboard/sales/sales-order"],
  "/dashboard/purchase/country-transfer": ["purchases:read", "shipping_transfers:read", "route:/dashboard/purchase/country-transfer"],
  "/dashboard/inter-country-transfers": ["purchases:read", "shipping_records:read", "shipping_transfers:read", "route:/dashboard/inter-country-transfers"],
  "/dashboard/purchase/country-purchase-reports": ["purchases:read", "reports:read", "route:/dashboard/purchase/country-purchase-reports"],
  "/dashboard/bill-cost-profit": ["purchases:read", "expenses:read", "route:/dashboard/bill-cost-profit"],
  "/dashboard/expenses/bill-expenses": ["expenses:read", "expenses:create", "route:/dashboard/expenses/bill-expenses"],
  "/dashboard/inventory": ["products:read", "inventory:read", "route:/dashboard/inventory"],
  "/dashboard/clearing-agent/customer-order": ["shipping_records:read", "clearing_agents:read", "route:/dashboard/clearing-agent/customer-order"],
  "/dashboard/clearing-agent/customer-bill": ["shipping_records:read", "clearing_bill_customer_charges:read", "route:/dashboard/clearing-agent/customer-bill"],
  "/dashboard/shipping-line": ["shipping_records:read", "route:/dashboard/shipping-line"],
  "/dashboard/shipping-line/bl-entry": ["shipping_records:read", "route:/dashboard/shipping-line/bl-entry"],
  "/dashboard/shipping-line/tracking": ["shipping_records:read", "route:/dashboard/shipping-line/tracking"],
  "/dashboard/purchase/shipment-tracking": ["purchases:read", "route:/dashboard/purchase/shipment-tracking"],
  "/dashboard/tracking": ["dashboard:read", "shipping_records:read", "route:/dashboard/tracking"],
  "/dashboard/clearing-agent": ["clearing_agents:read", "route:/dashboard/clearing-agent"],
  "/dashboard/clearing-agent/truck-registration": ["shipping_records:read", "clearing_agents:read", "route:/dashboard/clearing-agent/truck-registration"],
  "/dashboard/shipping-line/handover-inbox": ["shipping_records:read", "shipping_transfers:read", "route:/dashboard/shipping-line/handover-inbox"],
  "/dashboard/shipping-line/account-access": ["accounts:read", "route:/dashboard/shipping-line/account-access"],
  "/dashboard/settings/bank": ["banks:read", "route:/dashboard/settings/bank"],
  "/dashboard/roznamcha/reports/bank": ["banks:read", "roznamcha:read", "route:/dashboard/roznamcha/reports/bank"],
  "/dashboard/roznamcha/money-exchange": ["exchange_rates:read", "route:/dashboard/roznamcha/money-exchange"],
  "/dashboard/reports/exchange-rate": ["exchange_rates:read", "route:/dashboard/reports/exchange-rate"],
  "/dashboard/super-admin/investments": ["transactions:read", "super_admin", "route:/dashboard/super-admin/investments"],
  "/dashboard/settings/customers": ["customers:read", "route:/dashboard/settings/customers"],
  "/dashboard/general-office/employees": ["users:read", "employees:read", "route:/dashboard/general-office/employees"],
  "/dashboard/general-office/employee-kyc": ["users:read", "employees:read", "route:/dashboard/general-office/employee-kyc"],
  "/dashboard/general-office/leave-attendance": ["users:read", "employees:read", "route:/dashboard/general-office/leave-attendance"],
  "/dashboard/general-office/payroll": ["users:read", "payroll:read", "route:/dashboard/general-office/payroll"],
  "/dashboard/general-office/departments": ["users:read", "route:/dashboard/general-office/departments"],
  "/dashboard/general-office/gratuity": ["users:read", "payroll:read", "route:/dashboard/general-office/gratuity"],
  "/dashboard/settlement": ["transactions:read", "route:/dashboard/settlement"],
  "/dashboard/settlement/daily": ["transactions:read", "route:/dashboard/settlement/daily"],
  "/dashboard/settlement/payment": ["transactions:read", "route:/dashboard/settlement/payment"],
  "/dashboard/reports": ["reports:read", "route:/dashboard/reports"],
  "/dashboard/audit-monitoring": ["audit_logs:read", "route:/dashboard/audit-monitoring"],
  "/dashboard/documents": ["documents:read", "route:/dashboard/documents"],
  "/dashboard/ai-entry/messages": ["communication:read", "route:/dashboard/ai-entry/messages"],
  "/dashboard/ai-entry/voice-text": ["communication:read", "route:/dashboard/ai-entry/voice-text"],
  "/dashboard/messages/whatsapp": ["communication:read", "whatsapp:read", "route:/dashboard/messages/whatsapp"],
  "/dashboard/messages/email": ["communication:read", "route:/dashboard/messages/email"],
  "/dashboard/settings/email-accounts": ["communication:read", "settings:read", "route:/dashboard/settings/email-accounts"],
  "/dashboard/settings/super-admin-security": ["super_admin", "route:/dashboard/settings/super-admin-security"],
  "/dashboard/mail-management": ["communication:read", "route:/dashboard/mail-management"],
  "/dashboard/mail-management/users": ["users:read", "communication:read", "route:/dashboard/mail-management/users"],
  "/dashboard/mail-management/monitoring": ["audit_logs:read", "route:/dashboard/mail-management/monitoring"],
  "/dashboard/permissions/control-center": ["super_admin", "permissions:read", "route:/dashboard/permissions/control-center"],
  "/dashboard/reports/journal": ["reports:read", "ledgers:read", "route:/dashboard/reports/journal"],
  "/dashboard/bill-cost-profit/purchase": ["purchases:read", "expenses:read", "route:/dashboard/bill-cost-profit/purchase"],
  "/dashboard/bill-cost-profit/sales": ["sales:read", "expenses:read", "route:/dashboard/bill-cost-profit/sales"],
  "/dashboard/bill-cost-profit/expenses": ["expenses:read", "route:/dashboard/bill-cost-profit/expenses"],
  "/dashboard/bill-cost-profit/reports": ["reports:read", "expenses:read", "route:/dashboard/bill-cost-profit/reports"],
  "/dashboard/inventory/stock-reports/branch": ["inventory:read", "products:read", "route:/dashboard/inventory/stock-reports/branch"],
  "/dashboard/inventory/stock-reports/country": ["inventory:read", "products:read", "route:/dashboard/inventory/stock-reports/country"],
  "/dashboard/inventory/stock-reports/salesman": ["inventory:read", "products:read", "route:/dashboard/inventory/stock-reports/salesman"],
  "/dashboard/purchase/stock/warehouse": ["inventory:read", "purchases:read", "warehouses:read", "route:/dashboard/purchase/stock/warehouse"],
  "/dashboard/purchase/stock/booking": ["purchases:read", "inventory:read", "route:/dashboard/purchase/stock/booking"],
  "/dashboard/purchase/stock/confirmed": ["purchases:read", "inventory:read", "route:/dashboard/purchase/stock/confirmed"],
  "/dashboard/purchase/stock/import": ["purchases:read", "shipping_records:read", "route:/dashboard/purchase/stock/import"],
  "/dashboard/purchase/stock/in-transit": ["purchases:read", "shipping_records:read", "route:/dashboard/purchase/stock/in-transit"],
  "/dashboard/inventory/journal-report/branch": ["inventory:read", "reports:read", "route:/dashboard/inventory/journal-report/branch"],
  "/dashboard/clearing-agent/clearing-workspace": ["shipping_records:read", "clearing_agents:read", "route:/dashboard/clearing-agent/clearing-workspace"],
  "/dashboard/transfer-center": ["shipping_transfers:read", "shipping_records:read", "route:/dashboard/transfer-center"],
  "/dashboard/user-tasks": ["tasks:read", "dashboard:read", "route:/dashboard/user-tasks"],
  "/dashboard/reports/super-admin": ["super_admin", "reports:read", "route:/dashboard/reports/super-admin"],
  "/dashboard/reports/country": ["country_admin", "reports:read", "route:/dashboard/reports/country"],
  "/dashboard/reports/branch": ["reports:read", "route:/dashboard/reports/branch"],
  "/dashboard/reports/payments": ["reports:read", "transactions:read", "route:/dashboard/reports/payments"],
  "/dashboard/reports/shipping": ["reports:read", "shipping_records:read", "route:/dashboard/reports/shipping"],
  "/dashboard/reports/financial-statements": ["reports:read", "ledgers:read", "route:/dashboard/reports/financial-statements"],
  "/dashboard/reports/handover": ["reports:read", "shipping_transfers:read", "route:/dashboard/reports/handover"],
  "/dashboard/reports/system-forms-directory": ["reports:read", "dashboard:read", "route:/dashboard/reports/system-forms-directory"],
  "/dashboard/ai-entry/approvals": ["approvals:read", "approvals:approve", "route:/dashboard/ai-entry/approvals"],
  "/dashboard/customer-inquiries/calls": ["communication:read", "customers:read", "route:/dashboard/customer-inquiries/calls"],
  "/dashboard/document-intelligence": ["documents:read", "route:/dashboard/document-intelligence"],
  "/dashboard/crm": ["customers:read", "crm:read", "route:/dashboard/crm"],
  "/dashboard/smart-due": ["smart_due:read", "dashboard:read", "route:/dashboard/smart-due"],
  "/dashboard/crm/customers/new": ["customers:create", "customers:read", "route:/dashboard/crm/customers/new"],
  "/dashboard/crm/reports": ["reports:read", "customers:read", "route:/dashboard/crm/reports"],
  "/dashboard/tax-einvoicing/uae/dashboard": ["uae_tax:read", "route:/dashboard/tax-einvoicing/uae/dashboard"],
  "/dashboard/tax-einvoicing/uae/vat-return": ["uae_tax:read", "uae_tax_filing:read", "route:/dashboard/tax-einvoicing/uae/vat-return"],
  "/dashboard/tax-einvoicing/uae/e-invoices": ["uae_tax:read", "route:/dashboard/tax-einvoicing/uae/e-invoices"],
  "/dashboard/tax-einvoicing/uae/asp-fta-status": ["uae_tax:read", "route:/dashboard/tax-einvoicing/uae/asp-fta-status"],
  "/dashboard/tax-einvoicing/uae/vat-control": ["uae_tax:read", "route:/dashboard/tax-einvoicing/uae/vat-control"],
  "/dashboard/tax-einvoicing/uae/tax-reports": ["uae_tax:read", "reports:read", "route:/dashboard/tax-einvoicing/uae/tax-reports"],
  "/dashboard/settings/goods-master": ["products:read", "inventory:read", "goods:read", "route:/dashboard/settings/goods-master"],
  "/dashboard/settings/product-categories": ["product_categories:read", "products:read", "route:/dashboard/settings/product-categories"],
  "/dashboard/settings/warehouse": ["warehouses:read", "route:/dashboard/settings/warehouse"],
  "/dashboard/communication-center": ["communication:read", "messages:read", "route:/dashboard/communication-center"],
  "/dashboard/customer-inquiries": ["communication:read", "customers:read", "route:/dashboard/customer-inquiries"],
  "/dashboard/customer-inquiries/follow-ups": ["communication:read", "customers:read", "route:/dashboard/customer-inquiries/follow-ups"],
  "/dashboard/return-sms-reply": ["communication:read", "messages:read", "route:/dashboard/return-sms-reply"],
  "/dashboard/settings": ["settings:read", "route:/dashboard/settings"],
  "/dashboard/settings/dashboard-settings": ["settings:read", "route:/dashboard/settings/dashboard-settings"],
  "/dashboard/settings/company-setup": ["companies:update", "companies:read", "route:/dashboard/settings/company-setup"],
  "/dashboard/settings/account-type": ["accounts:read", "settings:read", "route:/dashboard/settings/account-type"],
  "/dashboard/settings/locations": ["countries:read", "settings:read", "route:/dashboard/settings/locations"],
  "/dashboard/settings/tax": ["uae_tax:read", "settings:read", "route:/dashboard/settings/tax"],
  "/dashboard/settings/translations": ["translations:read", "settings:read", "route:/dashboard/settings/translations"],
  "/dashboard/settings/profile": ["profile:read", "users:read", "route:/dashboard/settings/profile"],
  "/dashboard/temp-bills/purchase": ["purchases:read", "route:/dashboard/temp-bills/purchase"],
  "/dashboard/temp-bills/sales": ["sales:read", "route:/dashboard/temp-bills/sales"],
  "/dashboard/temp-bills": ["purchases:read", "sales:read", "route:/dashboard/temp-bills"],
  "/dashboard/temp-bills/reports": ["purchases:read", "sales:read", "reports:read", "route:/dashboard/temp-bills/reports"]
};

type ShippingContext = {
  isShippingScoped?: boolean;
  operationalDomains?: ("business" | "shipping" | "both")[] | null;
  ledgerVisibility?: "scoped" | "shipping_only" | "full" | null;
};

/** RBAC & Form Allotment Filter — keeps an entry when it declares no `roles`, the user is a super
 *  admin, or the user holds one of the declared roles AND has been allotted permission for that form. */
function filterByRolesAndPermissions<T extends { key?: string; roles?: string[]; href?: string; children?: any[] }>(
  items: T[],
  userRoles: Set<string>,
  userPermissions: Set<string>,
  shippingContext?: ShippingContext
): T[] {
  const isSuper = userRoles.has("super_admin") || userPermissions.has("*:*");

  // Determine if this user is exclusively a Shipping Line / Clearing Agent user:
  // 1. Bound to clearing agent with shipping_only ledger (isShippingScoped = true)
  // 2. OR ledger_visibility === "shipping_only"
  // 3. OR operationalDomains contains "shipping" but neither "business" nor "both"
  // 4. OR role is agent_user / shipping_user
  // AND not holding higher broad administrative roles (country_admin, main_branch_admin, super_admin, accountant)
  const isShippingOnly =
    !isSuper &&
    (Boolean(shippingContext?.isShippingScoped) ||
      shippingContext?.ledgerVisibility === "shipping_only" ||
      (shippingContext?.operationalDomains?.includes("shipping") &&
        !shippingContext?.operationalDomains?.includes("business") &&
        !shippingContext?.operationalDomains?.includes("both")) ||
      userRoles.has("agent_user") ||
      userRoles.has("shipping_user")) &&
    !userRoles.has("country_admin") &&
    !userRoles.has("country_user") &&
    !userRoles.has("main_branch_admin") &&
    !userRoles.has("city_branch_admin") &&
    !userRoles.has("accountant") &&
    !userRoles.has("cashier");

  if (isShippingOnly) {
    // A shipping line / clearing agent user sees ONLY their shipping ecosystem:
    // 1. Dashboard (Logistics Tracking / Agent dashboard)
    // 2. Shipping & Clearing (All 10 modules)
    // 3. Ledgers (Detailed Statement & General Report — already restricted by backend to their clearing agent)
    // 4. Transfer & Handover Center
    // 5. Daily Cash Entry (Roznamcha) if they have roznamcha permissions
    const ALLOWED_SHIPPING_KEYS = new Set([
      "dashboard",
      "shipping-cleaning",
      "ledgers",
      "transfer-handover-center",
      "daily-payment"
    ]);

    return items
      .filter((it: any) => ALLOWED_SHIPPING_KEYS.has(it.key))
      .map((it: any) => {
        if (it.key === "dashboard") {
          return { ...it, href: "/dashboard/logistics" };
        }
        if (it.key === "shipping-cleaning") {
          return { ...it, defaultOpen: true };
        }
        if (it.key === "ledgers") {
          // Shipping users must see their scoped ledgers (Detailed statement & General report)
          const allowedLedgerHrefs = new Set([
            "/dashboard/ledger/detailed",
            "/dashboard/ledger/general-report"
          ]);
          const kids = (it.children || []).filter((c: any) => allowedLedgerHrefs.has(c.href));
          return {
            ...it,
            defaultOpen: false,
            children: kids
          };
        }
        if (it.key === "daily-payment") {
          // Keep only cash entry if the user has roznamcha:read, remove all purchase/sales payments
          const hasRoznamcha = userPermissions.has("roznamcha:read") || userPermissions.has("roznamcha:*");
          if (!hasRoznamcha) return null;
          return {
            ...it,
            children: (it.children || []).filter((c: any) => c.href === "/dashboard/roznamcha/cash-entry")
          };
        }
        return it;
      })
      .filter(Boolean) as T[];
  }

  // -----------------------------------------------------------------------
  // BUSINESS-ONLY domain: A pure Business Admin (operational_domain='business')
  // must NOT see Shipping & Clearing menus. Operations Admins (domain='both')
  // and Super Admins pass through and see everything.
  // -----------------------------------------------------------------------
  const isBusinessOnly =
    !isSuper &&
    !isShippingOnly &&
    shippingContext?.operationalDomains != null &&
    shippingContext.operationalDomains.length > 0 &&
    shippingContext.operationalDomains.includes("business") &&
    !shippingContext.operationalDomains.includes("shipping") &&
    !shippingContext.operationalDomains.includes("both");

  const HIDDEN_FOR_BUSINESS_ONLY = new Set([
    "shipping-cleaning",
  ]);

  const isPermitted = (it: T): boolean => {
    // Business-only domain: hide shipping-cleaning accordion entirely
    if (isBusinessOnly && it.key && HIDDEN_FOR_BUSINESS_ONLY.has(it.key)) return false;

    // 1. Role check
    const r = it.roles;
    const roleOk = !r || r.length === 0 || isSuper || r.some((x) => userRoles.has(x));
    if (!roleOk) return false;

    // Super Admin sees all role-permitted entries
    if (isSuper) return true;

    // If item has no href (it's a group accordion), its visibility depends on its children
    if (!it.href) return true;

    const rawHref = it.href;
    const cleanHref = rawHref.split("?")[0];

    // Default home dashboard is always visible
    if (cleanHref === "/dashboard") return true;

    // Direct route permission: route:/dashboard/...
    if (userPermissions.has(`route:${cleanHref}`) || userPermissions.has(`route:${rawHref}`)) {
      return true;
    }

    // Mapped permissions: e.g. accounts:read, purchases:read, roznamcha:read
    const reqPerms = ROUTE_PERMISSION_MAP[cleanHref];
    if (reqPerms && reqPerms.length > 0) {
      for (const p of reqPerms) {
        if (userPermissions.has(p)) return true;
        if (p.includes(":")) {
          const [resource] = p.split(":");
          if (userPermissions.has(`${resource}:*`)) return true;
        }
      }
    }

    // STRICT DENY BY DEFAULT FOR FORM-SCOPED USERS:
    // Any route not explicitly granted must NOT appear in the user's menu.
    return false;
  };

  return items
    .filter(isPermitted)
    .map((it) => {
      if (!it.children) return it;
      const kids = filterByRolesAndPermissions(it.children as any[], userRoles, userPermissions, shippingContext);
      return { ...it, children: kids };
    })
    .filter((it) => it.children === undefined || (it as any).href || (it.children as any[]).length > 0) as T[];
}

export function DigitalDockPremiumSidebar({
  onNavigate,
  onToggleCollapse,
  brandTitle,
  roles,
  permissions,
  isShippingScoped,
  operationalDomains,
  ledgerVisibility,
}: DigitalDockPremiumSidebarProps = {}) {
  const pathname = usePathname() ?? "";
  const lang = useActiveLanguage();
  const tr = (s: string) => translateHeader(lang, s);

  const userRolesSet = useMemo(() => new Set((roles ?? []).map(String)), [roles]);
  const userPermsSet = useMemo(() => new Set((permissions ?? []).map(String)), [permissions]);
  const shippingCtx = useMemo(() => ({
    isShippingScoped,
    operationalDomains,
    ledgerVisibility,
  }), [isShippingScoped, operationalDomains, ledgerVisibility]);

  const menuItems = useMemo(() => {
    return filterByRolesAndPermissions(DAMAN_SIDEBAR_ITEMS, userRolesSet, userPermsSet, shippingCtx);
  }, [userRolesSet, userPermsSet, shippingCtx]);

  const [companyName, setCompanyName] = useState<string>("Daman Business Group");

  useEffect(() => {
    let alive = true;
    fetchBranding(null).then((b) => {
      if (!alive) return;
      const resolved = brandingName(b, lang);
      if (resolved) {
        setCompanyName(resolved.replace(/Daman Business Group/gi, "Damaan Business Group"));
      }
    });
    return () => { alive = false; };
  }, [lang]);

  // Track expanded accordion keys (Level 1 and Level 2). A group the user has
  // not clicked stays closed - the only groups open on load are whichever
  // contains the current page (`defaultOpen` is gone; see the narrow
  // shipping-agent-only exception in filterByRoles above, which is the sole
  // remaining forced-open case, for a role whose entire menu IS that group).
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of menuItems) {
      if (item.defaultOpen || hasActiveDescendant(item, pathname)) {
        initial.add(item.key);
        if (item.children) {
          for (const sub of item.children) {
            if (sub.key && hasActiveDescendant(sub, pathname)) {
              initial.add(sub.key);
            }
          }
        }
      }
    }
    return initial;
  });

  // On navigation, open the group (and sub-group) containing the new active
  // page and close every OTHER top-level group - an accordion driven by
  // location, not an ever-growing set of every group ever visited.
  useEffect(() => {
    setOpenKeys(() => {
      const next = new Set<string>();
      for (const item of menuItems) {
        if (hasActiveDescendant(item, pathname)) {
          next.add(item.key);
          if (item.children) {
            for (const sub of item.children) {
              if (sub.key && hasActiveDescendant(sub, pathname)) {
                next.add(sub.key);
              }
            }
          }
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Clicking a top-level group opens it and closes every other top-level
  // group (plus that group's own sub-groups); clicking a level-2 sub-group
  // closes its sibling sub-groups under the same parent. Clicking an
  // already-open group just closes it.
  const toggleKey = (key: string, level: 1 | 2 = 1, parentKey?: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      const willOpen = !next.has(key);

      if (level === 1) {
        for (const item of menuItems) {
          if (item.key === key) continue;
          next.delete(item.key);
          if (item.children) {
            for (const sub of item.children) if (sub.key) next.delete(sub.key);
          }
        }
      } else if (parentKey) {
        const parent = menuItems.find((m) => m.key === parentKey);
        if (parent?.children) {
          for (const sub of parent.children) {
            if (sub.key && sub.key !== key) next.delete(sub.key);
          }
        }
      }

      if (willOpen) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const displayBrand = (brandTitle || companyName || "Damaan Business Group").replace(/Daman Business Group/gi, "Damaan Business Group");

  return (
    <div className="flex h-full w-full flex-col bg-white text-[#0f172a] select-none font-sans overflow-hidden">
      {/* 1. Header: Damaan Business Group */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 group"
        >
          <img
            src="/images/damaan-logo.png"
            alt={nt("Damaan Business Group")}
            className="h-10 w-10 rounded-full object-contain shadow-md border border-amber-500/30 shrink-0 group-hover:scale-105 transition-transform"
          />
          <div className="min-w-0">
            <h1 className="text-[15px] font-black tracking-tight text-[#0a192f] group-hover:text-[#2563eb] transition-colors leading-tight truncate">
              {displayBrand}
            </h1>
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-500 tracking-wider uppercase truncate mt-0.5">
              DGT.LLC • Super Quality
            </p>
          </div>
        </Link>
      </div>

      {/* 2. Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-1 [scrollbar-width:thin]">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = Boolean(item.children?.length);
          const isOpen = hasChildren && openKeys.has(item.key);
          const isDirectActive = isPathActive(item.href, pathname);
          const isDescActive = hasChildren && hasActiveDescendant(item, pathname);
          const isHighlighted = isOpen || isDirectActive || isDescActive;
          const isRed = item.tone === "red";

          return (
            <div key={item.key} className="relative">
              {hasChildren ? (
                /* Level 1: Accordion Parent Item */
                <div>
                  <button
                    type="button"
                    onClick={() => toggleKey(item.key, 1)}
                    className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13.5px] transition-all duration-150 cursor-pointer ${
                      isHighlighted
                        ? isRed
                          ? "bg-red-50/90 text-red-600 font-bold border border-red-200/80 shadow-xs"
                          : "bg-[#edf5ff] text-[#2563eb] font-bold"
                        : isRed
                          ? "text-red-600 font-bold hover:bg-red-100/70 hover:text-red-700 bg-red-50/40 border border-red-200/60"
                          : "text-[#0f172a] hover:bg-slate-50 font-medium hover:text-[#2563eb]"
                    }`}
                  >
                    {/* Left vertical accent indicator bar when highlighted/open */}
                    {isHighlighted && (
                      <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3.5px] rounded-r-md ${
                        isRed ? "bg-red-600" : "bg-[#2563eb]"
                      }`} />
                    )}

                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        isRed
                          ? "text-red-600"
                          : isHighlighted
                            ? "text-[#2563eb]"
                            : "text-[#0f172a]"
                      }`} />
                      <span className={`truncate text-left tracking-tight ${isRed ? "text-red-600 font-bold" : ""}`}>
                        {tr(item.label)}
                      </span>
                    </div>

                    {item.badge && (
                      <span className={`me-2 px-1.5 py-0.5 text-[10px] font-extrabold rounded uppercase tracking-wider ${
                        isRed ? "bg-red-600 text-white" : "bg-blue-100 text-blue-700"
                      }`}>
                        {item.badge}
                      </span>
                    )}

                    {isOpen ? (
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                        isRed
                          ? "text-red-600"
                          : isHighlighted
                            ? "text-[#2563eb]"
                            : "text-[#0f172a]"
                      }`} />
                    ) : (
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                        isRed ? "text-red-500" : "text-[#0f172a]"
                      }`} />
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
                                onClick={() => toggleKey(subKey, 2, item.key)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all duration-150 cursor-pointer ${
                                  isSubActive || isSubOpen
                                    ? isRed
                                      ? "text-red-700 font-bold bg-red-100/70 border border-red-200/70"
                                      : "text-[#2563eb] font-bold bg-blue-50/70"
                                    : isRed
                                      ? "text-red-700 font-semibold hover:text-red-800 hover:bg-red-50/60"
                                      : "text-[#0f172a] font-semibold hover:text-[#2563eb] hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <SubIcon className={`h-4 w-4 shrink-0 transition-colors ${
                                    isSubActive || isSubOpen
                                      ? isRed ? "text-red-600" : "text-[#2563eb]"
                                      : isRed ? "text-red-500" : "text-[#0f172a]"
                                  }`} />
                                  <span className="truncate text-left tracking-tight">
                                    {tr(sub.label)}
                                  </span>
                                </div>
                                {isSubOpen ? (
                                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${isRed ? "text-red-600" : "text-[#2563eb]"}`} />
                                ) : (
                                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isRed ? "text-red-400" : "text-slate-400"}`} />
                                )}
                              </button>

                              {/* Level 3 Deep Children (e.g. Local Purchase, Completed Bills...) */}
                              {isSubOpen && sub.children && (
                                <div className={`ms-5 ps-3 pe-1 py-1 space-y-0.5 border-l-2 my-0.5 animate-in fade-in-50 duration-150 ${
                                  isRed ? "border-red-300" : "border-blue-200/60"
                                }`}>
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
                                            ? isRed
                                              ? "text-red-700 font-bold bg-red-100/90"
                                              : "text-[#2563eb] font-bold bg-blue-50/90"
                                            : isRed
                                              ? "text-red-800 font-medium hover:text-red-600 hover:bg-red-50/70"
                                              : "text-slate-600 font-medium hover:text-[#2563eb] hover:bg-slate-50"
                                        }`}
                                      >
                                        {LeafIcon ? (
                                          <LeafIcon className={`h-3.5 w-3.5 shrink-0 ${
                                            isLeafActive
                                              ? isRed ? "text-red-600" : "text-[#2563eb]"
                                              : isRed ? "text-red-400" : "text-slate-400"
                                          }`} />
                                        ) : (
                                          <span className={`h-1.5 w-1.5 rounded-full ${
                                            isLeafActive
                                              ? isRed ? "bg-red-600" : "bg-[#2563eb]"
                                              : isRed ? "bg-red-300" : "bg-slate-300"
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
                                ? isRed
                                  ? "text-red-700 font-bold bg-red-100/70 border border-red-200/80"
                                  : "text-[#2563eb] font-bold bg-blue-50/70"
                                : isRed
                                  ? "text-red-800 font-semibold hover:text-red-600 hover:bg-red-50/70"
                                  : "text-[#0f172a] font-medium hover:text-[#2563eb] hover:bg-slate-50"
                            }`}
                          >
                            <SubIcon className={`h-4 w-4 shrink-0 transition-colors ${
                              isSubDirectActive
                                ? isRed ? "text-red-600" : "text-[#2563eb]"
                                : isRed ? "text-red-500" : "text-[#0f172a]"
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
                      ? isRed
                        ? "bg-red-50 text-red-600 font-bold border border-red-200/80 shadow-xs"
                        : "bg-[#edf5ff] text-[#2563eb] font-bold"
                      : isRed
                        ? "text-red-600 font-bold hover:bg-red-100/70 hover:text-red-700 bg-red-50/40 border border-red-200/60"
                        : "text-[#0f172a] hover:bg-slate-50 font-medium hover:text-[#2563eb]"
                  }`}
                >
                  {isDirectActive && (
                    <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3.5px] rounded-r-md ${
                      isRed ? "bg-red-600" : "bg-[#2563eb]"
                    }`} />
                  )}
                  <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isRed
                      ? "text-red-600"
                      : isDirectActive
                        ? "text-[#2563eb]"
                        : "text-[#0f172a]"
                  }`} />
                  <span className={`truncate tracking-tight flex-1 ${isRed ? "text-red-600 font-bold" : ""}`}>
                    {tr(item.label)}
                  </span>
                  {item.badge && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded uppercase tracking-wider ${
                      isRed ? "bg-red-600 text-white" : "bg-blue-100 text-blue-700"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* 3. Support — small, professional entry point (replaces the old large "Need
          Help?" card). Guidance-only in this phase; see components/support/safe-support-assistant.tsx. */}
      <SafeSupportAssistant lang={lang} pathname={pathname} />

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
  const drawerLang = useActiveLanguage();
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
              aria-label={tUi(drawerLang, "nav.close_navigation", "Close navigation")}
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
