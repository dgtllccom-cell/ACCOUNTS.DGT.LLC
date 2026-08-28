import fs from 'fs';

// Let's read the original clean version or fix the current one
let content = fs.readFileSync('lib/navigation/sidebar.ts', 'utf8');

// Remove double export const sidebarTree
content = content.replace(
  'export const sidebarTree: SidebarNode[] = [\nexport const sidebarTree: SidebarNode[] = [',
  'export const sidebarTree: SidebarNode[] = ['
);

// Remove all "{," and replace with "{"
content = content.replace(/\{\s*,\s*\n\s*key:/g, '{\n    key:');
content = content.replace(/  \{,\nkey:/g, '  {\n    key:');

fs.writeFileSync('lib/navigation/sidebar.ts', content, 'utf8');
console.log('Fixed syntax artifacts in lib/navigation/sidebar.ts');
