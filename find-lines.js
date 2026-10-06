const fs = require('fs');
const content = fs.readFileSync('c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/features/purchases/components/purchase-order-wizard.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('cityBranchId')) {
        console.log(`${i+1}: ${line.trim()}`);
    }
});
