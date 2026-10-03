import { withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { ApiClientError } from "@/lib/api/response";
import {
  canChooseDisposition, canMoveStatus, dispositionOutcome, dispositionProblems, isFinalDisposition, LANE_STATUSES,
  purchaseIsFinallyCompleted, remainingToLoad, transferNeedsAcceptance, transferProblems,
  type Disposition, type LaneStatus, type TransferRequest,
} from "@/lib/purchases/lane-rules";
import { stockInToWarehouse } from "@/lib/services/purchase-warehouse-stock";

/**
 * Purchase Transit & Lane service.
 *
 * Guarantees (each is also covered by tests/purchases + scripts/e2e-verify-purchase-lane.mts):
 *  - one lane row per physical load (unique index) → no duplicate load / stock / expense rows when a load moves;
 *  - moving a load between branches, agents, customs or lanes writes an audit event and NOTHING else
 *    (no stock, no journal, no ledger, no revenue);
 *  - lane stock is reduced exactly once, when a FINAL disposition is confirmed;
 *  - warehouse stock goes through the shared stockInToWarehouse() (same tables the ERP already uses);
 *  - expenses stay linked Purchase → Loading → BL → Container → Lane → Agent/Branch and only reach the
 *    Bill Expenses register (as an UNPOSTED line) after review + confirmation. Nothing is posted here.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;
export type LaneActor = { session: ErpSession };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
const fail = (msg: string, code = "LANE_ERROR", status = 422, details?: unknown) => new ApiClientError(msg, { status, code, details });

export function laneScopeSql(sql: Sql, session: ErpSession, alias = "l") {
  const scope = sessionSqlScope(session);
  if (scope.kind === "all") return sql`TRUE`;
  const origin = sqlScopeCondition(sql, scope, alias);
  const owner = sqlScopeCondition(sql, scope, alias, { prefix: "owner_" });
  return sql`(${origin} OR (${sql.unsafe(alias)}.owner_country_branch_id IS NOT NULL OR ${sql.unsafe(alias)}.owner_city_branch_id IS NOT NULL OR ${sql.unsafe(alias)}.owner_country_id IS NOT NULL) AND ${owner} OR ${sql.unsafe(alias)}.owner_user_id = ${session.userId}::uuid)`;
}

/**
 * Is this branch (country / main branch / city branch) one the caller is responsible for?
 *  - a city-branch role covers ITS city branch only (a city admin is not responsible for the whole main branch)
 *  - a main-branch role covers the main branch and every city branch under it
 *  - a country role covers the whole country
 */
function inBranchScope(session: ErpSession, c: string | null, b: string | null, ci: string | null): boolean {
  if (ci && session.cityBranchIds.includes(ci)) return true;
  if (b) {
    const a = session.assignments as Array<{ cityBranchId?: string | null; countryBranchId?: string | null }> | undefined;
    if (Array.isArray(a) ? a.some((x) => !x.cityBranchId && x.countryBranchId === b) : session.countryBranchIds.includes(b)) return true;
  }
  const isCountryRole = session.roles?.some((r) => r === "country_admin" || r === "country_user");
  if (isCountryRole && c && session.countryIds.includes(c)) return true;
  return false;
}

/** May this person act on the load now (transfer / advance / dispose / add expenses)? */
function canAct(session: ErpSession, l: Record<string, any>): boolean {
  if (session.isSuperAdmin) return true;
  if (l.owner_user_id && l.owner_user_id === session.userId) return true;
  const inScope = (c: string | null, b: string | null, ci: string | null) => inBranchScope(session, c, b, ci);
  const ownerSet = Boolean(l.owner_country_id || l.owner_country_branch_id || l.owner_city_branch_id);
  if (ownerSet && inScope(l.owner_country_id, l.owner_country_branch_id, l.owner_city_branch_id)) return true;
  // an agent has no ERP login: whoever handed the load to the agent keeps managing it for the agent
  if ((l.owner_type === "external_agent" || l.owner_type === "internal_agent") && inScope(l.country_id, l.country_branch_id, l.city_branch_id)) return true;
  if (!ownerSet && inScope(l.country_id, l.country_branch_id, l.city_branch_id)) return true;
  return false;
}

async function addEvent(sql: Sql, load: Record<string, any>, ev: { type: string; from?: string | null; to?: string | null; detail?: unknown }, session: ErpSession) {
  await sql`
    insert into public.purchase_lane_events (lane_load_id, purchase_order_id, event_type, from_status, to_status, detail, actor_id, actor_name)
    values (${load.id}::uuid, ${load.purchase_order_id ?? null}, ${ev.type}, ${ev.from ?? null}, ${ev.to ?? null}, ${sql.json((ev.detail ?? {}) as never)}, ${session.userId}::uuid, ${session.fullName ?? null})`;
}

// ───────────────────────────── entering the lane ─────────────────────────────

/** Idempotent: a loading record has exactly one lane row. Called when a loading is saved (and lazily for older loads). */
export async function ensureLaneFromLoadingRecord(sql: Sql, loadingRecordId: string, session: ErpSession): Promise<{ id: string; created: boolean } | null> {
  const rows = await sql`
    insert into public.purchase_lane_loads (
      source_type, source_id, purchase_order_id, purchase_ref_no, loading_record_no, supplier_name, goods_name, goods_id,
      bl_number, container_number, container_type, loaded_quantity, unit, gross_weight, tare_weight, net_weight,
      origin_text, destination_text, transport_mode, lane_status, current_location, owner_type,
      owner_country_id, owner_country_branch_id, owner_city_branch_id, lane_stock_qty,
      country_id, country_branch_id, city_branch_id, created_by)
    select
      'purchase_booking', plr.id, plr.purchase_order_id, plr.purchase_order_no, plr.loading_record_no,
      coalesce(po.form_data->'form'->>'supplierName', po.form_data->'form'->>'purchaseAccountName'),
      coalesce(plr.report_payload->>'goodsName', po.form_data->'goodsEntries'->0->>'goodsName', po.form_data->'form'->>'goodsName'),
      plr.receiving_goods_id,
      coalesce(plr.bl_number, plr.report_payload->>'blNumber'), plr.container_number, plr.container_type,
      coalesce(plr.loaded_quantity, 0),
      coalesce(plr.report_payload->>'qtyName', po.form_data->'form'->>'qtyName'),
      coalesce(plr.gross_weight, nullif(plr.report_payload->>'grossWeight','')::numeric),
      plr.tare_weight,
      coalesce(plr.net_weight, nullif(plr.report_payload->>'netWeight','')::numeric),
      coalesce(plr.origin_text, plr.loading_location), coalesce(plr.destination_text, plr.receiving_location), plr.transport_mode,
      case when coalesce(plr.received_quantity,0) > 0 then 'arrived' else 'loaded' end,
      plr.loading_location, 'branch',
      plr.country_id, plr.country_branch_id, plr.city_branch_id,
      greatest(0, coalesce(plr.loaded_quantity,0) - coalesce(plr.received_quantity,0)),
      plr.country_id, plr.country_branch_id, plr.city_branch_id, ${session.userId}::uuid
    from public.purchase_loading_records plr
    left join public.purchase_orders po on po.id = plr.purchase_order_id
    where plr.id = ${loadingRecordId}::uuid and plr.deleted_at is null and plr.loading_status <> 'cancelled'
    on conflict (source_type, source_id) where deleted_at is null do nothing
    returning id`;
  if (rows[0]) {
    await addEvent(sql, { id: rows[0].id }, { type: "loaded", to: "loaded", detail: { source: "purchase_booking", loadingRecordId } }, session);
    return { id: rows[0].id as string, created: true };
  }
  const ex = await sql`select id from public.purchase_lane_loads where source_type = 'purchase_booking' and source_id = ${loadingRecordId}::uuid and deleted_at is null`;
  return ex[0] ? { id: ex[0].id as string, created: false } : null;
}

export async function ensureLaneFromLocalPurchase(sql: Sql, localPurchaseId: string, session: ErpSession): Promise<{ id: string; created: boolean } | null> {
  const rows = await sql`
    insert into public.purchase_lane_loads (
      source_type, source_id, local_purchase_id, purchase_ref_no, supplier_name, goods_name, goods_id,
      container_number, loaded_quantity, unit, gross_weight, net_weight, transport_mode, lane_status, current_location, owner_type,
      owner_country_id, owner_country_branch_id, owner_city_branch_id, lane_stock_qty,
      country_id, country_branch_id, city_branch_id, created_by)
    select
      'local_purchase', lp.id, lp.id, coalesce(lp.manual_bill_no, lp.entry_serial, lp.journal_serial_no), lp.supplier_name, lp.goods_name, lp.goods_id,
      lp.truck_no, coalesce(lp.numbers, 0), lp.quantity_name, lp.total_gross_weight, lp.net_weight, lp.shipping_mode, 'loaded', lp.warehouse_name, 'branch',
      lp.country_id, lp.country_branch_id, lp.city_branch_id, coalesce(lp.numbers, 0),
      lp.country_id, lp.country_branch_id, lp.city_branch_id, ${session.userId}::uuid
    from public.local_purchases lp
    where lp.id = ${localPurchaseId}::uuid and lp.deleted_at is null
    on conflict (source_type, source_id) where deleted_at is null do nothing
    returning id`;
  if (rows[0]) {
    await addEvent(sql, { id: rows[0].id }, { type: "loaded", to: "loaded", detail: { source: "local_purchase", localPurchaseId } }, session);
    return { id: rows[0].id as string, created: true };
  }
  const ex = await sql`select id from public.purchase_lane_loads where source_type = 'local_purchase' and source_id = ${localPurchaseId}::uuid and deleted_at is null`;
  return ex[0] ? { id: ex[0].id as string, created: false } : null;
}

/** Older loads (saved before the lane existed) enter the lane the first time their scope looks at it. */
async function backfillScope(sql: Sql, session: ErpSession) {
  const scope = sessionSqlScope(session);
  const ids = await sql`
    select plr.id from public.purchase_loading_records plr
    where plr.deleted_at is null and plr.loading_status <> 'cancelled' and coalesce(plr.loaded_quantity,0) > 0
      and ${sqlScopeCondition(sql, scope, "plr")}
      and not exists (select 1 from public.purchase_lane_loads l where l.source_type='purchase_booking' and l.source_id = plr.id and l.deleted_at is null)
    limit 500`;
  for (const r of ids) await ensureLaneFromLoadingRecord(sql, r.id, session);
}

// ───────────────────────────── queries ─────────────────────────────

export type LaneFilters = { status?: string; q?: string; purchaseOrderId?: string; sourceType?: string; sourceId?: string; limit?: number };

export async function listLaneLoads(session: ErpSession, f: LaneFilters = {}) {
  return withLocalPg(async (sql: Sql) => {
    await backfillScope(sql, session);
    const term = f.q?.trim();
    const rows = await sql`
      select l.*,
             coalesce(cb.name, '') as owner_country_branch_name, coalesce(ci.name, '') as owner_city_branch_name,
             (select count(*)::int from public.purchase_lane_expenses e where e.lane_load_id = l.id and e.deleted_at is null) as expense_count,
             (select coalesce(sum(e.amount),0) from public.purchase_lane_expenses e where e.lane_load_id = l.id and e.deleted_at is null and e.status <> 'cancelled') as expense_total
      from public.purchase_lane_loads l
      left join public.country_branches cb on cb.id = l.owner_country_branch_id
      left join public.city_branches ci on ci.id = l.owner_city_branch_id
      where l.deleted_at is null and ${laneScopeSql(sql, session, "l")}
        ${f.status && (LANE_STATUSES as readonly string[]).includes(f.status) ? sql`and l.lane_status = ${f.status}` : sql``}
        ${f.purchaseOrderId ? sql`and l.purchase_order_id = ${f.purchaseOrderId}::uuid` : sql``}
        ${f.sourceType ? sql`and l.source_type = ${f.sourceType}` : sql``}
        ${f.sourceId ? sql`and l.source_id = ${f.sourceId}::uuid` : sql``}
        ${term ? sql`and (l.purchase_ref_no ilike ${"%" + term + "%"} or l.container_number ilike ${"%" + term + "%"} or l.bl_number ilike ${"%" + term + "%"} or l.supplier_name ilike ${"%" + term + "%"} or l.goods_name ilike ${"%" + term + "%"})` : sql``}
      order by l.updated_at desc
      limit ${Math.min(Math.max(f.limit ?? 300, 1), 1000)}`;
    const summary: Record<string, number> = {};
    for (const s of LANE_STATUSES) summary[s] = 0;
    for (const r of rows) summary[r.lane_status] = (summary[r.lane_status] ?? 0) + 1;
    const laneStock = rows.filter((r: any) => r.lane_status !== "completed").reduce((a: number, r: any) => a + num(r.lane_stock_qty), 0);
    return { rows, summary, laneStockQty: laneStock };
  });
}

export async function getLaneLoad(session: ErpSession, id: string) {
  return withLocalPg(async (sql: Sql) => {
    const l = (await sql`select * from public.purchase_lane_loads where id = ${id}::uuid and deleted_at is null and ${laneScopeSql(sql, session, "purchase_lane_loads")}`)[0];
    if (!l) return null;
    const events = await sql`select * from public.purchase_lane_events where lane_load_id = ${id}::uuid order by created_at desc limit 200`;
    const expenses = await sql`select * from public.purchase_lane_expenses where lane_load_id = ${id}::uuid and deleted_at is null order by created_at desc`;
    return { load: l, events, expenses, canAct: canAct(session, l) };
  });
}

/** Lane state per loading record, for the Action column on the Purchase Loading page. */
export async function laneStatesForLoadingRecords(session: ErpSession, loadingRecordIds: string[]) {
  type LaneState = { id: string; lane_status: string; leg_no: number; owner_type: string; ownerChanged: boolean; current_location: string | null; assigned_to: string | null; disposition: string | null };
  if (!loadingRecordIds.length) return {} as Record<string, LaneState>;
  return withLocalPg(async (sql: Sql) => {
    const rows = await sql`
      select l.id, l.source_id, l.lane_status, l.leg_no, l.owner_type, l.current_location, l.disposition,
             (l.owner_city_branch_id is distinct from l.city_branch_id or l.owner_country_branch_id is distinct from l.country_branch_id or l.owner_type <> 'branch') as owner_changed,
             coalesce(l.owner_agent_name, l.owner_user_name,
                      (select cb.name from public.city_branches cb where cb.id = l.owner_city_branch_id),
                      (select b.name from public.country_branches b where b.id = l.owner_country_branch_id)) as assigned_to
      from public.purchase_lane_loads l
      where l.deleted_at is null and l.source_type = 'purchase_booking' and l.source_id = ANY(${loadingRecordIds}::uuid[]) and ${laneScopeSql(sql, session, "l")}`;
    const out: Record<string, LaneState> = {};
    for (const r of rows) out[r.source_id] = { id: r.id, lane_status: r.lane_status, leg_no: r.leg_no, owner_type: r.owner_type, ownerChanged: Boolean(r.owner_changed), current_location: r.current_location ?? null, assigned_to: r.assigned_to ?? null, disposition: r.disposition ?? null };
    return out;
  });
}

// ───────────────────────────── transfer ─────────────────────────────

async function loadForUpdate(tx: Sql, session: ErpSession, id: string) {
  const l = (await tx`select * from public.purchase_lane_loads where id = ${id}::uuid and deleted_at is null for update`)[0];
  if (!l) throw fail("Load not found.", "NOT_FOUND", 404);
  if (!canAct(session, l)) throw fail("You are not responsible for this load, so you cannot change it.", "FORBIDDEN", 403);
  return l;
}

async function resolveTarget(tx: Sql, session: ErpSession, req: TransferRequest) {
  const t: { country: string | null; countryBranch: string | null; cityBranch: string | null; agentId: string | null; agentName: string | null; userId: string | null; userName: string | null } =
    { country: null, countryBranch: null, cityBranch: null, agentId: null, agentName: null, userId: null, userName: null };

  const branchFromCity = async (cityId: string) => {
    const r = (await tx`select id, country_id, country_branch_id from public.city_branches where id = ${cityId}::uuid and deleted_at is null`)[0];
    if (!r) throw fail("The selected city branch does not exist.", "TARGET_INVALID");
    return r;
  };
  const branchFromMain = async (mainId: string) => {
    const r = (await tx`select id, country_id from public.country_branches where id = ${mainId}::uuid and deleted_at is null`)[0];
    if (!r) throw fail("The selected main branch does not exist.", "TARGET_INVALID");
    return r;
  };

  if (req.type === "own_branch") {
    // "Own branch" = a branch the caller actually belongs to (a super admin may pick any).
    if (req.cityBranchId) {
      const r = await branchFromCity(req.cityBranchId);
      if (!session.isSuperAdmin && !inBranchScope(session, r.country_id, r.country_branch_id, r.id)) throw fail("That is not one of your own branches. Use 'Another country or city branch' to hand a load to a different branch.", "TARGET_FORBIDDEN", 403);
      t.country = r.country_id; t.countryBranch = r.country_branch_id; t.cityBranch = r.id;
    } else if (req.countryBranchId) {
      const r = await branchFromMain(req.countryBranchId);
      if (!session.isSuperAdmin && !inBranchScope(session, r.country_id, r.id, null)) throw fail("That is not one of your own branches. Use 'Another country or city branch' to hand a load to a different branch.", "TARGET_FORBIDDEN", 403);
      t.country = r.country_id; t.countryBranch = r.id;
    }
  } else if (req.type === "other_branch") {
    if (req.cityBranchId) {
      const r = await branchFromCity(req.cityBranchId);
      if (req.countryId && r.country_id !== req.countryId) throw fail("The branch does not belong to the selected country.", "TARGET_INVALID");
      t.country = r.country_id; t.countryBranch = r.country_branch_id; t.cityBranch = r.id;
    } else if (req.countryBranchId) {
      const r = await branchFromMain(req.countryBranchId);
      if (req.countryId && r.country_id !== req.countryId) throw fail("The branch does not belong to the selected country.", "TARGET_INVALID");
      t.country = r.country_id; t.countryBranch = r.id;
    }
  } else if (req.type === "internal_agent" || req.type === "external_agent") {
    if (req.agentId) {
      const a = (await tx`select id, name from public.clearing_agents where id = ${req.agentId}::uuid and deleted_at is null`)[0];
      if (!a) throw fail("The selected agent does not exist.", "TARGET_INVALID");
      t.agentId = a.id; t.agentName = a.name;
    } else t.agentName = String(req.agentName ?? "").trim() || null;
    if (req.cityBranchId) { const r = await branchFromCity(req.cityBranchId); t.country = r.country_id; t.countryBranch = r.country_branch_id; t.cityBranch = r.id; }
    else if (req.countryBranchId) { const r = await branchFromMain(req.countryBranchId); t.country = r.country_id; t.countryBranch = r.id; }
    else if (req.countryId) t.country = req.countryId;
  } else if (req.type === "other_user") {
    const u = (await tx`select id, full_name from public.profiles where id = ${req.userId}::uuid and deleted_at is null`)[0];
    if (!u) throw fail("The selected user does not exist.", "TARGET_INVALID");
    t.userId = u.id; t.userName = u.full_name;
    const a = (await tx`select country_id, country_branch_id, city_branch_id from public.user_role_assignments where user_id = ${u.id}::uuid order by city_branch_id nulls last limit 1`)[0];
    if (a) { t.country = a.country_id; t.countryBranch = a.country_branch_id; t.cityBranch = a.city_branch_id; }
  } else if (req.type === "self_managed") {
    t.userId = session.userId; t.userName = session.fullName ?? null;
    t.country = session.countryIds[0] ?? null; t.countryBranch = session.countryBranchIds[0] ?? null; t.cityBranch = session.cityBranchIds[0] ?? null;
  }
  return t;
}

/** Transfer one or more loads (all-or-nothing). Writes an audit event per load; nothing else. */
export async function transferLoads(session: ErpSession, ids: string[], req: TransferRequest) {
  const problems = transferProblems(req);
  if (problems.length) throw fail("The transfer is incomplete: " + problems.join(", "), "TRANSFER_INCOMPLETE", 422, { problems });
  if (!ids.length || ids.some((i) => !uuidRe.test(i))) throw fail("Select at least one load.", "NO_LOADS");
  return withLocalPg(async (sql: Sql) =>
    sql.begin(async (tx: Sql) => {
      const target = await resolveTarget(tx, session, req);
      const results: Array<{ id: string; from: string; to: string }> = [];
      for (const id of [...new Set(ids)]) {
        const l = await loadForUpdate(tx, session, id);
        if (l.lane_status === "completed") throw fail(`Load ${l.container_number || l.purchase_ref_no} is completed and cannot be transferred.`, "LOAD_COMPLETED");
        const needsAccept = transferNeedsAcceptance(req.type);
        const to: LaneStatus = needsAccept ? "transfer_pending" : "assigned";
        const prevOwner = { type: l.owner_type, countryBranchId: l.owner_country_branch_id, cityBranchId: l.owner_city_branch_id, agent: l.owner_agent_name, user: l.owner_user_name };
        await tx`
          update public.purchase_lane_loads set
            lane_status = ${to},
            owner_type = ${req.type === "own_branch" || req.type === "other_branch" ? "branch" : req.type === "other_user" ? "user" : req.type === "self_managed" ? "self" : req.type},
            owner_country_id = ${target.country}, owner_country_branch_id = ${target.countryBranch}, owner_city_branch_id = ${target.cityBranch},
            owner_agent_id = ${target.agentId}, owner_agent_name = ${target.agentName},
            owner_user_id = ${target.userId}, owner_user_name = ${target.userName},
            responsibility = ${req.responsibility ?? null}, expected_location = ${req.expectedLocation ?? null},
            updated_at = now()
          where id = ${id}::uuid`;
        await addEvent(tx, l, {
          type: "transferred", from: l.lane_status, to,
          detail: {
            transferType: req.type, responsibility: req.responsibility, expectedLocation: req.expectedLocation, note: req.note ?? null,
            from: prevOwner,
            to: { type: req.type, ...target },
            // an internal branch hand-over is settled between branches — it is NOT a sale
            settlement: req.type === "own_branch" || req.type === "other_branch" ? "inter_branch" : "none",
          },
        }, session);
        results.push({ id, from: l.lane_status, to });
      }
      return results;
    })
  );
}

/** The receiver (or whoever manages the load for an agent) accepts the hand-over. */
export async function acceptTransfer(session: ErpSession, id: string, note?: string | null) {
  return withLocalPg(async (sql: Sql) =>
    sql.begin(async (tx: Sql) => {
      const l = await loadForUpdate(tx, session, id);
      if (l.lane_status !== "transfer_pending") throw fail("Only a load in 'Transfer Pending' can be accepted.", "BAD_STATE");
      await tx`update public.purchase_lane_loads set lane_status = 'assigned', updated_at = now() where id = ${id}::uuid`;
      await addEvent(tx, l, { type: "accepted", from: "transfer_pending", to: "assigned", detail: { note: note ?? null } }, session);
      return { id, from: "transfer_pending", to: "assigned" };
    })
  );
}

export async function changeStatus(session: ErpSession, id: string, to: string, note?: string | null) {
  if (!(LANE_STATUSES as readonly string[]).includes(to)) throw fail("Unknown lane status.", "BAD_STATUS");
  return withLocalPg(async (sql: Sql) =>
    sql.begin(async (tx: Sql) => {
      const l = await loadForUpdate(tx, session, id);
      if (!canMoveStatus(l.lane_status as LaneStatus, to as LaneStatus)) throw fail(`A load cannot move from '${l.lane_status}' to '${to}'.`, "BAD_TRANSITION");
      await tx`
        update public.purchase_lane_loads set lane_status = ${to},
          current_location = case when ${to} = 'arrived' then coalesce(destination_text, current_location) else current_location end,
          updated_at = now()
        where id = ${id}::uuid`;
      if (to === "arrived" && l.source_type === "purchase_booking") {
        await tx`update public.purchase_loading_records set actual_arrival_date = coalesce(actual_arrival_date, current_date), updated_at = now() where id = ${l.source_id}::uuid`;
      }
      await addEvent(tx, l, { type: "status_changed", from: l.lane_status, to, detail: { note: note ?? null } }, session);
      return { id, from: l.lane_status, to };
    })
  );
}

// ───────────────────────────── final disposition ─────────────────────────────

async function resolveGoodsId(tx: Sql, l: Record<string, any>, explicit?: string | null): Promise<string | null> {
  if (explicit && uuidRe.test(explicit)) return explicit;
  if (l.goods_id) return l.goods_id;
  if (l.purchase_order_id) {
    const it = (await tx`select product_id from public.purchase_order_items where purchase_order_id = ${l.purchase_order_id}::uuid and product_id is not null order by created_at asc limit 1`)[0];
    if (it?.product_id) return it.product_id;
  }
  if (l.source_type === "local_purchase") {
    const lp = (await tx`select goods_id from public.local_purchases where id = ${l.source_id}::uuid`)[0];
    if (lp?.goods_id) return lp.goods_id;
  }
  return null;
}

export type DispositionRequest = { kind: Disposition; warehouseId?: string | null; goodsId?: string | null; nextDestination?: string | null; note?: string | null };

export async function chooseDisposition(session: ErpSession, id: string, req: DispositionRequest) {
  const problems = dispositionProblems({ kind: req.kind, warehouseId: req.warehouseId, nextDestination: req.nextDestination });
  if (problems.length) throw fail("The disposition is incomplete: " + problems.join(", "), "DISPOSITION_INCOMPLETE", 422, { problems });
  return withLocalPg(async (sql: Sql) =>
    sql.begin(async (tx: Sql) => {
      const l = await loadForUpdate(tx, session, id);
      if (l.disposition_final) throw fail("This load already has a confirmed final disposition. Nothing was changed (stock is never reduced twice).", "ALREADY_DISPOSED", 409);
      if (!canChooseDisposition(l.lane_status as LaneStatus)) throw fail("The final disposition can be chosen only after customs clearance (or when 'Final Disposition Pending').", "BAD_STATE");
      const out = dispositionOutcome(req.kind);
      let stockMovementId: string | null = null;
      const qtyInLane = num(l.lane_stock_qty);

      if (out.stockEffect === "warehouse_in") {
        const wh = (await tx`select id, country_id from public.warehouses where id = ${req.warehouseId}::uuid and deleted_at is null`)[0];
        if (!wh) throw fail("The selected warehouse does not exist.", "WAREHOUSE_INVALID");
        const goodsId = await resolveGoodsId(tx, l, req.goodsId);
        if (!goodsId && qtyInLane > 0) throw fail("No goods item is linked to this load. Choose the goods item to book into the warehouse.", "GOODS_REQUIRED", 422);
        if (qtyInLane > 0 && goodsId) {
          const r = await stockInToWarehouse(tx, {
            goodsId, warehouseId: wh.id, quantity: qtyInLane,
            scope: { countryId: l.owner_country_id ?? l.country_id, countryBranchId: l.owner_country_branch_id ?? l.country_branch_id, cityBranchId: l.owner_city_branch_id ?? l.city_branch_id },
            referenceNo: l.loading_record_no || l.purchase_ref_no, purchaseOrderId: l.purchase_order_id,
            loadingRecordId: l.source_type === "purchase_booking" ? l.source_id : null,
            userId: session.userId, remarks: req.note ?? "Purchase Lane — final disposition: warehouse",
          });
          stockMovementId = r.stockMovementId;
          if (l.source_type === "purchase_booking") {
            // keep the loading record's own receiving columns in step so the older Destination Receiving screen cannot receive it again
            await tx`update public.purchase_loading_records set received_quantity = coalesce(received_quantity,0) + ${qtyInLane}, received_at = now(), received_by = ${session.userId}::uuid,
                       receiving_warehouse_id = ${wh.id}::uuid, receiving_goods_id = ${goodsId}::uuid, loading_status = 'received', shipment_status = 'received', updated_at = now()
                     where id = ${l.source_id}::uuid`;
          }
        }
      }

      const newStatus = out.status;
      await tx`
        update public.purchase_lane_loads set
          lane_status = ${newStatus},
          disposition = ${req.kind}, disposition_final = ${out.final}, disposition_at = now(), disposition_by = ${session.userId}::uuid,
          disposition_warehouse_id = ${req.kind === "warehouse" ? req.warehouseId ?? null : null}, disposition_note = ${req.note ?? null},
          stock_movement_id = coalesce(${stockMovementId}, stock_movement_id),
          lane_stock_qty = ${out.final ? 0 : qtyInLane},
          leg_no = leg_no + ${out.newLeg ? 1 : 0},
          expected_location = ${req.kind === "continue_transit" ? req.nextDestination ?? null : null},
          updated_at = now()
        where id = ${id}::uuid`;
      await addEvent(tx, l, {
        type: "disposition", from: l.lane_status, to: newStatus,
        detail: { kind: req.kind, final: out.final, quantity: qtyInLane, warehouseId: req.warehouseId ?? null, nextDestination: req.nextDestination ?? null, stockMovementId, note: req.note ?? null,
                  // loading / lane never creates revenue; a sale/delivery completes in Sales
                  revenueCreated: false },
      }, session);

      const completed = await recomputePurchaseCompletion(tx, l, session);
      return { id, status: newStatus, disposition: req.kind, final: out.final, stockMovementId, purchaseCompleted: completed };
    })
  );
}

/** Marks the purchase "Final Purchase Completed" once EVERY live load is finally disposed and nothing is left to load. */
async function recomputePurchaseCompletion(tx: Sql, l: Record<string, any>, session: ErpSession): Promise<boolean> {
  if (l.source_type !== "purchase_booking" || !l.purchase_order_id) return false;
  const loads = await tx`select lane_status, disposition_final from public.purchase_lane_loads where purchase_order_id = ${l.purchase_order_id}::uuid and deleted_at is null`;
  const po = (await tx`select form_data from public.purchase_orders where id = ${l.purchase_order_id}::uuid for update`)[0];
  if (!po) return false;
  const fd = po.form_data || {};
  const wf = fd.workflow || {};
  const remaining = remainingToLoad(num(wf.totalQuantity ?? fd.totals?.totalQuantity), num(wf.loadedQuantity));
  const done = purchaseIsFinallyCompleted(loads) && remaining <= 0;
  if (done && wf.lifecycleStatus !== "Final Purchase Completed") {
    wf.lifecycleStatus = "Final Purchase Completed";
    wf.finalPurchaseCompleted = true;
    wf.finalPurchaseCompletedAt = new Date().toISOString();
    fd.workflow = wf;
    await tx`update public.purchase_orders set form_data = ${tx.json(fd as never)} where id = ${l.purchase_order_id}::uuid`;
    await addEvent(tx, l, { type: "purchase_completed", detail: { purchaseOrderId: l.purchase_order_id, loads: loads.length } }, session);
  }
  return done;
}

// ───────────────────────────── expenses ─────────────────────────────

export type ExpenseRequest = {
  expenseType: string; amount: number; currency: string; description?: string | null;
  payeeType: "external_agent" | "internal_branch" | "internal_agent" | "other";
  payeeAgentId?: string | null; payeeName?: string | null; payeeCountryBranchId?: string | null; payeeCityBranchId?: string | null;
};
const EXPENSE_TYPES = ["transport", "port", "customs", "clearing", "detention", "handling", "other"];

export async function addExpense(session: ErpSession, loadId: string, req: ExpenseRequest) {
  if (!EXPENSE_TYPES.includes(req.expenseType)) throw fail("Unknown expense type.", "BAD_EXPENSE_TYPE");
  if (!(Number(req.amount) >= 0) || !Number.isFinite(Number(req.amount))) throw fail("Enter a valid amount.", "BAD_AMOUNT");
  if (!/^[A-Za-z]{3}$/.test(req.currency || "")) throw fail("Enter a 3-letter currency code.", "BAD_CURRENCY");
  const settlement = req.payeeType === "internal_branch" ? "inter_branch" : req.payeeType === "other" ? "none" : "agent_payable";
  return withLocalPg(async (sql: Sql) =>
    sql.begin(async (tx: Sql) => {
      const l = await loadForUpdate(tx, session, loadId);
      const row = (await tx`
        insert into public.purchase_lane_expenses (lane_load_id, purchase_order_id, source_type, source_id, bl_number, container_number,
          expense_type, description, amount, currency, payee_type, payee_agent_id, payee_name, payee_country_branch_id, payee_city_branch_id, settlement, status, created_by)
        values (${loadId}::uuid, ${l.purchase_order_id}, ${l.source_type}, ${l.source_id}::uuid, ${l.bl_number}, ${l.container_number},
          ${req.expenseType}, ${req.description ?? null}, ${Number(req.amount)}, ${req.currency.toUpperCase()}, ${req.payeeType}, ${req.payeeAgentId ?? null}, ${req.payeeName ?? null},
          ${req.payeeCountryBranchId ?? null}, ${req.payeeCityBranchId ?? null}, ${settlement}, 'draft', ${session.userId}::uuid)
        returning *`)[0];
      await addEvent(tx, l, { type: "expense_added", detail: { expenseId: row.id, type: req.expenseType, amount: Number(req.amount), currency: req.currency.toUpperCase(), settlement } }, session);
      return row;
    })
  );
}

export async function advanceExpense(session: ErpSession, expenseId: string, action: "review" | "confirm" | "cancel") {
  return withLocalPg(async (sql: Sql) =>
    sql.begin(async (tx: Sql) => {
      const e = (await tx`select * from public.purchase_lane_expenses where id = ${expenseId}::uuid and deleted_at is null for update`)[0];
      if (!e) throw fail("Expense not found.", "NOT_FOUND", 404);
      const l = await loadForUpdate(tx, session, e.lane_load_id);
      if (action === "review") {
        if (e.status !== "draft") throw fail("Only a draft expense can be reviewed.", "BAD_STATE");
        await tx`update public.purchase_lane_expenses set status = 'reviewed', reviewed_by = ${session.userId}::uuid, reviewed_at = now(), updated_at = now() where id = ${expenseId}::uuid`;
        await addEvent(tx, l, { type: "expense_reviewed", detail: { expenseId } }, session);
        return { id: expenseId, status: "reviewed" };
      }
      if (action === "cancel") {
        if (e.status === "confirmed" && e.bill_expense_line_id) throw fail("A confirmed expense that already has a bill line cannot be cancelled here — void it in Bill Expenses.", "BAD_STATE");
        await tx`update public.purchase_lane_expenses set status = 'cancelled', updated_at = now() where id = ${expenseId}::uuid`;
        await addEvent(tx, l, { type: "expense_cancelled", detail: { expenseId } }, session);
        return { id: expenseId, status: "cancelled" };
      }
      // confirm — only a REVIEWED expense; an agent payable is created (UNPOSTED) only now
      if (e.status !== "reviewed") throw fail("Review the expense before confirming it.", "REVIEW_FIRST");
      let billLineId: string | null = null;
      let billId: string | null = null;
      let registerMissing = false;
      if (e.settlement === "agent_payable") {
        const srcModule = e.source_type === "local_purchase" ? "local_purchase" : "purchase_booking";
        const srcId = e.source_type === "local_purchase" ? e.source_id : e.purchase_order_id;
        const header = srcId ? (await tx`select id from public.bill_expenses where source_module = ${srcModule} and source_id = ${srcId}::uuid and deleted_at is null limit 1`)[0] : null;
        if (header) {
          billId = header.id;
          const serial = num((await tx`select coalesce(max(row_serial),0) m from public.bill_expense_lines where bill_expense_id = ${header.id}::uuid`)[0]?.m) + 1;
          const details = `Purchase Lane · ${e.expense_type}${e.description ? " · " + e.description : ""} · BL ${e.bl_number || "-"} · Container ${e.container_number || "-"} · payee ${e.payee_name || "agent"}`;
          const line = (await tx`
            insert into public.bill_expense_lines (bill_expense_id, row_serial, expense_type, details, currency, amount, exchange_rate, local_amount, tax_pct, tax_amount, grand_amount, posting_status, created_by)
            values (${header.id}::uuid, ${serial}, ${e.expense_type}, ${details}, ${e.currency}, ${e.amount}, 1, ${e.amount}, 0, 0, ${e.amount}, 'unposted', ${session.userId}::uuid)
            returning id`)[0];
          billLineId = line.id;
          await tx`update public.bill_expenses set expense_total = coalesce(expense_total,0) + ${e.amount}, expense_count = coalesce(expense_count,0) + 1, updated_at = now() where id = ${header.id}::uuid`;
        } else registerMissing = true;
      }
      await tx`update public.purchase_lane_expenses set status = 'confirmed', confirmed_by = ${session.userId}::uuid, confirmed_at = now(), bill_expense_line_id = ${billLineId}, bill_expense_id = ${billId}, updated_at = now() where id = ${expenseId}::uuid`;
      await addEvent(tx, l, { type: "expense_confirmed", detail: { expenseId, settlement: e.settlement, billExpenseLineId: billLineId, registerMissing, posted: false } }, session);
      return { id: expenseId, status: "confirmed", settlement: e.settlement, billExpenseLineId: billLineId, registerMissing };
    })
  );
}

/** Lane stock + payables snapshot for a purchase: loaded vs remaining quantity, lane vs warehouse stock — and the (untouched) payable. */
export async function purchaseLaneSummary(session: ErpSession, purchaseOrderId: string) {
  return withLocalPg(async (sql: Sql) => {
    const loads = await sql`select * from public.purchase_lane_loads l where l.purchase_order_id = ${purchaseOrderId}::uuid and l.deleted_at is null and ${laneScopeSql(sql, session, "l")}`;
    const po = (await sql`select order_total, advance_paid, remaining_paid, remaining_due, credit_amount, payment_status, form_data from public.purchase_orders where id = ${purchaseOrderId}::uuid`)[0];
    const wf = po?.form_data?.workflow ?? {};
    return {
      loads: loads.length,
      laneStockQty: loads.filter((x: any) => x.lane_status !== "completed").reduce((a: number, x: any) => a + num(x.lane_stock_qty), 0),
      loadedQuantity: num(wf.loadedQuantity),
      remainingToLoad: remainingToLoad(num(wf.totalQuantity), num(wf.loadedQuantity)),
      finalPurchaseCompleted: Boolean(wf.finalPurchaseCompleted),
      payable: po ? { orderTotal: num(po.order_total), advancePaid: num(po.advance_paid), remainingPaid: num(po.remaining_paid), remainingDue: num(po.remaining_due), paymentStatus: po.payment_status } : null,
    };
  });
}

export { isFinalDisposition };
