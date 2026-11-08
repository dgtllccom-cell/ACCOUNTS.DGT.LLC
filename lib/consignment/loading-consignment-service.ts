/**
 * Loading → Consignment service.
 *
 * Lists every saved loading of Purchase Booking AND Local Purchase as one consignment row (derived, so a loading can
 * never be entered twice) and moves a loading's untransferred balance to its next destination by REUSING the existing
 * stock logic only:
 *   - Purchase Booking → Warehouse : stockInToWarehouse (the one place a purchased load is booked into warehouse stock)
 *   - Local Purchase   → Warehouse : goods-transfer-service createTransfer (purchase lots, "own_warehouse")
 *   - Local Purchase   → Re-export : goods-transfer-service moveStock (lot leaves as "exported")
 *   - Purchase Booking → Re-export : no warehouse stock is created (same as the Purchase Lane "re_export" disposition)
 *
 * Nothing here posts to Roznamcha / ledger / journal or touches any payment. Every transfer runs in one transaction
 * with the loading row locked, re-checks the available balance, and is idempotent (a repeated click replays).
 */
import { randomUUID } from "node:crypto";
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { authorizeApiScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { stockInToWarehouse } from "@/lib/services/purchase-warehouse-stock";
import { createTransfer, ensureLotsForPurchase, lockLot, moveStock } from "@/lib/services/goods-transfer-service";
import {
  availableToTransfer,
  bookingPaymentProofComplete,
  bookingTransferredQty,
  consignmentKey,
  consignmentStatus,
  findReplay,
  localEntryId,
  parseConsignmentKey,
  proportionalWeights,
  readTransfers,
  sumTransferred,
  transferProblems,
  CONSIGNMENT_DESTINATION_LABEL,
  type ConsignmentDestination,
  type ConsignmentSource,
  type ConsignmentStatus,
  type ConsignmentTransferRecord,
} from "./loading-consignment-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

const q4 = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
};
const txt = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s && s !== "—" && s !== "â€”" && s !== "-" ? s : null;
};
const day = (v: unknown) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);
const obj = (v: unknown): Record<string, any> => {
  if (v && typeof v === "object") return v as Record<string, any>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return p && typeof p === "object" ? p : {};
    } catch {
      return {};
    }
  }
  return {};
};

const LANE_NOTE = "Consignment transfer";

export type ConsignmentLot = { id: string; lotRef: string; goodsName: string; available: number };

export type LoadingConsignmentRow = {
  key: string;
  source: ConsignmentSource;
  purchaseId: string;
  purchaseRefNo: string;
  loadingId: string;
  loadingNo: string;
  loadingDate: string | null;
  supplierName: string | null;
  goodsName: string | null;
  unit: string | null;
  loadedQty: number;
  grossWeight: number;
  netWeight: number;
  truckNo: string | null;
  driverName: string | null;
  containerNo: string | null;
  blNo: string | null;
  transporter: string | null;
  transportMode: string | null;
  origin: string | null;
  destination: string | null;
  countryId: string | null;
  countryName: string | null;
  branchName: string | null;
  paymentCondition: string | null;
  paymentStatus: string | null;
  transferredQty: number;
  availableQty: number;
  status: ConsignmentStatus;
  locked: boolean;
  lockReason: string | null;
  transfers: ConsignmentTransferRecord[];
  lots: ConsignmentLot[];
  createdAt: string | null;
};

function fail(message: string, code: string, status = 422, details?: unknown) {
  return new ApiClientError(message, { status, code, details });
}

async function pg<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const out = await withLocalPg(fn);
  if (out === null || out === undefined) throw fail("Database is temporarily unavailable.", "DB_UNAVAILABLE", 503);
  return out as T;
}

// ───────────────────────────── row builders ─────────────────────────────

