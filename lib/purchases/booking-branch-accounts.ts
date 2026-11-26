type Side = "purchase" | "sales";

export type BookingAccountScope = {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
};

export type BookingDefaultAccount = BookingAccountScope & {
  id?: string | null;
  accountId?: string | null;
  accountCode?: string | null;
  accountName?: string | null;
  operationalDomain?: string | null;
  status?: string | null;
};

export type BookingAccountChoice = { mode: "manual" } | { mode: "automatic"; scope: string; id: string };

const id = (value?: string | null) => String(value || "").trim();
const words = (value?: string | null) => id(value).toLowerCase().replace(/[-_.]+/g, " ").replace(/\s+/g, " ");
const purchaseLabel = /^business purchases?( account)?$/;
const salesLabel = /^business sales?( account)?$/;

export function branchBusinessScopeKey(scope: BookingAccountScope) {
  if (!id(scope.countryId) || id(scope.countryId).toLowerCase() === "all" || (!id(scope.countryBranchId) && !id(scope.cityBranchId))) return null;
  return [id(scope.countryId), id(scope.countryBranchId), id(scope.cityBranchId)].join("/");
}

function matchesExactBranch(account: BookingDefaultAccount, scope: BookingAccountScope) {
  if (id(account.countryId) !== id(scope.countryId)) return false;
  const city = id(scope.cityBranchId);
  const main = id(scope.countryBranchId);
  if (city) return id(account.cityBranchId) === city && (!main || id(account.countryBranchId) === main);
  return !id(account.cityBranchId) && id(account.countryBranchId) === main;
}

/** With no configured unique Business role at the exact branch, nothing is safe to auto-select. */
export function branchBusinessAccountDefaults<T extends BookingDefaultAccount>(accounts: readonly T[], scope: BookingAccountScope): Record<Side, T | null> {
  if (!branchBusinessScopeKey(scope)) return { purchase: null, sales: null };
  const eligible = accounts.filter((a) => id(a.id || a.accountId) && id(a.accountCode) && words(a.operationalDomain) === "business" &&
    words(a.status) === "active" && matchesExactBranch(a, scope));
  const one = (role: RegExp) => {
    const matches = eligible.filter((a) => role.test(words(a.accountName)));
    return matches.length === 1 ? matches[0] : null;
  };
  return { purchase: one(purchaseLabel), sales: one(salesLabel) };
}

/** An automatic choice may be replaced at another branch; saved/manual accounts never are. */
export function branchDefaultAction<T extends BookingDefaultAccount>(options: {
  savedBill: boolean; scope: string | null; choice?: BookingAccountChoice | null;
  selected: { id?: string | null; code?: string | null; name?: string | null };
  candidate: T | null;
}): { type: "keep" | "clear" } | { type: "select"; account: T } {
  const { savedBill, scope, choice, selected, candidate } = options;
  if (savedBill || choice?.mode === "manual") return { type: "keep" };
  const tracked = choice?.mode === "automatic" && choice.id === id(selected.id);
  const alreadySelected = Boolean(id(selected.id) || id(selected.code) || id(selected.name));
  if (alreadySelected && (!tracked || choice?.scope === scope)) return { type: "keep" };
  if (scope && candidate) return { type: "select", account: candidate };
  return { type: tracked ? "clear" : "keep" };
}

/** A returned account ID is authoritative even when two branches reuse the same code. */
export function preferSameAccount<T extends BookingDefaultAccount>(accounts: readonly T[], selected: T, code: string): T {
  const selectedId = id(selected.id || selected.accountId);
  if (selectedId) return accounts.find(a => id(a.id || a.accountId) === selectedId) ?? selected;
  const normalized = id(code).toLowerCase();
  const matches = normalized ? accounts.filter(a => id(a.accountCode).toLowerCase() === normalized) : [];
  return matches.length === 1 ? matches[0] : selected;
}
