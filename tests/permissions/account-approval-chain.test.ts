import { describe, expect, it } from "vitest";
import { accountNeedsApprovalChain, advanceChain, canDecideChainStage, chainOf, initialChainState } from "@/lib/approval/account-approval-chain";

const PK = "c-pk", UAE = "c-uae";
const sess = (roles: string[], countryIds: string[], userId = "u-actor", isSuperAdmin = false) => ({ roles, countryIds, userId, isSuperAdmin }) as any;
const req = (country_id: string | null, requested_by = "u-chaman") => ({ country_id, requested_by });

describe("Shipping Line account approval chain (Country Admin -> Operations Country Admin)", () => {
  it("only a Shipping/shared account opened by a BRANCH-level login needs the chain", () => {
    expect(accountNeedsApprovalChain(["city_branch_admin"], false, "shipping")).toBe(true);
    expect(accountNeedsApprovalChain(["shipping_line_admin"], false, "shipping")).toBe(true);
    expect(accountNeedsApprovalChain(["agent_user"], false, "both")).toBe(true);
    // Business accounts keep their existing flow
    expect(accountNeedsApprovalChain(["city_branch_admin"], false, "business")).toBe(false);
    expect(accountNeedsApprovalChain(["city_branch_admin"], false, undefined)).toBe(false);
    // the approvers themselves (and above) are not put through their own chain
    expect(accountNeedsApprovalChain(["country_admin"], false, "shipping")).toBe(false);
    expect(accountNeedsApprovalChain(["country_operations_admin"], false, "shipping")).toBe(false);
    expect(accountNeedsApprovalChain(["shipping_super_admin"], false, "shipping")).toBe(false);
    expect(accountNeedsApprovalChain(["city_branch_admin"], true, "shipping")).toBe(false);
  });

  it("the chain starts at stage 1 with two stages and no approvals", () => {
    const s = initialChainState();
    expect(s.approvalStage).toBe(1);
    expect(s.approvalChain.map((x) => x.role)).toEqual(["country_admin", "country_operations_admin"]);
    expect(s.stageApprovals).toEqual([]);
    expect(chainOf(s)?.approvalChain).toHaveLength(2);
    expect(chainOf({ foo: 1 })).toBeNull();
    expect(chainOf(JSON.stringify(s))?.approvalStage).toBe(1);
  });

  it("stage 1 is decided by the Country Admin of THAT country only", () => {
    expect(canDecideChainStage(sess(["country_admin"], [PK]), "country_admin", req(PK))).toBe(true);
    expect(canDecideChainStage(sess(["country_admin"], [UAE]), "country_admin", req(PK))).toBe(false);          // other country
    expect(canDecideChainStage(sess(["country_operations_admin"], [PK]), "country_admin", req(PK))).toBe(false); // wrong role for stage 1
    expect(canDecideChainStage(sess(["city_branch_admin"], [PK]), "country_admin", req(PK))).toBe(false);
    expect(canDecideChainStage(sess(["country_admin"], [PK], "u-chaman"), "country_admin", req(PK, "u-chaman"))).toBe(false); // never your own request
  });

  it("stage 2 is decided by the Operations Country Admin (or Global Operations Admin), not the Country Admin", () => {
    expect(canDecideChainStage(sess(["country_operations_admin"], [PK]), "country_operations_admin", req(PK))).toBe(true);
    expect(canDecideChainStage(sess(["country_operations_admin"], [UAE]), "country_operations_admin", req(PK))).toBe(false);
    expect(canDecideChainStage(sess(["global_operations_admin"], []), "country_operations_admin", req(PK))).toBe(true);
    expect(canDecideChainStage(sess(["country_admin"], [PK]), "country_operations_admin", req(PK))).toBe(false);
  });

  it("the approver must work in the request's domain: a Business Country Admin never approves a Shipping account", () => {
    const biz = { ...sess(["country_admin"], [PK]), operationalDomains: ["business"] };
    const ship = { ...sess(["country_admin"], [PK]), operationalDomains: ["shipping"] };
    const both = { ...sess(["country_admin"], [PK]), operationalDomains: ["both"] };
    expect(canDecideChainStage(biz, "country_admin", { ...req(PK), operational_domain: "shipping" })).toBe(false);
    expect(canDecideChainStage(ship, "country_admin", { ...req(PK), operational_domain: "shipping" })).toBe(true);
    expect(canDecideChainStage(both, "country_admin", { ...req(PK), operational_domain: "shipping" })).toBe(true);
  });

  it("the Global Super Admin may decide any stage", () => {
    expect(canDecideChainStage(sess(["super_admin"], [], "u-sa", true), "country_admin", req(PK))).toBe(true);
    expect(canDecideChainStage(sess(["super_admin"], [], "u-sa", true), "country_operations_admin", req(PK))).toBe(true);
  });

  it("advancing records who approved what and when, and only the last stage completes the chain", () => {
    const s1 = advanceChain(initialChainState(), "u-country", "ok", new Date("2026-10-18T10:00:00Z"));
    expect(s1.done).toBe(false);
    expect(s1.next.approvalStage).toBe(2);
    expect(s1.next.stageApprovals).toEqual([{ stage: 1, role: "country_admin", actorId: "u-country", at: "2026-10-18T10:00:00.000Z", note: "ok" }]);
    const s2 = advanceChain(s1.next, "u-ops", null, new Date("2026-10-18T11:00:00Z"));
    expect(s2.done).toBe(true);
    expect(s2.next.stageApprovals?.map((a) => [a.stage, a.role, a.actorId])).toEqual([[1, "country_admin", "u-country"], [2, "country_operations_admin", "u-ops"]]);
  });
});
