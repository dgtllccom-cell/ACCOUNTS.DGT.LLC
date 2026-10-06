import { describe, it, expect } from "vitest";
import {
  assertRouteContinuity,
  normalizeLegs,
  RouteContinuityError,
  type OrderLegInput,
} from "@/lib/services/clearing-customer-order-service";

describe("Server-side route/border validation (assertRouteContinuity)", () => {
  it("accepts a single leg with no continuity check needed", () => {
    const legs: OrderLegInput[] = [
      { legNo: 1, fromCountryId: "uae", toCountryId: "pk", transportMode: "by_sea" },
    ];
    expect(() => assertRouteContinuity(legs)).not.toThrow();
  });

  it("accepts a continuous multi-leg corridor (each leg's destination = next leg's origin)", () => {
    const legs: OrderLegInput[] = [
      { legNo: 1, fromCountryId: "uae", toCountryId: "iran", transportMode: "by_sea" },
      { legNo: 2, fromCountryId: "iran", toCountryId: "pakistan", transportMode: "by_road" },
      { legNo: 3, fromCountryId: "pakistan", toCountryId: "afghanistan", transportMode: "by_road" },
    ];
    expect(() => assertRouteContinuity(legs)).not.toThrow();
  });

  it("rejects a discontinuous route where a leg's origin doesn't match the previous leg's destination", () => {
    const legs: OrderLegInput[] = [
      { legNo: 1, fromCountryId: "uae", toCountryId: "iran", transportMode: "by_sea" },
      // leg 2 originates in "china", not "iran" where leg 1 ended — a gap/jump.
      { legNo: 2, fromCountryId: "china", toCountryId: "pakistan", transportMode: "by_road" },
    ];
    expect(() => assertRouteContinuity(legs)).toThrow(RouteContinuityError);
  });

  it("rejects a backtracking route (leg goes back to the origin country)", () => {
    const legs: OrderLegInput[] = [
      { legNo: 1, fromCountryId: "uae", toCountryId: "iran", transportMode: "by_sea" },
      { legNo: 2, fromCountryId: "iran", toCountryId: "pakistan", transportMode: "by_road" },
      // leg 3 should start in "pakistan" (where leg 2 ended), not jump back to "uae".
      { legNo: 3, fromCountryId: "uae", toCountryId: "afghanistan", transportMode: "by_air" },
    ];
    expect(() => assertRouteContinuity(legs)).toThrow(RouteContinuityError);
  });

  it("rejects duplicate leg numbers", () => {
    const legs: OrderLegInput[] = [
      { legNo: 1, fromCountryId: "uae", toCountryId: "iran", transportMode: "by_sea" },
      { legNo: 1, fromCountryId: "iran", toCountryId: "pakistan", transportMode: "by_road" },
    ];
    expect(() => assertRouteContinuity(legs)).toThrow(RouteContinuityError);
  });

  it("skips the check for legs missing country ids (legacy/partial data) rather than false-failing", () => {
    const legs: OrderLegInput[] = [
      { legNo: 1, fromLocationText: "Port Khalid", toLocationText: "Bandar Abbas", transportMode: "by_sea" },
      { legNo: 2, fromLocationText: "Bandar Abbas", toLocationText: "Taftan Border", transportMode: "by_road" },
    ];
    expect(() => assertRouteContinuity(legs)).not.toThrow();
  });
});

describe("normalizeLegs carries handler/partner attribution through (regression: was silently dropped)", () => {
  it("preserves handlerType='external_partner' and partner fields sent by the route builder UI", () => {
    const input: OrderLegInput[] = [
      {
        legNo: 1,
        fromCountryId: "uae",
        toCountryId: "iran",
        transportMode: "by_sea",
        handlerType: "external_partner",
        partnerType: "shipping_provider",
        partnerName: "Gulf Star Shipping",
        partnerAccountId: "ledger-uuid-123",
        partnerAccountNumber: "AC-4521",
        partnerCountryName: "United Arab Emirates",
      },
    ];

    const [normalized] = normalizeLegs(input);

    // Before the fix, normalizeLegs's explicit field-mapping dropped these
    // properties entirely, so the persist layer's `leg.handlerType ?? "our_branch"`
    // always fell through to "our_branch" no matter what the UI sent.
    expect(normalized.handlerType).toBe("external_partner");
    expect(normalized.partnerType).toBe("shipping_provider");
    expect(normalized.partnerName).toBe("Gulf Star Shipping");
    expect(normalized.partnerAccountId).toBe("ledger-uuid-123");
    expect(normalized.partnerAccountNumber).toBe("AC-4521");
    expect(normalized.partnerCountryName).toBe("United Arab Emirates");
  });

  it("defaults to 'our_branch' when no handler is specified", () => {
    const input: OrderLegInput[] = [
      { legNo: 1, fromCountryId: "uae", toCountryId: "iran", transportMode: "by_sea" },
    ];
    const [normalized] = normalizeLegs(input);
    expect(normalized.handlerType).toBe("our_branch");
    expect(normalized.partnerType).toBeNull();
  });

  it("rejects an unrecognized partnerType rather than persisting an arbitrary string", () => {
    const input: OrderLegInput[] = [
      {
        legNo: 1,
        fromCountryId: "uae",
        toCountryId: "iran",
        transportMode: "by_sea",
        handlerType: "external_partner",
        partnerType: "not_a_real_partner_type",
      },
    ];
    const [normalized] = normalizeLegs(input);
    expect(normalized.partnerType).toBeNull();
  });
});
