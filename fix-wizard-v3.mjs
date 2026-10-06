// fix-wizard-v3.mjs - Run with: node fix-wizard-v3.mjs
// Uses EXACT line number surgery, no fuzzy content matching.
import { readFileSync, writeFileSync } from 'fs';

const file = 'features/sales/components/sales-order-wizard.jsx';
const raw = readFileSync(file, 'utf8');
const lines = raw.split('\n');
console.log(`Total lines: ${lines.length}`);

// ── STEP 1: Find the exact corrupt block boundaries by content ───────────────
// We know the corrupt block starts at the line containing:
//   <div className="border-t border-border/40 pt-1 mt-1">
// RIGHT AFTER the company dropdown closes (line ~902), and ends just before:
//   <div className="relative" ref={salesDropdownRef}>

let blockStart = -1;
let blockEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('border-t border-border/40 pt-1 mt-1') && blockStart === -1) {
    blockStart = i;
    console.log(`Found blockStart at line ${i+1}: ${lines[i].trim()}`);
  }
  if (blockStart !== -1 && lines[i].includes('ref={salesDropdownRef}')) {
    blockEnd = i;
    console.log(`Found blockEnd (salesDropdownRef) at line ${i+1}: ${lines[i].trim()}`);
    break;
  }
}

if (blockStart === -1 || blockEnd === -1) {
  console.error('ERROR: Could not find block boundaries!');
  console.log('Looking for border-t...');
  lines.forEach((l, i) => { if (l.includes('border-t border-border/40')) console.log(`  ${i+1}: ${l.trim()}`); });
  console.log('Looking for salesDropdownRef...');
  lines.forEach((l, i) => { if (l.includes('salesDropdownRef')) console.log(`  ${i+1}: ${l.trim()}`); });
  process.exit(1);
}

console.log(`\nWill replace lines ${blockStart+1} to ${blockEnd} (0-indexed ${blockStart} to ${blockEnd-1})`);
console.log('--- Lines being replaced ---');
for (let i = blockStart; i < blockEnd; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

// The replacement: close the company dropdown correctly,
// then open the sales account section (salesDropdownRef div is kept from blockEnd)
const replacement = [
  `                        </div>`,
  `                      </div>`,
  `                    )}`,
  `                  </div>`,
  ``,
];

console.log('\n--- Replacement ---');
replacement.forEach((l, i) => console.log(`  ${i}: ${l}`));

lines.splice(blockStart, blockEnd - blockStart, ...replacement);
console.log(`\nTotal lines after fix: ${lines.length}`);

writeFileSync(file, lines.join('\n'), 'utf8');
console.log('✅ Saved.');

// Verify
const after = readFileSync(file, 'utf8').split('\n');
console.log('\n--- Result (15 lines around fix) ---');
for (let i = Math.max(0, blockStart - 3); i < blockStart + replacement.length + 5; i++) {
  console.log(`${i+1}: ${after[i]}`);
}
