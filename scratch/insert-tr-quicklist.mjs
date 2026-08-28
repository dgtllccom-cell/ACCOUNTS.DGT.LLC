import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /function QuickList\(\{\s*title,\s*icon:\s*Icon,\s*items,\s*\}\s*:\s*\{[\s\S]*?\}\)\s*\{(\r?\n)\s*return \(/,
  'function QuickList({\n  title,\n  icon: Icon,\n  items,\n}: {\n  title: string;\n  icon: ComponentType<{ className?: string }>;\n  items: { icon: ComponentType<{ className?: string }>; label: string; href?: string }[];\n}) {$1  const tr = useTr();$1  return ('
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully inserted const tr = useTr() into QuickList!");
