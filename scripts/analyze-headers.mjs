// DEV-only: analyse the harvested headings: long ones, ones without 5-language coverage, and current alignment / size / wrapping.
// Usage: node analyze-headers.mjs headers-en.json
import fs from "node:fs";
const harvest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const src = fs.readFileSync("lib/i18n/table-headers.ts", "utf8");
const dict = new Map();
for (const line of src.split("\n")) {
  const t = line.trimStart();
  if (!t.startsWith('"')) continue;
  const sep = t.indexOf('": {');
  if (sep < 0) continue;
  const key = t.slice(1, sep);
  const objText = t.slice(sep + 3).replace(/,\s*$/, "").replace(/\b(ur|ar|fa|ps):/g, '"$1":');
  try { const o = JSON.parse(objText); if (o.ur !== undefined) dict.set(key, o); } catch { /* not a heading row */ }
}
const norm = (s) => s.trim().replace(/\s+/g, " ").toUpperCase();
const stat = new Map();
for (const [route, tables] of Object.entries(harvest)) for (const tb of tables) for (const h of tb) {
  const k = norm(h.t); const e = stat.get(k) || { text: h.t, routes: new Set(), n: 0, align: {}, size: {}, wrap: {} };
  e.routes.add(route); e.n++; e.align[h.a] = (e.align[h.a] || 0) + 1; e.size[h.f] = (e.size[h.f] || 0) + 1; e.wrap[h.w] = (e.wrap[h.w] || 0) + 1; stat.set(k, e);
}
const all = [...stat.entries()];
console.log("dictionary rows parsed:", dict.size, "| distinct headings:", all.length, "| total cells:", all.reduce((a, [, e]) => a + e.n, 0));
const agg = (key) => { const o = {}; for (const [, e] of all) for (const [k, v] of Object.entries(e[key])) o[k] = (o[k] || 0) + v; return o; };
console.log("alignment now:", JSON.stringify(agg("align")), "| font sizes:", JSON.stringify(agg("size")), "| white-space:", JSON.stringify(agg("wrap")));
const isData = (t) => /^[\d\s.,:\-—–#%/()+]*$/.test(t) || t.length <= 1;
const rows = all.filter(([, e]) => !isData(e.text));
const long = rows.filter(([, e]) => e.text.length > 20).sort((a, b) => b[1].text.length - a[1].text.length);
const missing = rows.filter(([k]) => !dict.has(k) && !dict.has(k.replace(/:$/, "")));
const longTrans = [];
for (const [k, e] of rows) { const d = dict.get(k); if (!d) continue; for (const l of ["ur", "ar", "fa", "ps"]) if (d[l].length > 20) longTrans.push([e.text, l, d[l]]); }
console.log(`English headings > 20 chars: ${long.length}; headings with NO 5-language entry: ${missing.length}; translated values > 20 chars: ${longTrans.length}`);
fs.writeFileSync("C:/Users/dgtll/AppData/Local/Temp/rs/headers-analysis.json", JSON.stringify({ long: long.map(([, e]) => ({ text: e.text, routes: e.routes.size })), missing: missing.map(([, e]) => ({ text: e.text, routes: e.routes.size })), longTrans }, null, 1));
for (const [, e] of long.slice(0, 80)) console.log("LONG", e.text.length, "|", e.text);
