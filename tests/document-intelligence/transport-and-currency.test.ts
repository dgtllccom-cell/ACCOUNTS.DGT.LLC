import { describe, expect, it } from "vitest";
import { parseTradeContract } from "@/lib/document-intelligence/contract-parser";
import { buildTargetPayload, emptyReview, handoffBlockers } from "@/lib/document-intelligence/review-state";
import { getIntakeModule } from "@/lib/document-intelligence/intake-modules";
import { inferShipmentMode } from "@/lib/document-intelligence/review-init";
import { extractFields } from "@/lib/document-intelligence/extractors";

const SUP = "11111111-1111-4111-8111-111111111111";
const scope = { countryId: "c", countryBranchId: "b", cityBranchId: null };

const CONTRACT = `SALES CONTRACT
Contract No.: 0907B
Date: 2026-09-05
The Seller: Dalian Sunshine Imp & Exp. Co., Ltd. (CHINA)
The Buyer: DGT LLC (UAE)
DESCRIPTION QUANTITY (MT) UNIT PRICE (USD/MT) AMOUNT (USD)
Plastic Raw Material 50 1,200 60,000
Total 50 1,200 60,000
HS Code: 3901.20
1. Payment Terms: T/T
2. Delivery Terms: CIF Dalian Port`;

describe("a Purchase Contract with no transport references", () => {
  it("states none of BL / container / truck / AWB / rail — and does not invent them", () => {
    const p = parseTradeContract(CONTRACT);
    expect(p.blNo).toBeNull();
    expect(p.awbNo).toBeNull();
    expect(p.railRef).toBeNull();
    expect(p.containerNos).toEqual([]);
    expect(p.truckNo).toBeNull();
  });
  it("the generic rules add no BL / vessel / account-master noise on a trade contract", () => {
    const f = Object.fromEntries(extractFields(CONTRACT, [{ pageNumber: 1, text: CONTRACT }] as any, "sales_contract").map((x) => [x.key, x.normalizedValue]));
    for (const k of ["bl_number", "container_numbers", "truck_number", "awb_number", "rail_reference", "vessel", "account_code", "registration_number"]) expect(f[k], k).toBeUndefined();
    expect(f.currency).toBe("USD");
    expect(f.grand_total).toBe("60000");
  });
  it("shipment mode stays unspecified when no reference exists", () => {
    expect(inferShipmentMode({}, {})).toBe("");
  });
  it("transport references are optional: they never block saving or opening the Purchase Booking", () => {
    const s = emptyReview("purchase_booking");
    s.form = { ...s.form, currency: "USD", totalAmount: "60000" };
    s.party = { id: "22222222-2222-4222-8222-222222222222", kind: "company", name: "X", documentName: "X" };
    s.accounts.supplierAccountId = SUP;
    s.exchange = { ...s.exchange, originalAmount: 60000, originalCurrency: "USD", finalCurrency: "USD" };
    expect(handoffBlockers(getIntakeModule("purchase_booking"), s)).toEqual([]);
  });
});

describe("transport fields are conditional on the shipment mode", () => {
  const base = () => {
    const s = emptyReview("purchase_booking");
    s.form = { ...s.form, blNo: "COSU123", containerNos: "MSKU1234567", truckNo: "TL-1", awbNo: "176-1234", railRef: "WG-9" };
    return s;
  };
  const mod = getIntakeModule("purchase_booking")!;
  it("By Sea carries the BL and containers only", () => {
    const s = base(); s.form.shipmentMode = "sea";
    const p = buildTargetPayload(mod, s, scope);
    expect(p.blNumber).toBe("COSU123"); expect(p.containerNumbers).toBe("MSKU1234567");
    expect(p.truckNumber).toBeUndefined(); expect(p.awbNumber).toBeUndefined(); expect(p.shippingMode).toBe("By Sea");
  });
  it("By Road carries the truck only", () => {
    const s = base(); s.form.shipmentMode = "road";
    const p = buildTargetPayload(mod, s, scope);
    expect(p.truckNumber).toBe("TL-1"); expect(p.blNumber).toBeUndefined(); expect(p.containerNumbers).toBeUndefined();
  });
  it("By Air carries the AWB, By Train the rail reference", () => {
    const a = base(); a.form.shipmentMode = "air";
    expect(buildTargetPayload(mod, a, scope).awbNumber).toBe("176-1234");
    const t = base(); t.form.shipmentMode = "train";
    expect(buildTargetPayload(mod, t, scope).railReference).toBe("WG-9");
  });
  it("mode not stated: no transport key is sent at all (a purchase bill no. is never turned into a BL)", () => {
    const s = base(); s.form.reference = "PB-77"; s.form.contractNo = "0907B";
    const p = buildTargetPayload(mod, s, scope);
    for (const k of ["blNumber", "containerNumbers", "truckNumber", "awbNumber", "railReference"]) expect(p[k], k).toBeUndefined();
    expect(p.billNo).toBe("PB-77");
  });
});

describe("purchase currency is mandatory and conflicts are flagged", () => {
  it("hand-off is blocked until a purchase currency and an original amount exist", () => {
    const s = emptyReview("purchase_booking");
    s.party = { id: "22222222-2222-4222-8222-222222222222", kind: "company", name: "X", documentName: "X" };
    s.accounts.supplierAccountId = SUP;
    const b = handoffBlockers(getIntakeModule("purchase_booking"), s);
    expect(b).toContain("currency"); expect(b).toContain("amount");
  });
  it("two different currencies in one document are reported so the reviewer must choose", () => {
    const p = parseTradeContract(CONTRACT + "\nBank charges are payable in CNY.");
    expect(p.currencies.sort()).toEqual(["CNY", "USD"]);
    expect(p.warnings.some((w) => /More than one currency/.test(w))).toBe(true);
    const f = extractFields(CONTRACT + "\nBank charges are payable in CNY.", [{ pageNumber: 1, text: CONTRACT }] as any, "sales_contract");
    const cur = f.find((x) => x.key === "currency")!;
    expect(cur.normalizedValue).toBe("USD");
    expect(cur.validationStatus).toBe("amber");
  });
});
