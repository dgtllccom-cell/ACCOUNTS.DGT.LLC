/**
 * Builds docs/store/design/{mockups.html, components.html, tokens.css, strings.json} from
 *   - docs/store/design/tokens.json            (design tokens, hand-authored from app/globals.css)
 *   - scripts/design/spec.mjs                  (screen specification: real ERP routes + real labels)
 *   - the ERP dictionaries (lib/i18n/ui.ts, lib/i18n/table-headers*.ts, features/auth/components/login-translations.ts)
 * FAILS if a route does not exist under app/ or a label has no real translation in all five languages (no half-English RTL screens).
 *   node scripts/build-design-mockups.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { buildSpec } from "./design/spec.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const OUT = path.join(ROOT, "docs/store/design");
const base = new URL("../", import.meta.url).href;
const LANGS = ["en", "ur", "ar", "fa", "ps"];

const ui = await import(base + "lib/i18n/ui.ts");
const D = ui.getUiDictionaries();
const login = (await import(base + "features/auth/components/login-translations.ts")).LOGIN_TRANSLATIONS;
const ex = await import(base + "lib/i18n/table-headers-extra.ts");

// header translations (table-headers.ts imports app aliases, so it is parsed as text)
const Q = String.raw`"((?:[^"\\]|\\.)*)"`;
const re = new RegExp(String.raw`^\s*"([^"]+)":\s*\{\s*ur:\s*${Q},\s*ar:\s*${Q},\s*fa:\s*${Q},\s*ps:\s*${Q}\s*\}`, "gm");
const HT = {};
for (const m of fs.readFileSync(path.join(ROOT, "lib/i18n/table-headers.ts"), "utf8").matchAll(re)) {
  const un = (s) => JSON.parse('"' + s + '"');
  HT[m[1].toUpperCase()] = { ur: un(m[2]), ar: un(m[3]), fa: un(m[4]), ps: un(m[5]) };
}
const rev = new Map();
for (const [k, v] of Object.entries(D.en)) { const key = String(v).trim().toLowerCase(); if (!rev.has(key)) rev.set(key, []); rev.get(key).push(k); }

const strings = {};
const problems = [];
const silent = [];
function reg(en, row, src) {
  if (!strings[en]) strings[en] = { en, ur: row.ur, ar: row.ar, fa: row.fa, ps: row.ps, _src: src };
  for (const l of ["ur", "ar", "fa", "ps"]) if (!row[l]) problems.push(`no ${l} translation: "${en}" (${src})`); else if (row[l] === en && /[A-Za-z]{4,}/.test(en)) silent.push(`${l}=en "${en}"`);
}
const K = (key) => {
  const en = D.en[key];
  if (en == null) { problems.push(`missing ui key ${key}`); return key; }
  reg(en, { ur: D.ur[key], ar: D.ar[key], fa: D.fa[key], ps: D.ps[key] }, "ui:" + key);
  return en;
};
const L = (name) => {
  const en = login.en[name];
  if (en == null) { problems.push(`missing login field ${name}`); return name; }
  reg(en, { ur: login.ur[name], ar: login.ar[name], fa: login.fa[name], ps: login.ps[name] }, "login:" + name);
  return en;
};
function resolvePlain(label) {
  if (strings[label]) return true;
  const u = label.toUpperCase();
  if (HT[u]) { reg(label, HT[u], "HEADER"); return true; }
  const e = ex.HEADER_EXTRA?.[u];
  if (e && e.ur) { reg(label, e, "HEADER_EXTRA"); return true; }
  const ks = rev.get(label.trim().toLowerCase());
  if (ks) {
    const k = ks.find((k) => ["ur", "ar", "fa", "ps"].every((l) => D[l][k] && D[l][k] !== D.en[k])) || ks[0];
    reg(label, { ur: D.ur[k], ar: D.ar[k], fa: D.fa[k], ps: D.ps[k] }, "ui:" + k);
    return true;
  }
  return false;
}

const spec = buildSpec(K, L);
const LABEL_KEYS = new Set(["title", "sub", "ph", "text", "action", "l", "hint", "g", "from", "to", "role", "brandTitle"]);
const LIST_KEYS = new Set(["items", "cols", "fields"]);
const labels = new Set();
(function walk(o, key) {
  if (typeof o === "string") { if (LABEL_KEYS.has(key)) labels.add(o); return; }
  if (Array.isArray(o)) { for (const x of o) { if (typeof x === "string") { if (LIST_KEYS.has(key)) labels.add(x); } else walk(x, key); } return; }
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, k);
})(spec.screens);
(function walkC(o, key) {
  if (typeof o === "string") { if (LABEL_KEYS.has(key)) labels.add(o); return; }
  if (Array.isArray(o)) { for (const x of o) { if (typeof x === "string") { if (LIST_KEYS.has(key)) labels.add(x); } else walkC(x, key); } return; }
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walkC(v, k);
})(spec.components);
// labels the renderer itself uses
["Status", "Role", "Branch", "Language"].forEach((x) => labels.add(x));
const unresolved = [];
for (const l of labels) if (!resolvePlain(l)) unresolved.push(l);

// routes must exist
const routeErr = [];
for (const s of spec.screens) for (const r of s.routes || []) {
  if (!r.startsWith("/")) continue;
  const p = r.split("?")[0];
  const ok = ["page.tsx", "page.jsx", "page.ts"].some((f) => fs.existsSync(path.join(ROOT, "app", p, f))) || fs.existsSync(path.join(ROOT, "app", p.replace(/\/[^/]+$/, ""), "[...slug]"));
  if (!ok) routeErr.push(`${s.id}: route ${r} has no app${p}/page.tsx`);
}

if (unresolved.length || problems.length || routeErr.length) {
  console.error("BUILD FAILED");
  if (unresolved.length) console.error("Labels with no real translation (use a label that exists in the ERP dictionaries):\n  " + unresolved.join("\n  "));
  if (problems.length) console.error("Problems:\n  " + problems.join("\n  "));
  if (routeErr.length) console.error("Routes:\n  " + routeErr.join("\n  "));
  process.exit(1);
}

// ---- tokens.css (generated from tokens.json) ----
const T = JSON.parse(fs.readFileSync(path.join(OUT, "tokens.json"), "utf8"));
const val = (o) => o.$value;
const modeCss = (name, m) => `.dev[data-mode=${name}],.dg-scope[data-mode=${name}]{${Object.entries(m).filter(([k]) => !k.startsWith("$")).map(([k, v]) => `--${k}:${val(v)};`).join("")}}`;
let css = "/* GENERATED by scripts/build-design-mockups.mjs from tokens.json — do not edit. */\n";
css += `:root{--font-latin:${val(T.font.family.latin)};--font-arabic:${val(T.font.family["arabic-script"])};` +
  Object.entries(T.size).filter(([k]) => !k.startsWith("$")).map(([k, v]) => `--size-${k}:${val(v)};`).join("") +
  Object.entries(T.radius).filter(([k]) => !k.startsWith("$")).map(([k, v]) => `--radius-${k}:${val(v)};`).join("") +
  `--e1:${val(T.elevation.e1)};--e2:${val(T.elevation.e2)};--e3:${val(T.elevation.e3)};--e4:${val(T.elevation.e4)};}\n`;