function bookingRow(r: Record<string, any>): LoadingConsignmentRow {
  const payload = obj(r.report_payload);
  const fd = obj(r.po_form_data);
  const form = obj(fd.form);
  const goods = Array.isArray(fd.goodsEntries) ? fd.goodsEntries : [];
  const transfers = readTransfers(payload.consignmentTransfers);
  const loaded = q4(r.loaded_quantity);
  const laneFinalElsewhere = Boolean(r.lane_disposition_final) && !String(r.lane_disposition_note ?? "").startsWith(LANE_NOTE);
  const transferred = bookingTransferredQty({ loadedQty: loaded, receivedQty: q4(r.received_quantity), transfers, laneFinalElsewhere });
  const paid = bookingPaymentProofComplete(r.po_payment_status, r.po_remaining_due);
  const locked = !paid;
  return {
    key: consignmentKey("purchase_booking", r.purchase_order_id, r.id),
    source: "purchase_booking",
    purchaseId: r.purchase_order_id,
    purchaseRefNo: txt(r.purchase_order_no) ?? txt(r.po_no) ?? String(r.purchase_order_id).slice(0, 8),
    loadingId: r.id,
    loadingNo: txt(r.loading_record_no) ?? `LD-${String(r.id).slice(0, 8)}`,
    loadingDate: day(r.loaded_at ?? r.created_at),
    supplierName: txt(form.supplierName) ?? txt(form.salesAccountName) ?? txt(form.purchaseAccountName),
    goodsName: txt(payload.goodsName) ?? txt(goods[0]?.goodsName) ?? txt(form.goodsName),
    unit: txt(payload.qtyName) ?? txt(form.qtyName) ?? txt(form.quantityUnit),
    loadedQty: loaded,
    grossWeight: q4(r.gross_weight ?? payload.grossWeight),
    netWeight: q4(r.net_weight ?? payload.netWeight),
    truckNo: txt(r.vehicle_no) ?? txt(payload.truckNo) ?? txt(payload.vehicleNo),
    driverName: txt(r.driver_name) ?? txt(payload.driverName),
    containerNo: txt(r.container_number) ?? txt(payload.containerNumber),
    blNo: txt(r.bl_number) ?? txt(payload.blNumber),
    transporter: txt(r.transporter_name) ?? txt(payload.transporterName),
    transportMode: txt(r.transport_mode),
    origin: txt(r.origin_text) ?? txt(r.loading_location),
    destination: txt(r.destination_text) ?? txt(r.receiving_location),
    countryId: r.country_id ?? null,
    countryName: txt(r.country_name),
    branchName: txt(r.branch_name),
    paymentCondition: txt(form.paymentType) ?? txt(form.paymentCondition),
    paymentStatus: txt(r.po_payment_status),
    transferredQty: transferred,
    availableQty: availableToTransfer(loaded, transferred),
    status: consignmentStatus({ loadedQty: loaded, transferredQty: transferred, locked }),
    locked,
    lockReason: locked ? "Purchase Booking payment is not yet complete (existing booking payment rule)." : null,
    transfers,
    lots: [],
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  };
}

