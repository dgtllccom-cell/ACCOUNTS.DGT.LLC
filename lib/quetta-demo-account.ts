/** Identifies only the approved Quetta fixture references, not ordinary manual refs. */
export function isQuettaDemoReference(reference: string): boolean {
  if (!/^QTEST\d{4}$/i.test(reference)) return false;
  const serial = Number(reference.slice(5));
  return serial >= 501 && serial <= 1000;
}

type LinkedEntry = { id?: string | null };
type QuettaDemoDetails = {
  manualReferenceNumber?: string | null; scope?: string; code?: string; currency?: string;
  countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null;
  addressCountryId?: string | null; addressStateId?: string | null; addressCityId?: string | null;
  fullAddress?: string | null; contacts?: readonly unknown[]; customerId?: string | null;
  companyId?: string | null; companyIds?: readonly string[]; linkedCompanies?: readonly LinkedEntry[];
  bankId?: string | null; bankIds?: readonly string[]; linkedBanks?: readonly LinkedEntry[];
  isControlAccount?: boolean; openingBalance?: number; category?: string | null;
};
export function validQuettaDemoFields(body: QuettaDemoDetails): boolean {
  function one(primary?: string | null, ids: readonly string[] = [], rows: readonly LinkedEntry[] = []) {
    return rows.every((row) => Boolean(row.id)) && new Set([primary, ...ids, ...rows.map(r=>r.id)].filter(Boolean)).size === 1;
  }
  return Boolean(body.manualReferenceNumber && body.manualReferenceNumber === body.manualReferenceNumber.toUpperCase() &&
    body.scope === "city_branch" && body.code === "AUTO" && body.currency === "PKR" &&
    body.countryId && body.countryBranchId && body.cityBranchId && body.customerId &&
    body.addressCountryId && body.addressStateId && body.addressCityId && body.fullAddress?.trim() &&
    body.contacts?.length && body.openingBalance === 0 && !body.isControlAccount &&
    ["P", "S", "P/S"].includes(body.category ?? "") &&
    one(body.companyId,body.companyIds,body.linkedCompanies) && one(body.bankId,body.bankIds,body.linkedBanks));
}
