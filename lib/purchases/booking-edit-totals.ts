import { effectiveFxRate } from "./fx-operator";

export const roundBookingAmount = (value: number) => Math.round(value * 10_000) / 10_000;

type GoodsInput = Record<string, unknown>;

export function calculateBookingEditTotals(goods: GoodsInput[], exchangeRate: number, operator: "*" | "/") {
  if (!goods.length || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error("Enter booking goods and a positive exchange rate.");
  }
  const multiplier = effectiveFxRate(exchangeRate, operator);
  const lines = goods.map((line) => {
    const qtyNo = Number(line.qtyNo);
    const qtyKgs = Number(line.qtyKgs ?? (Number(line.grossWeight || 0) / qtyNo));
    const emptyKgs = Number(line.emptyKgs ?? Math.max(0, (Number(line.grossWeight || 0) - Number(line.netWeight || 0)) / qtyNo));
    const divideWeight = Number(line.divideWeight || 1);
    const coursePrice = Number(line.coursePrice);
    const grossWeight = roundBookingAmount(qtyNo * qtyKgs);
    const netWeight = roundBookingAmount(Number(line.netWeight ?? Math.max(0, grossWeight - qtyNo * emptyKgs)));
    if (!String(line.goodsName ?? "").trim() || qtyNo <= 0 || divideWeight <= 0 ||
      [qtyNo, qtyKgs, emptyKgs, divideWeight, coursePrice, grossWeight, netWeight].some((n) => !Number.isFinite(n) || n < 0) ||
      (grossWeight > 0 && netWeight > grossWeight)) {
      throw new Error("Check the goods quantity, weights and purchase price.");
    }
    // A manually agreed original amount is supported by the wizard. Validate the
    // entered amount, then calculate the converted amount from the booking's FX.
    const totalAmount = roundBookingAmount(Number(line.totalAmount ?? (netWeight / divideWeight) * coursePrice));
    const finalAmount = roundBookingAmount(totalAmount * multiplier);
    if (!Number.isFinite(totalAmount) || totalAmount < 0 || !Number.isFinite(finalAmount)) {
      throw new Error("Check the original and converted goods amounts.");
    }
    return { ...line, qtyNo, qtyKgs, emptyKgs, divideWeight, coursePrice, grossWeight, netWeight,
      totalAmount, finalAmount, op: operator, exchangeRate };
  });
  const sum = (getValue: (line: (typeof lines)[number]) => number) =>
    roundBookingAmount(lines.reduce((total, line) => total + getValue(line), 0));
  return {
    lines,
    totals: {
      totalGross: sum((line) => line.grossWeight),
      totalNet: sum((line) => line.netWeight),
      grandFinal: sum((line) => line.finalAmount),
      grandPrimaryFinal: sum((line) => line.totalAmount),
      totalQty: sum((line) => line.qtyNo),
      totalDeductions: sum((line) => line.qtyNo * line.emptyKgs),
    },
    multiplier,
  };
}

export function bookingAdjustmentLines(before: number, after: number, purchaseLedger: string, payableLedger: string) {
  const delta = roundBookingAmount(after - before);
  if (!delta) return null;
  return {
    delta,
    amount: Math.abs(delta),
    debitLedger: delta > 0 ? purchaseLedger : payableLedger,
    creditLedger: delta > 0 ? payableLedger : purchaseLedger,
  };
}
