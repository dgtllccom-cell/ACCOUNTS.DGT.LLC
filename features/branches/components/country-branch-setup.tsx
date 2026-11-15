"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { cn } from "@/lib/utils";
import { getPermissionKeysForTemplate } from "@/lib/permissions/catalog";
import { openBranchProfileReport } from "@/lib/reports/build-branch-profile-report";
import type { BranchReportData } from "@/lib/reports/open-a4-report-window";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { ContactTypeKey } from "@/features/contact-types/contact-type-api";
import { BranchFinalReview, type BranchReviewDocumentItem, type BranchUserPermissionItem } from "./branch-final-review";
import { CITY_BRANCH_FIELD_KEYS, describeCityBranchServerError } from "@/features/branches/lib/city-branch-server-error";
import { loadCompanyOwnerViews, emptyOwnerView, type CompanyView, type OwnerView } from "@/features/branches/lib/city-branch-owner-company";
import { normalizeCityBranchDetail, documentTypeLabel, formatFileSize, type CityBranchDetail } from "@/features/branches/lib/city-branch-detail";
import { domainLabel, roleLabel, accessProfileLabel } from "@/features/branches/lib/city-branch-report";
import { evaluateCountryBranchChecklist } from "@/features/branches/lib/country-branch-checklist";
import {
  buildCountryBranchDrawerData,
  buildCountryBranchProfileData,
  buildCountryBranchRows,
  countryBranchContact,
  type CountryBranchReportInput
} from "@/features/branches/lib/country-branch-report";
import { COUNTRY_DEFAULT_PERMISSION_TEMPLATE, countryGrantsForForm } from "@/features/branches/lib/country-branch-grants";

