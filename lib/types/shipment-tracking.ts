export const TRACKING_EVENT_CODES = [
  "booking_confirmed",
  "empty_picked_up",
  "gate_in",
  "loaded",
  "vessel_departed",
  "transshipment",
  "vessel_voyage_change",
  "arrived",
  "discharged",
  "gate_out",
  "empty_returned",
  "closed",
] as const;

export type TrackingEventCode = (typeof TRACKING_EVENT_CODES)[number];

export const TRACKING_EVENT_LABELS: Record<TrackingEventCode, string> = {
  booking_confirmed: "Booking Confirmed",
  empty_picked_up: "Empty Picked Up",
  gate_in: "Gate In",
  loaded: "Loaded",
  vessel_departed: "Vessel Departed",
  transshipment: "Transshipment",
  vessel_voyage_change: "Vessel/Voyage Change",
  arrived: "Arrived",
  discharged: "Discharged",
  gate_out: "Gate Out",
  empty_returned: "Empty Returned",
  closed: "Closed",
};

export type TrackingEventRow = {
  id: string;
  order_id: string;
  leg_id: string | null;
  event_code: TrackingEventCode;
  event_name: string;
  location_name: string | null;
  event_time: string;
  status: "scheduled" | "in_progress" | "completed" | "delayed";
  provider_name: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  container_number: string | null;
  eta: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
};

export type CanonicalTrackingPayload = {
  shipment: {
    id: string;
    order_no: string;
    customer_id: string | null;
    customer_name: string;
    route_name: string | null;
    transport_mode: string;
    movement_type: string;
    current_stage: string;
    current_leg_id: string | null;
    loading_country_name: string | null;
    receiving_country_name: string | null;
    loading_port_name: string | null;
    destination_port_name: string | null;
    goods_name: string | null;
    goods_quantity: number | null;
    goods_unit: string | null;
    goods_gross_weight: number | null;
    goods_net_weight: number | null;
    created_at: string;
    country_id: string | null;
    city_branch_id: string | null;
  };
  kpis: {
    currentStatus: string;
    currentLocation: string;
    containerNumber: string;
    shippingLine: string;
    blNumber: string;
    vesselName: string;
    voyageNumber: string;
    pol: string;
    pod: string;
    etd: string | null;
    eta: string | null;
    lastUpdate: string;
    activeLegNo: number;
    totalLegs: number;
  };
  activeLeg: Record<string, any> | null;
  legs: Array<Record<string, any>>;
  events: TrackingEventRow[];
  blRecord: Record<string, any> | null;
  handover: Record<string, any> | null;
};
