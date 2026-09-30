"use client";

import { pl } from "@/lib/reports/print-label";
import React, { Fragment, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  BadgeInfo,
  Building2,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Container,
  Download,
  Eye,
  FileText,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Repeat2,
  Route,
  Save,
  Search,
  Truck,
  Users,
  Warehouse,
  Wallet,
  CreditCard,
  Ship,
  Globe2,
  Filter,
  MoreVertical,
  Calendar,
  Layers,
  Scale,
  Sparkles,
  ChevronDown,
  Trash2,
  X,
  Hash,
  Train,
  User,
  ArrowRightLeft,
  Clock,
  RotateCcw,
  Activity,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck
} from "lucide-react";

import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Th } from "@/components/ui/translated-th";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { SmartSearchFilter, type SmartFilterState } from "@/components/ui/smart-search-filter";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { ClearingCustomerOrderRow, PartyLinkInput, PartyRoleKey } from "@/lib/services/clearing-customer-order-service";
import { TruckEntryPicker, type TruckEntryValue } from "@/features/clearing-agent/components/truck-entry-picker";
import { GoodsPicker, type GoodsPickerValue } from "@/features/goods-master/components/goods-picker";
import { WarehousePicker } from "@/features/warehouses/components/warehouse-picker";
import { ClearingAgentPicker } from "@/features/shipping/components/clearing-agent-picker";
import { ShippingLinePicker } from "@/features/shipping/components/shipping-line-picker";
import { LocationPicker } from "@/features/location-master/components/location-picker";
import { useBranchUserContext, type BranchUserContext } from "@/lib/hooks/use-branch-user-context";
import { DocumentAttachmentIcon } from "@/components/documents/document-attachment-icon";
import { VoiceDictateButton } from "@/components/voice-dictate-button";
import { listCities } from "@/features/locations/location-api";
import { useSetActiveRecord } from "@/lib/support/active-record-context";
import { TaskHandoverModal } from "@/features/transfer-center/components/task-handover-modal";
import {
  BranchScopeDropdown,
  type BranchScopeValue,
  type BranchScopeCountry,
  type BranchScopeCountryBranch,
  type BranchScopeCityBranch
} from "@/features/purchases/components/branch-scope-dropdown";
import { CustomerOrderActivityTimelineModal } from "@/features/clearing-agent/components/customer-order-activity-timeline-modal";
import { CustomerOrderReturnCorrectionModal } from "@/features/clearing-agent/components/customer-order-return-correction-modal";
import { CustomerOrderStageAssignmentModal } from "@/features/clearing-agent/components/customer-order-stage-assignment-modal";
import { CustomerOrderRouteBuilder } from "@/features/clearing-agent/components/customer-order-route-builder";
import { CustomerOrderPartnerBillsPanel } from "@/features/clearing-agent/components/customer-order-partner-bills-panel";
import { CustomerOrderInsurancePanel } from "@/features/clearing-agent/components/customer-order-insurance-panel";

type TransportMode = "by_sea" | "by_road" | "by_air" | "by_rail";
type MovementType = "import" | "export" | "transit" | "up_transit" | "down_transit" | "domestic";
type LoadingSource = "shipping_warehouse" | "customer_warehouse" | "container" | "port_terminal" | "border_yard" | "other";
type LoadType = "full_truck" | "partial_load" | "container_haulage";
type LegTransportMode = "by_sea" | "by_road" | "by_air" | "by_rail";
type ClearanceType = "import" | "export" | "transit";
type DutyTreatment = "duty_payable" | "no_duty_exempt" | "transit_bonded" | "pending";
type LegCustomsStatus = "not_applicable" | "pending" | "submitted" | "cleared" | "held" | "rejected";

// One goods line, sourced from more than one warehouse/location — the order's own
// goods_id/goods_name/goods_quantity remains the single order-level total; this is
// only the breakdown of WHERE that total quantity is being picked up from.
type LoadingAllocation = {
  id?: string;
  rowSerial: number;
  warehouseId: string;
  warehouseName: string;
  sourceLocationText: string;
  quantity: string;
  unit: string;
  remarks: string;
};

function emptyLoadingAllocation(rowSerial: number): LoadingAllocation {
  return { rowSerial, warehouseId: "", warehouseName: "", sourceLocationText: "", quantity: "", unit: "", remarks: "" };
}

function getCanonicalOrderSerials(order: any, countryName?: string, branchName?: string) {
  const rawNo = order?.order_no || `CL-ORD-202609-${order?.id?.slice(0, 4) || "0001"}`;
  const match = rawNo.match(/(?:ORD-)?(\d{6})-(\d+)/);
  const period = match ? match[1] : (order?.created_at ? new Date(order.created_at).toISOString().slice(0, 7).replace("-", "") : "202609");
  const seq = match ? match[2] : (order?.id ? order.id.slice(0, 4).toUpperCase() : "0001");

  const cName = order?.country_name || countryName || order?.loading_country_name || "UAE";
  let countryCode = "AE";
  const cLower = String(cName).toLowerCase();
  if (cLower.includes("pak")) countryCode = "PK";
  else if (cLower.includes("afg")) countryCode = "AF";
  else if (cLower.includes("iran")) countryCode = "IR";
  else if (cLower.includes("uzb")) countryCode = "UZ";
  else if (cLower.includes("ind")) countryCode = "IN";
  else if (cLower.includes("uae") || cLower.includes("emirates")) countryCode = "AE";

  const bName = order?.branch_name || branchName || "Main";
  let branchCode = "BR";
  const bLower = String(bName).toLowerCase();
  if (bLower.includes("karachi") || bLower.includes("khi")) branchCode = "KHI";
  else if (bLower.includes("lahore") || bLower.includes("lhe")) branchCode = "LHE";
  else if (bLower.includes("dubai") || bLower.includes("dxb")) branchCode = "DXB";
  else if (bLower.includes("kabul") || bLower.includes("kbl")) branchCode = "KBL";
  else branchCode = (String(bName).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()) || "HQ";

  return {
    superAdminSerial: `SA-ORD-${period}-${seq}`,
    countrySerial: `${countryCode}-ORD-${period}-${seq}`,
    branchSerial: `${branchCode}-ORD-${period}-${seq}`,
    entrySerial: rawNo
  };
}

type RouteLeg = {
  id?: string;
  legNo: number;
  fromCountryId: string;
  fromCountryName: string;
  toCountryId: string;
  toCountryName: string;
  fromLocationText: string;
  toLocationText: string;
  fromLocationId: string;
  toLocationId: string;
  transportMode: LegTransportMode | "";
  responsibleCountryBranchId: string;
  responsibleCityBranchId: string;
  responsibleClearingAgentId: string;
  truckId: string;
  truckRegistrationType: "registered" | "temporary" | "";
  truckNumber: string;
  truckDriverName: string;
  truckDriverMobile: string;
  shippingLineId: string;
  vesselName: string;
  voyageNumber: string;
  containerNumber: string;
  sealNumber: string;
  blNumber: string;
  portOfLoading: string;
  portOfDischarge: string;
  etd: string;
  eta: string;
  customsCountryId: string;
  customsPointText: string;
  customsClearingAgentId: string;
  clearanceType: ClearanceType | "";
  dutyTreatment: DutyTreatment | "";
  dutyAmount: string;
  dutyCurrency: string;
  dutyPayer: string;
  customsReceiptRef: string;
  customsClearanceDate: string;
  plannedDeparture: string;
  actualDeparture: string;
  plannedArrival: string;
  actualArrival: string;
  status: string;
  handoverId: string;
  remarks: string;
  responsibleUserId: string;
  billOfEntryNo: string;
  pgmNumber: string;
  declarationReference: string;
  taxAmount: string;
  otherCharges: string;
  customsStatus: LegCustomsStatus | "";
  estimatedExpenseAmount: string;
  actualExpenseAmount: string;
  expenseCurrency: string;
  currentTaskId?: string | null;
  airlineName: string;
  flightNumber: string;
  airwayBillNo: string;
  railwayOperator: string;
  wagonNumber: string;
  railContainerNumber: string;
  handlerType?: "our_branch" | "external_partner" | "";
  partnerType?: string;
  partnerName?: string;
  partnerAccountId?: string;
  partnerAccountNumber?: string;
  partnerCountryName?: string;
};

function emptyLeg(legNo: number, transportMode: LegTransportMode | "" = ""): RouteLeg {
  return {
    legNo, fromCountryId: "", fromCountryName: "", toCountryId: "", toCountryName: "",
    fromLocationText: "", toLocationText: "", fromLocationId: "", toLocationId: "", transportMode,
    responsibleCountryBranchId: "", responsibleCityBranchId: "", responsibleClearingAgentId: "",
    truckId: "", truckRegistrationType: "", truckNumber: "", truckDriverName: "", truckDriverMobile: "",
    shippingLineId: "", vesselName: "", voyageNumber: "", containerNumber: "", sealNumber: "", blNumber: "",
    portOfLoading: "", portOfDischarge: "", etd: "", eta: "",
    customsCountryId: "", customsPointText: "", customsClearingAgentId: "", clearanceType: "", dutyTreatment: "",
    dutyAmount: "", dutyCurrency: "", dutyPayer: "", customsReceiptRef: "", customsClearanceDate: "",
    plannedDeparture: "", actualDeparture: "", plannedArrival: "", actualArrival: "",
    status: "pending", handoverId: "", remarks: "",
    responsibleUserId: "", billOfEntryNo: "", pgmNumber: "", declarationReference: "",
    taxAmount: "", otherCharges: "", customsStatus: "not_applicable",
    estimatedExpenseAmount: "", actualExpenseAmount: "", expenseCurrency: "", currentTaskId: null,
    airlineName: "", flightNumber: "", airwayBillNo: "",
    railwayOperator: "", wagonNumber: "", railContainerNumber: "",
    handlerType: "our_branch", partnerType: "", partnerName: "",
    partnerAccountId: "", partnerAccountNumber: "", partnerCountryName: ""
  };
}

type AccountRow = {
  id: string;
  code: string;
  name: string;
  kind?: string | null;
  currency?: string | null;
  status?: string | null;
  current_balance?: string | number | null;
  opening_balance?: string | number | null;
  customer_id?: string | null;
  company_id?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  account_number?: string | null;
  manual_reference_number?: string | null;
};

type CustomerRow = {
  id: string;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  country_id?: string | null;
  person_code?: string | null;
  country_name?: string | null;
  city_name?: string | null;
};

type CityRow = { id: string; name: string };
type ClearingAgentRow = { id: string; name: string };
type ShippingLineRow = { id: string; name: string };

type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  owner_name?: string | null;
  address?: string | null;
  country_id?: string | null;
  city_name?: string | null;
};

type CountryRow = { id: string; name: string };
type PortRow = { id: string; port_name: string };

type PartySelection = {
  customerId: string;
  customerName: string;
  companyId: string;
  companyName: string;
  addressText: string;
  addressSource: string;
};

export type CustomerOrderGoodsItem = {
  id?: string;
  goodsId: string;
  goodsName: string;
  goodsChsCode?: string;
  goodsVariationId?: string;
  goodsVariationLabel?: string;
  size?: string;
  brandQuality?: string;
  originCountry?: string;
  unit: string;
  quantity: string;
  kgPerQty: string;
  totalKg: string;
  grossWeight?: string;
  emptyWeight?: string;
  netWeight?: string;
  currency?: string;
  rate?: string;
  finalAmount?: string;
  qualityReport?: string;
  warehouseSourceType: "same" | "company_warehouse" | "customer_warehouse" | "other";
  warehouseType?: "company" | "customer" | "other" | string;
  warehouseId: string;
  warehouseName: string;
  warehouseAddressText: string;
  photoUrl?: string;
  photoName?: string;
  remarks?: string;

  // Compatibility fields for Live Report & UI
  goods_name?: string;
  qty_unit?: string;
  kg_per_qty?: string;
  total_weight_kg?: string;
  packaging_type?: string;
  bags_cartons?: string;
  warehouse_source?: string;
  warehouse_name?: string;
};

export function defaultGoodsItem(): CustomerOrderGoodsItem {
  return {
    goodsId: "",
    goodsName: "",
    goodsChsCode: "",
    goodsVariationId: "",
    goodsVariationLabel: "",
    size: "",
    brandQuality: "",
    originCountry: "",
    unit: "Bags",
    quantity: "1",
    kgPerQty: "50",
    totalKg: "50",
    grossWeight: "50",
    emptyWeight: "0",
    netWeight: "50",
    currency: "AED",
    rate: "",
    finalAmount: "",
    qualityReport: "",
    warehouseSourceType: "company_warehouse",
    warehouseId: "",
    warehouseName: "",
    warehouseAddressText: "",
    photoUrl: "",
    photoName: "",
    remarks: "",
    goods_name: "",
    qty_unit: "Bags",
    kg_per_qty: "50",
    total_weight_kg: "50",
    packaging_type: "Bags",
    bags_cartons: "1",
    warehouse_source: "company",
    warehouse_name: ""
  };
}

export function getRouteCountryFlag(name: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("dubai") || n.includes("uae") || n.includes("emirates") || n.includes("jebel") || n.includes("sharjah") || n.includes("abu dhabi")) return "🇦🇪";
  if (n.includes("iran") || n.includes("bandar") || n.includes("chabahar") || n.includes("tehran")) return "🇮🇷";
  if (n.includes("afghanistan") || n.includes("kabul") || n.includes("kandahar") || n.includes("herat") || n.includes("torkham") || n.includes("chaman") || n.includes("spin boldak") || n.includes("jalalabad") || n.includes("islam qala")) return "🇦🇫";
  if (n.includes("pakistan") || n.includes("karachi") || n.includes("lahore") || n.includes("peshawar") || n.includes("gwadar") || n.includes("qasim")) return "🇵🇰";
  if (n.includes("uzbekistan") || n.includes("tashkent") || n.includes("termez") || n.includes("samarkand")) return "🇺🇿";
  if (n.includes("india") || n.includes("mumbai") || n.includes("nhava") || n.includes("delhi")) return "🇮🇳";
  if (n.includes("china") || n.includes("yiwu") || n.includes("guangzhou") || n.includes("urumqi")) return "🇨🇳";
  if (n.includes("tajikistan") || n.includes("dushanbe")) return "🇹🇯";
  if (n.includes("turkmenistan") || n.includes("ashgabat")) return "🇹🇲";
  if (n.includes("turkey") || n.includes("istanbul") || n.includes("mersin")) return "🇹🇷";
  if (n.includes("oman") || n.includes("muscat") || n.includes("sohar")) return "🇴🇲";
  if (n.includes("saudi") || n.includes("riyadh") || n.includes("jeddah")) return "🇸🇦";
  return "📍";
}

export function parseRouteStops(routeStr: string): string[] {
  if (!routeStr) return [];
  return routeStr.split(/➔|->|→|\s+via\s+|,/i).map((s) => s.trim()).filter(Boolean);
}

const EMPTY_FORM = {
  // Serials & Timestamps
  order_date: "",
  order_time: "",
  super_admin_serial: "",
  global_serial: "",
  country_serial: "",
  branch_serial: "",
  entry_serial: "",
  order_no: "",
  status: "pending",

  // 1A Customer & Basics
  customer_id: "",
  customer_name: "",
  shipment_type: "FCL",
  transport_mode: "by_sea" as TransportMode,
  shipment_mode: "by_sea" as TransportMode,
  movement_type: "import" as MovementType,

  // 1B Truck & Pre-Carriage
  truck_assignment_mode: "permanent" as "permanent" | "hired" | "later",
  truck_mode: "permanent" as "permanent" | "hired" | "later",
  truck_registration_type: "registered" as "registered" | "temporary",
  truck_id: "",
  truck_number: "",
  truck_driver_name: "",
  truck_driver_mobile: "",
  truck_owner_name: "",
  truck_transport_company: "",
  truck_po_ref: "",
  truck_details: "",
  truck_vehicle_type: "Container Trailer",
  truck_arrival_time: "",
  truck_loading_location: "",
  truck_status: "Pending",
  truck_photo_url: "",
  truck_photo_name: "",
  current_stage: "1A",

  // 1B Dates
  planned_pickup_date: "",
  actual_pickup_date: "",
  planned_dispatch_date: "",
  actual_dispatch_date: "",

  // 1B Multi-Goods
  goods_items: [defaultGoodsItem()] as CustomerOrderGoodsItem[],

  // 1B Loading Details
  load_type: "" as LoadType | "",
  loading_source: "shipping_warehouse" as LoadingSource,
  loading_source_name: "",
  loading_source_warehouse_id: "",
  loading_source_container_ref: "",
  cargo_details: "",
  expected_loading_date: new Date().toISOString().split("T")[0],

  // 1C Dynamic Route Fields (Mode-specific)
  // By Road
  exit_border_port_id: "",
  exit_border_port_name: "",
  planned_border_exit_date: "",
  entry_border_port_id: "",
  entry_border_port_name: "",
  border_entry_date: "",
  destination_state_province: "",
  destination_city: "",
  final_delivery_location: "",

  // Dynamic Route Aliases for Live Report
  route_origin_warehouse: "",
  route_exit_border: "",
  route_planned_exit_date: "",
  route_entry_border: "",
  route_entry_date: "",
  route_dest_state_city: "",
  route_final_delivery_location: "",

  // By Sea
  loading_port_id: "",
  loading_port_name: "",
  destination_port_id: "",
  destination_port_name: "",

  // By Air
  origin_airport_id: "",
  origin_airport_name: "",
  destination_airport_id: "",
  destination_airport_name: "",
  route_origin_airport: "",
  route_dest_airport: "",

  // By Train
  origin_rail_station: "",
  destination_rail_station: "",
  route_origin_station: "",
  route_dest_station: "",

  // 1C Operational Tracking Dates
  planned_departure_date: "",
  actual_departure_date: "",
  planned_arrival_date: "",
  actual_arrival_date: "",

  // Locations / Countries
  loading_country_id: "",
  loading_country_name: "",
  loading_state_province_id: "",
  loading_district_id: "",
  loading_city_id: "",
  loading_city_name: "",
  loading_area_id: "",
  receiving_country_id: "",
  receiving_country_name: "",
  receiving_state_province_id: "",
  receiving_district_id: "",
  receiving_city_id: "",
  receiving_city_name: "",
  receiving_area_id: "",
  route_name: "",
  customs_point_text: "",
  customs_clearance_office: "",

  // Legacy single-goods and parties fields for full backward compatibility
  goods_id: "",
  goods_variation_id: "",
  goods_name: "",
  goods_chs_code: "",
  goods_variation_label: "",
  goods_brand: "",
  goods_size: "",
  goods_category: "",
  goods_variety: "",
  goods_origin_country_id: "",
  goods_origin_country_name: "",
  goods_quantity: "",
  goods_unit: "",
  goods_bags_cartons: "",
  goods_gross_weight: "",
  goods_empty_weight: "",
  goods_net_weight: "",
  exporter_name: "",
  importer_name: "",
  notify_party_required: false,
  notify_party_name: "",
  buyer_name: "",
  consignee_name: "",
  remarks: "",
  step1b_assignee_id: "",
  step1b_assignee_name: "",
  step1b_handover_notes: "",
  step1c_assignee_id: "",
  step1c_assignee_name: "",
  step1c_handover_notes: "",
  legs: [] as RouteLeg[],
  loadingAllocations: [] as LoadingAllocation[]
};

type FormDataState = typeof EMPTY_FORM;
type SetFormData = Dispatch<SetStateAction<FormDataState>>;

function emptyPartySelection(): PartySelection {
  return {
    customerId: "",
    customerName: "",
    companyId: "",
    companyName: "",
    addressText: "",
    addressSource: ""
  };
}

