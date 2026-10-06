"use client";

/**
 * Company Master — create / edit one legal company in the ONE `companies` master.
 *
 * Two flows on the same master:
 *   • Customer Company  — a registered company owned by an existing Customer / Owner (sister
 *     companies of the same owner stay separate records with their own registration & TRN).
 *   • Internal / Branch Company — our own legal entity; the branches that operate under it are
 *     linked through the existing city_branches.company_id / country_branches.company_id.
 *
 * This form never creates bank accounts, ledgers or postings (Bank Master → New Account →
 * Roznamcha/Journal). Duplicates are never silent: the API answers 409 with candidates and the
 * user decides. An AI Document Intake draft (Scan / Upload) only pre-fills — the user saves.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, Link2, Loader2, Plus, Minus, Search, ShieldCheck, Trash2, UserRound, AlertTriangle, FileText, ScanLine } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { LocationHierarchySelect } from "@/features/locations/components/location-hierarchy-select";
import { useIntakeDraft } from "@/lib/document-intelligence/use-intake-draft";
import { CompanyDuplicateWarningModal, type CompanyDuplicateCandidate } from "@/components/erp/company-duplicate-warning-modal";
import {
  COMPANY_TYPES,
  LEGAL_STRUCTURE_OPTIONS,
  REGISTRATION_TYPE_OPTIONS,
  COMPANY_STATUS_OPTIONS,
} from "@/features/companies/company-labels";
import { cn } from "@/lib/utils";

export type CompanyContactItem = {
  id: string;
  type: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  whatsapp: string;
};

export type CompanyRegistrationEntry = { type: string; value: string };

export type CompanyIncorporationData = {
  id?: string;
  ownerName: string;
  companyName: string;
  businessName: string;
  businessType?: string;
  registrationType?: string;
  licenseNumber?: string;
  natureOfBusiness?: string;
  countryId?: string;
  countryBranchId?: string;
  cityBranchId?: string;
  isBranchOperative?: boolean;
  country: string;
  state: string;
  city: string;
  address: string;
};

type OwnerOption = { id: string; name: string; code: string | null; mobile: string | null; email: string | null };
type SisterCompany = { id: string; name: string; company_code: string | null; registration_number: string | null; country_name: string | null };
type BranchOption = { id: string; name: string; code: string | null; city_name?: string | null; company_id: string | null };
type DupCandidate = CompanyDuplicateCandidate & { reasons?: string[]; registrationNumber?: string | null; taxNumber?: string | null };

const CURRENCIES = ["AED", "PKR", "AFN", "INR", "CNY", "USD", "EUR", "GBP", "SAR", "IRR", "TRY", "OMR", "QAR"];
const CONTACT_TYPES = [
  { value: "main", key: "contact_main", en: "Main Contact" },
  { value: "authorized", key: "contact_authorized", en: "Authorized Person" },
  { value: "accounts", key: "contact_accounts", en: "Accounts" },
  { value: "operations", key: "contact_operations", en: "Operations" },
] as const;

// Repeatable tax-registration types (owner spec: NTN / TRN / VAT / GST / Other).
const TAX_TYPE_OPTIONS: Array<{ value: string; key: string; en: string }> = [
  { value: "ntn", key: "taxtype_ntn", en: "NTN" },
  { value: "trn", key: "taxtype_trn", en: "TRN" },
  { value: "vat", key: "taxtype_vat", en: "VAT" },
  { value: "gst", key: "taxtype_gst", en: "GST" },
  { value: "other", key: "taxtype_other", en: "Other" },
];
type TaxRegItem = { id: string; type: string; value: string };
const newTaxRegId = () => `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Repeatable contract details (migration 20261226 — tracking only, no accounting).
const CONTRACT_TYPE_OPTIONS: Array<{ value: string; key: string; en: string }> = [
  { value: "service", key: "ctype_service", en: "Service Agreement" },
  { value: "supply", key: "ctype_supply", en: "Supply Contract" },
  { value: "agency", key: "ctype_agency", en: "Agency Agreement" },
  { value: "lease", key: "ctype_lease", en: "Lease / Tenancy" },
  { value: "other", key: "ctype_other", en: "Other" },
];
type ContractItem = { id: string; type: string; reference: string; startDate: string; endDate: string; note: string };
const newContractId = () => `ct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const field = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const label = "mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300";
const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5";

function newContact(): CompanyContactItem {
  return { id: `c-${Math.random().toString(36).slice(2, 9)}`, type: "main", name: "", designation: "", email: "", phone: "", whatsapp: "" };
}

export function CompanyIncorporationForm({
  mode = "standalone",
  initialCompanyId,
  initialOwnerPersonId,
  onSave,
  onClose,
}: {
  mode?: "standalone" | "embedded";
  initialCompanyId?: string;
  initialOwnerPersonId?: string;
  onSave?: (data: CompanyIncorporationData) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const s = useErpScreen("cmf");
  const tt = s.tGlobal;
  const intake = useIntakeDraft("companies");

  const [loading, setLoading] = useState(Boolean(initialCompanyId));
  const [companyType, setCompanyType] = useState<"customer" | "internal">("customer");
  // owner (customer company)
  const [owner, setOwner] = useState<OwnerOption | null>(null);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerResults, setOwnerResults] = useState<OwnerOption[]>([]);
  const [ownerSearching, setOwnerSearching] = useState(false);
  const [sisters, setSisters] = useState<SisterCompany[]>([]);
  // legal identity
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [legalStructure, setLegalStructure] = useState("");
  const [natureOfBusiness, setNatureOfBusiness] = useState("");
  const [registrationType, setRegistrationType] = useState("trade_license");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  // Additional repeatable tax registrations (merged into the `registrations` jsonb on save).
  const [taxRegs, setTaxRegs] = useState<TaxRegItem[]>([]);
  // Repeatable contract details (saved to the companies.contracts jsonb).
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  // Live summary card (sticky; collapsible so it stays usable on mobile).
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [incorporationDate, setIncorporationDate] = useState("");
  const [licenseExpiryDate, setLicenseExpiryDate] = useState("");
  const [companyStatus, setCompanyStatus] = useState("active");
  const [baseCurrency, setBaseCurrency] = useState("");
  // location
  const [countries, setCountries] = useState<Array<{ id: string; name: string; currency_code?: string | null }>>([]);
  const [countryId, setCountryId] = useState("");
  const [stateName, setStateName] = useState("");
  const [cityName, setCityName] = useState("");
  // Location Management master ids (Country → State → District → City). Names above are kept for display/back-compat + dedup.
  const [stateProvinceId, setStateProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cityId, setCityId] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  // internal company → branches
  const [mainBranches, setMainBranches] = useState<BranchOption[]>([]);
  const [cityBranches, setCityBranches] = useState<BranchOption[]>([]);
  const [linkedMain, setLinkedMain] = useState<string[]>([]);
  const [linkedCity, setLinkedCity] = useState<string[]>([]);
  // contacts
  const [contacts, setContacts] = useState<CompanyContactItem[]>([]);
  // save / duplicates
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(initialCompanyId ?? null);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [liveDups, setLiveDups] = useState<DupCandidate[]>([]);
  const [dupModal, setDupModal] = useState<DupCandidate[] | null>(null);
  const prefilled = useRef(false);

  const reasonLabel = useCallback(
    (r: string) =>
      ({
        same_name: s.t("dup_same_name", "Same company name"),
        same_registration_number: s.t("dup_same_reg", "Same registration / license number"),
        same_tax_number: s.t("dup_same_trn", "Same TRN / tax number"),
        same_owner_same_name: s.t("dup_same_owner", "Same owner and same name"),
      })[r] ?? r,
    [s]
  );

  // ── reference data ─────────────────────────────────────────────────────────
  useEffect(() => {
    apiGet<any>("/api/branch-management/countries")
      .then((r) => setCountries((r?.countries ?? []).map((c: any) => ({ id: c.id, name: c.name, currency_code: c.currency_code ?? null }))))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!countryId) {
      setMainBranches([]);
      setCityBranches([]);
      return;
    }
    const q = encodeURIComponent(countryId);
    Promise.all([
      apiGet<any>(`/api/branch-management/country-branches?countryId=${q}`).catch(() => null),
      apiGet<any>(`/api/branch-management/city-branches?countryId=${q}`).catch(() => null),
    ]).then(([m, c]) => {
      const mb: BranchOption[] = (m?.countryBranches ?? []).map((b: any) => ({ id: b.id, name: b.name, code: b.code ?? null, company_id: b.company_id ?? null }));
      const cb: BranchOption[] = (c?.cityBranches ?? []).map((b: any) => ({ id: b.id, name: b.name, code: b.code ?? null, city_name: b.city_name ?? null, company_id: b.company_id ?? null }));
      setMainBranches(mb);
      setCityBranches(cb);
      if (savedId) {
        setLinkedMain(mb.filter((b) => b.company_id === savedId).map((b) => b.id));
        setLinkedCity(cb.filter((b) => b.company_id === savedId).map((b) => b.id));
      }
    });
  }, [countryId, savedId]);

  useEffect(() => {
    if (!baseCurrency && countryId) {
      const c = countries.find((x) => x.id === countryId);
      if (c?.currency_code) setBaseCurrency(c.currency_code);
    }
  }, [countryId, countries, baseCurrency]);

  // ── owner search (existing Customer Master — no new customer is created here) ──
  useEffect(() => {
    const q = ownerQuery.trim();
    if (q.length < 2 || (owner && ownerQuery === owner.name)) {
      setOwnerResults([]);
      return;
    }
    setOwnerSearching(true);
    const h = setTimeout(() => {
      apiGet<any>(`/api/erp/customers?q=${encodeURIComponent(q)}&limit=15&lang=${s.lang}`)
        .then((r) =>
          setOwnerResults(
            (r?.customers ?? []).map((c: any) => ({
              id: c.id,
              name: c.customer_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || "—",
              code: c.person_code || c.entry_serial || null,
              mobile: c.mobile || null,
              email: c.email || null,
            }))
          )
        )
        .catch(() => setOwnerResults([]))
        .finally(() => setOwnerSearching(false));
    }, 300);
    return () => clearTimeout(h);
  }, [ownerQuery, owner, s.lang]);

  const loadOwner = useCallback(async (id: string) => {
    try {
      const r = await apiGet<any>(`/api/erp/customers/${encodeURIComponent(id)}`);
      const c = r?.customer ?? r;
      if (c?.id) {
        const o = { id: c.id, name: c.customer_name || c.company_name || "—", code: c.person_code || null, mobile: c.mobile || null, email: c.email || null };
        setOwner(o);
        setOwnerQuery(o.name);
      }
    } catch {
      /* owner outside scope or removed — leave unselected */
    }
  }, []);

  useEffect(() => {
    if (!owner) {
      setSisters([]);
      return;
    }
    apiGet<any>(`/api/erp/companies?ownerPersonId=${encodeURIComponent(owner.id)}&limit=50&lang=${s.lang}`)
      .then((r) =>
        setSisters(
          (r?.companies ?? [])
            .filter((c: any) => c.id !== savedId)
            .map((c: any) => ({ id: c.id, name: c.name, company_code: c.company_code ?? null, registration_number: c.registration_number ?? null, country_name: c.country_name ?? null }))
        )
      )
      .catch(() => setSisters([]));
  }, [owner, savedId, s.lang]);

  useEffect(() => {
    if (initialOwnerPersonId && !initialCompanyId) void loadOwner(initialOwnerPersonId);
  }, [initialOwnerPersonId, initialCompanyId, loadOwner]);

  // ── edit: load the existing company (raw, untranslated source values) ─────
  useEffect(() => {
    if (!initialCompanyId) return;
    let alive = true;
    (async () => {
      try {
        const r = await apiGet<any>(`/api/erp/companies/${encodeURIComponent(initialCompanyId)}?raw=1`);
        const c = r?.company;
        if (!alive || !c) return;
        setCompanyType((c.company_type || c.effective_company_type || "customer") as "customer" | "internal");
        setLegalName(c.legal_name || c.name || "");
        setTradeName(c.trade_name || "");
        setLegalStructure(c.legal_structure || "");
        setNatureOfBusiness(c.nature_of_business || (!c.legal_structure ? c.business_type || "" : ""));
        setRegistrationType(c.registration_type || "trade_license");
        setRegistrationNumber(c.registration_number || "");
        setTaxNumber(c.tax_number || "");
        // Hydrate extra tax registrations from the stored jsonb, excluding the two primary values already shown above.
        {
          const primaryReg = String(c.registration_number || "").trim();
          const primaryTrn = String(c.tax_number || "").trim();
          const extra: TaxRegItem[] = Array.isArray(c.registrations)
            ? c.registrations
                .filter((r: any) => r && r.value && String(r.value).trim() !== primaryReg && String(r.value).trim() !== primaryTrn)
                .map((r: any) => ({ id: newTaxRegId(), type: String(r.type || "other").toLowerCase(), value: String(r.value).trim() }))
            : [];
          setTaxRegs(extra);
        }
        setContracts(
          Array.isArray(c.contracts)
            ? c.contracts.map((r: any) => ({
                id: newContractId(),
                type: String(r?.type || "service"),
                reference: String(r?.reference || ""),
                startDate: String(r?.startDate || r?.start_date || ""),
                endDate: String(r?.endDate || r?.end_date || ""),
                note: String(r?.note || ""),
              }))
            : [],
        );
        setIncorporationDate(c.incorporation_date || "");
        setLicenseExpiryDate(c.license_expiry_date || "");
        setCompanyStatus(c.company_status || "active");
        setBaseCurrency(c.base_currency || "");
        setCountryId(c.country_id || "");
        setStateName(c.state_name || "");
        setCityName(c.city_name || "");
        setStateProvinceId(c.state_province_id || "");
        setDistrictId(c.district_id || "");
        setCityId(c.city_id || "");
        setAddress(c.address || "");
        setZipCode(c.zip_code || "");
        setSavedCode(c.company_code || null);
        setContacts(
          (Array.isArray(c.contacts) ? c.contacts : []).map((x: any) => ({
            id: x.id || `c-${Math.random().toString(36).slice(2, 9)}`,
            type: x.type || "main",
            name: x.name || x.value || "",
            designation: x.designation || "",
            email: x.email || "",
            phone: x.phone || "",
            whatsapp: x.whatsapp || "",
          }))
        );
        if (c.owner_person_id) await loadOwner(c.owner_person_id);
      } catch (e: any) {
        if (alive) setError(e?.message || s.t("load_failed", "The company could not be loaded."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId, loadOwner]);

  // ── AI Document Intake draft → pre-fill only (the user reviews and saves) ─
  useEffect(() => {
    if (prefilled.current || !intake.draft) return;
    prefilled.current = true;
    const p = intake.payload || {};
    if (p.companyName) setLegalName(String(p.companyName));
    if (p.legalStructure) {
      const v = String(p.legalStructure).toLowerCase();
      const hit = LEGAL_STRUCTURE_OPTIONS.find((o) => v.includes(o.value.replace(/_/g, " ")) || v.includes(o.value));
      if (hit) setLegalStructure(hit.value);
    }
    if (p.natureOfBusiness) setNatureOfBusiness(String(p.natureOfBusiness));
    if (p.registrationNumber) setRegistrationNumber(String(p.registrationNumber));
    if (p.taxRegistrationNumber) setTaxNumber(String(p.taxRegistrationNumber));
    if (p.incorporationDate && /^\d{4}-\d{2}-\d{2}/.test(String(p.incorporationDate))) setIncorporationDate(String(p.incorporationDate).slice(0, 10));
    if (p.licenseExpiryDate && /^\d{4}-\d{2}-\d{2}/.test(String(p.licenseExpiryDate))) setLicenseExpiryDate(String(p.licenseExpiryDate).slice(0, 10));
    if (p.address) setAddress(String(p.address));
    if (p.baseCurrency && /^[A-Z]{3}$/.test(String(p.baseCurrency))) setBaseCurrency(String(p.baseCurrency));
    if (p.phone || p.email) setContacts((prev) => (prev.length ? prev : [{ ...newContact(), name: String(p.ownerName || ""), phone: String(p.phone || ""), email: String(p.email || "") }]));
  }, [intake.draft, intake.payload]);

  // ── live duplicate check (same rule the API enforces) ──────────────────────
  useEffect(() => {
    const name = legalName.trim();
    if (name.length < 3 && !registrationNumber.trim() && !taxNumber.trim()) {
      setLiveDups([]);
      return;
    }
    const h = setTimeout(() => {
      const qp = new URLSearchParams();
      if (name) qp.set("legalName", name);
      if (registrationNumber.trim()) qp.set("registrationNumber", registrationNumber.trim());
      if (taxNumber.trim()) qp.set("taxNumber", taxNumber.trim());
      if (owner?.id) qp.set("ownerPersonId", owner.id);
      if (countryId) qp.set("countryId", countryId);
      if (savedId) qp.set("excludeId", savedId);
      apiGet<any>(`/api/erp/companies/duplicates?${qp.toString()}`)
        .then((r) => setLiveDups(r?.candidates ?? []))
        .catch(() => setLiveDups([]));
    }, 450);
    return () => clearTimeout(h);
  }, [legalName, registrationNumber, taxNumber, owner, countryId, savedId]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (legalName.trim().length < 2) issues.push(s.t("v_legal_name", "Company legal name is required."));
    if (companyType === "customer" && !owner) issues.push(s.t("v_owner", "Select the existing Customer / Owner of this company."));
    if (!countryId) issues.push(s.t("v_country", "Country is required."));
    if (!baseCurrency) issues.push(s.t("v_currency", "Base currency is required."));
    if (incorporationDate && licenseExpiryDate && licenseExpiryDate < incorporationDate) issues.push(s.t("v_dates", "License expiry cannot be before the registration date."));
    return issues;
  }, [legalName, companyType, owner, countryId, baseCurrency, incorporationDate, licenseExpiryDate, s]);

  async function save(acknowledgeDuplicates = false) {
    setError(null);
    setJustSaved(false);
    if (validation.length) {
      setError(validation[0]);
      return;
    }
    setSaving(true);
    const country = countries.find((c) => c.id === countryId);
    const payload: Record<string, unknown> = {
      name: tradeName.trim() || legalName.trim(),
      legalName: legalName.trim(),
      tradeName: tradeName.trim() || null,
      companyType,
      ownerPersonId: companyType === "customer" ? owner?.id ?? null : null,
      ownerName: companyType === "customer" ? owner?.name ?? null : null,
      legalStructure: legalStructure || null,
      natureOfBusiness: natureOfBusiness.trim() || null,
      businessType: natureOfBusiness.trim() || null,
      registrationType: registrationType || null,
      registrationNumber: registrationNumber.trim() || null,
      taxNumber: taxNumber.trim() || null,
      incorporationDate: incorporationDate || null,
      licenseExpiryDate: licenseExpiryDate || null,
      companyStatus,
      baseCurrency,
      countryId,
      countryName: country?.name ?? null,
      stateName: stateName.trim() || null,
      cityName: cityName.trim() || null,
      stateProvinceId: stateProvinceId || null,
      districtId: districtId || null,
      cityId: cityId || null,
      address: address.trim() || null,
      zipCode: zipCode.trim() || null,
      isBranchOperative: companyType === "internal",
      originalLanguage: s.lang,
      contacts: contacts
        .filter((c) => c.name.trim() || c.phone.trim() || c.email.trim())
        .map((c) => ({ id: c.id, type: c.type, name: c.name.trim(), designation: c.designation.trim(), email: c.email.trim(), phone: c.phone.trim(), whatsapp: c.whatsapp.trim(), value: c.phone.trim() || c.email.trim() })),
      registrations: [
        registrationNumber.trim() ? { type: registrationType || "registration", value: registrationNumber.trim() } : null,
        taxNumber.trim() ? { type: "trn", value: taxNumber.trim() } : null,
        ...taxRegs
          .filter((r) => r.value.trim())
          .map((r) => ({ type: (r.type || "other").trim(), value: r.value.trim() })),
      ].filter(Boolean),
      contracts: contracts
        .filter((r) => r.reference.trim() || r.note.trim())
        .map((r) => ({ id: r.id, type: r.type, reference: r.reference.trim(), startDate: r.startDate, endDate: r.endDate, note: r.note.trim() })),
      acknowledgeDuplicates,
    };
    if (companyType === "internal") {
      payload.linkedCountryBranchIds = linkedMain;
      payload.linkedCityBranchIds = linkedCity;
    }
    try {
      const res = await fetch(savedId ? `/api/erp/companies/${encodeURIComponent(savedId)}` : "/api/erp/companies", {
        method: savedId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-erp-lang": s.lang },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409 && body?.error?.code === "POSSIBLE_DUPLICATE") {
        setDupModal(body.error.details?.candidates ?? []);
        return;
      }
      if (!res.ok || body?.ok === false) throw new Error(body?.error?.message || s.t("save_failed", "The company could not be saved."));
      const id: string = savedId ?? body?.data?.companyId;
      if (!savedId && id) {
        setSavedId(id);
        if (intake.draft) await intake.consume(id).catch(() => undefined);
        try {
          const r = await apiGet<any>(`/api/erp/companies/${encodeURIComponent(id)}?raw=1`);
          setSavedCode(r?.company?.company_code ?? null);
        } catch {
          /* code is shown after the next load */
        }
      }
      setJustSaved(true);
      onSave?.({
        id,
        ownerName: owner?.name ?? "",
        companyName: legalName.trim(),
        businessName: tradeName.trim(),
        natureOfBusiness,
        countryId,
        isBranchOperative: companyType === "internal",
        country: country?.name ?? "",
        state: stateName,
        city: cityName,
        address,
      });
    } catch (e: any) {
      setError(e?.message || s.t("save_failed", "The company could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const branchLinkedElsewhere = (b: BranchOption) => Boolean(b.company_id && b.company_id !== savedId);

  if (loading) {
    return (
      <div dir={s.dir} className="flex items-center gap-2 p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading company…")}
      </div>
    );
  }

  return (
    <div dir={s.dir} className={cn("w-full space-y-4 font-sans", mode === "embedded" ? "" : "mx-auto max-w-5xl")}>
      {/* Header */}
      <div className={cn(card, "flex flex-wrap items-center justify-between gap-3")}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">
              {savedId ? s.t("title_edit", "Edit Company — Company Master") : s.t("title_new", "New Company — Company Master")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {s.t("subtitle", "One legal company record. Accounts are opened in New Account; postings go through Roznamcha / Journal.")}
            </p>
          </div>
        </div>
        {savedCode && (
          <span data-testid="company-code" className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{savedCode}</span>
        )}
      </div>

      {/* Live Summary — sticky + collapsible so it stays reachable on mobile while the long form scrolls. */}
      <div className={cn(card, "sticky top-2 z-10 !p-0 overflow-hidden border-blue-200 dark:border-blue-900/50")}>
        <button
          type="button"
          onClick={() => setSummaryOpen((v) => !v)}
          aria-expanded={summaryOpen}
          className="flex w-full items-center justify-between gap-2 bg-blue-50/70 px-4 py-2.5 text-left dark:bg-blue-950/30"
        >
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            <FileText className="h-4 w-4" /> {s.t("live_summary", "Live Summary")}
          </span>
          <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
            {(legalName || tradeName || s.t("sum_untitled", "Untitled company")).trim()}
          </span>
        </button>
        {summaryOpen && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
            {[
              [s.t("nature_label", "Company Type / Business Nature"), natureOfBusiness || "—"],
              [s.t("country", "Country"), countries.find((c) => c.id === countryId)?.name || "—"],
              [s.t("state", "State / Province"), stateName || "—"],
              [s.t("city", "City"), cityName || "—"],
              [s.t("base_currency", "Base Currency"), baseCurrency || "—"],
              [s.t("sum_registrations", "Tax registrations"), String((registrationNumber.trim() ? 1 : 0) + (taxNumber.trim() ? 1 : 0) + taxRegs.filter((r) => r.value.trim()).length)],
              [s.t("sum_contracts", "Contracts"), String(contracts.filter((r) => r.reference.trim() || r.note.trim()).length)],
              [s.t("sum_contacts", "Contacts"), String(contacts.filter((c) => c.name.trim() || c.phone.trim() || c.email.trim()).length)],
            ].map(([k, v], i) => (
              <div key={i} className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">{k}</div>
                <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {intake.draft && (
        <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
          <ScanLine className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {s.t("prefilled", "Pre-filled from a reviewed document draft")} — <b className="font-mono">{(intake.draft as any).draftNo ?? (intake.draft as any).draft_no ?? ""}</b>.{" "}
            {s.t("prefilled_hint", "Check every value against the document before saving.")}
          </span>
        </div>
      )}

      {/* 1. Company type */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_type", "1. Company Type")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {COMPANY_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-testid={`company-type-${opt.value}`}
              onClick={() => setCompanyType(opt.value)}
              className={cn(
                "rounded-xl border p-3 text-start transition-colors",
                companyType === opt.value
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )}
            >
              <div className="text-sm font-bold text-slate-900 dark:text-white">{tt(opt.key, opt.en)}</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {opt.value === "customer"
                  ? s.t("type_customer_hint", "A legally registered company owned by an existing customer. One owner can own several sister companies.")
                  : s.t("type_internal_hint", "Our own registered legal entity. Link the branches that operate under it — branches stay branches.")}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Owner (customer company) */}
      {companyType === "customer" && (
        <section className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <UserRound className="h-4 w-4 text-blue-600" /> {s.t("sec_owner", "2. Customer / Owner")}
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="owner-search"
              className={cn(field, "ps-9")}
              value={ownerQuery}
              placeholder={s.t("owner_search_ph", "Search existing customer by name, code or mobile…")}
              onChange={(e) => {
                setOwnerQuery(e.target.value);
                if (owner && e.target.value !== owner.name) setOwner(null);
              }}
            />
            {ownerSearching && <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
            {ownerResults.length > 0 && !owner && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {ownerResults.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    data-testid="owner-option"
                    className="flex w-full flex-col items-start px-3 py-2 text-start hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => {
                      setOwner(o);
                      setOwnerQuery(o.name);
                      setOwnerResults([]);
                    }}
                  >
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{o.name}</span>
                    <span className="text-xs text-slate-500">{[o.code, o.mobile, o.email].filter(Boolean).join(" · ") || "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {owner ? (
            <div data-testid="owner-card" className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/50">
              <div className="font-bold text-slate-900 dark:text-white">{owner.name}</div>
              <div className="text-slate-500">{[owner.code, owner.mobile, owner.email].filter(Boolean).join(" · ") || "—"}</div>
              <div className="mt-2 font-semibold text-slate-700 dark:text-slate-300">
                {s.t("sister_companies", "Sister companies of this owner")} ({sisters.length})
              </div>
              {sisters.length === 0 ? (
                <div className="text-slate-500">{s.t("no_sisters", "No other registered company for this owner yet.")}</div>
              ) : (
                <ul className="mt-1 space-y-1">
                  {sisters.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      <Link2 className="h-3 w-3 text-slate-400" />
                      <span className="font-medium">{c.name}</span>
                      {c.company_code && <span className="font-mono text-[11px] text-slate-500">{c.company_code}</span>}
                      {c.registration_number && <span className="text-slate-500">· {c.registration_number}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 text-[11px] text-slate-500">{s.t("sister_separate", "Each company keeps its own registration, TRN, documents, contracts, orders and invoices — nothing is merged.")}</div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">{s.t("owner_hint", "Pick an existing customer. A new customer is created in Customer Management, never here.")}</p>
          )}
        </section>
      )}

      {/* Legal identity */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
          {companyType === "customer" ? s.t("sec_legal_3", "3. Legal Identity & Registration") : s.t("sec_legal_2", "2. Legal Identity & Registration")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>{s.t("legal_name", "Company Legal Name")} *</label>
            <input data-testid="legal-name" className={field} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div>
            <label className={label}>{s.t("trade_name", "Trade / Business Name")}</label>
            <input data-testid="trade-name" className={field} value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
          </div>
          <div>
            <label className={label}>{s.t("legal_structure", "Legal Structure")}</label>
            <select data-testid="legal-structure" className={field} value={legalStructure} onChange={(e) => setLegalStructure(e.target.value)}>
              <option value="">{s.t("select", "— Select —")}</option>
              {LEGAL_STRUCTURE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{tt(o.key, o.en)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>{s.t("nature_label", "Company Type / Business Nature")}</label>
            {(() => {
              // Controlled business-nature: the three system-defined types + Other (free text). Arbitrary text does
              // not change business rules — it is only stored as the descriptive nature. Existing free-text values
              // that are not one of the three are shown under "Other" so no saved data is lost.
              const NATURES = [
                { v: "Clearing Agent", k: "nature_clearing", en: "Clearing Agent" },
                { v: "Import / Export", k: "nature_import_export", en: "Import / Export" },
                { v: "Shipping Company", k: "nature_shipping", en: "Shipping Company" },
              ];
              const isKnown = NATURES.some((n) => n.v === natureOfBusiness);
              const selectVal = natureOfBusiness === "" ? "" : isKnown ? natureOfBusiness : "__other__";
              return (
                <>
                  <select
                    data-testid="nature-of-business"
                    className={field}
                    value={selectVal}
                    onChange={(e) => setNatureOfBusiness(e.target.value === "__other__" ? " " : e.target.value === "" ? "" : e.target.value)}
                  >
                    <option value="">{s.t("select", "— Select —")}</option>
                    {NATURES.map((n) => (
                      <option key={n.v} value={n.v}>{s.t(n.k, n.en)}</option>
                    ))}
                    <option value="__other__">{s.t("nature_other", "Other (specify)")}</option>
                  </select>
                  {selectVal === "__other__" && (
                    <input
                      className={cn(field, "mt-2")}
                      placeholder={s.t("nature_other_ph", "Describe the business nature")}
                      value={natureOfBusiness.trim() === "" ? "" : natureOfBusiness}
                      onChange={(e) => setNatureOfBusiness(e.target.value)}
                      autoFocus
                    />
                  )}
                </>
              );
            })()}
          </div>
          <div>
            <label className={label}>{s.t("registration_type", "Registration Type")}</label>
            <select className={field} value={registrationType} onChange={(e) => setRegistrationType(e.target.value)}>
              {REGISTRATION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{tt(o.key, o.en)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>{s.t("registration_number", "Registration / License Number")}</label>
            <input data-testid="registration-number" className={field} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
          </div>
          <div>
            <label className={label}>{s.t("tax_number", "TRN / Tax Number")}</label>
            <input data-testid="tax-number" className={field} value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
          </div>
          {/* Repeatable additional tax registrations — type dropdown (NTN/TRN/VAT/GST/Other) + number + add/remove */}
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className={label + " mb-0"}>{s.t("tax_registrations", "Tax Registrations")}</label>
              <button
                type="button"
                onClick={() => setTaxRegs((prev) => [...prev, { id: newTaxRegId(), type: "ntn", value: "" }])}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
              >
                <Plus className="h-3.5 w-3.5" /> {s.t("add_tax_reg", "Add tax registration")}
              </button>
            </div>
            {taxRegs.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">{s.t("tax_reg_hint", "Add NTN, TRN, VAT, GST or other tax registrations. Use “Add tax registration” for each one.")}</p>
            ) : (
              <div className="space-y-2">
                {taxRegs.map((r, idx) => (
                  <div key={r.id} className="grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
                    <select
                      className={field}
                      value={r.type}
                      onChange={(e) => setTaxRegs((prev) => prev.map((x, i) => (i === idx ? { ...x, type: e.target.value } : x)))}
                    >
                      {TAX_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.value === "other" ? s.t("taxtype_other", "Other") : o.en}</option>
                      ))}
                    </select>
                    <input
                      className={field}
                      value={r.value}
                      placeholder={s.t("tax_reg_number_ph", "Registration number")}
                      onChange={(e) => setTaxRegs((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                    />
                    <button
                      type="button"
                      aria-label={s.t("remove", "Remove")}
                      onClick={() => setTaxRegs((prev) => prev.filter((_, i) => i !== idx))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:hover:bg-rose-950/40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={label}>{s.t("base_currency", "Base Currency")} *</label>
            <select data-testid="base-currency" className={field} value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
              <option value="">{s.t("select", "— Select —")}</option>
              {[...new Set([baseCurrency, ...CURRENCIES].filter(Boolean))].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>{s.t("incorporation_date", "Registration / Incorporation Date")}</label>
            <input type="date" className={field} value={incorporationDate} onChange={(e) => setIncorporationDate(e.target.value)} />
          </div>
          <div>
            <label className={label}>{s.t("license_expiry", "License / Registration Expiry Date")}</label>
            <input type="date" data-testid="license-expiry" className={field} value={licenseExpiryDate} onChange={(e) => setLicenseExpiryDate(e.target.value)} />
          </div>
          <div>
            <label className={label}>{s.t("status", "Company Status")}</label>
            <select data-testid="company-status" className={field} value={companyStatus} onChange={(e) => setCompanyStatus(e.target.value)}>
              {COMPANY_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{tt(o.key, o.en)}</option>
              ))}
            </select>
          </div>
        </div>

        {liveDups.length > 0 && (
          <div data-testid="dup-warning" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="mb-1 flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-4 w-4" /> {s.t("dup_live_title", "Possible existing company — check before saving")}
            </div>
            <ul className="space-y-1">
              {liveDups.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <b>{d.legalName || d.name}</b> {d.companyCode && <span className="font-mono">({d.companyCode})</span>} — {(d.reasons ?? []).map(reasonLabel).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Country, address and (internal) branches */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_location", "Country, Address & Branches")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>{s.t("country", "Country")} *</label>
            <select
              data-testid="country"
              className={field}
              value={countryId}
              onChange={(e) => {
                setCountryId(e.target.value);
                setLinkedMain([]);
                setLinkedCity([]);
                // Reset the location cascade so no stale state/district/city carries across countries.
                setStateProvinceId("");
                setDistrictId("");
                setCityId("");
                setStateName("");
                setCityName("");
              }}
            >
              <option value="">{s.t("select", "— Select —")}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            {/* Location Management master: State → District → City cascade from the country above, with built-in "+ New" / Manage links. */}
            <LocationHierarchySelect
              lang={s.lang}
              showCountry={false}
              showDistrict
              value={{ countryId, stateProvinceId, districtId, cityId }}
              onChange={(next, meta) => {
                setStateProvinceId(next.stateProvinceId);
                setDistrictId(next.districtId);
                setCityId(next.cityId);
                setStateName(meta.state?.name || "");
                setCityName(meta.city?.name || "");
              }}
            />
          </div>
          <div>
            <label className={label}>{s.t("zip", "Postal Code")}</label>
            <input className={field} value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{s.t("address", "Registered Address")}</label>
            <textarea className={cn(field, "h-20 py-2")} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>

        {companyType === "internal" && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-bold text-slate-800 dark:text-slate-200">{s.t("linked_branches", "Branches operating under this legal company")}</div>
            <p className="mb-2 text-[11px] text-slate-500">{s.t("linked_branches_hint", "Company = registered legal entity; Branch = operational unit. Linking does not create a company per branch.")}</p>
            {!countryId ? (
              <div className="text-xs text-slate-500">{s.t("pick_country_first", "Select the country first.")}</div>
            ) : mainBranches.length + cityBranches.length === 0 ? (
              <div className="text-xs text-slate-500">{s.t("no_branches", "No branches found in this country for your access.")}</div>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {[...mainBranches.map((b) => ({ ...b, lvl: "main" as const })), ...cityBranches.map((b) => ({ ...b, lvl: "city" as const }))].map((b) => {
                  const checked = b.lvl === "main" ? linkedMain.includes(b.id) : linkedCity.includes(b.id);
                  const toggle = () =>
                    b.lvl === "main"
                      ? setLinkedMain((p) => (p.includes(b.id) ? p.filter((x) => x !== b.id) : [...p, b.id]))
                      : setLinkedCity((p) => (p.includes(b.id) ? p.filter((x) => x !== b.id) : [...p, b.id]));
                  return (
                    <label key={b.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                      <input type="checkbox" data-testid="branch-link" data-branch-id={b.id} className="mt-0.5" checked={checked} onChange={toggle} />
                      <span className="min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-white">{b.name}</span>
                        <span className="ms-1 text-slate-500">
                          {b.lvl === "main" ? s.t("main_branch", "Main Branch") : s.t("city_branch", "City Branch")}
                          {b.code ? ` · ${b.code}` : ""}
                        </span>
                        {branchLinkedElsewhere(b) && (
                          <span className="block text-amber-700 dark:text-amber-300">{s.t("branch_other_company", "Currently linked to another company — saving moves it here.")}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Contract details — repeatable "+ Add"; tracking only (companies.contracts jsonb). */}
      <section className={card}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_contracts", "Contract Details")}</h3>
          <button
            type="button"
            onClick={() => setContracts((p) => [...p, { id: newContractId(), type: "service", reference: "", startDate: "", endDate: "", note: "" }])}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" /> {s.t("add_contract", "Add contract")}
          </button>
        </div>
        {contracts.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">{s.t("contracts_hint", "Optional. Add one or more contracts (service, supply, agency, lease…). Tracking only — no accounting posting.")}</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((r, idx) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className={label}>{s.t("contract_type", "Type")}</label>
                    <select className={field} value={r.type} onChange={(e) => setContracts((p) => p.map((x, j) => (j === idx ? { ...x, type: e.target.value } : x)))}>
                      {CONTRACT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{s.t(o.key, o.en)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>{s.t("contract_ref", "Reference / No.")}</label>
                    <input className={field} value={r.reference} onChange={(e) => setContracts((p) => p.map((x, j) => (j === idx ? { ...x, reference: e.target.value } : x)))} />
                  </div>
                  <div>
                    <label className={label}>{s.t("contract_start", "Start Date")}</label>
                    <input type="date" className={field} value={r.startDate} onChange={(e) => setContracts((p) => p.map((x, j) => (j === idx ? { ...x, startDate: e.target.value } : x)))} />
                  </div>
                  <div>
                    <label className={label}>{s.t("contract_end", "End Date")}</label>
                    <input type="date" className={field} value={r.endDate} onChange={(e) => setContracts((p) => p.map((x, j) => (j === idx ? { ...x, endDate: e.target.value } : x)))} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className={label}>{s.t("contract_note", "Note")}</label>
                    <div className="flex items-center gap-2">
                      <input className={field} value={r.note} onChange={(e) => setContracts((p) => p.map((x, j) => (j === idx ? { ...x, note: e.target.value } : x)))} />
                      <button
                        type="button"
                        aria-label={s.t("remove", "Remove")}
                        onClick={() => setContracts((p) => p.filter((_, j) => j !== idx))}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:hover:bg-rose-950/40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Contacts */}
      <section className={card}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_contacts", "Contacts & Authorized Persons")}</h3>
          <button type="button" onClick={() => setContacts((p) => [...p, newContact()])} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <Plus className="h-3.5 w-3.5" /> {s.t("add_contact", "Add Contact")}
          </button>
        </div>
        {contacts.length === 0 ? (
          <div className="text-xs text-slate-500">{s.t("no_contacts", "No contacts added.")}</div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c, i) => (
              <div key={c.id} className="grid gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700 sm:grid-cols-6">
                <select className={field} value={c.type} onChange={(e) => setContacts((p) => p.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
                  {CONTACT_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{s.t(o.key, o.en)}</option>
                  ))}
                </select>
                <input className={field} placeholder={s.t("c_name", "Name")} value={c.name} onChange={(e) => setContacts((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className={field} placeholder={s.t("c_designation", "Designation")} value={c.designation} onChange={(e) => setContacts((p) => p.map((x, j) => (j === i ? { ...x, designation: e.target.value } : x)))} />
                <input className={field} placeholder={s.t("c_phone", "Phone")} value={c.phone} onChange={(e) => setContacts((p) => p.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                <input className={field} placeholder={s.t("c_email", "Email")} value={c.email} onChange={(e) => setContacts((p) => p.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                <div className="flex gap-2">
                  <input className={field} placeholder={s.t("c_whatsapp", "WhatsApp")} value={c.whatsapp} onChange={(e) => setContacts((p) => p.map((x, j) => (j === i ? { ...x, whatsapp: e.target.value } : x)))} />
                  <button type="button" aria-label={s.t("remove", "Remove")} onClick={() => setContacts((p) => p.filter((_, j) => j !== i))} className="rounded-lg px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documents — existing Document Management, no second storage */}
      <section className={card}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <FileText className="h-4 w-4 text-blue-600" /> {s.t("sec_documents", "Company Documents")}
        </h3>
        <p className="text-xs text-slate-500">
          {s.t("documents_hint", "Trade license, registration / TRN certificates, establishment card and other legal documents are kept in Document Management and linked to this company.")}
        </p>
        {savedId ? (
          <button
            type="button"
            data-testid="open-documents"
            onClick={() => router.push(`/dashboard/documents?companyId=${encodeURIComponent(savedId)}` as Route)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
          >
            <FileText className="h-3.5 w-3.5" /> {s.t("open_documents", "Open company documents")}
          </button>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{s.t("documents_after_save", "Save the company first, then attach its documents.")}</p>
        )}
      </section>

      {/* Accounting architecture notice (a rule, not an action) */}
      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>{s.t("accounting_rule", "Company Master stores legal data only. Bank Master registers banks, New Account opens accounts, and Roznamcha / Journal posts debit and credit.")}</span>
      </div>

      {error && (
        <div role="alert" data-testid="form-error" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}
      {justSaved && !error && (
        <div data-testid="form-saved" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {s.t("saved", "Company saved.")} {savedCode && <span className="font-mono">{savedCode}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pb-6">
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            {s.t("close", "Close")}
          </button>
        )}
        <button
          type="button"
          data-testid="save-company"
          disabled={saving}
          onClick={() => void save(false)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {savedId ? s.t("save_changes", "Save Changes") : s.t("save_company", "Save Company")}
        </button>
      </div>

      {dupModal && (
        <CompanyDuplicateWarningModal
          lang={s.lang}
          searchedName={legalName.trim()}
          candidates={dupModal.map((d) => ({ ...d, ownerName: [d.ownerName, (d.reasons ?? []).map(reasonLabel).join(", ")].filter(Boolean).join(" — ") }))}
          onUseExisting={(id) => {
            setDupModal(null);
            router.push(`/dashboard/settings/company-setup?companyId=${encodeURIComponent(id)}` as Route);
          }}
          onCreateAnyway={() => {
            setDupModal(null);
            void save(true);
          }}
          onCancel={() => setDupModal(null)}
        />
      )}
    </div>
  );
}
