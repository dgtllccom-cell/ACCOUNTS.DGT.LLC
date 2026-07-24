const fs = require('fs');
const lines = fs.readFileSync('c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC\\features\\purchases\\components\\purchase-order-wizard.jsx', 'utf-8').split('\n');
const results = [];
lines.forEach((line, i) => {
  if (line.includes('PRICE (') || line.includes('AMOUNT (')) {
    results.push(`${i+1}: ${line}`);
  }
});
console.log(results.join('\n'));
