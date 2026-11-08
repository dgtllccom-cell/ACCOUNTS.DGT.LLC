import { describe, expect, it } from "vitest";
import {
  availableToTransfer,
  bookingPaymentProofComplete,
  bookingTransferredQty,
  consignmentKey,
  consignmentStatus,
  findReplay,
  localEntryId,
  parseConsignmentKey,
  proportionalWeights,
  readTransfers,
  transferProblems,
  type ConsignmentTransferRecord,
} from "@/lib/consignment/loading-consignment-rules";

const PO = "11111111-1111-4111-8111-111111111111";
const LR = "22222222-2222-4222-8222-222222222222";
const LP = "33333333-3333-4333-8333-333333333333";

const t = (qty: number, destination: "warehouse" | "re_export" = "warehouse", key = `k-${qty}`): ConsignmentTransferRecord => ({
  id: key, idempotencyKey: key, destination, qty, grossWeight: 0, netWeight: 0, warehouseId: null, warehouseName: null,
  destinationNote: null, stockReference: null, at: "2026-11-08T10:00:00Z", userId: "u", userName: "User",
});

describe("loading → consignment keys (each loading individually traceable, never duplicated)", () => {
  it("builds one key per loading and parses it back", () => {
    const pb = consignmentKey("purchase_booking", PO, LR);
    const lp1 = consignmentKey("local_purchase", LP, "entry-1");
    const lp2 = consignmentKey("local_purchase", LP, "entry-2");
    expect(pb).toBe(`pb:${LR}`);
    expect(new Set([pb, lp1, lp2]).size).toBe(3);
    expect(parseConsignmentKey(pb)).toEqual({ source: "purchase_booking", purchaseId: null, loadingId: LR });
    expect(parseConsignmentKey(lp2)).toEqual({ source: "local_purchase", purchaseId: LP, loadingId: "entry-2" });
    expect(parseConsignmentKey("pb:not-a-uuid")).toBeNull();
    expect(parseConsignmentKey("lp:x:y")).toBeNull();
  });

  it("gives older local entries without an id a stable positional id", () => {
    expect(localEntryId({ id: "abc-123" }, 0)).toBe("abc-123");
    expect(localEntryId({ entryNo: 3 }, 0)).toBe("entry-3");
    expect(localEntryId({}, 1)).toBe("entry-2");
  });
});

describe("available balance — only the untransferred quantity can move", () => {
  it("local: 400 loaded, 150 transferred → 250 available", () => {
    expect(availableToTransfer(400, 150)).toBe(250);
    expect(availableToTransfer(400, 400)).toBe(0);
    expect(availableToTransfer(400, 500)).toBe(0);
  });

  it("booking: counts own transfers, receipts made elsewhere, and a final lane disposition", () => {
    // 100 to warehouse via consignment (also raised received_quantity to 100) + 50 re-export
    expect(bookingTransferredQty({ loadedQty: 400, receivedQty: 100, transfers: [t(100), t(50, "re_export")], laneFinalElsewhere: false })).toBe(150);
    // 80 received on the older Destination Receiving screen, nothing from consignment
    expect(bookingTransferredQty({ loadedQty: 400, receivedQty: 80, transfers: [], laneFinalElsewhere: false })).toBe(80);
    // the lane already finally disposed the load → nothing left
    expect(bookingTransferredQty({ loadedQty: 400, receivedQty: 0, transfers: [], laneFinalElsewhere: true })).toBe(400);
    // never above the loaded quantity
    expect(bookingTransferredQty({ loadedQty: 400, receivedQty: 900, transfers: [], laneFinalElsewhere: false })).toBe(400);
  });

  it("refuses a repeated or excessive transfer", () => {
    expect(transferProblems({ destination: "warehouse", qty: 300, available: 250, warehouseId: "w" })).toContain("exceeds");
    expect(transferProblems({ destination: "warehouse", qty: 10, available: 0, warehouseId: "w" })).toContain("nothing_left");
    expect(transferProblems({ destination: "warehouse", qty: 10, available: 250 })).toContain("warehouse");
    expect(transferProblems({ destination: "moon", qty: 10, available: 250 })).toContain("destination");
    expect(transferProblems({ destination: "re_export", qty: 0, available: 250 })).toContain("qty");
    expect(transferProblems({ destination: "re_export", qty: 250, available: 250 })).toEqual([]);
    expect(transferProblems({ destination: "re_export", qty: 10, available: 250, locked: true })).toContain("locked");
  });

  it("replays the same transfer for a repeated idempotency key", () => {
    const list = [t(100, "warehouse", "key-aaaa-1111")];
    expect(findReplay(list, "key-aaaa-1111")?.qty).toBe(100);
    expect(findReplay(list, "key-bbbb-2222")).toBeNull();
  });
});

describe("status and payment rule", () => {
  it("keeps the established booking payment-proof rule", () => {
    expect(bookingPaymentProofComplete("completed", 500)).toBe(true);
    expect(bookingPaymentProofComplete("partial", 0)).toBe(true);
    expect(bookingPaymentProofComplete("partial", 500)).toBe(false);
  });

  it("derives the row status", () => {
    expect(consignmentStatus({ loadedQty: 400, transferredQty: 0, locked: true })).toBe("awaiting_payment");
    expect(consignmentStatus({ loadedQty: 400, transferredQty: 0, locked: false })).toBe("ready");
    expect(consignmentStatus({ loadedQty: 400, transferredQty: 100, locked: false })).toBe("partial");
    expect(consignmentStatus({ loadedQty: 400, transferredQty: 400, locked: true })).toBe("transferred");
  });
});

describe("weights travel with the quantity", () => {
  it("splits weights proportionally", () => {
    expect(proportionalWeights(400, 8400, 8000, 100)).toEqual({ grossWeight: 2100, netWeight: 2000 });
    expect(proportionalWeights(0, 8400, 8000, 100)).toEqual({ grossWeight: 0, netWeight: 0 });
  });

  it("reads stored transfers defensively", () => {
    expect(readTransfers(null)).toEqual([]);
    expect(readTransfers([{ qty: 0 }, { qty: "25", destination: "re_export" }])).toHaveLength(1);
  });
});

