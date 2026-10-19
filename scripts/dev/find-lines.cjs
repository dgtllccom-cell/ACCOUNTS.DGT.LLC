const fs = require('fs');
const lines = fs.readFileSync('lib/i18n/ui.ts', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('"trk.registered_truck_title"')) {
    console.log(i + 1, l.slice(0, 60));
  }
});
