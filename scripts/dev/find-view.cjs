const fs = require('fs');
const lines = fs.readFileSync('features/clearing-agent/components/truck-recreation-wizard.tsx', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('view === "list"') || l.includes("view === 'list'")) {
    console.log(i + 1, l.slice(0, 60));
  }
});
