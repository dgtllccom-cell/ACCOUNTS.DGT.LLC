import fs from 'fs';

const sidebarFile = 'lib/navigation/sidebar.ts';
const content = fs.readFileSync(sidebarFile, 'utf8');

// We want to extract each node from the file based on the node block
// Let's find each top-level object:

const rawNodes = [];

// Regex to find top level objects in sidebarTree:
const header = content.slice(0, content.indexOf('export const sidebarTree: SidebarNode[] = [') + 'export const sidebarTree: SidebarNode[] = ['.length);
const footer = content.slice(content.lastIndexOf('];'));

const treeBody = content.slice(content.indexOf('export const sidebarTree: SidebarNode[] = [') + 'export const sidebarTree: SidebarNode[] = ['.length, content.lastIndexOf('];'));

// Let's parse all top level nodes in treeBody using bracket counting
let depth = 0;
let currentBlock = '';
let inString = false;
let stringChar = '';
let escape = false;

for (let i = 0; i < treeBody.length; i++) {
  const char = treeBody[i];

  if (escape) {
    escape = false;
    currentBlock += char;
    continue;
  }

  if (char === '\\') {
    escape = true;
    currentBlock += char;
    continue;
  }

  if (inString) {
    if (char === stringChar) {
      inString = false;
    }
    currentBlock += char;
    continue;
  }

  if (char === '"' || char === "'" || char === '`') {
    inString = true;
    stringChar = char;
    currentBlock += char;
    continue;
  }

  if (char === '{') {
    depth++;
    currentBlock += char;
  } else if (char === '}') {
    depth--;
    currentBlock += char;
    if (depth === 0) {
      // Finished a top-level node!
      const trimmed = currentBlock.trim();
      if (trimmed.startsWith('{')) {
        // Extract key
        const keyMatch = trimmed.match(/key:\s*"([^"]+)"/);
        if (keyMatch) {
          rawNodes.push({ key: keyMatch[1], code: trimmed });
        }
      }
      currentBlock = '';
    }
  } else {
    if (depth > 0) {
      currentBlock += char;
    }
  }
}

console.log('Extracted top-level nodes count:', rawNodes.length);
console.log('Extracted keys:', rawNodes.map(r => r.key));

// Map by key
const nodeMap = {};
for (const n of rawNodes) {
  nodeMap[n.key] = n.code;
}

// Exact desired order from user's voice note:
// 1. Dashboard
// 2. New Entry
// 3. Ledgers
// 4. Daily Payment Entry / Roznamcha (journal)
// 5. Purchase
// 6. Sales
// 7. Inter-Country Trade & Transfers
// 8. General Office Management
// 9. Journal Stock / Inventory
// 10. Shipping Line / Customs Clearing
// 11. SMART CRM / Due & Followups
// 12. Tax & E-Invoicing (VAT / FTA)
// 13. Settlement & Reconciliation
// 14. Document Management & Hard Copy Center
// 15. Enterprise Audit & Monitoring / Super Admin
// 16. KYC Reports
// 17. Tax
// 18. Smart Due Center
// 19. Super Admin Menu
// 20. Reports & Analytics Hub
// 21. Message & WhatsApp System
// 22. Settings & Configurations
// 23. ERP Master System Journal & Complete Handover PDF
// 24. System Walkthrough Video Guide

const desiredOrder = [
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

const formattedNodes = [];
for (const key of desiredOrder) {
  if (nodeMap[key]) {
    formattedNodes.push('  ' + nodeMap[key]);
  } else {
    console.warn('Missing node in nodeMap:', key);
  }
}

// Check if any nodes were missed
for (const k of Object.keys(nodeMap)) {
  if (!desiredOrder.includes(k)) {
    console.log('Appending extra unlisted node:', k);
    formattedNodes.push('  ' + nodeMap[k]);
  }
}

const finalFileContent = header + '\n' + formattedNodes.join(',\n') + '\n' + footer;
fs.writeFileSync(sidebarFile, finalFileContent, 'utf8');
console.log('✅ Applied perfectly reordered sidebarTree to lib/navigation/sidebar.ts!');
