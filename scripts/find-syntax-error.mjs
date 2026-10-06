import fs from 'fs';

const content = fs.readFileSync('features/journal/components/purchase-order-payment-journal.tsx', 'utf8');
const lines = content.split('\n');

let braceStack = [];
let inString = false;
let stringChar = '';
let inTemplate = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    // Ignore line comments
    if (!inString && char === '/' && line[j + 1] === '/') {
      break;
    }
    
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
      braceStack.push({ line: i + 1, col: j + 1, text: line.trim() });
    } else if (char === '}') {
      if (braceStack.length === 0) {
        console.log(`Extra closing brace at line ${i + 1}:${j + 1}`);
      } else {
        braceStack.pop();
      }
    }
  }
}

console.log(`Unclosed braces count: ${braceStack.length}`);
if (braceStack.length > 0) {
  console.log("Unclosed braces starting from:");
  braceStack.slice(-5).forEach(b => {
    console.log(`Line ${b.line}:${b.col} -> ${b.text}`);
  });
}
