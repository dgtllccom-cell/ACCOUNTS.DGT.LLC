// Static audit of every API route handler: does it authenticate, authorise (permission) and scope (country/branch)?
// Usage: node scripts/audit-api-authorization.mjs [--json out.json]
// This is a SCREEN, not a proof: it finds routes with no recognisable check so they can be reviewed by hand.
import fs from "node:fs";
import path from "node:path";

const ROOT = "app/api";
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "route.ts" || e.name === "route.tsx") files.push(p);
  }
})(ROOT);

const AUTH = /(require[A-Za-z]*Session|guard[A-Z][A-Za-z]*|requireAuth[A-Za-z]*|withAuth[A-Za-z]*|requireErpSession|getErpSessionForApi|getCurrentErpSession|requireAuthorizedSession|requireSession|readTempSession|requireSuperAdmin|requireMobileProfile)/;
const PERM = /(authorize\(|authorizeApiScope|authorizeApiScopeEither|requireAuthorizedSession|hasRolePermission|assertResourceDomain|requireSuperAdmin|requireShippingExplicit|assertExplicit|isSuperAdmin|requireMobileProfile|requireModuleAccess|requirePermission|assertPermission)/;
const SCOPE = /(sessionSqlScope|sqlScopeCondition|enforceScopeFilter|recordInSessionScope|recordInHierarchyScope|buildScopeFilter|canAccessCountry|canAccessCityBranch|canAccessCountryBranch|assertExplicitScopeAllowed|resolveReportScope|enforceScopeFilters|sqlHierarchyScopeCondition|postgrestHierarchyScope|laneScopeSql|authorizeApiScope|authorize\(|session\.(countryIds|cityBranchIds|countryBranchIds)|recordAtOwnAssignmentLevel|clearingAgentIds)/;
const PUBLIC_OK = /^app\/api\/(erp\/auth|public|health|webhooks?|cron|whatsapp\/webhook)/;

const rows = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const methods = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
  const constMethods = [...src.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
  const all = [...new Set([...methods, ...constMethods])];
  if (!all.length) continue;
  const norm = f.replace(/\\/g, "/");
  rows.push({
    file: norm,
    methods: all,
    auth: AUTH.test(src),
    perm: PERM.test(src),
    scope: SCOPE.test(src),
    publicOk: PUBLIC_OK.test(norm),
    lines: src.split("\n").length,
  });
}

const noAuth = rows.filter((r) => !r.auth && !r.publicOk);
const authNoPerm = rows.filter((r) => r.auth && !r.perm && !r.publicOk);
const permNoScope = rows.filter((r) => r.perm && !r.scope && !r.publicOk);
console.log(`routes scanned: ${rows.length}`);
console.log(`NO authentication visible: ${noAuth.length}`);
console.log(`authenticated but NO permission check visible: ${authNoPerm.length}`);
console.log(`permission check but NO country/branch scope visible: ${permNoScope.length}`);
const section = (title, list) => { console.log(`\n== ${title} (${list.length}) ==`); for (const r of list) console.log(`${r.methods.join(",").padEnd(18)} ${r.file}`); };
if (process.argv.includes("--list")) {
  section("no authentication", noAuth);
  section("authenticated, no permission check", authNoPerm);
  section("permission, no scope", permNoScope);
}
const jIdx = process.argv.indexOf("--json");
if (jIdx > -1) fs.writeFileSync(process.argv[jIdx + 1], JSON.stringify({ rows, noAuth: noAuth.map((r) => r.file), authNoPerm: authNoPerm.map((r) => r.file), permNoScope: permNoScope.map((r) => r.file) }, null, 1));
