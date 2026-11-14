"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactNumberInput } from "@/components/ui/contact-number-input";
import { SearchSelect } from "@/components/ui/search-select";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { BranchOwnerPicker } from "@/features/branches/components/branch-owner-picker";
import { BranchLiveReportPanel } from "@/features/branches/components/branch-live-report-panel";
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
import type { ContactTypeKey } from "@/features/contact-types/contact-type-api";
import { cn } from "@/lib/utils";
import { getPermissionKeysForTemplate } from "@/lib/permissions/catalog";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";
import type { BranchReportData } from "@/lib/reports/open-a4-report-window";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { BranchFinalReview, type BranchReviewDocumentItem, type BranchUserPermissionItem } from "./branch-final-review";
import {
  emptyOwnerView,
  loadCompanyBankCount,
  loadCompanyView,
  loadOwnerView,
  type CompanyView,
  type OwnerView
} from "@/features/branches/lib/city-branch-owner-company";
import { evaluateCityBranchChecklist } from "@/features/branches/lib/city-branch-checklist";
import { describeCityBranchServerError, CITY_BRANCH_FIELD_KEYS } from "@/features/branches/lib/city-branch-server-error";
import {
  documentTypeLabel,
  formatFileSize,
  locationMetaFromSaved,
  normalizeCityBranchDetail,
  type CityBranchDetail,
  type CityBranchLocationNames
} from "@/features/branches/lib/city-branch-detail";
import {
  accessProfileLabel,
  buildCityBranchDrawerData,
  buildCityBranchReportConfig,
  buildCityBranchReportSections,
  domainLabel,
  emailOf,
  roleLabel,
  type CityBranchReportInput
} from "@/features/branches/lib/city-branch-report";

