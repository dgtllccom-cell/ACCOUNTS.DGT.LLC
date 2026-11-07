/** Operational weights only. Reuses the bill's quantity × per-unit gross/net convention. */
type Row = Record<string, any>;
const number = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (value == null || String(value).trim() === "") continue;
    const n = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
};
const positive = (...values: unknown[]) => {
  for (const value of values) { const n = number(value); if (n != null && n > 0) return n; }
  return null;
};
const name = (g: Row) => String(g.itemName || g.goodsName || g.item || "").trim();
export type LoadingWeightProfile = { grossPerUnit: number | null; netPerUnit: number | null; emptyPerUnit: number | null };

export function loadingWeightProfile(goods: Row[], form: Row, selectedName: string): LoadingWeightProfile {
  const matches = goods.filter(g => name(g) === selectedName.trim());
  const g = !goods.length ? form : matches.length === 1 ? (goods.length === 1 ? { ...form, ...matches[0] } : matches[0]) : null;
  if (!g) return { grossPerUnit: null, netPerUnit: null, emptyPerUnit: null };
  const qty = positive(g.qtyNo, g.quantity, g.qty);
  const grossTotal = positive(g.grossWeight, g.gross_weight, g.grossWt);
  const netTotal = positive(g.netWeight, g.net_weight, g.netWt);
  const grossPerUnit = qty && grossTotal != null ? grossTotal / qty : positive(g.qtyKgs, g.oneQtyKgs);
  const empty = number(g.emptyKgs, g.oneEmptyKgs);
  const net = qty && netTotal != null ? netTotal / qty : grossPerUnit != null && empty != null && empty <= grossPerUnit ? grossPerUnit - empty : null;
  const netPerUnit = net != null && grossPerUnit != null && net > grossPerUnit ? null : net;
  const emptyPerUnit = grossPerUnit != null && netPerUnit != null ? grossPerUnit - netPerUnit : empty;
  return { grossPerUnit, netPerUnit, emptyPerUnit };
}

export function loadingWeights(quantity: unknown, profile: LoadingWeightProfile, grossInput?: unknown, emptyInput?: unknown) {
  const qty = positive(quantity);
  if (qty == null) return { gross: null, net: null, tare: null };
  const grossPerUnit = number(grossInput) ?? profile.grossPerUnit;
  const emptyPerUnit = number(emptyInput) ?? profile.emptyPerUnit;
  const netPerUnit = grossPerUnit != null && emptyPerUnit != null && emptyPerUnit <= grossPerUnit
    ? grossPerUnit - emptyPerUnit : number(grossInput) == null ? profile.netPerUnit : null;
  const round = (v: number) => Math.round(v * 10000) / 10000;
  const gross = grossPerUnit == null ? null : round(qty * grossPerUnit);
  const net = netPerUnit == null ? null : round(qty * netPerUnit);
  return { gross, net, tare: gross != null && net != null && gross >= net ? round(gross - net) : null };
}
