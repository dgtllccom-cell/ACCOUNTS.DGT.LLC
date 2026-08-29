"use client";

import { useEffect, useMemo, useState } from "react";
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

type TransportMode = "by_sea" | "by_road" | "by_truck" | "by_air";
type MovementType = "import" | "export" | "domestic" | "up_transit";
type LoadingSource = "warehouse" | "truck_transfer" | "container_transfer";

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
};

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
type GoodsVariationRow = { id: string; goods_id: string; size: string; brand: string };
type GoodsRow = {
  id: string;
  chs_code: string;
  goods_name: string;
  origin_country_id?: string | null;
  variations?: GoodsVariationRow[];
};

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
  goods_origin_country_name: "",
  route_name: "",
  shipment_type: "FCL",
  transport_mode: "by_sea" as TransportMode,
  movement_type: "import" as MovementType,
  loading_source: "warehouse" as LoadingSource,
  loading_source_name: "",
  exporter_name: "",
  importer_name: "",
  notify_party_required: false,
  notify_party_name: "",
  buyer_name: "",
  loading_country_id: "",
  loading_country_name: "",
  receiving_country_id: "",
  receiving_country_name: "",
  loading_port_id: "",
  loading_port_name: "",
  destination_port_id: "",
  destination_port_name: "",
  cargo_details: "",
  expected_loading_date: new Date().toISOString().split("T")[0],
  remarks: "",
  order_no: ""
};

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

function optionLabelFromGoods(row: GoodsRow) {
  const variationCount = Array.isArray(row.variations) ? row.variations.length : 0;
  return [row.goods_name, row.chs_code ? `CHS ${row.chs_code}` : "", variationCount ? `${variationCount} variation${variationCount === 1 ? "" : "s"}` : ""]
    .filter(Boolean)
    .join(" • ");
}