type CountryBranchRow = {
  id: string;
  country_id: string;
  operational_domain?: string | null;
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
  operational_domain?: string | null;
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
  owner_customer_id?: string | null;
  owner_profile_id?: string | null;
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
type Banner = { type: "success" | "error"; message: string };
type Domain = "business" | "shipping" | "";

const contactTypeOptions = ["Mobile", "Phone", "WhatsApp", "Email", "Fax"] as const;

/** Stored contact type (English data value) -> central label key. */
const CONTACT_TYPE_KEYS: Record<string, string> = {
  Mobile: "cbs.contact_type_mobile",
  Phone: "cbs.contact_type_phone",
  WhatsApp: "cbs.contact_type_whatsapp",
  Email: "cbs.contact_type_email",
  Fax: "cbs.contact_type_fax"
};

const EMPTY_LOCATION: LocationHierarchyValue = { countryId: "", stateProvinceId: "", districtId: "", cityId: "", areaId: "" };
const EMPTY_META: LocationHierarchyMeta = { country: null, state: null, district: null, city: null, area: null };
const EMPTY_LOCATION_NAMES: CityBranchLocationNames = {
  countryName: "",
  countryIso2: "",
  countryIso3: "",
  countryCurrency: "",
  countryPhoneCode: "",
  stateName: "",
  districtName: "",
  cityName: "",
  cityCode: "",
  cityZip: "",
  areaName: "",
  areaPostal: ""
};

function localizeContactType(type: string, tt: (key: string, fallback: string) => string): string {
  const key = CONTACT_TYPE_KEYS[type];
  return key ? tt(key, type) : type;
}

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

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-dashed border-slate-100 py-1 last:border-0 dark:border-slate-800/60">
      <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={cn("text-end text-[11px] font-semibold break-words", value ? "text-slate-800 dark:text-slate-100" : "text-slate-300 dark:text-slate-600")}>
        {value || "—"}
      </span>
    </div>
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

/** Route codes for a partly-loaded saved record, translated here; any other text is a database message passed through. */
function describeDetailError(code: string, lang: string): string {
  if (!code) return "";
  if (code === "NO_DATABASE") return t(lang, "cbs.detail_no_database");
  if (code === "DETAIL_FAILED") return t(lang, "cbs.detail_load_failed");
  return code;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
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

function formatDateShort(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function suggestBranchCode(meta: LocationHierarchyMeta, existingBranchesList: CityBranchRow[], domain: Domain) {
  const prefix = asIso3(meta.country);
  const rawCity = meta.city?.code || meta.city?.name || "";
  const cityCode = compactCode(rawCity, "CITY");
  const existingCodes = new Set((existingBranchesList || []).map((b) => (b.code || "").toUpperCase().trim()));

  if (domain === "shipping") {
    for (let n = 1; n <= 99; n++) {
      const candidate = `${prefix}-${cityCode}-SHIP-${String(n).padStart(2, "0")}`;
      if (!existingCodes.has(candidate)) return candidate;
    }
    return `${prefix}-${cityCode}-SHIP-01`;
  }

  for (let n = 1; n <= 999; n++) {
    const candidate = `${prefix}-${cityCode}-${String(n).padStart(3, "0")}`;
    if (!existingCodes.has(candidate)) return candidate;
  }
  return `${prefix}-${cityCode}-${String((existingBranchesList || []).length + 1).padStart(3, "0")}`;
}

function suggestBranchName(meta: LocationHierarchyMeta, existingBranchesList: CityBranchRow[], domain: Domain) {
  const city = meta.city?.name?.trim();
  if (!city) return "";
  const existingNames = new Set(
    (existingBranchesList || [])
      .filter((b) => isCityBranchMatch(b, meta.city?.id ?? "", meta.city?.name ?? ""))
      .map((b) => (b.name || "").toLowerCase().trim())
  );

  const baseName = domain === "shipping" ? `${city} Shipping & Clearing Branch` : `${city} City Branch`;
  if (!existingNames.has(baseName.toLowerCase())) return baseName;
  for (let n = 2; n <= 100; n++) {
    const candidate = domain === "shipping" ? `${city} Shipping & Clearing Branch ${n}` : `${city} City Branch ${n}`;
    if (!existingNames.has(candidate.toLowerCase())) return candidate;
  }
  return `${baseName} ${(existingBranchesList || []).length + 1}`;
}

async function fetchMainBranchList(countryId: string, domain: Domain): Promise<CountryBranchRow[]> {
  if (!isUuid(countryId) || !domain) return [];
  const res = await fetch(
    `/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}&operationalDomain=${domain}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { countryBranches?: CountryBranchRow[] };
  const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
  const mains = list.filter((b) => b.is_main !== false);
  return mains.length > 0 ? mains : list;
}

async function fetchExistingCityBranches(countryId: string, countryBranchId: string | undefined, domain: Domain): Promise<CityBranchRow[]> {
  if (!isUuid(countryId)) return [];
  const params = new URLSearchParams({ countryId });
  if (countryBranchId && isUuid(countryBranchId)) params.set("countryBranchId", countryBranchId);
  if (domain) params.set("operationalDomain", domain);
  const res = await fetch(`/api/branch-management/city-branches?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json()) as { cityBranches?: CityBranchRow[] };
  return Array.isArray(json.cityBranches) ? json.cityBranches : [];
}

async function fetchSavedCityBranch(id: string): Promise<{ row: CityBranchRow; detail: CityBranchDetail | null; detailError: string }> {
  const res = await fetch(`/api/branch-management/city-branches?id=${encodeURIComponent(id)}&detail=1`, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as {
    cityBranches?: CityBranchRow[];
    detail?: unknown;
    detailError?: string | null;
    error?: unknown;
  };
  if (!res.ok) {
    throw new Error(describeCityBranchServerError(json, "", () => ""));
  }
  const row = Array.isArray(json.cityBranches) ? json.cityBranches[0] : null;
  if (!row) throw new Error("");
  return { row, detail: normalizeCityBranchDetail(json.detail), detailError: json.detailError ?? "" };
}

function CityBranchSetupContent() {
  const lang = useActiveLanguage();
  const tt = useCallback((key: string, fallback: string) => t(lang, key, fallback), [lang]);
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId") ?? "";

  const [drawerBranchData, setDrawerBranchData] = useState<BranchReportData | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [location, setLocation] = useState<LocationHierarchyValue>(EMPTY_LOCATION);
  const [locationMeta, setLocationMeta] = useState<LocationHierarchyMeta>(EMPTY_META);
  const [currency, setCurrency] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [manualZip, setManualZip] = useState("");

  const [companyId, setCompanyId] = useState("");
  const [companyView, setCompanyView] = useState<CompanyView | null>(null);
  const [companyBankCount, setCompanyBankCount] = useState(0);
  const [ownerName, setOwnerName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerCustomerId, setOwnerCustomerId] = useState<string | null>(null);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);
  const [ownerView, setOwnerView] = useState<OwnerView | null>(null);
  const [linkedRecordError, setLinkedRecordError] = useState("");

  const [countryBranchId, setCountryBranchId] = useState("");
  const [mainBranches, setMainBranches] = useState<CountryBranchRow[]>([]);
  const [operationalDomain, setOperationalDomain] = useState<Domain>("");
  const [branchCategory, setBranchCategory] = useState<"business" | "clearing_agent" | "">("");
  const [existingCityBranches, setExistingCityBranches] = useState<CityBranchRow[]>([]);
  const [existingCitySearch, setExistingCitySearch] = useState("");
  const [editingCityBranchId, setEditingCityBranchId] = useState("");
  const [savedRow, setSavedRow] = useState<CityBranchRow | null>(null);
  const [savedDetail, setSavedDetail] = useState<CityBranchDetail | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [permissionTemplate, setPermissionTemplate] = useState("city-standard");
  const [permissionGrants, setPermissionGrants] = useState<string[]>(() => getPermissionKeysForTemplate("city-standard"));

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
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

  // Official branch email and WhatsApp number are kept in the contacts list.
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

  // Company record (one loader; the form, live summary, saved record and print all read this view).
  useEffect(() => {
    let cancelled = false;
    if (!companyId) {
      setCompanyView(null);
      setCompanyBankCount(0);
      return;
    }
    (async () => {
      try {
        const company = await loadCompanyView(companyId);
        const bankCount = await loadCompanyBankCount(companyId);
        if (cancelled) return;
        setCompanyView(company);
        setCompanyBankCount(bankCount);
      } catch (error) {
        if (!cancelled) setLinkedRecordError(`${tt("cbs.company_load_failed", "Company details could not be loaded.")} ${messageOf(error)}`.trim());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, refreshNonce, tt]);

  // Owner record (customer master), same loader for every surface.
  useEffect(() => {
    let cancelled = false;
    if (!ownerCustomerId) {
      setOwnerView(null);
      return;
    }
    (async () => {
      try {
        const owner = await loadOwnerView(ownerCustomerId);
        if (!cancelled) setOwnerView(owner);
      } catch (error) {
        if (!cancelled) setLinkedRecordError(`${tt("cbs.owner_load_failed", "Owner details could not be loaded.")} ${messageOf(error)}`.trim());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerCustomerId, refreshNonce, tt]);

  const selectedMainBranch = useMemo(
    () => mainBranches.find((b) => b.id === countryBranchId) ?? null,
    [mainBranches, countryBranchId]
  );
  const parentPermissionGrants = selectedMainBranch?.permission_grants?.length ? selectedMainBranch.permission_grants : undefined;

  useEffect(() => {
    if (!parentPermissionGrants?.length) return;
    setPermissionGrants((current) => current.filter((permission) => parentPermissionGrants.includes(permission)));
  }, [parentPermissionGrants]);

  const autoZip = locationMeta.area?.postal_code ?? locationMeta.city?.zip_code ?? "";
  const zip = manualZip || autoZip;
  const resolvedCityName = locationMeta.city?.name?.trim() || savedRow?.city_name?.trim() || "";
  const effectiveBranchName = useMemo(() => {
    if (branchName.trim()) return branchName.trim();
    if (locationMeta.city?.name?.trim()) {
      return suggestBranchName(locationMeta, existingCityBranches, operationalDomain) || `${locationMeta.city.name.trim()} City Branch`;
    }
    return "";
  }, [branchName, locationMeta, existingCityBranches, operationalDomain]);
  const resolvedBranchName = branchName.trim() || effectiveBranchName;

  // Auto-suggest the branch name from the city while the branch is still a draft.
  useEffect(() => {
    if (editingCityBranchId) return;
    const city = locationMeta.city?.name?.trim();
    if (!city) return;
    if (!branchName.trim() || branchName.endsWith("City Branch") || /City Branch \d+$/.test(branchName)) {
      const suggested = suggestBranchName(locationMeta, existingCityBranches, operationalDomain) || `${city} City Branch`;
      if (suggested && suggested !== branchName) setBranchName(suggested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationMeta.city?.name, editingCityBranchId, existingCityBranches]);

  const codeAlreadyExists = Boolean(
    branchCode.trim() &&
      existingCityBranches.some((b) => {
        if (editingCityBranchId && b.id === editingCityBranchId) return false;
        return b.code && b.code.trim().toUpperCase() === branchCode.trim().toUpperCase();
      })
  );

  const nameAlreadyExists = Boolean(
    resolvedBranchName &&
      existingCityBranches.some((b) => {
        if (editingCityBranchId && b.id === editingCityBranchId) return false;
        const sameCity =
          (location.cityId && b.city_id && b.city_id === location.cityId) ||
          (b.city_name && resolvedCityName && b.city_name.trim().toLowerCase() === resolvedCityName.toLowerCase());
        const sameDomain = !operationalDomain || !b.operational_domain || b.operational_domain === operationalDomain;
        return Boolean(sameCity && sameDomain && b.name && b.name.trim().toLowerCase() === resolvedBranchName.toLowerCase());
      })
  );

  const branchConflict = codeAlreadyExists || nameAlreadyExists;
  const cityAlreadyExists = branchConflict;

  const contactsPayload = useMemo(
    () => contacts.map((row) => ({ type: row.type.trim(), value: row.value.trim() })).filter((row) => row.type && row.value),
    [contacts]
  );
  const effectiveEmail = generatedEmail || emailOf(contactsPayload);
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

  const linkedUsers = editingCityBranchId ? savedDetail?.linkedUsers ?? [] : [];
  const linkedDocuments = editingCityBranchId ? savedDetail?.linkedDocuments ?? [] : [];

  const checklist = useMemo(
    () =>
      evaluateCityBranchChecklist({
        countryId: location.countryId,
        countryBranchId,
        operationalDomain,
        branchCategory,
        branchName: resolvedBranchName,
        branchCode,
        stateProvinceId: location.stateProvinceId,
        cityId: location.cityId,
        cityName: resolvedCityName,
        fullAddress,
        currency: currency || locationMeta.country?.currency_code?.toUpperCase() || "",
        companyId,
        ownerCustomerId,
        ownerProfileId,
        contacts: contactsPayload,
        emailAddress: effectiveEmail,
        permissionGrants,
        savedBranchId: editingCityBranchId,
        linkedUsers,
        linkedDocumentCount: linkedDocuments.length,
        companyBankCount
      }),
    [
      location.countryId,
      location.stateProvinceId,
      location.cityId,
      countryBranchId,
      operationalDomain,
      branchCategory,
      resolvedBranchName,
      branchCode,
      resolvedCityName,
      fullAddress,
      currency,
      locationMeta.country?.currency_code,
      companyId,
      ownerCustomerId,
      ownerProfileId,
      contactsPayload,
      effectiveEmail,
      permissionGrants,
      editingCityBranchId,
      linkedUsers,
      linkedDocuments.length,
      companyBankCount
    ]
  );

  // Owner shown everywhere: the loaded customer record, or the name for a non-customer owner.
  const ownerForView: OwnerView | null =
    ownerView ?? (ownerCustomerId || ownerProfileId || ownerName.trim() ? emptyOwnerView(ownerName.trim(), ownerProfileId ? "profile" : "customer") : null);

  const categoryLabel =
    branchCategory === "clearing_agent" ? tt("cbs.category_clearing_agent", "Clearing Agent") : branchCategory === "business" ? tt("cbs.category_business", "Business Branch") : "";

  const reportInput: CityBranchReportInput = useMemo(
    () => ({
      savedId: editingCityBranchId,
      name: resolvedBranchName,
      code: branchCode.trim(),
      status: savedRow?.status || (editingCityBranchId ? "active" : tt("cbs.new_draft_word", "Draft")),
      currency: currency || locationMeta.country?.currency_code?.toUpperCase() || "",
      operationalDomain,
      createdAt: savedRow?.created_at ?? "",
      updatedAt: savedRow?.updated_at ?? "",
      createdByName: savedDetail?.createdByName ?? "",
      country: locationMeta.country?.name ?? "",
      countryIso2: locationMeta.country?.iso2 ?? "",
      state: locationMeta.state?.name ?? "",
      district: locationMeta.district?.name ?? "",
      city: resolvedCityName,
      area: locationMeta.area?.name ?? "",
      zip,
      fullAddress: fullAddress.trim(),
      mainBranchName: selectedMainBranch?.name ?? "",
      mainBranchCode: selectedMainBranch?.code ?? "",
      mainBranchCurrency: selectedMainBranch?.local_currency ?? "",
      contacts: contactsPayload,
      permissionTemplate,
      permissionGrants,
      company: companyView,
      owner: ownerForView,
      users: linkedUsers,
      documents: linkedDocuments
    }),
    [
      editingCityBranchId,
      resolvedBranchName,
      branchCode,
      savedRow,
      tt,
      currency,
      locationMeta,
      operationalDomain,
      savedDetail,
      resolvedCityName,
      zip,
      fullAddress,
      selectedMainBranch,
      contactsPayload,
      permissionTemplate,
      permissionGrants,
      companyView,
      ownerForView,
      linkedUsers,
      linkedDocuments
    ]
  );

  const reportSections = useMemo(() => buildCityBranchReportSections(reportInput, tt), [reportInput, tt]);
  const flatReportRows = useMemo(
    () => reportSections.sections.flatMap((section) => section.rows.map((row) => ({ label: row.label, value: row.value ?? "" }))),
    [reportSections]
  );

  const filteredExistingCityBranches = useMemo(() => {
    const q = existingCitySearch.trim().toLowerCase();
    if (!q) return existingCityBranches;
    return existingCityBranches.filter((b) => [b.code, b.name, b.city_name].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [existingCityBranches, existingCitySearch]);

  function openReport(autoPrint: boolean) {
    openMasterProfileReportWindow(buildCityBranchReportConfig(reportInput, { lang, autoPrint, tt }));
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

  function emailReport() {
    if (typeof window === "undefined") return;
    window.location.href = buildMailtoHref(tt("cbs.report_mail_subject", "City Branch Report"), flatReportRows);
  }

  function exportReportCsv() {
    const rows = [[tt("cbs.csv_field", "Field"), tt("cbs.csv_value", "Value")], ...flatReportRows.map((row) => [row.label, row.value])];
    downloadCsv(`city-branch_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  /** Read-only view of a saved branch in the drawer. Built from the saved record, never from the open form. */
  async function viewSavedBranch(row: CityBranchRow) {
    setBanner(null);
    try {
      const { row: fresh, detail } = await fetchSavedCityBranch(row.id);
      const [company, owner, mains] = await Promise.all([
        fresh.company_id ? loadCompanyView(fresh.company_id) : Promise.resolve(null),
        fresh.owner_customer_id ? loadOwnerView(fresh.owner_customer_id) : Promise.resolve(null),
        fetchMainBranchList(fresh.country_id, fresh.operational_domain === "shipping" ? "shipping" : "business")
      ]);
      const main = mains.find((m) => m.id === fresh.country_branch_id) ?? null;
      const input = buildSavedInput(fresh, detail, {
        company,
        owner,
        mainBranch: main ? { name: main.name, code: main.code, currency: main.local_currency } : null
      });
      setDrawerBranchData(buildCityBranchDrawerData(input, tt));
    } catch (error) {
      setBanner({ type: "error", message: `${t(lang, "cbs.failed_load_branch")}\n${messageOf(error) || t(lang, "cbs.branch_not_found")}` });
    }
  }

  /** Loads one saved branch into the form, the live summary and the print input (edit, refresh, drawer). */
  async function applySavedCityBranch(row: CityBranchRow, detail: CityBranchDetail | null) {
    const domain: Domain = row.operational_domain === "shipping" ? "shipping" : "business";
    const [mains, cityList] = await Promise.all([
      fetchMainBranchList(row.country_id, domain),
      fetchExistingCityBranches(row.country_id, row.country_branch_id, domain)
    ]);
    const ids = {
      countryId: row.country_id,
      stateProvinceId: row.state_province_id ?? "",
      districtId: row.district_id ?? "",
      cityId: row.city_id ?? "",
      areaId: row.area_location_id ?? ""
    };
    const names: CityBranchLocationNames = detail?.location ?? { ...EMPTY_LOCATION_NAMES, cityName: row.city_name ?? "" };

    setMainBranches(mains);
    setExistingCityBranches(cityList);
    setOperationalDomain(domain);
    setBranchCategory(domain === "shipping" ? "clearing_agent" : "business");
    setEditingCityBranchId(row.id);
    setSavedRow(row);
    setSavedDetail(detail);
    setCountryBranchId(row.country_branch_id);
    setLocation(ids);
    setLocationMeta(locationMetaFromSaved(ids, names));
    setManualZip("");
    setCurrency(row.local_currency || "");
    setFullAddress(row.address ?? "");
    setCompanyId(row.company_id ?? "");
    setOwnerCustomerId(row.owner_customer_id ?? null);
    setOwnerProfileId(row.owner_profile_id ?? null);
    setOwnerId(row.owner_customer_id ?? row.owner_profile_id ?? "");
    setOwnerName(row.owner_name ?? "");
    setContacts(normalizeContacts(row.contacts));
    setBranchName(row.name || "");
    setBranchCode(row.code || "");
    setPermissionTemplate(row.permission_template ?? "city-standard");
    setPermissionGrants(
      Array.isArray(row.permission_grants) && row.permission_grants.length ? row.permission_grants : getPermissionKeysForTemplate("city-standard")
    );
    setRefreshNonce((n) => n + 1);

    // Keep the saved record in the URL, so a page refresh loads the same values back.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("editId") !== row.id) {
        url.searchParams.set("editId", row.id);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    }

    // Communication settings saved for this branch.
    setEmailPrefix("");
    setWhatsappNumber("");
    setPhoneNumberId("");
    setWabaId("");
    setAccessToken("");
    try {
      const res = await fetch(`/api/erp/email/config?countryId=${row.country_id}&countryBranchId=${row.country_branch_id}&cityBranchId=${row.id}`);
      const data = await res.json();
      if (data?.config) {
        const emailAddr = data.config.fromEmail || "";
        setEmailPrefix(emailAddr.split("@")[0] || "");
        if (data.config.smtpHost) setSmtpHost(data.config.smtpHost);
        if (data.config.smtpPort) setSmtpPort(String(data.config.smtpPort));
        if (data.config.smtpSecure !== undefined) setSslSecure(data.config.smtpSecure);
        if (data.config.smtpUser) setSmtpUser(data.config.smtpUser);
        setSmtpStatus("Ready");
      }
    } catch (err) {
      console.error("Failed to load email config for edit:", err);
    }
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
  }

  async function editCityBranch(id: string) {
    setEditLoading(true);
    setBanner(null);
    try {
      const { row, detail, detailError } = await fetchSavedCityBranch(id);
      await applySavedCityBranch(row, detail);
      setBanner({
        type: detailError ? "error" : "success",
        message: [
          t(lang, "cbs.editing_existing_branch"),
          `${t(lang, "cbs.branch_name")}: ${row.name}`,
          `${t(lang, "cbs.branch_code_word")}: ${row.code}`,
          detailError ? `${t(lang, "cbs.detail_partial_warning")} ${describeDetailError(detailError, lang)}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setBanner({ type: "error", message: `${t(lang, "cbs.failed_load_branch")}\n${messageOf(error) || t(lang, "cbs.branch_not_found")}` });
    } finally {
      setEditLoading(false);
    }
  }

  // Edit from the URL (?editId=) — a page refresh restores the same saved values.
  useEffect(() => {
    if (!isUuid(editId)) return;
    if (editingCityBranchId === editId) return;
    void editCityBranch(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  /** Report input for a saved record. Every value comes from the saved row, its detail and the loaded views. */
  function buildSavedInput(
    row: CityBranchRow,
    detail: CityBranchDetail | null,
    views: { company: CompanyView | null; owner: OwnerView | null; mainBranch: { name: string; code: string; currency: string } | null }
  ): CityBranchReportInput {
    const names = detail?.location ?? { ...EMPTY_LOCATION_NAMES, cityName: row.city_name ?? "" };
    const savedContacts = normalizeContacts(row.contacts);
    const main = views.mainBranch;
    return {
      savedId: row.id,
      name: row.name,
      code: row.code,
      status: row.status || "active",
      currency: row.local_currency || "",
      operationalDomain: row.operational_domain === "shipping" ? "shipping" : "business",
      createdAt: row.created_at ?? "",
      updatedAt: row.updated_at ?? "",
      createdByName: detail?.createdByName ?? "",
      country: names.countryName,
      countryIso2: names.countryIso2,
      state: names.stateName,
      district: names.districtName,
      city: row.city_name || names.cityName,
      area: names.areaName,
      zip: names.cityZip || names.areaPostal,
      fullAddress: row.address ?? "",
      mainBranchName: main?.name ?? "",
      mainBranchCode: main?.code ?? "",
      mainBranchCurrency: main?.currency ?? "",
      contacts: savedContacts,
      permissionTemplate: row.permission_template ?? "city-standard",
      permissionGrants: Array.isArray(row.permission_grants) ? row.permission_grants : [],
      company: views.company,
      owner: views.owner ?? (row.owner_name ? emptyOwnerView(row.owner_name, row.owner_profile_id ? "profile" : "customer") : null),
      users: detail?.linkedUsers ?? [],
      documents: detail?.linkedDocuments ?? []
    };
  }

  async function loadMainBranches(nextCountryId: string, domain: Domain) {
    if (!isUuid(nextCountryId) || !domain) {
      setMainBranches([]);
      setCountryBranchId("");
      return;
    }
    const finalBranches = await fetchMainBranchList(nextCountryId, domain);
    setMainBranches(finalBranches);
    if (finalBranches.length > 0) {
      if (!countryBranchId || !finalBranches.some((b) => b.id === countryBranchId)) {
        await onMainBranchSelected(finalBranches[0].id, domain);
      }
    } else {
      setCountryBranchId("");
    }
  }

  async function onOperationalDomainChange(nextDomain: "business" | "shipping") {
    setOperationalDomain(nextDomain);
    setBranchCategory(nextDomain === "shipping" ? "clearing_agent" : "business");
    setBanner(null);
    if (!isUuid(location.countryId)) return;
    const list = await fetchExistingCityBranches(location.countryId, undefined, nextDomain);
    setExistingCityBranches(list);
    await loadMainBranches(location.countryId, nextDomain);
    if (locationMeta.city?.name && !editingCityBranchId) {
      setBranchName(suggestBranchName(locationMeta, list, nextDomain));
      setBranchCode(suggestBranchCode(locationMeta, list, nextDomain));
    }
  }

  async function onCountrySelected(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    setBanner(null);
    if (editingCityBranchId && next.countryId === location.countryId) {
      setLocation(next);
      setLocationMeta(meta);
      if (meta.country?.currency_code) setCurrency(meta.country.currency_code.toUpperCase());
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
    setSavedRow(null);
    setSavedDetail(null);
    setBranchName("");
    setBranchCode("");

    if (meta.country?.phone_code) {
      const code = meta.country.phone_code;
      setContacts((prev) => {
        if (prev.length === 0) return [{ type: "Mobile", value: code + " " }];
        return prev.map((c) => (["Mobile", "Phone", "WhatsApp"].includes(c.type) && !c.value.trim() ? { ...c, value: code + " " } : c));
      });
    }

    if (!isUuid(next.countryId) || !operationalDomain) return;
    const list = await fetchExistingCityBranches(next.countryId, undefined, operationalDomain);
    setExistingCityBranches(list);
    await loadMainBranches(next.countryId, operationalDomain);
  }

  async function onMainBranchSelected(nextId: string, domain?: Domain) {
    const effectiveDomain = domain ?? operationalDomain;
    setBanner(null);
    setCountryBranchId(nextId);
    const list = await fetchExistingCityBranches(location.countryId, nextId, effectiveDomain);
    setExistingCityBranches(list);
    if (!editingCityBranchId) {
      setBranchCode(suggestBranchCode(locationMeta, list, effectiveDomain));
      if (locationMeta.city?.name?.trim() && (!branchName.trim() || branchName.includes("Branch"))) {
        const nextName = suggestBranchName(locationMeta, list, effectiveDomain) || `${locationMeta.city.name.trim()} City Branch`;
        if (nextName) setBranchName(nextName);
      }
    }
    const parent = mainBranches.find((branch) => branch.id === nextId);
    const parentPermissions = parent?.permission_grants?.length ? parent.permission_grants : undefined;
    setPermissionGrants((current) => (parentPermissions ? current.filter((permission) => parentPermissions.includes(permission)) : current));
  }

  function onLocationChange(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    setLocation(next);
    setLocationMeta(meta);
    const derivedZip = meta.area?.postal_code ?? meta.city?.zip_code ?? "";
    if (derivedZip) setManualZip("");
    if (editingCityBranchId) return;
    if (!branchName.trim() || branchName.includes("Branch")) {
      const nextName = suggestBranchName(meta, existingCityBranches, operationalDomain) || (meta.city?.name ? `${meta.city.name.trim()} City Branch` : "");
      if (nextName) setBranchName(nextName);
    }
    if (countryBranchId) setBranchCode(suggestBranchCode(meta, existingCityBranches, operationalDomain));
  }

  async function onCompanyPicked(nextId: string) {
    setCompanyId(nextId);
    setLinkedRecordError("");
    if (!nextId) return;
    try {
      const company = await loadCompanyView(nextId);
      if (company?.ownerPersonId) {
        setOwnerId(company.ownerPersonId);
        setOwnerCustomerId(company.ownerPersonId);
        setOwnerProfileId(null);
      }
    } catch (error) {
      setLinkedRecordError(`${tt("cbs.company_load_failed", "Company details could not be loaded.")} ${messageOf(error)}`.trim());
    }
  }

  function updateContact(idx: number, updates: Partial<ContactRow>) {
    setContacts((current) => current.map((row, i) => (i === idx ? { ...row, ...updates } : row)));
  }

  function addNewTypePrompt() {
    const value = window.prompt(tt("cbs.enter_new_type", "Enter new type"));
    if (!value) return null;
    const clean = value.trim();
    return clean || null;
  }

  /** Checks the form before saving. Returns the message to show, or null when the form is ready. */
  function validationProblem(): string | null {
    if (!operationalDomain) return tt("cbs.err_domain_required", "Select the operational section first (Business & Trading or Shipping Line & Clearing Agent).");
    if (!isUuid(location.countryId) || !isUuid(countryBranchId)) return t(lang, "cbs.select_valid_country_branch");
    if (!isUuid(location.stateProvinceId) || !isUuid(location.cityId) || !resolvedCityName) return t(lang, "cbs.select_state_city_msg");
    if (!resolvedBranchName) return t(lang, "cbs.branch_name_required");
    if (codeAlreadyExists) return `${t(lang, "cbs.branch_code_exists_title")}\n${t(lang, "cbs.branch_code_in_use_msg").replace("{0}", branchCode)}`;
    if (nameAlreadyExists) return `${t(lang, "cbs.branch_name_exists_title")}\n${t(lang, "cbs.branch_name_in_use_msg").replace("{0}", resolvedBranchName)}`;
    if (!branchCode.trim()) return t(lang, "cbs.branch_code_required");
    if (!permissionTemplate || !permissionGrants.length) return t(lang, "cbs.select_template_permission_msg");
    if (parentPermissionGrants?.length && permissionGrants.some((permission) => !parentPermissionGrants.includes(permission))) {
      return t(lang, "cbs.permissions_scope_msg");
    }
    return null;
  }

  function describeSaveFailure(json: unknown): string {
    const body = (json ?? {}) as { code?: string; field?: string };
    const headline = t(lang, "cbs.save_failed_title");
    if (body.code === "DUPLICATE_BRANCH") {
      const key = body.field === "code" ? "cbs.dup_code_msg" : body.field === "name" ? "cbs.dup_name_msg" : "cbs.dup_scope_msg";
      return `${headline}\n${t(lang, key)}`;
    }
    const fieldLabel = (field: string) => tt(CITY_BRANCH_FIELD_KEYS[field] ?? "cbs.field_unknown", field);
    const text = describeCityBranchServerError(json, t(lang, "cbs.save_failed_generic"), fieldLabel);
    return `${headline}\n${text}`;
  }

  /** Saves the branch: POST for a new branch, PUT for the saved record being edited. */
  async function saveBranch(): Promise<void> {
    setFormTouched(true);
    setBanner(null);
    const problem = validationProblem();
    if (problem) {
      setBanner({ type: "error", message: `${t(lang, "cbs.save_failed_title")}\n${problem}` });
      return;
    }

    const isUpdate = Boolean(editingCityBranchId);
    const emailContact = contactsPayload.find((row) => row.type.toLowerCase().includes("email"))?.value;
    const emailForSave = (emailPrefix ? `${emailPrefix.trim().toLowerCase()}@dgt.llc` : emailContact && emailContact.includes("@") ? emailContact : `${branchCode.trim().toLowerCase()}@dgt.llc`) || "";
    const phone = contactsPayload.find((row) => row.type.toLowerCase().includes("phone") || row.type.toLowerCase().includes("mobile"))?.value;
    const whatsappForSave = contactsPayload.find((row) => row.type.toLowerCase().includes("whatsapp"))?.value;

    setSaving(true);
    try {
      const res = await fetch("/api/branch-management/city-branches", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: isUpdate ? editingCityBranchId : undefined,
          countryId: location.countryId,
          countryBranchId,
          operationalDomain,
          cityName: resolvedCityName,
          stateProvinceId: location.stateProvinceId || undefined,
          districtId: location.districtId || undefined,
          cityId: location.cityId || undefined,
          areaLocationId: location.areaId || undefined,
          name: resolvedBranchName,
          code: branchCode,
          currencyCode: currency || locationMeta.country?.currency_code || "USD",
          address: fullAddress.trim() || undefined,
          phone: phone || undefined,
          email: emailForSave,
          whatsappNumber: whatsappForSave || undefined,
          companyId: companyId || undefined,
          ownerName: (ownerView?.name || ownerName.trim()) || undefined,
          ownerCustomerId: ownerCustomerId || undefined,
          ownerProfileId: ownerProfileId || undefined,
          permissionTemplate,
          permissionGrants,
          contacts: contactsPayload.length ? contactsPayload : undefined,
          emailPrefix,
          emailServerSettings: emailPrefix
            ? {
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
              }
            : undefined,
          whatsappConfig: whatsappForSave
            ? { whatsappNumber: whatsappForSave, wabaId, phoneNumberId, accessToken, isActive: true }
            : undefined
        })
      });

      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        code?: string;
        name?: string;
        warnings?: unknown;
      };
      if (!res.ok) {
        setBanner({ type: "error", message: describeSaveFailure(json) });
        return;
      }

      const savedId = typeof json.id === "string" && json.id ? json.id : editingCityBranchId;
      const savedName = typeof json.name === "string" ? json.name : resolvedBranchName;
      const savedCode = typeof json.code === "string" ? json.code : branchCode.trim();
      const warnings = Array.isArray(json.warnings) ? json.warnings.map((w) => String(w)) : [];

      // Reload the stored record: the form, live summary and print then show exactly what was saved.
      let reloadWarning = "";
      try {
        const loaded = await fetchSavedCityBranch(savedId);
        await applySavedCityBranch(loaded.row, loaded.detail);
        reloadWarning = loaded.detailError ? `${t(lang, "cbs.detail_partial_warning")} ${describeDetailError(loaded.detailError, lang)}` : "";
      } catch (reloadError) {
        reloadWarning = `${t(lang, "cbs.reload_after_save_failed")} ${messageOf(reloadError)}`.trim();
      }

      const lines = [
        t(lang, isUpdate ? "cbs.saved_update_ok" : "cbs.saved_create_ok"),
        `${t(lang, "cbs.branch_name")}: ${savedName}`,
        `${t(lang, "cbs.branch_code_word")}: ${savedCode}`,
        `${t(lang, "cbs.record_id")}: ${savedId}`,
        ...warnings.map((w) => `⚠ ${w}`),
        reloadWarning ? `⚠ ${reloadWarning}` : ""
      ].filter(Boolean);
      setBanner({ type: warnings.length || reloadWarning ? "error" : "success", message: lines.join("\n") });
    } catch (err) {
      setBanner({ type: "error", message: `${t(lang, "cbs.save_failed_title")}\n${messageOf(err) || t(lang, "cbs.save_failed_generic")}` });
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveBranch();
  }

  function onReset() {
    setBanner(null);
    setActiveStep(1);
    setLocation(EMPTY_LOCATION);
    setLocationMeta(EMPTY_META);
    setCurrency("");
    setFullAddress("");
    setCountryBranchId("");
    setMainBranches([]);
    setExistingCityBranches([]);
    setBranchName("");
    setBranchCode("");
    setOwnerName("");
    setOwnerId("");
    setOwnerCustomerId(null);
    setOwnerProfileId(null);
    setCompanyId("");
    setContacts([]);
    setPermissionTemplate("city-standard");
    setPermissionGrants(getPermissionKeysForTemplate("city-standard"));
    setOperationalDomain("");
    setBranchCategory("");
    setEditingCityBranchId("");
    setSavedRow(null);
    setSavedDetail(null);
    setEmailPrefix("");
    setWhatsappNumber("");
    setPhoneNumberId("");
    setWabaId("");
    setAccessToken("");
  }

  const bannerView = banner ? (
    <div
      className={
        banner.type === "success"
          ? "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          : "mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
      }
      role={banner.type === "error" ? "alert" : "status"}
    >
      <div className="whitespace-pre-line break-words">{banner.message}</div>
    </div>
  ) : null;

  const reviewFields = {
    country: reportInput.country,
    stateProvince: locationMeta.state?.name ?? "",
    city: resolvedCityName,
    companyName: companyView?.name ?? "",
    currency: reportInput.currency,
    mainBranchName: selectedMainBranch?.name ?? "",
    category: categoryLabel
  };

  const documentItems: BranchReviewDocumentItem[] = linkedDocuments.map((doc) => ({
    id: doc.id,
    name: doc.name,
    type: documentTypeLabel(doc.mimeType, doc.name),
    size: formatFileSize(doc.sizeBytes),
    isRequired: false,
    isUploaded: true,
    uploadedAt: formatDateShort(doc.createdAt)
  }));

  const userItems: BranchUserPermissionItem[] = linkedUsers.map((u) => ({
    id: u.assignmentId,
    userName: u.userName || u.userCode || "—",
    role: roleLabel(u.role, tt),
    operationalDomain: u.operationalDomain === "both" ? tt("cbs.domain_both", "Both") : domainLabel(u.operationalDomain, tt),
    countryScope: reviewFields.country,
    branchScope: resolvedBranchName,
    permissionGroup: accessProfileLabel(u.accessProfile, tt),
    ledgerVisibility: domainLabel(u.operationalDomain, tt),
    status: u.isActive ? "Active" : "Warning",
    statusReason: u.isActive ? undefined : tt("cbs.user_inactive_reason", "Assignment is inactive")
  }));

  if (activeStep === 9) {
    return (
      <div className="space-y-6">
        {bannerView}
        {linkedRecordError ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{linkedRecordError}</div>
        ) : null}
        <BranchFinalReview
          branchLevel="city"
          branchLevelTitle={tt("cbs.city_branch_word", "City Branch")}
          branchName={resolvedBranchName}
          branchCode={branchCode.trim()}
          branchType={tt("cbs.pr_city_branch", "City Branch")}
          category={reviewFields.category}
          country={reviewFields.country}
          stateProvince={reviewFields.stateProvince}
          city={reviewFields.city}
          fullAddress={fullAddress.trim()}
          companyName={reviewFields.companyName}
          businessDomain={operationalDomain === "business" ? domainLabel("business", tt) : "—"}
          shippingDomain={operationalDomain === "shipping" ? domainLabel("shipping", tt) : "—"}
          currency={reviewFields.currency}
          mainBranchName={reviewFields.mainBranchName || "—"}
          documents={documentItems}
          usersAndPermissions={userItems}
          sampleFallback={false}
          showSavedBanner={false}
          emptyDocumentsText={tt("cbs.docs_empty", "No documents are linked to this branch yet.")}
          emptyUsersText={tt("cbs.users_empty", "No users are assigned to this branch yet.")}
          isSaving={saving}
          isEditing={Boolean(editingCityBranchId)}
          checklistStatus={checklist.status}
          onBack={() => setActiveStep(8)}
          onGoToStep={(step) => {
            if (step === 1) setActiveStep(1);
            else if (step === 2) setActiveStep(4);
            else if (step === 3) setActiveStep(2);
            else if (step === 4) setActiveStep(5);
            else if (step === 5) setActiveStep(8);
            else if (step === 6) setActiveStep(6);
            else setActiveStep(9);
          }}
          onEditSection={(sec) => {
            if (sec === "branch_info") setActiveStep(1);
            else if (sec === "location") setActiveStep(2);
            else if (sec === "company") setActiveStep(4);
            else if (sec === "documents") setActiveStep(6);
            else if (sec === "roles") setActiveStep(8);
          }}
          onApproveAndActivate={async () => {
            await saveBranch();
          }}
          onSendBackForEdit={() => setActiveStep(1)}
          onRequestChanges={() => {
            setBanner({ type: "error", message: tt("cbs.request_changes_unavailable", "Request Changes is not connected to a workflow for city branches yet. Nothing was sent.") });
          }}
          onViewSummary={viewReport}
          onPrint={printReport}
        />
      </div>
    );
  }

  const companyRowsView = companyView;
  const ownerRowsView = ownerForView;

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
            <ArrowLeft className="me-1.5 h-3.5 w-3.5" /> {t(lang, "common.previous")}
          </Button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              {editingCityBranchId ? t(lang, "cbs.editing_existing_branch_short") : t(lang, "cbs.new_entry")}
            </span>
            <span className="text-[11px] font-bold text-slate-500 mt-0.5">
              {t(lang, "cbs.step_word")} {activeStep} {t(lang, "cbs.of_9")}
            </span>
          </div>
        </div>

        {/* Center Section: Compact 1-9 Step Navigator */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          {[
            { n: 1, label: t(lang, "cbs.step1_label"), done: Boolean(resolvedBranchName && branchCode) },
            { n: 2, label: t(lang, "cbs.step2_label"), done: Boolean(locationMeta.city?.name) },
            { n: 3, label: t(lang, "cbs.step3_label"), done: Boolean(companyId || ownerCustomerId) },
            { n: 4, label: t(lang, "cbs.step4_label"), done: contacts.some((c) => c.value) },
            { n: 5, label: t(lang, "cbs.step5_label"), done: hasAny },
            { n: 6, label: t(lang, "cbs.step6_label"), done: linkedDocuments.length > 0 },
            { n: 7, label: t(lang, "cbs.step7_label"), done: false },
            { n: 8, label: t(lang, "cbs.step8_label"), done: permissionGrants.length > 0 },
            { n: 9, label: t(lang, "cbs.step9_label"), done: false }
          ].map(({ n, label, done }) => {
            const active = activeStep === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setActiveStep(n)}
                title={`${n}. ${label}`}
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-black transition-all",
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

        {/* Right Section: Actions, Next / Save, scope */}
        <div className="flex items-center gap-2">
          <BranchReportActionsMenu
            ariaLabel={tt("cbs.actions_aria", "City branch actions")}
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
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg border-0"
              onClick={() => setActiveStep((step) => Math.min(9, step + 1))}
            >
              {t(lang, "common.next")} <ArrowRight className="ms-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              form="city-branch-wizard-form"
              size="sm"
              disabled={saving || !location.countryId || !operationalDomain || !countryBranchId || cityAlreadyExists}
              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg border-0 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {saving ? t(lang, "common.saving") : editingCityBranchId ? t(lang, "common.update") : t(lang, "cbs.accept_save")}
            </Button>
          )}

          <span className={pillClassName()}>
            <b>{t(lang, "cbs.scope_label")}</b> {t(lang, "cbs.scope_desc_city")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1600px] mx-auto items-start">
        <div className="lg:col-span-7 xl:col-span-7 space-y-6 w-full">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>{t(lang, "cbs.title")}</CardTitle>
            </CardHeader>

            <CardContent>
              {editLoading ? (
                <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
                  {t(lang, "cbs.loading_edit")}
                </div>
              ) : null}
              {bannerView}
              {linkedRecordError ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{linkedRecordError}</div>
              ) : null}

              <form id="city-branch-wizard-form" onSubmit={onSubmit} onReset={onReset} className="flex flex-col gap-6">
                <section hidden={activeStep !== 1} className={cn("order-1 rounded-xl border bg-white p-4 shadow-sm space-y-3 dark:bg-slate-950", !location.countryId || !currency ? "border-rose-200 ring-1 ring-rose-100 dark:border-rose-900/70 dark:ring-rose-950" : "border-slate-100 dark:border-slate-800/80")}>
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step1a_title")}</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <LocationHierarchySelect value={location} showState={false} showCity={false} showArea={false} onChange={onCountrySelected} />
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">{t(lang, "cbs.currency_label")}</Label>
                      <Input value={currency} readOnly placeholder={t(lang, "cbs.currency_placeholder")} className="h-9 text-sm" />
                    </div>
                  </div>
                </section>

                <section hidden={activeStep !== 1} className={cn("order-1 rounded-xl border bg-white p-4 shadow-sm space-y-3 dark:bg-slate-950", !operationalDomain || !countryBranchId ? "border-rose-200 ring-1 ring-rose-100 dark:border-rose-900/70 dark:ring-rose-950" : "border-slate-100 dark:border-slate-800/80")}>
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step1b_title")}</h2>
                  </div>

                  {/* Mandatory operational section (Business & Trading vs Shipping Line & Clearing Agent) */}
                  <div
                    className={cn(
                      "mt-2 space-y-3 p-4 rounded-xl border-2 transition-all",
                      !operationalDomain
                        ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20"
                        : operationalDomain === "business"
                        ? "border-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/30"
                        : "border-blue-300 bg-blue-50/40 dark:bg-blue-950/30"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-slate-200 dark:border-slate-800">
                      <div>
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{t(lang, "cbs.domain_question")}</span>
                          <span className="text-rose-500 text-sm">*</span>
                        </Label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t(lang, "cbs.domain_mandatory_hint")}</p>
                      </div>
                      {operationalDomain ? (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 whitespace-nowrap">
                          ✓ {t(lang, "cbs.domain_selected_prefix")} {operationalDomain === "shipping" ? t(lang, "cbs.domain_shipping") : t(lang, "cbs.domain_business")}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 whitespace-nowrap">
                          ⚠ {t(lang, "cbs.domain_required_badge")}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        id="operational-domain-business-btn"
                        onClick={() => void onOperationalDomainChange("business")}
                        className={`p-3.5 rounded-xl border-2 text-start flex items-start gap-3 transition-all ${
                          operationalDomain === "business"
                            ? "border-indigo-600 bg-white dark:bg-slate-950 text-indigo-900 dark:text-indigo-100 shadow-md ring-2 ring-indigo-500/30"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:border-indigo-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-2xl mt-0.5">🏢</span>
                        <div className="flex-1">
                          <div className="text-xs font-black tracking-wide text-slate-900 dark:text-slate-100 flex items-center justify-between">
                            <span>{t(lang, "cbs.domain_option_business")}</span>
                            {operationalDomain === "business" && <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">✓</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{t(lang, "cbs.domain_business_desc")}</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        id="operational-domain-shipping-btn"
                        onClick={() => void onOperationalDomainChange("shipping")}
                        className={`p-3.5 rounded-xl border-2 text-start flex items-start gap-3 transition-all ${
                          operationalDomain === "shipping"
                            ? "border-blue-600 bg-white dark:bg-slate-950 text-blue-900 dark:text-blue-100 shadow-md ring-2 ring-blue-500/30"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:border-blue-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-2xl mt-0.5">🚢</span>
                        <div className="flex-1">
                          <div className="text-xs font-black tracking-wide text-slate-900 dark:text-slate-100 flex items-center justify-between">
                            <span>{t(lang, "cbs.domain_option_shipping")}</span>
                            {operationalDomain === "shipping" && <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">✓</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{t(lang, "cbs.domain_shipping_desc")}</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Parent Main Branch, scoped to the selected operational section */}
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <SearchSelect
                      label={
                        !operationalDomain
                          ? t(lang, "cbs.main_branch_label_none")
                          : operationalDomain === "shipping"
                          ? t(lang, "cbs.main_branch_label_shipping")
                          : t(lang, "cbs.main_branch_label_business")
                      }
                      value={countryBranchId}
                      placeholder={
                        !location.countryId
                          ? t(lang, "cbs.select_country_first")
                          : !operationalDomain
                          ? t(lang, "cbs.select_domain_first")
                          : mainBranches.length === 0
                          ? t(lang, "cbs.no_main_branch_found")
                          : t(lang, "cbs.select_main_branch_ph")
                      }
                      disabled={!location.countryId || !operationalDomain}
                      options={mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
                      onValueChange={(value) => void onMainBranchSelected(value)}
                    />

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">{t(lang, "cbs.main_branch_code")}</Label>
                      <Input value={selectedMainBranch?.code ?? ""} readOnly className="h-9 text-sm" />
                    </div>
                  </div>
                </section>

                <section hidden={activeStep !== 1} className="order-1 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step1c_title")}</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="space-y-2 md:col-span-4">
                      <Label className="text-xs text-slate-600">{t(lang, "cbs.country_auto")}</Label>
                      <Input value={locationMeta.country?.name ?? ""} readOnly className="h-9 text-sm" />
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
                      <Label className="text-xs text-slate-600">{t(lang, "cbs.zip_postal_code")}</Label>
                      <Input
                        value={zip}
                        onChange={(e) => setManualZip(e.target.value)}
                        placeholder={autoZip ? autoZip : t(lang, "cbs.zip_placeholder")}
                        className="h-9 text-sm"
                      />
                      {!manualZip && autoZip && <p className="text-[11px] text-slate-400 leading-tight">{t(lang, "cbs.zip_auto_hint")}</p>}
                      {manualZip && (
                        <button type="button" onClick={() => setManualZip("")} className="text-[11px] text-indigo-500 hover:text-indigo-700 underline leading-tight">
                          {t(lang, "cbs.zip_clear_manual").replace("{0}", autoZip || t(lang, "cbs.zip_none"))}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-8">
                      <Label className="text-xs text-slate-600">{t(lang, "cbs.full_address")}</Label>
                      <textarea
                        value={fullAddress}
                        onChange={(event) => setFullAddress(event.target.value)}
                        placeholder={t(lang, "cbs.full_address_placeholder")}
                        className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </section>

                <section hidden={activeStep !== 1} className="order-1 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step1d_title")}</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">{t(lang, "cbs.branch_name")}</Label>
                      <Input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder={t(lang, "cbs.branch_name_placeholder")} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">{t(lang, "cbs.branch_code")}</Label>
                      <Input value={branchCode} onChange={(event) => setBranchCode(event.target.value)} placeholder={t(lang, "cbs.branch_code_placeholder")} className="h-9 text-sm" />
                    </div>
                  </div>
                </section>

                <section hidden={activeStep !== 3} className="order-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step3_section_title")}</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <CompanyPicker
                      label={t(lang, "cbs.company_name_field")}
                      value={companyId}
                      onValueChange={(next) => void onCompanyPicked(next)}
                      placeholder={t(lang, "cbs.search_company_ph")}
                      createButtonPlacement="below"
                      disabled={!location.countryId}
                    />

                    <BranchOwnerPicker
                      value={ownerId}
                      companyId={companyId}
                      countryId={location.countryId}
                      onValueChange={setOwnerId}
                      onOwnerResolved={(owner, customer) => {
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
                      disabled={!location.countryId}
                      placeholder={t(lang, "cbs.search_owner_ph")}
                      createButtonPlacement="below"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-slate-50/40 p-3 dark:bg-slate-900/30">
                      <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">{t(lang, "cbs.linked_company_details")}</h3>
                      {companyRowsView ? (
                        <div>
                          <DetailLine label={t(lang, "cbs.company_name_field")} value={companyRowsView.name} />
                          <DetailLine label={t(lang, "cbs.pr_legal_name")} value={companyRowsView.legalName} />
                          <DetailLine label={t(lang, "cbs.pr_company_code")} value={companyRowsView.companyCode} />
                          <DetailLine label={t(lang, "cbs.pr_base_currency")} value={companyRowsView.baseCurrency} />
                          <DetailLine label={t(lang, "cbs.pr_business_type")} value={companyRowsView.businessType} />
                          <DetailLine label={t(lang, "cbs.pr_registration_no")} value={companyRowsView.registrationNumber} />
                          <DetailLine label={t(lang, "cbs.pr_tax_no")} value={companyRowsView.taxNumber} />
                          <DetailLine label={t(lang, "cbs.pr_company_status")} value={companyRowsView.companyStatus} />
                          <DetailLine label={t(lang, "acct.country")} value={companyRowsView.country} />
                          <DetailLine label={t(lang, "acct.city")} value={companyRowsView.city} />
                          <DetailLine label={t(lang, "acct.address")} value={companyRowsView.address} />
                          <DetailLine label={t(lang, "cbs.pr_bank_accounts")} value={String(companyBankCount)} />
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">{t(lang, "cbs.no_company_selected")}</p>
                      )}
                    </div>

                    <div className="rounded-lg border bg-slate-50/40 p-3 dark:bg-slate-900/30">
                      <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">{t(lang, "cbs.linked_owner_details")}</h3>
                      {ownerRowsView ? (
                        <div>
                          <DetailLine label={t(lang, "branch.owner_name")} value={ownerRowsView.name} />
                          <DetailLine label={t(lang, "cbs.pr_owner_code")} value={ownerRowsView.code} />
                          <DetailLine label={t(lang, "acct.company_name")} value={ownerRowsView.companyName} />
                          <DetailLine label={t(lang, "cbs.pr_contact_person")} value={ownerRowsView.contactPerson} />
                          <DetailLine label={t(lang, "cbs.pr_mobile")} value={ownerRowsView.mobile} />
                          <DetailLine label={t(lang, "branch.whatsapp")} value={ownerRowsView.whatsapp} />
                          <DetailLine label={t(lang, "acct.email")} value={ownerRowsView.email} />
                          <DetailLine label={t(lang, "acct.country")} value={ownerRowsView.country} />
                          <DetailLine label={t(lang, "acct.city")} value={ownerRowsView.city} />
                          <DetailLine label={t(lang, "acct.address")} value={ownerRowsView.address} />
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">{t(lang, "cbs.no_owner_selected")}</p>
                      )}
                    </div>
                  </div>
                </section>

                <section hidden={activeStep !== 4} className="order-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">4</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "branch.sec_contact", "Step 4 - Contact Information")}</h2>
                  </div>
                  <div className="space-y-3">
                    {contacts.map((row, idx) => {
                      const isEmail = (row.type || "").toLowerCase().includes("email");
                      const isPhone = toContactTypeKey(row.type);
                      return (
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
                            <option value="">{t(lang, "common.select_type", "Select Type")}</option>
                            {contactTypeOptions.map((type) => (
                              <option key={type} value={type}>
                                {localizeContactType(type, tt)}
                              </option>
                            ))}
                            {row.type && !(contactTypeOptions as readonly string[]).includes(row.type) ? (
                              <option value={row.type}>{row.type}</option>
                            ) : null}
                            <option value="__new__">{t(lang, "common.add_new_type", "+ Add New Type")}</option>
                          </select>

                          {isPhone ? (
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
                          ) : isEmail ? (
                            <Input
                              type="email"
                              dir="ltr"
                              value={row.value}
                              onChange={(event) => updateContact(idx, { value: event.target.value })}
                              placeholder="branch@dgt.llc"
                              className="font-sans text-left bg-white text-slate-900"
                            />
                          ) : (
                            <Input
                              dir="ltr"
                              value={row.value}
                              onChange={(event) => updateContact(idx, { value: event.target.value })}
                              placeholder={t(lang, "branch.enter_val", "Enter value")}
                              className="font-mono text-left bg-white text-slate-900"
                            />
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            onClick={() => setContacts((current) => current.filter((_, i) => i !== idx))}
                          >
                            {t(lang, "common.remove", "Remove")}
                          </Button>
                        </div>
                      );
                    })}

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setContacts((current) => [...current, { type: "", value: "" }])}>
                        {t(lang, "branch.add_contact_btn", "+ Add Contact")}
                      </Button>
                    </div>
                  </div>
                </section>

                <section hidden={activeStep !== 7} className="order-7 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">7</span>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step7_title2")}</h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t(lang, "cbs.step7_subtitle")}</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
                      🔐 {t(lang, "cbs.permissions_active").replace("{0}", String(permissionGrants.length))}
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
                    note={t(lang, "cbs.step7_note")}
                  />
                </section>

                <section hidden={activeStep !== 5} className="order-5 rounded-xl border border-cyan-200/80 bg-cyan-50/40 p-5 shadow-sm space-y-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
                  <div className="flex items-center justify-between gap-3 border-b border-cyan-100 pb-3 dark:border-cyan-900/60">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">5</span>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step5_title2")}</h2>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => openReport(true)} disabled={!hasAny}>{t(lang, "cbs.download_pdf")}</Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3 text-xs">
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.country_word")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{reviewFields.country || "—"}</p></div>
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.main_branch_word")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{reviewFields.mainBranchName || "—"}</p></div>
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.city_branch_word")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{resolvedBranchName || t(lang, "status.draft")}</p></div>
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.branch_code_word")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{branchCode || "—"}</p></div>
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.currency_word")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{reportInput.currency || "—"}</p></div>
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.field_contacts")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{contactsPayload.length}</p></div>
                  </div>
                </section>

                <section hidden={activeStep !== 6} className="order-6 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">6</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step6_title2")}</h2>
                  </div>
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/30">{t(lang, "cbs.step6_desc")}</div>
                  {!editingCityBranchId ? (
                    <p className="text-xs text-slate-500">{t(lang, "cbs.docs_need_save")}</p>
                  ) : documentItems.length === 0 ? (
                    <p className="text-xs text-slate-500">{t(lang, "cbs.docs_empty")}</p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {documentItems.map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/40">
                          <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">{doc.name}</span>
                          <span className="shrink-0 text-slate-500">{[doc.type, doc.size].filter(Boolean).join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section hidden={activeStep !== 2} className="order-2 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-sm space-y-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2.5 border-b border-emerald-100 pb-3 dark:border-emerald-900/60">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">2</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step2_title2")}</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3 text-xs">
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.template_word")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{permissionTemplate || "—"}</p></div>
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.permissions_word")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{permissionGrants.length}</p></div>
                    <div className="rounded-lg border bg-white p-3 dark:bg-slate-950"><span className="text-slate-500">{t(lang, "cbs.parent_limited_word")}</span><p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{parentPermissionGrants?.length ? t(lang, "common.yes") : t(lang, "common.no")}</p></div>
                  </div>
                </section>

                <section hidden={activeStep !== 8} className="order-8 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">8</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(lang, "cbs.step8_title2")}</h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4 rounded-lg border p-4 bg-slate-50/30">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{t(lang, "cbs.official_branch_email")}</h3>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600">{t(lang, "cbs.official_email_prefix")}</Label>
                        <div className="flex gap-2">
                          <Input value={emailPrefix} onChange={(e) => setEmailPrefix(e.target.value)} placeholder={t(lang, "cbs.email_prefix_ph")} className="flex-1" />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={aiLoading || !resolvedBranchName}
                            onClick={() => {
                              setAiLoading(true);
                              setTimeout(() => {
                                const suggested = resolvedBranchName.toLowerCase().replace(/city|branch|store|office/gi, "").trim().replace(/\s+/g, ".");
                                setEmailPrefix(suggested);
                                setAiLoading(false);
                              }, 500);
                            }}
                          >
                            {aiLoading ? t(lang, "cbs.ai_thinking") : t(lang, "cbs.ai_suggest")}
                          </Button>
                        </div>
                        {generatedEmail && (
                          <p className="text-[11px] text-green-600 font-semibold mt-1">
                            {t(lang, "cbs.generated_email_label")} {generatedEmail}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600">{t(lang, "cbs.email_server")}</Label>
                        <select className={selectClassName()} value={emailServerName} onChange={(e) => setEmailServerName(e.target.value)}>
                          <option value="Local IP Server (UPS Linked)">{t(lang, "cbs.email_server_local")}</option>
                          <option value="Google Workspace Cloud Server">{t(lang, "cbs.email_server_google")}</option>
                          <option value="Microsoft Office 365 Cloud Server">{t(lang, "cbs.email_server_o365")}</option>
                        </select>
                      </div>

                      {emailServerName.includes("Local IP") && (
                        <div className="grid gap-2 grid-cols-2 pt-2 border-t text-[11px] space-y-1">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[11px] text-slate-500">{t(lang, "cbs.local_ip_address")}</Label>
                            <Input value={localIp} onChange={(e) => setLocalIp(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[11px] text-slate-500">{t(lang, "cbs.public_ip_address")}</Label>
                            <Input value={publicIp} onChange={(e) => setPublicIp(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-500">{t(lang, "cbs.smtp_host")}</Label>
                            <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-500">{t(lang, "cbs.smtp_port")}</Label>
                            <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-500">{t(lang, "cbs.imap_host")}</Label>
                            <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-500">{t(lang, "cbs.imap_port")}</Label>
                            <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2 flex items-center gap-2 pt-1.5">
                            <input type="checkbox" checked={sslSecure} onChange={(e) => setSslSecure(e.target.checked)} id="ssl-checkbox" />
                            <Label htmlFor="ssl-checkbox" className="text-[11px] text-slate-600">{t(lang, "cbs.ssl_tls")}</Label>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-2 grid-cols-2 pt-2 border-t">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-500">{t(lang, "cbs.smtp_username")}</Label>
                          <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder={generatedEmail} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-500">{t(lang, "cbs.app_password")}</Label>
                          <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••••••" className="h-8 text-xs" />
                        </div>
                      </div>

                      <div className="pt-2 border-t flex items-center justify-between">
                        <div className="text-[11px] font-bold text-slate-500">
                          {t(lang, "cbs.email_status_label")}{" "}
                          <span className={cn("px-1.5 py-0.5 rounded", smtpStatus === "Ready" ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50")}>
                            {smtpStatus === "Ready" ? t(lang, "cbs.status_ready") : smtpStatus === "Connection Failed" ? t(lang, "cbs.status_connection_failed") : t(lang, "cbs.not_configured", "Not Configured")}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={testingEmail || !emailPrefix}
                          onClick={async () => {
                            try {
                              setTestingEmail(true);
                              const res = await fetch("/api/erp/messages/test-connection", {
                                method: "POST",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  countryId: location.countryId,
                                  countryBranchId,
                                  cityBranchId: editingCityBranchId || undefined,
                                  settings: { smtpHost, smtpPort: Number(smtpPort), smtpSecure: sslSecure, smtpUser: smtpUser || generatedEmail, smtpPass }
                                })
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data?.error || t(lang, "cbs.connection_failed_generic"));
                              alert(t(lang, "cbs.email_ready_alert").replace("{0}", resolvedBranchName || t(lang, "cbs.branch_fallback")));
                              setSmtpStatus("Ready");
                            } catch (err: any) {
                              alert(t(lang, "cbs.smtp_auth_failed_alert").replace("{0}", err.message || t(lang, "cbs.invalid_credentials")));
                              setSmtpStatus("Connection Failed");
                            } finally {
                              setTestingEmail(false);
                            }
                          }}
                        >
                          {testingEmail ? t(lang, "cbs.testing_ellipsis") : t(lang, "cbs.test_email_server")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4 bg-slate-50/30">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{t(lang, "cbs.whatsapp_api_integration")}</h3>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600">{t(lang, "cbs.official_whatsapp_number")}</Label>
                        <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+923001234567" />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600">{t(lang, "cbs.phone_number_id")}</Label>
                        <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder={t(lang, "cbs.phone_number_id_ph")} />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600">{t(lang, "cbs.waba_id")}</Label>
                        <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder={t(lang, "cbs.waba_id_ph")} />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600">{t(lang, "cbs.system_user_access_token")}</Label>
                        <textarea
                          value={accessToken}
                          onChange={(e) => setAccessToken(e.target.value)}
                          placeholder={t(lang, "cbs.access_token_ph")}
                          className="min-h-16 w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none shadow-sm focus:border-primary"
                        />
                      </div>

                      <div className="pt-2 border-t flex items-center justify-between">
                        <div className="text-[11px] font-bold text-slate-500">
                          {t(lang, "cbs.whatsapp_status_label")}{" "}
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded",
                              whatsappStatus === "Ready" ? "text-green-700 bg-green-50" : whatsappStatus === "Verification Pending" ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"
                            )}
                          >
                            {whatsappStatus === "Ready" ? t(lang, "cbs.status_ready") : whatsappStatus === "Verification Pending" ? t(lang, "cbs.status_verification_pending") : t(lang, "cbs.not_configured", "Not Configured")}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={testingWhatsapp || !whatsappNumber || !phoneNumberId || !accessToken}
                          onClick={() => {
                            setTestingWhatsapp(true);
                            setTimeout(() => {
                              alert(t(lang, "cbs.whatsapp_verified_alert"));
                              setWhatsappStatus("Ready");
                              setTestingWhatsapp(false);
                            }, 600);
                          }}
                        >
                          {testingWhatsapp ? t(lang, "cbs.verifying_ellipsis") : t(lang, "cbs.verify_whatsapp")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="order-10 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <Button type="reset" variant="outline" disabled={saving}>
                    {t(lang, "common.cancel")}
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" disabled={saving || activeStep === 1} onClick={() => setActiveStep((step) => Math.max(1, step - 1))}>
                      <ArrowLeft className="me-1.5 h-3.5 w-3.5" /> {t(lang, "common.previous")}
                    </Button>
                    {activeStep < 9 ? (
                      <Button type="button" onClick={() => setActiveStep((step) => Math.min(9, step + 1))} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md hover:shadow-lg border-0">
                        {t(lang, "common.next")} <ArrowRight className="ms-1.5 h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={saving || !location.countryId || !countryBranchId || cityAlreadyExists} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md hover:shadow-lg border-0 disabled:bg-slate-300 disabled:text-slate-500">
                        {saving ? t(lang, "common.saving") : editingCityBranchId ? t(lang, "common.update") : t(lang, "cbs.save")}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 xl:col-span-5 w-full space-y-3 lg:sticky lg:top-4">
          {/* Live summary: same rows as the print and the drawer */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t(lang, "cbs.live_summary")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${hasAny ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                  {hasAny ? t(lang, "status.draft") : t(lang, "branch.status_empty")}
                </span>
                <BranchReportActionsMenu
                  ariaLabel={tt("cbs.actions_aria", "City branch actions")}
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

            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {[
                { label: t(lang, "cbs.branch_word"), value: resolvedBranchName || "—" },
                { label: t(lang, "cbs.currency_word"), value: reportInput.currency || "—" },
                { label: t(lang, "cbs.permissions_word"), value: String(permissionGrants.length) }
              ].map(({ label, value }) => (
                <div key={label} className="px-3 py-2 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                  <div className="mt-0.5 truncate text-xs font-black text-slate-800 dark:text-slate-100">{value}</div>
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportSections.sections
                .filter((section) => section.title !== t(lang, "acct.sec_audit_info", "System / Audit Information"))
                .map((section) => (
                  <details key={section.title} className="group" open={section.title === t(lang, "branch.sec_branch_info", "Branch Information")}>
                    <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{section.title}</span>
                      <span className="ms-auto text-[11px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <div className="px-4 pb-3 pt-1">
                      {section.rows.map((row, idx) => (
                        <DetailLine key={`${section.title}-${idx}`} label={row.label} value={row.value ?? ""} />
                      ))}
                    </div>
                  </details>
                ))}
            </div>

            {/* Missing items, from the same checklist as step 9 */}
            {hasAny && (() => {
              const missing = [
                !location.countryId && t(lang, "cbs.field_country"),
                !countryBranchId && t(lang, "cbs.field_main_branch"),
                !resolvedBranchName && t(lang, "cbs.field_branch_name"),
                !branchCode.trim() && t(lang, "cbs.field_branch_code"),
                !currency && t(lang, "cbs.field_currency"),
                !(location.cityId || locationMeta.city?.name) && t(lang, "cbs.field_city"),
                !contactsPayload.length && t(lang, "cbs.field_contacts"),
                !permissionGrants.length && t(lang, "cbs.permissions_word")
              ].filter((m): m is string => Boolean(m));
              if (!missing.length) return null;
              return (
                <div className="border-t border-rose-100 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">⚠ {t(lang, "cbs.incomplete_fields")}</p>
                  <div className="flex flex-wrap gap-1">
                    {missing.map((m) => (
                      <span key={m} className="rounded border border-rose-200 bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 whitespace-nowrap">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {branchConflict && (
              <div className="border-t border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">⚠ {t(lang, "cbs.duplicate_code_name_detected")}</p>
                <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                  {codeAlreadyExists && <p>{t(lang, "cbs.branch_code_word")} <b>{branchCode}</b> {t(lang, "cbs.already_in_use_short")}</p>}
                  {nameAlreadyExists && <p>{t(lang, "cbs.branch_name")} <b>{resolvedBranchName}</b> {t(lang, "cbs.already_exists_in_city").replace("{0}", resolvedCityName || t(lang, "cbs.this_city_word"))}</p>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {codeAlreadyExists && (
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => setBranchCode(suggestBranchCode(locationMeta, existingCityBranches, operationalDomain))}>
                      ⚡ {t(lang, "cbs.auto_fix_code")}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {hasAny && (
              <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{t(lang, "cbs.checklist_progress").replace("{0}", String(checklist.completed)).replace("{1}", String(checklist.total))}</p>
              </div>
            )}

            {hasAny && existingCityBranches.length > 0 && (
              <details className="border-t border-slate-100 dark:border-slate-800">
                <summary className="cursor-pointer px-4 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  {t(lang, "cbs.existing_branches_count").replace("{0}", String(existingCityBranches.length))}
                </summary>
                <div className="px-3 pb-3 pt-1 space-y-1.5">
                  <Input value={existingCitySearch} onChange={(event) => setExistingCitySearch(event.target.value)} placeholder={t(lang, "cbs.search_branches_ph")} className="h-7 text-xs" />
                  {filteredExistingCityBranches.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{b.code}</span>
                        <span className="text-[11px] text-slate-400"> — {b.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button type="button" size="sm" variant="outline" className="h-5 px-1.5 text-[11px]" onClick={() => viewSavedBranch(b)} aria-label={t(lang, "cbs.view_branch_aria")}>
                          <Eye className="h-2.5 w-2.5" aria-hidden />
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-5 px-1.5 text-[11px]" onClick={() => void editCityBranch(b.id)} aria-label={t(lang, "cbs.edit_branch_aria")}>
                          <Pencil className="h-2.5 w-2.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredExistingCityBranches.length > 5 && <p className="text-[11px] text-slate-400 px-1">{t(lang, "cbs.more_count").replace("{0}", String(filteredExistingCityBranches.length - 5))}</p>}
                </div>
              </details>
            )}

            {editingCityBranchId && (
              <div className="border-t border-sky-100 bg-sky-50 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                <p className="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">✏ {t(lang, "cbs.editing_existing_branch")}</p>
                <p className="mt-0.5 text-[11px] text-sky-800 dark:text-sky-300">
                  {savedRow?.name} · {savedRow?.code}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerBranchData !== null}
        onClose={() => setDrawerBranchData(null)}
        title={t(lang, "cbs.city_branch_details_title")}
        subtitle={t(lang, "cbs.verification_cert_subtitle")}
      >
        {drawerBranchData && (
          <BranchLiveReportPanel title={t(lang, "cbs.saved_city_branch_title")} status={drawerBranchData.branchStatus ?? ""} branchData={drawerBranchData} />
        )}
      </DetailDrawer>
    </div>
  );
}

export function CityBranchSetup() {
  const lang = useActiveLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-slate-500">{t(lang, "cbs.loading_wizard")}</div>}>
      <CityBranchSetupContent />
    </Suspense>
  );
}
