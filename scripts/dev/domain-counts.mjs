/**
 * DEV-only: what each persona RECEIVES (row counts per operational domain) from the list endpoints - the before/after evidence
 * of the Business / Shipping / Global separation.
 *   BASE=http://127.0.0.1:3540 node scripts/dev/domain-counts.mjs [persona,persona]
 */
import { PERSONAS, login, client, rows } from "./_rbac-lib.mjs";

const only = process.argv[2]?.split(",");
const tally = (list, key) => {
  const t = {};
  for (const r of list) { const k = r[key] ?? "business"; t[k] = (t[k] || 0) + 1; }
  return Object.entries(t).map(([k, v]) => `${k}:${v}`).join(" ") || "-";
};

console.log("persona".padEnd(16), "city-branch lookup".padEnd(28), "branch-mgmt".padEnd(24), "users".padEnd(28), "accounts".padEnd(34), "ledgers");
for (const [name, p] of Object.entries(PERSONAS)) {
  if (only && !only.includes(name)) continue;
  const c = client(await login(p.body));
  const lookup = rows((await c.get("/api/erp/locations/branches/city?scope=all")).json, "cityBranches");
  const mgmt = rows((await c.get("/api/branch-management/city-branches")).json, "cityBranches");
  const users = rows((await c.get("/api/erp/users/journal-report?limit=1000")).json, "rows");
  const accounts = rows((await c.get("/api/erp/accounting/accounts")).json, "accounts");
  const ledgers = rows((await c.get("/api/erp/ledgers")).json, "ledgers");
  console.log(
    name.padEnd(16),
    `${lookup.length} (${tally(lookup, "operationalDomain")})`.padEnd(28),
    `${mgmt.length} (${tally(mgmt, "operational_domain")})`.padEnd(24),
    `${users.length} (${tally(users, "operationalDomain")})`.padEnd(28),
    `${accounts.length} (${tally(accounts, "operational_domain")})`.padEnd(34),
    ledgers.length
  );
}
