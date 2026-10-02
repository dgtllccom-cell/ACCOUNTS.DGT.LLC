// usage: node scripts/_tmp_apply.cjs <translations.cjs>   (keys WITHOUT "com." ; [en, ur, ar, fa, ps])
const fs = require("fs");
const path = require("path");
const tr = require(path.resolve(process.argv[2]));
let s = fs.readFileSync("lib/i18n/ui.ts", "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
const keys = Object.keys(tr).filter((k) => {
  if (s.includes('"com.' + k + '"')) { console.warn("skip existing:", k); return false; }
  if (tr[k].length !== 5 || tr[k].some((v) => !v)) { console.error("BAD ENTRY", k); process.exit(1); }
  return true;
});
const unionAnchor = '  | "com.err_save_before_return"\n';
if (s.split(unionAnchor).length !== 2) { console.error("union anchor"); process.exit(1); }
s = s.replace(unionAnchor, unionAnchor + keys.map((k) => '  | "com.' + k + '"\n').join(""));
const hits = [...s.matchAll(/^  "com\.err_save_before_return": .*\n/gm)];
if (hits.length !== 5) { console.error("dict anchors", hits.length); process.exit(1); }
let out = "", last = 0;
hits.forEach((m, i) => {
  const end = m.index + m[0].length;
  out += s.slice(last, end) + keys.map((k) => '  "com.' + k + '": ' + JSON.stringify(tr[k][i]) + ",\n").join("");
  last = end;
});
out += s.slice(last);
fs.writeFileSync("lib/i18n/ui.ts", crlf ? out.replace(/\n/g, "\r\n") : out);
console.log("added", keys.length, "keys x 5");
