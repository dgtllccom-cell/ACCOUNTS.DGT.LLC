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
  const [approvalActionOrderId, setApprovalActionOrderId] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{ id: string; top: number; bottom: number; right: number } | null>(null);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);

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
      const [orderRes, customerRes, companyRes, countryRes, portRes, agentRes, lineRes, countryBranchRes, cityBranchRes, assigneeRes, accountRes] = await Promise.all([
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
        fetch("/api/erp/accounting/accounts?limit=1000").catch(() => null)
      ]);

      const [orderJson, customerJson, companyJson, countryJson, portJson, agentJson, lineJson, countryBranchJson, cityBranchJson, assigneeJson, accountJson] = await Promise.all([
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
        accountRes ? accountRes.json().catch(() => null) : null
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

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
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

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(tt("confirm_delete", "Are you sure you want to delete this customer order?"))) return;
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to delete order");
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
      {successMessage ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
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
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">{countries.length} <span className="text-xs font-normal text-slate-400">Countries</span></div>
              <div className="mt-1 text-[9.5px] font-semibold text-slate-500">{ports.length} Active Ports</div>
            </div>

            {/* 4. Total Volume */}
            <div className="rounded-xl border border-indigo-100 bg-white p-3.5 dark:border-indigo-900/40 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_total_volume", "Total Volume")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"><Scale className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xl font-black text-indigo-600 dark:text-indigo-400">{orderCounts.totalVolume.toLocaleString()} <span className="text-xs font-normal text-slate-400">MT</span></div>
              <div className="mt-1 text-[9.5px] font-semibold text-slate-500">Combined Cargo</div>
            </div>

            {/* 5. Active Routes */}
            <div className="rounded-xl border border-emerald-100 bg-white p-3.5 dark:border-emerald-900/40 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_active_routes", "Active Routes")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"><Globe2 className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">{orderCounts.uniqueRoutes}</div>
              <div className="mt-1 text-[9.5px] font-semibold text-slate-500">Cross-Border Routes</div>
            </div>

            {/* 6. Quick Info */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("kpi_quick_info", "Quick Info")}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"><BadgeInfo className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-2 text-xs font-black text-slate-800 dark:text-slate-200 truncate">{userContext.context?.branchName || "Global Group"}</div>
              <div className="mt-1 text-[9.5px] font-medium text-slate-500">Shipping & Clearing ERP</div>
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
                              title="Shipping / Clearing pipeline — truck, goods verification, customs, handover"
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
                              {prog.label}
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
                        onClick={() => setCurrentStep(st.num as any)}
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

          {/* Main 2-Column Content Grid: Left Inputs (7 cols) + Right Live Report (5 cols) */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start" dir="ltr">
            {/* LEFT COLUMN: The 4-Step Form Cards */}
            <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 xl:col-span-7">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {currentStep === 1 && (
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
                    onAdvanceToStep2={() => void handleSaveProgress(true)}
                  />
                )}

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

                {/* Stepper Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    {currentStep > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep((s) => (s - 1) as any);
                          if (currentStep === 2) setStep1SubStep("1C");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>{t(lang, "comv.back", "Previous")}</span>
                      </button>
                    ) : step1SubStep !== "1A" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (step1SubStep === "1C") setStep1SubStep("1B");
                          else if (step1SubStep === "1B") setStep1SubStep("1A");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>{step1SubStep === "1C" ? t(lang, "comv.prev_substep_1b", "Back to Movement") : t(lang, "comv.prev_substep_1a", "Back to Parties")}</span>
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

                    {currentStep < 4 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (currentStep === 1) {
                            if (step1SubStep === "1A") { setStep1SubStep("1B"); return; }
                            if (step1SubStep === "1B") { setStep1SubStep("1C"); return; }
                          }
                          void handleSaveProgress(true);
                        }}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
                      >
                        <span>
                          {currentStep === 1 && step1SubStep === "1A"
                            ? t(lang, "comv.next_substep_1b", "Continue to Transport")
                            : currentStep === 1 && step1SubStep === "1B"
                            ? t(lang, "comv.next_substep_1c", "Continue to Route")
                            : t(lang, "comv.next_step", "Next Step")}
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSaveProgress(true)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition"
                      >
                        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        <span>{t(lang, "comv.confirm_booking", "Confirm Booking")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: The Live Customer Order Report Panel (Screenshots 1, 2, 3) */}
            <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 xl:col-span-5 xl:sticky xl:top-4 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5">
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

                {/* Top 3 Party Cards (Customer, Shipper/Supplier, Buyer) */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {/* Card 1: Customer */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      <Users className="h-3.5 w-3.5" />
                      <span>{tt("customer", "Customer")}</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                      {formData.customer_name || "Abdul Mateen Khan"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {selectedCustomerInfo?.person_code || "PR-0000106"}
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                      {selectedCustomerInfo?.mobile || "+92 300 123 4567"}
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate">
                      {selectedCustomerInfo?.email || "abdul.mateen@traders.com"}
                    </div>
                  </div>

                  {/* Card 2: Shipper / Supplier / Order Party */}
                  <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-2.5 dark:border-purple-900/40 dark:bg-purple-950/20 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="truncate">{tt("party_shipper_supplier", "Shipper / Supplier")}</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                      {formData.exporter_name || partySelections.supplier?.companyName || "Golden Grains Trading LLC"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {selectedSupplierInfo?.person_code || "SUP-0000243"}
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                      {selectedSupplierInfo?.mobile || "+971 4 345 6789"}
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate">
                      {selectedSupplierInfo?.email || "sales@goldengrains.ae"}
                    </div>
                  </div>

                  {/* Card 3: Buyer */}
                  <div className="rounded-xl border border-sky-100 bg-sky-50/30 p-2.5 dark:border-sky-900/40 dark:bg-sky-950/20 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      <Users className="h-3.5 w-3.5" />
                      <span>{tt("party_buyer", "Buyer")}</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                      {formData.buyer_name || formData.importer_name || partySelections.buyer?.companyName || "Fresh Foods Importers"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {selectedBuyerInfo?.person_code || "BUY-0000233"}
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                      {selectedBuyerInfo?.mobile || "+92 21 987 6543"}
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate">
                      {selectedBuyerInfo?.email || "procurement@freshfoods.com"}
                    </div>
                  </div>
                </div>

                {/* Movement / Route Summary Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Repeat2 className="h-4 w-4 text-blue-600" />
                      <span>{tt("route_summary_title", "Movement / Route Summary")}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {formData.shipment_type || "FCL"} • {formData.movement_type || "International"}
                    </span>
                  </div>

                  {/* 4 Mini Badges */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">{tt("movement", "Movement Type")}</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 capitalize text-[11px] truncate">
                        {formData.movement_type || "International"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">{tt("shipment", "Transport Type")}</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px] truncate">
                        {formData.shipment_type || "FCL"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">{tt("transport", "Transport Mode")}</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 capitalize text-[11px] truncate">
                        {formData.transport_mode?.replace("by_", "") || "Sea + Road"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">{t(lang, "comv.load_type", "Load Type")}</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 capitalize text-[11px] truncate">
                        {formData.load_type?.replace("_", " ") || "Full Truck"}
                      </div>
                    </div>
                  </div>

                  {/* Visual Route Journey Track */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      {/* Origin */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900 dark:text-white">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[110px]">
                            {formData.loading_source_name || formData.loading_country_name || "Dubai Warehouse"}
                          </span>
                        </div>
                        <div className="text-[9.5px] text-slate-400">
                          {formData.loading_country_name || "Dubai, UAE"}
                        </div>
                      </div>

                      {/* Transit leg 1: Road */}
                      <div className="flex flex-col items-center px-1">
                        <Truck className="h-3.5 w-3.5 text-blue-500" />
                        <div className="w-12 sm:w-16 border-t border-dashed border-slate-300 dark:border-slate-600 my-1" />
                        <span className="text-[8px] font-semibold text-slate-400">Road</span>
                      </div>

                      {/* Transit Port */}
                      <div className="space-y-0.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-900 dark:text-white">
                          <Anchor className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                          <span className="truncate max-w-[100px]">
                            {formData.loading_port_name || "Jebel Ali Port"}
                          </span>
                        </div>
                        <div className="text-[9.5px] text-slate-400">
                          {formData.loading_country_name || "Dubai, UAE"}
                        </div>
                      </div>

                      {/* Transit leg 2: Sea */}
                      <div className="flex flex-col items-center px-1">
                        <Ship className="h-3.5 w-3.5 text-blue-600" />
                        <div className="w-12 sm:w-16 border-t border-dashed border-slate-300 dark:border-slate-600 my-1" />
                        <span className="text-[8px] font-semibold text-slate-400">Sea</span>
                      </div>

                      {/* Destination */}
                      <div className="space-y-0.5 text-right">
                        <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-slate-900 dark:text-white">
                          <span className="truncate max-w-[110px]">
                            {formData.destination_port_name || formData.receiving_country_name || "Karachi Port"}
                          </span>
                          <MapPin className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        </div>
                        <div className="text-[9.5px] text-slate-400">
                          {formData.receiving_country_name || "Karachi, Pakistan"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2 Dynamic Summary Cards (Screenshot 3) */}
                {currentStep === 2 && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    {/* Goods Summary */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Boxes className="h-4 w-4 text-emerald-600" />
                        <span>{tt("goods_summary", "Goods Summary")}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {formData.goods_name || "Rice - 5% Broken (RICE-001)"}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            {formData.goods_quantity || "25"} {formData.goods_unit || "MT"}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div className="rounded bg-slate-50 p-1 dark:bg-slate-900">
                            <span className="text-slate-400 block text-[8px] uppercase">{tt("bags", "Bags")}</span>
                            <span className="font-black text-slate-800 dark:text-slate-200">{formData.goods_bags_cartons || "1,000"}</span>
                          </div>
                          <div className="rounded bg-slate-50 p-1 dark:bg-slate-900">
                            <span className="text-slate-400 block text-[8px] uppercase">{tt("gross_wt", "Gross Wt")}</span>
                            <span className="font-black text-slate-800 dark:text-slate-200">{formData.goods_gross_weight || "25,000"} kg</span>
                          </div>
                          <div className="rounded bg-slate-50 p-1 dark:bg-slate-900">
                            <span className="text-slate-400 block text-[8px] uppercase">{tt("net_wt", "Net Wt")}</span>
                            <span className="font-black text-slate-800 dark:text-slate-200">{formData.goods_net_weight || "24,500"} kg</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Truck & Transport Requirement */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Truck className="h-4 w-4 text-blue-600" />
                        <span>{tt("truck_transport_summary", "Truck & Transport")}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">{t(lang, "com.truck_number", "Truck No")}</span>
                          <span className="font-black text-slate-800 dark:text-slate-200">{formData.truck_number || "ABC-1234"}</span>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">{t(lang, "plr.driver_name", "Driver")}</span>
                          <span className="font-black text-slate-800 dark:text-slate-200">{formData.truck_driver_name || "Imran Khan"}</span>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">{t(lang, "comv.load_type", "Load Type")}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">{formData.load_type?.replace("_", " ") || "Full Truck"}</span>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">{tt("transporter", "Transporter")}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{formData.truck_transport_company || "ABC Transport Co."}</span>
                        </div>
                      </div>
                    </div>

                    {/* Order Progress 4-Step Tracker */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>{tt("order_progress", "Order Progress")}</span>
                      </div>
                      <div className="flex items-center justify-between text-center pt-1">
                        <div className="flex flex-col items-center">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold">1</span>
                          <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300 mt-1">Draft (Current)</span>
                        </div>
                        <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-700 -mt-3" />
                        <div className="flex flex-col items-center">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 text-[9px] font-bold">2</span>
                          <span className="text-[9px] text-slate-400 mt-1">Pickup Details</span>
                        </div>
                        <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-700 -mt-3" />
                        <div className="flex flex-col items-center">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 text-[9px] font-bold">3</span>
                          <span className="text-[9px] text-slate-400 mt-1">Route & Customs</span>
                        </div>
                        <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-700 -mt-3" />
                        <div className="flex flex-col items-center">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 text-[9px] font-bold">4</span>
                          <span className="text-[9px] text-slate-400 mt-1">Review & Confirm</span>
                        </div>
                      </div>
                    </div>

                    {/* Blue Info Banner */}
                    <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs font-semibold text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                      <BadgeInfo className="h-4 w-4 shrink-0 text-blue-600" />
                      <span>{tt("step2_fill_hint", "Fill all required details and proceed to next step.")}</span>
                    </div>
                  </div>
                )}

                {/* Step 3 & 4 Dynamic 6-Metric Tiles (Screenshots 1 & 2) */}
                {(currentStep === 3 || currentStep === 4) && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Layers className="h-4 w-4 text-blue-600" />
                      <span>{tt("kpi_order_summary", "Order Summary")}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div className="flex items-center justify-between text-blue-600">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="text-[8px] font-bold uppercase">Lines</span>
                        </div>
                        <div className="mt-1 text-base font-black text-slate-900 dark:text-white">
                          {formData.loadingAllocations.length || 1}
                        </div>
                        <div className="text-[8.5px] text-slate-400">Total Order Lines</div>
                      </div>

                      <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-2.5 dark:border-purple-900/40 dark:bg-purple-950/20">
                        <div className="flex items-center justify-between text-purple-600">
                          <Route className="h-3.5 w-3.5" />
                          <span className="text-[8px] font-bold uppercase">Movements</span>
                        </div>
                        <div className="mt-1 text-base font-black text-purple-600 dark:text-purple-400">
                          {formData.legs.length || 2}
                        </div>
                        <div className="text-[8.5px] text-slate-400">Road: 1 • Sea: 1</div>
                      </div>

                      <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-2.5 dark:border-sky-900/40 dark:bg-sky-950/20">
                        <div className="flex items-center justify-between text-sky-600">
                          <Anchor className="h-3.5 w-3.5" />
                          <span className="text-[8px] font-bold uppercase">Ports</span>
                        </div>
                        <div className="mt-1 text-base font-black text-slate-900 dark:text-white">3</div>
                        <div className="text-[8.5px] text-slate-400">Locations & Ports</div>
                      </div>

                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                        <div className="flex items-center justify-between text-emerald-600">
                          <Boxes className="h-3.5 w-3.5" />
                          <span className="text-[8px] font-bold uppercase">Cartons</span>
                        </div>
                        <div className="mt-1 text-base font-black text-slate-900 dark:text-white">
                          {formData.goods_bags_cartons ? `${formData.goods_bags_cartons} Bags` : "1,000 Bags"}
                        </div>
                        <div className="text-[8.5px] text-slate-400">Total Bags / Cartons</div>
                      </div>

                      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                        <div className="flex items-center justify-between text-indigo-600">
                          <Scale className="h-3.5 w-3.5" />
                          <span className="text-[8px] font-bold uppercase">Weight</span>
                        </div>
                        <div className="mt-1 text-base font-black text-indigo-600 dark:text-indigo-400">
                          {formData.goods_net_weight ? `${formData.goods_net_weight} kg` : "25,000 kg"}
                        </div>
                        <div className="text-[8.5px] text-slate-400">Net Weight • 25 MT</div>
                      </div>

                      <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between text-amber-600">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="text-[8px] font-bold uppercase">Monthly</span>
                        </div>
                        <div className="mt-1 text-base font-black text-slate-900 dark:text-white">
                          {orders.length}
                        </div>
                        <div className="text-[8.5px] text-slate-400">Orders Logged</div>
                      </div>
                    </div>
                  </div>
                )}

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
  handlePartyChange,
  handleLoadingCountryChange,
  handleReceivingCountryChange,
  handleLoadingPortChange,
  handleDestinationPortChange,
  onAdvanceToStep2
}: {
  lang: ReturnType<typeof useActiveLanguage>;
  tt: (k: string, f: string) => string;
  userContext: { context: BranchUserContext | null; loading: boolean; error: string | null };
  formData: FormDataState;
  setFormData: SetFormData;
  step1SubStep: "1A" | "1B" | "1C";
  setStep1SubStep: (sub: "1A" | "1B" | "1C") => void;
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
  handlePartyChange: (roleKey: PartyRoleKey, next: PartySelection) => void;
  handleLoadingCountryChange: (countryId: string) => void;
  handleReceivingCountryChange: (countryId: string) => void;
  handleLoadingPortChange: (portId: string) => void;
  handleDestinationPortChange: (portId: string) => void;
  onAdvanceToStep2: () => void;
}) {
  const ctx = userContext.context;
  const selectedCustomer = customers.find((c) => c.id === formData.customer_id);
  const selectedAccount = accounts.find(
    (a) =>
      (formData.customer_id && a.customer_id === formData.customer_id) ||
      a.id === formData.customer_id ||
      (selectedCustomer && a.id === (selectedCustomer as any).account_id)
  );

  const selectedLoadingCountry = countries.find((c) => c.id === formData.loading_country_id);
  const selectedReceivingCountry = countries.find((c) => c.id === formData.receiving_country_id);
  const selectedLoadingCity = loadingCities.find((c) => c.id === formData.loading_city_id);
  const selectedReceivingCity = receivingCities.find((c) => c.id === formData.receiving_city_id);
  const selectedLoadingPort = ports.find((p) => p.id === formData.loading_port_id);
  const selectedDestinationPort = ports.find((p) => p.id === formData.destination_port_id);

  const isComplete1A = Boolean(formData.customer_id && formData.customer_name);
  const isComplete1B = Boolean(formData.movement_type && formData.transport_mode);
  const isComplete1C = Boolean(formData.loading_country_id && formData.receiving_country_id);

  const handleCustomerSelection = (cid: string) => {
    const cust = customers.find((c) => c.id === cid);
    const acc = accounts.find((a) => a.id === cid || (cust && a.customer_id === cust.id));
    const finalCustId = cust?.id || acc?.customer_id || cid;
    const finalCustName = cust?.customer_name || acc?.name || "";
    const finalCompName = cust?.company_name || "";
    const finalAddr = cust?.address || "";

    setFormData((prev) => ({
      ...prev,
      customer_id: finalCustId,
      customer_name: finalCustName,
      loading_country_id: prev.loading_country_id || cust?.country_id || acc?.country_id || ""
    }));

    handlePartyChange("supplier", {
      ...partySelections.supplier,
      customerId: finalCustId,
      customerName: finalCustName,
      companyName: partySelections.supplier.companyName || finalCompName,
      addressText: partySelections.supplier.addressText || finalAddr,
      addressSource: partySelections.supplier.addressSource || "ERP Account / Customer Master"
    });
  };

  const copyCustomerToBuyer = () => {
    if (!formData.customer_id) return;
    handlePartyChange("buyer", {
      ...partySelections.buyer,
      customerId: formData.customer_id,
      customerName: formData.customer_name,
      companyName: partySelections.supplier.companyName || selectedCustomer?.company_name || "",
      addressText: partySelections.supplier.addressText || selectedCustomer?.address || "",
      addressSource: "Copied from Customer"
    });
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      <SectionHeading
        num={1}
        icon={Boxes}
        title={t(lang, "comv.step1_title", "Booking & Customer")}
        subtitle={
          step1SubStep === "1A"
            ? t(lang, "comv.substep_1a_desc", "Customer, company, consignee/shipper and related party information")
            : step1SubStep === "1B"
            ? t(lang, "comv.substep_1b_desc", "Import/export/transit movement, transport mode and operational movement details")
            : t(lang, "comv.substep_1c_desc", "Origin, destination, loading/unloading location, ports, borders and route information")
        }
      />

      {/* Sub-step Progress Navigator (1A -> 1B -> 1C) */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
        <button
          type="button"
          onClick={() => setStep1SubStep("1A")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all ${
            step1SubStep === "1A"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/80 dark:border-blue-900/80"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/40"
          }`}
        >
          <Users className={`h-3.5 w-3.5 shrink-0 ${step1SubStep === "1A" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
          <span className="hidden sm:inline truncate">{t(lang, "comv.substep_1a_title", "1A — Customer & Parties")}</span>
          <span className="inline sm:hidden truncate">1A: Parties</span>
          {isComplete1A ? <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> : null}
        </button>

        <button
          type="button"
          onClick={() => setStep1SubStep("1B")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all ${
            step1SubStep === "1B"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/80 dark:border-blue-900/80"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/40"
          }`}
        >
          <Truck className={`h-3.5 w-3.5 shrink-0 ${step1SubStep === "1B" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
          <span className="hidden sm:inline truncate">{t(lang, "comv.substep_1b_title", "1B — Mode & Movement")}</span>
          <span className="inline sm:hidden truncate">1B: Movement</span>
          {isComplete1B ? <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> : null}
        </button>

        <button
          type="button"
          onClick={() => setStep1SubStep("1C")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all ${
            step1SubStep === "1C"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/80 dark:border-blue-900/80"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/40"
          }`}
        >
          <Route className={`h-3.5 w-3.5 shrink-0 ${step1SubStep === "1C" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
          <span className="hidden sm:inline truncate">{t(lang, "comv.substep_1c_title", "1C — Route & Locations")}</span>
          <span className="inline sm:hidden truncate">1C: Route</span>
          {isComplete1C ? <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> : null}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-STEP 1A: CUSTOMER & PARTIES                                           */}
      {/* ========================================================================= */}
      {step1SubStep === "1A" && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Serial bar — role-gated visibility; Global Bill/Shipping No. always shown */}
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

          {/* Customer / ERP Ledger Account Search & Select */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-600" />
                <span>{t(lang, "comv.customer_ledger_account_req", "Customer / Ledger Account *")}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/60">
                  <Wallet className="h-3 w-3" />
                  <span>{t(lang, "comv.erp_ledger_integrated", "ERP Ledger & Customer Integrated")}</span>
                </span>
                {formData.customer_name ? (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    ✓ {formData.customer_name}
                  </span>
                ) : null}
              </div>
            </div>

            <SearchSelect
              label={t(lang, "comv.select_customer_account", "Select Customer Account")}
              value={formData.customer_id}
              options={customerOptions}
              placeholder={t(lang, "comv.search_customer_full_ph", "Search customer by name, code or mobile...")}
              onValueChange={handleCustomerSelection}
              disabled={loading}
              searchPlaceholder={t(lang, "comv.search_customer_ph", "Search customer name or code...")}
              emptyLabel={t(lang, "comv.no_customers_found", "No customers found")}
            />

            {/* Live ERP Account & Ledger Details Card */}
            {(selectedCustomer || selectedAccount) ? (
              <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-blue-50/40 p-3 text-xs dark:border-slate-800 dark:from-slate-850 dark:to-slate-900 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-black text-[10px]">
                      {selectedAccount?.code ? "ACC" : "CST"}
                    </span>
                    <div>
                      <div className="font-black text-slate-900 dark:text-slate-100 text-xs">
                        {selectedCustomer?.customer_name || selectedAccount?.name}
                      </div>
                      <div className="text-[10.5px] font-semibold text-slate-500">
                        {t(lang, "comv.acc_code", "Account Code")}: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedAccount?.code || selectedCustomer?.person_code || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Current Balance Badge */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[10px] font-semibold text-slate-500">{t(lang, "comv.acc_balance", "Ledger Balance")}:</span>
                    <span className={`font-black font-mono text-[11px] ${
                      selectedAccount?.current_balance != null && Number(selectedAccount.current_balance) < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}>
                      {selectedAccount?.current_balance != null
                        ? `${selectedAccount.currency || ""} ${Number(selectedAccount.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "0.00"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium">{t(lang, "comv.acc_company", "Company:")}</span>{" "}
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCustomer?.company_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">{t(lang, "comv.acc_contact", "Contact:")}</span>{" "}
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCustomer?.mobile || selectedCustomer?.contact_person || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">{t(lang, "comv.acc_country", "Country / Branch:")}</span>{" "}
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCustomer?.country_name || "—"} {selectedCustomer?.city_name ? `(${selectedCustomer.city_name})` : ""}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.customer_id) {
                        handlePartyChange("supplier", {
                          ...partySelections.supplier,
                          customerId: formData.customer_id,
                          customerName: formData.customer_name,
                          companyName: selectedCustomer?.company_name || partySelections.supplier.companyName || "",
                          addressText: selectedCustomer?.address || partySelections.supplier.addressText || "",
                          addressSource: "ERP Master Synced"
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/80 px-2 py-1 text-[10.5px] font-bold text-blue-700 hover:bg-blue-100 transition"
                  >
                    ✓ {t(lang, "comv.autofill_supplier", "Use Customer as Supplier / Order Party")}
                  </button>
                  <button
                    type="button"
                    onClick={copyCustomerToBuyer}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10.5px] font-bold text-slate-700 hover:bg-slate-100 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    + Copy to Buyer / Consignee
                  </button>
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

          {/* Sub-step 1A Action */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep1SubStep("1B")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
            >
              <span>{t(lang, "comv.next_substep_1b", "Continue to Transport Mode & Movement (1B)")}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-STEP 1B: TRANSPORT MODE & MOVEMENT                                    */}
      {/* ========================================================================= */}
      {step1SubStep === "1B" && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Movement Type & Shipment Type */}
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

          {/* Transport Mode Cards */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("transport_mode", "Transport Mode")} *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "by_sea", label: tt("tm_by_sea", "By Sea"), icon: Anchor },
                { key: "by_road", label: tt("tm_by_road", "By Road"), icon: Truck },
                { key: "by_air", label: tt("tm_by_air", "By Air"), icon: Plane },
                { key: "by_rail", label: t(lang, "comv.tm_by_rail", "By Rail"), icon: Route }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormData((current) => ({ ...current, transport_mode: key as TransportMode }))}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                    formData.transport_mode === key
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Operational Movement & Load Type */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Load Type (Full / Partial / Haulage)</label>
              <select
                value={formData.load_type || ""}
                onChange={(e) => setFormData((current) => ({ ...current, load_type: e.target.value as LoadType }))}
                className={selectClass}
              >
                <option value="">— Standard / Auto —</option>
                <option value="full_truck">Full Truck (FTL)</option>
                <option value="partial_load">Partial Load (LTL)</option>
                <option value="container_haulage">Container Haulage</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{tt("expected_loading_date", "Expected Loading Date")}</label>
              <input
                type="date"
                value={formData.expected_loading_date}
                onChange={(e) => setFormData((current) => ({ ...current, expected_loading_date: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{tt("cargo_container_details", "Cargo / Container Details")}</label>
            <input
              type="text"
              placeholder={tt("cargo_ph", "e.g. 40ft High Cube Container / 22 MT Dry Cargo")}
              value={formData.cargo_details}
              onChange={(e) => setFormData((current) => ({ ...current, cargo_details: e.target.value }))}
              className={inputClass}
            />
          </div>

          {/* Sub-step 1B Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep1SubStep("1A")}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>{t(lang, "comv.prev_substep_1a", "Back to Customer & Parties (1A)")}</span>
            </button>
            <button
              type="button"
              onClick={() => setStep1SubStep("1C")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
            >
              <span>{t(lang, "comv.next_substep_1c", "Continue to Route & Locations (1C)")}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-STEP 1C: ROUTE / PORT / LOCATION DETAILS                              */}
      {/* ========================================================================= */}
      {step1SubStep === "1C" && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Loading / Receiving Country + Location */}
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

          {/* Route Summary & Journey Card */}
          {(selectedLoadingCountry || selectedReceivingCountry || formData.route_name) ? (
            <div className="rounded-xl border border-blue-200/70 bg-blue-50/40 p-3 dark:border-blue-900/50 dark:bg-blue-950/20 text-xs space-y-1.5">
              <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5 text-blue-600" />
                <span>Journey Preview</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                  {selectedLoadingCountry?.name || "Origin Country"}{selectedLoadingCity ? ` (${selectedLoadingCity.name})` : ""}
                </span>
                <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded uppercase text-[10px] font-black">
                  {formData.transport_mode.replace("by_", "")} • {formData.movement_type}
                </span>
                <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />
                <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                  {selectedReceivingCountry?.name || "Destination Country"}{selectedReceivingCity ? ` (${selectedReceivingCity.name})` : ""}
                </span>
              </div>
              {selectedLoadingPort || selectedDestinationPort ? (
                <div className="text-[10.5px] text-slate-500">
                  Ports: {selectedLoadingPort?.port_name || "—"} ➔ {selectedDestinationPort?.port_name || "—"}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Sub-step 1C Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep1SubStep("1B")}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>{t(lang, "comv.prev_substep_1b", "Back to Movement & Mode (1B)")}</span>
            </button>
            <button
              type="button"
              onClick={onAdvanceToStep2}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
            >
              <span>{t(lang, "comv.proceed_step_2", "Proceed to Step 2 (Pickup, Goods & Truck)")}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
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
