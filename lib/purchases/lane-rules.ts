/**
 * Purchase Transit & Lane — pure rules (no DB / React) shared by the API, the UI and the tests.
 *
 * Loading is an OPERATIONAL step: it records cargo (quantity, BL, container, weights, vessel/truck …). It never asks for a
 * currency, rate or amount and it never changes what is payable. Outstanding Credit / Final Payment balances stay in
 * Accounts Payable, supplier balance, payment schedule and aging; "Remaining to Load" is physical quantity ONLY.
 */

export const LANE_STATUSES = [
  "loaded",
  "in_transit",
  "arrived",
  "transfer_pending",
  "assigned",
  "customs_pending",
  "under_clearance",
  "customs_cleared",
  "final_disposition_pending",
  "completed",
] as const;
export type LaneStatus = (typeof LANE_STATUSES)[number];

export const LANE_STATUS_LABEL: Record<LaneStatus, { key: string; en: string }> = {
  loaded: { key: "st_loaded", en: "Loaded" },
  in_transit: { key: "st_in_transit", en: "In Transit" },
  arrived: { key: "st_arrived", en: "Arrived" },
  transfer_pending: { key: "st_transfer_pending", en: "Transfer Pending" },
  assigned: { key: "st_assigned", en: "Assigned to Branch/Agent" },
  customs_pending: { key: "st_customs_pending", en: "Customs Pending" },
  under_clearance: { key: "st_under_clearance", en: "Under Customs Clearance" },
  customs_cleared: { key: "st_customs_cleared", en: "Customs Cleared" },
  final_disposition_pending: { key: "st_final_disposition_pending", en: "Final Disposition Pending" },
  completed: { key: "st_completed", en: "Completed" },
};

/** Manual status moves (a transfer and a disposition have their own actions). */
const NEXT: Record<LaneStatus, LaneStatus[]> = {
  loaded: ["in_transit", "arrived"],
  in_transit: ["arrived"],
  arrived: ["customs_pending", "final_disposition_pending"], // customs not required -> straight to disposition
  transfer_pending: [], // only "accept" (-> assigned) or another transfer
  assigned: ["in_transit", "arrived", "customs_pending", "final_disposition_pending"],
  customs_pending: ["under_clearance"],
  under_clearance: ["customs_cleared"],
  customs_cleared: ["final_disposition_pending"],
  final_disposition_pending: [],
  completed: [],
};

export function allowedNextStatuses(s: LaneStatus): LaneStatus[] {
  return NEXT[s] ?? [];
}
export function canMoveStatus(from: LaneStatus, to: LaneStatus): boolean {
  return allowedNextStatuses(from).includes(to);
}

// ───────────────────────────── transfers ─────────────────────────────

export const TRANSFER_TYPES = ["own_branch", "other_branch", "internal_agent", "external_agent", "other_user", "self_managed"] as const;
export type TransferType = (typeof TRANSFER_TYPES)[number];

export const RESPONSIBILITIES = ["custody", "transport", "customs_clearance", "full_handling"] as const;
export type Responsibility = (typeof RESPONSIBILITIES)[number];

export type TransferRequest = {
  type: TransferType;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  agentId?: string | null;
  agentName?: string | null;
  userId?: string | null;
  expectedLocation?: string | null;
  responsibility?: string | null;
  note?: string | null;
};

/** Missing / invalid parts of a transfer request. Empty = valid. Codes are translated by the UI. */
export function transferProblems(t: TransferRequest): string[] {
  const out: string[] = [];
  if (!TRANSFER_TYPES.includes(t.type)) out.push("type");
  if (!t.responsibility || !(RESPONSIBILITIES as readonly string[]).includes(t.responsibility)) out.push("responsibility");
  if (t.type !== "self_managed" && !String(t.expectedLocation ?? "").trim()) out.push("expectedLocation");
  switch (t.type) {
    case "own_branch":
      if (!t.countryBranchId && !t.cityBranchId) out.push("branch");
      break;
    case "other_branch":
      if (!t.countryId) out.push("country");
      if (!t.countryBranchId && !t.cityBranchId) out.push("branch");
      break;
    case "internal_agent":
      if (!t.agentId) out.push("agent");
      break;
    case "external_agent":
      if (!t.agentId && !String(t.agentName ?? "").trim()) out.push("agent");
      break;
    case "other_user":
      if (!t.userId) out.push("user");
      break;
    default:
      break;
  }
  return out;
}

/** Self-managed and own-branch hand-overs need nobody to accept; everything else waits as "Transfer Pending". */
export function transferNeedsAcceptance(type: TransferType): boolean {
  return type !== "self_managed" && type !== "own_branch";
}

// ───────────────────────────── final disposition ─────────────────────────────

