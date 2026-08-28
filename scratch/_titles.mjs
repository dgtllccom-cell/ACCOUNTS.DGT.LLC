import fs from "node:fs";
import { execSync } from "node:child_process";

const files = execSync('find app -name page.tsx', {encoding:'utf8'}).trim().split('\n').sort();

// Curated titles for hub / top-level pages (path from app/ without /page.tsx)
const CURATED = {
  "dashboard/accounts": "Account Master Registry & Search",
  "dashboard/accounts/setup": "New Account Entry",
  "dashboard/accounts/summary": "Accounts Summary",
  "dashboard/accounts/view": "Account Ledger View",
  "dashboard/ledger": "Ledger Hub",
  "dashboard/ledger/country": "Country Ledger",
  "dashboard/ledger/branch": "Branch Ledger",
  "dashboard/ledger/detailed": "Detailed Ledger",
  "dashboard/ledger/outstanding": "Outstanding Balances Ledger",
  "dashboard/ledger/new": "New Ledger Entry",
  "dashboard/ledger/general-report": "Ledger General Report",
  "dashboard/companies": "Companies & Branches",
  "dashboard/clearing-agent": "Clearing Agent Workspace",
  "dashboard/clearing-agents": "Clearing Agents Directory",
  "dashboard/crm": "Smart CRM / Due & Follow-Up Control Center",
  "dashboard/crm/reports": "CRM Reports",
  "dashboard/employees": "Employees",
  "dashboard/companies/general-office": "General Office Management",
  "dashboard/documents": "Document Management & Hardware Scanner",
  "dashboard/inventory": "Stock & Inventory Management",
  "dashboard/reports": "Reports Center",
  "dashboard/settlement": "Settlement & Reconciliation",
  "dashboard/agent": "Agent Dashboard",
  "dashboard/city": "City Branch Dashboard",
  "dashboard/country": "Country Dashboard",
  "dashboard/super-admin": "Super Admin Dashboard",
};

function titleFromPath(rel) {
  // rel like "dashboard/journal/sales-order-payment/advance"
  let parts = rel.split('/').filter(p => p && p !== 'dashboard' && !/^\[.*\]$/.test(p) && !/^\(.*\)$/.test(p));
  if (parts.length === 0) parts = ['Dashboard'];
  const words = parts.map(p => p.replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase()));
  // de-dup consecutive repeats
  const dedup = words.filter((w,i)=> i===0 || w.toLowerCase()!==words[i-1].toLowerCase());
  return dedup.join(' — ');
}

let added = 0, skipped = 0, clientPages = [], errors = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (/title:\s*["'`]|generateMetadata|<title>/.test(src)) { skipped++; continue; }
  const rel = f.replace(/^app\//,'').replace(/\/page\.tsx$/,'');
  const isClient = /^\s*["']use client["']/m.test(src.slice(0, 500));
  if (isClient) { clientPages.push(f); continue; }
  const title = CURATED[rel] || titleFromPath(rel);
  // insert after the last import line at top of file, else at very top
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    if (/^import\s|^\}\s*from\s|^\s+from\s+["']/.test(lines[i])) lastImport = i;
    if (/^(export\s+)?(async\s+)?(default\s+)?function\s|^export\s+default\s|^const\s+\w+\s*=/.test(lines[i]) && lastImport >= 0) break;
  }
  const inject = `\nexport const metadata = { title: ${JSON.stringify(title)} };\n`;
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, inject);
  } else {
    lines.unshift(inject.trim() + '\n');
  }
  fs.writeFileSync(f, lines.join('\n'));
  added++;
}
console.log(JSON.stringify({added, skipped, clientPageCount: clientPages.length}, null, 1));
fs.writeFileSync('scratch/_client_pages.txt', clientPages.join('\n'));
