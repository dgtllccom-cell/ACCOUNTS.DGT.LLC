"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
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
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [searchingDb, setSearchingDb] = useState(false);
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

    // Reset auto-chunk retry count after 3s of stable page execution
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
        ...(allotments?.[scopeKey] || {})
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

  // Command palette search database
  const searchItems = useMemo(() => {
    return [
      { title: "Dashboard Overview", titleKey: "cmd.dashboard_overview", category: "Navigation", href: "/dashboard", keywords: "home main landing dashboard overview" },
      { title: "Super Admin Dashboard", titleKey: "cmd.super_admin_dashboard", category: "Navigation", href: "/dashboard/super-admin", keywords: "super admin dashboard summary stats" },
      { title: "Country Admin Dashboard", titleKey: "cmd.country_admin_dashboard", category: "Navigation", href: "/dashboard/country", keywords: "country admin dashboard summary stats" },
      { title: "City Branch Dashboard", titleKey: "cmd.city_branch_dashboard", category: "Navigation", href: "/dashboard/city", keywords: "city branch dashboard summary stats" },

      { title: "Customers Directory List", titleKey: "cmd.customers_directory", category: "Modules", href: "/dashboard/settings/customers", keywords: "customers directory clients list accounts" },
      { title: "Add New Customer Profile", titleKey: "cmd.add_customer", category: "Actions", href: "/dashboard/settings/customers/setup", keywords: "create add new customer account client profile" },

      { title: "Country Branch Setup", titleKey: "cmd.country_branch_setup", category: "Modules", href: "/dashboard/new-entry/branch-entry/country-branch", keywords: "country branch office setup creation edit" },
      { title: "City Branch Setup", titleKey: "cmd.city_branch_setup", category: "Modules", href: "/dashboard/new-entry/branch-entry/city-branch", keywords: "city branch office setup creation edit" },
      { title: "Super Admin Branch Registry", titleKey: "cmd.super_admin_branch_registry", category: "Modules", href: "/dashboard/new-entry/branches/super-admin", keywords: "super admin branch registry setup" },

      { title: "User Registration / Management", titleKey: "cmd.user_registration", category: "Modules", href: "/dashboard/new-entry/users/registration", keywords: "register user employee create edit staff role assignment" },
      { title: "User Journal Log Report", titleKey: "cmd.user_journal_log", category: "Modules", href: "/dashboard/new-entry/users/journal-report", keywords: "user journal log activity report auditing" },

      { title: "Daily Exchange Rate Manager", titleKey: "cmd.daily_exchange_rate", category: "Modules", href: "/dashboard/reports/exchange-rate", keywords: "daily exchange rate usd foreign currency update converter settings" },
      { title: "Credit & Debit Entries (Cash Entry)", titleKey: "cmd.cash_entry", category: "Modules", href: "/dashboard/roznamcha/cash-entry", keywords: "cash entry debit credit roznamcha entries post transaction" },
      { title: "Expenses Bill (Bill Entry)", titleKey: "cmd.expenses_bill", category: "Modules", href: "/dashboard/roznamcha/expenses-bill", keywords: "expenses bill entry roznamcha tax invoice" },
      { title: "Money Changer (Currency Exchange)", titleKey: "cmd.money_changer", category: "Modules", href: "/dashboard/roznamcha/money-exchange", keywords: "money changer currency exchange buy sell profit loss roznamcha" },
      { title: "Roznamcha All Report Ledger", titleKey: "cmd.roznamcha_all", category: "Modules", href: "/dashboard/roznamcha/all", keywords: "roznamcha all report transaction logs ledger postings" },

      { title: "Accounts Master General Report", titleKey: "cmd.accounts_master", category: "Modules", href: "/dashboard/accounts", keywords: "accounts master general report setup balance" },
      { title: "Create New Account Item", titleKey: "cmd.create_account", category: "Actions", href: "/dashboard/accounts/setup", keywords: "create add account category chart of accounts asset liability equity" },
      { title: "Ledger Statement General Report", titleKey: "cmd.ledger_statement", category: "Modules", href: "/dashboard/ledger/general-report", keywords: "ledger general statement report balance credit debit logs" },

      { title: "Purchase Order Advance Payment", titleKey: "cmd.po_advance_payment", category: "Modules", href: "/dashboard/journal/purchase-order-payment/advance", keywords: "purchase order advance payment entries history" },
      { title: "Purchase Order Remaining Payment", titleKey: "cmd.po_remaining_payment", category: "Modules", href: "/dashboard/journal/purchase-order-payment/remaining", keywords: "purchase order remaining payment balance entries history" },

      { title: "Settings - Location Nodes Setup", titleKey: "cmd.settings_location", category: "Settings", href: "/dashboard/settings/location", keywords: "settings location setup country state city area" },
      { title: "Settings - Enterprise Company Profile", titleKey: "cmd.settings_company", category: "Settings", href: "/dashboard/settings/company", keywords: "settings company setup legal profile tax registry" }
    ];
  }, []);

  // Keyboard shortcut listener for Ctrl+K
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
    if (!q) return searchItems.slice(0, 7);
    return searchItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [searchQuery, searchItems]);

  const onSelectLink = (href: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setDbResults([]);
    router.push(href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Premium Overlay Drawer Navigation */}
      {(drawerOpen || mobileOpen) && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop Overlay with Blur */}
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in cursor-pointer border-none p-0 outline-none"
            aria-label={t(lang, "nav.close_navigation", "Close navigation")}
            onClick={() => {
              setDrawerOpen(false);
              setMobileOpen(false);
            }}
          />

          {/* Slide-in Overlay Drawer Panel */}
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

      {/* Main Content Container - Always 100% Full Width (No Content Compression or Layout Shift) */}
      <div className="transition-all duration-300 min-h-screen flex flex-col w-full">
        {/* Sticky Premium Layout Header */}
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
              <div id="erp-page-actions-slot" className="flex items-center gap-2" />
            </div>

            {/* Smart Search, Date picker, Bell and Profile controls */}
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
              {/* Search trigger filter mockup */}
              {/* Search trigger filter */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 sm:px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/80 transition-colors"
                aria-label={t(lang, "nav.search", "Search")}
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="erp-search-label font-semibold text-foreground/80 hidden sm:inline">{t(lang, "nav.search_and_filter", "Search & Filter")}</span>
                <kbd className="erp-search-kbd pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 md:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>

              {/* Date selector indicator — deferred to lg: (was md:, i.e. visible starting
                  exactly at the 768px tablet breakpoint) because the topbar's right-hand
                  button group (search, date filter, bell, divider, language/theme, avatar)
                  together overflowed the available width at 768px, pushing the whole page
                  into horizontal scroll instead of staying contained. This is the lowest
                  priority item in the group, so it's the one deferred. */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="hidden lg:flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/80 transition-colors"
                title={t(lang, "nav.filter_by_date_range", "Filter by date range")}
              >
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="font-semibold">{t(lang, "nav.all_dates", "All Dates")} ({new Date().getFullYear()})</span>
                <svg className="h-3 w-3 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>

              {/* Bell Notification center icon */}
              <button
                type="button"
                className="relative p-1.5 rounded-full hover:bg-muted text-muted-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-red-500" />
              </button>

              <div className="h-8 w-px bg-border hidden sm:block" />

              {/* Right Profile avatar selection block */}
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

              {/* Profile Dropdown */}
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
                      ["/dashboard/settings/profile?panel=security", t(lang, "nav.security_settings", "Security Settings"), "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400"]
                    ].map(([href, label, iconBg]) => (
                      <Link key={href} href={href as any} onClick={() => setProfileMenuOpen(false)} className="px-3 py-2.5 text-xs font-semibold rounded-lg hover:bg-muted text-foreground flex items-center gap-3 transition-colors">
                        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", iconBg)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
                        </span>
                        {label}
                      </Link>
                    ))}

                    <Link href="/dashboard/new-entry/users/registration" onClick={() => setProfileMenuOpen(false)} className="px-3 py-2.5 text-xs font-semibold rounded-lg hover:bg-muted text-foreground flex items-center gap-3 transition-colors">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                      </span>
                      {t(lang, "nav.sign_up_new_user", "Sign Up New User")}
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        fetch("/api/erp/auth/logout", { method: "POST" }).then(() => {
                          window.location.href = "/";
                        });
                      }}
                      className="w-full text-left px-3 py-2.5 text-xs font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center gap-3 transition-colors"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                      </span>
                      {t(lang, "nav.log_out", "Log Out")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </header>

        {/* Main Work Area */}
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
        <CommandList>
          {searchingDb ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3 shrink-0" />
              {t(lang, "nav.searching_database", "Searching database...")}
            </div>
          ) : (
            <CommandEmpty>{t(lang, "nav.no_matching_results", "No matching modules, actions or records found.")}</CommandEmpty>
          )}

          {!searchingDb && filteredSearchItems.length > 0 && (
            <CommandGroup heading={t(lang, "nav.quick_actions_navigation", "Quick Actions / Navigation")}>
              {filteredSearchItems.map((item, idx) => (
                <CommandItem
                  key={`nav-${idx}`}
                  value={item.title + " " + item.keywords}
                  onSelect={() => onSelectLink(item.href)}
                  className="flex items-center gap-3 py-2 cursor-pointer"
                >
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold",
                    item.category === "Actions"
                      ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-900/30 dark:text-emerald-400"
                      : item.category === "Settings"
                        ? "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                        : "bg-primary/5 border-primary/10 text-primary dark:bg-primary/15"
                  )}>
                    {item.category === "Actions" ? "+" : t(lang, item.titleKey).substring(0, 1)}
                  </span>
                  <div>
                    <p className="text-xs font-bold">{t(lang, item.titleKey)}</p>
                    <p className="text-[10px] text-muted-foreground">{t(lang, `cmd.cat_${item.category.toLowerCase()}`)}</p>
                  </div>
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
                  className="flex items-center gap-3 py-2 cursor-pointer"
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

