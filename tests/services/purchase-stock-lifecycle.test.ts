import { describe, expect, it } from "vitest";
import { derivePurchaseStockLifecycle, normalizePurchaseStockDestination, purchaseStockDestinationLabel } from "@/lib/services/purchase-stock-lifecycle";

describe("purchase stock lifecycle", () => {
  const baseOrder = {
    order_total: 1000,
    advance_paid: 250,
    remaining_due: 750,
    payment_status: "pending",
    form_data: {
      totals: { totalQuantity: 100 },
      workflow: { totalQuantity: 100 },
      goodsEntries: [{ qtyNo: 100 }]
    }
  } as const;

  it("treats loading rows with payment still pending as Remaining Stock", () => {
    const lifecycle = derivePurchaseStockLifecycle(baseOrder, [
      {
        id: "row-1",
        loaded_quantity: 40,
        report_payload: {
          lifecycleStage: "remaining",
          stockStage: "Remaining Stock",
          nextDestination: "Land Stock"
        }
      }
    ]);

    expect(lifecycle.lifecycleStage).toBe("remaining");
    expect(lifecycle.remainingQuantity).toBe(60);
    expect(lifecycle.paymentProofComplete).toBe(false);
    expect(lifecycle.visualStatus).toBe("red");
  });

  it("supports land stock forwarding to in-transit and destination labels", () => {
    expect(normalizePurchaseStockDestination("in transit")).toBe("in-transit");
    expect(purchaseStockDestinationLabel("in-transit")).toBe("In Transit");

    const lifecycle = derivePurchaseStockLifecycle(
      {
        ...baseOrder,
        payment_status: "completed",
        remaining_due: 0
      },
      [
        {
          id: "row-2",
          loaded_quantity: 40,
          report_payload: {
            lifecycleStage: "land",
            stockStage: "Land Stock",
            nextDestination: "In Transit"
          }
        }
      ]
    );

    expect(lifecycle.lifecycleStage).toBe("in-transit");
    expect(lifecycle.paymentProofComplete).toBe(true);
    expect(lifecycle.nextDestinationLabel).toBe("In Transit");
  });
});
