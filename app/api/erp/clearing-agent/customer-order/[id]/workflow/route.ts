/* eslint-disable @typescript-eslint/no-explicit-any */
// Unified Operational Workflow API for Customer Order Stages 1A -> 1B -> 1C
// Reuses existing database tables and models:
// clearing_customer_orders, clearing_customer_order_legs,
// clearing_customer_order_goods_verifications, clearing_customer_order_loading_allocations,
// inter_country_transfers, user_tasks, user_task_notifications, erp_activity_events.
// Single Order ID and serials throughout all stages.

export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, rethrowIfNextControlFlow, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";
import { getCustomerOrderById } from "@/lib/services/clearing-customer-order-service";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import {
  TEMP_TRUCK_MESSAGE,
  isTruckPlaceholder,
  mergeTruckDetails,
  parseJsonObject,
  readGoodsItem,
  stage1bMissing,
  temporaryTruckProblems,
  validateGoodsItems
} from "@/lib/services/clearing-customer-order-workflow-rules";

// Response envelope. Every browser caller of this endpoint (confirm truck, complete goods,
// stage assignment, return-for-correction, activity timeline) tests `json.success` and shows
// `json.error` as text. The generic apiOk() envelope is { ok, data } and apiError() puts an
// OBJECT in `error`, so a request the server had fully committed was reported to the user as
// "Failed to confirm truck" / "Failed to complete goods entry". Keep both flags and a plain
// string `error` so old and new callers agree.
function wfOk(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, ok: true, data });
}

async function wfFail(error: unknown) {
  rethrowIfNextControlFlow(error);
  const res = await handleApiError(error);
  const body = await res.clone().json().catch(() => null);
  const message = body?.error?.message || (error as Error)?.message || "Request failed";
  return NextResponse.json(
    { success: false, ok: false, error: message, code: body?.error?.code, details: body?.error?.details },
    { status: res.status }
  );
}

