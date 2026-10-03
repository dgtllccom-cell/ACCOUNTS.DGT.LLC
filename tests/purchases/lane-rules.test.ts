import { describe, expect, it } from "vitest";
import {
  LANE_STATUSES, allowedNextStatuses, bulkTransferActions, canChooseDisposition, canCreateNewLoading, canMoveStatus, dispositionOutcome,
  dispositionProblems, isFinalDisposition, isGenuineLoadingRow, loadingRowAction, purchaseIsFinallyCompleted, remainingToLoad,
  transferNeedsAcceptance, transferProblems,
} from "@/lib/purchases/lane-rules";

describe("Remaining to Load is physical quantity only", () => {
  it("is total − loaded, never negative, and ignores any payment balance", () => {
    expect(remainingToLoad(100, 40)).toBe(60);
    expect(remainingToLoad(100, 100)).toBe(0);
    expect(remainingToLoad(100, 120)).toBe(0);
  });
  it("New Loading is disabled at zero remaining unless correcting an existing entry", () => {
    expect(canCreateNewLoading({ remainingQuantity: 0 })).toBe(false);
    expect(canCreateNewLoading({ remainingQuantity: 0, editingExisting: true })).toBe(true);
    expect(canCreateNewLoading({ remainingQuantity: 5 })).toBe(true);
  });
});

describe("the action shown on every saved loading row", () => {
  it("older loads with no lane row get 'Send to Purchase Lane'", () => {
    expect(loadingRowAction({ hasLaneRow: false }).label).toBe("Send to Purchase Lane");
  });
  it("a fresh load in the lane gets 'Transfer Load'", () => {
    expect(loadingRowAction({ hasLaneRow: true, laneStatus: "loaded", legNo: 1 }).kind).toBe("transfer");
  });
  it("a load that is already moving / assigned / completed gets 'Track Load'", () => {
    for (const st of ["transfer_pending", "assigned", "in_transit", "customs_pending", "completed"]) {
      expect(loadingRowAction({ hasLaneRow: true, laneStatus: st }).label).toBe("Track Load");
    }
  });
  it("never offers the misleading 'Transfer Remaining' — bulk actions are explicit", () => {
    const labels = bulkTransferActions({ untransferredLoads: 3, selectedLoads: 0 }).map((a) => a.label);
    expect(labels).toEqual(["Transfer Selected Containers", "Transfer All Untransferred Loads"]);
    expect(labels.join(" ")).not.toMatch(/Remaining/);
    expect(bulkTransferActions({ untransferredLoads: 3, selectedLoads: 0 })[0].enabled).toBe(false);
    expect(bulkTransferActions({ untransferredLoads: 3, selectedLoads: 2 })[0].enabled).toBe(true);
    expect(bulkTransferActions({ untransferredLoads: 0, selectedLoads: 0 })[1].enabled).toBe(false);
  });
  it("the synthetic 'pending loading' placeholder is not a genuine loading row", () => {
    expect(isGenuineLoadingRow({ id: "synthetic-1", loading_status: "pending", container_number: "-" })).toBe(false);
    expect(isGenuineLoadingRow({ id: "abc", loading_status: "loaded", container_number: "MSKU1" })).toBe(true);
  });
});

describe("lane status flow", () => {
  it("has the ten required statuses in order", () => {
    expect(LANE_STATUSES).toEqual(["loaded", "in_transit", "arrived", "transfer_pending", "assigned", "customs_pending", "under_clearance", "customs_cleared", "final_disposition_pending", "completed"]);
  });
  it("customs run pending → under clearance → cleared; no skipping and no going back", () => {
    expect(canMoveStatus("customs_pending", "under_clearance")).toBe(true);
    expect(canMoveStatus("customs_pending", "customs_cleared")).toBe(false);
    expect(canMoveStatus("under_clearance", "customs_cleared")).toBe(true);
    expect(canMoveStatus("customs_cleared", "customs_pending")).toBe(false);
    expect(allowedNextStatuses("completed")).toEqual([]);
  });
  it("a load awaiting acceptance can only be accepted or re-transferred, not advanced", () => {
    expect(allowedNextStatuses("transfer_pending")).toEqual([]);
  });
});

