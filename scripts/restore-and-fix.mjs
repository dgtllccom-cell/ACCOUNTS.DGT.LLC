import { execSync } from 'child_process';
import fs from 'fs';

console.log("Restoring open-purchase-a4-report-window.ts from git...");
execSync('git checkout lib/reports/open-purchase-a4-report-window.ts', { stdio: 'inherit' });

const filePath = 'lib/reports/open-purchase-a4-report-window.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replace trailing extra closing brace
content = content.replace(/\}\s*\}\s*$/, '}\n');

fs.writeFileSync(filePath, content);
console.log("Cleaned extra closing brace in open-purchase-a4-report-window.ts");