type CountryBranchRow = {
  id: string;
  country_id: string;
  operational_domain?: string | null;
  name: string;
  code: string;
  local_currency: string;
  is_main: boolean;
  status: string;
  company_id?: string | null;
  owner_name?: string | null;
  owner_customer_id?: string | null;
  owner_profile_id?: string | null;
  contacts?: unknown;
  documents?: unknown;
  permission_template?: string | null;
  permission_grants?: string[] | null;
  state_province_id?: string | null;
  district_id?: string | null;
  city_id?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ContactRow = { type: string; value: string };

type SaveResponse = {
  id?: string;
  code?: string;
  name?: string;
  status?: string;
  updatedAt?: string | null;
  warnings?: string[];
  domainAccess?: { business: boolean; shipping: boolean } | null;
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
    .replace(/[̀-ͯ]/g, "")
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

/** Contact rows from the saved JSON list. */
function normalizeContactRows(value: unknown): ContactRow[] {
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

/**
 * Contacts for the form. A row whose JSON contact list is empty still carries the phone / WhatsApp columns;
 * those are loaded too, so a save does not erase them.
 */
function contactsForForm(row: CountryBranchRow): ContactRow[] {
  const fromJson = normalizeContactRows(row.contacts);
  if (fromJson.length) return fromJson;
  const legacy: ContactRow[] = [];
  if (row.phone) legacy.push({ type: "Phone", value: row.phone });
  if (row.whatsapp_number) legacy.push({ type: "WhatsApp", value: row.whatsapp_number });
  return legacy;
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function CountryBranchSetupContent() {
  const lang = useActiveLanguage();
  const tt = useCallback((key: string, fallback: string) => t(lang as never, key as never, fallback), [lang]);
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId") ?? "";
  const stepParam = searchParams.get("step");
  const parsedStep = stepParam ? parseInt(stepParam, 10) : 1;
  const [drawerBranchData, setDrawerBranchData] = useState<BranchReportData | null>(null);
  const [activeStep, setActiveStep] = useState(() =>
    Number.isFinite(parsedStep) && parsedStep >= 1 && parsedStep <= 9 ? parsedStep : 1
  );
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
  const [branchEmail, setBranchEmail] = useState("");
  const [fullAddress, setFullAddress] = useState("");

  const [companyId, setCompanyId] = useState("");
  const [companyView, setCompanyView] = useState<CompanyView | null>(null);
  const [companyBankCount, setCompanyBankCount] = useState(0);
  const [ownerName, setOwnerName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerCustomerId, setOwnerCustomerId] = useState<string | null>(null);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);
  const [ownerView, setOwnerView] = useState<OwnerView | null>(null);
  const [linkedRecordFailed, setLinkedRecordFailed] = useState(false);

  const [existingMainBranch, setExistingMainBranch] = useState<CountryBranchRow | null>(null);
  const [editingCountryBranchId, setEditingCountryBranchId] = useState("");
  const [savedDetail, setSavedDetail] = useState<CityBranchDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState("");
  const [grantsPrefilled, setGrantsPrefilled] = useState(false);
  const [countryBranches, setCountryBranches] = useState<CountryBranchRow[]>([]);
  const [countryBranchSearch, setCountryBranchSearch] = useState("");
  const [branchType, setBranchType] = useState("");
  const [operationalDomain, setOperationalDomain] = useState<"business" | "shipping">("business");
  const [branchCategory, setBranchCategory] = useState<"business" | "clearing_agent">("business");
  const [branchCode, setBranchCode] = useState("");
  const [permissionTemplate, setPermissionTemplate] = useState(COUNTRY_DEFAULT_PERMISSION_TEMPLATE);
  const [permissionGrants, setPermissionGrants] = useState<string[]>(() =>
    getPermissionKeysForTemplate(COUNTRY_DEFAULT_PERMISSION_TEMPLATE)
  );

  const [contacts, setContacts] = useState<ContactRow[]>([]);

  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  // The record id whose load was started last. It lives in a ref, so it survives an effect cleanup or re-run.
  const editLoadRef = useRef("");

  const fieldLabel = useCallback((field: string) => tt(CITY_BRANCH_FIELD_KEYS[field] ?? "cbs.field_unknown", field), [tt]);

  const filteredCountryBranches = useMemo(() => {
    const q = countryBranchSearch.trim().toLowerCase();
    if (!q) return countryBranches;
    return countryBranches.filter((b) => {
      const haystack = [b.code, b.name, b.status].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [countryBranches, countryBranchSearch]);

  useEffect(() => {
    if (locationMeta.country?.currency_code) {
      setCurrency(locationMeta.country.currency_code);
    }
  }, [locationMeta.country]);

  // Company and owner: one loader for the form, the live preview, the checklist and the print.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const views = await loadCompanyOwnerViews({ companyId, ownerCustomerId });
        if (cancelled) return;
        setCompanyView(views.company);
        setCompanyBankCount(views.companyBankCount);
        setOwnerView(views.owner);
        setLinkedRecordFailed(false);
        if (views.owner?.name) setOwnerName(views.owner.name);
        // A company that names its owner fills the owner only when no owner is chosen yet.
        if (views.company?.ownerPersonId && !ownerCustomerId && !ownerProfileId) {
          setOwnerId(views.company.ownerPersonId);
          setOwnerCustomerId(views.company.ownerPersonId);
        }
      } catch {
        if (cancelled) return;
        setCompanyView(null);
        setCompanyBankCount(0);
        setOwnerView(null);
        setLinkedRecordFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, ownerCustomerId, ownerProfileId]);

  // Saved-record detail (location names, users assigned to this main branch, documents).
  useEffect(() => {
    let cancelled = false;
    if (!isUuid(editingCountryBranchId)) {
      setSavedDetail(null);
      setDetailFailed("");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/branch-management/country-branches?id=${encodeURIComponent(editingCountryBranchId)}&detail=1`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (!res.ok) {
          setSavedDetail(null);
          setDetailFailed("DETAIL_FAILED");
          return;
        }
        const json = (await res.json().catch(() => ({}))) as { detail?: unknown; detailError?: string | null };
        if (cancelled) return;
        const detail = normalizeCityBranchDetail(json.detail);
        setSavedDetail(detail);
        setDetailFailed(detail ? "" : json.detailError || "NO_DATABASE");
      } catch {
        if (cancelled) return;
        setSavedDetail(null);
        setDetailFailed("DETAIL_FAILED");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingCountryBranchId]);

  const countryName = locationMeta.country?.name || "";
  const zip = locationMeta.area?.postal_code ?? locationMeta.city?.zip_code ?? "";
  const previewCountry = countryName || "-";
  const previewLocation = [locationMeta.state?.name, locationMeta.city?.name, locationMeta.area?.name, zip].filter(Boolean).join(" / ") || "-";
  // The country name arrives with the location list; until then a saved record shows its own saved name.
  const resolvedBranchName = countryName
    ? operationalDomain === "shipping"
      ? `${countryName} Shipping Line Main Branch`
      : `${countryName} Main Branch`
    : existingMainBranch?.name || "";

  const contactsPayload = useMemo(
    () =>
      contacts
        .map((row) => ({ type: row.type.trim(), value: row.value.trim() }))
        .filter((row) => row.type && row.value),
    [contacts]
  );
  const contactItems = contactsPayload.map((row) => `${row.type}: ${row.value}`);

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

  // Owner as shown everywhere: the loaded customer record, or the name for a non-customer owner.
  const ownerForView: OwnerView | null =
    ownerView ??
    (ownerCustomerId || ownerProfileId || ownerName.trim()
      ? emptyOwnerView(ownerName.trim(), ownerProfileId ? "profile" : "customer")
      : null);

  const linkedUsers = useMemo(
    () => (editingCountryBranchId ? savedDetail?.linkedUsers ?? [] : []),
    [editingCountryBranchId, savedDetail]
  );
  const linkedDocuments = useMemo(
    () => (editingCountryBranchId ? savedDetail?.linkedDocuments ?? [] : []),
    [editingCountryBranchId, savedDetail]
  );

  const reportInput: CountryBranchReportInput = useMemo(
    () => ({
      savedId: editingCountryBranchId,
      name: resolvedBranchName,
      code: branchCode.trim(),
      status: existingMainBranch?.status || (editingCountryBranchId ? "active" : tt("cbs.new_draft_word", "Draft")),
      currency: currency || locationMeta.country?.currency_code?.toUpperCase() || "",
      operationalDomain,
      createdAt: existingMainBranch?.created_at ?? "",
      updatedAt: existingMainBranch?.updated_at ?? "",
      createdByName: savedDetail?.createdByName ?? "",
      country: countryName,
      countryIso2: locationMeta.country?.iso2 ?? "",
      stateProvince: locationMeta.state?.name ?? "",
      district: locationMeta.district?.name ?? "",
      city: locationMeta.city?.name ?? "",
      fullAddress: fullAddress.trim(),
      contacts: contactsPayload,
      branchEmail: branchEmail.trim(),
      ownerName: ownerForView?.name ?? ownerName,
      company: companyView,
      owner: ownerForView,
      permissionTemplate,
      permissionGrants
    }),
    [
      editingCountryBranchId,
      resolvedBranchName,
      branchCode,
      existingMainBranch,
      tt,
      currency,
      locationMeta.country?.currency_code,
      locationMeta.country?.iso2,
      locationMeta.state?.name,
      locationMeta.district?.name,
      locationMeta.city?.name,
      operationalDomain,
      savedDetail?.createdByName,
      countryName,
      fullAddress,
      contactsPayload,
      branchEmail,
      ownerForView,
      ownerName,
      companyView,
      permissionTemplate,
      permissionGrants
    ]
  );

  const liveBranchData = useMemo(() => buildCountryBranchDrawerData(reportInput, tt), [reportInput, tt]);
  const reportRows = useMemo(() => buildCountryBranchRows(reportInput, tt), [reportInput, tt]);

  const checklist = useMemo(
    () =>
      evaluateCountryBranchChecklist({
        countryId: location.countryId,
        operationalDomain,
        branchCategory,
        branchName: resolvedBranchName,
        branchCode: branchCode.trim(),
        stateProvinceId: location.stateProvinceId,
        cityId: location.cityId,
        address: fullAddress,
        currency: currency || locationMeta.country?.currency_code?.toUpperCase() || "",
        companyId,
        ownerCustomerId,
        ownerProfileId,
        contacts: contactsPayload,
        emailAddress: branchEmail.trim(),
        permissionGrants,
        savedBranchId: editingCountryBranchId,
        linkedUsers,
        linkedDocumentCount: linkedDocuments.length,
        companyBankCount
      }),
    [
      location.countryId,
      location.stateProvinceId,
      location.cityId,
      operationalDomain,
      branchCategory,
      resolvedBranchName,
      branchCode,
      fullAddress,
      currency,
      locationMeta.country?.currency_code,
      companyId,
      ownerCustomerId,
      ownerProfileId,
      contactsPayload,
      branchEmail,
      permissionGrants,
      editingCountryBranchId,
      linkedUsers,
      linkedDocuments.length,
      companyBankCount
    ]
  );

  const documentItems: BranchReviewDocumentItem[] = linkedDocuments.map((doc) => ({
    id: doc.id,
    name: doc.name,
    type: documentTypeLabel(doc.mimeType, doc.name),
    size: formatFileSize(doc.sizeBytes),
    isRequired: false,
    isUploaded: true,
    uploadedAt: shortDate(doc.createdAt)
  }));

  const userItems: BranchUserPermissionItem[] = linkedUsers.map((u) => ({
    id: u.assignmentId,
    userName: u.userName || u.userCode || "—",
    role: roleLabel(u.role, tt),
    operationalDomain: u.operationalDomain === "both" ? tt("cbs.domain_both", "Both") : domainLabel(u.operationalDomain, tt),
    countryScope: previewCountry,
    branchScope: resolvedBranchName,
    permissionGroup: accessProfileLabel(u.accessProfile, tt),
    ledgerVisibility: domainLabel(u.operationalDomain, tt),
    status: u.isActive ? "Active" : "Warning",
    statusReason: u.isActive ? undefined : tt("cbs.user_inactive_reason", "Assignment is inactive")
  }));

  const editIdentityRows = useMemo(
    () => [
      { label: tt("cnbs.country", "Country"), value: previewCountry },
      { label: tt("cnbs.main_branch", "Main Branch"), value: existingMainBranch?.name || "" },
      { label: tt("cnbs.branch_code", "Branch Code"), value: existingMainBranch?.code || branchCode },
      { label: tt("cnbs.record_id", "Record ID"), value: editingCountryBranchId },
      { label: tt("cnbs.status", "Status"), value: existingMainBranch?.status || "" },
      { label: tt("cnbs.created_date", "Created Date"), value: shortDate(existingMainBranch?.created_at) },
      { label: tt("cnbs.last_updated", "Last Updated"), value: shortDate(existingMainBranch?.updated_at) },
      { label: tt("cnbs.currency", "Currency"), value: currency }
    ],
    [tt, branchCode, currency, editingCountryBranchId, existingMainBranch, previewCountry]
  );

  const editProfileSections: BranchProfileSection[] = useMemo(
    () => [
      {
        title: tt("cnbs.sec_branch_info", "Branch Information"),
        items: [
          { label: tt("cnbs.branch_type", "Branch Type"), value: tt("branch.report_country_main_branch", "Country Main Branch") },
          { label: tt("cnbs.branch_code", "Branch Code"), value: existingMainBranch?.code || branchCode },
          { label: tt("cnbs.currency", "Currency"), value: currency },
          { label: tt("cnbs.status", "Status"), value: existingMainBranch?.status || "" }
        ]
      },
      {
        title: tt("cnbs.sec_location_info", "Location Information"),
        items: [
          { label: tt("cnbs.country", "Country"), value: previewCountry },
          { label: tt("cnbs.country_code", "Country Code"), value: locationMeta.country?.iso2 || locationMeta.country?.iso3 || "" },
          { label: tt("cnbs.location", "Location"), value: previewLocation === "-" ? "" : previewLocation },
          { label: tt("cnbs.address", "Address"), value: fullAddress }
        ]
      },
      {
        title: tt("cnbs.sec_company_info", "Company Information"),
        items: [
          { label: tt("cnbs.company_name", "Company Name"), value: companyView?.name || "" },
          { label: tt("cnbs.company_code", "Company Code"), value: companyView?.companyCode || "" },
          { label: tt("cnbs.legal_name", "Legal Name"), value: companyView?.legalName || "" },
          { label: tt("cbs.pr_tax_no", "Tax / NTN No."), value: companyView?.taxNumber || "" },
          { label: tt("cnbs.base_currency", "Base Currency"), value: companyView?.baseCurrency || "" }
        ]
      },
      {
        title: tt("cnbs.sec_owner_info", "Owner Information"),
        items: [
          { label: tt("cnbs.owner_name", "Owner Name"), value: ownerForView?.name || "" },
          { label: tt("cnbs.owner_code", "Owner Code"), value: ownerForView?.code || "" },
          { label: tt("cnbs.owner_source", "Owner Source"), value: ownerForView?.source || "" }
        ]
      },
      {
        title: tt("cnbs.sec_contact_info", "Contact Information"),
        items: [
          { label: tt("cnbs.contacts", "Contacts"), value: contactItems.join(", ") },
          { label: tt("cnbs.phone", "Phone"), value: countryBranchContact(contactsPayload, (x) => x.includes("phone") || x.includes("mobile")) },
          { label: tt("cnbs.whatsapp", "WhatsApp"), value: countryBranchContact(contactsPayload, (x) => x.includes("whatsapp")) },
          { label: tt("cnbs.email", "Email"), value: branchEmail.trim() }
        ]
      },
      {
        title: tt("cnbs.permissions", "Permissions"),
        items: [
          { label: tt("cnbs.template", "Template"), value: permissionTemplate },
          { label: tt("cnbs.granted_permissions", "Granted Permissions"), value: permissionGrants.join(", ") }
        ]
      }
    ],
    [
      tt,
      branchCode,
      companyView,
      contactItems,
      contactsPayload,
      currency,
      existingMainBranch,
      fullAddress,
      locationMeta.country?.iso2,
      locationMeta.country?.iso3,
      ownerForView,
      permissionGrants,
      permissionTemplate,
      previewCountry,
      previewLocation,
      branchEmail
    ]
  );

  function openReport(autoPrint: boolean) {
    const activeLang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
    openBranchProfileReport({
      kind: "country",
      lang: activeLang,
      autoPrint,
      data: buildCountryBranchProfileData(reportInput, tt)
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

  /** Loads a saved main branch into the form. Saving from here updates this record (never a second main). */
  function applySavedRow(row: CountryBranchRow) {
    const domain = (row.operational_domain === "shipping" ? "shipping" : "business") as "business" | "shipping";
    setEditingCountryBranchId(row.id);
    setExistingMainBranch(row);
    setOperationalDomain(domain);
    setBranchCategory(domain === "shipping" ? "clearing_agent" : "business");
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
    setBranchEmail(row.email || "");
    setFullAddress(row.address ?? "");
    setCompanyId(row.company_id ?? "");
    setOwnerName(row.owner_name ?? "");
    setOwnerCustomerId(row.owner_customer_id ?? null);
    setOwnerProfileId(row.owner_profile_id ?? null);
    setOwnerId(row.owner_customer_id || row.owner_profile_id || "");
    setContacts(contactsForForm(row));
    setPermissionTemplate(row.permission_template || COUNTRY_DEFAULT_PERMISSION_TEMPLATE);
    const grants = countryGrantsForForm(row.permission_grants, row.permission_template);
    setPermissionGrants(grants.grants);
    setGrantsPrefilled(grants.prefilled);
  }

  function existingBranchMessage(main: CountryBranchRow) {
    return [
      tt("cnbs.existing_loaded", "A main branch already exists for this country and section. It is loaded now. Saving updates it; no duplicate is created."),
      `${tt("cbs.field_branch_name", "Branch Name")}: ${main.name}`,
      `${tt("cbs.field_branch_code", "Branch Code")}: ${main.code}`
    ].join("\n");
  }

  function beginEditCountryBranch(row: CountryBranchRow) {
    applySavedRow(row);
    setBanner(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function viewSavedBranch(row: CountryBranchRow) {
    try {
      const [detailJson, views] = await Promise.all([
        fetch(`/api/branch-management/country-branches?id=${encodeURIComponent(row.id)}&detail=1`, { cache: "no-store" })
          .then((res) => res.json())
          .catch(() => ({})) as Promise<{ detail?: unknown }>,
        loadCompanyOwnerViews({ companyId: row.company_id ?? "", ownerCustomerId: row.owner_customer_id ?? null })
      ]);
      const detail = normalizeCityBranchDetail(detailJson?.detail);
      const input: CountryBranchReportInput = {
        savedId: row.id,
        name: row.name,
        code: row.code,
        status: row.status || "",
        currency: row.local_currency || "",
        operationalDomain: row.operational_domain === "shipping" ? "shipping" : "business",
        createdAt: row.created_at ?? "",
        updatedAt: row.updated_at ?? "",
        createdByName: detail?.createdByName ?? "",
        country: detail?.location.countryName ?? "",
        countryIso2: detail?.location.countryIso2 ?? "",
        stateProvince: detail?.location.stateName ?? "",
        district: detail?.location.districtName ?? "",
        city: detail?.location.cityName ?? "",
        fullAddress: row.address ?? "",
        contacts: contactsForForm(row),
        branchEmail: row.email ?? "",
        ownerName: row.owner_name ?? "",
        company: views.company,
        owner: views.owner ?? (row.owner_profile_id ? emptyOwnerView(row.owner_name ?? "", "profile") : null),
        permissionTemplate: row.permission_template ?? "",
        permissionGrants: Array.isArray(row.permission_grants) ? row.permission_grants : []
      };
      setDrawerBranchData(buildCountryBranchDrawerData(input, tt));
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error && error.message ? error.message : tt("cnbs.detail_load_failed", "The saved branch details could not be loaded.")
      });
    }
  }

  // Loads the record named by ?editId. The request belongs to the id it was started for, not to this effect run:
  // a cleanup or re-render while the request is pending (for example the query parameter flickering) must neither
  // drop the response nor leave the loading state on. Only a different record id supersedes the request.
  useEffect(() => {
    if (!isUuid(editId)) return;
    if (editingCountryBranchId === editId || editLoadRef.current === editId) return;

    const requestedId = editId;
    editLoadRef.current = requestedId;
    setEditLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/branch-management/country-branches?id=${encodeURIComponent(requestedId)}`, {
          cache: "no-store"
        });
        const json = (await res.json().catch(() => ({}))) as { countryBranches?: CountryBranchRow[]; error?: string };
        if (editLoadRef.current !== requestedId) return;
        if (!res.ok) {
          setBanner({ type: "error", message: json.error || tt("cnbs.record_not_found", "Branch record not found.") });
          return;
        }
        const row = Array.isArray(json.countryBranches) ? json.countryBranches[0] : null;
        if (!row) {
          setBanner({ type: "error", message: tt("cnbs.record_not_found", "Branch record not found.") });
          return;
        }
        setCountryBranches(json.countryBranches ?? []);
        beginEditCountryBranch(row);
      } catch (error) {
        if (editLoadRef.current === requestedId) {
          setBanner({ type: "error", message: error instanceof Error ? error.message : tt("cnbs.detail_load_failed", "The saved branch details could not be loaded.") });
        }
      } finally {
        if (editLoadRef.current === requestedId) setEditLoading(false);
      }
    })();
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

  /** Loads the saved main branch of this country for one section (business or shipping). */
  async function loadExistingMainBranch(nextCountryId: string, domain?: "business" | "shipping") {
    const effectiveDomain = domain ?? operationalDomain;
    if (!isUuid(nextCountryId)) {
      setExistingMainBranch(null);
      setEditingCountryBranchId("");
      setCountryBranches([]);
      return null;
    }

    const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(nextCountryId)}&operationalDomain=${effectiveDomain}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      setExistingMainBranch(null);
      setEditingCountryBranchId("");
      setCountryBranches([]);
      return null;
    }

    const json = (await res.json()) as { countryBranches?: CountryBranchRow[] };
    const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
    setCountryBranches(list);
    // The lookup also returns every main branch of the country (each is visible in both sections), so pick by section.
    const main = list.find((b) => b.is_main && (b.operational_domain || "business") === effectiveDomain) ?? null;
    if (main) {
      applySavedRow(main);
    } else {
      setExistingMainBranch(null);
      setEditingCountryBranchId("");
    }
    return { list, main };
  }

  function nextSuggestedCode(country: LocationCountry | null, existingCount: number, domain: "business" | "shipping" = "business") {
    const prefix = asIso3(country);
    if (domain === "shipping") {
      const num = String(Math.max(1, existingCount + 1)).padStart(2, "0");
      return `${prefix}-MAIN-SHIP-${num}`;
    }
    const num = String(Math.max(1, existingCount + 1)).padStart(3, "0");
    return `${prefix}-MAIN-${num}`;
  }

  async function onOperationalDomainChange(nextDomain: "business" | "shipping") {
    setOperationalDomain(nextDomain);
    setBranchCategory(nextDomain === "shipping" ? "clearing_agent" : "business");
    setBanner(null);
    setGrantsPrefilled(false);

    if (!isUuid(location.countryId)) return;

    const existing = await loadExistingMainBranch(location.countryId, nextDomain);
    if (existing?.main) {
      setBanner({ type: "success", message: existingBranchMessage(existing.main) });
    } else {
      setBranchCode(nextSuggestedCode(locationMeta.country, existing?.list?.length ?? 0, nextDomain));
    }
  }

  async function onLocationChange(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    const isCountryChanged = next.countryId !== location.countryId;
    setLocation(next);
    setLocationMeta(meta);

    if (isCountryChanged) {
      setBanner(null);
      if (editingCountryBranchId && next.countryId === location.countryId) {
        if (meta.country?.currency_code) {
          setCurrency(meta.country.currency_code.toUpperCase());
        }
        return;
      }

      setFullAddress("");
      setBranchType(next.countryId ? "MAIN" : "");
      setExistingMainBranch(null);
      setCountryBranches([]);
      setCountryBranchSearch("");
      setBranchCode("");
      setEditingCountryBranchId("");
      setGrantsPrefilled(false);

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
      }

      if (!isUuid(next.countryId)) return;

      const existing = await loadExistingMainBranch(next.countryId, operationalDomain);
      if (existing?.main) {
        setBanner({ type: "success", message: existingBranchMessage(existing.main) });
        return;
      }

      setBranchCode(nextSuggestedCode(meta.country, existing?.list?.length ?? 0, operationalDomain));
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

  /** Maps a failed save response to the text shown. Known codes use the page's translations. */
  function saveErrorMessage(json: SaveResponse & { error?: unknown; code?: string; existingBranch?: { id?: string } }, status: number) {
    if (json?.code === "MAIN_BRANCH_EXISTS") {
      return json.existingBranch?.id
        ? existingBranchMessage(json.existingBranch as CountryBranchRow)
        : tt("cnbs.existing_loaded", "A main branch already exists for this country and section. It is loaded now. Saving updates it; no duplicate is created.");
    }
    if (json?.code === "COUNTRY_CURRENCY_MISSING") return tt("cnbs.country_no_currency", "The selected country has no currency code. Set it in Location settings, then save again.");
    if (json?.code === "DUPLICATE_BRANCH") return tt("cnbs.err_duplicate_branch", "Branch Code is already used by another Country branch in this country. Use a different Branch Code.");
    const fallback = status >= 500 ? tt("cbs.save_failed_generic", "The server did not return a reason. Please try again.") : tt("cnbs.save_failed", "The country main branch could not be saved.");
    return describeCityBranchServerError(json, fallback, fieldLabel);
  }

  /**
   * Save and Approve & Activate both come here. A record id (edit, or an existing main branch of this
   * country and section) is updated with PUT; otherwise a new main is created with POST. A duplicate
   * conflict re-targets the existing branch once, so a repeated approval never creates a second main.
   */
  async function submitCountryBranch(targetId: string, allowRetry: boolean): Promise<void> {
    setBanner(null);

    if (!isUuid(location.countryId)) {
      setBanner({ type: "error", message: tt("cnbs.err_country_required", "Please select a valid country from Location Settings.") });
      return;
    }
    if (!isUuid(location.stateProvinceId) || !isUuid(location.cityId)) {
      setBanner({ type: "error", message: tt("cnbs.err_state_city_required", "Please select State/Province and City from Location Settings.") });
      return;
    }
    if (!branchCode.trim()) {
      setBanner({ type: "error", message: tt("cnbs.err_branch_code_required", "Branch Code is required.") });
      return;
    }
    if (!branchEmail.trim() || !branchEmail.includes("@")) {
      setBanner({ type: "error", message: tt("cnbs.err_branch_email_required", "Branch Email (Hostinger Titan Mailbox) is required.") });
      return;
    }
    if (!permissionTemplate || !permissionGrants.length) {
      setBanner({ type: "error", message: tt("cnbs.err_permissions_required", "Please select a Role Template and at least one permission before saving the Country.") });
      return;
    }

    const branchName = resolvedBranchName || `${locationMeta.country?.name || "Country"} Main Branch`;
    const isUpdate = Boolean(targetId);

    setSaving(true);
    try {
      const email = branchEmail.trim().toLowerCase();
      const phone = contactsPayload.find((row) => row.type.toLowerCase().includes("phone") || row.type.toLowerCase().includes("mobile"))?.value;
      const whatsappNumber = contactsPayload.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value;

      const res = await fetch("/api/branch-management/country-branches", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: targetId || undefined,
          countryId: location.countryId,
          operationalDomain,
          name: branchName,
          code: branchCode.trim(),
          stateProvinceId: location.stateProvinceId || undefined,
          districtId: location.districtId || undefined,
          cityId: location.cityId || undefined,
          address: fullAddress.trim() || undefined,
          phone: phone || undefined,
          email,
          whatsappNumber: whatsappNumber || undefined,
          companyId: companyId || undefined,
          ownerName: ownerName.trim() || undefined,
          ownerCustomerId: ownerCustomerId || undefined,
          ownerProfileId: ownerProfileId || undefined,
          permissionTemplate,
          permissionGrants,
          contacts: contactsPayload.length ? contactsPayload : undefined
        })
      });

      const json = (await res.json().catch(() => ({}))) as SaveResponse & { error?: unknown; code?: string; existingBranch?: CountryBranchRow };
      if (!res.ok) {
        if (json?.code === "MAIN_BRANCH_EXISTS" && json.existingBranch?.id && allowRetry && !isUpdate) {
          // The main branch exists already: continue as an update of that same record.
          await loadExistingMainBranch(location.countryId, operationalDomain);
          return await submitCountryBranch(String(json.existingBranch.id), false);
        }
        if (json?.code === "MAIN_BRANCH_EXISTS") {
          await loadExistingMainBranch(location.countryId, operationalDomain);
        }
        setBanner({ type: "error", message: saveErrorMessage(json, res.status) });
        return;
      }

      const savedId = String(json.id || targetId || "");
      setEditingCountryBranchId(savedId);
      // Reload the saved record so the form, checklist and final review show what the database holds.
      await loadExistingMainBranch(location.countryId, operationalDomain);

      const visibleIn = json.domainAccess
        ? [
            json.domainAccess.business ? tt("cbs.domain_business", "Business & Trading") : "",
            json.domainAccess.shipping ? tt("cbs.domain_shipping", "Shipping Line & Clearing Agent") : ""
          ].filter(Boolean).join(" · ")
        : "";
      const lines = [
        isUpdate ? tt("cnbs.updated_ok", "Country main branch updated.") : tt("cnbs.saved_ok", "Country main branch saved."),
        `${json.name || branchName} (${json.code || branchCode.trim().toUpperCase()})`,
        visibleIn ? `${tt("cnbs.available_in", "Available in")}: ${visibleIn}` : "",
        ...(Array.isArray(json.warnings) ? json.warnings : [])
      ].filter(Boolean);
      setBanner({ type: "success", message: lines.join("\n") });
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error && err.message ? err.message : tt("cnbs.save_failed", "The country main branch could not be saved.") });
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCountryBranch(editingCountryBranchId, true);
  }

  function onReset() {
    setBanner(null);
    setLocation({ countryId: "", stateProvinceId: "", districtId: "", cityId: "", areaId: "" });
    setLocationMeta({ country: null, state: null, district: null, city: null, area: null });
    setCurrency("");
    setBranchEmail("");
    setFullAddress("");
    setCompanyId("");
    setCompanyView(null);
    setCompanyBankCount(0);
    setOwnerName("");
    setOwnerId("");
    setOwnerCustomerId(null);
    setOwnerProfileId(null);
    setOwnerView(null);
    setContacts([]);
    setExistingMainBranch(null);
    setEditingCountryBranchId("");
    setSavedDetail(null);
    setDetailFailed("");
    setGrantsPrefilled(false);
    setCountryBranches([]);
    setCountryBranchSearch("");
    setBranchType("");
    setBranchCode("");
    setPermissionTemplate(COUNTRY_DEFAULT_PERMISSION_TEMPLATE);
    setPermissionGrants(getPermissionKeysForTemplate(COUNTRY_DEFAULT_PERMISSION_TEMPLATE));
    setActiveStep(1);
  }

  if (activeStep === 9) {
    return (
      <div className="space-y-6">
        {linkedRecordFailed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {tt("cnbs.linked_record_failed", "Company or owner details could not be loaded from their saved records.")}
          </div>
        ) : null}
        {detailFailed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {detailFailed === "NO_DATABASE" ? tt("cbs.detail_no_database", "Location names and linked users cannot be loaded: the database connection is not configured.") : tt("cnbs.detail_load_failed", "The saved branch details could not be loaded.")}
          </div>
        ) : null}
        {grantsPrefilled ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {tt("cnbs.grants_prefilled", "No valid permissions were stored on this branch, so the Country Standard template is pre-selected. Review the permissions, then save.")}
          </div>
        ) : null}
        <BranchFinalReview
          branchLevel="country"
          branchLevelTitle={tt("cnbs.title", "Country Branch")}
          branchName={resolvedBranchName || tt("cnbs.title", "Country Branch")}
          branchCode={branchCode.trim()}
          branchType={tt("branch.report_country_main_branch", "Country Main Branch")}
          category={branchCategory === "clearing_agent" ? tt("cbs.category_clearing_agent", "Clearing Agent") : tt("cbs.category_business", "Business Branch")}
          country={countryName}
          stateProvince={locationMeta.state?.name || ""}
          city={locationMeta.city?.name || ""}
          fullAddress={fullAddress.trim()}
          companyName={companyView?.name || ""}
          businessDomain={operationalDomain === "business" ? domainLabel("business", tt) : "—"}
          shippingDomain={operationalDomain === "shipping" ? domainLabel("shipping", tt) : "—"}
          currency={currency || locationMeta.country?.currency_code?.toUpperCase() || ""}
          mainBranchName="—"
          documents={documentItems}
          usersAndPermissions={userItems}
          sampleFallback={false}
          showSavedBanner={false}
          emptyDocumentsText={tt("cbs.docs_empty", "No documents are linked to this branch yet. Documents uploaded in the document module appear here.")}
          emptyUsersText={tt("cbs.users_empty", "No users are assigned to this branch yet.")}
          isSaving={saving}
          isEditing={Boolean(editingCountryBranchId)}
          checklistStatus={checklist.status}
          onBack={() => setActiveStep(8)}
          onGoToStep={(step) => {
            if (step === 1) setActiveStep(1);
            else if (step === 2) setActiveStep(3);
            else if (step === 3) setActiveStep(2);
            else if (step === 4) setActiveStep(4);
            else if (step === 5) setActiveStep(7);
            else if (step === 6) setActiveStep(6);
            else setActiveStep(9);
          }}
          onEditSection={(sec) => {
            if (sec === "branch_info") setActiveStep(1);
            else if (sec === "location") setActiveStep(2);
            else if (sec === "company") setActiveStep(3);
            else if (sec === "documents") setActiveStep(6);
            else if (sec === "roles") setActiveStep(7);
          }}
          onApproveAndActivate={async () => {
            await submitCountryBranch(editingCountryBranchId, true);
          }}
          onSendBackForEdit={() => setActiveStep(1)}
          onRequestChanges={() => {
            setBanner({ type: "error", message: tt("cnbs.request_changes_unavailable", "Request Changes is not connected to a workflow for country branches yet. Nothing was sent.") });
          }}
          onViewSummary={viewReport}
          onPrint={printReport}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{t(lang, "cnbs.new_entry")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t(lang, "cnbs.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(lang, "cnbs.subtitle")}
          </p>
        </div>
        <span className={pillClassName()}>
          <b>{t(lang, "cnbs.rule_label")}</b> {t(lang, "cnbs.rule_desc")}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto -mx-1 px-1" aria-label={t(lang, "cnbs.wizard_sequence_aria", "Country branch wizard sequence")}>
          <div className="flex gap-2 min-w-max">
          {[
            ["1", t(lang, "cnbs.step1_title"), t(lang, "cnbs.step1_desc")],
            ["2", t(lang, "cnbs.step2_title"), t(lang, "cnbs.step2_desc")],
            ["3", t(lang, "cnbs.step3_title"), t(lang, "cnbs.step3_desc")],
            ["4", t(lang, "cnbs.step4_title"), t(lang, "cnbs.step4_desc")],
            ["5", t(lang, "cnbs.step5_title"), t(lang, "cnbs.step5_desc")],
            ["6", t(lang, "cnbs.step6_title"), t(lang, "cnbs.step6_desc")],
            ["7", t(lang, "cnbs.step7_title"), t(lang, "cnbs.step7_desc")],
            ["8", t(lang, "cnbs.step8_title"), t(lang, "cnbs.step8_desc")],
            ["9", t(lang, "cnbs.step9_title"), t(lang, "cnbs.step9_desc")]
          ].map(([no, title, desc]) => (
            <div
              key={no}
              role="button"
              tabIndex={0}
              onClick={() => setActiveStep(Number(no))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveStep(Number(no)); }}
              className={cn(
                "rounded-xl border px-3 py-2 transition min-w-[120px] max-w-[140px] flex-shrink-0 cursor-pointer select-none hover:border-cyan-400",
                Number(no) === activeStep
                  ? "border-cyan-500 bg-cyan-50 shadow-sm ring-1 ring-cyan-200 dark:border-cyan-500 dark:bg-cyan-950/40"
                  : "border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/50"
              )}
            >
              <div className="flex items-start gap-2">
                <span className={cn("flex h-6 w-6 min-w-6 min-h-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold", Number(no) === activeStep ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200")}>{no}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">{title}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-500 line-clamp-2">{desc}</p>
            </div>
          ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500">{t(lang, "cbs.step_word")} {activeStep} {t(lang, "cbs.of_9")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || activeStep === 1}
              onClick={() => setActiveStep((step) => Math.max(1, step - 1))}
              className="font-bold text-xs h-8 px-3.5 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
            >
              ← {t(lang, "common.back")}
            </Button>
            {activeStep < 9 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setActiveStep((step) => Math.min(9, step + 1))}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm h-8 px-4 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <span>{t(lang, "common.next")}</span>
                <span className="text-sm font-black">→</span>
              </Button>
            ) : (
              <Button
                type="submit"
                form="country-branch-wizard-form"
                size="sm"
                disabled={saving || !location.countryId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm h-8 px-4 cursor-pointer disabled:opacity-40"
              >
                {saving ? t(lang, "common.saving") : editingCountryBranchId ? t(lang, "cnbs.update_branch") : t(lang, "cbs.accept_save")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1600px] mx-auto items-start">
        <div className={cn(activeStep === 9 ? "hidden" : "lg:col-span-7 xl:col-span-7", "space-y-6 w-full")}>
          <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>{t(lang, "cnbs.setup_title")}</CardTitle>
          </CardHeader>

          <CardContent>
            {editLoading ? (
              <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
                {t(lang, "cnbs.loading_edit")}
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
                    {t(lang, "cbs.edit_existing_branch")}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <form id="country-branch-wizard-form" onSubmit={onSubmit} onReset={onReset} className="flex flex-col gap-6">
              <section hidden={activeStep !== 1} className="order-1 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cnbs.step1_section_title")}</h2>
                </div>

                <div className="space-y-4">
                  <LocationHierarchySelect
                    value={location}
                    showCountry={true}
                    showState={true}
                    showDistrict={true}
                    showCity={true}
                    showArea={true}
                    allowManageLink={true}
                    onChange={onLocationChange}
                  />

                  {/* Branch Business Nature / Type Selector */}
                  <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 font-sans">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {lang === "ur" ? "برانچ کی نوعیت / بزنس کی قسم *" : lang === "ar" ? "نوع ونشاط الفرع *" : lang === "ps" ? "د څانګې ډول *" : lang === "fa" ? "نوعیت شعبه *" : "Branch Business Nature / Type *"}
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => void onOperationalDomainChange("business")}
                        className={`p-3 rounded-xl border text-start flex items-center gap-3 transition-all ${
                          operationalDomain === "business"
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 font-bold shadow-xs ring-1 ring-indigo-400/30"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-2xl">🏢</span>
                        <div>
                          <div className="text-xs font-bold">{lang === "ur" ? "بزنس و کارپوریٹ برانچ" : lang === "ar" ? "فرع تجاري / أعمال" : lang === "ps" ? "تجارتي / بزنس څانګه" : lang === "fa" ? "شعبه تجاری و شرکتی" : "Business & Corporate Branch"}</div>
                          <div className="text-[11px] text-slate-500">{t(lang, "cbs.general_commercial_ops", "General commercial & trading operations")}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onOperationalDomainChange("shipping")}
                        className={`p-3 rounded-xl border text-start flex items-center gap-3 transition-all ${
                          operationalDomain === "shipping"
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 font-bold shadow-xs ring-1 ring-blue-400/30"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-2xl">🚢</span>
                        <div>
                          <div className="text-xs font-bold">{lang === "ur" ? "کسٹم کلیئرنگ ایجنٹ و شپنگ لائن" : lang === "ar" ? "فرع التخليص الجمركي وخط الشحن" : lang === "ps" ? "ګمرکي کلیرنګ ایجنټ او د کښتۍ لاین" : lang === "fa" ? "کارگزاری گمرک و خط کشتیرانی" : "Clearing Agent & Shipping Line"}</div>
                          <div className="text-[11px] text-slate-500">{t(lang, "cbs.ports_shipping_customs", "Ports, shipping lines & customs clearing")}</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{t(lang, "cbs.currency_label")}</Label>
                      <Input value={currency} readOnly placeholder={t(lang, "cnbs.currency_auto_placeholder")} className="bg-muted/50 font-semibold" />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{t(lang, "cbs.zip_postal_code")}</Label>
                      <Input value={zip} readOnly placeholder={t(lang, "cnbs.zip_auto_placeholder")} className="bg-muted/50 font-semibold" />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{t(lang, "cbs.branch_code")}</Label>
                      <Input value={branchCode} readOnly placeholder={t(lang, "cnbs.branch_code_auto")} className="bg-muted/50 font-mono font-semibold" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {t(lang, "cnbs.branch_email")}
                    </Label>
                    <Input
                      type="email"
                      required
                      value={branchEmail}
                      onChange={(e) => setBranchEmail(e.target.value)}
                      placeholder={t(lang, "cnbs.branch_email_ph", "e.g. dubai@dgtllc.com or khi@dgtllc.com")}
                      className="h-9 text-xs font-medium"
                    />
                    <p className="text-[11px] text-slate-500">
                      {t(lang, "cnbs.branch_email_hint")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{t(lang, "cbs.full_address")}</Label>
                    <textarea
                      value={fullAddress}
                      onChange={(event) => setFullAddress(event.target.value)}
                      placeholder={tt("cnbs.address_ph", "Area / Road, Building, Street, Landmark, etc.")}
                      className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <input type="hidden" value={branchType} readOnly />
              </section>

              <section hidden={activeStep !== 3} className="order-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cnbs.step3_section_title")}</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <CompanyPicker
                      label={t(lang, "cnbs.company_name_label")}
                      value={companyId}
                      onValueChange={setCompanyId}
                      placeholder={t(lang, "cnbs.search_company")}
                      createButtonPlacement="below"
                    />
                  </div>
                  <div className="space-y-2">
                    <BranchOwnerPicker
                      value={ownerId}
                      companyId={companyId}
                      countryId={location.countryId}
                      onValueChange={setOwnerId}
                      onOwnerResolved={(owner, customer) => {
                        // The owner record itself is loaded by the company / owner loader (one source for every view).
                        if (customer) {
                          setOwnerName(customer.customer_name);
                          setOwnerCustomerId(customer.id);
                          setOwnerProfileId(null);
                        } else if (!owner) {
                          setOwnerName("");
                          setOwnerCustomerId(null);
                          setOwnerProfileId(null);
                        } else {
                          setOwnerName(owner.name);
                          setOwnerCustomerId(owner.kind === "customer" ? owner.id : null);
                          setOwnerProfileId(owner.kind === "profile" ? owner.id : null);
                        }
                      }}
                      placeholder={t(lang, "cnbs.search_owner")}
                      createButtonPlacement="below"
                    />
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 4} className="order-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">4</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cnbs.step4_section_title")}</h2>
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
                        <option value="">{t(lang, "cnbs.select_type")}</option>
                        {contactTypeOptions.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                        <option value="__new__">{t(lang, "cnbs.add_new_type")}</option>
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
                          placeholder={t(lang, "cnbs.enter_value")}
                        />
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        onClick={() => setContacts((current) => current.filter((_, i) => i !== idx))}
                      >
                        {t(lang, "common.remove")}
                      </Button>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setContacts((current) => [...current, { type: "", value: "" }])}>
                      + {t(lang, "cnbs.add_contact", "Add Contact")}
                    </Button>
                  </div>
                </div>
              </section>

              <section hidden={activeStep !== 7} className="order-7 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">5</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cnbs.step7_section_title")}</h2>
                </div>
                <PermissionAssignmentSection
                  level="country"
                  template={permissionTemplate}
                  selected={permissionGrants}
                  onTemplateChange={setPermissionTemplate}
                  onSelectedChange={setPermissionGrants}
                  required
                  note={t(lang, "cnbs.permission_note", "Super Admin must grant the Country permissions explicitly before saving.")}
                />
              </section>

              <div className="order-last flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving || activeStep === 1}
                    onClick={() => {
                      setActiveStep((step) => Math.max(1, step - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="font-bold text-xs h-9 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
                  >
                    {t(lang, "common.previous", "Previous")}
                  </Button>
                  <Button
                    type="reset"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    className="text-xs text-muted-foreground hover:text-foreground h-9 px-3"
                  >
                    {t(lang, "common.reset")}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {activeStep < 9 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setActiveStep((step) => Math.min(9, step + 1));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm h-9 px-5 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <span>{t(lang, "common.next")}</span>
                      <span className="text-sm font-black">→</span>
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={saving || !location.countryId}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm h-9 px-6 cursor-pointer disabled:opacity-40"
                    >
                      {saving ? t(lang, "common.saving") : editingCountryBranchId ? t(lang, "cnbs.update_country_branch") : t(lang, "cnbs.accept_save_country_branch")}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className={cn(activeStep === 9 ? "col-span-12 w-full max-w-5xl mx-auto space-y-5" : "lg:col-span-5 xl:col-span-5 w-full space-y-4 lg:sticky lg:top-4")}>
        {activeStep === 9 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>📋</span>
                <span>{tt("cnbs.step9_review_title", "Country Main Branch — Final Review & Live Preview")}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {tt("cnbs.step9_review_desc", "Please verify all corporate details and branch specifications before confirming. Only 1 Main Branch is permitted per country.")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveStep(8);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="font-bold text-xs h-8 px-3.5 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ← {t(lang, "cbs.back_to_edit")}
              </Button>
              {existingMainBranch && !editingCountryBranchId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold text-xs h-8 px-3.5"
                  onClick={() => beginEditCountryBranch(existingMainBranch)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden />
                  {t(lang, "cbs.edit_existing_branch")}
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="country-branch-wizard-form"
                  disabled={saving || !location.countryId}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm h-8 px-5 cursor-pointer disabled:opacity-40"
                >
                  {saving ? t(lang, "common.saving") : editingCountryBranchId ? t(lang, "cnbs.update_country_branch") : t(lang, "cnbs.accept_save_country_branch")}
                </Button>
              )}
            </div>
          </div>
        )}

        {activeStep === 9 && existingMainBranch && !editingCountryBranchId && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span className="text-base">⚠️</span>
              <span>{tt("cnbs.existing_branch_alert_title", "Country Main Branch Already Exists")}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed">
              A Main Branch already exists for {previewCountry}: <strong>{existingMainBranch.name}</strong> ({existingMainBranch.code}).
              Under system rules, each country can have only <strong>1 Country Main Branch</strong>. All other offices in this country must be created as <strong>City Branches</strong>.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 px-4"
                onClick={() => beginEditCountryBranch(existingMainBranch)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                {t(lang, "cbs.edit_existing_branch")}
              </Button>
            </div>
          </div>
        )}

        {activeStep === 9 && banner && (
          <div
            className={
              banner.type === "success"
                ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                : "rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
            }
            role="status"
          >
            <div className="whitespace-pre-line font-medium">{banner.message}</div>
          </div>
        )}

          <BranchLiveReportPanel
            title={tt("cnbs.live_preview_title", "Store Entry (Live Preview)")}
            status={hasAny ? "Draft" : "Empty"}
            branchData={liveBranchData}
            summary={[
              { label: tt("cnbs.branch", "Branch"), value: branchType || "-" },
              { label: tt("cnbs.country", "Country"), value: previewCountry || "-" },
              { label: tt("cnbs.currency", "Currency"), value: currency || "-" }
            ]}
            actions={
              <BranchReportActionsMenu
                ariaLabel={tt("cnbs.actions_aria", "Country branch actions")}
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
                title: tt("cnbs.step1_company_owner", "Step 1 - Company & Owner"),
                rows: [
                  { label: tt("cnbs.company_name", "Company Name"), value: companyView?.name || "-" },
                  { label: tt("cnbs.company_code", "Company Code"), value: companyView?.companyCode || "-" },
                  { label: tt("cnbs.legal_name", "Legal Name"), value: companyView?.legalName || "-" },
                  { label: tt("cbs.pr_tax_no", "Tax / NTN No."), value: companyView?.taxNumber || "-" },
                  { label: tt("cnbs.base_currency", "Base Currency"), value: companyView?.baseCurrency || "-" },
                  { label: tt("cnbs.owner", "Owner"), value: ownerForView?.name || ownerName || "-" },
                  { label: tt("cnbs.owner_code", "Owner Code"), value: ownerForView?.code || "-" },
                  { label: tt("cnbs.source", "Source"), value: ownerForView ? ownerForView.source : "-" }
                ]
              },
              {
                title: tt("cnbs.step2_location", "Step 2 - Location"),
                rows: [
                  { label: tt("cnbs.country", "Country"), value: previewCountry || "-" },
                  { label: tt("cnbs.country_code", "Country Code"), value: locationMeta.country?.iso2 || locationMeta.country?.iso3 || "-" },
                  { label: tt("cnbs.state", "State"), value: locationMeta.state?.name || "-" },
                  { label: tt("cnbs.state_code", "State Code"), value: locationMeta.state?.code || "-" },
                  { label: tt("cnbs.district", "District"), value: locationMeta.district?.name || "-" },
                  { label: tt("cnbs.city", "City"), value: locationMeta.city?.name || "-" },
                  { label: tt("cnbs.city_code", "City Code"), value: locationMeta.city?.code || "-" },
                  { label: tt("cnbs.branch_name", "Branch Name"), value: locationMeta.country?.name ? `${locationMeta.country.name} Main Branch` : "-" },
                  { label: tt("cnbs.branch_code", "Branch Code"), value: branchCode || "-" },
                  { label: tt("cnbs.zip_postal", "Zip / Postal Code"), value: zip || "-" }
                ]
              },
              {
                title: tt("cnbs.step3_contact_address", "Step 3 - Contact & Address"),
                rows: [
                  { label: tt("cnbs.currency", "Currency"), value: currency || "-" },
                  { label: tt("cnbs.address", "Address"), value: fullAddress || "-" },
                  { label: tt("cnbs.contacts", "Contacts"), value: contactItems.length ? contactItems.join(", ") : "-" }
                ]
              },
              {
                title: tt("cnbs.step4_roles_perms", "Step 4 - Roles & Permissions"),
                rows: [
                  { label: tt("cnbs.role_template", "Role Template"), value: permissionTemplate || "-" },
                  { label: tt("cnbs.permission_count", "Permission Count"), value: String(permissionGrants.length) },
                  { label: tt("cnbs.permissions", "Permissions"), value: permissionGrants.length ? permissionGrants.join(", ") : "-" }
                ]
              }
            ]}
            footer={
              <div className="space-y-3">
                {editingCountryBranchId ? (
                  <BranchRecordProfile
                    title={tt("cnbs.editing_title", "Editing Existing Branch")}
                    subtitle={tt("cnbs.editing_subtitle", "Saved data, completed fields, and missing information.")}
                    identity={editIdentityRows}
                    sections={editProfileSections}
                  />
                ) : null}
                {hasAny ? (
                  <>
                    {existingMainBranch ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                        {t(lang, "cnbs.main_branch_exists")} <b>{existingMainBranch.name}</b> ({existingMainBranch.code})
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ms-3 h-7"
                          onClick={() => beginEditCountryBranch(existingMainBranch)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          {t(lang, "cnbs.edit_existing_short")}
                        </Button>
                      </div>
                    ) : null}

                    <details className="border-t pt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">{t(lang, "cnbs.saved_branches")}</summary>
                      {!location.countryId ? (
                        <p className="mt-2 text-xs text-muted-foreground">{t(lang, "cnbs.select_country_load")}</p>
                      ) : countryBranches.length ? (
                        <div className="mt-2 space-y-2">
                          <Input
                            value={countryBranchSearch}
                            onChange={(event) => setCountryBranchSearch(event.target.value)}
                            placeholder={t(lang, "cnbs.search_branches")}
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
                                    {t(lang, "common.view")}
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => beginEditCountryBranch(b)}>
                                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                                    {t(lang, "common.edit")}
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
                        <p className="mt-2 text-xs text-muted-foreground">{t(lang, "cnbs.no_saved_branches")}</p>
                      )}
                    </details>
                  </>
                ) : null}
              </div>
            }
          />

          {activeStep === 9 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveStep(8);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="font-bold text-xs h-9 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ← {t(lang, "cbs.back_to_edit")}
              </Button>
              {existingMainBranch && !editingCountryBranchId ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    Main branch already registered for {previewCountry}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => beginEditCountryBranch(existingMainBranch)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm h-9 px-5 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                    {t(lang, "cbs.edit_existing_branch")}
                  </Button>
                </div>
              ) : (
                <Button
                  type="submit"
                  form="country-branch-wizard-form"
                  disabled={saving || !location.countryId}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm h-9 px-6 cursor-pointer disabled:opacity-40"
                >
                  {saving ? t(lang, "common.saving") : editingCountryBranchId ? t(lang, "cnbs.update_country_branch") : t(lang, "cnbs.accept_save_country_branch")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerBranchData !== null}
        onClose={() => setDrawerBranchData(null)}
        title={tt("cnbs.details_title", "Country Branch Details")}
        subtitle={tt("cnbs.details_subtitle", "Verification certificate and branch permissions")}
      >
        {drawerBranchData && (
          <BranchLiveReportPanel
            title={tt("cnbs.saved_branch_title", "Saved Country Branch")}
            status={drawerBranchData.branchStatus ?? ""}
            branchData={drawerBranchData}
          />
        )}
      </DetailDrawer>
    </div>
  );
}

export function CountryBranchSetup() {
  const lang = useActiveLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-slate-500">{t(lang, "cnbs.loading_wizard")}</div>}>
      <CountryBranchSetupContent />
    </Suspense>
  );
}






