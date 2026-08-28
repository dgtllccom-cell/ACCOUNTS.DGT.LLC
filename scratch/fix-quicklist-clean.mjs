import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const marker = `                  <span className="truncate">{tr(c.label)}</span>\n                  {c.badge && (`;
const markerEnd = `/* ---------------- main sidebar component ---------------- */`;

const idx1 = content.indexOf(marker);
const idx2 = content.indexOf(markerEnd);

if (idx1 !== -1 && idx2 !== -1) {
  const cleanMiddle = `                  <span className="truncate">{tr(c.label)}</span>
                  {c.badge && (
                    <span className="ml-auto rounded-full bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#F59E0B]">{c.badge}</span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];
}) {
  const tr = useTr();
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        <Icon className="h-3 w-3" />
        {tr(title)}
      </div>
      <div className="space-y-0.5">
        {items.map((it) => {
          const I = it.icon;
          return (
            <a
              key={it.label}
              href={it.href ?? "#"}
              className="group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] text-slate-600 transition-all hover:bg-slate-100/80 hover:text-slate-900"
            >
              <I className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#2563EB]" />
              <span className="truncate">{tr(it.label)}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

`;

  content = content.substring(0, idx1) + cleanMiddle + content.substring(idx2);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully fixed QuickList and SidebarNavItem!");
} else {
  console.error("Markers not found");
}
