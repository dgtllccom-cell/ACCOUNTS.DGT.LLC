"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Mail, MoreVertical, Printer, RefreshCcw, Save, Search, Ship, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { cn } from "@/lib/utils";

type OptionRow = {
  id: string;
  name: string;
  code?: string | null;
  iso2?: string | null;
  iso3?: string | null;
  currency_code?: string | null;
  local_currency?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  city_name?: string | null;
  account_number?: string | null;
  manual_reference_number?: string | null;
  customer_number?: string | null;
  country_serial_number?: string | null;
  branch_serial_number?: string | null;
  account_name?: string | null;
  account_currency?: string | null;
  account_balance?: number | string | null;
  current_balance?: number | string | null;
  currency?: string | null;
};

type ShippingRecord = {
  id: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  shipping_line_name: string;
  bl_number: string;
  container_number: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  loading_port: string | null;
  discharge_port: string | null;
  eta: string | null;
  etd: string | null;
  shipment_status: string;
  account_number: string | null;
  debit: number | string;
  credit: number | string;
  currency_code: string;
  created_at: string;
  countries?: { name: string; iso2: string | null; currency_code: string } | null;
  country_branches?: { name: string; code: string | null } | null;
  city_branches?: { name: string; code: string | null; city_name: string | null } | null;
  ledgers?: { code: string; name: string; currency: string } | null;
  profiles?: { full_name: string | null } | null;
};

type ShippingData = {
  records: ShippingRecord[];
  filters: {
    countries: OptionRow[];
    countryBranches: OptionRow[];
    cityBranches: OptionRow[];
    ledgers: OptionRow[];
  };
  session: {
    isSuperAdmin: boolean;
    fullName: string | null;
    roles: string[];
  };
};

const BL_CACHE_MS = 1000 * 60 * 3;
const blDataCache = new Map<string, { data: ShippingData; cachedAt: number }>();

const emptyForm = {
  countryId: "",
  countryBranchId: "",
  cityBranchId: "",
  ledgerId: "",
  shippingLineName: "DGT Logistics",
  blNumber: "BL-671867",
  containerNumber: "",
  vesselName: "",
  voyageNumber: "",
  loadingPort: "Karachi Port",
  dischargePort: "Jebel Ali Port",
  eta: todayIso(),
  etd: todayIso(),
  shipmentStatus: "draft",
  purchaseConfirmationStatus: "Confirmed",
  loadingStatus: "Completed",
  accountNumber: "",
  debit: "0",
  credit: "0",
  currencyCode: "USD",
  supplierCustomer: "",
  deliveryStatus: "Pending",
  customerAccountNo: "CUST-1001",
  shippingType: "By Sea",
  shipmentType: "Import",
  importer: "Pending Data",
  exporter: "Pending Data",
  notifyParty: "",
  bookingNo: "BK-2026-001",
  bookingCompanyType: "Shipping Line",
  bookingCompanyName: "DGT Logistics",
  bookingDate: todayIso(),
  issueDate: todayIso(),
  issueSerial: "ISS-671867",
  blType: "New BL",
  routeCountry: "PK / UAE",
  loadingCountry: "Pakistan",
  receivingCountry: "UAE",
  loadDate: todayIso(),
  receiveDate: todayIso(),
  goodsName: "PISTACHIOS KERNEL",
  goodsSize: "Large",
  goodsBrand: "Premium",
  goodsOrigin: "IRAN",
  hsCode: "0802.51",
  allotName: "ALT-4421",
  warehouse: "MAIN WH-A",
  qtyName: "BAGS",
  qtyNo: "100",
  totalGrossWeight: "5000",
  emptyPerBag: "0.25",
  totalEmptyWeight: "25",
  netWeight: "4975",
  divideName: "Ton",
  divideNumber: "1000",
  totalDivide: "4.975",
  containerType: "Dry Container 20FT",
  containerName: "MSC Container",
  sealNumber: "SEAL-7788",
  dischargeVessel: "MSC DUBAI",
  dischargeDate: todayIso(),
  carrierRemarks: ""
};

