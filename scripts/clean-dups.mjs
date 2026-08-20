import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve("lib/i18n/ui.ts");
let content = fs.readFileSync(filePath, "utf8");

// Remove the block from "// Roznamcha keys injected" up to "Object.assign(en, rozrep_en);"
content = content.replace(/\/\/ Roznamcha keys injected\r?\nconst rozrep_en = \{[\s\S]*?Object\.assign\(en, rozrep_en\);\r?\n+/g, "");

fs.writeFileSync(filePath, content, "utf8");
console.log("Successfully removed duplicate rozrep_en!");
