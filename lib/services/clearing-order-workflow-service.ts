/* eslint-disable @typescript-eslint/no-explicit-any */
// Phase 2: Shipping / Clearing pipeline workflow — orchestrates the EXISTING
// clearing_customer_orders / clearing_customer_order_legs model through its
// operational stages, reusing:
//   - the existing per-leg truck/customs/shipping-line columns (no new order,
//     no new shipment identity — same order_id, same leg row throughout),
//   - the existing user_tasks work-order engine for truck-task assignment
//     (lib/user-tasks/service.ts createTask — the SAME system behind
//     /dashboard/user-tasks; not a second task system),
//   - the Phase 1 canonical Transfer & Handover Center
//     (lib/services/inter-country-transfer-service.ts createHandoverTransfer)
//     for cross-branch/cross-country handoffs.
//
// A "stage" here is the leg's/order's position in:
//   booking -> truck_assignment -> goods_verification -> loading ->
//   customs_clearing -> shipment_bl -> handover -> destination_review ->
//   completed
// Advancing stage never creates a new order/leg row — it only updates
// clearing_customer_order_legs.stage (+ mirrors to clearing_customer_orders.
// current_stage/current_leg_id) and appends an erp_activity_events row for
// the audit trail (the same activity-log table already used elsewhere in
// this codebase — not a new history table).

import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import type { ErpSession } from "@/lib/auth/session";
import { createTask } from "@/lib/user-tasks/service";
import {
  createHandoverTransfer,
  acceptHandover,
  returnTransferForCorrection,
  rejectInterCountryTransfer,
  completeHandover,
} from "@/lib/services/inter-country-transfer-service";

export const LEG_STAGES = [
  "booking",
  "truck_assignment",
  "goods_verification",
  "loading",
  "customs_clearing",
  "shipment_bl",
  "handover",
  "destination_review",
  "completed",
] as const;
export type LegStage = (typeof LEG_STAGES)[number];

type LegRow = {
  id: string;
  order_id: string;
  leg_no: number;
  from_country_id: string | null;
  to_country_id: string | null;
  responsible_country_branch_id: string | null;
  responsible_city_branch_id: string | null;
  responsible_clearing_agent_id: string | null;
  responsible_user_id: string | null;
  transport_mode: string | null;
  stage: LegStage;
  current_task_id: string | null;
  transfer_center_id: string | null;
};

async function loadLegWithOrder(legId: string) {
  return withLocalPg(async (sql) => {
    const rows = (await sql`
      select l.*, o.order_no, o.customer_name, o.status as order_status,
             o.country_id as order_country_id, o.country_branch_id as order_country_branch_id,
             o.city_branch_id as order_city_branch_id
      from public.clearing_customer_order_legs l
      join public.clearing_customer_orders o on o.id = l.order_id and o.deleted_at is null
      where l.id = ${legId}::uuid and l.deleted_at is null
      limit 1
    `) as unknown as any[];
    return rows[0] ?? null;
  });
}

function legInSessionScope(session: ErpSession, leg: any): boolean {
  if (session.isSuperAdmin) return true;
  const countryIds = session.countryIds ?? [];
  const countryBranchIds = session.countryBranchIds ?? [];
  const cityBranchIds = session.cityBranchIds ?? [];
  return (
    (leg.responsible_city_branch_id && cityBranchIds.includes(leg.responsible_city_branch_id)) ||
    (leg.responsible_country_branch_id && countryBranchIds.includes(leg.responsible_country_branch_id)) ||
    (leg.order_city_branch_id && cityBranchIds.includes(leg.order_city_branch_id)) ||
    (leg.order_country_branch_id && countryBranchIds.includes(leg.order_country_branch_id)) ||
    (leg.order_country_id && countryIds.includes(leg.order_country_id)) ||
    (leg.from_country_id && countryIds.includes(leg.from_country_id)) ||
    (leg.to_country_id && countryIds.includes(leg.to_country_id)) ||
    false
  );
}

async function logActivity(session: ErpSession, action: string, legId: string, orderId: string, countryId: string | null, metadata: Record<string, unknown>) {
  try {
    await withLocalPg(async (sql) => {
      await sql`
        insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, metadata)
        values (
          ${session.userId}, ${action}, 'shipping_clearing_pipeline', 'clearing_customer_order_legs', ${legId}::uuid,
          ${countryId}::uuid,
          ${JSON.stringify({ orderId, ...metadata })}::jsonb
        )`;
    });
  } catch {
    // audit logging never blocks the operation
  }
}

