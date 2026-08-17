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
import { DashboardFrame } from "@/components/layout/dashboard-frame";
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {selection.customerName ? selection.customerName : `Select ${label}`}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
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
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Building2 className="h-4 w-4 text-indigo-400" />
          {linkedCompanies.length > 0 ? `${linkedCompanies.length} linked companies` : "Pick company"}
        </button>
        <div className="text-[11px] text-slate-500">
          <span className="font-semibold text-slate-300">Selected Company:</span> {effectiveCompanyName || "-"}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-slate-300 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-emerald-400" />
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
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
          />
        )}
        <div className="mt-1 text-[11px] text-slate-500">Selected Address: {summaryValue(effectiveAddress)}</div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-500">Party</span>
          <span className="text-right font-medium text-slate-100">{summaryValue(selection.customerName)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-500">Company</span>
          <span className="text-right font-medium text-slate-100">{summaryValue(effectiveCompanyName)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-500">Address</span>
          <span className="max-w-[70%] text-right font-medium text-slate-100">{summaryValue(effectiveAddress)}</span>
        </div>
      </div>

      {companyPickerOpen ? (
        <SimpleModal
          title={`${label} - Linked Companies`}
          onClose={() => setCompanyPickerOpen(false)}
          className="w-[96vw] max-w-[900px] max-h-[90vh] overflow-y-auto rounded-2xl font-sans"
        >
          <div className="space-y-4 p-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
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
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
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
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [reportQuery, setReportQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<ClearingCustomerOrderRow | null>(null);
  const [partySelections, setPartySelections] = useState<Record<PartyRoleKey, PartySelection>>(emptyPartyState());
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const title = t(lang, "nav.customer_order", "Customer Order");
  const refreshLabel = t(lang, "common.refresh", "Refresh");
  const saveLabel = editingOrderId ? "Update Customer Order" : "Save Customer Order";

  useEffect(() => {
    void fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [orderRes, customerRes, companyRes, countryRes, portRes] = await Promise.all([
        fetch("/api/erp/clearing-agent/customer-order"),
        fetch("/api/erp/customers?limit=250"),
        fetch("/api/erp/companies?limit=250"),
        fetch("/api/erp/locations/countries"),
        fetch("/api/erp/ports")
      ]);

      const [orderJson, customerJson, companyJson, countryJson, portJson] = await Promise.all([
        orderRes.json(),
        customerRes.json(),
        companyRes.json(),
        countryRes.json(),
        portRes.json()
      ]);

      const extractArray = (json: any, keys: string[]) => {
        if (!json) return [];
        if (Array.isArray(json)) return json;
        if (Array.isArray(json.data)) return json.data;
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

  const visibleOrders = useMemo(() => {
    const query = normalize(reportQuery);
    if (!query) return orders;
    return orders.filter((order) => {
      const haystack = [
        order.order_no,
        order.customer_name,
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
  const nextActionLabel = isSeaMode || formData.notify_party_required ? "Bill Entry" : isRoadMode ? "Truck Entry" : "Review";
  const loadingSourceLabel =
    formData.loading_source === "warehouse"
      ? "Warehouse"
      : formData.loading_source === "truck_transfer"
        ? "Transfer from Truck"
        : "Transfer from Container";

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
    const html = `
      <html><head><title>${order.order_no || "Customer Order"}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;}
        h1{margin:0 0 10px 0;}
        table{width:100%;border-collapse:collapse;margin-top:16px;}
        th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:12px;}
        th{background:#f1f5f9;}
      </style></head><body>
      <h1>${order.order_no || "Customer Order"}</h1>
      <p><strong>Party:</strong> ${order.customer_name || "-"}</p>
      <p><strong>Route:</strong> ${order.route_name || "-"}</p>
      <p><strong>Movement:</strong> ${order.movement_type || "-"}</p>
      <table>
        <thead><tr><th>Role</th><th>Party</th><th>Company</th><th>Address</th></tr></thead>
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
      alert("Please select the Supplier / Order Party.");
      return;
    }
    if (!partySelections.importer.customerName) {
      alert("Please select an Importer.");
      return;
    }
    if (!partySelections.exporter.customerName) {
      alert("Please select an Exporter.");
      return;
    }

    setSaving(true);
    setSuccessMessage("");
    try {
      const payload = {
        ...formData,
        customer_id: supplier.customerId || null,
        customer_name: supplier.customerName,
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
      if (!result.success) throw new Error(result.error || "Failed to save order");

      setSuccessMessage(`Order ${result.data.order_no || ""} ${editingOrderId ? "updated" : "created"} successfully.`);
      resetForm();
      await fetchInitialData();
    } catch (error: any) {
      alert(`Save failed: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardFrame title={title} subtitle="Shipping Line / Clearing Agent — searchable party, company and address workflow">
      <div className="mx-auto max-w-[1700px] space-y-6 pb-12">
        <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-indigo-500/30 bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-200">
                  Customer Order Entry
                </span>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                  Left Entry / Right Report
                </span>
                <span className="rounded-md border border-sky-500/30 bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-200">
                  Next: {nextActionLabel}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Customer Order</h1>
              <p className="max-w-4xl text-sm text-slate-300">
                Search Supplier, Importer, Exporter and Notify Party masters, pick the linked company/business and
                address, then save a database-backed shipping order with the same row refreshed in the live register.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchInitialData}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-700"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {refreshLabel}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                New
              </button>
            </div>
          </div>
        </div>

        {successMessage ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <form
            onSubmit={handleSubmit}
            className="space-y-5 self-start rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg xl:col-span-5 xl:sticky xl:top-4"
          >
            <div className="space-y-3 border-b border-slate-800 pb-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <FileText className="h-5 w-5 text-indigo-400" />
                Order Entry
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="uppercase tracking-wider text-slate-500">Movement</div>
                  <div className="mt-1 font-semibold text-slate-100">{formData.movement_type.replace("_", " ")}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="uppercase tracking-wider text-slate-500">Transport</div>
                  <div className="mt-1 font-semibold text-slate-100">{formData.transport_mode.replace("_", " ")}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Movement Type *</label>
                  <select
                    value={formData.movement_type}
                    onChange={(e) => setFormData((current) => ({ ...current, movement_type: e.target.value as MovementType }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="import">Import</option>
                    <option value="export">Export</option>
                    <option value="domestic">Domestic</option>
                    <option value="up_transit">Up Transit</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Shipment Type</label>
                  <select
                    value={formData.shipment_type}
                    onChange={(e) => setFormData((current) => ({ ...current, shipment_type: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="FCL">FCL (Full Container Load)</option>
                    <option value="LCL">LCL (Less than Container)</option>
                    <option value="Loose Cargo">Loose Cargo</option>
                    <option value="Bulk Cargo">Bulk Cargo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">Transport Mode *</label>
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
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                        formData.transport_mode === key
                          ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">Loading Source</label>
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
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                        formData.loading_source === key
                          ? "border-sky-500 bg-sky-600/20 text-sky-300"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                      }`}
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
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
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

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Expected Loading Date</label>
                  <input
                    type="date"
                    value={formData.expected_loading_date}
                    onChange={(e) => setFormData((current) => ({ ...current, expected_loading_date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Notify Party Required</label>
                  <select
                    value={formData.notify_party_required ? "yes" : "no"}
                    onChange={(e) =>
                      setFormData((current) => ({ ...current, notify_party_required: e.target.value === "yes" }))
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Loading Country</label>
                  <select
                    value={formData.loading_country_id}
                    onChange={(e) => handleLoadingCountryChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
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
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Receiving Country</label>
                  <select
                    value={formData.receiving_country_id}
                    onChange={(e) => handleReceivingCountryChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
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

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Loading Port</label>
                  <select
                    value={formData.loading_port_id}
                    onChange={(e) => handleLoadingPortChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
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
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Destination Port</label>
                  <select
                    value={formData.destination_port_id}
                    onChange={(e) => handleDestinationPortChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
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

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Route / Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Karachi to Kabul via Torkham"
                    value={formData.route_name}
                    onChange={(e) => setFormData((current) => ({ ...current, route_name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Cargo / Container Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 40ft High Cube Container"
                    value={formData.cargo_details}
                    onChange={(e) => setFormData((current) => ({ ...current, cargo_details: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Remarks</label>
                  <textarea
                    rows={4}
                    placeholder="Additional instructions or notes..."
                    value={formData.remarks}
                    onChange={(e) => setFormData((current) => ({ ...current, remarks: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <BadgeInfo className="h-4 w-4 text-sky-400" />
                    Flow Hints
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500">Next Action</div>
                      <div className="mt-1 font-semibold text-slate-100">{nextActionLabel}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500">Loading Source</div>
                      <div className="mt-1 font-semibold text-slate-100">{loadingSourceLabel}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500">Buyer Section</div>
                      <div className="mt-1 font-semibold text-slate-100">{shouldShowBuyer ? "Visible" : "Optional"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500">Transport Gate</div>
                      <div className="mt-1 font-semibold text-slate-100">{isRoadMode ? "Truck Entry" : isSeaMode ? "Bill Entry" : "Review"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                {editingOrderId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                  >
                    Cancel Edit
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saveLabel}
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-4 xl:col-span-7">
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Total", value: orderCounts.total, icon: FileText },
                  { label: "Import", value: orderCounts.import, icon: ArrowRight },
                  { label: "Export", value: orderCounts.export, icon: Route },
                  { label: "Domestic / Transit", value: `${orderCounts.domestic} / ${orderCounts.transit}`, icon: Boxes }
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400">
                      <item.icon className="h-4 w-4 text-sky-400" />
                      {item.label}
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Registered Customer Orders ({orders.length})</h2>
                  <p className="text-xs text-slate-400">
                    Live report on the right, driven from the same canonical table and party-link rows.
                  </p>
                </div>
                <div className="relative sm:w-80">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={reportQuery}
                    onChange={(e) => setReportQuery(e.target.value)}
                    placeholder="Search order, party, route, company..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 ps-9 pe-3 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
              {loading ? (
                <div className="py-12 text-center text-sm text-slate-400">Loading customer orders…</div>
              ) : visibleOrders.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">No customer orders created yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="border-b border-slate-800 bg-slate-950 text-xs font-semibold uppercase text-slate-400">
                      <tr>
                        <Th className="px-4 py-3">Order No</Th>
                        <Th className="px-4 py-3">Party</Th>
                        <Th className="px-4 py-3">Movement / Mode</Th>
                        <Th className="px-4 py-3">Company / Address</Th>
                        <Th className="px-4 py-3">Route / Port</Th>
                        <Th className="px-4 py-3">Next Step</Th>
                        <Th className="px-4 py-3">Status</Th>
                        <Th className="px-4 py-3 text-right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {visibleOrders.map((order) => {
                        const movement = String(order.movement_type || "-").replace(/_/g, " ");
                        const mode = String(order.transport_mode || "-").replace(/_/g, " ");
                        const source = order.loading_source_name || order.loading_source || "-";
                        const route = order.route_name || `${order.loading_country_name || "-"} → ${order.receiving_country_name || "-"}`;
                        const port = [order.loading_port_name, order.destination_port_name].filter(Boolean).join(" → ") || "-";
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
                          <tr key={order.id} className="align-top transition-colors hover:bg-slate-800/30">
                            <td className="px-4 py-3 font-mono font-medium text-indigo-400">{order.order_no}</td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="font-medium text-white">{order.customer_name}</div>
                                <div className="text-[11px] text-slate-500">
                                  {[supplierLink?.party_customer_name, importLink?.party_customer_name, exportLink?.party_customer_name, notifyLink?.party_customer_name, buyerLink?.party_customer_name]
                                    .filter(Boolean)
                                    .join(" • ") || "Customer order party"}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="inline-flex rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                                  {movement}
                                </div>
                                <div className="text-[11px] text-slate-500">{mode}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="font-medium text-slate-100">
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
                                <div className="text-[11px] text-slate-500">
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
                            <td className="px-4 py-3 text-xs text-slate-400">
                              <div>{route}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{port}</div>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-200">{nextStep}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  order.status === "pending"
                                    ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
                                    : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                                }`}
                              >
                                {order.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openViewOrder(order)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-indigo-500 hover:text-white"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => loadEditOrder(order)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-indigo-500 hover:text-white"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintOrder(order)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-indigo-500 hover:text-white"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  Print
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportOrder(order)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-indigo-500 hover:text-white"
                                >
                                  <Download className="h-3.5 w-3.5" />
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
      </div>

      {viewOrder ? (
        <SimpleModal
          title={`View Customer Order — ${viewOrder.order_no}`}
          onClose={() => setViewOrder(null)}
          className="w-[96vw] max-w-[1100px] max-h-[90vh] overflow-y-auto rounded-2xl font-sans"
        >
          <div className="space-y-4 p-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-lg font-black text-white">{viewOrder.order_no}</div>
                <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {viewOrder.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div><span className="text-slate-500">Party:</span> <span className="font-semibold">{viewOrder.customer_name}</span></div>
                <div><span className="text-slate-500">Route:</span> <span className="font-semibold">{viewOrder.route_name || "-"}</span></div>
                <div><span className="text-slate-500">Movement:</span> <span className="font-semibold">{viewOrder.movement_type}</span></div>
                <div><span className="text-slate-500">Transport:</span> <span className="font-semibold">{viewOrder.transport_mode}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(viewOrder.party_links || []).map((link) => (
                <div key={link.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">{link.role_key.replace("_", " ")}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{link.party_customer_name}</div>
                  <div className="text-sm text-slate-300">{link.party_company_name || "-"}</div>
                  <div className="mt-2 text-xs text-slate-500">{link.selected_address_text || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </DashboardFrame>
  );
}