describe("transfers", () => {
  const base = { responsibility: "customs_clearance", expectedLocation: "Jebel Ali" };
  it("every transfer needs a responsibility; non-self transfers need an expected location", () => {
    expect(transferProblems({ type: "self_managed", responsibility: "custody" })).toEqual([]);
    expect(transferProblems({ type: "internal_agent", agentId: "a" })).toEqual(expect.arrayContaining(["responsibility", "expectedLocation"]));
  });
  it("branch transfers need country + branch (other branch) or a branch (own)", () => {
    expect(transferProblems({ type: "other_branch", ...base })).toEqual(expect.arrayContaining(["country", "branch"]));
    expect(transferProblems({ type: "other_branch", ...base, countryId: "c", cityBranchId: "b" })).toEqual([]);
    expect(transferProblems({ type: "own_branch", ...base })).toEqual(["branch"]);
  });
  it("agent / user transfers need the agent or user", () => {
    expect(transferProblems({ type: "internal_agent", ...base })).toEqual(["agent"]);
    expect(transferProblems({ type: "external_agent", ...base })).toEqual(["agent"]);
    expect(transferProblems({ type: "external_agent", ...base, agentName: "Gulf Logistics" })).toEqual([]);
    expect(transferProblems({ type: "other_user", ...base })).toEqual(["user"]);
  });
  it("only hand-overs to somebody else wait as 'Transfer Pending'", () => {
    expect(transferNeedsAcceptance("self_managed")).toBe(false);
    expect(transferNeedsAcceptance("own_branch")).toBe(false);
    for (const t of ["other_branch", "internal_agent", "external_agent", "other_user"] as const) expect(transferNeedsAcceptance(t)).toBe(true);
  });
});

describe("final disposition", () => {
  it("is offered only after customs clearance (or when disposition is pending)", () => {
    expect(canChooseDisposition("customs_cleared")).toBe(true);
    expect(canChooseDisposition("final_disposition_pending")).toBe(true);
    expect(canChooseDisposition("in_transit")).toBe(false);
    expect(canChooseDisposition("customs_pending")).toBe(false);
  });
  it("warehouse needs a warehouse; continue transit needs the next destination", () => {
    expect(dispositionProblems({ kind: "warehouse" })).toEqual(["warehouse"]);
    expect(dispositionProblems({ kind: "warehouse", warehouseId: "w" })).toEqual([]);
    expect(dispositionProblems({ kind: "continue_transit" })).toEqual(["nextDestination"]);
    expect(dispositionProblems({ kind: "hold" })).toEqual([]);
    expect(dispositionProblems({ kind: "bogus" })).toEqual(["kind"]);
  });
  it("each outcome causes at most ONE stock effect and never a sale", () => {
    expect(dispositionOutcome("warehouse")).toMatchObject({ status: "completed", final: true, stockEffect: "warehouse_in" });
    expect(dispositionOutcome("re_export")).toMatchObject({ status: "completed", final: true, stockEffect: "lane_out" });
    expect(dispositionOutcome("sale_delivery")).toMatchObject({ final: true, stockEffect: "lane_out" });
    expect(dispositionOutcome("continue_transit")).toMatchObject({ status: "in_transit", final: false, stockEffect: "none", newLeg: true });
    expect(dispositionOutcome("hold")).toMatchObject({ final: false, stockEffect: "none", newLeg: false });
    expect(["re_export", "warehouse", "sale_delivery"].every(isFinalDisposition)).toBe(true);
    expect(isFinalDisposition("hold")).toBe(false);
  });
  it("'Final Purchase Completed' needs EVERY load finally disposed", () => {
    const done = { lane_status: "completed", disposition_final: true };
    expect(purchaseIsFinallyCompleted([done, done])).toBe(true);
    expect(purchaseIsFinallyCompleted([done, { lane_status: "completed", disposition_final: false }])).toBe(false);
    expect(purchaseIsFinallyCompleted([done, { lane_status: "in_transit", disposition_final: false }])).toBe(false);
    expect(purchaseIsFinallyCompleted([])).toBe(false);
  });
});
