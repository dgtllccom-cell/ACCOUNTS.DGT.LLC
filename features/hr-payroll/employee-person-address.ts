type Person = {
  id: string;
  address?: string | null;
  city_name?: string | null;
  state_province_name?: string | null;
  country_name?: string | null;
  address_country_name?: string | null;
};

export function resolveEmployeePerson<T extends Person>(
  id: string, loaded: T | null, entries: readonly T[],
): T | null {
  if (!id) return null;
  return loaded?.id === id ? loaded : entries.find((entry) => entry.id === id) ?? null;
}

export function employeePersonAddress(person: Person | null): string | null {
  if (!person) return null;
  // Customer / Person Master is the source, not the branch where the employee works.
  const street = person.address?.trim();
  const country = person.address_country_name || ((person.city_name || person.state_province_name) ? person.country_name : null);
  return (street === "-" ? "" : street) ||
    [person.city_name, person.state_province_name, country].map((value) => value?.trim()).filter(Boolean).join(", ") ||
    null;
}
