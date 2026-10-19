const fs = require('fs');

const UI_PATH = 'lib/i18n/ui.ts';
let content = fs.readFileSync(UI_PATH, 'utf8');

const scriptContent = fs.readFileSync('scripts/dev/add-payment-tracking-i18n.cjs', 'utf8');
const match = scriptContent.match(/const KEYS = (\[[\s\S]*?\]);\s*\/\/ Check/);
if (!match) {
  console.error("Could not extract KEYS");
  process.exit(1);
}
const keys = eval(match[1]);

const psEntries = keys.map(k => `  "${k.key}": "${k.ps}",`).join('\n');
const psTarget = '  "trk.registered_truck_title": "د کلیرنس د لارۍ راجستر",';

if (!content.includes('"paytrack.due_date": "د موافقه شوې تادیې نېټه"')) {
  if (content.includes(psTarget)) {
    content = content.replace(psTarget, `${psEntries}\n${psTarget}`);
    fs.writeFileSync(UI_PATH, content, 'utf8');
    console.log(`Added ${keys.length} keys to PS block in ui.ts!`);
  } else {
    console.error("psTarget not found in ui.ts!");
  }
} else {
  console.log("Already present in PS block");
}
