/**
 * DEV-only: direct-URL (pasted /dashboard/... address) and API access matrix per persona.
 *   BASE=http://127.0.0.1:3540 node scripts/dev/direct-url-api-matrix.mjs [persona,persona|all] [page|api]
 * A page the policy forbids must answer 403 (server-side route gate), a page the persona owns must NOT be 403, and the
 * Business-confidential / Shipping-only APIs must answer 403 for the wrong domain.
 */
import { PERSONAS, login, client, tally } from "./_rbac-lib.mjs";
import { loginAsUser, lookupUserId } from "./_rbac-users.mjs";

const T = tally();
const only = process.argv[2] && process.argv[2] !== "all" ? process.argv[2].split(",") : null;
const onlyKind = process.argv[3] || null; // "page" | "api" (a dev server compiles each page on first hit - run pages in small groups)

// [persona, kind, path, expectation]  expectation: "403" | "allowed" (anything except 401/403/5xx)
const CASES = [
  // ---- Business login (Quetta branch admin) must not reach the Shipping Line world -----------------------------------
  ["quetta_biz", "page", "/dashboard/logistics", "403"],
  ["quetta_biz", "page", "/dashboard/shipping-line/account-access", "403"],
  ["quetta_biz", "page", "/dashboard/shipping-line/account-approvals", "403"],
  ["quetta_biz", "page", "/dashboard/clearing-agent/customer-bill", "403"],
  ["quetta_biz", "page", "/dashboard/clearing-agent/truck-freight-bill", "403"],
  ["quetta_biz", "page", "/dashboard/reports/shipping", "403"],
  ["quetta_biz", "page", "/dashboard/purchase/new-purchase-booking-order", "allowed"],
  // BL records are shared logistics data that Business purchase-transit pages read (deliberately not behind the Shipping accounting gate); scope still limits rows
  ["quetta_biz", "api", "/api/erp/shipping/bl-records", "allowed"],
  ["quetta_biz", "api", "/api/erp/clearing-agent/customer-bill", "403"],
  ["quetta_biz", "api", "/api/erp/shipping/account-access/search?q=a", "403"],
  // ---- Business Super Admin ---------------------------------------------------------------------------------------
  ["biz_super", "page", "/dashboard/shipping-line/account-access", "403"],
  ["biz_super", "page", "/dashboard/logistics", "403"],
  ["biz_super", "page", "/dashboard/super-admin", "403"],
  ["biz_super", "page", "/dashboard/new-entry/users/all", "allowed"],
  // ---- Shipping login (Chaman branch admin) must not reach the Business world -----------------------------------------
  ["chaman_ship", "page", "/dashboard/purchase/new-purchase-booking-order", "403"],
  ["chaman_ship", "page", "/dashboard/sales/new-sales-booking-order", "403"],
  ["chaman_ship", "page", "/dashboard/reports/payments", "403"],
  ["chaman_ship", "page", "/dashboard/reports/financial-statements", "403"],
  ["chaman_ship", "page", "/dashboard/inventory", "403"],
  ["chaman_ship", "page", "/dashboard/logistics", "allowed"],
  ["chaman_ship", "page", "/dashboard/ledger/detailed", "allowed"],
  ["chaman_ship", "api", "/api/erp/accounting/reports/trial-balance", "403"],
  ["chaman_ship", "api", "/api/erp/reports/payments", "403"],
  ["chaman_ship", "api", "/api/erp/accounting/reports/ledger/ledgers", "403"],
  ["chaman_ship", "api", "/api/erp/accounting/accounts", "allowed"],
  // ---- Shipping Super Admin -----------------------------------------------------------------------------------------
  ["ship_super", "page", "/dashboard/purchase/new-purchase-booking-order", "403"],
  ["ship_super", "page", "/dashboard/super-admin", "403"],
  ["ship_super", "page", "/dashboard/logistics", "allowed"],
  ["ship_super", "api", "/api/erp/accounting/reports/trial-balance", "403"],
  // ---- the REAL Chaman Shipping Branch Admin (DEV user, acted as through dev-session { userId }): the Task B working set ----------
  ["chaman_real", "page", "/dashboard/accounts/setup?domain=shipping", "allowed"],
  ["chaman_real", "page", "/dashboard/clearing-agent/customer-bill", "allowed"],
  ["chaman_real", "page", "/dashboard/clearing-agent/truck-expenses", "allowed"],
  ["chaman_real", "page", "/dashboard/clearing-agent/truck-freight-bill", "allowed"],
  ["chaman_real", "page", "/dashboard/shipping-line/account-approvals", "allowed"],
  ["chaman_real", "page", "/dashboard/purchase/new-purchase-booking-order", "403"],
  ["chaman_real", "page", "/dashboard/sales/new-sales-booking-order", "403"],
  ["chaman_real", "api", "/api/erp/customers", "allowed"],
  ["chaman_real", "api", "/api/erp/companies", "allowed"],
  ["chaman_real", "api", "/api/erp/warehouses", "allowed"],
  ["chaman_real", "api", "/api/erp/shipping-lines", "allowed"],
  ["chaman_real", "api", "/api/erp/clearing-agent/customer-bill", "allowed"],
  ["chaman_real", "api", "/api/erp/expenses?category=truck_expenses", "allowed"],
  ["chaman_real", "api", "/api/erp/accounting/reports/trial-balance", "403"],
  ["chaman_real", "api", "/api/erp/reports/payments", "403"],
  // ---- Global Super Admin keeps everything ------------------------------------------------------------------------------
  ["global_super", "page", "/dashboard/shipping-line/account-access", "allowed"],
  ["global_super", "page", "/dashboard/purchase/new-purchase-booking-order", "allowed"],
];

const sessions = new Map();
async function sessionFor(p) {
  if (!sessions.has(p)) {
    if (p === "chaman_real") sessions.set(p, await loginAsUser(await lookupUserId("chaman.shipping@dgt.llc")));
    else sessions.set(p, client(await login(PERSONAS[p].body)));
  }
  return sessions.get(p);
}

for (const [persona, kind, path, expect] of CASES) {
  if (only && !only.includes(persona)) continue;
  if (onlyKind && kind !== onlyKind) continue;
  const c = await sessionFor(persona);
  const r = await c.get(path);
  const forbidden = r.status === 403;
  const ok = expect === "403" ? forbidden : !forbidden && r.status !== 401 && r.status < 500;
  T.check(`${persona.padEnd(12)} ${kind.padEnd(4)} ${path}`, ok, `expected ${expect}, got HTTP ${r.status}`);
}
process.exit(T.summary() ? 0 : 1);
