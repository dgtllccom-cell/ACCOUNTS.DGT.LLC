import fs from "fs";
import path from "path";

function scanAndFix(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".git") {
        scanAndFix(fullPath);
      }
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      let content = fs.readFileSync(fullPath, "utf8");
      // Pattern: import {\r?\nimport { Th } or import {\r?\n  import { Th }
      const regex = /import\s*\{\s*[\r\n]+\s*import\s*\{\s*Th\s*\}\s*from\s*["']@\/components\/ui\/translated-th["'];/g;
      if (regex.test(content)) {
        console.log(`Fixing broken import in ${fullPath}`);
        const fixed = content.replace(
          regex,
          `import { Th } from "@/components/ui/translated-th";\nimport {`
        );
        fs.writeFileSync(fullPath, fixed, "utf8");
      }
    }
  }
}

console.log("Scanning repository for broken import statements...");
scanAndFix(process.cwd());
console.log("Scan complete.");
