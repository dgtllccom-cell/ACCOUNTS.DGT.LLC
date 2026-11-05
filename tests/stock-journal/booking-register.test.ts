import { describe, expect, it } from "vitest";
import { buildBookingRegister, sumQty } from "@/lib/stock-journal/booking-register";
import { allocateLoadings, extractPoGoodsLines, type LoadingFact } from "@/lib/stock-journal/model";
import type { StockJournalRow } from "@/lib/services/stock-journal-service";

/** A row shaped exactly like loadStockJournal emits it (only the fields the register reads matter). */
let n = 0;
function row(over: Partial<StockJournalRow>): StockJournalRow {
  n += 1;
  return {
    id: `R${n}`, sourceType: "purchase_booking", sourceId: "PO-1", lineKey: "walnuts", stage: "booking",
    billNumber: "PB-0001", systemBillNumber: "PB-0001", manualBillNumber: "MB-77", date: "2026-10-01T00:00:00.000Z",
    countryId: "C-PK", countryName: "Pakistan", countryCode: "PK", countryBranchId: "MB-PK", cityBranchId: "QTA", branchName: "Quetta",
    supplierName: "Kabul Traders", productName: "Walnuts", goodsId: null, brand: "Gold", size: "L", unit: "CTN", currencyCode: "USD",
    quantity: 0, bookedQuantity: 10000, loadedQuantity: 8000, receivedQuantity: 0, damagedQuantity: 0, shortageQuantity: 0, outstandingQuantity: 0,
    origin: "Afghanistan", grossWeight: 250000, netWeight: 240000, bookingNo: "#PB-0001", invoiceNo: "#INV-9", shipDetails: "",
    bookingStatus: "confirmed", invoiceStatus: "posted", paymentStatus: "partial", customsStatus: "not_recorded", truckOrContainer: "",
    loadingRecordId: null, loadingRecordNo: null, blNumber: "", warehouseId: null, warehouseName: null, transferId: null, transferNo: null,
    destinationType: null, customerName: null, salesOrderNo: null, documentRef: null, issueType: null, confirmedAt: null, issuedAt: null,
    quantityNotEntered: false, legacyReceived: false, overLoaded: false, canConfirm: false, canIssue: false, canReverse: false,
    payment: null, paymentHold: false, goodsTransferHref: null, loadingDetail: null,
    invoice: { invoiceNo: "INV-9", currency: "USD", exchangeRate: 3.67, purchaseAmount: 116250, finalAmount: 426637.5, finalCurrency: "AED" },
    ...over,
  };
}
const chunk = (id: string, created: string, loaded: number, received: number, extra: Partial<StockJournalRow> = {}) => ({
  loadingRecordId: id, loadingRecordNo: `LR-${id}`, truckOrContainer: `CONT-${id}`, blNumber: `BL-${id}`, loadedQuantity: loaded, receivedQuantity: received,
  loadingDetail: { createdAt: created, loadedAt: created, transportMode: "sea", loadingPlace: "Karachi Port", departureDate: created, receivingPlace: "Jebel Ali",
    arrivalDate: null, arrivalExpected: false, receivedAt: received > 0 ? created : null, grossWeight: null, netWeight: null, loadingStatus: received > 0 ? "received" : "loaded" },
  ...extra,
});

