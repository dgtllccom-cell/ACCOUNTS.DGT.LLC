import { describe, expect, it } from "vitest";
import { duplicateTransferReason, transferOutstanding } from "@/lib/services/purchase-lane-service";

describe("transfer payment gate: outstanding balance", () => {
  it("is zero only when the full bill is settled", () => {
    expect(transferOutstanding(100, 100)).toBe(0);
    expect(transferOutstanding(100, 150)).toBe(0); // over-settled never goes negative
    expect(transferOutstanding(1158750, 734000)).toBe(424750); // matches the DEV partly-paid bill
    expect(transferOutstanding(310000, 0)).toBe(310000); // matches the DEV unpaid local purchase
  });

  it("rounds to cents so a float residue cannot block a settled bill", () => {
    expect(transferOutstanding(0.3, 0.1 + 0.2)).toBe(0);
  });
});

describe("transfer duplicate guard", () => {
  const req = { type: "self_managed" } as never;
  const target = { countryBranch: null, cityBranch: null, agentId: null, userId: null };
  const fresh = { id: "11111111-1111-4111-8111-111111111111", lane_status: "loaded", transfer_destination: null };

  it("allows the first transfer of a load", () => {
    expect(duplicateTransferReason(fresh, req, target)).toBeNull();
  });

  it("refuses a load that is already waiting for acceptance", () => {
    expect(duplicateTransferReason({ ...fresh, lane_status: "transfer_pending" }, req, target)).toMatch(/waiting to be accepted/);
  });

  it("refuses a second transfer to the same destination", () => {
    const already = { ...fresh, lane_status: "assigned", transfer_destination: "self_managed", owner_country_branch_id: null, owner_city_branch_id: null, owner_agent_id: null, owner_user_id: null };
    expect(duplicateTransferReason(already, req, target)).toMatch(/already at this destination/);
  });
});
