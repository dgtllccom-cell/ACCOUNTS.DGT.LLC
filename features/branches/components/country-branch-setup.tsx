"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactNumberInput } from "@/components/ui/contact-number-input";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import type { LocationCountry } from "@/features/locations/location-api";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { BranchOwnerPicker } from "@/features/branches/components/branch-owner-picker";
import { BranchLiveReportPanel } from "@/features/branches/components/branch-live-report-panel";
import { BranchRecordProfile, type BranchProfileSection } from "@/features/branches/components/branch-record-profile";
import { BranchReportActionsMenu } from "@/features/branches/components/branch-report-actions-menu";
import { downloadCsv } from "@/features/branches/components/branch-report-export";
import { PermissionAssignmentSection } from "@/features/users/components/permission-assignment-section";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { getPermissionKeysForTemplate } from "@/lib/permissions/catalog";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import type { ContactTypeKey } from "@/features/contact-types/contact-type-api";

type CountryBranchRow = {
  id: string;
  country_id: string;
  name: string;
  code: string;
  local_currency: string;
  is_main: boolean;
  status: string;
  company_id?: string | null;
  owner_name?: string | null;
  contacts?: unknown;
  documents?: unknown;
  permission_template?: string | null;
  permission_grants?: string[] | null;
  state_province_id?: string | null;
  district_id?: string | null;
  city_id?: string | null;
  address?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ContactRow = { type: string; value: string };
type CompanyRow = { id: string; name: string; legal_name: string | null; base_currency: string };
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

const contactTypeOptions = ["Mobile", "Phone", "WhatsApp", "Email", "Fax"] as const;

function toContactTypeKey(label: string): ContactTypeKey | null {
  const normalized = (label || "").toLowerCase();
  if (normalized.startsWith("mobile")) return "mobile";
  if (normalized.startsWith("phone")) return "phone";
  if (normalized.startsWith("whatsapp")) return "whatsapp";
  if (normalized.startsWith("fax")) return "fax";
  if (normalized.startsWith("extension")) return "extension";
  return null;
}

function selectClassName() {
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

function buildMailtoHref(subject: string, rows: Array<{ label: string; value: string }>) {
  const body = rows.map((row) => `${row.label}: ${row.value || "-"}`).join("\n");
  const params = new URLSearchParams({ subject, body });
  return `mailto:?${params.toString()}`;
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

function formatBulletList(items: string[]) {
  if (!items.length) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <ul className="ms-4 list-disc text-sm text-slate-700 dark:text-slate-200">
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`}>{item}</li>
      ))}
    </ul>
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asIso3(country: LocationCountry | null) {
  if (!country) return "";
  const iso = (country.iso3 || country.iso2 || country.name || "").replace(/[^a-zA-Z]/g, "");
  return iso.slice(0, 3).toUpperCase() || "CTR";
}

export function CountryBranchSetup() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId") ?? "";
  const [drawerBranchData, setDrawerBranchData] = useState<any>(null);
  const [activeStep, setActiveStep] = useState(1);
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

  const [currency, setCurrency] = useState("");
  const [fullAddress, setFullAddress] = useState("");

  const [companyId, setCompanyId] = useState("");
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPreview, setOwnerPreview] = useState<OwnerPreview | null>(null);

  const [existingMainBranch, setExistingMainBranch] = useState<CountryBranchRow | null>(null);
  const [editingCountryBranchId, setEditingCountryBranchId] = useState("");
  const [countryBranches, setCountryBranches] = useState<CountryBranchRow[]>([]);
  const [countryBranchSearch, setCountryBranchSearch] = useState("");
  const [branchType, setBranchType] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [permissionTemplate, setPermissionTemplate] = useState("country-standard");
  const [permissionGrants, setPermissionGrants] = useState<string[]>(() => getPermissionKeysForTemplate("country-standard"));

  const [contacts, setContacts] = useState<ContactRow[]>([]);

  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const filteredCountryBranches = useMemo(() => {
    const q = countryBranchSearch.trim().toLowerCase();
    if (!q) return countryBranches;
    return countryBranches.filter((b) => {
      const haystack = [b.code, b.name, b.status].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [countryBranches, countryBranchSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!companyId) {
        setCompany(null);
        return;
      }
      try {
        const res = await apiGet<{ company: CompanyRow }>(`/api/erp/companies/${encodeURIComponent(companyId)}`);
        if (!cancelled) setCompany(res.company);
      } catch {
        if (!cancelled) setCompany(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    const q = ownerName.trim();
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
            [row.customer_name, row.company_name, row.contact_person, row.mobile, row.whatsapp, row.email]
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
            country: locationMeta.country?.name ?? "-",
            branch: existingMainBranch?.name ?? "-",
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
            companyName: company?.name ?? "-",
            contactPerson: profile.fullName,
            mobile: "-",
            whatsapp: "-",
            email: "-",
            address: "-",
            country: profile.countryName || locationMeta.country?.name || "-",
            branch: profile.branchName || existingMainBranch?.name || "-",
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
  }, [ownerName, company, existingMainBranch?.name, locationMeta.country?.name]);

  const zip = locationMeta.area?.postal_code ?? locationMeta.city?.zip_code ?? "";
  const previewCountry = locationMeta.country?.name || "-";
  const previewLocation = [locationMeta.state?.name, locationMeta.city?.name, locationMeta.area?.name, zip].filter(Boolean).join(" / ") || "-";
  const previewCompany = company?.name || "-";
  const companyCode = company?.id ? compactCode(company.id, "CMP") : "-";

  const contactItems = contacts
    .map((row) => {
      if (!row.type && !row.value) return null;
      return `${row.type || "Type"}: ${row.value || "-"}`;
    })
    .filter((row): row is string => Boolean(row));

  const hasAny = Boolean(
    location.countryId ||
      location.stateProvinceId ||
      location.cityId ||
      currency ||
      fullAddress ||
      companyId ||
      ownerName ||
      branchType ||
      branchCode ||
      permissionGrants.length ||
      contacts.some((c) => c.type || c.value)
  );

  const reportRows = useMemo(
    () => [
      { label: "Country", value: previewCountry },
      { label: "Country Code", value: locationMeta.country?.iso2 || locationMeta.country?.iso3 || "-" },
      { label: "Branch Type", value: branchType || "-" },
      { label: "Branch Code", value: branchCode || "-" },
      { label: "Currency", value: currency || "-" },
      { label: "Location", value: previewLocation },
      { label: "Address", value: fullAddress || "-" },
      { label: "Company Name", value: previewCompany },
      { label: "Company Code", value: companyCode },
      { label: "Company Owner", value: ownerPreview?.name || ownerName || "-" },
      { label: "Owner Details", value: ownerPreview ? `${ownerPreview.source.toUpperCase()} · ${ownerPreview.code}` : ownerName || "-" },
      { label: "Permission Template", value: permissionTemplate || "-" },
      { label: "Permission Grants", value: permissionGrants.length ? permissionGrants.join(", ") : "-" },
      { label: "Contacts", value: contactItems.length ? contactItems.join(", ") : "-" }
    ],
    [
      branchCode,
      branchType,
      contactItems,
      companyCode,
      currency,
      fullAddress,
      locationMeta.country?.iso2,
      locationMeta.country?.iso3,
      ownerName,
      ownerPreview,
      permissionGrants,
      permissionTemplate,
      previewCompany,
      previewCountry,
      previewLocation
    ]
  );

  const editIdentityRows = useMemo(
    () => [
      { label: "Country", value: previewCountry },
      { label: "Main Branch", value: existingMainBranch?.name || (previewCountry && previewCountry !== "-" ? `${previewCountry} Main Branch` : "") },
      { label: "Branch Code", value: existingMainBranch?.code || branchCode },
      { label: "Record ID", value: editingCountryBranchId },
      { label: "Status", value: existingMainBranch?.status || "active" },
      { label: "Created Date", value: existingMainBranch?.created_at ? new Date(existingMainBranch.created_at).toLocaleString() : "" },
      { label: "Last Updated", value: existingMainBranch?.updated_at ? new Date(existingMainBranch.updated_at).toLocaleString() : "" },
      { label: "Currency", value: currency }
    ],
    [branchCode, currency, editingCountryBranchId, existingMainBranch, previewCountry]
  );

  const editProfileSections: BranchProfileSection[] = useMemo(
    () => [
      {
        title: "Branch Information",
        items: [
          { label: "Branch Type", value: branchType },
          { label: "Branch Code", value: existingMainBranch?.code || branchCode },
          { label: "Currency", value: currency },
          { label: "Status", value: existingMainBranch?.status || "active" }
        ]
      },
      {
        title: "Location Information",
        items: [
          { label: "Country", value: previewCountry },
          { label: "Country Code", value: locationMeta.country?.iso2 || locationMeta.country?.iso3 },
          { label: "Location", value: previewLocation },
          { label: "Address", value: fullAddress }
        ]
      },
      {
        title: "Company Information",
        items: [
          { label: "Company Name", value: company?.name },
          { label: "Company Code", value: company?.id ? compactCode(company.id, "CMP") : "" },
          { label: "Legal Name", value: company?.legal_name },
          { label: "Base Currency", value: company?.base_currency }
        ]
      },
      {
        title: "Owner Information",
        items: [
          { label: "Owner Name", value: ownerPreview?.name || ownerName },
          { label: "Owner Code", value: ownerPreview?.code || "N/A" },
          { label: "Owner Source", value: ownerPreview?.source || "custom" },
          { label: "Owner Role", value: ownerPreview?.role || "Owner" }
        ]
      },
      {
        title: "Contact Information",
        items: [
          { label: "Contacts", value: contactItems.length ? contactItems.join(", ") : "" },
          { label: "Phone", value: contacts.find((row) => row.type.toLowerCase().includes("phone"))?.value },
          { label: "WhatsApp", value: contacts.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value },
          { label: "Email", value: contacts.find((row) => row.type.toLowerCase().includes("email"))?.value }
        ]
      },
      {
        title: "Permissions",
        items: [
          { label: "Template", value: permissionTemplate },
          { label: "Granted Permissions", value: permissionGrants.length ? permissionGrants.join(", ") : "" }
        ]
      }
    ],
    [
      branchCode,
      branchType,
      company,
      contactItems,
      contacts,
      currency,
      existingMainBranch,
      fullAddress,
      locationMeta.country?.iso2,
      locationMeta.country?.iso3,
      ownerName,
      ownerPreview,
      permissionGrants,
      permissionTemplate,
      previewCountry,
      previewLocation
    ]
  );

  const liveBranchData = useMemo(() => {
    const active = existingMainBranch;
    const phoneVal = contacts.find((row) => row.type.toLowerCase().includes("phone"))?.value || "";
    const emailVal = contacts.find((row) => row.type.toLowerCase().includes("email"))?.value || "";
    const whatsappVal = contacts.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value || "";

    return {
      serialNumber: active?.id ? active.id.slice(0, 4).toUpperCase() : "0001",
      branchStatus: active?.status || (hasAny ? "Draft" : "Empty"),
      branchCode: active?.code || branchCode || "-",
      branchType: "MAIN",
      country: previewCountry,
      currency: active?.local_currency || currency || "USD",
      
      parentBranch: {
        name: "ACCOUNTS.DGT.LLC Headquarters",
        code: "SUPER-HQ-001",
        type: "SUPER_ADMIN",
        status: "ACTIVE",
        currency: "USD"
      },

      branchName: active?.name || (previewCountry && previewCountry !== "-" ? `${previewCountry} Main Branch` : "Main Branch"),
      createdDate: active?.created_at ? new Date(active.created_at).toLocaleDateString() : undefined,
      updatedDate: active?.updated_at ? new Date(active.updated_at).toLocaleDateString() : undefined,
      createdBy: "Super Admin",
      updatedBy: "Super Admin",
      establishedOn: "-",
      taxRegNo: "-",
      ntnGstNo: "-",

      city: locationMeta.city?.name || "-",
      cityCode: locationMeta.city?.code || "-",
      stateProvince: locationMeta.state?.name || "-",
      district: locationMeta.district?.name || "-",
      areaRegion: locationMeta.area?.name || "-",
      zipCode: zip || "-",
      fullAddress: active?.address || fullAddress || "-",

      ownerName: ownerPreview?.name || active?.owner_name || ownerName || "-",
      ownerCode: ownerPreview?.code || "OWN-0001",
      fatherHusbandName: "-",
      cnicId: "-",
      nationality: "Pakistani",
      designation: "Country Admin",
      ownershipType: "Individual",
      ownershipPercent: "100%",
      ownerPhone: phoneVal || ownerPreview?.mobile || "-",
      ownerWhatsApp: whatsappVal || ownerPreview?.whatsapp || "-",
      ownerEmail: emailVal || ownerPreview?.email || "-",
      ownerAltEmail: "-",
      ownerLandline: "-",
      ownerWebsite: ownerPreview?.address || "-",

      companyName: previewCompany || "-",
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
      companyOfficeAddress: active?.address || fullAddress || "-",

      allowedPermissions: active?.permission_grants || permissionGrants,
      remarks: "This is a detailed country main branch report representing live settings."
    };
  }, [
    existingMainBranch,
    contacts,
    branchCode,
    previewCountry,
    currency,
    locationMeta,
    zip,
    fullAddress,
    ownerPreview,
    ownerName,
    previewCompany,
    companyCode,
    permissionGrants,
    hasAny
  ]);

  function openReport(autoPrint: boolean) {
    const activeLang = typeof document !== "undefined" ? document.documentElement.lang : "en";
    openA4ReportWindow({
      title: "Country Main Branch Report",
      subtitle: "Store Entry Preview (A4)",
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

  function normalizeContacts(value: unknown): ContactRow[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((row) => {
        const item = row as { type?: string; value?: string };
        const type = String(item.type ?? "").trim();
        const contactValue = String(item.value ?? "").trim();
        return type && contactValue ? { type, value: contactValue } : null;
      })
      .filter((row): row is ContactRow => Boolean(row));
  }

  function beginEditCountryBranch(row: CountryBranchRow) {
    setEditingCountryBranchId(row.id);
    setExistingMainBranch(row);
    setLocation({
      countryId: row.country_id,
      stateProvinceId: row.state_province_id ?? "",
      districtId: row.district_id ?? "",
      cityId: row.city_id ?? "",
      areaId: ""
    });
    setLocationMeta({ country: null, state: null, district: null, city: null, area: null });
    setBranchType("MAIN");
    setBranchCode(row.code || "");
    setCurrency(row.local_currency || "");
    setFullAddress(row.address ?? "");
    setCompanyId(row.company_id ?? "");
    setOwnerName(row.owner_name ?? "");
    setContacts(normalizeContacts(row.contacts));
    setPermissionTemplate(row.permission_template ?? "country-standard");
    setPermissionGrants(Array.isArray(row.permission_grants) ? row.permission_grants : getPermissionKeysForTemplate("country-standard"));
    setBanner({
      type: "success",
      message: `Editing Existing Branch\nBranch Name: ${row.name}\nBranch Code: ${row.code}`
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function viewSavedBranch(row: CountryBranchRow) {
    const phoneVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("phone") || c.type.toLowerCase().includes("mobile"))?.value || "";
    const emailVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("email"))?.value || "";
    const whatsappVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("whatsapp"))?.value || "";

    const payload = {
      serialNumber: row.id.slice(0, 4).toUpperCase(),
      branchStatus: row.status || "ACTIVE",
      branchCode: row.code || "-",
      branchType: "MAIN",
      country: previewCountry || row.name.split(" ")[0] || "Country",
      currency: row.local_currency || currency || "USD",
      
      parentBranch: {
        name: "ACCOUNTS.DGT.LLC Headquarters",
        code: "SUPER-HQ-001",
        type: "SUPER_ADMIN",
        status: "ACTIVE",
        currency: "USD"
      },

      branchName: row.name,
      createdDate: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined,
      updatedDate: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : undefined,
      createdBy: "Super Admin",
      updatedBy: "Super Admin",
      establishedOn: "-",
      taxRegNo: "-",
      ntnGstNo: "-",

      city: locationMeta.city?.name || "-",
      cityCode: locationMeta.city?.code || "-",
      stateProvince: locationMeta.state?.name || "-",
      district: locationMeta.district?.name || "-",
      areaRegion: locationMeta.area?.name || "-",
      zipCode: zip || "-",
      fullAddress: row.address || "-",

      ownerName: row.owner_name || "-",
      ownerCode: "OWN-0001",
      fatherHusbandName: "-",
      cnicId: "-",
      nationality: "Pakistani",
      designation: "Country Admin",
      ownershipType: "Individual",
      ownershipPercent: "100%",
      ownerPhone: phoneVal || "-",
      ownerWhatsApp: whatsappVal || "-",
      ownerEmail: emailVal || "-",
      ownerAltEmail: "-",
      ownerLandline: "-",
      ownerWebsite: "-",

      companyName: previewCompany || "-",
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
      companyOfficeAddress: row.address || "-",

      allowedPermissions: Array.isArray(row.permission_grants) ? row.permission_grants : [],
      remarks: "Saved country main branch details registry."
    };

    setDrawerBranchData(payload);
  }

  useEffect(() => {
    if (!isUuid(editId)) return;
    if (editingCountryBranchId === editId) return;

    let cancelled = false;
    (async () => {
      setEditLoading(true);
      try {
        const res = await fetch(`/api/branch-management/country-branches?id=${encodeURIComponent(editId)}`, {
          cache: "no-store"
        });
        const json = (await res.json().catch(() => ({}))) as { countryBranches?: CountryBranchRow[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setBanner({ type: "error", message: json.error || "Branch record not found." });
          return;
        }
        const row = Array.isArray(json.countryBranches) ? json.countryBranches[0] : null;
        if (!row) {
          setBanner({ type: "error", message: "Branch record not found." });
          return;
        }
        setCountryBranches(json.countryBranches ?? []);
        beginEditCountryBranch(row);
      } catch (error) {
        if (!cancelled) setBanner({ type: "error", message: error instanceof Error ? error.message : "Failed to load branch record." });
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function emailReport() {
    if (typeof window === "undefined") return;
    window.location.href = buildMailtoHref("Country Main Branch Report", reportRows);
  }

  function exportReportCsv() {
    const rows = [["Field", "Value"], ...reportRows.map((row) => [row.label, row.value])];
    downloadCsv(`country-branch_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  async function loadExistingMainBranch(nextCountryId: string) {
    if (!isUuid(nextCountryId)) {
      setExistingMainBranch(null);
      setCountryBranches([]);
      return;
    }

    const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(nextCountryId)}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      setExistingMainBranch(null);
      setCountryBranches([]);
      return;
    }

    const json = (await res.json()) as { countryBranches?: CountryBranchRow[] };
    const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
    setCountryBranches(list);
    const main = list.find((b) => b.is_main) ?? null;
    setExistingMainBranch(main);

    // If a main branch already exists, treat it as "loaded" data for the form.
    if (main) {
      setBranchType("MAIN");
      setBranchCode(main.code);
      setCurrency(main.local_currency || "");
      setFullAddress(main.address ?? "");
      setCompanyId(main.company_id ?? "");
      setOwnerName(main.owner_name ?? "");
      setContacts(normalizeContacts(main.contacts));
      setPermissionTemplate(main.permission_template ?? "country-standard");
      setPermissionGrants(Array.isArray(main.permission_grants) ? main.permission_grants : getPermissionKeysForTemplate("country-standard"));
    }
    return { list, main };
  }

  function nextSuggestedCode(country: LocationCountry | null, existingCount: number) {
    const prefix = asIso3(country);
    const num = String(Math.max(1, existingCount + 1)).padStart(3, "0");
    return `${prefix}-MAIN-${num}`;
  }

  async function onCountrySelected(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    setBanner(null);
    if (editingCountryBranchId && next.countryId === location.countryId) {
      setLocation(next);
      setLocationMeta(meta);
      if (meta.country?.currency_code) {
        setCurrency(meta.country.currency_code.toUpperCase());
      }
      return;
    }
    setLocation(next);
    setLocationMeta(meta);

    setFullAddress("");
    setBranchType(next.countryId ? "MAIN" : "");
    setExistingMainBranch(null);
    setCountryBranches([]);
    setCountryBranchSearch("");
    setBranchCode("");
    setEditingCountryBranchId("");

    const defaultCurrency = meta.country?.currency_code?.toUpperCase() || "";
    setCurrency(defaultCurrency);

    if (meta.country?.phone_code) {
      const code = meta.country.phone_code;
      setContacts((prev) => {
        if (prev.length === 0) {
          return [{ type: "Mobile", value: code + " " }];
        }
        return prev.map((c) => {
          if (["Mobile", "Phone", "WhatsApp"].includes(c.type) && !c.value.trim()) {
            return { ...c, value: code + " " };
          }
          return c;
        });
      });
    };

    if (!isUuid(next.countryId)) return;

    const existing = await loadExistingMainBranch(next.countryId);
    if (existing?.main) {
      setBranchCode(existing.main.code);
      setBanner({
        type: "error",
        message:
          `Country Branch Already Exists\nBranch Name: ${existing.main.name}\nBranch Code: ${existing.main.code}\nStatus: ${existing.main.status}`
      });
      return;
    }

    setBranchCode(nextSuggestedCode(meta.country, existing?.list?.length ?? 0));
  }

  function onLocationChange(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    setLocation(next);
    setLocationMeta(meta);
  }

  function addNewTypePrompt() {
    const value = window.prompt("Enter new type");
    if (!value) return null;
    const clean = value.trim();
    if (!clean) return null;
    return clean;
  }

  function updateContact(idx: number, updates: Partial<ContactRow>) {
    setContacts((current) => current.map((row, i) => (i === idx ? { ...row, ...updates } : row)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);

    if (!isUuid(location.countryId)) {
      setBanner({ type: "error", message: "Please select a valid country from Location Settings." });
      return;
    }

    if (!isUuid(location.stateProvinceId) || !isUuid(location.cityId)) {
      setBanner({ type: "error", message: "Please select State/Province and City from Location Settings." });
      return;
    }

    if (!branchCode.trim()) {
      setBanner({ type: "error", message: "Branch Code is required." });
      return;
    }

    if (!permissionTemplate || !permissionGrants.length) {
      setBanner({ type: "error", message: "Please select a Role Template and at least one permission before saving the Country." });
      return;
    }

    const countryName = locationMeta.country?.name || "Country";
    const branchName = `${countryName} Main Branch`;

    setSaving(true);
    try {
      const contactsPayload = contacts
        .map((row) => ({ type: row.type.trim(), value: row.value.trim() }))
        .filter((row) => row.type && row.value);

      const emailContact = contactsPayload.find((row) => row.type.toLowerCase().includes("email"))?.value;
      const email = emailContact && emailContact.includes("@") ? emailContact : `${branchCode.trim().toLowerCase()}@dgt.llc`;
      const phone = contactsPayload.find((row) => row.type.toLowerCase().includes("phone") || row.type.toLowerCase().includes("mobile"))?.value;
      const whatsappNumber = contactsPayload.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value;

      const res = await fetch("/api/branch-management/country-branches", {
        method: editingCountryBranchId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingCountryBranchId || undefined,
          countryId: location.countryId,
          name: branchName,
          code: branchCode,
          stateProvinceId: location.stateProvinceId || undefined,
          districtId: location.districtId || undefined,
          cityId: location.cityId || undefined,
          address: fullAddress.trim() || undefined,
          phone: phone || undefined,
          email,
          whatsappNumber: whatsappNumber || undefined,
          companyId: companyId || undefined,
          ownerName: ownerName.trim() || undefined,
          permissionTemplate,
          permissionGrants,
          contacts: contactsPayload.length ? contactsPayload : undefined
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        let message = "Failed to save country branch.";
        if (json?.error) {
          if (typeof json.error === "string") {
            message = json.error;
          } else if (json.error.message && typeof json.error.message === "string") {
            message = json.error.message;
          } else if (json.error.fieldErrors && typeof json.error.fieldErrors === "object") {
            const fieldMsgs = Object.entries(json.error.fieldErrors)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
              .join("; ");
            message = `Validation Error: ${fieldMsgs}`;
          } else {
            message = JSON.stringify(json.error);
          }
        }
        if (json?.existingBranch?.id) {
          setExistingMainBranch(json.existingBranch);
          setBranchCode(json.existingBranch.code ?? branchCode);
        }
        setBanner({ type: "error", message });
        return;
      }
      setBanner({ type: "success", message: `${editingCountryBranchId ? "Updated" : "Saved"}: ${branchName} (${branchCode})` });
      setEditingCountryBranchId("");
      await loadExistingMainBranch(location.countryId);
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Failed to save country branch." });
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setBanner(null);
    setLocation({ countryId: "", stateProvinceId: "", districtId: "", cityId: "", areaId: "" });
    setLocationMeta({ country: null, state: null, district: null, city: null, area: null });
    setCurrency("");
    setFullAddress("");
    setCompanyId("");
    setCompany(null);
    setOwnerName("");
    setOwnerPreview(null);
    setContacts([]);
    setExistingMainBranch(null);
    setEditingCountryBranchId("");
    setCountryBranches([]);
    setCountryBranchSearch("");
    setBranchType("");
    setBranchCode("");
    setPermissionTemplate("country-standard");
    setPermissionGrants(getPermissionKeysForTemplate("country-standard"));
    setActiveStep(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">New Entry</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Country Branch</h1>
          <p className="text-sm text-muted-foreground">
            Create one main branch per country. Countries and locations come from Settings / Location.
          </p>
        </div>
        <span className={pillClassName()}>
          <b>Rule:</b> One Main Branch per Country
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-9" aria-label="Country branch wizard sequence">
          {[
            ["1", "Branch Information", "Country, currency and location"],
            ["2", "Access Scope", "Review country scope before setup"],
            ["3", "User Account Setup", "Company and branch owner"],
            ["4", "Contact Information", "Phone, email and official IDs"],
            ["5", "Review & PDF Summary", "Preview before final setup"],
            ["6", "Branch Documents", "Optional branch files"],
            ["7", "Roles & Permissions", "Configure and confirm role access"],
            ["8", "AI Communication Setup", "Email, WhatsApp and alerts"],
            ["9", "Final Approval", "Accept setup or go back"]
          ].map(([no, title, desc]) => (
            <div key={no} className={cn("rounded-xl border px-3 py-2 transition", Number(no) === activeStep ? "border-cyan-500 bg-cyan-50 shadow-sm ring-1 ring-cyan-200 dark:border-cyan-500 dark:bg-cyan-950/40" : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50")}>
              <div className="flex items-center gap-2">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", Number(no) === activeStep ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200")}>{no}</span>
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">{title}</span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500">Step {activeStep} of 9</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving || activeStep === 1} onClick={() => setActiveStep((step) => Math.max(1, step - 1))}>Back</Button>
            {activeStep < 9 ? (
              <Button type="button" size="sm" onClick={() => setActiveStep((step) => Math.min(9, step + 1))}>Next</Button>
            ) : (
              <Button type="submit" form="country-branch-wizard-form" size="sm" disabled={saving || Boolean(existingMainBranch && !editingCountryBranchId) || !location.countryId}>{saving ? "Saving..." : editingCountryBranchId ? "Update" : "Accept & Save"}</Button>
            )}
          </div>
        </div>
      </div>
      <div className={cn("grid gap-5", activeStep === 9 ? "xl:grid-cols-1" : "xl:grid-cols-[0.9fr_1.1fr]")}> 
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>Country Main Branch Setup</CardTitle>
          </CardHeader>

          <CardContent>
            {editLoading ? (
              <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
                Loading existing branch for edit...
              </div>
            ) : null}
            {banner ? (
              <div
                className={
                  banner.type === "success"
                    ? "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                    : "mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
                }
                role="status"
              >
                <div className="whitespace-pre-line">{banner.message}</div>
                {existingMainBranch && !editingCountryBranchId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => beginEditCountryBranch(existingMainBranch)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit Existing Branch
                  </Button>
                ) : null}
              </div>
            ) : null}
            <form id="country-branch-wizard-form" onSubmit={onSubmit} onReset={onReset} className="flex flex-col gap-6">
              <section hidden={activeStep !== 1} className="order-1 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 1 - Country & Currency</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <LocationHierarchySelect
                    value={location}
                    showState={false}
                    showCity={false}
                    showArea={false}
                    onChange={onCountrySelected}
                  />

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Currency</Label>
                    <Input value={currency} readOnly placeholder="Auto from selected Country" />
                  </div>
                </div>
                <input type="hidden" value={branchType} readOnly />
                <input type="hidden" value={branchCode} readOnly />
              </section>

              <section hidden={activeStep !== 1} className="order-1 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 2 - Location</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="space-y-2 md:col-span-4">
                    <Label className="text-xs text-slate-600">Country (auto)</Label>
                    <Input value={locationMeta.country?.name ?? ""} readOnly />
                  </div>
                  <div className="space-y-2 md:col-span-8">
                    <LocationHierarchySelect
                      value={location}
                      showCountry={false}
                      showDistrict={false}
                      showArea={true}
                      allowManageLink={false}
                      onChange={onLocationChange}
                      disabled={!location.countryId}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-4">
                    <Label className="text-xs text-slate-600">Zip / Postal Code</Label>
                    <Input value={zip} readOnly placeholder="Auto from selected Area or City" />
                  </div>
                  <div className="space-y-2 md:col-span-8">
                    <Label className="text-xs text-slate-600">Full Address</Label>
                    <textarea
                      value={fullAddress}
                      onChange={(event) => setFullAddress(event.target.value)}
                      placeholder="Area / Road, Building, Street, Landmark, etc."
                      className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 3} className="order-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 3 - Company & Branch Owner</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <CompanyPicker
                      label="Company Name"
                      value={companyId}
                      onValueChange={setCompanyId}
                      placeholder="Search company"
                      createButtonPlacement="below"
                    />
                  </div>
                  <div className="space-y-2">
                    <BranchOwnerPicker
                      value={ownerName}
                      onValueChange={setOwnerName}
                      placeholder="Search owner"
                      createButtonPlacement="below"
                    />
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 4} className="order-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">4</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 4 - Contacts</h2>
                </div>
                <div className="space-y-3">
                  {contacts.map((row, idx) => (
                    <div key={`contact-${idx}`} className="grid gap-2 md:grid-cols-[180px_1fr_120px]">
                      <select
                        className={selectClassName()}
                        value={row.type}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "__new__") {
                            const next = addNewTypePrompt();
                            if (!next) return;
                            updateContact(idx, { type: next });
                            return;
                          }
                          updateContact(idx, { type: value });
                        }}
                      >
                        <option value="">Select Type</option>
                        {contactTypeOptions.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                        <option value="__new__">+ Add New Type</option>
                      </select>

                      {toContactTypeKey(row.type) ? (
                        <ContactNumberInput
                          label=""
                          hideLabel
                          showHelp={false}
                          countryId={location.countryId || null}
                          contactTypeKey={toContactTypeKey(row.type) as ContactTypeKey}
                          value={row.value}
                          disabled={!location.countryId}
                          onValueChange={(next) => updateContact(idx, { value: next })}
                        />
                      ) : (
                        <Input
                          value={row.value}
                          onChange={(event) => updateContact(idx, { value: event.target.value })}
                          placeholder="Enter value"
                        />
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        onClick={() => setContacts((current) => current.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setContacts((current) => [...current, { type: "", value: "" }])}>
                      + Add Contact
                    </Button>
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 7} className="order-7 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">5</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 7 - Roles & Permissions</h2>
                </div>
                <PermissionAssignmentSection
                  level="country"
                  template={permissionTemplate}
                  selected={permissionGrants}
                  onTemplateChange={setPermissionTemplate}
                  onSelectedChange={setPermissionGrants}
                  required
                  note="Super Admin must grant the Country permissions explicitly before saving."
                />
              </section>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="reset" variant="outline" disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || Boolean(existingMainBranch && !editingCountryBranchId) || !location.countryId}>
                  {saving ? "Saving..." : editingCountryBranchId ? "Update" : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <BranchLiveReportPanel
            title="Store Entry (Live Preview)"
            status={hasAny ? "Draft" : "Empty"}
            branchData={liveBranchData}
            summary={[
              { label: "Branch", value: branchType || "-" },
              { label: "Country", value: previewCountry || "-" },
              { label: "Currency", value: currency || "USD" }
            ]}
            actions={
              <BranchReportActionsMenu
                ariaLabel="Country branch actions"
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
                title: "Step 1 - Company & Owner",
                rows: [
                  { label: "Company Name", value: company?.name || "-" },
                  { label: "Company Code", value: company?.id ? compactCode(company.id, "CMP") : "-" },
                  { label: "Legal Name", value: company?.legal_name || "-" },
                  { label: "Base Currency", value: company?.base_currency || currency || "USD" },
                  { label: "Owner", value: ownerPreview?.name || ownerName || "-" },
                  { label: "Owner Code", value: ownerPreview?.code || "-" },
                  { label: "Source", value: ownerPreview ? ownerPreview.source : "-" },
                  { label: "Role / Branch", value: ownerPreview ? [ownerPreview.role, ownerPreview.branch].filter(Boolean).join(" · ") : "-" }
                ]
              },
              {
                title: "Step 2 - Location",
                rows: [
                  { label: "Country", value: previewCountry || "-" },
                  { label: "Country Code", value: locationMeta.country?.iso2 || locationMeta.country?.iso3 || "-" },
                  { label: "State", value: locationMeta.state?.name || "-" },
                  { label: "State Code", value: locationMeta.state?.code || "-" },
                  { label: "District", value: locationMeta.district?.name || "-" },
                  { label: "City", value: locationMeta.city?.name || "-" },
                  { label: "City Code", value: locationMeta.city?.code || "-" },
                  { label: "Branch Name", value: locationMeta.country?.name ? `${locationMeta.country.name} Main Branch` : "-" },
                  { label: "Branch Code", value: branchCode || "-" },
                  { label: "Zip / Postal Code", value: zip || "-" }
                ]
              },
              {
                title: "Step 3 - Contact & Address",
                rows: [
                  { label: "Currency", value: currency || "USD" },
                  { label: "Address", value: fullAddress || "-" },
                  { label: "Contacts", value: contactItems.length ? contactItems.join(", ") : "-" }
                ]
              },
              {
                title: "Step 4 - Roles & Permissions",
                rows: [
                  { label: "Role Template", value: permissionTemplate || "-" },
                  { label: "Permission Count", value: String(permissionGrants.length) },
                  { label: "Permissions", value: permissionGrants.length ? permissionGrants.join(", ") : "-" }
                ]
              }
            ]}
            footer={
              <div className="space-y-3">
                {editingCountryBranchId ? (
                  <BranchRecordProfile
                    title="Editing Existing Branch"
                    subtitle="Saved data, completed fields, and missing information."
                    identity={editIdentityRows}
                    sections={editProfileSections}
                  />
                ) : null}
                {hasAny ? (
                  <>
                    {existingMainBranch ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                        A main branch already exists for this country: <b>{existingMainBranch.name}</b> ({existingMainBranch.code})
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ms-3 h-7"
                          onClick={() => beginEditCountryBranch(existingMainBranch)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit Existing
                        </Button>
                      </div>
                    ) : null}

                    <details className="border-t pt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">Saved Country Main Branches</summary>
                      {!location.countryId ? (
                        <p className="mt-2 text-xs text-muted-foreground">Select a country to load saved branches.</p>
                      ) : countryBranches.length ? (
                        <div className="mt-2 space-y-2">
                          <Input
                            value={countryBranchSearch}
                            onChange={(event) => setCountryBranchSearch(event.target.value)}
                            placeholder="Search branches"
                          />
                          <ul className="space-y-2 text-xs text-muted-foreground">
                            {filteredCountryBranches.slice(0, 6).map((b) => (
                              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                                <span>
                                  <span className="font-semibold text-foreground">{b.code}</span>
                                  <span className="text-muted-foreground">{" - "}</span>
                                  <span className="text-muted-foreground">{b.name}</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => viewSavedBranch(b)}>
                                    <Eye className="h-3.5 w-3.5" aria-hidden />
                                    View
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => beginEditCountryBranch(b)}>
                                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                                    Edit
                                  </Button>
                                </div>
                              </li>
                            ))}
                            {filteredCountryBranches.length > 6 ? (
                              <li className="text-xs text-muted-foreground">+{filteredCountryBranches.length - 6} more...</li>
                            ) : null}
                          </ul>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No saved branches for this country yet.</p>
                      )}
                    </details>
                  </>
                ) : null}
              </div>
            }
          />
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerBranchData !== null}
        onClose={() => setDrawerBranchData(null)}
        title="Country Branch Details"
        subtitle="Verification certificate and branch permissions"
      >
        {drawerBranchData && (
          <BranchLiveReportPanel
            title="Saved Country Branch"
            status={drawerBranchData.branchStatus}
            branchData={drawerBranchData}
          />
        )}
      </DetailDrawer>
    </div>
  );
}






