"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
  Train
} from "lucide-react";

import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Th } from "@/components/ui/translated-th";
import { SmartSearchFilter, type SmartFilterState } from "@/components/ui/smart-search-filter";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { ClearingCustomerOrderRow, PartyLinkInput, PartyRoleKey } from "@/lib/services/clearing-customer-order-service";
import { TruckEntryPicker, type TruckEntryValue } from "@/features/clearing-agent/components/truck-entry-picker";
import { GoodsPicker, type GoodsPickerValue } from "@/features/goods-master/components/goods-picker";
import { WarehousePicker } from "@/features/warehouses/components/warehouse-picker";
import { ClearingAgentPicker } from "@/features/shipping/components/clearing-agent-picker";
import { ShippingLinePicker } from "@/features/shipping/components/shipping-line-picker";
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

type RouteLeg = {
  id?: string;
  legNo: number;
  fromCountryId: string;
  fromCountryName: string;
  toCountryId: string;
  toCountryName: string;
  fromLocationText: string;
  toLocationText: string;
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
};

function emptyLeg(legNo: number, transportMode: LegTransportMode | "" = ""): RouteLeg {
  return {
    legNo, fromCountryId: "", fromCountryName: "", toCountryId: "", toCountryName: "",
    fromLocationText: "", toLocationText: "", transportMode,
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
    estimatedExpenseAmount: "", actualExpenseAmount: "", expenseCurrency: "", currentTaskId: null
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
  unit: string;
  quantity: string;
  kgPerQty: string;
  totalKg: string;
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
    unit: "Bags",
    quantity: "1",
    kgPerQty: "50",
    totalKg: "50",
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
  loading_area_id: "",
  receiving_country_id: "",
  receiving_country_name: "",
  receiving_state_province_id: "",
  receiving_district_id: "",
  receiving_city_id: "",
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

  if (hasGoods && hasSupplier && hasShipping && hasLogistics) {
    return { step: 4, labelKey: "progress_complete", label: "Complete (4/4)", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" };
  }
  if (hasGoods && hasSupplier && hasShipping) {
    return { step: 3, labelKey: "progress_step3", label: "Step 3/4 (Shipping)", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800" };
  }
  if (hasGoods && hasSupplier) {
    return { step: 2, labelKey: "progress_step2", label: "Step 2/4 (Parties)", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" };
  }
  return { step: 1, labelKey: "progress_step1", label: "Step 1/4 (Goods)", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" };
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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "true") {
        setFormData({ ...EMPTY_FORM });
        setPartySelections(emptyPartyState());
        setEditingOrderId(null);
        setCurrentStep(1);
        setStep1SubStep("1A");
        setIsFormOpen(true);
      }
    }
  }, []);

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

    // 1. Branch Scope hierarchy
    if (branchScope.cityBranchId) {
      list = list.filter((o: any) => o.city_branch_id === branchScope.cityBranchId || o.cityBranchId === branchScope.cityBranchId);
    } else if (branchScope.countryBranchId) {
      list = list.filter((o: any) => o.country_branch_id === branchScope.countryBranchId || o.countryBranchId === branchScope.countryBranchId);
    } else if (branchScope.countryId) {
      list = list.filter((o: any) => o.country_id === branchScope.countryId || o.countryId === branchScope.countryId || o.loading_country_id === branchScope.countryId);
    }

    // 2. Status filter
    if (statusFilter && statusFilter !== "all") {
      list = list.filter((o) => (o.status || "pending").toLowerCase() === statusFilter.toLowerCase());
    }

    // 3. Transport mode filter
    if (modeFilter && modeFilter !== "all") {
      list = list.filter((o) => (o.transport_mode || "").toLowerCase() === modeFilter.toLowerCase());
    }

    // 4. Movement type filter
    if (movementFilter && movementFilter !== "all") {
      list = list.filter((o) => (o.movement_type || "").toLowerCase() === movementFilter.toLowerCase());
    }

    // 5. Search query
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
  }, [orders, branchScope, statusFilter, modeFilter, movementFilter, searchQuery, filterState]);

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
    setStep1SubStep("1A");
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
              unit: row.unit || order.goods_unit || "Bags",
              quantity: q,
              kgPerQty: k,
              totalKg: tot,
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
      truck_assignment_mode: (o.truck_id ? "permanent" : o.truck_number === "TO BE ASSIGNED" ? "later" : o.truck_number ? "hired" : "permanent") as any,
      truck_registration_type: (o.truck_registration_type as "registered" | "temporary") || "registered",
      truck_id: o.truck_id || "",
      truck_number: o.truck_number || "",
      truck_driver_name: o.truck_driver_name || "",
      truck_driver_mobile: o.truck_driver_mobile || "",
      truck_owner_name: o.truck_owner_name || "",
      truck_transport_company: o.truck_transport_company || "",
      truck_po_ref: o.truck_po_ref || "",
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
            currentTaskId: leg.current_task_id || null
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
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
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
              expenseCurrency: leg.expenseCurrency || null
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

  const stepsList = [
    {
      num: 1,
      title: "1A: " + t(lang, "comv.step1_name", "Customer & Route"),
      desc: t(lang, "comv.step1_desc", "Account, Movement Type (Import/Export/Transit) & Route")
    },
    {
      num: 2,
      title: "1B: " + t(lang, "comv.step2_name", "Truck & Transport"),
      desc: t(lang, "comv.step2_desc", "Fleet Assignment & Driver Details")
    },
    {
      num: 3,
      title: "1C: " + t(lang, "comv.step3_name", "Goods & Warehouse"),
      desc: t(lang, "comv.step3_desc", "Apna / Other Warehouse & Goods Manifest")
    },
    {
      num: 4,
      title: t(lang, "comv.step4_name", "Review, Shipping & Customs"),
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
          customerPartyName={justCompletedOrder.customerName}
          onSuccess={() => { setHandoffModalOpen(false); setJustCompletedOrder(null); resetForm(); }}
          lang={lang}
        />
      ) : null}

      {!isFormOpen ? (
        /* ========================================================================= */
        /* MODE 1: ENTERPRISE CUSTOMER ORDERS REGISTRY (MAIN SCREEN TABLE VIEW)      */
        /* ========================================================================= */
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Action Bar */}
          <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/50 dark:border-blue-900 dark:text-blue-400">
                  <Route className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                      {tt("registry_title", "Customer Orders Registry")}
                    </h1>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                      {orders.length} {tt("orders_badge", "Orders")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tt("registry_subtitle", "Enterprise multi-branch shipping and customer orders management")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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

          {/* 6 Top KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Total Orders */}
            <div className="rounded-xl border border-blue-100 bg-white p-3.5 dark:border-blue-900/40 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_total_orders", "Total Orders")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"><FileText className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">{orderCounts.total}</div>
              <div className="mt-1 flex items-center gap-1 text-[9.5px] font-semibold text-slate-500">
                <span>Draft: {orderCounts.draft}</span>
                <span>•</span>
                <span className="text-amber-600">Active: {orderCounts.confirmed}</span>
                <span>•</span>
                <span className="text-emerald-600">Done: {orderCounts.cleared}</span>
              </div>
            </div>

            {/* 2. Movements */}
            <div className="rounded-xl border border-purple-100 bg-white p-3.5 dark:border-purple-900/40 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_movements", "Movements")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"><Route className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xl font-black text-purple-600 dark:text-purple-400">{orderCounts.total}</div>
              <div className="mt-1 flex items-center gap-1 text-[9.5px] font-semibold text-slate-500">
                <span className="text-emerald-600">Imp: {orderCounts.import}</span>
                <span>•</span>
                <span className="text-purple-600">Exp: {orderCounts.export}</span>
                <span>•</span>
                <span className="text-amber-600">Tr: {orderCounts.transit}</span>
              </div>
            </div>

            {/* 3. Locations & Ports */}
            <div className="rounded-xl border border-sky-100 bg-white p-3.5 dark:border-sky-900/40 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_locations", "Locations & Ports")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400"><Anchor className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">{countries.length} <span className="text-xs font-normal text-slate-400">{tt("countries", "Countries")}</span></div>
              <div className="mt-1 text-[9.5px] font-semibold text-slate-500">{ports.length} {tt("active_ports", "Active Ports")}</div>
            </div>

            {/* 4. Total Volume */}
            <div className="rounded-xl border border-indigo-100 bg-white p-3.5 dark:border-indigo-900/40 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_total_volume", "Total Volume")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"><Scale className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xl font-black text-indigo-600 dark:text-indigo-400">{orderCounts.totalVolume.toLocaleString()} <span className="text-xs font-normal text-slate-400">MT</span></div>
              <div className="mt-1 text-[9.5px] font-semibold text-slate-500">{tt("combined_cargo", "Combined Cargo")}</div>
            </div>

            {/* 5. Active Routes */}
            <div className="rounded-xl border border-emerald-100 bg-white p-3.5 dark:border-emerald-900/40 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_active_routes", "Active Routes")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"><Globe2 className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">{orderCounts.uniqueRoutes}</div>
              <div className="mt-1 text-[9.5px] font-semibold text-slate-500">{tt("cross_border_routes", "Cross-Border Routes")}</div>
            </div>

            {/* 6. Quick Info */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_quick_info", "Quick Info")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"><BadgeInfo className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xs font-black text-slate-800 dark:text-slate-200 truncate">{userContext.context?.branchName || tt("global_group", "Global Group")}</div>
              <div className="mt-1 text-[9.5px] font-medium text-slate-500">{tt("shipping_clearing_erp", "Shipping & Clearing ERP")}</div>
            </div>
          </div>

          {/* Filter Row */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tt("search_placeholder", "Search by Order No, Customer, Shipper, Goods, Port, Container...")}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">{tt("all_statuses", "All Statuses")}</option>
                  <option value="draft">{tt("status_draft", "Draft")}</option>
                  <option value="pending_approval">{tt("status_pending_approval", "Pending Approval")}</option>
                  <option value="approved">{tt("status_approved", "Approved")}</option>
                  <option value="booking_confirmed">{tt("status_confirmed", "Confirmed")}</option>
                  <option value="in_transit">{tt("status_in_transit", "In Transit")}</option>
                  <option value="completed">{tt("status_completed", "Completed")}</option>
                  <option value="rejected">{tt("status_rejected", "Rejected")}</option>
                </select>

                {/* Transport Mode Filter */}
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{tt("reset_filters", "Reset")}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Full Enterprise Customer Orders Registry Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>{tt("registry_table_title", "Customer Shipping Orders")}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500">
                {visibleOrders.length} / {orders.length} {tt("visible", "visible")}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <Th className="px-3.5 py-3">#</Th>
                    <Th className="px-3.5 py-3">{tt("th_order_no", "Order No")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_date", "Date")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_party", "Customer / Account")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_shipper", "Shipper / Exporter")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_buyer", "Buyer / Importer")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_goods", "Goods & Qty")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_route", "Route / Ports")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_movement", "Mode & Movement")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_step_status", "Status")}</Th>
                    <Th className="px-3.5 py-3">{tt("th_branch", "Branch / Agent")}</Th>
                    <Th className="px-3.5 py-3 text-right">{tt("th_actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleOrders.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
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
                      const prog = getOrderProgress(order);
                      const isSelected = editingOrderId === order.id;
                      const dateText = order.created_at ? new Date(order.created_at).toLocaleDateString() : "-";
                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-slate-50/80 transition dark:hover:bg-slate-800/50 ${
                            isSelected ? "bg-blue-50/60 dark:bg-blue-950/30 font-semibold" : ""
                          }`}
                        >
                          <td className="px-3.5 py-3 font-bold text-slate-400">{index + 1}</td>
                          <td className="px-3.5 py-3">
                            <a
                              href={`/dashboard/clearing-agent/customer-order/${order.id}/workflow`}
                              className="font-mono font-bold text-blue-600 hover:underline dark:text-blue-400"
                              title={tt("shipping_clearing_pipeline", "Shipping / Clearing pipeline — truck, goods verification, customs, handover")}
                            >
                              {order.order_no || `CL-${order.id.slice(0, 6)}`}
                            </a>
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap text-slate-500 font-medium">{dateText}</td>
                          <td className="px-3.5 py-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{order.customer_name || "-"}</div>
                            {order.customer_id ? (
                              <div className="text-[10px] text-slate-400 font-mono">ID: {order.customer_id.slice(0, 8)}</div>
                            ) : null}
                          </td>
                          <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300 font-medium">
                            {order.exporter_name || "-"}
                          </td>
                          <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300 font-medium">
                            {order.buyer_name || order.importer_name || "-"}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{order.goods_name || "-"}</div>
                            <div className="text-[10px] text-slate-500 font-bold">
                              {order.goods_quantity ? `${order.goods_quantity} ${order.goods_unit || ""}` : ""}
                              {order.goods_chs_code ? ` • CHS: ${order.goods_chs_code}` : ""}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-slate-600 dark:text-slate-400">
                            <div>{order.route_name || [order.loading_country_name, order.receiving_country_name].filter(Boolean).join(" → ") || "-"}</div>
                            {(order.loading_port_name || order.destination_port_name) ? (
                              <div className="text-[10px] text-slate-400">
                                {[order.loading_port_name, order.destination_port_name].filter(Boolean).join(" → ")}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="flex flex-wrap gap-1">
                              <span className="capitalize rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {order.movement_type || "-"}
                              </span>
                              <span className="capitalize rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                {order.transport_mode?.replace("_", " ") || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${prog.color}`}>
                              {tt(prog.labelKey, prog.label)}
                            </span>
                            {order.status === "approved" || order.status === "rejected" || order.status === "pending_approval" ? (
                              <div className="mt-1">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${
                                    order.status === "approved"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                                      : order.status === "rejected"
                                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300"
                                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
                                  }`}
                                >
                                  {order.status === "approved"
                                    ? t(lang, "comv.approval_approved", "Approved")
                                    : order.status === "rejected"
                                    ? t(lang, "comv.approval_rejected", "Rejected")
                                    : t(lang, "comv.approval_pending", "Pending Approval")}
                                </span>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3.5 py-3 text-slate-600 dark:text-slate-400">
                            <div className="font-semibold">{order.branch_name || userContext.context?.branchName || "-"}</div>
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <div className="relative inline-block text-left">
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
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                                title={tt("th_actions", "Actions")}
                              >
                                <MoreVertical className="h-4 w-4" />
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
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: 4-STEP WIZARD VIEW (NEW / EDIT ORDER & LIVE CUSTOMER REPORT)      */
        /* ========================================================================= */
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Wizard Navigation Bar */}
          <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setActiveActionMenuId(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>{tt("back", "Back")}</span>
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {tt("breadcrumb_dashboard", "Dashboard")} &gt; {tt("breadcrumb_orders", "Customer Order")} &gt;{" "}
                      <span className="text-slate-700 dark:text-slate-300 font-bold">
                        {editingOrderId ? tt("edit_customer_order", "Edit Customer Order") : tt("new_customer_order", "New Customer Order")}
                      </span>
                    </span>
                  </div>
                  <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                    {editingOrderId ? `${tt("edit_order_heading", "Edit Customer Order")} • ${formData.order_no || formData.customer_name}` : tt("new_order_heading", "New Customer Order")}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(lang, "comv.intro_subtitle", "Create shipping orders in a simple way. Save progress at any time and complete later.")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {/* More Actions Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMoreActionsOpen(!isMoreActionsOpen);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>{t(lang, "cbill.view_customer_bill", "View Customer Bill")}</span>
                  </Link>
                ) : null}

                {/* Save Draft */}
                <button
                  type="button"
                  onClick={() => void handleSaveProgress(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 transition"
                >
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{t(lang, "comv.save_draft", "Save Draft")}</span>
                </button>

                {/* + New Order */}
                <button
                  type="button"
                  onClick={handleStartNewOrder}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{tt("new", "New Order")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar (Screenshots 1, 2, 3) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center flex-1 max-w-2xl px-1">
                {stepsList.map((st, idx) => {
                  const isActive = currentStep === st.num;
                  const isPast = currentStep > st.num;
                  return (
                    <div key={st.num} className={`flex items-center ${idx < stepsList.length - 1 ? "flex-1" : ""}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(st.num as any);
                          if (st.num === 1) setStep1SubStep("1A");
                          else if (st.num === 2) setStep1SubStep("1B");
                          else if (st.num === 3) setStep1SubStep("1C");
                        }}
                        title={st.title}
                        className="group flex shrink-0 items-center gap-2"
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black shrink-0 ring-4 transition-all ${
                            isPast
                              ? "bg-emerald-600 text-white ring-emerald-50 dark:ring-emerald-950/40"
                              : isActive
                              ? "bg-blue-600 text-white ring-blue-100 dark:ring-blue-950/60"
                              : "bg-slate-100 text-slate-500 ring-transparent dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {isPast ? "✓" : st.num}
                        </span>
                        <span
                          className={`hidden text-xs font-bold sm:block ${
                            isActive ? "text-blue-700 dark:text-blue-300" : isPast ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"
                          }`}
                        >
                          {st.title}
                        </span>
                      </button>
                      {idx < stepsList.length - 1 ? (
                        <div className={`mx-3 h-0.5 flex-1 rounded-full transition-colors ${currentStep > st.num ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`} />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t(lang, "comv.step_x_of_4", "Step {n} of 4").replace("{n}", String(currentStep))}
                </span>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200">{stepsList[currentStep - 1]?.title}</div>
                <div className="text-[10px] text-slate-500">{stepsList[currentStep - 1]?.desc}</div>
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
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start" dir="ltr">
              {/* LEFT COLUMN: The Form Cards */}
              <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 xl:col-span-5">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                      saving={saving}
                    />
                  )}

                {/* Stepper Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    {currentStep > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (currentStep === 3) {
                            setCurrentStep(2);
                            setStep1SubStep("1B");
                          } else if (currentStep === 2) {
                            setCurrentStep(1);
                            setStep1SubStep("1A");
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>{t(lang, "comv.back", "Previous")}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>{tt("back_to_registry", "Back to Registry")}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveProgress(false)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 transition"
                    >
                      {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      <span>{t(lang, "comv.save_draft", "Save Draft")}</span>
                    </button>

                    {currentStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => void handleSaveProgress(true)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
                      >
                        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                        <span>Save & Continue to Truck & Fleet (1B)</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : currentStep === 2 ? (
                      <button
                        type="button"
                        onClick={() => void handleSaveProgress(true)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
                      >
                        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                        <span>Save & Continue to Goods & Warehouse (1C)</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : currentStep === 3 ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(4)}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                        >
                          <span>{tt("review_summary", "Review Summary")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveProgress(true)}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition"
                        >
                          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          <span>Save & Proceed to Review (Step 4)</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSaveProgress(true)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition"
                      >
                        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        <span>{tt("confirm_save_order", "Confirm & Save Customer Order")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: The Live Customer Order Report Panel (Enlarged 7-cols) */}
            <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 xl:col-span-7 xl:sticky xl:top-4 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5">
              {/* Live Report Card Container */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                {/* Header with Title and Live Badge */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
                      <Route className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white">
                        {tt("live_report", "Live Customer Order Report")}
                      </h2>
                      <p className="text-[10px] text-slate-500">
                        {tt("live_report_desc", "Real-time summary of your customer order details, movements and related information.")}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {tt("live", "Live")}
                  </span>
                </div>

                {/* Auto-Generated Serials & Timestamps Banner */}
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-blue-600" />
                      {tt("auto_generated_order_serials", "Auto-Generated Order Serials & Timestamp")}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {formData.order_date || "—"} • {formData.order_time || "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900 shadow-2xs">
                      <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{tt("global_serial", "Global Serial")}</span>
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-[11px] truncate block">
                        {formData.global_serial || "—"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900 shadow-2xs">
                      <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{tt("country_serial", "Country Serial")}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate block">
                        {formData.country_serial || "—"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900 shadow-2xs">
                      <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{tt("branch_serial", "Branch Serial")}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate block">
                        {formData.branch_serial || "—"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900 shadow-2xs">
                      <span className="text-[8.5px] font-bold uppercase text-slate-400 block">{tt("entry_serial", "Entry Serial")}</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-[11px] truncate block">
                        {formData.entry_serial || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Account Live Report — Formal Document / Message Layout (Voice note + Image 3 Reference) */}
                <div className="rounded-xl border border-blue-200/90 bg-white p-4 shadow-sm dark:border-blue-900/60 dark:bg-slate-900 space-y-3.5">
                  {/* Top Bar: Customer Name, Badges & Live Ledger Balance */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-sm shadow-md shadow-blue-600/20">
                        <Users className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {formData.customer_name || selectedCustomerInfo?.customer_name || selectedAccountInfo?.name || `— ${tt("select_customer_account", "Select Customer Account")} —`}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                            {selectedAccountInfo?.code || selectedCustomerInfo?.person_code || "ACC"}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            {selectedAccountInfo?.currency || "USD"}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{tt("customer_profile", "Customer & Account Document")}</span>
                          <span>•</span>
                          <span className="text-slate-400">ID: {formData.customer_id ? formData.customer_id.slice(0, 8) : "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Live Ledger Balance Badge */}
                      <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <CreditCard className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div className="text-right">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">Live Ledger Balance</div>
                          <div className={`font-black font-mono text-sm leading-tight mt-0.5 ${
                            selectedAccountInfo?.current_balance != null && Number(selectedAccountInfo.current_balance) < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {selectedAccountInfo?.current_balance != null
                              ? `${selectedAccountInfo.currency || "USD"} ${Number(selectedAccountInfo.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "0.00"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setStep1SubStep("1A");
                          setCurrentStep(1);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 transition shadow-2xs"
                        title={tt("transfer_step1a_customer", "Transfer to Step 1A / Customer Profile")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>{tt("transfer_step1a_short", "Transfer to 1A")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Customer Profile & Billing Address / Remarks Layout (Clean & Non-Duplicated) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    {/* COLUMN 1: BILLING ADDRESS & DIRECT CONTACT */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-850/60 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 dark:border-slate-750">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" />
                          {tt("billing_address_direct_contact", "Billing Address & Direct Contact")}
                        </span>
                      </div>
                      <div className="space-y-1 text-slate-700 dark:text-slate-300">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {selectedCustomerInfo?.contact_person || selectedCustomerInfo?.customer_name || formData.customer_name || "—"}
                        </div>
                        {selectedCustomerInfo?.company_name ? (
                          <div className="text-slate-600 dark:text-slate-400 font-medium">
                            {selectedCustomerInfo.company_name}
                          </div>
                        ) : null}
                        <div className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          {selectedCustomerInfo?.address || "Address on customer file"}
                        </div>
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                          {[selectedCustomerInfo?.city_name, selectedCustomerInfo?.country_name].filter(Boolean).join(", ") || "—"}
                        </div>
                        <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-750 space-y-0.5 text-[11px]">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-500">Phone:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-200">{selectedCustomerInfo?.mobile || "—"}</span>
                          </div>
                          {selectedCustomerInfo?.whatsapp ? (
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <span className="font-semibold text-slate-500">WhatsApp:</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">{selectedCustomerInfo.whatsapp}</span>
                            </div>
                          ) : null}
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 truncate">
                            <span className="font-semibold text-slate-500">Email:</span>
                            <span className="text-slate-800 dark:text-slate-200 truncate">{selectedCustomerInfo?.email || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* COLUMN 2: INSTRUCTIONS, REMARKS & SECONDARY PARTIES */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-850/60 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 dark:border-slate-750">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <FileText className="h-3 w-3" />
                            {tt("order_instructions_remarks", "Order Instructions & Remarks")}
                          </span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 italic text-[11px] leading-relaxed pt-1.5">
                          {formData.remarks || tt("no_special_instructions", "No special instructions registered for this customer order.")}
                        </div>
                      </div>

                      {/* Secondary Parties if assigned */}
                      {(partySelections.supplier?.companyName || partySelections.buyer?.companyName) ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-750 text-xs">
                          {partySelections.supplier?.companyName ? (
                            <div className="rounded-lg bg-white p-1.5 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                              <span className="text-[8.5px] uppercase font-bold text-slate-400 block">{tt("supplier_label", "Supplier")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-[10.5px] truncate block">{partySelections.supplier.companyName}</span>
                            </div>
                          ) : null}
                          {partySelections.buyer?.companyName ? (
                            <div className="rounded-lg bg-white p-1.5 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                              <span className="text-[8.5px] uppercase font-bold text-slate-400 block">{tt("buyer_label", "Buyer")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-[10.5px] truncate block">{partySelections.buyer.companyName}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 1. Unified Movement & Dynamic Route Journey Specification Card (Non-Duplicate) */}
                <div className="rounded-xl border border-sky-200/90 bg-white p-4 shadow-sm dark:border-sky-900/60 dark:bg-slate-900 space-y-3.5">
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
                        <div className="text-[10.5px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>Route Corridor: <strong className="text-slate-700 dark:text-slate-300">{formData.route_name || "Direct Customs Corridor"}</strong></span>
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
                      <span>Transfer to Route (1A)</span>
                    </button>
                  </div>

                  {/* 3-Stage Chronological Journey Diagram */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Stage 1: Origin & Loading */}
                      <div className="rounded-lg bg-white p-2.5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-sky-600 dark:text-sky-400">
                          <MapPin className="h-3 w-3" />
                          <span>1. Origin / Loading</span>
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {formData.loading_country_name || "Country Pending"}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          {formData.loading_port_name || formData.origin_airport_name || formData.exit_border_port_name || "Origin Port / Border"}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Facility: {formData.loading_source_name || "Origin Facility"}
                        </div>
                      </div>

                      {/* Stage 2: Customs & Border Transit */}
                      <div className="rounded-lg bg-white p-2.5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                          <Anchor className="h-3 w-3" />
                          <span>2. Border & Customs</span>
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {formData.entry_border_port_name || formData.exit_border_port_name || "Border Checkpoint"}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          Clearance: {formData.customs_clearance_office || "In-Transit Customs"}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Corridor: {formData.route_name || "Bonded Highway"}
                        </div>
                      </div>

                      {/* Stage 3: Destination & Receiving */}
                      <div className="rounded-lg bg-white p-2.5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                          <Globe2 className="h-3 w-3" />
                          <span>3. Final Destination</span>
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {formData.receiving_country_name || "Target Country"}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          {formData.destination_port_name || formData.destination_city || "Destination Port / City"}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Delivery: {formData.final_delivery_location || "Target Warehouse"}
                        </div>
                      </div>
                    </div>

                    {/* Operational Milestone Dates */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-750 text-[10.5px]">
                      <div>
                        <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Planned Pickup</span>
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{formData.planned_pickup_date || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Planned Dispatch</span>
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{formData.planned_dispatch_date || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Planned Arrival</span>
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{formData.planned_arrival_date || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Truck & Driver Assignment Message Card */}
                <div className="rounded-xl border border-indigo-200/90 bg-white p-4 shadow-sm dark:border-indigo-900/60 dark:bg-slate-900 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-sm shadow-md shadow-indigo-600/20">
                        <Truck className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {formData.truck_assignment_mode === "later"
                              ? "Truck Assignment Pending (Later)"
                              : formData.truck_number || "Vehicle & Driver Unassigned"}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                            {formData.truck_assignment_mode === "permanent"
                              ? "Permanent Fleet"
                              : formData.truck_assignment_mode === "later"
                              ? "Assign Later"
                              : "Hired Truck"}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{tt("truck_driver_desc", "Fleet Details, Driver Credentials & Dispatch Timing")}</span>
                          <span>•</span>
                          <span className="text-slate-400">Driver: {formData.truck_driver_name || "—"}</span>
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
                      <span>Transfer to Truck (1B)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    {/* Vehicle Specifications */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-850/60 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 dark:border-slate-750">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                          <Truck className="h-3 w-3" />
                          {tt("vehicle_specifications", "Vehicle Specifications")}
                        </span>
                      </div>
                      <div className="space-y-1 text-slate-700 dark:text-slate-300">
                        <div className="font-black text-slate-900 dark:text-white text-sm font-mono">
                          {formData.truck_assignment_mode === "later" ? tt("to_be_assigned_later", "To Be Assigned Later") : (formData.truck_number || "—")}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          {tt("transporter_label", "Transporter:")} <strong className="text-slate-800 dark:text-slate-200">{formData.truck_transport_company || formData.truck_owner_name || tt("internal_fleet", "Internal Fleet")}</strong>
                        </div>
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                          {tt("registration_label", "Registration:")} <span className="capitalize font-semibold">{formData.truck_registration_type || tt("registered_status", "Registered")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Driver & Contact Information */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-850/60 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 dark:border-slate-750">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          {tt("driver_credentials_dispatch", "Driver Credentials & Dispatch")}
                        </span>
                      </div>
                      <div className="space-y-1 text-slate-700 dark:text-slate-300">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formData.truck_assignment_mode === "later" ? "—" : (formData.truck_driver_name || tt("driver_unassigned", "Driver Unassigned"))}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          {tt("mobile_label", "Mobile:")} <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{formData.truck_driver_mobile || "—"}</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-750 space-y-0.5 text-[11px]">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-500">{tt("actual_dispatch_label", "Actual Dispatch:")}</span>
                            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{formData.actual_dispatch_date || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Goods & Cargo Manifest Breakdown Table Message Card */}
                <div className="rounded-xl border border-emerald-200/90 bg-white p-4 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900 space-y-3.5">
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

                  {/* Manifest Table */}
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
                                <div>{it.goodsName || it.goods_name || "General Cargo"}</div>
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
                                    🏢 Apna: {it.warehouseName || "Company"}
                                  </span>
                                ) : it.warehouseType === "customer" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                                    👤 Customer: {it.warehouseName || "Client Yard"}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                                    📍 Other: {it.warehouseName || formData.loading_source_name || "Warehouse"}
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
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Grand Manifest Totals KPI Banner */}
                  {(() => {
                    const totalItems = (formData.goods_items || []).length;
                    const totalPackages = (formData.goods_items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
                    const totalKg = (formData.goods_items || []).reduce((acc, it) => acc + (Number(it.totalKg) || 0), 0);
                    const totalMt = (totalKg / 1000).toFixed(3);
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs pt-1">
                        <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/30">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Total Items</span>
                          <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">{totalItems}</span>
                        </div>
                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Total Packaging</span>
                          <span className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block">{totalPackages.toLocaleString()} Units</span>
                        </div>
                        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Total Gross Wt (KG)</span>
                          <span className="text-base font-black text-indigo-700 dark:text-indigo-400 mt-0.5 block">{totalKg.toLocaleString()} kg</span>
                        </div>
                        <div className="rounded-xl border border-purple-200/80 bg-purple-50/50 p-2.5 dark:border-purple-900/40 dark:bg-purple-950/30">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Total Gross Wt (MT)</span>
                          <span className="text-base font-black text-purple-700 dark:text-purple-400 mt-0.5 block">{totalMt} MT</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Registered Customer Orders Mini-Table (Screenshots 1, 2, 3) */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white">
                        {tt("registered_orders", "Registered Customer Orders")} ({orders.length})
                      </h3>
                      <p className="text-[9.5px] text-slate-400">
                        {tt("recent_orders_hint", "Recent orders from this customer and related parties.")}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title={tt("export_csv", "Export to CSV")}
                      >
                        <Download className="h-3 w-3" />
                        <span>CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10.5px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                        title={tt("view_all", "View All in Table")}
                      >
                        <Filter className="h-3 w-3" />
                        <span>{tt("full_table", "Full Registry")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Mini-table container */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 text-[9.5px]">
                        <tr>
                          <th className="px-2.5 py-2">#</th>
                          <th className="px-2.5 py-2">{tt("th_order_no", "Order No")}</th>
                          <th className="px-2.5 py-2">{tt("th_party", "Customer")}</th>
                          <th className="px-2.5 py-2">{tt("th_goods", "Goods")}</th>
                          <th className="px-2.5 py-2">{tt("th_qty", "Qty")}</th>
                          <th className="px-2.5 py-2">{tt("th_route", "Route / Ports")}</th>
                          <th className="px-2.5 py-2">{tt("th_step_status", "Status")}</th>
                          <th className="px-2.5 py-2 text-right">{tt("th_actions", "Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {orders.slice(0, 5).map((order, oIdx) => (
                          <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="px-2.5 py-2 font-bold text-slate-400">{oIdx + 1}</td>
                            <td className="px-2.5 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {order.order_no || `CL-${order.id.slice(0, 6)}`}
                            </td>
                            <td className="px-2.5 py-2 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                              {order.customer_name || "-"}
                            </td>
                            <td className="px-2.5 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[90px]">
                              {order.goods_name || "-"}
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap text-slate-600 dark:text-slate-400">
                              {order.goods_quantity ? `${order.goods_quantity} ${order.goods_unit || ""}` : "-"}
                            </td>
                            <td className="px-2.5 py-2 text-slate-500 truncate max-w-[100px]">
                              {order.route_name || [order.loading_country_name, order.receiving_country_name].filter(Boolean).join(" → ") || "-"}
                            </td>
                            <td className="px-2.5 py-2">
                              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                {order.status || "Draft"}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => loadEditOrder(order)}
                                className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                title={tt("edit_resume_step", "Edit / Resume")}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
  handlePartyChange,
  handleLoadingCountryChange,
  handleReceivingCountryChange,
  handleLoadingPortChange,
  handleDestinationPortChange,
  onAdvanceToStep2,
  onAdvanceToStep3,
  onConfirmSave,
  onSaveDraft,
  saving
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  tt: (k: string, f: string) => string;
  userContext: { context: BranchUserContext | null; loading: boolean; error: string | null };
  formData: FormDataState;
  setFormData: SetFormData;
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
  handlePartyChange: (roleKey: PartyRoleKey, next: PartySelection) => void;
  handleLoadingCountryChange: (countryId: string) => void;
  handleReceivingCountryChange: (countryId: string) => void;
  handleLoadingPortChange: (portId: string) => void;
  handleDestinationPortChange: (portId: string) => void;
  onAdvanceToStep2: () => void;
  onAdvanceToStep3?: () => void;
  onConfirmSave?: () => void;
  onSaveDraft?: () => void;
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

  // Multi-goods helper functions
  const updateGoodsItem = (idx: number, patch: Partial<CustomerOrderGoodsItem>) => {
    setFormData((current) => {
      const items = [...(current.goods_items || [defaultGoodsItem()])];
      const existing = items[idx] || defaultGoodsItem();
      const next = { ...existing, ...patch };

      if ("quantity" in patch || "kgPerQty" in patch) {
        const q = Number(next.quantity) || 0;
        const k = Number(next.kgPerQty) || 0;
        next.totalKg = String(q * k);
      }

      items[idx] = next;

      // Sync first goods to order-level top fields for backward compatibility
      const first = items[0];
      const totalQty = items.reduce((sum, g) => sum + (Number(g.quantity) || 0), 0);
      const totalKg = items.reduce((sum, g) => sum + (Number(g.totalKg) || 0), 0);

      return {
        ...current,
        goods_items: items,
        goods_id: first?.goodsId || current.goods_id,
        goods_name: items.map((g) => g.goodsName).filter(Boolean).join(", ") || current.goods_name,
        goods_unit: first?.unit || current.goods_unit,
        goods_quantity: String(totalQty),
        goods_gross_weight: String(totalKg),
        goods_net_weight: String(totalKg)
      };
    });
  };

  // Step 1B Goods Draft & Edit State (Voice note: enter once, save to table, repeat)
  const [draftGoodsItem, setDraftGoodsItem] = useState<CustomerOrderGoodsItem>(defaultGoodsItem());
  const [editingGoodsIdx, setEditingGoodsIdx] = useState<number | null>(null);

  const handleDraftGoodsChange = (field: keyof CustomerOrderGoodsItem, value: any) => {
    setDraftGoodsItem((curr) => {
      const updated = { ...curr, [field]: value };
      if (field === "quantity" || field === "kgPerQty") {
        const q = Number(field === "quantity" ? value : updated.quantity) || 0;
        const k = Number(field === "kgPerQty" ? value : updated.kgPerQty) || 0;
        updated.totalKg = String(q * k);
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
    const total = String(qty * kg);
    const itemToSave: CustomerOrderGoodsItem = {
      ...draftGoodsItem,
      goodsName: draftGoodsItem.goodsName || "Goods Item",
      quantity: String(qty),
      kgPerQty: String(kg),
      totalKg: total
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
      const totalGrossKg = updatedItems.reduce((sum, g) => sum + (Number(g.totalKg) || 0), 0);
      const first = updatedItems[0];
      return {
        ...current,
        goods_items: updatedItems,
        goods_id: first?.goodsId || "",
        goods_name: updatedItems.map((g) => g.goodsName).filter(Boolean).join(", "),
        goods_unit: first?.unit || "Bags",
        goods_quantity: String(totalQty),
        goods_gross_weight: String(totalGrossKg),
        goods_net_weight: String(totalGrossKg)
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
    if (editingGoodsIdx === idx) {
      setDraftGoodsItem(defaultGoodsItem());
      setEditingGoodsIdx(null);
    }
  };

  // Pre-fill 1B warehouse into 1C origin warehouse automatically
  const effectiveOriginWarehouse = useMemo(() => {
    const firstItem = formData.goods_items?.[0];
    if (firstItem?.warehouseName) return firstItem.warehouseName;
    if (formData.loading_source_name) return formData.loading_source_name;
    return "";
  }, [formData.goods_items, formData.loading_source_name]);

  // Totals calculations
  const totalGoodsQuantity = useMemo(
    () => (formData.goods_items || []).reduce((sum, g) => sum + (Number(g.quantity) || 0), 0),
    [formData.goods_items]
  );
  const totalGoodsKg = useMemo(
    () => (formData.goods_items || []).reduce((sum, g) => sum + (Number(g.totalKg) || 0), 0),
    [formData.goods_items]
  );
  const totalGoodsMt = useMemo(() => (totalGoodsKg / 1000).toFixed(2), [totalGoodsKg]);

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
          <span className="truncate">1B — Truck & Fleet</span>
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
          <span className="truncate">1C — Goods & Warehouse</span>
          {(formData.goods_items || []).filter((g) => g.goodsName || g.quantity).length > 0 ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
          ) : null}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1A — CUSTOMER ACCOUNT, MOVEMENT TYPE & DYNAMIC ROUTE                      */}
      {/* ========================================================================= */}
      {step1SubStep === "1A" && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Compact Serials & Timestamp Bar */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-850">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-[10px] font-black text-white">
                  1A
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Serials:</span>
                <span className="font-mono text-blue-700 dark:text-blue-300 font-bold">
                  {formData.super_admin_serial || formData.order_no || "Auto"}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {formData.country_serial || "Auto"}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {formData.branch_serial || "Auto"}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {formData.entry_serial || "Auto"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                <Calendar className="h-3 w-3 text-blue-600" />
                <span>{formData.order_date || new Date().toISOString().split("T")[0]}</span>
                <span>•</span>
                <span>{formData.order_time || new Date().toTimeString().slice(0, 5)}</span>
              </div>
            </div>
          </div>

          {/* 1. Customer Account SearchSelect */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <div className="flex items-center justify-between">
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

            {/* Tag summary underneath input */}
            {selectedCustomer || selectedAccount ? (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
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

          {/* 2. Ship Mode & Movement Type Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Ship className="h-4 w-4 text-blue-600" />
                <span>{tt("shipping_transport_mode", "Shipping / Transport Mode")} *</span>
              </label>
              <select
                value={formData.transport_mode}
                onChange={(e) => setFormData((curr) => ({ ...curr, transport_mode: e.target.value as any }))}
                className={selectClass}
              >
                <option value="by_sea">🚢 By Sea (Ocean Vessel / Container)</option>
                <option value="by_road">🚛 By Road (Truck / Trailer / Road Freight)</option>
                <option value="by_air">✈️ By Air (Air Freight / Cargo)</option>
                <option value="by_rail">🚆 By Train (Rail Freight)</option>
              </select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Repeat2 className="h-4 w-4 text-purple-600" />
                <span>{tt("movement_type_route", "Movement Type (Route Type)")} *</span>
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
          </div>

          {/* 3. DYNAMIC MOVEMENT & ROUTE FIELDS BASED ON MOVEMENT TYPE */}
          {formData.movement_type === "import" && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 space-y-3 dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="flex items-center justify-between border-b border-sky-200/60 pb-1.5 dark:border-sky-900/60">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-sky-800 dark:text-sky-300">
                  <Ship className="h-4 w-4 text-sky-600" />
                  <span>{tt("import_movement_route", "Import Movement & Route Specifications")}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                  {tt("import_clearance_badge", "Import Clearance")}
                </span>
              </div>

              {/* Row 1: Foreign Origin Country & Port of Loading */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("foreign_origin_country", "Foreign Origin Country")} *
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
                    {tt("foreign_port_of_loading", "Foreign Port of Loading")}
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
                  {tt("final_delivery_location", "Final Delivery Location / Warehouse Address")}
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
                  <span>{tt("export_movement_route", "Export Movement & Route Specifications")}</span>
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
                    {tt("destination_country", "Destination Country")} *
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
                    {tt("foreign_port_discharge_city", "Foreign Port of Discharge / Destination City")}
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
                  <span>{tt("bonded_transit_movement", "Bonded Transit Movement Specifications")}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 uppercase">
                  {formData.movement_type.replace("_", " ")}
                </span>
              </div>

              {/* Row 1: Entry Border / Port & Corridor */}
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
                    {tt("transit_corridor_route", "Transit Corridor / Route Name")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("ph_transit_corridor", "e.g. Karachi - Chaman - Spin Boldak")}
                    value={formData.route_name}
                    onChange={(e) => setFormData((c) => ({ ...c, route_name: e.target.value }))}
                    className={inputClass}
                  />
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
                    {tt("transit_destination_country", "Transit Destination Country")} *
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

          {/* 1A Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setFormData((curr) => ({
                  ...curr,
                  customer_id: "",
                  customer_name: "",
                  movement_type: "import",
                  transport_mode: "by_sea"
                }));
              }}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
            >
              {tt("reset_1a_form", "Reset 1A Form")}
            </button>

            <button
              type="button"
              onClick={onAdvanceToStep2}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 transition"
            >
              <span>{tt("save_continue_1b", "Save & Continue to 1B (Truck)")}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1B — TRUCK / FLEET ASSIGNMENT & OPERATIONAL DATES                         */}
      {/* ========================================================================= */}
      {step1SubStep === "1B" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Read-Only 1A Summary Badge Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200/80 bg-blue-50/50 p-2.5 text-xs dark:border-blue-900/60 dark:bg-blue-950/30">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                {tt("summary_1a_badge", "1A Summary")}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {tt("customer_label_colon", "Customer:")} <span className="text-blue-700 dark:text-blue-300">{formData.customer_name || "—"}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">
                {tt("ship_label_colon", "Ship:")} {formData.transport_mode.replace("by_", "")}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-bold text-purple-700 dark:text-purple-300 capitalize">
                {tt("movement_label_colon", "Movement:")} {formData.movement_type.replace("_", " ")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => selectSub("1A")}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
            >
              <Pencil className="h-3 w-3" />
              <span>{tt("edit_1a_bracket", "[Edit (1A)]")}</span>
            </button>
          </div>

          {/* Truck / Pre-Carriage Section — Single Vehicle per Order */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {tt("truck_fleet_assignment_single", "Truck / Fleet Assignment (Single Vehicle per Order)")}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{tt("road_transport", "Road / Transport")}</span>
            </div>

            {/* Truck Assignment Dropdown & Inputs */}
            <div className="space-y-2.5">
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
            </div>
          </div>

          {/* Operational Dates: Planned vs Actual Pickup, Dispatch, Departure, Arrival */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 pb-2 dark:border-slate-800">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span>Operational Tracking Dates — Planned vs. Actual</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Planned Pickup Date *
                </label>
                <input
                  type="date"
                  value={formData.planned_pickup_date || formData.expected_loading_date}
                  onChange={(e) =>
                    setFormData((c) => ({
                      ...c,
                      planned_pickup_date: e.target.value,
                      expected_loading_date: e.target.value
                    }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Actual Pickup Date
                </label>
                <input
                  type="date"
                  value={formData.actual_pickup_date || ""}
                  onChange={(e) => setFormData((c) => ({ ...c, actual_pickup_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Planned Dispatch Date
                </label>
                <input
                  type="date"
                  value={formData.planned_dispatch_date || ""}
                  onChange={(e) => setFormData((c) => ({ ...c, planned_dispatch_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Actual Dispatch Date
                </label>
                <input
                  type="date"
                  value={formData.actual_dispatch_date || ""}
                  onChange={(e) => setFormData((c) => ({ ...c, actual_dispatch_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Planned Departure Date
                </label>
                <input
                  type="date"
                  value={formData.planned_departure_date}
                  onChange={(e) => setFormData((c) => ({ ...c, planned_departure_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Actual Departure Date
                </label>
                <input
                  type="date"
                  value={formData.actual_departure_date}
                  onChange={(e) => setFormData((c) => ({ ...c, actual_departure_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Planned Arrival Date
                </label>
                <input
                  type="date"
                  value={formData.planned_arrival_date}
                  onChange={(e) => setFormData((c) => ({ ...c, planned_arrival_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Actual Arrival Date
                </label>
                <input
                  type="date"
                  value={formData.actual_arrival_date}
                  onChange={(e) => setFormData((c) => ({ ...c, actual_arrival_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 1B Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => selectSub("1A")}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back to 1A (Customer & Route)</span>
            </button>

            <button
              type="button"
              onClick={onAdvanceToStep3}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 transition"
            >
              <span>Save & Continue to 1C (Goods & Warehouse)</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1C — GOODS MANIFEST & WAREHOUSE SELECTION (APNA VS OTHER WAREHOUSE)       */}
      {/* ========================================================================= */}
      {step1SubStep === "1C" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Read-Only 1A & 1B Summary Badge Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-850">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                1A & 1B Summary
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formData.customer_name} • {formData.transport_mode.replace("by_", "").toUpperCase()} • {formData.movement_type.toUpperCase()}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-bold text-slate-600 dark:text-slate-400">
                Truck: {formData.truck_number || "Later"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectSub("1A")}
                className="text-[11px] font-bold text-blue-600 underline"
              >
                [Edit 1A]
              </button>
              <button
                type="button"
                onClick={() => selectSub("1B")}
                className="text-[11px] font-bold text-blue-600 underline"
              >
                [Edit 1B]
              </button>
            </div>
          </div>

          {/* Multiple Goods Section with Save-to-Table & Manifest Grid */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
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
            <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/30 p-3.5 space-y-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black">
                    {editingGoodsIdx !== null ? editingGoodsIdx + 1 : (formData.goods_items || []).length + 1}
                  </span>
                  <span>{editingGoodsIdx !== null ? `Edit Goods Item #${editingGoodsIdx + 1}` : "Add Goods Item"}</span>
                </span>
                {editingGoodsIdx !== null ? (
                  <button
                    type="button"
                    onClick={handleCancelEditGoods}
                    className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 underline font-medium"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              {/* Apna Warehouse ya Other Warehouse Prominent Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Warehouse className="h-3.5 w-3.5 text-blue-600" />
                    <span>Warehouse Location (Apna Warehouse ya Other Warehouse?) *</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">Step 3 Specification</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Option 1: Apna Warehouse (Company) */}
                  <button
                    type="button"
                    onClick={() => {
                      handleDraftGoodsChange("warehouseSourceType", "company_warehouse");
                    }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      draftGoodsItem.warehouseSourceType === "company_warehouse"
                        ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 dark:border-blue-500 shadow-xs ring-2 ring-blue-500/20"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      draftGoodsItem.warehouseSourceType === "company_warehouse" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      <Warehouse className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">Apna Warehouse</div>
                      <div className="text-[10px] text-slate-500">Company DGT Warehouse</div>
                    </div>
                  </button>

                  {/* Option 2: Customer Warehouse */}
                  <button
                    type="button"
                    onClick={() => {
                      handleDraftGoodsChange("warehouseSourceType", "customer_warehouse");
                      handleDraftGoodsChange("warehouseName", selectedCustomer ? `${selectedCustomer.customer_name}'s Warehouse` : "Customer Warehouse");
                      handleDraftGoodsChange("warehouseAddressText", selectedCustomer?.address || "Customer Registered Address");
                    }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      draftGoodsItem.warehouseSourceType === "customer_warehouse"
                        ? "border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 dark:border-emerald-500 shadow-xs ring-2 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      draftGoodsItem.warehouseSourceType === "customer_warehouse" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">Customer Warehouse</div>
                      <div className="text-[10px] text-slate-500">Client Premises / Yard</div>
                    </div>
                  </button>

                  {/* Option 3: Other Warehouse */}
                  <button
                    type="button"
                    onClick={() => {
                      handleDraftGoodsChange("warehouseSourceType", "other");
                    }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      draftGoodsItem.warehouseSourceType === "other"
                        ? "border-purple-600 bg-purple-50/80 dark:bg-purple-950/40 dark:border-purple-500 shadow-xs ring-2 ring-purple-500/20"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      draftGoodsItem.warehouseSourceType === "other" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">Other Warehouse</div>
                      <div className="text-[10px] text-slate-500">Third-Party Yard / Port</div>
                    </div>
                  </button>
                </div>

                {/* Dynamic inputs based on selection */}
                {draftGoodsItem.warehouseSourceType === "company_warehouse" && (
                  <div className="mt-2">
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
                  <div className="mt-2 p-2 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">{tt("customer_facility", "Customer Facility")}: </span>
                    <span className="text-slate-700 dark:text-slate-300">{draftGoodsItem.warehouseAddressText || selectedCustomer?.address || tt("address_from_customer_account", "Address from customer account")}</span>
                  </div>
                )}

                {draftGoodsItem.warehouseSourceType === "other" && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              {/* Row 1: Goods Master Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {tt("goods_name_from_master", "Goods Name (from Goods Master or New Item)")} *
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
                  searchPlaceholder="Search goods..."
                  emptyLabel="No goods found in master"
                />
              </div>

              {/* Row 2: Qty Unit, Quantity, KG Per Qty, Total KG */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">{tt("qty_unit", "Qty Unit")}</label>
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
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">Quantity *</label>
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
                  <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">KG Per Qty *</label>
                  <input
                    type="number"
                    min="0"
                    value={draftGoodsItem.kgPerQty}
                    onChange={(e) => handleDraftGoodsChange("kgPerQty", e.target.value)}
                    className={inputClass}
                    placeholder="50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                    Total KG (Auto)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={draftGoodsItem.totalKg || "0"}
                    className="w-full rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-xs font-mono font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Quality / Inspection Photo Upload & Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/40">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span>{tt("quality_loading_inspection_photo", "Quality / Loading Inspection Photo")}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGoodsPhotoUpload}
                      className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/40 dark:file:text-blue-300"
                    />
                    {draftGoodsItem.photoUrl ? (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ Attached</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-end justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraftGoods}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{editingGoodsIdx !== null ? "Update Goods Item" : "Add to Manifest Table"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Manifest Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50/90 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-750 dark:bg-slate-800 text-[9.5px]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Goods Description</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">KG/Unit</th>
                    <th className="py-2.5 px-3 text-right">Total KG</th>
                    <th className="py-2.5 px-3 text-right">Total MT</th>
                    <th className="py-2.5 px-3">Warehouse Source</th>
                    <th className="py-2.5 px-3 text-center">Quality Photo</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-750 text-[11px]">
                  {(formData.goods_items || []).filter((it) => it.goodsName || it.goodsId || Number(it.quantity) > 0).map((it, idx) => {
                    const q = parseFloat(String(it.quantity || 0)) || 0;
                    const kg = parseFloat(String(it.totalKg || 0)) || 0;
                    const kgPer = parseFloat(String(it.kgPerQty || 0)) || (q > 0 ? kg / q : 0);
                    const mt = kg > 0 ? (kg / 1000).toFixed(3) : "0.000";

                    return (
                      <tr key={it.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                          <div>{it.goodsName || it.goods_name || "General Cargo"}</div>
                          {it.goodsChsCode ? (
                            <span className="inline-block text-[9.5px] font-mono text-slate-400">CHS: {it.goodsChsCode}</span>
                          ) : null}
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
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            it.warehouseSourceType === "company_warehouse"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : it.warehouseSourceType === "customer_warehouse"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}>
                            {it.warehouseName || "Warehouse"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {it.photoUrl ? (
                            <div className="inline-flex items-center gap-1">
                              <img
                                src={it.photoUrl}
                                alt={tt("thumbnail", "Thumbnail")}
                                className="h-6 w-6 rounded object-cover border border-slate-200 dark:border-slate-700"
                              />
                              <a
                                href={it.photoUrl}
                                download={it.photoName || `goods-photo-${idx + 1}.jpg`}
                                className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                title={tt("download_quality_photo", "Download quality photo")}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditGoodsRow(idx)}
                              className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              title={tt("edit_item", "Edit Item")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeGoodsItem(idx)}
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
              </table>
            </div>

            {/* Total Goods Weights Bar */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                Total Quantity: <span className="font-black font-mono">{totalGoodsQuantity}</span>
              </span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                Total Gross Weight: <span className="font-black font-mono">{totalGoodsKg.toLocaleString()} KG</span> ({totalGoodsMt} MT)
              </span>
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
  editingOrderId
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
