import fs from 'fs';

const uiFilePath = 'lib/i18n/ui.ts';
let content = fs.readFileSync(uiFilePath, 'utf8');

// Replace duplicate occurrences of identical lines in Dict objects
const lines = content.split('\n');
const seen = new Set();
const cleanLines = [];
let insideDict = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes(': Dict = {')) {
    insideDict = true;
    seen.clear();
    cleanLines.push(line);
    continue;
  }
  if (insideDict && line.trim() === '};') {
    insideDict = false;
    cleanLines.push(line);
    continue;
  }
  if (insideDict) {
    const trimmed = line.trim();
    if (trimmed.startsWith('"nav.') || trimmed.startsWith('"rep.') || trimmed.startsWith('"sae.')) {
      const match = trimmed.match(/^"([^"]+)":/);
      if (match) {
        const key = match[1];
        if (seen.has(key)) {
          continue; // skip duplicate key in this dict
        }
        seen.add(key);
      }
    }
  }
  cleanLines.push(line);
}

fs.writeFileSync(uiFilePath, cleanLines.join('\n'), 'utf8');
console.log('✓ Cleaned and deduplicated ui.ts dictionaries successfully!');