async function setLegStage(legId: string, orderId: string, stage: LegStage) {
  await withLocalPg(async (sql) => {
    await sql`
      update public.clearing_customer_order_legs
      set stage = ${stage}, stage_updated_at = now(), updated_at = now()
      where id = ${legId}::uuid`;
    await sql`
      update public.clearing_customer_orders
      set current_stage = ${stage}, current_leg_id = ${legId}::uuid, updated_at = now()
      where id = ${orderId}::uuid`;
  });
}

// ─── 1. TRUCK / TRANSPORT ASSIGNMENT ──────────────────────────────────────────
// Sets the leg's own truck fields (the leg, not the whole shipment, owns the
// truck — a shipment with multiple road legs can have a different truck per
// leg) and creates a REAL user_tasks work order assigned to the driver/
// responsible user, exactly the same task engine /dashboard/user-tasks uses.

export async function assignLegTruckTask(
  session: ErpSession,
  input: {
    legId: string;
    truckId?: string | null;
    truckRegistrationType: "registered" | "temporary";
    truckNumber: string;
    truckDriverName?: string | null;
    truckDriverMobile?: string | null;
    assignedUserId: string;
    dueAt?: string | null;
    instructions?: string | null;
  }
) {
  const leg = await loadLegWithOrder(input.legId);
  if (!leg) throw new ApiClientError("Leg not found.", { status: 404 });
  if (!legInSessionScope(session, leg)) {
    throw new ApiClientError("This leg is outside your scope.", { status: 403 });
  }

  // Cross-border road movement requires a REGISTERED truck (existing rule —
  // see [[truck-registration-erp-wide]]); a local short movement may still use
  // a temporary truck if the leg allows it (from_country_id === to_country_id).
  const isCrossBorder = Boolean(leg.from_country_id && leg.to_country_id && leg.from_country_id !== leg.to_country_id);
  if (isCrossBorder && input.truckRegistrationType !== "registered") {
    throw new ApiClientError(
      "Cross-border road movement requires a registered truck. Register the truck first or select an existing registered truck.",
      { status: 400, code: "TRUCK_REGISTRATION_REQUIRED" }
    );
  }
  if (input.truckRegistrationType === "registered" && !input.truckId) {
    throw new ApiClientError("Select a registered truck.", { status: 400 });
  }

  await withLocalPg(async (sql) => {
    await sql`
      update public.clearing_customer_order_legs
      set truck_id = ${input.truckId ?? null},
          truck_registration_type = ${input.truckRegistrationType},
          truck_number = ${input.truckNumber},
          truck_driver_name = ${input.truckDriverName ?? null},
          truck_driver_mobile = ${input.truckDriverMobile ?? null},
          responsible_user_id = ${input.assignedUserId},
          updated_at = now()
      where id = ${input.legId}::uuid`;
  });

  const { id: taskId, taskNo } = await createTask(session, {
    title: `Truck task — ${leg.order_no} leg ${leg.leg_no} (${input.truckNumber})`,
    description: `Transport assignment for order ${leg.order_no}, leg ${leg.leg_no} (${leg.from_country_id ?? "?"} -> ${leg.to_country_id ?? "?"}). Truck ${input.truckNumber}.`,
    instructions: input.instructions ?? null,
    assignedTo: input.assignedUserId,
    countryId: leg.order_country_id ?? null,
    countryBranchId: leg.responsible_country_branch_id ?? leg.order_country_branch_id ?? null,
    cityBranchId: leg.responsible_city_branch_id ?? leg.order_city_branch_id ?? null,
    relatedModule: "shipping",
    relatedRecordTable: "clearing_customer_order_legs",
    relatedRecordId: input.legId,
    relatedRecordLabel: `${leg.order_no} — Leg ${leg.leg_no}`,
    relatedRoute: `/dashboard/clearing-agent/customer-order/${leg.order_id}/workflow`,
    priority: "high",
    dueAt: input.dueAt ?? null,
  });

  await withLocalPg(async (sql) => {
    await sql`update public.clearing_customer_order_legs set current_task_id = ${taskId}::uuid where id = ${input.legId}::uuid`;
  });

  await setLegStage(input.legId, leg.order_id, "truck_assignment");
  await logActivity(session, "truck_assigned", input.legId, leg.order_id, leg.order_country_id, { taskId, taskNo, truckNumber: input.truckNumber, assignedUserId: input.assignedUserId });

  return { taskId, taskNo };
}

// ─── 2. GOODS VERIFICATION ─────────────────────────────────────────────────