function localRows(lp: Record<string, any>, lots: ConsignmentLot[]): LoadingConsignmentRow[] {
  const details = obj(lp.loading_details);
  const entries: any[] = Array.isArray(details.entries) ? details.entries : [];
  return entries
    .map((e, i) => ({ e: obj(e), i }))
    .filter(({ e }) => q4(e.loadedQuantity) > 0)
    .map(({ e, i }) => {
      const loadingId = localEntryId(e, i);
      const transfers = readTransfers(e.consignmentTransfers);
      const loaded = q4(e.loadedQuantity);
      const transferred = Math.min(loaded, sumTransferred(transfers));
      const ref = txt(lp.manual_bill_no) ?? txt(lp.entry_serial) ?? txt(lp.journal_serial_no) ?? String(lp.id).slice(0, 8);
      return {
        key: consignmentKey("local_purchase", lp.id, loadingId),
        source: "local_purchase" as const,
        purchaseId: lp.id,
        purchaseRefNo: ref,
        loadingId,
        loadingNo: txt(e.loadingNumber) ?? `LD-${ref}-${String(i + 1).padStart(2, "0")}`,
        loadingDate: day(e.loadingDate ?? e.createdAt),
        supplierName: txt(lp.supplier_name),
        goodsName: txt(e.goodsName) ?? txt(lp.goods_name),
        unit: txt(e.quantityName) ?? txt(lp.quantity_name),
        loadedQty: loaded,
        grossWeight: q4(e.grossWeight),
        netWeight: q4(e.netWeight),
        truckNo: txt(e.truckNo),
        driverName: txt(e.driverName),
        containerNo: txt(e.blOrContainerNo),
        blNo: null,
        transporter: txt(e.transportDetails),
        transportMode: txt(lp.shipping_mode),
        origin: txt(e.route)?.split("→")[0]?.trim() || txt(lp.origin_country_name),
        destination: txt(lp.warehouse_name),
        countryId: lp.country_id ?? null,
        countryName: txt(lp.country_name),
        branchName: txt(lp.branch_name),
        paymentCondition: txt(lp.payment_mode),
        paymentStatus: null,
        transferredQty: transferred,
        availableQty: availableToTransfer(loaded, transferred),
        // Local Purchase loading is already payment-gated when it is saved — no extra step here.
        status: consignmentStatus({ loadedQty: loaded, transferredQty: transferred, locked: false }),
        locked: false,
        lockReason: null,
        transfers,
        lots,
        createdAt: e.createdAt ? String(e.createdAt) : lp.created_at ? new Date(lp.created_at).toISOString() : null,
      };
    });
}

// ───────────────────────────── list ─────────────────────────────

export type ListOptions = { source?: string | null; q?: string | null; limit?: number };

