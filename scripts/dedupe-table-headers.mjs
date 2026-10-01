import fs from "fs";
import path from "path";

const filePath = path.resolve("lib/i18n/table-headers.ts");
let content = fs.readFileSync(filePath, "utf8");

const startMarker = "export const HEADER_TRANSLATIONS: Record<string, Row> = {";
const endMarker = "/** Normalize an English header";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find markers in table-headers.ts");
  process.exit(1);
}

// Find the last "};" before endMarker
const closeBraceIndex = content.lastIndexOf("};", endIndex);

const before = content.slice(0, startIndex + startMarker.length);
const body = content.slice(startIndex + startMarker.length, closeBraceIndex);
const after = content.slice(closeBraceIndex);

const entries = new Map();
const lines = body.split(/\r?\n/);

let currentComment = "";
const keyRegex = /^\s*"([^"]+)":\s*\{\s*ur:\s*"([^"]*)",\s*ar:\s*"([^"]*)",\s*fa:\s*"([^"]*)",\s*ps:\s*"([^"]*)"\s*\},?$/;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (!trimmed) continue;
  if (trimmed.startsWith("//")) {
    currentComment = line;
    continue;
  }
  const m = line.match(keyRegex);
  if (m) {
    const [, k, ur, ar, fa, ps] = m;
    const existing = entries.get(k);
    if (!existing) {
      entries.set(k, { ur, ar, fa, ps, comment: currentComment });
    } else {
      if (ur && !existing.ur) existing.ur = ur;
      if (ar && !existing.ar) existing.ar = ar;
      if (fa && !existing.fa) existing.fa = fa;
      if (ps && !existing.ps) existing.ps = ps;
    }
    currentComment = "";
  }
}

console.log(`Parsed ${entries.size} unique keys.`);

let newBody = "\n";
for (const [k, v] of entries.entries()) {
  if (v.comment) {
    newBody += `${v.comment}\n`;
  }
  newBody += `  "${k}": { ur: ${JSON.stringify(v.ur)}, ar: ${JSON.stringify(v.ar)}, fa: ${JSON.stringify(v.fa)}, ps: ${JSON.stringify(v.ps)} },\n`;
}

fs.writeFileSync(filePath, before + newBody + after, "utf8");
console.log("Successfully deduped table-headers.ts!");
