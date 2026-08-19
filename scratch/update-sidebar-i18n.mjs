import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('useActiveLanguage')) {
  content = content.replace(
    'import { useEffect, useMemo, useState, type ComponentType } from "react";',
    'import { useEffect, useMemo, useState, type ComponentType } from "react";\nimport { useActiveLanguage } from "@/lib/i18n/use-active-language";\nimport { translateHeader } from "@/lib/i18n/table-headers";'
  );
}

// In SidebarNavItem
content = content.replace(
  'export function SidebarNavItem({ item, query = "" }: { item: NavItem; query?: string }) {',
  'export function SidebarNavItem({ item, query = "" }: { item: NavItem; query?: string }) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);'
);

content = content.replace('<span className="truncate">{item.label}</span>', '<span className="truncate">{tr(item.label)}</span>');
content = content.replace('<span className="flex-1 truncate text-left">{item.label}</span>', '<span className="flex-1 truncate text-start">{tr(item.label)}</span>');
content = content.replace('<span className="truncate">{c.label}</span>', '<span className="truncate">{tr(c.label)}</span>');
content = content.replace('{item.highlighted && (\n          <span className="rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">NEW</span>\n        )}', '{item.highlighted && (\n          <span className="rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">{tr("NEW")}</span>\n        )}');

// In QuickList
content = content.replace(
  'function QuickList({',
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);'
);

content = content.replace('{title}', '{tr(title)}');
content = content.replace('<span className="truncate">{it.label}</span>', '<span className="truncate">{tr(it.label)}</span>');

// In DigitalDockPremiumSidebar
content = content.replace(
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {',
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);'
);

content = content.replace('placeholder="Search menu…"', 'placeholder={tr("Search menu…")}');
content = content.replace('{group.title}', '{tr(group.title)}');
content = content.replace('Online', '{tr("Online")}');
content = content.replace('All systems operational', '{tr("All systems operational")}');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated digital-dock-premium-sidebar.tsx");
