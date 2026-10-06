import fs from 'fs';

const content = fs.readFileSync('features/journal/components/purchase-order-payment-journal.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
let output = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inStr = false;
  let quote = '';
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    // Ignore inline comments
    if (!inStr && char === '/' && line[j+1] === '/') break;
    
    if (inStr) {
      if (char === quote && line[j-1] !== '\\') inStr = false;
      continue;
    }
    
    if (char === '"' || char === "'" || char === '`') {
      inStr = true;
      quote = char;
      continue;
    }
    
    if (char === '{') {
      stack.push({ line: i + 1, col: j + 1, snippet: line.trim() });
    } else if (char === '}') {
      if (stack.length === 0) {
        output.push(`UNMATCHED CLOSING BRACE } at line ${i + 1}:${j + 1}`);
      } else {
        stack.pop();
      }
    }
  }
}

output.push(`TOTAL UNCLOSED BRACES: ${stack.length}`);
if (stack.length > 0) {
  output.push("UNCLOSED BRACES LIST:");
  stack.forEach(s => output.push(`Line ${s.line}:${s.col} -> ${s.snippet}`));
}

fs.writeFileSync('braces-output.txt', output.join('\n'));
console.log("Done writing braces-output.txt");
