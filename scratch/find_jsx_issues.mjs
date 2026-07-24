import fs from 'fs';
import path from 'path';

const filePath = 'c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/features/purchases/components/purchase-loading-records-view.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`Analyzing ${lines.length} lines in purchase-loading-records-view.tsx...`);

// Stack-based JSX and brace checker
let inJsx = false;
let openBraces = 0;
let openParens = 0;
let openAngles = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check if line contains double slashes inside JSX braces or elements
  if (line.includes('//') && (line.includes('<') || line.includes('>')) && !line.includes('{/*')) {
    console.log(`Possible inline comment in JSX at line ${i + 1}: ${line.trim()}`);
  }

  // Check for stray closing braces at end of file or components
  if (line.trim() === '}}' || line.trim() === '}}}') {
    console.log(`Stray closing braces at line ${i + 1}: ${line}`);
  }

  // Check for unclosed regex pattern /... without trailing /
  const slashCount = (line.match(/\//g) || []).length;
  if (slashCount % 2 !== 0 && line.includes('/') && !line.includes('//') && !line.includes('</') && !line.includes('/>') && !line.includes('http://') && !line.includes('https://')) {
    if (!line.includes('"') && !line.includes("'") && !line.includes('`')) {
      console.log(`Unmatched slash / at line ${i + 1}: ${line.trim()}`);
    }
  }
}
