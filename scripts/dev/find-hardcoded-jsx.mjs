// DEV helper: list probable hard-coded English UI strings (JSX text, placeholder/title/aria-label attrs, <option> text) in a TSX line range.
// usage: node scripts/dev/find-hardcoded-jsx.mjs <file> <fromLine> <toLine>
import fs from "node:fs";
const [file, from, to] = process.argv.slice(2);
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
const out = [];
for (let i = Number(from) - 1; i < Math.min(Number(to), lines.length); i++) {
  const l = lines[i];
  if (/^\s*(\/\/|\{\/\*|\*)/.test(l)) continue;
  const hits = [];
  for (const m of l.matchAll(/>\s*([A-Za-z][^<>{}]{2,}?)\s*</g)) hits.push(m[1].trim());
  for (const m of l.matchAll(/(?:placeholder|title|aria-label|label)=\"([^\"{}]{3,})\"/g)) hits.push("@" + m[1]);
  // bare text line inside JSX (no tags/braces)
  const bare = l.match(/^\s*([A-Za-z][A-Za-z0-9 ,.'’&/()%:#?!-]{2,})\s*$/);
  if (bare && !/^(return|const|let|import|export|if|else|case|default|break|type|function)\b/.test(bare[1])) hits.push(bare[1]);
  for (const h of hits) if (/[A-Za-z]{3,}/.test(h) && !/^(className|import)/.test(h)) out.push(`${i + 1}: ${h}`);
}
console.log(out.join("\n")); console.error(out.length + " candidates");
