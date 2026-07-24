import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/features/purchases/components/local-purchase-journal-report-view.tsx', 'utf8');
const tagRegex = /(<\/?[A-Za-z0-9_.-]+(?:\s+[^>]*?)?>)/gs;

// Let's test matches starting around line 620
const lines = content.split('\n');
const subContent = lines.slice(610, 660).join('\n');

let output = "Subcontent:\n" + subContent + "\n\nMatches:\n";
const matches = subContent.matchAll(tagRegex);
for (const m of matches) {
    output += `- Match: ${JSON.stringify(m[0])}\n`;
}

fs.writeFileSync('c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/scratch/debug-output.txt', output, 'utf8');
console.log("Wrote output to c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/scratch/debug-output.txt");
