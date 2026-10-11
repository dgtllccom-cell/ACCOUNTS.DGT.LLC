/**
 * One display unit for a set of purchase records, so the approved header's cards always add up and no figure is ever guessed:
 *  - every record in the same currency  -> that currency, NO conversion at all;
 *  - mixed currencies                   -> USD, only if a rate (units of currency per 1 USD) exists for EVERY currency used;
 *  - otherwise                          -> no unit; the value is shown as "—" (never a fabricated zero or a wrong number).
 */
export type MoneyUnit = { kind: "native"; cur: string } | { kind: "usd" } | { kind: "none" };
export type RateOf = (currency: string) => number | null | undefined;

export function unitFor<T>(rows: readonly T[], currencyOf: (r: T) => string, amountOf: (r: T) => number, rateOf: RateOf): MoneyUnit {
  const curs = Array.from(new Set(rows.filter((r) => amountOf(r) > 0).map((r) => String(currencyOf(r) || "USD").toUpperCase())));
  if (curs.length === 0) return { kind: "none" };
  if (curs.length === 1) return { kind: "native", cur: curs[0] };
  return curs.every((c) => c === "USD" || Number(rateOf(c)) > 0) ? { kind: "usd" } : { kind: "none" };
}

export function valueIn<T>(unit: MoneyUnit, rows: readonly T[], currencyOf: (r: T) => string, amountOf: (r: T) => number, rateOf: RateOf): number | null {
  if (unit.kind === "none") return null;
  let total = 0;
  for (const r of rows) {
    const a = amountOf(r);
    if (!a) continue;
    if (unit.kind === "native") total += a;
    else { const c = String(currencyOf(r) || "USD").toUpperCase(); total += c === "USD" ? a : a / Number(rateOf(c)); }
  }
  return total;
}

export function fmtMoney(unit: MoneyUnit, v: number | null): string {
  if (v === null || unit.kind === "none") return "—";
  return `${unit.kind === "usd" ? "$" : unit.cur} ${Math.round(v).toLocaleString("en-US")}`;
}
export const fmtInt = (n: number) => n.toLocaleString("en-US");
export const fmtPct = (a: number | null, b: number | null) => (a === null || b === null || !b ? undefined : `${((a / b) * 100).toFixed(1)}%`);
