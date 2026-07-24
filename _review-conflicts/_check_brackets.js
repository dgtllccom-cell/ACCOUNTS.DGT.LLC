const fs = require('fs');
const lines = fs.readFileSync('features/journal/components/journal-report.tsx', 'utf8').split('\n');

// Find the return statement
let returnLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim().startsWith('return (') || lines[i].trim() === 'return (') {
    returnLine = i;
    break;
  }
}
console.log('Return statement at line:', returnLine + 1);

// Count brackets from return statement to end
let parenDepth = 0;  // ()
let braceDepth = 0;  // {}
let divDepth = 0;    // <div> </div>

for (let i = returnLine; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  // Count parens (excluding those in strings/attributes)
  const openParens = (line.match(/\(/g) || []).length;
  const closeParens = (line.match(/\)/g) || []).length;
  
  // Count braces
  const openBraces = (line.match(/\{/g) || []).length;
  const closeBraces = (line.match(/\}/g) || []).length;
  
  // Count divs
  const openDivs = (line.match(/<div[\s>]/g) || []).length;
  const closeDivs = (line.match(/<\/div>/g) || []).length;
  
  parenDepth += openParens - closeParens;
  braceDepth += openBraces - closeBraces;
  divDepth += openDivs - closeDivs;
  
  // Print lines where depth changes significantly or near the end
  if (lineNum >= 1185 || (openParens !== closeParens && lineNum > 700) || (openDivs !== closeDivs && divDepth <= 2 && lineNum > 700)) {
    console.log(`L${lineNum} p=${parenDepth} b=${braceDepth} d=${divDepth}  ${line.trim().substring(0, 70)}`);
  }
}

console.log('\n=== FINAL DEPTHS ===');
console.log('Parens:', parenDepth, '(should be 0)');
console.log('Braces:', braceDepth, '(should be 0)');
console.log('Divs:', divDepth, '(should be 0)');

// Now find ALL lines where divDepth goes to specific values
console.log('\n=== DIV DEPTH TRACE (key moments) ===');
divDepth = 0;
for (let i = returnLine; i < lines.length; i++) {
  const line = lines[i];
  const openDivs = (line.match(/<div[\s>]/g) || []).length;
  const closeDivs = (line.match(/<\/div>/g) || []).length;
  const prevDepth = divDepth;
  divDepth += openDivs - closeDivs;
  // Show when we reach depth 0 or 1
  if (divDepth <= 1 && prevDepth !== divDepth) {
    console.log(`L${i+1} div_depth: ${prevDepth} -> ${divDepth}  ${line.trim().substring(0, 60)}`);
  }
}
