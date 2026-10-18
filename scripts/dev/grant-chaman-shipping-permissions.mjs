/**
 * DEV-only (Task B): enable the Chaman Shipping Branch Admin (chaman.shipping@dgt.llc) to work on the existing Account Master,
 * Customer / Company masters and the three Shipping bills - inside its OWN Chaman Shipping & Clearing Branch scope only.
 *
 *   BASE=http://127.0.0.1:3540 node scripts/dev/grant-chaman-shipping-permissions.mjs
 *
 * Root cause it fixes: the user's saved custom permission set (2026-09-13) only holds legacy form tokens (clearing:*, route:/...),
 * so accounts:create / customers:* / expenses:* / ledgers:read were never granted and POST /api/erp/accounting/accounts answered
 * "Missing permission: accounts:create".
 *
 * It ADDS exact tokens (never a wildcard, never a module-wide grant) through the real users API as the Global Super Admin, so the
 * change is audited and capped by the same rules as the Permission Control Center. Scope is not a permission: the user's
 * assignment (Chaman Shipping & Clearing Branch, shipping domain) still bounds every row it can read or write.
 *
 * PRODUCTION: this script refuses to run anywhere but a localhost dev server on the DEV database. The owner applies the same token
 * list to the production user from Permission Control Center (the list is printed below).
 */
import { globalClient, lookupUserId, devQuery } from "./_rbac-users.mjs";

// SHIPPING_APPROVED_BUNDLE (lib/permissions/enterprise-roles.ts) - the owner-approved Shipping user template
const BUNDLE = [
  "accounts:read", "accounts:create", "roznamcha:read", "roznamcha:create", "transactions:read", "transactions:create",
  "roznamcha:post_cross_branch", "record_transfers:read", "record_transfers:create", "shipping_records:read", "shipping_records:create",
  "shipping_records:update", "shipping_reports:read", "reports:read", "shipping:read", "inter_branch_transfers:read",
  "inter_branch_transfers:create", "inter_branch_transfers:approve", "clearing_bill_customer_charges:read",
  "clearing_bill_customer_charges:create", "customer_receipts:read", "customer_receipts:create",
];
// Customer / Company masters, warehouse selection, ledgers (shipping-domain filtered) and the three bills' expense engine
const EXTRA = [
  "customers:read", "customers:create", "customers:update", "companies:read", "companies:create", "warehouses:read",
  "ledgers:read", "expenses:read", "expenses:create",
  // menu / route entries for the new screens
  "route:/dashboard/clearing-agent/customer-bill", "route:/dashboard/clearing-agent/truck-expenses",
  "route:/dashboard/clearing-agent/truck-freight-bill", "route:/dashboard/shipping-line/account-approvals",
  "route:/dashboard/accounts/setup", "route:/dashboard/ledger/detailed", "route:/dashboard/ledger/general-report",
  "route:/dashboard/ledger/outstanding", "route:/dashboard/roznamcha/expenses-bill",
];

const userId = await lookupUserId("chaman.shipping@dgt.llc");
if (!userId) throw new Error("chaman.shipping@dgt.llc not found in the DEV database");
const before = (await devQuery((sql) => sql`select permissions from public.user_permission_sets where user_id = ${userId} and deleted_at is null`))[0]?.permissions ?? [];
const next = [...new Set([...before, ...BUNDLE, ...EXTRA])];
const added = next.filter((p) => !before.includes(p));
console.log(`current ${before.length} tokens, adding ${added.length}:`, added.join(" ") || "(nothing - already granted)");
if (added.length) {
  const g = await globalClient();
  const res = await g.req("PATCH", "/api/erp/users", { userId, permissions: next });
  console.log("PATCH /api/erp/users ->", res.status, res.status === 200 ? "ok" : JSON.stringify(res.json).slice(0, 300));
  if (res.status !== 200) process.exit(1);
}
const after = (await devQuery((sql) => sql`select permissions from public.user_permission_sets where user_id = ${userId} and deleted_at is null`))[0]?.permissions ?? [];
console.log(`now ${after.length} tokens; accounts:create granted: ${after.includes("accounts:create")}`);
