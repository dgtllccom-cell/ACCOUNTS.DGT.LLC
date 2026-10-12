// DEV only: compare the posting payloads captured from the OLD and NEW build (cash-post-capture.mjs). usage: node cash-post-diff.mjs <dir>
import fs from "node:fs";
const dir = process.argv[2];
const VOLATILE = new Set(["journalNo", "voucherNo"]); // generated per submission (J-YYYYMMDD-xxxx / V-YYYYMMDD-xxxx)
const norm = (v) => JSON.parse(JSON.stringify(v, (k, x) => (VOLATILE.has(k) ? "<generated>" : x)));
let bad = 0;
for (const sc of ["debit", "credit"]) {
  const a = norm(JSON.parse(fs.readFileSync(`${dir}/old-${sc}.json`, "utf8")).payload);
  const b = norm(JSON.parse(fs.readFileSync(`${dir}/new-${sc}.json`, "utf8")).payload);
  const flat = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const fa = Object.fromEntries(flat(a)), fb = Object.fromEntries(flat(b));
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  const diffs = [...keys].filter((k) => JSON.stringify(fa[k]) !== JSON.stringify(fb[k]));
  console.log(`${sc}: ${keys.size} payload fields compared — ${diffs.length === 0 ? "IDENTICAL" : "DIFFERENT"}`);
  diffs.forEach((k) => { bad++; console.log(`  ${k}: old=${JSON.stringify(fa[k])} new=${JSON.stringify(fb[k])}`); });
}
process.exit(bad ? 1 : 0);