// 10,000 cartons booked; four 2,000-carton loads on different days; one more 2,000 not loaded yet
const rows: StockJournalRow[] = [
  row({ stage: "booking", quantity: 2000 }),
  // L1: received 2,000 and confirmed (1,500 still available, 500 already sold / issued)
  row({ stage: "available", quantity: 1500, ...chunk("L1", "2026-10-02T00:00:00.000Z", 2000, 2000), transferId: "T1" }),
  row({ stage: "sold", quantity: 500, ...chunk("L1", "2026-10-02T00:00:00.000Z", 2000, 2000), transferId: "T2" }),
  // L2: received 2,000, customs cleared, waiting for an authorized Confirm Stock
  row({ stage: "ready", quantity: 2000, ...chunk("L2", "2026-10-09T00:00:00.000Z", 2000, 2000), customsStatus: "cleared" }),
  // L3: 1,500 received (customs still open), 500 still on the road
  row({ stage: "transit", quantity: 500, ...chunk("L3", "2026-10-16T00:00:00.000Z", 2000, 1500) }),
  row({ stage: "receiving", quantity: 1500, ...chunk("L3", "2026-10-16T00:00:00.000Z", 2000, 1500), customsStatus: "pending" }),
  // L4: loaded, nothing received yet
  row({ stage: "transit", quantity: 2000, ...chunk("L4", "2026-10-23T00:00:00.000Z", 2000, 0) }),
  // a second bill in another branch, counted in BAGS and with no recorded weight, nothing loaded
  row({ sourceId: "PO-2", systemBillNumber: "PB-0002", billNumber: "PB-0002", lineKey: "rice", productName: "Rice", unit: "BAG", stage: "booking", quantity: 1000,
    bookedQuantity: 1000, loadedQuantity: 0, grossWeight: 0, netWeight: 0, cityBranchId: "CHM", branchName: "Chaman", date: "2026-10-05T00:00:00.000Z", bookingStatus: "draft" }),
  // a Local Purchase never appears in this register
  row({ sourceType: "local_purchase", sourceId: "LP-1", stage: "available", quantity: 99, unit: "CTN" }),
];

describe("Purchase Journal Booking Stock register (issue #38)", () => {
  const { bills, panels } = buildBookingRegister(rows);
  const pb1 = bills.find((b) => b.sourceId === "PO-1")!;
  const pb2 = bills.find((b) => b.sourceId === "PO-2")!;

  it("lists one parent row per Purchase Booking bill and never a Local Purchase", () => {
    expect(bills.map((b) => b.sourceId).sort()).toEqual(["PO-1", "PO-2"]);
    expect(panels.purchase.bills).toBe(2);
  });

  it("splits the 10,000 booked cartons across the stages exactly once", () => {
    // "CTN" is normalized to "CARTON" (one spelling per unit; different units still never merge)
    expect(pb1.booked).toEqual({ CARTON: 10000 });
    expect(pb1.loaded).toEqual({ CARTON: 8000 });
    expect(pb1.received).toEqual({ CARTON: 5500 });
    expect(pb1.inTransit).toEqual({ CARTON: 2500 });
    expect(pb1.awaiting).toEqual({ CARTON: 3500 });
    expect(pb1.confirmed).toEqual({ CARTON: 2000 });
    expect(pb1.sold).toEqual({ CARTON: 500 });
    expect(pb1.notLoaded).toEqual({ CARTON: 2000 });
    // booked = not loaded + in transit + awaiting confirmation + confirmed (+ damaged + shortage)
    expect(sumQty(pb1.notLoaded, pb1.inTransit, pb1.awaiting, pb1.confirmed, pb1.damaged, pb1.shortage)).toEqual(pb1.booked);
    // pending = not loaded + awaiting confirmation (two different internal states, both kept)
    expect(pb1.pending).toEqual({ CARTON: 5500 });
  });

  it("receiving a load MOVES it from transit to awaiting / confirmed (never counted twice)", () => {
    const l3 = pb1.entries.find((e) => e.loadingRecordId === "L3")!;
    expect(l3.loaded).toEqual({ CARTON: 2000 });
    expect(sumQty(l3.inTransit, l3.awaiting, l3.confirmed)).toEqual({ CARTON: 2000 });
    expect(l3.receiving).toBe("partially_received");
    expect(l3.confirmation).toBe("awaiting_customs");
  });

  it("numbers the loading / receipt entries in loading order and keeps their facts", () => {
    expect(pb1.entries.map((e) => e.entryNo)).toEqual(["PB-0001-01", "PB-0001-02", "PB-0001-03", "PB-0001-04"]);
    const [l1, l2, , l4] = pb1.entries;
    expect(l1.confirmation).toBe("confirmed");
    expect(l1.receiving).toBe("received");
    expect(l2.confirmation).toBe("ready");
    expect(l4.receiving).toBe("in_transit");
    expect(l4.confirmation).toBe("not_received");
    expect(l1.transportMode).toBe("sea");
    expect(l1.loadingPlace).toBe("Karachi Port");
    expect(l1.receivingPlace).toBe("Jebel Ali");
    expect(l1.blNumber).toBe("BL-L1");
  });

  it("derives kg only from the same goods line (25 / 24 kg per carton) and says when a line has no weight", () => {
    expect(pb1.gross).toBe(250000);
    expect(pb1.net).toBe(240000);
    expect(pb1.entries[0].gross).toBe(50000);
    expect(pb1.entries[0].weightRecorded).toBe(false);
    expect(panels.confirm.inTransit.gross).toBe(62500);
    expect(panels.confirm.confirmed.net).toBe(48000);
    expect(panels.confirm.notLoaded.weightMissing).toBe(true); // the rice line has no recorded weight
  });

  it("never adds bags to cartons", () => {
    expect(panels.purchase.booked).toEqual({ CARTON: 10000, BAG: 1000 });
    expect(panels.purchase.supplierPending).toEqual({ CARTON: 2000, BAG: 1000 });
    expect(panels.confirm.notLoaded.qty).toEqual({ CARTON: 2000, BAG: 1000 });
  });

  it("gives every bill a status from its own stages", () => {
    expect(pb1.status).toBe("partially_confirmed");
    expect(pb2.status).toBe("draft");
  });

  it("groups the country-wise panel by country and branch", () => {
    expect(panels.countries.map((c) => `${c.countryName}/${c.branchName}`)).toEqual(["Pakistan/Chaman", "Pakistan/Quetta"]);
    expect(panels.countries.find((c) => c.branchName === "Quetta")!.booked).toEqual({ CARTON: 10000 });
  });

  it("keeps the invoice read-only and carries no payment figure", () => {
    expect(pb1.invoice).toMatchObject({ currency: "USD", exchangeRate: 3.67, purchaseAmount: 116250, finalCurrency: "AED" });
    expect(Object.keys(pb1)).not.toContain("payment");
  });
});

