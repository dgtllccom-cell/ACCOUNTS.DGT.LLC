import React, { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
// @ts-expect-error JSX view module
import { SalesBookingTransferReport, goodsLotNo, goodsStockSource, goodsWarehouse, isHalfPostedSalesTransfer } from "@/features/sales/components/sales-booking-transfer-report.jsx";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

// shaped like a real Local Sales stock-sale booking (lot picked from a purchase location)
const goods = [{
  goodsName: "WALNUT KENRELS", brand: "DGT.LLC", origin: "China", hsCode: "0802-3200", packType: "Cartons", size: "HSLVES90%",
  lotNo: "LOT-2611-000024@Purchase location", warehouse: "Purchase location", saleSource: "lot", lotAvailableQty: 2500,
  qtyNo: 2250, qtyName: "Boxes", grossWeight: 22500, netWeight: 22500, unitPrice: 10.1, exchangeRate: 1, totalAmount: 22725, finalAmount: 22725,
}];
const form = { customerAccountName: "NAJEEB ULLAH ABDULLAH", customerAccountNo: "AE-AEDU-S-001", salesAccountName: "Purchase and sales Dubai office",
  salesAccountNo: "AE-AEDU-PS-001", salesCurrency: "AED", secondaryCurrency: "AED", exchangeRate: 1, operator: "*", shipmentType: "By Sea", containerSize: "40 FT" };
const order = { id: "o1", order_total: 22725, ledger_posting_status: "unposted", form_data: { form, goodsEntries: goods, workflow: {} },
  loadingRecords: [{ containerNumber: "MSKU1234567", containerType: "40 FT", loadingDate: "2026-11-25", receivedDate: null, quantity: 2250, netWeight: 22500 }] };

function view(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<SalesBookingTransferReport open onClose={() => {}} form={form} goods={goods} order={order} localSale lang="en" {...props} />));
  return document.body.textContent || "";
}

describe("goods line stock helpers", () => {
  it("splits the lot number from its location and finds the warehouse", () => {
    expect(goodsLotNo(goods[0])).toBe("LOT-2611-000024");
    expect(goodsWarehouse({ lotNo: "LOT-1@Dubai Store" })).toBe("Dubai Store");
    expect(goodsWarehouse({ warehouseId: "w1" }, {}, { w1: "Jebel Ali · WH-01" })).toBe("Jebel Ali · WH-01");
    expect(goodsStockSource({ saleSource: "lot" })).toBe("Managed Lot");
    expect(goodsStockSource({ saleSource: "local" })).toBe("Local Stock");
  });
  it("recognises a transfer that posted but never finished its status", () => {
    expect(isHalfPostedSalesTransfer({ ledger_posting_status: "unposted", form_data: { workflow: { transferPostedPaymentId: "p1" } } })).toBe(true);
    expect(isHalfPostedSalesTransfer({ ledger_posting_status: "posted", form_data: { workflow: { transferPostedPaymentId: "p1" } } })).toBe(false);
    expect(isHalfPostedSalesTransfer({ ledger_posting_status: "unposted", form_data: { workflow: {} } })).toBe(false);
  });
});

describe("Local Sales transfer verification report", () => {
  it("shows warehouse, full goods details, loading records and what Transfer will do", () => {
    const text = view({ onPost: () => {} });
    expect(text).toContain("Warehouse / Stock Source");
    expect(text).toContain("Purchase location");
    expect(text).toContain("LOT-2611-000024");
    expect(text).not.toContain("LOT-2611-000024@");
    expect(text).toContain("Managed Lot");
    expect(text).toContain("DGT.LLC");
    expect(text).toContain("China");
    expect(text).toContain("0802-3200");
    expect(text).toContain("MSKU1234567");
    expect(text).toContain("40 FT");
    expect(text).toContain("On Transfer / Post:");
    expect(text).toContain("2,250 Boxes WALNUT KENRELS will leave Purchase location (Lot LOT-2611-000024).");
    expect(text).toContain("NAJEEB ULLAH ABDULLAH will be debited AED 22,725");
    expect(text).toContain("Transfer / Post");
  });

  it("confirms the posting and the stock that left the warehouse after Transfer", () => {
    const text = view({ onPost: () => {}, confirmation: { ledgerPostingStatus: "posted", transferVerification: { voucherNo: "SOPAY-1" }, stockDeductionAudit: { deducted: true } } });
    expect(text).toContain("Transferred successfully. Roznamcha voucher SOPAY-1.");
    expect(text).toContain("Stock left Purchase location (Lot LOT-2611-000024): 2,250 Boxes WALNUT KENRELS.");
    expect(text).toContain("Stock deducted ✓");
    expect(text).not.toContain("On Transfer / Post:");
  });

  it("never offers Transfer again for a half-posted booking and says why", () => {
    const half = { ...order, form_data: { ...order.form_data, workflow: { transferPostedPaymentId: "p1" } } };
    const text = view({ onPost: () => {}, order: half });
    expect(text).toContain("Posted — status incomplete");
    expect(text).toContain("Do not post it again");
    expect(document.querySelector("footer")?.textContent).not.toContain("Transfer / Post");
  });

  it("follows the selected language (Urdu)", () => {
    const text = view({ onPost: () => {}, lang: "ur" });
    expect(text).toContain("گودام / اسٹاک کا ذریعہ");
    expect(text).toContain("ٹرانسفر / پوسٹ کرنے پر:");
    expect(text).toContain("Purchase location");
  });

  it("says when no container has been loaded yet", () => {
    expect(view({ order: { ...order, loadingRecords: [] } })).toContain("No loading recorded yet.");
  });
});
