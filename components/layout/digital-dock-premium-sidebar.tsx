"use client";

/**
 * DigitalDockPremiumSidebar
 * -------------------------------------------------------------
 * Standalone premium left navigation menu for Digital Dock ERP.
 *
 * Pure UI component — no business logic, API calls, database access,
 * or authentication. Design-only reference (hardcoded English menu +
 * plain <a> links). To use it as the real ERP navigation it must be
 * wired to the app's nav tree, i18n labels, permissions and routing.
 *
 * Requirements: React 18+, Tailwind CSS, lucide-react.
 */
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Anchor,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Container,
  Coins,
  FileBarChart,
  FileText,
  Flag,
  Globe2,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  Menu,
  NotebookPen,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Users,
  Users2,
  Wallet,
  X,
} from "lucide-react";

/* ---------------- types ---------------- */
type NavChild = {
  label: string;
  href?: string;
  badge?: string;
  active?: boolean;
  icon?: ComponentType<{ className?: string }>;
};
type NavItem = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  badge?: string;
  active?: boolean;
  highlighted?: boolean;
  children?: NavChild[];
};
type NavGroup = { title: string; items: NavItem[] };

/* ---------------- menu data ---------------- */
export const SIDEBAR_GROUPS: NavGroup[] = [
  {
    title: "Quick Setup",
    items: [
      { icon: Users, label: "New User", href: "/dashboard/users/new" },
      { icon: Globe2, label: "New Country", href: "/dashboard/new-entry/branch-entry/country-branch" },
      { icon: Building2, label: "New Branch", href: "/dashboard/new-entry/branch-entry/city-branch" },
    ],
  },
  {
    title: "Journal & Ledger",
    items: [
      {
        icon: BookOpen,
        label: "Journal & Ledger",
        children: [
          { label: "Journal", href: "/dashboard/journal", icon: NotebookPen },
          { label: "Ledgers", href: "/dashboard/ledgers", icon: BookOpen },
        ],
      },
    ],
  },
  {
    title: "Daily Payment",
    items: [
      {
        icon: HandCoins,
        label: "Daily Payment",
        children: [
          { label: "Purchase Invoice Payment", href: "/dashboard/journal/purchase-order-payment/advance", icon: Receipt },
          { label: "Sales Invoice Payment", href: "/dashboard/sales/payment", icon: CircleDollarSign },
          { label: "Cash Payment", href: "/dashboard/cash-entry", icon: Banknote },
          { label: "Daily Cash Entry", href: "/dashboard/daily-payment-entry", icon: Wallet },
          { label: "Exchange Rate", href: "/dashboard/exchange-rates", icon: RefreshCw },
          { label: "Payment History", href: "/dashboard/journal/purchase-order-payment/history", icon: History },
        ],
      },
    ],
  },
  {
    title: "Overview",
    items: [{ icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", active: true }],
  },
  {
    title: "Purchase",
    items: [
      {
        icon: ShoppingCart,
        label: "Purchase",
        badge: "8",
        children: [
          { label: "Purchase Booking", href: "/dashboard/purchase", active: true },
          { label: "Advance Payment", href: "/dashboard/journal/purchase-order-payment/advance" },
          { label: "Remaining Payment", href: "/dashboard/journal/purchase-order-payment/remaining" },
          { label: "Credit Payment", href: "/dashboard/journal/purchase-order-payment/credit" },
          { label: "Payment History", href: "/dashboard/journal/purchase-order-payment/history" },
        ],
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        icon: CircleDollarSign,
        label: "Sales",
        children: [
          { label: "Sales Booking", href: "/dashboard/sales" },
          { label: "Sales Payment", href: "/dashboard/sales/payment" },
          { label: "Sales Reports", href: "/dashboard/sales/reports" },
        ],
      },
    ],
  },
  {
    title: "Stock & Warehouse",
    items: [
      {
        icon: Boxes,
        label: "Stock & Warehouse",
        children: [
          { label: "Stock Register", href: "/dashboard/stock", icon: Package },
          { label: "Stock Reports", href: "/dashboard/stock/reports", icon: BarChart3 },
        ],
      },
    ],
  },
  {
    title: "Shipping & Logistics",
    items: [
      {
        icon: Ship,
        label: "Shipping & Logistics",
        children: [
          { label: "Shipping Lines", href: "/dashboard/shipping-lines" },
          { label: "Clearing Agents", href: "/dashboard/clearing-agents" },
          { label: "Loading Records", href: "/dashboard/purchase-loading-records" },
          { label: "Containers", href: "/dashboard/containers", icon: Container },
        ],
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        icon: FileBarChart,
        label: "Reports",
        children: [
          { label: "Purchase Reports", href: "/dashboard/reports/purchase" },
          { label: "Sales Reports", href: "/dashboard/reports/sales" },
          { label: "Journal Reports", href: "/dashboard/reports/journal" },
          { label: "Ledger Reports", href: "/dashboard/reports/ledger" },
        ],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        icon: ShieldCheck,
        label: "Administration",
        children: [
          { label: "Users", href: "/dashboard/users", icon: Users },
          { label: "Countries", href: "/dashboard/country", icon: Globe2 },
          { label: "Branches", href: "/dashboard/branch-management", icon: Building2 },
          { label: "Exchange Rates", href: "/dashboard/exchange-rates", icon: RefreshCw },
        ],
      },
    ],
  },
  {
    title: "System & Handover",
    items: [
      { icon: FileText, label: "ERP Development & Handover Report", href: "/dashboard/reports/handover", badge: "Live" },
      { icon: Settings, label: "Settings", href: "/dashboard/settings" }
    ],
  },
];

export const QUICK_FAVOURITES = [
  { icon: ShoppingCart, label: "Purchase Booking", href: "/dashboard/purchase" },
  { icon: Wallet, label: "Daily Payment", href: "/dashboard/daily-payment-entry" },
  { icon: CircleDollarSign, label: "Exchange Rates", href: "/dashboard/exchange-rates" },
];

export const QUICK_RECENT = [
  { icon: FileText, label: "PB-2026-6789", href: "/dashboard/purchase" },
  { icon: Package, label: "Sales Invoice", href: "/dashboard/sales" },
  { icon: BookOpen, label: "Ledger — FAREDULLAH", href: "/dashboard/ledgers" },
];

/* ---------------- palette tokens ---------------- */
const colors = {
  primary: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  sidebarBg: "#FFFFFF",
  background: "#F8FAFC",
};

/* ---------------- internal components ---------------- */
function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = useState<boolean>(
    hasChildren && (!!item.active || !!item.highlighted || !!item.children?.some((c) => c.active)),
  );
  const matches = useMemo(() => {
    if (!query) return { self: true, children: item.children ?? [] };
    const q = query.toLowerCase();
    const selfMatch = item.label.toLowerCase().includes(q);
    const kids = (item.children ?? []).filter((c) => c.label.toLowerCase().includes(q));
    return { self: selfMatch || kids.length > 0, children: selfMatch ? (item.children ?? []) : kids };
  }, [query, item]);
  useEffect(() => {
    if (query && matches.children.length > 0) setOpen(true);
  }, [query, matches.children.length]);

  if (!matches.self) return null;
  const isTopActive = item.active && !hasChildren;

  if (!hasChildren) {
    return (
      <a
        href={item.href ?? "#"}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ${
          isTopActive
            ? "bg-gradient-to-r from-[#2563EB] to-indigo-500 font-semibold text-white shadow-lg shadow-[#2563EB]/25"
            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 hover:translate-x-0.5"
        }`}
      >
        <Icon className={`h-[17px] w-[17px] shrink-0 ${isTopActive ? "text-white" : "text-slate-500 group-hover:text-[#2563EB]"}`} />
        <span className="truncate">{item.label}</span>
        {item.badge && (
          <span className="ml-auto rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[9px] font-bold text-white">{item.badge}</span>
        )}
      </a>
    );
  }

  const activeChild = item.children?.some((c) => c.active);
  const highlightClass = item.highlighted
    ? "bg-gradient-to-r from-[#2563EB]/10 via-indigo-500/5 to-transparent ring-1 ring-[#2563EB]/15 text-[#1D4ED8] font-semibold"
    : "";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ${
          activeChild ? "bg-[#2563EB]/8 font-semibold text-[#2563EB]" : highlightClass || "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
        }`}
      >
        <Icon className={`h-[17px] w-[17px] shrink-0 ${item.highlighted || activeChild ? "text-[#2563EB]" : "text-slate-500 group-hover:text-[#2563EB]"}`} />
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.highlighted && (
          <span className="rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">NEW</span>
        )}
        {item.badge && (
          <span className="rounded-full bg-[#2563EB]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#2563EB]">{item.badge}</span>
        )}
        <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
      </button>
      <div className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0">
          <div className="relative ml-[19px] mt-1 space-y-0.5 border-l border-slate-200/80 pl-3">
            {matches.children.map((c) => {
              const CIcon = c.icon;
              return (
                <a
                  key={c.label}
                  href={c.href ?? "#"}
                  className={`group/child relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] transition-all duration-150 ${
                    c.active
                      ? "bg-gradient-to-r from-[#2563EB] to-indigo-500 font-semibold text-white shadow-md shadow-[#2563EB]/20"
                      : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800 hover:pl-4"
                  }`}
                >
                  {CIcon ? (
                    <CIcon className={`h-3.5 w-3.5 shrink-0 ${c.active ? "text-white" : "text-slate-400 group-hover/child:text-[#2563EB]"}`} />
                  ) : (
                    <span className={`h-1.5 w-1.5 rounded-full ${c.active ? "bg-white" : "bg-slate-300"}`} />
                  )}
                  <span className="truncate">{c.label}</span>
                  {c.badge && (
                    <span className="ml-auto rounded-full bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#F59E0B]">{c.badge}</span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((it) => {
          const I = it.icon;
          return (
            <a
              key={it.label}
              href={it.href ?? "#"}
              className="group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] text-slate-600 transition-all hover:bg-slate-100/80 hover:text-slate-900"
            >
              <I className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#2563EB]" />
              <span className="truncate">{it.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- main sidebar component ---------------- */
export interface DigitalDockPremiumSidebarProps {
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
}

export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {
  const [internalQuery, setInternalQuery] = useState("");
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = (v: string) => {
    setInternalQuery(v);
    onSearchQueryChange?.(v);
  };

  return (
    <div className="flex h-full flex-col bg-white/95 backdrop-blur-xl">
      {/* Brand — Digital Dock ERP */}
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] via-indigo-500 to-indigo-600 text-white shadow-lg shadow-[#2563EB]/30">
            <Anchor className="h-5 w-5" strokeWidth={2.4} />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#10B981]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-extrabold tracking-tight text-slate-900">DIGITAL DOCK ERP</div>
            <div className="truncate text-[10px] font-medium text-slate-500">Enterprise Management System</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-gradient-to-r from-[#10B981]/8 to-transparent px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
            </span>
            <span className="text-[10.5px] font-semibold text-[#059669]">Online</span>
          </div>
          <span className="text-[9.5px] font-medium text-slate-400">v2.6.1</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu…"
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-8 text-[12.5px] text-slate-700 placeholder:text-slate-400 outline-none transition-all focus:border-[#2563EB]/40 focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">⌘K</kbd>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 [scrollbar-width:thin]">
        {!query && (
          <>
            <QuickList title="Favourites" icon={Star} items={QUICK_FAVOURITES} />
            <QuickList title="Recent" icon={Clock} items={QUICK_RECENT} />
          </>
        )}
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.title}</div>
            <div className="space-y-1">
              {group.items.map((it) => (
                <SidebarNavItem key={it.label} item={it} query={query} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — user + status glass card */}
      <div className="border-t border-slate-100 p-3">
        <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-white/80 to-slate-50/80 p-3 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-indigo-600 text-[12px] font-bold text-white shadow-md shadow-[#2563EB]/25">A</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-slate-800">ADMIN</div>
              <div className="truncate text-[10px] text-slate-500">Super Admin · AL.RAS</div>
            </div>
            <button className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
            </span>
            <span className="text-[10px] font-medium text-slate-500">All systems operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- responsive drawer wrapper ---------------- */
export interface DigitalDockPremiumSidebarWithDrawerProps extends DigitalDockPremiumSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DigitalDockPremiumSidebarWithDrawer({ open, onOpenChange, ...sidebarProps }: DigitalDockPremiumSidebarWithDrawerProps) {
  return (
    <>
      <button onClick={() => onOpenChange(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Open navigation">
        <Menu className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={() => onOpenChange(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-200">
            <button onClick={() => onOpenChange(false)} className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close navigation">
              <X className="h-4 w-4" />
            </button>
            <DigitalDockPremiumSidebar {...sidebarProps} />
          </aside>
        </div>
      )}
    </>
  );
}

export default DigitalDockPremiumSidebar;

// Re-export palette tokens for convenience when building matching UI elsewhere.
export const digitalDockPalette = colors;