export const DISPOSITIONS = ["re_export", "warehouse", "sale_delivery", "continue_transit", "hold"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

/** Dispositions that end the load's journey (and reduce lane stock exactly once). */
export const FINAL_DISPOSITIONS: Disposition[] = ["re_export", "warehouse", "sale_delivery"];
export const isFinalDisposition = (d: string | null | undefined): boolean => FINAL_DISPOSITIONS.includes(d as Disposition);

export function canChooseDisposition(status: LaneStatus): boolean {
  return status === "customs_cleared" || status === "final_disposition_pending";
}

export function dispositionProblems(d: { kind: string; warehouseId?: string | null; nextDestination?: string | null }): string[] {
  if (!(DISPOSITIONS as readonly string[]).includes(d.kind)) return ["kind"];
  if (d.kind === "warehouse" && !d.warehouseId) return ["warehouse"];
  if (d.kind === "continue_transit" && !String(d.nextDestination ?? "").trim()) return ["nextDestination"];
  return [];
}

/** What a disposition does to the load. `stockEffect` is the ONE stock movement it may cause. */
export function dispositionOutcome(kind: Disposition): { status: LaneStatus; final: boolean; stockEffect: "none" | "warehouse_in" | "lane_out"; newLeg: boolean } {
  switch (kind) {
    case "warehouse": return { status: "completed", final: true, stockEffect: "warehouse_in", newLeg: false };
    case "re_export": return { status: "completed", final: true, stockEffect: "lane_out", newLeg: false };
    case "sale_delivery": return { status: "completed", final: true, stockEffect: "lane_out", newLeg: false };
    case "continue_transit": return { status: "in_transit", final: false, stockEffect: "none", newLeg: true };
    case "hold": return { status: "final_disposition_pending", final: false, stockEffect: "none", newLeg: false };
  }
}

/** "Final Purchase Completed" only when EVERY live load of the purchase has a confirmed final disposition. */
export function purchaseIsFinallyCompleted(loads: Array<{ lane_status: string; disposition_final?: boolean | null }>): boolean {
  return loads.length > 0 && loads.every((l) => l.lane_status === "completed" && Boolean(l.disposition_final));
}

// ───────────────────────────── loading page rules ─────────────────────────────

/** Remaining to Load is PHYSICAL quantity only — never a payment balance. */
export function remainingToLoad(totalQuantity: number, loadedQuantity: number): number {
  const t = Number(totalQuantity) || 0;
  const l = Number(loadedQuantity) || 0;
  return Math.max(0, Math.round((t - l) * 10000) / 10000);
}

/** New Loading is only for quantity still to load — or when correcting / replacing an existing entry. */
export function canCreateNewLoading(p: { remainingQuantity: number; editingExisting?: boolean }): boolean {
  return Boolean(p.editingExisting) || p.remainingQuantity > 0;
}

export type LoadingRowAction = { kind: "send_to_lane" | "open_lane" | "transfer" | "track"; labelKey: string; label: string };

/**
 * The next operational action shown in the Action column of every saved loading/container row.
 *  - no lane row yet (older loads)           -> Send to Purchase Lane
 *  - in the lane, still at the loading branch -> Transfer Load
 *  - already moving / assigned / completed    -> Track Load
 */
export function loadingRowAction(row: { laneStatus?: string | null; hasLaneRow: boolean; legNo?: number | null; ownerChanged?: boolean }): LoadingRowAction {
  if (!row.hasLaneRow) return { kind: "send_to_lane", labelKey: "act_send_to_lane", label: "Send to Purchase Lane" };
  const st = row.laneStatus as LaneStatus | undefined;
  if (st === "loaded" && !row.ownerChanged && (row.legNo ?? 1) <= 1) return { kind: "transfer", labelKey: "act_transfer_load", label: "Transfer Load" };
  return { kind: "track", labelKey: "act_track_load", label: "Track Load" };
}

/** Bulk buttons under the loading list: never the misleading "Transfer Remaining". */
export function bulkTransferActions(p: { untransferredLoads: number; selectedLoads: number }): Array<{ id: "transfer_selected" | "transfer_all"; labelKey: string; label: string; enabled: boolean }> {
  return [
    { id: "transfer_selected", labelKey: "act_transfer_selected", label: "Transfer Selected Containers", enabled: p.selectedLoads > 0 },
    { id: "transfer_all", labelKey: "act_transfer_all", label: "Transfer All Untransferred Loads", enabled: p.untransferredLoads > 0 },
  ];
}

/** A loaded row shows the genuine container/BL/load, never the synthetic "pending" placeholder. */
export function isGenuineLoadingRow(r: { id?: string | null; loading_status?: string | null; container_number?: string | null }): boolean {
  if (!r.id || String(r.id).startsWith("synthetic-")) return false;
  return r.loading_status !== "pending" || Boolean(r.container_number && r.container_number !== "-");
}
