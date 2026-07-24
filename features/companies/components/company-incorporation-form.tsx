"use client";
// Force rebuild trigger


import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, CheckCircle2, Plus, Save, Trash2, RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ContactNumberInput } from "@/components/ui/contact-number-input";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import { apiPost } from "@/lib/api/client";
import type { ContactTypeKey } from "@/features/contact-types/contact-type-api";

type DynamicList = "contacts" | "registrations" | "ownerIds";
type DynamicRow = {
  id: string;
  type: string;
  value: string;
};

export type CompanyIncorporationData = {
  id?: string;
  ownerName: string;
  companyName: string;
  businessName: string;
  businessType?: string;
  countryId?: string;
  stateProvinceId?: string;
  districtId?: string;
  cityId?: string;
  areaLocationId?: string;
  country: string;
  state: string;
  district?: string;
  city: string;
  zipCode: string;
  address: string;
  contacts: DynamicRow[];
  registrations: DynamicRow[];
  ownerIds: DynamicRow[];
};

const defaultTypes: Record<DynamicList, string[]> = {
  contacts: ["Mobile Number", "Office Number", "WhatsApp Number", "Email Address"],
  registrations: ["Trade License Number", "VAT/TRN", "Sales Tax No", "GST No", "PSI No", "NTN No"],
  ownerIds: ["Passport / Emirates ID / National ID", "CNIC No", "Passport No", "National ID", "Residence Permit"]
};


const damaamDraftLocationMeta: LocationHierarchyMeta = {
  country: { id: "", name: "United Arab Emirates", iso2: "AE", currency_code: "AED" } as any,
  state: { id: "", name: "Dubai", code: "DXB" } as any,
  district: null,
  city: { id: "", name: "Deira", zip_code: "0000", postal_code: "0000" } as any,
  area: { id: "", name: "Al Ras", postal_code: "0000", zip_code: "0000" } as any
};

const damaamDraftContacts: DynamicRow[] = [
  { id: "draft-email", type: "Email Address", value: "asmattrader@gmail.com" },
  { id: "draft-mobile", type: "Mobile Number", value: "" },
  { id: "draft-office", type: "Office Number", value: "" }
];

const damaamDraftRegistrations: DynamicRow[] = [
  { id: "draft-trade-license", type: "Trade License Number", value: "" },
  { id: "draft-vat-trn", type: "VAT/TRN", value: "" }
];

const damaamDraftOwnerIds: DynamicRow[] = [
  { id: "draft-owner-id", type: "Passport / Emirates ID / National ID", value: "" }
];
const initialCompanies: (CompanyIncorporationData & { id: string })[] = [
  {
    id: "co-1",
    ownerName: "John Doe",
    companyName: "Apex Trading LLC",
    businessName: "Apex Imports",
    country: "United States",
    state: "New York",
    city: "New York",
    zipCode: "10001",
    address: "5th Avenue, Manhattan, NY",
    contacts: [
      { id: "c-1", type: "Mobile Number", value: "+1-555-0199" },
      { id: "c-2", type: "Email Address", value: "info@apextrading.com" }
    ],
    registrations: [
      { id: "r-1", type: "GST No", value: "REG-9988221" }
    ],
    ownerIds: [
      { id: "o-1", type: "Passport No", value: "US9876543" }
    ]
  },
  {
    id: "co-2",
    ownerName: "Muhammad Ali",
    companyName: "Al-Noor Logistics",
    businessName: "Al-Noor Cargo",
    country: "Pakistan",
    state: "Punjab",
    city: "Lahore",
    zipCode: "54000",
    address: "Gulberg III, Lahore, Pakistan",
    contacts: [
      { id: "c-3", type: "Mobile Number", value: "+92-300-1234567" },
      { id: "c-4", type: "Email Address", value: "contact@alnoor.pk" }
    ],
    registrations: [
      { id: "r-2", type: "NTN No", value: "NTN-882233-1" }
    ],
    ownerIds: [
      { id: "o-2", type: "CNIC No", value: "35201-1234567-1" }
    ]
  }
];

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "row-" + Math.random().toString(36).substring(2, 11);
}

function newRow(): DynamicRow {
  return { id: safeUUID(), type: "", value: "" };
}

function selectClass() {
  return "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-white text-slate-900";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-700">{children}</h2>;
}

