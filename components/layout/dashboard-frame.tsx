"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { 
  ArrowLeftRight,
  BadgePercent,
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  Compass,
  CreditCard,
  FileSpreadsheet,
  Globe,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  PlusCircle,
  Receipt,
  Repeat,
  Search,
  Shield,
  ShieldCheck,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { SidebarMenuVisibilityMap, SidebarNode } from "@/lib/navigation/sidebar";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { filterSidebarTree } from "@/lib/navigation/sidebar";
import { enterpriseRoles, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PremiumSidebarNav } from "@/components/layout/premium-sidebar-nav";
import { PreferencesControls } from "@/components/layout/preferences-controls";
import { ErpPageActions } from "@/components/layout/erp-page-actions";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function DashboardFrame({
  children,
  nodes,
  lang,
  roles,
  permissions,
  userEmail,
  userName
}: {
  children: React.ReactNode;
  nodes: SidebarNode[];
  lang: SupportedLanguage;
  roles: EnterpriseRole[] | null;
  permissions?: string[] | null;
  userEmail: string;
  userName?: string | null;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const isWizardPath = useMemo(() => {
    return pathname === "/dashboard/purchase/new-purchase-booking-order" ||
           pathname === "/dashboard/purchase/purchase-confirm";
  }, [pathname]);

  useEffect(() => {
    setDrawerOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (drawerOpen || mobileOpen)) {
        setDrawerOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, mobileOpen]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("All");
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [searchingDb, setSearchingDb] = useState(false);

  // Date Filter Dropdown State
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const dateMenuRef = useRef<HTMLDivElement>(null);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarMenuVisibility, setSidebarMenuVisibility] = useState<SidebarMenuVisibilityMap | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const sidebarDefaultVisibility: SidebarMenuVisibilityMap = {
    menu_purchase_stock_section: false
  };

  function resolveMenuRoleScope(): "super_admin" | "country_admin" | "branch_admin" | "agent_user" | null {
    if (!roles || roles.length === 0) return null;
    if (roles.includes("super_admin")) return "super_admin";
    if (roles.includes("country_admin") || roles.includes("country_user")) return "country_admin";
    if (roles.includes("main_branch_admin") || roles.includes("city_branch_admin") || roles.includes("accountant") || roles.includes("cashier")) {
      return "branch_admin";
    }
    if (roles.includes("agent_user")) return "agent_user";
    return "branch_admin";
  }

  useEffect(() => {
    function handleChunkError(event: PromiseRejectionEvent | ErrorEvent) {
      const reason = "reason" in event ? event.reason : (event as ErrorEvent).error;
      const msg = String(reason?.message || reason || "");
      const isChunkError =
        reason?.name === "ChunkLoadError" ||
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("failed to fetch") ||
        msg.includes("Failed to fetch dynamically imported module");

      if (isChunkError) {
        const countKey = "erp_auto_chunk_cnt";
        const tsKey = "erp_auto_chunk_ts";
        const now = Date.now();
        const lastTs = parseInt(sessionStorage.getItem(tsKey) || "0", 10);
        let count = parseInt(sessionStorage.getItem(countKey) || "0", 10);

        if (now - lastTs > 15000) count = 0;

        if (count < 3) {
          sessionStorage.setItem(countKey, String(count + 1));
          sessionStorage.setItem(tsKey, String(now));
          if (window.isSecureContext && "serviceWorker" in navigator) {
            navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
          }
          if ("caches" in window) {
            caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
          }
          let targetRoute: string | null = null;
          try {
            const match = msg.match(/_next\/static\/chunks\/app(\/[^.\?]+?)(?:\/page|\/layout|\/route|-[a-f0-9]+|\.js)/i);
            if (match && match[1]) targetRoute = match[1];
          } catch (e) {}
          const dest = targetRoute || window.location.pathname;
          window.location.replace(dest + (dest.includes("?") ? "&" : "?") + "_v=" + now);
        }
      }
    }

    window.addEventListener("unhandledrejection", handleChunkError);
    window.addEventListener("error", handleChunkError);

    const resetTimer = setTimeout(() => {
      try {
        sessionStorage.removeItem("erp_auto_chunk_cnt");
        sessionStorage.removeItem("erp_auto_chunk_ts");
      } catch {}
    }, 3000);

    return () => {
      clearTimeout(resetTimer);
      window.removeEventListener("unhandledrejection", handleChunkError);
      window.removeEventListener("error", handleChunkError);
    };
  }, []);

  useEffect(() => {
    const scopeKey = resolveMenuRoleScope();
    if (!scopeKey) {
      setSidebarMenuVisibility(null);
      return;
    }

    let cancelled = false;
    async function loadMenuVisibility() {
      let allotments: any = null;

      try {
        const res = await fetch("/api/erp/admin/dashboard-settings", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        allotments = json?.data?.allotments ?? null;
      } catch {
        allotments = null;
      }

      if (!allotments && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("erp_dashboard_allotments_v2");
          allotments = raw ? JSON.parse(raw) : null;
        } catch {
          allotments = null;
        }
      }

      const visibility = {
        ...sidebarDefaultVisibility,
        ...(scopeKey && allotments?.[scopeKey] ? allotments[scopeKey] : {})
      };
      if (!cancelled) setSidebarMenuVisibility(visibility);
    }

    void loadMenuVisibility();
    return () => {
      cancelled = true;
    };
  }, [roles]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setDbResults([]);
      return;
    }

    setSearchingDb(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/erp/search?q=${encodeURIComponent(query)}`);
        const payload = await res.json();
        if (payload?.ok && payload?.data?.results) {
          setDbResults(payload.data.results);
        } else {
          setDbResults([]);
        }
      } catch (err) {
        console.error("Global search error:", err);
        setDbResults([]);
      } finally {
        setSearchingDb(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) {
        setDateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredNodes = useMemo(
    () => filterSidebarTree(nodes, roles, permissions ?? null, sidebarMenuVisibility),
    [nodes, roles, permissions, sidebarMenuVisibility]
  );
  const roleLabel = useMemo(() => {
    if (!roles || roles.length === 0) return null;

    const labels: Record<EnterpriseRole, string> = {
      super_admin: t(lang, "role.super_admin", "Super Admin"),
      country_admin: t(lang, "role.country_admin", "Country Admin"),
      country_user: t(lang, "role.country_user", "Country User"),
      main_branch_admin: t(lang, "role.main_branch_admin", "Main Branch Admin"),
      city_branch_admin: t(lang, "role.city_branch_admin", "City Branch Admin"),
      accountant: t(lang, "role.accountant", "Accountant"),
      cashier: t(lang, "role.cashier", "Cashier"),
      agent_user: t(lang, "role.agent_user", "Agent User"),
      staff_user: t(lang, "role.staff_user", "Staff User"),
      auditor_viewer: t(lang, "role.auditor_viewer", "Auditor / Viewer")
    };

    for (const role of enterpriseRoles) {
      if (roles.includes(role)) return labels[role];
    }

    return labels[roles[0]] ?? null;
  }, [roles, lang]);

  const searchItems = useMemo(() => {
    return [
      { title: "Dashboard Overview", titleKey: "cmd.dashboard_overview", category: "Navigation" as const, href: "/dashboard", keywords: "home main landing dashboard overview", icon: LayoutDashboard, tone: "indigo" as const },
      { title: "Super Admin Dashboard", titleKey: "cmd.super_admin_dashboard", category: "Navigation" as const, href: "/dashboard/super-admin", keywords: "super admin dashboard summary stats", icon: ShieldCheck, tone: "emerald" as const },
      { title: "Country Admin Dashboard", titleKey: "cmd.country_admin_dashboard", category: "Navigation" as const, href: "/dashboard/country", keywords: "country admin dashboard summary stats", icon: Globe, tone: "sky" as const },
      { title: "City Branch Dashboard", titleKey: "cmd.city_branch_dashboard", category: "Navigation" as const, href: "/dashboard/city", keywords: "city branch dashboard summary stats", icon: Building2, tone: "amber" as const },
      { title: "Customers Directory List", titleKey: "cmd.customers_directory", category: "Modules" as const, href: "/dashboard/settings/customers", keywords: "customers directory clients list accounts", icon: Users, tone: "blue" as const },
      { title: "Add New Customer Profile", titleKey: "cmd.add_customer", category: "Actions" as const, href: "/dashboard/settings/customers/setup", keywords: "create add new customer account client profile", icon: UserPlus, tone: "emerald" as const },
      { title: "Country Branch Setup", titleKey: "cmd.country_branch_setup", category: "Modules" as const, href: "/dashboard/new-entry/branch-entry/country-branch", keywords: "country branch office setup creation edit", icon: MapPin, tone: "sky" as const },
      { title: "City Branch Setup", titleKey: "cmd.city_branch_setup", category: "Modules" as const, href: "/dashboard/new-entry/branch-entry/city-branch", keywords: "city branch office setup creation edit", icon: Building, tone: "violet" as const },
      { title: "Super Admin Branch Registry", titleKey: "cmd.super_admin_branch_registry", category: "Modules" as const, href: "/dashboard/new-entry/branches/super-admin", keywords: "super admin branch registry setup", icon: Shield, tone: "indigo" as const },
      { title: "User Registration / Management", titleKey: "cmd.user_registration", category: "Modules" as const, href: "/dashboard/new-entry/users/registration", keywords: "register user employee create edit staff role assignment", icon: UserCheck, tone: "purple" as const },
      { title: "User Journal Log Report", titleKey: "cmd.user_journal_log", category: "Modules" as const, href: "/dashboard/new-entry/users/journal-report", keywords: "user journal log activity report auditing", icon: History, tone: "slate" as const },
      { title: "Daily Exchange Rate Manager", titleKey: "cmd.daily_exchange_rate", category: "Modules" as const, href: "/dashboard/reports/exchange-rate", keywords: "daily exchange rate usd foreign currency update converter settings", icon: Coins, tone: "amber" as const },
      { title: "Credit & Debit Entries (Cash Entry)", titleKey: "cmd.cash_entry", category: "Modules" as const, href: "/dashboard/roznamcha/cash-entry", keywords: "cash entry debit credit roznamcha entries post transaction", icon: ArrowLeftRight, tone: "emerald" as const },
      { title: "Expenses Bill (Bill Entry)", titleKey: "cmd.expenses_bill", category: "Modules" as const, href: "/dashboard/roznamcha/expenses-bill", keywords: "expenses bill entry roznamcha tax invoice", icon: Receipt, tone: "rose" as const },
      { title: "Money Changer (Currency Exchange)", titleKey: "cmd.money_changer", category: "Modules" as const, href: "/dashboard/roznamcha/money-exchange", keywords: "money changer currency exchange buy sell profit loss roznamcha", icon: Repeat, tone: "cyan" as const },
      { title: "Roznamcha All Report Ledger", titleKey: "cmd.roznamcha_all", category: "Modules" as const, href: "/dashboard/roznamcha/all", keywords: "roznamcha all report transaction logs ledger postings", icon: BookOpen, tone: "indigo" as const },
      { title: "Accounts Master General Report", titleKey: "cmd.accounts_master", category: "Modules" as const, href: "/dashboard/accounts", keywords: "accounts master general report setup balance", icon: CreditCard, tone: "blue" as const },
      { title: "Create New Account Item", titleKey: "cmd.create_account", category: "Actions" as const, href: "/dashboard/accounts/setup", keywords: "create add account category chart of accounts asset liability equity", icon: PlusCircle, tone: "emerald" as const },
      { title: "Ledger Statement General Report", titleKey: "cmd.ledger_statement", category: "Modules" as const, href: "/dashboard/ledger/general-report", keywords: "ledger general statement report balance credit debit logs", icon: FileSpreadsheet, tone: "sky" as const },
      { title: "Master Forms Directory & Audit Report", titleKey: "cmd.forms_directory" as any, category: "Modules" as const, href: "/dashboard/reports/system-forms-directory", keywords: "forms directory all forms menu catalog report audit timeline pdf download", icon: BookOpen, tone: "indigo" as const },
      { title: "Transit Entry & Public Report", titleKey: "cmd.transit_entry", category: "Modules" as const, href: "/dashboard/clearing-agent/transit-entry", keywords: "transit entry public report cargo customs border serial invoice python", icon: Truck, tone: "blue" as const },
      { title: "Purchase Order Advance Payment", titleKey: "cmd.po_advance_payment", category: "Modules" as const, href: "/dashboard/journal/purchase-order-payment/advance", keywords: "purchase order advance payment entries history", icon: BadgePercent, tone: "amber" as const },
      { title: "Purchase Order Remaining Payment", titleKey: "cmd.po_remaining_payment", category: "Modules" as const, href: "/dashboard/journal/purchase-order-payment/remaining", keywords: "purchase order remaining payment balance entries history", icon: CheckCircle2, tone: "emerald" as const },
      { title: "Settings - Location Nodes Setup", titleKey: "cmd.settings_location", category: "Settings" as const, href: "/dashboard/settings/location", keywords: "settings location setup country state city area", icon: Compass, tone: "slate" as const },
      { title: "Settings - Enterprise Company Profile", titleKey: "cmd.settings_company", category: "Settings" as const, href: "/dashboard/settings/company", keywords: "settings company setup legal profile tax registry", icon: Briefcase, tone: "slate" as const }
    ];
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredSearchItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchItems;
    return searchItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [searchQuery, searchItems]);

  const categories = ["All", "Navigation", "Modules", "Actions", "Settings"] as const;

  const navigationItems = useMemo(() => filteredSearchItems.filter(i => i.category === "Navigation"), [filteredSearchItems]);
  const moduleItems = useMemo(() => filteredSearchItems.filter(i => i.category === "Modules"), [filteredSearchItems]);
  const actionItems = useMemo(() => filteredSearchItems.filter(i => i.category === "Actions"), [filteredSearchItems]);
  const settingItems = useMemo(() => filteredSearchItems.filter(i => i.category === "Settings"), [filteredSearchItems]);

  const onSelectLink = (href: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setDbResults([]);
    router.push(href);
  };

  function getDateFilterLabel(filter: string): string {
    const currentYear = new Date().getFullYear();
    switch (filter) {
      case "today":
        return t(lang, "ledger.preset_today", "Today");
      case "week":
        return t(lang, "ledger.preset_this_week", "This Week");
      case "month":
        return t(lang, "ledger.preset_this_month", "This Month");
      case "year":
        return `This Year (${currentYear})`;
      case "custom":
        return t(lang, "ledger.preset_custom", "Custom Date Range");
      case "all":
      default:
        return `${t(lang, "nav.all_dates", "All Dates")} (${currentYear})`;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {(drawerOpen || mobileOpen) && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in cursor-pointer border-none p-0 outline-none"
            aria-label={t(lang, "nav.close_navigation", "Close navigation")}
            onClick={() => {
              setDrawerOpen(false);
              setMobileOpen(false);
            }}
          />
          <aside className="relative z-50 h-full w-72 max-w-[85vw] border-r border-border bg-white dark:bg-slate-950 shadow-2xl flex flex-col animate-in slide-in-from-left duration-250 text-card-foreground">
            <div className="border-b border-border/80 px-5 py-4 flex items-center justify-between gap-2 bg-muted/20">
              <Link href="/dashboard" className="block flex-1 min-w-0" onClick={() => { setDrawerOpen(false); setMobileOpen(false); }}>
                <div className="flex items-center gap-3">
                  <img src="/icons/digital-dock-icon.svg" alt="DAMAAN" className="h-8 w-8 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black tracking-tight text-foreground leading-tight truncate">DAMAAN BUSINESS GROUP</p>
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                      Owner: Asmat Abdullah
                    </p>
                  </div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setDrawerOpen(false); setMobileOpen(false); }}
                className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg cursor-pointer"
                aria-label={t(lang, "nav.close_navigation", "Close navigation")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 bg-white dark:bg-slate-950">
              <PremiumSidebarNav nodes={filteredNodes} lang={lang} onNavigate={() => { setDrawerOpen(false); setMobileOpen(false); }} />
            </div>
            <div className="border-t border-border/80 p-3.5 bg-white dark:bg-slate-950">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200/80 dark:border-slate-800">
                <p className="text-[11px] font-bold text-foreground/90 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t(lang, "nav.erp_core_engine", "ERP Core Engine")}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  {t(lang, "nav.erp_core_engine_subtitle", "Multi-country branches, accounts & exchange matrices are active.")}
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="transition-all duration-300 min-h-screen flex flex-col w-full">
        <header className="erp-topbar sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
          <div className={cn("flex items-center gap-2 sm:gap-4 px-3 sm:px-4 lg:px-6 transition-all duration-200 justify-between", isWizardPath ? "h-16" : "h-14")}>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-lg border-border hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                onClick={() => setDrawerOpen((prev) => !prev)}
                aria-label={t(lang, "nav.open_navigation", "Open navigation")}
              >
                <Menu className="h-4 w-4" aria-hidden />
              </Button>

              <h2 className="text-base font-bold text-foreground hidden sm:block">{t(lang, "nav.dashboard", "Dashboard")}</h2>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 sm:px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                aria-label={t(lang, "nav.search", "Search")}
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="erp-search-label font-semibold text-foreground/80 hidden sm:inline">{t(lang, "nav.search_and_filter", "Search & Filter")}</span>
                <kbd className="erp-search-kbd pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 md:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>

              <div className="relative hidden lg:block" ref={dateMenuRef}>
                <button
                  type="button"
                  onClick={() => setDateMenuOpen(!dateMenuOpen)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/80 transition-colors cursor-pointer"
                  title={t(lang, "nav.filter_by_date_range", "Filter by date range")}
                >
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold">{getDateFilterLabel(selectedDateFilter)}</span>
                  <ChevronDown className={cn("h-3 w-3 text-slate-500 transition-transform duration-200", dateMenuOpen ? "rotate-180" : "")} />
                </button>

                {dateMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-50 p-1.5 font-sans">
                    <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/80 mb-1 flex items-center justify-between">
                      <span>{t(lang, "nav.filter_by_date_range", "Filter by date range")}</span>
                      <span className="font-mono text-[9px] text-primary">{new Date().getFullYear()}</span>
                    </div>

                    {[
                      { id: "all", label: `${t(lang, "nav.all_dates", "All Dates")} (${new Date().getFullYear()})` },
                      { id: "today", label: t(lang, "ledger.preset_today", "Today") },
                      { id: "week", label: t(lang, "ledger.preset_this_week", "This Week") },
                      { id: "month", label: t(lang, "ledger.preset_this_month", "This Month") },
                      { id: "year", label: `This Year (${new Date().getFullYear()})` },
                      { id: "custom", label: t(lang, "ledger.preset_custom", "Custom Date Range") }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSelectedDateFilter(opt.id);
                          if (opt.id !== "custom") {
                            setDateMenuOpen(false);
                          }
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors text-left cursor-pointer",
                          selectedDateFilter === opt.id
                            ? "bg-primary/10 text-primary font-bold"
                            : "hover:bg-muted text-foreground/80"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {opt.label}
                        </span>
                        {selectedDateFilter === opt.id && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                      </button>
                    ))}

                    {selectedDateFilter === "custom" && (
                      <div className="mt-2 pt-2 border-t border-border/80 px-2 pb-1">
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <label className="text-muted-foreground font-bold block mb-1">From</label>
                            <input
                              type="date"
                              value={customDateFrom}
                              onChange={(e) => setCustomDateFrom(e.target.value)}
                              className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="text-muted-foreground font-bold block mb-1">To</label>
                            <input
                              type="date"
                              value={customDateTo}
                              onChange={(e) => setCustomDateTo(e.target.value)}
                              className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDateMenuOpen(false)}
                          className="mt-2 w-full rounded bg-primary text-primary-foreground py-1 text-xs font-bold hover:bg-primary/90 transition-colors"
                        >
                          Apply Filter
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="relative p-1.5 rounded-full hover:bg-muted text-muted-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-red-500" />
              </button>

              <div className="h-8 w-px bg-border hidden sm:block" />

              <div className="flex items-center gap-3 relative" ref={profileMenuRef}>
                <PreferencesControls />
                <button 
                  type="button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className={cn("hidden text-start text-xs sm:flex items-center gap-2.5 hover:bg-muted/50 p-1.5 rounded-lg transition-colors cursor-pointer focus:outline-none")}
                >
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-sm">
                    {userName ? userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : "SA"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground leading-none">{userName || t(lang, "role.super_admin", "Super Admin")}</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{roleLabel || t(lang, "nav.administrator", "Administrator")}</p>
                  </div>
                </button>

              {profileMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-50">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <p className="font-bold text-sm text-foreground">{userName || t(lang, "common.user", "User")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                  </div>

                  <div className="p-4 border-b border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">{t(lang, "nav.assigned_permissions", "Assigned Permissions")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {roles?.map((r, i) => (
                        <span key={i} className="inline-flex items-center rounded bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                          {t(lang, `role.${r}` as const, r.replace(/_/g, ' '))}
                        </span>
                      ))}
                      {(!roles || roles.length === 0) && (
                        <span className="text-xs text-slate-500 italic">{t(lang, "nav.no_role_assigned", "No specific role assigned")}</span>
                      )}
                    </div>
                  </div>

                  <div className="p-2 flex flex-col gap-1">
                    {[
                      ["/dashboard/settings/profile", t(lang, "nav.my_profile", "My Profile"), "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"],
                      ["/dashboard/settings/profile?mode=edit", t(lang, "nav.edit_profile", "Edit Profile"), "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400"],
                      ["/dashboard/settings/profile?panel=password", t(lang, "nav.change_password", "Change Password"), "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"],
                      ["/dashboard/settings/profile?panel=email", t(lang, "nav.change_email", "Change Email"), "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"],
                    ].map(([href, label, tone], i) => (
                      <Link
                        key={i}
                        href={href as any}
                        onClick={() => setProfileMenuOpen(false)}
                        className="px-3 py-2 text-xs font-semibold rounded-lg hover:bg-muted text-foreground flex items-center justify-between transition-colors"
                      >
                        <span>{label}</span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", tone)}>Access</span>
                      </Link>
                    ))}
                  </div>

                  <div className="p-2 border-t border-border bg-muted/10">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        fetch("/api/erp/auth/logout", { method: "POST" }).then(() => {
                          window.location.href = "/";
                        });
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center gap-3 transition-colors"
                    >
                      {t(lang, "nav.log_out", "Log Out")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </header>

        <main className="w-full flex-1 p-4 lg:p-6 bg-background">
          <ErpPageActions />
          {children}
        </main>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput
          placeholder={t(lang, "nav.type_to_search", "Type to search modules, reports or actions...")}
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/70 bg-muted/20 overflow-x-auto text-[10px]">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategoryTab(cat)}
              className={cn(
                "px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer",
                selectedCategoryTab === cat
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {cat === "All" ? "All Categories" : t(lang, `cmd.cat_${cat.toLowerCase()}` as any, cat)}
            </button>
          ))}
        </div>

        <CommandList className="max-h-[380px] overflow-y-auto">
          {searchingDb ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3 shrink-0" />
              {t(lang, "nav.searching_database", "Searching database...")}
            </div>
          ) : (
            <CommandEmpty>{t(lang, "nav.no_matching_results", "No matching modules, actions or records found.")}</CommandEmpty>
          )}

          {!searchingDb && (selectedCategoryTab === "All" || selectedCategoryTab === "Navigation") && navigationItems.length > 0 && (
            <CommandGroup heading={t(lang, "cmd.cat_navigation", "Navigation")}>
              {navigationItems.map((item, idx) => (
                <CommandItem
                  key={`nav-${idx}`}
                  value={item.title + " " + item.keywords}
                  onSelect={() => onSelectLink(item.href)}
                  className="flex items-center justify-between py-2 cursor-pointer rounded-lg px-2 hover:bg-accent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs shadow-xs",
                      item.tone === "indigo" && "bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/40 dark:text-indigo-400",
                      item.tone === "emerald" && "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900/40 dark:text-emerald-400",
                      item.tone === "sky" && "bg-sky-50 border-sky-100 text-sky-600 dark:bg-sky-950/40 dark:border-sky-900/40 dark:text-sky-400",
                      item.tone === "amber" && "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/40 dark:border-amber-900/40 dark:text-amber-400"
                    )}>
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{t(lang, item.titleKey as any, item.title)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{item.href}</p>
                    </div>
                  </div>
                  <span className="shrink-0 ml-2 rounded bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200/60 dark:ring-indigo-800">
                    Navigation
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!searchingDb && (selectedCategoryTab === "All" || selectedCategoryTab === "Modules") && moduleItems.length > 0 && (
            <CommandGroup heading={t(lang, "cmd.cat_modules", "Modules & Reports")}>
              {moduleItems.map((item, idx) => (
                <CommandItem
                  key={`mod-${idx}`}
                  value={item.title + " " + item.keywords}
                  onSelect={() => onSelectLink(item.href)}
                  className="flex items-center justify-between py-2 cursor-pointer rounded-lg px-2 hover:bg-accent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs shadow-xs",
                      item.tone === "blue" && "bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-950/40 dark:border-blue-900/40 dark:text-blue-400",
                      item.tone === "sky" && "bg-sky-50 border-sky-100 text-sky-600 dark:bg-sky-950/40 dark:border-sky-900/40 dark:text-sky-400",
                      item.tone === "violet" && "bg-violet-50 border-violet-100 text-violet-600 dark:bg-violet-950/40 dark:border-violet-900/40 dark:text-violet-400",
                      item.tone === "indigo" && "bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/40 dark:text-indigo-400",
                      item.tone === "purple" && "bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-950/40 dark:border-purple-900/40 dark:text-purple-400",
                      item.tone === "slate" && "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
                      item.tone === "amber" && "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/40 dark:border-amber-900/40 dark:text-amber-400",
                      item.tone === "emerald" && "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900/40 dark:text-emerald-400",
                      item.tone === "rose" && "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900/40 dark:text-rose-400",
                      item.tone === "cyan" && "bg-cyan-50 border-cyan-100 text-cyan-600 dark:bg-cyan-950/40 dark:border-cyan-900/40 dark:text-cyan-400"
                    )}>
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{t(lang, item.titleKey as any, item.title)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{item.href}</p>
                    </div>
                  </div>
                  <span className="shrink-0 ml-2 rounded bg-sky-50 dark:bg-sky-950/50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-sky-700 dark:text-sky-300 ring-1 ring-sky-200/60 dark:ring-sky-800">
                    Module
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!searchingDb && (selectedCategoryTab === "All" || selectedCategoryTab === "Actions") && actionItems.length > 0 && (
            <CommandGroup heading={t(lang, "cmd.cat_actions", "Quick Actions")}>
              {actionItems.map((item, idx) => (
                <CommandItem
                  key={`act-${idx}`}
                  value={item.title + " " + item.keywords}
                  onSelect={() => onSelectLink(item.href)}
                  className="flex items-center justify-between py-2 cursor-pointer rounded-lg px-2 hover:bg-accent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs shadow-xs bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900/40 dark:text-emerald-400">
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{t(lang, item.titleKey as any, item.title)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{item.href}</p>
                    </div>
                  </div>
                  <span className="shrink-0 ml-2 rounded bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/60 dark:ring-emerald-800">
                    Action
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!searchingDb && (selectedCategoryTab === "All" || selectedCategoryTab === "Settings") && settingItems.length > 0 && (
            <CommandGroup heading={t(lang, "cmd.cat_settings", "Settings & Configuration")}>
              {settingItems.map((item, idx) => (
                <CommandItem
                  key={`set-${idx}`}
                  value={item.title + " " + item.keywords}
                  onSelect={() => onSelectLink(item.href)}
                  className="flex items-center justify-between py-2 cursor-pointer rounded-lg px-2 hover:bg-accent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs shadow-xs bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{t(lang, item.titleKey as any, item.title)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{item.href}</p>
                    </div>
                  </div>
                  <span className="shrink-0 ml-2 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-700 dark:text-slate-300 ring-1 ring-slate-200/60 dark:ring-slate-700">
                    Settings
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!searchingDb && dbResults.length > 0 && (
            <CommandGroup heading={t(lang, "nav.database_records", "Database Records")}>
              {dbResults.map((item, idx) => (
                <CommandItem
                  key={`db-${idx}`}
                  value={item.title + " " + item.subtitle}
                  onSelect={() => onSelectLink(item.link)}
                  className="flex items-center gap-3 py-2 cursor-pointer rounded-lg px-2 hover:bg-accent"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-bold bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-950/30 dark:border-blue-900/30 dark:text-blue-400 uppercase">
                    {item.entityType.substring(0, 3)}
                  </span>
                  <div>
                    <p className="text-xs font-bold">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.subtitle} {item.matchedField ? `(Matched: ${item.matchedField})` : ""}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
