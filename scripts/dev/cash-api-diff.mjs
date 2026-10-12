// DEV only: compare two cash-api-baseline outputs (before/after a design change). usage: node cash-api-diff.mjs before.json after.json
import fs from "node:fs";
const norm = (k) => k.replace(/([?&])_t=\d+/g, "$1").replace(/[?&]$/, "").replace(/&&/g, "&");
const load = (f) => Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(f, "utf8"))).map(([k, v]) => [norm(k), v]));
const a = load(process.argv[2]), b = load(process.argv[3]);
let bad = 0;
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (!(k in a)) { console.log("ONLY AFTER ", k.slice(0, 100)); bad++; continue; }
  if (!(k in b)) { console.log("ONLY BEFORE", k.slice(0, 100)); bad++; continue; }
  const same = JSON.stringify(a[k]) === JSON.stringify(b[k]);
  if (!same) { bad++; console.log("DIFF       ", k.slice(0, 100)); }
}
console.log(bad === 0 ? `IDENTICAL: ${Object.keys(a).length} endpoints` : `${bad} difference(s)`);
process.exit(bad ? 1 : 0);