function optionLabelFromGoodsVariation(row: GoodsVariationRow) {
  return [row.size, row.brand].filter(Boolean).join(" • ");
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
          label={`${lang === "ur" ? "کسٹمر / لیجر نام" : "Customer / Person Name"} *`}
          value={selection.customerId}
          placeholder={disabled ? t(lang as never, "common.loading" as never, "Loading...") : `${lang === "ur" ? "کسٹمر نام یا کوڈ منتخب کریں" : "Select Customer Account"} — ${label}`}
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
          label={lang === "ur" ? "کمپنی / کاروباری ادارہ" : "Company / Business Name"}
          value={selection.companyId}
          placeholder={lang === "ur" ? "کمپنی منتخب کریں (اختیاری)..." : "Select Company (Optional)..."}
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
          searchPlaceholder={lang === "ur" ? "کمپنی نام سے تلاش کریں..." : "Search company name..."}
          emptyLabel={lang === "ur" ? "کوئی کمپنی نہیں ملی" : "No matching companies found"}
        />
      </div>

      {/* 3. Direct Address Field */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
          <span>{lang === "ur" ? "مکمل پتہ / ڈیلیوری ایڈریس" : "Address / Billing / Shipping"}</span>
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
          placeholder={lang === "ur" ? "پتہ درج کریں یا ماسٹر سے منتخب کریں..." : "Enter address or select from master..."}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {/* Summary Box */}
      {(selection.customerName || effectiveCompanyName || effectiveAddress) ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] space-y-1 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">{lang === "ur" ? "نام:" : "Party:"}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{selection.customerName || "-"}</span>
          </div>
          {effectiveCompanyName ? (
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">{lang === "ur" ? "کمپنی:" : "Company:"}</span>
              <span className="font-bold text-blue-700 dark:text-blue-300">{effectiveCompanyName}</span>
            </div>
          ) : null}
          {effectiveAddress ? (
            <div className="flex justify-between text-slate-600 dark:text-slate-400 truncate">
              <span className="text-slate-500 font-semibold">{lang === "ur" ? "پتہ:" : "Address:"}</span>
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
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [orders, setOrders] = useState<ClearingCustomerOrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [goods, setGoods] = useState<GoodsRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);
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
      const [orderRes, customerRes, companyRes, countryRes, portRes, goodsRes] = await Promise.all([
        fetch("/api/erp/clearing-agent/customer-order"),
        fetch("/api/erp/customers?limit=250"),
        fetch("/api/erp/companies?limit=250"),
        fetch("/api/erp/locations/countries"),
        fetch("/api/erp/ports"),
        fetch("/api/erp/goods?limit=250")
      ]);

      const [orderJson, customerJson, companyJson, countryJson, portJson, goodsJson] = await Promise.all([
        orderRes.json(),
        customerRes.json(),
        companyRes.json(),
        countryRes.json(),
        portRes.json(),
        goodsRes.json()
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
      setGoods(extractArray(goodsJson, ["goods", "data"]));
      setCountries(extractArray(countryJson, ["countries", "data"]));
      setPorts(extractArray(portJson, ["ports", "data"]));
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
      loading_country_name: row?.name || ""
    }));
  };

  const handleReceivingCountryChange = (countryId: string) => {
    const row = countries.find((item) => item.id === countryId);
    setFormData((current) => ({
      ...current,
      receiving_country_id: countryId,
      receiving_country_name: row?.name || ""
    }));
  };

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

  const handleGoodsChange = (goodsId: string) => {
    const row = goods.find((item) => item.id === goodsId);
    const originCountry = countries.find((country) => country.id === row?.origin_country_id);
    const firstVariation = row?.variations?.[0];
    setFormData((current) => ({
      ...current,
      goods_id: goodsId,
      goods_name: row?.goods_name || "",
      goods_chs_code: row?.chs_code || "",
      goods_origin_country_name: originCountry?.name || "",
      goods_variation_id: row?.variations?.length === 1 ? firstVariation?.id || "" : "",
      goods_variation_label: row?.variations?.length === 1 && firstVariation ? optionLabelFromGoodsVariation(firstVariation) : "",
      goods_brand: row?.variations?.length === 1 ? firstVariation?.brand || "" : "",
      goods_size: row?.variations?.length === 1 ? firstVariation?.size || "" : ""
    }));
  };

  const handleGoodsVariationChange = (variationId: string) => {
    const selectedGoods = goods.find((item) => item.id === formData.goods_id);
    const variation = selectedGoods?.variations?.find((item) => item.id === variationId);
    setFormData((current) => ({
      ...current,
      goods_variation_id: variationId,
      goods_variation_label: variation ? optionLabelFromGoodsVariation(variation) : "",
      goods_brand: variation?.brand || "",
      goods_size: variation?.size || ""
    }));
  };

  const goodsOptions = useMemo(
    () =>
      goods.map((row) => ({
        value: row.id,
        label: optionLabelFromGoods(row),
        keywords: [
          row.goods_name,
          row.chs_code,
          row.origin_country_id ? countries.find((country) => country.id === row.origin_country_id)?.name : "",
          ...(row.variations ?? []).flatMap((variation) => [variation.size, variation.brand, optionLabelFromGoodsVariation(variation)])
        ]
          .filter(Boolean)
          .join(" ")
      })),
    [goods, countries]
  );

  const selectedGoods = useMemo(() => goods.find((item) => item.id === formData.goods_id) || null, [goods, formData.goods_id]);

  const variationOptions = useMemo(
    () =>
      (selectedGoods?.variations ?? []).map((variation) => ({
        value: variation.id,
        label: optionLabelFromGoodsVariation(variation),
        keywords: [variation.size, variation.brand, optionLabelFromGoodsVariation(variation)].filter(Boolean).join(" ")
      })),
    [selectedGoods]
  );

  const selectedGoodsVariation = useMemo(
    () => selectedGoods?.variations?.find((item) => item.id === formData.goods_variation_id) || null,
    [selectedGoods, formData.goods_variation_id]
  );

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
  const isRoadMode = formData.transport_mode === "by_road" || formData.transport_mode === "by_truck";
  const shouldShowBuyer = isSeaMode || formData.notify_party_required;
  const nextActionLabel = isSeaMode || formData.notify_party_required ? tt("step_bill_entry", "Bill Entry") : isRoadMode ? tt("step_truck_entry", "Truck Entry") : tt("step_review", "Review");
  const loadingSourceLabel =
    formData.loading_source === "warehouse"
      ? tt("ls_warehouse", "Warehouse")
      : formData.loading_source === "truck_transfer"
        ? tt("transfer_from_truck", "Transfer from Truck")
        : tt("transfer_from_container", "Transfer from Container");

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setPartySelections(emptyPartyState());
    setEditingOrderId(null);
    setCurrentStep(1);
  };

  const loadEditOrder = (order: ClearingCustomerOrderRow) => {
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
      goods_origin_country_name: order.goods_origin_country_name || "",
      route_name: order.route_name || "",
      shipment_type: order.shipment_type || "FCL",
      transport_mode: (order.transport_mode || "by_sea") as TransportMode,
      movement_type: (order.movement_type || "import") as MovementType,
      loading_source: (order.loading_source || "warehouse") as LoadingSource,
      loading_source_name: order.loading_source_name || "",
      exporter_name: order.exporter_name || "",
      importer_name: order.importer_name || "",
      notify_party_required: Boolean(order.notify_party_required),
      notify_party_name: order.notify_party_name || "",
      buyer_name: order.buyer_name || "",
      loading_country_id: order.loading_country_id || "",
      loading_country_name: order.loading_country_name || "",
      receiving_country_id: order.receiving_country_id || "",
      receiving_country_name: order.receiving_country_name || "",
      loading_port_id: order.loading_port_id || "",
      loading_port_name: order.loading_port_name || "",
      destination_port_id: order.destination_port_id || "",
      destination_port_name: order.destination_port_name || "",
      cargo_details: order.cargo_details || "",
      expected_loading_date: order.expected_loading_date ? order.expected_loading_date.split("T")[0] : new Date().toISOString().split("T")[0],
      remarks: order.remarks || "",
      order_no: order.order_no || ""
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
      const payload = {
        ...formData,
        customer_id: supplier.customerId || formData.customer_id || null,
        customer_name: supplier.customerName || formData.customer_name || "Shipping Party",
        goods_id: formData.goods_id || null,
        goods_variation_id: formData.goods_variation_id || null,
        goods_name: formData.goods_name || null,
        goods_chs_code: formData.goods_chs_code || null,
        goods_variation_label: formData.goods_variation_label || null,
        goods_brand: formData.goods_brand || null,
        goods_size: formData.goods_size || null,
        goods_origin_country_name: formData.goods_origin_country_name || null,
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
          } satisfies PartyLinkInput))
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
      title: lang === "ur" ? "آرڈر و سامان" : lang === "ar" ? "الطلب والبضائع" : lang === "fa" ? "سفارش و کالا" : lang === "ps" ? "فرمایش او توکي" : "Order & Goods",
      desc: lang === "ur" ? "موومنٹ، ٹرانسپورٹ، گڈز ماسٹر" : "Movement, Mode & Goods"
    },
    {
      num: 2,
      title: lang === "ur" ? "بنیادی پارٹیاں" : lang === "ar" ? "الأطراف الأساسية" : lang === "fa" ? "طرف‌های اصلی" : lang === "ps" ? "اصلي لوري" : "Core Parties",
      desc: lang === "ur" ? "سپلائر / آرڈر پارٹی اور خریدار" : "Supplier & Buyer"
    },
    {
      num: 3,
      title: lang === "ur" ? "لاجسٹک پارٹیاں" : lang === "ar" ? "أطراف الشحن" : lang === "fa" ? "طرف‌های گمرکی" : lang === "ps" ? "د بار وړلو لوري" : "Shipping Parties",
      desc: lang === "ur" ? "امپورٹر، ایکسپورٹر، نوٹیفائی" : "Importer, Exporter, Notify"
    },
    {
      num: 4,
      title: lang === "ur" ? "روٹ، پورٹس و تواریخ" : lang === "ar" ? "المسار والموانئ" : lang === "fa" ? "مسیر، بنادر و تاریخ" : lang === "ps" ? "لارې او بندرونه" : "Logistics & Review",
      desc: lang === "ur" ? "روٹ، پورٹس، کنٹینر اور ریویو" : "Ports, Route, Container, Review"
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
                {lang === "ur" ? "۴ مرحلہ وار وزرڈ" : "4-Step Progressive Wizard"}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                {tt("header_next", "Next")}: {nextActionLabel}
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
                {lang === "ur" ? `مرحلہ ${currentStep} از ۴` : `Step ${currentStep} of 4`}
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

          {/* STEP 1: SERIALS, CUSTOMER LEDGER, ROUTE & GOODS */}
          {currentStep === 1 && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                <Boxes className="h-4 w-4" />
                <span>1. {tt("step1_title", "Order Serials, Customer & Goods Master")}</span>
              </div>

              {/* 4 Serial Numbers Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-850">
                <div className="space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">1. Super Admin</div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200">SA-001</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">2. Country Serial</div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200">PK-001</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">3. Branch Serial</div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200">KHI-01</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">4. Order / Entry</div>
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400 truncate">{formData.order_no || "CL-ORD-AUTO"}</div>
                </div>
              </div>

              {/* Customer / Ledger Account Search & Select */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-600" />
                    <span>{lang === "ur" ? "کسٹمر / لیجر اکاؤنٹ *" : "Customer / Ledger Account *"}</span>
                  </label>
                  {formData.customer_name ? (
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                      ✓ {formData.customer_name}
                    </span>
                  ) : null}
                </div>
                <SearchSelect
                  label={lang === "ur" ? "کسٹمر اکاؤنٹ منتخب کریں" : "Select Customer Account"}
                  value={formData.customer_id}
                  options={customerOptions}
                  placeholder={lang === "ur" ? "کسٹمر نام، اکاؤنٹ کوڈ یا موبائل سے تلاش کریں..." : "Search customer by name, code or mobile..."}
                  onValueChange={(cid) => {
                    const cust = customers.find((c) => c.id === cid);
                    if (cust) {
                      setFormData((prev) => ({
                        ...prev,
                        customer_id: cust.id,
                        customer_name: cust.customer_name,
                      }));
                      setPartySelections((prev) => ({
                        ...prev,
                        supplier: {
                          ...prev.supplier,
                          customerId: cust.id,
                          customerName: cust.customer_name,
                          addressText: prev.supplier.addressText || cust.address || "",
                        }
                      }));
                    }
                  }}
                  disabled={loading}
                  searchPlaceholder={lang === "ur" ? "کسٹمر نام یا کوڈ تلاش کریں..." : "Search customer name or code..."}
                  emptyLabel={lang === "ur" ? "کوئی کسٹمر نہیں ملا" : "No customers found"}
                />
              </div>

              {/* Route Countries (2 Clear Dropdowns: Loading Country & Receiving Country) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5 text-blue-600" />
                  <span>{lang === "ur" ? "روٹ کے ممالک (Route Countries) *" : "Route Countries (Origin & Destination) *"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      {lang === "ur" ? "روانگی ملک (Loading Country) *" : "1. Loading Country *"}
                    </label>
                    <select
                      value={formData.loading_country_id}
                      onChange={(e) => {
                        const cId = e.target.value;
                        const cName = countries.find((c) => c.id === cId)?.name || "";
                        setFormData((prev) => ({
                          ...prev,
                          loading_country_id: cId,
                          loading_country_name: cName,
                          route_name: cName && prev.receiving_country_name ? `${cName} ➔ ${prev.receiving_country_name}` : prev.route_name
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">{lang === "ur" ? "— روانگی ملک منتخب کریں —" : "— Select Loading Country —"}</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      {lang === "ur" ? "وصولی ملک (Receiving Country) *" : "2. Receiving Country *"}
                    </label>
                    <select
                      value={formData.receiving_country_id}
                      onChange={(e) => {
                        const cId = e.target.value;
                        const cName = countries.find((c) => c.id === cId)?.name || "";
                        setFormData((prev) => ({
                          ...prev,
                          receiving_country_id: cId,
                          receiving_country_name: cName,
                          route_name: prev.loading_country_name && cName ? `${prev.loading_country_name} ➔ ${cName}` : prev.route_name
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">{lang === "ur" ? "— وصولی ملک منتخب کریں —" : "— Select Receiving Country —"}</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Movement Type & Shipment Type */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("movement_type", "Movement Type")} *</label>
                  <select
                    value={formData.movement_type}
                    onChange={(e) => setFormData((current) => ({ ...current, movement_type: e.target.value as MovementType }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                  >
                    <option value="import">{tt("mv_import", "Import")}</option>
                    <option value="export">{tt("mv_export", "Export")}</option>
                    <option value="domestic">{tt("mv_domestic", "Domestic")}</option>
                    <option value="up_transit">{tt("mv_up_transit", "Up Transit")}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("shipment_type", "Shipment Type")}</label>
                  <select
                    value={formData.shipment_type}
                    onChange={(e) => setFormData((current) => ({ ...current, shipment_type: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                  >
                    <option value="FCL">{tt("ship_fcl", "FCL (Full Container Load)")}</option>
                    <option value="LCL">{tt("ship_lcl", "LCL (Less than Container)")}</option>
                    <option value="Loose Cargo">{tt("ship_loose", "Loose Cargo")}</option>
                    <option value="Bulk Cargo">{tt("ship_bulk", "Bulk Cargo")}</option>
                  </select>
                </div>
              </div>

              {/* Transport Mode */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("transport_mode", "Transport Mode")} *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "by_sea", label: tt("tm_by_sea", "By Sea"), icon: Anchor },
                    { key: "by_road", label: tt("tm_by_road", "By Road"), icon: MapPin },
                    { key: "by_truck", label: tt("tm_by_truck", "By Truck"), icon: Truck },
                    { key: "by_air", label: tt("tm_by_air", "By Air"), icon: Plane }
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

              {/* Loading Source */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("loading_source", "Loading Source")}</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { key: "warehouse", label: tt("ls_warehouse", "Warehouse"), icon: Warehouse },
                    { key: "truck_transfer", label: tt("ls_truck_transfer", "Truck Transfer"), icon: Repeat2 },
                    { key: "container_transfer", label: tt("ls_container_transfer", "Container Transfer"), icon: Container }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setFormData((current) => ({
                          ...current,
                          loading_source: key as LoadingSource,
                          loading_source_name: label
                        }))
                      }
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
                <input
                  type="text"
                  placeholder={tt("ls_name_ph", "Source name / truck number / container reference")}
                  value={formData.loading_source_name}
                  onChange={(e) => setFormData((current) => ({ ...current, loading_source_name: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                />
              </div>

              {/* Goods Master Selection Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <Boxes className="h-4 w-4 text-emerald-600" />
                  {tt("goods_master_card", "Goods / Item Master")}
                </div>
                <SearchSelect
                  label={tt("goods_master", "Goods Master")}
                  value={formData.goods_id}
                  placeholder={tt("goods_master_ph", "Search existing Goods Master by name / CHS code")}
                  options={goodsOptions}
                  onValueChange={handleGoodsChange}
                  disabled={loading}
                  searchPlaceholder={tt("goods_search_ph", "Search goods / CHS code / variation")}
                  emptyLabel={tt("no_goods", "No matching goods found")}
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
                      {selectedGoodsVariation ? ` • ${selectedGoodsVariation.size} / ${selectedGoodsVariation.brand}` : ""}
                    </div>
                  </div>
                </div>
                {variationOptions.length > 0 ? (
                  <SearchSelect
                    label={tt("goods_variation", "Goods Variation")}
                    value={formData.goods_variation_id}
                    placeholder={tt("variation_ph", "Search variation size / brand")}
                    options={variationOptions}
                    onValueChange={handleGoodsVariationChange}
                    disabled={loading}
                    searchPlaceholder={tt("variation_search_ph", "Search size / brand")}
                    emptyLabel={tt("no_variations", "No matching variations found")}
                  />
                ) : null}
              </div>
            </div>
          )}

          {/* STEP 2: CORE PARTIES (SUPPLIER & BUYER) */}
          {currentStep === 2 && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                <Building2 className="h-4 w-4" />
                <span>2. {tt("step2_title", "Core Parties (Supplier & Buyer)")}</span>
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
            </div>
          )}

          {/* STEP 3: LOGISTICS & BORDER PARTIES */}
          {currentStep === 3 && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                <Route className="h-4 w-4" />
                <span>3. {tt("step3_title", "Shipping & Border Parties")}</span>
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
            </div>
          )}

          {/* STEP 4: LOGISTICS, PORTS, ROUTE, DATES & REVIEW */}
          {currentStep === 4 && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                <MapPin className="h-4 w-4" />
                <span>4. {tt("step4_title", "Logistics, Ports & Review")}</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("loading_country", "Loading Country")}</label>
                  <select
                    value={formData.loading_country_id}
                    onChange={(e) => handleLoadingCountryChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                  >
                    <option value="">{tt("select_loading_country", "Select Loading Country")}</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("receiving_country", "Receiving Country")}</label>
                  <select
                    value={formData.receiving_country_id}
                    onChange={(e) => handleReceivingCountryChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                  >
                    <option value="">{tt("select_receiving_country", "Select Receiving Country")}</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("loading_port", "Loading Port")}</label>
                  <select
                    value={formData.loading_port_id}
                    onChange={(e) => handleLoadingPortChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                  >
                    <option value="">{tt("select_loading_port", "Select Loading Port")}</option>
                    {ports.map((port) => (
                      <option key={port.id} value={port.id}>
                        {port.port_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("destination_port", "Destination Port")}</label>
                  <select
                    value={formData.destination_port_id}
                    onChange={(e) => handleDestinationPortChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                  >
                    <option value="">{tt("select_destination_port", "Select Destination Port")}</option>
                    {ports.map((port) => (
                      <option key={port.id} value={port.id}>
                        {port.port_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("expected_loading_date", "Expected Loading Date")}</label>
                  <input
                    type="date"
                    value={formData.expected_loading_date}
                    onChange={(e) => setFormData((current) => ({ ...current, expected_loading_date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("route_reference", "Route / Reference")}</label>
                  <input
                    type="text"
                    placeholder={tt("route_ph", "e.g. Karachi to Kabul via Torkham")}
                    value={formData.route_name}
                    onChange={(e) => setFormData((current) => ({ ...current, route_name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("cargo_container_details", "Cargo / Container Details")}</label>
                <input
                  type="text"
                  placeholder={tt("cargo_ph", "e.g. 40ft High Cube Container")}
                  value={formData.cargo_details}
                  onChange={(e) => setFormData((current) => ({ ...current, cargo_details: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("remarks", "Remarks")}</label>
                <textarea
                  rows={2}
                  placeholder={tt("remarks_ph", "Additional instructions or notes...")}
                  value={formData.remarks}
                  onChange={(e) => setFormData((current) => ({ ...current, remarks: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
                />
              </div>
            </div>
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
                  {lang === "ur" ? "پچھلا" : "Previous"}
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
                <span>{lang === "ur" ? "محفوظ کریں (Save Progress)" : "Save Progress"}</span>
              </button>

              {/* Next or Complete Button */}
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => void handleSaveProgress(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                >
                  <span>{lang === "ur" ? "اگلا مرحلہ" : "Next Step"}</span>
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
                  <span>{lang === "ur" ? "مکمل آرڈر محفوظ کریں" : "Complete & Save Order"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side Register & Live Report (Prominent, High Visibility) */}
        <div className="space-y-4 xl:col-span-7 xl:sticky xl:top-4 xl:self-start h-fit max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5">
          {/* Top KPI Cards */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: tt("kpi_total_orders", "Total Orders"), value: orderCounts.total, icon: FileText, color: "text-blue-600 dark:text-blue-400" },
                { label: tt("mv_import", "Import"), value: orderCounts.import, icon: ArrowRight, color: "text-emerald-600 dark:text-emerald-400" },
                { label: tt("mv_export", "Export"), value: orderCounts.export, icon: Route, color: "text-purple-600 dark:text-purple-400" },
                { label: tt("kpi_domestic_transit", "Domestic / Transit"), value: `${orderCounts.domestic} / ${orderCounts.transit}`, icon: Boxes, color: "text-amber-600 dark:text-amber-400" }
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    {item.label}
                  </div>
                  <div className="mt-1 text-xl font-black text-slate-900 dark:text-white">{item.value}</div>
                </div>
              ))}
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
                  title="Export to CSV"
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
                                title="Edit / Resume Step"
                              >
                                <Pencil className="h-3.5 w-3.5 text-blue-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewOrder(order)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                                title="View Details"
                              >
                                <Eye className="h-3.5 w-3.5 text-emerald-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintOrder(order)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                                title="Print"
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
          title={`Order Details: ${viewOrder.order_no || viewOrder.id}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <div><strong>Movement:</strong> {viewOrder.movement_type}</div>
              <div><strong>Transport:</strong> {viewOrder.transport_mode}</div>
              <div><strong>Shipment:</strong> {viewOrder.shipment_type}</div>
              <div><strong>Loading Source:</strong> {viewOrder.loading_source_name || viewOrder.loading_source || "-"}</div>
              <div><strong>Goods:</strong> {viewOrder.goods_name || "-"}</div>
              <div><strong>CHS Code:</strong> {viewOrder.goods_chs_code || "-"}</div>
              <div><strong>Route:</strong> {viewOrder.route_name || "-"}</div>
              <div><strong>Loading Date:</strong> {viewOrder.expected_loading_date ? new Date(viewOrder.expected_loading_date).toLocaleDateString() : "-"}</div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider">Linked Parties</h4>
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
                Edit / Resume Order
              </button>
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </div>
  );
}
