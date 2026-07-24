import fs from 'fs';

const code = fs.readFileSync('features/journal/components/purchase-order-payment-journal.tsx', 'utf8');

// Use simple regex scan for function blocks
const lines = code.split('\n');
let depth = 0;
let log = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inStr = false, quote = '';
  
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (!inStr && c === '/' && line[j+1] === '/') break;
    if (inStr) {
      if (c === quote && line[j-1] !== '\\') inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = true; quote = c; continue;
    }
    if (c === '{') depth++;
    if (c === '}') depth--;
  }
  if (depth < 0) {
    log.push(`Line ${i+1}: DEPTH DROPPED BELOW 0: ${line.trim()}`);
    depth = 0;
  }
}

log.push(`FINAL DEPTH AT END OF FILE: ${depth}`);
fs.writeFileSync('syntax-error.txt', log.join('\n'));
