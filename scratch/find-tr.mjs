import fs from 'fs';

const filePath = 'components/layout/digital-dock-premium-sidebar.tsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (/\btr\s*\(/.test(line)) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
