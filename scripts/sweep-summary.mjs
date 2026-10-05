// DEV-only: summarise the sweep .jsonl results. Usage: node sweep-summary.mjs DIR [--routes]
import fs from "node:fs";
const dir = process.argv[2];
const rows = [];
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("results-"))) for (const l of fs.readFileSync(`${dir}/${f}`, "utf8").split("\n")) { try { rows.push(JSON.parse(l)); } catch {} }
const byKey = new Map(); for (const r of rows) byKey.set(r.key, r); // last result per key wins (re-runs)
const all = [...byKey.values()];
const bad = all.filter((r) => r.bad && r.bad.length);
console.log(`cases: ${all.length}  clean: ${all.length - bad.length}  flagged: ${bad.length}  routes seen: ${new Set(all.map((r) => r.r)).size}`);
const types = {}; for (const r of bad) for (const b of r.bad) types[b.replace(/:.*/, "")] = (types[b.replace(/:.*/, "")] || 0) + 1;
console.log("by type:", JSON.stringify(types));
const byRoute = {}; for (const r of bad) (byRoute[r.r] ||= []).push(r);
for (const [route, list] of Object.entries(byRoute).sort((a, b) => b[1].length - a[1].length)) {
  const t = {}; for (const r of list) for (const b of r.bad) t[b] = (t[b] || 0) + 1;
  const devs = [...new Set(list.map((r) => r.device))];
  console.log(`${list.length}\t${route}\t${JSON.stringify(t)}\t${devs.slice(0, 4).join(",")}${devs.length > 4 ? "+" + (devs.length - 4) : ""}`);
}
const apis = {}; for (const r of all) for (const a of r.badApi || []) apis[a] = (apis[a] || 0) + 1;
const topApi = Object.entries(apis).sort((a, b) => b[1] - a[1]).slice(0, 12); if (topApi.length) console.log("failing API calls:", JSON.stringify(topApi));
const red = {}; for (const r of all) if (r.note) red[`${r.r} -> ${r.note}`] = 1; const rl = Object.keys(red); if (rl.length) console.log("redirects:", rl.length, rl.slice(0, 8).join(" | "));
