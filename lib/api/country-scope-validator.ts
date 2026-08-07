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
  if (!accountId || typeof accountId !== "string") return;
  const trimmedId = accountId.trim();
  if (!trimmedId) return;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);

  let account: any = null;
  let queryError: any = null;

  if (isUuid) {
    const { data, error } = await adminClient
      .from("enterprise_accounts")
      .select("id, code, name, country_id")
      .eq("id", trimmedId)
      .is("deleted_at", null)
      .maybeSingle();
    account = data;
    queryError = error;
  } else {
    // Search by code or manual_reference_number
    const { data, error } = await adminClient
      .from("enterprise_accounts")
      .select("id, code, name, country_id")
      .or(`code.eq."${trimmedId}",manual_reference_number.eq."${trimmedId}"`)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      const { data: fallbackData, error: fallbackErr } = await adminClient
        .from("enterprise_accounts")
        .select("id, code, name, country_id")
        .eq("code", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      account = fallbackData;
      queryError = fallbackErr;
    } else {
      account = data;
    }
  }

  if (queryError) {
    throw new Error(`Failed to query account scope validation: ${queryError.message}`);
  }

  if (!account) {
    return;
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
  if (!ledgerId || typeof ledgerId !== "string") return;
  const trimmedId = ledgerId.trim();
  if (!trimmedId) return;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);

  let ledger: any = null;
  let queryError: any = null;

  if (isUuid) {
    const { data, error } = await adminClient
      .from("ledgers")
      .select("id, code, name, country_id, enterprise_account_id")
      .eq("id", trimmedId)
      .is("deleted_at", null)
      .maybeSingle();
    ledger = data;
    queryError = error;
  } else {
    const { data, error } = await adminClient
      .from("ledgers")
      .select("id, code, name, country_id, enterprise_account_id")
      .or(`code.eq."${trimmedId}",manual_reference_number.eq."${trimmedId}"`)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      const { data: fallbackData, error: fallbackErr } = await adminClient
        .from("ledgers")
        .select("id, code, name, country_id, enterprise_account_id")
        .eq("code", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      ledger = fallbackData;
      queryError = fallbackErr;
    } else {
      ledger = data;
    }
  }

  if (queryError) {
    throw new Error(`Failed to query ledger scope validation: ${queryError.message}`);
  }

  if (!ledger) {
    return;
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