describe("the canonical model splits staggered loads of a 10,000 booking without loss", () => {
  it("5 x 2,000 loads with partial receipts add back up to the booking", () => {
    const { lines } = extractPoGoodsLines({ form: { goodsName: "Walnuts", qtyNo: 10000, qtyName: "CTN", qtyKgs: 25 } });
    const load = (id: string, day: number, received: number | null, damaged = 0): LoadingFact => ({
      id, no: id, containerNo: id, vehicleNo: "", blNumber: "", createdAt: `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`, loadedAt: null,
      loaded: 2000, received, damaged, shortage: 0, loadingStatus: received == null ? "loaded" : "received", receivingWarehouseId: null, receivingGoodsId: null,
      customsStatus: "cleared", customsSource: "loading_record", payload: null,
    });
    const { chunks, overLoaded } = allocateLoadings(lines, [load("L1", 1, 2000), load("L2", 8, 1990, 10), load("L3", 15, 1500), load("L4", 22, null), load("L5", 29, null)]);
    expect(chunks).toHaveLength(5);
    expect(overLoaded).toEqual({});
    const sum = (k: "loaded" | "receivedGood" | "damaged" | "inTransit") => chunks.reduce((s, c) => s + c[k], 0);
    expect(sum("loaded")).toBe(10000);
    expect(sum("receivedGood")).toBe(5490);
    expect(sum("damaged")).toBe(10);
    expect(sum("inTransit")).toBe(4500);
    expect(sum("receivedGood") + sum("damaged") + sum("inTransit")).toBe(10000);
    expect(lines[0].grossWeight).toBe(250000);
  });
});
