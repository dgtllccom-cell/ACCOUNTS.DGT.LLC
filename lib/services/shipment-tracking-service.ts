import { withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";
import { ApiClientError } from "@/lib/api/response";
import { recordInSessionScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import {
  TRACKING_EVENT_CODES,
  TRACKING_EVENT_LABELS,
  type TrackingEventCode,
  type TrackingEventRow,
  type CanonicalTrackingPayload
} from "@/lib/types/shipment-tracking";

export {
  TRACKING_EVENT_CODES,
  TRACKING_EVENT_LABELS,
  type TrackingEventCode,
  type TrackingEventRow,
  type CanonicalTrackingPayload
};

/** Which identifier a search is limited to ("all" searches every identifier below). */
export const TRACKING_SEARCH_FIELDS = ["all", "shipment", "bl", "container", "vessel", "voyage", "customer", "carrier", "truck", "transport"] as const;
export type TrackingSearchField = (typeof TRACKING_SEARCH_FIELDS)[number];
export const TRACKING_MODES = ["by_sea", "by_road", "by_air", "by_rail"] as const;

/** Older orders store "Road" / "road" / "train"; every screen works with the canonical by_* values. */
export function normalizeTrackingMode(value: unknown): (typeof TRACKING_MODES)[number] {
  const v = String(value ?? "").toLowerCase().replace(/^by[_\s-]*/, "");
  if (v === "road" || v === "truck") return "by_road";
  if (v === "air" || v === "flight") return "by_air";
  if (v === "rail" || v === "train" || v === "railway") return "by_rail";
  return "by_sea";
}

const LEGACY_MODE_VALUES: Record<string, string[]> = {
  by_sea: ["by_sea", "sea"],
  by_road: ["by_road", "road", "truck"],
  by_air: ["by_air", "air"],
  by_rail: ["by_rail", "rail", "train"],
};

/** Case-, space- and punctuation-insensitive form used on BOTH sides of a match ("DG-26 104w" ≡ "dg26104W"). */
export function normalizeTrackingKey(value: string): string {
  return String(value ?? "").toLowerCase().replace(/[\s\-_/.,]+/g, "");
}
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * SQL expressions searched per field. Every alias is joined in {@link trackingFrom}:
 *   o = clearing_customer_orders, al = its legs (ALL legs, so a container / vessel / truck of any leg matches),
 *   sl = shipping line, bl = BL record, h = business handover.
 */
const FIELD_EXPRESSIONS: Record<Exclude<TrackingSearchField, "all">, string[]> = {
  shipment: ["o.order_no", "h.handover_no", "h.business_reference_no"],
  bl: ["al.bl_number", "bl.bl_number", "h.bl_reference", "al.airway_bill_no"],
  container: ["al.container_number", "al.rail_container_number", "bl.container_number", "array_to_string(h.container_numbers, ' ')"],
  vessel: ["al.vessel_name", "bl.vessel_name"],
  voyage: ["al.voyage_number", "bl.voyage_number", "al.flight_number"],
  customer: ["o.customer_name"],
  carrier: ["sl.name", "bl.shipping_line_name", "al.airline_name", "al.railway_operator"],
  truck: ["al.truck_number", "o.truck_number"],
  transport: ["al.flight_number", "al.airway_bill_no", "al.wagon_number", "al.railway_operator", "al.airline_name"],
};
const ALL_EXPRESSIONS = Array.from(new Set(Object.values(FIELD_EXPRESSIONS).flat()));

/** FROM / JOIN part shared by the list, its count and the search so all three always agree. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trackingFrom(sql: any) {
  return sql`
    FROM public.clearing_customer_orders o
    LEFT JOIN public.clearing_customer_order_legs al ON al.order_id = o.id AND al.deleted_at IS NULL
    LEFT JOIN public.shipping_lines sl ON sl.id = al.shipping_line_id AND sl.deleted_at IS NULL
    LEFT JOIN public.business_shipping_handovers h ON h.shipping_request_id = o.id AND h.deleted_at IS NULL
    LEFT JOIN public.shipping_bl_records bl ON (bl.order_id = o.id OR bl.leg_id = al.id) AND bl.deleted_at IS NULL`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function searchCondition(sql: any, query: string, field: TrackingSearchField) {
  const raw = (query || "").trim().toLowerCase();
  if (!raw) return sql``;
  const like = `%${escapeLike(raw)}%`;
  const nq = normalizeTrackingKey(query);
  const nlike = `%${escapeLike(nq)}%`;
  const exprs = field === "all" ? ALL_EXPRESSIONS : FIELD_EXPRESSIONS[field] ?? ALL_EXPRESSIONS;
  const parts = exprs.map((e) => {
    const col = sql.unsafe(`coalesce((${e})::text, '')`);
    return nq
      ? sql`(lower(${col}) LIKE ${like} OR regexp_replace(lower(${col}), '[\\s\\-_/.,]+', '', 'g') LIKE ${nlike})`
      : sql`lower(${col}) LIKE ${like}`;
  });
  let cond = parts[0];
  for (let i = 1; i < parts.length; i++) cond = sql`${cond} OR ${parts[i]}`;
  return sql`AND (${cond})`;
}

export type TrackingListFilter = {
  query?: string;
  field?: TrackingSearchField;
  domain: "business" | "shipping" | "both";
  mode?: string;
  status?: string;
  view?: "all" | "containers" | "shipments" | "trucks";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function whereClause(sql: any, session: ErpSession, f: TrackingListFilter) {
  const scope = sqlScopeCondition(sql, sessionSqlScope(session), "o");
  const mode = f.mode && f.mode !== "all" && (TRACKING_MODES as readonly string[]).includes(f.mode) ? sql`AND (al.transport_mode = ${f.mode} OR (al.id IS NULL AND lower(coalesce(o.transport_mode, '')) IN ${sql(LEGACY_MODE_VALUES[f.mode])}))` : sql``;
  let status = sql``;
  if (f.status && f.status !== "all") {
    status =
      f.status === "delayed"
        ? sql`AND o.current_stage <> 'completed' AND o.updated_at < NOW() - INTERVAL '7 days'`
        : sql`AND o.current_stage = ${f.status}`;
  }
  const view =
    f.view === "containers"
      ? sql`AND (coalesce(al.container_number,'') <> '' OR coalesce(al.rail_container_number,'') <> '' OR coalesce(bl.container_number,'') <> '')`
      : f.view === "trucks"
      ? sql`AND (coalesce(al.truck_number,'') <> '' OR coalesce(o.truck_number,'') <> '')`
      : sql``;
  const domain = f.domain === "business" ? sql`AND h.id IS NOT NULL` : sql``;
  return sql`WHERE o.deleted_at IS NULL AND ${scope} ${domain} ${mode} ${status} ${view} ${searchCondition(sql, f.query ?? "", f.field ?? "all")}`;
}

const DASH = "—";

export class ShipmentTrackingService {
  /**
   * Compact search used by the quick-search endpoint (same matching rules as the list).
   */
  async searchTracking(query: string, domain: "business" | "shipping" | "both", session: ErpSession, limit = 50, field: TrackingSearchField = "all") {
    const r = await this.searchTrackingList(query, domain, session, Math.min(limit, 100), 0, undefined, undefined, field);
    return (r?.rows ?? []).map((row) => ({
      id: row.id,
      orderNo: row.orderNo,
      customerName: row.customerName,
      currentStage: row.currentStage,
      containerNumber: row.containerNumber,
      blNumber: row.blNumber,
      vesselName: row.vesselName,
      voyageNumber: row.voyageNumber,
      shippingLineName: row.shippingLine,
      pol: row.from,
      pod: row.to,
      etd: row.etd,
      eta: row.eta,
      transportMode: row.transportMode,
      createdAt: row.createdAt,
      isBusinessHandover: row.isBusinessHandover,
      businessReferenceNo: row.businessReferenceNo,
      businessSourceModule: row.businessSourceModule,
    }));
  }

  /**
   * Full canonical tracking details for a single shipment (all legs of every mode, events, BL, handover).
   */
  async getTrackingDetails(
    idOrNumber: string,
    domain: "business" | "shipping" | "both",
    session: ErpSession
  ): Promise<CanonicalTrackingPayload | null> {
    return withLocalPg(async (sql) => {
      const key = String(idOrNumber ?? "").trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
      const orders = (await sql`
        SELECT *
        FROM public.clearing_customer_orders
        WHERE ${isUuid ? sql`id = ${key}::uuid` : sql`lower(order_no) = ${key.toLowerCase()}`}
          AND deleted_at IS NULL
        LIMIT 1
      `) as any[];

      if (!orders.length) return null;
      const order = orders[0];

      // Strict scope: the same rule as the list. Never reveal that an out-of-scope shipment exists.
      if (!recordInSessionScope(session, order)) return null;

      const legs = (await sql`
        SELECT l.*, sl.name AS shipping_line_name, t.truck_number AS master_truck_number
        FROM public.clearing_customer_order_legs l
        LEFT JOIN public.shipping_lines sl ON sl.id = l.shipping_line_id AND sl.deleted_at IS NULL
        LEFT JOIN public.trucks t ON t.id = l.truck_id AND t.deleted_at IS NULL
        WHERE l.order_id = ${order.id} AND l.deleted_at IS NULL
        ORDER BY l.leg_no ASC
      `) as any[];

      const events = (await sql`
        SELECT *
        FROM public.shipment_tracking_events
        WHERE order_id = ${order.id} AND deleted_at IS NULL
        ORDER BY event_time DESC, created_at DESC
      `) as any[];

      const legBls = legs.map((l) => l.bl_number).filter(Boolean);
      const blRecords = (await sql`
        SELECT *
        FROM public.shipping_bl_records
        WHERE (order_id = ${order.id} ${legBls.length ? sql`OR bl_number = ANY(${legBls}::text[])` : sql``})
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `) as any[];
      const blRecord = blRecords[0] ?? null;

      const handovers = (await sql`
        SELECT h.id, h.handover_no, h.business_source_module, h.business_source_id,
               h.business_reference_no, h.contract_reference, h.container_numbers,
               h.shared_payload, h.status, h.created_at
        FROM public.business_shipping_handovers h
        WHERE h.shipping_request_id = ${order.id} AND h.deleted_at IS NULL
        LIMIT 1
      `) as any[];
      const handover = handovers[0] ?? null;

      // the business tracking view only ever shows shipments that came from a business handover
      if (domain === "business" && !handover) return null;

      const activeLeg =
        legs.find((l) => l.id === order.current_leg_id) ||
        legs.find((l) => l.status !== "completed") ||
        legs[legs.length - 1] ||
        null;

      const containerNumber =
        activeLeg?.container_number ||
        activeLeg?.rail_container_number ||
        blRecord?.container_number ||
        (handover?.container_numbers?.length ? handover.container_numbers.join(", ") : null) ||
        DASH;
      const blNumber = activeLeg?.bl_number || activeLeg?.airway_bill_no || blRecord?.bl_number || handover?.bl_reference || DASH;
      const vesselName = activeLeg?.vessel_name || blRecord?.vessel_name || DASH;
      const voyageNumber = activeLeg?.voyage_number || activeLeg?.flight_number || blRecord?.voyage_number || DASH;
      const shippingLine = activeLeg?.shipping_line_name || activeLeg?.airline_name || activeLeg?.railway_operator || blRecord?.shipping_line_name || DASH;
      const pol = activeLeg?.port_of_loading || activeLeg?.from_location_text || blRecord?.loading_port || order.loading_port_name || DASH;
      const pod = activeLeg?.port_of_discharge || activeLeg?.to_location_text || blRecord?.discharge_port || order.destination_port_name || DASH;
      const etd = activeLeg?.etd || blRecord?.etd || null;
      const eta = activeLeg?.eta || blRecord?.eta || null;

      const latestEvent = events[0] ?? null;
      const currentLocation = latestEvent?.location_name || (latestEvent?.event_name ? `${latestEvent.event_name}` : null) || pol;

      return {
        shipment: {
          id: order.id,
          order_no: order.order_no,
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          route_name: order.route_name,
          transport_mode: order.transport_mode,
          movement_type: order.movement_type,
          current_stage: order.current_stage || "booking",
          current_leg_id: order.current_leg_id,
          loading_country_name: order.loading_country_name,
          receiving_country_name: order.receiving_country_name,
          loading_port_name: order.loading_port_name,
          destination_port_name: order.destination_port_name,
          goods_name: order.cargo_details || null,
          goods_quantity: order.goods_quantity,
          goods_unit: order.goods_unit,
          goods_gross_weight: order.goods_gross_weight,
          goods_net_weight: order.goods_net_weight,
          created_at: order.created_at,
          country_id: order.country_id,
          city_branch_id: order.city_branch_id,
        },
        kpis: {
          currentStatus: latestEvent?.event_name || order.current_stage?.replace(/_/g, " ").toUpperCase() || "BOOKED",
          currentLocation: currentLocation || "In Transit",
          containerNumber,
          shippingLine,
          blNumber,
          vesselName,
          voyageNumber,
          pol,
          pod,
          etd: etd ? String(etd) : null,
          eta: eta ? String(eta) : null,
          lastUpdate: latestEvent?.event_time || order.updated_at || order.created_at,
          activeLegNo: activeLeg?.leg_no || 1,
          totalLegs: legs.length || 1,
        },
        activeLeg: activeLeg ? { ...activeLeg } : null,
        legs: legs.map((l) => ({ ...l })),
        events: events.map((e) => ({ ...e })),
        blRecord: blRecord ? { ...blRecord } : null,
        handover: handover ? { ...handover } : null,
      };
    });
  }

  /**
   * Add a tracking milestone event, update ETA, or log a vessel/voyage change.
   */
  async recordTrackingEvent(
    input: {
      orderId: string;
      legId?: string | null;
      eventCode: TrackingEventCode;
      eventName?: string;
      locationName?: string;
      eventTime?: string;
      status?: "scheduled" | "in_progress" | "completed" | "delayed";
      providerName?: string;
      vesselName?: string;
      voyageNumber?: string;
      containerNumber?: string;
      eta?: string;
      remarks?: string;
    },
    session: ErpSession
  ): Promise<TrackingEventRow> {
    return withLocalPg(async (sql) => {
      const orders = (await sql`
        SELECT * FROM public.clearing_customer_orders
        WHERE id = ${input.orderId} AND deleted_at IS NULL
      `) as any[];
      // out-of-scope and missing look the same
      if (!orders.length || !recordInSessionScope(session, orders[0])) {
        throw new ApiClientError("Shipment not found.", { status: 404, code: "TRACKING_NOT_FOUND" });
      }
      const order = orders[0];

      // an event can only belong to a leg of THIS shipment
      let legId: string | null = input.legId || order.current_leg_id || null;
      if (input.legId) {
        const own = (await sql`SELECT 1 FROM public.clearing_customer_order_legs WHERE id = ${input.legId}::uuid AND order_id = ${order.id} AND deleted_at IS NULL`) as any[];
        if (!own.length) throw new ApiClientError("That leg does not belong to this shipment.", { status: 400, code: "LEG_MISMATCH" });
      }

      const eventName = input.eventName || TRACKING_EVENT_LABELS[input.eventCode] || input.eventCode;
      const when = input.eventTime ? new Date(input.eventTime) : new Date();
      if (Number.isNaN(when.getTime())) throw new ApiClientError("The event time is not a valid date.", { status: 400, code: "BAD_EVENT_TIME" });
      const eta = input.eta ? new Date(input.eta) : null;
      if (eta && Number.isNaN(eta.getTime())) throw new ApiClientError("The ETA is not a valid date.", { status: 400, code: "BAD_ETA" });
      const status = input.status || "completed";

      const inserted = (await sql`
        INSERT INTO public.shipment_tracking_events (
          order_id, leg_id, event_code, event_name, location_name, event_time, status,
          provider_name, vessel_name, voyage_number, container_number, eta, remarks, created_by
        ) VALUES (
          ${order.id}, ${legId}, ${input.eventCode}, ${eventName}, ${input.locationName || null}, ${when.toISOString()}, ${status},
          ${input.providerName || null}, ${input.vesselName || null}, ${input.voyageNumber || null}, ${input.containerNumber || null},
          ${eta ? eta.toISOString() : null}, ${input.remarks || null}, ${session.userId}
        ) RETURNING *
      `) as any[];
      const eventRow = inserted[0];

      // keep the leg and the linked BL record in step with the latest known vessel / voyage / container / ETA
      if (legId) {
        await sql`
          UPDATE public.clearing_customer_order_legs
          SET vessel_name = coalesce(${input.vesselName || null}, vessel_name),
              voyage_number = coalesce(${input.voyageNumber || null}, voyage_number),
              container_number = coalesce(${input.containerNumber || null}, container_number),
              eta = coalesce(${eta ? eta.toISOString() : null}, eta),
              updated_at = now()
          WHERE id = ${legId}
        `;
      }
      await sql`
        UPDATE public.shipping_bl_records
        SET vessel_name = coalesce(${input.vesselName || null}, vessel_name),
            voyage_number = coalesce(${input.voyageNumber || null}, voyage_number),
            container_number = coalesce(${input.containerNumber || null}, container_number),
            eta = coalesce(${eta ? eta.toISOString().slice(0, 10) : null}::date, eta),
            updated_at = now()
        WHERE order_id = ${order.id}
      `;
      return eventRow;
    });
  }

  /**
   * Enriched tracking list (also the source of the CSV / print export).
   */
  async searchTrackingList(
    query: string,
    domain: "business" | "shipping" | "both",
    session: ErpSession,
    limit = 100,
    offset = 0,
    modeFilter?: string,
    statusFilter?: string,
    field: TrackingSearchField = "all",
    view: "all" | "containers" | "shipments" | "trucks" = "all"
  ) {
    const filter: TrackingListFilter = { query, field, domain, mode: modeFilter, status: statusFilter, view };
    return withLocalPg(async (sql) => {
      const where = whereClause(sql, session, filter);

      const countRows = (await sql`SELECT COUNT(DISTINCT o.id)::int AS total ${trackingFrom(sql)} ${where}`) as any[];
      const total = countRows[0]?.total ?? 0;

      const rows = (await sql`
        SELECT * FROM (
          SELECT DISTINCT ON (o.created_at, o.id)
            o.id, o.order_no, o.customer_name, o.current_stage,
            o.transport_mode AS order_transport_mode,
            o.loading_port_name, o.destination_port_name,
            o.loading_country_name, o.receiving_country_name,
            o.created_at, o.country_id, o.country_branch_id, o.city_branch_id,
            o.truck_number AS order_truck_number,
            al.id AS leg_id, al.leg_no,
            al.transport_mode AS leg_transport_mode,
            al.vessel_name, al.voyage_number, al.container_number, al.bl_number,
            al.truck_number AS leg_truck_number, al.truck_driver_name,
            al.airline_name, al.flight_number, al.airway_bill_no,
            al.railway_operator, al.wagon_number, al.rail_container_number,
            al.port_of_loading, al.port_of_discharge, al.eta, al.etd, al.status AS leg_status,
            al.from_location_text, al.to_location_text,
            sl.name AS shipping_line_name,
            bl.bl_number AS bl_rec_number, bl.container_number AS bl_rec_container,
            bl.vessel_name AS bl_rec_vessel, bl.voyage_number AS bl_rec_voyage,
            bl.shipping_line_name AS bl_rec_shipping_line,
            bl.loading_port AS bl_rec_pol, bl.discharge_port AS bl_rec_pod, bl.eta AS bl_rec_eta,
            h.id AS handover_id, h.business_reference_no, h.business_source_module,
            (SELECT COUNT(*)::int FROM public.clearing_customer_order_legs x WHERE x.order_id = o.id AND x.deleted_at IS NULL) AS leg_count,
            (SELECT array_agg(DISTINCT x.transport_mode) FROM public.clearing_customer_order_legs x WHERE x.order_id = o.id AND x.deleted_at IS NULL) AS leg_modes,
            ev.location_name AS current_location,
            ev.event_name AS latest_event_name, ev.event_time AS latest_event_time
          ${trackingFrom(sql)}
          LEFT JOIN LATERAL (
            SELECT e.location_name, e.event_name, e.event_time
            FROM public.shipment_tracking_events e
            WHERE e.order_id = o.id AND e.deleted_at IS NULL
            ORDER BY e.event_time DESC, e.created_at DESC LIMIT 1
          ) ev ON true
          ${where}
          -- one row per shipment: the leg that matched; otherwise the current leg, then the first unfinished leg
          ORDER BY o.created_at DESC, o.id,
                   (al.id IS NOT DISTINCT FROM o.current_leg_id) DESC,
                   (coalesce(al.status, '') = 'completed') ASC,
                   al.leg_no ASC NULLS LAST
        ) page
        ORDER BY page.created_at DESC, page.id
        LIMIT ${limit} OFFSET ${offset}
      `) as any[];

      return {
        total,
        rows: rows.map((r) => {
          const mode = normalizeTrackingMode(r.leg_transport_mode || r.order_transport_mode);
          const vessel = r.vessel_name || r.bl_rec_vessel;
          const voyage = r.voyage_number || r.bl_rec_voyage || r.flight_number;
          return {
            id: r.id as string,
            orderNo: r.order_no as string,
            customerName: (r.customer_name as string) || DASH,
            currentStage: (r.current_stage as string) || "booking",
            blNumber: r.bl_number || r.bl_rec_number || r.airway_bill_no || DASH,
            containerNumber: r.container_number || r.rail_container_number || r.bl_rec_container || DASH,
            truckNumber: r.leg_truck_number || r.order_truck_number || DASH,
            truckDriverName: (r.truck_driver_name as string) || null,
            shippingLine: r.shipping_line_name || r.bl_rec_shipping_line || r.airline_name || r.railway_operator || DASH,
            vesselName: vessel || DASH,
            voyageNumber: voyage || DASH,
            vesselVoyage: vessel ? `${vessel}${voyage ? ` / ${voyage}` : ""}` : r.flight_number ? String(r.flight_number) : r.wagon_number ? String(r.wagon_number) : DASH,
            flightNumber: (r.flight_number as string) || null,
            airwayBillNo: (r.airway_bill_no as string) || null,
            wagonNumber: (r.wagon_number as string) || null,
            from: r.from_location_text || r.port_of_loading || r.bl_rec_pol || r.loading_port_name || r.loading_country_name || DASH,
            to: r.to_location_text || r.port_of_discharge || r.bl_rec_pod || r.destination_port_name || r.receiving_country_name || DASH,
            transportMode: mode as string,
            legCount: Number(r.leg_count ?? 1) || 1,
            legModes: Array.from(new Set(((r.leg_modes as string[] | null) ?? [mode]).map(normalizeTrackingMode))),
            currentLocation: r.current_location || r.latest_event_name || r.from_location_text || r.port_of_loading || r.loading_port_name || DASH,
            eta: r.eta || r.bl_rec_eta || null,
            etd: r.etd || null,
            legId: (r.leg_id as string) || null,
            legNo: r.leg_no || 1,
            legStatus: (r.leg_status as string) || null,
            latestEventTime: r.latest_event_time || null,
            createdAt: r.created_at as string,
            isBusinessHandover: Boolean(r.handover_id),
            businessReferenceNo: (r.business_reference_no as string) || null,
            businessSourceModule: (r.business_source_module as string) || null,
          };
        }),
      };
    });
  }
}

export const shipmentTrackingService = new ShipmentTrackingService();
