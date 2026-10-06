import fs from 'fs';

const content = fs.readFileSync('lib/i18n/ui.ts', 'utf8');

// Find all occurrences of "nav.entry_register"
const matches = [];
const regex = /"nav\.entry_register":\s*"([^"]+)"/g;
let m;
while ((m = regex.exec(content)) !== null) {
  matches.push({ index: m.index, val: m[1] });
}

console.log('Matches found for "nav.entry_register":', matches);
