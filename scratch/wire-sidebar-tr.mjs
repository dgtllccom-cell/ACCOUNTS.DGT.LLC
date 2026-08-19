import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. SidebarNavItem
content = content.replace(
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const Icon = item.icon;',
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);\n  const Icon = item.icon;'
);

// 2. QuickList
content = content.replace(
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  return (',
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);\n  return ('
);

// 3. DigitalDockPremiumSidebar
content = content.replace(
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const [internalQuery, setInternalQuery] = useState("");',
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const lang = useActiveLanguage();\n  const tr = (s: string) => translateHeader(lang, s);\n  const [internalQuery, setInternalQuery] = useState("");'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully wired i18n into all sidebar functions!");