function generateTransferNo() {
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TRF-${d}-${rnd}`;
}

function generateGlobalRefId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "", part2 = "";
  for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
  return `DGT-TRF-${part1}-${part2}`;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { id } = await ctx.params;
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const order = await getCustomerOrderById(id);
    if (!order) throw new ApiClientError("Order not found.", { status: 404 });

    // Same access rule as the order's own GET/PATCH routes (scope, clearing-agent, creator, or the
    // user the order was handed over to) — the stage workflow must not be stricter or looser.
    if (!canAccessOrder(session, order)) throw new ApiClientError("This order is outside your scope.", { status: 403 });

    const legIds = ((order as any).legs || []).map((l: any) => l.id);

    const [verifications, transfers, activityEvents, creatorProfile] = await Promise.all([
      withLocalPg(async (sql) => {
        const rows = (await sql`
          select v.*, p.full_name as verified_by_name
          from public.clearing_customer_order_goods_verifications v
          left join public.profiles p on p.id = v.verified_by
          where v.order_id = ${id}::uuid and v.deleted_at is null
          order by v.created_at desc
        `) as unknown as any[];
        return rows;
      }),
      withLocalPg(async (sql) => {
        const rows = (await sql`
          select t.id, t.transfer_no, t.transfer_type, t.status, t.source_id, t.dest_country_id, t.dest_country_branch_id,
                 t.dest_city_branch_id, t.created_at, t.accepted_at, t.completed_at, t.return_reason, t.rejection_reason,
                 t.narration, t.remarks, t.metadata, t.sender_user_id, t.receiver_user_id,
                 sp.full_name as sender_name, rp.full_name as receiver_name,
                 scb.name as source_branch_name, dcb.name as dest_branch_name
          from public.inter_country_transfers t
          left join public.profiles sp on sp.id = t.sender_user_id
          left join public.profiles rp on rp.id = t.receiver_user_id
          left join public.country_branches scb on scb.id = t.source_country_branch_id
          left join public.country_branches dcb on dcb.id = t.dest_country_branch_id
          where (
            (t.source_table = 'clearing_customer_order_legs' and t.source_id = any(${legIds.length ? legIds : ['00000000-0000-0000-0000-000000000000']}::uuid[]))
            or (t.source_table = 'clearing_customer_orders' and t.source_id = ${id}::uuid)
            or t.order_reference = ${(order as any).order_no}
          ) and t.deleted_at is null
          order by t.created_at desc
        `) as unknown as any[];
        return rows;
      }),
      withLocalPg(async (sql) => {
        const rows = (await sql`
          select e.id, e.actor_id, e.action, e.resource, e.record_table, e.record_id, e.metadata, e.created_at,
                 p.full_name as actor_name
          from public.erp_activity_events e
          left join public.profiles p on p.id = e.actor_id
          where (e.record_table = 'clearing_customer_orders' and e.record_id = ${id}::uuid)
             or (e.metadata->>'orderId' = ${id})
          order by e.created_at asc
        `) as unknown as any[];
        return rows;
      }),
      withLocalPg(async (sql) => {
        if (!(order as any).created_by) return null;
        const [p] = await sql`select full_name from public.profiles where id = ${(order as any).created_by}::uuid limit 1`;
        return p?.full_name || null;
      })
    ]);

    // Build unified chronological activity timeline
    const timeline: any[] = [];

    // 1. Initial Order Creation
    timeline.push({
      id: `created-${order.id}`,
      stage: "1A",
      stageName: "Stage 1A — Order & Route Setup",
      action: "Order Created & Registered",
      actorName: creatorProfile || (order as any).customer_name || "User",
      countryName: (order as any).loading_country_name || (order as any).country_name || "",
      branchName: (order as any).branch_name || "",
      createdAt: (order as any).created_at,
      status: "completed",
      notes: (order as any).remarks || `Customer Order ${(order as any).order_no} initialized with route ${(order as any).route_name || "Direct"}.`
    });

    // 2. Transfers & Handovers
    for (const tr of (transfers || [])) {
      const meta = parseJsonObject(tr.metadata);
      const is1B = tr.transfer_type === "truck_task" || meta.stage === "1B";
      const is1C = tr.transfer_type === "goods_verification" || meta.stage === "1C";
      const stg = is1C ? "1C" : is1B ? "1B" : "1A";
      const stageTitle = is1C
        ? "Stage 1C — Goods Entry"
        : is1B
        ? "Stage 1B — Truck Confirmation"
        : "Stage 1A — Order Handover";

      let actionTitle = `Assigned to ${tr.receiver_name || "User"}`;
      if (tr.status === "returned") {
        actionTitle = `Returned for Correction to ${tr.receiver_name || "User"}`;
      } else if (tr.status === "completed") {
        actionTitle = `Completed by ${tr.receiver_name || tr.sender_name || "User"}`;
      } else if (tr.status === "accepted") {
        actionTitle = `Accepted by ${tr.receiver_name || "User"}`;
      }

      timeline.push({
        id: tr.id,
        stage: stg,
        stageName: stageTitle,
        action: actionTitle,
        actorName: tr.sender_name || "Assigning User",
        targetUserName: tr.receiver_name || "Assigned User",
        countryName: tr.dest_country_name || "",
        branchName: tr.dest_branch_name || tr.source_branch_name || "",
        createdAt: tr.created_at,
        status: tr.status,
        returnReason: tr.return_reason || null,
        notes: tr.narration || tr.remarks || meta.requestedTask || null
      });
    }

    // 3. Activity events (Truck confirmations, Goods additions, etc.)
    for (const ev of (activityEvents || [])) {
      const meta = parseJsonObject(ev.metadata);
      const actionName = ev.action || "";
      if (actionName.includes("assigned") && (transfers || []).some((t) => t.created_at === ev.created_at)) {
        continue; // deduplicate
      }

      let stg = meta.stage || "1A";
      let stageTitle = "Stage 1A — Order Setup";
      let actionTitle = meta.actionText || actionName;

      if (actionName === "truck_confirmed" || meta.stage === "1B") {
        stg = "1B";
        stageTitle = "Stage 1B — Truck & Transport Confirmation";
        actionTitle = `Truck Confirmed (${meta.truckNumber || (order as any).truck_number || "Verified"})`;
      } else if (actionName === "stage_1c_completed" || actionName === "goods_completed" || meta.stage === "1C") {
        stg = "1C";
        stageTitle = "Stage 1C — Goods Entry";
        actionTitle = `Goods Entry Completed (${meta.totalItems || 1} items, ${meta.totalNetWeight || 0} kg net)`;
      } else if (actionName === "returned_for_correction") {
        actionTitle = `Returned for Correction: ${meta.reason || (order as any).rejected_reason || ""}`;
      }

      timeline.push({
        id: ev.id,
        stage: stg,
        stageName: stageTitle,
        action: actionTitle,
        actorName: ev.actor_name || meta.confirmedBy || meta.completedBy || "User",
        createdAt: ev.created_at,
        status: actionName.includes("return") ? "returned" : "completed",
        returnReason: meta.reason || null,
        notes: meta.instructions || meta.notes || null
      });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let localizedOrder: any = order;
    try {
      const [loc] = await localizeRecordFields<any>(
        [order as any],
        "clearing_customer_orders",
        ["customer_name", "route_name", "cargo_details", "remarks", "goods_name", "exporter_name", "importer_name", "buyer_name", "notify_party_name", "consignee_name"],
        lang
      );
      localizedOrder = loc ?? order;
    } catch {
      // keep the original record if localization is unavailable
    }

    return wfOk({ order: localizedOrder, verifications, transfers, timeline });
  } catch (error) {
    return wfFail(error);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    // Confirming a truck / completing goods / handing over / returning an order WRITES the order, so it
    // needs the same shipping_records:update permission the order PATCH route already requires.
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const { id } = await ctx.params;
    const body = await request.json();
    const { action } = body;

    const order = await getCustomerOrderById(id);
    if (!order) throw new ApiClientError("Order not found.", { status: 404 });

    // Authorization & Scope check (identical to the order PATCH route)
    if (!canAccessOrder(session, order)) throw new ApiClientError("This order is outside your scope.", { status: 403 });

    const now = new Date().toISOString();

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. STAGE 1A COMPLETION — ASSIGN TO ANOTHER USER (STAGE 1B TRUCK CONFIRMATION)
    // ─────────────────────────────────────────────────────────────────────────────
    if (action === "handover_1a") {
      const { toUserId, toCountryId, toCountryBranchId, toCityBranchId, instructions, dueDate } = body;
      if (!toUserId) throw new ApiClientError("Assignee user is required.", { status: 400 });

      const targetCountryId = toCountryId || (order as any).country_id || (session.countryIds ?? [])[0];
      if (!targetCountryId) throw new ApiClientError("Target country is required.", { status: 400 });

      const transferNo = generateTransferNo();
      const globalRefId = generateGlobalRefId();

      await withLocalPg(async (sql) => {
        // Update customer order status and current_stage
        await sql`
          update public.clearing_customer_orders
          set current_stage = case when status in ('truck_confirmed','completed') then current_stage else 'truck_assignment' end,
              status = case when status in ('truck_confirmed','completed') then status else 'booking_confirmed' end,
              updated_at = now()
          where id = ${id}::uuid
        `;

        // Insert into inter_country_transfers
        await sql`
          insert into public.inter_country_transfers (
            transfer_no, transfer_type, source_table, source_id,
            source_country_id, source_country_branch_id, source_city_branch_id,
            dest_country_id, dest_country_branch_id, dest_city_branch_id,
            narration, remarks, status, global_reference_id,
            sender_user_id, receiver_user_id, created_by,
            order_reference, customer_party_name, reference_date, claim_category,
            metadata
          ) values (
            ${transferNo}, 'truck_task', 'clearing_customer_orders', ${id}::uuid,
            ${(order as any).country_id || targetCountryId}::uuid,
            ${(order as any).country_branch_id ?? null}::uuid,
            ${(order as any).city_branch_id ?? null}::uuid,
            ${targetCountryId}::uuid,
            ${toCountryBranchId ?? null}::uuid,
            ${toCityBranchId ?? null}::uuid,
            ${instructions || 'Truck Confirmation Required'},
            ${instructions || null},
            'pending',
            ${globalRefId},
            ${session.userId},
            ${toUserId}::uuid,
            ${session.userId},
            ${(order as any).order_no},
            ${(order as any).customer_name},
            ${now.slice(0, 10)},
            'truck_task',
            ${sql.json({
              stage: '1B',
              orderNo: (order as any).order_no,
              assignedBy: session.fullName,
              dueDate: dueDate || null
            })}
          )
        `;

        // Insert into user_tasks for user inbox
        const taskRes = await sql`
          insert into public.user_tasks (
            task_no, title, description, instructions,
            country_id, country_branch_id, city_branch_id,
            department, created_by, assigned_to,
            related_module, related_record_table, related_record_id, related_record_label,
            related_route, priority, status, due_at, created_at, updated_at
          ) values (
            ${'TSK-' + Date.now().toString().slice(-6)},
            ${'Truck Confirmation Required — ' + (order as any).order_no},
            ${'Truck and transport confirmation for ' + (order as any).order_no + ' (' + (order as any).customer_name + ')'},
            ${instructions || null},
            ${targetCountryId}::uuid,
            ${toCountryBranchId ?? null}::uuid,
            ${toCityBranchId ?? null}::uuid,
            'Transport / Fleet',
            ${session.userId},
            ${toUserId}::uuid,
            'shipping',
            'clearing_customer_orders',
            ${id}::uuid,
            ${(order as any).order_no},
            ${'/dashboard/clearing-agent/customer-order?id=' + id},
            'high',
            'new',
            ${dueDate ? new Date(dueDate).toISOString() : null},
            now(), now()
          )
          returning id
        `;

        if (taskRes[0]?.id) {
          // Notification to the recipient
          await sql`
            insert into public.user_task_notifications (
              task_id, recipient_id, kind, title, is_read, created_at
            ) values (
              ${taskRes[0].id}::uuid,
              ${toUserId}::uuid,
              'assignment',
              ${'Order ' + (order as any).order_no + ' assigned to you: Truck Confirmation Required'},
              false, now()
            )
          `;
        }

        // Activity event
        await sql`
          insert into public.erp_activity_events (
            actor_id, action, resource, record_table, record_id, country_id, metadata
          ) values (
            ${session.userId}, 'stage_1a_assigned', 'shipping', 'clearing_customer_orders', ${id}::uuid,
            ${targetCountryId}::uuid,
            ${sql.json({
              stage: '1A',
              actionText: 'Stage 1A Setup Completed — Assigned to Another User',
              assignedToUserId: toUserId,
              instructions: instructions || null,
              date: now
            })}
          )
        `;
      });

      return wfOk({ success: true, message: `Order ${(order as any).order_no} assigned to user for Truck Confirmation.` });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. STAGE 1B — CONFIRM TRUCK (CONTINUE MYSELF OR ASSIGN TO GOODS USER)
    // ─────────────────────────────────────────────────────────────────────────────
    else if (action === "confirm_truck") {
      const {
        continueMyself,
        goodsAssignee,
        goodsAssigneeId,
        destCountryId,
        destCountryBranchId,
        destCityBranchId,
        instructions,
        dueDate,
        truckData
      } = body;

      const truckNumber = body.truckNumber || truckData?.truckNumber;
      const truckDriverName = body.truckDriverName || truckData?.truckDriverName;
      const truckDriverMobile = body.truckDriverMobile || truckData?.truckDriverMobile;
      const vehicleType = body.vehicleType || truckData?.vehicleType;
      const truckRegistrationType = body.truckRegistrationType || truckData?.truckRegistrationType;
      const truckTransportCompany = body.truckTransportCompany || truckData?.truckTransportCompany;
      const arrivalTime = body.arrivalTime || truckData?.arrivalTime;
      const loadingLocation = body.loadingLocation || truckData?.loadingLocation;
      const truckStatus = body.truckStatus || truckData?.truckStatus;
      const truckPhotos = body.truckPhotos || truckData?.truckPhotos;

      const effectiveAssigneeUserId = goodsAssignee?.userId || goodsAssigneeId;
      const effectiveCountryId = goodsAssignee?.countryId || destCountryId;
      const effectiveCountryBranchId = goodsAssignee?.countryBranchId || destCountryBranchId;
      const effectiveCityBranchId = goodsAssignee?.cityBranchId || destCityBranchId;
      const effectiveInstructions = goodsAssignee?.instructions || instructions;
      const effectiveDueDate = goodsAssignee?.dueDate || dueDate;

      if (!truckNumber || !String(truckNumber).trim()) {
        throw new ApiClientError("Truck Number is required.", { status: 400, code: "TRUCK_NUMBER_REQUIRED" });
      }
      if ((order as any).status === "completed") {
        throw new ApiClientError("This order is already completed; Stage 1B can no longer be changed.", { status: 409, code: "ORDER_ALREADY_COMPLETED" });
      }

      // A temporary / one-trip truck must carry all three mandatory details. (A permanent fleet
      // truck takes them from the Fleet Master; "Assign Later" is a placeholder, not a vehicle.)
      const isPermanentTruck = truckRegistrationType === "permanent" || truckRegistrationType === "registered";
      if (!isPermanentTruck && !isTruckPlaceholder(truckNumber)) {
        const problems = temporaryTruckProblems({ truckNumber, driverName: truckDriverName, driverMobile: truckDriverMobile });
        if (problems.length) {
          return NextResponse.json(
            { success: false, ok: false, error: TEMP_TRUCK_MESSAGE, code: "TEMP_TRUCK_INCOMPLETE", fields: problems },
            { status: 422 }
          );
        }
      }

      await withLocalPg(async (sql) => {
        // Complete any open 1B handover transfer
        await sql`
          update public.inter_country_transfers
          set status = 'completed', completed_at = now(), updated_at = now()
          where source_id = ${id}::uuid
            and source_table = 'clearing_customer_orders'
            and transfer_type = 'truck_task'
            and status in ('pending', 'accepted')
        `;

        // Complete any open 1B user task (user_tasks use new/accepted/in_progress/waiting — never 'pending')
        await sql`
          update public.user_tasks
          set status = 'completed', completed_at = now(), updated_at = now()
          where related_record_id = ${id}::uuid
            and related_record_table = 'clearing_customer_orders'
            and status in ('new', 'accepted', 'in_progress', 'waiting')
        `;

        // Update truck details (older rows hold this jsonb as JSON text — parseJsonObject accepts both)
        const existingDetails = parseJsonObject((order as any).truck_details);
        const updatedTruckDetails = {
          ...existingDetails,
          vehicleType: vehicleType || existingDetails.vehicleType || "Trailer",
          arrivalTime: arrivalTime || existingDetails.arrivalTime || null,
          loadingLocation: loadingLocation || existingDetails.loadingLocation || null,
          truckStatus: truckStatus || existingDetails.truckStatus || "At Gate",
          truckPhotos: (truckPhotos && truckPhotos.length ? truckPhotos : existingDetails.truckPhotos) || [],
          confirmedBy: session.userId,
          confirmedByName: session.fullName || "User",
          confirmedByBranch: (order as any).branch_name || session.countryBranchIds?.[0] || "Branch",
          confirmedAt: now,
          stage1bCompleted: true,
          stage1bCompletedAt: now
        };

        // A placeholder ("To be assigned") is not a vehicle, so it carries no registration type
        // (and can never trip the cross-border registered-truck rule on the legs).
        const effectiveRegType = isTruckPlaceholder(truckNumber)
          ? null
          : (truckRegistrationType === "permanent" || truckRegistrationType === "registered") ? "registered" : "temporary";

        await sql`
          update public.clearing_customer_orders
          set truck_number = ${truckNumber.trim()},
              truck_driver_name = ${truckDriverName?.trim() || null},
              truck_driver_mobile = ${truckDriverMobile?.trim() || null},
              truck_transport_company = ${truckTransportCompany?.trim() || null},
              truck_registration_type = ${effectiveRegType},
              truck_details = ${sql.json(updatedTruckDetails)},
              current_stage = 'goods_verification',
              status = 'truck_confirmed',
              updated_at = now()
          where id = ${id}::uuid
        `;

        if (continueMyself) {
          // Log Activity: Confirmed & continuing myself
          await sql`
            insert into public.erp_activity_events (
              actor_id, action, resource, record_table, record_id, country_id, metadata
            ) values (
              ${session.userId}, 'truck_confirmed', 'shipping', 'clearing_customer_orders', ${id}::uuid,
              ${(order as any).country_id}::uuid,
              ${sql.json({
                stage: '1B',
                actionText: 'Truck Confirmed — Self Execution (Continue to 1C)',
                truckNumber: truckNumber.trim(),
                driverName: truckDriverName?.trim() || null,
                confirmedBy: session.fullName,
                date: now
              })}
            )
          `;
        } else {
          // Assign to Goods User (Stage 1C)
          if (!effectiveAssigneeUserId) {
            throw new ApiClientError("Goods Entry assignee user is required when handing over.", { status: 400 });
          }

          const targetCountryId = effectiveCountryId || (order as any).country_id || (session.countryIds ?? [])[0];
          const transferNo = generateTransferNo();
          const globalRefId = generateGlobalRefId();

          await sql`
            insert into public.inter_country_transfers (
              transfer_no, transfer_type, source_table, source_id,
              source_country_id, source_country_branch_id, source_city_branch_id,
              dest_country_id, dest_country_branch_id, dest_city_branch_id,
              narration, remarks, status, global_reference_id,
              sender_user_id, receiver_user_id, created_by,
              order_reference, customer_party_name, reference_date, claim_category,
              metadata
            ) values (
              ${transferNo}, 'goods_verification', 'clearing_customer_orders', ${id}::uuid,
              ${(order as any).country_id || targetCountryId}::uuid,
              ${(order as any).country_branch_id ?? null}::uuid,
              ${(order as any).city_branch_id ?? null}::uuid,
              ${targetCountryId}::uuid,
              ${effectiveCountryBranchId ?? null}::uuid,
              ${effectiveCityBranchId ?? null}::uuid,
              ${effectiveInstructions || 'Truck Confirmed — Goods Entry Assigned to You'},
              ${effectiveInstructions || null},
              'pending',
              ${globalRefId},
              ${session.userId},
              ${effectiveAssigneeUserId}::uuid,
              ${session.userId},
              ${(order as any).order_no},
              ${(order as any).customer_name},
              ${now.slice(0, 10)},
              'goods_verification',
              ${sql.json({
                stage: '1C',
                orderNo: (order as any).order_no,
                assignedBy: session.fullName,
                truckNumber: String(truckNumber).trim(),
                dueDate: effectiveDueDate || null
              })}
            )
          `;

          // Insert user task for Goods user
          const taskRes = await sql`
            insert into public.user_tasks (
              task_no, title, description, instructions,
              country_id, country_branch_id, city_branch_id,
              department, created_by, assigned_to,
              related_module, related_record_table, related_record_id, related_record_label,
              related_route, priority, status, due_at, created_at, updated_at
            ) values (
              ${'TSK-' + Date.now().toString().slice(-6)},
              ${'Truck Confirmed — Goods Entry Assigned to You: ' + (order as any).order_no},
              ${'Enter goods manifest and verify cargo for order ' + (order as any).order_no + ' (' + (order as any).customer_name + ')'},
              ${effectiveInstructions || null},
              ${targetCountryId}::uuid,
              ${effectiveCountryBranchId ?? null}::uuid,
              ${effectiveCityBranchId ?? null}::uuid,
              'Warehouse / Cargo Operations',
              ${session.userId},
              ${effectiveAssigneeUserId}::uuid,
              'shipping',
              'clearing_customer_orders',
              ${id}::uuid,
              ${(order as any).order_no},
              ${'/dashboard/clearing-agent/customer-order?id=' + id},
              'high',
              'new',
              ${effectiveDueDate ? new Date(effectiveDueDate).toISOString() : null},
              now(), now()
            )
            returning id
          `;

          if (taskRes[0]?.id) {
            // Notification: "Truck Confirmed — Goods Entry Assigned to You"
            await sql`
              insert into public.user_task_notifications (
                task_id, recipient_id, kind, title, is_read, created_at
              ) values (
                ${taskRes[0].id}::uuid,
                ${effectiveAssigneeUserId}::uuid,
                'assignment',
                ${'Truck Confirmed — Goods Entry Assigned to You (' + (order as any).order_no + ')'},
                false, now()
              )
            `;
          }

          // Activity event
          await sql`
            insert into public.erp_activity_events (
              actor_id, action, resource, record_table, record_id, country_id, metadata
            ) values (
              ${session.userId}, 'stage_1b_confirmed_assigned', 'shipping', 'clearing_customer_orders', ${id}::uuid,
              ${targetCountryId}::uuid,
              ${sql.json({
                stage: '1B',
                actionText: 'Truck Confirmed — Goods Entry Assigned to Another User',
                truckNumber: String(truckNumber).trim(),
                assignedToUserId: effectiveAssigneeUserId,
                instructions: effectiveInstructions || null,
                date: now
              })}
            )
          `;
        }
      });

      return wfOk({ success: true, message: `Truck ${truckNumber.trim()} confirmed for order ${(order as any).order_no}.`, status: "truck_confirmed", current_stage: "goods_verification" });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2b. ACCEPT THE ASSIGNED STAGE (the receiving user acknowledges 1B / 1C before working on it)
    // ─────────────────────────────────────────────────────────────────────────────
    else if (action === "accept_stage") {
      const accepted = await withLocalPg(async (sql) => {
        const [tr] = (await sql`
          select id, transfer_type, sender_user_id, receiver_user_id, status
          from public.inter_country_transfers
          where source_id = ${id}::uuid and source_table = 'clearing_customer_orders'
            and transfer_type in ('truck_task', 'goods_verification') and deleted_at is null
          order by created_at desc limit 1
        `) as unknown as any[];
        if (!tr) return { error: "There is no assignment on this order to accept.", status: 404 };
        if (tr.receiver_user_id !== session.userId && !session.isSuperAdmin) {
          return { error: "This stage is assigned to another user.", status: 403 };
        }
        if (tr.status === "accepted") return { already: true, stage: tr.transfer_type === "goods_verification" ? "1C" : "1B" };
        if (tr.status !== "pending") return { error: `This assignment is already ${tr.status}.`, status: 409 };
        await sql`
          update public.inter_country_transfers
          set status = 'accepted', accepted_at = now(), accepted_by = ${session.userId}::uuid, updated_at = now()
          where id = ${tr.id}::uuid
        `;
        const [task] = (await sql`
          select id from public.user_tasks
          where related_record_id = ${id}::uuid and related_record_table = 'clearing_customer_orders'
            and assigned_to = ${tr.receiver_user_id}::uuid and status = 'new' and deleted_at is null
          order by created_at desc limit 1
        `) as unknown as any[];
        return { transferId: tr.id, taskId: task?.id ?? null, stage: tr.transfer_type === "goods_verification" ? "1C" : "1B" };
      });
      if (accepted && (accepted as any).error) {
        throw new ApiClientError((accepted as any).error, { status: (accepted as any).status, code: "ACCEPT_REFUSED" });
      }
      const info: any = accepted || {};
      if (info.taskId) {
        // Same transition the Tasks module uses, so its audit trail and notifications stay consistent.
        const { transition } = await import("@/lib/user-tasks/service");
        try { await transition(session, info.taskId, "accept", {}); } catch { /* task already accepted/started elsewhere */ }
      }
      if (!info.already) {
        await withLocalPg(async (sql) => {
          await sql`
            insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, metadata)
            values (${session.userId}, 'stage_accepted', 'shipping', 'clearing_customer_orders', ${id}::uuid,
                    ${(order as any).country_id}::uuid,
                    ${sql.json({ stage: info.stage, actionText: `Stage ${info.stage} Accepted`, acceptedBy: session.fullName, date: now })})
          `;
        });
      }
      return wfOk({ success: true, stage: info.stage, alreadyAccepted: Boolean(info.already), message: `Stage ${info.stage} accepted.` });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. RETURN FOR CORRECTION (MANDATORY REASON)
    // ─────────────────────────────────────────────────────────────────────────────
    else if (action === "return_for_correction") {
      const { reason, returnToStage } = body;
      if (!reason || !reason.trim()) {
        throw new ApiClientError("A mandatory reason is required when returning for correction.", { status: 400 });
      }

      await withLocalPg(async (sql) => {
        // Mark pending transfer as returned
        const returnedTransfer = await sql`
          update public.inter_country_transfers
          set status = 'returned',
              return_reason = ${reason.trim()},
              receiver_user_id = ${session.userId},
              updated_at = now()
          where source_id = ${id}::uuid
            and source_table = 'clearing_customer_orders'
            and status in ('pending', 'accepted')
          returning id, sender_user_id, transfer_no
        `;

        // Mark active user task as returned
        const returnedTasks = (await sql`
          update public.user_tasks
          set status = 'returned',
              return_reason = ${reason.trim()},
              returned_at = now(),
              updated_at = now()
          where related_record_id = ${id}::uuid
            and related_record_table = 'clearing_customer_orders'
            and status in ('new', 'accepted', 'in_progress', 'waiting')
          returning id, created_by
        `) as unknown as any[];

        const targetStage = returnToStage === "1B" ? "truck_assignment" : "booking";

        // Update customer order
        await sql`
          update public.clearing_customer_orders
          set current_stage = ${targetStage},
              status = 'returned_for_correction',
              rejected_reason = ${reason.trim()},
              updated_at = now()
          where id = ${id}::uuid
        `;

        const effectiveTaskId = returnedTasks?.[0]?.id;
        const targetUserId = returnedTransfer[0]?.sender_user_id || returnedTasks?.[0]?.created_by || (order as any).created_by;

        if (effectiveTaskId && targetUserId) {
          // Notification to the returning user
          await sql`
            insert into public.user_task_notifications (
              task_id, recipient_id, kind, title, is_read, created_at
            ) values (
              ${effectiveTaskId}::uuid,
              ${targetUserId}::uuid,
              'return',
              ${'Order ' + (order as any).order_no + ' returned for correction: ' + reason.trim()},
              false, now()
            )
          `;
        }

        // Log Activity event
        await sql`
          insert into public.erp_activity_events (
            actor_id, action, resource, record_table, record_id, country_id, metadata
          ) values (
            ${session.userId}, 'returned_for_correction', 'shipping', 'clearing_customer_orders', ${id}::uuid,
            ${(order as any).country_id}::uuid,
            ${sql.json({
              stage: returnToStage || '1A',
              actionText: `Order Returned for Correction to ${returnToStage || '1A'}`,
              returnedBy: session.fullName,
              returnReason: reason.trim(),
              date: now
            })}
          )
        `;
      });

      return wfOk({ success: true, message: `Order ${(order as any).order_no} returned for correction.` });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. STAGE 1C — COMPLETE GOODS ENTRY & FINALIZE ORDER
    // ─────────────────────────────────────────────────────────────────────────────
    else if (action === "complete_goods") {
      const { goodsItems } = body;
      if (!Array.isArray(goodsItems) || goodsItems.length === 0) {
        throw new ApiClientError("At least one goods item is required to complete goods entry.", { status: 400, code: "GOODS_REQUIRED" });
      }

      // ── Completion gates ─────────────────────────────────────────────────────────
      // The order must not be marked complete while 1B (truck & transport) or 1C (goods)
      // is missing required information. Checked against what is STORED, not what the
      // browser claims, so a stale or hand-built request cannot skip a stage.
      const missing1b = stage1bMissing({
        truck_number: (order as any).truck_number,
        truck_details: (order as any).truck_details,
        status: (order as any).status
      });
      if (missing1b.length) {
        throw new ApiClientError(
          `Stage 1B is incomplete — ${missing1b.join("; ")}. Go back to 1B, confirm the truck, then complete Goods Entry.`,
          { status: 409, code: "STAGE_1B_INCOMPLETE", details: { stage: "1B", missing: missing1b } }
        );
      }
      const goodsProblems = validateGoodsItems(goodsItems);
      if (goodsProblems.length) {
        throw new ApiClientError(
          `Stage 1C is incomplete — ${goodsProblems.join("; ")}.`,
          { status: 422, code: "STAGE_1C_INCOMPLETE", details: { stage: "1C", missing: goodsProblems } }
        );
      }

      const rows = goodsItems.map((g: any) => readGoodsItem(g));
      const totalQuantity = rows.reduce((acc: number, g: any) => acc + g.quantity, 0);
      const totalGross = rows.reduce((acc: number, g: any) => acc + g.gross, 0);
      const totalEmpty = rows.reduce((acc: number, g: any) => acc + g.empty, 0);
      const totalNet = Math.max(0, totalGross - totalEmpty);
      const first = rows[0];
      const aggregatedNames = rows.map((g: any) => g.name).filter(Boolean).join(", ") || (order as any).goods_name || "Goods";

      await withLocalPg(async (sql) => {
        // Complete any open transfer for this order
        await sql`
          update public.inter_country_transfers
          set status = 'completed', completed_at = now(), updated_at = now()
          where source_id = ${id}::uuid
            and source_table = 'clearing_customer_orders'
            and status in ('pending', 'accepted')
        `;

        // Complete any open task
        await sql`
          update public.user_tasks
          set status = 'completed', completed_at = now(), updated_at = now()
          where related_record_id = ${id}::uuid
            and related_record_table = 'clearing_customer_orders'
            and status in ('new', 'accepted', 'in_progress', 'waiting')
        `;

        // Finalise the order. The browser's field names are used (goodsChsCode / brandQuality /
        // originCountry) — the previous code read hsCode / brand that the form never sends and
        // so overwrote the saved HS code and brand with NULL. Nothing is blanked: a value the
        // manifest does not carry keeps what the order already had. cargo_details is the free-text
        // cargo note shared with billing/loading/tracking and is NOT overwritten with JSON; the
        // structured manifest lives in goods_items.
        await sql`
          update public.clearing_customer_orders
          set status = 'completed',
              current_stage = 'completed',
              goods_quantity = ${totalQuantity},
              goods_gross_weight = ${totalGross},
              goods_empty_weight = ${totalEmpty},
              goods_net_weight = ${totalNet},
              goods_name = ${aggregatedNames},
              goods_brand = coalesce(${first.brand}, goods_brand),
              goods_size = coalesce(${first.size}, goods_size),
              goods_variation_label = coalesce(${first.variety}, goods_variation_label),
              goods_chs_code = coalesce(${first.hsCode}, goods_chs_code),
              goods_origin_country_name = coalesce(${first.originCountry}, goods_origin_country_name),
              goods_unit = ${first.unit},
              goods_items = ${sql.json(goodsItems)},
              approved_by = ${session.userId},
              approved_at = now(),
              updated_at = now()
          where id = ${id}::uuid
        `;

        // Replace allocations in clearing_customer_order_loading_allocations
        await sql`
          delete from public.clearing_customer_order_loading_allocations
          where order_id = ${id}::uuid
        `;

        for (let i = 0; i < goodsItems.length; i++) {
          const g = goodsItems[i];
          const r = rows[i];
          await sql`
            insert into public.clearing_customer_order_loading_allocations (
              order_id, row_serial, warehouse_id, source_location_text,
              quantity, unit, remarks, created_at, updated_at
            ) values (
              ${id}::uuid,
              ${i + 1},
              ${g.warehouseId || null}::uuid,
              ${g.warehouseAddressText || g.warehouseName || (order as any).loading_source_name || null},
              ${r.quantity},
              ${r.unit},
              ${`${r.name}${r.brand ? ` [Brand: ${r.brand}]` : ""} (${g.kgPerQty || ""} kg/${r.unit}) • Total: ${r.gross} kg • Gross: ${r.gross} kg • Net: ${r.net} kg`},
              now(), now()
            )
          `;
        }

        // Insert goods verification record
        await sql`
          insert into public.clearing_customer_order_goods_verifications (
            order_id, booked_quantity, booked_unit,
            booked_gross_weight, booked_net_weight,
            verified_quantity, verified_unit,
            verified_gross_weight, verified_net_weight,
            warehouse_id, loading_source_text,
            result, verified_by, verified_at,
            country_id, country_branch_id, city_branch_id, created_by,
            created_at, updated_at
          ) values (
            ${id}::uuid,
            ${totalQuantity}, ${first.unit},
            ${totalGross}, ${totalNet},
            ${totalQuantity}, ${first.unit},
            ${totalGross}, ${totalNet},
            ${goodsItems[0]?.warehouseId || null}::uuid,
            ${goodsItems[0]?.warehouseName || (order as any).loading_source_name || null},
            'verified',
            ${session.userId}, now(),
            ${(order as any).country_id ?? null}::uuid,
            ${(order as any).country_branch_id ?? null}::uuid,
            ${(order as any).city_branch_id ?? null}::uuid,
            ${session.userId}, now(), now()
          )
        `;

        // Log Activity event
        await sql`
          insert into public.erp_activity_events (
            actor_id, action, resource, record_table, record_id, country_id, metadata
          ) values (
            ${session.userId}, 'stage_1c_completed', 'shipping', 'clearing_customer_orders', ${id}::uuid,
            ${(order as any).country_id ?? null}::uuid,
            ${sql.json({
              stage: '1C',
              actionText: 'Stage 1C Completed — Goods Entry Finalized',
              completedBy: session.fullName,
              totalItems: goodsItems.length,
              totalQuantity,
              totalGrossWeight: totalGross,
              totalNetWeight: totalNet,
              date: now
            })}
          )
        `;
      });

      return wfOk({
        success: true,
        message: `Goods entry completed and order ${(order as any).order_no} finalized.`,
        status: "completed",
        current_stage: "completed"
      });
    }

    throw new ApiClientError(`Unknown workflow action: ${action}`, { status: 400 });
  } catch (error) {
    return wfFail(error);
  }
}
