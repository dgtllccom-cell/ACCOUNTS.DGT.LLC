"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Anchor,
  ArrowRight,
  BadgeInfo,
  Building2,
  Boxes,
  CheckCircle2,
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
  Search,
  Truck,
  Warehouse
} from "lucide-react";

import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Th } from "@/components/ui/translated-th";
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
  remarks: ""
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
      if (link.party_customer_id === selection.customerId && !selection.companyId) {
        addOption(`Saved in ${order.order_no}`, link.selected_address_text);
      }
    }
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

function PartyRolePanel({
  roleKey,
  label,
  required,
  selection,
  customers,
  companies,
  orders,
  onChange,
  disabled,
  lang
}: {
  roleKey: PartyRoleKey;
  label: string;
  required?: boolean;
  selection: PartySelection;
  customers: CustomerRow[];
  companies: CompanyRow[];
  orders: ClearingCustomerOrderRow[];
  onChange: (next: PartySelection) => void;
  disabled?: boolean;
  lang: string;
}) {
  const tt = (k: string, f: string) => t(lang, ("com." + k) as never, f);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");

  const customerOptions = useMemo(() => {
    const list = customers.map((row) => ({
      value: row.id,
      label: optionLabelFromCustomer(row),
      keywords: [row.customer_name, row.company_name, row.contact_person, row.mobile, row.whatsapp, row.email, row.address].filter(Boolean).join(" ")
    }));
    if (selection.customerId && !list.some((item) => item.value === selection.customerId)) {
      list.unshift({ value: selection.customerId, label: selection.customerName || selection.customerId, keywords: selection.customerName });
    }
    return list;
  }, [customers, selection.customerId, selection.customerName]);

  const linkedCompanies = useMemo(
    () => deriveLinkedCompanies(roleKey, selection, customers, companies, orders),
    [roleKey, selection, customers, companies, orders]
  );
  const addressOptions = useMemo(
    () => guessAddressOptions(selection, customers, companies, orders),
    [selection, customers, companies, orders]
  );

  const selectedCompany = companies.find((item) => item.id === selection.companyId);
  const effectiveCompanyName = selection.companyName || selectedCompany?.name || "";
  const effectiveAddress = selection.addressText || selectedCompany?.address || customers.find((item) => item.id === selection.customerId)?.address || "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
          {label}
        </div>
        <button
          type="button"
          onClick={() => setCompanyPickerOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 cursor-pointer"
        >
          <Building2 className="h-3 w-3" />
          {effectiveCompanyName ? tt("company_linked", "Company Linked") : tt("pick_company", "Pick Company")}
        </button>
      </div>

      <SearchSelect
        label={`${tt("search_party", "Search party")} — ${label}`}
        value={selection.customerId}
        placeholder={disabled ? t(lang, "common.loading" as never, "Loading...") : `${tt("search_party", "Search party")} — ${label}`}
        options={customerOptions}
        onValueChange={(customerId) => {
          const customer = customers.find((item) => item.id === customerId);
          const guessedCompany = companies.find((company) => {
            const haystack = normalize([company.name, company.legal_name, company.owner_name, company.address].filter(Boolean).join(" "));
            const needles = [
              normalize(customer?.company_name),
              normalize(customer?.customer_name),
              normalize(customer?.contact_person),
              normalize(customer?.mobile),
              normalize(customer?.whatsapp),
              normalize(customer?.email)
            ].filter(Boolean);
            return needles.some((needle) => haystack.includes(needle));
          });

          onChange({
            ...selection,
            customerId,
            customerName: customer ? optionLabelFromCustomer(customer) : selection.customerName || customerId,
            companyId: guessedCompany?.id || selection.companyId,
            companyName: guessedCompany ? optionLabelFromCompany(guessedCompany) : selection.companyName,
            addressText: customer?.address || guessedCompany?.address || selection.addressText,
            addressSource: customer?.address ? "customer" : guessedCompany?.address ? "company" : selection.addressSource
          });
        }}
        onSearchValueChange={setCustomerSearch}
        disabled={disabled}
        searchPlaceholder={tt("search_party", "Search party")}
        emptyLabel={tt("no_parties", "No matching parties")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || !selection.customerId}
          onClick={() => setCompanyPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          {linkedCompanies.length > 0 ? `${linkedCompanies.length} ${tt("linked_companies", "Linked Companies")}` : tt("pick_company", "Pick Company")}
        </button>
        <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[280px]">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{tt("company", "Company")}:</span> {effectiveCompanyName || "-"}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          {tt("address_billing_shipping", "Address / Billing / Shipping")}
        </div>
        {addressOptions.length > 0 ? (
          <SearchSelect
            value={selection.addressText}
            options={addressOptions}
            onValueChange={(value) => {
              const chosen = addressOptions.find((item) => item.value === value);
              onChange({
                ...selection,
                addressText: value,
                addressSource: chosen?.label || "selected"
              });
            }}
            placeholder={tt("search_address", "Search address")}
            searchPlaceholder={tt("search_address", "Search address")}
            emptyLabel={tt("no_addresses", "No matching addresses")}
          />
        ) : (
          <input
            value={selection.addressText}
            onChange={(e) => onChange({ ...selection, addressText: e.target.value, addressSource: "manual" })}
            placeholder={tt("enter_address", "Enter address")}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        )}
        <div className="mt-1 text-[10.5px] text-slate-500 truncate">{tt("selected_address", "Selected Address")}: {summaryValue(effectiveAddress)}</div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex items-start justify-between gap-2">
          <span className="text-slate-500 text-[11px]">{tt("party", "Party")}</span>
          <span className="text-right font-semibold text-slate-800 dark:text-slate-200">{summaryValue(selection.customerName)}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-slate-500 text-[11px]">{tt("company", "Company")}</span>
          <span className="text-right font-semibold text-slate-800 dark:text-slate-200">{summaryValue(effectiveCompanyName)}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-slate-500 text-[11px]">{tt("address", "Address")}</span>
          <span className="max-w-[70%] text-right font-medium text-slate-700 dark:text-slate-300 truncate">{summaryValue(effectiveAddress)}</span>
        </div>
      </div>

      {companyPickerOpen ? (
        <SimpleModal
          title={`${label} — ${tt("linked_companies_modal", "Linked Companies")}`}
          onClose={() => setCompanyPickerOpen(false)}
          className="w-[96vw] max-w-[800px] max-h-[90vh] overflow-y-auto rounded-2xl font-sans"
        >
          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {tt("company_picker_hint", "Search and select the company/business linked to this party.")}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {tt("company_picker_note", "If previous orders already linked this party to companies, they appear first.")}
              </div>
            </div>
            <SearchSelect
              value={selection.companyId}
              options={linkedCompanies.length > 0 ? linkedCompanies : companies.map((company) => ({
                value: company.id,
                label: optionLabelFromCompany(company),
                keywords: [company.name, company.legal_name, company.owner_name, company.address, company.city_name].filter(Boolean).join(" ")
              }))}
              onValueChange={(companyId) => {
                const company = companies.find((item) => item.id === companyId);
                onChange({
                  ...selection,
                  companyId,
                  companyName: company ? optionLabelFromCompany(company) : selection.companyName || companyId,
                  addressText: selection.addressText || company?.address || "",
                  addressSource: company?.address ? "company" : selection.addressSource
                });
                setCompanyPickerOpen(false);
              }}
              onSearchValueChange={setCompanySearch}
              placeholder={tt("search_company_biz", "Search company / business")}
              searchPlaceholder={tt("search_company_full", "Search company by name, code or owner")}
              emptyLabel={tt("no_companies", "No matching companies")}
              label={tt("linked_company", "Linked Company")}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCompanyPickerOpen(false)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {tt("close", "Close")}
              </button>
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </div>
  );
}

export function CustomerOrderManagementView() {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<ClearingCustomerOrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [goods, setGoods] = useState<GoodsRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [reportQuery, setReportQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<ClearingCustomerOrderRow | null>(null);
  const [partySelections, setPartySelections] = useState<Record<PartyRoleKey, PartySelection>>(emptyPartyState());
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const tt = (k: string, f: string) => t(lang, ("com." + k) as never, f);
  const title = t(lang, "nav.customer_order", "Customer Order");
  const refreshLabel = t(lang, "common.refresh", "Refresh");
  const saveLabel = editingOrderId ? tt("update_order", "Update Customer Order") : tt("save_order", "Save Customer Order");

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
    const query = normalize(reportQuery);
    if (!query) return orders;
    return orders.filter((order) => {
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
  }, [orders, reportQuery]);

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
      expected_loading_date: order.expected_loading_date ? String(order.expected_loading_date).slice(0, 10) : new Date().toISOString().split("T")[0],
      remarks: order.remarks || ""
    });

    const next = emptyPartyState();
    for (const link of order.party_links || []) {
      const roleKey = link.role_key;
      next[roleKey] = {
        customerId: link.party_customer_id || "",
        customerName: link.party_customer_name || "",
        companyId: link.party_company_id || "",
        companyName: link.party_company_name || "",
        addressText: link.selected_address_text || "",
        addressSource: link.selected_address_source || ""
      };
    }
    setPartySelections(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openViewOrder = (order: ClearingCustomerOrderRow) => {
    setViewOrder(order);
  };

  const handleExportOrder = (order: ClearingCustomerOrderRow) => {
    const blob = new Blob([JSON.stringify(order, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${order.order_no || "customer-order"}.json`;
    anchor.click();
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
      <script>window.onload=()=>window.print();</script>
      </body></html>`;
    const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=850");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = partySelections.supplier;
    if (!supplier.customerName) {
      alert(tt("err_supplier", "Please select the Supplier / Order Party."));
      return;
    }
    if (!partySelections.importer.customerName) {
      alert(tt("err_importer", "Please select an Importer."));
      return;
    }
    if (!partySelections.exporter.customerName) {
      alert(tt("err_exporter", "Please select an Exporter."));
      return;
    }

    setSaving(true);
    setSuccessMessage("");
    try {
      const payload = {
        ...formData,
        customer_id: supplier.customerId || null,
        customer_name: supplier.customerName,
        goods_id: formData.goods_id || null,
        goods_variation_id: formData.goods_variation_id || null,
        goods_name: formData.goods_name || null,
        goods_chs_code: formData.goods_chs_code || null,
        goods_variation_label: formData.goods_variation_label || null,
        goods_brand: formData.goods_brand || null,
        goods_size: formData.goods_size || null,
        goods_origin_country_name: formData.goods_origin_country_name || null,
        party_links: Object.entries(partySelections).map(([roleKey, selection]) => ({
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

      setSuccessMessage(`Order ${result.data.order_no || ""} ${editingOrderId ? "updated" : "created"} successfully.`);
      resetForm();
      await fetchInitialData();
    } catch (error: any) {
      alert(`${tt("err_save_failed", "Save failed")}: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

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
                {tt("header_left_right", "Left Entry / Right Register")}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                {tt("header_next", "Next")}: {nextActionLabel}
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">{tt("title", "Customer Order")}</h1>
            <p className="max-w-4xl text-xs text-slate-500 dark:text-slate-400">
              {tt("subtitle", "Search Supplier, Importer, Exporter and Notify Party masters, pick the linked company/business and address, then save a database-backed shipping order with the same row refreshed in the live register.")}
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {tt("new", "New")}
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
        {/* Left Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 self-start rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:col-span-5 xl:sticky xl:top-4"
        >
          <div className="space-y-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <FileText className="h-4 w-4 text-blue-600" />
              {tt("order_entry", "Order Entry")}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("movement", "Movement")}</div>
                <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200 capitalize">{formData.movement_type.replace("_", " ")}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("transport", "Transport")}</div>
                <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200 capitalize">{formData.transport_mode.replace("_", " ")}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("movement_type", "Movement Type")} *</label>
                <select
                  value={formData.movement_type}
                  onChange={(e) => setFormData((current) => ({ ...current, movement_type: e.target.value as MovementType }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="FCL">{tt("ship_fcl", "FCL (Full Container Load)")}</option>
                  <option value="LCL">{tt("ship_lcl", "LCL (Less than Container)")}</option>
                  <option value="Loose Cargo">{tt("ship_loose", "Loose Cargo")}</option>
                  <option value="Bulk Cargo">{tt("ship_bulk", "Bulk Cargo")}</option>
                </select>
              </div>
            </div>

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
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition-all ${
                      formData.loading_source === key
                        ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300"
                        : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder={tt("ls_name_ph", "Source name / truck number / container reference")}
                value={formData.loading_source_name}
                onChange={(e) => setFormData((current) => ({ ...current, loading_source_name: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Goods Master Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-800/40">
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
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("selected_goods", "Selected Goods")}</div>
                  <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                    {formData.goods_name ? `${formData.goods_name}${formData.goods_chs_code ? ` • ${formData.goods_chs_code}` : ""}` : "-"}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-500">
                    {selectedGoods
                      ? `${tt("goods_id", "Goods ID")}: ${selectedGoods.id}${selectedGoods.variations?.length ? ` • ${selectedGoods.variations.length}` : ""}`
                      : tt("select_goods_hint", "Select an existing Goods Master record.")}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("origin_variation", "Origin / Variation")}</div>
                  <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                    {formData.goods_origin_country_name || "-"}
                    {selectedGoodsVariation ? ` • ${selectedGoodsVariation.size} / ${selectedGoodsVariation.brand}` : ""}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-500">
                    {formData.goods_variation_label || tt("choose_variation_hint", "Choose a variation if goods master has multiple sizes/brands.")}
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

            {/* Party Role Panels */}
            <div className="grid grid-cols-1 gap-3.5">
              {PARTY_ROLES.map((role) => (
                <PartyRolePanel
                  key={role.key}
                  roleKey={role.key}
                  label={tt(role.labelKey, role.label)}
                  required={role.required}
                  selection={partySelections[role.key]}
                  customers={customers}
                  companies={companies}
                  orders={orders}
                  disabled={loading}
                  lang={lang}
                  onChange={(next) => handlePartyChange(role.key, next)}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("expected_loading_date", "Expected Loading Date")}</label>
                <input
                  type="date"
                  value={formData.expected_loading_date}
                  onChange={(e) => setFormData((current) => ({ ...current, expected_loading_date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("notify_party_required", "Notify Party Required")}</label>
                <select
                  value={formData.notify_party_required ? "yes" : "no"}
                  onChange={(e) =>
                    setFormData((current) => ({ ...current, notify_party_required: e.target.value === "yes" }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="no">{tt("no_opt", "No")}</option>
                  <option value="yes">{tt("yes", "Yes")}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("loading_country", "Loading Country")}</label>
                <select
                  value={formData.loading_country_id}
                  onChange={(e) => handleLoadingCountryChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("route_reference", "Route / Reference")}</label>
                <input
                  type="text"
                  placeholder={tt("route_ph", "e.g. Karachi to Kabul via Torkham")}
                  value={formData.route_name}
                  onChange={(e) => setFormData((current) => ({ ...current, route_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("cargo_container_details", "Cargo / Container Details")}</label>
                <input
                  type="text"
                  placeholder={tt("cargo_ph", "e.g. 40ft High Cube Container")}
                  value={formData.cargo_details}
                  onChange={(e) => setFormData((current) => ({ ...current, cargo_details: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{tt("remarks", "Remarks")}</label>
                <textarea
                  rows={4}
                  placeholder={tt("remarks_ph", "Additional instructions or notes...")}
                  value={formData.remarks}
                  onChange={(e) => setFormData((current) => ({ ...current, remarks: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <BadgeInfo className="h-4 w-4 text-blue-600" />
                  {tt("flow_hints", "Flow Hints")}
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("next_action", "Next Action")}</div>
                    <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">{nextActionLabel}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("loading_source", "Loading Source")}</div>
                    <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">{loadingSourceLabel}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("buyer_section", "Buyer Section")}</div>
                    <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">{shouldShowBuyer ? tt("visible", "Visible") : tt("optional", "Optional")}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("transport_gate", "Transport Gate")}</div>
                    <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">{isRoadMode ? tt("step_truck_entry", "Truck Entry") : isSeaMode ? tt("step_bill_entry", "Bill Entry") : tt("step_review", "Review")}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              {editingOrderId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {tt("cancel_edit", "Cancel Edit")}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {saveLabel}
              </button>
            </div>
          </div>
        </form>

        {/* Right Side Register & Live Report */}
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
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={reportQuery}
                  onChange={(e) => setReportQuery(e.target.value)}
                  placeholder={tt("search_order_ph", "Search order, party, route...")}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 ps-8 pe-3 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Orders Data Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-xs font-semibold text-slate-400">{tt("loading_orders", "Loading customer orders…")}</div>
            ) : visibleOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                {tt("empty_orders", "No customer orders found. Fill out the form on the left to create one.")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-xs text-slate-800 dark:text-slate-200">
                  <thead className="bg-slate-900 text-white dark:bg-slate-800 text-[11px] font-bold">
                    <tr>
                      <Th className="px-3 py-2.5">{tt("col_order_no", "Order No")}</Th>
                      <Th className="px-3 py-2.5">{tt("party", "Party")}</Th>
                      <Th className="px-3 py-2.5">{tt("col_movement_mode", "Movement / Mode")}</Th>
                      <Th className="px-3 py-2.5">{tt("col_company_address", "Company / Address")}</Th>
                      <Th className="px-3 py-2.5">{tt("col_goods_variation", "Goods / Variation")}</Th>
                      <Th className="px-3 py-2.5">{tt("col_route_port", "Route / Port")}</Th>
                      <Th className="px-3 py-2.5">{tt("col_next_step", "Next Step")}</Th>
                      <Th className="px-3 py-2.5">{tt("col_status", "Status")}</Th>
                      <Th className="px-3 py-2.5 text-right">{tt("col_actions", "Actions")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleOrders.map((order) => {
                      const movement = String(order.movement_type || "-").replace(/_/g, " ");
                      const mode = String(order.transport_mode || "-").replace(/_/g, " ");
                      const source = order.loading_source_name || order.loading_source || "-";
                      const route = order.route_name || `${order.loading_country_name || "-"} → ${order.receiving_country_name || "-"}`;
                      const port = [order.loading_port_name, order.destination_port_name].filter(Boolean).join(" → ") || "-";
                      const goodsSummary = [
                        order.goods_name,
                        order.goods_chs_code ? `CHS ${order.goods_chs_code}` : "",
                        order.goods_variation_label,
                        order.goods_origin_country_name
                      ]
                        .filter(Boolean)
                        .join(" • ") || "-";
                      const nextStep =
                        String(order.transport_mode || "").toLowerCase().includes("sea") || Boolean(order.notify_party_required)
                          ? tt("step_bill_entry", "Bill Entry")
                          : String(order.transport_mode || "").toLowerCase().includes("road") || String(order.transport_mode || "").toLowerCase().includes("truck")
                            ? tt("step_truck_entry", "Truck Entry")
                            : tt("step_review", "Review");
                      const supplierLink = (order.party_links || []).find((link) => link.role_key === "supplier");
                      const importLink = (order.party_links || []).find((link) => link.role_key === "importer");
                      const exportLink = (order.party_links || []).find((link) => link.role_key === "exporter");
                      const notifyLink = (order.party_links || []).find((link) => link.role_key === "notify_party");
                      const buyerLink = (order.party_links || []).find((link) => link.role_key === "buyer");

                      return (
                        <tr key={order.id} className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-3 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{order.order_no}</td>
                          <td className="px-3 py-2.5">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 dark:text-white">{order.customer_name}</div>
                              <div className="text-[10.5px] text-slate-500">
                                {[supplierLink?.party_customer_name, importLink?.party_customer_name, exportLink?.party_customer_name, notifyLink?.party_customer_name, buyerLink?.party_customer_name]
                                  .filter(Boolean)
                                  .join(" • ") || tt("default_party", "Customer order party")}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="space-y-0.5">
                              <span className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 capitalize">
                                {movement}
                              </span>
                              <div className="text-[10.5px] text-slate-500 capitalize">{mode}</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 max-w-[200px]">
                            <div className="space-y-0.5">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {[
                                  supplierLink?.party_company_name,
                                  importLink?.party_company_name,
                                  exportLink?.party_company_name,
                                  notifyLink?.party_company_name,
                                  buyerLink?.party_company_name
                                ]
                                  .filter(Boolean)
                                  .join(" • ") || source}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {[
                                  supplierLink?.selected_address_text,
                                  importLink?.selected_address_text,
                                  exportLink?.selected_address_text,
                                  notifyLink?.selected_address_text,
                                  buyerLink?.selected_address_text
                                ]
                                  .filter(Boolean)
                                  .join(" • ") || tt("selected_addresses", "Selected addresses")}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{goodsSummary}</div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {order.goods_id ? `${tt("goods_id", "Goods ID")}: ${order.goods_id}` : tt("uses_goods_master", "Uses Goods Master")}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400">
                            <div>{route}</div>
                            <div className="mt-0.5 text-[10px] text-slate-500">{port}</div>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">{nextStep}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                order.status === "pending"
                                  ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openViewOrder(order)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <Eye className="h-3 w-3" />
                                {tt("view", "View")}
                              </button>
                              <button
                                type="button"
                                onClick={() => loadEditOrder(order)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <Pencil className="h-3 w-3" />
                                {tt("edit", "Edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintOrder(order)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <Printer className="h-3 w-3" />
                                {tt("print", "Print")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportOrder(order)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <Download className="h-3 w-3" />
                                {tt("export", "Export")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Customer Order Modal */}
      {viewOrder ? (
        <SimpleModal
          title={`${tt("view_order_title", "View Customer Order")} — ${viewOrder.order_no}`}
          onClose={() => setViewOrder(null)}
          className="w-[96vw] max-w-[1000px] max-h-[90vh] overflow-y-auto rounded-2xl font-sans"
        >
          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-base font-black text-slate-900 dark:text-white">{viewOrder.order_no}</div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {viewOrder.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div><span className="text-slate-500 font-medium">{tt("party", "Party")}:</span> <span className="font-bold">{viewOrder.customer_name}</span></div>
                <div><span className="text-slate-500 font-medium">{tt("print_goods", "Goods")}:</span> <span className="font-bold">{[viewOrder.goods_name, viewOrder.goods_chs_code ? `CHS ${viewOrder.goods_chs_code}` : "", viewOrder.goods_variation_label, viewOrder.goods_origin_country_name].filter(Boolean).join(" • ") || "-"}</span></div>
                <div><span className="text-slate-500 font-medium">{tt("print_route", "Route")}:</span> <span className="font-bold">{viewOrder.route_name || "-"}</span></div>
                <div><span className="text-slate-500 font-medium">{tt("print_movement", "Movement")}:</span> <span className="font-bold capitalize">{viewOrder.movement_type}</span></div>
                <div><span className="text-slate-500 font-medium">{tt("transport_lbl", "Transport")}:</span> <span className="font-bold capitalize">{viewOrder.transport_mode}</span></div>
                <div><span className="text-slate-500 font-medium">{tt("goods_id", "Goods ID")}:</span> <span className="font-mono">{viewOrder.goods_id || "-"}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(viewOrder.party_links || []).map((link) => (
                <div key={link.id} className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">{link.role_key.replace("_", " ")}</div>
                  <div className="mt-1 text-xs font-bold text-slate-900 dark:text-white">{link.party_customer_name}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{link.party_company_name || "-"}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{link.selected_address_text || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </div>
  );
}
