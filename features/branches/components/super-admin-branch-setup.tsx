"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Eye,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { BranchOwnerPicker } from "@/features/branches/components/branch-owner-picker";
import { BranchLiveReportPanel } from "@/features/branches/components/branch-live-report-panel";
import { BranchRecordProfile, type BranchProfileSection } from "@/features/branches/components/branch-record-profile";
import { BranchReportActionsMenu } from "@/features/branches/components/branch-report-actions-menu";
import { downloadCsv } from "@/features/branches/components/branch-report-export";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import { apiGet } from "@/lib/api/client";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type ContactRow = { id: string; type: string; value: string };
type SavedBranch = {
  id: string;
  branchCode: string;
  country: string;
  city: string;
  company: string;
  owner: string;
  savedAt: string;
};

type DbSuperAdminBranchRow = {
  id: string;
  name: string;
  code: string;
  company_id: string;
  currency: string | null;
  country_id: string | null;
  state_province_id: string | null;
  district_id?: string | null;
  city_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  owner_name: string | null;
  contacts: unknown;
  documents: unknown;
  created_at: string;
  companies?: { name: string } | null;
  countries?: { name: string } | null;
  states_provinces?: { name: string } | null;
  cities?: { name: string } | null;
};

type CompanyDetailRow = {
  id: string;
  name: string;
  legal_name: string | null;
  base_currency: string;
  address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type OwnerCustomerRow = {
  id: string;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
};

type OwnerProfileRow = {
  userId: string;
  userCode: string;
  fullName: string;
  countryName: string;
  branchName: string;
  branchType: string;
  role: string;
  permissions: string[];
};

type OwnerPreview = {
  source: "customer" | "profile";
  code: string;
  name: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  whatsapp: string;
  email: string;
  address: string;
  country: string;
  branch: string;
  role: string;
};

const initialContactTypes = ["Mobile Number", "Phone Number", "WhatsApp Number", "Email Address"];
const currencies = [["USD", "US Dollar (USD)"]] as const;

function selectClass() {
  return "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
}

function pillClassName() {
  return "inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-slate-700 dark:text-slate-200";
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactCode(value: string, prefix: string) {
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean ? `${prefix}-${clean.slice(0, 8)}` : `${prefix}-`;
}

function TextArea({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div
        className={
          wide
            ? "max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border bg-background shadow-2xl"
            : "w-full max-w-lg rounded-lg border bg-background shadow-2xl"
        }
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  const blank = !value || value === "-";

  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-dashed py-2 text-sm last:border-b-0">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <span className={blank ? "font-semibold text-muted-foreground" : "font-semibold text-foreground"}>
        {value || "-"}
      </span>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 className={done ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-slate-300"} aria-hidden />
      <span className={done ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function buildMailtoHref(subject: string, rows: Array<{ label: string; value: string }>) {
  const body = rows.map((row) => `${row.label}: ${row.value || "-"}`).join("\n");
  const params = new URLSearchParams({ subject, body });
  return `mailto:?${params.toString()}`;
}

function ChipList({
  empty,
  rows,
  onRemove
}: {
  empty: string;
  rows: Array<{ id: string; type: string; value: string }>;
  onRemove: (id: string) => void;
}) {
  const lang = useActiveLanguage();
  if (!rows.length) {
    return <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">{row.type}</p>
            <p className="text-sm font-semibold text-foreground">{row.value}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            aria-label={t(lang, "sabs.remove_row" as never, "Remove row")}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

function SuperAdminBranchSetupContent() {
  const lang = useActiveLanguage();
  const tt = useCallback((key: string, fallback: string) => t(lang, key as never, fallback), [lang]);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId") ?? "";
  const [drawerBranchData, setDrawerBranchData] = useState<any>(null);
  const [contactTypes, setContactTypes] = useState(initialContactTypes);

  const [location, setLocation] = useState<LocationHierarchyValue>({
    countryId: "",
    stateProvinceId: "",
    districtId: "",
    cityId: ""
  });
  const [locationMeta, setLocationMeta] = useState<LocationHierarchyMeta>({
    country: null,
    state: null,
    district: null,
    city: null,
    area: null
  });
  const [currency, setCurrency] = useState("USD");
  const [address, setAddress] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companyDetails, setCompanyDetails] = useState<CompanyDetailRow | null>(null);
  const [owner, setOwner] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerCustomerId, setOwnerCustomerId] = useState<string | null>(null);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);
  const [ownerPreview, setOwnerPreview] = useState<OwnerPreview | null>(null);

  const [contactType, setContactType] = useState(initialContactTypes[0]);
  const [contactValue, setContactValue] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [savedBranches, setSavedBranches] = useState<SavedBranch[]>([]);
  const [savedBranchRows, setSavedBranchRows] = useState<DbSuperAdminBranchRow[]>([]);
  const [editingBranchId, setEditingBranchId] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedSearch, setSavedSearch] = useState("");

  const [modal, setModal] = useState<null | "contactType" | "report">(null);
  const [newType, setNewType] = useState("");
  const [message, setMessage] = useState("");

  const countryName = locationMeta.country?.name ?? "";
  const stateName = locationMeta.state?.name ?? "";
  const districtName = locationMeta.district?.name ?? "";
  const cityName = locationMeta.city?.name ?? "";
  const zip = locationMeta.area?.postal_code ?? locationMeta.city?.zip_code ?? "";

  const branchCode = "SUPER-HQ-001";
  const contactsText = contacts.length ? contacts.map((row) => `${row.type}: ${row.value}`).join(", ") : "No Contacts";
  const companyName = companyDetails?.name ?? "";
  const companyCode = companyDetails?.id ? compactCode(companyDetails.id, "CMP") : "-";
  const readyToSave = Boolean(countryName && stateName && (cityName || districtName) && branchCode && currency && companyName && owner && address);

  const hasAny = useMemo(() => Boolean(
    location.countryId ||
      location.stateProvinceId ||
      location.districtId ||
      location.cityId ||
      currency ||
      address ||
      companyId ||
      owner ||
      contacts.length
  ), [location, currency, address, companyId, owner, contacts]);

  // Prefill phone prefix in contacts
  useEffect(() => {
    if (locationMeta.country?.phone_code) {
      const code = locationMeta.country.phone_code;
      setContacts((prev) => {
        if (prev.length === 0) {
          return [{ id: `Mobile Number-${code}-${Date.now()}`, type: "Mobile Number", value: code + " " }];
        }
        return prev.map((c) => {
          if (["Mobile Number", "Phone Number", "WhatsApp Number"].includes(c.type) && !c.value.trim()) {
            return { ...c, value: code + " " };
          }
          return c;
        });
      });
    }
  }, [locationMeta.country]);

  const reportRows = useMemo(
    () => [
      { label: tt("sabs.branch_code", "Branch Code"), value: branchCode || "-" },
      { label: tt("sabs.branch_type", "Branch Type"), value: "Super Admin Branch" },
      { label: tt("sabs.country", "Country"), value: countryName || "-" },
      { label: tt("sabs.country_code", "Country Code"), value: locationMeta.country?.iso2 || locationMeta.country?.iso3 || "-" },
      { label: tt("sabs.state_province", "State / Province"), value: stateName || "-" },
      { label: tt("sabs.state_code", "State Code"), value: locationMeta.state?.code || "-" },
      { label: tt("sabs.city", "City"), value: cityName || "-" },
      { label: tt("sabs.city_code", "City Code"), value: locationMeta.city?.code || "-" },
      { label: tt("sabs.zip_postal", "Zip / Postal Code"), value: zip || "-" },
      { label: tt("sabs.company_name", "Company Name"), value: companyName || "-" },
      { label: tt("sabs.company_code", "Company Code"), value: companyCode || "-" },
      { label: tt("sabs.company_owner", "Company Owner"), value: ownerPreview?.name || owner || "-" },
      { label: tt("sabs.owner_details", "Owner Details"), value: ownerPreview ? `${ownerPreview.source.toUpperCase()} · ${ownerPreview.code}` : owner || "-" },
      { label: tt("sabs.branch_name", "Branch Name"), value: "Super Admin Branch" },
      { label: tt("sabs.currency", "Currency"), value: currency || "USD" },
      { label: tt("sabs.address", "Address"), value: address || "-" },
      { label: tt("sabs.contacts", "Contacts"), value: contactsText }
    ],
    [tt, address, branchCode, cityName, companyCode, companyName, contactsText, countryName, currency, locationMeta.city?.code, locationMeta.country?.iso2, locationMeta.country?.iso3, locationMeta.state?.code, owner, ownerPreview, stateName, zip]
  );
  const editIdentityRows = useMemo(
    () => [
      { label: tt("sabs.country", "Country"), value: countryName || "-" },
      { label: tt("sabs.branch_type", "Branch Type"), value: "Super Admin Branch" },
      { label: tt("sabs.branch_code", "Branch Code"), value: branchCode },
      { label: tt("sabs.record_id", "Record ID"), value: editingBranchId },
      { label: tt("sabs.status", "Status"), value: "active" },
      { label: tt("sabs.currency", "Currency"), value: currency }
    ],
    [tt, branchCode, currency, editingBranchId, countryName]
  );

  const editProfileSections: BranchProfileSection[] = useMemo(
    () => [
      {
        title: tt("sabs.sec_branch_info", "Branch Information"),
        items: [
          { label: tt("sabs.branch_type", "Branch Type"), value: "Super Admin Branch" },
          { label: tt("sabs.branch_code", "Branch Code"), value: branchCode },
          { label: tt("sabs.currency", "Currency"), value: currency },
          { label: tt("sabs.status", "Status"), value: "active" }
        ]
      },
      {
        title: tt("sabs.sec_location_info", "Location Information"),
        items: [
          { label: tt("sabs.country", "Country"), value: countryName || "-" },
          { label: tt("sabs.country_code", "Country Code"), value: locationMeta.country?.iso2 || locationMeta.country?.iso3 || "-" },
          { label: tt("sabs.state", "State"), value: stateName || "-" },
          { label: tt("sabs.city", "City"), value: cityName || "-" },
          { label: tt("sabs.address", "Address"), value: address }
        ]
      },
      {
        title: tt("sabs.sec_company_info", "Company Information"),
        items: [
          { label: tt("sabs.company_name", "Company Name"), value: companyDetails?.name || "-" },
          { label: tt("sabs.company_code", "Company Code"), value: companyCode },
          { label: tt("sabs.legal_name", "Legal Name"), value: companyDetails?.legal_name || "-" },
          { label: tt("sabs.base_currency", "Base Currency"), value: companyDetails?.base_currency || "-" }
        ]
      },
      {
        title: tt("sabs.sec_owner_info", "Owner Information"),
        items: [
          { label: tt("sabs.owner_name", "Owner Name"), value: ownerPreview?.name || owner },
          { label: tt("sabs.owner_code", "Owner Code"), value: ownerPreview?.code || "N/A" },
          { label: tt("sabs.owner_source", "Owner Source"), value: ownerPreview?.source || "custom" },
          { label: tt("sabs.owner_role", "Owner Role"), value: ownerPreview?.role || "Owner" }
        ]
      },
      {
        title: tt("sabs.sec_contact_info", "Contact Information"),
        items: [
          { label: tt("sabs.contacts", "Contacts"), value: contactsText },
          { label: tt("sabs.phone", "Phone"), value: contacts.find((row) => row.type.toLowerCase().includes("phone"))?.value || "-" },
          { label: tt("sabs.email", "Email"), value: contacts.find((row) => row.type.toLowerCase().includes("email"))?.value || "-" }
        ]
      }
    ],
    [
      tt,
      branchCode,
      companyCode,
      companyDetails,
      contacts,
      contactsText,
      countryName,
      currency,
      locationMeta.country?.iso2,
      locationMeta.country?.iso3,
      owner,
      ownerPreview,
      stateName,
      cityName,
      address
    ]
  );

  const filteredSavedBranches = useMemo(() => {
    const q = savedSearch.trim().toLowerCase();
    if (!q) return savedBranches;
    return savedBranches.filter((entry) => {
      const haystack = [entry.branchCode, entry.country, entry.city, entry.company, entry.owner]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [savedBranches, savedSearch]);

  const liveBranchData = useMemo(() => {
    const phoneVal = contacts.find((row) => row.type.toLowerCase().includes("phone"))?.value || "";
    const emailVal = contacts.find((row) => row.type.toLowerCase().includes("email"))?.value || "";
    const whatsappVal = contacts.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value || "";

    return {
      serialNumber: editingBranchId ? editingBranchId.slice(0, 4).toUpperCase() : "0001",
      branchStatus: editingBranchId ? "Active" : (hasAny ? "Draft" : "Empty"),
      branchCode: branchCode || "-",
      branchType: "SUPER_ADMIN",
      country: countryName || "-",
      currency: currency || "USD",
      
      branchName: companyDetails?.name ? `${companyDetails.name} Super Admin Branch` : "Super Admin Branch",
      createdDate: undefined,
      updatedDate: undefined,
      createdBy: "",
      updatedBy: "",
      establishedOn: "-",
      taxRegNo: "-",
      ntnGstNo: "-",

      city: cityName || "-",
      cityCode: locationMeta.city?.code || "-",
      stateProvince: stateName || "-",
      areaRegion: locationMeta.area?.name || "-",
      zipCode: zip || "-",
      fullAddress: address || "-",
      phone: contacts.find((row) => row.type.toLowerCase().includes("phone") || row.type.toLowerCase().includes("mobile"))?.value || "",
      email: contacts.find((row) => row.type.toLowerCase().includes("email"))?.value || "",

      ownerName: ownerPreview?.name || owner || "-",
      ownerCode: ownerPreview?.code || "OWN-0001",
      fatherHusbandName: "-",
      cnicId: "-",
      nationality: "Pakistani",
      designation: ownerPreview?.role || "—",
      ownershipType: "Individual",
      ownershipPercent: "100%",
      ownerPhone: phoneVal || ownerPreview?.mobile || "-",
      ownerWhatsApp: whatsappVal || ownerPreview?.whatsapp || "-",
      ownerEmail: emailVal || ownerPreview?.email || "-",
      ownerAltEmail: "-",
      ownerLandline: "-",
      ownerWebsite: ownerPreview?.address || "-",
      ownerCountry: ownerPreview?.country || "-",

      companyName: companyDetails?.name || "-",
      companyCode: companyCode || "-",
      companyType: "Private Limited",
      companyRegNo: "-",
      companyIncDate: "-",
      companyTaxRegNo: "-",
      companyNtnGstNo: "-",
      companyStatus: "Active",
      companyPhone: phoneVal || "-",
      companyEmail: emailVal || "-",
      companyWebsite: "-",
      companyOfficeAddress: companyDetails?.address || address || "-",

      allowedPermissions: ["settings.access", "branch.super_admin", "settings.system"],
      remarks: "Super Admin main headquarters and system configurations."
    };
  }, [
    editingBranchId,
    contacts,
    branchCode,
    countryName,
    currency,
    companyDetails,
    cityName,
    locationMeta,
    stateName,
    zip,
    address,
    ownerPreview,
    owner,
    companyCode,
    hasAny
  ]);

  function openReport(autoPrint: boolean) {
    const activeLang = typeof document !== "undefined" ? document.documentElement.lang : "en";
    openA4ReportWindow({
      title: t(activeLang, "sabs.report_title" as never, "Super Admin Branch Report"),
      subtitle: t(activeLang, "sabs.report_subtitle_a4" as never, "Store Entry Preview (A4)"),
      autoPrint,
      branchData: liveBranchData,
      lang: activeLang
    });
  }

  function printReport() {
    openReport(true);
  }

  function viewReport() {
    openReport(false);
  }

  function editReport() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const firstField = document.querySelector("form input, form select, form textarea") as HTMLElement | null;
    firstField?.focus?.();
  }

  function resetForm() {
    setEditingBranchId("");
    setLocation({ countryId: "", stateProvinceId: "", districtId: "", cityId: "" });
    setLocationMeta({ country: null, state: null, district: null, city: null, area: null });
    setCurrency("USD");
    setAddress("");
    setCompanyId("");
    setCompanyDetails(null);
    setOwner("");
    setOwnerPreview(null);
    setContacts([]);
    setMessage("");
  }

  function normalizeContacts(value: unknown): ContactRow[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((row, index) => {
        const item = row as { id?: string; type?: string; value?: string };
        const type = String(item.type ?? "").trim();
        const contactValue = String(item.value ?? "").trim();
        if (!type || !contactValue) return null;
        return { id: item.id || `${type}-${contactValue}-${index}`, type, value: contactValue };
      })
      .filter((row): row is ContactRow => Boolean(row));
  }

  function beginEditBranch(row: DbSuperAdminBranchRow) {
    setEditingBranchId(row.id);
    setLocation({
      countryId: row.country_id ?? "",
      stateProvinceId: row.state_province_id ?? "",
      districtId: row.district_id ?? "",
      cityId: row.city_id ?? ""
    });
    setLocationMeta({ country: null, state: null, district: null, city: null, area: null });
    setCurrency(row.currency || "USD");
    setAddress(row.address || "");
    setCompanyId(row.company_id || "");
    setOwner(row.owner_name || "");
    setContacts(normalizeContacts(row.contacts));
    setMessage(`Editing: ${row.code}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function viewSavedBranch(row: DbSuperAdminBranchRow) {
    const phoneVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("phone") || c.type.toLowerCase().includes("mobile"))?.value || "";
    const emailVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("email"))?.value || row.email || "";
    const whatsappVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("whatsapp"))?.value || "";

    const payload = {
      serialNumber: row.id.slice(0, 4).toUpperCase(),
      branchStatus: "Active",
      branchCode: row.code || "-",
      branchType: "SUPER_ADMIN",
      country: row.countries?.name || countryName || "Country",
      currency: row.currency || currency || "USD",
      
      branchName: row.name,
      createdDate: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined,
      updatedDate: undefined,
      createdBy: "",
      updatedBy: "",
      establishedOn: "-",
      taxRegNo: "-",
      ntnGstNo: "-",

      city: row.cities?.name || cityName || "-",
      cityCode: "-",
      stateProvince: row.states_provinces?.name || stateName || "-",
      areaRegion: "-",
      zipCode: "-",
      fullAddress: row.address || "-",

      ownerName: row.owner_name || "-",
      ownerCode: "OWN-0001",
      fatherHusbandName: "-",
      cnicId: "-",
      nationality: "Pakistani",
      designation: "Super Admin",
      ownershipType: "Individual",
      ownershipPercent: "100%",
      ownerPhone: phoneVal || "-",
      ownerWhatsApp: whatsappVal || "-",
      ownerEmail: emailVal || "-",
      ownerAltEmail: "-",
      ownerLandline: "-",
      ownerWebsite: "-",

      companyName: row.companies?.name || companyName || "-",
      companyCode: row.company_id ? compactCode(row.company_id, "CMP") : "-",
      companyType: "Private Limited",
      companyRegNo: "-",
      companyIncDate: "-",
      companyTaxRegNo: "-",
      companyNtnGstNo: "-",
      companyStatus: "Active",
      companyPhone: phoneVal || "-",
      companyEmail: emailVal || "-",
      companyWebsite: "-",
      companyOfficeAddress: row.address || "-",

      allowedPermissions: ["settings.access", "branch.super_admin", "settings.system"],
      remarks: "Super Admin main headquarters."
    };

    setDrawerBranchData(payload);
  }

  function emailReport() {
    if (typeof window === "undefined") return;
    window.location.href = buildMailtoHref("Super Admin Branch Report", reportRows);
  }

  function exportReportCsv() {
    const rows = [["Field", "Value"], ...reportRows.map((row) => [row.label, row.value])];
    downloadCsv(`super-admin-branch_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  async function loadSavedBranches() {
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/branch-management/super-admin-branches", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { superAdminBranches?: DbSuperAdminBranchRow[] };
      const list = Array.isArray(json.superAdminBranches) ? json.superAdminBranches : [];

      const mapped: SavedBranch[] = list.map((row) => ({
        id: row.id,
        branchCode: row.code,
        country: row.countries?.name ?? "-",
        city: row.cities?.name ?? "-",
        company: row.companies?.name ?? companyName,
        owner: row.owner_name ?? "-",
        savedAt: new Date(row.created_at).toLocaleString()
      }));

      setSavedBranchRows(list);
      setSavedBranches(mapped);
    } catch {
      // Keep silent; this is a side panel convenience list.
    } finally {
      setLoadingSaved(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!companyId) {
        setCompanyDetails(null);
        return;
      }
      try {
        const res = await apiGet<{ company: CompanyDetailRow }>(`/api/erp/companies/${encodeURIComponent(companyId)}`);
        if (!cancelled) setCompanyDetails(res.company ?? null);
      } catch {
        if (!cancelled) setCompanyDetails(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    const q = owner.trim();
    if (!q) {
      setOwnerPreview(null);
      return;
    }

    (async () => {
      try {
        const [customersRes, usersRes] = await Promise.all([
          apiGet<{ customers: OwnerCustomerRow[] }>(`/api/erp/customers?q=${encodeURIComponent(q)}&limit=10`),
          apiGet<{ rows: OwnerProfileRow[] }>(`/api/erp/users/journal-report?q=${encodeURIComponent(q)}&limit=10`)
        ]);

        if (cancelled) return;

        const normalized = normalizeSearch(q);
        const customer =
          customersRes.customers?.find((row) =>
            [
              row.customer_name,
              row.company_name,
              row.contact_person,
              row.mobile,
              row.whatsapp,
              row.email
            ]
              .filter(Boolean)
              .some((value) => normalizeSearch(String(value)) === normalized || normalizeSearch(String(value)).includes(normalized))
          ) ?? customersRes.customers?.[0] ?? null;

        if (customer) {
          setOwnerPreview({
            source: "customer",
            code: compactCode(customer.id, "CUST"),
            name: customer.customer_name,
            companyName: customer.company_name ?? "-",
            contactPerson: customer.contact_person ?? "-",
            mobile: customer.mobile ?? "-",
            whatsapp: customer.whatsapp ?? "-",
            email: customer.email ?? "-",
            address: customer.address ?? "-",
            country: countryName || "-",
            branch: "Customer Management",
            role: "Customer / Owner"
          });
          return;
        }

        const profile =
          usersRes.rows?.find((row) => {
            const haystack = normalizeSearch([row.userCode, row.fullName, row.countryName, row.branchName, row.role].filter(Boolean).join(" "));
            return haystack.includes(normalized);
          }) ?? usersRes.rows?.[0] ?? null;

        if (profile) {
          setOwnerPreview({
            source: "profile",
            code: profile.userCode || compactCode(profile.userId, "USR"),
            name: profile.fullName,
            companyName: companyName || "-",
            contactPerson: profile.fullName,
            mobile: "-",
            whatsapp: "-",
            email: "-",
            address: "-",
            country: profile.countryName || countryName || "-",
            branch: profile.branchName || "-",
            role: profile.role
          });
          return;
        }

        setOwnerPreview(null);
      } catch {
        if (!cancelled) setOwnerPreview(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyName, countryName, owner]);

  function addType(kind: "contact") {
    const name = newType.trim();
    if (!name) return;

    setContactTypes((current) => [...current, name]);
    setContactType(name);

    setNewType("");
    setModal(null);
  }

  function addContact() {
    const value = contactValue.trim();
    if (!value) return;

    setContacts((current) => [
      ...current,
      { id: `${contactType}-${value}-${Date.now()}`, type: contactType, value }
    ]);
    setContactValue("");
  }

  async function saveBranch() {
    if (!readyToSave) {
      setMessage("Complete country, state, city, company, owner, currency, and address first.");
      return;
    }

    setMessage("");
    try {
      const contactsPayload = contacts
        .map((row) => ({ type: row.type.trim(), value: row.value.trim() }))
        .filter((row) => row.type && row.value);

      const emailContact = contactsPayload.find((row) => row.type.toLowerCase().includes("email"))?.value;
      const email = emailContact && emailContact.includes("@") ? emailContact : `${branchCode.trim().toLowerCase()}@dgt.llc`;
      const phone = contactsPayload.find((row) => row.type.toLowerCase().includes("phone") || row.type.toLowerCase().includes("mobile"))?.value;
      const whatsappNumber = contactsPayload.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value;

      const branchName = companyName ? `${companyName} Super Admin Branch` : "Super Admin Branch";

      const res = await fetch("/api/branch-management/super-admin-branches", {
        method: editingBranchId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingBranchId || undefined,
          companyId,
          name: branchName,
          code: branchCode,
          countryId: location.countryId || undefined,
          stateProvinceId: location.stateProvinceId || undefined,
          districtId: location.districtId || undefined,
          cityId: location.cityId || undefined,
          currencyCode: currency || undefined,
          address: address.trim() || undefined,
          phone: phone || undefined,
          email,
          whatsappNumber: whatsappNumber || undefined,
          ownerName: owner.trim() || undefined,
          ownerCustomerId: ownerCustomerId || undefined,
          ownerProfileId: ownerProfileId || undefined,
          contacts: contactsPayload.length ? contactsPayload : undefined
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        let errorMessage = "Failed to save Super Admin Branch.";
        if (json?.error) {
          if (typeof json.error === "string") {
            errorMessage = json.error;
          } else if (json.error.message && typeof json.error.message === "string") {
            errorMessage = json.error.message;
          } else if (json.error.fieldErrors && typeof json.error.fieldErrors === "object") {
            const fieldMsgs = Object.entries(json.error.fieldErrors)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
              .join("; ");
            errorMessage = `Validation Error: ${fieldMsgs}`;
          } else {
            errorMessage = JSON.stringify(json.error);
          }
        }
        setMessage(errorMessage);
        return;
      }

      setMessage(`${editingBranchId ? "Updated" : "Saved"}: ${branchCode}`);
      setEditingBranchId("");
      await loadSavedBranches();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save Super Admin Branch.");
    }
  }

  useEffect(() => {
    loadSavedBranches().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (savedBranchRows.length) {
      const targetId = isUuid(editId) ? editId : (savedBranchRows.length === 1 ? savedBranchRows[0].id : "");
      if (isUuid(targetId)) {
        const row = savedBranchRows.find((r) => r.id === targetId);
        if (row && editingBranchId !== targetId) {
          beginEditBranch(row);
        }
      }
    }
  }, [editId, savedBranchRows, editingBranchId]);

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{tt("nav.new_entry", "New Entry")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tt("sab.title", "Super Admin Branch")}</h1>
          <p className="text-sm text-muted-foreground">
            {tt("sab.desc", "Create the root (Head Office) branch. Country Main Branch and City Branch records will be created under this hierarchy.")}
          </p>
        </div>
        <span className={pillClassName()}>
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
          <b>{tt("sab.status_lbl", "Status")}:</b> <span>{readyToSave ? tt("sab.status_ready", "Ready") : tt("sab.status_draft", "Draft")}</span>
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" aria-hidden />
              <CardTitle>{tt("sab.setup_title", "Super Admin Branch Setup")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 bg-slate-50/30 dark:bg-slate-900/5 p-6">
            <section className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{tt("sab.step1", "Step 1 - Branch Info & Currency")}</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{tt("sab.branch_type", "Branch Type")}</Label>
                  <Input value={tt("sab.title", "Super Admin Branch")} readOnly className="bg-muted/50 font-semibold" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currencySelect">{tt("ulrp.currency", "Currency")}</Label>
                  <select id="currencySelect" value={currency} onChange={(event) => setCurrency(event.target.value)} className={selectClass()}>
                    {currencies.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{tt("ulrp.branch_code", "Branch Code")}</Label>
                  <Input value={branchCode} readOnly placeholder="Auto" className="bg-muted/50 font-mono font-semibold" />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{tt("sab.step2", "Step 2 - Location Settings")}</h2>
              </div>
              <div className="space-y-4">
                <LocationHierarchySelect
                  value={location}
                  showDistrict={false}
                  showArea={true}
                  onChange={(next, meta) => {
                    setLocation(next);
                    setLocationMeta(meta);
                    setMessage("");
                  }}
                />

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{tt("sab.zip", "ZIP / Postal Code")}</Label>
                    <Input value={zip} readOnly placeholder={tt("sab.zip_ph", "Auto from selected Area or City")} className="bg-muted/50 font-semibold" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{tt("ulrp.address", "Full Address")}</Label>
                  <TextArea value={address} onChange={setAddress} placeholder={tt("sab.address_ph", "Area / Road, Building, Street, Landmark, etc.")} />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{tt("sab.step3", "Step 3 - Company & Owner Settings")}</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <CompanyPicker
                    label={tt("sabs.company_name", "Company Name")}
                    value={companyId}
                    onValueChange={setCompanyId}
                    placeholder={tt("sabs.search_company", "Search company")}
                    createButtonPlacement="below"
                  />
                </div>

                <div className="space-y-2">
                  <BranchOwnerPicker
                    value={ownerId}
                    onValueChange={setOwnerId}
                    onOwnerResolved={(resolved) => {
                      setOwner(resolved?.name || "");
                      setOwnerCustomerId(resolved?.kind === "customer" ? resolved.id : null);
                      setOwnerProfileId(resolved?.kind === "profile" ? resolved.id : null);
                    }}
                    placeholder={tt("sabs.search_owner", "Search owner")}
                    createButtonPlacement="below"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">4</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{tt("sab.step4", "Step 4 - Contact Details")}</h2>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>{tt("sab.contact_type", "Contact Type")}</Label>
                    <select
                      value={contactType}
                      onChange={(event) => (event.target.value === "__new__" ? setModal("contactType") : setContactType(event.target.value))}
                      className={selectClass()}
                    >
                      {contactTypes.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                      <option value="__new__">{tt("sab.new_option", "+ New")}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("sab.value_lbl", "Value")}</Label>
                    <Input value={contactValue} onChange={(event) => setContactValue(event.target.value)} placeholder={tt("sab.value_ph", "Enter value")} />
                  </div>
                  <Button
                    type="button"
                    onClick={addContact}
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-1.5"
                    title={tt("sab.add_contact", "Add Contact")}
                  >
                    <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden />
                    <span>{tt("sab.add", "Add")}</span>
                  </Button>
                </div>
                <ChipList empty={tt("sab.no_contacts", "No contacts added yet.")} rows={contacts} onRemove={(id) => setContacts((rows) => rows.filter((row) => row.id !== id))} />
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                }}
                className="h-10 px-5 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 font-semibold"
              >
                {tt("sab.reset", "Reset")}
              </Button>
              <Button
                type="button"
                onClick={saveBranch}
                className={cn(
                  "h-10 px-6 rounded-lg text-white font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2",
                  editingBranchId
                    ? "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
                    : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                )}
              >
                <Save className="h-4 w-4 stroke-[2.5]" aria-hidden />
                <span>{editingBranchId ? tt("sab.update_btn", "Update Branch") : tt("sab.save_btn", "Save Branch")}</span>
              </Button>
            </div>

            {message ? (
              <div
                className={
                  message.startsWith("Saved") || message.startsWith("Updated")
                    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                    : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
                }
              >
                {message}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <BranchLiveReportPanel
            title={tt("sabs.live_preview_title", "Store Entry (Live Preview)")}
            status={hasAny ? "Draft" : "Empty"}
            branchData={liveBranchData}
            summary={[
              { label: tt("sabs.branch", "Branch"), value: branchCode || "-" },
              { label: tt("sabs.country", "Country"), value: locationMeta.country?.iso2 || countryName || "-" },
              { label: tt("sabs.state", "State"), value: locationMeta.state?.code || stateName || "-" },
              { label: tt("sabs.city", "City"), value: locationMeta.city?.code || cityName || "-" }
            ]}
            actions={
              <BranchReportActionsMenu
                ariaLabel={tt("sabs.actions_aria", "Super Admin branch actions")}
                disabled={!hasAny}
                onView={viewReport}
                onEdit={editReport}
                onPrint={printReport}
                onPdf={() => openReport(true)}
                onEmail={emailReport}
                onExcel={exportReportCsv}
              />
            }
            steps={[
              {
                title: tt("sabs.step1_company_owner", "Step 1 - Company & Owner"),
                rows: [
                  { label: tt("sabs.company_name", "Company Name"), value: companyName || "-" },
                  { label: tt("sabs.company_code", "Company Code"), value: companyCode || "-" },
                  { label: tt("sabs.legal_name", "Legal Name"), value: companyDetails?.legal_name || "-" },
                  { label: tt("sabs.base_currency", "Base Currency"), value: companyDetails?.base_currency || currency || "USD" },
                  { label: tt("sabs.owner", "Owner"), value: ownerPreview?.name || owner || "-" },
                  { label: tt("sabs.owner_code", "Owner Code"), value: ownerPreview?.code || "-" },
                  { label: tt("sabs.source", "Source"), value: ownerPreview ? ownerPreview.source : "-" },
                  { label: tt("sabs.role_branch", "Role / Branch"), value: ownerPreview ? [ownerPreview.role, ownerPreview.branch].filter(Boolean).join(" · ") : "-" }
                ]
              },
              {
                title: tt("sabs.step2_location", "Step 2 - Location"),
                rows: [
                  { label: tt("sabs.country", "Country"), value: countryName || "-" },
                  { label: tt("sabs.country_code", "Country Code"), value: locationMeta.country?.iso2 || locationMeta.country?.iso3 || "-" },
                  { label: tt("sabs.state", "State"), value: stateName || "-" },
                  { label: tt("sabs.state_code", "State Code"), value: locationMeta.state?.code || "-" },
                  { label: tt("sabs.district", "District"), value: districtName || "-" },
                  { label: tt("sabs.city", "City"), value: cityName || "-" },
                  { label: tt("sabs.city_code", "City Code"), value: locationMeta.city?.code || "-" },
                  { label: tt("sabs.branch_name", "Branch Name"), value: companyName ? `${companyName} Super Admin Branch` : "Super Admin Branch" },
                  { label: tt("sabs.branch_code", "Branch Code"), value: branchCode || "-" },
                  { label: tt("sabs.zip_code", "Zip Code"), value: zip || "-" }
                ]
              },
              {
                title: tt("sabs.step3_contact_address", "Step 3 - Contact & Address"),
                rows: [
                  { label: tt("sabs.currency", "Currency"), value: currency || "USD" },
                  { label: tt("sabs.address", "Address"), value: address || "-" },
                  { label: tt("sabs.contacts", "Contacts"), value: contactsText }
                ]
              }
            ]}
            footer={
              <div className="space-y-3">
                {editingBranchId ? (
                  <BranchRecordProfile
                    title={tt("sabs.editing_title", "Editing Existing Branch")}
                    subtitle={tt("sabs.editing_subtitle", "Saved data, completed fields, and missing information.")}
                    identity={editIdentityRows}
                    sections={editProfileSections}
                  />
                ) : null}

                <details className="rounded-lg border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">{tt("sab.saved_title", "Saved Super Admin Branches")}</summary>
                  <div className="mt-3 space-y-2">
                    <Input
                      value={savedSearch}
                      onChange={(event) => setSavedSearch(event.target.value)}
                      placeholder={tt("sab.search_ph", "Search saved branch")}
                      className="h-9"
                    />
                    {loadingSaved ? (
                      <p className="text-sm text-muted-foreground">{tt("sab.loading_saved", "Loading saved branches...")}</p>
                    ) : filteredSavedBranches.length ? (
                      filteredSavedBranches.map((entry) => {
                        const row = savedBranchRows.find((item) => item.id === entry.id);
                        return (
                          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm">
                            <div>
                              <p className="font-semibold">{entry.branchCode}</p>
                              <p className="text-xs text-muted-foreground">
                                {entry.company} · {entry.country} · {entry.city}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" size="sm" variant="outline" disabled={!row} onClick={() => row && viewSavedBranch(row)}>
                                <Eye className="h-3.5 w-3.5" aria-hidden />
                                {tt("bgr.view", "View")}
                              </Button>
                              <Button type="button" size="sm" variant="outline" disabled={!row} onClick={() => row && beginEditBranch(row)}>
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                {tt("bgr.edit", "Edit")}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">{tt("sab.no_saved", "No saved branches found.")}</p>
                    )}
                  </div>
                </details>
              </div>
            }
          />
        </div>
      </div>

      {modal === "contactType" ? (
        <Modal title={tt("sab.add_type_title", "Add Contact Type")} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Input value={newType} onChange={(event) => setNewType(event.target.value)} placeholder={tt("sab.value_ph", "Enter value")} />
            <Button type="button" onClick={() => addType("contact")}>{tt("sab.save_type", "Save Type")}</Button>
          </div>
        </Modal>
      ) : null}

      {modal === "report" ? (
        <Modal title={tt("sabs.report_title", "Super Admin Branch Report")} onClose={() => setModal(null)}>
          <div>
            {reportRows.map((row) => (
              <ReportRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </Modal>
      ) : null}

      <DetailDrawer
        isOpen={drawerBranchData !== null}
        onClose={() => setDrawerBranchData(null)}
        title={tt("sabs.details_title", "Super Admin Branch Details")}
        subtitle={tt("sabs.details_subtitle", "Verification certificate and branch permissions")}
      >
        {drawerBranchData && (
          <BranchLiveReportPanel
            title={tt("sabs.saved_branch_title", "Saved Super Admin Branch")}
            status={drawerBranchData.branchStatus}
            branchData={drawerBranchData}
          />
        )}
      </DetailDrawer>
    </div>
  );
}

function SuperAdminBranchSetupFallback() {
  const lang = useActiveLanguage();
  return (
    <div className="p-8 text-center text-sm font-semibold text-slate-500">
      {t(lang, "sabs.loading" as never, "Loading...")}
    </div>
  );
}

export function SuperAdminBranchSetup() {
  return (
    <Suspense fallback={<SuperAdminBranchSetupFallback />}>
      <SuperAdminBranchSetupContent />
    </Suspense>
  );
}

