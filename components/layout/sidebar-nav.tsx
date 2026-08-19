"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
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

const CHANGED_KEYS = new Set<string>([
  "inter-country-trade",
  "inter-country-booking",
  "inter-country-transfer-payment",
  "inter-country-verification",
  "receiving-country-workflow",
  "roz-expenses-bill-direct",
  "roz-expenses-bill",
  "local-purchase-management",
  "branch-purchase-management",
  "local-branch-purchase-management",
  "country-purchase-management",
  "local-purchase",
  "purchase-transfer-verification",
  "local-goods-received",
  "mgmt-location-workspace",
  "mgmt-company",
  "mgmt-employees",
  "mgmt-product-units",
  "mgmt-product-brands",
  "mgmt-product-categories",
  "mgmt-warehouses",
  "mgmt-bank",
  "mgmt-goods-master",
  "roz-money-exchange"
]);

function SidebarNodeItem({
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
  const isChanged = CHANGED_KEYS.has(node.key);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center justify-between rounded-lg text-[12.5px] transition-all duration-200 py-0.5",
          isActive
            ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white font-black shadow-md shadow-blue-500/20 active-nav-item"
            : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
        )}
      >
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pe-2 ps-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            style={{ paddingInlineStart: depth > 0 ? `${14 + depth * 12}px` : undefined }}
          >
            <SidebarIcon name={node.iconKey} className={cn("transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
            <span className="truncate text-start">{t(lang, node.labelKey)}</span>
            {isChanged && !isActive && (
              <span className="ms-1 shrink-0 rounded bg-amber-400 text-amber-950 px-1.5 py-0.5 text-[8.5px] font-black uppercase leading-none shadow-xs">
                {t(lang, "common.new", "New")}
              </span>
            )}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => (hasChildren ? onToggle(node.key) : undefined)}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pe-2 ps-3.5 text-start transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            style={{ paddingInlineStart: depth > 0 ? `${14 + depth * 12}px` : undefined }}
          >
            <SidebarIcon name={node.iconKey} className={cn("transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
            <span className="truncate">{t(lang, node.labelKey)}</span>
            {isChanged && (
              <span className="ms-1 shrink-0 rounded bg-amber-400 text-amber-950 px-1.5 py-0.5 text-[8.5px] font-black uppercase leading-none shadow-xs">
                {t(lang, "common.new", "New")}
              </span>
            )}
          </button>
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.key)}
            className="me-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700/60 hover:text-foreground transition-colors"
            aria-label={t(lang, "nav.toggle_submenu", "Toggle submenu")}
            aria-expanded={isOpen}
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? "rotate-180" : "rotate-0")} />
          </button>
        ) : null}
      </div>

      {hasChildren ? (
        <div className={cn("grid transition-all duration-200", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden ps-2">
            <div className="mt-0.5 space-y-0.5">
              {node.children!.map((child) => (
                <SidebarNodeItem
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

export function SidebarNav({
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <nav className="space-y-0.5">
      {nodes.map((node) => (
        <SidebarNodeItem
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