css += modeCss("day", T.color.mode.day) + "\n" + modeCss("night", T.color.mode.night) + "\n";
for (const [app, a] of Object.entries(T.color.app)) {
  if (app.startsWith("$")) continue;
  css += `.dev[data-app=${app}],.dg-scope[data-app=${app}]{--primary:${val(a.primary)};--primary-foreground:${val(a["primary-foreground"])};--ring:${val(a.primary)};--icon-from:${val(a["icon-from"])};--icon-to:${val(a["icon-to"])};--splash:${val(a.splash)}}\n`;
  css += `.dev[data-mode=night][data-app=${app}],.dg-scope[data-mode=night][data-app=${app}]{--primary:${val(a["primary-dark"])};--primary-foreground:222 47% 11%}\n`;
}
css += ".dev .t-neutral{--tone:215 16% 47%}\n";
fs.writeFileSync(path.join(OUT, "tokens.css"), css);

// ---- strings.json (for Figma text styles / translators) ----
const outStrings = {};
for (const [k, v] of Object.entries(strings).sort(([a], [b]) => a.localeCompare(b))) outStrings[k] = { en: v.en, ur: v.ur, ar: v.ar, fa: v.fa, ps: v.ps, source: v._src };
fs.writeFileSync(path.join(OUT, "strings.json"), JSON.stringify(outStrings, null, 1));

