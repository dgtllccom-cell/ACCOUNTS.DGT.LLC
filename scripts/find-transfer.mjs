import fs from 'fs';
const lines = fs.readFileSync('features/purchases/components/purchase-order-wizard.jsx', 'utf-8').split('\n');
lines.forEach((line, i) => {
  if (line.includes('handleTransfer')) console.log(i + 1, line.trim());
});
