"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  Mail,
  MessageCircle,
  MoreVertical,
  Printer,
  RefreshCw,
  Send,
  Share2,
  X
} from "lucide-react";
import { shareToDgtConnect } from "@/features/dgt-connect/share-bridge";
import { usePathname, useRouter } from "next/navigation";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t, type UiKey } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { sidebarTree, type SidebarNode } from "@/lib/navigation/sidebar";
import { DAMAN_SIDEBAR_ITEMS } from "@/components/layout/digital-dock-premium-sidebar";
import { useErpPageMenuState } from "@/components/layout/erp-page-menu";
import { ViewModeToggle } from "@/components/layout/view-mode-toggle";

// Route → nav labelKey, so the page header reuses the fully-translated (and
// i18n-guard-enforced) `nav.*` dictionary instead of a humanised URL segment.
const NAV_LABEL_BY_HREF: Map<string, UiKey> = (() => {
  const map = new Map<string, UiKey>();
  const walk = (nodes: SidebarNode[]) => {
    for (const n of nodes) {
      if (n.href && !map.has(n.href)) map.set(n.href, n.labelKey);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(sidebarTree);
  return map;
})();

function titleFromPath(pathname: string, lang: string) {
  // Prefer the route's own nav labelKey — a complete, guard-enforced translation.
  const cleanPath = pathname.replace(/\?.*$/, "");
  const navKey = NAV_LABEL_BY_HREF.get(cleanPath);
  if (navKey) return t(lang, navKey, undefined);

  const lastSegment = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "dashboard")
    .at(-1);

  if (!lastSegment) return t(lang, "pa.default_title", "Dashboard");

  const humanized = lastSegment
    .replace(/\?.*$/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Route segments don't carry a semantic i18n key of their own, so this falls
  // back to the shared header dictionary (keyed by normalized English text) —
  // same lookup used for table column headers. Unmapped routes safely render
  // the humanized English title, same as before this fix.
  return translateHeader(lang, humanized);
}

type Crumb = { label: string; href?: string };

/** Home › Group › Page — built from the same menu the user sees, so every crumb is translated and every link is a real route. */
function breadcrumbFor(pathname: string, lang: string): Crumb[] {
  const path = pathname.replace(/\?.*$/, "").replace(/\/$/, "") || "/dashboard";
  const home: Crumb = { label: translateHeader(lang, "Dashboard"), href: "/dashboard" };
  type N = { label: string; href?: string; children?: N[] };
  const walk = (nodes: N[], acc: N[]): N[] | null => {
    for (const n of nodes) {
      const next = [...acc, n];
      if (n.href === path) return next;
      if (n.children) { const r = walk(n.children, next); if (r) return r; }
    }
    return null;
  };
  const trail = walk(DAMAN_SIDEBAR_ITEMS as unknown as N[], []);
  if (!trail) return [home];
  const items = trail.filter((n) => n.href !== "/dashboard");
  return [home, ...items.map((n, i) => ({ label: translateHeader(lang, n.label), href: i < items.length - 1 ? n.href : undefined }))];
}

function currentUrl() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

function parentPathFor(pathname: string) {
  const explicitParents: Record<string, string> = {
    "/dashboard/new-entry/branch-entry/country-branch": "/dashboard/branch-management/general-report",
    "/dashboard/new-entry/branch-entry/city-branch": "/dashboard/branch-management/general-report",
    "/dashboard/new-entry/branches/super-admin": "/dashboard/branch-management/general-report",
    "/dashboard/new-entry/users/registration": "/dashboard/new-entry/users/journal-report",
    "/dashboard/new-entry/users/journal-report": "/dashboard/new-entry/users/journal-report",
    "/dashboard/accounts/setup": "/dashboard/accounts",
    "/dashboard/accounts/view": "/dashboard/accounts",
    "/dashboard/purchase/new-purchase-booking-order": "/dashboard/purchase/purchase-order",
    "/dashboard/purchase/purchase-confirm": "/dashboard/purchase/purchase-order",
    "/dashboard/roznamcha/cash-entry": "/dashboard/roznamcha/all"
  };

  if (explicitParents[pathname]) return explicitParents[pathname];

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/dashboard";
  if (parts.length === 2 && parts[0] === "dashboard") return "/dashboard";
  // The nearest ancestor that is a REAL page: first a menu destination, never a bare path segment that has no page (404).
  const known = knownMenuHrefs();
  for (let n = parts.length - 1; n >= 2; n--) {
    const candidate = `/${parts.slice(0, n).join("/")}`;
    if (known.has(candidate)) return candidate;
  }
  return "/dashboard";
}

let KNOWN_HREFS: Set<string> | null = null;
function knownMenuHrefs() {
  if (KNOWN_HREFS) return KNOWN_HREFS;
  const set = new Set<string>();
  const walk = (nodes: Array<{ href?: string; children?: unknown[] }>) => {
    for (const n of nodes) { if (n.href) set.add(n.href); if (n.children) walk(n.children as Array<{ href?: string; children?: unknown[] }>); }
  };
  walk(DAMAN_SIDEBAR_ITEMS as unknown as Array<{ href?: string; children?: unknown[] }>);
  KNOWN_HREFS = set;
  return set;
}

type ErpPageActionsProps = {
  children?: ReactNode;
  backLink?: string;
  title?: string;
  subtitle?: string;
};

export function ErpPageActions({ children, backLink, title: titleOverride, subtitle: subtitleOverride }: ErpPageActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const lang = useActiveLanguage();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { items: pageItems, hideDefaults } = useErpPageMenuState();

  // Has the user navigated inside the app yet? Then "Back" is the real previous page; a deep link opened directly goes to the parent.
  const firstPath = useRef<string | null>(null);
  const navigatedInApp = useRef(false);
  useEffect(() => {
    if (firstPath.current === null) { firstPath.current = pathname; return; }
    if (pathname !== firstPath.current) navigatedInApp.current = true;
  }, [pathname]);

  // A page that draws its OWN complete header (Back + actions) marks it with data-page-chrome; the global bar then steps aside so the
  // user never sees two Back buttons or two ⋮ menus. (The hard-coded isReportPage list below stays for pages that predate the marker.)
  const [pageOwnsChrome, setPageOwnsChrome] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => { raf = 0; setPageOwnsChrome(Boolean(document.querySelector("[data-page-chrome]"))); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [pathname]);

  // Report pages, documents manager, KYC reports, and specialized studio pages render their own dedicated toolbar directly.
  // NOTE: this is computed but the early return MUST come after every hook below — a conditional
  // return before a hook changes the hook count between route renders and triggers React error #310
  // (Rules of Hooks). ErpPageActions renders on every dashboard route, so that crash hit ~every
  // navigation between a report and a non-report page.
  const isReportPage =
    pathname === "/dashboard" ||
    pathname === "/dashboard/city" ||
    pathname?.startsWith("/dashboard/city") ||
    pathname === "/dashboard/shipping-line" ||
    pathname?.startsWith("/dashboard/shipping-line") ||
    pathname === "/dashboard/logistics" ||
    pathname?.startsWith("/dashboard/logistics") ||
    pathname === "/dashboard/smart-operations" ||
    pathname?.startsWith("/dashboard/smart-operations") ||
    pathname === "/dashboard/country" ||
    pathname?.startsWith("/dashboard/country") ||
    pathname === "/dashboard/super-admin" ||
    pathname?.startsWith("/dashboard/super-admin") ||
    pathname?.startsWith("/dashboard/admin") ||
    pathname?.startsWith("/dashboard/agent") ||
    pathname?.startsWith("/dashboard/reports") ||
    pathname?.startsWith("/dashboard/roznamcha/reports") ||
    pathname?.startsWith("/dashboard/ledger") ||
    pathname?.startsWith("/dashboard/journal") ||
    pathname === "/dashboard/documents" ||
    pathname?.startsWith("/dashboard/documents/") ||
    pathname === "/dashboard/kyc-reports" ||
    pathname?.startsWith("/dashboard/kyc-reports/") ||
    // BILL COST, EXPENSES & PROFIT drill-down + report suite carry their own
    // header / back / refresh / print — the generic bar would duplicate them
    // (and humanise the bill UUID into the title).
    pathname?.startsWith("/dashboard/bill-cost-profit/bill/") ||
    // Branch & Network full-screen views (/country/<uuid>, /branch/<uuid>) own their header,
    // back link and Print/PDF; the generic bar would humanise the UUID into the title.
    pathname?.startsWith("/dashboard/branch-management/country/") ||
    pathname?.startsWith("/dashboard/branch-management/branch/") ||
    pathname === "/dashboard/bill-cost-profit/reports" ||
    pathname?.startsWith("/dashboard/purchase/local-purchase") ||
    pathname?.startsWith("/dashboard/clearing-agent/customer-order") ||
    pathname?.startsWith("/dashboard/clearing-agent/truck-registration") ||
    pathname?.startsWith("/dashboard/clearing-agent/truck-recreation") ||
    pathname?.startsWith("/dashboard/new-entry/users/all") ||
    pathname?.startsWith("/dashboard/communication-center") ||
    pathname?.startsWith("/dashboard/messages") ||
    pathname?.startsWith("/dashboard/email") ||
    pathname?.startsWith("/dashboard/accounts/setup") ||
    pathname?.startsWith("/dashboard/settings/customers");

  const title = titleOverride || titleFromPath(pathname || "/dashboard", lang);
  const crumbs = breadcrumbFor(pathname || "/dashboard", lang);
  const subtitle = subtitleOverride || crumbs.map((c) => c.label).join(" › ");

  useEffect(() => {
    if (!open) return;

    function onMouseDown(event: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeAndRun(action: () => void) {
    setOpen(false);
    action();
  }

  // Generic page Print / PDF: render only the page's <main> content into the
  // shared preview modal (no sidebar / top nav / this menu). Pages with their
  // own report engine wire their action into #erp-page-actions-slot instead.
  async function printPageContent() {
    const main = typeof document !== "undefined"
      ? (document.querySelector("main") || document.querySelector("[data-erp-page-content]"))
      : null;
    if (main) {
      if (!main.id) main.id = "erp-generic-page-print";
      const { printDomFragmentViaModal } = await import("@/lib/reports/print-dom-fragment");
      if (printDomFragmentViaModal(main.id, document.title || t(lang, "pa.print", "Print"), { lang })) return;
    }
    if (typeof window !== "undefined") window.print();
  }

  function goBack() {
    if (backLink) {
      router.push(backLink as any);
      return;
    }
    if (navigatedInApp.current && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(parentPathFor(pathname || "/dashboard") as any);
  }

  function closePage() {
    router.push((backLink || parentPathFor(pathname || "/dashboard")) as any);
  }

  function editCurrentRecord() {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    params.set("mode", "edit");
    router.push(`${pathname}?${params.toString()}` as any);
  }

  function emailPage() {
    const subject = encodeURIComponent(`ERP Page: ${title}`);
    const body = encodeURIComponent(`Please review this ERP page:\n\n${currentUrl()}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function whatsAppShare() {
    const text = encodeURIComponent(`${title}\n${currentUrl()}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  function shareToConnect() {
    shareToDgtConnect({
      module: (pathname || "/").split("/").filter(Boolean).slice(-2).join("/") || "page",
      id: currentUrl(),
      label: title,
      route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
      summary: subtitle,
    });
  }

  // Early return is safe here — every hook above has already run unconditionally.
  if (isReportPage || pageOwnsChrome) return null;

  return (
    <section data-erp-page-actions className="no-print mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-1.5 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900/90 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goBack}
          className="h-7 gap-1 rounded-lg border-slate-200 bg-slate-50 px-2.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label={t(lang, "pa.back_to_previous_page", "Back to previous page")}
          title={t(lang, "pa.back", "Back")}
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          {t(lang, "pa.back", "Back")}
        </Button>
        <style>{`#erp-page-title-slot:not(:empty) ~ .default-title { display: none !important; }`}</style>
        <div id="erp-page-title-slot" className="min-w-0 empty:hidden" />
        <div className="flex min-w-0 flex-col justify-center leading-tight default-title">
          <h1 className="truncate text-xs font-black leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-sm">{title}</h1>
          {subtitleOverride ? (
            <p className="mt-0.5 hidden truncate text-[9.5px] font-medium leading-tight text-slate-400 sm:block">{subtitle}</p>
          ) : (
            <nav aria-label={t(lang, "pa.breadcrumb", "Breadcrumb")} data-testid="erp-breadcrumb" className="mt-0.5 hidden min-w-0 items-center gap-0.5 truncate text-[10px] font-medium leading-tight text-slate-400 sm:flex">
              {crumbs.map((c, i) => (
                <span key={i} className="flex min-w-0 items-center gap-0.5">
                  {i > 0 && <ChevronRight className="h-2.5 w-2.5 shrink-0 rtl:rotate-180" aria-hidden />}
                  {c.href ? (
                    <a href={c.href} onClick={(e) => { e.preventDefault(); router.push(c.href as any); }} className="truncate hover:text-blue-600 hover:underline">{c.label}</a>
                  ) : (
                    <span className="truncate text-slate-500" aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div id="erp-page-actions-slot" className="flex flex-wrap items-center gap-1.5 empty:hidden" />
        <ViewModeToggle />
        {!pathname?.startsWith("/dashboard/purchase/new-purchase-booking-order") && !pathname?.startsWith("/dashboard/purchase/purchase-order") && (
          <div ref={menuRef} className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen((current) => !current)}
              className="h-7 gap-1 rounded-lg border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label={t(lang, "pa.open_actions_menu", "Open page actions menu")}
              title={t(lang, "pa.page_actions", "Page actions")}
            >
              <MoreVertical className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              {t(lang, "pa.actions", "Actions")}
            </Button>

            {open ? (
              <div role="menu" data-testid="erp-page-menu" className={cn("absolute end-0 top-full z-40 mt-1.5 w-56 max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900")}>
                {pageItems.filter((it) => !it.hidden).map((it) => (
                  <div key={it.key}>
                    {it.separatorBefore && <div className="my-0.5 border-t border-slate-100 dark:border-slate-800" />}
                    <button type="button" role="menuitem" disabled={it.disabled} onClick={() => closeAndRun(it.onSelect)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800">
                      {it.icon}
                      {it.label}
                    </button>
                  </div>
                ))}
                {pageItems.some((it) => !it.hidden) && <div className="my-0.5 border-t border-slate-100 dark:border-slate-800" />}
                {!hideDefaults.has("print") && (
                  <button type="button" role="menuitem" onClick={() => closeAndRun(() => { void printPageContent(); })} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Printer className="h-4 w-4" aria-hidden />
                    {t(lang, "pa.print", "Print")}
                  </button>
                )}
                {!hideDefaults.has("pdf") && (
                  <button type="button" role="menuitem" onClick={() => closeAndRun(() => { void printPageContent(); })} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <DownloadActionIcon className="h-4 w-4" aria-hidden />
                    {t(lang, "pa.pdf_download", "PDF Download")}
                  </button>
                )}
                {!hideDefaults.has("email") && (
                  <button type="button" role="menuitem" onClick={() => closeAndRun(emailPage)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Mail className="h-4 w-4" aria-hidden />
                    {t(lang, "pa.email", "Email")}
                  </button>
                )}
                {!hideDefaults.has("whatsapp") && (
                  <button type="button" role="menuitem" onClick={() => closeAndRun(whatsAppShare)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Send className="h-4 w-4" aria-hidden />
                    {t(lang, "pa.whatsapp_share", "WhatsApp Share")}
                  </button>
                )}
                {!hideDefaults.has("connect") && (
                  <button type="button" role="menuitem" onClick={() => closeAndRun(shareToConnect)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {t(lang, "dgtc.title", "DGT Connect")}
                  </button>
                )}
                {!hideDefaults.has("edit") && (
                  <button type="button" role="menuitem" onClick={() => closeAndRun(editCurrentRecord)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Edit3 className="h-4 w-4" aria-hidden />
                    {t(lang, "pa.edit", "Edit")}
                  </button>
                )}
                {!hideDefaults.has("refresh") && (
                  <button type="button" role="menuitem" onClick={() => closeAndRun(() => window.location.reload())} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    {t(lang, "common.refresh", "Refresh")}
                  </button>
                )}
                {!hideDefaults.has("copy") && (
                  <button type="button" role="menuitem" onClick={() => closeAndRun(() => navigator.clipboard?.writeText(currentUrl()))} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Share2 className="h-4 w-4" aria-hidden />
                    {t(lang, "pa.copy_link", "Copy Link")}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={closePage}
          className="h-7 w-7 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
          aria-label={t(lang, "pa.close_current_page", "Close current page")}
          title={t(lang, "pa.close", "Close")}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      {children ? <div className="w-full flex flex-wrap items-center gap-2 pt-2">{children}</div> : null}
    </section>
  );
}