export async function listLoadingConsignments(session: ErpSession, opts: ListOptions = {}) {
  authorizeApiScope(session, { resource: "purchases", action: "read" });
  const limit = Math.min(Math.max(Number(opts.limit) || 500, 1), 1000);
  const wantBooking = !opts.source || opts.source === "all" || opts.source === "purchase_booking";
  const wantLocal = !opts.source || opts.source === "all" || opts.source === "local_purchase";
  const scope = sessionSqlScope(session);

  const data = await pg(async (sql: Sql) => {
    const booking = wantBooking
      ? await sql`
          select plr.id, plr.purchase_order_id, plr.purchase_order_no, plr.loading_record_no, plr.loaded_quantity, plr.received_quantity,
                 plr.gross_weight, plr.net_weight, plr.vehicle_no, plr.driver_name, coalesce(plr.transport_company, plr.carrier_name, plr.shipping_line) as transporter_name, plr.container_number,
                 plr.bl_number, plr.transport_mode, plr.origin_text, plr.destination_text, plr.loading_location, plr.receiving_location,
                 plr.loaded_at, plr.created_at, plr.report_payload, plr.country_id,
                 po.purchase_order_no as po_no, po.payment_status as po_payment_status, po.remaining_due as po_remaining_due,
                 po.form_data as po_form_data,
                 c.name as country_name, coalesce(cib.city_name, cb.name) as branch_name,
                 lane.disposition_final as lane_disposition_final, lane.disposition_note as lane_disposition_note
          from public.purchase_loading_records plr
          join public.purchase_orders po on po.id = plr.purchase_order_id and po.deleted_at is null
          left join public.countries c on c.id = plr.country_id
          left join public.city_branches cib on cib.id = plr.city_branch_id
          left join public.country_branches cb on cb.id = plr.country_branch_id
          left join public.purchase_lane_loads lane
            on lane.source_type = 'purchase_booking' and lane.source_id = plr.id and lane.deleted_at is null
          where plr.deleted_at is null
            and coalesce(plr.loading_status, '') <> 'cancelled'
            and coalesce(plr.loaded_quantity, 0) > 0
            and ${sqlScopeCondition(sql, scope, "plr")}
          order by coalesce(plr.loaded_at, plr.created_at) desc
          limit ${limit}`
      : [];

    const locals = wantLocal
      ? await sql`
          select lp.id, lp.manual_bill_no, lp.entry_serial, lp.journal_serial_no, lp.supplier_name, lp.goods_name,
                 lp.quantity_name, lp.loading_details, lp.warehouse_name, lp.shipping_mode, lp.payment_mode, lp.origin_country_name,
                 lp.country_id, lp.created_at,
                 c.name as country_name, coalesce(cib.city_name, cb.name) as branch_name
          from public.local_purchases lp
          left join public.countries c on c.id = lp.country_id
          left join public.city_branches cib on cib.id = lp.city_branch_id
          left join public.country_branches cb on cb.id = lp.country_branch_id
          where lp.deleted_at is null
            and lp.status = 'posted'
            and jsonb_typeof(lp.loading_details -> 'entries') = 'array'
            and jsonb_array_length(lp.loading_details -> 'entries') > 0
            and ${sqlScopeCondition(sql, scope, "lp")}
          order by lp.updated_at desc nulls last
          limit ${limit}`
      : [];

    const localIds = (locals as any[]).map((l) => l.id);
    const lotRows = localIds.length
      ? await sql`
          select l.id, l.local_purchase_id, l.lot_ref, l.goods_name,
                 coalesce((select sum(s.qty) from public.lot_stock s where s.lot_id = l.id and s.state = 'available'), 0) as available
          from public.purchase_lots l
          where l.local_purchase_id = any(${localIds}::uuid[])
          order by l.created_at`
      : [];
    return { booking, locals, lotRows };
  });

  const lotsByPurchase = new Map<string, ConsignmentLot[]>();
  for (const l of data.lotRows as any[]) {
    const list = lotsByPurchase.get(l.local_purchase_id) ?? [];
    list.push({ id: l.id, lotRef: l.lot_ref, goodsName: l.goods_name, available: q4(l.available) });
    lotsByPurchase.set(l.local_purchase_id, list);
  }

  let rows: LoadingConsignmentRow[] = [
    ...(data.booking as any[]).map(bookingRow),
    ...(data.locals as any[]).flatMap((lp) => localRows(lp, lotsByPurchase.get(lp.id) ?? [])),
  ];

  const term = opts.q?.trim().toLowerCase();
  if (term) {
    rows = rows.filter((r) =>
      [r.purchaseRefNo, r.loadingNo, r.supplierName, r.goodsName, r.truckNo, r.driverName, r.containerNo, r.blNo]
        .some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }
  rows.sort((a, b) => String(b.loadingDate ?? b.createdAt ?? "").localeCompare(String(a.loadingDate ?? a.createdAt ?? "")));

  const summary = {
    total: rows.length,
    booking: rows.filter((r) => r.source === "purchase_booking").length,
    local: rows.filter((r) => r.source === "local_purchase").length,
    ready: rows.filter((r) => r.status === "ready" || r.status === "partial").length,
    awaitingPayment: rows.filter((r) => r.status === "awaiting_payment").length,
    transferred: rows.filter((r) => r.status === "transferred").length,
    loadedQty: q4(rows.reduce((s, r) => s + r.loadedQty, 0)),
    availableQty: q4(rows.reduce((s, r) => s + r.availableQty, 0)),
  };
  return { rows, summary };
}

export async function listTransferWarehouses(session: ErpSession, countryIds: string[]) {
  return pg(async (sql: Sql) =>
    sql`
      select w.id, w.warehouse_code, w.warehouse_name, w.country_id
      from public.warehouses w
      where w.deleted_at is null and coalesce(w.is_active, true) = true
        and (${session.isSuperAdmin}::boolean or w.country_id = any(${countryIds}::uuid[]))
      order by w.warehouse_name
      limit 500`,
  );
}

// ───────────────────────────── transfer ─────────────────────────────

export type TransferInput = {
  key: string;
  destination: ConsignmentDestination;
  qty: number;
  warehouseId?: string | null;
  lotId?: string | null;
  destinationNote?: string | null;
  idempotencyKey: string;
};

export type TransferResult = { key: string; replayed: boolean; transfer: ConsignmentTransferRecord; availableQty: number; transferredQty: number };

function userName(session: ErpSession) {
  return session.fullName || session.email || "User";
}

async function loadWarehouse(tx: Sql, id: string | null | undefined) {
  if (!id) throw fail("Select the destination warehouse.", "WAREHOUSE_REQUIRED");
  const [w] = await tx`select id, warehouse_name, country_id from public.warehouses where id = ${id}::uuid and deleted_at is null and coalesce(is_active, true) = true`;
  if (!w) throw fail("The selected warehouse does not exist or is inactive.", "WAREHOUSE_INVALID");
  return w;
}

function assertTransferable(p: Parameters<typeof transferProblems>[0]) {
  const problems = transferProblems(p);
  if (!problems.length) return;
  if (problems.includes("locked")) throw fail("This Purchase Booking loading cannot move yet: the booking payment is not complete.", "PAYMENT_PENDING", 409, { problems });
  if (problems.includes("nothing_left")) throw fail("This loading has already been fully transferred. Nothing was changed.", "ALREADY_TRANSFERRED", 409, { problems });
  if (problems.includes("exceeds")) throw fail(`Only ${p.available} is still available to transfer from this loading.`, "EXCEEDS_AVAILABLE", 409, { problems });
  throw fail("The transfer is incomplete: " + problems.join(", "), "TRANSFER_INCOMPLETE", 422, { problems });
}

export async function transferLoadingConsignment(session: ErpSession, input: TransferInput): Promise<TransferResult> {
  const parsed = parseConsignmentKey(input.key);
  if (!parsed) throw fail("Unknown consignment row.", "BAD_KEY", 400);
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) throw fail("An idempotency key is required.", "IDEMPOTENCY_REQUIRED", 400);
  return parsed.source === "purchase_booking"
    ? transferBooking(session, parsed.loadingId, input)
    : transferLocal(session, parsed.purchaseId as string, parsed.loadingId, input);
}

