// DEV-only: verify table headings from runtime harvests (one JSON per language) against the heading standard:
//   centred, one moderate size, on one line where practical, translated into the language, concise.
// Usage: node verify-headers.mjs DIR   (DIR has headers-en.json, headers-ur.json, headers-ar.json, headers-fa.json, headers-ps.json)
import fs from "node:fs";
const dir = process.argv[2];
const SCRIPT = { ur: /[؀-ۿ]/, ar: /[؀-ۿ]/, fa: /[؀-ۿ]/, ps: /[؀-ۿ]/ };
const isData = (t) => /^[\d\s.,:\-—–#%/()+*]*$/.test(t) || t.length <= 1 || /^[A-Z0-9 ./#&()-]{1,6}$/.test(t) && !/[AEIOU]{2}/.test(t) && t.length <= 4;
let overall = true;
for (const lang of ["en", "ur", "ar", "fa", "ps"]) {
  const f = `${dir}/headers-${lang}.json`;
  if (!fs.existsSync(f)) { console.log(lang, "NOT HARVESTED"); overall = false; continue; }
  const h = JSON.parse(fs.readFileSync(f, "utf8"));
  let cells = 0, centred = 0, nowrap = 0, tooLong = 0, untranslated = 0, sizes = {}; const longEx = [], untEx = new Map(), notCentred = new Map();
  for (const [route, tables] of Object.entries(h)) for (const t of tables) for (const c of t) {
    if (!c.t) continue; cells++;
    if (c.a === "center") centred++; else notCentred.set(`${route} :: ${c.t}`.slice(0, 90), c.a);
    if (c.w === "nowrap") nowrap++;
    sizes[c.f] = (sizes[c.f] || 0) + 1;
    if (c.t.length > 24) { tooLong++; if (longEx.length < 8) longEx.push(c.t); }
    if (lang !== "en" && !isData(c.t) && !SCRIPT[lang].test(c.t)) { untranslated++; untEx.set(c.t, 1); }
  }
  const pct = (n) => (cells ? ((100 * n) / cells).toFixed(1) + "%" : "-");
  console.log(`[${lang}] heading cells ${cells} | centred ${pct(centred)} | one-line(nowrap) ${pct(nowrap)} | sizes ${JSON.stringify(sizes)} | >24 chars ${tooLong} | untranslated ${untranslated}`);
  if (longEx.length) console.log("   long:", longEx.join(" | "));
  if (untEx.size) console.log("   untranslated (first 12):", [...untEx.keys()].slice(0, 12).join(" | "));
  if (notCentred.size) console.log("   not centred (first 5):", [...notCentred.entries()].slice(0, 5).map(([k, v]) => `${k}=${v}`).join(" | "));
  if (centred !== cells || untranslated || tooLong) overall = false;
}
console.log(overall ? "HEADINGS: ALL CHECKS PASS" : "HEADINGS: ISSUES REMAIN (see above)");
