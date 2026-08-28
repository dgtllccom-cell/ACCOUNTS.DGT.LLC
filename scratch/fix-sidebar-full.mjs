import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const marker = `    title: "System & Reports",`;
const markerEnd = `  if (!hasChildren) {`;

const idx1 = content.indexOf(marker);
const idx2 = content.indexOf(markerEnd);

if (idx1 !== -1 && idx2 !== -1) {
  const cleanMiddle = `    title: "System & Reports",
    items: [
      { icon: FileText, label: "Journal Report PDF ERP", href: "/dashboard/reports/handover", badge: "PDF" },
      { icon: Settings, label: "Settings", href: "/dashboard/settings" }
    ],
  },
];

export const QUICK_FAVOURITES = [
  { icon: ShoppingCart, label: "Purchase Booking", href: "/dashboard/purchase" },
  { icon: Wallet, label: "Daily Payment", href: "/dashboard/roznamcha/cash-entry" },
  { icon: CircleDollarSign, label: "Exchange Rates", href: "/dashboard/reports/exchange-rate" },
];

export const QUICK_RECENT = [
  { icon: FileText, label: "PB-2026-6789", href: "/dashboard/purchase" },
  { icon: Package, label: "Sales Invoice", href: "/dashboard/sales" },
  { icon: BookOpen, label: "Ledger — FAREDULLAH", href: "/dashboard/ledger" },
];

/* ---------------- palette tokens ---------------- */
const colors = {
  primary: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  sidebarBg: "#FFFFFF",
  background: "#F8FAFC",
};

/* ---------------- internal components ---------------- */
function SidebarNavItem({ item, query }: { item: NavItem; query: string }) {
  const lang = useActiveLanguage();
  const tr = (s: string) => translateHeader(lang, s);
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = useState<boolean>(
    hasChildren && (!!item.active || !!item.highlighted || !!item.children?.some((c) => c.active)),
  );
  const matches = useMemo(() => {
    if (!query) return { self: true, children: item.children ?? [] };
    const q = query.toLowerCase();
    const selfMatch = item.label.toLowerCase().includes(q);
    const kids = (item.children ?? []).filter((c) => c.label.toLowerCase().includes(q));
    return { self: selfMatch || kids.length > 0, children: selfMatch ? (item.children ?? []) : kids };
  }, [query, item]);
  useEffect(() => {
    if (query && matches.children.length > 0) setOpen(true);
  }, [query, matches.children.length]);

  if (!matches.self) return null;
  const isTopActive = item.active && !hasChildren;

`;

  content = content.substring(0, idx1) + cleanMiddle + content.substring(idx2);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully restored sidebar structure!");
} else {
  console.error("Markers not found");
}
