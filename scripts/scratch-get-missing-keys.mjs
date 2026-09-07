import fs from "node:fs";
import { globSync } from "glob";

const UI_FILE = "lib/i18n/ui.ts";
const uiContent = fs.readFileSync(UI_FILE, "utf8");
const enBlock = uiContent.slice(uiContent.indexOf("const en: Dict = {"), uiContent.indexOf("const ur: Dict = {"));
const have = new Set([...enBlock.matchAll(/"([^"]+)":/g)].map(m => m[1]));

const CENTRAL_KEY = "[a-z][a-z0-9_]*\\.[a-zA-Z0-9_]+(?:\\.[a-zA-Z0-9_]+)*";
const REF_PATTERNS = [
  new RegExp(`\\bt\\(\\s*[a-zA-Z_][a-zA-Z0-9_.]*\\s*,\\s*"(${CENTRAL_KEY})"`, "g"),
  new RegExp(`\\b(?:tt|tr|nt|_)\\(\\s*"(${CENTRAL_KEY})"`, "g"),
];

const codeFiles = globSync([
  "features/**/*.{ts,tsx,jsx}",
  "app/**/*.{ts,tsx,jsx}",
  "components/**/*.{ts,tsx,jsx}",
  "lib/reports/**/*.{ts,tsx}"
]);

const missing = new Map();
for (const f of codeFiles) {
  const s = fs.readFileSync(f, "utf8");
  for (const p of REF_PATTERNS) {
    const r = new RegExp(p.source, "g");
    let m;
    while ((m = r.exec(s))) {
      if (!have.has(m[1])) {
        if (!missing.has(m[1])) missing.set(m[1], f);
      }
    }
  }
}

console.log("Total Missing Keys:", missing.size);
for (const [k, f] of missing.entries()) {
  console.log(`${k}  <-  ${f}`);
}
