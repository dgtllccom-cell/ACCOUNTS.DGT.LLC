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
import { apiPost, apiGet, apiPatch } from "@/lib/api/client";
import type { ContactTypeKey } from "@/features/contact-types/contact-type-api";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

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
  area?: string;
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

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function PreviewField({
  label,
  value,
  mono = false,
  className = ""
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  className?: string;
}) {
  const shown = value && value !== "-" ? value : "â€”";
  const empty = shown === "â€”";
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={`mt-1 break-words text-sm leading-snug ${mono ? "font-mono" : ""} ${
          empty ? "text-slate-300" : "font-medium text-slate-800"
        }`}
      >
        {shown}
      </p>
    </div>
  );
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

const TYPE_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Mobile Number": { ur: "موبائل نمبر", ar: "رقم الجوال", ps: "موبایل شمیره", fa: "شماره موبایل" },
  "Office Number": { ur: "دفتر کا نمبر", ar: "رقم المكتب", ps: "د دفتر شمیره", fa: "شماره دفتر" },
  "WhatsApp Number": { ur: "واٹس ایپ نمبر", ar: "رقم الواتساب", ps: "د واټس اپ شمیره", fa: "شماره واتساپ" },
  "Email Address": { ur: "ای میل ایڈریس", ar: "البريد الإلكتروني", ps: "بریښنالیک پته", fa: "آدرس ایمیل" },
  "Phone Number": { ur: "فون نمبر", ar: "رقم الهاتف", ps: "د تلیفون شمیره", fa: "شماره تلفن" },
  "Fax Number": { ur: "فیکس نمبر", ar: "رقم الفاكس", ps: "د فکس شمیره", fa: "شماره فکس" },
  "Trade License Number": { ur: "ٹریڈ لائسنس نمبر", ar: "رقم الرخصة التجارية", ps: "د سوداګرۍ جواز شمیره", fa: "شماره پروانه کسب" },
  "VAT/TRN": { ur: "VAT / TRN (ویلیو ایڈڈ ٹیکس)", ar: "ضريبة القيمة المضافة / TRN", ps: "VAT / TRN مالیه", fa: "مالیات بر ارزش افزوده / TRN" },
  "Sales Tax No": { ur: "سیلز ٹیکس نمبر", ar: "رقم ضريبة المبيعات", ps: "د پلور مالیې شمیره", fa: "شماره مالیات بر فروش" },
  "GST No": { ur: "جی ایس ٹی نمبر", ar: "رقم ضريبة السلع والخدمات (GST)", ps: "GST شمیره", fa: "شماره GST" },
  "PSI No": { ur: "پی ایس آئی نمبر", ar: "رقم PSI", ps: "PSI شمیره", fa: "شماره PSI" },
  "NTN No": { ur: "این ٹی این نمبر (NTN)", ar: "رقم NTN", ps: "NTN شمیره", fa: "شماره NTN" },
  "Passport / Emirates ID / National ID": { ur: "پاسپورٹ / ایمریٹس آئی ڈی / قومی شناختی کارڈ", ar: "جواز السفر / الهوية الإماراتية / الهوية الوطنية", ps: "پاسپورت / د اماراتو پیژندپاڼه / ملي پیژندپاڼه", fa: "پاسپورت / شناسه امارات / کارت ملی" },
  "CNIC No": { ur: "شناختی کارڈ نمبر (CNIC)", ar: "رقم الهوية الوطنية (CNIC)", ps: "د پیژندپاڼې شمیره (CNIC)", fa: "شماره کارت ملی (CNIC)" },
  "Passport No": { ur: "پاسپورٹ نمبر", ar: "رقم جواز السفر", ps: "د پاسپورت شمیره", fa: "شماره پاسپورت" },
  "National ID": { ur: "قومی شناختی کارڈ", ar: "الهوية الوطنية", ps: "ملي پیژندپاڼه", fa: "کارت ملی" },
  "Residence Permit": { ur: "اقامہ / رہائشی اجازت نامہ", ar: "تصريح الإقامة / الإقامة", ps: "د استوګنې اجازه لیک", fa: "مجوز اقامت" }
};

