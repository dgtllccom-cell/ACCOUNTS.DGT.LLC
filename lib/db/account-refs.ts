import { withReadPg } from "@/lib/db/local-postgres";
import { isUuid } from "@/lib/utils";

/**
 * Screens show — and links, bookmarks and typed searches carry — an account's human
 * reference instead of its id: the account number (enterprise_accounts.account_number,
 * e.g. "ACC-000080", which every ledger lookup row exposes as `accountCode`), the
 * account / ledger code, or the manual reference number. Comparing one of those with a
 * uuid column makes Postgres raise 22P02 "invalid input syntax for type uuid" and failed
 * the whole request with a 500. These helpers map a reference to the real id.
 *
 * They only translate a reference; they never grant access. Callers keep applying their
 * own session scope to the id they get back. Without a direct database connection a
 * human reference simply does not resolve (treated as not found, never as an error).
 */

const refsOf = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((v) => String(v ?? "").trim()).filter((v) => v && !isUuid(v)).map((v) => v.toUpperCase()))];

/** enterprise_accounts.id for an id or a human account reference; null when nothing matches. */
export async function resolveEnterpriseAccountId(ref: string | null | undefined): Promise<string | null> {
  const value = String(ref ?? "").trim();
  if (!value) return null;
  if (isUuid(value)) return value;
  const key = value.toUpperCase();
  const rows = await withReadPg((sql) => sql`
    select ea.id from public.enterprise_accounts ea
    where ea.deleted_at is null
      and (upper(ea.account_number) = ${key} or upper(ea.code) = ${key} or upper(ea.manual_reference_number) = ${key})
    order by case when upper(ea.account_number) = ${key} then 0 when upper(ea.code) = ${key} then 1 else 2 end
    limit 1
  `);
  return (rows?.[0]?.id as string | undefined) ?? null;
}

/**
 * ledgers.id values for a mix of ids and human references (ledger code, or the linked
 * account's number / code / manual reference). Ids pass through unchanged; references
 * that match nothing are dropped.
 */
export async function resolveLedgerIds(values: (string | null | undefined)[]): Promise<string[]> {
  const ids = [...new Set(values.map((v) => String(v ?? "").trim()).filter((v) => isUuid(v)))];
  const refs = refsOf(values);
  if (!refs.length) return ids;
  const rows = await withReadPg((sql) => sql`
    select l.id from public.ledgers l
    where l.deleted_at is null
      and (
        upper(l.code) = any(${refs}::text[])
        or l.enterprise_account_id in (
          select ea.id from public.enterprise_accounts ea
          where ea.deleted_at is null
            and (upper(ea.account_number) = any(${refs}::text[]) or upper(ea.code) = any(${refs}::text[]) or upper(ea.manual_reference_number) = any(${refs}::text[]))
        )
      )
  `);
  return [...new Set([...ids, ...((rows ?? []) as unknown as { id: string }[]).map((r) => r.id)])];
}
