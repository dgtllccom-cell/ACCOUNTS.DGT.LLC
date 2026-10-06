/**
 * Browser-side helpers shared by every screen that shows a loading row's Purchase Lane action
 * (the Loading Records report and the per-booking Load Details form).
 */

export type LaneState = {
  id: string;
  lane_status: string;
  leg_no: number;
  owner_type: string;
  ownerChanged: boolean;
  current_location: string | null;
  assigned_to: string | null;
  disposition: string | null;
};

/** Lane state of the given loading rows, keyed by loading record id (rows not yet in the lane are simply absent). */
export async function fetchLaneStates(ids: string[]): Promise<Record<string, LaneState>> {
  const clean = ids.filter(Boolean);
  if (!clean.length) return {};
  try {
    const r = await fetch(`/api/erp/purchases/lane?loadingRecordIds=${clean.join(",")}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    return (j?.data?.states ?? {}) as Record<string, LaneState>;
  } catch {
    return {};
  }
}

/** Puts a loading row into the Purchase Lane (idempotent — one lane row per loading record) and returns the lane id. */
export async function ensureLaneForLoading(loadingRecordId: string): Promise<string> {
  const r = await fetch("/api/erp/purchases/lane", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ensure", loadingRecordId }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok || !j?.data?.lane?.id) throw new Error(j?.error?.message || "Could not send this load to the Purchase Lane.");
  return j.data.lane.id as string;
}

/** Deep link into the Purchase Transit & Lane report: filter to one booking, open the transfer form, or open one load. */
export function laneReportHref(p: { purchaseOrderId?: string | null; laneIds?: string[]; action?: "transfer"; focus?: string }): string {
  const qs = new URLSearchParams();
  if (p.purchaseOrderId) qs.set("po", String(p.purchaseOrderId));
  if (p.laneIds?.length) qs.set("laneIds", p.laneIds.join(","));
  if (p.action) qs.set("action", p.action);
  if (p.focus) qs.set("focus", p.focus);
  qs.set("source", "purchase_booking");
  return `/dashboard/purchase/purchase-transit-lane?${qs.toString()}`;
}
