import fs from 'fs';

const content = fs.readFileSync('b:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts', 'utf8');

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('const en') || line.includes('const ar') || line.includes('const ur') || line.includes('const fa') || line.includes('const ps') || line.includes('dictionaries: Record')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
}
