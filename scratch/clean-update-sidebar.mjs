import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  'import { cn } from "@/lib/utils";',
  'import { cn } from "@/lib/utils";\nimport { useActiveLanguage } from "@/lib/i18n/use-active-language";\nimport { translateHeader } from "@/lib/i18n/table-headers";'
);

// 2. In SidebarNavItem
content = content.replace(
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const Icon = item.icon;',
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);\n  const Icon = item.icon;'
);

content = content.replace('<span className="truncate">{item.label}</span>', '<span className="truncate">{tr(item.label)}</span>');
content = content.replace('<span className="flex-1 truncate text-start">{item.label}</span>', '<span className="flex-1 truncate text-start">{tr(item.label)}</span>');
content = content.replace('<span className="truncate">{c.label}</span>', '<span className="truncate">{tr(c.label)}</span>');

// 3. In QuickList
content = content.replace(
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {',
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n'
);
content = content.replace(
  '  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  return (',
  '  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);\n  return ('
);

content = content.replace('{title}', '{tr(title)}');
content = content.replace('<span className="truncate">{it.label}</span>', '<span className="truncate">{tr(it.label)}</span>');

// 4. In DigitalDockPremiumSidebar
content = content.replace(
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const [internalQuery, setInternalQuery] = useState("");',
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);\n  const [internalQuery, setInternalQuery] = useState("");'
);

content = content.replace('<span className="text-[10.5px] font-semibold text-[#059669]">Online</span>', '<span className="text-[10.5px] font-semibold text-[#059669]">{tr("Online")}</span>');
content = content.replace('placeholder="Search menu…"', 'placeholder={tr("Search menu…")}');
content = content.replace('<div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.title}</div>', '<div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{tr(group.title)}</div>');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated digital-dock-premium-sidebar.tsx cleanly!");
