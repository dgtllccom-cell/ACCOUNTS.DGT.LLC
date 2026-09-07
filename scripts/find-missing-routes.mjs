import fs from "fs";
import path from "path";

function pageExists(route) {
  const clean = route.split("?")[0].replace(/\/$/, "");
  const direct = path.join("app", clean, "page.tsx");
  if (fs.existsSync(direct)) return true;

  // Check for dynamic segment [type], [id], etc.
  const parts = clean.split("/").filter(Boolean); // ['dashboard', 'purchase', 'stock', 'warehouse']
  function checkDynamic(currentDir, index) {
    if (index >= parts.length) {
      return fs.existsSync(path.join(currentDir, "page.tsx"));
    }
    const seg = parts[index];
    const exact = path.join(currentDir, seg);
    if (fs.existsSync(exact)) {
      if (checkDynamic(exact, index + 1)) return true;
    }
    // Check dynamic folder [param]
    if (fs.existsSync(currentDir)) {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const it of items) {
        if (it.isDirectory() && it.name.startsWith("[") && it.name.endsWith("]")) {
          const dynDir = path.join(currentDir, it.name);
          if (checkDynamic(dynDir, index + 1)) return true;
        }
      }
    }
    return false;
  }

  return checkDynamic("app", 0);
}

const content = fs.readFileSync("components/layout/digital-dock-premium-sidebar.tsx", "utf8");
const hrefs = [...content.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
const missing = [];
const valid = [];

for (const h of hrefs) {
  if (pageExists(h)) {
    valid.push(h);
  } else {
    missing.push(h);
  }
}

console.log("ACTUAL 404s (Route Does Not Exist in app/):");
console.log(JSON.stringify(missing, null, 2));
console.log("\nTOTAL:", hrefs.length, "VALID:", valid.length, "MISSING:", missing.length);
