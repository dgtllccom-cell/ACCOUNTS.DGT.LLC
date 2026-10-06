import fs from 'fs';

const files = [
  'features/journal/components/purchase-order-payment-journal.tsx',
  'features/journal/components/sales-order-payment-journal.tsx',
  'features/purchases/components/purchase-booking-journal-report-view.tsx'
];

for (const f of files) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    const before = content;
    content = content.replaceAll('â€”', '—');
    content = content.replaceAll('âœ ', '✓');
    content = content.replaceAll('â”€', '─');
    if (content !== before) {
      fs.writeFileSync(f, content, 'utf8');
      console.log(`Cleaned mojibake in ${f}`);
    } else {
      console.log(`No mojibake in ${f}`);
    }
  }
}
