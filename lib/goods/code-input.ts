/** Format up to eight numeric digits for display without discarding legacy codes. */
export function formatGoodsCodeInput(value: string): string {
  const trimmed = value.toUpperCase();
  if (!/^[0-9.\s-]*$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length > 8) return trimmed;
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}
