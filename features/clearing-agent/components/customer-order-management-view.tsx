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
import { listCities } from "@/features/locations/location-api";

type TransportMode = "by_sea" | "by_road" | "by_air" | "by_rail";
type MovementType = "import" | "export" | "transit" | "up_transit" | "down_transit" | "domestic";
type LoadingSource = "shipping_warehouse" | "customer_warehouse" | "container" | "port_terminal" | "border_yard" | "other";
type LoadType = "full_truck" | "partial_load" | "container_haulage";
type LegTransportMode = "by_sea" | "by_road" | "by_air" | "by_rail";
type ClearanceType = "import" | "export" | "transit";
type DutyTreatment = "duty_payable" | "no_duty_exempt" | "transit_bonded" | "pending";

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
    status: "pending", handoverId: "", remarks: ""
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
  legs: [] as RouteLeg[]
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
  const userContext = useBranchUserContext();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [orders, setOrders] = useState<ClearingCustomerOrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [clearingAgents, setClearingAgents] = useState<ClearingAgentRow[]>([]);
  const [shippingLines, setShippingLines] = useState<ShippingLineRow[]>([]);
  const [loadingCities, setLoadingCities] = useState<CityRow[]>([]);
  const [receivingCities, setReceivingCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
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
      const [orderRes, customerRes, companyRes, countryRes, portRes, agentRes, lineRes] = await Promise.all([
        fetch("/api/erp/clearing-agent/customer-order"),
        fetch("/api/erp/customers?limit=250"),
        fetch("/api/erp/companies?limit=250"),
        fetch("/api/erp/locations/countries"),
        fetch("/api/erp/ports"),
        fetch("/api/erp/clearing-agents?limit=200"),
        fetch("/api/erp/shipping-lines?limit=200")
      ]);

      const [orderJson, customerJson, companyJson, countryJson, portJson, agentJson, lineJson] = await Promise.all([
        orderRes.json(),
        customerRes.json(),
        companyRes.json(),
        countryRes.json(),
        portRes.json(),
        agentRes.json(),
        lineRes.json()
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
            remarks: leg.remarks || ""
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
      "Order No",
      "Party",
      "Goods",
      "CHS Code",
      "Movement",
      "Transport",
      "Shipment",
      "Loading Source",
      "Route",
      "Supplier",
      "Importer",
      "Exporter",
      "Buyer",
      "Created Date"
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
          remarks: leg.remarks || null
        }))
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
    <div className="w-full space-y-4 pb-12">
      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                {tt("header_entry", "Customer Order Entry")}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                {t(lang, "comv.four_step_wizard", "4-Step Progressive Wizard")}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                {tt("header_next", "Next")}: {currentStep < 4 ? stepsList[currentStep]?.title : t(lang, "comv.confirm_booking", "Confirm Booking")}
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">{tt("title", "Customer Order")}</h1>
            <p className="max-w-4xl text-xs text-slate-500 dark:text-slate-400">
              {lang === "ur"
                ? "چار آسان مراحل میں کسٹمر آرڈر درج کریں، کسی بھی مرحلے پر بغیر مکمل کیے محفوظ کریں اور بعد میں مکمل کریں۔"
                : "Enter customer shipping orders in 4 easy steps. Save progress at any step and complete later."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchInitialData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {refreshLabel}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left Form: Compact 4-Step Wizard */}
        <div className="space-y-4 self-start rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:col-span-5 xl:sticky xl:top-4">
          {/* Stepper Navigation Bar */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "comv.step_x_of_4", "Step {n} of 4").replace("{n}", String(currentStep))}
              </span>
              {editingOrderId ? (
                <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                  Editing: {formData.customer_name || "Order"}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {stepsList.map((st) => {
                const isActive = currentStep === st.num;
                const isPast = currentStep > st.num;
                return (
                  <button
                    key={st.num}
                    type="button"
                    onClick={() => setCurrentStep(st.num as any)}
                    className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all ${
                      isActive
                        ? "border-blue-600 bg-blue-50/80 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200 shadow-xs"
                        : isPast
                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-1 w-full">
                      <span
                        className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : isPast
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {isPast ? "✓" : st.num}
                      </span>
                      <span className="text-[10px] font-bold truncate">{st.title}</span>
                    </div>
                  </button>
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
        <div className="space-y-4 xl:col-span-7 xl:sticky xl:top-4 xl:self-start h-fit max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5">
          {/* Top KPI Cards */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* 1. Order Summary */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{tt("kpi_order_summary", "Order Summary")}</span>
                </div>
                <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{orderCounts.total}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-bold">
                  <span className="text-slate-500">Draft: {orders.filter(o => !o.status || o.status === "draft").length}</span>
                  <span className="text-red-500">Active: {orders.filter(o => o.status === "confirmed" || o.status === "accepted" || o.status === "in_progress").length}</span>
                  <span className="text-emerald-600">Done: {orders.filter(o => o.status === "completed").length}</span>
                </div>
              </div>

              {/* 2. Movements */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Route className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>{tt("kpi_movements", "Movements")}</span>
                </div>
                <div className="mt-1 text-lg font-black text-purple-600 dark:text-purple-400">{orderCounts.total}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-bold">
                  <span className="text-emerald-600">Imp: {orderCounts.import}</span>
                  <span className="text-purple-600">Exp: {orderCounts.export}</span>
                  <span className="text-amber-600">Dom/Tr: {orderCounts.domestic + orderCounts.transit}</span>
                </div>
              </div>

              {/* 3. Locations & Ports */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Anchor className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{tt("kpi_locations", "Locations & Ports")}</span>
                </div>
                <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{countries.length} <span className="text-[10px] font-normal text-slate-500">Countries</span></div>
                <div className="mt-1 text-[9px] font-bold text-slate-500">
                  <span>{ports.length} Active Ports</span>
                </div>
              </div>

              {/* 4. This Month */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Boxes className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{tt("kpi_this_month", "This Month")}</span>
                </div>
                <div className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">{orders.length}</div>
                <div className="mt-1 text-[9px] font-bold text-slate-500">
                  <span>Orders Logged</span>
                </div>
              </div>

              {/* 5. Quick Info */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60 flex flex-col justify-between col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <BadgeInfo className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  <span>{tt("kpi_quick_info", "Quick Info")}</span>
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
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
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

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans";
const inputClass = selectClass;
const labelClass = "mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300";

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
      <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
        <Boxes className="h-4 w-4" />
        <span>1. {t(lang, "comv.step1_title", "Booking & Customer")}</span>
      </div>

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
      <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
        <Warehouse className="h-4 w-4" />
        <span>2. {t(lang, "comv.step2_title", "Pickup, Goods & Truck")}</span>
      </div>

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
  seedLegsForSeaWithPreCarriage
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
}) {
  const showAutoSeed =
    formData.transport_mode === "by_sea" && formData.loading_source !== "port_terminal" && formData.legs.length === 0;

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
        <Route className="h-4 w-4" />
        <span>3. {t(lang, "comv.step3_title", "Route, Vessel & Customs")}</span>
      </div>

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

                {leg.dutyTreatment === "duty_payable" ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <input type="number" placeholder={t(lang, "comv.duty_amount", "Duty Amount")} value={leg.dutyAmount} onChange={(e) => updateLeg(idx, { dutyAmount: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.duty_currency", "Currency")} value={leg.dutyCurrency} onChange={(e) => updateLeg(idx, { dutyCurrency: e.target.value })} className={inputClass} />
                    <input type="text" placeholder={t(lang, "comv.duty_payer", "Payer")} value={leg.dutyPayer} onChange={(e) => updateLeg(idx, { dutyPayer: e.target.value })} className={inputClass} />
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.planned_departure", "Planned Departure")}</label>
                  <input type="date" value={leg.plannedDeparture} onChange={(e) => updateLeg(idx, { plannedDeparture: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{t(lang, "comv.planned_arrival", "Planned Arrival")}</label>
                  <input type="date" value={leg.plannedArrival} onChange={(e) => updateLeg(idx, { plannedArrival: e.target.value })} className={inputClass} />
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
      <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
        <CheckCircle2 className="h-4 w-4" />
        <span>4. {t(lang, "comv.step4_title", "Review & Confirm")}</span>
      </div>

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
