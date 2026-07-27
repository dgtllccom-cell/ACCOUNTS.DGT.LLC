"use client";

/**
 * PremiumSidebarNav
 * -------------------------------------------------------------
 * Drop-in replacement for SidebarNav with a modern "premium" look.
 * It uses the EXACT same data and behaviour as the original sidebar:
 *   - real nav tree (already role/permission filtered upstream)
 *   - i18n labels via t(lang, node.labelKey)
 *   - real routes via next/link
 *   - active-path detection + auto-open of the active branch
 *   - existing iconKey icons (SidebarIcon)
 * Only the visual design changes (colors, spacing, icons, active
 * highlight, smooth expand/collapse). No labels, routes, permissions,
 * APIs or business logic are altered.
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

  const rowClass = cn(
    "group flex items-center justify-between rounded-xl text-[13px] transition-all duration-200",
    isActive
      ? "bg-gradient-to-r from-[#2563EB] to-indigo-500 font-semibold text-white shadow-md shadow-[#2563EB]/25"
      : branchActive
        ? "bg-[#2563EB]/10 font-semibold text-[#2563EB] dark:bg-[#2563EB]/15"
        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white"
  );
  const iconClass = cn(
    "shrink-0 transition-colors",
    isActive ? "text-white" : branchActive ? "text-[#2563EB]" : "text-slate-500 group-hover:text-[#2563EB] dark:text-slate-400"
  );
  const labelClass =
    "flex min-w-0 flex-1 items-center gap-2 py-1.5 pe-1.5 ps-2.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5";
  const indentStyle = { paddingInlineStart: depth > 0 ? `${8 + depth * 8}px` : undefined };

  return (
    <div>
      <div className={rowClass}>
        {href ? (
          <Link href={href} onClick={onNavigate} className={labelClass} style={indentStyle}>
            <SidebarIcon name={node.iconKey} className={iconClass} />
            <span className="min-w-0 flex-1 text-start leading-snug break-words text-[12px]">{t(lang, node.labelKey)}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => (hasChildren ? onToggle(node.key) : undefined)}
            className={cn(labelClass, "text-start")}
            style={indentStyle}
          >
            <SidebarIcon name={node.iconKey} className={iconClass} />
            <span className="min-w-0 flex-1 text-start leading-snug break-words text-[12px]">{t(lang, node.labelKey)}</span>
          </button>
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.key)}
            className={cn(
              "me-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg transition-colors",
              isActive ? "text-white/80 hover:bg-white/20" : "text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700/60"
            )}
            aria-label="Toggle submenu"
            aria-expanded={isOpen}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-300", isOpen ? "rotate-90" : "rotate-0")} />
          </button>
        ) : null}
      </div>

      {hasChildren ? (
        <div className={cn("grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="min-h-0">
            <div className="relative ms-4 mt-1 space-y-0.5 border-s border-slate-200/80 ps-2 dark:border-slate-700/60">
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