// ---- HTML ----
const data = { strings: Object.fromEntries(Object.entries(strings).map(([k, v]) => [k, { en: v.en, ur: v.ur, ar: v.ar, fa: v.fa, ps: v.ps }])), groups: spec.groups, screens: spec.screens, components: spec.components };
const esc = (s) => s.replace(/</g, "\\u003c");
const head = (title) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="design.css">
</head>`;
const toolbar = (extra) => `<div class="dg-bar"><b>DGT.llc B / BS</b>
<span class="grp"><span class="lbl">App</span><button data-k="app" data-v="b">DGT.llc B</button><button data-k="app" data-v="bs">DGT.llc BS</button></span>
<span class="grp"><span class="lbl">Device</span><button data-k="device" data-v="phone">Phone 390</button><button data-k="device" data-v="phone360">Phone 360</button><button data-k="device" data-v="tablet">Tablet 820</button></span>
<span class="grp"><span class="lbl">Language</span><button data-k="lang" data-v="en">English</button><button data-k="lang" data-v="ur">اردو</button><button data-k="lang" data-v="ar">العربية</button><button data-k="lang" data-v="fa">فارسی</button><button data-k="lang" data-v="ps">پښتو</button></span>
<span class="grp"><span class="lbl">Theme</span><button data-k="mode" data-v="day">Light</button><button data-k="mode" data-v="night">Dark</button></span>${extra || ""}</div>`;
const boot = (render) => `<script>
(function(){var q=new URLSearchParams(location.search),S=DG.S;["app","device","lang","mode"].forEach(function(k){if(q.get(k))S[k]=q.get(k)});
function sync(){document.querySelectorAll('.dg-bar button').forEach(function(b){b.setAttribute('aria-pressed',String(S[b.dataset.k]===b.dataset.v))});
 var u=new URL(location.href);["app","device","lang","mode"].forEach(function(k){u.searchParams.set(k,S[k])});history.replaceState(null,'',u)}
document.querySelectorAll('.dg-bar button').forEach(function(b){b.onclick=function(){S[b.dataset.k]=b.dataset.v;${render};sync()}});
${render};sync()})();
</script>`;

const mock = `${head("DGT.llc B / BS — screen mockups")}
<body class="dg-page">
${toolbar('<span class="grp"><a style="color:#93c5fd" href="components.html">Components →</a></span>')}
<div class="dg-note"><b>Design mockups — layout placeholders only.</b> Labels, routes and translations are the real ERP's (checked at build time). Values show as <code>#,###</code> and grey bars: no real or invented business data.
Switch app, device, language (EN + UR/AR/FA/PS with full RTL) and light/dark above. Deep link: <code>?app=bs&amp;lang=ur&amp;device=tablet&amp;mode=night</code>.</div>
<main class="dg-wrap" id="root"></main>
<script>window.DG_DATA=${esc(JSON.stringify(data))};</script>
<script src="design-lib.js"></script>
${boot("DG.render(document.getElementById('root'),DG_DATA.screens)")}
</body></html>
`;
fs.writeFileSync(path.join(OUT, "mockups.html"), mock);

// ---- components.html ----
const comp = `${head("DGT.llc B / BS — component inventory")}
<body class="dg-page">
${toolbar('<span class="grp"><a style="color:#93c5fd" href="mockups.html">← Screens</a></span>')}
<div class="dg-note"><b>Component inventory.</b> Names follow the Figma plan in README (<code>Category/Name/Variant</code>). Everything is built from <code>tokens.json</code> and the ERP's own patterns; use the toolbar for RTL / dark / app colour.</div>
<main class="dg-wrap" id="root"></main>
<script>window.DG_DATA=${esc(JSON.stringify(data))};</script>
<script src="design-lib.js"></script>
${boot("DG.renderComponents(document.getElementById('root'))")}
</body></html>
`;
fs.writeFileSync(path.join(OUT, "components.html"), comp);

console.log(`OK  screens=${spec.screens.length}  strings=${Object.keys(strings).length}  silent-English entries=${silent.length}`);
if (silent.length) console.log("  (allowed — same word in that language): " + [...new Set(silent)].slice(0, 12).join("; "));
