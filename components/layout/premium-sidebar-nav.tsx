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
const CHANGED_KEYS = new Set<string>([]);

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
  const isChanged = CHANGED_KEYS.has(node.key);

  const rowClass = cn(
    "group flex items-center justify-between rounded-lg transition-all duration-150 my-1 cursor-pointer select-none",
    depth === 0 ? "text-xs sm:text-[13.5px] font-bold" : depth === 1 ? "text-xs sm:text-[12.5px] font-semibold" : "text-xs sm:text-[12px] font-medium",
    isActive
      ? "bg-blue-600 text-white font-bold shadow-sm"
      : branchActive
        ? "bg-slate-100 text-blue-700 dark:bg-slate-800 dark:text-blue-400 font-semibold"
        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
  );

  const iconClass = cn(
    "shrink-0 transition-colors h-4 w-4 sm:h-4.5 sm:w-4.5 me-2",
    isActive ? "text-white" : branchActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200"
  );

  const labelClass = "flex min-w-0 flex-1 items-center py-2 px-3 overflow-hidden";

  return (
    <div>
      <div className={rowClass}>
        {href ? (
          <Link
            href={href}
            onClick={(e) => {
              if (hasChildren) {
                onToggle(node.key);
              }
              onNavigate?.();
            }}
            className={labelClass}
            title={labelText}
          >
            <SidebarIcon name={node.iconKey} className={iconClass} />
            <span className={cn("min-w-0 flex-1 text-start truncate whitespace-nowrap tracking-tight leading-snug", (isActive || branchActive) && "font-bold", isActive && "text-white")}>
              {labelText}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => (hasChildren ? onToggle(node.key) : undefined)}
            className={cn(labelClass, "text-start")}
            title={labelText}
          >
            <SidebarIcon name={node.iconKey} className={iconClass} />
            <span className={cn("min-w-0 flex-1 text-start truncate whitespace-nowrap tracking-tight leading-snug", branchActive && "font-bold text-blue-600 dark:text-blue-400")}>
              {labelText}
            </span>
          </button>
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.key)}
            className={cn(
              "me-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              isActive ? "text-white/90 hover:bg-white/20" : "text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700/60"
            )}
            aria-label="Toggle submenu"
            aria-expanded={isOpen}
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isOpen ? "rotate-90" : "rotate-0")} />
          </button>
        ) : null}
      </div>

      {hasChildren ? (
        <div className={cn("grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="min-h-0">
            {/* Clean indentation without vertical tree lines */}
            <div className="ms-3 sm:ms-4 mt-0.5 space-y-0.5 ps-2">
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

function findNodeByKey(list: SidebarNode[], key: string): SidebarNode | null {
  for (const item of list) {
    if (item.key === key) return item;
    if (item.children?.length) {
      const found = findNodeByKey(item.children, key);
      if (found) return found;
    }
  }
  return null;
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

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
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
