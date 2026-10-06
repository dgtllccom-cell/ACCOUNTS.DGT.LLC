import fs from 'fs';

const filePath = 'features/journal/components/purchase-order-payment-journal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Let's check brace count in entire file
let count = 0;
let inString = false, quote = '';
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (!inString && c === '/' && content[i+1] === '/') {
    // skip to newline
    while (i < content.length && content[i] !== '\n') i++;
    continue;
  }
  if (inString) {
    if (c === quote && content[i-1] !== '\\') inString = false;
    continue;
  }
  if (c === '"' || c === "'" || c === '`') {
    inString = true; quote = c; continue;
  }
  if (c === '{') count++;
  if (c === '}') count--;
}

console.log("Overall Brace Net Count:", count);

if (count > 0) {
  console.log(`Adding ${count} missing closing brace(s) at end of file...`);
  const missing = '\n' + '}'.repeat(count) + '\n';
  fs.writeFileSync(filePath, content + missing);
  console.log("File updated successfully.");
} else if (count < 0) {
  console.log("Too many closing braces by:", Math.abs(count));
} else {
  console.log("Brace balance is exact 0!");
}
