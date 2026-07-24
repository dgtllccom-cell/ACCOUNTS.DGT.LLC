const fs = require('fs');
const file = 'c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/features/journal/components/purchase-order-payment-journal.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const startLine = 3307;
const endLine = 3587;
const target = lines.slice(startLine - 1, endLine).join('\n');
const replacementFile = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/7f9559da-435d-431f-b7a2-0debadb5c9b4/scratch/sub_table_logic.tsx';
const replacementRaw = fs.readFileSync(replacementFile, 'utf8');
const replacement = replacementRaw.substring(replacementRaw.indexOf('`') + 1, replacementRaw.lastIndexOf('`'));

const newContent = content.replace(target, replacement);
fs.writeFileSync(file, newContent, 'utf8');
console.log('Replaced lines 3307 to 3587 successfully!');
