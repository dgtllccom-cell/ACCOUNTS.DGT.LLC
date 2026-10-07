// DEV-only: turn design-sweep2 results (.jsonl) into the route x language x theme x device PASS/FAIL report.
// Usage: node sweep-report.mjs DIR [OUT.md]   (DIR holds results-*.jsonl; later results for the same key win, so re-runs replace old ones)
// A route is PASS only when every one of its expected cases exists and is clean. Missing or load-failed cases are INCOMPLETE, never PASS.
import fs from "node:fs";

const dir = process.argv[2]; const out = process.argv[3];
const LANGS = ["en", "ur", "ar", "fa", "ps"], THEMES = ["day", "night", "system"];
const SIZES = ["iphone-se", "huawei-p", "iphone15", "samsung-s", "iphone17promax", "iphone17promax-land", "ipad-portrait", "android-tab-portrait", "ipad-landscape", "android-tab-landscape", "laptop-1366", "macbook-13", "desktop-1920", "desktop-2560"];
const routes = fs.readFileSync(process.env.ROUTES || `${dir}/../routes_sweep.txt`, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const byKey = new Map();
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("results-"))) for (const l of fs.readFileSync(`${dir}/${f}`, "utf8").split("\n")) { try { const r = JSON.parse(l); byKey.set(r.key, r); } catch {} }
const EXPECT = LANGS.length * THEMES.length * SIZES.length;
const state = (r) => !r ? "missing" : (r.bad || []).some((b) => b === "loadFailed" || b === "stuckLoading") ? "incomplete" : (r.bad || []).length ? "fail" : "pass";
const rows = [];
for (const route of routes) {
  const per = { pass: 0, fail: 0, incomplete: 0, missing: 0 };
  const lang = Object.fromEntries(LANGS.map((l) => [l, { pass: 0, other: 0 }]));
  const theme = Object.fromEntries(THEMES.map((t) => [t, { pass: 0, other: 0 }]));
  const size = Object.fromEntries(SIZES.map((s) => [s, { pass: 0, other: 0 }]));
  const issues = {};
  for (const l of LANGS) for (const t of THEMES) for (const s of SIZES) {
    const r = byKey.get(`${route}|${s}|${l}|${t}`); const st = state(r); per[st]++;
    (st === "pass" ? lang[l].pass++ : lang[l].other++); (st === "pass" ? theme[t].pass++ : theme[t].other++); (st === "pass" ? size[s].pass++ : size[s].other++);
    if (st === "fail") for (const b of r.bad) issues[b.replace(/:.*/, "")] = (issues[b.replace(/:.*/, "")] || 0) + 1;
  }
  const verdict = per.pass === EXPECT ? "PASS" : per.missing === EXPECT ? "NOT RUN" : (per.fail === 0 && per.missing === 0 && per.incomplete === 0) ? "PASS" : per.fail ? "FAIL" : "INCOMPLETE";
  rows.push({ route, verdict, per, lang, theme, size, issues });
}
const count = (v) => rows.filter((r) => r.verdict === v).length;
let md = `# Landing-screen matrix report\n\nExpected per route: ${EXPECT} cases (5 languages x 3 themes x ${SIZES.length} sizes). Routes: ${routes.length}.\n\n` +
  `**PASS ${count("PASS")}  |  FAIL ${count("FAIL")}  |  INCOMPLETE ${count("INCOMPLETE")}  |  NOT RUN ${count("NOT RUN")}**\n\n` +
  `| Route | Verdict | pass/${EXPECT} | fail | incomplete | missing | EN | UR | AR | FA | PS | Light | Dark | System | issue types |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
const cell = (o, n) => (o.other === 0 ? "PASS" : `${o.pass}/${o.pass + o.other}`);
for (const r of rows) md += `| ${r.route} | ${r.verdict} | ${r.per.pass} | ${r.per.fail} | ${r.per.incomplete} | ${r.per.missing} | ${LANGS.map((l) => cell(r.lang[l])).join(" | ")} | ${THEMES.map((t) => cell(r.theme[t])).join(" | ")} | ${Object.entries(r.issues).map(([k, v]) => `${k}:${v}`).join(", ")} |\n`;
if (out) fs.writeFileSync(out, md);
console.log(`routes ${routes.length}: PASS ${count("PASS")}, FAIL ${count("FAIL")}, INCOMPLETE ${count("INCOMPLETE")}, NOT RUN ${count("NOT RUN")}; cases recorded ${byKey.size}`);
const worst = rows.filter((r) => r.verdict === "FAIL").sort((a, b) => b.per.fail - a.per.fail).slice(0, 15);
for (const r of worst) console.log(r.per.fail, r.route, JSON.stringify(r.issues));
