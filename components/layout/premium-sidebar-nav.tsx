"use client";

/**
 * PremiumSidebarNav
 * -------------------------------------------------------------
 * Drop-in replacement for SidebarNav with a modern "premium" look.
 * Optimized for multi-tier ERP hierarchies to prevent 3-line text wrapping.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { SidebarNode } from "@/lib/navigation/sidebar";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { SidebarIcon } from "@/components/layout/sidebar-icon";

/**
 * TEMPORARY (testing only): menu keys created or modified in this development
 * phase are highlighted in red so they are easy to spot. Remove this Set + the
 * `isChanged` usage below to restore normal colors — no other change needed.
 */
const CHANGED_KEYS = new Set<string>([
  // Purchase / Sales menu reorganization
  "purchase",
  "sales",
  "local-purchase-management",
  "sales-order-management",
  "local-sales-management",
  // New product-master modules (CRUD + UI + i18n + security)
  "mgmt-product-units",
  "mgmt-product-brands",
  "mgmt-product-categories",
  "mgmt-warehouses",
  // Masters wired to the centralized multilingual engine this phase
  "mgmt-bank",
  "mgmt-goods-master",
  "mgmt-customers",
  "mgmt-location-workspace",
  // Security / authorization added this phase
  "mgmt-tax-setup",
  "documents-hub",
  // Accounts (multilingual verified) + exchange-rate work
  "accounts",
  "accounts-new",
  "journal-super-admin-exchange-rate",
]);

function isPathMatch(href: string, pathname: string) {
  if (!href) return false;
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

function branchHasActive(node: SidebarNode, pathname: string): boolean {
  if (!node.children?.length) return false;
  for (const child of node.children) {
    if (child.href && isPathMatch(String(child.href), pathname)) return true;
    if (branchHasActive(child, pathname)) return true;
  }
  return false;
}

function collectAutoOpenKeys(nodes: SidebarNode[], pathname: string) {
  const keys = new Set<string>();
  function walk(list: SidebarNode[]) {
    let anyActive = false;
    for (const node of list) {
      const selfActive = node.href ? isPathMatch(String(node.href), pathname) : false;
      const childActive = node.children ? walk(node.children) : false;
      if (childActive) keys.add(node.key);
      if (selfActive && node.children?.length) keys.add(node.key);
      if (selfActive || childActive) anyActive = true;
    }
    return anyActive;
  }
  walk(nodes);
  return keys;
}

function PremiumNodeItem({
  node,
  lang,
  depth,
  openKeys,
  onToggle,
  activePath,
  onNavigate
}: {
  node: SidebarNode;
  lang: SupportedLanguage;
  depth: number;
  openKeys: Set<string>;
  onToggle: (key: string) => void;
  activePath: string;
  onNavigate?: () => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isOpen = hasChildren && openKeys.has(node.key);
  const href = node.href ?? null;
  const isActive = href ? isPathMatch(String(href), activePath) : false;
  const branchActive = !isActive && branchHasActive(node, activePath);
  const labelText = t(lang, node.labelKey);
  const isChanged = CHANGED_KEYS.has(node.key); // TEMPORARY testing highlight

  const rowClass = cn(
    "group flex items-center justify-between rounded-xl transition-all duration-200 my-0.5",
    depth === 0 ? "text-[12.5px] font-bold" : depth === 1 ? "text-[12px] font-semibold" : "text-[11.5px] font-medium",
    isActive
      ? "bg-gradient-to-r from-red-600 via-rose-600 to-red-700 font-black text-white shadow-lg shadow-red-500/30 ring-2 ring-red-400/50 scale-[1.01]"
      : branchActive
        ? "bg-red-50/90 font-extrabold text-red-700 dark:bg-red-950/50 dark:text-red-300 border-s-4 border-red-600 shadow-xs"
        : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
  );

  const iconClass = cn(
    "shrink-0 transition-colors h-4 w-4",
    isActive ? "text-white animate-pulse" : branchActive ? "text-red-600 dark:text-red-400 font-bold" : "text-slate-400 group-hover:text-red-600 dark:text-slate-400"
  );

  const labelClass = "flex min-w-0 flex-1 items-center gap-2 py-1.5 px-2.5 overflow-hidden";

  return (
    <div>
      <div className={rowClass}>
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            className={labelClass}
            title={labelText}
          >
            <SidebarIcon name={node.iconKey} className={iconClass} />
            <span className={cn("min-w-0 flex-1 text-start truncate whitespace-nowrap tracking-tight", (isActive || branchActive || isChanged) && "font-bold text-red-600 dark:text-red-400", isActive && "text-white")}>
              {labelText}
            </span>
            {isActive ? (
              <span className="ms-1 shrink-0 rounded-full bg-white text-red-700 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest shadow-xs">
                ACTIVE
              </span>
            ) : branchActive ? (
              <span className="ms-1 shrink-0 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-[8.5px] font-black uppercase">
                OPEN
              </span>
            ) : isChanged ? (
              <span className="ms-1 shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-red-600 dark:bg-red-950/50 dark:text-red-400">
                new
              </span>
            ) : null}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => (hasChildren ? onToggle(node.key) : undefined)}
            className={cn(labelClass, "text-start")}
            title={labelText}
          >
            <SidebarIcon name={node.iconKey} className={iconClass} />
            <span className={cn("min-w-0 flex-1 text-start truncate whitespace-nowrap tracking-tight", (branchActive || isChanged) && "font-bold text-red-600 dark:text-red-400")}>
              {labelText}
            </span>
            {branchActive ? (
              <span className="ms-1 shrink-0 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-[8.5px] font-black uppercase">
                OPEN
              </span>
            ) : isChanged ? (
              <span className="ms-1 shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-red-600 dark:bg-red-950/50 dark:text-red-400">
                new
              </span>
            ) : null}
          </button>
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.key)}
            className={cn(
              "me-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
              isActive ? "text-white/90 hover:bg-white/20" : "text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700/60"
            )}
            aria-label="Toggle submenu"
            aria-expanded={isOpen}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? "rotate-90" : "rotate-0")} />
          </button>
        ) : null}
      </div>

      {hasChildren ? (
        <div className={cn("grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="min-h-0">
            <div className="relative ms-2.5 mt-0.5 space-y-0.5 border-s border-slate-200/90 ps-1.5 dark:border-slate-800">
              {node.children!.map((child) => (
                <PremiumNodeItem
                  key={child.key}
                  node={child}
                  lang={lang}
                  depth={depth + 1}
                  openKeys={openKeys}
                  onToggle={onToggle}
                  activePath={activePath}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PremiumSidebarNav({
  nodes,
  lang,
  onNavigate
}: {
  nodes: SidebarNode[];
  lang: SupportedLanguage;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const autoOpen = useMemo(() => collectAutoOpenKeys(nodes, pathname), [nodes, pathname]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => autoOpen);

  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      for (const key of autoOpen) next.add(key);
      return next;
    });
  }, [autoOpen]);

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <nav className="space-y-1">
      {nodes.map((node) => (
        <PremiumNodeItem
          key={node.key}
          node={node}
          lang={lang}
          depth={0}
          openKeys={openKeys}
          onToggle={toggle}
          activePath={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
