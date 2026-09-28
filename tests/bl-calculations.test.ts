import { describe, it, expect } from "vitest";
import { calculateBlGoodsItem } from "@/features/shipping/components/bl-entry-view";

describe("BL System Goods Entry Mathematical Formulas & Precisions", () => {
  it("matches the exact reference screenshot values", () => {
    // Reference screenshot row:
    // Quantity No = 100
    // Quantity KGS = 50.00
    // Empty KGS = 0.10
    // Price Type = P/KGs
    // Divide Type = D/KGs
    // Currency 1 = USD, Rate 1 = 12.50
    // OP = *
    // Currency 2 = PKR, Rate 2 = 280.00
    const calc = calculateBlGoodsItem({
      qtyNo: 100,
      qtyKgs: 50.00,
      emptyPerBag: 0.10,
      priceType: "P/KGs",
      divideType: "D/KGs",
      currency1: "USD",
      rate1: 12.50,
      op: "*",
      currency2: "PKR",
      rate2: 280.00
    });

    expect(calc.totalGrossWeight).toBe(5000.00);
    expect(calc.totalEmptyWeight).toBe(10.00);
    expect(calc.netWeight).toBe(4990.00);
    expect(calc.tons).toBe(4.990);
    expect(calc.primaryAmount).toBe(62375.00);
    expect(calc.finalAmount).toBe(17465000.00);
  });

  it("calculates Price Type P/TON accurately", () => {
    const calc = calculateBlGoodsItem({
      qtyNo: 200,
      qtyKgs: 50.00, // 10,000 kg gross
      emptyPerBag: 0.10, // 20 kg empty
      priceType: "P/TON",
      divideType: "D/TON",
      currency1: "USD",
      rate1: 2500.00, // $2500 per ton
      op: "*",
      currency2: "AED",
      rate2: 3.6725
    });

    // Net Weight = 10,000 - 20 = 9,980 kg = 9.98 tons
    expect(calc.totalGrossWeight).toBe(10000.00);
    expect(calc.totalEmptyWeight).toBe(20.00);
    expect(calc.netWeight).toBe(9980.00);
    expect(calc.tons).toBe(9.980);
    // Primary Amount = 9.98 * 2500 = $24,950.00
    expect(calc.primaryAmount).toBe(24950.00);
    // Final Amount = 24,950 * 3.6725 = 91,628.88 AED
    expect(calc.finalAmount).toBe(91628.88);
  });

  it("handles division operator (/) for currency conversion", () => {
    const calc = calculateBlGoodsItem({
      qtyNo: 50,
      qtyKgs: 20.00, // 1000 kg
      emptyPerBag: 0.00,
      priceType: "P/KGs",
      divideType: "D/KGs",
      currency1: "PKR",
      rate1: 560.00, // 560 PKR / kg = 560,000 PKR
      op: "/",
      currency2: "USD",
      rate2: 280.00 // Divide by 280 PKR/USD
    });

    expect(calc.totalGrossWeight).toBe(1000.00);
    expect(calc.netWeight).toBe(1000.00);
    expect(calc.primaryAmount).toBe(560000.00);
    expect(calc.finalAmount).toBe(2000.00);
  });

  it("prevents negative net weight and handles zero quantity gracefully", () => {
    const calc = calculateBlGoodsItem({
      qtyNo: 10,
      qtyKgs: 1.00, // 10 kg
      emptyPerBag: 2.00, // 20 kg empty tare > 10 kg gross
      priceType: "P/KGs",
      divideType: "D/KGs",
      currency1: "USD",
      rate1: 10.00,
      op: "*",
      currency2: "USD",
      rate2: 1.00
    });

    // Net weight must clamp at 0 and not become negative
    expect(calc.netWeight).toBe(0);
    expect(calc.finalAmount).toBe(0);
  });
});
