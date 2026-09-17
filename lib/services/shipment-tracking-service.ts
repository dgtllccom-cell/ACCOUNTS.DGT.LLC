import { withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";
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

function hasScopeAccess(session: ErpSession, row: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }): boolean {
  if (session.isSuperAdmin) return true;
  const countryIds = session.countryIds ?? [];
  const countryBranchIds = session.countryBranchIds ?? [];
  const cityBranchIds = session.cityBranchIds ?? [];

  if (row.city_branch_id && cityBranchIds.length > 0 && !cityBranchIds.includes(row.city_branch_id)) return false;
  if (row.country_branch_id && countryBranchIds.length > 0 && !countryBranchIds.includes(row.country_branch_id)) return false;
  if (row.country_id && countryIds.length > 0 && !countryIds.includes(row.country_id)) return false;
  return true;
}

export class ShipmentTrackingService {
  /**
   * Search shipments by any of the 8 canonical identifiers:
   * 1. Shipment Number (order_no)
   * 2. Customer Order Number
   * 3. BL Number
   * 4. Container Number
   * 5. Vessel Name
   * 6. Voyage Number
   * 7. Customer Name
   * 8. Shipping Line Name
   */
  async searchTracking(
    query: string,
    domain: "business" | "shipping" | "both",
    session: ErpSession,
    limit = 50
  ) {
    return withLocalPg(async (sql) => {
      const q = `%${(query || "").trim().toLowerCase()}%`;
      const hasQ = query.trim().length > 0;

      // Base query joining clearing_customer_orders with legs and BL records
      const rows = (await sql`
        SELECT DISTINCT ON (o.id)
          o.id,
          o.order_no,
          o.customer_name,
          o.route_name,
          o.transport_mode,
          o.movement_type,
          o.current_stage,
          o.loading_port_name,
          o.destination_port_name,
          o.country_id,
          o.country_branch_id,
          o.city_branch_id,
          o.created_at,
          l.id AS active_leg_id,
          l.leg_no,
          l.transport_mode AS leg_transport_mode,
          l.vessel_name,
          l.voyage_number,
          l.container_number,
          l.bl_number,
          l.shipping_line_id,
          l.port_of_loading,
          l.port_of_discharge,
          l.eta,
          l.etd,
          l.status AS leg_status,
          sl.name AS shipping_line_name,
          h.id AS handover_id,
          h.handover_no,
          h.business_source_module,
          h.business_reference_no,
          bl.bl_number AS bl_record_bl_number,
          bl.container_number AS bl_record_container_number
        FROM public.clearing_customer_orders o
        LEFT JOIN public.clearing_customer_order_legs l ON l.order_id = o.id AND l.deleted_at IS NULL
        LEFT JOIN public.shipping_lines sl ON sl.id = l.shipping_line_id AND sl.deleted_at IS NULL
        LEFT JOIN public.business_shipping_handovers h ON h.shipping_request_id = o.id AND h.deleted_at IS NULL
        LEFT JOIN public.shipping_bl_records bl ON (bl.order_id = o.id OR bl.bl_number = l.bl_number) AND bl.deleted_at IS NULL
        WHERE o.deleted_at IS NULL
        ${
          hasQ
            ? sql`AND (
                lower(o.order_no) LIKE ${q}
                OR lower(coalesce(o.customer_name, '')) LIKE ${q}
                OR lower(coalesce(l.bl_number, '')) LIKE ${q}
                OR lower(coalesce(bl.bl_number, '')) LIKE ${q}
                OR lower(coalesce(l.container_number, '')) LIKE ${q}
                OR lower(coalesce(bl.container_number, '')) LIKE ${q}
                OR lower(coalesce(l.vessel_name, '')) LIKE ${q}
                OR lower(coalesce(bl.vessel_name, '')) LIKE ${q}
                OR lower(coalesce(l.voyage_number, '')) LIKE ${q}
                OR lower(coalesce(bl.voyage_number, '')) LIKE ${q}
                OR lower(coalesce(sl.name, '')) LIKE ${q}
                OR lower(coalesce(bl.shipping_line_name, '')) LIKE ${q}
                OR lower(coalesce(h.handover_no, '')) LIKE ${q}
                OR lower(coalesce(h.business_reference_no, '')) LIKE ${q}
              )`
            : sql``
        }
        ${
          domain === "business"
            ? sql`AND h.id IS NOT NULL`
            : sql``
        }
        ORDER BY o.id, l.leg_no ASC
        LIMIT ${limit}
      `) as any[];

      // Filter by session scope
      const filtered = rows.filter((r) => hasScopeAccess(session, r));

      return filtered.map((r) => ({
        id: r.id,
        orderNo: r.order_no,
        customerName: r.customer_name,
        currentStage: r.current_stage || "booking",
        containerNumber: r.container_number || r.bl_record_container_number || "—",
        blNumber: r.bl_number || r.bl_record_bl_number || "—",
        vesselName: r.vessel_name || "—",
        voyageNumber: r.voyage_number || "—",
        shippingLineName: r.shipping_line_name || "—",
        pol: r.port_of_loading || r.loading_port_name || "—",
        pod: r.port_of_discharge || r.destination_port_name || "—",
        etd: r.etd,
        eta: r.eta,
        transportMode: r.leg_transport_mode || r.transport_mode || "by_sea",
        createdAt: r.created_at,
        isBusinessHandover: Boolean(r.handover_id),
        businessReferenceNo: r.business_reference_no || null,
        businessSourceModule: r.business_source_module || null,
      }));
    });
  }

