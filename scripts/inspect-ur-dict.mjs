import fs from 'fs';

const content = fs.readFileSync('lib/i18n/ui.ts', 'utf8');

// Find where "const ur: Dict" is defined and print the first 20 lines inside it
const urIdx = content.indexOf('const ur: Dict = {');
console.log('urIdx:', urIdx);
console.log(content.slice(urIdx, urIdx + 500));
