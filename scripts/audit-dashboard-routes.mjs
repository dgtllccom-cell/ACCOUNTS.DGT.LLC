// Lists /dashboard pages that no ROUTE_PERMISSION_MAP entry covers (by exact path or prefix).
// Usage: node scripts/audit-dashboard-routes.mjs
import fs from "node:fs";
import path from "node:path";

const mapSrc = fs.existsSync("lib/navigation/route-policy.ts")
  ? fs.readFileSync("lib/navigation/route-policy.ts", "utf8")
  : fs.readFileSync("components/layout/digital-dock-premium-sidebar.tsx", "utf8");
const map = [...mapSrc.matchAll(/^\s+"(\/dashboard[^"]*)":\s*\[/gm)].map((m) => m[1]);

const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "page.tsx") pages.push("/" + path.dirname(p).split(path.sep).join("/").replace(/^app\//, "").replace(/\/\([^)]*\)/g, ""));
  }
})("app/dashboard");

const unmapped = pages.filter((r) => {
  const c = r.replace(/\[[^\]]+\]/g, "X");
  return !map.some((m) => c === m || (m !== "/dashboard" && c.startsWith(m + "/")));
});
console.log(`pages ${pages.length} | covered ${pages.length - unmapped.length} | unmapped ${unmapped.length}`);
console.log(unmapped.sort().join("\n"));
