import { execSync } from 'child_process';
import fs from 'fs';

console.log("Restoring lib/reports/open-purchase-a4-report-window.ts from Git...");
try {
  execSync('git checkout lib/reports/open-purchase-a4-report-window.ts', { stdio: 'pipe' });
} catch (e) {}

const filePath = 'lib/reports/open-purchase-a4-report-window.ts';
let content = fs.readFileSync(filePath, 'utf8');

// The clean file ends at: printStore.openPrint(html, input.title);\n}
const cleanEndMarker = 'printStore.openPrint(html, input.title);\n}';
const idx = content.lastIndexOf(cleanEndMarker);

if (idx !== -1) {
  content = content.substring(0, idx + cleanEndMarker.length) + '\n';
  fs.writeFileSync(filePath, content);
  console.log("Successfully cleaned lib/reports/open-purchase-a4-report-window.ts!");
} else {
  console.log("Marker not found, leaving file intact.");
}
