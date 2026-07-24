// fix-wizard-v5.mjs - Run with: node fix-wizard-v5.mjs
// Removes the duplicate pin-button block injected inside the sales accounts list div.
import { readFileSync, writeFileSync } from 'fs';

const file = 'features/sales/components/sales-order-wizard.jsx';
const raw = readFileSync(file, 'utf8');
const lines = raw.split('\n');
console.log(`Total lines: ${lines.length}`);

// Find the first occurrence of `<div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">`
// inside the sales dropdown section (which comes after salesDropdownRef).
// There should be TWO of these - one at ~line 1017 (bad) and one at ~line 1038 (good with .map after it).
// We want to delete from line 1017 up to (but not including) line 1038.

// Strategy: find the line with max-h-64 that is immediately followed by the
// stray <button (not by the .map call), and delete through to the next max-h-64.

let firstMaxH64 = -1;
let secondMaxH64 = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('max-h-64 overflow-y-auto space-y-1.5 pr-0.5')) {
    if (firstMaxH64 === -1) {
      firstMaxH64 = i;
      console.log(`First max-h-64 at line ${i+1}: ${lines[i].trim()}`);
    } else {
      secondMaxH64 = i;
      console.log(`Second max-h-64 at line ${i+1}: ${lines[i].trim()}`);
      break;
    }
  }
}

if (firstMaxH64 === -1 || secondMaxH64 === -1) {
  console.error('Could not find both max-h-64 divs!');
  process.exit(1);
}

// Check: the line after firstMaxH64 should be the stray <button, not the .map call
console.log(`\nLine after first max-h-64 (${firstMaxH64+2}): ${lines[firstMaxH64+1].trim()}`);
console.log(`Line after second max-h-64 (${secondMaxH64+2}): ${lines[secondMaxH64+1].trim()}`);

// Delete from firstMaxH64+1 through secondMaxH64 (i.e., remove the bad block,
// keeping the first max-h-64 div and jumping to the second one's content)
const deleteStart = firstMaxH64 + 1; // line after first max-h-64
const deleteEnd = secondMaxH64;      // up to (not including) second max-h-64

console.log(`\nDeleting lines ${deleteStart+1} to ${deleteEnd} (${deleteEnd - deleteStart} lines)`);
console.log('--- Lines being deleted ---');
for (let i = deleteStart; i < deleteEnd; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

lines.splice(deleteStart, deleteEnd - deleteStart);
console.log(`\nTotal lines after fix: ${lines.length}`);
writeFileSync(file, lines.join('\n'), 'utf8');
console.log('✅ Saved.');

// Verify
const after = readFileSync(file, 'utf8').split('\n');
console.log('\n--- Result (10 lines around fix) ---');
for (let i = Math.max(0, firstMaxH64 - 2); i < firstMaxH64 + 8 && i < after.length; i++) {
  console.log(`${i+1}: ${after[i]}`);
}