  /**
   * Get full canonical tracking details for a single shipment
   */
  async getTrackingDetails(
    idOrNumber: string,
    domain: "business" | "shipping" | "both",
    session: ErpSession
  ): Promise<CanonicalTrackingPayload | null> {
    return withLocalPg(async (sql) => {
      // 1. Fetch Order
      const orders = (await sql`
        SELECT *
        FROM public.clearing_customer_orders
        WHERE (id::text = ${idOrNumber} OR lower(order_no) = ${idOrNumber.toLowerCase().trim()})
          AND deleted_at IS NULL
        LIMIT 1
      `) as any[];

      if (!orders.length) return null;
      const order = orders[0];

      if (!hasScopeAccess(session, order)) {
        throw new Error("Shipment is outside your authorized scope.");
      }

      // 2. Fetch all legs ordered by leg_no
      const legs = (await sql`
        SELECT l.*, sl.name AS shipping_line_name, t.truck_number AS master_truck_number
        FROM public.clearing_customer_order_legs l
        LEFT JOIN public.shipping_lines sl ON sl.id = l.shipping_line_id AND sl.deleted_at IS NULL
        LEFT JOIN public.trucks t ON t.id = l.truck_id AND t.deleted_at IS NULL
        WHERE l.order_id = ${order.id} AND l.deleted_at IS NULL
        ORDER BY l.leg_no ASC
      `) as any[];

      // 3. Fetch all tracking events
      const events = (await sql`
        SELECT *
        FROM public.shipment_tracking_events
        WHERE order_id = ${order.id} AND deleted_at IS NULL
        ORDER BY event_time DESC, created_at DESC
      `) as any[];

      // 4. Fetch BL record if linked
      const blRecords = (await sql`
        SELECT *
        FROM public.shipping_bl_records
        WHERE (order_id = ${order.id} OR bl_number = ANY(${legs.map((l) => l.bl_number).filter(Boolean)}))
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `) as any[];
      const blRecord = blRecords[0] ?? null;

      // 5. Fetch Handover record if linked
      const handovers = (await sql`
        SELECT h.id, h.handover_no, h.business_source_module, h.business_source_id,
               h.business_reference_no, h.contract_reference, h.container_numbers,
               h.shared_payload, h.status, h.created_at
        FROM public.business_shipping_handovers h
        WHERE h.shipping_request_id = ${order.id} AND h.deleted_at IS NULL
        LIMIT 1
      `) as any[];
      const handover = handovers[0] ?? null;

      // Active leg resolution
      const activeLeg =
        legs.find((l) => l.id === order.current_leg_id) ||
        legs.find((l) => l.status !== "completed") ||
        legs[legs.length - 1] ||
        null;

      // Derive key metrics
      const containerNumber =
        activeLeg?.container_number ||
        blRecord?.container_number ||
        (handover?.container_numbers?.length ? handover.container_numbers.join(", ") : null) ||
        "—";

      const blNumber = activeLeg?.bl_number || blRecord?.bl_number || handover?.bl_reference || "—";
      const vesselName = activeLeg?.vessel_name || blRecord?.vessel_name || "—";
      const voyageNumber = activeLeg?.voyage_number || blRecord?.voyage_number || "—";
      const shippingLine = activeLeg?.shipping_line_name || blRecord?.shipping_line_name || "—";
      const pol = activeLeg?.port_of_loading || blRecord?.loading_port || order.loading_port_name || "—";
      const pod = activeLeg?.port_of_discharge || blRecord?.discharge_port || order.destination_port_name || "—";
      const etd = activeLeg?.etd || blRecord?.etd || null;
      const eta = activeLeg?.eta || blRecord?.eta || null;

      const latestEvent = events[0] ?? null;
      const currentLocation =
        latestEvent?.location_name ||
        (latestEvent?.event_name ? `${latestEvent.event_name}` : null) ||
        pol;

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
   * Add a tracking milestone event, update ETA, or log a vessel/voyage change
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
      // Check order
      const orders = (await sql`
        SELECT * FROM public.clearing_customer_orders
        WHERE id = ${input.orderId} AND deleted_at IS NULL
      `) as any[];
      if (!orders.length) throw new Error("Shipment not found.");
      const order = orders[0];

      if (!hasScopeAccess(session, order)) {
        throw new Error("Shipment is outside your authorized scope.");
      }

      const eventName = input.eventName || TRACKING_EVENT_LABELS[input.eventCode] || input.eventCode;
      const eventTime = input.eventTime ? new Date(input.eventTime).toISOString() : new Date().toISOString();
      const status = input.status || "completed";

      // 1. Insert tracking event
      const inserted = (await sql`
        INSERT INTO public.shipment_tracking_events (
          order_id,
          leg_id,
          event_code,
          event_name,
          location_name,
          event_time,
          status,
          provider_name,
          vessel_name,
          voyage_number,
          container_number,
          eta,
          remarks,
          created_by
        ) VALUES (
          ${order.id},
          ${input.legId || order.current_leg_id || null},
          ${input.eventCode},
          ${eventName},
          ${input.locationName || null},
          ${eventTime},
          ${status},
          ${input.providerName || null},
          ${input.vesselName || null},
          ${input.voyageNumber || null},
          ${input.containerNumber || null},
          ${input.eta ? new Date(input.eta).toISOString() : null},
          ${input.remarks || null},
          ${session.userId}
        ) RETURNING *
      `) as any[];

      const eventRow = inserted[0];

      // 2. Synchronize active leg if vessel, voyage, container, or ETA changed
      const legId = input.legId || order.current_leg_id;
      if (legId) {
        await sql`
          UPDATE public.clearing_customer_order_legs
          SET
            vessel_name = coalesce(${input.vesselName || null}, vessel_name),
            voyage_number = coalesce(${input.voyageNumber || null}, voyage_number),
            container_number = coalesce(${input.containerNumber || null}, container_number),
            eta = coalesce(${input.eta ? new Date(input.eta).toISOString() : null}, eta),
            updated_at = now()
          WHERE id = ${legId}
        `;
      }

      // 3. Synchronize linked BL record if any
      await sql`
        UPDATE public.shipping_bl_records
        SET
          vessel_name = coalesce(${input.vesselName || null}, vessel_name),
          voyage_number = coalesce(${input.voyageNumber || null}, voyage_number),
          container_number = coalesce(${input.containerNumber || null}, container_number),
          eta = coalesce(${input.eta ? new Date(input.eta).toISOString() : null}, eta),
          updated_at = now()
        WHERE order_id = ${order.id}
      `;

      return eventRow;
    });
  }
}

export const shipmentTrackingService = new ShipmentTrackingService();
