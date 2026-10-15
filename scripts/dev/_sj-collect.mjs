import fs from "node:fs";
const src = fs.readFileSync("features/journal/components/journal-booking-stock-dashboard.tsx", "utf8");
const re = /\bs\.t\(\s*"([a-z0-9_]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
const out = {};
let m;
while ((m = re.exec(src))) {
  const k = "sj." + m[1];
  const v = JSON.parse('"' + m[2] + '"');
  if (out[k] && out[k] !== v) console.error("CONFLICT", k, out[k], "|", v);
  out[k] = out[k] ?? v;
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, "keys");
