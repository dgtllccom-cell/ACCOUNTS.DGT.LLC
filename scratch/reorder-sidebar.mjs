import fs from 'fs';

const sidebarFile = 'lib/navigation/sidebar.ts';
const content = fs.readFileSync(sidebarFile, 'utf8');
const lines = content.split('\n');

// Find all top-level node ranges
// A top-level node starts with '  {' or '      {' at the outer array level
// Let's define the ranges accurately

const nodeDefs = [
  { key: 'dashboard', start: 61, end: 93 },
  { key: 'settlement-reconciliation-group', start: 94, end: 199 },
  { key: 'tax-setup-rules-group', start: 200, end: 247 },
  { key: 'crm-main-group', start: 248, end: 318 },
  { key: 'enterprise-audit-group', start: 319, end: 344 },
  { key: 'new-entry', start: 345, end: 475 },
  { key: 'ledgers', start: 476, end: 512 },
  { key: 'journal', start: 513, end: 679 },
  { key: 'inter-country-trade', start: 680, end: 715 },
  { key: 'purchase', start: 716, end: 748 },
  { key: 'sales', start: 749, end: 794 },
  { key: 'documents-hub', start: 795, end: 801 },
  { key: 'journal-stock', start: 802, end: 902 },
  { key: 'kyc-reports-top', start: 903, end: 909 },
  { key: 'logistics', start: 910, end: 989 },
  { key: 'tax', start: 990, end: 995 },
  { key: 'general-office', start: 996, end: 1021 },
  { key: 'smart-due-center', start: 1022, end: 1028 },
  { key: 'super-admin-menu', start: 1029, end: 1107 },
  { key: 'reports', start: 1108, end: 1149 },
  { key: 'message-system', start: 1150, end: 1217 },
  { key: 'settings', start: 1218, end: 1365 },
  { key: 'master-system-journal-pdf', start: 1366, end: 1372 },
  { key: 'walkthrough-video', start: 1373, end: 1378 }
];

console.log('Verifying line slices...');
const nodeMap = {};
for (const n of nodeDefs) {
  const slice = lines.slice(n.start - 1, n.end);
  const text = slice.join('\n');
  if (!text.includes(`key: "${n.key}"`)) {
    console.error(`Mismatch for key ${n.key}: start line ${n.start} did not match.`);
    process.exit(1);
  }
  nodeMap[n.key] = text;
}
console.log('All 24 nodes verified perfectly!');

// Reconstruct in target order
const targetOrder = [
  'dashboard',
  'new-entry',
  'ledgers',
  'journal',
  'purchase',
  'sales',
  'inter-country-trade',
  'general-office',
  'journal-stock',
  'logistics',
  'crm-main-group',
  'tax-setup-rules-group',
  'settlement-reconciliation-group',
  'documents-hub',
  'enterprise-audit-group',
  'kyc-reports-top',
  'tax',
  'smart-due-center',
  'super-admin-menu',
  'reports',
  'message-system',
  'settings',
  'master-system-journal-pdf',
  'walkthrough-video',
];

const headerLines = lines.slice(0, 60);
const footerLines = lines.slice(1378); // from closing '];' onwards

let newContent = headerLines.join('\n') + '\n';
newContent += 'export const sidebarTree: SidebarNode[] = [\n';

const formattedNodes = targetOrder.map((key) => {
  let code = nodeMap[key].trim();
  // Ensure indentation starts with 2 spaces
  // If ends with comma, keep clean
  if (!code.endsWith(',')) {
    code = code + ',';
  }
  return code;
});

// Remove trailing comma from last item
const lastIdx = formattedNodes.length - 1;
if (formattedNodes[lastIdx].endsWith(',')) {
  formattedNodes[lastIdx] = formattedNodes[lastIdx].slice(0, -1);
}

newContent += formattedNodes.join('\n') + '\n';
newContent += footerLines.join('\n');

fs.writeFileSync(sidebarFile, newContent, 'utf8');
console.log('Successfully reordered sidebarTree in lib/navigation/sidebar.ts!');
