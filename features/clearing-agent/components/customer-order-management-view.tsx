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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

const PARTY_ROLES: Array<{ key: PartyRoleKey; label: string; required?: boolean }> = [
  { key: "supplier", label: "Supplier / Order Party", required: true },
  { key: "importer", label: "Importer", required: true },
  { key: "exporter", label: "Exporter", required: true },
  { key: "notify_party", label: "Notify Party" },
  { key: "buyer", label: "Buyer" }
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
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 shadow-xs space-y-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">
            {selection.customerName ? selection.customerName : `Select ${label}`}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          <Building2 className="h-3.5 w-3.5" />
          {effectiveCompanyName ? "Company selected" : "Linked companies"}
        </span>
      </div>

      <SearchSelect
        label={`${label} Party`}
        value={selection.customerId}
        placeholder={disabled ? "Loading..." : `Search ${label.toLowerCase()} by name / code / phone`}
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
        searchPlaceholder="Search party"
        emptyLabel="No matching parties"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || !selection.customerId}
          onClick={() => setCompanyPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          {linkedCompanies.length > 0 ? `${linkedCompanies.length} linked companies` : "Pick company"}
        </button>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Selected Company:</span> {effectiveCompanyName || "-"}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Address / Billing / Shipping
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
            placeholder="Search address"
            searchPlaceholder="Search address"
            emptyLabel="No matching addresses"
          />
        ) : (
          <input
            value={selection.addressText}
            onChange={(e) => onChange({ ...selection, addressText: e.target.value, addressSource: "manual" })}
            placeholder="Enter address"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        )}
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Selected Address: {summaryValue(effectiveAddress)}</div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-500 font-medium">Party</span>
          <span className="text-right font-bold text-slate-800 dark:text-slate-100">{summaryValue(selection.customerName)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-500 font-medium">Company</span>
          <span className="text-right font-bold text-slate-800 dark:text-slate-100">{summaryValue(effectiveCompanyName)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-500 font-medium">Address</span>
          <span className="max-w-[70%] text-right font-medium text-slate-700 dark:text-slate-300">{summaryValue(effectiveAddress)}</span>
        </div>
      </div>

      {companyPickerOpen ? (
        <SimpleModal
          title={`${label} - Linked Companies`}
          onClose={() => setCompanyPickerOpen(false)}
          className="w-[96vw] max-w-[900px] max-h-[90vh] overflow-y-auto rounded-xl font-sans"
        >
          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Search and select the correct company/business linked to this party.
              </div>
              <div className="mt-1 text-xs text-slate-500">
                If previous orders already linked this party to companies, they appear first.
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
              placeholder="Search company / business"
              searchPlaceholder="Search company by name, code or owner"
              emptyLabel="No matching companies"
              label="Linked Company"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCompanyPickerOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
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

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [orderRes, custRes, compRes, goodsRes, countryRes, portRes] = await Promise.all([
        fetch("/api/erp/clearing-agent/customer-orders?limit=100", { cache: "no-store" }),
        fetch("/api/erp/settings/customers?limit=200", { cache: "no-store" }),
        fetch("/api/erp/settings/companies?limit=200", { cache: "no-store" }),
        fetch("/api/erp/settings/goods?limit=200", { cache: "no-store" }),
        fetch("/api/erp/settings/locations/countries", { cache: "no-store" }),
        fetch("/api/erp/settings/ports", { cache: "no-store" })
      ]);

      const [orderJson, custJson, compJson, goodsJson, countryJson, portJson] = await Promise.all([
        orderRes.json().catch(() => ({})),
        custRes.json().catch(() => ({})),
        compJson.json().catch(() => ({})),
        goodsJson.json().catch(() => ({})),
        countryJson.json().catch(() => ({})),
        portJson.json().catch(() => ({}))
      ]);

      if (orderJson?.data) setOrders(orderJson.data);
      if (custJson?.data) setCustomers(custJson.data);
      if (compJson?.data) setCompanies(compJson.data);
      if (goodsJson?.data) setGoods(goodsJson.data);
      if (countryJson?.data) setCountries(countryJson.data);
      if (portJson?.data) setPorts(portJson.data);
    } catch (error) {
      console.error("Error fetching clearing initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setPartySelections(emptyPartyState());
    setEditingOrderId(null);
  };

  const handlePartyChange = (roleKey: PartyRoleKey, next: PartySelection) => {
    setPartySelections((prev) => ({
      ...prev,
      [roleKey]: next
    }));
  };

  const selectedGoods = goods.find((item) => item.id === formData.goods_id);
  const selectedGoodsVariation = selectedGoods?.variations?.find((item) => item.id === formData.goods_variation_id);

  const goodsOptions = useMemo(
    () =>
      goods.map((item) => ({
        value: item.id,
        label: `${item.goods_name || item.name || "Goods"}${item.chs_code ? ` • CHS ${item.chs_code}` : ""}`,
        keywords: [item.goods_name, item.name, item.chs_code, item.origin_country_name].filter(Boolean).join(" ")
      })),
    [goods]
  );

  const variationOptions = useMemo(() => {
    if (!selectedGoods?.variations?.length) return [];
    return selectedGoods.variations.map((v) => ({
      value: v.id,
      label: [v.size, v.brand].filter(Boolean).join(" • ") || `Variation ${v.id}`,
      keywords: [v.size, v.brand].filter(Boolean).join(" ")
    }));
  }, [selectedGoods]);

  const handleGoodsChange = (goodsId: string) => {
    const item = goods.find((g) => g.id === goodsId);
    setFormData((prev) => ({
      ...prev,
      goods_id: goodsId,
      goods_name: item?.goods_name || item?.name || "",
      goods_chs_code: item?.chs_code || "",
      goods_origin_country_id: item?.origin_country_id || "",
      goods_origin_country_name: item?.origin_country_name || "",
      goods_variation_id: "",
      goods_variation_label: ""
    }));
  };

  const handleGoodsVariationChange = (variationId: string) => {
    const v = selectedGoods?.variations?.find((item) => item.id === variationId);
    setFormData((prev) => ({
      ...prev,
      goods_variation_id: variationId,
      goods_variation_label: v ? [v.size, v.brand].filter(Boolean).join(" • ") : ""
    }));
  };

  const handleLoadingCountryChange = (countryId: string) => {
    const country = countries.find((c) => c.id === countryId);
    setFormData((prev) => ({
      ...prev,
      loading_country_id: countryId,
      loading_country_name: country?.name || ""
    }));
  };

  const handleReceivingCountryChange = (countryId: string) => {
    const country = countries.find((c) => c.id === countryId);
    setFormData((prev) => ({
      ...prev,
      receiving_country_id: countryId,
      receiving_country_name: country?.name || ""
    }));
  };

  const handleLoadingPortChange = (portId: string) => {
    const port = ports.find((p) => p.id === portId);
    setFormData((prev) => ({
      ...prev,
      loading_port_id: portId,
      loading_port_name: port?.port_name || ""
    }));
  };

  const handleDestinationPortChange = (portId: string) => {
    const port = ports.find((p) => p.id === portId);
    setFormData((prev) => ({
      ...prev,
      destination_port_id: portId,
      destination_port_name: port?.port_name || ""
    }));
  };

  const loadEditOrder = (order: ClearingCustomerOrderRow) => {
    setEditingOrderId(order.id);
    setFormData({
      movement_type: (order.movement_type as MovementType) || "import",
      transport_mode: (order.transport_mode as TransportMode) || "by_sea",
      loading_source: (order.loading_source as LoadingSource) || "warehouse",
      loading_source_name: order.loading_source_name || "",
      shipment_type: order.shipment_type || "FCL",
      goods_id: order.goods_id || "",
      goods_name: order.goods_name || "",
      goods_chs_code: order.goods_chs_code || "",
      goods_origin_country_id: order.goods_origin_country_id || "",
      goods_origin_country_name: order.goods_origin_country_name || "",
      goods_variation_id: order.goods_variation_id || "",
      goods_variation_label: order.goods_variation_label || "",
      expected_loading_date: order.expected_loading_date || "",
      notify_party_required: Boolean(order.notify_party_required),
      loading_country_id: order.loading_country_id || "",
      loading_country_name: order.loading_country_name || "",
      receiving_country_id: order.receiving_country_id || "",
      receiving_country_name: order.receiving_country_name || "",
      loading_port_id: order.loading_port_id || "",
      loading_port_name: order.loading_port_name || "",
      destination_port_id: order.destination_port_id || "",
      destination_port_name: order.destination_port_name || "",
      route_name: order.route_name || "",
      cargo_details: order.cargo_details || "",
      remarks: order.remarks || ""
    });

    const nextState = emptyPartyState();
    (order.party_links || []).forEach((link) => {
      if (link.role_key in nextState) {
        nextState[link.role_key as PartyRoleKey] = {
          customerId: link.party_customer_id || "",
          customerName: link.party_customer_name || "",
          companyId: link.party_company_id || "",
          companyName: link.party_company_name || "",
          addressText: link.selected_address_text || "",
          addressSource: "selected"
        };
      }
    });
    setPartySelections(nextState);
  };

  const openViewOrder = (order: ClearingCustomerOrderRow) => {
    setViewOrder(order);
  };

  const handlePrintOrder = (order: ClearingCustomerOrderRow) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>${order.order_no || "Customer Order"}</title>
      <style>body{font-family:sans-serif;padding:24px;font-size:12px;color:#1e293b}h1{font-size:18px;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}</style>
      </head><body>
      <h1>Customer Order — ${order.order_no || ""}</h1>
      <p>Status: ${order.status} | Movement: ${order.movement_type} | Mode: ${order.transport_mode}</p>
      <table>
        <tr><th>Order No</th><td>${order.order_no}</td><th>Date</th><td>${order.created_at || ""}</td></tr>
        <tr><th>Party / Customer</th><td>${order.customer_name}</td><th>Goods</th><td>${order.goods_name || "-"}</td></tr>
        <tr><th>Route</th><td>${order.route_name || "-"}</td><th>Cargo Details</th><td>${order.cargo_details || "-"}</td></tr>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleExportOrder = (order: ClearingCustomerOrderRow) => {
    const json = JSON.stringify(order, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-${order.order_no || order.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRoadMode = formData.transport_mode === "by_road" || formData.transport_mode === "by_truck";
  const isSeaMode = formData.transport_mode === "by_sea";
  const shouldShowBuyer = formData.movement_type === "export" || formData.movement_type === "up_transit";

  const nextActionLabel =
    isSeaMode || formData.notify_party_required
      ? "Bill Entry"
      : isRoadMode
        ? "Truck Entry"
        : "Review & Dispatch";

  const loadingSourceLabel =
    formData.loading_source === "warehouse"
      ? "Warehouse Loading"
      : formData.loading_source === "truck_transfer"
        ? "Truck-to-Truck Transfer"
        : "Container-to-Truck Transfer";

  const visibleOrders = useMemo(() => {
    if (!reportQuery.trim()) return orders;
    const q = reportQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.order_no?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.route_name?.toLowerCase().includes(q) ||
        o.goods_name?.toLowerCase().includes(q) ||
        o.cargo_details?.toLowerCase().includes(q)
    );
  }, [orders, reportQuery]);

  const orderCounts = useMemo(() => {
    const total = orders.length;
    const imp = orders.filter((o) => o.movement_type === "import").length;
    const exp = orders.filter((o) => o.movement_type === "export").length;
    const dom = orders.filter((o) => o.movement_type === "domestic").length;
    const trn = orders.filter((o) => o.movement_type === "up_transit").length;
    return { total, import: imp, export: exp, domestic: dom, transit: trn };
  }, [orders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...formData,
        parties: partySelections
      };

      const url = editingOrderId
        ? `/api/erp/clearing-agent/customer-orders/${editingOrderId}`
        : "/api/erp/clearing-agent/customer-orders";
      const method = editingOrderId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to save customer order");

      setSuccessMessage(`Order ${result.data?.order_no || ""} ${editingOrderId ? "updated" : "created"} successfully.`);
      resetForm();
      await fetchInitialData();
    } catch (error: any) {
      alert(`Save failed: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-4 pb-12 text-foreground animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
              Customer Order Entry
            </span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              Form & Live Register
            </span>
            <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
              Next: {nextActionLabel}
            </span>
          </div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Customer Order Management</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search Supplier, Importer, Exporter and Notify Party masters, link addresses, and register database-backed shipping orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchInitialData}
            disabled={loading}
            className="h-8 gap-1.5 rounded-lg border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Reload
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={resetForm}
            className="h-8 gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New Order
          </Button>
        </div>
      </div>

      {successMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-xs font-bold">{successMessage}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 self-start rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:col-span-5 xl:sticky xl:top-4"
        >
          <div className="space-y-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {editingOrderId ? "Edit Customer Order" : "New Order Entry"}
              </h2>
              {editingOrderId ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                  Editing
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Movement</div>
                <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">{formData.movement_type.replace("_", " ")}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transport</div>
                <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">{formData.transport_mode.replace("_", " ")}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Movement Type *</label>
                <select
                  value={formData.movement_type}
                  onChange={(e) => setFormData((current) => ({ ...current, movement_type: e.target.value as MovementType }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="import">Import</option>
                  <option value="export">Export</option>
                  <option value="domestic">Domestic</option>
                  <option value="up_transit">Up Transit</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Shipment Type</label>
                <select
                  value={formData.shipment_type}
                  onChange={(e) => setFormData((current) => ({ ...current, shipment_type: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="FCL">FCL (Full Container Load)</option>
                  <option value="LCL">LCL (Less than Container)</option>
                  <option value="Loose Cargo">Loose Cargo</option>
                  <option value="Bulk Cargo">Bulk Cargo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Transport Mode *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "by_sea", label: "By Sea", icon: Anchor },
                  { key: "by_road", label: "By Road", icon: MapPin },
                  { key: "by_truck", label: "By Truck", icon: Truck },
                  { key: "by_air", label: "By Air", icon: Plane }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData((current) => ({ ...current, transport_mode: key as TransportMode }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all",
                      formData.transport_mode === key
                        ? "border-blue-600 bg-blue-50 text-blue-700 shadow-2xs dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                        : "border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Loading Source</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { key: "warehouse", label: "Warehouse", icon: Warehouse },
                  { key: "truck_transfer", label: "Truck Transfer", icon: Repeat2 },
                  { key: "container_transfer", label: "Container Transfer", icon: Container }
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
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all",
                      formData.loading_source === key
                        ? "border-sky-600 bg-sky-50 text-sky-700 shadow-2xs dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300"
                        : "border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Source name / truck number / container reference"
                value={formData.loading_source_name}
                onChange={(e) => setFormData((current) => ({ ...current, loading_source_name: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <Boxes className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Goods / Item Master
              </div>
              <SearchSelect
                label="Goods Master"
                value={formData.goods_id}
                placeholder="Search existing Goods Master by name / CHS code"
                options={goodsOptions}
                onValueChange={handleGoodsChange}
                disabled={loading}
                searchPlaceholder="Search goods / CHS code / variation"
                emptyLabel="No matching goods found"
              />
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selected Goods</div>
                  <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                    {formData.goods_name ? `${formData.goods_name}${formData.goods_chs_code ? ` • ${formData.goods_chs_code}` : ""}` : "-"}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-500">
                    {selectedGoods
                      ? `ID: ${selectedGoods.id.substring(0, 8)}...${selectedGoods.variations?.length ? ` • ${selectedGoods.variations.length} variation(s)` : ""}`
                      : "Select Goods Master."}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Origin / Variation</div>
                  <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                    {formData.goods_origin_country_name || "-"}
                    {selectedGoodsVariation ? ` • ${selectedGoodsVariation.size} / ${selectedGoodsVariation.brand}` : ""}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-500 truncate">
                    {formData.goods_variation_label || "No variation selected"}
                  </div>
                </div>
              </div>
              {variationOptions.length > 0 ? (
                <SearchSelect
                  label="Goods Variation"
                  value={formData.goods_variation_id}
                  placeholder="Search variation size / brand"
                  options={variationOptions}
                  onValueChange={handleGoodsVariationChange}
                  disabled={loading}
                  searchPlaceholder="Search size / brand"
                  emptyLabel="No matching variations found"
                />
              ) : null}
            </div>

            <div className="space-y-3">
              {PARTY_ROLES.map((role) => (
                <PartyRolePanel
                  key={role.key}
                  roleKey={role.key}
                  label={role.label}
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
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Expected Loading Date</label>
                <input
                  type="date"
                  value={formData.expected_loading_date}
                  onChange={(e) => setFormData((current) => ({ ...current, expected_loading_date: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Notify Party Required</label>
                <select
                  value={formData.notify_party_required ? "yes" : "no"}
                  onChange={(e) =>
                    setFormData((current) => ({ ...current, notify_party_required: e.target.value === "yes" }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Loading Country</label>
                <select
                  value={formData.loading_country_id}
                  onChange={(e) => handleLoadingCountryChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select Loading Country</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Receiving Country</label>
                <select
                  value={formData.receiving_country_id}
                  onChange={(e) => handleReceivingCountryChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select Receiving Country</option>
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
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Loading Port</label>
                <select
                  value={formData.loading_port_id}
                  onChange={(e) => handleLoadingPortChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select Loading Port</option>
                  {ports.map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.port_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Destination Port</label>
                <select
                  value={formData.destination_port_id}
                  onChange={(e) => handleDestinationPortChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select Destination Port</option>
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
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Route / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Karachi to Kabul via Torkham"
                  value={formData.route_name}
                  onChange={(e) => setFormData((current) => ({ ...current, route_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Cargo / Container Details</label>
                <input
                  type="text"
                  placeholder="e.g. 40ft High Cube Container"
                  value={formData.cargo_details}
                  onChange={(e) => setFormData((current) => ({ ...current, cargo_details: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Remarks</label>
              <textarea
                rows={3}
                placeholder="Additional instructions or notes..."
                value={formData.remarks}
                onChange={(e) => setFormData((current) => ({ ...current, remarks: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {editingOrderId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                  className="h-8 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300"
                >
                  Cancel Edit
                </Button>
              ) : null}
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="h-8 gap-1.5 bg-blue-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {editingOrderId ? "Update Customer Order" : "Save Customer Order"}
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-4 xl:col-span-7">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: "Total Orders", value: orderCounts.total, icon: FileText, color: "text-blue-600 bg-blue-50 border-blue-200" },
                { label: "Import", value: orderCounts.import, icon: ArrowRight, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                { label: "Export", value: orderCounts.export, icon: Route, color: "text-purple-600 bg-purple-50 border-purple-200" },
                { label: "Domestic / Transit", value: `${orderCounts.domestic} / ${orderCounts.transit}`, icon: Boxes, color: "text-amber-600 bg-amber-50 border-amber-200" }
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <item.icon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                    {item.label}
                  </div>
                  <div className="mt-1.5 text-xl font-black text-slate-900 dark:text-white">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Registered Customer Orders ({orders.length})</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Live report connected to registered clearing agent orders and party links.
                </p>
              </div>
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={reportQuery}
                  onChange={(e) => setReportQuery(e.target.value)}
                  placeholder="Search order, party, route..."
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 shadow-2xs outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading customer orders…</div>
            ) : visibleOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No customer orders created yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5">Order No</th>
                      <th className="px-3 py-2.5">Party</th>
                      <th className="px-3 py-2.5">Movement / Mode</th>
                      <th className="px-3 py-2.5">Company / Address</th>
                      <th className="px-3 py-2.5">Goods / Variation</th>
                      <th className="px-3 py-2.5">Route / Port</th>
                      <th className="px-3 py-2.5">Next Step</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleOrders.map((order, idx) => {
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
                          ? "Bill Entry"
                          : String(order.transport_mode || "").toLowerCase().includes("road") || String(order.transport_mode || "").toLowerCase().includes("truck")
                            ? "Truck Entry"
                            : "Review";
                      const supplierLink = (order.party_links || []).find((link) => link.role_key === "supplier");
                      const importLink = (order.party_links || []).find((link) => link.role_key === "importer");
                      const exportLink = (order.party_links || []).find((link) => link.role_key === "exporter");
                      const notifyLink = (order.party_links || []).find((link) => link.role_key === "notify_party");
                      const buyerLink = (order.party_links || []).find((link) => link.role_key === "buyer");

                      return (
                        <tr key={order.id} className={cn("align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50", idx % 2 ? "bg-slate-50/30" : "bg-white")}>
                          <td className="px-3 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{order.order_no}</td>
                          <td className="px-3 py-2.5">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{order.customer_name}</div>
                              <div className="text-[10px] text-slate-500">
                                {[supplierLink?.party_customer_name, importLink?.party_customer_name, exportLink?.party_customer_name, notifyLink?.party_customer_name, buyerLink?.party_customer_name]
                                  .filter(Boolean)
                                  .join(" • ") || "Customer order party"}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="space-y-0.5">
                              <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {movement}
                              </span>
                              <div className="text-[10px] text-slate-500 font-medium">{mode}</div>
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
                                  .join(" • ") || "Selected addresses"}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 max-w-[180px]">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{goodsSummary}</div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {order.goods_id ? `Goods ID: ${order.goods_id.substring(0, 8)}...` : "Goods Master"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 max-w-[160px]">
                            <div className="font-medium text-slate-700 dark:text-slate-300 truncate">{route}</div>
                            <div className="mt-0.5 text-[10px] text-slate-500 truncate">{port}</div>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{nextStep}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                order.status === "pending"
                                  ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              )}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <div className="flex flex-wrap justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openViewOrder(order)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => loadEditOrder(order)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintOrder(order)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <Printer className="h-3 w-3" />
                                Print
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportOrder(order)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <Download className="h-3 w-3" />
                                Export
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

      {viewOrder ? (
        <SimpleModal
          title={`View Customer Order — ${viewOrder.order_no}`}
          onClose={() => setViewOrder(null)}
          className="w-[96vw] max-w-[1100px] max-h-[90vh] overflow-y-auto rounded-xl font-sans"
        >
          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-base font-black text-slate-900 dark:text-white">{viewOrder.order_no}</div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {viewOrder.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                <div><span className="text-slate-500 font-medium">Party:</span> <span className="font-bold text-slate-800 dark:text-slate-100">{viewOrder.customer_name}</span></div>
                <div><span className="text-slate-500 font-medium">Goods:</span> <span className="font-bold text-slate-800 dark:text-slate-100">{[viewOrder.goods_name, viewOrder.goods_chs_code ? `CHS ${viewOrder.goods_chs_code}` : "", viewOrder.goods_variation_label, viewOrder.goods_origin_country_name].filter(Boolean).join(" • ") || "-"}</span></div>
                <div><span className="text-slate-500 font-medium">Route:</span> <span className="font-bold text-slate-800 dark:text-slate-100">{viewOrder.route_name || "-"}</span></div>
                <div><span className="text-slate-500 font-medium">Movement:</span> <span className="font-bold text-slate-800 dark:text-slate-100">{viewOrder.movement_type}</span></div>
                <div><span className="text-slate-500 font-medium">Transport:</span> <span className="font-bold text-slate-800 dark:text-slate-100">{viewOrder.transport_mode}</span></div>
                <div><span className="text-slate-500 font-medium">Goods ID:</span> <span className="font-bold text-slate-800 dark:text-slate-100">{viewOrder.goods_id || "-"}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(viewOrder.party_links || []).map((link) => (
                <div key={link.id} className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{link.role_key.replace("_", " ")}</div>
                  <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{link.party_customer_name}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">{link.party_company_name || "-"}</div>
                  <div className="mt-1.5 text-[11px] text-slate-500">{link.selected_address_text || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </div>
  );
}
