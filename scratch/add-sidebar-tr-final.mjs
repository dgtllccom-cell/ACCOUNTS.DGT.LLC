import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const [internalQuery, setInternalQuery] = useState("");',
  'export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {\n  const tr = useTr();\n  const [internalQuery, setInternalQuery] = useState("");'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Added useTr to DigitalDockPremiumSidebar!");
