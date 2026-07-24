const fs = require('fs');
const diff = fs.readFileSync('c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC\\public\\git_debug.txt', 'utf-8');
const lines = diff.split('\n');
let found = false;
let out = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Shipping & Loading Details')) found = true;
  if (found) {
    out.push(lines[i]);
    if (out.length > 100) break;
  }
}
console.log(out.join('\n'));
