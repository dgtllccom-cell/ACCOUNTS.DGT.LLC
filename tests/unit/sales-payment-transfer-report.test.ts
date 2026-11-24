import { describe, expect, it } from "vitest";
import { salesPaymentTransferReport } from "@/lib/sales/payment-transfer-report";

describe("Sales Payment Transfer report", () => {
  it("uses the approved settlement and excludes the transfer voucher from receipts", () => {
    const result = salesPaymentTransferReport({
      currency_code: "USD", order_total: 999, paid_amount: 999,
      form_data: { form: { paymentCondition: "Credit" }, transferTrace: { paymentId: "transfer", settlement: {
        originalAmount: 100, originalCurrency: "USD", finalCurrency: "AED", finalAmount: 367.25, exchangeRate: 3.6725, operator: "*",
      } } },
    }, [
      { id: "transfer", status: "posted", payment_kind: "credit", currency_code: "AED", amount: 367.25 },
      { id: "cash-1", status: "posted", payment_kind: "advance", currency_code: "USD", amount: 20, base_currency_amount: 73.45 },
      { id: "cash-2", status: "posted", payment_kind: "remaining", currency_code: "AED", amount: 100 },
      { id: "void", status: "cancelled", payment_kind: "advance", currency_code: "AED", amount: 100 },
    ]);
    expect(result).toMatchObject({ originalAmount: 100, originalCurrency: "USD", finalAmount: 367.25, finalCurrency: "AED",
      advance: 73.45, received: 173.45, remaining: 193.8, condition: "Partial Advance + Credit" });
  });

  it("uses division for legacy paid balances without inventing a received advance", () => {
    const result = salesPaymentTransferReport({ currency_code: "USD", order_total: 10, total_goods_original: 40, paid_amount: 8,
      form_data: { form: { salesCurrency: "AED", operator: "/", exchangeRate: 4 } } });
    expect(result).toMatchObject({ originalAmount: 40, finalAmount: 10, received: 2, advance: null, remaining: 8 });
  });
});
