import { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError } from "@/lib/permissions/middleware";

/**
 * Validates that an Enterprise Account belongs to the permitted country scope.
 * 
 * Rules:
 * 1. Super Admins bypass country isolation except where targetCountryId restricts it.
 * 2. If targetCountryId is provided (e.g., from transaction scope), the account must match targetCountryId.
 * 3. The account's country_id must be included in session.countryIds for non-Super Admins.
 * 4. Cross-country account selection between distinct countries is strictly forbidden.
 */
export async function validateAccountCountryScope(
  session: ErpSession,
  accountId: string | null | undefined,
  targetCountryId: string | null | undefined,
  adminClient: any
): Promise<void> {
  if (!accountId) return;

  const { data: account, error } = await adminClient
    .from("enterprise_accounts")
    .select("id, code, name, country_id")
    .eq("id", accountId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query account scope validation: ${error.message}`);
  }

  if (!account) {
    throw new ErpPermissionError(`Selected account ID '${accountId}' does not exist or has been deleted.`);
  }

  const accountCountryId = account.country_id;

  // 1. Session scope check for non-Super Admin
  if (!session.isSuperAdmin && accountCountryId) {
    if (!session.countryIds.includes(accountCountryId)) {
      throw new ErpPermissionError(
        `Cross-country violation: Account '${account.name}' (${account.code}) belongs to country scope '${accountCountryId}', which is outside your permitted countries.`
      );
    }
  }

  // 2. Transaction Target Country Scope Check
  if (targetCountryId && accountCountryId && accountCountryId !== targetCountryId) {
    throw new ErpPermissionError(
      `Cross-country violation: Account '${account.name}' (${account.code}) belongs to a different country than the transaction target country.`
    );
  }
}

/**
 * Validates that a Ledger belongs to the permitted country scope.
 */
export async function validateLedgerCountryScope(
  session: ErpSession,
  ledgerId: string | null | undefined,
  targetCountryId: string | null | undefined,
  adminClient: any
): Promise<void> {
  if (!ledgerId) return;

  const { data: ledger, error } = await adminClient
    .from("ledgers")
    .select("id, code, name, country_id, enterprise_account_id")
    .eq("id", ledgerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query ledger scope validation: ${error.message}`);
  }

  if (!ledger) {
    throw new ErpPermissionError(`Selected ledger ID '${ledgerId}' does not exist or has been deleted.`);
  }

  const ledgerCountryId = ledger.country_id;

  if (!session.isSuperAdmin && ledgerCountryId) {
    if (!session.countryIds.includes(ledgerCountryId)) {
      throw new ErpPermissionError(
        `Cross-country violation: Ledger '${ledger.name}' (${ledger.code}) belongs to country scope '${ledgerCountryId}', which is outside your permitted countries.`
      );
    }
  }

  if (targetCountryId && ledgerCountryId && ledgerCountryId !== targetCountryId) {
    throw new ErpPermissionError(
      `Cross-country violation: Ledger '${ledger.name}' (${ledger.code}) belongs to a different country than the transaction target country.`
    );
  }
}
