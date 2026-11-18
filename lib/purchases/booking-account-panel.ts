/**
 * Purchase Booking report — which account and which company a Purchase / Sales Account panel may show.
 *
 * Display only: saved bills are never rewritten. A bill saved before 18 Nov could carry a company name that the old
 * "first company in the list" fallback put there, although the selected account has no company at all. The panel must
 * show only what belongs to the selected account record, so a saved company is shown only when it is the company that
 * account itself links to.
 */

export type PanelAccount = {
  id?: string | null;
  accountId?: string | null;
  accountCode?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
};

export type PanelCompany = { id?: string | null; name?: string | null; [key: string]: unknown };

/** True only for the explicitly selected account: id first, then code / account number, and the name only when neither is saved. */
export function matchesSelectedAccount(account: PanelAccount, id?: string | null, code?: string | null, name?: string | null): boolean {
  if (id && String(account.id || account.accountId || "") === String(id)) return true;
  if (code && (String(account.accountCode || "") === String(code) || String(account.accountNumber || "") === String(code))) return true;
  return !id && !code && Boolean(name) && account.accountName === name;
}

export function findSelectedAccount<T extends PanelAccount>(accounts: T[], id?: string | null, code?: string | null, name?: string | null): T | null {
  return accounts.find((a) => matchesSelectedAccount(a, id, code, name)) || null;
}

/**
 * The company to show for a selected account.
 * - Account found in the account master: only the company it links to (by id, else by its own company name); none → null,
 *   whatever the saved bill says.
 * - Account not loaded (e.g. master unavailable): fall back to the saved company id, never to a name match on another party.
 */
export function resolveAccountCompany<T extends PanelCompany>(
  account: PanelAccount | null,
  companies: T[],
  savedCompanyId?: string | null
): T | null {
  if (account) {
    if (account.companyId) return companies.find((c) => String(c.id) === String(account.companyId)) || null;
    if (account.companyName) return companies.find((c) => c.name === account.companyName) || null;
    return null;
  }
  if (savedCompanyId) return companies.find((c) => String(c.id) === String(savedCompanyId)) || null;
  return null;
}

/** Company name for the panel: the resolved company or the account's own company name — never a name typed on the bill alone. */
export function accountCompanyName(account: PanelAccount | null, company: PanelCompany | null): string {
  if (company?.name) return String(company.name);
  return account?.companyName ? String(account.companyName) : "";
}
