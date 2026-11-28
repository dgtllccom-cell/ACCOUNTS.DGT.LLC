/** Reserved account-number namespace for non-transactional ERP master records. */
export function isDemoBankAccountNumber(value: unknown): boolean {
  return typeof value === "string" && /^DEMO-NONPAY-/i.test(value.trim());
}