async function transferBooking(session: ErpSession, loadingId: string, input: TransferInput): Promise<TransferResult> {
  return pg(async (sql: Sql) =>
    sql.begin(async (tx: Sql) => {
      const [r] = await tx`
        select plr.*, po.payment_status as po_payment_status, po.remaining_due as po_remaining_due, po.form_data as po_form_data
        from public.purchase_loading_records plr
        join public.purchase_orders po on po.id = plr.purchase_order_id
        where plr.id = ${loadingId}::uuid and plr.deleted_at is null
        for update of plr`;
      if (!r) throw fail("Loading record not found.", "NOT_FOUND", 404);
      authorizeApiScope(session, { resource: "purchases", action: "update", countryId: r.country_id, countryBranchId: r.country_branch_id, cityBranchId: r.city_branch_id });

      const payload = obj(r.report_payload);
      const transfers = readTransfers(payload.consignmentTransfers);
      const replay = findReplay(transfers, input.idempotencyKey);
      const [lane] = await tx`
        select * from public.purchase_lane_loads
        where source_type = 'purchase_booking' and source_id = ${loadingId}::uuid and deleted_at is null
        for update`;
      const laneFinalElsewhere = Boolean(lane?.disposition_final) && !String(lane?.disposition_note ?? "").startsWith(LANE_NOTE);
      const loaded = q4(r.loaded_quantity);
      const transferredBefore = bookingTransferredQty({ loadedQty: loaded, receivedQty: q4(r.received_quantity), transfers, laneFinalElsewhere });
      if (replay) {
        return { key: input.key, replayed: true, transfer: replay, transferredQty: transferredBefore, availableQty: availableToTransfer(loaded, transferredBefore) };
      }

      const available = availableToTransfer(loaded, transferredBefore);
      const locked = !bookingPaymentProofComplete(r.po_payment_status, r.po_remaining_due);
      assertTransferable({ destination: input.destination, qty: input.qty, available, warehouseId: input.warehouseId, locked });

      const qty = q4(input.qty);
      const w = proportionalWeights(loaded, q4(r.gross_weight ?? payload.grossWeight), q4(r.net_weight ?? payload.netWeight), qty);
      let warehouse: any = null;
      let stockReference: string | null = null;

      if (input.destination === "warehouse") {
        warehouse = await loadWarehouse(tx, input.warehouseId);
        const goodsId = await resolveBookingGoodsId(tx, r, lane);
        if (!goodsId) throw fail("No goods item is linked to this purchase booking, so it cannot be booked into warehouse stock.", "GOODS_REQUIRED");
        const res = await stockInToWarehouse(tx, {
          goodsId,
          warehouseId: warehouse.id,
          quantity: qty,
          scope: { countryId: r.country_id, countryBranchId: r.country_branch_id, cityBranchId: r.city_branch_id },
          referenceNo: r.loading_record_no || r.purchase_order_no,
          purchaseOrderId: r.purchase_order_id,
          loadingRecordId: r.id,
          userId: session.userId,
          remarks: `Consignment → Warehouse (${r.loading_record_no || r.id})`,
        });
        stockReference = res.stockMovementId;
        // keep the loading's receiving columns in step so Destination Receiving cannot receive the same quantity again
        await tx`
          update public.purchase_loading_records
          set received_quantity = coalesce(received_quantity, 0) + ${qty}, received_at = now(), received_by = ${session.userId}::uuid,
              receiving_warehouse_id = ${warehouse.id}::uuid, receiving_goods_id = coalesce(receiving_goods_id, ${goodsId}::uuid)
          where id = ${r.id}::uuid`;
      }

      const transfer: ConsignmentTransferRecord = {
        id: randomUUID(),
        idempotencyKey: input.idempotencyKey,
        destination: input.destination,
        qty,
        grossWeight: w.grossWeight,
        netWeight: w.netWeight,
        warehouseId: warehouse?.id ?? null,
        warehouseName: warehouse?.warehouse_name ?? null,
        destinationNote: input.destinationNote ?? null,
        stockReference,
        at: new Date().toISOString(),
        userId: session.userId,
        userName: userName(session),
      };
      const nextTransfers = [...transfers, transfer];
      const transferredAfter = q4(transferredBefore + qty);
      const availableAfter = availableToTransfer(loaded, transferredAfter);
      const done = availableAfter <= 0;
      const stage = input.destination === "warehouse" ? "warehouse" : "re-export";
      const stageEvents = Array.isArray(payload.stageEvents) ? [...payload.stageEvents] : [];
      stageEvents.push({ stage, action: "consignment_transfer", destination: stage, qty, userId: session.userId, userName: userName(session), at: transfer.at, note: input.destinationNote ?? null });
      const nextPayload = {
        ...payload,
        consignmentTransfers: nextTransfers,
        consignmentTransferredQty: transferredAfter,
        consignmentAvailableQty: availableAfter,
        stageEvents,
        ...(done ? { lifecycleStage: stage, stockStage: stage === "warehouse" ? "Warehouse Stock" : "Re-export Stock", stockStatus: "BLACK", nextDestination: stage, destinationType: stage } : {}),
      };
      await tx`
        update public.purchase_loading_records
        set report_payload = ${tx.json(nextPayload)},
            ${done ? tx`loading_status = 'received', shipment_status = ${stage},` : tx``}
            updated_at = now()
        where id = ${r.id}::uuid`;

      // Keep the Purchase Lane in step so its own "final disposition" can never move the same quantity again.
      if (lane && !lane.disposition_final) {
        const laneLeft = Math.max(0, q4(lane.lane_stock_qty) - qty);
        await tx`
          update public.purchase_lane_loads set
            lane_stock_qty = ${done ? 0 : laneLeft},
            ${done ? tx`lane_status = 'completed', disposition = ${input.destination}, disposition_final = true, disposition_at = now(),
                        disposition_by = ${session.userId}::uuid, disposition_note = ${LANE_NOTE},
                        disposition_warehouse_id = ${warehouse?.id ?? null},` : tx``}
            updated_at = now()
          where id = ${lane.id}::uuid`;
        await tx`
          insert into public.purchase_lane_events (lane_load_id, purchase_order_id, event_type, from_status, to_status, detail, actor_id, actor_name)
          values (${lane.id}::uuid, ${r.purchase_order_id}::uuid, 'consignment_transfer', ${lane.lane_status}, ${done ? "completed" : lane.lane_status},
                  ${tx.json({ qty, destination: input.destination, warehouseId: warehouse?.id ?? null, stockMovementId: stockReference, final: done })},
                  ${session.userId}::uuid, ${session.fullName ?? null})`;
      }

      return { key: input.key, replayed: false, transfer, transferredQty: transferredAfter, availableQty: availableAfter };
    }),
  );
}

