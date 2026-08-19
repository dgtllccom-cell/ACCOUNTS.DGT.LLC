import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  '} from "lucide-react";',
  '} from "lucide-react";\nimport { useActiveLanguage } from "@/lib/i18n/use-active-language";\nimport { translateHeader } from "@/lib/i18n/table-headers";'
);

// 2. Add useTr helper
content = content.replace(
  '/* ---------------- internal components ---------------- */',
  'function useTr() {\n  const lang = useActiveLanguage();\n  return (s: string) => translateHeader(lang, s);\n}\n\n/* ---------------- internal components ---------------- */'
);

// 3. Update SidebarNavItem
content = content.replace(
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const Icon = item.icon;',
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const tr = useTr();\n  const Icon = item.icon;'
);

content = content.replace(
  '<span className="truncate">{item.label}</span>',
  '<span className="truncate">{tr(item.label)}</span>'
);

content = content.replace(
  '<span className="flex-1 truncate text-left">{item.label}</span>',
  '<span className="flex-1 truncate text-left">{tr(item.label)}</span>'
);

content = content.replace(
  '<span className="truncate">{c.label}</span>',
  '<span className="truncate">{tr(c.label)}</span>'
);

// 4. Update QuickList
content = content.replace(
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  return (',
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  const tr = useTr();\n  return ('
);

content = content.replace(
  '{title}\n      </div>',
  '{tr(title)}\n      </div>'
);

content = content.replace(
  '<span className="truncate">{it.label}</span>',
  '<span className="truncate">{tr(it.label)}</span>'
);

// 5. Update DigitalDockPremiumSidebar
content = content.replace(
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const [internalQuery, setInternalQuery] = useState("");',
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const tr = useTr();\n  const [internalQuery, setInternalQuery] = useState("");'
);

content = content.replace(
  '<span className="text-[10.5px] font-semibold text-[#059669]">Online</span>',
  '<span className="text-[10.5px] font-semibold text-[#059669]">{tr("Online")}</span>'
);

content = content.replace(
  'placeholder="Search menu…"',
  'placeholder={tr("Search menu…")}'
);

content = content.replace(
  '<div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.title}</div>',
  '<div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{tr(group.title)}</div>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully transformed digital-dock-premium-sidebar.tsx!");
