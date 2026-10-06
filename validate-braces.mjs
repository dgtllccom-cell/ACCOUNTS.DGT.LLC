import fs from 'fs';

const content = fs.readFileSync('features/journal/components/purchase-order-payment-journal.tsx', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;
let inString = false;
let stringChar = '';
let inComment = false;
let inRegex = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    // Simple string / comment bypass
    if (inString) {
      if (char === stringChar && line[j - 1] !== '\\') {
        inString = false;
      }
      continue;
    }
    
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount < 0) {
        console.log(`Unmatched } at line ${i + 1}, column ${j + 1}`);
      }
    } else if (char === '(') {
      parenCount++;
    } else if (char === ')') {
      parenCount--;
      if (parenCount < 0) {
        console.log(`Unmatched ) at line ${i + 1}, column ${j + 1}`);
      }
    }
  }
}

console.log(`Total Braces Open: ${braceCount}`);
console.log(`Total Parentheses Open: ${parenCount}`);
