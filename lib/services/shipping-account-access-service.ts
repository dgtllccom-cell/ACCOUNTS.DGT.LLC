/* eslint-disable @typescript-eslint/no-explicit-any */
// Shipping Line user extensions on top of the existing Account Master / Ledger /
// Roznamcha architecture: same-country cross-branch account search, a minimal
// (non-balance) account projection for out-of-own-branch accounts, an own-postings-only
// transaction view, and cross-branch DR/CR posting. Reuses enterprise_accounts, ledgers,
// roznamcha_entries/roznamcha_lines and the canonical posting engine (posting.ts) — no
// duplicate Account Master, no duplicate ledger/transaction tables.
import { withReadPg, withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";
import { hasRolePermission, ErpPermissionError } from "@/lib/permissions/middleware";

export type MinimalAccountView = {
  id: string;
  code: string;
  name: string;
  currency: string;
  accountNumber: string | null;
  manualReferenceNumber: string | null;
  customerNumber: string | null;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  operationalDomain: string | null;
  ledgerId: string | null;
  isOwnBranch: boolean;
  /** Only populated when the session holds `ledger_full:read`, or the account is in the session's own branch scope. */
  currentBalance: number | null;
}

function isOwnBranchScope(session: ErpSession, countryBranchId: string | null, cityBranchId: string | null) {
  if (session.isSuperAdmin) return true;
  // A city-branch-scoped session's "own branch" is its SPECIFIC city branch — not every
  // city branch under the same parent Main Branch. Two city branches in the same country
  // (e.g. Chaman and Quetta) commonly share one country_branch_id, so matching on that
  // alone would treat every sibling branch as "own" and leak its full balance. Only a
  // session with no city-branch assignment at all (e.g. a main_branch_admin, whose own
  // scope genuinely IS the main-branch level) falls back to the country-branch match.
  if (session.cityBranchIds?.length) {
    return Boolean(cityBranchId && session.cityBranchIds.includes(cityBranchId));
  }
  if (countryBranchId && session.countryBranchIds?.includes(countryBranchId)) return true;
  return false;
}

function hasFullLedgerView(session: ErpSession) {
  return session.isSuperAdmin || hasRolePermission(session, "ledger_full", "read");
}

export function assertSameCountry(session: ErpSession, accountCountryId: string | null) {
  if (session.isSuperAdmin) return;
  if (!accountCountryId) return;
  if (!session.countryIds?.includes(accountCountryId)) {
    throw new ErpPermissionError("This account belongs to a country outside your permitted scope.");
  }
}

function project(row: any, session: ErpSession): MinimalAccountView {
  const ownBranch = isOwnBranchScope(session, row.country_branch_id, row.city_branch_id);
  const showBalance = ownBranch || hasFullLedgerView(session);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    currency: row.currency,
    accountNumber: row.account_number ?? null,
    manualReferenceNumber: row.manual_reference_number ?? null,
    customerNumber: row.customer_number ?? null,
    countryId: row.country_id ?? null,
    countryBranchId: row.country_branch_id ?? null,
    cityBranchId: row.city_branch_id ?? null,
    operationalDomain: row.operational_domain ?? null,
    ledgerId: row.ledger_id ?? null,
    isOwnBranch: ownBranch,
    currentBalance: showBalance ? Number(row.current_balance ?? 0) : null
  };
}

/**
 * Same-country account search for a Shipping Line user holding `accounts:read`.
 * Deliberately returns ONLY identifying fields plus a balance (current_balance) that is
 * stripped unless the row is in the caller's own branch scope or they hold
 * `ledger_full:read` — "enough to identify/select the account", never its full history.
 */
export async function searchSameCountryAccounts(
  session: ErpSession,
  params: { query: string; countryId: string; limit?: number }
): Promise<MinimalAccountView[]> {
  if (!hasRolePermission(session, "accounts", "read")) {
    throw new ErpPermissionError("Missing permission: accounts:read");
  }
  assertSameCountry(session, params.countryId);

  const limit = Math.max(1, Math.min(params.limit ?? 25, 100));
  const q = params.query.trim();
  const likeValue = `%${q}%`;

  const rows = await withReadPg(async (sql) => {
    return sql`
      select ea.id, ea.code, ea.name, ea.currency, ea.account_number, ea.manual_reference_number,
             ea.customer_number, ea.country_id, ea.country_branch_id, ea.city_branch_id,
             ea.operational_domain, ea.current_balance, l.id as ledger_id
      from public.enterprise_accounts ea
      left join public.ledgers l on l.enterprise_account_id = ea.id and l.deleted_at is null
      where ea.deleted_at is null
        and ea.country_id = ${params.countryId}
        and ea.operational_domain in ('shipping', 'both')
        and (
          ea.code ilike ${likeValue} or ea.name ilike ${likeValue} or
          ea.account_number ilike ${likeValue} or ea.manual_reference_number ilike ${likeValue} or
          ea.customer_number ilike ${likeValue}
        )
      order by ea.name asc
      limit ${limit}
    `;
  });

  return (rows ?? []).map((row: any) => project(row, session));
}

/** Minimal identity + ledger id for a specific account, for cross-branch posting/selection. */
export async function getAccountForCrossBranchAccess(session: ErpSession, accountId: string): Promise<MinimalAccountView | null> {
  if (!hasRolePermission(session, "accounts", "read")) {
    throw new ErpPermissionError("Missing permission: accounts:read");
  }

  const rows = await withReadPg(async (sql) => {
    return sql`
      select ea.id, ea.code, ea.name, ea.currency, ea.account_number, ea.manual_reference_number,
             ea.customer_number, ea.country_id, ea.country_branch_id, ea.city_branch_id,
             ea.operational_domain, ea.current_balance, l.id as ledger_id
      from public.enterprise_accounts ea
      left join public.ledgers l on l.enterprise_account_id = ea.id and l.deleted_at is null
      where ea.deleted_at is null and ea.id = ${accountId}
      limit 1
    `;
  });

  const row = rows?.[0];
  if (!row) return null;
  assertSameCountry(session, row.country_id);
  return project(row, session);
}

/**
 * The caller's OWN posted lines against a given account — the one thing a Shipping user
 * is guaranteed to see on an account outside their own branch, per the owner's rule
 * ("permission to POST is not permission to VIEW the full ledger").
 */
export async function getOwnPostedTransactions(
  session: ErpSession,
  params: { enterpriseAccountId: string; limit?: number }
) {
  const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
  const rows = await withReadPg(async (sql) => {
    return sql`
      select rl.id as line_id, rl.debit, rl.credit, rl.currency, rl.usd_amount, rl.description,
             re.id as entry_id, re.voucher_no, re.journal_no, re.entry_date, re.narration,
             re.entry_category, re.operational_domain, re.created_at, re.posted_at
      from public.roznamcha_lines rl
      join public.roznamcha_entries re on re.id = rl.roznamcha_entry_id
      where rl.enterprise_account_id = ${params.enterpriseAccountId}
        and re.created_by = ${session.userId}
        and re.deleted_at is null
      order by re.created_at desc
      limit ${limit}
    `;
  });
  return rows ?? [];
}

/** Whether this session may post a cross-branch (same-country) DR/CR entry. */
export function canPostCrossBranch(session: ErpSession) {
  return session.isSuperAdmin || hasRolePermission(session, "roznamcha", "post_cross_branch");
}
