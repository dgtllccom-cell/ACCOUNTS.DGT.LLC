import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve("lib/i18n/ui.ts");
let content = fs.readFileSync(filePath, "utf8");

const occurrences = [];
let idx = content.indexOf("rozrep_en");
while (idx !== -1) {
  occurrences.push(idx);
  idx = content.indexOf("rozrep_en", idx + 1);
}

console.log("Total occurrences of rozrep_en:", occurrences.length);
occurrences.forEach((pos, i) => {
  const start = Math.max(0, pos - 40);
  const end = Math.min(content.length, pos + 40);
  console.log(`Occurrence ${i}:`, JSON.stringify(content.substring(start, end)));
});
