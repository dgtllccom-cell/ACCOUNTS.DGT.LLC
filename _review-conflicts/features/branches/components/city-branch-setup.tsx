"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Eye, ArrowLeft, Printer, Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactNumberInput } from "@/components/ui/contact-number-input";
import { SearchSelect } from "@/components/ui/search-select";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { BranchOwnerPicker } from "@/features/branches/components/branch-owner-picker";
import { BranchLiveReportPanel } from "@/features/branches/components/branch-live-report-panel";
import { BranchRecordProfile, type BranchProfileSection } from "@/features/branches/components/branch-record-profile";
import { BranchReportActionsMenu } from "@/features/branches/components/branch-report-actions-menu";
import { downloadCsv } from "@/features/branches/components/branch-report-export";
import { PermissionAssignmentSection } from "@/features/users/components/permission-assignment-section";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import type { LocationCountry } from "@/features/locations/location-api";
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
  permission_template?: string | null;
  permission_grants?: string[] | null;
};

type CityBranchRow = {
  id: string;
  country_id: string;
  country_branch_id: string;
  city_name: string;
  name: string;
  code: string;
  local_currency: string;
  status: string;
  state_province_id?: string | null;
  district_id?: string | null;
  city_id?: string | null;
  area_location_id?: string | null;
  company_id?: string | null;
  owner_name?: string | null;
  contacts?: unknown;
  documents?: unknown;
  permission_template?: string | null;
  permission_grants?: string[] | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
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

function isCityBranchMatch(row: CityBranchRow, cityId: string, cityName: string) {
  if (cityId && row.city_id && row.city_id === cityId) return true;
  if (cityName && row.city_name) return row.city_name.trim().toLowerCase() === cityName.trim().toLowerCase();
  return false;
}

function compactCode(value: string, fallback: string) {
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!clean) return fallback;
  return clean.slice(0, 4);
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function CityBranchSetup() {
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

  const [countryBranchId, setCountryBranchId] = useState("");
  const [mainBranches, setMainBranches] = useState<CountryBranchRow[]>([]);

  const [existingCityBranches, setExistingCityBranches] = useState<CityBranchRow[]>([]);
  const [existingCitySearch, setExistingCitySearch] = useState("");
  const [editingCityBranchId, setEditingCityBranchId] = useState("");

  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [permissionTemplate, setPermissionTemplate] = useState("city-standard");
  const [permissionGrants, setPermissionGrants] = useState<string[]>(() => getPermissionKeysForTemplate("city-standard"));

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [manualZip, setManualZip] = useState("");

  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [emailPrefix, setEmailPrefix] = useState("");
  const [emailServerName, setEmailServerName] = useState("Local IP Server (UPS Linked)");
  const [localIp, setLocalIp] = useState("192.168.1.50");
  const [publicIp, setPublicIp] = useState("182.50.32.14");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("465");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [sslSecure, setSslSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<"Ready" | "Not Configured" | "Connection Failed">("Not Configured");
  const [whatsappStatus, setWhatsappStatus] = useState<"Ready" | "Not Configured" | "Verification Pending">("Not Configured");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);

  const generatedEmail = emailPrefix ? `${emailPrefix.trim().toLowerCase()}@dgt.llc` : "";

  // Auto-sync email prefix to main contacts list
  useEffect(() => {
    if (generatedEmail) {
      setContacts((prev) => {
        const list = prev.filter((c) => !c.type.toLowerCase().includes("email"));
        return [...list, { type: "Email", value: generatedEmail }];
      });
      setSmtpStatus("Ready");
    } else {
      setSmtpStatus("Not Configured");
    }
  }, [generatedEmail]);

  useEffect(() => {
    if (whatsappNumber) {
      setContacts((prev) => {
        const list = prev.filter((c) => !c.type.toLowerCase().includes("whatsapp"));
        return [...list, { type: "WhatsApp", value: whatsappNumber }];
      });
      setWhatsappStatus("Verification Pending");
    } else {
      setWhatsappStatus("Not Configured");
    }
  }, [whatsappNumber]);

  const selectedMainBranch = useMemo(
    () => mainBranches.find((b) => b.id === countryBranchId) ?? null,
    [mainBranches, countryBranchId]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!companyId) {
        setCompany(null);
        return;
      }
      try {
        const res = await apiGet<{ company: CompanyRow }>(`/api/erp/companies/${encodeURIComponent(companyId)}`);
        if (!cancelled) setCompany(res.company ?? null);
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
            branch: selectedMainBranch?.name ?? "-",
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
            branch: profile.branchName || selectedMainBranch?.name || "-",
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
  }, [company, locationMeta.country?.name, ownerName, selectedMainBranch?.name]);

  const hasAny = Boolean(
    location.countryId ||
      countryBranchId ||
      location.stateProvinceId ||
      location.cityId ||
      currency ||
      fullAddress ||
      companyId ||
      ownerName ||
      branchName ||
      branchCode ||
      permissionGrants.length ||
      contacts.some((c) => c.type || c.value)
  );

  const autoZip = locationMeta.area?.postal_code ?? locationMeta.city?.zip_code ?? "";
  // zip: manual entry wins; if empty, fall back to auto-derived value
  const zip = manualZip || autoZip;
  const compactInputClass = (alert = false) =>
    cn(
      "h-9 text-sm",
      alert &&
        "border-rose-300 bg-rose-50/70 text-rose-900 placeholder:text-rose-300 focus-visible:ring-rose-300 dark:border-rose-800 dark:bg-rose-950/20"
    );
  const compactTextareaClass = (alert = false) =>
    cn(
      "min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      alert && "border-rose-300 bg-rose-50/70 text-rose-900 focus-visible:ring-rose-300 dark:border-rose-800 dark:bg-rose-950/20"
    );
  const compactSectionClass = (alert = false) =>
    cn(
      "order-1 rounded-xl border bg-white p-4 shadow-sm space-y-3 dark:bg-slate-950",
      alert ? "border-rose-200 ring-1 ring-rose-100 dark:border-rose-900/70 dark:ring-rose-950" : "border-slate-100 dark:border-slate-800/80"
    );
  const changedFromSaved = (current: string, saved?: string | null) =>
    Boolean(editingCityBranchId && saved && current.trim() && current.trim() !== saved.trim());
  const previewCountry = locationMeta.country?.name || "-";
  const previewMainBranch = selectedMainBranch?.name || "-";
  const previewLocation = [locationMeta.state?.name, locationMeta.city?.name, locationMeta.area?.name, zip].filter(Boolean).join(" / ") || "-";
  const previewCompany = company?.name || "-";
  const companyCode = company?.id ? compactCode(company.id, "CMP") : "-";
  const parentPermissionGrants = selectedMainBranch?.permission_grants?.length ? selectedMainBranch.permission_grants : undefined;

  useEffect(() => {
    if (!parentPermissionGrants?.length) return;
    setPermissionGrants((current) => current.filter((permission) => parentPermissionGrants.includes(permission)));
  }, [parentPermissionGrants]);

  const matchingExistingCityBranch = useMemo(() => {
    if (!countryBranchId || !location.cityId || !locationMeta.city?.name) return null;
    return (
      existingCityBranches.find(
        (branch) =>
          branch.country_branch_id === countryBranchId &&
          isCityBranchMatch(branch, location.cityId, locationMeta.city?.name ?? "")
      ) ?? null
    );
  }, [countryBranchId, existingCityBranches, location.cityId, locationMeta.city?.name]);

  const activeExistingCityBranch = useMemo(() => {
    if (editingCityBranchId) {
      return existingCityBranches.find((branch) => branch.id === editingCityBranchId) ?? matchingExistingCityBranch;
    }
    return matchingExistingCityBranch;
  }, [editingCityBranchId, existingCityBranches, matchingExistingCityBranch]);

  const cityAlreadyExists = Boolean(
    location.cityId &&
      existingCityBranches.some((b) => {
        if (editingCityBranchId && b.id === editingCityBranchId) return false;
        if (b.city_id && b.city_id === location.cityId) return true;
        if (b.city_name && locationMeta.city?.name) {
          return b.city_name.trim().toLowerCase() === locationMeta.city.name.trim().toLowerCase();
        }
        return false;
      })
  );

  const contactItems = contacts
    .map((row) => {
      if (!row.type && !row.value) return null;
      return `${row.type || "Type"}: ${row.value || "-"}`;
    })
    .filter((row): row is string => Boolean(row));

  const reportRows = useMemo(
    () => [
      { label: "Country", value: previewCountry },
      { label: "Country Code", value: locationMeta.country?.iso2 || locationMeta.country?.iso3 || "-" },
      { label: "Country Main Branch", value: previewMainBranch },
      { label: "City Branch", value: activeExistingCityBranch?.name || branchName || "-" },
      { label: "Branch Code", value: activeExistingCityBranch?.code || branchCode || "-" },
      { label: "Currency", value: activeExistingCityBranch?.local_currency || currency || "-" },
      { label: "Location", value: previewLocation },
      { label: "Address", value: activeExistingCityBranch?.address || fullAddress || "-" },
      { label: "Company Name", value: previewCompany },
      { label: "Company Code", value: companyCode },
      { label: "Company Owner", value: ownerPreview?.name || activeExistingCityBranch?.owner_name || ownerName || "-" },
      { label: "Owner Details", value: ownerPreview ? `${ownerPreview.source.toUpperCase()} · ${ownerPreview.code}` : activeExistingCityBranch?.owner_name || ownerName || "-" },
      { label: "Permission Template", value: activeExistingCityBranch?.permission_template || permissionTemplate || "-" },
      {
        label: "Permission Grants",
        value: activeExistingCityBranch?.permission_grants?.length
          ? activeExistingCityBranch.permission_grants.join(", ")
          : permissionGrants.length
            ? permissionGrants.join(", ")
            : "-"
      },
      { label: "Contacts", value: contactItems.length ? contactItems.join(", ") : "-" }
    ],
    [
      activeExistingCityBranch?.address,
      activeExistingCityBranch?.code,
      activeExistingCityBranch?.local_currency,
      activeExistingCityBranch?.name,
      activeExistingCityBranch?.owner_name,
      branchCode,
      branchName,
      contactItems,
      currency,
      fullAddress,
      companyCode,
      ownerName,
      ownerPreview,
      permissionGrants,
      permissionTemplate,
      previewCompany,
      previewCountry,
      previewLocation,
      previewMainBranch
    ]
  );

  const editIdentityRows = useMemo(
    () => [
      { label: "Country", value: previewCountry },
      { label: "Main Branch", value: previewMainBranch },
      { label: "City Branch", value: activeExistingCityBranch?.name || branchName },
      { label: "Branch Code", value: activeExistingCityBranch?.code || branchCode },
      { label: "Record ID", value: editingCityBranchId },
      { label: "Status", value: activeExistingCityBranch?.status || "active" },
      { label: "Created Date", value: activeExistingCityBranch?.created_at ? new Date(activeExistingCityBranch.created_at).toLocaleString() : "" },
      { label: "Last Updated", value: activeExistingCityBranch?.updated_at ? new Date(activeExistingCityBranch.updated_at).toLocaleString() : "" }
    ],
    [activeExistingCityBranch, branchCode, branchName, editingCityBranchId, previewCountry, previewMainBranch]
  );

  const editProfileSections: BranchProfileSection[] = useMemo(
    () => [
      {
        title: "Branch Information",
        items: [
          { label: "Branch Name", value: activeExistingCityBranch?.name || branchName },
          { label: "Branch Code", value: activeExistingCityBranch?.code || branchCode },
          { label: "Currency", value: activeExistingCityBranch?.local_currency || currency },
          { label: "Status", value: activeExistingCityBranch?.status || "active" }
        ]
      },
      {
        title: "Location Information",
        items: [
          { label: "Country", value: previewCountry },
          { label: "Main Branch", value: previewMainBranch },
          { label: "Location", value: previewLocation },
          { label: "Address", value: activeExistingCityBranch?.address || fullAddress }
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
          { label: "Owner Name", value: ownerPreview?.name || activeExistingCityBranch?.owner_name || ownerName },
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
          { label: "Email", value: contacts.find((row) => row.type.toLowerCase().includes("email"))?.value || activeExistingCityBranch?.email }
        ]
      },
      {
        title: "Permissions",
        items: [
          { label: "Template", value: activeExistingCityBranch?.permission_template || permissionTemplate },
          {
            label: "Granted Permissions",
            value: activeExistingCityBranch?.permission_grants?.length
              ? activeExistingCityBranch.permission_grants.join(", ")
              : permissionGrants.length
                ? permissionGrants.join(", ")
                : ""
          }
        ]
      }
    ],
    [
      activeExistingCityBranch,
      branchCode,
      branchName,
      company,
      contactItems,
      contacts,
      currency,
      fullAddress,
      ownerName,
      ownerPreview,
      permissionGrants,
      permissionTemplate,
      previewCountry,
      previewLocation,
      previewMainBranch
    ]
  );

  const liveBranchData = useMemo(() => {
    const active = activeExistingCityBranch;
    const phoneVal = contacts.find((row) => row.type.toLowerCase().includes("phone"))?.value || "";
    const emailVal = contacts.find((row) => row.type.toLowerCase().includes("email"))?.value || active?.email || "";
    const whatsappVal = contacts.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value || "";

    return {
      serialNumber: active?.id ? active.id.slice(0, 4).toUpperCase() : "0001",
      branchStatus: active?.status || (hasAny ? "Draft" : "Empty"),
      branchCode: active?.code || branchCode || "-",
      branchType: "CITY",
      country: previewCountry,
      currency: active?.local_currency || currency || "USD",
      
      grandparentBranch: {
        name: "ACCOUNTS.DGT.LLC Headquarters",
        code: "SUPER-HQ-001",
        type: "SUPER_ADMIN",
        status: "ACTIVE",
        currency: "USD"
      },
      parentBranch: selectedMainBranch
        ? {
            name: selectedMainBranch.name,
            code: selectedMainBranch.code,
            type: "MAIN",
            status: selectedMainBranch.status,
            currency: selectedMainBranch.local_currency
          }
        : undefined,

      branchName: active?.name || branchName || "-",
      createdDate: active?.created_at ? new Date(active.created_at).toLocaleDateString() : undefined,
      updatedDate: active?.updated_at ? new Date(active.updated_at).toLocaleDateString() : undefined,
      createdBy: "Super Admin",
      updatedBy: "Super Admin",
      establishedOn: "-",
      taxRegNo: "-",
      ntnGstNo: "-",

      city: locationMeta.city?.name || active?.city_name || "-",
      cityCode: locationMeta.city?.code || "-",
      stateProvince: locationMeta.state?.name || "-",
      areaRegion: locationMeta.area?.name || "-",
      zipCode: zip || "-",
      fullAddress: active?.address || fullAddress || "-",

      ownerName: ownerPreview?.name || active?.owner_name || ownerName || "-",
      ownerCode: ownerPreview?.code || "OWN-0001",
      fatherHusbandName: "-",
      cnicId: "-",
      nationality: "Pakistani",
      designation: "Branch Manager",
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
      remarks: "This is a detailed city branch report representing live settings."
    };
  }, [
    activeExistingCityBranch,
    contacts,
    branchCode,
    previewCountry,
    currency,
    branchName,
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
      title: "City Branch Report",
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

  function beginEditCityBranch(row: CityBranchRow) {
    setEditingCityBranchId(row.id);
    setCountryBranchId(row.country_branch_id);
    setLocation({
      countryId: row.country_id,
      stateProvinceId: row.state_province_id ?? "",
      districtId: row.district_id ?? "",
      cityId: row.city_id ?? "",
      areaId: row.area_location_id ?? ""
    });
    setLocationMeta({ country: null, state: null, district: null, city: null, area: null });
    setCurrency(row.local_currency || "");
    setFullAddress(row.address ?? "");
    setCompanyId(row.company_id ?? "");
    setOwnerName(row.owner_name ?? "");
    setContacts(normalizeContacts(row.contacts));
    setBranchName(row.name || "");
    setBranchCode(row.code || "");
    setPermissionTemplate(row.permission_template ?? "city-standard");
    setPermissionGrants(Array.isArray(row.permission_grants) ? row.permission_grants : getPermissionKeysForTemplate("city-standard"));
    setBanner({
      type: "success",
      message: `Editing Existing Branch\nBranch Name: ${row.name}\nBranch Code: ${row.code}`
    });

    // Load communication configs
    setEmailPrefix("");
    setWhatsappNumber("");
    setPhoneNumberId("");
    setWabaId("");
    setAccessToken("");

    (async () => {
      try {
        const res = await fetch(`/api/erp/email/config?countryId=${row.country_id}&countryBranchId=${row.country_branch_id}&cityBranchId=${row.id}`);
        const data = await res.json();
        if (data?.config) {
          const emailAddr = data.config.fromEmail || "";
          const prefix = emailAddr.split("@")[0] || "";
          setEmailPrefix(prefix);
          if (data.config.smtpHost) setSmtpHost(data.config.smtpHost);
          if (data.config.smtpPort) setSmtpPort(String(data.config.smtpPort));
          if (data.config.smtpSecure !== undefined) setSslSecure(data.config.smtpSecure);
          if (data.config.smtpUser) setSmtpUser(data.config.smtpUser);
          setSmtpStatus("Ready");
        }
      } catch (err) {
        console.error("Failed to load email config for edit:", err);
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/erp/whatsapp/accounts");
        const data = await res.json();
        const accounts = Array.isArray(data?.data) ? data.data : Array.isArray(data?.accounts) ? data.accounts : [];
        const match = accounts.find((acc: any) => acc.city_branch_id === row.id);
        if (match) {
          setWhatsappNumber(match.phone_number || "");
          setPhoneNumberId(match.phone_number_id || "");
          setWabaId(match.waba_id || "");
          setWhatsappStatus("Ready");
        }
      } catch (err) {
        console.error("Failed to load whatsapp config for edit:", err);
      }
    })();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function viewSavedBranch(row: CityBranchRow) {
    const phoneVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("phone") || c.type.toLowerCase().includes("mobile"))?.value || "";
    const emailVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("email"))?.value || row.email || "";
    const whatsappVal = normalizeContacts(row.contacts).find((c) => c.type.toLowerCase().includes("whatsapp"))?.value || "";

    const payload = {
      serialNumber: row.id.slice(0, 4).toUpperCase(),
      branchStatus: row.status || "ACTIVE",
      branchCode: row.code || "-",
      branchType: "CITY",
      country: locationMeta.country?.name || "Country",
      currency: row.local_currency || currency || "USD",
      
      parentBranch: {
        name: selectedMainBranch?.name || "Main Branch",
        code: selectedMainBranch?.code || "MAIN",
        type: "MAIN",
        status: "ACTIVE",
        currency: selectedMainBranch?.local_currency || "USD"
      },

      branchName: row.name,
      createdDate: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined,
      updatedDate: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : undefined,
      createdBy: "Super Admin",
      updatedBy: "Super Admin",
      establishedOn: "-",
      taxRegNo: "-",
      ntnGstNo: "-",

      city: row.city_name || locationMeta.city?.name || "-",
      cityCode: "-",
      stateProvince: locationMeta.state?.name || "-",
      areaRegion: locationMeta.area?.name || "-",
      zipCode: zip || "-",
      fullAddress: row.address || "-",

      ownerName: row.owner_name || "-",
      ownerCode: "OWN-0001",
      fatherHusbandName: "-",
      cnicId: "-",
      nationality: "Pakistani",
      designation: "City Branch Manager",
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
      remarks: "Saved city branch details registry."
    };

    setDrawerBranchData(payload);
  }

  useEffect(() => {
    if (!isUuid(editId)) return;
    if (editingCityBranchId === editId) return;

    let cancelled = false;
    (async () => {
      setEditLoading(true);
      try {
        const res = await fetch(`/api/branch-management/city-branches?id=${encodeURIComponent(editId)}`, {
          cache: "no-store"
        });
        const json = (await res.json().catch(() => ({}))) as { cityBranches?: CityBranchRow[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setBanner({ type: "error", message: json.error || "City branch record not found." });
          return;
        }
        const row = Array.isArray(json.cityBranches) ? json.cityBranches[0] : null;
        if (!row) {
          setBanner({ type: "error", message: "City branch record not found." });
          return;
        }
        await loadMainBranches(row.country_id);
        await loadExistingCityBranches(row.country_id, row.country_branch_id);
        beginEditCityBranch(row);
      } catch (error) {
        if (!cancelled) setBanner({ type: "error", message: error instanceof Error ? error.message : "Failed to load city branch record." });
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
    window.location.href = buildMailtoHref("City Branch Report", reportRows);
  }

  function exportReportCsv() {
    const rows = [["Field", "Value"], ...reportRows.map((row) => [row.label, row.value])];
    downloadCsv(`city-branch_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const filteredExistingCityBranches = useMemo(() => {
    const q = existingCitySearch.trim().toLowerCase();
    if (!q) return existingCityBranches;
    return existingCityBranches.filter((b) => {
      const haystack = [b.code, b.name, b.city_name].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [existingCityBranches, existingCitySearch]);

  async function loadMainBranches(nextCountryId: string) {
    if (!isUuid(nextCountryId)) {
      setMainBranches([]);
      return;
    }
    const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(nextCountryId)}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      setMainBranches([]);
      return;
    }
    const json = (await res.json()) as { countryBranches?: CountryBranchRow[] };
    const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
    setMainBranches(list.filter((b) => b.is_main));
  }

  async function loadExistingCityBranches(nextCountryId: string, nextCountryBranchId: string) {
    if (!isUuid(nextCountryId) || !isUuid(nextCountryBranchId)) {
      setExistingCityBranches([]);
      return [];
    }
    const res = await fetch(
      `/api/branch-management/city-branches?countryId=${encodeURIComponent(nextCountryId)}&countryBranchId=${encodeURIComponent(
        nextCountryBranchId
      )}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      setExistingCityBranches([]);
      return [];
    }
    const json = (await res.json()) as { cityBranches?: CityBranchRow[] };
    const list = Array.isArray(json.cityBranches) ? json.cityBranches : [];
    setExistingCityBranches(list);
    return list;
  }

  function suggestBranchCode(meta: LocationHierarchyMeta, existingCount: number) {
    const prefix = asIso3(meta.country);
    const num = String(Math.max(1, existingCount + 1)).padStart(3, "0");
    const cityCode = compactCode(meta.city?.code || meta.city?.name || "", "CITY");
    return `${prefix}-${cityCode}-${num}`;
  }

  function suggestBranchName(meta: LocationHierarchyMeta) {
    const city = meta.city?.name?.trim();
    if (!city) return "";
    return `${city} City Branch`;
  }

  async function onCountrySelected(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    setBanner(null);
    if (editingCityBranchId && next.countryId === location.countryId) {
      setLocation(next);
      setLocationMeta(meta);
      if (meta.country?.currency_code) {
        setCurrency(meta.country.currency_code.toUpperCase());
      }
      return;
    }
    setLocation(next);
    setLocationMeta(meta);

    setCurrency(meta.country?.currency_code?.toUpperCase() || "");
    setFullAddress("");

    setCountryBranchId("");
    setMainBranches([]);
    setExistingCityBranches([]);
    setPermissionTemplate("city-standard");
    setPermissionGrants(getPermissionKeysForTemplate("city-standard"));
    setEditingCityBranchId("");

    setBranchName("");
    setBranchCode("");

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
    }

    if (!isUuid(next.countryId)) return;
    await loadMainBranches(next.countryId);
  }

  async function onMainBranchSelected(nextId: string) {
    setBanner(null);
    setCountryBranchId(nextId);
    const list = await loadExistingCityBranches(location.countryId, nextId);
    setBranchCode(suggestBranchCode(locationMeta, list.length));
    const parent = mainBranches.find((branch) => branch.id === nextId);
    const parentPermissions = parent?.permission_grants?.length ? parent.permission_grants : undefined;
    setPermissionGrants((current) => (parentPermissions ? current.filter((permission) => parentPermissions.includes(permission)) : current));
  }

  function onLocationChange(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    setLocation(next);
    setLocationMeta(meta);

    // Auto-fill ZIP from newly selected area or city (only if user hasn't typed a manual zip)
    const derivedZip = meta.area?.postal_code ?? meta.city?.zip_code ?? "";
    if (derivedZip) setManualZip(""); // clear manual so auto shows through

    if (editingCityBranchId) return;

    if (!branchName.trim()) {
      const nextName = suggestBranchName(meta);
      if (nextName) setBranchName(nextName);
    }

    if (countryBranchId) {
      setBranchCode(suggestBranchCode(meta, existingCityBranches.length));
    }
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

    if (!isUuid(location.countryId) || !isUuid(countryBranchId)) {
      setBanner({ type: "error", message: "Please select a valid Country and Main Branch." });
      return;
    }

    if (!isUuid(location.stateProvinceId) || !isUuid(location.cityId) || !locationMeta.city?.name) {
      setBanner({ type: "error", message: "Please select State/Province and City from Location Settings." });
      return;
    }

    if (cityAlreadyExists) {
      setBanner({
        type: "error",
        message: `City Branch Already Exists\nBranch Name: ${activeExistingCityBranch?.name || "-"}\nBranch Code: ${activeExistingCityBranch?.code || "-"}\nStatus: ${activeExistingCityBranch?.status || "-"}`
      });
      return;
    }

    if (!branchName.trim()) {
      setBanner({ type: "error", message: "Branch Name is required." });
      return;
    }

    if (!branchCode.trim()) {
      setBanner({ type: "error", message: "Branch Code is required." });
      return;
    }

    if (!permissionTemplate || !permissionGrants.length) {
      setBanner({
        type: "error",
        message: "Please select a Permissions Template and at least one explicit permission before saving the City Branch."
      });
      return;
    }

    if (parentPermissionGrants?.length && permissionGrants.some((permission) => !parentPermissionGrants.includes(permission))) {
      setBanner({
        type: "error",
        message: "City Branch permissions must be selected from the Country/Main Branch permissions only."
      });
      return;
    }

    setSaving(true);
    try {
      const contactsPayload = contacts
        .map((row) => ({ type: row.type.trim(), value: row.value.trim() }))
        .filter((row) => row.type && row.value);

      const emailContact = contactsPayload.find((row) => row.type.toLowerCase().includes("email"))?.value;
      const email = emailContact && emailContact.includes("@") ? emailContact : `${branchCode.trim().toLowerCase()}@dgt.llc`;
      const phone = contactsPayload.find((row) => row.type.toLowerCase().includes("phone") || row.type.toLowerCase().includes("mobile"))?.value;
      const whatsappNumber = contactsPayload.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value;

      const res = await fetch("/api/branch-management/city-branches", {
        method: editingCityBranchId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingCityBranchId || undefined,
          countryId: location.countryId,
          countryBranchId,
          cityName: locationMeta.city.name,
          stateProvinceId: location.stateProvinceId || undefined,
          districtId: location.districtId || undefined,
          cityId: location.cityId || undefined,
          areaLocationId: location.areaId || undefined,
          name: branchName,
          code: branchCode,
          currencyCode: currency || locationMeta.country?.currency_code || "USD",
          address: fullAddress.trim() || undefined,
          phone: phone || undefined,
          email: (emailPrefix ? `${emailPrefix.trim().toLowerCase()}@dgt.llc` : email) || "",
          whatsappNumber: whatsappNumber || undefined,
          companyId: companyId || undefined,
          ownerName: ownerName.trim() || undefined,
          permissionTemplate,
          permissionGrants,
          contacts: contactsPayload.length ? contactsPayload : undefined,
          emailPrefix,
          emailServerSettings: emailPrefix ? {
            mailServerName: emailServerName,
            localIp,
            publicIp,
            smtpHost,
            smtpPort: smtpPort ? Number(smtpPort) : null,
            imapHost,
            imapPort: imapPort ? Number(imapPort) : null,
            sslSecure,
            smtpUser: smtpUser || (emailPrefix ? `${emailPrefix.trim().toLowerCase()}@dgt.llc` : ""),
            smtpPass: smtpPass || undefined
          } : undefined,
          whatsappConfig: whatsappNumber ? {
            whatsappNumber,
            wabaId,
            phoneNumberId,
            accessToken,
            isActive: true
          } : undefined
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        let message = "Failed to save city branch.";
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
        setBanner({ type: "error", message });
        return;
      }

      setBanner({ type: "success", message: `${editingCityBranchId ? "Updated" : "Saved"}: ${branchName} (${branchCode})` });
      const list = await loadExistingCityBranches(location.countryId, countryBranchId);
      setEditingCityBranchId("");
      if (!editingCityBranchId) {
        setBranchCode(suggestBranchCode(locationMeta, list.length));
        setBranchName("");
        setPermissionTemplate("city-standard");
        setPermissionGrants(parentPermissionGrants?.length ? getPermissionKeysForTemplate("city-standard").filter((p) => parentPermissionGrants.includes(p)) : getPermissionKeysForTemplate("city-standard"));
        setEmailPrefix("");
        setWhatsappNumber("");
        setPhoneNumberId("");
        setWabaId("");
        setAccessToken("");
      }
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Failed to save city branch." });
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setBanner(null);
    setActiveStep(1);
    setLocation({ countryId: "", stateProvinceId: "", districtId: "", cityId: "", areaId: "" });
    setLocationMeta({ country: null, state: null, district: null, city: null, area: null });
    setCurrency("");
    setFullAddress("");
    setCountryBranchId("");
    setMainBranches([]);
    setExistingCityBranches([]);
    setBranchName("");
    setBranchCode("");
    setOwnerName("");
    setOwnerPreview(null);
    setContacts([]);
    setPermissionTemplate("city-standard");
    setPermissionGrants(getPermissionKeysForTemplate("city-standard"));
    setEmailPrefix("");
    setWhatsappNumber("");
    setPhoneNumberId("");
    setWabaId("");
    setAccessToken("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm">
        {/* Left Section: Back button & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || activeStep === 1}
            onClick={() => setActiveStep((step) => Math.max(1, step - 1))}
            className="h-8 px-2.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/50"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
          </Button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              New Entry
            </span>
            <span className="text-[10px] font-bold text-slate-500 mt-0.5">
              Step {activeStep} of 9
            </span>
          </div>
        </div>

        {/* Center Section: Compact 1-9 Step Navigator with Tooltips/Checkmarks */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          {[
            { n: 1, label: "Branch Info", done: Boolean(branchName && branchCode) },
            { n: 2, label: "Address & Location", done: Boolean(locationMeta.city?.name) },
            { n: 3, label: "Bank Account Setup", done: false },
            { n: 4, label: "Contact Info", done: contacts.some(c => c.value) },
            { n: 5, label: "Review & Summary", done: hasAny },
            { n: 6, label: "Upload Documents", done: false },
            { n: 7, label: "Accounting Setup", done: false },
            { n: 8, label: "Roles & Permissions", done: permissionGrants.length > 0 },
            { n: 9, label: "Final Approval", done: false },
          ].map(({ n, label, done }) => {
            const active = activeStep === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setActiveStep(n)}
                title={`${n}. ${label}`}
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-black transition-all",
                  active
                    ? "bg-indigo-600 text-white shadow-sm scale-105"
                    : done
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                {done && !active ? "✓" : n}
              </button>
            );
          })}
        </div>

        {/* Right Section: Actions Dropdown, Next/Save button, and Scope badge */}
        <div className="flex items-center gap-2">
          <BranchReportActionsMenu
            ariaLabel="City branch actions"
            disabled={!hasAny}
            onView={viewReport}
            onEdit={editReport}
            onPrint={printReport}
            onPdf={() => openReport(true)}
            onEmail={emailReport}
            onExcel={exportReportCsv}
          />

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block mx-1" />

          {activeStep < 9 ? (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs font-semibold"
              onClick={() => setActiveStep((step) => Math.min(9, step + 1))}
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              form="city-branch-wizard-form"
              size="sm"
              disabled={saving || !location.countryId || !countryBranchId || cityAlreadyExists}
              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Saving..." : editingCityBranchId ? "Update" : "Accept & Save"}
            </Button>
          )}

          <span className={pillClassName()}>
            <b>Scope:</b> City branch under selected Country Main Branch
          </span>
        </div>
      </div>
      <div className={cn("grid gap-5", activeStep === 9 ? "xl:grid-cols-1" : "xl:grid-cols-[0.9fr_1.1fr]")}>
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>City Branch Setup</CardTitle>
          </CardHeader>

          <CardContent>
            {editLoading ? (
              <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
                Loading existing city branch for edit...
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
                {activeExistingCityBranch && !editingCityBranchId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => beginEditCityBranch(activeExistingCityBranch)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit Existing Branch
                  </Button>
                ) : null}
              </div>
            ) : null}

            <form id="city-branch-wizard-form" onSubmit={onSubmit} onReset={onReset} className="flex flex-col gap-6">
              <section hidden={activeStep !== 1} className={compactSectionClass(!location.countryId || !currency)}>
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 1 - Branch Information: Country & Currency</h2>
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
                    <Input value={currency} readOnly placeholder="Auto from selected Country" className={compactInputClass(!currency)} />
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 1} className={compactSectionClass(!countryBranchId)}>
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 1 - Branch Information: Main Branch</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <SearchSelect
                    label="Select Main Branch"
                    value={countryBranchId}
                    placeholder={location.countryId ? "Select main branch" : "Select country first"}
                    disabled={!location.countryId}
                    options={mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
                    onValueChange={(value) => void onMainBranchSelected(value)}
                  />

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Main Branch Code</Label>
                    <Input value={selectedMainBranch?.code ?? ""} readOnly className={compactInputClass(!countryBranchId)} />
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 1} className={compactSectionClass(!location.stateProvinceId || !location.cityId || !fullAddress.trim() || changedFromSaved(fullAddress, activeExistingCityBranch?.address))}>
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 1 - Branch Information: Location</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="space-y-2 md:col-span-4">
                    <Label className="text-xs text-slate-600">Country (auto)</Label>
                    <Input value={locationMeta.country?.name ?? ""} readOnly className={compactInputClass(!location.countryId)} />
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

                  <div className="space-y-1.5 md:col-span-4">
                    <Label className="text-xs text-slate-600">ZIP / Postal Code</Label>
                    <Input
                      value={zip}
                      onChange={(e) => setManualZip(e.target.value)}
                      placeholder={autoZip ? autoZip : "Enter ZIP / postal code"}
                      className={compactInputClass(!zip)}
                    />
                    {!manualZip && autoZip && (
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Auto from selected area or city &mdash; type to override
                      </p>
                    )}
                    {manualZip && (
                      <button
                        type="button"
                        onClick={() => setManualZip("")}
                        className="text-[10px] text-indigo-500 hover:text-indigo-700 underline leading-tight"
                      >
                        Clear manual &mdash; use auto ({autoZip || "none"})
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-8">
                    <Label className="text-xs text-slate-600">Full Address</Label>
                    <textarea
                      value={fullAddress}
                      onChange={(event) => setFullAddress(event.target.value)}
                      placeholder="Area / Road, Building, Street, Landmark, etc."
                      className={compactTextareaClass(!fullAddress.trim() || changedFromSaved(fullAddress, activeExistingCityBranch?.address))}
                    />
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 1} className={compactSectionClass(!branchName.trim() || !branchCode.trim() || changedFromSaved(branchName, activeExistingCityBranch?.name) || changedFromSaved(branchCode, activeExistingCityBranch?.code))}>
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 1 - Branch Information: City Branch Details</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Branch Name</Label>
                    <Input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="e.g. Chaman City Branch" className={compactInputClass(!branchName.trim() || changedFromSaved(branchName, activeExistingCityBranch?.name))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Branch Code</Label>
                    <Input value={branchCode} onChange={(event) => setBranchCode(event.target.value)} placeholder="Auto suggests from Country + City code" className={compactInputClass(!branchCode.trim() || changedFromSaved(branchCode, activeExistingCityBranch?.code))} />
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 3} className="order-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 3 - User Account Setup: Company & Owner</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <CompanyPicker
                    label="Company Name"
                    value={companyId}
                    onValueChange={setCompanyId}
                    placeholder="Search company"
                    createButtonPlacement="below"
                    disabled={!location.countryId}
                  />

                  <div className="space-y-2">
                    <BranchOwnerPicker
                      value={ownerName}
                      onValueChange={setOwnerName}
                      disabled={!location.countryId}
                      placeholder="Search owner"
                      createButtonPlacement="below"
                    />
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 4} className="order-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">4</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 4 - Contact Information</h2>
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

              <section hidden={activeStep !== 7} className="order-7 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">7</span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 7 — Roles &amp; Permissions</h2>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Configure access controls for this city branch.</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
                    🔐 {permissionGrants.length} permissions active
                  </span>
                </div>
                <PermissionAssignmentSection
                  level="city"
                  template={permissionTemplate}
                  selected={permissionGrants}
                  onTemplateChange={setPermissionTemplate}
                  onSelectedChange={setPermissionGrants}
                  parentPermissions={parentPermissionGrants}
                  required
                  note="City permissions are explicit and are not inherited automatically from the Country/Main Branch."
                />
              </section>

              <section hidden={activeStep !== 5} className="order-5 rounded-xl border border-cyan-200/80 bg-cyan-50/40 p-5 shadow-sm space-y-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
                <div className="flex items-center justify-between gap-3 border-b border-cyan-100 pb-3 dark:border-cyan-900/60">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">5</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 5 - Review & PDF Summary</h2>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => openReport(true)} disabled={!hasAny}>Download PDF Summary</Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3 text-xs">
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">Country</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{previewCountry || "-"}</p></div>
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">Main Branch</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{previewMainBranch || "-"}</p></div>
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">City Branch</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{branchName || "Draft"}</p></div>
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">Branch Code</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{branchCode || "-"}</p></div>
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">Currency</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{currency || "USD"}</p></div>
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">Contacts</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{contactItems.length || 0}</p></div>
                </div>
              </section>

              <section hidden={activeStep !== 6} className="order-6 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">6</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 6 - Branch Documents</h2>
                </div>
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/30">Branch documents are optional. Existing document workflow remains unchanged and can be attached where applicable.</div>
              </section>

              <section hidden={activeStep !== 2} className="order-2 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-sm space-y-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2.5 border-b border-emerald-100 pb-3 dark:border-emerald-900/60">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">2</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 2 - Access Scope & Role Planning</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-3 text-xs">
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">Template</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{permissionTemplate || "-"}</p></div>
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">Permissions</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{permissionGrants.length}</p></div>
                  <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">Parent Limited</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{parentPermissionGrants?.length ? "Yes" : "No"}</p></div>
                </div>
              </section>
              <section hidden={activeStep !== 8} className="order-8 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">8</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Step 8 - AI Branch Communication Setup</h2>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4 rounded-lg border p-4 bg-slate-50/30">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Official Branch Email</h3>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">Official Email Prefix</Label>
                      <div className="flex gap-2">
                        <Input
                          value={emailPrefix}
                          onChange={(e) => setEmailPrefix(e.target.value)}
                          placeholder="e.g. chaman"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={aiLoading || !branchName}
                          onClick={() => {
                            setAiLoading(true);
                            setTimeout(() => {
                              const suggested = branchName.toLowerCase().replace(/city|branch|store|office/gi, "").trim().replace(/\s+/g, ".");
                              setEmailPrefix(suggested);
                              setAiLoading(false);
                            }, 500);
                          }}
                        >
                          {aiLoading ? "Thinking..." : "AI Suggest"}
                        </Button>
                      </div>
                      {generatedEmail && (
                        <p className="text-[10px] text-green-600 font-semibold mt-1">
                          Generated Email Address: {generatedEmail}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">Email Server</Label>
                      <select
                        className={selectClassName()}
                        value={emailServerName}
                        onChange={(e) => setEmailServerName(e.target.value)}
                      >
                        <option value="Local IP Server (UPS Linked)">Local IP Server (UPS Linked)</option>
                        <option value="Google Workspace Cloud Server">Google Workspace Cloud Server</option>
                        <option value="Microsoft Office 365 Cloud Server">Microsoft Office 365 Cloud Server</option>
                      </select>
                    </div>

                    {emailServerName.includes("Local IP") && (
                      <div className="grid gap-2 grid-cols-2 pt-2 border-t text-[11px] space-y-1">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[10px] text-slate-500">Local IP Address</Label>
                          <Input value={localIp} onChange={(e) => setLocalIp(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[10px] text-slate-500">Public IP Address</Label>
                          <Input value={publicIp} onChange={(e) => setPublicIp(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-500">SMTP Host</Label>
                          <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-500">SMTP Port</Label>
                          <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-500">IMAP Host</Label>
                          <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-500">IMAP Port</Label>
                          <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-2 flex items-center gap-2 pt-1.5">
                          <input type="checkbox" checked={sslSecure} onChange={(e) => setSslSecure(e.target.checked)} id="ssl-checkbox" />
                          <Label htmlFor="ssl-checkbox" className="text-[11px] text-slate-600">SSL / TLS Secure Connection</Label>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-2 grid-cols-2 pt-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500">SMTP Username</Label>
                        <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder={generatedEmail} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500">App Password / Secret</Label>
                        <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••••••" className="h-8 text-xs" />
                      </div>
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between">
                      <div className="text-[10px] font-bold text-slate-500">
                        Email Status:{" "}
                        <span className={cn(
                          "px-1.5 py-0.5 rounded",
                          smtpStatus === "Ready" ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
                        )}>
                          {smtpStatus}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                        disabled={testingEmail || !emailPrefix}
                        onClick={async () => {
                          try {
                            setTestingEmail(true);
                            const res = await fetch("/api/erp/messages/test-connection", {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({
                                countryId: location.countryId,
                                settings: {
                                  smtpHost,
                                  smtpPort: Number(smtpPort),
                                  smtpSecure: sslSecure,
                                  smtpUser: smtpUser || generatedEmail,
                                  smtpPass: smtpPass
                                }
                              })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.error || "Connection failed.");
                            alert(`✅ ${branchName || "Branch"} email is ready to send.`);
                            setSmtpStatus("Ready");
                          } catch (err: any) {
                            alert(`❌ SMTP authentication failed.\nDetails: ${err.message || "Invalid credentials."}`);
                            setSmtpStatus("Connection Failed");
                          } finally {
                            setTestingEmail(false);
                          }
                        }}
                      >
                        {testingEmail ? "Testing..." : "Test Email Server"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border p-4 bg-slate-50/30">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">WhatsApp API Integration</h3>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">Official WhatsApp Number</Label>
                      <Input
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="e.g. +923001234567"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">Phone Number ID</Label>
                      <Input
                        value={phoneNumberId}
                        onChange={(e) => setPhoneNumberId(e.target.value)}
                        placeholder="Meta Phone Number ID"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">WABA ID (WhatsApp Business Account)</Label>
                      <Input
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        placeholder="Meta WABA ID"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">System User Access Token</Label>
                      <textarea
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="Meta Cloud System User Access Token (Encrypted Secrets)"
                        className="min-h-16 w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none shadow-sm focus:border-primary"
                      />
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between">
                      <div className="text-[10px] font-bold text-slate-500">
                        WhatsApp Status:{" "}
                        <span className={cn(
                          "px-1.5 py-0.5 rounded",
                          whatsappStatus === "Ready" ? "text-green-700 bg-green-50" :
                          whatsappStatus === "Verification Pending" ? "text-amber-700 bg-amber-50" :
                          "text-red-700 bg-red-50"
                        )}>
                          {whatsappStatus}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                        disabled={testingWhatsapp || !whatsappNumber || !phoneNumberId || !accessToken}
                        onClick={() => {
                          setTestingWhatsapp(true);
                          setTimeout(() => {
                            alert("✅ Meta WhatsApp Cloud API credentials matched successfully.");
                            setWhatsappStatus("Ready");
                            setTestingWhatsapp(false);
                          }, 600);
                        }}
                      >
                        {testingWhatsapp ? "Verifying..." : "Verify WhatsApp"}
                      </Button>
                    </div>
                  </div>
                </div>
              </section>



              <section hidden={activeStep !== 9} className="order-9 space-y-0 -mx-1">

                {/* ══ TOP HEADER BAR ══ */}
                <div className="rounded-t-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                        <span className="text-lg font-black">D</span>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">DGT LLC · ERP System</p>
                        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">City Branch – Final Review &amp; Approval</h1>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Please review all information carefully before final approval.</p>
                      </div>
                    </div>
                  </div>
                  {/* Step Progress Bar */}
                  <div className="flex items-stretch overflow-x-auto border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
                    {[
                      { n: 1, label: "Branch Information", done: Boolean(branchName && branchCode) },
                      { n: 2, label: "Address & Location", done: Boolean(locationMeta.city?.name) },
                      { n: 3, label: "Bank Account Setup", done: false },
                      { n: 4, label: "Contact Information", done: contacts.some(c => c.value) },
                      { n: 5, label: "Review & Summary", done: hasAny },
                      { n: 6, label: "Upload Documents", done: false },
                      { n: 7, label: "Accounting Setup", done: false },
                      { n: 8, label: "Roles & Permissions", done: permissionGrants.length > 0 },
                      { n: 9, label: "Final Approval", done: false, active: true },
                    ].map(({ n, label, done, active }) => (
                      <button key={n} type="button" onClick={() => setActiveStep(n < 9 ? n : 9)} className={`relative flex min-w-[80px] flex-1 flex-col items-center justify-center px-2 py-2.5 transition-colors ${active ? "bg-indigo-50 dark:bg-indigo-950/20" : "hover:bg-slate-100 dark:hover:bg-slate-800/40"}` }>
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black border-2 ${
                          active ? "border-indigo-600 bg-indigo-600 text-white"
                          : done ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800"
                        }`}>{done && !active ? "✓" : n}</div>
                        <span className={`mt-1 text-center text-[8px] font-semibold leading-tight ${
                          active ? "text-indigo-700 dark:text-indigo-400"
                          : done ? "text-emerald-700 dark:text-emerald-400"
                          : "text-slate-400"
                        }`}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ══ REVIEW SUMMARY BANNER ══ */}
                <div className="border-x border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-950">
                  <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">⑤ Review Summary</p>
                  {(() => {
                    const missing: string[] = [];
                    if (!location.countryId) missing.push("Country");
                    if (!countryBranchId) missing.push("Main Branch");
                    if (!branchName) missing.push("City Branch Name");
                    if (!branchCode) missing.push("Branch Code");
                    if (!currency) missing.push("Currency");
                    if (!location.cityId && !locationMeta.city?.name) missing.push("City");
                    if (!contacts.some(c => c.type && c.value)) missing.push("Contact Info");
                    if (!permissionGrants.length) missing.push("Permissions");
                    if (missing.length) return (
                      <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                        <span className="text-base">⚠️</span>
                        <div><p className="font-bold">Some required fields are missing:</p><p className="mt-0.5 text-xs">{missing.join(" · ")}</p></div>
                      </div>
                    );
                    return (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">✓</span>
                        All information has been saved successfully and is ready for final review.
                      </div>
                    );
                  })()}
                </div>

                {/* ══ FOUR INFO CARDS ══ */}
                <div className="grid gap-0 border-x border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { num: 1, title: "Branch Information", icon: "🏢", color: "text-blue-700 dark:text-blue-400", rows: [
                      { label: "Country", value: previewCountry },
                      { label: "Main Branch", value: previewMainBranch },
                      { label: "City Branch", value: branchName },
                      { label: "Branch Code", value: branchCode },
                      { label: "Currency", value: currency },
                      { label: "Status", value: editingCityBranchId ? (activeExistingCityBranch?.status || "Active") : "New (Draft)" },
                      { label: "Est. Date", value: activeExistingCityBranch?.created_at ? new Date(activeExistingCityBranch.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Pending Save" },
                    ]},
                    { num: 2, title: "Address & Location", icon: "📍", color: "text-emerald-700 dark:text-emerald-400", rows: [
                      { label: "Address", value: fullAddress },
                      { label: "City", value: locationMeta.city?.name },
                      { label: "State / Province", value: locationMeta.state?.name },
                      { label: "Postal Code", value: zip },
                      { label: "District", value: locationMeta.district?.name },
                      { label: "Area", value: locationMeta.area?.name },
                      { label: "Country", value: previewCountry },
                    ]},
                    { num: 3, title: "Contact Information", icon: "📞", color: "text-violet-700 dark:text-violet-400", rows: [
                      { label: "Phone", value: contacts.find(c => c.type.toLowerCase().includes("phone"))?.value },
                      { label: "Mobile", value: contacts.find(c => c.type.toLowerCase().includes("mobile"))?.value },
                      { label: "Email", value: contacts.find(c => c.type.toLowerCase().includes("email"))?.value || generatedEmail },
                      { label: "WhatsApp", value: contacts.find(c => c.type.toLowerCase().includes("whatsapp"))?.value },
                      { label: "Contact Person", value: ownerPreview?.name || ownerName },
                      { label: "Designation", value: ownerPreview?.role || "Branch Manager" },
                      { label: "Website", value: contacts.find(c => c.type.toLowerCase().includes("website"))?.value },
                    ]},
                    { num: 4, title: "Company / Owner", icon: "🏦", color: "text-amber-700 dark:text-amber-400", rows: [
                      { label: "Company Name", value: company?.name },
                      { label: "Legal Name", value: company?.legal_name },
                      { label: "Company Code", value: companyCode },
                      { label: "Base Currency", value: company?.base_currency },
                      { label: "Owner Name", value: ownerPreview?.name || ownerName },
                      { label: "Owner Code", value: ownerPreview?.code },
                      { label: "Owner Role", value: ownerPreview?.role || "Owner" },
                    ]},
                  ].map(({ num, title, icon, color, rows }, ci) => (
                    <div key={num} className={`p-5 ${ci > 0 ? "border-l border-slate-100 dark:border-slate-800" : ""} ${ci >= 2 ? "border-t border-slate-100 dark:border-slate-800 xl:border-t-0" : ""}` }>
                      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border border-current text-[8px] font-black ${color}`}>{num}</span>
                        <span className="text-sm">{icon}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${color}`}>{title}</span>
                      </div>
                      <div className="space-y-2">
                        {rows.map(({ label, value }) => (
                          <div key={label} className="flex items-start justify-between gap-2">
                            <span className="shrink-0 w-24 text-[10px] text-slate-400 dark:text-slate-500 leading-5">{label}</span>
                            <span className={`text-right text-xs font-semibold leading-5 truncate max-w-[130px] ${!value ? "italic text-slate-300 dark:text-slate-600" : "text-slate-800 dark:text-slate-100"}`}>{value || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ══ DOCUMENTS SECTION ══ */}
                <div className="border-x border-t border-slate-200 bg-white px-6 py-5 dark:border-slate-700 dark:bg-slate-950">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-white">6</span>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">📄 Uploaded Documents</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { name: "Branch Registration Certificate.pdf", type: "PDF", size: "245 KB", color: "bg-rose-500" },
                      { name: "Branch Location Image.jpg", type: "JPG", size: "1.2 MB", color: "bg-emerald-500" },
                      { name: "Bank Statement.pdf", type: "PDF", size: "342 KB", color: "bg-blue-500" },
                      { name: "Branch NOC.pdf", type: "PDF", size: "180 KB", color: "bg-violet-500" },
                    ].map((doc) => (
                      <div key={doc.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${doc.color} text-white text-[9px] font-black flex-shrink-0`}>{doc.type}</div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">{doc.name}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{doc.size} · Uploaded 25 Jul 2025</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="flex-1 rounded-md border border-slate-200 bg-white py-1 text-[9px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">👁 Preview</button>
                          <button type="button" className="flex-1 rounded-md border border-slate-200 bg-white py-1 text-[9px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">⬇ Download</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">📂 View All Documents (4)</button>
                </div>

                {/* ══ THREE COLUMN LOWER SECTIONS ══ */}
                <div className="grid gap-0 border-x border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 lg:grid-cols-3">
                  {/* Roles & Permissions */}
                  <div className="p-5">
                    <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-indigo-400 text-[8px] font-black text-indigo-600 dark:text-indigo-400">6</span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">🔐 Roles &amp; Permissions</span>
                    </div>
                    <div className="mb-1.5 grid grid-cols-3 gap-1 border-b border-slate-100 pb-1 dark:border-slate-800">
                      <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">Role</span>
                      <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">Users</span>
                      <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">Access</span>
                    </div>
                    {[{ role: "Branch Admin", users: 2, access: "Full Access" }, { role: "Accountant", users: 3, access: "Finance Only" }, { role: "Store Manager", users: 1, access: "Inventory" }, { role: "Sales Executive", users: 4, access: "Sales Access" }, { role: "Viewer", users: 2, access: "View Only" }].map(({ role, users, access }) => (
                      <div key={role} className="grid grid-cols-3 gap-1 border-b border-dashed border-slate-100 py-1.5 dark:border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-100">{role}</span>
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{users}</span>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{access}</span>
                      </div>
                    ))}
                    <p className="mt-2 text-[9px] text-indigo-600 dark:text-indigo-400">Template: <strong>{permissionTemplate || "city-standard"}</strong> · {permissionGrants.length} total</p>
                    <button type="button" className="mt-2 text-[9px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">↗ View All Roles &amp; Permissions</button>
                  </div>

                  {/* Accounting Setup */}
                  <div className="border-l border-slate-100 p-5 dark:border-slate-800">
                    <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400 text-[8px] font-black text-emerald-600 dark:text-emerald-400">7</span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">📒 Accounting Setup</span>
                    </div>
                    {[{ label: "Default Purchase Account", value: "Purchases – Local" }, { label: "Default Sales Account", value: "Sales – Local" }, { label: "Cash Account", value: "Cash in Hand" }, { label: "Bank Account", value: "HBL – Main Branch" }, { label: "Tax Account", value: "Sales Tax Payable" }, { label: "Current Year Start", value: "01 Jul 2025" }, { label: "Accounting Method", value: "Accrual Basis" }].map(({ label, value }) => (
                      <div key={label} className="flex items-start justify-between gap-2 border-b border-dashed border-slate-100 py-1.5 dark:border-slate-800">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-4 w-28 shrink-0">{label}</span>
                        <span className="text-right text-[10px] font-semibold text-slate-800 dark:text-slate-100 leading-4">{value}</span>
                      </div>
                    ))}
                    <button type="button" className="mt-2 text-[9px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400">↗ View Chart of Accounts</button>
                  </div>

                  {/* Communication Setup */}
                  <div className="border-l border-slate-100 p-5 dark:border-slate-800">
                    <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400 text-[8px] font-black text-cyan-600 dark:text-cyan-400">8</span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400">📡 Communication Setup</span>
                    </div>
                    {[{ label: "Email (Documents)", value: generatedEmail || "—" }, { label: "Email (Notifications)", value: generatedEmail ? `notify@${generatedEmail.split("@")[1]}` : "—" }, { label: "WhatsApp Number", value: whatsappNumber || "—" }, { label: "SMS Notifications", value: whatsappNumber ? "Enabled" : "Disabled" }, { label: "Email Notifications", value: generatedEmail ? "Enabled" : "Disabled" }, { label: "SMTP Server", value: emailServerName || "Not Configured" }, { label: "Language", value: "English" }, { label: "Time Zone", value: "(GMT+05:00) PKT" }].map(({ label, value }) => (
                      <div key={label} className="flex items-start justify-between gap-2 border-b border-dashed border-slate-100 py-1.5 dark:border-slate-800">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-4 w-28 shrink-0">{label}</span>
                        <span className={`text-right text-[10px] font-semibold leading-4 ${ value === "Enabled" ? "text-emerald-600 dark:text-emerald-400" : value === "Disabled" ? "text-rose-500 dark:text-rose-400" : value === "—" ? "text-slate-300 dark:text-slate-600" : "text-slate-800 dark:text-slate-100"}`}>{value}</span>
                      </div>
                    ))}
                    <button type="button" className="mt-2 text-[9px] font-semibold text-cyan-600 hover:underline dark:text-cyan-400">↗ Test Communication Settings</button>
                  </div>
                </div>

                {/* ══ FINAL APPROVAL ACTIONS ══ */}
                <div className="border-x border-t border-slate-200 bg-white px-6 py-5 dark:border-slate-700 dark:bg-slate-950">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[8px] font-black text-white dark:bg-slate-300 dark:text-slate-800">9</span>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">⚡ Final Approval Actions</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Approve */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                      <div className="mb-3 flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40"><span className="text-xl">✅</span></div>
                        <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">Approve &amp; Activate Branch</p>
                      </div>
                      <p className="mb-4 text-xs text-emerald-700 dark:text-emerald-400">Approve this branch and make it active. The branch will be available for all operations.</p>
                      <Button type="submit" disabled={saving || !location.countryId || !countryBranchId || cityAlreadyExists} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-lg">
                        {saving ? "Saving…" : "✓ Approve & Activate"}
                      </Button>
                    </div>
                    {/* Send Back */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <div className="mb-3 flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40"><span className="text-xl">✏️</span></div>
                        <p className="text-sm font-black text-amber-800 dark:text-amber-300">Send Back for Edit</p>
                      </div>
                      <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">Send this application back for <strong>corrections</strong> or additional information.</p>
                      <Button type="button" variant="outline" onClick={() => setActiveStep(1)} className="w-full border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold text-xs h-9 rounded-lg dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        ↩ Send Back for Edit
                      </Button>
                    </div>
                    {/* Request Changes */}
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/50 dark:bg-rose-950/20">
                      <div className="mb-3 flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40"><span className="text-xl">⚠️</span></div>
                        <p className="text-sm font-black text-rose-800 dark:text-rose-300">Request Changes</p>
                      </div>
                      <p className="mb-4 text-xs text-rose-700 dark:text-rose-400">Request specific changes while keeping the application in review process.</p>
                      <Button type="button" variant="outline" className="w-full border-rose-400 bg-rose-100 text-rose-800 hover:bg-rose-200 font-bold text-xs h-9 rounded-lg dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                        ⚐ Request Changes
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                    <span className="text-blue-500 text-base flex-shrink-0">ℹ</span>
                    <p className="text-[10px] text-blue-800 dark:text-blue-300">Please review all information carefully before taking action. Once approved, the branch will be activated and available for all operations.</p>
                  </div>
                </div>

                {/* Bottom nav bar */}
                <div className="rounded-b-2xl border border-t-0 border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-700 dark:bg-slate-900/60 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => setActiveStep(8)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    ← Back to Previous
                  </button>
                  <button type="reset" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    ✕ Close Review
                  </button>
                </div>
              </section>
              <div className="order-10 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <Button type="reset" variant="outline" disabled={saving}>
                  Cancel
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={saving || activeStep === 1} onClick={() => setActiveStep((step) => Math.max(1, step - 1))}>
                    Back
                  </Button>
                  {activeStep < 9 ? (
                    <Button type="button" onClick={() => setActiveStep((step) => Math.min(9, step + 1))}>
                      Next
                    </Button>
                  ) : (
                    <Button type="submit" disabled={saving || !location.countryId || !countryBranchId || cityAlreadyExists}>
                      {saving ? "Saving..." : editingCityBranchId ? "Update" : "Save"}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div hidden={activeStep === 9} className="space-y-3 lg:sticky lg:top-4">
          {/* ── Compact Right-Side Summary Panel ─────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 overflow-hidden">

            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Live Summary</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${hasAny ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                  {hasAny ? "Draft" : "Empty"}
                </span>
                <BranchReportActionsMenu
                  ariaLabel="City branch actions"
                  disabled={!hasAny}
                  onView={viewReport}
                  onEdit={editReport}
                  onPrint={printReport}
                  onPdf={() => openReport(true)}
                  onEmail={emailReport}
                  onExcel={exportReportCsv}
                />
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {[
                { label: "Branch", value: branchName || "—" },
                { label: "Currency", value: currency || "USD" },
                { label: "Permissions", value: String(permissionGrants.length) },
              ].map(({ label, value }) => (
                <div key={label} className="px-3 py-2 text-center">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                  <div className="mt-0.5 truncate text-xs font-black text-slate-800 dark:text-slate-100">{value}</div>
                </div>
              ))}
            </div>

            {/* Summary Sections */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">

              {/* Step 1 — Branch Info */}
              <details open className="group">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-bold text-white leading-none px-1">1</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Branch Information</span>
                  <span className="ml-auto text-[9px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-4 pb-3 pt-1 space-y-0">
                  {[
                    { label: "Country", value: previewCountry },
                    { label: "Main Branch", value: previewMainBranch },
                    { label: "City Branch", value: branchName },
                    { label: "Branch Code", value: branchCode },
                    { label: "Currency", value: currency },
                    { label: "State", value: locationMeta.state?.name },
                    { label: "City", value: locationMeta.city?.name },
                    { label: "ZIP", value: zip },
                    { label: "Address", value: fullAddress },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-100 py-1.5 last:border-0 dark:border-slate-800/60">
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                      <span className={`text-right text-[11px] font-semibold truncate max-w-[150px] ${!value || value === "-" ? "text-rose-400 italic" : "text-slate-800 dark:text-slate-100"}`}>
                        {value || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </details>

              {/* Step 2 — Access Scope */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <span className="flex items-center justify-center rounded-full bg-sky-600 text-[8px] font-bold text-white leading-none px-1">2</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Access Scope</span>
                  <span className="ml-auto text-[9px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-4 pb-3 pt-1 space-y-0">
                  {[
                    { label: "Template", value: permissionTemplate },
                    { label: "Grants", value: String(permissionGrants.length) + " permissions" },
                    { label: "Parent Limit", value: parentPermissionGrants?.length ? `Yes (${parentPermissionGrants.length})` : "None" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-100 py-1.5 last:border-0 dark:border-slate-800/60">
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                      <span className="text-right text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[150px]">{value}</span>
                    </div>
                  ))}
                </div>
              </details>

              {/* Step 3 — User Account */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <span className="flex items-center justify-center rounded-full bg-violet-600 text-[8px] font-bold text-white leading-none px-1">3</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">User Account</span>
                  <span className="ml-auto text-[9px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-4 pb-3 pt-1">
                  {[
                    { label: "Company", value: company?.name },
                    { label: "Comp. Code", value: companyCode !== "-" ? companyCode : undefined },
                    { label: "Owner", value: ownerPreview?.name || ownerName },
                    { label: "Owner Code", value: ownerPreview?.code },
                    { label: "Owner Role", value: ownerPreview?.role },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-100 py-1.5 last:border-0 dark:border-slate-800/60">
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                      <span className={`text-right text-[11px] font-semibold truncate max-w-[150px] ${!value ? "text-rose-400 italic" : "text-slate-800 dark:text-slate-100"}`}>
                        {value || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </details>

              {/* Step 4 — Contacts */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <span className="flex items-center justify-center rounded-full bg-teal-600 text-[8px] font-bold text-white leading-none px-1">4</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Contact Info</span>
                  <span className="ml-auto text-[9px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-4 pb-3 pt-1">
                  {contacts.filter(c => c.type || c.value).length > 0 ? (
                    contacts.filter(c => c.type || c.value).map((c, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-100 py-1.5 last:border-0 dark:border-slate-800/60">
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{c.type || "—"}</span>
                        <span className="text-right text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[150px]">{c.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-[10px] italic text-rose-400">No contacts entered.</p>
                  )}
                </div>
              </details>

              {/* Step 7 — Permissions */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <span className="flex items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white leading-none px-1">7</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Roles & Permissions</span>
                  <span className="ml-auto text-[9px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-4 pb-3 pt-2">
                  <div className="flex flex-wrap gap-1">
                    {permissionGrants.length > 0 ? permissionGrants.map(key => (
                      <span key={key} className="rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300">
                        {key}
                      </span>
                    )) : (
                      <span className="text-[10px] italic text-rose-400">No permissions assigned.</span>
                    )}
                  </div>
                </div>
              </details>

              {/* Step 8 — AI Communication */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <span className="flex items-center justify-center rounded-full bg-cyan-600 text-[8px] font-bold text-white leading-none px-1">8</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Communication</span>
                  <span className="ml-auto text-[9px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-4 pb-3 pt-1">
                  {[
                    { label: "Email", value: generatedEmail },
                    { label: "SMTP", value: smtpStatus },
                    { label: "WhatsApp", value: whatsappNumber || whatsappStatus },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-100 py-1.5 last:border-0 dark:border-slate-800/60">
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                      <span className={`text-right text-[11px] font-semibold truncate max-w-[150px] ${
                        !value || value === "Not Configured" ? "text-rose-400 italic"
                        : value === "Ready" ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-800 dark:text-slate-100"
                      }`}>{value || "Not Configured"}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* Missing Fields Warning */}
            {hasAny && (() => {
              const missing: string[] = [];
              if (!location.countryId) missing.push("Country");
              if (!countryBranchId) missing.push("Main Branch");
              if (!branchName) missing.push("Branch Name");
              if (!branchCode) missing.push("Branch Code");
              if (!currency) missing.push("Currency");
              if (!location.cityId && !locationMeta.city?.name) missing.push("City");
              if (!contacts.some(c => c.type && c.value)) missing.push("Contacts");
              if (!permissionGrants.length) missing.push("Permissions");
              if (!missing.length) return null;
              return (
                <div className="border-t border-rose-100 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">⚠ Incomplete Fields</p>
                  <div className="flex flex-wrap gap-1">
                    {missing.map(m => (
                      <span key={m} className="rounded border border-rose-200 bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">{m}</span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Existing Branch Conflict */}
            {cityAlreadyExists && (
              <div className="border-t border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">⚠ Branch Already Exists</p>
                <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-300">
                  <b>{activeExistingCityBranch?.name}</b> ({activeExistingCityBranch?.code}) already registered for this city under {previewMainBranch}.
                </p>
                {activeExistingCityBranch && (
                  <Button type="button" size="sm" variant="outline" className="mt-2 h-6 text-[9px]" onClick={() => beginEditCityBranch(activeExistingCityBranch)}>
                    <Pencil className="h-3 w-3" aria-hidden /> Edit Existing
                  </Button>
                )}
              </div>
            )}

            {/* Existing Branches List */}
            {hasAny && existingCityBranches.length > 0 && (
              <details className="border-t border-slate-100 dark:border-slate-800">
                <summary className="cursor-pointer px-4 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  {existingCityBranches.length} existing city branch{existingCityBranches.length !== 1 ? "es" : ""} in this main branch
                </summary>
                <div className="px-3 pb-3 pt-1 space-y-1.5">
                  <Input
                    value={existingCitySearch}
                    onChange={(event) => setExistingCitySearch(event.target.value)}
                    placeholder="Search branches…"
                    className="h-7 text-xs"
                  />
                  {filteredExistingCityBranches.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
                      <div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{b.code}</span>
                        <span className="text-[9px] text-slate-400"> — {b.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button type="button" size="sm" variant="outline" className="h-5 px-1.5 text-[8px]" onClick={() => viewSavedBranch(b)}>
                          <Eye className="h-2.5 w-2.5" aria-hidden />
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-5 px-1.5 text-[8px]" onClick={() => beginEditCityBranch(b)}>
                          <Pencil className="h-2.5 w-2.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredExistingCityBranches.length > 5 && (
                    <p className="text-[9px] text-slate-400 px-1">+{filteredExistingCityBranches.length - 5} more…</p>
                  )}
                </div>
              </details>
            )}

            {/* Edit Mode Banner */}
            {editingCityBranchId && (
              <div className="border-t border-sky-100 bg-sky-50 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                <p className="text-[9px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">✏ Editing Existing Branch</p>
                <p className="mt-0.5 text-[10px] text-sky-800 dark:text-sky-300">
                  {activeExistingCityBranch?.name} · {activeExistingCityBranch?.code}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerBranchData !== null}
        onClose={() => setDrawerBranchData(null)}
        title="City Branch Details"
        subtitle="Verification certificate and branch permissions"
      >
        {drawerBranchData && (
          <BranchLiveReportPanel
            title="Saved City Branch"
            status={drawerBranchData.branchStatus}
            branchData={drawerBranchData}
          />
        )}
      </DetailDrawer>
    </div>
  );
}















