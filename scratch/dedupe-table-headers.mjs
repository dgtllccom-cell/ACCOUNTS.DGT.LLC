import fs from 'fs';

const filePath = 'lib/i18n/table-headers.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find HEADER_TRANSLATIONS start
const startIdx = content.indexOf('export const HEADER_TRANSLATIONS: Record<string, Row> = {');
const endIdx = content.lastIndexOf('};');

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find table translations object");
  process.exit(1);
}

const headerPart = content.substring(0, startIdx + 'export const HEADER_TRANSLATIONS: Record<string, Row> = {'.length);
const bodyPart = content.substring(startIdx + 'export const HEADER_TRANSLATIONS: Record<string, Row> = {'.length, endIdx);
const footerPart = content.substring(endIdx);

// Parse entries using regex
const entryRegex = /"([^"]+)":\s*\{\s*ur:\s*"([^"]*)",\s*ar:\s*"([^"]*)",\s*fa:\s*"([^"]*)",\s*ps:\s*"([^"]*)"\s*\},?/g;
const map = new Map();

let match;
while ((match = entryRegex.exec(bodyPart)) !== null) {
  const [full, key, ur, ar, fa, ps] = match;
  map.set(key, { ur, ar, fa, ps });
}

console.log(`Found ${map.size} unique keys.`);

let formattedEntries = '\n';
for (const [key, val] of map.entries()) {
  formattedEntries += `  "${key}": { ur: "${val.ur}", ar: "${val.ar}", fa: "${val.fa}", ps: "${val.ps}" },\n`;
}

const newContent = headerPart + formattedEntries + footerPart;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Successfully deduplicated lib/i18n/table-headers.ts");
