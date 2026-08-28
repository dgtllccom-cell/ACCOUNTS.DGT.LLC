import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /export function DigitalDockPremiumSidebar\(\{\s*searchQuery:\s*externalQuery,\s*onSearchQueryChange\s*\}\s*:\s*DigitalDockPremiumSidebarProps\s*=\s*\{\}\)\s*\{(\r?\n)\s*const \[internalQuery/,
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {$1  const tr = useTr();$1  const [internalQuery'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully added useTr via CRLF-aware regex!");
