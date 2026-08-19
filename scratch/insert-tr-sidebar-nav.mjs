import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace function SidebarNavItem to guarantee const tr = useTr(); is inside
content = content.replace(
  /function SidebarNavItem\(\{ item, query \}: \{ item: NavItem; query: string \}\) \{(\r?\n)/,
  'function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {$1  const tr = useTr();$1'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully inserted const tr = useTr() into SidebarNavItem!");
