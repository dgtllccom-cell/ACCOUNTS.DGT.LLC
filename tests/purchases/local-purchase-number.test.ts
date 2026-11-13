import { describe, expect, it } from "vitest";
import { localPurchaseBillNo, localPurchaseContractRef } from "@/lib/purchases/local-purchase-number";

describe("local purchase bill number", () => {
  it("is the system journal serial, never the typed contract reference", () => {
    const a = { id: "4b8128dc-301b-471b-8250-ac67777aef4f", journal_serial_no: "LP-JRN-00000044", contract_no: "0" };
    const b = { id: "34d01f84-f7d0-4f14-8f25-1c499ac558ad", journal_serial_no: "LP-JRN-00000052", contract_no: "0" };
    expect([localPurchaseBillNo(a), localPurchaseBillNo(b)]).toEqual(["LP-JRN-00000044", "LP-JRN-00000052"]);
    expect(localPurchaseContractRef(a)).toBe("0");
  });

  it("falls back to the booking serial, then the record id; reads camelCase rows too", () => {
    expect(localPurchaseBillNo({ id: "x", manual_bill_no: "LP-000123", contract_no: "7" })).toBe("LP-000123");
    expect(localPurchaseBillNo({ id: "ed4f5bd9-8e49-4e98", contract_no: "7" })).toBe("LP-ed4f5bd9");
    expect(localPurchaseBillNo({ journalSerialNo: "LP-JRN-1", contractNo: "2" })).toBe("LP-JRN-1");
    expect(localPurchaseContractRef({ contractNo: 2 })).toBe("2");
  });
});
