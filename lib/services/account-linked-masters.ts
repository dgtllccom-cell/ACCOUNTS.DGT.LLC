/**
 * A linked company / bank entry as it is STORED on an account (enterprise_accounts.linked_companies / linked_banks).
 *
 * The name a screen shows for a linked master is the master record's own saved name, resolved live on every read
 * (accounts/[id] GET). A language view of that name must never be written back into the account: the form sends the
 * names it displays, so the stored entry keeps only the link (id, primary flag, code, country …) and never a `name`.
 */
export function storableLinkedMaster<T extends object>(item: T): Omit<T, "name"> {
  const copy: Record<string, unknown> = { ...(item as Record<string, unknown>) };
  delete copy.name;
  return copy as Omit<T, "name">;
}
