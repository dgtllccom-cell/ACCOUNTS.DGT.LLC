import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const marker = `/* ---------------- main sidebar component ---------------- */`;
const markerEnd = `  return (\n    <div className="flex h-full flex-col bg-white/95 backdrop-blur-xl">`;

const idx1 = content.indexOf(marker);
const idx2 = content.indexOf(markerEnd);

if (idx1 !== -1 && idx2 !== -1) {
  const cleanMiddle = `/* ---------------- main sidebar component ---------------- */
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
`;

  content = content.substring(0, idx1) + cleanMiddle + content.substring(idx2);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully fixed DigitalDockPremiumSidebar signature!");
} else {
  console.error("Markers not found");
}
