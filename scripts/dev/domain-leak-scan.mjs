/**
 * DEV-only: Business ↔ Shipping Line data-leak scanner.
 *   BASE=http://127.0.0.1:3540 node scripts/dev/domain-leak-scan.mjs [persona,persona]
 *
 * 1. As the Global Super Admin it learns every FOREIGN id: accounts, city branches and users, grouped by operational domain.
 * 2. For each single-domain persona it calls the list / report / lookup endpoints and scans the whole JSON body for an id that
 *    belongs to the OTHER domain. Any hit is a leak (FAIL). Endpoints that must be refused (403) for a persona are asserted too.
 */
import { PERSONAS, login, client, rows, tally } from "./_rbac-lib.mjs";

const T = tally();
const g = client(await login(PERSONAS.global_super.body));

const accounts = rows((await g.get("/api/erp/accounting/accounts")).json, "accounts");
const branches = rows((await g.get("/api/branch-management/city-branches")).json, "cityBranches");
const users = rows((await g.get("/api/erp/users/journal-report")).json, "rows");
const ids = { business: { acc: new Set(), br: new Set(), usr: new Set() }, shipping: { acc: new Set(), br: new Set(), usr: new Set() } };
// System inter-country / corporate clearing accounts are shared by design (shipping transfers post into them): not "foreign".
const SHARED_SYSTEM = /^(PAK|AFG|IND|UAE|CHN)-CORP-GEN-001$|^CT-INTER-|IND-HUB/i;
for (const a of accounts) if (ids[a.operational_domain] && !SHARED_SYSTEM.test(a.code || "") && !/inter-country|central clearing|main country clearing/i.test(a.name || "")) ids[a.operational_domain].acc.add(a.id);
for (const b of branches) if (ids[b.operational_domain]) ids[b.operational_domain].br.add(b.id);
for (const u of users) if (ids[u.operationalDomain]) ids[u.operationalDomain].usr.add(u.userId);
console.log(`foreign-id universe: accounts b=${ids.business.acc.size}/s=${ids.shipping.acc.size}  branches b=${ids.business.br.size}/s=${ids.shipping.br.size}  users b=${ids.business.usr.size}/s=${ids.shipping.usr.size}\n`);

const LIST_ENDPOINTS = [
  "/api/erp/accounting/accounts",
  "/api/erp/accounts",
  "/api/erp/ledgers",
  "/api/erp/accounting/reports/ledger/ledgers",
  "/api/erp/accounting/reports/ledger/balances",
  "/api/erp/accounting/reports/ledger/general",
  "/api/erp/accounting/reports/ledger/outstanding",
  "/api/erp/accounting/reports/accounts/general",
  "/api/erp/roznamcha",
  "/api/erp/roznamcha/summary-overview",
  "/api/erp/reports/general",
  "/api/erp/reports/general/accounts",
  "/api/erp/reports/meta",
  "/api/erp/locations/branches/city?scope=all",
  "/api/branch-management/city-branches",
  "/api/branch-management/general-report",
  "/api/branch-management/network-view",
  "/api/branch-management/org-chart",
  "/api/erp/users/journal-report",
  "/api/erp/users/login-management",
];

// Documented, accepted legacy: ONE pre-separation roznamcha entry (operational_domain IS NULL, 2026-09-11) was created by the
// Pakistan Shipping & Clearing Admin; unclassified legacy entries stay visible to Business by design (roznamcha/route.ts).
// Also accepted: 6 Shipping-domain accounts (+7 ledgers, 2 user assignments) are filed on the BUSINESS branch 'Quetta City Branch'
// (legacy mis-filing, see docs/user-verification). They are correctly Shipping rows; only their branch-id column names Quetta.
const ACCEPTED_LEGACY = [
  { ep: "/api/erp/roznamcha", prefix: "usr:54a55f8a" },
  ...["/api/erp/accounting/accounts", "/api/erp/ledgers", "/api/erp/reports/meta", "/api/erp/accounting/reports/accounts/general", "/api/erp/accounting/reports/ledger/ledgers"].map((ep) => ({ ep, prefix: "br:7d7d42fe", shippingOnly: true })),
];

// SCAN=critical limits the run to the endpoints that carry the separation rule (each call costs ~10-30 s on the remote DEV database)
const CRITICAL = new Set([
  "/api/erp/accounting/accounts", "/api/erp/ledgers", "/api/erp/accounting/reports/ledger/ledgers", "/api/erp/accounting/reports/accounts/general",
  "/api/erp/locations/branches/city?scope=all", "/api/branch-management/city-branches", "/api/branch-management/org-chart",
  "/api/erp/users/journal-report", "/api/erp/users/login-management", "/api/erp/reports/meta", "/api/branch-management/general-report",
]);
const SINGLE = { biz_super: "business", quetta_biz: "business", deira_biz: "business", pk_country_biz: "business",
  ship_super: "shipping", chaman_ship: "shipping", alras_ship: "shipping", pk_country_ship: "shipping" };
const only = process.argv[2]?.split(",");

for (const [persona, domain] of Object.entries(SINGLE)) {
  if (only && !only.includes(persona)) continue;
  const other = domain === "business" ? "shipping" : "business";
  const c = client(await login(PERSONAS[persona].body));
  for (const ep of LIST_ENDPOINTS) {
    if (process.env.SCAN === "critical" && !CRITICAL.has(ep)) continue;
    const r = await c.get(ep);
    if (r.status >= 500) { T.check(`${persona.padEnd(15)} ${ep}`, false, `HTTP ${r.status}`); continue; }
    if (r.status >= 400 || r.status === 307) { T.check(`${persona.padEnd(15)} ${ep}`, true, `refused ${r.status}`); continue; }
    const body = r.text;
    const hits = [];
    for (const kind of ["acc", "br", "usr"]) for (const id of ids[other][kind]) if (body.includes(id)) hits.push(`${kind}:${id.slice(0, 8)}`);
    const real = hits.filter((h) => !ACCEPTED_LEGACY.some((a) => a.ep === ep && a.prefix === h && (!a.shippingOnly || domain === "shipping")));
    T.check(`${persona.padEnd(15)} ${ep}`, real.length === 0, real.length ? `LEAK ${other} ids → ${real.slice(0, 6).join(",")}` : hits.length ? "clean (accepted legacy NULL-domain entry only)" : "clean");
  }
}
process.exit(T.summary() ? 0 : 1);
