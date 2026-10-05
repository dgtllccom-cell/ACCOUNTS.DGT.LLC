// DEV-only: list every literal table-heading text in the source (<Th>/<th> children) with its length, to plan concise headings.
import fs from "node:fs";
import path from "node:path";
const roots = ["features", "components", "app"]; const counts = new Map(); let files = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p); } else if (/\.(tsx|jsx)$/.test(e.name)) scan(p); } };
const re = /<(?:Th|th)\b[^>]*>\s*([^<{}][^<{}]*?)\s*<\/(?:Th|th)>/g;
function scan(p) { const s = fs.readFileSync(p, "utf8"); let m, any = false; while ((m = re.exec(s))) { const t = m[1].replace(/\s+/g, " ").trim(); if (!t || /^[\d\s.\-—–#%]+$/.test(t)) continue; counts.set(t, (counts.get(t) || 0) + 1); any = true; } if (any) files++; }
for (const r of roots) walk(r);
const all = [...counts.entries()].sort((a, b) => b[1] - a[1]);
fs.writeFileSync(process.argv[2] || "headers-static.json", JSON.stringify(all, null, 0));
const long = all.filter(([t]) => t.length > 22);
console.log(`distinct headings: ${all.length}, in ${files} files; longer than 22 chars: ${long.length}; longer than 30: ${all.filter(([t]) => t.length > 30).length}`);
for (const [t, c] of long.slice(0, 40)) console.log(c, "|", t);
