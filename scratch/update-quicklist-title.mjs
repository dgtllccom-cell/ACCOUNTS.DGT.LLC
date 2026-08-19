import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  '<Icon className="h-3 w-3" />\r\n        {title}',
  '<Icon className="h-3 w-3" />\r\n        {tr(title)}'
);

content = content.replace(
  '<Icon className="h-3 w-3" />\n        {title}',
  '<Icon className="h-3 w-3" />\n        {tr(title)}'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated QuickList title to tr(title)");
