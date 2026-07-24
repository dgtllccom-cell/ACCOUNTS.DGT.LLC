import fs from 'fs';

const content = fs.readFileSync('features/purchases/components/local-purchase-journal-report-view.tsx', 'utf8');
const lines = content.split('\n');

let openDivs = 0;
let closeDivs = 0;

for (let i = 0; i < 612; i++) {
    const line = lines[i];
    const openCount = (line.match(/<div(?:\s|>|$)/g) || []).length;
    const closeCount = (line.match(/<\/div>/g) || []).length;
    
    // Ignore self-closing tags like <div />
    const selfCloseCount = (line.match(/<div\s+[^>]*\/>/g) || []).length;
    
    openDivs += (openCount - selfCloseCount);
    closeDivs += closeCount;
    
    if (openCount > 0 || closeCount > 0) {
        console.log(`Line ${i + 1}: +${openCount - selfCloseCount} Open, -${closeCount} Close. Balance: ${openDivs - closeDivs}`);
    }
}

console.log(`\nFinal up to line 612: Open ${openDivs}, Close ${closeDivs}, Net: ${openDivs - closeDivs}`);
