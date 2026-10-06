const fs = require('fs');

const path = 'c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC\\features\\purchases\\components\\purchase-order-wizard.jsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Find the start and end of GLOBAL INFO CARDS
const startIdx = lines.findIndex(line => line.includes('{/* GLOBAL INFO CARDS (Always visible at top) */}'));
let endIdx = -1;

// The block ends right before } // End of activeTab === "report" or something.
// Actually we know it ends at 4203 `          </div>`
for (let i = startIdx + 1; i < lines.length; i++) {
  if (lines[i].includes('        {activeTab === "report" && (')) {
    endIdx = i - 1;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  // Extract the cards
  const cardsBlock = lines.slice(startIdx, endIdx);
  
  // Remove the cards
  lines.splice(startIdx, endIdx - startIdx);
  
  // Find where to insert (before GOODS LIST TABLE)
  const insertIdx = lines.findIndex(line => line.includes('{/* GOODS LIST TABLE */}'));
  if (insertIdx !== -1) {
    lines.splice(insertIdx, 0, ...cardsBlock);
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Success!');
  } else {
    console.log('Could not find insert point.');
  }
} else {
  console.log('Could not find start/end points.', startIdx, endIdx);
}