export async function recordGoodsVerification(
  session: ErpSession,
  input: {
    orderId: string;
    legId?: string | null;
    bookedQuantity?: number | null;
    bookedUnit?: string | null;
    bookedCartons?: number | null;
    bookedGrossWeight?: number | null;
    bookedNetWeight?: number | null;
    verifiedQuantity?: number | null;
    verifiedUnit?: string | null;
    verifiedCartons?: number | null;
    verifiedGrossWeight?: number | null;
    verifiedNetWeight?: number | null;
    warehouseId?: string | null;
    loadingSourceText?: string | null;
    supportingDocument?: string | null;
    result: "verified" | "discrepancy" | "returned";
    discrepancyNotes?: string | null;
  }
) {
  const order = await withLocalPg(async (sql) => {
    const rows = (await sql`select * from public.clearing_customer_orders where id = ${input.orderId}::uuid and deleted_at is null limit 1`) as unknown as any[];
    return rows[0] ?? null;
  });
  if (!order) throw new ApiClientError("Order not found.", { status: 404 });
  if (!session.isSuperAdmin) {
    const inScope =
      (order.city_branch_id && (session.cityBranchIds ?? []).includes(order.city_branch_id)) ||
      (order.country_branch_id && (session.countryBranchIds ?? []).includes(order.country_branch_id)) ||
      (order.country_id && (session.countryIds ?? []).includes(order.country_id));
    if (!inScope) throw new ApiClientError("This order is outside your scope.", { status: 403 });
  }
  if (input.result === "discrepancy" && !input.discrepancyNotes?.trim()) {
    throw new ApiClientError("Discrepancy notes are required when reporting a discrepancy.", { status: 400 });
  }

  const row = await withLocalPg(async (sql) => {
    const r = await sql`
      insert into public.clearing_customer_order_goods_verifications (
        order_id, leg_id,
        booked_quantity, booked_unit, booked_cartons, booked_gross_weight, booked_net_weight,
        verified_quantity, verified_unit, verified_cartons, verified_gross_weight, verified_net_weight,
        warehouse_id, loading_source_text, supporting_document,
        result, discrepancy_notes, verified_by, verified_at,
        country_id, country_branch_id, city_branch_id, created_by
      ) values (
        ${input.orderId}::uuid, ${input.legId ?? null}::uuid,
        ${input.bookedQuantity ?? order.goods_quantity ?? null}, ${input.bookedUnit ?? order.goods_unit ?? null},
        ${input.bookedCartons ?? order.goods_bags_cartons ?? null},
        ${input.bookedGrossWeight ?? order.goods_gross_weight ?? null}, ${input.bookedNetWeight ?? order.goods_net_weight ?? null},
        ${input.verifiedQuantity ?? null}, ${input.verifiedUnit ?? null}, ${input.verifiedCartons ?? null},
        ${input.verifiedGrossWeight ?? null}, ${input.verifiedNetWeight ?? null},
        ${input.warehouseId ?? null}, ${input.loadingSourceText ?? null}, ${input.supportingDocument ?? null},
        ${input.result}, ${input.discrepancyNotes ?? null}, ${session.userId}, now(),
        ${order.country_id ?? null}, ${order.country_branch_id ?? null}, ${order.city_branch_id ?? null}, ${session.userId}
      )
      returning id`;
    return r[0];
  });

  const rowId = (row as any).id as string;

  if (input.legId && input.result !== "returned") {
    await setLegStage(input.legId, input.orderId, input.result === "verified" ? "goods_verification" : "goods_verification");
  }

  await logActivity(session, `goods_verification_${input.result}`, input.legId ?? input.orderId, input.orderId, order.country_id, {
    verificationId: rowId,
    discrepancyNotes: input.discrepancyNotes ?? null,
  });

  return { id: rowId };
}

// ─── 3. HANDOFF — creates a Phase 1 Transfer & Handover Center row ────────────

