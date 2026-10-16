/**
 * Stock Journal canonical-implementation guard (runs in prebuild + the pre-commit hook).
 *
 * The Stock Journal is ONE implementation (docs/stock-journal.md): lib/services/stock-journal-service.ts + lib/stock-journal/model.ts, the
 * /api/erp/inventory/journal-stock/* routes and features/journal/components/journal-booking-stock-dashboard.tsx. A parallel session that
 * merges an older copy of those files would silently bring back the bugs this replaced (bookings missing, un-scoped reads, double STOCK_IN,
 * no idempotency). This guard fails the build / commit when that happens, with a message that says what to restore.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : null);
const problems = [];
const need = (rel, pattern, why) => {
  const t = read(rel);
  if (t == null) return problems.push(`${rel} is missing — ${why}`);
  if (!(pattern instanceof RegExp ? pattern.test(t) : t.includes(pattern))) problems.push(`${rel} no longer contains ${pattern} — ${why}`);
};
const forbid = (rel, pattern, why) => {
  const t = read(rel);
  if (t == null) return;
  if (pattern instanceof RegExp ? pattern.test(t) : t.includes(pattern)) problems.push(`${rel} contains ${pattern} — ${why}`);
};

// the old, un-scoped, non-idempotent writer must stay deleted
if (fs.existsSync(path.join(root, "app/api/erp/inventory/journal-stock/transfer/route.ts"))) {
  problems.push("app/api/erp/inventory/journal-stock/transfer/route.ts was restored — it has no scope check / idempotency and books STOCK_IN a second time. Delete it; use /confirm (see docs/stock-journal.md).");
}

need("app/api/erp/inventory/journal-stock/route.ts", "loadStockJournal", "the list must come from the scope-enforcing service, not inline SQL");
forbid("app/api/erp/inventory/journal-stock/route.ts", /FROM public\.purchase_orders po/i, "inline SQL over purchase_orders = the old route that ignored the session scope");
for (const r of ["confirm", "issue", "reverse", "customs", "history"]) {
  need(`app/api/erp/inventory/journal-stock/${r}/route.ts`, "stock-journal-service", `the ${r} action must go through the stock-journal service`);
}
for (const fn of ["confirmStock", "issueStock", "reverseConfirmation", "issueForSalesOrder", "setCustomsStatus", "getStockHistory", "loadStockJournal", "assertRecordAccess"]) {
  need("lib/services/stock-journal-service.ts", new RegExp(`function ${fn}\\b`), `${fn} is part of the Stock Journal contract`);
}
need("lib/services/stock-journal-service.ts", "for update", "confirm / issue / reverse must lock the rows they change");
need("lib/stock-journal/model.ts", /export function parseJsonish\(/, "bookings whose form_data is a JSON string would read as quantity 0 again");
need("features/journal/components/journal-booking-stock-dashboard.tsx", 'useErpScreen("sj"', "the screen must stay five-language (namespace sj)");
need("features/journal/components/journal-booking-stock-dashboard.tsx", 'data-testid="stock-journal"', "the new Stock Journal screen was replaced");
forbid("features/journal/components/journal-booking-stock-dashboard.tsx", "journal-stock/transfer", "the screen must not post to the removed transfer route");
need("app/api/erp/sales/orders/[id]/transfer/route.ts", /issueForSalesOrder\(/, "sales posting must issue the allocations linked to its sales booking (exactly once)");
need("app/api/erp/purchases/loading-records/route.ts", /parseJsonish\(/, "the loading quantity gate must read string-encoded form_data");
need("app/api/erp/purchases/loading-records/[id]/receive/route.ts", "damagedQuantity", "receiving records damage / shortage / customs");
need("supabase/migrations/20261235_stock_journal_integration.sql", "journal_stock_transfers", "the Stock Journal ledger migration must stay in the repo");

if (problems.length) {
  console.error("✗ stock-journal-guard FAILED — the canonical Stock Journal implementation was overwritten or an older copy was restored:\n");
  for (const p of problems) console.error("  - " + p);
  console.error("\n  Restore the files from the commit that introduced them (git log -- lib/services/stock-journal-service.ts) and read docs/stock-journal.md.");
  process.exit(1);
}
console.log("✓ stock-journal-guard passed — canonical Stock Journal implementation intact.");
