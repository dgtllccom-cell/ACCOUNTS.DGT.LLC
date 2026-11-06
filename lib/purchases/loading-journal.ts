/** Read-only loading journal. A bill keeps its identity; later loads remain separate source records. */
export type LoadingJournalRow = {
  id: string; sequence: number; goodsName: string | null; loadingNo: string | null; loadedAt: string | null;
  blNumber: string | null; containerNumber: string | null; quantity: number;
  grossWeight: number; netWeight: number; currency: string | null; finalAmount: number | null;
  laneId: string | null; status: string | null; destination: string | null;
};
export function loadingJournalRows(rows: Record<string, any>[]): LoadingJournalRow[] {
  return [...rows].sort((a, b) => String(a.created_at || a.loaded_at || "").localeCompare(String(b.created_at || b.loaded_at || "")) || String(a.id).localeCompare(String(b.id)))
    .map((r, i) => ({ id: r.id, sequence: i + 1, goodsName: r.report_payload?.goodsName || null, loadingNo: r.loading_record_no || null, loadedAt: r.loaded_at || r.created_at || null,
      blNumber: r.bl_number || null, containerNumber: r.container_number || null, quantity: Number(r.loaded_quantity || 0),
      grossWeight: Number(r.gross_weight ?? r.report_payload?.grossWeight ?? 0), netWeight: Number(r.net_weight ?? r.report_payload?.netWeight ?? 0),
      currency: r.local_currency || null, finalAmount: r.loaded_purchase_local == null ? null : Number(r.loaded_purchase_local),
      laneId: r.lane_id || null, status: r.lane_status || r.loading_status || null, destination: r.transfer_destination || null }));
}
export async function readBillLoadingJournal(sql: any, bill: { source_table: string; source_id: string; country_id: string | null; country_branch_id: string | null; city_branch_id: string | null }) {
  if (bill.source_table === "local_purchases") {
    const rows = await sql`select distinct on (l.source_id) l.source_id as id,l.purchase_ref_no as loading_record_no,
      l.created_at,l.created_at as loaded_at,l.bl_number,l.container_number,l.loaded_quantity,l.gross_weight,l.net_weight,
      l.id as lane_id,l.lane_status,l.transfer_destination
      from public.purchase_lane_loads l where l.source_type='local_purchase' and l.local_purchase_id=${bill.source_id}::uuid
        and l.deleted_at is null and l.country_id is not distinct from ${bill.country_id}::uuid
        and (${bill.country_branch_id}::uuid is null or l.country_branch_id=${bill.country_branch_id}::uuid)
        and (${bill.city_branch_id}::uuid is null or l.city_branch_id=${bill.city_branch_id}::uuid)
      order by l.source_id,l.leg_no desc,l.created_at desc`;
    return loadingJournalRows(rows);
  }
  if (bill.source_table !== "purchase_orders") return [];
  const rows = await sql`
    select lr.id, lr.loading_record_no, lr.loaded_at, lr.created_at, lr.bl_number, lr.container_number,
           lr.loaded_quantity, lr.gross_weight, lr.net_weight, lr.report_payload, lr.loading_status,
           lr.local_currency, lr.loaded_purchase_local,
           lane.id as lane_id, lane.lane_status, lane.transfer_destination
    from public.purchase_loading_records lr
    left join lateral (
      select l.id,l.lane_status,l.transfer_destination from public.purchase_lane_loads l
      where l.source_type='purchase_booking' and l.source_id=lr.id and l.deleted_at is null
      order by l.leg_no desc,l.created_at desc limit 1
    ) lane on true
    where lr.purchase_order_id=${bill.source_id}::uuid and lr.deleted_at is null and lr.loading_status <> 'cancelled'
      and lr.country_id is not distinct from ${bill.country_id}::uuid
      and (${bill.country_branch_id}::uuid is null or lr.country_branch_id=${bill.country_branch_id}::uuid)
      and (${bill.city_branch_id}::uuid is null or lr.city_branch_id=${bill.city_branch_id}::uuid)
    order by lr.created_at,lr.id`;
  return loadingJournalRows(rows);
}
export function loadingJournalLinks(laneId: string, purchaseOrderId?: string | null) {
  const params = new URLSearchParams();
  if (purchaseOrderId) params.set("purchaseOrderId", purchaseOrderId);
  if (laneId) params.set("laneId", laneId);
  return { expenses: `/dashboard/expenses/purchase?${params}`, tracking: `/dashboard/tracking?purchaseLaneId=${encodeURIComponent(laneId)}` };
}
