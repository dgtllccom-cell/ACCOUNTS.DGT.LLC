/**
 * PNG previews of the design mockups for owner review → docs/store/design/previews/ (static mockups only: placeholders, no business data).
 *   node scripts/make-design-previews.mjs
 */
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";

const DIR = path.resolve("docs/store/design");
const U = "file:///" + DIR.split(path.sep).join("/");
const OUT = path.join(DIR, "previews");
fs.mkdirSync(OUT, { recursive: true });
// [app, device, lang, mode, screen id]
const JOBS = [
  // first-dashboards review set
  ...["b:d1", "bs:d3"].flatMap((x) => { const [app, id] = x.split(":"); return [["phone", "en", "day"], ["phone", "ur", "day"], ["phone", "en", "night"], ["tablet", "en", "day"], ["tablet", "ur", "day"]].map(([d, l, m]) => [app, d, l, m, id]); }),
  // access, navigation, modules, tracking, accounts, settings
  ["b", "phone", "en", "day", "a2"], ["b", "phone", "ur", "day", "a5"], ["bs", "phone", "ar", "day", "a4"], ["b", "tablet", "ar", "day", "a7"],
  ["b", "phone", "en", "day", "n1"], ["bs", "phone", "ps", "night", "n3"], ["bs", "tablet", "en", "day", "s3"], ["bs", "phone", "fa", "day", "s4"],
  ["b", "phone", "ur", "day", "m2"], ["b", "tablet", "en", "day", "m1"], ["b", "phone", "en", "day", "r1"], ["b", "phone", "ar", "day", "r4"],
  ["bs", "phone", "en", "day", "t1"], ["b", "phone", "ur", "day", "p1"], ["b", "phone", "fa", "day", "p2"]
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 1 });
let n = 0;
for (const [app, device, lang, mode, id] of JOBS) {
  await page.goto(`${U}/mockups.html?app=${app}&device=${device}&lang=${lang}&mode=${mode}&view=full`, { waitUntil: "load" });
  await page.addStyleTag({ content: ".dg-bar,.dg-note{display:none!important}" });
  await page.waitForTimeout(250);
  const el = await page.$(`#s-${id} .bezel`);
  if (!el) { console.log("missing", app, id); continue; }
  await el.screenshot({ path: path.join(OUT, `${id}-${app}-${device}-${lang}-${mode}.png`) });
  n++;
}
await browser.close();
console.log(`wrote ${n} previews to docs/store/design/previews`);