async function resolveBookingGoodsId(tx: Sql, r: Record<string, any>, lane: Record<string, any> | undefined): Promise<string | null> {
  if (r.receiving_goods_id) return r.receiving_goods_id;
  if (lane?.goods_id) return lane.goods_id;
  const [it] = await tx`select product_id from public.purchase_order_items where purchase_order_id = ${r.purchase_order_id}::uuid and product_id is not null order by created_at asc limit 1`;
  if (it?.product_id) return it.product_id;
  const fd = obj(r.po_form_data);
  const g = Array.isArray(fd.goodsEntries) ? fd.goodsEntries[0] : null;
  const candidate = String(g?.goodsId ?? g?.goods_id ?? g?.productId ?? "");
  if (/^[0-9a-f-]{36}$/i.test(candidate)) {
    const [ok] = await tx`select id from public.goods where id = ${candidate}::uuid`;
    if (ok) return ok.id;
  }
  return null;
}

async function transferLocal(session: ErpSession, purchaseId: string, loadingId: string, input: TransferInput): Promise<TransferResult> {
  return pg(async (sql: Sql) =>
    sql.begin(async (tx: Sql) => {
      const [lp] = await tx`select * from public.local_purchases where id = ${purchaseId}::uuid and deleted_at is null for update`;
      if (!lp) throw fail("Local purchase not found.", "NOT_FOUND", 404);
      authorizeApiScope(session, { resource: "purchases", action: "update", countryId: lp.country_id, countryBranchId: lp.country_branch_id, cityBranchId: lp.city_branch_id ?? null });
      if (lp.status !== "posted") throw fail("Only a posted Local Purchase can move to a destination.", "NOT_POSTED", 409);

      const details = obj(lp.loading_details);
      const entries: any[] = Array.isArray(details.entries) ? details.entries.map(obj) : [];
      const idx = entries.findIndex((e, i) => localEntryId(e, i) === loadingId);
      if (idx < 0) throw fail("Loading entry not found on this Local Purchase.", "NOT_FOUND", 404);
      const entry = entries[idx];
      const transfers = readTransfers(entry.consignmentTransfers);
      const loaded = q4(entry.loadedQuantity);
      const transferredBefore = Math.min(loaded, sumTransferred(transfers));
      const replay = findReplay(transfers, input.idempotencyKey);
      if (replay) {
        return { key: input.key, replayed: true, transfer: replay, transferredQty: transferredBefore, availableQty: availableToTransfer(loaded, transferredBefore) };
      }
      const available = availableToTransfer(loaded, transferredBefore);
      assertTransferable({ destination: input.destination, qty: input.qty, available, warehouseId: input.warehouseId, locked: false });
      const qty = q4(input.qty);

      // Purchase lots carry the Local Purchase stock (created on posting); the loading moves part of that stock.
      await ensureLotsForPurchase(tx, purchaseId, session.userId);
      const lots = await tx`select id from public.purchase_lots where local_purchase_id = ${purchaseId}::uuid order by created_at`;
      const lotId = input.lotId ?? (lots.length === 1 ? lots[0].id : null);
      if (!lotId) throw fail("This Local Purchase has several goods lots. Choose the lot to transfer.", "LOT_REQUIRED", 422, { lots: lots.map((l: any) => l.id) });
      if (!lots.some((l: any) => l.id === lotId)) throw fail("That lot does not belong to this purchase.", "LOT_MISMATCH", 400);
      const lot = await lockLot(tx, lotId);
      const places = await tx`
        select warehouse_id, location_label, rack_bin, qty from public.lot_stock
        where lot_id = ${lotId}::uuid and state = 'available' and reference_id is null and qty >= ${qty}
        order by (warehouse_id is not distinct from ${lp.warehouse_id ?? null}::uuid) desc, qty desc
        limit 1`;
      const src = places[0];
      if (!src) {
        throw fail(`Only part of this lot is still available (it may have been moved on the Goods Transfer Journal). ${qty} cannot be transferred from one place.`, "INSUFFICIENT_STOCK", 409);
      }
      const source = { warehouseId: src.warehouse_id ?? null, label: src.location_label ?? "", rack: src.rack_bin ?? "" };
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: session.userId, role: "authenticated" })}, true)`;

      let warehouse: any = null;
      let stockReference: string | null = null;
      const noteText = `Consignment ${entry.loadingNumber || loadingId}${input.destinationNote ? " — " + input.destinationNote : ""}`;
      if (input.destination === "warehouse") {
        warehouse = await loadWarehouse(tx, input.warehouseId);
        if (source.warehouseId && source.warehouseId === warehouse.id && !source.rack) {
          stockReference = "already-in-warehouse"; // the goods already sit in that warehouse — record the routing only
        } else {
          const res = await createTransfer(tx, {
            lotId,
            purpose: "own_warehouse",
            qty,
            idempotencyKey: `cns-${loadingId}-${input.idempotencyKey}`.slice(0, 120),
            source,
            dest: { warehouseId: warehouse.id },
            notes: noteText,
            userId: session.userId,
          });
          stockReference = res.transfer?.transfer_no ?? res.transfer?.id ?? null;
        }
      } else {
        await moveStock(tx, {
          lot,
          from: { state: "available", ...source },
          to: { state: "exported", label: `Re-export: ${entry.loadingNumber || loadingId}` },
          qty,
          movementType: "re_export",
          referenceType: "consignment_loading",
          referenceId: purchaseId,
          referenceNo: entry.loadingNumber || null,
          notes: noteText,
          userId: session.userId,
        });
        stockReference = `re-export:${lot.lot_ref}`;
      }

      const w = proportionalWeights(loaded, q4(entry.grossWeight), q4(entry.netWeight), qty);
      const transfer: ConsignmentTransferRecord = {
        id: randomUUID(),
        idempotencyKey: input.idempotencyKey,
        destination: input.destination,
        qty,
        grossWeight: w.grossWeight,
        netWeight: w.netWeight,
        warehouseId: warehouse?.id ?? null,
        warehouseName: warehouse?.warehouse_name ?? null,
        destinationNote: input.destinationNote ?? null,
        stockReference,
        at: new Date().toISOString(),
        userId: session.userId,
        userName: userName(session),
      };
      const transferredAfter = q4(transferredBefore + qty);
      entries[idx] = { ...entry, consignmentTransfers: [...transfers, transfer], consignmentTransferredQty: transferredAfter };
      const nextDetails = { ...details, entries };
      await tx`update public.local_purchases set loading_details = ${tx.json(nextDetails)}, updated_at = now() where id = ${purchaseId}::uuid`;
      return { key: input.key, replayed: false, transfer, transferredQty: transferredAfter, availableQty: availableToTransfer(loaded, transferredAfter) };
    }),
  );
}

export function destinationLabel(d: ConsignmentDestination) {
  return CONSIGNMENT_DESTINATION_LABEL[d];
}
