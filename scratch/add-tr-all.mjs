import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add in SidebarNavItem
content = content.replace(
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const Icon = item.icon;',
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {\n  const tr = useTr();\n  const Icon = item.icon;'
);

// Add in QuickList
content = content.replace(
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  return (',
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {\n  const tr = useTr();\n  return ('
);

content = content.replace(
  '<Icon className="h-3 w-3" />\n        {title}',
  '<Icon className="h-3 w-3" />\n        {tr(title)}'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully added tr to SidebarNavItem and QuickList!");
