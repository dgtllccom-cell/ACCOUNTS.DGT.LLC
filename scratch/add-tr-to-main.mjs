import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add const tr = useTr(); inside DigitalDockPremiumSidebar
content = content.replace(
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {',
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const tr = useTr();'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Added const tr = useTr() to DigitalDockPremiumSidebar!");
