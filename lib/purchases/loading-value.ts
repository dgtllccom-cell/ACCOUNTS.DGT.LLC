/**
 * What one loading is worth, from the goods it really carries — quantity and weight — at the contract's own price for that goods line.
 * A bill with several trucks must not be split into equal parts: trucks carry different goods, quantities and weights, and goods are priced
 * per KG, per ton or per unit. Pure (rows in, number out); the callers hand over the bill's `goodsEntries` and the loading row.
 *
 *   per KG   : net kg ÷ divideWeight × price   (divideWeight = kg per price unit: 1 → price per kg, 20 → price per 20 kg)
 *   per ton  : net kg ÷ 1000 × price
 *   per unit : quantity × price
 *   otherwise: the line's total × (loaded quantity ÷ line quantity)
 *
 * Returns null when the loading cannot be matched to the bill's goods lines (the caller then falls back to the quantity share).
 */

const num = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export type PriceBasis = "per_kg" | "per_ton" | "per_unit" | "share";

export type ContractLine = {
  goodsId: string;
  goodsName: string;
  qty: number;
  netKg: number;
  totalAmount: number;
  price: number;
  basis: PriceBasis;
  /** kg per price unit for per-kg pricing */
  kgPerPriceUnit: number;
};

export type LoadedGoods = { goodsId: string; goodsName: string; qty: number; netKg: number };

function basisOf(priceType: unknown): PriceBasis {
  const t = norm(priceType);
  if (!t) return "share";
  if (/(^|[^a-z])(ton|tons|tonne|tonnes|mt)([^a-z]|$)/.test(t)) return "per_ton";
  if (t.includes("kg")) return "per_kg";
  if (/(qty|quantity|carton|box|bag|unit|pcs|piece|each)/.test(t)) return "per_unit";
  return "share";
}

/** the bill's goods lines with their contract prices */
export function contractLines(goodsEntries: unknown): ContractLine[] {
  if (!Array.isArray(goodsEntries)) return [];
  return goodsEntries
    .map((g: any) => {
      const price = num(g?.coursePrice ?? g?.price ?? g?.rate);
      const divide = num(g?.divideWeight);
      return {
        goodsId: String(g?.goodsId ?? g?.goods_id ?? ""),
        goodsName: String(g?.goodsName ?? g?.item ?? g?.name ?? ""),
        qty: num(g?.qtyNo ?? g?.quantity ?? g?.qty),
        netKg: num(g?.netWeight ?? g?.netKgs),
        totalAmount: num(g?.totalAmount),
        price,
        basis: price > 0 ? basisOf(g?.priceType) : ("share" as PriceBasis),
        kgPerPriceUnit: divide > 0 ? divide : 1
      };
    })
    .filter((l) => l.qty > 0 || l.totalAmount > 0);
}

/** the goods a loading carries: its own goods entries when it has them, otherwise the loading row's quantity and net weight */
export function loadedGoodsOf(loading: { loaded_quantity?: unknown; net_weight?: unknown; report_payload?: unknown }): LoadedGoods[] {
  const payload: any = typeof loading.report_payload === "string" ? safeParse(loading.report_payload) : loading.report_payload || {};
  const loadedQty = num(loading.loaded_quantity) || num(payload?.loadedQuantity);
  const entries: any[] = Array.isArray(payload?.goodsEntries) ? payload.goodsEntries : [];
  const fromEntries: LoadedGoods[] = entries
    .map((e) => {
      const qty = num(e?.quantityNo ?? e?.qtyNo ?? e?.quantity);
      const gross = num(e?.oneQtyKgs ?? e?.qtyKgs);
      const empty = num(e?.oneEmptyKgs ?? e?.emptyKgs);
      return { goodsId: String(e?.goodsId ?? ""), goodsName: String(e?.goodsName ?? ""), qty, netKg: gross > 0 ? qty * Math.max(0, gross - empty) : 0 };
    })
    .filter((e) => e.qty > 0);
  const sumQty = fromEntries.reduce((s, e) => s + e.qty, 0);
  // the entries must agree with the quantity the loading row itself records; otherwise the row is the truth
  if (fromEntries.length && (loadedQty <= 0 || Math.abs(sumQty - loadedQty) <= 0.5)) {
    const rowKg = num(loading.net_weight);
    if (fromEntries.length === 1 && rowKg > 0) return [{ ...fromEntries[0], netKg: rowKg }]; // the weighed net weight wins over qty × per-unit weight
    return fromEntries;
  }
  return loadedQty > 0 ? [{ goodsId: "", goodsName: "", qty: loadedQty, netKg: num(loading.net_weight) }] : [];
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/**
 * The loading's value in the bill's purchase currency, or null when it cannot be priced from the goods lines.
 */
export function loadingGoodsValue(
  lines: ContractLine[],
  loading: { loaded_quantity?: unknown; net_weight?: unknown; report_payload?: unknown }
): number | null {
  if (!lines.length) return null;
  const goods = loadedGoodsOf(loading);
  if (!goods.length) return null;
  let total = 0;
  for (const g of goods) {
    const line =
      (g.goodsId && lines.find((l) => l.goodsId && l.goodsId === g.goodsId)) ||
      (g.goodsName && lines.find((l) => norm(l.goodsName) === norm(g.goodsName))) ||
      (lines.length === 1 ? lines[0] : undefined);
    if (!line) return null;
    const share = line.qty > 0 ? g.qty / line.qty : 0;
    let v: number;
    if (line.basis === "per_kg") {
      const kg = g.netKg > 0 ? g.netKg : line.netKg * share;
      v = (kg / line.kgPerPriceUnit) * line.price;
    } else if (line.basis === "per_ton") {
      const kg = g.netKg > 0 ? g.netKg : line.netKg * share;
      v = (kg / 1000) * line.price;
    } else if (line.basis === "per_unit") {
      v = g.qty * line.price;
    } else {
      v = line.totalAmount * share;
    }
    if (!Number.isFinite(v) || v < 0) return null;
    total += v;
  }
  return round4(total);
}
