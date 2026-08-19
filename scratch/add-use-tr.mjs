import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Ensure useTr hook is defined right before internal components
if (!content.includes('function useTr()')) {
  content = content.replace(
    '/* ---------------- internal components ---------------- */',
    'function useTr() {\n  const lang = useActiveLanguage();\n  return (s: string) => translateHeader(lang, s);\n}\n\n/* ---------------- internal components ---------------- */'
  );
}

// In SidebarNavItem
content = content.replace(
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {',
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const tr = useTr();'
);

// In QuickList
content = content.replace(
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {',
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  const tr = useTr();'
);

// In DigitalDockPremiumSidebar
content = content.replace(
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {',
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const tr = useTr();'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully defined and wired useTr into all components in digital-dock-premium-sidebar.tsx!");
