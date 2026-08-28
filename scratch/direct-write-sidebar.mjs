import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// If missing DigitalDockPremiumSidebar signature:
const searchTarget = `/* ---------------- main sidebar component ---------------- */\n\n  return (`;
const replacement = `/* ---------------- main sidebar component ---------------- */
export interface DigitalDockPremiumSidebarProps {
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
}

export function DigitalDockPremiumSidebar({ searchQuery: externalQuery, onSearchQueryChange }: DigitalDockPremiumSidebarProps = {}) {
  const tr = useTr();
  const [internalQuery, setInternalQuery] = useState("");
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = (v: string) => {
    setInternalQuery(v);
    onSearchQueryChange?.(v);
  };

  return (`;

if (content.includes(searchTarget)) {
  content = content.replace(searchTarget, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Replaced signature directly!");
} else {
  // Let's check with flexible regex
  content = content.replace(
    /\/\* ---------------- main sidebar component ---------------- \*\/\s*return \(/,
    replacement
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Replaced signature via regex!");
}