function emptyPartyState(): Record<PartyRoleKey, PartySelection> {
  return {
    supplier: emptyPartySelection(),
    importer: emptyPartySelection(),
    exporter: emptyPartySelection(),
    notify_party: emptyPartySelection(),
    buyer: emptyPartySelection(),
    consignee: emptyPartySelection()
  };
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function optionLabelFromCustomer(row: CustomerRow) {
  return row.company_name ? `${row.customer_name} (${row.company_name})` : row.customer_name;
}

function optionLabelFromCompany(row: CompanyRow) {
  return row.legal_name ? `${row.name} (${row.legal_name})` : row.name;
}

function guessAddressOptions(
  selection: PartySelection,
  customers: CustomerRow[],
  companies: CompanyRow[],
  orderLinks: ClearingCustomerOrderRow[]
) {
  const options = new Map<string, SearchSelectOption>();
  const customer = customers.find((item) => item.id === selection.customerId);
  const company = companies.find((item) => item.id === selection.companyId);

  const addOption = (source: string, text?: string | null) => {
    const value = String(text || "").trim();
    if (!value) return;
    if (options.has(value)) return;
    options.set(value, {
      value,
      label: source ? `${value} • ${source}` : value,
      keywords: [value, source].filter(Boolean).join(" ")
    });
  };

  addOption("Customer master", customer?.address);
  addOption("Company master", company?.address);
  for (const order of orderLinks) {
    for (const link of order.party_links ?? []) {
      if (link.party_customer_id === selection.customerId && link.party_company_id === selection.companyId) {
        addOption(`Saved in ${order.order_no}`, link.selected_address_text);
      }
    }
  }

  if (selection.addressText) {
    addOption(selection.addressSource || "Selected", selection.addressText);
  }

  return Array.from(options.values());
}

function deriveLinkedCompanies(
  roleKey: PartyRoleKey,
  selection: PartySelection,
  customers: CustomerRow[],
  companies: CompanyRow[],
  orders: ClearingCustomerOrderRow[]
) {
  const linked = new Map<string, SearchSelectOption>();
  const customer = customers.find((item) => item.id === selection.customerId);
  const partyNeedle = normalize(customer?.customer_name || selection.customerName);
  const companyNeedle = normalize(customer?.company_name || selection.companyName);
  const rowNeedles = [partyNeedle, companyNeedle, normalize(customer?.contact_person), normalize(customer?.mobile), normalize(customer?.email)]
    .filter(Boolean);

  const addCompany = (company: CompanyRow | { id: string; name: string; legal_name?: string | null; owner_name?: string | null; address?: string | null }) => {
    const label = optionLabelFromCompany(company as CompanyRow);
    if (linked.has(company.id)) return;
    linked.set(company.id, {
      value: company.id,
      label,
      keywords: [company.name, (company as any).legal_name, (company as any).owner_name, (company as any).address, label].filter(Boolean).join(" ")
    });
  };

  for (const order of orders) {
    for (const link of order.party_links ?? []) {
      if (link.role_key !== roleKey) continue;
      if (link.party_customer_id && link.party_customer_id !== selection.customerId) continue;
      if (link.party_company_id) {
        const company = companies.find((item) => item.id === link.party_company_id);
        addCompany(company || { id: link.party_company_id, name: link.party_company_name || "Company" });
      }
    }
  }

  for (const company of companies) {
    const haystack = normalize([company.name, company.legal_name, company.owner_name, company.address].filter(Boolean).join(" "));
    if (!rowNeedles.length || rowNeedles.some((needle) => needle && haystack.includes(needle))) {
      addCompany(company);
    }
    if (partyNeedle && haystack.includes(partyNeedle)) addCompany(company);
    if (companyNeedle && haystack.includes(companyNeedle)) addCompany(company);
  }

  if (selection.companyId) {
    const current = companies.find((item) => item.id === selection.companyId);
    if (current) addCompany(current);
  }

  return Array.from(linked.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function summaryValue(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function getOrderProgress(order: ClearingCustomerOrderRow) {
  const hasGoods = Boolean(order.goods_id || order.goods_name);
  const hasSupplier = Boolean(order.customer_name);
  const hasShipping = Boolean(order.importer_name || order.exporter_name);
  const hasLogistics = Boolean(order.loading_country_id || order.receiving_country_id || order.loading_port_id || order.route_name);

  // Fallback text lives at the tt() call site (see prog.labelKey usage below), not
  // here, so a real English literal is never duplicated outside a translation call
  // (i18n-ui-guard's hardcoded-string check flags literals it can't trace through
  // a returned object). The `com.progress_*` keys below are already fully translated.
  if (hasGoods && hasSupplier && hasShipping && hasLogistics) {
    return { step: 4, labelKey: "progress_complete", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" };
  }
  if (hasGoods && hasSupplier && hasShipping) {
    return { step: 3, labelKey: "progress_step3", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800" };
  }
  if (hasGoods && hasSupplier) {
    return { step: 2, labelKey: "progress_step2", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" };
  }
  return { step: 1, labelKey: "progress_step1", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" };
}

function PartyRolePanel({
  roleKey,
  label,
  required = false,
  selection,
  onChange,
  customers,
  companies,
  customerOptions,
  companyOptions,
  orders,
  disabled = false,
  lang
}: {
  roleKey: PartyRoleKey;
  label: string;
  required?: boolean;
  selection: PartySelection;
  onChange: (next: PartySelection) => void;
  customers: CustomerRow[];
  companies: CompanyRow[];
  customerOptions: SearchSelectOption[];
  companyOptions: SearchSelectOption[];
  orders: ClearingCustomerOrderRow[];
  disabled?: boolean;
  lang: string;
}) {
  const tt = (k: string, f: string) => t(lang as never, ("com." + k) as never, f);
  const selectedCustomer = customers.find((item) => item.id === selection.customerId);
  const selectedCompany = companies.find((item) => item.id === selection.companyId);
  const effectiveCompanyName = selection.companyName || selectedCompany?.name || "";
  const effectiveAddress = selection.addressText || selectedCompany?.address || selectedCustomer?.address || "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-blue-600" />
          <span>{label}</span>
          {required ? <span className="text-rose-500 font-bold">*</span> : null}
        </div>
        {selection.customerId ? (
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
            ✓ {selection.customerName}
          </span>
        ) : null}
      </div>

      {/* 1. Customer / Person / Ledger Select */}
      <div>
        <SearchSelect
          label={`${t(lang, "comv.customer_person_name", "Customer / Person Name")} *`}
          value={selection.customerId}
          placeholder={disabled ? t(lang as never, "common.loading" as never, "Loading...") : `${t(lang, "comv.select_customer_account", "Select Customer Account")} — ${label}`}
          options={customerOptions}
          onValueChange={(customerId) => {
            const customer = customers.find((item) => item.id === customerId);
            const guessedCompany = companies.find((comp) => {
              const haystack = normalize([comp.name, comp.legal_name, comp.owner_name, comp.address].filter(Boolean).join(" "));
              const needles = [
                normalize(customer?.company_name),
                normalize(customer?.customer_name),
                normalize(customer?.contact_person),
                normalize(customer?.mobile),
                normalize(customer?.whatsapp),
                normalize(customer?.email)
              ].filter(Boolean);
              return needles.some((needle) => needle && haystack.includes(needle));
            });

            onChange({
              ...selection,
              customerId,
              customerName: customer?.customer_name || selection.customerName,
              companyId: selection.companyId || guessedCompany?.id || "",
              companyName: selection.companyName || guessedCompany?.name || customer?.company_name || "",
              addressText: selection.addressText || guessedCompany?.address || customer?.address || "",
              addressSource: selection.addressSource || (guessedCompany?.address ? "Company master" : customer?.address ? "Customer master" : "Direct input")
            });
          }}
          disabled={disabled}
          searchPlaceholder={tt("search_customer_ph", "Search by customer name, company, contact...")}
          emptyLabel={tt("no_customers", "No matching customers found")}
        />
      </div>

      {/* 2. Company / Business Direct Dropdown */}
      <div>
        <SearchSelect
          label={t(lang, "comv.company_business_name", "Company / Business Name")}
          value={selection.companyId}
          placeholder={t(lang, "comv.select_company_optional", "Select Company (Optional)...")}
          options={companyOptions}
          onValueChange={(companyId) => {
            const comp = companies.find((item) => item.id === companyId);
            onChange({
              ...selection,
              companyId,
              companyName: comp?.name || "",
              addressText: selection.addressText || comp?.address || "",
              addressSource: comp?.address ? "Company master" : selection.addressSource
            });
          }}
          disabled={disabled}
          searchPlaceholder={t(lang, "comv.search_company_name_ph", "Search company name...")}
          emptyLabel={t(lang, "comv.no_matching_companies", "No matching companies found")}
        />
      </div>

      {/* 3. Direct Address Field */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
          <span>{t(lang, "comv.address_billing_shipping", "Address / Billing / Shipping")}</span>
        </label>
        <input
          type="text"
          value={selection.addressText}
          onChange={(e) =>
            onChange({
              ...selection,
              addressText: e.target.value,
              addressSource: "Direct input"
            })
          }
          placeholder={t(lang, "comv.enter_address_ph", "Enter address or select from master...")}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {/* Summary Box */}
      {(selection.customerName || effectiveCompanyName || effectiveAddress) ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] space-y-1 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">{t(lang, "comv.party_colon", "Party:")}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{selection.customerName || "-"}</span>
          </div>
          {effectiveCompanyName ? (
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">{t(lang, "comv.company_colon", "Company:")}</span>
              <span className="font-bold text-blue-700 dark:text-blue-300">{effectiveCompanyName}</span>
            </div>
          ) : null}
          {effectiveAddress ? (
            <div className="flex justify-between text-slate-600 dark:text-slate-400 truncate">
              <span className="text-slate-500 font-semibold">{t(lang, "comv.address_colon", "Address:")}</span>
              <span className="truncate max-w-[240px]">{effectiveAddress}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CustomerOrderManagementView() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const userContext = useBranchUserContext();
  const searchParams = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [step1SubStep, setStep1SubStep] = useState<"1A" | "1B" | "1C">("1A");
  const [orders, setOrders] = useState<ClearingCustomerOrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [clearingAgents, setClearingAgents] = useState<ClearingAgentRow[]>([]);
  const [shippingLines, setShippingLines] = useState<ShippingLineRow[]>([]);
  const [countryBranches, setCountryBranches] = useState<{ id: string; name: string; countryId: string; code?: string | null }[]>([]);
  const [cityBranches, setCityBranches] = useState<{ id: string; name: string; countryBranchId: string; code?: string | null }[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string }[]>([]);
  const [loadingCities, setLoadingCities] = useState<CityRow[]>([]);
  const [receivingCities, setReceivingCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  // Step 4 final confirm: instead of resetting immediately, offer "Continue Myself"
  // vs. "Assign to Another User" (reuses the canonical TaskHandoverModal / Transfer
  // Center — same order, no duplicate record) before clearing the wizard.
  const [justCompletedOrder, setJustCompletedOrder] = useState<{ id: string; orderNo: string; countryId: string | null; customerName: string | null } | null>(null);
  const [stageHandoverPrompt, setStageHandoverPrompt] = useState<{
    orderId: string;
    orderNo: string;
    currentStepNum: number;
    currentStepTitle: string;
    nextStepNum: number;
    nextStepTitle: string;
    nextSubStep: "1A" | "1B" | "1C";
    defaultTask: string;
    transferType: "truck_task" | "goods_verification" | "shipping_handover" | "other";
  } | null>(null);
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [approvalActionOrderId, setApprovalActionOrderId] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{ id: string; top: number; bottom: number; right: number } | null>(null);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);

  // Master data lists for 1B & 1C
  const [trucksList, setTrucksList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [goodsMasterList, setGoodsMasterList] = useState<any[]>([]);

  // Enterprise Branch Scope Hierarchy
  const [branchScope, setBranchScope] = useState<BranchScopeValue>({
    countryId: "",
    countryBranchId: "",
    cityBranchId: ""
  });

  // Scope Tabs: Super Admin (Global), Country Admin, Branch Admin
  const [scopeMode, setScopeMode] = useState<"super_admin" | "country" | "branch">("super_admin");
  const [selectedCountryScopeId, setSelectedCountryScopeId] = useState<string>("");
  const [selectedBranchScopeId, setSelectedBranchScopeId] = useState<string>("");

  // 4 Canonical Serials Modal State
  const [selectedOrderForSerials, setSelectedOrderForSerials] = useState<any | null>(null);
  const [copiedSerialKey, setCopiedSerialKey] = useState<string | null>(null);

  // User Queues
  const [queueTab, setQueueTab] = useState<
    "all" | "assigned_to_me" | "pending_with_me" | "completed_by_me" | "sent_to_another" | "returned"
  >("all");

  // Activity Timeline Modal State
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineOrder, setTimelineOrder] = useState<{ id: string; orderNo: string } | null>(null);

  // Return For Correction Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnOrderInfo, setReturnOrderInfo] = useState<{ id: string; orderNo: string; stage: "1B" | "1C" } | null>(null);

  // Stage Assignment Modal State (1A -> 1B or 1B -> 1C)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentModalStage, setAssignmentModalStage] = useState<"1A_TO_1B" | "1B_TO_1C">("1A_TO_1B");
  const [assignmentTruckData, setAssignmentTruckData] = useState<Record<string, any> | null>(null);

  // Table filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [movementFilter, setMovementFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [filterState, setFilterState] = useState<SmartFilterState>({
    query: "",
    country: "all",
    branch: "all",
    mainBranch: "all",
    status: "all"
  });
  const [viewOrder, setViewOrder] = useState<ClearingCustomerOrderRow | null>(null);
  const [partySelections, setPartySelections] = useState<Record<PartyRoleKey, PartySelection>>(emptyPartyState());
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [draftGoodsItem, setDraftGoodsItem] = useState<CustomerOrderGoodsItem>(defaultGoodsItem());
  const [editingGoodsIdx, setEditingGoodsIdx] = useState<number | null>(null);

  const handleEditGoodsRow = (idx: number) => {
    const item = formData.goods_items?.[idx];
    if (!item) return;
    setDraftGoodsItem({ ...item });
    setEditingGoodsIdx(idx);
    setStep1SubStep("1C");
    setCurrentStep(3);
  };

  const tt = (k: string, f: string) => t(lang, ("com." + k) as never, f);
  const refreshLabel = t(lang, "common.refresh", "Refresh");

  const setActiveRecord = useSetActiveRecord();
  useEffect(() => {
    setActiveRecord(
      viewOrder?.id
        ? {
            table: "clearing_customer_orders",
            id: viewOrder.id,
            label: viewOrder.manual_bill_no || viewOrder.entry_serial || viewOrder.customer_name || undefined
          }
        : null
    );
    return () => setActiveRecord(null);
  }, [viewOrder, setActiveRecord]);

  useEffect(() => {
    void fetchInitialData();
  }, []);

  // Check URL query parameters for ?create=true or ?orderId=
  useEffect(() => {
    if (searchParams?.get("create") === "true") {
      setFormData({ ...EMPTY_FORM });
      setPartySelections(emptyPartyState());
      setEditingOrderId(null);
      setCurrentStep(1);
      setStep1SubStep("1A");
      setIsFormOpen(true);
    }
  }, [searchParams]);

  // Listen for click-outside to close active action dropups
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveActionMenuId(null);
      setActionMenuAnchor(null);
      setIsMoreActionsOpen(false);
    };
    const handleScroll = () => {
      if (activeActionMenuId) {
        setActiveActionMenuId(null);
        setActionMenuAnchor(null);
      }
    };
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [activeActionMenuId]);

  // Auto-initialize branchScope once branch user context loads
  useEffect(() => {
    if (!userContext.loading && userContext.context?.branchId && !branchScope.countryBranchId) {
      setBranchScope({
        countryId: "",
        countryBranchId: userContext.context.branchId || "",
        cityBranchId: ""
      });
    }
  }, [userContext.loading, userContext.context]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [orderRes, customerRes, companyRes, countryRes, portRes, agentRes, lineRes, countryBranchRes, cityBranchRes, assigneeRes, accountRes, truckRes, warehouseRes, goodsRes] = await Promise.all([
        fetch("/api/erp/clearing-agent/customer-order"),
        fetch("/api/erp/customers?limit=250"),
        fetch("/api/erp/companies?limit=250"),
        fetch("/api/erp/locations/countries"),
        fetch("/api/erp/ports"),
        fetch("/api/erp/clearing-agents?limit=200"),
        fetch("/api/erp/shipping-lines?limit=200"),
        fetch("/api/branch-management/country-branches"),
        fetch("/api/branch-management/city-branches"),
        fetch("/api/erp/user-tasks/assignees"),
        fetch("/api/erp/accounting/accounts?limit=1000").catch(() => null),
        fetch("/api/erp/master-data/trucks?selectable=true&limit=250").catch(() => null),
        fetch("/api/erp/master-data/warehouses?limit=250").catch(() => null),
        fetch("/api/erp/goods?limit=250").catch(() => null)
      ]);

      const [orderJson, customerJson, companyJson, countryJson, portJson, agentJson, lineJson, countryBranchJson, cityBranchJson, assigneeJson, accountJson, truckJson, warehouseJson, goodsJson] = await Promise.all([
        orderRes.json(),
        customerRes.json(),
        companyRes.json(),
        countryRes.json(),
        portRes.json(),
        agentRes.json(),
        lineRes.json(),
        countryBranchRes.json().catch(() => null),
        cityBranchRes.json().catch(() => null),
        assigneeRes.json().catch(() => null),
        accountRes ? accountRes.json().catch(() => null) : null,
        truckRes ? truckRes.json().catch(() => null) : null,
        warehouseRes ? warehouseRes.json().catch(() => null) : null,
        goodsRes ? goodsRes.json().catch(() => null) : null
      ]);

      const extractArray = (json: any, keys: string[]) => {
        if (!json) return [];
        if (Array.isArray(json)) return json;
        if (Array.isArray(json.data)) return json.data;
        if (json.data && typeof json.data === "object") {
          for (const key of keys) {
            if (Array.isArray(json.data[key])) return json.data[key];
          }
        }
        for (const key of keys) {
          if (Array.isArray(json[key])) return json[key];
        }
        return [];
      };

      setOrders(extractArray(orderJson, ["data", "orders", "entries"]));
      setCustomers(extractArray(customerJson, ["customers", "data"]));
      setAccounts(extractArray(accountJson, ["accounts", "data"]));
      setCompanies(extractArray(companyJson, ["companies", "data"]));
      setCountries(extractArray(countryJson, ["countries", "data"]));
      setPorts(extractArray(portJson, ["ports", "data"]));
      setClearingAgents(extractArray(agentJson, ["clearingAgents", "data"]));
      setShippingLines(extractArray(lineJson, ["shippingLines", "data"]));
      setTrucksList(extractArray(truckJson, ["trucks", "data"]));
      setWarehousesList(extractArray(warehouseJson, ["warehouses", "data"]));
      setGoodsMasterList(extractArray(goodsJson, ["goods", "data"]));
      setCountryBranches(
        extractArray(countryBranchJson, ["countryBranches", "data"]).map((b: any) => ({
          id: b.id,
          name: b.name,
          countryId: b.country_id || b.countryId,
          code: b.code || null
        }))
      );
      setCityBranches(
        extractArray(cityBranchJson, ["cityBranches", "data"]).map((b: any) => ({
          id: b.id,
          name: b.name,
          countryBranchId: b.country_branch_id || b.countryBranchId,
          code: b.code || null
        }))
      );
      setAssignableUsers(
        extractArray(assigneeJson, ["users", "data"]).map((u: any) => ({ id: u.id, name: u.fullName || u.full_name || u.name || u.email || u.id }))
      );
    } catch (error) {
      console.error("Error loading customer-order data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePartyChange = (roleKey: PartyRoleKey, next: PartySelection) => {
    setPartySelections((current) => ({ ...current, [roleKey]: next }));
  };

  const handleLoadingCountryChange = (countryId: string) => {
    const row = countries.find((item) => item.id === countryId);
    setFormData((current) => ({
      ...current,
      loading_country_id: countryId,
      loading_country_name: row?.name || "",
      loading_city_id: ""
    }));
  };

  const handleReceivingCountryChange = (countryId: string) => {
    const row = countries.find((item) => item.id === countryId);
    setFormData((current) => ({
      ...current,
      receiving_country_id: countryId,
      receiving_country_name: row?.name || "",
      receiving_city_id: ""
    }));
  };

  useEffect(() => {
    let cancelled = false;
    if (!formData.loading_country_id) {
      setLoadingCities([]);
      return;
    }
    listCities({ countryId: formData.loading_country_id })
      .then((rows) => {
        if (!cancelled) setLoadingCities(rows as unknown as CityRow[]);
      })
      .catch(() => {
        if (!cancelled) setLoadingCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.loading_country_id]);

  useEffect(() => {
    let cancelled = false;
    if (!formData.receiving_country_id) {
      setReceivingCities([]);
      return;
    }
    listCities({ countryId: formData.receiving_country_id })
      .then((rows) => {
        if (!cancelled) setReceivingCities(rows as unknown as CityRow[]);
      })
      .catch(() => {
        if (!cancelled) setReceivingCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.receiving_country_id]);

  const handleLoadingPortChange = (portId: string) => {
    const row = ports.find((item) => item.id === portId);
    setFormData((current) => ({
      ...current,
      loading_port_id: portId,
      loading_port_name: row?.port_name || ""
    }));
  };

  const handleDestinationPortChange = (portId: string) => {
    const row = ports.find((item) => item.id === portId);
    setFormData((current) => ({
      ...current,
      destination_port_id: portId,
      destination_port_name: row?.port_name || ""
    }));
  };

  const customerOptions = useMemo(() => {
    const accountByCustomerId = new Map<string, AccountRow>();
    for (const acc of accounts) {
      if (acc.customer_id) accountByCustomerId.set(acc.customer_id, acc);
    }

    const items: SearchSelectOption[] = [];
    const seenIds = new Set<string>();

    for (const row of customers) {
      seenIds.add(row.id);
      const acc = accountByCustomerId.get(row.id);
      const parts = [row.customer_name];
      if (row.company_name) parts.push(`(${row.company_name})`);
      if (acc?.code) parts.push(`• [${acc.code}]`);
      else if (row.person_code) parts.push(`• [${row.person_code}]`);
      if (acc?.current_balance != null && Number(acc.current_balance) !== 0) {
        parts.push(`• Bal: ${acc.currency || ""} ${Number(acc.current_balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
      }

      items.push({
        value: row.id,
        label: parts.join(" "),
        keywords: [
          row.customer_name,
          row.company_name,
          row.contact_person,
          row.mobile,
          row.whatsapp,
          row.email,
          row.address,
          row.person_code,
          acc?.code,
          acc?.name,
          acc?.currency
        ]
          .filter(Boolean)
          .join(" ")
      });
    }

    for (const acc of accounts) {
      if (!acc.id || seenIds.has(acc.id) || (acc.customer_id && seenIds.has(acc.customer_id))) continue;
      items.push({
        value: acc.id,
        label: `${acc.name} • [${acc.code}]${acc.current_balance != null ? ` • Bal: ${acc.currency || ""} ${Number(acc.current_balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}`,
        keywords: [acc.name, acc.code, acc.currency, acc.account_number, acc.manual_reference_number]
          .filter(Boolean)
          .join(" ")
      });
    }

    return items;
  }, [customers, accounts]);

  const companyOptions = useMemo(
    () =>
      companies.map((row) => ({
        value: row.id,
        label: optionLabelFromCompany(row),
        keywords: [row.name, row.legal_name, row.owner_name, row.address, row.city_name]
          .filter(Boolean)
          .join(" ")
      })),
    [companies]
  );

  const handleGoodsSelect = (value: GoodsPickerValue) => {
    const originCountry = countries.find((country) => country.id === value.originCountryId);
    setFormData((current) => ({
      ...current,
      goods_id: value.goodsId,
      goods_variation_id: value.goodsVariationId || "",
      goods_name: value.goodsName,
      goods_chs_code: value.goodsChsCode,
      goods_variation_label: value.variationLabel || "",
      goods_brand: value.brand || "",
      goods_size: value.size || "",
      goods_category: value.category || "",
      goods_variety: value.variety || "",
      goods_origin_country_id: value.originCountryId || "",
      goods_origin_country_name: originCountry?.name || ""
    }));
  };

  const updateLeg = (index: number, patch: Partial<RouteLeg>) => {
    setFormData((current) => {
      const legs = current.legs.map((leg, i) => (i === index ? { ...leg, ...patch } : leg));
      return { ...current, legs };
    });
  };

  const addLeg = (transportMode: LegTransportMode | "" = "") => {
    setFormData((current) => ({
      ...current,
      legs: [...current.legs, emptyLeg(current.legs.length + 1, transportMode)]
    }));
  };

  const removeLeg = (index: number) => {
    setFormData((current) => ({
      ...current,
      legs: current.legs.filter((_, i) => i !== index).map((leg, i) => ({ ...leg, legNo: i + 1 }))
    }));
  };

  const seedLegsForSeaWithPreCarriage = () => {
    setFormData((current) => {
      if (current.legs.length > 0) return current;
      const roadLeg = emptyLeg(1, "by_road");
      roadLeg.fromLocationText = current.loading_source_name || "";
      roadLeg.fromCountryId = current.loading_country_id;
      roadLeg.fromCountryName = current.loading_country_name;
      roadLeg.toLocationText = current.loading_port_name || "";
      roadLeg.toCountryId = current.loading_country_id;
      roadLeg.toCountryName = current.loading_country_name;
      const seaLeg = emptyLeg(2, "by_sea");
      seaLeg.fromLocationText = current.loading_port_name || "";
      seaLeg.fromCountryId = current.loading_country_id;
      seaLeg.fromCountryName = current.loading_country_name;
      seaLeg.toLocationText = current.destination_port_name || "";
      seaLeg.toCountryId = current.receiving_country_id;
      seaLeg.toCountryName = current.receiving_country_name;
      seaLeg.portOfLoading = current.loading_port_name || "";
      seaLeg.portOfDischarge = current.destination_port_name || "";
      return { ...current, legs: [roadLeg, seaLeg] };
    });
  };

  const visibleOrders = useMemo(() => {
    let list = orders;

    // 1. Enterprise Multi-Tier Scope Filtering (Super Admin / Country Admin / Branch Admin)
    if (scopeMode === "country" && selectedCountryScopeId) {
      list = list.filter((o: any) =>
        o.country_id === selectedCountryScopeId ||
        o.countryId === selectedCountryScopeId ||
        o.loading_country_id === selectedCountryScopeId ||
        o.country_branch_id === selectedCountryScopeId
      );
    } else if (scopeMode === "branch" && selectedBranchScopeId) {
      list = list.filter((o: any) =>
        o.city_branch_id === selectedBranchScopeId ||
        o.cityBranchId === selectedBranchScopeId ||
        o.branch_id === selectedBranchScopeId ||
        o.country_branch_id === selectedBranchScopeId
      );
    } else if (scopeMode === "super_admin") {
      // Super Admin sees all orders across all branches
    } else {
      // Fallback to branchScope hierarchy if set
      if (branchScope.cityBranchId) {
        list = list.filter((o: any) => o.city_branch_id === branchScope.cityBranchId || o.cityBranchId === branchScope.cityBranchId);
      } else if (branchScope.countryBranchId) {
        list = list.filter((o: any) => o.country_branch_id === branchScope.countryBranchId || o.countryBranchId === branchScope.countryBranchId);
      } else if (branchScope.countryId) {
        list = list.filter((o: any) => o.country_id === branchScope.countryId || o.countryId === branchScope.countryId || o.loading_country_id === branchScope.countryId);
      }
    }

    // 2. Queue filter
    const currentUserId = userContext.context?.userId;
    if (queueTab === "assigned_to_me") {
      list = list.filter(
        (o: any) =>
          (o.latest_handover?.receiver_user_id === currentUserId && o.latest_handover?.status === "pending") ||
          (o.responsible_user_id === currentUserId && o.status !== "completed")
      );
    } else if (queueTab === "pending_with_me") {
      list = list.filter(
        (o: any) =>
          (o.latest_handover?.receiver_user_id === currentUserId && o.latest_handover?.status === "pending") ||
          (o.created_by === currentUserId && (o.current_stage === "returned_for_correction" || o.status === "draft" || o.current_stage === "1a_draft"))
      );
    } else if (queueTab === "completed_by_me") {
      list = list.filter(
        (o: any) =>
          (o.created_by === currentUserId && (o.status === "completed" || o.current_stage === "goods_completed" || o.current_stage === "completed")) ||
          (o.latest_handover?.receiver_user_id === currentUserId && o.latest_handover?.status === "completed")
      );
    } else if (queueTab === "sent_to_another") {
      list = list.filter(
        (o: any) =>
          o.latest_handover?.sender_user_id === currentUserId &&
          o.latest_handover?.receiver_user_id !== currentUserId &&
          o.latest_handover?.status === "pending"
      );
    } else if (queueTab === "returned") {
      list = list.filter(
        (o: any) =>
          o.current_stage === "returned_for_correction" ||
          o.status === "returned" ||
          o.latest_handover?.status === "returned"
      );
    }

    // 3. Status filter
    if (statusFilter && statusFilter !== "all") {
      list = list.filter((o) => (o.status || "pending").toLowerCase() === statusFilter.toLowerCase());
    }

    // 4. Transport mode filter
    if (modeFilter && modeFilter !== "all") {
      list = list.filter((o) => (o.transport_mode || "").toLowerCase() === modeFilter.toLowerCase());
    }

    // 5. Movement type filter
    if (movementFilter && movementFilter !== "all") {
      list = list.filter((o) => (o.movement_type || "").toLowerCase() === movementFilter.toLowerCase());
    }

    // 6. Search query
    const query = normalize(searchQuery || filterState.query);
    if (query) {
      list = list.filter((order) => {
        const haystack = [
          order.order_no,
          order.customer_name,
          order.goods_name,
          order.goods_chs_code,
          order.goods_variation_label,
          order.goods_brand,
          order.goods_size,
          order.goods_origin_country_name,
          order.exporter_name,
          order.importer_name,
          order.notify_party_name,
          order.buyer_name,
          order.loading_source_name,
          order.loading_country_name,
          order.receiving_country_name,
          order.loading_port_name,
          order.destination_port_name,
          order.route_name,
          order.cargo_details,
          ...(order.party_links ?? []).map((link) => [link.party_customer_name, link.party_company_name, link.selected_address_text].filter(Boolean).join(" "))
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    return list;
  }, [orders, scopeMode, selectedCountryScopeId, selectedBranchScopeId, branchScope, queueTab, userContext.context?.userId, statusFilter, modeFilter, movementFilter, searchQuery, filterState]);

  const queueCounts = useMemo(() => {
    const currentUserId = userContext.context?.userId;
    const assignedToMe = orders.filter(
      (o: any) =>
        (o.latest_handover?.receiver_user_id === currentUserId && o.latest_handover?.status === "pending") ||
        (o.responsible_user_id === currentUserId && o.status !== "completed")
    ).length;
    const pendingWithMe = orders.filter(
      (o: any) =>
        (o.latest_handover?.receiver_user_id === currentUserId && o.latest_handover?.status === "pending") ||
        (o.created_by === currentUserId && (o.current_stage === "returned_for_correction" || o.status === "draft" || o.current_stage === "1a_draft"))
    ).length;
    const completedByMe = orders.filter(
      (o: any) =>
        (o.created_by === currentUserId && (o.status === "completed" || o.current_stage === "goods_completed" || o.current_stage === "completed")) ||
        (o.latest_handover?.receiver_user_id === currentUserId && o.latest_handover?.status === "completed")
    ).length;
    const sentToAnother = orders.filter(
      (o: any) =>
        o.latest_handover?.sender_user_id === currentUserId &&
        o.latest_handover?.receiver_user_id !== currentUserId &&
        o.latest_handover?.status === "pending"
    ).length;
    const returned = orders.filter(
      (o: any) =>
        o.current_stage === "returned_for_correction" ||
        o.status === "returned" ||
        o.latest_handover?.status === "returned"
    ).length;
    const all = orders.length;

    return { assignedToMe, pendingWithMe, completedByMe, sentToAnother, returned, all };
  }, [orders, userContext.context?.userId]);

  const orderCounts = useMemo(() => {
    const total = orders.length;
    const draft = orders.filter((o) => !o.status || o.status === "draft" || o.status === "pending").length;
    const confirmed = orders.filter((o) => o.status === "booking_confirmed" || o.status === "confirmed" || o.status === "accepted" || o.status === "in_progress").length;
    const inTransit = orders.filter((o) => o.status === "in_transit" || o.status === "loaded" || o.status === "customs_pending").length;
    const cleared = orders.filter((o) => o.status === "cleared" || o.status === "completed").length;
    const totalVolume = orders.reduce((sum, o) => sum + (Number(o.goods_quantity) || 0), 0);
    const uniqueRoutes = new Set(orders.map((o) => o.route_name || `${o.loading_country_name || ""}-${o.receiving_country_name || ""}`).filter(Boolean)).size;

    return {
      total,
      draft,
      confirmed,
      inTransit,
      cleared,
      totalVolume,
      uniqueRoutes,
      import: orders.filter((order) => String(order.movement_type || "").toLowerCase() === "import").length,
      export: orders.filter((order) => String(order.movement_type || "").toLowerCase() === "export").length,
      domestic: orders.filter((order) => String(order.movement_type || "").toLowerCase() === "domestic").length,
      transit: orders.filter((order) => String(order.movement_type || "").toLowerCase() === "up_transit" || String(order.movement_type || "").toLowerCase() === "transit").length
    };
  }, [orders]);

  const isSeaMode = formData.transport_mode === "by_sea";
  const isRoadMode = formData.transport_mode === "by_road";

  const generateSerials = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");

    const today = `${yyyy}-${mm}-${dd}`;
    const nowTime = `${hh}:${min}`;
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const seqNum = String((orders.length || 0) + 1).padStart(4, "0");

    const globalSerial = `CL-ORD-${yyyy}${mm}-${randNum}`;
    const countryPrefix = (userContext.context as any)?.countryCode || (userContext.context as any)?.countryId || "INTL";
    const branchPrefix = (userContext.context as any)?.branchCode || userContext.context?.branchId || "HQ";
    const countrySerial = `${countryPrefix}-ORD-${seqNum}`;
    const branchSerial = `${branchPrefix}-ORD-${seqNum}`;
    const entrySerial = `ENT-${seqNum}`;

    return { globalSerial, countrySerial, branchSerial, entrySerial, today, nowTime };
  };

  const resetForm = () => {
    const s = generateSerials();
    setFormData({
      ...EMPTY_FORM,
      order_no: s.globalSerial,
      super_admin_serial: s.globalSerial,
      global_serial: s.globalSerial,
      country_serial: s.countrySerial,
      branch_serial: s.branchSerial,
      entry_serial: s.entrySerial,
      order_date: s.today,
      order_time: s.nowTime,
      expected_loading_date: s.today,
      planned_pickup_date: s.today,
      planned_dispatch_date: s.today,
      planned_departure_date: s.today,
      goods_items: [defaultGoodsItem()]
    });
    setPartySelections(emptyPartyState());
    setEditingOrderId(null);
    setDraftGoodsItem(defaultGoodsItem());
    setEditingGoodsIdx(null);
    setCurrentStep(1);
    setStep1SubStep("1A");
  };

  const handleStartNewOrder = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const loadEditOrder = (order: ClearingCustomerOrderRow) => {
    const o = order as Record<string, any>;
    setEditingOrderId(order.id);
    setDraftGoodsItem(defaultGoodsItem());
    setEditingGoodsIdx(null);
    const currentStageVal = o.current_stage || "1A";
    if (currentStageVal === "1B" || currentStageVal === "truck_confirmation_required") {
      setStep1SubStep("1B");
      setCurrentStep(2);
    } else if (currentStageVal === "1C" || currentStageVal === "goods_entry_required" || currentStageVal === "truck_confirmed") {
      setStep1SubStep("1C");
      setCurrentStep(3);
    } else {
      setStep1SubStep("1A");
      setCurrentStep(1);
    }
    setIsFormOpen(true);

    // Reconstruct goods items
    const loadedGoodsItems: CustomerOrderGoodsItem[] =
      Array.isArray(order.loading_allocations) && order.loading_allocations.length > 0
        ? order.loading_allocations.map((row: Record<string, any>, idx: number) => {
            const parsedKgMatch = row.remarks?.match(/\(([\d.]+)\s*kg\//i)?.[1];
            const q = row.quantity != null ? String(row.quantity) : "1";
            const k = parsedKgMatch || (idx === 0 && order.goods_quantity && order.goods_gross_weight ? String(Math.round(Number(order.goods_gross_weight) / Math.max(1, Number(order.goods_quantity)))) : "50");
            const tot = String((Number(q) || 0) * (Number(k) || 0));
            return {
              id: row.id,
              goodsId: idx === 0 ? (order.goods_id || "") : "",
              goodsName: idx === 0 ? (order.goods_name || "") : (row.remarks?.split(" (")[0] || order.goods_name || "Goods Item"),
              goodsChsCode: idx === 0 ? (order.goods_chs_code || "") : "",
              goodsVariationId: idx === 0 ? (order.goods_variation_id || "") : "",
              goodsVariationLabel: idx === 0 ? (order.goods_variation_label || "") : "",
              size: row.size || "",
              brandQuality: row.brand_quality || row.brandQuality || "",
              originCountry: row.origin_country || row.originCountry || "",
              unit: row.unit || order.goods_unit || "Bags",
              quantity: q,
              kgPerQty: k,
              totalKg: tot,
              grossWeight: row.gross_weight != null ? String(row.gross_weight) : tot,
              emptyWeight: row.empty_weight != null ? String(row.empty_weight) : "0",
              netWeight: row.net_weight != null ? String(row.net_weight) : tot,
              currency: row.currency || "AED",
              rate: row.rate != null ? String(row.rate) : "",
              finalAmount: row.final_amount != null ? String(row.final_amount) : "",
              qualityReport: row.quality_report || "",
              warehouseSourceType: (row.warehouse_id ? "company_warehouse" : "other") as any,
              warehouseId: row.warehouse_id || "",
              warehouseName: row.warehouse_name || "",
              warehouseAddressText: row.source_location_text || "",
              remarks: row.remarks || ""
            };
          })
        : [
            {
              goodsId: order.goods_id || "",
              goodsName: order.goods_name || "",
              goodsChsCode: order.goods_chs_code || "",
              goodsVariationId: order.goods_variation_id || "",
              goodsVariationLabel: order.goods_variation_label || "",
              unit: order.goods_unit || "Bags",
              quantity: order.goods_quantity != null ? String(order.goods_quantity) : "1",
              kgPerQty: order.goods_quantity && order.goods_gross_weight ? String(Math.round(Number(order.goods_gross_weight) / Math.max(1, Number(order.goods_quantity)))) : "50",
              totalKg: order.goods_gross_weight != null ? String(order.goods_gross_weight) : "50",
              warehouseSourceType: order.loading_source === "customer_warehouse" ? "customer_warehouse" : "company_warehouse",
              warehouseId: o.loading_source_warehouse_id || "",
              warehouseName: order.loading_source_name || "",
              warehouseAddressText: "",
              remarks: ""
            }
          ];

    setFormData({
      ...EMPTY_FORM,
      customer_id: order.customer_id || "",
      customer_name: order.customer_name || "",
      order_date: o.order_date || (order.created_at ? order.created_at.split("T")[0] : ""),
      order_time: o.order_time || (order.created_at && order.created_at.includes("T") ? order.created_at.split("T")[1]?.slice(0, 5) : ""),
      goods_id: order.goods_id || "",
      goods_variation_id: order.goods_variation_id || "",
      goods_name: order.goods_name || "",
      goods_chs_code: order.goods_chs_code || "",
      goods_variation_label: order.goods_variation_label || "",
      goods_brand: order.goods_brand || "",
      goods_size: order.goods_size || "",
      goods_category: o.goods_category || "",
      goods_variety: o.goods_variety || "",
      goods_origin_country_id: o.goods_origin_country_id || "",
      goods_origin_country_name: order.goods_origin_country_name || "",
      goods_quantity: o.goods_quantity != null ? String(o.goods_quantity) : "",
      goods_unit: o.goods_unit || "",
      goods_bags_cartons: o.goods_bags_cartons != null ? String(o.goods_bags_cartons) : "",
      goods_gross_weight: o.goods_gross_weight != null ? String(o.goods_gross_weight) : "",
      goods_empty_weight: o.goods_empty_weight != null ? String(o.goods_empty_weight) : "",
      goods_net_weight: o.goods_net_weight != null ? String(o.goods_net_weight) : "",
      route_name: order.route_name || "",
      shipment_type: order.shipment_type || "FCL",
      transport_mode: (order.transport_mode || "by_sea") as TransportMode,
      movement_type: (order.movement_type || "import") as MovementType,
      load_type: (o.load_type as LoadType) || "",
      loading_source: (order.loading_source || "shipping_warehouse") as LoadingSource,
      loading_source_name: order.loading_source_name || "",
      loading_source_warehouse_id: o.loading_source_warehouse_id || "",
      loading_source_container_ref: o.loading_source_container_ref || "",
      exporter_name: order.exporter_name || "",
      importer_name: order.importer_name || "",
      notify_party_required: Boolean(order.notify_party_required),
      notify_party_name: order.notify_party_name || "",
      buyer_name: order.buyer_name || "",
      consignee_name: order.consignee_name || "",
      loading_country_id: order.loading_country_id || "",
      loading_country_name: order.loading_country_name || "",
      loading_state_province_id: o.loading_state_province_id || "",
      loading_district_id: o.loading_district_id || "",
      loading_city_id: o.loading_city_id || "",
      loading_area_id: o.loading_area_id || "",
      receiving_country_id: order.receiving_country_id || "",
      receiving_country_name: order.receiving_country_name || "",
      receiving_state_province_id: o.receiving_state_province_id || "",
      receiving_district_id: o.receiving_district_id || "",
      receiving_city_id: o.receiving_city_id || "",
      receiving_area_id: o.receiving_area_id || "",
      loading_port_id: order.loading_port_id || "",
      loading_port_name: order.loading_port_name || "",
      destination_port_id: order.destination_port_id || "",
      destination_port_name: order.destination_port_name || "",
      cargo_details: order.cargo_details || "",
      expected_loading_date: order.expected_loading_date ? order.expected_loading_date.split("T")[0] : new Date().toISOString().split("T")[0],
      remarks: order.remarks || "",
      order_no: order.order_no || "",
      status: o.status || "pending",
      super_admin_serial: o.super_admin_serial || "",
      country_serial: o.country_serial || "",
      branch_serial: o.branch_serial || "",
      entry_serial: o.entry_serial || "",
      current_stage: currentStageVal,
      truck_assignment_mode: (o.truck_id ? "permanent" : o.truck_number === "TO BE ASSIGNED" ? "later" : o.truck_number ? "hired" : "permanent") as any,
      truck_registration_type: (o.truck_registration_type as "registered" | "temporary") || "registered",
      truck_id: o.truck_id || "",
      truck_number: o.truck_number || "",
      truck_driver_name: o.truck_driver_name || "",
      truck_driver_mobile: o.truck_driver_mobile || "",
      truck_owner_name: o.truck_owner_name || "",
      truck_transport_company: o.truck_transport_company || "",
      truck_po_ref: o.truck_po_ref || "",
      truck_vehicle_type: o.truck_vehicle_type || (o.truck_details && typeof o.truck_details === "object" ? o.truck_details.vehicleType : "Container Trailer") || "Container Trailer",
      truck_arrival_time: o.truck_arrival_time || (o.truck_details && typeof o.truck_details === "object" ? o.truck_details.arrivalTime : "") || "",
      truck_loading_location: o.truck_loading_location || (o.truck_details && typeof o.truck_details === "object" ? o.truck_details.loadingLocation : "") || "",
      truck_status: o.truck_status || (o.truck_details && typeof o.truck_details === "object" ? o.truck_details.truckStatus : "Pending") || "Pending",
      truck_photo_url: o.truck_photo_url || (o.truck_details && typeof o.truck_details === "object" && Array.isArray(o.truck_details.truckPhotos) ? o.truck_details.truckPhotos[0] : "") || "",
      truck_photo_name: o.truck_photo_name || "",
      truck_details: o.truck_details ? (typeof o.truck_details === "string" ? o.truck_details : JSON.stringify(o.truck_details)) : "",
      planned_pickup_date: o.planned_pickup_date || (o.expected_loading_date ? o.expected_loading_date.split("T")[0] : ""),
      actual_pickup_date: o.actual_pickup_date || "",
      planned_dispatch_date: o.planned_dispatch_date || "",
      actual_dispatch_date: o.actual_dispatch_date || "",
      goods_items: loadedGoodsItems,
      exit_border_port_id: o.exit_border_port_id || "",
      exit_border_port_name: o.exit_border_port_name || "",
      planned_border_exit_date: o.planned_border_exit_date || "",
      entry_border_port_id: o.entry_border_port_id || "",
      entry_border_port_name: o.entry_border_port_name || "",
      border_entry_date: o.border_entry_date || "",
      destination_state_province: o.destination_state_province || "",
      destination_city: o.destination_city || "",
      final_delivery_location: o.final_delivery_location || "",
      origin_airport_id: o.origin_airport_id || "",
      origin_airport_name: o.origin_airport_name || "",
      destination_airport_id: o.destination_airport_id || "",
      destination_airport_name: o.destination_airport_name || "",
      origin_rail_station: o.origin_rail_station || "",
      destination_rail_station: o.destination_rail_station || "",
      planned_departure_date: o.planned_departure_date || "",
      actual_departure_date: o.actual_departure_date || "",
      planned_arrival_date: o.planned_arrival_date || "",
      actual_arrival_date: o.actual_arrival_date || "",
      legs: Array.isArray(o.legs)
        ? o.legs.map((leg: Record<string, any>, idx: number) => ({
            id: leg.id,
            legNo: leg.leg_no ?? idx + 1,
            fromCountryId: leg.from_country_id || "",
            fromCountryName: leg.from_country_name || "",
            toCountryId: leg.to_country_id || "",
            toCountryName: leg.to_country_name || "",
            fromLocationText: leg.from_location_text || "",
            toLocationText: leg.to_location_text || "",
            fromLocationId: leg.from_location_id || "",
            toLocationId: leg.to_location_id || "",
            transportMode: (leg.transport_mode as LegTransportMode) || "",
            responsibleCountryBranchId: leg.responsible_country_branch_id || "",
            responsibleCityBranchId: leg.responsible_city_branch_id || "",
            responsibleClearingAgentId: leg.responsible_clearing_agent_id || "",
            truckId: leg.truck_id || "",
            truckRegistrationType: (leg.truck_registration_type as "registered" | "temporary") || "",
            truckNumber: leg.truck_number || "",
            truckDriverName: leg.truck_driver_name || "",
            truckDriverMobile: leg.truck_driver_mobile || "",
            shippingLineId: leg.shipping_line_id || "",
            vesselName: leg.vessel_name || "",
            voyageNumber: leg.voyage_number || "",
            containerNumber: leg.container_number || "",
            sealNumber: leg.seal_number || "",
            blNumber: leg.bl_number || "",
            portOfLoading: leg.port_of_loading || "",
            portOfDischarge: leg.port_of_discharge || "",
            etd: leg.etd ? String(leg.etd).split("T")[0] : "",
            eta: leg.eta ? String(leg.eta).split("T")[0] : "",
            customsCountryId: leg.customs_country_id || "",
            customsPointText: leg.customs_point_text || "",
            customsClearingAgentId: leg.customs_clearing_agent_id || "",
            clearanceType: (leg.clearance_type as ClearanceType) || "",
            dutyTreatment: (leg.duty_treatment as DutyTreatment) || "",
            dutyAmount: leg.duty_amount != null ? String(leg.duty_amount) : "",
            dutyCurrency: leg.duty_currency || "",
            dutyPayer: leg.duty_payer || "",
            customsReceiptRef: leg.customs_receipt_ref || "",
            customsClearanceDate: leg.customs_clearance_date ? String(leg.customs_clearance_date).split("T")[0] : "",
            plannedDeparture: leg.planned_departure ? String(leg.planned_departure).split("T")[0] : "",
            actualDeparture: leg.actual_departure ? String(leg.actual_departure).split("T")[0] : "",
            plannedArrival: leg.planned_arrival ? String(leg.planned_arrival).split("T")[0] : "",
            actualArrival: leg.actual_arrival ? String(leg.actual_arrival).split("T")[0] : "",
            status: leg.status || "pending",
            handoverId: leg.handover_id || "",
            remarks: leg.remarks || "",
            responsibleUserId: leg.responsible_user_id || "",
            billOfEntryNo: leg.bill_of_entry_no || "",
            pgmNumber: leg.pgm_number || "",
            declarationReference: leg.declaration_reference || "",
            taxAmount: leg.tax_amount != null ? String(leg.tax_amount) : "",
            otherCharges: leg.other_charges != null ? String(leg.other_charges) : "",
            customsStatus: (leg.customs_status as LegCustomsStatus) || "not_applicable",
            estimatedExpenseAmount: leg.estimated_expense_amount != null ? String(leg.estimated_expense_amount) : "",
            actualExpenseAmount: leg.actual_expense_amount != null ? String(leg.actual_expense_amount) : "",
            expenseCurrency: leg.expense_currency || "",
            currentTaskId: leg.current_task_id || null,
            handlerType: leg.handler_type || (leg.partner_name || leg.partner_account_id ? "external_partner" : "our_branch"),
            partnerType: leg.partner_type || "",
            partnerName: leg.partner_name || "",
            partnerAccountId: leg.partner_account_id || "",
            partnerAccountNumber: leg.partner_account_number || "",
            partnerCountryName: leg.partner_country_name || "",
            airlineName: leg.airline_name || "",
            flightNumber: leg.flight_number || "",
            airwayBillNo: leg.airway_bill_no || "",
            railwayOperator: leg.railway_operator || "",
            wagonNumber: leg.wagon_number || "",
            railContainerNumber: leg.rail_container_number || ""
          }))
        : [],
      loadingAllocations: Array.isArray(order.loading_allocations)
        ? order.loading_allocations.map((row: Record<string, any>, idx: number) => ({
            id: row.id,
            rowSerial: row.row_serial ?? idx + 1,
            warehouseId: row.warehouse_id || "",
            warehouseName: row.warehouse_name || "",
            sourceLocationText: row.source_location_text || "",
            quantity: row.quantity != null ? String(row.quantity) : "",
            unit: row.unit || "",
            remarks: row.remarks || ""
          }))
        : []
    });

    const nextState = emptyPartyState();
    for (const link of order.party_links ?? []) {
      if (nextState[link.role_key]) {
        nextState[link.role_key] = {
          customerId: link.party_customer_id || "",
          customerName: link.party_customer_name || "",
          companyId: link.party_company_id || "",
          companyName: link.party_company_name || "",
          addressText: link.selected_address_text || "",
          addressSource: link.selected_address_source || ""
        };
      }
    }
    if (!nextState.supplier.customerName && order.customer_name) {
      nextState.supplier.customerName = order.customer_name;
      nextState.supplier.customerId = order.customer_id || "";
    }
    setPartySelections(nextState);

    // Auto navigate to active step
    const progress = getOrderProgress(order);
    setCurrentStep(progress.step >= 4 ? 4 : ((progress.step + 1) as any));
  };

  // Deep-link support: a Handover Inbox "Open Linked Form" click lands here with
  // ?id=<orderId> — auto-open the SAME order (never a fresh blank form) once the
  // orders list has loaded far enough to find it.
  useEffect(() => {
    if (isFormOpen) return;
    const targetId = searchParams?.get("id");
    if (!targetId || orders.length === 0) return;
    const target = orders.find((o) => o.id === targetId);
    if (target) loadEditOrder(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, orders, isFormOpen]);

  const handleExportCsv = () => {
    if (!orders.length) return;
    const headers = [
      tt("th_order_no", "Order No"),
      tt("th_party", "Party"),
      tt("th_goods", "Goods"),
      tt("csv_chs_code", "CHS Code"),
      tt("th_movement", "Movement"),
      tt("csv_transport", "Transport"),
      tt("csv_shipment", "Shipment"),
      tt("csv_loading_source", "Loading Source"),
      tt("th_route", "Route"),
      tt("csv_supplier", "Supplier"),
      tt("csv_importer", "Importer"),
      tt("csv_exporter", "Exporter"),
      tt("csv_buyer", "Buyer"),
      tt("csv_created_date", "Created Date")
    ];
    const rows = orders.map((o) => [
      o.order_no || "-",
      o.customer_name || "-",
      o.goods_name || "-",
      o.goods_chs_code || "-",
      o.movement_type || "-",
      o.transport_mode || "-",
      o.shipment_type || "-",
      o.loading_source_name || o.loading_source || "-",
      o.route_name || "-",
      o.customer_name || "-",
      o.importer_name || "-",
      o.exporter_name || "-",
      o.buyer_name || "-",
      o.created_at ? new Date(o.created_at).toLocaleDateString() : "-"
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customer_orders_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintOrder = (order: ClearingCustomerOrderRow) => {
    const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
    const align = isRtl ? "right" : "left";
    const html = `
      <html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}"><head><title>${order.order_no || tt("title", "Customer Order")}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;}
        h1{margin:0 0 10px 0;}
        table{width:100%;border-collapse:collapse;margin-top:16px;}
        th,td{border:1px solid #cbd5e1;padding:8px;text-align:${align};font-size:12px;}
        th{background:#f1f5f9;}
      </style></head><body>
      <h1>${order.order_no || tt("title", "Customer Order")}</h1>
      <p><strong>${tt("party", "Party")}:</strong> ${order.customer_name || "-"}</p>
      <p><strong>${tt("print_goods", "Goods")}:</strong> ${[order.goods_name, order.goods_chs_code ? `CHS ${order.goods_chs_code}` : "", order.goods_variation_label, order.goods_origin_country_name].filter(Boolean).join(" • ") || "-"}</p>
      <p><strong>${tt("print_route", "Route")}:</strong> ${order.route_name || "-"}</p>
      <p><strong>${tt("print_movement", "Movement")}:</strong> ${order.movement_type || "-"}</p>
      <table>
        <thead><tr><th>${tt("print_role", "Role")}</th><th>${tt("party", "Party")}</th><th>${tt("print_company", "Company")}</th><th>${tt("print_address", "Address")}</th></tr></thead>
        <tbody>
          ${(order.party_links || []).map((link) => `
            <tr>
              <td>${link.role_key}</td>
              <td>${link.party_customer_name || "-"}</td>
              <td>${link.party_company_name || "-"}</td>
              <td>${link.selected_address_text || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      </body></html>`;
    import("@/lib/store/print-store").then(({ printStore }) => {
      printStore.openPrint(html, tt("print_title", "Clearing Order"));
    });
  };

  const handleSaveProgress = async (advanceStep: boolean = false) => {
    // Re-entrancy guard: some step-transition buttons aren't individually
    // disabled while saving, so a double-click under high API latency could
    // otherwise fire two overlapping saves — creating a duplicate draft order
    // and double-advancing currentStep when both responses resolve.
    if (saving) return;

    // Cross-border road rule: a real registered truck (Truck Master) is required
    // once the leg actually crosses a country border; a temporary one-time truck
    // is only for local/short transfers (warehouse<->port, yard<->warehouse, etc).
    const invalidCrossBorderLeg = formData.legs.find(
      (leg) =>
        leg.transportMode === "by_road" &&
        leg.fromCountryId &&
        leg.toCountryId &&
        leg.fromCountryId !== leg.toCountryId &&
        leg.truckRegistrationType === "temporary"
    );
    if (invalidCrossBorderLeg) {
      alert(
        tt(
          "err_cross_border_truck",
          `Leg #${invalidCrossBorderLeg.legNo} crosses a country border by road and must use a registered truck from the Truck Master, not a temporary one-time truck.`
        )
      );
      return;
    }

    setSaving(true);
    setSuccessMessage("");
    try {
      const supplier = partySelections.supplier;
      const isFinalConfirm = advanceStep && (currentStep === 4 || currentStep === 3);

      const goodsItems = formData.goods_items && formData.goods_items.length > 0 ? formData.goods_items : [defaultGoodsItem()];
      const firstGoods = goodsItems[0];
      const totalQuantity = goodsItems.reduce((acc, g) => acc + (Number(g.quantity) || 0), 0);
      const totalGrossKg = goodsItems.reduce((acc, g) => acc + (Number(g.totalKg) || 0), 0);
      const aggregatedGoodsNames = goodsItems.map((g) => g.goodsName).filter(Boolean).join(", ") || formData.goods_name || null;

      // Determine effective truck values based on truck_assignment_mode
      let effTruckId = formData.truck_id || null;
      let effTruckNumber = formData.truck_number || null;
      let effDriverName = formData.truck_driver_name || null;
      let effDriverMobile = formData.truck_driver_mobile || null;
      let effTransportCo = formData.truck_transport_company || null;

      if (formData.truck_assignment_mode === "later") {
        effTruckId = null;
        effTruckNumber = "TO BE ASSIGNED";
        effDriverName = null;
        effDriverMobile = null;
        effTransportCo = null;
      }

      // Map multi-goods to loading allocations
      const effectiveAllocations = goodsItems.map((g, idx) => ({
        id: g.id || undefined,
        rowSerial: idx + 1,
        warehouseId: g.warehouseId || formData.loading_source_warehouse_id || null,
        warehouseName: g.warehouseName || (g.warehouseSourceType === "customer_warehouse" ? "Customer Warehouse" : "Company Warehouse"),
        sourceLocationText: g.warehouseAddressText || g.warehouseName || formData.loading_source_name || null,
        quantity: Number(g.quantity) || 0,
        unit: g.unit || "Bags",
        remarks: `${g.goodsName || 'Goods'}${g.kgPerQty ? ` (${g.kgPerQty} kg/${g.unit || 'unit'})` : ""} • Total: ${g.totalKg || 0} kg`
      }));

      // Route legs
      const legsToSave =
        formData.legs && formData.legs.length > 0
          ? formData.legs.map((leg) => ({
              id: leg.id,
              legNo: leg.legNo,
              fromCountryId: leg.fromCountryId || null,
              fromCountryName: leg.fromCountryName || null,
              toCountryId: leg.toCountryId || null,
              toCountryName: leg.toCountryName || null,
              fromLocationText: leg.fromLocationText || null,
              toLocationText: leg.toLocationText || null,
              transportMode: leg.transportMode || null,
              responsibleCountryBranchId: leg.responsibleCountryBranchId || null,
              responsibleCityBranchId: leg.responsibleCityBranchId || null,
              responsibleClearingAgentId: leg.responsibleClearingAgentId || null,
              truckId: effTruckId,
              truckRegistrationType: leg.truckRegistrationType || (formData.truck_assignment_mode === "permanent" ? "registered" : "temporary"),
              truckNumber: effTruckNumber,
              truckDriverName: effDriverName,
              truckDriverMobile: effDriverMobile,
              shippingLineId: leg.shippingLineId || null,
              vesselName: leg.vesselName || null,
              voyageNumber: leg.voyageNumber || null,
              containerNumber: leg.containerNumber || null,
              sealNumber: leg.sealNumber || null,
              blNumber: leg.blNumber || null,
              portOfLoading: leg.portOfLoading || formData.loading_port_name || null,
              portOfDischarge: leg.portOfDischarge || formData.destination_port_name || null,
              etd: leg.etd || null,
              eta: leg.eta || null,
              customsCountryId: leg.customsCountryId || null,
              customsPointText: leg.customsPointText || null,
              customsClearingAgentId: leg.customsClearingAgentId || null,
              clearanceType: leg.clearanceType || null,
              dutyTreatment: leg.dutyTreatment || null,
              dutyAmount: leg.dutyAmount ? Number(leg.dutyAmount) : null,
              dutyCurrency: leg.dutyCurrency || null,
              dutyPayer: leg.dutyPayer || null,
              customsReceiptRef: leg.customsReceiptRef || null,
              customsClearanceDate: leg.customsClearanceDate || null,
              plannedDeparture: leg.plannedDeparture || formData.planned_departure_date || null,
              actualDeparture: leg.actualDeparture || formData.actual_departure_date || null,
              plannedArrival: leg.plannedArrival || formData.planned_arrival_date || null,
              actualArrival: leg.actualArrival || formData.actual_arrival_date || null,
              status: leg.status || "pending",
              handoverId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leg.handoverId) ? leg.handoverId : null,
              remarks: leg.remarks || null,
              responsibleUserId: leg.responsibleUserId || null,
              billOfEntryNo: leg.billOfEntryNo || null,
              pgmNumber: leg.pgmNumber || null,
              declarationReference: leg.declarationReference || null,
              taxAmount: leg.taxAmount ? Number(leg.taxAmount) : null,
              otherCharges: leg.otherCharges ? Number(leg.otherCharges) : null,
              customsStatus: leg.customsStatus || "not_applicable",
              estimatedExpenseAmount: leg.estimatedExpenseAmount ? Number(leg.estimatedExpenseAmount) : null,
              actualExpenseAmount: leg.actualExpenseAmount ? Number(leg.actualExpenseAmount) : null,
              expenseCurrency: leg.expenseCurrency || null,
              handlerType: leg.handlerType || "our_branch",
              partnerType: leg.partnerType || null,
              partnerName: leg.partnerName || null,
              partnerAccountId: leg.partnerAccountId || null,
              partnerAccountNumber: leg.partnerAccountNumber || null,
              partnerCountryName: leg.partnerCountryName || null
            }))
          : [
              {
                legNo: 1,
                transportMode: formData.transport_mode || "by_sea",
                fromCountryId: formData.loading_country_id || null,
                fromCountryName: formData.loading_country_name || null,
                toCountryId: formData.receiving_country_id || null,
                toCountryName: formData.receiving_country_name || null,
                fromLocationText: formData.loading_source_name || firstGoods.warehouseName || null,
                toLocationText: formData.final_delivery_location || formData.destination_port_name || null,
                portOfLoading: formData.loading_port_name || null,
                portOfDischarge: formData.destination_port_name || null,
                truckId: effTruckId,
                truckRegistrationType: formData.truck_assignment_mode === "permanent" ? "registered" : "temporary",
                truckNumber: effTruckNumber,
                truckDriverName: effDriverName,
                truckDriverMobile: effDriverMobile,
                status: "pending",
                plannedDeparture: formData.planned_departure_date || null,
                actualDeparture: formData.actual_departure_date || null,
                plannedArrival: formData.planned_arrival_date || null,
                actualArrival: formData.actual_arrival_date || null
              }
            ];

      const payload = {
        ...formData,
        status: isFinalConfirm ? "booking_confirmed" : formData.status || "pending",
        customer_id: supplier.customerId || formData.customer_id || null,
        customer_name: supplier.customerName || formData.customer_name || null,
        goods_id: firstGoods.goodsId || formData.goods_id || null,
        goods_variation_id: firstGoods.goodsVariationId || formData.goods_variation_id || null,
        goods_name: aggregatedGoodsNames,
        goods_chs_code: firstGoods.goodsChsCode || formData.goods_chs_code || null,
        goods_variation_label: firstGoods.goodsVariationLabel || formData.goods_variation_label || null,
        goods_brand: formData.goods_brand || null,
        goods_size: formData.goods_size || null,
        goods_origin_country_name: formData.goods_origin_country_name || null,
        goods_quantity: totalQuantity || (formData.goods_quantity ? Number(formData.goods_quantity) : null),
        goods_unit: firstGoods.unit || formData.goods_unit || "Bags",
        goods_bags_cartons: totalQuantity || (formData.goods_bags_cartons ? Number(formData.goods_bags_cartons) : null),
        goods_gross_weight: totalGrossKg || (formData.goods_gross_weight ? Number(formData.goods_gross_weight) : null),
        goods_empty_weight: formData.goods_empty_weight ? Number(formData.goods_empty_weight) : null,
        goods_net_weight: totalGrossKg || (formData.goods_net_weight ? Number(formData.goods_net_weight) : null),
        truck_id: effTruckId,
        truck_number: effTruckNumber,
        truck_driver_name: effDriverName,
        truck_driver_mobile: effDriverMobile,
        truck_transport_company: effTransportCo,
        exporter_name: partySelections.exporter.customerName || formData.exporter_name || null,
        importer_name: partySelections.importer.customerName || formData.importer_name || null,
        buyer_name: partySelections.buyer.customerName || formData.buyer_name || null,
        consignee_name: partySelections.consignee.customerName || formData.consignee_name || null,
        notify_party_name: partySelections.notify_party.customerName || formData.notify_party_name || null,
        party_links: Object.entries(partySelections)
          .filter(([, s]) => Boolean(s.customerName || s.companyName || s.addressText))
          .map(([roleKey, selection]) => ({
            roleKey: roleKey as PartyRoleKey,
            partyCustomerId: selection.customerId || null,
            partyCustomerName: selection.customerName || null,
            partyCompanyId: selection.companyId || null,
            partyCompanyName: selection.companyName || null,
            selectedAddressText: selection.addressText || null,
            selectedAddressSource: selection.addressSource || null
          } satisfies PartyLinkInput)),
        legs: legsToSave,
        loadingAllocations: effectiveAllocations
      };

      const response = await fetch(
        editingOrderId ? `/api/erp/clearing-agent/customer-order/${editingOrderId}` : "/api/erp/clearing-agent/customer-order",
        {
          method: editingOrderId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error || tt("save_failed", "Failed to save order"));

      const savedOrder = result.data;
      if (!editingOrderId && savedOrder?.id) {
        setEditingOrderId(savedOrder.id);
      }

      setSuccessMessage(
        advanceStep && currentStep === 4
          ? tt("order_completed_successfully", "Order {orderNo} completed successfully!").replace("{orderNo}", savedOrder?.order_no || "")
          : tt("order_progress_saved", "Order {orderNo} progress saved (Step {step}/4).").replace("{orderNo}", savedOrder?.order_no || "").replace("{step}", String(currentStep))
      );

      await fetchInitialData();

      if (advanceStep && currentStep < 4) {
        const nextStep = (currentStep + 1) as 1 | 2 | 3 | 4;
        const nextSub: "1A" | "1B" | "1C" = nextStep === 2 ? "1B" : nextStep === 3 ? "1C" : "1C";
        setStageHandoverPrompt({
          orderId: savedOrder?.id || editingOrderId || "",
          orderNo: savedOrder?.order_no || formData.order_no || "Draft",
          currentStepNum: currentStep,
          currentStepTitle: stepsList[currentStep - 1]?.title || `Step ${currentStep}`,
          nextStepNum: nextStep,
          nextStepTitle: stepsList[nextStep - 1]?.title || `Step ${nextStep}`,
          nextSubStep: nextSub,
          defaultTask: currentStep === 1
            ? tt("task_truck_transport", "Please assign and enter Truck & Transport fleet details for Order {orderNo}.").replace("{orderNo}", savedOrder?.order_no || formData.order_no || "")
            : currentStep === 2
            ? tt("task_goods_manifest", "Please enter Goods manifest and warehouse breakdown for Order {orderNo}.").replace("{orderNo}", savedOrder?.order_no || formData.order_no || "")
            : tt("task_expenses_review", "Please review expenses, Shipping Line Admin and Customs clearance for Order {orderNo}.").replace("{orderNo}", savedOrder?.order_no || formData.order_no || ""),
          transferType: currentStep === 1 ? "truck_task" : currentStep === 2 ? "goods_verification" : "shipping_handover"
        });
      } else if (advanceStep && currentStep === 4) {
        // Offer the handover choice before clearing the wizard — resetForm() runs
        // only after the user picks "Continue Myself" or finishes an assignment.
        setJustCompletedOrder({
          id: savedOrder?.id,
          orderNo: savedOrder?.order_no || "",
          countryId: formData.loading_country_id || formData.receiving_country_id || null,
          customerName: partySelections.supplier.customerName || formData.customer_name || null
        });
      }
      return savedOrder;
    } catch (error: any) {
      alert(`${tt("err_save_failed", "Save failed")}: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOrderApprovalAction = async (orderId: string, action: "submit" | "approve" | "reject") => {
    if (action === "reject") {
      const reason = window.prompt(tt("reject_reason_prompt", "Reason for rejection (optional):") ?? "") ?? "";
      return handleOrderApprovalActionWithReason(orderId, action, reason);
    }
    return handleOrderApprovalActionWithReason(orderId, action, null);
  };

  const handleOrderApprovalActionWithReason = async (orderId: string, action: "submit" | "approve" | "reject", reason: string | null) => {
    setApprovalActionOrderId(orderId);
    try {
      const response = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason || undefined })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || tt("approval_action_failed", "Action failed"));
      await fetchInitialData();
    } catch (error: any) {
      alert(`${tt("approval_action_failed", "Action failed")}: ${error?.message || error}`);
    } finally {
      setApprovalActionOrderId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(tt("confirm_delete", "Are you sure you want to delete this customer order?"))) return;
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || tt("err_delete_order_failed", "Failed to delete order"));
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setSuccessMessage(tt("order_deleted", "Customer order deleted successfully"));
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("Failed to delete order", error);
    }
  };

  const selectedCustomerInfo = useMemo(() => {
    return customers.find((c) => c.id === formData.customer_id);
  }, [customers, formData.customer_id]);

  const selectedAccountInfo = useMemo(() => {
    return accounts.find(
      (a) =>
        (formData.customer_id && a.customer_id === formData.customer_id) ||
        a.id === formData.customer_id ||
        (selectedCustomerInfo && a.id === (selectedCustomerInfo as any).account_id)
    );
  }, [accounts, formData.customer_id, selectedCustomerInfo]);

  const selectedSupplierInfo = useMemo(() => {
    const sId = partySelections.supplier?.customerId || partySelections.exporter?.customerId;
    return customers.find((c) => c.id === sId);
  }, [customers, partySelections]);

  const selectedBuyerInfo = useMemo(() => {
    const bId = partySelections.buyer?.customerId || partySelections.importer?.customerId;
    return customers.find((c) => c.id === bId);
  }, [customers, partySelections]);

  const handleDirectCustomerChange = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    const acc = accounts.find((a) => (a.customer_id && a.customer_id === customerId) || a.id === customerId);
    const effectiveCustName = cust?.customer_name || acc?.name || "";
    setFormData((current) => ({
      ...current,
      customer_id: customerId,
      customer_name: effectiveCustName
    }));
    handlePartyChange("supplier", {
      customerId,
      customerName: effectiveCustName,
      companyId: cust?.country_id || "",
      companyName: cust?.company_name || "",
      addressText: cust?.address || "",
      addressSource: "customer"
    });
  };

  // Unified Operational Stage Workflow Handlers (1A -> 1B -> 1C)
  const handleAssignStage1A = async () => {
    let orderId = editingOrderId;
    if (!orderId) {
      const saved = await handleSaveProgress(false);
      if (!saved?.id) return;
      orderId = saved.id;
    }
    setAssignmentModalStage("1A_TO_1B");
    setAssignmentTruckData(null);
    setAssignmentModalOpen(true);
  };

  const handleConfirmTruckContinueMyself = async () => {
    if (!formData.truck_number && formData.truck_assignment_mode !== "later") {
      alert("Please enter or select a Truck Number before confirming.");
      return;
    }
    setSaving(true);
    try {
      let orderId = editingOrderId;
      if (!orderId) {
        const saved = await handleSaveProgress(false);
        if (!saved?.id) return;
        orderId = saved.id;
      } else {
        await handleSaveProgress(false);
      }
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_truck",
          truckNumber: formData.truck_number || "TO BE ASSIGNED",
          truckDriverName: formData.truck_driver_name,
          truckDriverMobile: formData.truck_driver_mobile,
          vehicleType: formData.truck_vehicle_type || "Container Trailer",
          truckRegistrationType: formData.truck_registration_type || "temporary",
          truckTransportCompany: formData.truck_transport_company,
          arrivalTime: formData.truck_arrival_time,
          loadingLocation: formData.truck_loading_location,
          truckStatus: formData.truck_status || "Pending",
          continueMyself: true
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to confirm truck");
      setSuccessMessage("Truck confirmed! Proceeding to Stage 1C (Goods Entry).");
      setStep1SubStep("1C");
      setCurrentStep(3);
      await fetchInitialData();
    } catch (err: any) {
      alert(err.message || "Failed to confirm truck");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmTruckAssignGoods = async () => {
    if (!formData.truck_number && formData.truck_assignment_mode !== "later") {
      alert("Please enter or select a Truck Number before confirming.");
      return;
    }
    let orderId = editingOrderId;
    if (!orderId) {
      const saved = await handleSaveProgress(false);
      if (!saved?.id) return;
      orderId = saved.id;
    } else {
      await handleSaveProgress(false);
    }
    setAssignmentModalStage("1B_TO_1C");
    setAssignmentTruckData({
      truckNumber: formData.truck_number || "TO BE ASSIGNED",
      truckDriverName: formData.truck_driver_name,
      truckDriverMobile: formData.truck_driver_mobile,
      vehicleType: formData.truck_vehicle_type || "Container Trailer",
      truckRegistrationType: formData.truck_registration_type || "temporary",
      truckTransportCompany: formData.truck_transport_company,
      arrivalTime: formData.truck_arrival_time,
      loadingLocation: formData.truck_loading_location,
      truckStatus: formData.truck_status || "Pending"
    });
    setAssignmentModalOpen(true);
  };

  const handleTriggerReturnModal = (stage: "1B" | "1C") => {
    if (!editingOrderId) {
      alert("Please save the order before returning for correction.");
      return;
    }
    setReturnOrderInfo({
      id: editingOrderId,
      orderNo: formData.order_no || "Draft",
      stage
    });
    setReturnModalOpen(true);
  };

  const handleCompleteGoodsEntry = async () => {
    const validItems = (formData.goods_items || []).filter((g) => g.goodsName || g.quantity);
    if (validItems.length === 0) {
      alert("Please add at least one goods item to the manifest.");
      return;
    }
    setSaving(true);
    try {
      let orderId = editingOrderId;
      if (!orderId) {
        const saved = await handleSaveProgress(false);
        if (!saved?.id) return;
        orderId = saved.id;
      } else {
        await handleSaveProgress(false);
      }
      const totalNet = validItems.reduce((acc, g) => acc + (Number(g.netWeight || g.totalKg) || 0), 0);
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_goods",
          goodsItems: validItems,
          totalItems: validItems.length,
          totalNetWeight: totalNet
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to complete goods entry");
      setSuccessMessage(`Goods Entry completed successfully for Order ${formData.order_no}!`);
      setIsFormOpen(false);
      await fetchInitialData();
    } catch (err: any) {
      alert(err.message || "Failed to complete goods entry");
    } finally {
      setSaving(false);
    }
  };

  const stepsList = [
    {
      num: 1,
      title: "1A: " + t(lang, "comv.step1_name", "Customer & Route"),
      shortTitle: "1A: Booking",
      desc: t(lang, "comv.step1_desc", "Account, Movement Type (Import/Export/Transit) & Route")
    },
    {
      num: 2,
      title: "1B: " + t(lang, "comv.step2_name", "Truck & Transport"),
      shortTitle: "1B: Fleet",
      desc: t(lang, "comv.step2_desc", "Fleet Assignment & Driver Details")
    },
    {
      num: 3,
      title: "1C: " + t(lang, "comv.step3_name", "Goods & Warehouse"),
      shortTitle: "1C: Goods",
      desc: t(lang, "comv.step3_desc", "Own / Other Warehouse & Goods Manifest")
    },
    {
      num: 4,
      title: t(lang, "comv.step4_name", "Review, Shipping & Customs"),
      shortTitle: "4: Review & Sheet",
      desc: t(lang, "comv.step4_desc", "Expenses, Customs Agent & Confirmation")
    }
  ];

  return (
    <div className="w-full space-y-4 pb-12" dir={isRtl ? "rtl" : "ltr"}>
      {successMessage ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {stageHandoverPrompt && !handoffModalOpen ? (
        <SimpleModal
          title={tt("stage_handover_title", "Step Saved — Next Handover Choice")}
          onClose={() => {
            setCurrentStep(stageHandoverPrompt.nextStepNum as any);
            setStep1SubStep(stageHandoverPrompt.nextSubStep);
            setStageHandoverPrompt(null);
          }}
          className="w-[95vw] max-w-md rounded-3xl font-sans shadow-2xl"
        >
          <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 p-5 text-xs text-slate-800 dark:text-slate-200">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{stageHandoverPrompt.currentStepTitle} — Saved Successfully!</span>
              </div>
              <div className="mt-1 text-[11px] text-emerald-700/90 dark:text-emerald-400">
                Order <span className="font-mono font-bold">{stageHandoverPrompt.orderNo}</span> progress is saved.
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Next Stage / Agla Marhala:
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-blue-600" />
                <span>{stageHandoverPrompt.nextStepTitle}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                Aap yeh agla step khud mukammal karenge ya kisi doosre user ko assign / transfer karenge?
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(stageHandoverPrompt.nextStepNum as any);
                  setStep1SubStep(stageHandoverPrompt.nextSubStep);
                  setStageHandoverPrompt(null);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 shadow-sm transition"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{tt("continue_myself", "Continue Myself")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setJustCompletedOrder({
                    id: stageHandoverPrompt.orderId,
                    orderNo: stageHandoverPrompt.orderNo,
                    countryId: formData.loading_country_id || formData.receiving_country_id || null,
                    customerName: partySelections.supplier.customerName || formData.customer_name || null
                  });
                  setHandoffModalOpen(true);
                  setStageHandoverPrompt(null);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2.5 transition dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <Users className="h-3.5 w-3.5" />
                <span>{tt("assign_transfer_other_user", "Assign / Transfer to Another User")}</span>
              </button>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {justCompletedOrder && !handoffModalOpen ? (
        <SimpleModal
          title={tt("handover_choice_title", "Order Confirmed — What Next?")}
          onClose={() => { setJustCompletedOrder(null); resetForm(); }}
          className="w-[95vw] max-w-md rounded-3xl font-sans shadow-2xl"
        >
          <div dir={isRtl ? "rtl" : "ltr"} className="space-y-3 p-5 text-xs text-slate-800 dark:text-slate-200">
            <p className="text-slate-600 dark:text-slate-300">
              {tt("handover_choice_desc", "Order")} <span className="font-bold text-slate-900 dark:text-white">{justCompletedOrder.orderNo}</span> {tt("handover_choice_desc2", "is saved. Continue working on it yourself, or hand it off to another user for the next step.")}
            </p>
            <Link
              href="/dashboard/clearing-agent/order-transfer"
              onClick={() => { setJustCompletedOrder(null); resetForm(); }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 transition shadow-sm"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>{tt("nav_customer_order_transfer", "Customer Order Transfer")}</span>
            </Link>
            <button
              type="button"
              onClick={() => { setJustCompletedOrder(null); resetForm(); }}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 transition"
            >
              {tt("continue_myself", "Continue Myself")}
            </button>
            <button
              type="button"
              onClick={() => setHandoffModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2.5 transition dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              {tt("assign_another_user", "Assign to Another User")}
            </button>
          </div>
        </SimpleModal>
      ) : null}

      {handoffModalOpen && justCompletedOrder ? (
        <TaskHandoverModal
          open={handoffModalOpen}
          onClose={() => setHandoffModalOpen(false)}
          orderReference={justCompletedOrder.orderNo}
          sourceTable="clearing_customer_orders"
          sourceId={justCompletedOrder.id}
          targetUrl={`/dashboard/clearing-agent/customer-order?id=${justCompletedOrder.id}`}
          defaultTask={tt("handover_default_task", "Please continue this customer order to the next step.")}
          sourceCountryId={justCompletedOrder.countryId}
          domain="business"
          onSuccess={() => { setHandoffModalOpen(false); setJustCompletedOrder(null); resetForm(); }}
          lang={lang}
        />
      ) : null}

      {/* Complete Activity Timeline & Audit Trail Modal */}
      <CustomerOrderActivityTimelineModal
        isOpen={timelineModalOpen}
        orderId={timelineOrder?.id || null}
        orderNo={timelineOrder?.orderNo || null}
        onClose={() => {
          setTimelineModalOpen(false);
          setTimelineOrder(null);
        }}
        lang={lang}
      />

      {/* Return for Correction Modal */}
      {returnOrderInfo ? (
        <CustomerOrderReturnCorrectionModal
          isOpen={returnModalOpen}
          orderId={returnOrderInfo.id}
          orderNo={returnOrderInfo.orderNo}
          currentStage={returnOrderInfo.stage}
          onClose={() => {
            setReturnModalOpen(false);
            setReturnOrderInfo(null);
          }}
          onSuccess={async (reason) => {
            setSuccessMessage(`Order ${returnOrderInfo.orderNo} returned for correction: "${reason}".`);
            await fetchInitialData();
          }}
          lang={lang}
        />
      ) : null}

      {/* Stage Assignment Modal (1A -> 1B or 1B -> 1C) */}
      <CustomerOrderStageAssignmentModal
        isOpen={assignmentModalOpen}
        orderId={editingOrderId || ""}
        orderNo={formData.order_no || "Draft"}
        stage={assignmentModalStage}
        truckData={assignmentTruckData}
        countries={countries}
        countryBranches={countryBranches}
        cityBranches={cityBranches}
        assignableUsers={assignableUsers}
        onClose={() => setAssignmentModalOpen(false)}
        onSuccess={async (userName) => {
          setSuccessMessage(`Order assigned to ${userName} successfully!`);
          setAssignmentModalOpen(false);
          setIsFormOpen(false);
          await fetchInitialData();
        }}
        lang={lang}
      />

      {!isFormOpen ? (
        /* ========================================================================= */
        /* MODE 1: ENTERPRISE CUSTOMER ORDERS REGISTRY (MAIN SCREEN TABLE VIEW)      */
        /* ========================================================================= */
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Action Bar */}
          <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs shrink-0"
                  title={tt("back_to_dashboard", "Back to Dashboard")}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>{tt("back", "Back")}</span>
                </Link>

                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/50 dark:border-blue-900 dark:text-blue-400">
                  <Route className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
                    <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-200">
                      {tt("breadcrumb_dashboard", "Dashboard")}
                    </Link>
                    <span>&gt;</span>
                    <span>{tt("breadcrumb_shipping", "Shipping & Clearing")}</span>
                    <span>&gt;</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold truncate">
                      {tt("registry_title", "Customer Orders Registry")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                      {tt("registry_title", "Customer Orders Registry")}
                    </h1>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                      {orders.length} {tt("orders_badge", "Orders")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {/* 3 Scope Mode Tabs: Super Admin / Country Admin / Branch Admin */}
                <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setScopeMode("super_admin");
                      setSelectedCountryScopeId("");
                      setSelectedBranchScopeId("");
                    }}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      scopeMode === "super_admin"
                        ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs border border-slate-200/80 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span>{tt("scope_super_admin", "Super Admin")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScopeMode("country");
                      if (!selectedCountryScopeId && countries.length > 0) {
                        setSelectedCountryScopeId(countries[0].id);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      scopeMode === "country"
                        ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs border border-slate-200/80 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Globe2 className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{tt("scope_country_admin", "Country Admin")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScopeMode("branch");
                      if (!selectedBranchScopeId && (cityBranches.length > 0 || countryBranches.length > 0)) {
                        setSelectedBranchScopeId(cityBranches[0]?.id || countryBranches[0]?.id || "");
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      scopeMode === "branch"
                        ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs border border-slate-200/80 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{tt("scope_branch_admin", "Branch Admin")}</span>
                  </button>

                  {/* Contextual Selector for Country */}
                  {scopeMode === "country" ? (
                    <select
                      value={selectedCountryScopeId}
                      onChange={(e) => setSelectedCountryScopeId(e.target.value)}
                      className="ml-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-bold text-indigo-900 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-200"
                    >
                      <option value="">{tt("all_countries", "— All Countries —")}</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {/* Contextual Selector for Branch */}
                  {scopeMode === "branch" ? (
                    <select
                      value={selectedBranchScopeId}
                      onChange={(e) => setSelectedBranchScopeId(e.target.value)}
                      className="ml-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200"
                    >
                      <option value="">{tt("all_branches", "— All Branches —")}</option>
                      {cityBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                      {cityBranches.length === 0 &&
                        countryBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  ) : null}
                </div>

                {/* Branch Scope Dropdown for Multi-Branch Scope */}
                <BranchScopeDropdown
                  lang={lang}
                  countries={countries}
                  countryBranches={countryBranches}
                  cityBranches={cityBranches}
                  value={branchScope}
                  onChange={setBranchScope}
                  className="w-full sm:w-auto"
                />

                {/* Refresh */}
                <button
                  type="button"
                  onClick={fetchInitialData}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  title={refreshLabel}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{refreshLabel}</span>
                </button>

                {/* CSV Export */}
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  title={tt("export_csv", "Export to CSV")}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>

                {/* Primary + New Order Button */}
                <button
                  type="button"
                  onClick={handleStartNewOrder}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>{tt("new", "New Order")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 6 Top KPI Summary Cards — Compact Local Purchase Style */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* 1. Total Orders */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition h-full min-h-[145px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    1. {tt("kpi_total_orders", "Total Orders")}
                  </span>
                </div>
              </div>
              <div className="py-1.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <div className="text-xl font-black text-slate-900 dark:text-white">{orderCounts.total}</div>
                <div className="flex flex-wrap items-center gap-1 text-[9.5px] font-mono">
                  <span className="text-slate-400">Draft: <strong className="text-slate-700 dark:text-slate-300">{orderCounts.draft}</strong></span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-amber-600">Active: <strong>{orderCounts.confirmed}</strong></span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-emerald-600">Done: <strong>{orderCounts.cleared}</strong></span>
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-medium">Orders Registry</span>
                <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{orders.length} total</span>
              </div>
            </div>

            {/* 2. Movements */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition h-full min-h-[145px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Route className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    2. {tt("kpi_movements", "Movements")}
                  </span>
                </div>
              </div>
              <div className="py-1.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <div className="text-xl font-black text-purple-600 dark:text-purple-400">{orderCounts.total}</div>
                <div className="flex flex-wrap items-center gap-1 text-[9.5px] font-mono">
                  <span className="text-emerald-600">Imp: <strong>{orderCounts.import}</strong></span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-purple-600">Exp: <strong>{orderCounts.export}</strong></span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-amber-600">Tr: <strong>{orderCounts.transit}</strong></span>
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-medium">Logistics Modes</span>
                <span className="font-mono font-bold text-purple-700 dark:text-purple-400">Multi-Modal</span>
              </div>
            </div>

            {/* 3. Locations & Ports */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition h-full min-h-[145px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Anchor className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    3. {tt("kpi_locations", "Locations & Ports")}
                  </span>
                </div>
              </div>
              <div className="py-1.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  {countries.length} <span className="text-xs font-normal text-slate-400">{tt("countries", "Countries")}</span>
                </div>
                <div className="text-[9.5px] font-mono text-slate-500">
                  {ports.length} {tt("active_ports", "Active Ports")}
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-medium">Global Gateways</span>
                <span className="font-mono font-bold text-sky-700 dark:text-sky-400">Active</span>
              </div>
            </div>

            {/* 4. Total Volume */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition h-full min-h-[145px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Scale className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    4. {tt("kpi_total_volume", "Total Volume")}
                  </span>
                </div>
              </div>
              <div className="py-1.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  {orderCounts.totalVolume.toLocaleString()} <span className="text-xs font-normal text-slate-400">MT</span>
                </div>
                <div className="text-[9.5px] font-mono text-slate-500">
                  {tt("combined_cargo", "Combined Cargo Weight")}
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-medium">Manifest Weight</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Verified</span>
              </div>
            </div>

            {/* 5. Active Routes */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition h-full min-h-[145px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Globe2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    5. {tt("kpi_active_routes", "Active Routes")}
                  </span>
                </div>
              </div>
              <div className="py-1.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {orderCounts.uniqueRoutes}
                </div>
                <div className="text-[9.5px] font-mono text-slate-500">
                  {tt("cross_border_routes", "Cross-Border Routes")}
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-medium">Transit Corridors</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Active</span>
              </div>
            </div>

            {/* 6. Quick Info */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition h-full min-h-[145px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                    <BadgeInfo className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    6. {tt("kpi_quick_info", "Quick Info")}
                  </span>
                </div>
              </div>
              <div className="py-1.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                  {userContext.context?.branchName || tt("global_group", "Global Group")}
                </div>
                <div className="text-[9.5px] font-medium text-slate-500 truncate">
                  {tt("shipping_clearing_erp", "Shipping & Clearing ERP")}
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-medium">System Context</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Enterprise</span>
              </div>
            </div>
          </div>

          {/* User Operational Queues Tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2 shadow-2xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
              <button
                type="button"
                onClick={() => setQueueTab("all")}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  queueTab === "all"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                }`}
              >
                <span>{tt("queue_all_orders", "All Orders")}</span>
                <span className="font-mono text-[10px] opacity-80">({queueCounts.all})</span>
              </button>

              <button
                type="button"
                onClick={() => setQueueTab("assigned_to_me")}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  queueTab === "assigned_to_me"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                }`}
              >
                <User className="h-3 w-3" />
                <span>{tt("queue_assigned_to_me", "Assigned to Me")}</span>
                <span className="font-mono text-[10px] font-black rounded-full bg-blue-700 text-white px-1.5 py-0.2">
                  {queueCounts.assignedToMe}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setQueueTab("pending_with_me")}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  queueTab === "pending_with_me"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>{tt("queue_pending_with_me", "Pending with Me")}</span>
                <span className="font-mono text-[10px] font-black rounded-full bg-indigo-700 text-white px-1.5 py-0.2">
                  {queueCounts.pendingWithMe}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setQueueTab("completed_by_me")}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  queueTab === "completed_by_me"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>{tt("queue_completed_by_me", "Completed by Me")}</span>
                <span className="font-mono text-[10px] opacity-80">({queueCounts.completedByMe})</span>
              </button>

              <button
                type="button"
                onClick={() => setQueueTab("sent_to_another")}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  queueTab === "sent_to_another"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100"
                }`}
              >
                <ArrowRightLeft className="h-3 w-3" />
                <span>{tt("queue_sent_to_another", "Sent to Another User")}</span>
                <span className="font-mono text-[10px] opacity-80">({queueCounts.sentToAnother})</span>
              </button>

              <button
                type="button"
                onClick={() => setQueueTab("returned")}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  queueTab === "returned"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                }`}
              >
                <AlertTriangle className="h-3 w-3 text-rose-500" />
                <span>{tt("queue_returned_for_correction", "Returned for Correction")}</span>
                <span className="font-mono text-[10px] font-black rounded-full bg-rose-700 text-white px-1.5 py-0.2">
                  {queueCounts.returned}
                </span>
              </button>
            </div>
          </div>

          {/* Smart Filter Bar — Local Purchase Aesthetic */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-2xs space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              {/* Quick Status Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    statusFilter === "all"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <span>{tt("all_statuses", "All")}</span>
                  <span className="font-mono text-[10px] opacity-80">({orders.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("booking_confirmed")}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    statusFilter === "booking_confirmed"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <span className="text-amber-500">●</span>
                  <span>{tt("status_confirmed", "Active")}</span>
                  <span className="font-mono text-[10px] opacity-80">({orderCounts.confirmed})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("draft")}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    statusFilter === "draft"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <span className="text-slate-400">●</span>
                  <span>{tt("status_draft", "Draft")}</span>
                  <span className="font-mono text-[10px] opacity-80">({orderCounts.draft})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("completed")}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    statusFilter === "completed"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <span className="text-emerald-500">●</span>
                  <span>{tt("status_completed", "Cleared")}</span>
                  <span className="font-mono text-[10px] opacity-80">({orderCounts.cleared})</span>
                </button>
              </div>

              {/* Right Side: Search + Dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tt("search_placeholder", "Search order, customer, goods, route...")}
                    className="w-full h-8.5 rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-7 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Transport Mode Filter */}
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">{tt("all_modes", "All Modes")}</option>
                  <option value="by_sea">{tt("tm_by_sea", "Sea")}</option>
                  <option value="by_road">{tt("tm_by_road", "Road")}</option>
                  <option value="by_air">{tt("tm_by_air", "Air")}</option>
                  <option value="by_rail">{t(lang, "comv.tm_by_rail", "Rail")}</option>
                </select>

                {/* Movement Type Filter */}
                <select
                  value={movementFilter}
                  onChange={(e) => setMovementFilter(e.target.value)}
                  className="h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">{tt("all_movements", "All Movements")}</option>
                  <option value="import">{tt("mv_import", "Import")}</option>
                  <option value="export">{tt("mv_export", "Export")}</option>
                  <option value="domestic">{tt("mv_domestic", "Domestic")}</option>
                  <option value="transit">{t(lang, "comv.mv_transit", "Transit")}</option>
                </select>

                {(statusFilter !== "all" || modeFilter !== "all" || movementFilter !== "all" || searchQuery) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all");
                      setModeFilter("all");
                      setMovementFilter("all");
                      setSearchQuery("");
                    }}
                    className="h-8.5 inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{tt("reset_filters", "Reset")}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Full Enterprise Customer Orders Registry Table — Compact Local Purchase Style */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 dark:border-slate-800 dark:from-slate-850 dark:to-slate-900">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>{tt("registry_table_title", "Customer Shipping Orders Registry")}</span>
              </div>
              <div className="flex items-center gap-2">
              <JournalPrintButton
                title={tt("registry_table_title", "Customer Shipping Orders Registry")}
                columns={[
                  { key: "order_no", label: tt("th_order_no", "Order No"), align: "center" },
                  { key: "created_at", label: tt("th_date", "Date"), align: "center", format: "date" },
                  { key: "customer_name", label: tt("th_party", "Customer / Account") },
                  { key: "exporter_name", label: tt("th_shipper", "Shipper / Exporter") },
                  { key: (r) => String((r as any).buyer_name || (r as any).importer_name || ""), label: tt("th_buyer", "Buyer / Importer") },
                  { key: "goods_name", label: tt("th_goods", "Goods & Qty") },
                  { key: (r) => (r as any).goods_quantity ? `${(r as any).goods_quantity} ${(r as any).goods_unit || ""}`.trim() : "", label: pl("Quantity"), align: "right" },
                  { key: (r) => String((r as any).route_name || [(r as any).loading_country_name, (r as any).receiving_country_name].filter(Boolean).join(" -> ")), label: tt("th_route", "Route / Ports") },
                  { key: (r) => `${(r as any).movement_type || ""} ${String((r as any).transport_mode || "").replace("_", " ")}`.trim(), label: tt("th_movement", "Mode & Movement") },
                  { key: (r) => tt(getOrderProgress(r as any).labelKey, String((r as any).status ?? "")), label: tt("th_step_status", "Status"), align: "center" },
                  { key: "branch_name", label: tt("th_branch", "Branch / Agent") },
                ]}
                rows={visibleOrders as unknown as Record<string, unknown>[]}
                filters={[
                  ...(statusFilter !== "all" ? [{ label: tt("th_step_status", "Status"), value: statusFilter }] : []),
                  ...(modeFilter !== "all" ? [{ label: pl("Mode"), value: modeFilter }] : []),
                  ...(movementFilter !== "all" ? [{ label: tt("th_movement", "Mode & Movement"), value: movementFilter }] : []),
                  ...((searchQuery || filterState.query) ? [{ label: pl("Search"), value: String(searchQuery || filterState.query) }] : []),
                ]}
                orientation="landscape"
              />
              <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                {visibleOrders.length} / {orders.length} {tt("visible", "visible")}
              </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 text-[9px] font-black uppercase tracking-wider sticky top-0">
                  <tr>
                    <Th className="px-3.5 py-3">#</Th>
                    <Th className="px-3.5 py-3">{tt("th_order_no", "Order No")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_date", "Date")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_party", "Customer / Account")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_stage_lifecycle", "Stage Lifecycle (1A / 1B / 1C)")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_goods", "Goods & Qty")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_route", "Route / Ports")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_responsible_user", "Responsible User & Branch")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_next_action", "Next Required Action")}</Th>
                    <Th className="px-3.5 py-3 text-right">{tt("th_actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        <div className="mx-auto max-w-sm space-y-3">
                          <Route className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            {tt("no_orders_found", "No customer orders found.")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {tt("no_orders_desc", "Click '+ New Order' above to create a new customer shipping order.")}
                          </p>
                          <button
                            type="button"
                            onClick={handleStartNewOrder}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{tt("new", "New Order")}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visibleOrders.map((order, index) => {
                      const isSelected = editingOrderId === order.id;
                      const dateText = order.created_at ? new Date(order.created_at).toLocaleDateString() : "-";
                      const currentUserId = userContext.context?.userId;

                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-slate-50/80 transition dark:hover:bg-slate-800/50 ${
                            isSelected ? "bg-blue-50/60 dark:bg-blue-950/30 font-semibold" : ""
                          }`}
                        >
                          <td className="px-3.5 py-3 font-bold text-slate-400">{index + 1}</td>
                          <td className="px-3.5 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForSerials(order)}
                              className="group flex flex-col items-start text-left focus:outline-hidden"
                              title={tt("view_4_canonical_serials", "Click to view 4 canonical serial numbers & details")}
                            >
                              <div className="flex items-center gap-1.5 font-mono font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                <span className="underline decoration-dotted">{order.order_no || `CL-${order.id.slice(0, 6)}`}</span>
                                <span className="opacity-80 group-hover:opacity-100 rounded bg-blue-100 dark:bg-blue-900/60 px-1 py-0.2 text-[9px] font-mono text-blue-700 dark:text-blue-200">
                                  4 Serials
                                </span>
                              </div>
                              <span className="text-[9.5px] text-slate-400 group-hover:text-blue-500 transition-colors">
                                {tt("click_to_inspect_serials", "Click for SA / Country / Branch")}
                              </span>
                            </button>
                            <div className="text-[10px] text-slate-400 mt-1">
                              <a
                                href={`/dashboard/clearing-agent/customer-order/${order.id}/workflow`}
                                className="text-slate-500 hover:text-blue-600 hover:underline inline-flex items-center gap-0.5"
                                title={tt("shipping_clearing_pipeline", "Shipping / Clearing pipeline — truck, goods verification, customs, handover")}
                              >
                                <span>{tt("workflow_link", "Workflow")}</span>
                                <span>&rarr;</span>
                              </a>
                            </div>
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap text-slate-500 font-medium">{dateText}</td>
                          <td className="px-3.5 py-3">
                            {(() => {
                              const linkedCust = customers.find((c) => c.id === order.customer_id || c.name === order.customer_name);
                              const linkedAcc = accounts.find((a) =>
                                a.id === order.account_id ||
                                (linkedCust && (a.id === (linkedCust as any).account_id || a.id === (linkedCust as any).accountId))
                              );
                              const phone = (order as any).customer_phone || (order as any).phone || (linkedCust as any)?.phone;

                              return (
                                <div className="space-y-1 min-w-[150px]">
                                  <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                    {order.customer_name || linkedCust?.name || "-"}
                                  </div>
                                  {linkedAcc ? (
                                    <div className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60 max-w-full truncate" title={linkedAcc.name || (linkedAcc as any).account_name}>
                                      <span>Acc: #{linkedAcc.account_number || (linkedAcc as any).code || linkedAcc.id.slice(0, 6)}</span>
                                      <span className="font-sans font-medium text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                                        - {linkedAcc.name || (linkedAcc as any).account_name}
                                      </span>
                                    </div>
                                  ) : order.customer_id ? (
                                    <div className="text-[10px] text-slate-400 font-mono">ID: {order.customer_id.slice(0, 8)}</div>
                                  ) : null}
                                  {phone ? (
                                    <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                                      <span className="text-slate-400">📞</span>
                                      <span>{phone}</span>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Stage Lifecycle (1A / 1B / 1C) */}
                          <td className="px-3.5 py-3">
                            <div className="flex flex-col gap-1 min-w-[130px]">
                              {/* 1A */}
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="font-bold text-slate-400">1A:</span>
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Setup Complete
                                </span>
                              </div>
                              {/* 1B */}
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="font-bold text-slate-400">1B:</span>
                                {order.truck_number && order.truck_number !== "TO BE ASSIGNED" ? (
                                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 font-bold truncate max-w-[110px]" title={order.truck_number}>
                                    <Truck className="h-2.5 w-2.5 shrink-0" /> {order.truck_number}
                                  </span>
                                ) : order.current_stage === "truck_confirmation_required" ? (
                                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                                    <Clock className="h-2.5 w-2.5 shrink-0" /> Assigned / Pending
                                  </span>
                                ) : order.current_stage === "returned_for_correction" ? (
                                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> Returned
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium">
                                    ○ Pending
                                  </span>
                                )}
                              </div>
                              {/* 1C */}
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="font-bold text-slate-400">1C:</span>
                                {order.current_stage === "goods_completed" || order.status === "completed" || (order.goods_gross_weight && Number(order.goods_gross_weight) > 0) ? (
                                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                                    <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> Goods Verified
                                  </span>
                                ) : order.current_stage === "goods_entry_required" || order.current_stage === "truck_confirmed" ? (
                                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                                    <Clock className="h-2.5 w-2.5 shrink-0" /> Assigned / Entry
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium">
                                    ○ Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Goods & Qty */}
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{order.goods_name || "-"}</div>
                            <div className="text-[10px] text-slate-500 font-bold">
                              {order.goods_quantity ? `${order.goods_quantity} ${order.goods_unit || ""}` : ""}
                              {order.goods_gross_weight ? ` • Gross: ${order.goods_gross_weight} kg` : ""}
                              {order.goods_chs_code ? ` • CHS: ${order.goods_chs_code}` : ""}
                            </div>
                          </td>

                          {/* Route / Ports */}
                          <td className="px-3.5 py-3 text-slate-600 dark:text-slate-400">
                            <div>{order.route_name || [order.loading_country_name, order.receiving_country_name].filter(Boolean).join(" → ") || "-"}</div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              <span className="capitalize rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {order.movement_type || "-"}
                              </span>
                              <span className="capitalize rounded bg-blue-50 px-1 py-0.2 text-[9px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                {order.transport_mode?.replace("_", " ") || "-"}
                              </span>
                            </div>
                          </td>

                          {/* Responsible User & Branch */}
                          <td className="px-3.5 py-3 text-slate-600 dark:text-slate-400">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px]">
                                <User className="h-3 w-3 text-blue-600" />
                                <span>{order.latest_handover?.receiver_name || order.created_by_name || "Responsible Desk"}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Building2 className="h-2.5 w-2.5" />
                                <span>{order.latest_handover?.dest_branch_name || order.branch_name || userContext.context?.branchName || "-"}</span>
                              </div>
                            </div>
                          </td>

                          {/* Next Required Action */}
                          <td className="px-3.5 py-3">
                            <div>
                              {order.current_stage === "returned_for_correction" ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300 shadow-2xs"
                                  title={order.rejected_reason || "Correction required"}
                                >
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[120px]">Fix: {order.rejected_reason || "Correction"}</span>
                                </span>
                              ) : order.current_stage === "truck_confirmation_required" || (!order.truck_number || order.truck_number === "TO BE ASSIGNED") ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    loadEditOrder(order);
                                    setStep1SubStep("1B");
                                    setCurrentStep(2);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 hover:bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300 shadow-2xs transition"
                                >
                                  <Truck className="h-3 w-3 shrink-0 text-amber-600" />
                                  <span>{tt("btn_confirm_truck", "Confirm Truck")}</span>
                                </button>
                              ) : order.current_stage === "goods_entry_required" || order.current_stage === "truck_confirmed" || (!order.goods_gross_weight && order.status !== "completed") ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    loadEditOrder(order);
                                    setStep1SubStep("1C");
                                    setCurrentStep(3);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 hover:bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800 border border-blue-200 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300 shadow-2xs transition"
                                >
                                  <Boxes className="h-3 w-3 shrink-0 text-blue-600" />
                                  <span>{tt("btn_enter_goods", "Enter Goods")}</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 shadow-2xs">
                                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                                  <span>{tt("status_completed", "Completed")}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-3.5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Timeline Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTimelineOrder({ id: order.id, orderNo: order.order_no || `CL-${order.id.slice(0, 6)}` });
                                  setTimelineModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition shadow-2xs"
                                title={tt("view_activity_timeline", "View Activity Timeline & Audit Trail")}
                              >
                                <Activity className="h-3.5 w-3.5 text-blue-600" />
                              </button>

                              {/* Quick Edit / Resume Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  loadEditOrder(order);
                                  if (order.current_stage === "truck_confirmation_required") {
                                    setStep1SubStep("1B");
                                    setCurrentStep(2);
                                  } else if (order.current_stage === "goods_entry_required" || order.current_stage === "truck_confirmed") {
                                    setStep1SubStep("1C");
                                    setCurrentStep(3);
                                  } else {
                                    setStep1SubStep("1A");
                                    setCurrentStep(1);
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition shadow-2xs"
                                title={tt("edit_order", "Edit Order")}
                              >
                                <Pencil className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                              </button>

                              {/* More Actions Dropdown */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  if (activeActionMenuId === order.id) {
                                    setActiveActionMenuId(null);
                                    setActionMenuAnchor(null);
                                  } else {
                                    setActiveActionMenuId(order.id);
                                    setActionMenuAnchor({
                                      id: order.id,
                                      top: rect.top,
                                      bottom: rect.bottom,
                                      right: rect.right
                                    });
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition shadow-2xs"
                                title={tt("th_actions", "Actions")}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary Strip — Local Purchase 4-stat Strip */}
            <div className="border-t border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-850/60">
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
                <div className="px-3.5 py-2.5 min-w-0">
                  <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">Visible Orders</span>
                  <strong className="block text-[12px] font-black text-slate-800 dark:text-slate-100">{visibleOrders.length}</strong>
                </div>
                <div className="px-3.5 py-2.5 min-w-0">
                  <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">Total Cargo Weight</span>
                  <strong className="block text-[12px] font-black text-indigo-600 dark:text-indigo-400">
                    {orderCounts.totalVolume.toLocaleString()} MT
                  </strong>
                </div>
                <div className="px-3.5 py-2.5 min-w-0">
                  <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">Active Corridors</span>
                  <strong className="block text-[12px] font-black text-emerald-600 dark:text-emerald-400">
                    {orderCounts.uniqueRoutes} Routes
                  </strong>
                </div>
                <div className="px-3.5 py-2.5 min-w-0">
                  <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">Confirmed / Cleared</span>
                  <strong className="block text-[12px] font-black text-blue-600 dark:text-blue-400">
                    {orderCounts.confirmed} / {orderCounts.cleared}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Floating Action Dropup Menu for Table Rows (Never clipped!) */}
          {activeActionMenuId && actionMenuAnchor && (() => {
            const targetOrder = orders.find((o) => o.id === activeActionMenuId);
            if (!targetOrder) return null;
            const isDropup = actionMenuAnchor.top > (typeof window !== "undefined" ? window.innerHeight - 260 : 500);
            return (
              <div
                className="fixed z-[99999] w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-xs font-medium divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100"
                style={{
                  top: isDropup ? undefined : actionMenuAnchor.bottom + 4,
                  bottom: isDropup ? (typeof window !== "undefined" ? window.innerHeight - actionMenuAnchor.top + 4 : 200) : undefined,
                  right: typeof window !== "undefined" ? Math.max(16, window.innerWidth - actionMenuAnchor.right) : 16
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setViewOrder(targetOrder);
                      setActiveActionMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Eye className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{tt("view_details", "View Details")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      loadEditOrder(targetOrder);
                      setActiveActionMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5 text-blue-600" />
                    <span>{tt("edit_resume_step", "Edit / Resume Wizard")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintOrder(targetOrder);
                      setActiveActionMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Printer className="h-3.5 w-3.5 text-amber-600" />
                    <span>{tt("print", "Print Voucher")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimelineOrder({ id: targetOrder.id, orderNo: targetOrder.order_no || `CL-${targetOrder.id.slice(0, 6)}` });
                      setTimelineModalOpen(true);
                      setActiveActionMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Activity className="h-3.5 w-3.5 text-blue-600" />
                    <span>{tt("view_activity_timeline", "Activity Timeline & Audit")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReturnOrderInfo({
                        id: targetOrder.id,
                        orderNo: targetOrder.order_no || `CL-${targetOrder.id.slice(0, 6)}`,
                        stage: targetOrder.current_stage === "goods_entry_required" ? "1C" : "1B"
                      });
                      setReturnModalOpen(true);
                      setActiveActionMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    <span>{tt("return_for_correction_btn", "Return for Correction")}</span>
                  </button>
                </div>

                {(targetOrder.status === "booking_confirmed" || targetOrder.status === "pending_approval") ? (
                  <div className="py-1">
                    {targetOrder.status === "booking_confirmed" ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleOrderApprovalAction(targetOrder.id, "submit");
                          setActiveActionMenuId(null);
                        }}
                        disabled={approvalActionOrderId === targetOrder.id}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                        <span>{tt("submit_for_approval", "Submit for Approval")}</span>
                      </button>
                    ) : null}
                    {targetOrder.status === "pending_approval" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            void handleOrderApprovalAction(targetOrder.id, "approve");
                            setActiveActionMenuId(null);
                          }}
                          disabled={approvalActionOrderId === targetOrder.id}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{tt("approve_order", "Approve Order")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleOrderApprovalAction(targetOrder.id, "reject");
                            setActiveActionMenuId(null);
                          }}
                          disabled={approvalActionOrderId === targetOrder.id}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <X className="h-3.5 w-3.5 text-rose-600" />
                          <span>{tt("reject_order", "Reject Order")}</span>
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteOrder(targetOrder.id);
                      setActiveActionMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{tt("delete_order", "Delete Order")}</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 4 Canonical Order Serials Modal requested by User */}
          {selectedOrderForSerials ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/60 dark:border-blue-900 dark:text-blue-400">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        {tt("canonical_serials_modal_title", "4 Canonical Order Reference Numbers")}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tt("canonical_serials_modal_desc", "Multi-tier organizational identifiers & ledger links for this order")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForSerials(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {(() => {
                  const order = selectedOrderForSerials;
                  const serials = getCanonicalOrderSerials(
                    order,
                    order.country_name || countries.find((c) => c.id === order.country_id)?.name,
                    order.branch_name || cityBranches.find((b) => b.id === order.city_branch_id)?.name
                  );
                  const linkedCust = customers.find((c) => c.id === order.customer_id || c.name === order.customer_name);
                  const linkedAcc = accounts.find((a) =>
                    a.id === order.account_id ||
                    (linkedCust && (a.id === (linkedCust as any).account_id || a.id === (linkedCust as any).accountId))
                  );

                  const handleCopy = (text: string, key: string) => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(text);
                      setCopiedSerialKey(key);
                      setTimeout(() => setCopiedSerialKey(null), 2000);
                    }
                  };

                  const serialCards = [
                    {
                      key: "super_admin",
                      title: tt("serial_super_admin_title", "1. Super Admin Order Serial"),
                      subtitle: tt("serial_super_admin_sub", "Global Multi-Branch Unique Identifier"),
                      val: serials.superAdminSerial,
                      badge: "Global Enterprise",
                      badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300",
                      icon: ShieldCheck
                    },
                    {
                      key: "country_admin",
                      title: tt("serial_country_admin_title", "2. Country Admin Order Serial"),
                      subtitle: tt("serial_country_admin_sub", "Country Operations Ref (AE / PK / AF / etc.)"),
                      val: serials.countrySerial,
                      badge: "Country HQ",
                      badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300",
                      icon: Globe2
                    },
                    {
                      key: "branch_admin",
                      title: tt("serial_branch_admin_title", "3. Branch Admin Order Serial"),
                      subtitle: tt("serial_branch_admin_sub", "City Branch Operational Serial (DXB / KHI / etc.)"),
                      val: serials.branchSerial,
                      badge: "City Branch",
                      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300",
                      icon: Building2
                    },
                    {
                      key: "entry_serial",
                      title: tt("serial_entry_title", "4. System Entry / Voucher Number"),
                      subtitle: tt("serial_entry_sub", "Primary Registry Key & Workflow Ref"),
                      val: serials.entrySerial,
                      badge: "System Entry",
                      badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
                      icon: Hash
                    }
                  ];

                  return (
                    <div className="space-y-4 pt-3.5">
                      {/* The 4 Serials List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {serialCards.map((sc) => {
                          const Icon = sc.icon;
                          const isCopied = copiedSerialKey === sc.key;
                          return (
                            <div
                              key={sc.key}
                              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-col justify-between space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                  <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                  <span>{sc.title}</span>
                                </div>
                                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${sc.badgeClass}`}>
                                  {sc.badge}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                                <span className="truncate">{sc.val}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(sc.val, sc.key)}
                                  className="shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition"
                                  title={tt("copy_to_clipboard", "Copy to clipboard")}
                                >
                                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              </div>

                              <p className="text-[10px] text-slate-400 truncate">{sc.subtitle}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Quick Order & Customer Summary Box */}
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2">
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          {tt("order_quick_details", "Customer & Order Summary")}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">{tt("label_customer", "Customer")}</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate block">
                              {order.customer_name || linkedCust?.name || "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">{tt("label_account", "Linked Account")}</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                              {linkedAcc ? `#${linkedAcc.account_number || (linkedAcc as any).code} - ${linkedAcc.name}` : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">{tt("label_stage", "Current Stage")}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                              {order.current_stage || order.status || "Pending"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">{tt("label_weight", "Cargo & Weight")}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                              {order.goods_name || "Goods"} • {order.goods_gross_weight ? `${order.goods_gross_weight} kg` : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">{tt("label_corridor", "Route / Corridor")}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                              {order.loading_country_name || "Origin"} &rarr; {order.receiving_country_name || "Destination"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">{tt("label_created_at", "Booking Date")}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Modal Actions */}
                      <div className="flex items-center justify-between pt-2">
                        <a
                          href={`/dashboard/clearing-agent/customer-order/${order.id}/workflow`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs"
                        >
                          <span>{tt("open_order_workflow", "Open Order Workflow & Pipeline")}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={() => setSelectedOrderForSerials(null)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {tt("close", "Close")}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: 4-STEP WIZARD VIEW (NEW / EDIT ORDER & LIVE CUSTOMER REPORT)      */
        /* ========================================================================= */
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Unified Compact Top Header & Stepper Bar — Local Purchase Aesthetic */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              {/* Left: Back + Breadcrumbs + Title */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setActiveActionMenuId(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>{tt("back", "Back")}</span>
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setActiveActionMenuId(null);
                      }}
                      className="hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {tt("breadcrumb_dashboard", "Dashboard")}
                    </button>
                    <span>&gt;</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setActiveActionMenuId(null);
                      }}
                      className="hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {tt("breadcrumb_orders", "Customer Order")}
                    </button>
                    <span>&gt;</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold truncate">
                      {editingOrderId ? tt("edit_customer_order", "Edit Customer Order") : tt("new_customer_order", "New Customer Order")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white truncate">
                      {editingOrderId ? `${tt("edit_order_heading", "Edit Customer Order")} • ${formData.order_no || formData.customer_name}` : tt("new_order_heading", "New Customer Order")}
                    </h1>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shrink-0">
                      ORDER VOUCHER
                    </span>
                  </div>
                </div>
              </div>

              {/* Center: Compact Stepper Pills (1, 2, 3, 4) "chota chota" */}
              <div className="flex items-center justify-center gap-1 overflow-x-auto py-1 px-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
                {stepsList.map((st, idx) => {
                  const isActive = currentStep === st.num;
                  const isPast = currentStep > st.num;
                  return (
                    <div key={st.num} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(st.num as any);
                          if (st.num === 1) setStep1SubStep("1A");
                          else if (st.num === 2) setStep1SubStep("1B");
                          else if (st.num === 3) setStep1SubStep("1C");
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-xs"
                            : isPast
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                        title={st.desc}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${
                            isActive
                              ? "bg-white text-blue-600"
                              : isPast
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isPast ? "✓" : st.num}
                        </span>
                        <span className="whitespace-nowrap">{st.shortTitle || st.title}</span>
                      </button>
                      {idx < stepsList.length - 1 ? (
                        <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Right: Actions, Save Draft, + New Order */}
              <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
                {/* More Actions Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMoreActionsOpen(!isMoreActionsOpen);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
                  >
                    <span>{tt("more_actions", "More Actions")}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {isMoreActionsOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-xs font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreActionsOpen(false);
                          resetForm();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>{tt("reset_form", "Reset Form")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreActionsOpen(false);
                          setIsFormOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>{tt("close_form", "Close Form")}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* View Customer Bill */}
                {(editingOrderId || (formData as any).id) ? (
                  <Link
                    href={`/dashboard/clearing-agent/customer-bill?orderId=${editingOrderId || (formData as any).id || ""}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition shadow-2xs"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>{t(lang, "cbill.view_customer_bill", "View Bill")}</span>
                  </Link>
                ) : null}

                {/* Save Draft */}
                <button
                  type="button"
                  onClick={() => void handleSaveProgress(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 transition shadow-2xs"
                >
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{t(lang, "comv.save_draft", "Save Draft")}</span>
                </button>

                {/* + New Order */}
                <button
                  type="button"
                  onClick={handleStartNewOrder}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs shadow-blue-600/25 transition hover:bg-blue-700 active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{tt("new", "New Order")}</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setActiveActionMenuId(null);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-600 shadow-2xs hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 transition"
                  title={tt("close", "Close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area: If Step 4, render full-width A4 Review & Confirm Sheet; Else 2-Column Grid */}
          {currentStep === 4 ? (
            <div dir={isRtl ? "rtl" : "ltr"} className="w-full">
              <Step4ReviewConfirm
                lang={lang}
                tt={tt}
                formData={formData}
                partySelections={partySelections}
                selectedCustomerInfo={selectedCustomerInfo}
                selectedAccountInfo={selectedAccountInfo}
                clearingAgents={clearingAgents}
                shippingLines={shippingLines}
                userContext={userContext}
                onBack={() => {
                  setCurrentStep(3);
                  setStep1SubStep("1C");
                }}
                onGoToSubStep={(sub) => {
                  setStep1SubStep(sub);
                  if (sub === "1A") setCurrentStep(1);
                  else if (sub === "1B") setCurrentStep(2);
                  else if (sub === "1C") setCurrentStep(3);
                }}
                onSaveDraft={() => void handleSaveProgress(false)}
                onConfirmSave={() => void handleSaveProgress(true)}
                saving={saving}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,0.64fr)_minmax(0,1.36fr)] xl:items-start 2xl:grid-cols-[minmax(360px,0.6fr)_minmax(0,1.4fr)]" dir="ltr">
              {/* LEFT COLUMN: The Form Cards */}
              <div dir={isRtl ? "rtl" : "ltr"} className="space-y-3">
                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  {(currentStep === 1 || currentStep === 2 || currentStep === 3) && (
                    <Step1BookingCustomer
                      lang={lang}
                      tt={tt}
                      userContext={userContext}
                      formData={formData}
                      setFormData={setFormData}
                      step1SubStep={step1SubStep}
                      setStep1SubStep={setStep1SubStep}
                      accounts={accounts}
                      customers={customers}
                      customerOptions={customerOptions}
                      countries={countries}
                      ports={ports}
                      loadingCities={loadingCities}
                      receivingCities={receivingCities}
                      partySelections={partySelections}
                      companies={companies}
                      companyOptions={companyOptions}
                      orders={orders}
                      loading={loading}
                      handlePartyChange={handlePartyChange}
                      handleLoadingCountryChange={handleLoadingCountryChange}
                      handleReceivingCountryChange={handleReceivingCountryChange}
                      handleLoadingPortChange={handleLoadingPortChange}
                      handleDestinationPortChange={handleDestinationPortChange}
                      trucksList={trucksList}
                      warehousesList={warehousesList}
                      goodsMasterList={goodsMasterList}
                      assignableUsers={assignableUsers}
                      onSelectSubStep={(sub) => {
                        setStep1SubStep(sub);
                        if (sub === "1A") setCurrentStep(1);
                        else if (sub === "1B") setCurrentStep(2);
                        else if (sub === "1C") setCurrentStep(3);
                      }}
                      onAdvanceToStep2={() => {
                        setStep1SubStep("1B");
                        setCurrentStep(2);
                      }}
                      onAdvanceToStep3={() => {
                        setStep1SubStep("1C");
                        setCurrentStep(3);
                      }}
                      onConfirmSave={() => void handleSaveProgress(true)}
                      onSaveDraft={() => void handleSaveProgress(false)}
                      onAssignStage1A={handleAssignStage1A}
                      onConfirmTruckContinueMyself={handleConfirmTruckContinueMyself}
                      onConfirmTruckAssignGoods={handleConfirmTruckAssignGoods}
                      onReturnForCorrection={handleTriggerReturnModal}
                      onCompleteGoodsEntry={handleCompleteGoodsEntry}
                      activeOrder={editingOrderId ? orders.find((o) => o.id === editingOrderId) || null : null}
                      draftGoodsItem={draftGoodsItem}
                      setDraftGoodsItem={setDraftGoodsItem}
                      editingGoodsIdx={editingGoodsIdx}
                      setEditingGoodsIdx={setEditingGoodsIdx}
                      saving={saving}
                    />
                  )}

                {/* Stepper Navigation / Back to Registry */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs transition"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{tt("back_to_registry", "Back to Orders Registry")}</span>
                  </button>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Order ID: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{formData.order_no || "Draft"}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: The Live Customer Order Report Panel (Enlarged 7-cols) */}
            <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 xl:sticky xl:top-3 h-fit max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl bg-slate-50/70 p-2 pr-1 dark:bg-slate-950/30">
              {/* Live Report Card Container */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                {/* Header with Title and Live Badge */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-gradient-to-r from-blue-50/80 to-white p-3 dark:border-slate-800 dark:from-slate-800/80 dark:to-slate-900">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
                      <Route className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white">
                        {tt("live_report", "Live Customer Order Report")}
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        {tt("live_report_desc", "Real-time summary of your customer order details, movements and related information.")}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {tt("live", "Live")}
                  </span>
                </div>
                {/* 3 Unified Summary Reports: 1. Order Bill & Serials, 2. Customer Address, 3. Ship Types Report */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                  {/* REPORT 1: ORDER BILL & SYSTEM SERIALS */}
                  <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <Receipt className="h-3 w-3" />
                          </span>
                          <span>{tt("order_bill_serials_report", "ORDER BILL & SERIALS")}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {tt("live", "Live")}
                        </span>
                      </div>

                      {/* Prominent Bill Number / Global Serial */}
                      <div className="leading-relaxed space-y-0.5 pt-1">
                        <p className="font-mono font-black text-slate-900 dark:text-white text-base tracking-tight truncate">
                          {formData.global_serial || formData.order_no || "CL-ORD-PENDING"}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {tt("bill_no_global_serial", "Bill No / Order Reference")}
                        </p>
                      </div>

                      {/* Clean Serials List (No Nested Packets) */}
                      <div className="pt-2 space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("entry_serial", "Entry Serial:")}</span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formData.entry_serial || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("branch_serial", "Branch Serial:")}</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formData.branch_serial || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("country_serial", "Country Serial:")}</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formData.country_serial || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("super_admin_serial", "Super Admin Serial:")}</span>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-300">{formData.super_admin_serial || formData.global_serial || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Date & Time Footer */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>{formData.order_date || "—"}</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formData.order_time || "—"}
                      </span>
                    </div>
                  </div>

                  {/* REPORT 2: CUSTOMER ADDRESS REPORT */}
                  <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <User className="h-3 w-3" />
                          </span>
                          <span>{tt("customer_address", "CUSTOMER ADDRESS")}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStep1SubStep("1A");
                            setCurrentStep(1);
                          }}
                          className="text-slate-400 hover:text-blue-600 transition p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={tt("edit_customer_address", "Edit Customer Address")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {selectedCustomerInfo || formData.customer_name || formData.customer_id ? (
                        <div className="leading-relaxed space-y-1 pt-1">
                          <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                            {selectedCustomerInfo?.customer_name || formData.customer_name || selectedCustomerInfo?.contact_person}
                          </p>
                          {selectedCustomerInfo?.company_name && (
                            <p className="font-medium text-slate-600 dark:text-slate-300 text-[11.5px] truncate">
                              {selectedCustomerInfo.company_name}
                            </p>
                          )}
                          {selectedCustomerInfo?.address ? (
                            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-snug line-clamp-2">
                              {selectedCustomerInfo.address}
                            </p>
                          ) : null}
                          {[selectedCustomerInfo?.city_name, selectedCustomerInfo?.country_name].filter(Boolean).length > 0 && (
                            <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                              {[selectedCustomerInfo?.city_name, selectedCustomerInfo?.country_name].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 dark:text-slate-500 italic text-[11.5px]">
                          {tt("no_customer_selected_desc", "Select a customer to view complete address and contact details")}
                        </div>
                      )}
                    </div>

                    {/* Customer Contact Footer */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">{tt("phone_label", "Phone:")}</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{selectedCustomerInfo?.mobile || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">{tt("whatsapp_label", "WhatsApp:")}</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{selectedCustomerInfo?.whatsapp || "—"}</span>
                      </div>
                      {(selectedCustomerInfo?.person_code || selectedAccountInfo?.code) && (
                        <div className="flex items-center justify-between pt-0.5 text-[10.5px]">
                          <span className="text-slate-400">{tt("code_label", "Code:")}</span>
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                            {selectedCustomerInfo?.person_code || selectedAccountInfo?.code}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* REPORT 3: SHIP TYPES REPORT */}
                  <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                            <Ship className="h-3 w-3" />
                          </span>
                          <span>{tt("ship_types_report", "SHIP TYPES REPORT")}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStep1SubStep("1A");
                            setCurrentStep(1);
                          }}
                          className="text-slate-400 hover:text-sky-600 transition p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={tt("edit_shipping_types", "Edit Shipping Types")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Main Transport Mode Header */}
                      <div className="leading-relaxed space-y-0.5 pt-1">
                        <p className="font-bold text-slate-900 dark:text-white text-base capitalize truncate flex items-center gap-2">
                          <span>{formData.transport_mode?.replace("by_", "By ") || "By Sea"}</span>
                          <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/70 dark:border-sky-800">
                            {formData.transport_mode?.includes("air")
                              ? "Air Cargo"
                              : formData.transport_mode?.includes("road")
                              ? "Land / Trucking"
                              : "Ocean Vessel"}
                          </span>
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {tt("transport_mode_label", "Transport Mode")}
                        </p>
                      </div>

                      {/* Clean Message Lines (No Nested Packets) */}
                      <div className="pt-2 space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("movement_type_label", "Movement Type:")}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                            {formData.movement_type || "Import"}
                            <span className="ml-1 text-[10px] font-normal text-slate-500">
                              ({formData.movement_type === "export"
                                ? "Local → Foreign"
                                : formData.movement_type === "transit"
                                ? "Cross-Border"
                                : "Foreign → Local"})
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <Route className="h-3 w-3 text-slate-400" />
                            <span>{tt("route_via_colon", "Route Via:")}</span>
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={formData.route_name || "Direct Customs Corridor"}>
                            {formData.route_name || tt("direct_customs_corridor", "Direct Customs Corridor")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("clearance_office_label", "Clearance Office:")}</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400 truncate max-w-[170px]">
                            {formData.customs_clearance_office || "Customs Corridor"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Shipment & Freight Footer */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>{tt("shipment_type_label", "Shipment:")} <strong className="text-slate-800 dark:text-slate-200 font-semibold">{formData.shipment_type || "FCL"}</strong></span>
                      <span className="text-slate-400 font-medium">{tt("bill_terms", "Commercial Freight")}</span>
                    </div>
                  </div>
                </div>

                {/* REMARKS CARD (Directly below the 3 top reports) */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 font-bold uppercase text-[10.5px] tracking-wider">
                      {tt("remarks", "REMARKS")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 leading-relaxed">
                    {formData.remarks ? (
                      formData.remarks
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic text-[11.5px]">
                        {tt("no_remarks_recorded", "No remarks recorded.")}
                      </span>
                    )}
                  </p>
                </div>

                {/* 1. Unified Movement & Dynamic Route Journey Specification Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white font-black text-sm shadow-md shadow-sky-600/20">
                        <Route className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {tt("movement_route_journey", "Movement & Route Journey")}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            formData.movement_type === "import"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                              : formData.movement_type === "export"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                          }`}>
                            {formData.movement_type || "Import"}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 uppercase">
                            {formData.transport_mode?.replace("by_", "By ") || "By Road"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-1">
                          <span className="text-slate-500 font-medium">{tt("route_via_colon", "Route Via:")}</span>
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800">
                            <Route className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            {formData.route_name || tt("direct_customs_corridor", "Direct Customs Corridor")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setStep1SubStep("1A");
                        setCurrentStep(1);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300 transition shadow-2xs"
                      title={tt("transfer_step1a_route", "Transfer to Step 1A / Movement & Route Entry")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>{tt("transfer_route_1a", "Transfer to Route (1A)")}</span>
                    </button>
                  </div>

                  {/* Visual Route Journey Message Box (As requested: ek message ki tarah dikhana chahiye) */}
                  {(() => {
                    const liveRouteStops = parseRouteStops(formData.route_name);
                    if (liveRouteStops.length === 0) return null;
                    return (
                      <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/70 via-sky-50/50 to-blue-50/60 p-3 dark:border-emerald-900/60 dark:from-emerald-950/30 dark:via-slate-900/50 dark:to-blue-950/30 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                            <Route className="h-4 w-4 text-emerald-600" />
                            <span>{tt("route_pathway_title", "Transit Route Pathway (ملک بہ ملک راستہ)")}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {liveRouteStops.length > 1 ? `${liveRouteStops.length} Stages Route` : "Single Corridor"}
                          </span>
                        </div>

                        {/* Visual Flow Chain (Pills with arrows) */}
                        <div className="flex flex-wrap items-center gap-1.5 py-1">
                          {liveRouteStops.map((stop, idx) => (
                            <Fragment key={idx}>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200/90 dark:border-emerald-800/80 shadow-2xs text-xs font-bold text-slate-800 dark:text-slate-100">
                                <span className="text-sm">{getRouteCountryFlag(stop)}</span>
                                <span>{stop}</span>
                                <span className="text-[9px] px-1 py-0.2 rounded font-black uppercase text-slate-400 bg-slate-100 dark:bg-slate-700">
                                  {idx === 0 ? "Origin" : idx === liveRouteStops.length - 1 ? "Dest" : `Via ${idx}`}
                                </span>
                              </div>
                              {idx < liveRouteStops.length - 1 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm px-0.5">➔</span>
                              ) : null}
                            </Fragment>
                          ))}
                        </div>

                        {/* Narrative Route Message Line */}
                        {liveRouteStops.length > 1 && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-emerald-200/50 dark:border-slate-800 flex items-center gap-1.5">
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{tt("journey_summary", "Journey:")}</span>
                            <span>
                              From <strong>{liveRouteStops[0]}</strong> transiting through{" "}
                              <strong>{liveRouteStops.slice(1, -1).join(", ")}</strong> to final destination{" "}
                              <strong>{liveRouteStops[liveRouteStops.length - 1]}</strong>.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 3-Stage Chronological Journey in Clean Message Layout (No Nested Packets) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
                    {/* Stage 1: Origin & Loading */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                            <MapPin className="h-3 w-3" />
                          </span>
                          <span>{tt("option1_origin_loading", "1. ORIGIN & LOADING")}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
                          {formData.loading_country_name ? tt("specified", "Specified") : tt("pending", "Pending")}
                        </span>
                      </div>

                      {/* Prominent Origin Country */}
                      <div className="leading-relaxed space-y-0.5 pt-0.5">
                        <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight truncate">
                          {formData.loading_country_name || tt("country_pending", "Country Pending")}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {tt("origin_country_region", "Origin Country & Port of Loading")}
                        </p>
                      </div>

                      {/* Clean Details List */}
                      <div className="pt-1.5 space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("port_label", "Port / Exit:")}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {formData.loading_port_name || formData.origin_airport_name || formData.exit_border_port_name || tt("origin_port_border_fallback", "Origin Port / Border")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("facility_colon", "Facility:")}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {formData.loading_source_name || tt("origin_facility_fallback", "Origin Facility")}
                          </span>
                        </div>
                      </div>

                      {/* Planned Pickup Date Footer */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="text-slate-500 font-medium">{tt("planned_pickup_badge", "Planned Pickup:")}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formData.planned_pickup_date || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Stage 2: Customs & Border Transit */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            <Anchor className="h-3 w-3" />
                          </span>
                          <span>{tt("option2_border_customs", "2. BORDER & CUSTOMS")}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                          {tt("in_transit", "In-Transit")}
                        </span>
                      </div>

                      {/* Prominent Checkpoint */}
                      <div className="leading-relaxed space-y-0.5 pt-0.5">
                        <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight truncate">
                          {formData.entry_border_port_name || formData.exit_border_port_name || tt("border_checkpoint_fallback", "Border Checkpoint")}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {tt("customs_transit_point", "Customs Clearance & Corridor")}
                        </p>
                      </div>

                      {/* Clean Details List */}
                      <div className="pt-1.5 space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("clearance_colon", "Clearance:")}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {formData.customs_clearance_office || tt("in_transit_customs_fallback", "In-Transit Customs")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <Route className="h-3 w-3 text-slate-400" />
                            <span>{tt("route_via_colon", "Route Via:")}</span>
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={formData.route_name || "Direct Customs Corridor"}>
                            {formData.route_name || tt("bonded_highway_fallback", "Bonded Highway")}
                          </span>
                        </div>
                      </div>

                      {/* Planned Dispatch Date Footer */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="text-slate-500 font-medium">{tt("planned_dispatch_badge", "Planned Dispatch:")}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formData.planned_dispatch_date || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Stage 3: Destination & Receiving */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <Globe2 className="h-3 w-3" />
                          </span>
                          <span>{tt("option3_final_destination", "3. FINAL DESTINATION")}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                          {tt("destination", "Destination")}
                        </span>
                      </div>

                      {/* Prominent Target Country */}
                      <div className="leading-relaxed space-y-0.5 pt-0.5">
                        <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight truncate">
                          {formData.receiving_country_name || tt("target_country_fallback", "Target Country")}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {tt("destination_delivery_point", "Receiving Port / Destination City")}
                        </p>
                      </div>

                      {/* Clean Details List */}
                      <div className="pt-1.5 space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("dest_label", "Port/City:")}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {formData.destination_port_name || formData.destination_city || tt("destination_port_city_fallback", "Destination Port / City")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("delivery_colon", "Delivery:")}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {formData.final_delivery_location || tt("target_warehouse_fallback", "Target Warehouse")}
                          </span>
                        </div>
                      </div>

                      {/* Planned Arrival Date Footer */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="text-slate-500 font-medium">{tt("planned_arrival_badge", "Planned Arrival:")}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formData.planned_arrival_date || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Vehicle & Fleet Report Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-sm shadow-md shadow-indigo-600/20">
                        <Truck className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                            {tt("vehicle_fleet_report", "VEHICLE & FLEET REPORT")}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                            {formData.truck_assignment_mode === "permanent"
                              ? tt("permanent_fleet_value", "Permanent Fleet")
                              : formData.truck_assignment_mode === "later"
                              ? tt("assign_later_value", "Assign Later")
                              : tt("hired_truck_value", "Hired Truck")}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            formData.truck_number
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                          }`}>
                            {formData.truck_assignment_mode === "later"
                              ? tt("pending_later", "Pending (Later)")
                              : formData.truck_number
                              ? tt("assigned_status", "Assigned")
                              : tt("pending_allocation", "Pending Allocation")}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 mt-0.5">
                          {tt("truck_driver_desc", "Fleet Details, Driver Credentials & Dispatch Timing")}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setStep1SubStep("1B");
                        setCurrentStep(2);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 transition shadow-2xs"
                      title={tt("transfer_step1b_truck", "Transfer to Step 1B / Truck & Driver Entry")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>{tt("transfer_truck_1b", "Transfer to Truck (1B)")}</span>
                    </button>
                  </div>

                  {/* Clean 2-Column Message Layout (No Nested Packets) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                    {/* Vehicle Specifications */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            <Truck className="h-3 w-3" />
                          </span>
                          <span>{tt("vehicle_specifications", "VEHICLE SPECIFICATIONS")}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 capitalize">
                          {formData.truck_registration_type || tt("registered_status", "Registered")}
                        </span>
                      </div>

                      {/* Prominent Vehicle Number */}
                      <div className="leading-relaxed space-y-0.5 pt-0.5">
                        <p className="font-mono font-black text-slate-900 dark:text-white text-base tracking-tight truncate">
                          {formData.truck_assignment_mode === "later"
                            ? tt("to_be_assigned_later", "To Be Assigned Later")
                            : (formData.truck_number || <span className="text-slate-400 italic font-normal text-xs">{tt("no_truck_allocated", "No Truck Allocated")}</span>)}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {tt("allocated_vehicle_plate", "Allocated Vehicle Plate & Transporter")}
                        </p>
                      </div>

                      {/* Clean Details List */}
                      <div className="pt-1.5 space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("transporter_label", "Transporter:")}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                            {formData.truck_transport_company || formData.truck_owner_name || tt("internal_fleet", "Internal Fleet")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("fleet_mode_label", "Fleet Mode:")}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                            {formData.truck_assignment_mode === "permanent"
                              ? tt("permanent_fleet_value", "Permanent Fleet")
                              : formData.truck_assignment_mode === "later"
                              ? tt("assign_later_value", "Assign Later")
                              : tt("hired_truck_value", "Hired Truck")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Driver Credentials & Dispatch */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <Users className="h-3 w-3" />
                          </span>
                          <span>{tt("driver_credentials_dispatch", "DRIVER CREDENTIALS & DISPATCH")}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                          {formData.truck_driver_name ? tt("assigned_status", "Assigned") : tt("pending_assignment", "Pending")}
                        </span>
                      </div>

                      {/* Prominent Driver Name */}
                      <div className="leading-relaxed space-y-0.5 pt-0.5">
                        <p className="font-bold text-slate-900 dark:text-white text-base tracking-tight truncate">
                          {formData.truck_assignment_mode === "later"
                            ? <span className="text-slate-400 italic font-normal text-xs">{tt("to_be_assigned_later", "To Be Assigned Later")}</span>
                            : (formData.truck_driver_name || <span className="text-slate-400 italic font-normal text-xs">{tt("no_driver_assigned", "No Driver Assigned")}</span>)}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {tt("driver_contact_timing", "Driver Mobile Contact & Dispatch Record")}
                        </p>
                      </div>

                      {/* Clean Details List */}
                      <div className="pt-1.5 space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("mobile_label", "Driver Mobile:")}</span>
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {formData.truck_driver_mobile || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{tt("actual_dispatch_label", "Actual Dispatch:")}</span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {formData.actual_dispatch_date || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Goods & Cargo Manifest Breakdown Table Message Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-sm shadow-md shadow-emerald-600/20">
                        <Boxes className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {tt("goods_cargo_manifest_breakdown", "Goods & Cargo Manifest Breakdown")}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            {(formData.goods_items?.length || 1)} Item{(formData.goods_items?.length || 1) > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{tt("goods_manifest_desc", "Multi-item manifest specifications, warehouse source & gross weights")}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setStep1SubStep("1C");
                        setCurrentStep(3);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 transition shadow-2xs"
                      title={tt("transfer_step1c_goods", "Transfer to Step 1C / Goods & Warehouse Entry")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Transfer to Goods (1C)</span>
                    </button>
                  </div>

                  {/* Manifest Table & Totals */}
                  {(() => {
                    const totalItems = (formData.goods_items || []).length;
                    const totalPackages = (formData.goods_items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
                    const totalKg = (formData.goods_items || []).reduce((acc, it) => acc + (Number(it.totalKg) || 0), 0);
                    const totalMt = (totalKg / 1000).toFixed(3);

                    return (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-750 dark:bg-slate-850">
                          <table className="w-full text-left text-xs border-collapse">
                      <thead className="border-b border-slate-200 bg-slate-50/90 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-750 dark:bg-slate-800 text-[9.5px]">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">{tt("goods_item", "Goods Item")}</th>
                          <th className="py-2.5 px-3">{tt("chs_code", "CHS Code")}</th>
                          <th className="py-2.5 px-3">{tt("unit", "Unit")}</th>
                          <th className="py-2.5 px-3 text-right">{tt("quantity", "Quantity")}</th>
                          <th className="py-2.5 px-3 text-right">{tt("kg_per_unit", "KG/Unit")}</th>
                          <th className="py-2.5 px-3 text-right">{tt("total_kg", "Total KG")}</th>
                          <th className="py-2.5 px-3 text-right">{tt("total_mt", "Total MT")}</th>
                          <th className="py-2.5 px-3">{tt("warehouse_source", "Warehouse Source")}</th>
                          <th className="py-2.5 px-3 text-center">{tt("quality_photo", "Quality Photo")}</th>
                          <th className="py-2.5 px-3 text-center">{tt("actions", "Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-750 text-[11px]">
                        {(formData.goods_items || []).map((it, idx) => {
                          const q = parseFloat(String(it.quantity || 0)) || 0;
                          const kg = parseFloat(String(it.totalKg || 0)) || 0;
                          const kgPer = parseFloat(String(it.kgPerQty || 0)) || (q > 0 ? kg / q : 0);
                          const mt = kg > 0 ? (kg / 1000).toFixed(3) : "0.000";

                          return (
                            <tr key={it.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                                <div>{it.goodsName || it.goods_name || tt("general_cargo_fallback", "General Cargo")}</div>
                                {it.goodsVariationLabel ? (
                                  <div className="text-[9.5px] text-slate-400 font-normal">{it.goodsVariationLabel}</div>
                                ) : null}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                                {it.goodsChsCode || "—"}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                                {it.unit || "Bags"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                                {q.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                {kgPer.toFixed(1)} kg
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400">
                                {kg.toLocaleString()} kg
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {mt} MT
                              </td>
                              <td className="py-2.5 px-3">
                                {it.warehouseType === "company" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                                    🏢 {tt("warehouse_badge_own", "Own:")} {it.warehouseName || tt("warehouse_badge_company_fallback", "Company")}
                                  </span>
                                ) : it.warehouseType === "customer" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                                    👤 {tt("warehouse_badge_customer", "Customer:")} {it.warehouseName || tt("warehouse_badge_client_yard", "Client Yard")}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                                    📍 {tt("warehouse_badge_other", "Other:")} {it.warehouseName || formData.loading_source_name || tt("warehouse_badge_warehouse_fallback", "Warehouse")}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {it.photoUrl ? (
                                  <div className="inline-flex items-center justify-center gap-1">
                                    <img
                                      src={it.photoUrl}
                                      alt={tt("inspection", "Inspection")}
                                      className="h-6 w-6 rounded object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                                    />
                                    <a
                                      href={it.photoUrl}
                                      download={it.photoName || `inspection-${idx + 1}.jpg`}
                                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition"
                                      title={tt("download_quality_photo", "Download quality photo")}
                                    >
                                      <Download className="h-3 w-3" />
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="inline-flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditGoodsRow(idx)}
                                    className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                    title={tt("edit_item", "Edit Item in Step 1C")}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData((current) => {
                                        const filtered = (current.goods_items || []).filter((_, i) => i !== idx);
                                        const items = filtered.length > 0 ? filtered : [defaultGoodsItem()];
                                        const first = items[0];
                                        const totalQty = items.reduce((sum, g) => sum + (Number(g.quantity) || 0), 0);
                                        const totalKg = items.reduce((sum, g) => sum + (Number(g.totalKg) || 0), 0);
                                        return {
                                          ...current,
                                          goods_items: items,
                                          goods_id: first?.goodsId || "",
                                          goods_name: items.map((g) => g.goodsName).filter(Boolean).join(", "),
                                          goods_unit: first?.unit || "Bags",
                                          goods_quantity: String(totalQty),
                                          goods_gross_weight: String(totalKg),
                                          goods_net_weight: String(totalKg)
                                        };
                                      });
                                    }}
                                    className="p-1 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    title={tt("remove_item", "Remove Item")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50/80 font-bold text-slate-700 dark:border-slate-750 dark:bg-slate-800/60 text-[11px]">
                        <tr>
                          <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider text-[10px] text-slate-500 font-bold">
                            {tt("total_summary_colon", "Total Summary:")}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {totalPackages.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3"></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            {totalKg.toLocaleString()} kg
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700 dark:text-purple-400">
                            {totalMt} MT
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Grand Manifest Totals Message Card (Corner Message Layout) */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 pt-2">
                    {/* Left: Summary Note */}
                    <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                        <span>{tt("verified_manifest_summary", "Verified Cargo Manifest Summary")}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-sm">
                        {tt("manifest_calc_note", "Cargo weights and packaging units are automatically calculated across all manifest line items.")}
                      </p>
                    </div>

                    {/* Right Corner: Message Card (No Packets) */}
                    <div className="w-full sm:w-80 rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-850/80 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-750">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {tt("manifest_totals_summary", "MANIFEST TOTALS SUMMARY")}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                          {totalItems} {tt("goods_item", "Items")}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {/* 1. Total Entries / Items */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 font-mono text-[11px]">1.</span>
                            <span className="font-medium">{tt("total_entries_label", "Total Entries / Items:")}</span>
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono">
                            {totalItems}
                          </span>
                        </div>

                        {/* 2. Total Packaging */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 font-mono text-[11px]">2.</span>
                            <span className="font-medium">{tt("total_packaging_label", "Total Packaging / Units:")}</span>
                          </span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                            {totalPackages.toLocaleString()} {tt("unit", "Units")}
                          </span>
                        </div>

                        {/* 3. Total Gross Wt (KG) */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 font-mono text-[11px]">3.</span>
                            <span className="font-medium">{tt("total_gross_wt_kg_label", "Total Gross Wt (KG):")}</span>
                          </span>
                          <span className="font-bold text-indigo-700 dark:text-indigo-400 font-mono">
                            {totalKg.toLocaleString()} kg
                          </span>
                        </div>

                        {/* 4. Total Gross Wt (MT) */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 dark:border-slate-750">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-bold">
                            <span className="font-bold text-slate-400 font-mono text-[11px]">4.</span>
                            <span>{tt("total_gross_wt_mt_label", "Total Gross Wt (MT):")}</span>
                          </span>
                          <span className="font-black text-purple-700 dark:text-purple-400 font-mono text-sm">
                            {totalMt} MT
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* View Order Modal */}
      {viewOrder ? (
        <SimpleModal
          isOpen={Boolean(viewOrder)}
          onClose={() => setViewOrder(null)}
          title={`${tt("order_details", "Order Details")}: ${viewOrder.order_no || viewOrder.id}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <div><strong>{tt("movement", "Movement")}:</strong> {viewOrder.movement_type}</div>
              <div><strong>{tt("transport", "Transport")}:</strong> {viewOrder.transport_mode}</div>
              <div><strong>{tt("shipment", "Shipment")}:</strong> {viewOrder.shipment_type}</div>
              <div><strong>{tt("loading_source", "Loading Source")}:</strong> {viewOrder.loading_source_name || viewOrder.loading_source || "-"}</div>
              <div><strong>{tt("goods", "Goods")}:</strong> {viewOrder.goods_name || "-"}</div>
              <div><strong>{tt("chs_code", "CHS Code")}:</strong> {viewOrder.goods_chs_code || "-"}</div>
              <div><strong>{tt("route", "Route")}:</strong> {viewOrder.route_name || "-"}</div>
              <div><strong>{tt("loading_date", "Loading Date")}:</strong> {viewOrder.expected_loading_date ? new Date(viewOrder.expected_loading_date).toLocaleDateString() : "-"}</div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider">{tt("linked_parties", "Linked Parties")}</h4>
              <div className="divide-y border rounded-xl overflow-hidden">
                {(viewOrder.party_links ?? []).map((link, idx) => (
                  <div key={idx} className="p-2.5 flex justify-between items-center bg-white dark:bg-slate-900">
                    <div>
                      <span className="font-bold uppercase text-[10px] text-blue-600 mr-2">{link.role_key}:</span>
                      <span className="font-semibold">{link.party_customer_name}</span>
                      {link.party_company_name ? <span className="text-slate-500"> ({link.party_company_name})</span> : null}
                    </div>
                    <div className="text-[11px] text-slate-500">{link.selected_address_text || "-"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  loadEditOrder(viewOrder);
                  setViewOrder(null);
                }}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
              >
                {tt("edit_resume_order", "Edit / Resume Order")}
              </button>
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </div>
  );
}

// Role-based serial visibility (spec point 2): every serial is always stored on the
// row regardless of who is viewing — this only gates what's shown in the UI, mirroring
// the precedent already used on the Roznamcha report view.
function canSeeSerial(tier: "super" | "country" | "branch", ctx: BranchUserContext | null): boolean {
  if (!ctx) return false;
  if (ctx.isSuperAdmin) return true;
  const roles = ctx.roles || [];
  if (tier === "country") return roles.some((r) => ["country_admin", "country_user", "main_branch_admin"].includes(r));
  if (tier === "branch") return roles.some((r) => ["country_admin", "country_user", "main_branch_admin", "city_branch_admin"].includes(r));
  return false;
}

// Mirrors the DB CHECK constraint on clearing_customer_order_legs.status — the
// canonical order a leg progresses through, used to render the Shipment Progress
// timeline on the Live Order Report.
const LEG_STATUS_SEQUENCE = [
  "pending", "pickup_assigned", "loaded", "in_transit", "arrived",
  "customs_pending", "cleared", "handed_over", "completed"
] as const;

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans";
const inputClass = selectClass;
const labelClass = "mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300";

// Shared numbered/icon section heading used across all 4 wizard steps — a single
// visual language for "which part of the form am I in", matching the reference
// ERP screens' numbered-card sections (Customer Info / Shipping Details / etc.).
function SectionHeading({
  num,
  icon: Icon,
  title,
  subtitle
}: {
  num: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 pb-1">
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-[11px] font-black text-white shadow-sm shadow-blue-600/30">
        {num}
      </span>
      <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 sm:inline-flex">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-[13px] font-black leading-tight text-slate-900 dark:text-white">{title}</h3>
        {subtitle ? <p className="text-[10.5px] font-medium leading-tight text-slate-400">{subtitle}</p> : null}
      </div>
    </div>
  );
}

// Consistent card wrapper for a field group within a step — replaces the ad-hoc
// bordered <div>s that were previously repeated with slightly different classes.
function FieldCard({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "white" }) {
  return (
    <div
      className={`rounded-xl border p-3 space-y-2.5 ${
        tone === "white"
          ? "border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
          : "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
      }`}
    >
      {children}
    </div>
  );
}

function Step1BookingCustomer({
  lang,
  tt,
  userContext,
  formData,
  setFormData,
  activeOrder,
  step1SubStep,
  setStep1SubStep,
  onSelectSubStep,
  accounts,
  customers,
  customerOptions,
  countries,
  ports,
  loadingCities,
  receivingCities,
  partySelections,
  companies,
  companyOptions,
  orders,
  loading,
  trucksList,
  warehousesList,
  goodsMasterList,
  assignableUsers,
  handlePartyChange,
  handleLoadingCountryChange,
  handleReceivingCountryChange,
  handleLoadingPortChange,
  handleDestinationPortChange,
  onAdvanceToStep2,
  onAdvanceToStep3,
  onConfirmSave,
  onSaveDraft,
  onAssignStage1A,
  onConfirmTruckContinueMyself,
  onConfirmTruckAssignGoods,
  onReturnForCorrection,
  onCompleteGoodsEntry,
  draftGoodsItem: propsDraftGoodsItem,
  setDraftGoodsItem: propsSetDraftGoodsItem,
  editingGoodsIdx: propsEditingGoodsIdx,
  setEditingGoodsIdx: propsSetEditingGoodsIdx,
  saving
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  tt: (k: string, f: string) => string;
  userContext: { context: BranchUserContext | null; loading: boolean; error: string | null };
  formData: FormDataState;
  setFormData: SetFormData;
  activeOrder?: ClearingCustomerOrderRow | null;
  step1SubStep: "1A" | "1B" | "1C";
  setStep1SubStep: (sub: "1A" | "1B" | "1C") => void;
  onSelectSubStep?: (sub: "1A" | "1B" | "1C") => void;
  accounts: AccountRow[];
  customers: CustomerRow[];
  customerOptions: SearchSelectOption[];
  countries: CountryRow[];
  ports: PortRow[];
  loadingCities: CityRow[];
  receivingCities: CityRow[];
  partySelections: Record<PartyRoleKey, PartySelection>;
  companies: CompanyRow[];
  companyOptions: SearchSelectOption[];
  orders: ClearingCustomerOrderRow[];
  loading: boolean;
  trucksList?: any[];
  warehousesList?: any[];
  goodsMasterList?: any[];
  assignableUsers?: { id: string; name: string }[];
  handlePartyChange: (roleKey: PartyRoleKey, next: PartySelection) => void;
  handleLoadingCountryChange: (countryId: string) => void;
  handleReceivingCountryChange: (countryId: string) => void;
  handleLoadingPortChange: (portId: string) => void;
  handleDestinationPortChange: (portId: string) => void;
  onAdvanceToStep2: () => void;
  onAdvanceToStep3?: () => void;
  onConfirmSave?: () => void;
  onSaveDraft?: () => void;
  onAssignStage1A?: () => void;
  onConfirmTruckContinueMyself?: () => void;
  onConfirmTruckAssignGoods?: () => void;
  onReturnForCorrection?: (stage: "1B" | "1C") => void;
  onCompleteGoodsEntry?: () => void;
  draftGoodsItem?: CustomerOrderGoodsItem;
  setDraftGoodsItem?: React.Dispatch<React.SetStateAction<CustomerOrderGoodsItem>>;
  editingGoodsIdx?: number | null;
  setEditingGoodsIdx?: React.Dispatch<React.SetStateAction<number | null>>;
  saving?: boolean;
}) {
  const ctx = userContext.context;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === formData.customer_id),
    [customers, formData.customer_id]
  );

  const selectedAccount = useMemo(
    () =>
      accounts.find(
        (a) =>
          (formData.customer_id && a.customer_id === formData.customer_id) ||
          a.id === formData.customer_id ||
          (selectedCustomer && a.id === (selectedCustomer as any).account_id)
      ),
    [accounts, formData.customer_id, selectedCustomer]
  );

  const handleCustomerSelection = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    const acc = accounts.find((a) => (a.customer_id && a.customer_id === customerId) || a.id === customerId);

    const effectiveCustName = cust?.customer_name || acc?.name || "";
    setFormData((current) => ({
      ...current,
      customer_id: customerId,
      customer_name: effectiveCustName
    }));

    handlePartyChange("supplier", {
      customerId,
      customerName: effectiveCustName,
      companyId: cust?.country_id || "",
      companyName: cust?.company_name || "",
      addressText: cust?.address || "",
      addressSource: cust?.address ? "Customer master" : "Direct"
    });
  };

  // Step 1C Goods Draft & Edit State
  const [internalDraftGoodsItem, setInternalDraftGoodsItem] = useState<CustomerOrderGoodsItem>(defaultGoodsItem());
  const [internalEditingGoodsIdx, setInternalEditingGoodsIdx] = useState<number | null>(null);

  const draftGoodsItem = propsDraftGoodsItem ?? internalDraftGoodsItem;
  const setDraftGoodsItem = propsSetDraftGoodsItem ?? setInternalDraftGoodsItem;
  const editingGoodsIdx = propsEditingGoodsIdx !== undefined ? propsEditingGoodsIdx : internalEditingGoodsIdx;
  const setEditingGoodsIdx = propsSetEditingGoodsIdx ?? setInternalEditingGoodsIdx;

  const handleDraftGoodsChange = (field: keyof CustomerOrderGoodsItem, value: any) => {
    setDraftGoodsItem((curr) => {
      const updated = { ...curr, [field]: value };
      if (field === "quantity" || field === "kgPerQty") {
        const q = Number(field === "quantity" ? value : updated.quantity) || 0;
        const k = Number(field === "kgPerQty" ? value : updated.kgPerQty) || 0;
        const tot = String(q * k);
        updated.totalKg = tot;
        updated.grossWeight = tot;
        const empty = Number(updated.emptyWeight) || 0;
        updated.netWeight = String(Math.max(0, (q * k) - empty));
        if (updated.rate) {
          updated.finalAmount = String(Number((q * Number(updated.rate)).toFixed(2)));
        }
      }
      if (field === "grossWeight" || field === "emptyWeight") {
        const gross = Number(field === "grossWeight" ? value : updated.grossWeight) || 0;
        const empty = Number(field === "emptyWeight" ? value : updated.emptyWeight) || 0;
        updated.totalKg = String(gross);
        updated.netWeight = String(Math.max(0, gross - empty));
      }
      if (field === "rate") {
        const r = Number(value) || 0;
        const q = Number(updated.quantity) || 0;
        updated.finalAmount = r ? String(Number((q * r).toFixed(2))) : "";
      }
      return updated;
    });
  };

  const handleGoodsPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setDraftGoodsItem((c) => ({
        ...c,
        photoUrl: dataUrl,
        photoName: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDraftGoods = () => {
    if (!draftGoodsItem.goodsName && !draftGoodsItem.goodsId) {
      alert(tt("enter_goods_name", "Please select or enter Goods Name"));
      return;
    }
    const qty = Number(draftGoodsItem.quantity) || 1;
    const kg = Number(draftGoodsItem.kgPerQty) || 50;
    const gross = Number(draftGoodsItem.grossWeight) || (qty * kg);
    const empty = Number(draftGoodsItem.emptyWeight) || 0;
    const net = Math.max(0, gross - empty);
    const rateVal = draftGoodsItem.rate || "";
    const calcFinalAmount = draftGoodsItem.finalAmount || (rateVal ? String(Number((qty * Number(rateVal)).toFixed(2))) : "");

    const itemToSave: CustomerOrderGoodsItem = {
      ...draftGoodsItem,
      goodsName: draftGoodsItem.goodsName || "Goods Item",
      quantity: String(qty),
      kgPerQty: String(kg),
      totalKg: String(gross),
      grossWeight: String(gross),
      emptyWeight: String(empty),
      netWeight: String(net),
      currency: draftGoodsItem.currency || "AED",
      rate: rateVal,
      finalAmount: calcFinalAmount,
      qualityReport: draftGoodsItem.qualityReport || ""
    };

    setFormData((current) => {
      let updatedItems = [...(current.goods_items || [])];
      if (editingGoodsIdx !== null && editingGoodsIdx >= 0 && editingGoodsIdx < updatedItems.length) {
        updatedItems[editingGoodsIdx] = itemToSave;
      } else {
        // Replace empty default item if it's the only one
        if (updatedItems.length === 1 && !updatedItems[0].goodsName && !updatedItems[0].goodsId) {
          updatedItems = [itemToSave];
        } else {
          updatedItems.push(itemToSave);
        }
      }
      const totalQty = updatedItems.reduce((sum, g) => sum + (Number(g.quantity) || 0), 0);
      const totalGrossKg = updatedItems.reduce((sum, g) => sum + (Number(g.grossWeight || g.totalKg) || 0), 0);
      const totalEmptyKg = updatedItems.reduce((sum, g) => sum + (Number(g.emptyWeight) || 0), 0);
      const totalNetKg = updatedItems.reduce((sum, g) => sum + (Number(g.netWeight || g.totalKg) || 0), 0);
      const first = updatedItems[0];
      return {
        ...current,
        goods_items: updatedItems,
        goods_id: first?.goodsId || "",
        goods_name: updatedItems.map((g) => g.goodsName).filter(Boolean).join(", "),
        goods_unit: first?.unit || "Bags",
        goods_quantity: String(totalQty),
        goods_gross_weight: String(totalGrossKg),
        goods_empty_weight: String(totalEmptyKg),
        goods_net_weight: String(totalNetKg)
      };
    });

    setDraftGoodsItem(defaultGoodsItem());
    setEditingGoodsIdx(null);
  };

  const handleEditGoodsRow = (idx: number) => {
    const item = formData.goods_items?.[idx];
    if (!item) return;
    setDraftGoodsItem({ ...item });
    setEditingGoodsIdx(idx);
    selectSub("1C");
  };

  const handleCancelEditGoods = () => {
    setDraftGoodsItem(defaultGoodsItem());
    setEditingGoodsIdx(null);
  };

  const addGoodsItem = () => {
    setDraftGoodsItem(defaultGoodsItem());
    setEditingGoodsIdx(null);
  };

  const removeGoodsItem = (idx: number) => {
    setFormData((current) => {
      const filtered = (current.goods_items || []).filter((_, i) => i !== idx);
      const items = filtered.length > 0 ? filtered : [defaultGoodsItem()];
      const first = items[0];
      const totalQty = items.reduce((sum, g) => sum + (Number(g.quantity) || 0), 0);
      const totalGrossKg = items.reduce((sum, g) => sum + (Number(g.grossWeight || g.totalKg) || 0), 0);
      const totalEmptyKg = items.reduce((sum, g) => sum + (Number(g.emptyWeight) || 0), 0);
      const totalNetKg = items.reduce((sum, g) => sum + (Number(g.netWeight || g.totalKg) || 0), 0);

      return {
        ...current,
        goods_items: items,
        goods_id: first?.goodsId || "",
        goods_name: items.map((g) => g.goodsName).filter(Boolean).join(", "),
        goods_unit: first?.unit || "Bags",
        goods_quantity: String(totalQty),
        goods_gross_weight: String(totalGrossKg),
        goods_empty_weight: String(totalEmptyKg),
        goods_net_weight: String(totalNetKg)
      };
    });
    if (editingGoodsIdx === idx) {
      setDraftGoodsItem(defaultGoodsItem());
      setEditingGoodsIdx(null);
    }
  };

  // Totals calculations
  const totalGoodsQuantity = useMemo(
    () => (formData.goods_items || []).reduce((sum, g) => sum + (Number(g.quantity) || 0), 0),
    [formData.goods_items]
  );
  const totalGoodsGrossKg = useMemo(
    () => (formData.goods_items || []).reduce((sum, g) => sum + (Number(g.grossWeight || g.totalKg) || 0), 0),
    [formData.goods_items]
  );
  const totalGoodsEmptyKg = useMemo(
    () => (formData.goods_items || []).reduce((sum, g) => sum + (Number(g.emptyWeight) || 0), 0),
    [formData.goods_items]
  );
  const totalGoodsNetKg = useMemo(
    () => (formData.goods_items || []).reduce((sum, g) => sum + (Number(g.netWeight || g.totalKg) || 0), 0),
    [formData.goods_items]
  );
  const totalGoodsAmount = useMemo(
    () => (formData.goods_items || []).reduce((sum, g) => sum + (Number(g.finalAmount) || 0), 0),
    [formData.goods_items]
  );
  const totalGoodsGrossMt = useMemo(() => (totalGoodsGrossKg / 1000).toFixed(2), [totalGoodsGrossKg]);
  const totalGoodsNetMt = useMemo(() => (totalGoodsNetKg / 1000).toFixed(2), [totalGoodsNetKg]);

  const selectSub = (sub: "1A" | "1B" | "1C") => {
    if (onSelectSubStep) {
      onSelectSubStep(sub);
    } else {
      setStep1SubStep(sub);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Dynamic 1A / 1B / 1C Sub-step Navigator */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
        <button
          type="button"
          onClick={() => selectSub("1A")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all ${
            step1SubStep === "1A"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/80 dark:border-blue-900/80"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/40"
          }`}
        >
          <Users className={`h-3.5 w-3.5 shrink-0 ${step1SubStep === "1A" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
          <span className="truncate">1A — Customer & Route</span>
          {formData.customer_id ? <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> : null}
        </button>

        <button
          type="button"
          onClick={() => selectSub("1B")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all ${
            step1SubStep === "1B"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/80 dark:border-blue-900/80"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/40"
          }`}
        >
          <Truck className={`h-3.5 w-3.5 shrink-0 ${step1SubStep === "1B" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
          <span className="truncate">1B — Truck & Transport</span>
          {formData.truck_number || formData.truck_assignment_mode === "later" ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => selectSub("1C")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all ${
            step1SubStep === "1C"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/80 dark:border-blue-900/80"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/40"
          }`}
        >
          <Boxes className={`h-3.5 w-3.5 shrink-0 ${step1SubStep === "1C" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`} />
          <span className="truncate">1C — Goods Entry</span>
          {(formData.goods_items || []).filter((g) => g.goodsName || g.quantity).length > 0 ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
          ) : null}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1A — CUSTOMER ACCOUNT, MOVEMENT TYPE & SEQUENCED MULTI-LEG ROUTE          */}
      {/* ========================================================================= */}
      {step1SubStep === "1A" && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Multimodal Sea-Road Notice when By Sea is selected */}
          {formData.transport_mode === "by_sea" && (
            <div className="rounded-xl border border-blue-200/90 bg-blue-50/70 p-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold">
                <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{tt("sea_drayage_feeder_title", "Multimodal Sea-Road Drayage (Port Transfer Truck)")}</span>
              </div>
              <p className="mt-1 text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                {tt("sea_drayage_feeder_desc", "For Ocean Freight (By Sea), road haulage is required for initial port drayage / loading pickup and final delivery from port to destination warehouse.")}
              </p>
            </div>
          )}

          {/* Customer Account SearchSelect */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>{tt("customer_account_label", "Customer Account")} *</span>
                </label>
                {formData.customer_name ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    ✓ {formData.customer_name}
                  </span>
                ) : null}
              </div>

              <SearchSelect
                label=""
                value={formData.customer_id}
                options={customerOptions}
                placeholder={tt("select_customer_account_ph", "Select Customer Account...")}
                onValueChange={handleCustomerSelection}
                disabled={loading}
                searchPlaceholder="Search customer by name, code or mobile..."
                emptyLabel="No matching customers found"
              />
            </div>

            {/* Tag summary underneath input */}
            {selectedCustomer || selectedAccount ? (
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedCustomer?.customer_name || selectedAccount?.name}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-slate-500">
                  Code: {selectedAccount?.code || selectedCustomer?.person_code || "—"}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Bal: {selectedAccount?.currency || "USD"} {Number(selectedAccount?.current_balance || 0).toLocaleString()}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-slate-500">
                  {selectedCustomer?.city_name ? `${selectedCustomer.city_name}, ` : ""}{selectedCustomer?.country_name || ""}
                </span>
              </div>
            ) : null}
          </div>

          {/* ROW 2: Movement Type, Shipment/Package Type & Transport Mode (3-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Repeat2 className="h-4 w-4 text-purple-600" />
                <span>{tt("movement_type_route", "Movement Type")} *</span>
              </label>
              <select
                value={formData.movement_type}
                onChange={(e) => setFormData((curr) => ({ ...curr, movement_type: e.target.value as any }))}
                className={selectClass}
              >
                <option value="import">Import (Foreign Origin &rarr; Local Delivery)</option>
                <option value="export">Export (Local Origin &rarr; Foreign Discharge)</option>
                <option value="up_transit">Up Transit (Border Entry &rarr; Bonded Corridor)</option>
                <option value="down_transit">Down Transit (Inland &rarr; Border Exit)</option>
              </select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Boxes className="h-4 w-4 text-amber-600" />
                <span>{tt("shipment_package_type", "Shipment / Package Type")} *</span>
              </label>
              <select
                value={formData.shipment_type || "FCL"}
                onChange={(e) => setFormData((curr) => ({ ...curr, shipment_type: e.target.value }))}
                className={selectClass}
              >
                <option value="FCL">{tt("shipment_type_fcl", "FCL — Full Container Load")}</option>
                <option value="LCL">{tt("shipment_type_lcl", "LCL — Less than Container Load")}</option>
                <option value="Loose">{tt("shipment_type_loose", "Loose Cargo / General Freight")}</option>
                <option value="Bulk">{tt("shipment_type_bulk", "Dry Bulk Cargo")}</option>
                <option value="Breakbulk">{tt("shipment_type_breakbulk", "Breakbulk Heavy Cargo")}</option>
                <option value="Reefer">{tt("shipment_type_reefer", "Reefer Container (Cold Chain)")}</option>
                <option value="Flat Rack">{tt("shipment_type_flat_rack", "Flat Rack / Open Top Special")}</option>
              </select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Ship className="h-4 w-4 text-blue-600" />
                <span>{tt("shipping_transport_mode", "Transport Mode")} *</span>
              </label>
              <select
                value={formData.transport_mode}
                onChange={(e) => setFormData((curr) => ({ ...curr, transport_mode: e.target.value as any }))}
                className={selectClass}
              >
                <option value="by_sea">🚢 By Sea (Ocean Vessel / Container)</option>
                <option value="by_road">🚛 By Road (Truck / Trailer / Freight)</option>
                <option value="by_air">✈️ By Air (Air Freight / Cargo)</option>
                <option value="by_rail">🚆 By Train (Rail Freight)</option>
              </select>
            </div>
          </div>

          {/* DYNAMIC MOVEMENT & LOCATION SPECIFICATIONS BASED ON MOVEMENT TYPE */}
          {formData.movement_type === "import" && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 space-y-3 dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="flex items-center justify-between border-b border-sky-200/60 pb-1.5 dark:border-sky-900/60">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-sky-800 dark:text-sky-300">
                  <Ship className="h-4 w-4 text-sky-600" />
                  <span>{tt("import_movement_route", "Import Movement & Location Setup")}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                  {tt("import_clearance_badge", "Import Clearance")}
                </span>
              </div>

              {/* Row 1: Foreign Origin Country & Port of Loading */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("foreign_origin_country", "Loading Country (Origin)")} *
                  </label>
                  <select
                    value={formData.loading_country_id}
                    onChange={(e) => handleLoadingCountryChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_origin_country", "Select Origin Country")} —</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("foreign_port_of_loading", "Port of Loading")}
                  </label>
                  <select
                    value={formData.loading_port_id}
                    onChange={(e) => handleLoadingPortChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_port_of_loading", "Select Port of Loading")} —</option>
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>{p.port_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Entry Sea Port / Border Port & Entry Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("entry_sea_port_border", "Entry Sea Port / Border Point")} *
                  </label>
                  <select
                    value={formData.entry_border_port_id}
                    onChange={(e) => {
                      const p = ports.find((item) => item.id === e.target.value);
                      setFormData((c) => ({
                        ...c,
                        entry_border_port_id: e.target.value,
                        entry_border_port_name: p?.port_name || ""
                      }));
                    }}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_entry_port_border", "Select Entry Port / Border")} —</option>
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>{p.port_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("expected_border_entry_date", "Expected Border Entry Date")}
                  </label>
                  <input
                    type="date"
                    value={formData.border_entry_date}
                    onChange={(e) => setFormData((c) => ({ ...c, border_entry_date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Row 3: Customs Clearance Office & Destination City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("customs_clearance_point", "Customs Clearance Point / Port")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("ph_customs_point", "e.g. Karachi Custom House / Torkham Customs")}
                    value={formData.customs_point_text || ""}
                    onChange={(e) => setFormData((c) => ({ ...c, customs_point_text: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("destination_delivery_city", "Destination Delivery City")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("ph_destination_city_pk", "e.g. Lahore / Islamabad / Peshawar")}
                    value={formData.destination_city}
                    onChange={(e) => setFormData((c) => ({ ...c, destination_city: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Row 4: Final Delivery Location / Warehouse */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {tt("final_delivery_location", "Final Destination / Warehouse Address")}
                </label>
                <input
                  type="text"
                  placeholder={tt("ph_final_delivery", "e.g. Consignee Warehouse, Plot 14, Industrial Area")}
                  value={formData.final_delivery_location}
                  onChange={(e) => setFormData((c) => ({ ...c, final_delivery_location: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {formData.movement_type === "export" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5 dark:border-emerald-900/60">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-800 dark:text-emerald-300">
                  <Repeat2 className="h-4 w-4 text-emerald-600" />
                  <span>{tt("export_movement_route", "Export Movement & Location Setup")}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  {tt("export_clearance_badge", "Export Clearance")}
                </span>
              </div>

              {/* Row 1: Origin Loading City / Factory & Exit Border / Port of Loading */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("origin_loading_city_location", "Origin Loading City / Location")} *
                  </label>
                  <input
                    type="text"
                    placeholder={tt("ph_origin_loading_city", "e.g. Lahore / Sialkot Factory")}
                    value={formData.loading_source_name}
                    onChange={(e) => setFormData((c) => ({ ...c, loading_source_name: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("exit_border_port_loading", "Exit Border / Port of Loading")} *
                  </label>
                  <select
                    value={formData.exit_border_port_id || formData.loading_port_id}
                    onChange={(e) => {
                      const p = ports.find((item) => item.id === e.target.value);
                      setFormData((c) => ({
                        ...c,
                        exit_border_port_id: e.target.value,
                        exit_border_port_name: p?.port_name || "",
                        loading_port_id: e.target.value,
                        loading_port_name: p?.port_name || ""
                      }));
                    }}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_exit_port_border", "Select Exit Port / Border")} —</option>
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>{p.port_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Planned Border Exit Date & Export Customs Point */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("planned_border_exit_date", "Planned Border Exit Date")}
                  </label>
                  <input
                    type="date"
                    value={formData.planned_border_exit_date}
                    onChange={(e) => setFormData((c) => ({ ...c, planned_border_exit_date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("export_customs_point", "Export Customs Point")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("ph_export_customs", "e.g. Port Qasim Export Customs")}
                    value={formData.customs_point_text || ""}
                    onChange={(e) => setFormData((c) => ({ ...c, customs_point_text: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Row 3: Destination Country & Foreign Port of Discharge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("destination_country", "Final Destination Country")} *
                  </label>
                  <select
                    value={formData.receiving_country_id}
                    onChange={(e) => handleReceivingCountryChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_destination_country", "Select Destination Country")} —</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("foreign_port_discharge_city", "Discharge Port / Destination City")}
                  </label>
                  <select
                    value={formData.destination_port_id}
                    onChange={(e) => handleDestinationPortChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_port_discharge", "Select Port of Discharge")} —</option>
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>{p.port_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {(formData.movement_type === "transit" || formData.movement_type === "up_transit" || formData.movement_type === "down_transit") && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-3 dark:border-purple-900/60 dark:bg-purple-950/20">
              <div className="flex items-center justify-between border-b border-purple-200/60 pb-1.5 dark:border-purple-900/60">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-purple-800 dark:text-purple-300">
                  <Repeat2 className="h-4 w-4 text-purple-600" />
                  <span>{tt("bonded_transit_movement", "Bonded Transit Movement Setup")}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 uppercase">
                  {formData.movement_type.replace("_", " ")}
                </span>
              </div>

              {/* Row 1: Entry Border / Port & Loading Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("loading_origin_country", "Origin Country")} *
                  </label>
                  <select
                    value={formData.loading_country_id}
                    onChange={(e) => handleLoadingCountryChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_country_generic", "Select Country")} —</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("entry_sea_port_border", "Entry Sea Port / Border Point")} *
                  </label>
                  <select
                    value={formData.entry_border_port_id}
                    onChange={(e) => {
                      const p = ports.find((item) => item.id === e.target.value);
                      setFormData((c) => ({
                        ...c,
                        entry_border_port_id: e.target.value,
                        entry_border_port_name: p?.port_name || ""
                      }));
                    }}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_entry_port_border", "Select Entry Port / Border")} —</option>
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>{p.port_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Exit Border Checkpoint & Planned Exit Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("exit_border_checkpoint", "Exit Border Checkpoint")} *
                  </label>
                  <select
                    value={formData.exit_border_port_id}
                    onChange={(e) => {
                      const p = ports.find((item) => item.id === e.target.value);
                      setFormData((c) => ({
                        ...c,
                        exit_border_port_id: e.target.value,
                        exit_border_port_name: p?.port_name || ""
                      }));
                    }}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_exit_border", "Select Exit Border")} —</option>
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>{p.port_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("planned_border_exit_date", "Planned Border Exit Date")}
                  </label>
                  <input
                    type="date"
                    value={formData.planned_border_exit_date}
                    onChange={(e) => setFormData((c) => ({ ...c, planned_border_exit_date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Row 3: Final Transit Destination Country & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("transit_destination_country", "Final Destination Country")} *
                  </label>
                  <select
                    value={formData.receiving_country_id}
                    onChange={(e) => handleReceivingCountryChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_country_generic", "Select Country")} —</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("destination_city_label", "Destination City")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("ph_destination_city_af", "e.g. Kabul / Kandahar / Mazar-i-Sharif")}
                    value={formData.destination_city}
                    onChange={(e) => setFormData((c) => ({ ...c, destination_city: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SEQUENCED MULTI-LEG ROUTE CORRIDOR BUILDER */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <CustomerOrderRouteBuilder
              routeName={formData.route_name}
              transportMode={formData.transport_mode}
              loadingCountryId={formData.loading_country_id}
              loadingCountryName={
                countries.find((c) => c.id === formData.loading_country_id)?.name ||
                formData.loading_country_name ||
                ""
              }
              receivingCountryId={formData.receiving_country_id}
              receivingCountryName={
                countries.find((c) => c.id === formData.receiving_country_id)?.name ||
                formData.receiving_country_name ||
                ""
              }
              loadingCityName={
                loadingCities.find((c) => c.id === formData.loading_city_id)?.name ||
                formData.loading_city_name ||
                formData.loading_source_name ||
                ""
              }
              destinationCityName={
                receivingCities.find((c) => c.id === formData.receiving_city_id)?.name ||
                formData.destination_city ||
                ""
              }
              legs={formData.legs || []}
              onChange={(routeName, legs) => {
                setFormData((c) => ({ ...c, route_name: routeName, legs }));
              }}
              countries={countries.map((c) => ({ id: c.id, name: c.name }))}
              ledgers={accounts.map((a) => ({ id: a.id, name: a.name, code: a.code, currency: a.currency || undefined }))}
              lang={lang}
            />
          </div>

          {/* ORDER-LEVEL CARGO & ROUTE INSURANCE (covers a single leg or a leg range) */}
          {activeOrder?.id && (formData.legs || []).length > 0 && (
            <CustomerOrderInsurancePanel
              orderId={activeOrder.id}
              legs={(formData.legs || []).map((l: any) => ({ legNo: l.legNo }))}
              ledgers={accounts.map((a) => ({ id: a.id, name: a.name, code: a.code, currency: a.currency || undefined }))}
              lang={lang}
            />
          )}

          {/* 1A Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs transition"
            >
              <Save className="h-3.5 w-3.5 text-slate-500" />
              <span>{t(lang, "comv.save_draft", "Save Draft")}</span>
            </button>

            <div className="flex items-center gap-2">
              {onAssignStage1A && (
                <button
                  type="button"
                  onClick={onAssignStage1A}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 shadow-2xs transition"
                >
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{tt("assign_to_another_user", "Assign to Another User")}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onAdvanceToStep2}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs shadow-blue-600/25 transition"
              >
                <span>Continue Myself (Go to 1B)</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1B — TRUCK / FLEET ASSIGNMENT & OPERATIONAL DATES                         */}
      {/* ========================================================================= */}
      {step1SubStep === "1B" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Read-Only Stage 1A Summary Card */}
          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/40 p-4 space-y-3 dark:border-blue-900/70 dark:bg-slate-900/90 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/70 pb-2 dark:border-blue-900/60">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white shadow-xs">
                  Stage 1A Summary (Read-Only)
                </span>
                <span className="text-xs font-bold text-slate-500">
                  Order: <span className="font-mono font-black text-blue-700 dark:text-blue-300">{formData.order_no || activeOrder?.order_no || "Draft"}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-[11px] font-bold">
                  <Clock className="h-3 w-3" />
                  <span>{tt("truck_confirmation_required", "Truck Confirmation Required")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => selectSub("1A")}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                >
                  <Pencil className="h-3 w-3" />
                  <span>[{tt("edit_1a", "Edit (1A)")}]</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("customer_account_label", "Customer")}</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">{formData.customer_name || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("movement_type_route", "Movement Type")}</span>
                <span className="font-bold text-purple-700 dark:text-purple-300 capitalize block">{formData.movement_type?.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("shipment_package_type", "Shipment Type")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">{formData.shipment_type || "FCL"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("shipping_transport_mode", "Transport Mode")}</span>
                <span className="font-bold text-blue-700 dark:text-blue-300 capitalize block">{formData.transport_mode?.replace("by_", "")}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("loading_location", "Loading Location")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                  {formData.loading_source_name || formData.loading_city_name || countries.find(c => c.id === formData.loading_country_id)?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("final_destination", "Final Destination")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                  {formData.destination_city || countries.find(c => c.id === formData.receiving_country_id)?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("assigned_by", "Assigned By")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                  {activeOrder?.latest_handover?.sender_name || (formData.step1b_assignee_name ? "Assigned by User" : (ctx?.userName || "Self (Current User)"))}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("assigning_branch", "Assigning Branch")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                  {activeOrder?.latest_handover?.source_branch_name || ctx?.branchName || "Main Branch"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("assignment_date_time", "Assignment Date/Time")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 block">
                  {activeOrder?.latest_handover?.created_at ? new Date(activeOrder.latest_handover.created_at).toLocaleString() : (formData.order_date ? `${formData.order_date} ${formData.order_time}` : new Date().toLocaleString())}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("route_via_corridor", "Complete Route Via")}</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Route className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{formData.route_name || "Direct Route"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Truck / Fleet Section — Single Vehicle per Order */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {tt("truck_fleet_assignment_single", "Truck & Transport Confirmation")}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{tt("road_transport", "Road / Fleet Dispatch")}</span>
            </div>

            {/* Truck Assignment Mode & Registration Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {tt("truck_assignment_mode_label", "Truck Assignment Mode")} *
                </label>
                <select
                  value={formData.truck_assignment_mode}
                  onChange={(e) => {
                    const mode = e.target.value as "permanent" | "hired" | "later";
                    setFormData((c) => ({
                      ...c,
                      truck_assignment_mode: mode,
                      truck_id: mode === "later" ? "" : c.truck_id,
                      truck_number: mode === "later" ? "TO BE ASSIGNED" : (mode === "permanent" ? c.truck_number : "")
                    }));
                  }}
                  className={selectClass}
                >
                  <option value="permanent">{tt("opt_permanent_truck", "Option 1: Permanent Truck (From Fleet Master)")}</option>
                  <option value="hired">{tt("opt_hired_truck", "Option 2: Hired / External Truck (Manual Entry)")}</option>
                  <option value="later">{tt("opt_assign_later", "Option 3: Assign Later (Unblock Booking)")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Permanent / Temporary Vehicle *
                </label>
                <select
                  value={formData.truck_registration_type || "registered"}
                  onChange={(e) => setFormData((c) => ({ ...c, truck_registration_type: e.target.value as any }))}
                  className={selectClass}
                >
                  <option value="registered">{tt("truck_type_perm", "Permanent Fleet Truck (Company Registered)")}</option>
                  <option value="temporary">{tt("truck_type_temp", "Temporary Truck (Trip Hired / Contractor)")}</option>
                </select>
              </div>
            </div>

            {/* Truck Form Fields based on Dropdown Selection */}
            {formData.truck_assignment_mode === "permanent" && (
              <div className="space-y-2">
                <SearchSelect
                  label={`${tt("select_permanent_truck", "Select Permanent Truck")} *`}
                  value={formData.truck_id}
                  placeholder={tt("search_truck_ph", "Search truck by number, registration, driver or make...")}
                  options={(trucksList || []).map((t: any) => ({
                    value: t.id,
                    label: `${t.truck_number || t.registration_number || t.id} • Driver: ${t.driver_name || "—"} (${t.make || ""} ${t.model || ""})`,
                    keywords: [t.truck_number, t.registration_number, t.driver_name, t.driver_mobile, t.make, t.model, t.transport_company].filter(Boolean).join(" ")
                  }))}
                  onValueChange={(truckId) => {
                    const trk = (trucksList || []).find((t: any) => t.id === truckId);
                    if (trk) {
                      setFormData((c) => ({
                        ...c,
                        truck_id: trk.id,
                        truck_number: trk.truck_number || trk.registration_number || "",
                        truck_driver_name: trk.driver_name || "",
                        truck_driver_mobile: trk.driver_mobile || trk.driver_phone || "",
                        truck_transport_company: trk.transport_company || trk.owner_name || "",
                        truck_details: [trk.truck_type, trk.make, trk.model, trk.color].filter(Boolean).join(" • ")
                      }));
                    }
                  }}
                  searchPlaceholder="Search truck..."
                  emptyLabel="No matching trucks found"
                />

                {formData.truck_number ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-xs dark:border-slate-800 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.truck_number}</span>
                      <span className="text-slate-400 ml-2">{tt("driver_label", "Driver")}: {formData.truck_driver_name || "—"} ({formData.truck_driver_mobile || "—"})</span>
                    </div>
                    {formData.truck_details ? <span className="text-[11px] text-slate-500">{formData.truck_details}</span> : null}
                  </div>
                ) : null}
              </div>
            )}

            {formData.truck_assignment_mode === "hired" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {tt("truck_registration_no", "Truck / Registration No")} *
                  </label>
                  <input
                    type="text"
                    value={formData.truck_number}
                    onChange={(e) => setFormData((c) => ({ ...c, truck_number: e.target.value }))}
                    placeholder="e.g. TL-9988-KHI"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {tt("driver_name", "Driver Name")}
                  </label>
                  <input
                    type="text"
                    value={formData.truck_driver_name}
                    onChange={(e) => setFormData((c) => ({ ...c, truck_driver_name: e.target.value }))}
                    placeholder={tt("driver_full_name_ph", "Driver full name")}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {tt("driver_mobile", "Driver Mobile")}
                  </label>
                  <input
                    type="text"
                    value={formData.truck_driver_mobile}
                    onChange={(e) => setFormData((c) => ({ ...c, truck_driver_mobile: e.target.value }))}
                    placeholder="+92 300 1234567"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {tt("po_hire_reference", "PO / Hire Reference")}
                  </label>
                  <input
                    type="text"
                    value={formData.truck_po_ref || ""}
                    onChange={(e) => setFormData((c) => ({ ...c, truck_po_ref: e.target.value }))}
                    placeholder="e.g. PO-8874 / Hire Agmt"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {formData.truck_assignment_mode === "later" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <div className="font-bold flex items-center gap-1.5">
                  <BadgeInfo className="h-4 w-4 text-amber-600" />
                  <span>{tt("truck_assigned_later", "Truck To Be Assigned Later")}</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  {tt("truck_assigned_later_hint", "This order booking will be saved and registered without blocking. A vehicle can be assigned during dispatch operations.")}
                </p>
              </div>
            )}

            {/* Additional Fleet & Operational Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Vehicle Type *
                </label>
                <select
                  value={formData.truck_vehicle_type || "Container Trailer"}
                  onChange={(e) => setFormData((c) => ({ ...c, truck_vehicle_type: e.target.value }))}
                  className={selectClass}
                >
                  <option value="Container Trailer">{tt("vehicle_type_container", "Container Trailer (40ft / 20ft)")}</option>
                  <option value="Flatbed Truck">{tt("vehicle_type_flatbed", "Flatbed Truck (Open Body)")}</option>
                  <option value="Box Truck">{tt("vehicle_type_box_truck", "Box Truck / Covered Van")}</option>
                  <option value="Tanker">{tt("vehicle_type_tanker", "Liquid Tanker")}</option>
                  <option value="Lowbed Trailer">{tt("vehicle_type_lowbed", "Lowbed Heavy Equipment Trailer")}</option>
                  <option value="Reefer">{tt("vehicle_type_reefer", "Refrigerated (Reefer) Truck")}</option>
                  <option value="Pickup">{tt("vehicle_type_pickup", "Pickup / Light Commercial Vehicle")}</option>
                  <option value="Other">{tt("vehicle_type_other", "Other Specialized Transport")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Transport Co / Contractor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Al-Fatah Goods Transport"
                  value={formData.truck_transport_company || ""}
                  onChange={(e) => setFormData((c) => ({ ...c, truck_transport_company: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Arrival Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.truck_arrival_time || ""}
                  onChange={(e) => setFormData((c) => ({ ...c, truck_arrival_time: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Loading Location / Terminal
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jebel Ali Gate 4 / Karachi Terminal Yard"
                  value={formData.truck_loading_location || ""}
                  onChange={(e) => setFormData((c) => ({ ...c, truck_loading_location: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Truck Operational Status
                </label>
                <select
                  value={formData.truck_status || "Pending"}
                  onChange={(e) => setFormData((c) => ({ ...c, truck_status: e.target.value }))}
                  className={selectClass}
                >
                  <option value="Pending">{tt("truck_status_pending", "Pending Assignment")}</option>
                  <option value="At Gate">{tt("truck_status_at_gate", "At Gate / Terminal")}</option>
                  <option value="In Transit">{tt("truck_status_in_transit", "In Transit")}</option>
                  <option value="Loading">{tt("truck_status_loading", "Loading Cargo")}</option>
                  <option value="Dispatched">{tt("truck_status_dispatched", "Dispatched / Released")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  <span>{tt("truck_document_photos", "Truck Document / Photos")}</span>
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setFormData((c) => ({
                        ...c,
                        truck_photo_url: reader.result as string,
                        truck_photo_name: file.name
                      }));
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/40 dark:file:text-blue-300"
                />
                {formData.truck_photo_name ? (
                  <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ {formData.truck_photo_name} attached</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* 1B Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectSub("1A")}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Back to 1A</span>
              </button>

              {onReturnForCorrection && (
                <button
                  type="button"
                  onClick={() => onReturnForCorrection("1B")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 shadow-2xs transition"
                  title={tt("return_to_1a_title", "Return back to Stage 1A with mandatory correction reason")}
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  <span>{tt("return_for_correction", "Return for Correction")}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs transition"
              >
                <Save className="h-3.5 w-3.5 text-slate-500" />
                <span>{tt("save_draft", "Save Draft")}</span>
              </button>

              {onConfirmTruckAssignGoods && (
                <button
                  type="button"
                  onClick={onConfirmTruckAssignGoods}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 shadow-2xs transition"
                >
                  <Users className="h-3.5 w-3.5 text-blue-600" />
                  <span>{tt("confirm_truck_assign_goods", "Confirm Truck & Assign Goods Entry")}</span>
                </button>
              )}

              {onConfirmTruckContinueMyself && (
                <button
                  type="button"
                  onClick={onConfirmTruckContinueMyself}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs shadow-blue-600/25 transition"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{tt("confirm_truck_continue_myself", "Confirm Truck & Continue Myself")}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1C — GOODS ENTRY & LIVE MANIFEST BREAKDOWN                                 */}
      {/* ========================================================================= */}
      {step1SubStep === "1C" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Prominent Stage 1C Notification Banner */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-3.5 shadow-xs dark:border-emerald-800/80 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    🚚 Truck Confirmed — Goods Entry Assigned to You
                  </span>
                  <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    Stage 1C Active
                  </span>
                </div>
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  {tt("stage_1c_notification_desc_updated", "Truck logistics verified. Record cargo manifest, size, brand/quality, gross/tare weights, and rate/amounts.")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onReturnForCorrection && (
                <button
                  type="button"
                  onClick={() => onReturnForCorrection("1C")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 transition shadow-2xs"
                  title={tt("return_to_truck_user_title", "Return to Truck User for correction")}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                  <span>{tt("return_to_truck_user", "Return to Truck User")}</span>
                </button>
              )}
              {formData.truck_number ? (
                <div className="hidden sm:flex flex-col items-end text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tt("assigned_truck", "Assigned Truck")}</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-black">{formData.truck_number}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Read-Only Summary of 1A & 1B for Goods User */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white shadow-xs">
                  1A & 1B Verified Summary (Read-Only)
                </span>
                <span className="text-xs font-bold text-slate-500">
                  Order: <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">{formData.order_no || activeOrder?.order_no || "Draft"}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{tt("truck_confirmed", "Truck Confirmed")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => selectSub("1B")}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 underline"
                >
                  [{tt("view_1b_truck", "View 1B Truck")}]
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("customer_account_label", "Customer")}</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">{formData.customer_name || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("movement_type_route", "Movement")}</span>
                <span className="font-bold text-purple-700 dark:text-purple-300 capitalize block">{formData.movement_type?.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("truck_number_label", "Truck Number")}</span>
                <span className="font-mono font-black text-blue-700 dark:text-blue-300 block">{formData.truck_number || "TO BE ASSIGNED"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("driver_name", "Driver")}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                  {formData.truck_driver_name || "—"} {formData.truck_driver_mobile ? `(${formData.truck_driver_mobile})` : ""}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("loading_place", "Loading Place")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                  {formData.truck_loading_location || formData.loading_source_name || "Terminal Yard"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("vehicle_type", "Vehicle Type")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 block">{formData.truck_vehicle_type || "Container Trailer"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("truck_confirmed_by", "Truck Confirmed By")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                  {(activeOrder as any)?.truck_details?.confirmedByName || ctx?.userName || "Truck Desk User"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("confirmation_date_time", "Confirmation Date/Time")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 block">
                  {(activeOrder as any)?.truck_details?.confirmedAt ? new Date((activeOrder as any).truck_details.confirmedAt).toLocaleString() : new Date().toLocaleString()}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tt("route_via_corridor", "Complete Route")}</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Route className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{formData.route_name || "Direct Route"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Multiple Goods Section with Save-to-Table & Live Compact Manifest */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Goods & Cargo Breakdown ({(formData.goods_items || []).filter((g) => g.goodsName || g.quantity).length} Items)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraftGoodsItem(defaultGoodsItem());
                  setEditingGoodsIdx(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ New Goods Item</span>
              </button>
            </div>

            {/* Goods Entry / Edit Input Form */}
            <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/30 p-3 space-y-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black">
                    {editingGoodsIdx !== null ? editingGoodsIdx + 1 : (formData.goods_items || []).length + 1}
                  </span>
                  <span>{editingGoodsIdx !== null ? tt("edit_goods_item_num", "Edit Goods Item #{n}").replace("{n}", String(editingGoodsIdx + 1)) : tt("add_goods_item", "Add Goods Item")}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                  {tt("goods_entry_flexible_hint", "Complete cargo manifest with weights, warehouse, size, origin and pricing")}
                </span>
                {editingGoodsIdx !== null ? (
                  <button
                    type="button"
                    onClick={handleCancelEditGoods}
                    className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 underline font-medium"
                  >
                    {tt("cancel_edit_generic", "Cancel Edit")}
                  </button>
                ) : null}
              </div>

              {/* Warehouse Location Selection */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Warehouse className="h-3.5 w-3.5 text-blue-600" />
                    <span>{tt("warehouse_location_toggle_label", "Warehouse Location")} *</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">{tt("step3_specification", "Step 3 Specification")}</span>
                </div>

                <select
                  value={draftGoodsItem.warehouseSourceType}
                  onChange={(e) => {
                    const val = e.target.value as "company_warehouse" | "customer_warehouse" | "other";
                    handleDraftGoodsChange("warehouseSourceType", val);
                    if (val === "customer_warehouse") {
                      handleDraftGoodsChange("warehouseName", selectedCustomer ? `${selectedCustomer.customer_name}'s Warehouse` : tt("customer_warehouse_title", "Customer Warehouse"));
                      handleDraftGoodsChange("warehouseAddressText", selectedCustomer?.address || tt("customer_registered_address", "Customer Registered Address"));
                    }
                  }}
                  className={selectClass}
                >
                  <option value="company_warehouse">{tt("own_warehouse_title", "Own Warehouse (Company DGT Warehouse)")}</option>
                  <option value="customer_warehouse">{tt("customer_warehouse_title", "Customer Warehouse (Client Premises / Yard)")}</option>
                  <option value="other">{tt("other_warehouse_title", "Other Warehouse (Third-Party Yard / Port)")}</option>
                </select>

                {/* Dynamic inputs based on selection */}
                {draftGoodsItem.warehouseSourceType === "company_warehouse" && (
                  <div className="mt-1.5">
                    <SearchSelect
                      label={`${tt("select_company_warehouse", "Select Company Warehouse")} *`}
                      value={draftGoodsItem.warehouseId}
                      placeholder={tt("select_company_warehouse_ph", "Select Company Warehouse...")}
                      options={(warehousesList || []).map((w: any) => ({
                        value: w.id,
                        label: `${w.warehouse_name || w.name} (${w.city_name || w.country_name || "Central"})`,
                        keywords: [w.warehouse_name, w.name, w.city_name, w.country_name, w.full_address].filter(Boolean).join(" ")
                      }))}
                      onValueChange={(warehouseId) => {
                        const w = (warehousesList || []).find((wh: any) => wh.id === warehouseId);
                        const addr = [w?.full_address, w?.city_name, w?.country_name].filter(Boolean).join(", ");
                        handleDraftGoodsChange("warehouseId", warehouseId);
                        handleDraftGoodsChange("warehouseName", w?.warehouse_name || w?.name || "");
                        handleDraftGoodsChange("warehouseAddressText", addr);
                      }}
                      searchPlaceholder="Search company warehouses..."
                      emptyLabel="No warehouses found in master"
                    />
                  </div>
                )}

                {draftGoodsItem.warehouseSourceType === "customer_warehouse" && (
                  <div className="mt-1.5 p-2 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">{tt("customer_facility", "Customer Facility")}: </span>
                    <span className="text-slate-700 dark:text-slate-300">{draftGoodsItem.warehouseAddressText || selectedCustomer?.address || tt("address_from_customer_account", "Address from customer account")}</span>
                  </div>
                )}

                {draftGoodsItem.warehouseSourceType === "other" && (
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={`${tt("other_warehouse_yard_name", "Other Warehouse / Yard Name")} *`}
                      value={draftGoodsItem.warehouseName}
                      onChange={(e) => handleDraftGoodsChange("warehouseName", e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder={`${tt("address_port_yard_location", "Address / Port Yard Location")} *`}
                      value={draftGoodsItem.warehouseAddressText}
                      onChange={(e) => handleDraftGoodsChange("warehouseAddressText", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              {/* Row 1: Goods Master Selection, Goods Name, CHS Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("select_goods_master", "Goods Master")}
                  </label>
                  <SearchSelect
                    label=""
                    value={draftGoodsItem.goodsId}
                    placeholder={tt("select_search_goods_ph", "Select or search goods from master...")}
                    options={(goodsMasterList || []).map((g: any) => ({
                      value: g.id,
                      label: `${g.goods_name || g.name} ${g.chs_code ? `[CHS: ${g.chs_code}]` : ""}`,
                      keywords: [g.goods_name, g.chs_code, g.category, g.variety].filter(Boolean).join(" ")
                    }))}
                    onValueChange={(goodsId) => {
                      const found = (goodsMasterList || []).find((g: any) => g.id === goodsId);
                      handleDraftGoodsChange("goodsId", goodsId);
                      handleDraftGoodsChange("goodsName", found?.goods_name || found?.name || draftGoodsItem.goodsName);
                      handleDraftGoodsChange("goodsChsCode", found?.chs_code || "");
                    }}
                    searchPlaceholder={tt("search_goods_ph", "Search goods...")}
                    emptyLabel={tt("no_goods_in_master", "No goods found in master")}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("goods_name", "Goods Name")} *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Basmati Rice / Steel Coils"
                    value={draftGoodsItem.goodsName || ""}
                    onChange={(e) => handleDraftGoodsChange("goodsName", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("chs_code", "CHS / HS Code")}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1006.30 / 7208.51"
                    value={draftGoodsItem.goodsChsCode || ""}
                    onChange={(e) => handleDraftGoodsChange("goodsChsCode", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Row 2: Size / Dimensions, Brand / Quality, Origin Country */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("goods_size_dim", "Size / Dimension")}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 40mm / 12x12 / Standard"
                    value={draftGoodsItem.size || ""}
                    onChange={(e) => handleDraftGoodsChange("size", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("goods_brand_quality", "Brand / Quality")}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grade A / Premium / Export Quality"
                    value={draftGoodsItem.brandQuality || ""}
                    onChange={(e) => handleDraftGoodsChange("brandQuality", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("origin_country", "Origin Country")}
                  </label>
                  <select
                    value={draftGoodsItem.originCountry || ""}
                    onChange={(e) => handleDraftGoodsChange("originCountry", e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— {tt("select_origin_country", "Select Origin")} —</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Packaging & Unit Counts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">{tt("qty_unit", "Qty Unit")}</label>
                  <select
                    value={draftGoodsItem.unit}
                    onChange={(e) => handleDraftGoodsChange("unit", e.target.value)}
                    className={selectClass}
                  >
                    <option value="Bags">{tt("unit_bags", "Bags")}</option>
                    <option value="Cartons">{tt("unit_cartons", "Cartons")}</option>
                    <option value="Pallets">{tt("unit_pallets", "Pallets")}</option>
                    <option value="Packages">{tt("unit_packages", "Packages")}</option>
                    <option value="Boxes">{tt("unit_boxes", "Boxes")}</option>
                    <option value="MT">MT</option>
                    <option value="KG">KG</option>
                    <option value="Loose">{tt("unit_loose", "Loose")}</option>
                    <option value="Containers">{tt("unit_containers", "Containers")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">{tt("quantity", "Quantity")} *</label>
                  <input
                    type="number"
                    min="0"
                    value={draftGoodsItem.quantity}
                    onChange={(e) => handleDraftGoodsChange("quantity", e.target.value)}
                    className={inputClass}
                    placeholder="1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">{tt("kg_per_unit", "KG / Unit")} *</label>
                  <input
                    type="number"
                    min="0"
                    value={draftGoodsItem.kgPerQty}
                    onChange={(e) => handleDraftGoodsChange("kgPerQty", e.target.value)}
                    className={inputClass}
                    placeholder="50"
                  />
                </div>
              </div>

              {/* Row 4: Weight Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("gross_wt_kg", "Gross Wt (KG)")} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={draftGoodsItem.grossWeight || draftGoodsItem.totalKg}
                    onChange={(e) => handleDraftGoodsChange("grossWeight", e.target.value)}
                    className={inputClass}
                    placeholder="50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("empty_tare_kg", "Empty / Tare (KG)")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={draftGoodsItem.emptyWeight || "0"}
                    onChange={(e) => handleDraftGoodsChange("emptyWeight", e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-0.5">
                    {tt("net_wt_auto", "Net Wt (Auto)")} *
                  </label>
                  <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/90 px-2.5 py-2 text-xs font-mono font-black text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 truncate" title={tt("gross_minus_empty", "Gross - Empty Weight")}>
                    <Scale className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{(Number(draftGoodsItem.netWeight) || 0).toLocaleString()} kg</span>
                  </div>
                </div>
              </div>

              {/* Row 5: Currency, Rate & Final Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("currency", "Currency")} *
                  </label>
                  <select
                    value={draftGoodsItem.currency || "AED"}
                    onChange={(e) => handleDraftGoodsChange("currency", e.target.value)}
                    className={selectClass}
                  >
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="PKR">PKR — Pakistani Rupee</option>
                    <option value="AFN">AFN — Afghan Afghani</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="CNY">CNY — Chinese Yuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("rate_price_unit", "Rate / Price per Unit")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftGoodsItem.rate || ""}
                    onChange={(e) => handleDraftGoodsChange("rate", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 150.00"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                    {tt("final_amount", "Final Amount (Calculated)")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftGoodsItem.finalAmount || ""}
                    onChange={(e) => handleDraftGoodsChange("finalAmount", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 1500.00"
                  />
                </div>
              </div>

              {/* Quality Report / Cargo Condition */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                  {tt("quality_inspection_report", "Quality / Inspection Report & Cargo Notes")}
                </label>
                <textarea
                  rows={2}
                  value={draftGoodsItem.qualityReport || ""}
                  onChange={(e) => handleDraftGoodsChange("qualityReport", e.target.value)}
                  placeholder={tt("quality_report_ph", "Enter cargo inspection notes, moisture levels, batch numbers or packaging condition...")}
                  className={inputClass}
                />
              </div>

              {/* Photo Upload & Add/Update Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-emerald-200/50 dark:border-emerald-900/40">
                <div className="flex items-center gap-2">
                  <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span>{tt("quality_loading_inspection_photo", "Inspection Photo")}:</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGoodsPhotoUpload}
                    className="text-[11px] text-slate-500 file:mr-1.5 file:py-0.5 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/40 dark:file:text-blue-300"
                  />
                  {draftGoodsItem.photoUrl ? (
                    <span className="text-[10px] text-emerald-600 font-bold">✓ {tt("attached", "Attached")}</span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  {editingGoodsIdx !== null ? (
                    <button
                      type="button"
                      onClick={handleCancelEditGoods}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                    >
                      <span>{tt("cancel", "Cancel")}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSaveDraftGoods}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs shadow-emerald-600/25 hover:bg-emerald-700 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{editingGoodsIdx !== null ? tt("update_goods_item", "Update Item") : tt("add_to_manifest", "Add to Manifest")}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* LIVE COMPACT GOODS MANIFEST TABLE WITH TOTALS */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {tt("cargo_manifest_table_title", "Live Goods Manifest & Totals")}
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {(formData.goods_items || []).filter(g => g.goodsName || g.quantity).length} {tt("items_entered", "item(s)")}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 dark:bg-slate-800 text-[10.5px] font-black uppercase text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2 px-2.5 w-8 text-center">#</th>
                      <th className="py-2 px-2.5">{tt("goods_name_chs", "Goods Name & HS")}</th>
                      <th className="py-2 px-2.5">{tt("size_brand", "Size / Quality")}</th>
                      <th className="py-2 px-2.5">{tt("origin", "Origin")}</th>
                      <th className="py-2 px-2.5 text-right">{tt("quantity", "Qty")}</th>
                      <th className="py-2 px-2.5 text-right">{tt("gross_wt_kg", "Gross (kg)")}</th>
                      <th className="py-2 px-2.5 text-right">{tt("empty_tare_kg", "Tare (kg)")}</th>
                      <th className="py-2 px-2.5 text-right">{tt("net_wt_kg", "Net (kg)")}</th>
                      <th className="py-2 px-2.5">{tt("warehouse", "Warehouse")}</th>
                      <th className="py-2 px-2.5 text-right">{tt("rate_amount", "Rate / Amount")}</th>
                      <th className="py-2 px-2.5 text-center w-16">{tt("actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {(formData.goods_items || []).filter(g => g.goodsName || g.quantity).length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-4 text-center text-xs text-slate-400">
                          {tt("no_goods_added_yet", "No goods items added yet. Complete the form above and click '+ Add to Manifest'.")}
                        </td>
                      </tr>
                    ) : (
                      (formData.goods_items || []).filter(g => g.goodsName || g.quantity).map((g, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="py-2 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-white">
                            <div>{g.goodsName || "Goods Item"}</div>
                            {g.goodsChsCode ? <div className="font-mono text-[10px] text-slate-400">HS: {g.goodsChsCode}</div> : null}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">
                            {[g.size, g.brandQuality].filter(Boolean).join(" • ") || "—"}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">{g.originCountry || "—"}</td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {Number(g.quantity || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{g.unit || "Bags"}</span>
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                            {Number(g.grossWeight || g.totalKg || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-500">
                            {Number(g.emptyWeight || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {Number(g.netWeight || g.totalKg || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                            {g.warehouseName || g.warehouseSourceType?.replace("_", " ") || "—"}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-800 dark:text-slate-200">
                            {g.rate ? (
                              <div>
                                <span className="text-[10px] text-slate-400">{g.currency || "AED"} </span>
                                <span className="font-bold">{Number(g.finalAmount || ((Number(g.quantity) || 0) * (Number(g.rate) || 0))).toLocaleString()}</span>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditGoodsRow(idx)}
                                className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                title={tt("edit", "Edit")}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeGoodsItem(idx)}
                                className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title={tt("delete", "Delete")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Table Footer with Totals */}
                  <tfoot className="bg-slate-100/95 dark:bg-slate-800/90 font-black text-xs border-t-2 border-slate-300 dark:border-slate-700">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-2.5 text-right uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        {tt("manifest_totals", "Manifest Totals")}:
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-900 dark:text-white">
                        {totalGoodsQuantity.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-900 dark:text-white">
                        <div>{totalGoodsGrossKg.toLocaleString()} kg</div>
                        <div className="text-[10px] font-bold text-slate-500">({totalGoodsGrossMt} MT)</div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                        {totalGoodsEmptyKg.toLocaleString()} kg
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black">
                        <div>{totalGoodsNetKg.toLocaleString()} kg</div>
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">({totalGoodsNetMt} MT)</div>
                      </td>
                      <td className="py-2.5 px-2.5 text-slate-400 text-[10px]">
                        {(formData.goods_items || []).filter(g => g.goodsName || g.quantity).length} {tt("items", "items")}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-900 dark:text-white font-black">
                        {totalGoodsAmount > 0 ? `${draftGoodsItem.currency || "AED"} ${totalGoodsAmount.toLocaleString()}` : "—"}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* 1C Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectSub("1B")}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Back to 1B</span>
              </button>

              {onReturnForCorrection && (
                <button
                  type="button"
                  onClick={() => onReturnForCorrection("1C")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 shadow-2xs transition"
                  title={tt("return_to_truck_user_title", "Return back to Stage 1B Truck User with mandatory correction reason")}
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  <span>{tt("return_to_truck_user", "Return to Truck User")}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs transition"
              >
                <Save className="h-3.5 w-3.5 text-slate-500" />
                <span>{tt("save_draft", "Save Draft")}</span>
              </button>

              <button
                type="button"
                onClick={addGoodsItem}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{tt("add_item", "+ Add Item")}</span>
              </button>

              {onCompleteGoodsEntry && (
                <button
                  type="button"
                  onClick={onCompleteGoodsEntry}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/25 transition"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{tt("complete_goods_entry", "Complete Goods Entry")}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function Step2PickupGoodsTruck({
  lang,
  tt,
  formData,
  setFormData,
  handleGoodsSelect,
  saving
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  tt: (k: string, f: string) => string;
  formData: FormDataState;
  setFormData: SetFormData;
  handleGoodsSelect: (value: GoodsPickerValue) => void;
  saving: boolean;
}) {
  const isRoad = formData.transport_mode === "by_road";
  const [showTruckSection, setShowTruckSection] = useState(false);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      <SectionHeading num={2} icon={Warehouse} title={t(lang, "comv.step2_title", "Pickup, Goods & Truck")} />

      {/* Pickup Source — spec point 5: Customer Warehouse must never create internal stock */}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("loading_source", "Pickup Source")}</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(
            [
              { key: "shipping_warehouse", label: t(lang, "comv.ls_shipping_warehouse", "Shipping Link Warehouse"), icon: Warehouse },
              { key: "customer_warehouse", label: t(lang, "comv.ls_customer_warehouse", "Customer Warehouse"), icon: Building2 },
              { key: "container", label: t(lang, "comv.ls_container", "Container"), icon: Container },
              { key: "port_terminal", label: t(lang, "comv.ls_port_terminal", "Port / Terminal"), icon: Anchor },
              { key: "border_yard", label: t(lang, "comv.ls_border_yard", "Border / Yard"), icon: MapPin },
              { key: "other", label: t(lang, "comv.ls_other", "Other"), icon: Repeat2 }
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData((current) => ({ ...current, loading_source: key, loading_source_name: current.loading_source === key ? current.loading_source_name : "" }))}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs font-bold transition-all ${
                formData.loading_source === key
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300"
                  : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {formData.loading_source === "shipping_warehouse" ? (
          <div className="mt-2">
            <WarehousePicker
              label={t(lang, "comv.select_shipping_warehouse", "Select Shipping Link Warehouse")}
              value={formData.loading_source_warehouse_id}
              onSelectRecord={(record) =>
                setFormData((current) => ({
                  ...current,
                  loading_source_warehouse_id: record?.id || "",
                  loading_source_name: record?.warehouse_name || ""
                }))
              }
            />
          </div>
        ) : formData.loading_source === "customer_warehouse" ? (
          <div className="mt-2 space-y-1">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {t(lang, "comv.customer_warehouse_note", "Uses the customer's own address — this never creates internal Shipping Link stock.")}
            </p>
            <input
              type="text"
              placeholder={t(lang, "comv.customer_warehouse_ph", "Customer warehouse / delivery address")}
              value={formData.loading_source_name}
              onChange={(e) => setFormData((current) => ({ ...current, loading_source_name: e.target.value }))}
              className={inputClass}
            />
          </div>
        ) : formData.loading_source === "container" ? (
          <input
            type="text"
            placeholder={t(lang, "comv.container_ref_ph", "Container number / reference")}
            value={formData.loading_source_container_ref}
            onChange={(e) => setFormData((current) => ({ ...current, loading_source_container_ref: e.target.value }))}
            className={`mt-2 ${inputClass}`}
          />
        ) : (
          <input
            type="text"
            placeholder={tt("ls_name_ph", "Source name / location details")}
            value={formData.loading_source_name}
            onChange={(e) => setFormData((current) => ({ ...current, loading_source_name: e.target.value }))}
            className={`mt-2 ${inputClass}`}
          />
        )}
      </div>

      {/* Multi-warehouse loading allocations — ONE order + ONE goods item may still be
          picked up from several warehouses/locations (e.g. Almond 10,000kg split across
          3 warehouses). The order's own goods_quantity below stays the single total;
          this is only the breakdown of where that total is sourced from. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Warehouse className="h-4 w-4 text-emerald-600" />
            {t(lang, "comv.loading_allocations_title", "Multi-Warehouse Loading (optional)")}
          </div>
          <button
            type="button"
            onClick={() =>
              setFormData((current) => ({
                ...current,
                loadingAllocations: [...current.loadingAllocations, emptyLoadingAllocation(current.loadingAllocations.length + 1)]
              }))
            }
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Plus className="inline h-3 w-3 mr-0.5" />
            {t(lang, "comv.add_allocation", "Add Warehouse")}
          </button>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {t(lang, "comv.loading_allocations_hint", "Leave empty if this order's goods are picked up from a single source above. Add rows only when the same goods item is split across more than one warehouse.")}
        </p>
        {formData.loadingAllocations.map((alloc, aIdx) => (
          <div key={aIdx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <WarehousePicker
              label={t(lang, "comv.allocation_warehouse", "Warehouse")}
              value={alloc.warehouseId}
              onSelectRecord={(record) =>
                setFormData((current) => ({
                  ...current,
                  loadingAllocations: current.loadingAllocations.map((a, i) =>
                    i === aIdx ? { ...a, warehouseId: record?.id || "", warehouseName: record?.warehouse_name || "" } : a
                  )
                }))
              }
            />
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{t(lang, "comv.allocation_quantity", "Quantity")}</label>
              <input
                type="number"
                value={alloc.quantity}
                onChange={(e) =>
                  setFormData((current) => ({
                    ...current,
                    loadingAllocations: current.loadingAllocations.map((a, i) => (i === aIdx ? { ...a, quantity: e.target.value } : a))
                  }))
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{t(lang, "comv.allocation_unit", "Unit")}</label>
              <input
                type="text"
                value={alloc.unit}
                onChange={(e) =>
                  setFormData((current) => ({
                    ...current,
                    loadingAllocations: current.loadingAllocations.map((a, i) => (i === aIdx ? { ...a, unit: e.target.value } : a))
                  }))
                }
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData((current) => ({
                  ...current,
                  loadingAllocations: current.loadingAllocations.filter((_, i) => i !== aIdx)
                }))
              }
              className="self-end rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {formData.loadingAllocations.length > 0 ? (
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {t(lang, "comv.allocation_total", "Allocated total:")}{" "}
            {formData.loadingAllocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0)}
            {formData.goods_quantity ? ` / ${formData.goods_quantity}` : ""} {formData.goods_unit}
          </p>
        ) : null}
      </div>

      {/* Goods Master Selection Card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <Boxes className="h-4 w-4 text-emerald-600" />
          {tt("goods_master_card", "Goods / Item Master")}
        </div>
        <GoodsPicker
          value={formData.goods_id}
          variationValue={formData.goods_variation_id}
          onSelect={handleGoodsSelect}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
          <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("selected_goods", "Selected Goods")}</div>
            <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200 truncate">
              {formData.goods_name ? `${formData.goods_name}${formData.goods_chs_code ? ` • ${formData.goods_chs_code}` : ""}` : "-"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("origin_variation", "Origin / Variation")}</div>
            <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200 truncate">
              {formData.goods_origin_country_name || "-"}
              {formData.goods_variation_label ? ` • ${formData.goods_variation_label}` : ""}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.goods_quantity", "Quantity")}</label>
            <input
              type="number"
              value={formData.goods_quantity}
              onChange={(e) => setFormData((current) => ({ ...current, goods_quantity: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.goods_unit", "Unit")}</label>
            <input
              type="text"
              placeholder={t(lang, "comv.goods_unit_ph", "e.g. KG, TON, PCS")}
              value={formData.goods_unit}
              onChange={(e) => setFormData((current) => ({ ...current, goods_unit: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.goods_bags_cartons", "Bags / Cartons")}</label>
            <input
              type="number"
              value={formData.goods_bags_cartons}
              onChange={(e) => setFormData((current) => ({ ...current, goods_bags_cartons: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.goods_gross_weight", "Gross Weight")}</label>
            <input
              type="number"
              value={formData.goods_gross_weight}
              onChange={(e) => setFormData((current) => ({ ...current, goods_gross_weight: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.goods_empty_weight", "Empty Weight")}</label>
            <input
              type="number"
              value={formData.goods_empty_weight}
              onChange={(e) => setFormData((current) => ({ ...current, goods_empty_weight: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.goods_net_weight", "Net Weight")}</label>
            <input
              type="number"
              value={formData.goods_net_weight}
              onChange={(e) => setFormData((current) => ({ ...current, goods_net_weight: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Truck Requirement — spec point 7 */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Truck className="h-4 w-4 text-blue-600" />
            {t(lang, "comv.truck_requirement", "Truck Requirement")}
            {isRoad ? <span className="text-rose-500">*</span> : null}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{t(lang, "comv.load_type", "Load Type")}</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                { key: "full_truck", label: t(lang, "comv.load_type_full_truck", "Full Truck") },
                { key: "partial_load", label: t(lang, "comv.load_type_partial_load", "Partial Load") },
                { key: "container_haulage", label: t(lang, "comv.load_type_container_haulage", "Container Haulage") }
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFormData((current) => ({ ...current, load_type: key }))}
                className={`rounded-xl border px-2 py-1.5 text-xs font-bold transition-all ${
                  formData.load_type === key
                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300"
                    : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isRoad || showTruckSection || formData.truck_id || formData.truck_number ? (
          <TruckEntryPicker
            langProp={lang}
            disabled={saving}
            value={{
              truck_registration_type: formData.truck_registration_type,
              truck_id: formData.truck_id,
              truck_number: formData.truck_number,
              truck_driver_name: formData.truck_driver_name,
              truck_driver_mobile: formData.truck_driver_mobile,
              truck_owner_name: formData.truck_owner_name,
              truck_transport_company: formData.truck_transport_company
            }}
            onChange={(next: TruckEntryValue) => setFormData((current) => ({ ...current, ...next }))}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowTruckSection(true)}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            + {t(lang, "comv.add_truck_details", "Add Truck Details")}
          </button>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelClass}>{tt("remarks", "Remarks")}</label>
          <VoiceDictateButton
            context="clearing"
            lang={lang}
            value={formData.remarks}
            onChange={(next) => setFormData((current) => ({ ...current, remarks: next }))}
          />
        </div>
        <textarea
          rows={2}
          placeholder={tt("remarks_ph", "Additional instructions or notes...")}
          value={formData.remarks}
          onChange={(e) => setFormData((current) => ({ ...current, remarks: e.target.value }))}
          className={inputClass}
        />
      </div>
    </div>
  );
}

function LegPartyMini({
  label,
  value,
  rows,
  onChange
}: {
  label: string;
  value: string;
  rows: Array<{ id: string; name: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">-</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * "Send to next user" per leg — reuses the EXISTING generic user_tasks engine
 * (lib/user-tasks/service.ts, app/api/erp/user-tasks/route.ts) rather than a new
 * assignment system. Creates one task linked to this leg via the polymorphic
 * related_record_table/related_record_id columns already built for that purpose,
 * and stores the new task id back on the leg (current_task_id) so the Live Report
 * can show who is presently responsible without a second query round-trip.
 */
function ShippingLegHandoffAction({
  lang,
  leg,
  assignableUsers,
  onAssigned
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  leg: RouteLeg;
  assignableUsers: { id: string; name: string }[];
  onAssigned: (taskId: string, userId: string) => void;
}) {
  const [nextUserId, setNextUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAssign() {
    if (!nextUserId || !leg.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/erp/user-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Shipping Order — Leg #${leg.legNo} (${leg.fromCountryName || "?"} → ${leg.toCountryName || "?"})`,
          assignedTo: nextUserId,
          relatedModule: "shipping",
          relatedRecordTable: "clearing_customer_order_legs",
          relatedRecordId: leg.id,
          relatedRecordLabel: `Leg #${leg.legNo}`,
          priority: "normal"
        })
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Failed to assign leg.");
      onAssigned(json.data.id, nextUserId);
      setMessage(t(lang, "comv.assigned_ok", "Assigned. The next user now sees this leg in their tasks."));
      setNextUserId("");
    } catch (err: any) {
      setMessage(err?.message || t(lang, "comv.assign_failed", "Could not assign this leg."));
    } finally {
      setBusy(false);
    }
  }

  const currentUserName = leg.responsibleUserId ? assignableUsers.find((u) => u.id === leg.responsibleUserId)?.name : null;

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5 space-y-1.5 dark:border-indigo-900/40 dark:bg-indigo-950/10">
      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
        {t(lang, "comv.stage_handoff", "Stage Handoff")}
      </div>
      {currentUserName ? (
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          {t(lang, "comv.currently_with", "Currently with:")} <span className="font-bold">{currentUserName}</span>
          {leg.currentTaskId ? <span className="ms-1 text-emerald-600 dark:text-emerald-400">({t(lang, "comv.task_open", "task open")})</span> : null}
        </p>
      ) : null}
      <div className="flex gap-2">
        <select value={nextUserId} onChange={(e) => setNextUserId(e.target.value)} className={`${selectClass} flex-1`}>
          <option value="">{t(lang, "comv.select_next_user", "Send to next user…")}</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!nextUserId || busy}
          onClick={handleAssign}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {t(lang, "comv.assign_send", "Assign")}
        </button>
      </div>
      {message ? <p className="text-[10px] text-slate-500 dark:text-slate-400">{message}</p> : null}
    </div>
  );
}

function Step3RouteVesselCustoms({
  lang,
  tt,
  formData,
  setFormData,
  countries,
  partySelections,
  customers,
  companies,
  customerOptions,
  companyOptions,
  orders,
  loading,
  handlePartyChange,
  updateLeg,
  addLeg,
  removeLeg,
  seedLegsForSeaWithPreCarriage,
  countryBranches,
  cityBranches,
  assignableUsers,
  editingOrderId,
  accounts = [],
  onRefreshLegs
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  tt: (k: string, f: string) => string;
  formData: FormDataState;
  setFormData: SetFormData;
  countries: CountryRow[];
  partySelections: Record<PartyRoleKey, PartySelection>;
  customers: CustomerRow[];
  companies: CompanyRow[];
  customerOptions: SearchSelectOption[];
  companyOptions: SearchSelectOption[];
  orders: ClearingCustomerOrderRow[];
  loading: boolean;
  handlePartyChange: (roleKey: PartyRoleKey, next: PartySelection) => void;
  updateLeg: (index: number, patch: Partial<RouteLeg>) => void;
  addLeg: (transportMode?: LegTransportMode | "") => void;
  removeLeg: (index: number) => void;
  seedLegsForSeaWithPreCarriage: () => void;
  countryBranches: { id: string; name: string; countryId: string }[];
  cityBranches: { id: string; name: string; countryBranchId: string }[];
  assignableUsers: { id: string; name: string }[];
  editingOrderId: string | null;
  accounts?: AccountRow[];
  onRefreshLegs?: () => void;
}) {
  const showAutoSeed =
    formData.transport_mode === "by_sea" && formData.loading_source !== "port_terminal" && formData.legs.length === 0;

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      <SectionHeading num={3} icon={Route} title={t(lang, "comv.step3_title", "Route, Vessel & Customs")} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <PartyRolePanel
          roleKey="importer"
          label={tt("role_importer", "Importer")}
          required
          selection={partySelections.importer}
          customers={customers}
          companies={companies}
          customerOptions={customerOptions}
          companyOptions={companyOptions}
          orders={orders}
          disabled={loading}
          lang={lang}
          onChange={(next) => handlePartyChange("importer", next)}
        />

        <PartyRolePanel
          roleKey="exporter"
          label={tt("role_exporter", "Exporter")}
          required
          selection={partySelections.exporter}
          customers={customers}
          companies={companies}
          customerOptions={customerOptions}
          companyOptions={companyOptions}
          orders={orders}
          disabled={loading}
          lang={lang}
          onChange={(next) => handlePartyChange("exporter", next)}
        />
      </div>

      <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{tt("notify_party_required", "Notify Party Required?")}</label>
          <select
            value={formData.notify_party_required ? "yes" : "no"}
            onChange={(e) => setFormData((current) => ({ ...current, notify_party_required: e.target.value === "yes" }))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="no">{tt("no_opt", "No")}</option>
            <option value="yes">{tt("yes", "Yes")}</option>
          </select>
        </div>

        {formData.notify_party_required ? (
          <PartyRolePanel
            roleKey="notify_party"
            label={tt("role_notify_party", "Notify Party")}
            selection={partySelections.notify_party}
            customers={customers}
            companies={companies}
            customerOptions={customerOptions}
            companyOptions={companyOptions}
            orders={orders}
            disabled={loading}
            lang={lang}
            onChange={(next) => handlePartyChange("notify_party", next)}
          />
        ) : null}
      </div>

      {/* Route Legs — spec point 8: ONE master shipment, multiple legs (not a new shipment per crossing) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Route className="h-4 w-4 text-blue-600" />
            {t(lang, "comv.route_legs", "Route Legs")}
          </div>
          <div className="flex gap-2">
            {showAutoSeed ? (
              <button
                type="button"
                onClick={seedLegsForSeaWithPreCarriage}
                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
              >
                {t(lang, "comv.auto_add_road_sea", "+ Auto-add Road + Sea Legs")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => addLeg(formData.transport_mode as LegTransportMode)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus className="inline h-3 w-3 mr-0.5" />
              {t(lang, "comv.add_leg", "Add Leg")}
            </button>
          </div>
        </div>

        {formData.legs.length === 0 ? (
          <p className="text-[11px] text-slate-400">{t(lang, "comv.no_legs_yet", "No route legs added yet. Add a leg for each country/mode crossing.")}</p>
        ) : (
          formData.legs.map((leg, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-700 dark:text-blue-400">{t(lang, "comv.leg_no", "Leg")} #{leg.legNo}</span>
                <button type="button" onClick={() => removeLeg(idx)} className="text-rose-500 hover:text-rose-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{t(lang, "comv.leg_from", "From Country")}</label>
                  <select
                    value={leg.fromCountryId}
                    onChange={(e) => {
                      const row = countries.find((c) => c.id === e.target.value);
                      updateLeg(idx, { fromCountryId: e.target.value, fromCountryName: row?.name || "" });
                    }}
                    className={selectClass}
                  >
                    <option value="">-</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder={t(lang, "comv.leg_from_location_ph", "From location / port / border")}
                    value={leg.fromLocationText}
                    onChange={(e) => updateLeg(idx, { fromLocationText: e.target.value })}
                    className={`mt-1.5 ${inputClass}`}
                  />
                  <div className="mt-1.5">
                    <LocationPicker
                      countryId={leg.fromCountryId}
                      transportMode={leg.transportMode}
                      value={leg.fromLocationId}
                      onChange={(id, nm) => updateLeg(idx, { fromLocationId: id, fromLocationText: nm || leg.fromLocationText })}
                      label={t(lang, "comv.leg_from_location_master", "From Location (Master)")}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{t(lang, "comv.leg_to", "To Country")}</label>
                  <select
                    value={leg.toCountryId}
                    onChange={(e) => {
                      const row = countries.find((c) => c.id === e.target.value);
                      updateLeg(idx, { toCountryId: e.target.value, toCountryName: row?.name || "" });
                    }}
                    className={selectClass}
                  >
                    <option value="">-</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder={t(lang, "comv.leg_to_location_ph", "To location / port / border")}
                    value={leg.toLocationText}
                    onChange={(e) => updateLeg(idx, { toLocationText: e.target.value })}
                    className={`mt-1.5 ${inputClass}`}
                  />
                  <div className="mt-1.5">
                    <LocationPicker
                      countryId={leg.toCountryId}
                      transportMode={leg.transportMode}
                      value={leg.toLocationId}
                      onChange={(id, nm) => updateLeg(idx, { toLocationId: id, toLocationText: nm || leg.toLocationText })}
                      label={t(lang, "comv.leg_to_location_master", "To Location (Master)")}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{t(lang, "comv.leg_transport_mode", "Leg Transport Mode")}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["by_sea", "by_road", "by_air", "by_rail"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateLeg(idx, { transportMode: mode })}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
                        leg.transportMode === mode
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300"
                          : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {mode === "by_sea" ? tt("tm_by_sea", "Sea") : mode === "by_road" ? tt("tm_by_road", "Road") : mode === "by_air" ? tt("tm_by_air", "Air") : t(lang, "comv.tm_by_rail", "Rail")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Route Leg Handler: Our Branch vs External Partner */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                      {tt("leg_handler_type_label", "Route Leg Handler")}
                    </span>
                  </div>
                  <div className="flex items-center rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => updateLeg(idx, { handlerType: "our_branch" })}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                        leg.handlerType !== "external_partner"
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      {tt("handler_our_branch", "Our Branch")}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLeg(idx, { handlerType: "external_partner" })}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                        leg.handlerType === "external_partner"
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      {tt("handler_external_partner", "External Partner")}
                    </button>
                  </div>
                </div>

                {leg.handlerType === "external_partner" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">
                          {tt("partner_type_label", "Partner Type *")}
                        </label>
                        <select
                          value={leg.partnerType || ""}
                          onChange={(e) => updateLeg(idx, { partnerType: e.target.value })}
                          className={selectClass}
                        >
                          <option value="">-- Select Partner Type --</option>
                          <option value="customs_agent">{tt("pt_customs_agent", "Customs Clearing Agent")}</option>
                          <option value="transporter">{tt("pt_transporter", "Transporter / Trucking Carrier")}</option>
                          <option value="shipping_provider">{tt("pt_shipping_provider", "Shipping Line / Sea Provider")}</option>
                          <option value="airline">{tt("pt_airline", "Airline / Air Freight")}</option>
                          <option value="railway">{tt("pt_railway", "Railway Operator")}</option>
                          <option value="other_partner">{tt("pt_other_partner", "Other External Partner")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">
                          {tt("partner_name_label", "Partner / Provider Name *")}
                        </label>
                        <input
                          type="text"
                          placeholder={tt("ph_partner_name", "e.g. Khyber Afghan Trans / Apex Customs")}
                          value={leg.partnerName || ""}
                          onChange={(e) => updateLeg(idx, { partnerName: e.target.value })}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">
                          {tt("partner_country_label", "Country of Service")}
                        </label>
                        <select
                          value={leg.partnerCountryName || ""}
                          onChange={(e) => updateLeg(idx, { partnerCountryName: e.target.value })}
                          className={selectClass}
                        >
                          <option value="">-- Select Country --</option>
                          {countries.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Account Master Ledger Selection & Warning */}
                    <div className="rounded-lg bg-indigo-50/40 p-2.5 border border-indigo-100 dark:bg-slate-850 dark:border-indigo-900/40 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase">
                          {tt("provider_account_master", "Provider Account / Ledger (Account Master) *")}
                        </label>
                        <a
                          href="/dashboard/accounts/setup"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline"
                        >
                          <span>{tt("register_in_account_master", "Register / Open Account Master →")}</span>
                        </a>
                      </div>

                      <select
                        value={leg.partnerAccountId || ""}
                        onChange={(e) => {
                          const row = accounts.find((l) => l.id === e.target.value);
                          updateLeg(idx, {
                            partnerAccountId: e.target.value,
                            partnerAccountNumber: row?.code || ""
                          });
                        }}
                        className={selectClass}
                      >
                        <option value="">{tt("select_account_master_ledger", "-- Select Existing Provider Ledger --")}</option>
                        {accounts.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code ? `[${l.code}] ` : ""}{l.name} {l.currency ? `(${l.currency})` : ""}
                          </option>
                        ))}
                      </select>

                      {!leg.partnerAccountId && (
                        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                          <div>
                            <p className="font-bold">{tt("no_ledger_warning_title", "No Account Master Ledger Selected")}</p>
                            <p className="mt-0.5">
                              {tt(
                                "no_ledger_warning_body",
                                "An authorized payable ledger from Account Master is required before any bills can be approved or posted to Roznamcha. Do not invent fake ledgers; register the provider through the approved Account Master flow."
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* External Partner Bills & Postings Sub-Panel */}
                    <CustomerOrderPartnerBillsPanel
                      orderId={editingOrderId || undefined}
                      orderNo={formData.order_no}
                      legId={leg.id}
                      legNo={leg.legNo}
                      handlerType={leg.handlerType}
                      partnerType={leg.partnerType}
                      partnerName={leg.partnerName}
                      partnerAccountId={leg.partnerAccountId}
                      partnerAccountNumber={leg.partnerAccountNumber}
                      partnerCountryName={leg.partnerCountryName}
                      ledgers={accounts.map((a: AccountRow) => ({ id: a.id, name: a.name, code: a.code, currency: a.currency || undefined }))}
                      lang={lang}
                      onRefreshLegs={onRefreshLegs}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ClearingAgentPicker
                      label={t(lang, "comv.responsible_agent", "Responsible Clearing Agent")}
                      value={leg.responsibleClearingAgentId}
                      onValueChange={(id) => updateLeg(idx, { responsibleClearingAgentId: id })}
                    />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <LegPartyMini
                        label={t(lang, "comv.responsible_country_branch", "Responsible Branch")}
                        value={leg.responsibleCountryBranchId}
                        rows={countryBranches}
                        onChange={(id) => updateLeg(idx, { responsibleCountryBranchId: id, responsibleCityBranchId: "" })}
                      />
                      <LegPartyMini
                        label={t(lang, "comv.responsible_city_branch", "Responsible City Branch")}
                        value={leg.responsibleCityBranchId}
                        rows={cityBranches.filter((b) => !leg.responsibleCountryBranchId || b.countryBranchId === leg.responsibleCountryBranchId)}
                        onChange={(id) => updateLeg(idx, { responsibleCityBranchId: id })}
                      />
                      <LegPartyMini
                        label={t(lang, "comv.responsible_user", "Responsible User")}
                        value={leg.responsibleUserId}
                        rows={assignableUsers}
                        onChange={(id) => updateLeg(idx, { responsibleUserId: id })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {leg.id && editingOrderId ? (
                <ShippingLegHandoffAction
                  lang={lang}
                  leg={leg}
                  assignableUsers={assignableUsers}
                  onAssigned={(taskId: string, userId: string) => updateLeg(idx, { currentTaskId: taskId, responsibleUserId: userId })}
                />
              ) : (
                <p className="text-[10px] italic text-slate-400">
                  {t(lang, "comv.save_to_assign", "Save the order once to enable stage handoff/assignment for this leg.")}
                </p>
              )}

              {leg.transportMode === "by_road" ? (
                <TruckEntryPicker
                  langProp={lang}
                  disabled={loading}
                  value={{
                    truck_registration_type: (leg.truckRegistrationType || "registered") as "registered" | "temporary",
                    truck_id: leg.truckId,
                    truck_number: leg.truckNumber,
                    truck_driver_name: leg.truckDriverName,
                    truck_driver_mobile: leg.truckDriverMobile,
                    truck_owner_name: "",
                    truck_transport_company: ""
                  }}
                  onChange={(next: TruckEntryValue) =>
                    updateLeg(idx, {
                      truckRegistrationType: next.truck_registration_type,
                      truckId: next.truck_id,
                      truckNumber: next.truck_number,
                      truckDriverName: next.truck_driver_name,
                      truckDriverMobile: next.truck_driver_mobile
                    })
                  }
                />
              ) : null}

              {/* Cross-border road move — a real registered truck (not a one-time temporary
                  entry) is required once the leg actually crosses a country border. */}
              {leg.transportMode === "by_road" &&
              leg.fromCountryId &&
              leg.toCountryId &&
              leg.fromCountryId !== leg.toCountryId &&
              leg.truckRegistrationType === "temporary" ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  {t(
                    lang,
                    "comv.cross_border_truck_warning",
                    "This leg crosses a country border — use a registered truck from the Truck Master, not a temporary one-time entry."
                  )}
                </p>
              ) : null}

              {/* Vessel/Sea details — spec point 9: never forced onto a non-sea leg */}
              {leg.transportMode === "by_sea" ? (
                <div className="space-y-2 rounded-lg border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <ShippingLinePicker
                    label={t(lang, "comv.shipping_line", "Shipping Line")}
                    value={leg.shippingLineId}
                    onValueChange={(id) => updateLeg(idx, { shippingLineId: id })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder={t(lang, "comv.vessel_name", "Vessel Name")} value={leg.vesselName} onChange={(e) => updateLeg(idx, { vesselName: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.voyage_number", "Voyage No.")} value={leg.voyageNumber} onChange={(e) => updateLeg(idx, { voyageNumber: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.container_number", "Container No.")} value={leg.containerNumber} onChange={(e) => updateLeg(idx, { containerNumber: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.seal_number", "Seal No.")} value={leg.sealNumber} onChange={(e) => updateLeg(idx, { sealNumber: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.bl_number", "B/L Number")} value={leg.blNumber} onChange={(e) => updateLeg(idx, { blNumber: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.port_of_loading", "Port of Loading")} value={leg.portOfLoading} onChange={(e) => updateLeg(idx, { portOfLoading: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.port_of_discharge", "Port of Discharge")} value={leg.portOfDischarge} onChange={(e) => updateLeg(idx, { portOfDischarge: e.target.value })} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.etd", "ETD")}</label>
                      <input type="date" value={leg.etd} onChange={(e) => updateLeg(idx, { etd: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.eta", "ETA")}</label>
                      <input type="date" value={leg.eta} onChange={(e) => updateLeg(idx, { eta: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Air details — Dynamic Location & Route Management, By Air mode */}
              {leg.transportMode === "by_air" ? (
                <div className="space-y-2 rounded-lg border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder={t(lang, "comv.airline_name", "Airline")} value={leg.airlineName} onChange={(e) => updateLeg(idx, { airlineName: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.flight_number", "Flight Number")} value={leg.flightNumber} onChange={(e) => updateLeg(idx, { flightNumber: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.airway_bill_no", "Airway Bill No.")} value={leg.airwayBillNo} onChange={(e) => updateLeg(idx, { airwayBillNo: e.target.value })} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.etd", "ETD")}</label>
                      <input type="date" value={leg.etd} onChange={(e) => updateLeg(idx, { etd: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.eta", "ETA")}</label>
                      <input type="date" value={leg.eta} onChange={(e) => updateLeg(idx, { eta: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Railway details — Dynamic Location & Route Management, By Train mode */}
              {leg.transportMode === "by_rail" ? (
                <div className="space-y-2 rounded-lg border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder={t(lang, "comv.railway_operator", "Railway Operator")} value={leg.railwayOperator} onChange={(e) => updateLeg(idx, { railwayOperator: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.wagon_number", "Wagon Number")} value={leg.wagonNumber} onChange={(e) => updateLeg(idx, { wagonNumber: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.rail_container_number", "Container Number")} value={leg.railContainerNumber} onChange={(e) => updateLeg(idx, { railContainerNumber: e.target.value })} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.etd", "ETD")}</label>
                      <input type="date" value={leg.etd} onChange={(e) => updateLeg(idx, { etd: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.eta", "ETA")}</label>
                      <input type="date" value={leg.eta} onChange={(e) => updateLeg(idx, { eta: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Customs — spec point 10 */}
              <div className="space-y-2 rounded-lg border border-amber-100 bg-amber-50/40 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/10">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">{t(lang, "comv.customs", "Customs")}</div>
                <div className="grid grid-cols-2 gap-2">
                  <LegPartyMini
                    label={t(lang, "comv.customs_country", "Customs Country")}
                    value={leg.customsCountryId}
                    rows={countries.map((c) => ({ id: c.id, name: c.name }))}
                    onChange={(id) => updateLeg(idx, { customsCountryId: id })}
                  />
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{t(lang, "comv.customs_point", "Port / Border / Customs Point")}</label>
                    <input type="text" value={leg.customsPointText} onChange={(e) => updateLeg(idx, { customsPointText: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <ClearingAgentPicker
                  label={t(lang, "comv.customs_clearing_agent", "Clearing Agent")}
                  value={leg.customsClearingAgentId}
                  onValueChange={(id) => updateLeg(idx, { customsClearingAgentId: id })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{t(lang, "comv.clearance_type", "Clearance Type")}</label>
                    <select value={leg.clearanceType} onChange={(e) => updateLeg(idx, { clearanceType: e.target.value as ClearanceType })} className={selectClass}>
                      <option value="">-</option>
                      <option value="import">{tt("mv_import", "Import")}</option>
                      <option value="export">{tt("mv_export", "Export")}</option>
                      <option value="transit">{t(lang, "comv.mv_transit", "Transit")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{t(lang, "comv.duty_treatment", "Duty Treatment")}</label>
                    <select value={leg.dutyTreatment} onChange={(e) => updateLeg(idx, { dutyTreatment: e.target.value as DutyTreatment })} className={selectClass}>
                      <option value="">-</option>
                      <option value="duty_payable">{t(lang, "comv.duty_payable", "Duty Payable")}</option>
                      <option value="no_duty_exempt">{t(lang, "comv.duty_exempt", "No Duty / Exempt")}</option>
                      <option value="transit_bonded">{t(lang, "comv.duty_transit_bonded", "Transit / Bonded")}</option>
                      <option value="pending">{t(lang, "comv.duty_pending", "Pending")}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.customs_status", "Customs Status")}</label>
                    <select value={leg.customsStatus} onChange={(e) => updateLeg(idx, { customsStatus: e.target.value as LegCustomsStatus })} className={selectClass}>
                      {(["not_applicable", "pending", "submitted", "cleared", "held", "rejected"] as const).map((s) => (
                        <option key={s} value={s}>{t(lang, ("comv.customsstatus_" + s) as never, s.replace(/_/g, " "))}</option>
                      ))}
                    </select>
                  </div>
                  {leg.id ? (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.customs_documents", "Customs Documents")}</label>
                      <DocumentAttachmentIcon entityType="clearing_customer_order_leg" entityId={leg.id} />
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input type="text" placeholder={t(lang, "comv.bill_of_entry_no", "Bill of Entry No.")} value={leg.billOfEntryNo} onChange={(e) => updateLeg(idx, { billOfEntryNo: e.target.value })} className={inputClass} />
                  <input type="text" placeholder={t(lang, "comv.pgm_number", "PGM Number")} value={leg.pgmNumber} onChange={(e) => updateLeg(idx, { pgmNumber: e.target.value })} className={inputClass} />
                  <input type="text" placeholder={t(lang, "comv.declaration_reference", "Declaration / Reference No.")} value={leg.declarationReference} onChange={(e) => updateLeg(idx, { declarationReference: e.target.value })} className={inputClass} />
                </div>

                {leg.dutyTreatment === "duty_payable" ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <input type="number" placeholder={t(lang, "comv.duty_amount", "Duty Amount")} value={leg.dutyAmount} onChange={(e) => updateLeg(idx, { dutyAmount: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.duty_currency", "Currency")} value={leg.dutyCurrency} onChange={(e) => updateLeg(idx, { dutyCurrency: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.duty_payer", "Payer")} value={leg.dutyPayer} onChange={(e) => updateLeg(idx, { dutyPayer: e.target.value })} className={inputClass} />
                    <input type="number" placeholder={t(lang, "comv.tax_amount", "Tax Amount")} value={leg.taxAmount} onChange={(e) => updateLeg(idx, { taxAmount: e.target.value })} className={inputClass} />
                    <input type="number" placeholder={t(lang, "comv.other_charges", "Other Charges")} value={leg.otherCharges} onChange={(e) => updateLeg(idx, { otherCharges: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.customs_receipt_ref", "Receipt / Reference")} value={leg.customsReceiptRef} onChange={(e) => updateLeg(idx, { customsReceiptRef: e.target.value })} className={inputClass} />
                    <input type="date" value={leg.customsClearanceDate} onChange={(e) => updateLeg(idx, { customsClearanceDate: e.target.value })} className={inputClass} />
                  </div>
                ) : leg.dutyTreatment === "no_duty_exempt" || leg.dutyTreatment === "transit_bonded" ? (
                  <input
                    type="text"
                    placeholder={t(lang, "comv.supporting_reference", "Supporting reference / document")}
                    value={leg.customsReceiptRef}
                    onChange={(e) => updateLeg(idx, { customsReceiptRef: e.target.value })}
                    className={inputClass}
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.planned_departure", "Planned Departure")}</label>
                  <input type="date" value={leg.plannedDeparture} onChange={(e) => updateLeg(idx, { plannedDeparture: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.actual_departure", "Actual Departure")}</label>
                  <input type="date" value={leg.actualDeparture} onChange={(e) => updateLeg(idx, { actualDeparture: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.planned_arrival", "Planned Arrival")}</label>
                  <input type="date" value={leg.plannedArrival} onChange={(e) => updateLeg(idx, { plannedArrival: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.actual_arrival", "Actual Arrival")}</label>
                  <input type="date" value={leg.actualArrival} onChange={(e) => updateLeg(idx, { actualArrival: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-emerald-700 uppercase dark:text-emerald-400">{t(lang, "comv.estimated_expense", "Estimated Expense")}</label>
                  <input type="number" value={leg.estimatedExpenseAmount} onChange={(e) => updateLeg(idx, { estimatedExpenseAmount: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-emerald-700 uppercase dark:text-emerald-400">{t(lang, "comv.actual_expense", "Actual Expense")}</label>
                  <input type="number" value={leg.actualExpenseAmount} onChange={(e) => updateLeg(idx, { actualExpenseAmount: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-emerald-700 uppercase dark:text-emerald-400">{t(lang, "comv.expense_currency", "Currency")}</label>
                  <input type="text" value={leg.expenseCurrency} onChange={(e) => updateLeg(idx, { expenseCurrency: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.leg_status", "Leg Status")}</label>
                <select value={leg.status} onChange={(e) => updateLeg(idx, { status: e.target.value })} className={selectClass}>
                  {["pending", "pickup_assigned", "loaded", "in_transit", "arrived", "customs_pending", "cleared", "handed_over", "completed"].map((s) => (
                    <option key={s} value={s}>{t(lang, ("comv.legstatus_" + s) as never, s.replace(/_/g, " "))}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.handover_reference", "Handover Reference")}</label>
                <input
                  type="text"
                  placeholder={t(lang, "comv.handover_reference_ph", "Link to an existing handover record (optional)")}
                  value={leg.handoverId}
                  onChange={(e) => updateLeg(idx, { handoverId: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">{tt("remarks", "Remarks")}</label>
                  <VoiceDictateButton
                    context="clearing"
                    lang={lang}
                    value={leg.remarks}
                    onChange={(next) => updateLeg(idx, { remarks: next })}
                  />
                </div>
                <textarea rows={2} value={leg.remarks} onChange={(e) => updateLeg(idx, { remarks: e.target.value })} className={inputClass} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Step4ReviewConfirm({
  lang,
  tt,
  formData,
  partySelections,
  selectedCustomerInfo,
  selectedAccountInfo,
  clearingAgents,
  shippingLines,
  userContext,
  onBack,
  onGoToSubStep,
  onSaveDraft,
  onConfirmSave,
  saving
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  tt: (k: string, f: string) => string;
  formData: FormDataState;
  partySelections: Record<PartyRoleKey, PartySelection>;
  selectedCustomerInfo?: CustomerRow | null;
  selectedAccountInfo?: AccountRow | null;
  clearingAgents: ClearingAgentRow[];
  shippingLines: ShippingLineRow[];
  userContext: { context: BranchUserContext | null; loading: boolean; error: string | null };
  onBack: () => void;
  onGoToSubStep: (subStep: "1A" | "1B" | "1C") => void;
  onSaveDraft: () => void;
  onConfirmSave: () => void;
  saving: boolean;
}) {
  const ctx = userContext.context;
  const agentName = (id: string) => clearingAgents.find((a) => a.id === id)?.name || summaryValue(id);
  const lineName = (id: string) => shippingLines.find((l) => l.id === id)?.name || summaryValue(id);

  // Normalize multi-goods items
  const goodsList = useMemo(() => {
    if (Array.isArray(formData.goods_items) && formData.goods_items.length > 0) {
      return formData.goods_items;
    }
    if (formData.goods_name || formData.goods_quantity) {
      return [
        {
          goodsId: formData.goods_id || "",
          goodsName: formData.goods_name || "General Cargo",
          goodsChsCode: formData.goods_chs_code || "",
          goodsVariationId: formData.goods_variation_id || "",
          goodsVariationLabel: formData.goods_variation_label || "",
          unit: formData.goods_unit || "Bags",
          quantity: formData.goods_quantity || "0",
          kgPerQty:
            formData.goods_gross_weight && formData.goods_quantity
              ? String(Number(formData.goods_gross_weight) / Number(formData.goods_quantity))
              : "0",
          totalKg: formData.goods_gross_weight || "0",
          warehouseSourceType: "company_warehouse",
          warehouseName: formData.loading_source_name || formData.loading_source || ""
        }
      ];
    }
    return [];
  }, [formData]);

  const cargoTotals = useMemo(() => {
    let qty = 0;
    let kg = 0;
    goodsList.forEach((g) => {
      const q = parseFloat(String(g.quantity || 0)) || 0;
      const k = parseFloat(String(g.totalKg || 0)) || 0;
      qty += q;
      kg += k;
    });
    const mt = kg > 0 ? (kg / 1000).toFixed(3) : "0.000";
    return { count: goodsList.length, qty, kg, mt };
  }, [goodsList]);

  const custName =
    selectedCustomerInfo?.customer_name || partySelections.supplier.customerName || formData.customer_name || "-";
  const custCompany = selectedCustomerInfo?.company_name || partySelections.supplier.companyName || "-";
  const custPhone = selectedCustomerInfo?.mobile || selectedCustomerInfo?.whatsapp || "-";
  const custEmail = selectedCustomerInfo?.email || "-";
  const custAddress = selectedCustomerInfo?.address || partySelections.supplier.addressText || "-";
  const consigneeName =
    partySelections.buyer.customerName ||
    partySelections.consignee.customerName ||
    formData.consignee_name ||
    custName;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 animate-in fade-in duration-200 pb-16">
      {/* Top Floating / Action Bar (hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-2xl shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{tt("back_to_1c", "Back to 1C (Route & Delivery)")}</span>
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />
          <span className="text-xs font-medium text-slate-300 hidden md:inline">
            {tt("a4_instruction", "Step 4: Full A4 Document Review before confirmation")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-sm transition"
          >
            <Printer className="h-4 w-4" />
            <span>{tt("print_a4", "Print A4 Sheet")}</span>
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{t(lang, "comv.save_draft", "Save Draft")}</span>
          </button>
          <button
            type="button"
            onClick={onConfirmSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-600/30 transition"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{tt("confirm_save_order", "Confirm & Save Customer Order")}</span>
          </button>
        </div>
      </div>

      {/* Main A4 Document Preview Sheet */}
      <div
        id="customer-order-a4-sheet"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-10 space-y-6 text-slate-800 dark:text-slate-200 font-sans print:border-0 print:shadow-none print:p-0 print:m-0"
      >
        {/* Document Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 dark:border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-[11px] font-black uppercase tracking-wider text-white">
                ACCOUNTS.DGT.LLC
              </span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {tt("freight_forwarding_tagline", "Freight Forwarding & Customs Clearing")}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              {tt("order_spec_review_title", "Customer Order Specification & Review")}
            </h1>
            <p className="text-xs text-slate-500">
              {tt("official_shipment_manifest", "Official shipment order manifest")} • {tt("movement_colon", "Movement:")}{" "}
              <strong className="uppercase text-slate-800 dark:text-slate-200">
                {formData.movement_type || "IMPORT"}
              </strong>{" "}
              • {tt("mode_colon", "Mode:")}{" "}
              <strong className="uppercase text-slate-800 dark:text-slate-200">
                {formData.transport_mode?.replace("_", " ") || "BY ROAD"}
              </strong>{" "}
              • {tt("type_colon", "Type:")}{" "}
              <strong className="uppercase text-slate-800 dark:text-slate-200">
                {formData.shipment_type || "FCL"}
              </strong>
            </p>
          </div>

          <div className="text-right space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {formData.status ? formData.status.toUpperCase() : "PENDING CONFIRMATION"}
            </div>
            <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
              {formData.order_no || formData.global_serial || "AUTO-GENERATED"}
            </div>
            <div className="text-[10px] text-slate-400">
              {formData.order_date || new Date().toISOString().split("T")[0]} {formData.order_time || ""}
            </div>
          </div>
        </div>

        {/* References & Serials Strip */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            {t(lang, "comv.review_references", "System Serials & Timestamps")}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-semibold text-slate-500 block">{tt("entry_serial", "Entry Serial")}</span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">
                {formData.entry_serial || "-"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 block">{tt("global_serial_bill", "Global Serial / Bill")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                {formData.global_serial || formData.order_no || "-"}
              </span>
            </div>
            {canSeeSerial("country", ctx) && (
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block">{tt("country_serial", "Country Serial")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {formData.country_serial || "-"}
                </span>
              </div>
            )}
            {canSeeSerial("branch", ctx) && (
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block">{tt("branch_serial", "Branch Serial")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {formData.branch_serial || "-"}
                </span>
              </div>
            )}
            {canSeeSerial("super", ctx) && (
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block">{tt("super_admin_serial", "Super Admin Serial")}</span>
                <span className="font-mono font-bold text-purple-700 dark:text-purple-400 text-sm">
                  {formData.super_admin_serial || "-"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Customer Profile vs Consignee / Delivery (2 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer & Billing Box */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80 shadow-xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{tt("section_customer_billing_profile", "1A. Customer & Billing Profile")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToSubStep("1A")}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline print:hidden"
                >
                  {tt("edit_1a", "Edit 1A")}
                </button>
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white">{custName}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">{tt("field_company", "Company")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{custCompany}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{tt("account_ref", "Account Ref")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedAccountInfo?.name
                      ? `${selectedAccountInfo.name} (${selectedAccountInfo.code || ""})`
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{tt("phone_mobile", "Phone / Mobile")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{custPhone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{tt("field_email", "Email")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">{custEmail}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block">{tt("registered_address", "Registered Address")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{custAddress}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Consignee & Destination Box */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80 shadow-xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{tt("consignee_shipping_destination", "Consignee & Shipping Destination")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToSubStep("1C")}
                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline print:hidden"
                >
                  {tt("edit_1c", "Edit 1C")}
                </button>
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white">{consigneeName}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">{tt("movement_type_field", "Movement Type")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                    {formData.movement_type || "Import"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{tt("transport_mode_field", "Transport Mode")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                    {formData.transport_mode?.replace("_", " ") || "By Road"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block">{tt("final_delivery_destination", "Final Delivery Destination")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formData.final_delivery_location ||
                      formData.destination_city ||
                      formData.receiving_country_name ||
                      "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{tt("buyer_name", "Buyer Name")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {partySelections.buyer.customerName || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{tt("notify_party_field", "Notify Party")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {partySelections.notify_party.customerName || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Logistics Route, Ports & Operational Dates */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Route className="h-3.5 w-3.5 text-blue-600" />
              <span>{tt("section_route_schedule", "1C. Dynamic Route & Operational Schedule")}</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToSubStep("1C")}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline print:hidden"
            >
              {tt("edit_1c", "Edit 1C")}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">{tt("pickup_source_field", "Pickup Source")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                {formData.loading_source_name || formData.loading_source || "-"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">{tt("origin_loading_field", "Origin Loading")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                {formData.loading_country_name || "-"}{" "}
                {formData.loading_port_name ? `(${formData.loading_port_name})` : ""}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                {tt("destination_port_border", "Destination Port / Border")}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                {formData.destination_port_name ||
                  formData.entry_border_port_name ||
                  formData.destination_airport_name ||
                  "-"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                {tt("final_destination_country_field", "Final Destination Country")}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                {formData.receiving_country_name || "-"}
              </span>
            </div>
          </div>

          {/* Operational Milestones (Planned vs Actual) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-xs">
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/40 dark:bg-slate-800/30">
              <span className="text-[9.5px] text-slate-400 block uppercase">{tt("planned_pickup_badge", "Planned Pickup")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formData.planned_pickup_date || "-"}
              </span>
            </div>
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/40 dark:bg-slate-800/30">
              <span className="text-[9.5px] text-slate-400 block uppercase">{tt("actual_pickup_badge", "Actual Pickup")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formData.actual_pickup_date || "-"}
              </span>
            </div>
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/40 dark:bg-slate-800/30">
              <span className="text-[9.5px] text-slate-400 block uppercase">{tt("planned_dispatch_badge", "Planned Dispatch")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formData.planned_dispatch_date || "-"}
              </span>
            </div>
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/40 dark:bg-slate-800/30">
              <span className="text-[9.5px] text-slate-400 block uppercase">{tt("actual_dispatch_badge", "Actual Dispatch")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formData.actual_dispatch_date || "-"}
              </span>
            </div>
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/40 dark:bg-slate-800/30">
              <span className="text-[9.5px] text-slate-400 block uppercase">{tt("planned_arrival_badge", "Planned Arrival")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formData.planned_arrival_date || "-"}
              </span>
            </div>
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/40 dark:bg-slate-800/30">
              <span className="text-[9.5px] text-slate-400 block uppercase">{tt("actual_arrival_badge", "Actual Arrival")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formData.actual_arrival_date || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Vehicle & Driver Assignment */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Truck className="h-3.5 w-3.5 text-blue-600" />
              <span>{tt("section_vehicle_driver", "1B. Assigned Vehicle & Driver Details")}</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToSubStep("1B")}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline print:hidden"
            >
              {tt("edit_1b", "Edit 1B")}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">{tt("assignment_mode_field", "Assignment Mode")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formData.truck_assignment_mode === "permanent"
                  ? tt("permanent_fleet_value", "Permanent Fleet")
                  : formData.truck_assignment_mode === "hired"
                  ? tt("hired_external_truck_value", "Hired / External Truck")
                  : tt("assign_later_value", "Assign Later")}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">{tt("truck_vehicle_plate", "Truck / Vehicle Plate")}</span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">
                {formData.truck_number || tt("not_assigned_value", "Not Assigned")}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">{tt("driver_name_field", "Driver Name")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formData.truck_driver_name || "-"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">{tt("driver_mobile_field", "Driver Mobile")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formData.truck_driver_mobile || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Comprehensive Goods & Cargo Manifest Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900/80 shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <Boxes className="h-3.5 w-3.5 text-blue-600" />
              <span>{tt("goods_manifest_breakdown_count", "Goods & Cargo Manifest Breakdown ({n})").replace("{n}", String(cargoTotals.count))}</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToSubStep("1B")}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline print:hidden"
            >
              {tt("edit_goods_1b", "Edit Goods (1B)")}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">{tt("goods_description_th", "Goods Description")}</th>
                  <th className="py-2.5 px-3">{tt("chs_code", "CHS Code")}</th>
                  <th className="py-2.5 px-3">{tt("packaging_unit_th", "Packaging / Unit")}</th>
                  <th className="py-2.5 px-3 text-right">{tt("quantity", "Quantity")}</th>
                  <th className="py-2.5 px-3 text-right">{tt("kg_per_unit_th", "KG / Unit")}</th>
                  <th className="py-2.5 px-3 text-right">{tt("total_kg", "Total KG")}</th>
                  <th className="py-2.5 px-3 text-right">{tt("total_mt", "Total MT")}</th>
                  <th className="py-2.5 px-3">{tt("warehouse_source", "Warehouse Source")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {goodsList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-slate-400">
                      {tt("no_cargo_items", "No cargo items added.")}
                    </td>
                  </tr>
                ) : (
                  goodsList.map((item, idx) => {
                    const q = parseFloat(String(item.quantity || 0)) || 0;
                    const kg = parseFloat(String(item.totalKg || 0)) || 0;
                    const kgPer =
                      parseFloat(String(item.kgPerQty || 0)) || (q > 0 ? kg / q : 0);
                    const mt = kg > 0 ? (kg / 1000).toFixed(3) : "0.000";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {item.goodsName || tt("general_cargo_fallback", "General Cargo")}
                          </span>
                          {item.goodsVariationLabel ? (
                            <span className="text-[10px] text-slate-400 block">{item.goodsVariationLabel}</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {item.goodsChsCode || "-"}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                          {item.unit || "Bags"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {q.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                          {kgPer.toFixed(1)} kg
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-400">
                          {kg.toLocaleString()} kg
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {mt} MT
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {item.warehouseName || formData.loading_source_name || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-900 bg-slate-100/70 font-bold dark:border-slate-700 dark:bg-slate-800/80">
                <tr>
                  <td
                    colSpan={4}
                    className="py-3 px-3 uppercase text-[11px] tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    {tt("grand_manifest_totals", "Grand Manifest Totals ({n} items)").replace("{n}", String(cargoTotals.count))}
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-slate-900 dark:text-white">
                    {cargoTotals.qty.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-400 text-xs">-</td>
                  <td className="py-3 px-3 text-right text-sm text-blue-700 dark:text-blue-400">
                    {cargoTotals.kg.toLocaleString()} kg
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-emerald-700 dark:text-emerald-400">
                    {cargoTotals.mt} MT
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-400">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 5: Route Legs (if any) */}
        {formData.legs && formData.legs.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {tt("multi_leg_transit_route_count", "Multi-Leg Transit Route ({n})").replace("{n}", String(formData.legs.length))}
              </div>
              <button
                type="button"
                onClick={() => onGoToSubStep("1C")}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline print:hidden"
              >
                {tt("edit_legs_1c", "Edit Legs (1C)")}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {formData.legs.map((leg, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40 space-y-1"
                >
                  <div className="font-black text-blue-700 dark:text-blue-400">
                    {tt("leg_hash", "Leg #{n}:").replace("{n}", String(leg.legNo))} {summaryValue(leg.fromCountryName || leg.fromLocationText)} →{" "}
                    {summaryValue(leg.toCountryName || leg.toLocationText)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {tt("mode_colon", "Mode:")} <strong className="uppercase">{leg.transportMode || "-"}</strong> • {tt("agent_colon", "Agent:")}{" "}
                    <strong>
                      {leg.responsibleClearingAgentId ? agentName(leg.responsibleClearingAgentId) : "-"}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Section 6: Special Remarks & Instructions */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80 shadow-xs space-y-1">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {tt("special_instructions_logistics", "Special Instructions & Logistics Remarks")}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
            {formData.remarks ||
              tt("no_special_instructions_full", "No special instructions noted. All standard customs clearing, tariff verification, and road transit safety protocols apply.")}
          </p>
        </div>

        {/* Section 7: Official Signatures & Verification (Formatted for A4 Print) */}
        <div className="pt-6 border-t-2 border-slate-900 dark:border-slate-100">
          <div className="grid grid-cols-3 gap-6 text-center text-xs">
            <div className="space-y-8">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {tt("prepared_by_operator", "Prepared By (Operator / Agent)")}
              </span>
              <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                {tt("signature_date", "Signature & Date")}
              </span>
            </div>

            <div className="space-y-8">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {tt("fleet_driver_acceptance", "Fleet / Driver Acceptance")}
              </span>
              <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                {tt("driver_signature_vehicle_stamp", "Driver Signature & Vehicle Stamp")}
              </span>
            </div>

            <div className="space-y-8">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {tt("customer_authorized_consignee", "Customer / Authorized Consignee")}
              </span>
              <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                {tt("official_seal_acceptance", "Official Seal & Acceptance")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar (hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{tt("back_to_1c", "Back to 1C (Route & Delivery)")}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 transition"
          >
            <Printer className="h-4 w-4" />
            <span>{tt("print_a4", "Print A4 Sheet")}</span>
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 transition"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{t(lang, "comv.save_draft", "Save Draft")}</span>
          </button>
          <button
            type="button"
            onClick={onConfirmSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{tt("confirm_save_order", "Confirm & Save Customer Order")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
