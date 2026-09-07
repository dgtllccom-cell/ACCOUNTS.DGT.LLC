"use client";

/**
 * DigitalDockPremiumSidebar
 * -------------------------------------------------------------
 * Custom Sidebar precisely matching Daman Business Group visual specification:
 * - Pure white aesthetic with deep navy typography
 * - Dynamic accordion with blue pill background and crisp blue left indicator
 * - Sub-items indented with matching icons
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
  Container,
  FileSpreadsheet,
  FileText,
  Globe,
  Globe2,
  Headphones,
  Home,
  Landmark,
  Layers,
  ListPlus,
  Package,
  RefreshCw,
  ScanLine,
  Settings,
  ShieldCheck,
  Ship,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { fetchBranding, brandingName } from "@/lib/branding/client";

/* ---------------- Types ---------------- */
export type SidebarSubItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
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
      { label: "Branch Entry", href: "/dashboard/new-entry/branch-entry/city-branch", icon: Building2 },
      { label: "User Registration", href: "/dashboard/new-entry/users/registration", icon: Users },
      { label: "Account Setup", href: "/dashboard/accounts/setup", icon: BookOpen },
      { label: "New Ledger Account", href: "/dashboard/ledger/new", icon: BookOpen },
      { label: "Register Employee", href: "/dashboard/general-office/employees", icon: Users },
      { label: "New Entry Hub", href: "/dashboard/new-entry", icon: ListPlus },
    ],
  },
  {
    key: "ledgers",
    label: "Ledgers",
    icon: BookOpen,
    children: [
      { label: "New Ledger", href: "/dashboard/ledger/new", icon: BookOpen },
      { label: "Super Admin Detailed", href: "/dashboard/ledger/super-admin/detailed", icon: FileText },
      { label: "Country Detailed", href: "/dashboard/ledger/country/detailed", icon: FileText },
      { label: "General Report", href: "/dashboard/ledger/general-report", icon: FileText },
      { label: "Outstanding Ledgers", href: "/dashboard/ledger/outstanding", icon: FileText },
    ],
  },
  {
    key: "daily-payment",
    label: "Daily Payment Entry",
    icon: FileText,
    href: "/dashboard/roznamcha/cash-entry",
  },
  {
    key: "purchase-sales-trade",
    label: "Purchase, Sales & Trade",
    icon: ShoppingCart,
    defaultOpen: true,
    children: [
      { label: "Purchase", href: "/dashboard/purchase/new-purchase-booking-order", icon: FileText },
      { label: "Sales", href: "/dashboard/sales", icon: TrendingUp },
      { label: "Other Country Trade", href: "/dashboard/purchase/country-transfer", icon: Globe },
      { label: "Bill Cost, Expenses & Profit", href: "/dashboard/bill-cost-profit", icon: FileSpreadsheet },
    ],
  },
  {
    key: "journal-stock",
    label: "Journal Stock",
    icon: Boxes,
    children: [
      { label: "Stock Register", href: "/dashboard/inventory", icon: Package },
      { label: "Stock Reports", href: "/dashboard/inventory/stock-reports/branch", icon: BarChart3 },
      { label: "Warehouse Stock", href: "/dashboard/purchase/stock/warehouse", icon: Boxes },
      { label: "In-Transit Stock", href: "/dashboard/purchase/stock/in-transit", icon: Truck },
    ],
  },
  {
    key: "shipping-cleaning",
    label: "Shipping & Cleaning",
    icon: Ship,
    children: [
      { label: "Shipping Lines", href: "/dashboard/shipping-line", icon: Ship },
      { label: "Clearing Agents", href: "/dashboard/clearing-agent", icon: Truck },
      { label: "Logistics Tracking", href: "/dashboard/logistics", icon: Container },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: ShieldCheck,
    children: [
      { label: "Banks & Accounts", href: "/dashboard/banks", icon: Landmark },
      { label: "Money Exchange", href: "/dashboard/roznamcha/money-exchange", icon: ArrowRightLeft },
      { label: "Exchange Rates", href: "/dashboard/reports/exchange-rate", icon: RefreshCw },
      { label: "Investments", href: "/dashboard/super-admin/investments", icon: TrendingUp },
    ],
  },
  {
    key: "general-office",
    label: "General Office",
    icon: Settings,
    children: [
      { label: "Employees", href: "/dashboard/general-office/employees", icon: Users },
      { label: "Attendance & Leave", href: "/dashboard/general-office/attendance", icon: CalendarCheck },
      { label: "Payroll Runs", href: "/dashboard/general-office/payroll", icon: Banknote },
    ],
  },
  {
    key: "settlement-reconciliation",
    label: "Settlement & Reconciliation",
    icon: Layers,
    href: "/dashboard/settlement-reconciliation",
  },
  {
    key: "reports-all",
    label: "Reports and All Reporting Page",
    icon: BarChart3,
    defaultOpen: true,
    children: [
      { label: "KYC Reports", href: "/dashboard/reports/kyc", icon: FileText },
      { label: "User Tasks", href: "/dashboard/user-tasks", icon: CheckSquare },
      { label: "Reports", href: "/dashboard/reports", icon: CheckSquare },
      { label: "Document Management", href: "/dashboard/document-management", icon: FileText },
    ],
  },
  {
    key: "master-data",
    label: "Master Data",
    icon: BookOpenText,
    children: [
      { label: "Goods Master", href: "/dashboard/settings/goods-master", icon: Package },
      { label: "Product Categories", href: "/dashboard/settings/product-categories", icon: Boxes },
      { label: "Warehouses", href: "/dashboard/settings/warehouses", icon: Building2 },
      { label: "Location Workspace", href: "/dashboard/settings/locations", icon: Globe2 },
    ],
  },
  {
    key: "all-ai",
    label: "All AI Page",
    icon: Star,
    children: [
      { label: "AI Business Assistant", href: "/dashboard/ai", icon: Sparkles },
      { label: "Document Intelligence", href: "/dashboard/document-intelligence", icon: FileText },
      { label: "Smart CRM", href: "/dashboard/crm", icon: CalendarCheck },
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

  // Track expanded accordion keys. Initially include items with defaultOpen or active child
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of DAMAN_SIDEBAR_ITEMS) {
      if (item.defaultOpen) {
        initial.add(item.key);
      }
      if (item.children?.some((c) => isPathActive(c.href, pathname))) {
        initial.add(item.key);
      }
    }
    return initial;
  });

  const toggleGroup = (key: string) => {
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
          const isChildActive = hasChildren && item.children!.some((c) => isPathActive(c.href, pathname));
          const isHighlighted = isOpen || isDirectActive || isChildActive;

          return (
            <div key={item.key} className="relative">
              {hasChildren ? (
                /* Accordion Parent Item */
                <div>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.key)}
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

                  {/* Sub-items list */}
                  {isOpen && item.children && (
                    <div className="mt-1 ps-3 pe-1 space-y-0.5 animate-in fade-in-50 duration-150">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isSubActive = isPathActive(child.href, pathname);
                        return (
                          <Link
                            key={child.label + child.href}
                            href={child.href}
                            onClick={onNavigate}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                              isSubActive
                                ? "text-[#2563eb] font-bold bg-blue-50/70"
                                : "text-[#0f172a] font-medium hover:text-[#2563eb] hover:bg-slate-50"
                            }`}
                          >
                            <ChildIcon className={`h-4 w-4 shrink-0 transition-colors ${
                              isSubActive ? "text-[#2563eb]" : "text-[#0f172a]"
                            }`} />
                            <span className="truncate tracking-tight">
                              {tr(child.label)}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Standalone Direct Link Item */
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
