"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
  RefreshCw,
  Repeat2,
  Route,
  Save,
  Search,
  Truck,
  Users,
  Warehouse,
  X
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
import { listCities } from "@/features/locations/location-api";

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

const PARTY_ROLES: Array<{ key: PartyRoleKey; label: string; labelKey: string; required?: boolean }> = [
  { key: "supplier", label: "Supplier / Order Party", labelKey: "role_supplier", required: true },
  { key: "importer", label: "Importer", labelKey: "role_importer", required: true },
  { key: "exporter", label: "Exporter", labelKey: "role_exporter", required: true },
  { key: "notify_party", label: "Notify Party", labelKey: "role_notify_party" },
  { key: "buyer", label: "Buyer", labelKey: "role_buyer" }
];

const EMPTY_FORM = {
  customer_id: "",
  customer_name: "",
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
  route_name: "",
  shipment_type: "FCL",
  transport_mode: "by_sea" as TransportMode,
  movement_type: "import" as MovementType,
  load_type: "" as LoadType | "",
  loading_source: "shipping_warehouse" as LoadingSource,
  loading_source_name: "",
  loading_source_warehouse_id: "",
  loading_source_container_ref: "",
  exporter_name: "",
  importer_name: "",
  notify_party_required: false,
  notify_party_name: "",
  buyer_name: "",
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
  loading_port_id: "",
  loading_port_name: "",
  destination_port_id: "",
  destination_port_name: "",
  cargo_details: "",
  expected_loading_date: new Date().toISOString().split("T")[0],
  remarks: "",
  order_no: "",
  status: "pending",
  super_admin_serial: "",
  country_serial: "",
  branch_serial: "",
  entry_serial: "",
  // By Road truck
  truck_registration_type: "registered" as "registered" | "temporary",
  truck_id: "",
  truck_number: "",
  truck_driver_name: "",
  truck_driver_mobile: "",
  truck_owner_name: "",
  truck_transport_company: "",
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
    buyer: emptyPartySelection()
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
    return { step: 4, label: "Complete (4/4)", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" };
  }
  if (hasGoods && hasSupplier && hasShipping) {
    return { step: 3, label: "Step 3/4 (Shipping)", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800" };
  }
  if (hasGoods && hasSupplier) {
    return { step: 2, label: "Step 2/4 (Parties)", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" };
  }
  return { step: 1, label: "Step 1/4 (Goods)", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" };
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
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [orders, setOrders] = useState<ClearingCustomerOrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [clearingAgents, setClearingAgents] = useState<ClearingAgentRow[]>([]);
  const [shippingLines, setShippingLines] = useState<ShippingLineRow[]>([]);
  const [countryBranches, setCountryBranches] = useState<{ id: string; name: string; countryId: string }[]>([]);
  const [cityBranches, setCityBranches] = useState<{ id: string; name: string; countryBranchId: string }[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string }[]>([]);
  const [loadingCities, setLoadingCities] = useState<CityRow[]>([]);
  const [receivingCities, setReceivingCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [approvalActionOrderId, setApprovalActionOrderId] = useState<string | null>(null);
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

  useEffect(() => {
    void fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [orderRes, customerRes, companyRes, countryRes, portRes, agentRes, lineRes, countryBranchRes, cityBranchRes, assigneeRes] = await Promise.all([
        fetch("/api/erp/clearing-agent/customer-order"),
        fetch("/api/erp/customers?limit=250"),
        fetch("/api/erp/companies?limit=250"),
        fetch("/api/erp/locations/countries"),
        fetch("/api/erp/ports"),
        fetch("/api/erp/clearing-agents?limit=200"),
        fetch("/api/erp/shipping-lines?limit=200"),
        fetch("/api/branch-management/country-branches"),
        fetch("/api/branch-management/city-branches"),
        fetch("/api/erp/user-tasks/assignees")
      ]);

      const [orderJson, customerJson, companyJson, countryJson, portJson, agentJson, lineJson, countryBranchJson, cityBranchJson, assigneeJson] = await Promise.all([
        orderRes.json(),
        customerRes.json(),
        companyRes.json(),
        countryRes.json(),
        portRes.json(),
        agentRes.json(),
        lineRes.json(),
        countryBranchRes.json().catch(() => null),
        cityBranchRes.json().catch(() => null),
        assigneeRes.json().catch(() => null)
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
      setCompanies(extractArray(companyJson, ["companies", "data"]));
      setCountries(extractArray(countryJson, ["countries", "data"]));
      setPorts(extractArray(portJson, ["ports", "data"]));
      setClearingAgents(extractArray(agentJson, ["clearingAgents", "data"]));
      setShippingLines(extractArray(lineJson, ["shippingLines", "data"]));
      setCountryBranches(
        extractArray(countryBranchJson, ["countryBranches", "data"]).map((b: any) => ({ id: b.id, name: b.name, countryId: b.country_id }))
      );
      setCityBranches(
        extractArray(cityBranchJson, ["cityBranches", "data"]).map((b: any) => ({ id: b.id, name: b.name, countryBranchId: b.country_branch_id }))
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

  const customerOptions = useMemo(
    () =>
      customers.map((row) => ({
        value: row.id,
        label: optionLabelFromCustomer(row),
        keywords: [row.customer_name, row.company_name, row.contact_person, row.mobile, row.whatsapp, row.email, row.address]
          .filter(Boolean)
          .join(" ")
      })),
    [customers]
  );

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
    const query = normalize(filterState.query);
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

    if (filterState.country && filterState.country !== "all") {
      const c = filterState.country.toLowerCase();
      list = list.filter((o) =>
        (o.loading_country_name || "").toLowerCase().includes(c) ||
        (o.receiving_country_name || "").toLowerCase().includes(c) ||
        (o.goods_origin_country_name || "").toLowerCase().includes(c)
      );
    }

    if (filterState.status && filterState.status !== "all") {
      list = list.filter((o) => (o.status || "pending").toLowerCase() === filterState.status?.toLowerCase());
    }

    return list;
  }, [orders, filterState]);

  const orderCounts = useMemo(
    () => ({
      total: orders.length,
      import: orders.filter((order) => String(order.movement_type || "").toLowerCase() === "import").length,
      export: orders.filter((order) => String(order.movement_type || "").toLowerCase() === "export").length,
      domestic: orders.filter((order) => String(order.movement_type || "").toLowerCase() === "domestic").length,
      transit: orders.filter((order) => String(order.movement_type || "").toLowerCase() === "up_transit").length
    }),
    [orders]
  );

  const isSeaMode = formData.transport_mode === "by_sea";
  const isRoadMode = formData.transport_mode === "by_road";

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setPartySelections(emptyPartyState());
    setEditingOrderId(null);
    setCurrentStep(1);
  };

  const loadEditOrder = (order: ClearingCustomerOrderRow) => {
    const o = order as Record<string, any>;
    setEditingOrderId(order.id);
    setFormData({
      customer_id: order.customer_id || "",
      customer_name: order.customer_name || "",
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
      truck_registration_type: (o.truck_registration_type as "registered" | "temporary") || "registered",
      truck_id: o.truck_id || "",
      truck_number: o.truck_number || "",
      truck_driver_name: o.truck_driver_name || "",
      truck_driver_mobile: o.truck_driver_mobile || "",
      truck_owner_name: o.truck_owner_name || "",
      truck_transport_company: o.truck_transport_company || "",
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
      const isFinalConfirm = advanceStep && currentStep === 4;
      const payload = {
        ...formData,
        status: isFinalConfirm ? "booking_confirmed" : formData.status || "pending",
        customer_id: supplier.customerId || formData.customer_id || null,
        customer_name: supplier.customerName || formData.customer_name || null,
        goods_id: formData.goods_id || null,
        goods_variation_id: formData.goods_variation_id || null,
        goods_name: formData.goods_name || null,
        goods_chs_code: formData.goods_chs_code || null,
        goods_variation_label: formData.goods_variation_label || null,
        goods_brand: formData.goods_brand || null,
        goods_size: formData.goods_size || null,
        goods_origin_country_name: formData.goods_origin_country_name || null,
        goods_quantity: formData.goods_quantity ? Number(formData.goods_quantity) : null,
        goods_bags_cartons: formData.goods_bags_cartons ? Number(formData.goods_bags_cartons) : null,
        goods_gross_weight: formData.goods_gross_weight ? Number(formData.goods_gross_weight) : null,
        goods_empty_weight: formData.goods_empty_weight ? Number(formData.goods_empty_weight) : null,
        goods_net_weight: formData.goods_net_weight ? Number(formData.goods_net_weight) : null,
        exporter_name: partySelections.exporter.customerName || formData.exporter_name || null,
        importer_name: partySelections.importer.customerName || formData.importer_name || null,
        buyer_name: partySelections.buyer.customerName || formData.buyer_name || null,
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
        legs: formData.legs.map((leg) => ({
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
          truckId: leg.truckId || null,
          truckRegistrationType: leg.truckRegistrationType || null,
          truckNumber: leg.truckNumber || null,
          truckDriverName: leg.truckDriverName || null,
          truckDriverMobile: leg.truckDriverMobile || null,
          shippingLineId: leg.shippingLineId || null,
          vesselName: leg.vesselName || null,
          voyageNumber: leg.voyageNumber || null,
          containerNumber: leg.containerNumber || null,
          sealNumber: leg.sealNumber || null,
          blNumber: leg.blNumber || null,
          portOfLoading: leg.portOfLoading || null,
          portOfDischarge: leg.portOfDischarge || null,
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
          plannedDeparture: leg.plannedDeparture || null,
          actualDeparture: leg.actualDeparture || null,
          plannedArrival: leg.plannedArrival || null,
          actualArrival: leg.actualArrival || null,
          status: leg.status || "pending",
          // handover_id is a real FK into business_shipping_handovers — only forward it
          // if it actually looks like a UUID, otherwise a pasted free-text reference
          // would fail the column's uuid cast at insert time.
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
        })),
        loadingAllocations: formData.loadingAllocations?.map((alloc) => ({
          id: alloc.id,
          rowSerial: alloc.rowSerial,
          warehouseId: alloc.warehouseId || null,
          sourceLocationText: alloc.sourceLocationText || null,
          quantity: alloc.quantity ? Number(alloc.quantity) : 0,
          unit: alloc.unit || null,
          remarks: alloc.remarks || null
        })) ?? []
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
          ? `Order ${savedOrder?.order_no || ""} completed successfully!`
          : `Order ${savedOrder?.order_no || ""} progress saved (Step ${currentStep}/4).`
      );

      await fetchInitialData();

      if (advanceStep && currentStep < 4) {
        setCurrentStep((s) => (s + 1) as any);
      } else if (advanceStep && currentStep === 4) {
        resetForm();
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

  const stepsList = [
    {
      num: 1,
      title: t(lang, "comv.step1_name", "Booking & Customer"),
      desc: t(lang, "comv.step1_desc", "Customer, Movement, Mode & Route")
    },
    {
      num: 2,
      title: t(lang, "comv.step2_name", "Pickup, Goods & Truck"),
      desc: t(lang, "comv.step2_desc", "Pickup Source, Goods & Transport")
    },
    {
      num: 3,
      title: t(lang, "comv.step3_name", "Route, Vessel & Customs"),
      desc: t(lang, "comv.step3_desc", "Parties, Legs, Vessel & Clearance")
    },
    {
      num: 4,
      title: t(lang, "comv.step4_name", "Review & Confirm"),
      desc: t(lang, "comv.step4_desc", "Full Summary & Confirmation")
    }
  ];

  return (
    <div className="w-full space-y-4 pb-12" dir={isRtl ? "rtl" : "ltr"}>
      {/* Workspace header: entry and live report share one visual system. */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
              <Route className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-[22px]">{tt("title", "Customer Order")}</h1>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {t(lang, "comv.four_step_wizard", "4-Step Progressive Wizard")}
                </span>
              </div>
              <p className="max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t(lang, "comv.intro_subtitle", "Enter customer shipping orders in 4 easy steps. Save progress at any step and complete later.")}
              </p>
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {tt("header_next", "Next")}: {currentStep < 4 ? stepsList[currentStep]?.title : t(lang, "comv.confirm_booking", "Confirm Booking")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={fetchInitialData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {refreshLabel}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {tt("new", "New Order")}
            </button>
          </div>
        </div>
      </div>

      {successMessage ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start" dir="ltr">
        {/* Left Form: Compact 4-Step Wizard */}
        <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 self-start rounded-2xl border border-slate-200/90 border-t-4 border-t-blue-600 bg-white p-4 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:border-t-blue-500 dark:bg-slate-900 dark:shadow-none xl:col-span-5 xl:sticky xl:top-4">
          {/* Stepper Navigation Bar */}
          <div className="space-y-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {t(lang, "comv.step_x_of_4", "Step {n} of 4").replace("{n}", String(currentStep))}
              </span>
              {editingOrderId ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                  {tt("editing_label", "Editing:")} {formData.customer_name || tt("editing_fallback_order", "Order")}
                </span>
              ) : null}
            </div>

            {/* Connected stepper: numbered circles joined by a fill-as-you-go line. */}
            <div className="flex items-center px-0.5" aria-label={t(lang, "comv.progress_label", "Order completion progress")}>
              {stepsList.map((st, idx) => {
                const isActive = currentStep === st.num;
                const isPast = currentStep > st.num;
                return (
                  <div key={st.num} className={`flex items-center ${idx < stepsList.length - 1 ? "flex-1" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(st.num as any)}
                      title={st.title}
                      className="group flex shrink-0 flex-col items-center gap-1"
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black shrink-0 ring-4 transition-colors ${
                          isActive
                            ? "bg-blue-600 text-white ring-blue-100 dark:ring-blue-950/60"
                            : isPast
                            ? "bg-emerald-600 text-white ring-emerald-50 dark:ring-emerald-950/40"
                            : "bg-slate-100 text-slate-500 ring-transparent dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {isPast ? "✓" : st.num}
                      </span>
                      <span
                        className={`hidden text-[9.5px] font-bold truncate sm:block ${
                          isActive ? "text-blue-700 dark:text-blue-300" : isPast ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"
                        }`}
                      >
                        {st.title}
                      </span>
                    </button>
                    {idx < stepsList.length - 1 ? (
                      <div className={`mx-1.5 h-0.5 flex-1 rounded-full transition-colors ${currentStep > st.num ? "bg-emerald-500" : "bg-slate-100 dark:bg-slate-800"}`} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 1: BOOKING & CUSTOMER */}
          {currentStep === 1 && (
            <Step1BookingCustomer
              lang={lang}
              tt={tt}
              userContext={userContext}
              formData={formData}
              setFormData={setFormData}
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
            />
          )}

          {/* STEP 2: PICKUP, GOODS & TRUCK */}
          {currentStep === 2 && (
            <Step2PickupGoodsTruck
              lang={lang}
              tt={tt}
              formData={formData}
              setFormData={setFormData}
              handleGoodsSelect={handleGoodsSelect}
              saving={saving}
            />
          )}

          {/* STEP 3: ROUTE, VESSEL & CUSTOMS */}
          {currentStep === 3 && (
            <Step3RouteVesselCustoms
              lang={lang}
              tt={tt}
              formData={formData}
              setFormData={setFormData}
              countries={countries}
              partySelections={partySelections}
              customers={customers}
              companies={companies}
              customerOptions={customerOptions}
              companyOptions={companyOptions}
              orders={orders}
              loading={loading}
              handlePartyChange={handlePartyChange}
              updateLeg={updateLeg}
              addLeg={addLeg}
              removeLeg={removeLeg}
              seedLegsForSeaWithPreCarriage={seedLegsForSeaWithPreCarriage}
              countryBranches={countryBranches}
              cityBranches={cityBranches}
              assignableUsers={assignableUsers}
              editingOrderId={editingOrderId}
            />
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {currentStep === 4 && (
            <Step4ReviewConfirm
              lang={lang}
              tt={tt}
              formData={formData}
              partySelections={partySelections}
              clearingAgents={clearingAgents}
              shippingLines={shippingLines}
              userContext={userContext}
            />
          )}

          {/* Stepper Action Buttons (Previous, Save Progress, Next / Complete) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => (s - 1) as any)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {t(lang, "comv.back", "Back")}
                </button>
              ) : editingOrderId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                  {tt("cancel_edit", "Cancel")}
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {/* Save Progress / Draft Button (Available at ANY step) */}
              <button
                type="button"
                onClick={() => void handleSaveProgress(false)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 transition"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{t(lang, "comv.save_draft", "Save Draft")}</span>
              </button>

              {/* Next or Confirm Booking Button */}
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => void handleSaveProgress(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                >
                  <span>{t(lang, "comv.next_step", "Next Step")}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSaveProgress(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>{t(lang, "comv.confirm_booking", "Confirm Booking")}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side Register & Live Report (Prominent, High Visibility) */}
        <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 xl:col-span-7 xl:sticky xl:top-4 xl:self-start h-fit max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5">
          {/* Top KPI Cards */}
          <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20"><Route className="h-4 w-4" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">{tt("report_workspace", "Operations Workspace")}</p>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">{tt("live_report", "Live Customer Order Report")}</h2>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{tt("live", "Live")}</span>
            </div>
            {formData.legs.length > 0 || formData.customer_name ? (() => {
              const currentLeg = formData.legs.find((l) => l.status !== "completed") ?? formData.legs[formData.legs.length - 1];
              const responsibleName = currentLeg
                ? (currentLeg.responsibleUserId && assignableUsers.find((u) => u.id === currentLeg.responsibleUserId)?.name) ||
                  (currentLeg.responsibleClearingAgentId && clearingAgents.find((a) => a.id === currentLeg.responsibleClearingAgentId)?.name) ||
                  "-"
                : "-";
              const truckOrVessel = currentLeg
                ? currentLeg.transportMode === "by_road"
                  ? currentLeg.truckNumber || (currentLeg.truckRegistrationType ? `(${currentLeg.truckRegistrationType})` : "-")
                  : currentLeg.transportMode === "by_sea"
                    ? currentLeg.vesselName || "-"
                    : "-"
                : "-";
              const selectedCustomerInfo = customers.find((c) => c.id === formData.customer_id);
              const estimatedTotal = formData.legs.reduce((sum, l) => sum + (Number(l.estimatedExpenseAmount) || 0), 0);
              const actualTotal = formData.legs.reduce((sum, l) => sum + (Number(l.actualExpenseAmount) || 0), 0);
              const expenseCurrency = formData.legs.find((l) => l.expenseCurrency)?.expenseCurrency || "";
              const readinessItems = [
                { done: Boolean(formData.customer_name), label: t(lang, "comv.readiness_customer_selected", "Customer Selected") },
                { done: Boolean(formData.goods_name), label: t(lang, "comv.readiness_goods_added", "Goods Details Added") },
                { done: formData.legs.length > 0, label: t(lang, "comv.readiness_route_added", "Route Legs Added") },
                { done: formData.legs.some((l) => l.truckNumber || l.vesselName), label: t(lang, "comv.readiness_transport_assigned", "Truck / Vessel Assigned") },
                { done: formData.legs.some((l) => l.clearanceType), label: t(lang, "comv.readiness_customs_set", "Customs Info Set") }
              ];
              const cell = (label: string, value: string) => (
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="truncate text-[12px] font-black text-slate-800 dark:text-slate-100">{value || "-"}</p>
                </div>
              );
              return (
                <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white p-3.5 space-y-3 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
                        {t(lang, "comv.live_tracker_title", "This Order — Live")}
                      </p>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {formData.order_no || t(lang, "comv.live_tracker_unsaved", "Unsaved draft")} · {formData.customer_name || "-"}
                      </h3>
                    </div>
                    {currentLeg ? (
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                        {t(lang, ("comv.legstatus_" + currentLeg.status) as never, currentLeg.status.replace(/_/g, " "))}
                      </span>
                    ) : null}
                  </div>

                  {!currentLeg ? (
                    <p className="text-[11px] text-slate-500">{t(lang, "comv.no_legs_yet", "No route legs added yet. Add a leg for each country/mode crossing.")}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {cell(t(lang, "comv.live_current_location", "Current Location"), `${currentLeg.fromCountryName || "?"} — ${currentLeg.fromLocationText || "?"}`)}
                      {cell(t(lang, "comv.live_next_destination", "Next Destination"), `${currentLeg.toCountryName || "?"} — ${currentLeg.toLocationText || "?"}`)}
                      {cell(t(lang, "comv.live_responsible", "Responsible"), responsibleName)}
                      {cell(t(lang, "comv.live_truck_vessel", "Truck / Vessel"), truckOrVessel)}
                      {cell(
                        t(lang, "comv.live_customs", "Customs"),
                        currentLeg.clearanceType
                          ? `${tt(("mv_" + currentLeg.clearanceType) as any, currentLeg.clearanceType)} · ${t(lang, ("comv.customsstatus_" + (currentLeg.customsStatus || "not_applicable")) as never, currentLeg.customsStatus || "not_applicable")}`
                          : t(lang, "comv.customsstatus_not_applicable", "not applicable")
                      )}
                      {cell(
                        t(lang, "comv.live_duty", "Duty / No Duty"),
                        currentLeg.dutyTreatment ? t(lang, ("comv.duty_" + currentLeg.dutyTreatment.replace("duty_", "")) as never, currentLeg.dutyTreatment) : "-"
                      )}
                      {cell(t(lang, "comv.live_goods", "Goods"), `${formData.goods_name || "-"} ${formData.goods_quantity ? `(${formData.goods_quantity} ${formData.goods_unit})` : ""}`)}
                      {cell(t(lang, "comv.live_remarks", "Remarks"), currentLeg.remarks || "-")}
                    </div>
                  )}

                  {/* Shipment Progress timeline + Customer / Vehicle / Readiness snapshot cards */}
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <Repeat2 className="h-3.5 w-3.5 text-indigo-500" />
                        {t(lang, "comv.shipment_progress", "Shipment Progress")}
                      </p>
                      <ol className="space-y-0">
                        {LEG_STATUS_SEQUENCE.map((stage, idx) => {
                          const currentIdx = currentLeg ? LEG_STATUS_SEQUENCE.indexOf(currentLeg.status as any) : -1;
                          const isDone = currentLeg ? idx < currentIdx || currentLeg.status === "completed" : false;
                          const isCurrent = currentLeg ? idx === currentIdx && currentLeg.status !== "completed" : false;
                          return (
                            <li key={stage} className="flex items-start gap-2.5">
                              <div className="flex flex-col items-center">
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-black ${
                                    isDone
                                      ? "bg-emerald-500 text-white"
                                      : isCurrent
                                        ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950/60"
                                        : "bg-slate-200 dark:bg-slate-700"
                                  }`}
                                >
                                  {isDone ? "✓" : ""}
                                </span>
                                {idx < LEG_STATUS_SEQUENCE.length - 1 ? (
                                  <span className={`h-4 w-0.5 ${isDone ? "bg-emerald-400" : "bg-slate-150 dark:bg-slate-800"}`} />
                                ) : null}
                              </div>
                              <div className="pb-2.5">
                                <p className={`text-[11px] font-bold ${isCurrent ? "text-blue-700 dark:text-blue-300" : isDone ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}`}>
                                  {t(lang, ("comv.legstatus_" + stage) as never, stage.replace(/_/g, " "))}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    <div className="space-y-3 lg:col-span-2">
                      {selectedCustomerInfo ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <Users className="h-3.5 w-3.5 text-blue-500" />
                            {t(lang, "comv.customer_snapshot", "Customer")}
                          </p>
                          <p className="text-xs font-black text-slate-900 dark:text-white">{selectedCustomerInfo.customer_name}</p>
                          <p className="text-[10.5px] text-slate-500">{selectedCustomerInfo.person_code || "-"}</p>
                          <div className="mt-1.5 space-y-0.5 text-[10.5px] text-slate-600 dark:text-slate-400">
                            {selectedCustomerInfo.mobile ? <p>{t(lang, "acct.phone", "Phone")}: {selectedCustomerInfo.mobile}</p> : null}
                            {selectedCustomerInfo.email ? <p className="truncate">{t(lang, "branch.row_email", "Email")}: {selectedCustomerInfo.email}</p> : null}
                          </div>
                        </div>
                      ) : null}

                      {currentLeg && (currentLeg.truckNumber || currentLeg.vesselName) ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <Truck className="h-3.5 w-3.5 text-amber-500" />
                            {t(lang, "comv.vehicle_container", "Vehicle / Container")}
                          </p>
                          <div className="space-y-0.5 text-[10.5px] text-slate-600 dark:text-slate-400">
                            {currentLeg.truckNumber ? <p><span className="text-slate-400">{t(lang, "com.truck_number", "Truck Number")}:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{currentLeg.truckNumber}</span></p> : null}
                            {currentLeg.truckDriverName ? <p><span className="text-slate-400">{t(lang, "plr.driver_name", "Driver Name")}:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{currentLeg.truckDriverName}</span></p> : null}
                            {currentLeg.truckDriverMobile ? <p><span className="text-slate-400">{t(lang, "com.truck_driver_mobile", "Driver Mobile")}:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{currentLeg.truckDriverMobile}</span></p> : null}
                            {currentLeg.vesselName ? <p><span className="text-slate-400">{t(lang, "comv.vessel_name", "Vessel Name")}:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{currentLeg.vesselName}</span></p> : null}
                            {currentLeg.containerNumber ? <p><span className="text-slate-400">{t(lang, "comv.container_number", "Container No.")}:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{currentLeg.containerNumber}</span></p> : null}
                            {currentLeg.sealNumber ? <p><span className="text-slate-400">{t(lang, "comv.seal_number", "Seal No.")}:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{currentLeg.sealNumber}</span></p> : null}
                          </div>
                        </div>
                      ) : null}

                      {estimatedTotal > 0 || actualTotal > 0 ? (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            {t(lang, "comv.estimated_costs", "Estimated Costs (Ref.)")}
                          </p>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">{t(lang, "comv.estimate", "Estimated")}</span>
                            <span className="font-black text-slate-800 dark:text-slate-100">{estimatedTotal.toLocaleString()} {expenseCurrency}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">{t(lang, "comv.actual", "Actual")}</span>
                            <span className="font-black text-emerald-700 dark:text-emerald-400">{actualTotal.toLocaleString()} {expenseCurrency}</span>
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          {t(lang, "comv.order_readiness", "Order Readiness")}
                        </p>
                        <ul className="space-y-1">
                          {readinessItems.map((item) => (
                            <li key={item.label} className="flex items-center gap-1.5 text-[10.5px]">
                              <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7px] font-black ${item.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400 dark:bg-slate-700"}`}>
                                {item.done ? "✓" : ""}
                              </span>
                              <span className={item.done ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}>{item.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : null}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* 1. Order Summary */}
              <div className="rounded-xl border border-blue-100 bg-white p-3 dark:border-blue-900/50 dark:bg-slate-900 flex flex-col justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"><FileText className="h-3.5 w-3.5" /></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_order_summary", "Order Summary")}</span>
                </div>
                <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{orderCounts.total}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-bold">
                  <span className="text-slate-500">Draft: {orders.filter(o => !o.status || o.status === "draft").length}</span>
                  <span className="text-red-500">Active: {orders.filter(o => o.status === "confirmed" || o.status === "accepted" || o.status === "in_progress").length}</span>
                  <span className="text-emerald-600">Done: {orders.filter(o => o.status === "completed").length}</span>
                </div>
              </div>

              {/* 2. Movements */}
              <div className="rounded-xl border border-purple-100 bg-white p-3 dark:border-purple-900/50 dark:bg-slate-900 flex flex-col justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"><Route className="h-3.5 w-3.5" /></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_movements", "Movements")}</span>
                </div>
                <div className="mt-1 text-lg font-black text-purple-600 dark:text-purple-400">{orderCounts.total}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-bold">
                  <span className="text-emerald-600">Imp: {orderCounts.import}</span>
                  <span className="text-purple-600">Exp: {orderCounts.export}</span>
                  <span className="text-amber-600">Dom/Tr: {orderCounts.domestic + orderCounts.transit}</span>
                </div>
              </div>

              {/* 3. Locations & Ports */}
              <div className="rounded-xl border border-sky-100 bg-white p-3 dark:border-sky-900/50 dark:bg-slate-900 flex flex-col justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400"><Anchor className="h-3.5 w-3.5" /></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_locations", "Locations & Ports")}</span>
                </div>
                <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{countries.length} <span className="text-[10px] font-normal text-slate-500">Countries</span></div>
                <div className="mt-1 text-[9px] font-bold text-slate-500">
                  <span>{ports.length} Active Ports</span>
                </div>
              </div>

              {/* 4. This Month */}
              <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-emerald-900/50 dark:bg-slate-900 flex flex-col justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"><Boxes className="h-3.5 w-3.5" /></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_this_month", "This Month")}</span>
                </div>
                <div className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">{orders.length}</div>
                <div className="mt-1 text-[9px] font-bold text-slate-500">
                  <span>Orders Logged</span>
                </div>
              </div>

              {/* 5. Quick Info */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"><BadgeInfo className="h-3.5 w-3.5" /></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_quick_info", "Quick Info")}</span>
                </div>
                <div className="mt-1 text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">DGT LLC</div>
                <div className="mt-0.5 text-[9px] font-medium text-slate-500">
                  Clearing • FY 2026
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{tt("registered_orders", "Registered Customer Orders")} ({orders.length})</h2>
                <p className="text-[11px] text-slate-500">
                  {tt("live_report_hint", "Live report driven from canonical shipping orders and linked parties.")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  title={tt("export_csv","Export to CSV")}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <div className="w-full sm:w-auto">
                  <SmartSearchFilter
                    value={filterState}
                    onChange={setFilterState}
                    hideHeader
                    hideCascadingLocations
                    hideRiskLevel
                    hideDateRange
                    hideModule
                    hideUser
                    hideCurrency
                    placeholder={tt("search_order_ph", "Search order, party, route...")}
                    className="p-2 border-0 bg-transparent shadow-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Orders Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100"><FileText className="h-4 w-4 text-blue-600" />{tt("order_register", "Order Register")}</div>
              <span className="text-[10px] font-bold text-slate-500">{visibleOrders.length} / {orders.length} {tt("visible", "visible")}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <Th className="px-3 py-2.5">#</Th>
                    <Th className="px-3 py-2.5">{tt("th_order_no", "Order No")}</Th>
                    <Th className="px-3 py-2.5">{tt("th_step_status", "Progress")}</Th>
                    <Th className="px-3 py-2.5">{tt("th_party", "Supplier / Order Party")}</Th>
                    <Th className="px-3 py-2.5">{tt("th_goods", "Goods")}</Th>
                    <Th className="px-3 py-2.5">{tt("th_movement", "Movement")}</Th>
                    <Th className="px-3 py-2.5">{tt("th_route", "Route / Ports")}</Th>
                    <Th className="px-3 py-2.5 text-right">{tt("th_actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        {tt("no_orders_found", "No customer orders found. Fill out the 4-step form on the left to create one.")}
                      </td>
                    </tr>
                  ) : (
                    visibleOrders.map((order, index) => {
                      const prog = getOrderProgress(order);
                      const isSelected = editingOrderId === order.id;
                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-slate-50/80 transition dark:hover:bg-slate-800/50 ${
                            isSelected ? "bg-blue-50/60 dark:bg-blue-950/30 font-semibold" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 font-bold text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{order.order_no || `CL-${order.id.slice(0, 6)}`}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${prog.color}`}>
                              {prog.label}
                            </span>
                            {order.status === "pending_approval" || order.status === "approved" || order.status === "rejected" ? (
                              <span className={`ms-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                order.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                  : order.status === "rejected"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              }`}>
                                {order.status === "approved"
                                  ? t(lang, "comv.approval_approved", "Approved")
                                  : order.status === "rejected"
                                  ? t(lang, "comv.approval_rejected", "Rejected")
                                  : t(lang, "comv.approval_pending", "Pending Approval")}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {order.customer_name || "-"}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{order.goods_name || "-"}</div>
                            {order.goods_chs_code ? <div className="text-[10px] text-slate-500 font-mono">CHS: {order.goods_chs_code}</div> : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="capitalize text-slate-700 dark:text-slate-300 font-semibold">{order.movement_type || "-"}</span>
                            <div className="text-[10px] text-slate-400 capitalize">{order.transport_mode?.replace("_", " ") || "-"}</div>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                            <div>{order.route_name || [order.loading_country_name, order.receiving_country_name].filter(Boolean).join(" → ") || "-"}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => loadEditOrder(order)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                                title={tt("edit_resume_step","Edit / Resume Step")}
                              >
                                <Pencil className="h-3.5 w-3.5 text-blue-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewOrder(order)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                                title={tt("view_details","View Details")}
                              >
                                <Eye className="h-3.5 w-3.5 text-emerald-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintOrder(order)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                                title={tt("print","Print")}
                              >
                                <Printer className="h-3.5 w-3.5 text-amber-600" />
                              </button>
                              {order.status === "booking_confirmed" ? (
                                <button
                                  type="button"
                                  onClick={() => void handleOrderApprovalAction(order.id, "submit")}
                                  disabled={approvalActionOrderId === order.id}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
                                  title={tt("submit_for_approval", "Submit for Approval")}
                                >
                                  {tt("submit_for_approval", "Submit for Approval")}
                                </button>
                              ) : null}
                              {order.status === "pending_approval" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleOrderApprovalAction(order.id, "approve")}
                                    disabled={approvalActionOrderId === order.id}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    title={tt("approve_order", "Approve")}
                                  >
                                    {tt("approve_order", "Approve")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleOrderApprovalAction(order.id, "reject")}
                                    disabled={approvalActionOrderId === order.id}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                                    title={tt("reject_order", "Reject")}
                                  >
                                    {tt("reject_order", "Reject")}
                                  </button>
                                </>
                              ) : null}
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
        </div>
      </div>

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
  handlePartyChange,
  handleLoadingCountryChange,
  handleReceivingCountryChange,
  handleLoadingPortChange,
  handleDestinationPortChange
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  tt: (k: string, f: string) => string;
  userContext: { context: BranchUserContext | null; loading: boolean; error: string | null };
  formData: FormDataState;
  setFormData: SetFormData;
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
  handlePartyChange: (roleKey: PartyRoleKey, next: PartySelection) => void;
  handleLoadingCountryChange: (countryId: string) => void;
  handleReceivingCountryChange: (countryId: string) => void;
  handleLoadingPortChange: (portId: string) => void;
  handleDestinationPortChange: (portId: string) => void;
}) {
  const ctx = userContext.context;
  const selectedCustomer = customers.find((c) => c.id === formData.customer_id);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      <SectionHeading num={1} icon={Boxes} title={t(lang, "comv.step1_title", "Booking & Customer")} />

      {/* Serial bar — role-gated visibility (spec point 2); Global Bill/Shipping No. always shown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-850">
        {canSeeSerial("super", ctx) ? (
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-slate-500 uppercase">{t(lang, "comv.serial_super_admin", "Super Admin")}</div>
            <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{formData.super_admin_serial || "—"}</div>
          </div>
        ) : null}
        {canSeeSerial("country", ctx) ? (
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-slate-500 uppercase">{t(lang, "comv.serial_country", "Country Serial")}</div>
            <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{formData.country_serial || "—"}</div>
          </div>
        ) : null}
        {canSeeSerial("branch", ctx) ? (
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-slate-500 uppercase">{t(lang, "comv.serial_branch", "Branch Serial")}</div>
            <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{formData.branch_serial || "—"}</div>
          </div>
        ) : null}
        <div className="space-y-0.5">
          <div className="text-[9px] font-bold text-slate-500 uppercase">{t(lang, "comv.serial_global_bill", "Global Bill / Shipping No.")}</div>
          <div className="text-xs font-black text-blue-600 dark:text-blue-400 truncate">{formData.order_no || t(lang, "comv.serial_auto", "Auto on Save")}</div>
        </div>
      </div>

      {/* Customer / Ledger Account Search & Select */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-blue-600" />
            <span>{t(lang, "comv.customer_ledger_account_req", "Customer / Ledger Account *")}</span>
          </label>
          {formData.customer_name ? (
            <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
              ✓ {formData.customer_name}
            </span>
          ) : null}
        </div>
        <SearchSelect
          label={t(lang, "comv.select_customer_account", "Select Customer Account")}
          value={formData.customer_id}
          options={customerOptions}
          placeholder={t(lang, "comv.search_customer_full_ph", "Search customer by name, code or mobile...")}
          onValueChange={(cid) => {
            const cust = customers.find((c) => c.id === cid);
            if (cust) {
              setFormData((prev) => ({ ...prev, customer_id: cust.id, customer_name: cust.customer_name }));
              handlePartyChange("supplier", {
                ...partySelections.supplier,
                customerId: cust.id,
                customerName: cust.customer_name,
                addressText: partySelections.supplier.addressText || cust.address || ""
              });
            }
          }}
          disabled={loading}
          searchPlaceholder={t(lang, "comv.search_customer_ph", "Search customer name or code...")}
          emptyLabel={t(lang, "comv.no_customers_found", "No customers found")}
        />

        {/* Live account details side panel — spec point 3 */}
        {selectedCustomer ? (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] dark:border-slate-800 dark:bg-slate-800/50">
            <div>
              <span className="text-slate-500 font-semibold">{t(lang, "comv.acc_name", "Account Name:")}</span>{" "}
              <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.customer_name}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">{t(lang, "comv.acc_number", "Account No.:")}</span>{" "}
              <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.person_code || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">{t(lang, "comv.acc_company", "Company:")}</span>{" "}
              <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.company_name || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">{t(lang, "comv.acc_country", "Country:")}</span>{" "}
              <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.country_name || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">{t(lang, "comv.acc_branch", "Branch / City:")}</span>{" "}
              <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.city_name || "-"}</span>
            </div>
          </div>
        ) : null}
      </div>

      <PartyRolePanel
        roleKey="supplier"
        label={tt("role_supplier", "Supplier / Order Party")}
        required
        selection={partySelections.supplier}
        customers={customers}
        companies={companies}
        customerOptions={customerOptions}
        companyOptions={companyOptions}
        orders={orders}
        disabled={loading}
        lang={lang}
        onChange={(next) => handlePartyChange("supplier", next)}
      />

      <PartyRolePanel
        roleKey="buyer"
        label={tt("role_buyer", "Buyer")}
        selection={partySelections.buyer}
        customers={customers}
        companies={companies}
        customerOptions={customerOptions}
        companyOptions={companyOptions}
        orders={orders}
        disabled={loading}
        lang={lang}
        onChange={(next) => handlePartyChange("buyer", next)}
      />

      {/* Movement Type & Shipment Type — movement kept fully independent from transport mode (spec point 4) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{tt("movement_type", "Movement Type")} *</label>
          <select
            value={formData.movement_type}
            onChange={(e) => setFormData((current) => ({ ...current, movement_type: e.target.value as MovementType }))}
            className={selectClass}
          >
            <option value="import">{tt("mv_import", "Import")}</option>
            <option value="export">{tt("mv_export", "Export")}</option>
            <option value="transit">{t(lang, "comv.mv_transit", "Transit")}</option>
            <option value="up_transit">{tt("mv_up_transit", "Up Transit")}</option>
            <option value="down_transit">{t(lang, "comv.mv_down_transit", "Down Transit")}</option>
            <option value="domestic">{t(lang, "comv.mv_local_domestic", "Local / Domestic")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{tt("shipment_type", "Shipment Type")}</label>
          <select
            value={formData.shipment_type}
            onChange={(e) => setFormData((current) => ({ ...current, shipment_type: e.target.value }))}
            className={selectClass}
          >
            <option value="FCL">{tt("ship_fcl", "FCL (Full Container Load)")}</option>
            <option value="LCL">{tt("ship_lcl", "LCL (Less than Container)")}</option>
            <option value="Loose Cargo">{tt("ship_loose", "Loose Cargo")}</option>
            <option value="Bulk Cargo">{tt("ship_bulk", "Bulk Cargo")}</option>
          </select>
        </div>
      </div>

      {/* Transport Mode — Sea / Road / Air / Rail only (spec point 4: never mixed with movement type) */}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("transport_mode", "Transport Mode")} *</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "by_sea", label: tt("tm_by_sea", "By Sea"), icon: Anchor },
            { key: "by_road", label: tt("tm_by_road", "By Road"), icon: MapPin },
            { key: "by_air", label: tt("tm_by_air", "By Air"), icon: Plane },
            { key: "by_rail", label: t(lang, "comv.tm_by_rail", "By Rail"), icon: Route }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData((current) => ({ ...current, transport_mode: key as TransportMode }))}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                formData.transport_mode === key
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300"
                  : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Receiving Country + Location (spec point 4) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5 text-blue-600" />
          <span>{t(lang, "comv.route_countries_req", "Loading & Destination *")}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
              {t(lang, "comv.loading_country_step", "Loading Country *")}
            </label>
            <select value={formData.loading_country_id} onChange={(e) => handleLoadingCountryChange(e.target.value)} className={selectClass}>
              <option value="">{t(lang, "comv.select_loading_country_ph", "— Select Loading Country —")}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={formData.loading_city_id}
              onChange={(e) => setFormData((current) => ({ ...current, loading_city_id: e.target.value }))}
              disabled={!formData.loading_country_id}
              className={selectClass}
            >
              <option value="">{t(lang, "comv.select_loading_location_ph", "— Select Location / City —")}</option>
              {loadingCities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
              {t(lang, "comv.receiving_country_step", "Final Destination Country *")}
            </label>
            <select value={formData.receiving_country_id} onChange={(e) => handleReceivingCountryChange(e.target.value)} className={selectClass}>
              <option value="">{t(lang, "comv.select_receiving_country_ph", "— Select Receiving Country —")}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={formData.receiving_city_id}
              onChange={(e) => setFormData((current) => ({ ...current, receiving_city_id: e.target.value }))}
              disabled={!formData.receiving_country_id}
              className={selectClass}
            >
              <option value="">{t(lang, "comv.select_receiving_location_ph", "— Select Location / City —")}</option>
              {receivingCities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{tt("loading_port", "Loading Port")}</label>
          <select value={formData.loading_port_id} onChange={(e) => handleLoadingPortChange(e.target.value)} className={selectClass}>
            <option value="">{tt("select_loading_port", "Select Loading Port")}</option>
            {ports.map((port) => (
              <option key={port.id} value={port.id}>{port.port_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{tt("destination_port", "Destination Port")}</label>
          <select value={formData.destination_port_id} onChange={(e) => handleDestinationPortChange(e.target.value)} className={selectClass}>
            <option value="">{tt("select_destination_port", "Select Destination Port")}</option>
            {ports.map((port) => (
              <option key={port.id} value={port.id}>{port.port_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{tt("expected_loading_date", "Expected Loading Date")}</label>
          <input
            type="date"
            value={formData.expected_loading_date}
            onChange={(e) => setFormData((current) => ({ ...current, expected_loading_date: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{tt("route_reference", "Route / Reference")}</label>
          <input
            type="text"
            placeholder={tt("route_ph", "e.g. Karachi to Kabul via Torkham")}
            value={formData.route_name}
            onChange={(e) => setFormData((current) => ({ ...current, route_name: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>{tt("cargo_container_details", "Cargo / Container Details")}</label>
        <input
          type="text"
          placeholder={tt("cargo_ph", "e.g. 40ft High Cube Container")}
          value={formData.cargo_details}
          onChange={(e) => setFormData((current) => ({ ...current, cargo_details: e.target.value }))}
          className={inputClass}
        />
      </div>
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
        <label className={labelClass}>{tt("remarks", "Remarks")}</label>
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
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{tt("remarks", "Remarks")}</label>
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
  clearingAgents,
  shippingLines,
  userContext
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  tt: (k: string, f: string) => string;
  formData: FormDataState;
  partySelections: Record<PartyRoleKey, PartySelection>;
  clearingAgents: ClearingAgentRow[];
  shippingLines: ShippingLineRow[];
  userContext: { context: BranchUserContext | null; loading: boolean; error: string | null };
}) {
  const ctx = userContext.context;
  const agentName = (id: string) => clearingAgents.find((a) => a.id === id)?.name || summaryValue(id);
  const lineName = (id: string) => shippingLines.find((l) => l.id === id)?.name || summaryValue(id);

  const row = (label: string, value?: string | null) => (
    <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-slate-500 font-semibold">{label}</span>
      <span className="font-bold text-slate-900 dark:text-slate-100 text-right">{summaryValue(value)}</span>
    </div>
  );

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      <SectionHeading num={4} icon={CheckCircle2} title={t(lang, "comv.step4_title", "Review & Confirm")} />

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{t(lang, "comv.review_references", "References")}</div>
        {canSeeSerial("super", ctx) ? row(t(lang, "comv.serial_super_admin", "Super Admin"), formData.super_admin_serial) : null}
        {canSeeSerial("country", ctx) ? row(t(lang, "comv.serial_country", "Country Serial"), formData.country_serial) : null}
        {canSeeSerial("branch", ctx) ? row(t(lang, "comv.serial_branch", "Branch Serial"), formData.branch_serial) : null}
        {row(t(lang, "comv.serial_entry", "Entry Number"), formData.entry_serial)}
        {row(t(lang, "comv.serial_global_bill", "Global Bill / Shipping No."), formData.order_no)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{t(lang, "comv.review_booking", "Booking & Customer")}</div>
        {row(tt("role_supplier", "Supplier / Order Party"), partySelections.supplier.customerName || formData.customer_name)}
        {row(tt("role_buyer", "Buyer"), partySelections.buyer.customerName)}
        {row(tt("movement_type", "Movement Type"), formData.movement_type)}
        {row(tt("transport_mode", "Transport Mode"), formData.transport_mode)}
        {row(t(lang, "comv.loading_country_step", "Loading Country"), formData.loading_country_name)}
        {row(t(lang, "comv.receiving_country_step", "Final Destination Country"), formData.receiving_country_name)}
        {row(tt("loading_port", "Loading Port"), formData.loading_port_name)}
        {row(tt("destination_port", "Destination Port"), formData.destination_port_name)}
        {row(tt("route_reference", "Route / Reference"), formData.route_name)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{t(lang, "comv.review_pickup_goods_truck", "Pickup, Goods & Truck")}</div>
        {row(tt("loading_source", "Pickup Source"), formData.loading_source_name || formData.loading_source)}
        {row(tt("goods_master", "Goods"), formData.goods_name ? `${formData.goods_name}${formData.goods_chs_code ? " • " + formData.goods_chs_code : ""}` : null)}
        {row(t(lang, "comv.goods_quantity", "Quantity"), formData.goods_quantity ? `${formData.goods_quantity} ${formData.goods_unit}` : null)}
        {row(t(lang, "comv.goods_bags_cartons", "Bags / Cartons"), formData.goods_bags_cartons)}
        {row(t(lang, "comv.goods_gross_weight", "Gross Weight"), formData.goods_gross_weight)}
        {row(t(lang, "comv.load_type", "Load Type"), formData.load_type)}
        {row(t(lang, "comv.truck_requirement", "Truck"), formData.truck_number)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(lang, "comv.review_route_legs", "Route Legs")}</div>
        {formData.legs.length === 0 ? (
          <p className="text-slate-400">{t(lang, "comv.no_legs_yet", "No route legs added yet. Add a leg for each country/mode crossing.")}</p>
        ) : (
          formData.legs.map((leg, idx) => (
            <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/40 space-y-0.5">
              <div className="font-black text-blue-700 dark:text-blue-400">
                {t(lang, "comv.leg_no", "Leg")} #{leg.legNo}: {summaryValue(leg.fromCountryName || leg.fromLocationText)} → {summaryValue(leg.toCountryName || leg.toLocationText)} ({leg.transportMode || "-"})
              </div>
              {row(t(lang, "comv.responsible_agent", "Responsible Clearing Agent"), leg.responsibleClearingAgentId ? agentName(leg.responsibleClearingAgentId) : null)}
              {leg.transportMode === "by_sea" ? row(t(lang, "comv.shipping_line", "Shipping Line"), leg.shippingLineId ? lineName(leg.shippingLineId) : null) : null}
              {row(t(lang, "comv.clearance_type", "Clearance Type"), leg.clearanceType)}
              {row(t(lang, "comv.duty_treatment", "Duty Treatment"), leg.dutyTreatment)}
              {row(t(lang, "comv.leg_status", "Leg Status"), leg.status)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