export function localizeType(type: string, lang: string): string {
  if (!type || lang === "en") return type;
  const match = TYPE_TRANSLATIONS[type];
  if (match && match[lang]) return match[lang];
  return type;
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
  onNewType,
  addLabel = "Add",
  selectTypeLabel = "Select Type",
  addNewTypeLabel = "+ Add New Type",
  enterValueLabel = "Enter value",
  lang = "en"
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
  addLabel?: string;
  selectTypeLabel?: string;
  addNewTypeLabel?: string;
  enterValueLabel?: string;
  lang?: string;
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
          {addLabel}
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const isEmail = (row.type || "").toLowerCase().includes("email");
          const isContactPhone = list === "contacts" && toContactTypeKey(row.type);
          return (
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
                <option value="">{selectTypeLabel}</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {localizeType(type, lang)}
                  </option>
                ))}
                <option value="__new__">{addNewTypeLabel}</option>
              </select>
              {isContactPhone ? (
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
              ) : isEmail ? (
                <Input
                  type="email"
                  dir="ltr"
                  value={row.value}
                  onChange={(event) => onChange(row.id, { value: event.target.value })}
                  placeholder="example@domain.com"
                  className="bg-white text-slate-900 font-sans text-left"
                />
              ) : (
                <Input
                  dir="ltr"
                  value={row.value}
                  onChange={(event) => onChange(row.id, { value: event.target.value })}
                  placeholder={enterValueLabel}
                  className="bg-white text-slate-900 font-mono text-left"
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
          );
        })}
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
  const lang = useActiveLanguage();
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  function handleClose() {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/dashboard/settings/company" as Route);
  }
  const [ownerName, setOwnerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState<LocationHierarchyValue>({
    countryId: "",
    stateProvinceId: "",
    districtId: "",
    cityId: "",
    areaId: ""
  });
  const [locationMeta, setLocationMeta] = useState<LocationHierarchyMeta>({
    country: null,
    state: null,
    district: null,
    city: null,
    area: null
  });
  const [address, setAddress] = useState("");
  const [contacts, setContacts] = useState<DynamicRow[]>([newRow()]);
  const [registrations, setRegistrations] = useState<DynamicRow[]>([newRow()]);
  const [ownerIds, setOwnerIds] = useState<DynamicRow[]>([newRow()]);
  const [types, setTypes] = useState(defaultTypes);
  const [typeModal, setTypeModal] = useState<DynamicList | null>(null);
  const [newType, setNewType] = useState("");
  const [message, setMessage] = useState("");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  const [saving, setSaving] = useState(false);
  const [createdCompaniesForOwner, setCreatedCompaniesForOwner] = useState<Array<{ id: string; name: string }>>([]);
  const [showMultiPrompt, setShowMultiPrompt] = useState(false);

  function handleAddAnotherForSameOwner() {
    setShowMultiPrompt(false);
    setCompanyName("");
    setBusinessName("");
    setRegistrations([newRow()]);
    setMessage("");
    setCurrentStep(1);
  }

  // Tracks an existing company matched by name during duplicate-detection on save
  // (see the "duplicate"/"already exists" fallback below); cleared whenever the user
  // edits any field so a stale match never gets silently reused for a different entry.
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Load company details from API if initialCompanyId is provided for editing
  useEffect(() => {
    if (initialCompanyId) {
      apiGet<{ company: any }>(`/api/erp/companies/${encodeURIComponent(initialCompanyId)}`)
        .then((res) => {
          const comp = res.company;
          if (comp) {
            setOwnerName(comp.owner_name || "");
            setCompanyName(comp.name || "");
            setBusinessName(comp.legal_name || "");
            setBusinessType(comp.business_type || "");
            setAddress(comp.address || "");

            const mappedContacts = Array.isArray(comp.contacts) && comp.contacts.length > 0
              ? comp.contacts.map((c: any, i: number) => ({ id: c.id || `c-${i}`, type: c.type || "", value: c.value || "" }))
              : [newRow()];
            const mappedRegs = Array.isArray(comp.registrations) && comp.registrations.length > 0
              ? comp.registrations.map((r: any, i: number) => ({ id: r.id || `r-${i}`, type: r.type || "", value: r.value || "" }))
              : [newRow()];
            const mappedOwnerIds = Array.isArray(comp.owner_ids) && comp.owner_ids.length > 0
              ? comp.owner_ids.map((o: any, i: number) => ({ id: o.id || `o-${i}`, type: o.type || "", value: o.value || "" }))
              : [newRow()];

            setContacts(mappedContacts);
            setRegistrations(mappedRegs);
            setOwnerIds(mappedOwnerIds);

            setLocation({
              countryId: comp.country_id || "",
              stateProvinceId: comp.state_province_id || "",
              districtId: comp.district_id || "",
              cityId: comp.city_id || "",
              areaId: comp.area_location_id || ""
            });

            setLocationMeta({
              country: comp.country_name ? ({ id: comp.country_id || "", name: comp.country_name } as any) : null,
              state: comp.state_name ? ({ id: comp.state_province_id || "", name: comp.state_name } as any) : null,
              district: comp.district_name ? ({ id: comp.district_id || "", name: comp.district_name } as any) : null,
              city: comp.city_name ? ({ id: comp.city_id || "", name: comp.city_name, zip_code: comp.zip_code } as any) : null,
              area: comp.area_name ? ({ id: comp.area_location_id || "", name: comp.area_name, postal_code: comp.zip_code, zip_code: comp.zip_code } as any) : null
            });
          }
        })
        .catch((err) => {
          console.error("Error loading company profile:", err);
          setMessage(tr("company_form.load_failed_msg", "Failed to load company record from database."));
        });
    }
  }, [initialCompanyId]);

  const country = locationMeta.country?.name ?? "";
  const stateName = locationMeta.state?.name ?? "";
  const districtName = locationMeta.district?.name ?? "";
  const city = locationMeta.city?.name ?? "";
  const areaName = locationMeta.area?.name ?? "";
  const areaCode = (locationMeta.area as any)?.code ?? "";
  const displayArea = areaName ? (areaCode ? `${areaName} (${areaCode})` : areaName) : "-";
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
    return {
      ownerName: ownerName || "-",
      companyName: companyName || "-",
      businessName: businessName || "-",
      businessType: businessType || "-",
      country: country || "-",
      state: stateName || "-",
      district: districtName || "-",
      city: city || "-",
      area: displayArea || "-",
      areaCode: areaCode || "-",
      zipCode: zipCode || "-",
      address: address || "-",
      contacts: contacts.filter((row) => row.type && row.value),
      registrations: registrations.filter((row) => row.type && row.value),
      ownerIds: ownerIds.filter((row) => row.type && row.value)
    };
  }, [
    ownerName,
    companyName,
    businessName,
    businessType,
    country,
    stateName,
    districtName,
    city,
    displayArea,
    areaCode,
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

    setSaving(true);
    setMessage("");

    const payload = {
      name: companyName.trim(),
      legalName: businessName.trim() || companyName.trim(),
      baseCurrency: "USD",
      ownerName: ownerName.trim(),
      businessType: businessType.trim(),
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
    };

    try {
      if (initialCompanyId) {
        // Edit mode: update database record
        await apiPatch<{ company: any }>(`/api/erp/companies/${encodeURIComponent(initialCompanyId)}`, payload);
        setMessage(tr("company_form.updated_company_msg", `Updated company "${companyName}" in database successfully.`).replace("{name}", companyName));

        const updatedData: CompanyIncorporationData & { id: string } = {
          id: initialCompanyId,
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

        onSave?.(updatedData);

        if (mode === "standalone") {
          setTimeout(() => {
            router.push("/dashboard/settings/company" as Route);
          }, 1000);
        }
      } else {
        // Creation mode: add new company to database
        const lang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
        const originalLanguage = ["ar", "ur", "fa", "ps"].includes(lang) ? lang : "en";

        const res = await apiPost<{ companyId: string }>("/api/erp/companies", {
          ...payload,
          originalLanguage
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

        setCreatedCompaniesForOwner((prev) => [...prev, { id: res.companyId, name: companyName.trim() }]);
        setShowMultiPrompt(true);
        onSave?.(newCompany);
        setMessage(tr("company_form.saved_company_msg", `Saved company "${newCompany.companyName}" to database successfully.`).replace("{name}", newCompany.companyName));
      }
    } catch (err: any) {
      const errMsg = String(err?.message || err || "");
      if (errMsg.includes("duplicate") || errMsg.includes("already exists")) {
        try {
          const listRes = await apiGet<{ companies: Array<{ id: string; name: string }> }>("/api/erp/companies?limit=50");
          const match = listRes.companies?.find((c) => c.name.toLowerCase() === companyName.trim().toLowerCase());
          if (match?.id) {
            const fallbackComp: CompanyIncorporationData & { id: string } = {
              id: match.id,
              ownerName,
              companyName: match.name,
              businessName,
              country,
              state: stateName,
              city,
              zipCode,
              address,
              contacts: [],
              registrations: [],
              ownerIds: []
            };
            onSave?.(fallbackComp);
            setMessage(`Selected existing company "${match.name}".`);
            return;
          }
        } catch {}
      }
      setMessage(err?.message || "Failed to save company to database.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={mode === "standalone" ? "mx-auto flex h-[calc(100vh-2rem)] w-full max-w-[min(1600px,calc(100vw-2rem))] flex-col overflow-y-auto rounded-2xl border bg-white p-5 shadow-2xl" : "flex h-[86vh] w-full flex-col overflow-y-auto rounded-xl bg-white p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{tr("company_form.settings_company", "Settings / Company")}</p>
          <h1 className={mode === "standalone" ? "mt-1 text-2xl font-semibold tracking-tight text-slate-900" : "text-lg font-semibold"}>
            {initialCompanyId ? tr("company_form.edit_title", "Edit Company Details") : tr("company_form.create_title", "Company Incorporation Form")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {initialCompanyId ? tr("company_form.edit_subtitle", "Modify business profile records and registration information.") : tr("company_form.create_subtitle", "Register new business entities with locations, registrations, contact lists, and owners.")}
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
          {ready ? tr("company_form.ready", "Ready") : tr("company_form.draft", "Draft")}
        </span>
        <Button type="button" variant="outline" size="icon" onClick={handleClose} className="h-9 w-9 rounded-full border-slate-200" aria-label="Close company incorporation form">
          <X className="h-4 w-4" aria-hidden />
        </Button>
        </div>
      </div>

      <div className="sticky top-0 z-20 mb-3 grid grid-cols-2 gap-2 rounded-xl border bg-white/95 p-2 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur md:grid-cols-4">
        {[
          { id: 1, label: tr("company_form.step_company_details", "1. Company Details") },
          { id: 2, label: tr("company_form.step_location", "2. Location") },
          { id: 3, label: tr("company_form.step_contacts_ids", "3. Contacts & IDs") },
          { id: 4, label: tr("company_form.step_review_save", "4. Review & Save") },
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="space-y-5 rounded-lg border bg-card p-5 pb-24 shadow-sm">
          {currentStep === 1 && (
            <>
            <SectionTitle>{tr("company_form.section_company_details", "Company Details")}</SectionTitle>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">{tr("company_form.owner_name", "Company Owner Name")}</Label>
                <Input value={ownerName} onChange={(event) => { setOwnerName(event.target.value); setSelectedCompanyId(null); }} placeholder={tr("company_form.enter_owner_name", "Enter owner name")} className="bg-white text-slate-900 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">{tr("company_form.company_name", "Company Name")}</Label>
                <Input value={companyName} onChange={(event) => { setCompanyName(event.target.value); setSelectedCompanyId(null); }} placeholder={tr("company_form.enter_company_name", "Enter company name")} className="bg-white text-slate-900 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">{tr("company_form.business_name", "Business Name")}</Label>
                <Input value={businessName} onChange={(event) => { setBusinessName(event.target.value); setSelectedCompanyId(null); }} placeholder={tr("company_form.enter_business_name", "Enter business name")} className="bg-white text-slate-900 border-slate-200" />
              </div>
            </div>
            </>
          )}

          {currentStep === 2 && (
            <>
            <SectionTitle>{tr("company_form.section_location", "Location")}</SectionTitle>
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
                <Label className="text-xs font-semibold text-slate-700">{tr("company_form.zip_code", "Zip Code")}</Label>
                <Input value={zipCode || "-"} readOnly className="bg-slate-50 font-mono text-xs text-slate-600 font-semibold border-slate-200" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">{tr("company_form.full_address", "Full Address")}</Label>
              <Input value={address} onChange={(event) => { setAddress(event.target.value); setSelectedCompanyId(null); }} placeholder={tr("company_form.enter_full_address", "Enter full address")} className="bg-white text-slate-900 border-slate-200" />
            </div>
            </>
          )}

          {currentStep === 3 && (
            <>
            <DynamicRows
              label={tr("company_form.contacts_label", "Contacts")}
              list="contacts"
              rows={contacts}
              types={types.contacts}
              countryId={location.countryId}
              lang={lang}
              onChange={(id, patch) => { patchRow("contacts", id, patch); setSelectedCompanyId(null); }}
              onRemove={(id) => { removeRow("contacts", id); setSelectedCompanyId(null); }}
              onAdd={() => { addRow("contacts"); setSelectedCompanyId(null); }}
              onNewType={setTypeModal}
              addLabel={tr("company_form.add_button", "Add")}
              selectTypeLabel={tr("company_form.select_type", "Select Type")}
              addNewTypeLabel={tr("company_form.add_new_type", "+ Add New Type")}
              enterValueLabel={tr("company_form.enter_value", "Enter value")}
            />
            <DynamicRows
              label={tr("company_form.registrations_label", "Company Registrations")}
              helper={tr("company_form.registrations_helper", "Select type, for example VAT/NTN, and enter number.")}
              list="registrations"
              rows={registrations}
              types={types.registrations}
              lang={lang}
              onChange={(id, patch) => { patchRow("registrations", id, patch); setSelectedCompanyId(null); }}
              onRemove={(id) => { removeRow("registrations", id); setSelectedCompanyId(null); }}
              onAdd={() => { addRow("registrations"); setSelectedCompanyId(null); }}
              onNewType={setTypeModal}
              addLabel={tr("company_form.add_button", "Add")}
              selectTypeLabel={tr("company_form.select_type", "Select Type")}
              addNewTypeLabel={tr("company_form.add_new_type", "+ Add New Type")}
              enterValueLabel={tr("company_form.enter_value", "Enter value")}
            />
            <DynamicRows
              label={tr("company_form.owner_ids_label", "Company Owner Identification")}
              helper={tr("company_form.owner_ids_helper", "CNIC / Passport / National ID etc. Multiple IDs can be added.")}
              list="ownerIds"
              rows={ownerIds}
              types={types.ownerIds}
              lang={lang}
              onChange={(id, patch) => { patchRow("ownerIds", id, patch); setSelectedCompanyId(null); }}
              onRemove={(id) => { removeRow("ownerIds", id); setSelectedCompanyId(null); }}
              onAdd={() => { addRow("ownerIds"); setSelectedCompanyId(null); }}
              onNewType={setTypeModal}
              addLabel={tr("company_form.add_button", "Add")}
              selectTypeLabel={tr("company_form.select_type", "Select Type")}
              addNewTypeLabel={tr("company_form.add_new_type", "+ Add New Type")}
              enterValueLabel={tr("company_form.enter_value", "Enter value")}
            />
            </>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-800">{tr("company_form.review_save_title", "Review & Save")}</p>
              <p className="text-xs text-muted-foreground">
                {tr("company_form.review_save_desc", "Incorporate all details. Saving will update the entity registry and return you to the registry dashboard.")}
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
                {tr("common.back", "Back")}
              </Button>

              <div className="flex gap-2">
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep((Math.min(4, currentStep + 1)) as any)}
                    className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium shadow-sm h-10 px-8 gap-2"
                  >
                    {tr("common.next", "Next")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={submitForm}
                    disabled={!ready}
                    className="rounded-lg bg-primary text-white hover:bg-primary-dark transition gap-2 shadow-sm font-medium h-10 px-5"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    {initialCompanyId ? tr("company_form.update_profile", "Update Profile") : tr("company_form.submit_save", "Submit and Save")}
                  </Button>
                )}
              </div>
            </div>

            {showMultiPrompt && (
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/60 p-4 shadow-sm space-y-3 font-sans">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>
                    {lang === "ur" 
                      ? `کمپنی کامیابی سے درج ہو گئی! (مالک: ${ownerName})` 
                      : `Company Registered Successfully for Owner: ${ownerName}`}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  {lang === "ur" 
                    ? `اس مالک کے تحت اب تک ${createdCompaniesForOwner.length} کمپنیاں شامل ہو چکی ہیں۔ کیا آپ اسی مالک کے لیے مزید دوسری کمپنی کا اندراج کرنا چاہتے ہیں؟`
                    : `Total companies registered for this owner: ${createdCompaniesForOwner.length}. Would you like to register another company for this same owner now?`}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={handleAddAnotherForSameOwner}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {lang === "ur" ? "+ اسی مالک کے لیے مزید کمپنی شامل کریں" : "+ Add Another Company for this Owner"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="text-xs h-9 px-4 rounded-xl border-slate-300 font-semibold"
                  >
                    {lang === "ur" ? "کمپنیوں کی فہرست پر جائیں" : "Go to Companies Registry"}
                  </Button>
                </div>
              </div>
            )}

            {message ? (
              <div
                className={
                  message.includes("successfully")
                    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 font-sans"
                    : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 font-sans"
                }
              >
                {message}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="h-fit rounded-xl border bg-card p-6 shadow-sm xl:sticky xl:top-24">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 text-base leading-tight">{tr("company_form.company_preview", "Company Preview")}</h2>
                  <p className="text-xs text-muted-foreground">{tr("company_form.review_before_saving", "Review all details before saving")}</p>
                </div>
              </div>
              <div>
                {initialCompanyId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {tr("company_form.saved_record", "Saved Record")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    {tr("company_form.live_draft", "Live Draft")}
                  </span>
                )}
              </div>
            </div>

            {/* Hero: Company name */}
            <div className="mb-6 rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100/40 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tr("company_form.company_name", "Company Name")}</p>
              <p className="mt-1 break-words text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
                {previewData.companyName && previewData.companyName !== "-" ? previewData.companyName : tr("company_form.untitled_company", "Untitled Company")}
              </p>
              {previewData.ownerName && previewData.ownerName !== "-" ? (
                <p className="mt-1.5 text-sm text-slate-600">
                  {tr("company_form.owner_prefix", "Owner:")} <span className="font-semibold text-slate-800">{previewData.ownerName}</span>
                </p>
              ) : null}
            </div>

            <div className="space-y-6">
              {/* Business information */}
              <PreviewSection title={tr("company_form.business_info_section", "Business Information")}>
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <PreviewField label={tr("company_form.business_name", "Business Name")} value={previewData.businessName} />
                  <PreviewField label={tr("company_form.business_type_label", "Business Type")} value={previewData.businessType} />
                  <PreviewField label={tr("company_form.owner_name_label", "Owner Name")} value={previewData.ownerName} />
                </div>
              </PreviewSection>

              {/* Location */}
              <PreviewSection title={tr("company_form.section_location", "Location")}>
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <PreviewField label={tr("common.country", "Country")} value={previewData.country} />
                  <PreviewField label={tr("company_form.state_province_label", "State / Province")} value={previewData.state} />
                  <PreviewField label={tr("common.city", "City")} value={previewData.city} />
                  <PreviewField label={tr("company_form.area_label", "Area / Town / Locality / Road")} value={previewData.area} />
                  {(previewData as any).areaCode && (previewData as any).areaCode !== "-" ? (
                    <PreviewField label={tr("company_form.road_area_code_label", "Road / Area Code")} value={(previewData as any).areaCode} mono />
                  ) : null}
                  <PreviewField label={tr("company_form.zip_code_label", "ZIP Code")} value={previewData.zipCode} mono />
                </div>
                {previewData.address && previewData.address !== "-" ? (
                  <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tr("company_form.full_address", "Full Address")}</p>
                    <p className="mt-1 break-words text-sm leading-relaxed text-slate-700">{previewData.address}</p>
                  </div>
                ) : null}
              </PreviewSection>

              {/* Contacts */}
              <PreviewSection title={tr("company_form.contacts_section", "Contacts")}>
                {previewData.contacts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {previewData.contacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <span className="text-xs font-medium text-slate-500">{localizeType(c.type, lang)}</span>
                        <span className="break-all text-sm font-semibold text-slate-800 font-mono" dir="ltr">{c.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-400">{tr("company_form.no_contacts_added", "No contacts added")}</p>
                )}
              </PreviewSection>

              {/* Registrations */}
              <PreviewSection title={tr("company_form.registrations_section", "Registrations")}>
                {previewData.registrations.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {previewData.registrations.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <span className="text-xs font-medium text-slate-500">{localizeType(r.type, lang)}</span>
                        <span className="break-all text-sm font-semibold text-slate-800 font-mono" dir="ltr">{r.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-400">{tr("company_form.no_registrations_added", "No registrations added")}</p>
                )}
              </PreviewSection>

              {/* Owner Identification */}
              <PreviewSection title={tr("company_form.owner_id_section", "Owner Identification")}>
                {previewData.ownerIds.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {previewData.ownerIds.map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <span className="text-xs font-medium text-slate-500">{localizeType(o.type, lang)}</span>
                        <span className="break-all text-sm font-semibold text-slate-800 font-mono" dir="ltr">{o.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-400">{tr("company_form.no_ids_added", "No IDs added")}</p>
                )}
              </PreviewSection>

              {initialCompanyId ? (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedCompanyId(null)}
                    className="w-full gap-1.5 border-slate-200 text-sm"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {tr("company_form.back_to_form", "Back to Form / New Draft")}
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>
      </div>

      {typeModal ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-5 shadow-2xl">
            <h2 className="font-semibold text-slate-950">{tr("company_form.add_new_type_modal_title", "Add New Type")}</h2>
            <div className="mt-4 space-y-3">
              <Input value={newType} onChange={(event) => setNewType(event.target.value)} placeholder={tr("company_form.enter_type_name", "Enter type name")} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTypeModal(null)}>
                  {tr("common.cancel", "Cancel")}
                </Button>
                <Button type="button" onClick={saveType}>
                  {tr("common.save", "Save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