const shipmentStatuses = [
  { value: "draft", label: "Draft" },
  { value: "booked", label: "Booked" },
  { value: "in_transit", label: "In Transit" },
  { value: "arrived", label: "Arrived" },
  { value: "cleared", label: "Cleared" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" }
];

function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toOption(row: OptionRow, extra = ""): SearchSelectOption {
  const label = row.code ? `${row.name} (${row.code})` : row.name;
  return {
    value: row.id,
    label,
    keywords: [row.name, row.code, row.iso2, row.iso3, row.currency_code, row.local_currency, row.city_name, extra].filter(Boolean).join(" ")
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function BlEntryView({ context = "purchase" }: { context?: "purchase" }) {
  const moduleEyebrow = context === "purchase" ? "Purchase Workflow / B/L" : "Purchase Workflow / B/L";
  const [data, setData] = useState<ShippingData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const didRunInitialSearch = useRef(false);

  async function loadRecords(nextQuery = query, options: { force?: boolean } = {}) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      if (form.countryId) params.set("countryId", form.countryId);
      if (form.countryBranchId) params.set("countryBranchId", form.countryBranchId);
      if (form.cityBranchId) params.set("cityBranchId", form.cityBranchId);
      const cacheKey = params.toString();
      const cached = blDataCache.get(cacheKey);
      if (!options.force && cached && Date.now() - cached.cachedAt < BL_CACHE_MS) {
        setData(cached.data);
        setMessage("");
        return;
      }

      const res = await fetch(`/api/erp/shipping/bl-records?${params.toString()}`, { cache: "force-cache" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Unable to load B/L records");
      blDataCache.set(cacheKey, { data: json.data, cachedAt: Date.now() });
      setData(json.data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load B/L records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didRunInitialSearch.current) {
      didRunInitialSearch.current = true;
      return;
    }
    const timeout = window.setTimeout(() => {
      void loadRecords(query);
    }, 350);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const countries = data?.filters.countries ?? [];
  const countryBranches = data?.filters.countryBranches ?? [];
  const cityBranches = data?.filters.cityBranches ?? [];
  const ledgers = data?.filters.ledgers ?? [];

  const selectedCountry = countries.find((row) => row.id === form.countryId) ?? null;
  const selectedMainBranch = countryBranches.find((row) => row.id === form.countryBranchId) ?? null;
  const selectedCityBranch = cityBranches.find((row) => row.id === form.cityBranchId) ?? null;
  const selectedLedger = ledgers.find((row) => row.id === form.ledgerId) ?? null;

  const countryOptions = useMemo(() => countries.map((row) => toOption(row)), [countries]);
  const mainBranchOptions = useMemo(
    () => countryBranches.filter((row) => !form.countryId || row.country_id === form.countryId).map((row) => toOption(row, selectedCountry?.name ?? "")),
    [countryBranches, form.countryId, selectedCountry?.name]
  );
  const cityBranchOptions = useMemo(
    () =>
      cityBranches
        .filter((row) => (!form.countryId || row.country_id === form.countryId) && (!form.countryBranchId || row.country_branch_id === form.countryBranchId))
        .map((row) => toOption(row, selectedMainBranch?.name ?? "")),
    [cityBranches, form.countryBranchId, form.countryId, selectedMainBranch?.name]
  );
  const ledgerOptions = useMemo(
    () =>
      ledgers
        .filter((row) => {
          if (form.cityBranchId) return row.city_branch_id === form.cityBranchId || !row.city_branch_id;
          if (form.countryBranchId) return row.country_branch_id === form.countryBranchId || !row.country_branch_id;
          if (form.countryId) return row.country_id === form.countryId || !row.country_id;
          return true;
        })
        .map((row) => ({
          value: row.id,
          label: `${row.account_number ?? row.code ?? ""} - ${row.account_name ?? row.name}`.trim(),
          keywords: [
            row.account_number,
            row.manual_reference_number,
            row.customer_number,
            row.country_serial_number,
            row.branch_serial_number,
            row.account_name,
            row.code,
            row.name,
            row.currency,
            row.current_balance
          ]
            .filter(Boolean)
            .join(" ")
        })),
    [form.cityBranchId, form.countryBranchId, form.countryId, ledgers]
  );

  const records = data?.records ?? [];
  const purchaseConfirmed = form.purchaseConfirmationStatus === "Confirmed";
  const loadingCompleted = form.loadingStatus === "Completed";
  const shipmentDetailsReady = Boolean(
    form.shippingLineName &&
      form.vesselName &&
      form.voyageNumber &&
      form.blNumber &&
      form.issueDate &&
      form.containerNumber &&
      form.loadingPort &&
      form.dischargePort &&
      form.eta &&
      form.etd
  );
  const canGenerateBl = purchaseConfirmed && loadingCompleted && shipmentDetailsReady;
  const totals = useMemo(
    () => ({
      entries: records.length,
      debit: records.reduce((sum, row) => sum + Number(row.debit ?? 0), 0),
      credit: records.reduce((sum, row) => sum + Number(row.credit ?? 0), 0),
      active: records.filter((row) => !["cancelled", "delivered"].includes(row.shipment_status)).length
    }),
    [records]
  );

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyCountry(value: string) {
    const country = countries.find((row) => row.id === value);
    setForm((current) => ({
      ...current,
      countryId: value,
      countryBranchId: "",
      cityBranchId: "",
      currencyCode: country?.currency_code ?? current.currencyCode
    }));
  }

  function applyMainBranch(value: string) {
    const branch = countryBranches.find((row) => row.id === value);
    setForm((current) => ({
      ...current,
      countryBranchId: value,
      cityBranchId: "",
      currencyCode: branch?.local_currency ?? current.currencyCode
    }));
  }

  function applyCityBranch(value: string) {
    const branch = cityBranches.find((row) => row.id === value);
    setForm((current) => ({
      ...current,
      cityBranchId: value,
      currencyCode: branch?.local_currency ?? current.currencyCode
    }));
  }

  function applyLedger(value: string) {
    const ledger = ledgers.find((row) => row.id === value);
    setForm((current) => ({
      ...current,
      ledgerId: value,
      accountNumber: ledger?.account_number ?? ledger?.code ?? current.accountNumber,
      supplierCustomer: ledger?.account_name ?? ledger?.name ?? current.supplierCustomer,
      currencyCode: ledger?.account_currency ?? ledger?.currency ?? current.currencyCode
    }));
  }

  async function saveRecord() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/erp/shipping/bl-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId: form.countryId || null,
          countryBranchId: form.countryBranchId || null,
          cityBranchId: form.cityBranchId || null,
          ledgerId: form.ledgerId || null,
          shippingLineName: form.shippingLineName,
          blNumber: form.blNumber,
          containerNumber: form.containerNumber || null,
          vesselName: form.vesselName || null,
          voyageNumber: form.voyageNumber || null,
          loadingPort: form.loadingPort || null,
          dischargePort: form.dischargePort || null,
          eta: form.eta || null,
          etd: form.etd || null,
          shipmentStatus: form.shipmentStatus,
          accountNumber: form.accountNumber || null,
          debit: Number(form.debit || 0),
          credit: Number(form.credit || 0),
          currencyCode: form.currencyCode || "USD",
          reportPayload: {
            supplierCustomer: form.supplierCustomer,
            deliveryStatus: form.deliveryStatus,
            linkedModules: ["purchase_orders", "sales_orders", "loading_records", "roznamcha_entries", "ledger_entries"]
          }
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Unable to save B/L record");
      setMessage(`Generated B/L: ${json.data.blNumber}`);
      setForm((current) => ({ ...emptyForm, countryId: current.countryId, countryBranchId: current.countryBranchId, cityBranchId: current.cityBranchId, currencyCode: current.currencyCode }));
      await loadRecords();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save B/L record");
    } finally {
      setSaving(false);
    }
  }

  function printReport() {
    window.print();
    setMenuOpen(false);
  }

  function exportCsv() {
    const rows = [
      ["Country", "Branch", "City Branch", "Shipping Line", "B/L Number", "User", "Account Number", "Debit", "Credit", "Shipment Status"],
      ...records.map((row) => [
        row.countries?.name ?? "-",
        row.country_branches?.name ?? "-",
        row.city_branches?.name ?? "-",
        row.shipping_line_name,
        row.bl_number,
        row.profiles?.full_name ?? "-",
        row.account_number ?? row.ledgers?.code ?? "-",
        money(row.debit),
        money(row.credit),
        row.shipment_status
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-bl-report-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-3 bg-background p-3 text-foreground print:bg-white print:text-slate-950">
      <div className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-600 dark:text-cyan-300">{moduleEyebrow}</p>
          <h1 className="text-2xl font-black tracking-tight">Bill of Lading (B/L)</h1>
          <p className="text-xs text-muted-foreground">Purchase Order {"->"} Invoice {"->"} Payment {"->"} Confirmation {"->"} Loading Entry {"->"} B/L {"->"} Shipment.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadRecords(query, { force: true });
              }}
              placeholder="Search B/L, container, vessel..."
              className="h-9 bg-background pl-9 text-xs"
            />
          </div>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => void loadRecords(query, { force: true })} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
          </Button>
          <div className="relative">
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setMenuOpen((open) => !open)}>
              <MoreVertical className="h-4 w-4" />
            </Button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-lg border bg-popover py-1 text-popover-foreground shadow-2xl">
                <MenuAction icon={<SquareArrowOutUpRight className="h-4 w-4" />} label="View B/L Report" onClick={() => setMenuOpen(false)} />
                <MenuAction icon={<Printer className="h-4 w-4" />} label="Print B/L" onClick={printReport} />
                <MenuAction icon={<DownloadActionIcon className="h-4 w-4" />} label="PDF Download" onClick={printReport} />
                <MenuAction icon={<Mail className="h-4 w-4" />} label="Email B/L" onClick={() => setMenuOpen(false)} />
                <MenuAction icon={<DownloadActionIcon className="h-4 w-4" />} label="Export CSV" onClick={exportCsv} />
                <MenuAction icon={<SquareArrowOutUpRight className="h-4 w-4" />} label="Full Screen View" onClick={() => document.documentElement.requestFullscreen?.()} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
              <Ship className="h-4 w-4" /> BL Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3">
            <div className="rounded-lg border bg-background p-2">
              <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">B/L Generation Gate</div>
              <div className="grid gap-2 text-[10px] sm:grid-cols-3">
                <GateBadge label="Purchase Confirmed" ok={purchaseConfirmed} />
                <GateBadge label="Loading Completed" ok={loadingCompleted} />
                <GateBadge label="Shipment Details Entered" ok={shipmentDetailsReady} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                [1, "1) Parties"],
                [2, "2) BL Entry"],
                [3, "3) Goods Entry"],
                [4, "4) Container"]
              ].map(([step, label]) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setActiveStep(Number(step))}
                  className={cn(
                    "h-8 rounded-md border text-[9px] font-black transition",
                    activeStep === step ? "border-blue-500 bg-blue-600 text-white" : "border-border bg-muted/40 text-muted-foreground hover:border-slate-400"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              {activeStep === 1 ? (
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">SR#: 1 - Parties & Booking</div>
                  <Field label="Customer Account No *" value={form.customerAccountNo} onChange={(v) => updateField("customerAccountNo", v)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Shipping Type *" value={form.shippingType} onChange={(v) => updateField("shippingType", v)} asSelect options={[{ value: "By Sea", label: "By Sea" }, { value: "By Road", label: "By Road" }, { value: "By Air", label: "By Air" }]} />
                    <Field label="Shipment Type *" value={form.shipmentType} onChange={(v) => updateField("shipmentType", v)} asSelect options={[{ value: "Import", label: "Import" }, { value: "Export", label: "Export" }, { value: "Transit", label: "Transit" }]} />
                  </div>
                  <Field label="Importer *" value={form.importer} onChange={(v) => updateField("importer", v)} />
                  <Field label="Exporter *" value={form.exporter} onChange={(v) => updateField("exporter", v)} />
                  <Field label="Notify Party" value={form.notifyParty} onChange={(v) => updateField("notifyParty", v)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Booking No *" value={form.bookingNo} onChange={(v) => updateField("bookingNo", v)} />
                    <Field label="Booking Company Type *" value={form.bookingCompanyType} onChange={(v) => updateField("bookingCompanyType", v)} asSelect options={[{ value: "Shipping Line", label: "Shipping Line" }, { value: "Transport Company", label: "Transport Company" }, { value: "Airline", label: "Airline" }]} />
                    <Field label="Booking Company Name *" value={form.bookingCompanyName} onChange={(v) => updateField("bookingCompanyName", v)} />
                    <Field label="Booking Date *" type="date" value={form.bookingDate} onChange={(v) => updateField("bookingDate", v)} />
                    <Field label="Vessel Name *" value={form.vesselName} onChange={(v) => updateField("vesselName", v)} />
                    <Field label="Vessel Recharge Date *" type="date" value={form.eta} onChange={(v) => updateField("eta", v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2"><button className="h-8 rounded-md bg-slate-700 text-xs font-black text-slate-100" type="button">Reset</button><button className="h-8 rounded-md bg-blue-600 text-xs font-black text-white" type="button" onClick={() => setActiveStep(2)}>Next</button></div>
                </div>
              ) : null}

              {activeStep === 2 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Issue Date *" type="date" value={form.issueDate} onChange={(v) => updateField("issueDate", v)} />
                    <Field label="Issue Serial No *" value={form.issueSerial} onChange={(v) => updateField("issueSerial", v)} />
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_72px] gap-2">
                    <Field label="BL Type" value={form.blType} onChange={(v) => updateField("blType", v)} asSelect options={[{ value: "New BL", label: "New BL" }, { value: "Old BL", label: "Old BL" }]} />
                    <Field label="BL No" value={form.blNumber} onChange={(v) => updateField("blNumber", v)} />
                    <button className="mt-5 h-8 rounded bg-blue-600 text-[10px] font-black text-white" type="button">Search</button>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">Transport / Route Details</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="1) Route Type" value={form.shippingType} onChange={(v) => updateField("shippingType", v)} asSelect options={[{ value: "By Sea", label: "By Sea" }, { value: "By Road", label: "By Road" }, { value: "By Air", label: "By Air" }]} />
                    <Field label="2) Route Country" value={form.routeCountry} onChange={(v) => updateField("routeCountry", v)} asSelect options={[{ value: "PK / UAE", label: "PK / UAE" }, { value: "AF / PK", label: "AF / PK" }, { value: "IR / UAE", label: "IR / UAE" }]} />
                  </div>
                  <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2">
                    <div className="mb-2 text-[10px] font-black uppercase text-cyan-700 dark:text-cyan-300">3) Loading Details</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Loading Country" value={form.loadingCountry} onChange={(v) => updateField("loadingCountry", v)} />
                      <Field label="Port of Loading *" value={form.loadingPort} onChange={(v) => updateField("loadingPort", v)} />
                      <Field label="Loading Date" type="date" value={form.loadDate} onChange={(v) => updateField("loadDate", v)} />
                      <Field label="ETD *" type="date" value={form.etd} onChange={(v) => updateField("etd", v)} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-400/30 bg-rose-400/5 p-2">
                    <div className="mb-2 text-[10px] font-black uppercase text-rose-300">4) Receiving Details</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Receiving Country" value={form.receivingCountry} onChange={(v) => updateField("receivingCountry", v)} />
                      <Field label="Port of Discharge *" value={form.dischargePort} onChange={(v) => updateField("dischargePort", v)} />
                      <Field label="Receiving Date" type="date" value={form.receiveDate} onChange={(v) => updateField("receiveDate", v)} />
                      <Field label="ETA *" type="date" value={form.eta} onChange={(v) => updateField("eta", v)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2"><button className="h-8 rounded-md bg-slate-700 text-xs font-black text-slate-100" type="button">Reset</button><button className="h-8 rounded-md bg-blue-600 text-xs font-black text-white" type="button" onClick={() => setActiveStep(3)}>Next</button></div>
                </div>
              ) : null}

              {activeStep === 3 ? (
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">SR#: 1 - Goods Entry</div>
                  <Field label="Goods *" value={form.goodsName} onChange={(v) => updateField("goodsName", v)} asSelect options={[{ value: "PISTACHIOS KERNEL", label: "PISTACHIOS KERNEL" }, { value: "BADAM", label: "BADAM" }, { value: "WALNUT KERNELS", label: "WALNUT KERNELS" }]} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Size" value={form.goodsSize} onChange={(v) => updateField("goodsSize", v)} />
                    <Field label="Brand" value={form.goodsBrand} onChange={(v) => updateField("goodsBrand", v)} />
                    <Field label="Origin" value={form.goodsOrigin} onChange={(v) => updateField("goodsOrigin", v)} />
                    <Field label="HS Code" value={form.hsCode} onChange={(v) => updateField("hsCode", v)} />
                    <Field label="Allot Name" value={form.allotName} onChange={(v) => updateField("allotName", v)} />
                    <Field label="Warehouse" value={form.warehouse} onChange={(v) => updateField("warehouse", v)} />
                    <Field label="Qty Name" value={form.qtyName} onChange={(v) => updateField("qtyName", v)} asSelect options={[{ value: "BAGS", label: "BAGS" }, { value: "COTTON", label: "COTTON" }, { value: "KGS", label: "KGS" }]} />
                    <Field label="Quantity No" type="number" value={form.qtyNo} onChange={(v) => updateField("qtyNo", v)} />
                    <Field label="Total Gross Weight (KG)" type="number" value={form.totalGrossWeight} onChange={(v) => updateField("totalGrossWeight", v)} />
                    <Field label="Empty Wt / Bag (KG)" type="number" value={form.emptyPerBag} onChange={(v) => updateField("emptyPerBag", v)} />
                    <Field label="Net Weight (KG)" type="number" value={form.netWeight} onChange={(v) => updateField("netWeight", v)} />
                    <Field label="Divide Name" value={form.divideName} onChange={(v) => updateField("divideName", v)} asSelect options={[{ value: "Ton", label: "Ton" }, { value: "KG", label: "KG" }, { value: "Bag", label: "Bag" }, { value: "Carton", label: "Carton" }]} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded border bg-background p-2 text-[9px] text-muted-foreground">
                    <div>Total Gross Weight: <b className="text-foreground">{form.totalGrossWeight}</b></div>
                    <div>Total Empty Weight: <b className="text-foreground">{form.totalEmptyWeight}</b></div>
                    <div>NET Weight: <b className="text-amber-300">{form.netWeight}</b></div>
                    <div>Total Divide: <b className="text-foreground">{form.totalDivide}</b></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2"><button className="h-8 rounded-md bg-slate-700 text-xs font-black text-slate-100" type="button">Quality Report</button><button className="h-8 rounded-md bg-blue-600 text-xs font-black text-white" type="button" onClick={() => setActiveStep(4)}>Next Container</button></div>
                </div>
              ) : null}

              {activeStep === 4 ? (
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">SR#: 4 - Container Loading Entry</div>
                  <Field label="Select Goods For This Container" value={form.goodsName} onChange={(v) => updateField("goodsName", v)} asSelect options={[{ value: form.goodsName, label: form.goodsName || "Select Goods First" }]} />
                  <div className="rounded-lg border bg-background p-2">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Shipping Line Details</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Shipping Line Name *" value={form.shippingLineName} onChange={(v) => updateField("shippingLineName", v)} />
                      <Field label="Voyage Number *" value={form.voyageNumber} onChange={(v) => updateField("voyageNumber", v)} />
                    </div>
                  </div>
                  <Field label="Loading Type" value={form.shippingType} onChange={(v) => updateField("shippingType", v)} asSelect options={[{ value: "By Sea", label: "By Sea" }, { value: "By Road", label: "By Road" }, { value: "By Air", label: "By Air" }]} />
                  <Field label="Container Type" value={form.containerType} onChange={(v) => updateField("containerType", v)} asSelect options={[{ value: "Dry Container 20FT", label: "Dry Container 20FT" }, { value: "Dry Container 40FT", label: "Dry Container 40FT" }, { value: "Reefer Container 40FT", label: "Reefer Container 40FT" }]} />
                  <Field label="Container Name" value={form.containerName} onChange={(v) => updateField("containerName", v)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Container Numbers *" value={form.containerNumber} onChange={(v) => updateField("containerNumber", v)} />
                    <Field label="Seal Number" value={form.sealNumber} onChange={(v) => updateField("sealNumber", v)} />
                    <Field label="Vessel Name *" value={form.vesselName} onChange={(v) => updateField("vesselName", v)} />
                    <Field label="Discharge Date" type="date" value={form.dischargeDate} onChange={(v) => updateField("dischargeDate", v)} />
                  </div>
                  {!canGenerateBl ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
                      Complete Purchase Confirmation, Loading, and Shipment Details before generating Bill of Lading.
                    </div>
                  ) : null}
                  <Field label="Remarks" value={form.carrierRemarks} onChange={(v) => updateField("carrierRemarks", v)} />
                  <Button type="button" className="h-9 w-full bg-cyan-600 text-white hover:bg-cyan-500" onClick={saveRecord} disabled={saving || !canGenerateBl}>
                    <Save className="mr-2 h-4 w-4" /> {saving ? "Generating..." : "Generate Bill of Lading"}
                  </Button>
                </div>
              ) : null}
            </div>

            {message ? (
              <div className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
                <span>{message}</span>
                <button type="button" className="rounded border border-amber-600 px-2 py-1 font-bold" onClick={() => void loadRecords(query, { force: true })}>
                  Retry
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-3 bg-muted/20 p-3 text-foreground">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="flex items-center justify-between text-sm font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                <span>Board / BL / Loading Report</span>
                <Button type="button" size="sm" className="h-7 bg-blue-600 text-[10px] text-white">Clear BL</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
              <div className="grid gap-x-5 gap-y-1 rounded-lg border bg-background p-3 text-[10px] md:grid-cols-2">
                <MiniSection title="BL Basic / Board / BL Details" />
                <MiniLine label="Mode" value={form.blType} />
                <MiniLine label="B/L Date" value={form.issueDate} />
                <MiniLine label="Issue Serial" value={form.issueSerial} />
                <MiniLine label="BL No" value={form.blNumber} />
                <MiniLine label="Route" value={`${form.shippingType} | ${form.routeCountry} | L: ${form.loadingCountry} / ${form.loadingPort} -> R: ${form.receivingCountry} / ${form.dischargePort}`} full />
                <MiniLine label="Shipping Line" value={form.shippingLineName} />
                <MiniLine label="Vessel / Voyage" value={`${form.vesselName || "-"} / ${form.voyageNumber || "-"}`} />
                <MiniLine label="Containers" value={form.containerNumber || "-"} />
                <MiniLine label="ETA / ETD" value={`${form.eta || "-"} / ${form.etd || "-"}`} />
                <MiniSection title="Booking Details" />
                <MiniLine label="Shipping" value={form.shippingType} />
                <MiniLine label="Shipment" value={form.shipmentType} />
                <MiniLine label="Booking No" value={form.bookingNo} />
                <MiniLine label="Company" value={`${form.bookingCompanyType} / ${form.bookingCompanyName}`} />
                <MiniLine label="Date" value={form.bookingDate} />
                <MiniLine label="Vessel" value={form.vesselName} />
                <MiniSection title="System / User Report" />
                <MiniLine label="Country Serial" value={selectedCountry?.iso2 ? `${selectedCountry.iso2}-202602-001` : "PK-202602-001"} />
                <MiniLine label="Branch Serial" value={selectedCityBranch?.code ?? selectedMainBranch?.code ?? "KHI-202602-001"} />
                <MiniLine label="Team / User" value={data?.session.fullName ?? "Admin User"} />
                <MiniLine label="User ID" value={data?.session.roles?.[0] ?? "USR-001"} />
                <MiniSection title="Vessel Discharge Report" />
                <MiniLine label="Discharge Vessel / Date" value={`${form.dischargeVessel} / ${form.dischargeDate}`} full />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Goods Loading Report</span>
                  <span className="ml-2 rounded border px-2 py-1 text-[9px] font-black text-muted-foreground">Live Inventory</span>
                </div>
                <Button type="button" size="sm" className="h-7 bg-rose-600 text-[10px] text-white">Clear All Data</Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-xs">
                  <thead className="bg-slate-900 text-white dark:bg-[#020817]">
                    <tr>
                      {["SR#", "Good Name", "Size", "Brand", "Origin", "HS Code", "Allot Name", "Warehouse", "Qty Name", "Qty No", "Total Gross KG", "Empty/Bag KG", "Total Empty KG", "Net Weight KG", "Container Type", "Container Name", "Container No", "Seal No"].map((head) => (
                        <th key={head} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-card hover:bg-muted/40">
                      <td className="px-3 py-2">01</td>
                      <td className="px-3 py-2 font-semibold text-cyan-700 dark:text-cyan-200">{form.goodsName}</td>
                      <td className="px-3 py-2">{form.goodsSize}</td>
                      <td className="px-3 py-2">{form.goodsBrand}</td>
                      <td className="px-3 py-2">{form.goodsOrigin}</td>
                      <td className="px-3 py-2">{form.hsCode}</td>
                      <td className="px-3 py-2">{form.allotName}</td>
                      <td className="px-3 py-2">{form.warehouse}</td>
                      <td className="px-3 py-2">{form.qtyName}</td>
                      <td className="px-3 py-2">{form.qtyNo}</td>
                      <td className="px-3 py-2">{form.totalGrossWeight}</td>
                      <td className="px-3 py-2">{form.emptyPerBag}</td>
                      <td className="px-3 py-2">{form.totalEmptyWeight}</td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-600 dark:text-amber-300">{form.netWeight}</td>
                      <td className="px-3 py-2">{form.containerType}</td>
                      <td className="px-3 py-2">{form.containerName}</td>
                      <td className="px-3 py-2">{form.containerNumber || "-"}</td>
                      <td className="px-3 py-2">{form.sealNumber}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-8 rounded-lg border bg-background p-3 text-right">
                <div><span className="block text-[9px] font-black uppercase text-muted-foreground">Total KGS</span><b>{money(form.totalGrossWeight)}</b></div>
                <div><span className="block text-[9px] font-black uppercase text-muted-foreground">Net Weight</span><b className="text-amber-600 dark:text-amber-300">{money(form.netWeight)}</b></div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function MiniSection({ title }: { title: string }) {
  return (
    <div className="col-span-full mt-2 rounded bg-muted px-2 py-1 text-[9px] font-black uppercase tracking-wide text-blue-700 first:mt-0 dark:text-blue-300">
      {title}
    </div>
  );
}

function MiniLine({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[110px_1fr] gap-2 border-b border-dotted py-1", full ? "col-span-full" : "")}>
      <span className="text-[8px] font-black uppercase text-muted-foreground">{label}</span>
      <span className="text-right text-[10px] font-extrabold text-foreground">{value || "-"}</span>
    </div>
  );
}

function GateBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={cn("rounded-md border px-2 py-1 font-black", ok ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200")}>
      <span className="mr-1">{ok ? "✓" : "!"}</span>
      {label}
    </div>
  );
}

function StepHeading({ step, title, note }: { step: string; title: string; note: string }) {
  return (
    <div className="border-b border-slate-700 pb-2">
      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">{step}</div>
      <div className="mt-1 text-sm font-black text-slate-100">{title}</div>
      <div className="mt-1 text-[11px] text-slate-400">{note}</div>
    </div>
  );
}

function WizardStepButton({ step, label, activeStep, onClick }: { step: number; label: string; activeStep: number; onClick: () => void }) {
  const active = step === activeStep;
  const complete = step < activeStep;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-black transition",
        active
          ? "border-cyan-400 bg-cyan-500/15 text-cyan-100 shadow-sm shadow-cyan-950"
          : complete
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
            : "border-slate-700 bg-[#081122] text-slate-300 hover:border-slate-500"
      )}
    >
      <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[11px]", active ? "bg-cyan-500 text-white" : complete ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-300")}>
        {step}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  asSelect = false,
  options = []
}: {
  label: string;
  value: string;
  type?: string;
  asSelect?: boolean;
  options?: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      {asSelect ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-full rounded border bg-background px-2 text-xs text-foreground">
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 bg-background text-xs"
        />
      )}
    </div>
  );
}

function Metric({ label, value, tone = "text-slate-100" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-[#111c2e] p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cn("mt-2 text-xl font-black", tone)}>{value}</div>
    </div>
  );
}

function ReportBox({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-[#0b1628] p-3">
      <div className="border-b border-slate-700 pb-2 text-[10px] font-black uppercase tracking-wide text-cyan-300">{title}</div>
      <div className="mt-2 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[96px_1fr] gap-2 border-b border-slate-800 pb-1 text-[11px]">
            <span className="font-bold uppercase text-slate-500">{label}</span>
            <span className="truncate text-right font-bold text-slate-100">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-popover-foreground hover:bg-muted">
      <span className="text-cyan-700 dark:text-cyan-300">{icon}</span>
      {label}
    </button>
  );
}
