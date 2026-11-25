export type ScopeSerials = { superAdmin: string | null; country: string | null; mainBranch: string | null; cityBranch: string | null };
export type TransferScopeSerials = { voucher: ScopeSerials; debit: ScopeSerials; credit: ScopeSerials };

export const transferSerialLevels = [
  ["superAdmin", "Super Admin"],
  ["country", "Country"],
  ["mainBranch", "Main Branch"],
  ["cityBranch", "City Branch"],
] as const;

type SerialRow = Record<string, unknown>;
const cleanSerial = (value: unknown) => typeof value === "string" ? value.trim() || null : null;

/** Keep the actual recorded serials by level. Never infer one level from another. */
export function scopeSerials(row: SerialRow | null | undefined): ScopeSerials {
  return {
    superAdmin: cleanSerial(row?.super_admin_serial_number),
    country: cleanSerial(row?.country_transaction_serial_number),
    mainBranch: cleanSerial(row?.main_branch_transaction_serial),
    cityBranch: cleanSerial(row?.city_branch_transaction_serial),
  };
}

export function groupExactSerials<T extends string>(references: ReadonlyArray<readonly [T, unknown]>) {
  const grouped = new Map<string, T[]>();
  for (const [kind, candidate] of references) {
    const serial = cleanSerial(candidate);
    if (!serial) continue;
    grouped.set(serial, [...(grouped.get(serial) ?? []), kind]);
  }
  return Array.from(grouped, ([serial, kinds]) => ({ serial, kinds }));
}

/** A legacy booking's one branch number belongs to its original city when present, otherwise its main branch. */
export function bookingScopeSerials(record: SerialRow = {}, form: SerialRow = {}): ScopeSerials {
  const data = record.form_data as { traceability?: SerialRow } | null | undefined;
  const trace = data?.traceability ?? {};
  const booking = (form.bookingSerials ?? {}) as SerialRow;
  const legacyBranch = cleanSerial(record.branch_transaction_serial_number ?? trace.branchTransactionSerialNumber ?? booking.branchTransactionSerialNumber);
  const cityId = record.city_branch_id ?? form.cityBranchId;
  const mainId = record.country_branch_id ?? form.countryBranchId;
  return {
    superAdmin: cleanSerial(record.super_admin_serial_number ?? trace.superAdminSerialNumber ?? booking.superAdminSerialNumber),
    country: cleanSerial(record.country_transaction_serial_number ?? trace.countryTransactionSerialNumber ?? booking.countryTransactionSerialNumber),
    mainBranch: cleanSerial(record.main_branch_transaction_serial ?? trace.mainBranchTransactionSerialNumber ?? booking.mainBranchTransactionSerialNumber)
      ?? (!cityId && mainId ? legacyBranch : null),
    cityBranch: cleanSerial(record.city_branch_transaction_serial ?? trace.cityBranchTransactionSerialNumber ?? booking.cityBranchTransactionSerialNumber)
      ?? (cityId ? legacyBranch : null),
  };
}
