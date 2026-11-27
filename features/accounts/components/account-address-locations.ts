type AddressChoice = {
  id: string;
  name: string;
  is_active: boolean;
  country_id?: string | null;
  state_province_id?: string | null;
  code?: string | null;
  iso2?: string | null;
};

export function activeAddressChoices<T extends AddressChoice>(
  rows: readonly T[],
  countryId: string,
  stateId?: string,
  includeInactive = false,
): T[] {
  return rows.filter((row) =>
    (includeInactive || row.is_active) && row.country_id === countryId &&
    (stateId === undefined || row.state_province_id === stateId));
}

function normalized(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function findAddressDuplicate<T extends AddressChoice>(
  rows: readonly T[],
  name: string,
  code: string,
  isCountry: boolean,
): T | null {
  const expectedCode = normalized(code);
  const expectedName = normalized(name);
  const byCode = expectedCode ? rows.find((row) => normalized(isCountry ? row.iso2 : row.code) === expectedCode) : undefined;
  const byName = rows.find((row) => Boolean(expectedName) && normalized(row.name) === expectedName);
  if (byCode && byName && byCode.id !== byName.id) return null;
  if (byCode) return byCode;
  // A country with the same name but a different ISO2 must not be silently selected.
  if (byName && isCountry && expectedCode && normalized(byName.iso2) !== expectedCode) {
    return null;
  }
  return byName ?? null;
}
