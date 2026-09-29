import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: vi.fn(), withReadPg: vi.fn() }));
vi.mock("@/lib/services/clearing-customer-order-scope", () => ({ canAccessOrder: vi.fn() }));
vi.mock("@/lib/services/clearing-customer-order-service", () => ({ getCustomerOrderById: vi.fn(), routeIssuesForLegs: vi.fn() }));

import { coverage } from "@/lib/services/clearing-order-route-insurance-service";

const legs = [1, 2, 3, 4, 5].map((n) => ({ leg_no: n, planned_departure: `2026-10-0${n}`, planned_arrival: `2026-10-0${n + 1}`, status: "pending" }));
const pol = (id: string, from: number, to: number, cf: string, ct: string, docs = 1, status = "active") =>
  ({ id, policy_no: id, insurer_name: "Test Insurer", from_leg_no: from, to_leg_no: to, coverage_from: cf, coverage_to: ct, status, document_count: docs });

describe("order insurance coverage", () => {
  it("fully covered when policies span every leg inside their dates", () => {
    const c = coverage(legs, [pol("P1", 1, 4, "2026-10-01", "2026-10-20"), pol("P2", 5, 5, "2026-10-01", "2026-10-20")], "2026-09-30");
    expect(c.fullyCovered).toBe(true);
    expect(c.perLeg.every((l) => l.gaps.length === 0)).toBe(true);
  });
  it("shows the uncovered leg and a date gap", () => {
    const c = coverage(legs, [pol("P1", 1, 3, "2026-10-01", "2026-10-03")], "2026-09-30");
    expect(c.fullyCovered).toBe(false);
    expect(c.perLeg.find((l) => l.legNo === 3)?.gaps).toContain("dates_outside");
    expect(c.perLeg.find((l) => l.legNo === 4)?.gaps).toEqual(["uncovered"]);
  });
  it("cancelled policies do not count; missing file is flagged but is not a cover gap", () => {
    const c = coverage(legs.slice(0, 1), [pol("P1", 1, 1, "2026-10-01", "2026-10-30", 0), pol("P0", 1, 1, "2026-10-01", "2026-10-30", 1, "cancelled")], "2026-09-30");
    expect(c.perLeg[0].gaps).toEqual(["document_missing"]);
    expect(c.fullyCovered).toBe(true);
  });
  it("an expired policy on an undelivered leg is a gap", () => {
    const c = coverage([{ leg_no: 1, status: "in_transit" }], [pol("P1", 1, 1, "2026-01-01", "2026-06-30")], "2026-09-30");
    expect(c.perLeg[0].gaps).toContain("policy_expired");
  });
});
