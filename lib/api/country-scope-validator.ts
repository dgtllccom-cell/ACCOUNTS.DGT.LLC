import { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError } from "@/lib/permissions/middleware";

/**
 * A branch-scoped user (cashier / accountant / Brother-User etc.) carries
 * cityBranchIds / countryBranchIds but NO countryIds. They are still legitimately
 * "in" the country that owns their branch — so a ledger/account tagged with that
 * country is in scope. This resolves that implied country membership without
 * widening any data-filter query (those still use session.countryIds).
 */
async function sessionCoversCountryViaBranch(
  session: ErpSession,
  countryId: string,
  adminClient: any,
): Promise<boolean> {
  const cityIds = session.cityBranchIds ?? [];
  const cbIds = session.countryBranchIds ?? [];
  if (cityIds.length === 0 && cbIds.length === 0) return false;
  try {
    if (cityIds.length) {
      const { data } = await adminClient
        .from("city_branches").select("id").eq("country_id", countryId).in("id", cityIds).limit(1);
      if (Array.isArray(data) && data.length) return true;
    }
    if (cbIds.length) {
      const { data } = await adminClient
        .from("country_branches").select("id").eq("country_id", countryId).in("id", cbIds).limit(1);
      if (Array.isArray(data) && data.length) return true;
    }
  } catch { /* fail-closed on lookup error — the throw below still applies */ }
  return false;
}

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

  try {
    if (isUuid) {
      const { data } = await adminClient
        .from("enterprise_accounts")
        .select("id, code, name, country_id")
        .eq("id", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      account = data;
    }

    if (!account) {
      const { data: codeData } = await adminClient
        .from("enterprise_accounts")
        .select("id, code, name, country_id")
        .eq("code", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      account = codeData;
    }

    if (!account) {
      const { data: refData } = await adminClient
        .from("enterprise_accounts")
        .select("id, code, name, country_id")
        .eq("manual_reference_number", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      account = refData;
    }

    if (!account) {
      const { data: accNumData } = await adminClient
        .from("enterprise_accounts")
        .select("id, code, name, country_id")
        .eq("account_number", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      account = accNumData;
    }
  } catch (err) {
    console.warn("Account scope lookup warning:", err);
    return;
  }

  if (!account) {
    return;
  }

  const accountCountryId = account.country_id;

  // 1. Session scope check for non-Super Admin
  if (!session.isSuperAdmin && accountCountryId) {
    if (
      !session.countryIds.includes(accountCountryId) &&
      !(await sessionCoversCountryViaBranch(session, accountCountryId, adminClient))
    ) {
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

  try {
    if (isUuid) {
      const { data } = await adminClient
        .from("ledgers")
        .select("id, code, name, country_id, enterprise_account_id")
        .eq("id", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      ledger = data;
    }

    if (!ledger) {
      const { data: codeData } = await adminClient
        .from("ledgers")
        .select("id, code, name, country_id, enterprise_account_id")
        .eq("code", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      ledger = codeData;
    }

    if (!ledger) {
      const { data: refData } = await adminClient
        .from("ledgers")
        .select("id, code, name, country_id, enterprise_account_id")
        .eq("manual_reference_number", trimmedId)
        .is("deleted_at", null)
        .maybeSingle();
      ledger = refData;
    }
  } catch (err) {
    console.warn("Ledger scope lookup warning:", err);
    return;
  }

  if (!ledger) {
    return;
  }

  const ledgerCountryId = ledger.country_id;

  if (!session.isSuperAdmin && ledgerCountryId) {
    if (
      !session.countryIds.includes(ledgerCountryId) &&
      !(await sessionCoversCountryViaBranch(session, ledgerCountryId, adminClient))
    ) {
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