function toContactTypeKey(label: string): ContactTypeKey | null {
  const normalized = (label || "").toLowerCase();
  if (normalized.includes("mobile")) return "mobile";
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("fax")) return "fax";
  if (normalized.includes("office")) return "phone";
  if (normalized.includes("phone")) return "phone";
  if (normalized.includes("extension")) return "extension";
  return null;
}

function DynamicRows({
  label,
  helper,
  list,
  rows,
  types,
  countryId,
  onChange,
  onRemove,
  onAdd,
  onNewType
}: {
  label: string;
  helper?: string;
  list: DynamicList;
  rows: DynamicRow[];
  types: string[];
  countryId?: string;
  onChange: (id: string, patch: Partial<DynamicRow>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onNewType: (list: DynamicList) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label className="text-slate-900 font-medium">{label}</Label>
          {helper ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd} className="h-8">
          <Plus className="h-4 w-4 mr-1 text-slate-600" aria-hidden />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-2 md:grid-cols-[minmax(180px,0.8fr)_1fr_auto]">
            <select
              value={row.type}
              onChange={(event) => {
                if (event.target.value === "__new__") {
                  onNewType(list);
                  return;
                }
                onChange(row.id, { type: event.target.value });
              }}
              className={selectClass()}
            >
              <option value="">Select Type</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
              <option value="__new__">+ Add New Type</option>
            </select>
            {list === "contacts" && toContactTypeKey(row.type) ? (
              <ContactNumberInput
                label=""
                hideLabel
                showHelp={false}
                countryId={countryId ?? null}
                contactTypeKey={toContactTypeKey(row.type) as ContactTypeKey}
                value={row.value}
                disabled={!countryId}
                onValueChange={(next) => onChange(row.id, { value: next })}
              />
            ) : (
              <Input
                value={row.value}
                onChange={(event) => onChange(row.id, { value: event.target.value })}
                placeholder="Enter value"
                className="bg-white text-slate-900"
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onRemove(row.id)}
              aria-label={`Remove ${label} row`}
              className="h-10 w-10 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-slate-200"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompanyIncorporationForm({
  mode = "standalone",
  initialCompanyId,
  onSave,
  onClose
}: {
  mode?: "standalone" | "embedded";
  initialCompanyId?: string;
  onSave?: (data: CompanyIncorporationData) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  function handleClose() {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/dashboard/settings/company" as Route);
  }
  const [ownerName, setOwnerName] = useState("Asmat Khan");
  const [companyName, setCompanyName] = useState("DAMAAN Trading Company LLC");
  const [businessName, setBusinessName] = useState("Import Export Trading");
  const [businessType, setBusinessType] = useState("Import, Export, Trading, Steel & Purchase");
  const [location, setLocation] = useState<LocationHierarchyValue>({
    countryId: "",
    stateProvinceId: "",
    districtId: "",
    cityId: ""
  });
  const [locationMeta, setLocationMeta] = useState<LocationHierarchyMeta>(damaamDraftLocationMeta);
  const [address, setAddress] = useState("Al Ras, Deira, Dubai, United Arab Emirates");
  const [contacts, setContacts] = useState<DynamicRow[]>(damaamDraftContacts);
  const [registrations, setRegistrations] = useState<DynamicRow[]>(damaamDraftRegistrations);
  const [ownerIds, setOwnerIds] = useState<DynamicRow[]>(damaamDraftOwnerIds);
  const [types, setTypes] = useState(defaultTypes);
  const [typeModal, setTypeModal] = useState<DynamicList | null>(null);
  const [newType, setNewType] = useState("");
  const [message, setMessage] = useState("");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  const [savedCompanies, setSavedCompanies] = useState<(CompanyIncorporationData & { id: string })[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(initialCompanyId ?? null);

  // Initialize from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem("incorporated_companies");
    if (stored) {
      try {
        setSavedCompanies(JSON.parse(stored));
      } catch {
        setSavedCompanies(initialCompanies);
      }
    } else {
      setSavedCompanies(initialCompanies);
      localStorage.setItem("incorporated_companies", JSON.stringify(initialCompanies));
    }
  }, []);

  // Load company details if initialCompanyId is provided for editing
  useEffect(() => {
    if (initialCompanyId && savedCompanies.length > 0) {
      const comp = savedCompanies.find((c) => c.id === initialCompanyId);
      if (comp) {
        setOwnerName(comp.ownerName);
        setCompanyName(comp.companyName);
        setBusinessName(comp.businessName);
        setBusinessType(comp.businessType || "");
        setAddress(comp.address);
        setContacts(comp.contacts.length > 0 ? comp.contacts : [newRow()]);
        setRegistrations(comp.registrations.length > 0 ? comp.registrations : [newRow()]);
        setOwnerIds(comp.ownerIds.length > 0 ? comp.ownerIds : [newRow()]);
        
        setLocation({
          countryId: comp.countryId || "",
          stateProvinceId: comp.stateProvinceId || "",
          districtId: comp.districtId || "",
          cityId: comp.cityId || ""
        });
        setLocationMeta({
          country: comp.country ? { id: comp.countryId || "", name: comp.country } as any : null,
          state: comp.state ? { id: comp.stateProvinceId || "", name: comp.state } as any : null,
          district: comp.district ? { id: comp.districtId || "", name: comp.district } as any : null,
          city: comp.city ? { id: comp.cityId || "", name: comp.city, zip_code: comp.zipCode } as any : null,
          area: (comp as any).area ? { id: comp.areaLocationId || "", name: (comp as any).area, postal_code: comp.zipCode, zip_code: comp.zipCode } as any : null
        });
      }
    }
  }, [initialCompanyId, savedCompanies]);

  const country = locationMeta.country?.name ?? "";
  const stateName = locationMeta.state?.name ?? "";
  const districtName = locationMeta.district?.name ?? "";
  const city = locationMeta.city?.name ?? "";
  const areaName = locationMeta.area?.name ?? "";
  const zipCode = ((locationMeta.area as any)?.postal_code || (locationMeta.area as any)?.zip_code || (locationMeta.city as any)?.postal_code || locationMeta.city?.zip_code || "");

  // Auto-fill Country phone prefix when country selects
  useEffect(() => {
    if (locationMeta.country?.phone_code) {
      const code = locationMeta.country.phone_code;
      setContacts((prev) =>
        prev.map((c) => {
          if (["Mobile Number", "Office Number", "WhatsApp Number"].includes(c.type) && !c.value.trim()) {
            return { ...c, value: code + " " };
          }
          return c;
        })
      );
    }
  }, [locationMeta.country]);

  const ready = Boolean(ownerName && companyName && businessName && country && stateName && city && address);

  const previewData = useMemo(() => {
    if (selectedCompanyId) {
      const match = savedCompanies.find((c) => c.id === selectedCompanyId);
      if (match) return match;
    }
    return {
      ownerName: ownerName || "-",
      companyName: companyName || "-",
      businessName: businessName || "-",
      businessType: businessType || "-",
      country: country || "-",
      state: stateName || "-",
      district: districtName || "-",
      city: city || "-",
      area: areaName || "-",
      zipCode: zipCode || "-",
      address: address || "-",
      contacts: contacts.filter((row) => row.type && row.value),
      registrations: registrations.filter((row) => row.type && row.value),
      ownerIds: ownerIds.filter((row) => row.type && row.value)
    };
  }, [
    selectedCompanyId,
    savedCompanies,
    ownerName,
    companyName,
    businessName,
    businessType,
    country,
    stateName,
    districtName,
    city,
    areaName,
    zipCode,
    address,
    contacts,
    registrations,
    ownerIds
  ]);

  function patchRow(list: DynamicList, id: string, patch: Partial<DynamicRow>) {
    const update = (rows: DynamicRow[]) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

    if (list === "contacts") setContacts(update);
    if (list === "registrations") setRegistrations(update);
    if (list === "ownerIds") setOwnerIds(update);
  }

  function removeRow(list: DynamicList, id: string) {
    const remove = (rows: DynamicRow[]) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : rows);

    if (list === "contacts") setContacts(remove);
    if (list === "registrations") setRegistrations(remove);
    if (list === "ownerIds") setOwnerIds(remove);
  }

  function addRow(list: DynamicList) {
    if (list === "contacts") setContacts((rows) => [...rows, newRow()]);
    if (list === "registrations") setRegistrations((rows) => [...rows, newRow()]);
    if (list === "ownerIds") setOwnerIds((rows) => [...rows, newRow()]);
  }

  function saveType() {
    const value = newType.trim();
    if (!typeModal || !value) return;

    setTypes((current) => ({ ...current, [typeModal]: [...current[typeModal], value] }));
    setNewType("");
    setTypeModal(null);
  }

  async function submitForm() {
    if (!ready) {
      setMessage("Complete owner, company, business, location, zip code, and address first.");
      return;
    }

    if (initialCompanyId) {
      // Edit mode: update existing
      const updated = savedCompanies.map((c) => {
        if (c.id === initialCompanyId) {
          return {
            ...c,
            ownerName,
            companyName,
            businessName,
            businessType,
            countryId: location.countryId || undefined,
            stateProvinceId: location.stateProvinceId || undefined,
            districtId: location.districtId || undefined,
            cityId: location.cityId || undefined,
            areaLocationId: location.areaId || undefined,
            country,
            state: stateName,
            district: districtName,
            city,
            area: areaName,
            zipCode,
            address,
            contacts: contacts.filter((row) => row.type && row.value),
            registrations: registrations.filter((row) => row.type && row.value),
            ownerIds: ownerIds.filter((row) => row.type && row.value)
          };
        }
        return c;
      });
      setSavedCompanies(updated);
      localStorage.setItem("incorporated_companies", JSON.stringify(updated));
      setMessage(`Updated company "${companyName}" successfully.`);
      
      if (mode === "standalone") {
        setTimeout(() => {
          router.push("/dashboard/settings/company" as Route);
        }, 1000);
      } else {
        onSave?.(updated.find(c => c.id === initialCompanyId) as CompanyIncorporationData);
      }
    } else {
      // Creation mode: add new
      try {
        const lang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
        const originalLanguage = ["ar", "ur", "fa", "ps"].includes(lang) ? lang : "en";

        const res = await apiPost<{ companyId: string }>("/api/erp/companies", {
          name: companyName.trim(),
          legalName: businessName.trim() || companyName.trim(),
          baseCurrency: "USD",
          originalLanguage,
          ownerName,
          businessType,
          countryId: location.countryId || undefined,
          stateProvinceId: location.stateProvinceId || undefined,
          districtId: location.districtId || undefined,
          cityId: location.cityId || undefined,
          areaLocationId: location.areaId || undefined,
          countryName: country,
          stateName,
          districtName,
          cityName: city,
          areaName,
          zipCode,
          address,
          contacts: contacts.filter((row) => row.type && row.value),
          registrations: registrations.filter((row) => row.type && row.value),
          ownerIds: ownerIds.filter((row) => row.type && row.value)
        });

        const newCompany: CompanyIncorporationData & { id: string } = {
          id: res.companyId,
          ownerName,
          companyName,
          businessName,
          businessType,
          countryId: location.countryId || undefined,
          stateProvinceId: location.stateProvinceId || undefined,
          districtId: location.districtId || undefined,
          cityId: location.cityId || undefined,
          areaLocationId: location.areaId || undefined,
          country,
          state: stateName,
          district: districtName,
          city,
          area: areaName,
          zipCode,
          address,
          contacts: contacts.filter((row) => row.type && row.value),
          registrations: registrations.filter((row) => row.type && row.value),
          ownerIds: ownerIds.filter((row) => row.type && row.value)
        };

        const updated = [newCompany, ...savedCompanies];
        setSavedCompanies(updated);
        localStorage.setItem("incorporated_companies", JSON.stringify(updated));

        onSave?.(newCompany);
        setMessage(`Saved company "${newCompany.companyName}" successfully.`);
        
        if (mode === "standalone") {
          setTimeout(() => {
            router.push("/dashboard/settings/company" as Route);
          }, 1000);
        }
      } catch (err: any) {
        setMessage(err?.message || "Failed to save company to database.");
      }
    }
  }

  return (
    <div className={mode === "standalone" ? "mx-auto flex h-[calc(100vh-2rem)] w-full max-w-[min(1600px,calc(100vw-2rem))] flex-col overflow-y-auto rounded-2xl border bg-white p-5 shadow-2xl" : "flex h-[86vh] w-full flex-col overflow-y-auto rounded-xl bg-white p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings / Company</p>
          <h1 className={mode === "standalone" ? "mt-1 text-2xl font-semibold tracking-tight text-slate-900" : "text-lg font-semibold"}>
            {initialCompanyId ? "Edit Company Details" : "Company Incorporation Form"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {initialCompanyId ? "Modify business profile records and registration information." : "Register new business entities with locations, registrations, contact lists, and owners."}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <span
          className={
            ready
              ? "inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200"
              : "inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200"
          }
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {ready ? "Ready" : "Draft"}
        </span>
        <Button type="button" variant="outline" size="icon" onClick={handleClose} className="h-9 w-9 rounded-full border-slate-200" aria-label="Close company incorporation form">
          <X className="h-4 w-4" aria-hidden />
        </Button>
        </div>
      </div>

      <div className="sticky top-0 z-20 mb-3 grid grid-cols-2 gap-2 rounded-xl border bg-white/95 p-2 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur md:grid-cols-4">
        {[
          { id: 1, label: "1. Company Details" },
          { id: 2, label: "2. Location" },
          { id: 3, label: "3. Contacts & IDs" },
          { id: 4, label: "4. Review & Save" },
        ].map((s) => {
          const active = currentStep === s.id;
          const completed = currentStep > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStep(s.id as any)}
              className={`flex items-center gap-2 border rounded-lg p-2.5 text-left transition-all ${
                active
                  ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                  : completed
                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 font-bold"
                  : "border-slate-100 bg-slate-50/50 text-slate-400"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  active ? "bg-primary text-white" : completed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <section className="space-y-5 rounded-lg border bg-card p-5 pb-24 shadow-sm">
          {currentStep === 1 && (
            <>
            <SectionTitle>Company Details</SectionTitle>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Company Owner Name</Label>
                <Input value={ownerName} onChange={(event) => { setOwnerName(event.target.value); setSelectedCompanyId(null); }} placeholder="Enter owner name" className="bg-white text-slate-900 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Company Name</Label>
                <Input value={companyName} onChange={(event) => { setCompanyName(event.target.value); setSelectedCompanyId(null); }} placeholder="Enter company name" className="bg-white text-slate-900 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Business Name</Label>
                <Input value={businessName} onChange={(event) => { setBusinessName(event.target.value); setSelectedCompanyId(null); }} placeholder="Enter business name" className="bg-white text-slate-900 border-slate-200" />
              </div>
            </div>
            </>
          )}

          {currentStep === 2 && (
            <>
            <SectionTitle>Location</SectionTitle>
            <LocationHierarchySelect
              value={location}
              onChange={(next, meta) => {
                setLocation(next);
                setLocationMeta(meta);
                setSelectedCompanyId(null);
              }}
              showDistrict={false}
              showArea={true}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Zip Code</Label>
                <Input value={zipCode || "-"} readOnly className="bg-slate-50 font-mono text-xs text-slate-600 font-semibold border-slate-200" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Full Address</Label>
              <Input value={address} onChange={(event) => { setAddress(event.target.value); setSelectedCompanyId(null); }} placeholder="Enter full address" className="bg-white text-slate-900 border-slate-200" />
            </div>
            </>
          )}

          {currentStep === 3 && (
            <>
            <DynamicRows
              label="Contacts"
              list="contacts"
              rows={contacts}
              types={types.contacts}
              countryId={location.countryId}
              onChange={(id, patch) => { patchRow("contacts", id, patch); setSelectedCompanyId(null); }}
              onRemove={(id) => { removeRow("contacts", id); setSelectedCompanyId(null); }}
              onAdd={() => { addRow("contacts"); setSelectedCompanyId(null); }}
              onNewType={setTypeModal}
            />
            <DynamicRows
              label="Company Registrations"
              helper="Select type, for example VAT/NTN, and enter number."
              list="registrations"
              rows={registrations}
              types={types.registrations}
              onChange={(id, patch) => { patchRow("registrations", id, patch); setSelectedCompanyId(null); }}
              onRemove={(id) => { removeRow("registrations", id); setSelectedCompanyId(null); }}
              onAdd={() => { addRow("registrations"); setSelectedCompanyId(null); }}
              onNewType={setTypeModal}
            />
            <DynamicRows
              label="Company Owner Identification"
              helper="CNIC / Passport / National ID etc. Multiple IDs can be added."
              list="ownerIds"
              rows={ownerIds}
              types={types.ownerIds}
              onChange={(id, patch) => { patchRow("ownerIds", id, patch); setSelectedCompanyId(null); }}
              onRemove={(id) => { removeRow("ownerIds", id); setSelectedCompanyId(null); }}
              onAdd={() => { addRow("ownerIds"); setSelectedCompanyId(null); }}
              onNewType={setTypeModal}
            />
            </>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-800">Review & Save</p>
              <p className="text-xs text-muted-foreground">
                Incorporate all details. Saving will update the entity registry and return you to the registry dashboard.
              </p>
            </div>
          )}

            <div className="sticky bottom-0 z-20 -mx-5 -mb-24 mt-6 flex flex-wrap items-center justify-between gap-3 border-t bg-white/95 p-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep((Math.max(1, currentStep - 1)) as any)}
                disabled={currentStep === 1}
                className="border-slate-200 text-slate-700 font-medium h-10 px-4"
              >
                Back
              </Button>
              
              <div className="flex gap-2">
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep((Math.min(4, currentStep + 1)) as any)}
                    className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium shadow-sm h-10 px-8 gap-2"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={submitForm}
                    disabled={!ready}
                    className="rounded-lg bg-primary text-white hover:bg-primary-dark transition gap-2 shadow-sm font-medium h-10 px-5"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    {initialCompanyId ? "Update Profile" : "Submit and Save"}
                  </Button>
                )}
              </div>
            </div>

            {message ? (
              <div
                className={
                  message.includes("successfully")
                    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                    : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
                }
              >
                {message}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="h-fit rounded-lg border bg-card p-5 shadow-sm xl:sticky xl:top-24">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="font-semibold text-slate-800 text-sm">Company Preview</h2>
              </div>
              <div>
                {selectedCompanyId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Saved Record
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Live Draft
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Company Name</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{previewData.companyName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Business Name</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{previewData.businessName || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Business Type</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{previewData.businessType || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Owner Name</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{previewData.ownerName}</p>
              </div>
              <div className="border-t pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Location</p>
                <p className="text-xs text-slate-700 font-semibold mt-0.5">
                  {[previewData.area, previewData.city, previewData.state, previewData.country].filter((item) => item && item !== "-").join(", ") || "-"}
                </p>
                {previewData.zipCode && previewData.zipCode !== "-" && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Zip: {previewData.zipCode}</p>
                )}
              </div>
              {previewData.address && previewData.address !== "-" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Full Address</p>
                  <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{previewData.address}</p>
                </div>
              )}

              {/* Contacts */}
              <div className="border-t pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Contacts</p>
                {previewData.contacts.length > 0 ? (
                  <div className="space-y-1 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                    {previewData.contacts.map((c) => (
                      <div key={c.id} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-muted-foreground font-medium">{c.type}:</span>
                        <span className="font-semibold text-slate-800 font-mono">{c.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No contacts added</p>
                )}
              </div>

              {/* Registrations */}
              <div className="border-t pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Registrations</p>
                {previewData.registrations.length > 0 ? (
                  <div className="space-y-1 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                    {previewData.registrations.map((r) => (
                      <div key={r.id} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-muted-foreground font-medium">{r.type}:</span>
                        <span className="font-semibold text-slate-800 font-mono">{r.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No registrations added</p>
                )}
              </div>

              {/* Owner Identification */}
              <div className="border-t pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Owner Identification</p>
                {previewData.ownerIds.length > 0 ? (
                  <div className="space-y-1 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                    {previewData.ownerIds.map((o) => (
                      <div key={o.id} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-muted-foreground font-medium">{o.type}:</span>
                        <span className="font-semibold text-slate-800 font-mono">{o.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No IDs added</p>
                )}
              </div>

              {selectedCompanyId ? (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedCompanyId(null)}
                    className="w-full text-xs gap-1.5 h-8 border-slate-200"
                  >
                    <RefreshCcw className="h-3 w-3" />
                    Back to Form / New Draft
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>
      </div>

      {typeModal ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-5 shadow-2xl">
            <h2 className="font-semibold text-slate-950">Add New Type</h2>
            <div className="mt-4 space-y-3">
              <Input value={newType} onChange={(event) => setNewType(event.target.value)} placeholder="Enter type name" />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTypeModal(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveType}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
