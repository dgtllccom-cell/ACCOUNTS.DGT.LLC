import fs from 'fs';

const content = fs.readFileSync('lib/navigation/sidebar.ts', 'utf8');
const lines = content.split('\n');

const topNodes = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (i >= 60 && /^(\s{2}|\s{4}|\s{6})\{\s*$/.test(l)) {
    const nextL = lines[i + 1] || '';
    const match = nextL.match(/key:\s*"([^"]+)"/);
    if (match) {
      const indent = nextL.search(/\S/);
      if (indent === 4 || indent === 6 || indent === 8) {
        topNodes.push({ key: match[1], line: i + 1, indent });
      }
    }
  }
}

console.log('All candidate nodes:', topNodes);
