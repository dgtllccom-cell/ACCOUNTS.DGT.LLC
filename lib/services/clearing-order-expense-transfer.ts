import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";

/**
 * Customer Order → expense bill transfers (Order Transfer screen) and the "received at the Clearing Agent desk" mark.
 *
 * Stored in the existing activity log (erp_activity_events, record_table = clearing_customer_orders, action = expense_transfer) — the
 * same table the order workflow already writes its stage events to — so a transfer survives a reload, carries who / when / where, and
 * needs no new table. The order's own scope columns are copied onto the event, so the log reads under the same branch rules.
 */
export const EXPENSE_TRANSFER_ACTION = "expense_transfer";
export const EXPENSE_TRANSFER_DESTINATIONS = ["customs", "truck", "customer", "other", "clearing_agent"] as const;
export type ExpenseTransferDestination = (typeof EXPENSE_TRANSFER_DESTINATIONS)[number];

/** the destination text Order Transfer shows ("… (General Received Bill)" is what its received checks look for) */
export function destinationLabel(d: ExpenseTransferDestination): string {
  return d === "clearing_agent" ? "Clearing Agent (General Received Bill)" : `${d.toUpperCase()} Bill`;
}

export type ExpenseTransferRecord = {
  id: string;
  destination: ExpenseTransferDestination;
  destinationLabel: string;
  date: string;
  user: string;
  userId: string | null;
  branchName: string | null;
  memo: string | null;
  routingStage: string | null;
  recordedBy: string | null;
  recordedAt: string;
};

export type OrderTransferSummary = {
  /** the latest transfer of the order (any destination) */
  latest: ExpenseTransferRecord | null;
  /** the order was received at the Clearing Agent General Received Bills desk */
  generalReceived: boolean;
};

function mapRow(r: any): ExpenseTransferRecord {
  const m = (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata) ?? {};
  const destination = (EXPENSE_TRANSFER_DESTINATIONS as readonly string[]).includes(m.destination) ? (m.destination as ExpenseTransferDestination) : "other";
  return {
    id: String(r.id),
    destination,
    destinationLabel: destinationLabel(destination),
    date: String(m.date ?? "").slice(0, 10) || String(r.created_at).slice(0, 10),
    user: String(m.assignedUser ?? ""),
    userId: m.assignedUserId ?? null,
    branchName: m.assignedBranch ?? null,
    memo: m.memo ?? null,
    routingStage: m.routingStage ?? null,
    recordedBy: r.actor_name ?? m.recordedByName ?? null,
    recordedAt: new Date(r.created_at).toISOString(),
  };
}

/** Latest transfer + received mark per order (the orders passed in are already scope-filtered by their own list rules). */
export async function transferSummaries(orderIds: string[]): Promise<Map<string, OrderTransferSummary>> {
  const out = new Map<string, OrderTransferSummary>();
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return out;
  const rows = await withReadPg(async (sql) => sql`
    select e.id, e.record_id, e.metadata, e.created_at, p.full_name as actor_name
    from public.erp_activity_events e
    left join public.profiles p on p.id = e.actor_id
    where e.record_table = 'clearing_customer_orders' and e.action = ${EXPENSE_TRANSFER_ACTION} and e.record_id = any(${ids}::uuid[])
    order by e.created_at desc`);
  for (const r of (rows ?? []) as any[]) {
    const id = String(r.record_id);
    const cur = out.get(id) ?? { latest: null, generalReceived: false };
    const rec = mapRow(r);
    if (!cur.latest) cur.latest = rec; // rows are newest first
    if (rec.destination === "clearing_agent") cur.generalReceived = true;
    out.set(id, cur);
  }
  return out;
}

export async function recordExpenseTransfer(input: {
  order: { id: string; order_no: string; country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null };
  actorId: string | null;
  destination: ExpenseTransferDestination;
  assignedUserId?: string | null;
  assignedUser?: string | null;
  assignedBranch?: string | null;
  /** the person who recorded the transfer (kept in the metadata too: a login without a profile row has no actor_id) */
  recordedByName?: string | null;
  date?: string | null;
  memo?: string | null;
  routingStage?: string | null;
}): Promise<ExpenseTransferRecord> {
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : new Date().toISOString().slice(0, 10);
  const metadata = {
    orderNo: input.order.order_no,
    destination: input.destination,
    actionText: `Order transferred to ${destinationLabel(input.destination)}`,
    assignedUserId: input.assignedUserId ?? null,
    assignedUser: (input.assignedUser ?? "").slice(0, 200),
    assignedBranch: input.assignedBranch ?? null,
    date,
    memo: input.memo ? String(input.memo).slice(0, 1000) : null,
    routingStage: input.routingStage ?? null,
    recordedByName: input.recordedByName ?? null,
  };
  const row = await withLocalPg(async (sql) => {
    const [r] = await sql`
      insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, country_branch_id, city_branch_id, metadata)
      values ((select id from public.profiles where id = ${input.actorId}::uuid), ${EXPENSE_TRANSFER_ACTION}, 'shipping', 'clearing_customer_orders', ${input.order.id}::uuid,
        ${input.order.country_id ?? null}, ${input.order.country_branch_id ?? null}, ${input.order.city_branch_id ?? null}, ${sql.json(metadata as never)})
      returning id, metadata, created_at, actor_id`;
    const [actor] = input.actorId ? await sql`select full_name from public.profiles where id = ${input.actorId}::uuid` : [null];
    return { ...r, actor_name: actor?.full_name ?? input.recordedByName ?? null };
  });
  if (!row) throw new Error("The transfer could not be saved (no database connection).");
  return mapRow(row);
}

export async function listOrderTransfers(orderId: string): Promise<ExpenseTransferRecord[]> {
  const rows = await withReadPg(async (sql) => sql`
    select e.id, e.metadata, e.created_at, p.full_name as actor_name
    from public.erp_activity_events e left join public.profiles p on p.id = e.actor_id
    where e.record_table = 'clearing_customer_orders' and e.action = ${EXPENSE_TRANSFER_ACTION} and e.record_id = ${orderId}::uuid
    order by e.created_at desc limit 100`);
  return ((rows ?? []) as any[]).map(mapRow);
}