export async function createLegHandoff(
  session: ErpSession,
  input: {
    legId: string;
    toCountryId: string;
    toCountryBranchId?: string | null;
    toCityBranchId?: string | null;
    narration?: string | null;
  }
) {
  const leg = await loadLegWithOrder(input.legId);
  if (!leg) throw new ApiClientError("Leg not found.", { status: 404 });
  if (!legInSessionScope(session, leg)) {
    throw new ApiClientError("This leg is outside your scope.", { status: 403 });
  }
  if (leg.transfer_center_id) {
    const open = await withLocalPg(async (sql) => {
      const r = (await sql`select status from public.inter_country_transfers where id = ${leg.transfer_center_id}::uuid`) as unknown as any[];
      return r[0] ?? null;
    });
    if (open && !["accepted", "completed", "rejected", "resubmitted"].includes(open.status)) {
      throw new ApiClientError("This leg already has an open handoff pending a decision.", { status: 409, code: "HANDOFF_ALREADY_OPEN" });
    }
  }

  const sourceCountryId = leg.from_country_id || leg.order_country_id;
  if (!sourceCountryId) throw new ApiClientError("The leg's source country could not be resolved.", { status: 400 });

  const { id, transferNo } = await createHandoverTransfer({
    session,
    transferType: "shipping_handover",
    sourceCountryId,
    sourceCountryBranchId: leg.responsible_country_branch_id ?? leg.order_country_branch_id ?? null,
    sourceCityBranchId: leg.responsible_city_branch_id ?? leg.order_city_branch_id ?? null,
    destCountryId: input.toCountryId,
    destCountryBranchId: input.toCountryBranchId ?? null,
    destCityBranchId: input.toCityBranchId ?? null,
    sourceTable: "clearing_customer_order_legs",
    sourceId: input.legId,
    narration: input.narration ?? `${leg.order_no} — Leg ${leg.leg_no} handoff`,
    orderReference: leg.order_no,
    customerPartyName: leg.customer_name,
    blNumber: null,
    metadata: {
      orderId: leg.order_id,
      orderNo: leg.order_no,
      legId: leg.id,
      legNo: leg.leg_no,
      customerName: leg.customer_name,
      transportMode: leg.transport_mode,
    },
  });

  await withLocalPg(async (sql) => {
    await sql`update public.clearing_customer_order_legs set transfer_center_id = ${id}::uuid, updated_at = now() where id = ${input.legId}::uuid`;
  });
  await setLegStage(input.legId, leg.order_id, "handover");
  await logActivity(session, "handoff_sent", input.legId, leg.order_id, sourceCountryId, { transferId: id, transferNo, toCountryId: input.toCountryId });

  return { id, transferNo };
}

// ─── 4. STAGE ADVANCE (same-branch transitions, no handoff needed) ───────────

export async function advanceLegStage(session: ErpSession, input: { legId: string; stage: LegStage }) {
  const leg = await loadLegWithOrder(input.legId);
  if (!leg) throw new ApiClientError("Leg not found.", { status: 404 });
  if (!legInSessionScope(session, leg)) {
    throw new ApiClientError("This leg is outside your scope.", { status: 403 });
  }
  await setLegStage(input.legId, leg.order_id, input.stage);
  await logActivity(session, "stage_advanced", input.legId, leg.order_id, leg.order_country_id, { stage: input.stage });
  return { stage: input.stage };
}

// ─── 5. SYNC HOOK — called by the Transfer Center API after accept/return/  ──
// reject/resubmit/complete on a transfer whose source is a clearing leg, so
// the Transfer Center's generic engine and the leg's own stage/responsible
// fields never drift apart. Registered as a dispatcher keyed by source_table
// so future transfer types (truck_task, goods_verification, ...) can add
// their own hook here without touching the generic Phase 1 engine.

export async function syncLegFromTransferAction(
  session: ErpSession,
  transferRow: { id: string; source_table: string | null; source_id: string | null; status: string; dest_country_branch_id: string | null; dest_city_branch_id: string | null }
) {
  if (transferRow.source_table !== "clearing_customer_order_legs" || !transferRow.source_id) return;
  const legId = transferRow.source_id;
  const leg = await loadLegWithOrder(legId);
  if (!leg) return;

  if (transferRow.status === "accepted") {
    // The destination office now owns this leg — move responsibility + stage.
    await withLocalPg(async (sql) => {
      await sql`
        update public.clearing_customer_order_legs
        set responsible_country_branch_id = coalesce(${transferRow.dest_country_branch_id}::uuid, responsible_country_branch_id),
            responsible_city_branch_id = coalesce(${transferRow.dest_city_branch_id}::uuid, responsible_city_branch_id),
            responsible_user_id = ${session.userId}::uuid,
            updated_at = now()
        where id = ${legId}::uuid`;
    });
    await setLegStage(legId, leg.order_id, "destination_review");
  } else if (transferRow.status === "completed") {
    await setLegStage(legId, leg.order_id, "completed");
  } else if (transferRow.status === "returned") {
    // Stays visible at the sender's side for correction; stage steps back to
    // the last working stage so it re-enters the operational queue, not the
    // handover queue.
    await setLegStage(legId, leg.order_id, "loading");
  }

  await logActivity(session, `transfer_${transferRow.status}`, legId, leg.order_id, leg.order_country_id, { transferId: transferRow.id });
}

export { acceptHandover, returnTransferForCorrection, rejectInterCountryTransfer, completeHandover };
