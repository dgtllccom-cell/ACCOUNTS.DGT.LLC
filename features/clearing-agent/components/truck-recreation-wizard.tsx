"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Truck as TruckIcon,
  User,
  Building2,
  UserCheck,
  Save,
  X,
  Plus,
  Loader2,
  Search,
  Eye,
  ListChecks,
  ArrowLeft,
  FileText,
  Users,
  Globe,
  Columns as ColumnsIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Check,
  ArrowRight,
  Printer,
  UploadCloud,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Trash2,
  Download,
  Phone,
  Mail,
  HelpCircle,
  Calendar,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Fuel,
  Scale,
  Landmark,
  CreditCard,
  Palette,
  Tag,
  Settings,
  Briefcase,
  MapPin,
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { transliterateProperNoun, transliterateToLatin } from "@/lib/i18n/transliteration";
import "./truck-registration.css";
import { PersonPicker } from "@/components/erp/person-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { Party360Modal } from "@/features/customers/components/party-360-modal";
import { viewTruckReport, printTruckReport, downloadTruckPdf } from "@/lib/reports/master-profiles/truck-report-actions";
import type { TruckProfileRecord } from "@/lib/reports/master-profiles/build-truck-profile";
import { ReportActions } from "@/components/ui/report-actions";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { TruckAttachments } from "@/features/clearing-agent/components/truck-attachments";
import { Th } from "@/components/ui/translated-th";

/**
 * Clearing Truck Registration (Shipping & Clearing). Table: trucks.
 *
 * Implements the DGT Truck Developer Package specifications:
 * - Table-first landing list with live KPI analytics
 * - Compact registration form (left) with larger sticky Live Truck Report (right)
 * - Owner/Customer Selection with registered account profile
 * - Merged Truck & Vehicle details card
 * - Transporter / Shipping Line information with Yes/No company link
 * - Driver Information with photo upload, up to 10 repeatable contacts, and location management
 * - Drag-and-drop session documents with View / Download
 * - "View ⌄" dropdown menu with full Live Truck Report & section overlays
 * - Preserves existing ERP master data selectors, APIs (/api/erp/master-data/trucks), and database contracts
 */

type CustomerDetails = {
  id: string;
  customer_name?: string;
  first_name?: string;
  last_name?: string;
  father_name?: string;
  gender?: string;
  date_of_birth?: string;
  marital_status?: string;
  nationality?: string;
  code?: string;
  person_code?: string;
  photo_url?: string | null;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  cnic?: string;
  passport?: string;
  license_no?: string;
  license_type?: string;
  license_issue_date?: string;
  license_expiry?: string;
  issuing_authority?: string;
  address?: string;
  country?: string;
  country_name?: string;
  state?: string;
  state_province_name?: string;
  city?: string;
  city_name?: string;
  is_active?: boolean;
  registrations?: Array<{
    registration_type?: string;
    registration_value?: string;
  }>;
  contacts?: Array<{
    contact_type?: string;
    contact_value?: string;
    is_primary?: boolean;
  }>;
};

type CompanyDetails = {
  id: string;
  name?: string;
  legal_name?: string;
  trade_name?: string;
  company_code?: string;
  owner_name?: string;
  tax_number?: string;
  registration_number?: string;
  country_name?: string;
  state_name?: string;
  city_name?: string;
  address?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  contacts?: Array<{ type?: string; value?: string; isPrimary?: boolean }>;
  registrations?: Array<{ type?: string; value?: string }>;
};

function cleanTitle(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const stripped = raw.replace(/^[0-9۰-۹]+\s*[\.\:،-]?\s*/, "").trim();
  return stripped || fallback;
}

function companyPhone(company: CompanyDetails | null | undefined): string | undefined {
  if (!company) return undefined;
  if (company.phone) return company.phone;
  if (company.mobile) return company.mobile;
  if (Array.isArray(company.contacts) && company.contacts.length > 0) {
    const primary = company.contacts.find((c) => c.isPrimary)?.value;
    if (primary) return primary;
    const byType = (t: string) => company.contacts!.find((c) => (c.type || "").toLowerCase() === t)?.value;
    return byType("office") || byType("mobile") || byType("phone") || byType("whatsapp") || company.contacts[0]?.value;
  }
  return undefined;
}

function companyEmail(company: CompanyDetails | null | undefined): string | undefined {
  if (!company) return undefined;
  if (company.email) return company.email;
  if (Array.isArray(company.contacts) && company.contacts.length > 0) {
    const byType = company.contacts.find((c) => (c.type || "").toLowerCase() === "email")?.value;
    if (byType) return byType;
  }
  return undefined;
}

function companyRegNumber(company: CompanyDetails | null | undefined): string | undefined {
  if (!company) return undefined;
  if (company.registration_number) return company.registration_number;
  if (company.tax_number) return company.tax_number;
  if (Array.isArray(company.registrations) && company.registrations.length > 0) {
    return company.registrations[0]?.value;
  }
  return undefined;
}

type TruckRow = {
  id: string;
  truck_number: string;
  truck_name: string | null;
  model: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  registration_number: string | null;
  truck_type: string | null;
  make: string | null;
  manufacturing_year: number | null;
  color: string | null;
  fuel_type: string | null;
  capacity: string | null;
  registration_expiry_date: string | null;
  insurance_expiry_date: string | null;
  owner_person_id: string | null;
  owner_display_name: string | null;
  transport_company_id: string | null;
  company_display_name: string | null;
  transporter_person_id: string | null;
  transporter_display_name: string | null;
  driver_person_id: string | null;
  driver_display_name: string | null;
  driver_mobile: string | null;
  driver_cnic_passport: string | null;
  driver_docs_expiry_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  branch_display_name: string | null;
  country_display_name: string | null;
  super_admin_serial: string | null;
  country_serial: string | null;
  branch_serial: string | null;
  entry_serial: string | null;
};

export type ContactType = "WhatsApp" | "Mobile" | "Phone" | "Email";

export type ContactEntry = {
  id: string;
  type: ContactType;
  value: string;
};

export type SessionDocument = {
  id: string;
  name: string;
  size: number;
  url: string;
  file?: File;
};

const EMPTY_FORM = {
  hasOwner: "yes",
  ownerId: "",
  ownerType: "Truck Owner",
  truckNumber: "",
  truckName: "",
  truckModel: "",
  chassisNumber: "",
  engineNumber: "",
  registrationNumber: "",
  truckType: "",
  make: "",
  manufacturingYear: "",
  color: "",
  fuelType: "",
  capacity: "",
  registrationExpiryDate: "",
  insuranceProvider: "",
  insuranceExpiryDate: "",
  fitnessCertificateExpiryDate: "",
  companyLink: "yes",
  companyType: "transporter",
  companyId: "",
  transporterId: "",
  driverType: "permanent",
  temporaryDriverName: "",
  temporaryDriverFirstName: "",
  temporaryDriverLastName: "",
  driverFatherName: "",
  driverDob: "",
  driverCnic: "",
  driverNationality: "",
  driverId: "",
  driverMobile: "",
  driverWhatsapp: "",
  driverEmail: "",
  driverLicenseNo: "",
  driverLicenseType: "",
  driverLicenseIssueDate: "",
  driverLicenseExpiry: "",
  driverIssuingAuthority: "",
  driverMaritalStatus: "",
  addDriverLocation: "yes",
  driverCountry: "",
  driverState: "",
  driverCity: "",
  driverAddress: "",
  remarks: "",
  status: "active",
  registrationDate: new Date().toISOString().slice(0, 10),
};

type ViewMode = "list" | "form";
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
type OptionalColumnKey = "truckName" | "model" | "company" | "transporter" | "mobile" | "branch";

export function TruckRecreationWizard({
  lang: initialLang = "en",
  userName = null,
  isSuperAdmin = false,
}: {
  lang?: SupportedLanguage;
  userName?: string | null;
  isSuperAdmin?: boolean;
}) {
  const globalLang = useActiveLanguage();
  const activeLang = (globalLang || initialLang) as SupportedLanguage;
  const dir = getLanguageDirection(activeLang);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);
  const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);

  // Names / addresses are stored in the script they were typed in. Everything the user READS (picker, Live Report, View Report, print)
  // is shown in the language selected on screen; the stored record is never rewritten by this.
  const ARABIC_SCRIPT = /[\u0600-\u06FF]/;
  const nameText = (raw?: string | null): string => {
    const v = String(raw ?? "").trim();
    if (!v) return "";
    if (activeLang === "en") return ARABIC_SCRIPT.test(v) ? transliterateToLatin(v) : v;
    return transliterateProperNoun(v, activeLang);
  };
  const stepOf = (n: number) => tt("trk.w_step_n_of_total", "Step {n} of {total}").replace("{n}", String(n)).replace("{total}", "5");
  const stepAlert = (text: string) => {
    setMessage({ kind: "error", text });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  /** Language the server must resolve record names in: ALWAYS what is on screen (never the possibly stale cookie). */
  const langQ = `lang=${encodeURIComponent(activeLang)}`;

  const [view, setView] = useState<ViewMode>("list");
  const [form, setForm] = useState(EMPTY_FORM);
  const [contacts, setContacts] = useState<ContactEntry[]>([
    { id: "c-1", type: "WhatsApp", value: "" },
  ]);
  const [driverPhotoUrl, setDriverPhotoUrl] = useState<string | null>(null);
  const [driverPhotoName, setDriverPhotoName] = useState<string | null>(null);
  const [documents, setDocuments] = useState<SessionDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Report actions in flight ("view" | "print" | "pdf") — disables the buttons and shows a spinner
  const [reportBusy, setReportBusy] = useState<null | "view" | "print" | "pdf">(null);

  // Step-by-Step Wizard state (1: Owner, 2: Truck, 3: Transporter & Company, 4: Driver, 5: Documents)
  const [activeStep, setActiveStep] = useState<number>(1);

  // Card collapse state
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({
    owner: false,
    vehicle: false,
    transporter: false,
    driver: false,
    documents: false,
  });

  const [ownerDetails, setOwnerDetails] = useState<CustomerDetails | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [transporterDetails, setTransporterDetails] = useState<CustomerDetails | null>(null);
  const [driverDetails, setDriverDetails] = useState<CustomerDetails | null>(null);

  const [party360, setParty360] = useState<{ customerId: string; name: string } | null>(null);

  const [rows, setRows] = useState<TruckRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [visibleCols, setVisibleCols] = useState<Record<OptionalColumnKey, boolean>>({
    truckName: true,
    model: true,
    company: true,
    transporter: true,
    mobile: true,
    branch: false,
  });

  const [nowStr, setNowStr] = useState("");
  useEffect(() => { setNowStr(new Date().toLocaleString()); }, []);

  type TruckOption = { id: string; category: string; code: string; name_en: string; name_ur: string; name_ar: string; name_fa: string; name_ps: string };
  const [truckOptions, setTruckOptions] = useState<TruckOption[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/erp/master-data/truck-options");
        const json = await res.json().catch(() => ({}));
        setTruckOptions(json.options || []);
      } catch {
        setTruckOptions([]);
      }
    })();
  }, []);

  function optionLabel(o: TruckOption): string {
    const byLang: Record<string, string | undefined> = { en: o.name_en, ur: o.name_ur, ar: o.name_ar, fa: o.name_fa, ps: o.name_ps };
    return byLang[activeLang] || o.name_en || o.code;
  }

  const truckTypeOptions = useMemo(() => truckOptions.filter((o) => o.category === "truck_type"), [truckOptions]);
  const makeOptions = useMemo(() => truckOptions.filter((o) => o.category === "make"), [truckOptions]);
  const colorOptions = useMemo(() => truckOptions.filter((o) => o.category === "color"), [truckOptions]);
  const fuelTypeOptions = useMemo(() => truckOptions.filter((o) => o.category === "fuel_type"), [truckOptions]);

  // Close menus on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function loadList() {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/erp/master-data/trucks?lang=${encodeURIComponent(activeLang)}`);
      const json = await res.json();
      setRows(json.trucks || []);
    } catch {
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLang]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, pageSize]);

  // ── Linked-record lookups ──────────────────────────────────────────────────────────────────────────
  // DISPLAY copy  (…?lang=<language on screen>) feeds the Live Report / View / print and is fetched again when the language changes.
  // RAW copy      (…?raw=1) is the record exactly as it was entered: it pre-fills the form and is what gets SAVED, so a display
  //               translation can never overwrite the original name.
  const [ownerRaw, setOwnerRaw] = useState<any | null>(null);
  const [companyRaw, setCompanyRaw] = useState<any | null>(null);
  const [driverRaw, setDriverRaw] = useState<any | null>(null);

  useEffect(() => {
    if (!form.ownerId || form.hasOwner === "no") {
      setOwnerDetails(null);
      setOwnerRaw(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [res, raw] = await Promise.all([
          fetch(`/api/erp/customers/${encodeURIComponent(form.ownerId)}?${langQ}`).then((r) => r.json()),
          fetch(`/api/erp/customers/${encodeURIComponent(form.ownerId)}?raw=1`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (res?.data?.customer) setOwnerDetails(res.data.customer);
        if (raw?.data?.customer) setOwnerRaw(raw.data.customer);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.ownerId, form.hasOwner, activeLang]);

  useEffect(() => {
    if (!form.companyId || form.companyLink === "no") {
      setCompanyDetails(null);
      setCompanyRaw(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [res, raw] = await Promise.all([
          fetch(`/api/erp/companies/${encodeURIComponent(form.companyId)}?${langQ}`).then((r) => r.json()),
          fetch(`/api/erp/companies/${encodeURIComponent(form.companyId)}?raw=1`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        const comp = res?.data?.company || res?.company;
        if (comp) setCompanyDetails(comp);
        const rawComp = raw?.data?.company || raw?.company;
        if (rawComp) setCompanyRaw(rawComp);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.companyId, form.companyLink, activeLang]);

  useEffect(() => {
    if (!form.transporterId) {
      setTransporterDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(form.transporterId)}?${langQ}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.data?.customer) setTransporterDetails(res.data.customer);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.transporterId, activeLang]);

  function withDriverLicense(customer: any, registrations: any[], contactRows: any[]): CustomerDetails {
    const c: CustomerDetails = { ...customer, registrations: registrations || [], contacts: contactRows || [] };
    // Try to extract license number from registrations if not directly on customer
    const dlReg = c.registrations?.find((r) =>
      ["driving_license", "driving_licence", "license", "licence", "dl"].includes((r.registration_type || "").toLowerCase().trim())
    );
    if (!c.license_no && dlReg?.registration_value) c.license_no = dlReg.registration_value;
    return c;
  }

  /** Fill the empty driver fields of `prev` from the driver's own (raw, original-script) record. */
  function mergeDriverPrefill(prev: typeof EMPTY_FORM, c: CustomerDetails): typeof EMPTY_FORM {
    return {
      ...prev,
      driverMobile: prev.driverMobile || c.mobile || c.whatsapp || "",
      driverWhatsapp: prev.driverWhatsapp || c.whatsapp || c.mobile || "",
      driverEmail: prev.driverEmail || c.email || "",
      driverLicenseNo: prev.driverLicenseNo || c.license_no || "",
      driverLicenseExpiry: prev.driverLicenseExpiry || c.license_expiry || "",
      driverFatherName: prev.driverFatherName || c.father_name || "",
      driverDob: prev.driverDob || (c as any).date_of_birth || "",
      driverCnic: prev.driverCnic || c.cnic || "",
      driverNationality: prev.driverNationality || (c as any).nationality || "",
      driverLicenseType: prev.driverLicenseType || (c as any).license_type || "",
      driverLicenseIssueDate: prev.driverLicenseIssueDate || (c as any).license_issue_date || "",
      driverIssuingAuthority: prev.driverIssuingAuthority || (c as any).issuing_authority || "",
      driverMaritalStatus: prev.driverMaritalStatus || (c as any).marital_status || "",
      driverCountry: prev.driverCountry || c.country_name || c.country || "",
      driverState: prev.driverState || c.state_province_name || c.state || "",
      driverCity: prev.driverCity || c.city_name || c.city || "",
      driverAddress: prev.driverAddress || c.address || "",
    };
  }

  // Driver — display copy (follows the language on screen)
  useEffect(() => {
    if (!form.driverId || form.driverType !== "permanent") {
      setDriverDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(form.driverId)}?${langQ}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.data?.customer) setDriverDetails(withDriverLicense(res.data.customer, res.data.registrations, res.data.contacts));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.driverId, form.driverType, activeLang]);

  // Driver — RAW copy: pre-fills the form once per selected driver (original script, no invented defaults, never language-dependent)
  useEffect(() => {
    if (!form.driverId || form.driverType !== "permanent") {
      setDriverRaw(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(form.driverId)}?raw=1`).then((r) => r.json());
        if (cancelled) return;
        if (res?.data?.customer) {
          const c = withDriverLicense(res.data.customer, res.data.registrations, res.data.contacts);
          setDriverRaw(c);
          setForm((prev) => mergeDriverPrefill(prev, c));
          // Pre-populate contacts row if empty
          if (c.mobile || c.whatsapp) {
            setContacts((prev) => {
              const existingFilled = prev.filter((r) => r.value.trim().length > 0);
              if (existingFilled.length === 0) {
                const next: ContactEntry[] = [];
                if (c.whatsapp) next.push({ id: "c-wa", type: "WhatsApp", value: c.whatsapp });
                if (c.mobile && c.mobile !== c.whatsapp) next.push({ id: "c-mob", type: "Mobile", value: c.mobile });
                return next.length > 0 ? next : prev;
              }
              return prev;
            });
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.driverId, form.driverType]);

  function toggleCollapse(cardKey: string) {
    setCollapsedCards((prev) => ({ ...prev, [cardKey]: !prev[cardKey] }));
  }

  function scrollToSection(cardId: string) {
    if (cardId === "ownerCard") setActiveStep(1);
    else if (cardId === "vehicleCard") setActiveStep(2);
    else if (cardId === "transporterCard") setActiveStep(3);
    else if (cardId === "driverCard") setActiveStep(4);
    else if (cardId === "documentsCard") setActiveStep(5);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Contact management (up to 10 rows)
  function handleAddContact() {
    if (contacts.length >= 10) return;
    setContacts((prev) => [...prev, { id: `c-${Date.now()}-${prev.length}`, type: "WhatsApp", value: "" }]);
  }

  function handleRemoveContact(index: number) {
    if (contacts.length <= 1) {
      setContacts([{ id: "c-1", type: "WhatsApp", value: "" }]);
      return;
    }
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleContactTypeChange(index: number, type: ContactType) {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, type } : c))
    );
  }

  function handleContactValueChange(index: number, value: string) {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, value } : c))
    );
  }

  // Driver photo upload
  function handleDriverPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      stepAlert(tt("trk.w_alert_photo", "Please upload a JPG or PNG image under 5 MB."));
      e.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setDriverPhotoUrl(url);
    setDriverPhotoName(file.name);
    e.target.value = "";
  }

  // Document upload
  function handleAddDocuments(files: FileList | File[]) {
    const acceptedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const added: SessionDocument[] = [];
    Array.from(files).forEach((f) => {
      if (acceptedTypes.includes(f.type) && f.size <= 10 * 1024 * 1024) {
        added.push({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          size: f.size,
          url: URL.createObjectURL(f),
          file: f,
        });
      }
    });
    if (added.length > 0) {
      setDocuments((prev) => [...prev, ...added]);
    }
  }

  function handleRemoveDocument(docId: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setContacts([{ id: "c-1", type: "WhatsApp", value: "" }]);
    setDriverPhotoUrl(null);
    setDriverPhotoName(null);
    setDocuments([]);
    setEditingId(null);
    setActiveStep(1);
    setOwnerDetails(null);
    setCompanyDetails(null);
    setTransporterDetails(null);
    setDriverDetails(null);
    setOwnerRaw(null);
    setCompanyRaw(null);
    setDriverRaw(null);
  }

  function openNewRegistration() {
    resetForm();
    setMessage(null);
    setView("form");
    setActiveStep(1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToList() {
    clearTruckDraft();
    resetForm();
    setMessage(null);
    setView("list");
  }

  /** The saved record as form state. Nothing is invented: a value the record does not have stays empty. */
  function formFromRow(row: TruckRow): typeof EMPTY_FORM {
    let extraNotes: any = {};
    try {
      if (row.notes && row.notes.startsWith("{")) extraNotes = JSON.parse(row.notes);
    } catch {}
    return {
        hasOwner: row.owner_person_id ? "yes" : "no",
        ownerId: row.owner_person_id || "",
        ownerType: extraNotes.ownerType || "Truck Owner",
        truckNumber: row.truck_number || "",
        truckName: row.truck_name || "",
        truckModel: row.model || "",
        chassisNumber: row.chassis_number || "",
        engineNumber: row.engine_number || "",
        companyLink: row.transport_company_id || row.transporter_person_id ? "yes" : "no",
        companyType: "transporter",
        companyId: row.transport_company_id || "",
        transporterId: row.transporter_person_id || "",
        driverType: row.driver_person_id ? "permanent" : "temporary",
        temporaryDriverName: row.driver_display_name || "",
        temporaryDriverFirstName: extraNotes.temporaryDriverFirstName || "",
        temporaryDriverLastName: extraNotes.temporaryDriverLastName || "",
        driverFatherName: extraNotes.driverFatherName || "",
        driverDob: extraNotes.driverDob || "",
        driverCnic: extraNotes.driverCnic || "",
        driverNationality: extraNotes.driverNationality || "",
        driverId: row.driver_person_id || "",
        driverMobile: row.driver_mobile || "",
        driverWhatsapp: extraNotes.driverWhatsapp || "",
        driverEmail: extraNotes.driverEmail || "",
        driverLicenseNo: row.driver_cnic_passport || "",
        driverLicenseType: extraNotes.driverLicenseType || "",
        driverLicenseIssueDate: extraNotes.driverLicenseIssueDate || "",
        driverLicenseExpiry: row.driver_docs_expiry_date || "",
        driverIssuingAuthority: extraNotes.driverIssuingAuthority || "",
        driverMaritalStatus: extraNotes.driverMaritalStatus || "",
        addDriverLocation: "yes",
        driverCountry: "",
        driverState: "",
        driverCity: "",
        driverAddress: "",
        remarks: String(extraNotes.userNotes !== undefined ? (extraNotes.userNotes ?? "") : row.notes || ""),
        status: row.status || "active",
        registrationDate: (row.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
        registrationNumber: row.registration_number || "",
        truckType: row.truck_type || "",
        make: row.make || "",
        manufacturingYear: row.manufacturing_year ? String(row.manufacturing_year) : "",
        color: row.color || "",
        fuelType: row.fuel_type || "",
        capacity: row.capacity || "",
        registrationExpiryDate: row.registration_expiry_date || "",
        insuranceProvider: extraNotes.insuranceProvider || "",
        insuranceExpiryDate: row.insurance_expiry_date || "",
        fitnessCertificateExpiryDate: extraNotes.fitnessCertificateExpiryDate || "",
      };
  }

  function startEdit(row: TruckRow) {
    setEditingId(row.id);
    setActiveStep(1);
    setForm(formFromRow(row));
    if (row.driver_mobile) {
      setContacts([{ id: "c-1", type: "WhatsApp", value: row.driver_mobile }]);
    }
    setMessage(null);
    setView("form");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── In-progress registration survives a language switch / reload / step navigation (sessionStorage of this tab) ──
  const TRUCK_DRAFT_KEY = "dgt-trk-draft-v2";
  const [draftChecked, setDraftChecked] = useState(false);
  function clearTruckDraft() {
    try { sessionStorage.removeItem(TRUCK_DRAFT_KEY); } catch { /* ignore */ }
  }
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TRUCK_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.form) {
          setForm({ ...EMPTY_FORM, ...d.form });
          if (Array.isArray(d.contacts) && d.contacts.length) setContacts(d.contacts);
          setActiveStep(Number(d.activeStep) >= 1 && Number(d.activeStep) <= 5 ? Number(d.activeStep) : 1);
          setEditingId(d.editingId || null);
          setView("form");
        }
      }
    } catch { /* ignore */ }
    setDraftChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!draftChecked || view !== "form") return;
    try {
      sessionStorage.setItem(TRUCK_DRAFT_KEY, JSON.stringify({ form, contacts, activeStep, editingId }));
    } catch { /* ignore */ }
  }, [draftChecked, view, form, contacts, activeStep, editingId]);

  // Save Draft to LocalStorage
  function handleSaveDraft() {
    try {
      const draft = { form, contacts };
      localStorage.setItem("dgt-truck-registration-draft-v1", JSON.stringify(draft));
      setMessage({
        kind: "success",
        text: tt("trk.success_msg", "Draft successfully saved in this browser! Uploaded files remain in this session."),
      });
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage({ kind: "error", text: tt("common.error", "Something went wrong.") });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(tt("common.delete", "Delete") + "?")) return;
    try {
      const res = await fetch(`/api/erp/master-data/trucks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      await loadList();
    } catch {
      setMessage({ kind: "error", text: tt("common.error", "Something went wrong.") });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.truckNumber.trim() || !form.chassisNumber.trim() || !form.engineNumber.trim()) {
      setMessage({ kind: "error", text: tt("trk.required_fields_error", "Please fill mandatory fields: Truck Number, Chassis No, Engine No.") });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const firstValidContact = contacts.find((c) => c.value.trim().length > 0)?.value.trim() || form.driverMobile.trim() || null;
      const driverName =
        form.driverType === "permanent"
          ? driverRaw?.customer_name || driverDetails?.customer_name || null
          : form.temporaryDriverName.trim() || null;

      const extraMetadata = {
        ownerType: form.ownerType,
        insuranceProvider: form.insuranceProvider.trim() || null,
        fitnessCertificateExpiryDate: form.fitnessCertificateExpiryDate || null,
        temporaryDriverFirstName: form.temporaryDriverFirstName.trim() || null,
        temporaryDriverLastName: form.temporaryDriverLastName.trim() || null,
        driverFatherName: form.driverFatherName.trim() || null,
        driverDob: form.driverDob || null,
        driverCnic: form.driverCnic.trim() || null,
        driverNationality: form.driverNationality.trim() || null,
        driverWhatsapp: form.driverWhatsapp.trim() || null,
        driverEmail: form.driverEmail.trim() || null,
        driverLicenseType: form.driverLicenseType.trim() || null,
        driverLicenseIssueDate: form.driverLicenseIssueDate || null,
        driverIssuingAuthority: form.driverIssuingAuthority.trim() || null,
        driverMaritalStatus: form.driverMaritalStatus || null,
        userNotes: form.remarks.trim() || null,
      };

      const payload = {
        truck_number: form.truckNumber.trim(),
        truck_name: form.truckName.trim() || null,
        model: form.truckModel.trim() || null,
        chassis_number: form.chassisNumber.trim(),
        engine_number: form.engineNumber.trim(),
        owner_person_id: form.hasOwner === "yes" && form.ownerId ? form.ownerId : null,
        owner_name: form.hasOwner === "yes" ? ownerRaw?.customer_name || ownerDetails?.customer_name || null : null,
        owner_mobile: form.hasOwner === "yes" ? ownerRaw?.mobile || ownerDetails?.mobile || ownerDetails?.whatsapp || null : null,
        transport_company_id: form.companyLink === "yes" && form.companyId ? form.companyId : null,
        transport_company: form.companyLink === "yes" ? companyRaw?.name || companyDetails?.name || null : null,
        transporter_person_id: form.transporterId ? form.transporterId : null,
        driver_person_id: form.driverType === "permanent" && form.driverId ? form.driverId : null,
        driver_name: driverName,
        driver_mobile: firstValidContact,
        driver_cnic_passport: form.driverLicenseNo.trim() || null,
        driver_docs_expiry_date: form.driverLicenseExpiry || null,
        notes: JSON.stringify(extraMetadata),
        status: form.status,
        registration_number: form.registrationNumber.trim() || null,
        truck_type: form.truckType || null,
        make: form.make || null,
        manufacturing_year: form.manufacturingYear ? Number(form.manufacturingYear) : null,
        color: form.color || null,
        fuel_type: form.fuelType || null,
        capacity: form.capacity.trim() || null,
        registration_expiry_date: form.registrationExpiryDate || null,
        insurance_expiry_date: form.insuranceExpiryDate || null,
      };

      const url = editingId ? `/api/erp/master-data/trucks/${editingId}` : "/api/erp/master-data/trucks";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || tt("common.error", "Something went wrong."));
      }

      const wasEditing = Boolean(editingId);
      try {
        localStorage.removeItem("dgt-truck-registration-draft-v1");
      } catch {
        /* ignore */
      }
      clearTruckDraft();
      resetForm();
      setView("list");
      await loadList();
      setMessage({
        kind: "success",
        text: wasEditing
          ? tt("trk.updated_success_msg", "Truck Record Successfully Updated!")
          : tt("trk.success_msg", "Truck Record Successfully Created!"),
      });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || tt("common.error", "Something went wrong.") });
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        [r.truck_number, r.truck_name, r.model, r.owner_display_name, r.company_display_name, r.transporter_display_name, r.driver_display_name]
          .some((v) => (v || "").toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(pageStart, pageStart + pageSize);

  const totalTrucks = rows.length;
  const activeTrucksCount = rows.filter((r) => r.status === "active").length;
  const registeredOwnersCount = new Set(rows.map((r) => r.owner_person_id).filter(Boolean)).size;
  const assignedDriversCount = new Set(rows.map((r) => r.driver_person_id).filter(Boolean)).size;
  const pendingCount = rows.filter((r) => r.status === "suspended").length;
  const inactiveCount = rows.filter((r) => r.status === "inactive" || r.status === "expired").length;

  const countryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const name = r.country_display_name;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  const distinctCountries = useMemo(() => new Set(rows.map((r) => r.country_display_name).filter(Boolean)), [rows]);
  const distinctBranches = useMemo(() => new Set(rows.map((r) => r.branch_display_name).filter(Boolean)), [rows]);
  const scopeCountryLabel =
    distinctCountries.size === 0 ? "—" : distinctCountries.size === 1 ? [...distinctCountries][0]! : tt("common.all_countries", "All Countries");
  const scopeBranchLabel =
    distinctBranches.size === 0 ? "—" : distinctBranches.size === 1 ? [...distinctBranches][0]! : tt("trk.col_branch", "Branch");

  const statusLabel = (status: string) =>
    status === "active"
      ? tt("common.active", "Active")
      : status === "inactive"
        ? tt("common.inactive", "Inactive")
        : status === "suspended"
          ? tt("trk.badge_pending", "Pending")
          : status === "expired"
            ? tt("trk.badge_completed", "Completed")
            : status;

  const statusBadgeClasses = (status: string) =>
    status === "active"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  // Report date: "13 Oct 2026" in English; month names in the selected language otherwise (Latin digits, so numbers never change).
  function formatReportDate(iso?: string | null): string {
    if (!iso) return "—";
    const s0 = String(iso).trim();
    if (!s0) return "—";
    try {
      let d: Date | null = null;
      const ymd = s0.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (ymd) d = new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
      else {
        const t0 = new Date(s0);
        if (!isNaN(t0.getTime())) d = new Date(Date.UTC(t0.getFullYear(), t0.getMonth(), t0.getDate()));
      }
      if (!d || isNaN(d.getTime())) return s0;
      const locale = ({ en: "en-GB", ur: "ur-PK", ar: "ar", fa: "fa-IR", ps: "ps-AF" } as Record<string, string>)[activeLang] || "en-GB";
      return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
    } catch {
      return s0;
    }
  }

  // Key-Value Row matching Option 1
  const Option1Row = ({
    icon: Icon,
    iconColor = "text-[#0b5394] dark:text-sky-400",
    label,
    value,
    badge,
  }: {
    icon?: any;
    iconColor?: string;
    label: string;
    value?: string | number | null;
    badge?: React.ReactNode;
  }) => {
    const raw = value !== undefined && value !== null ? String(value).trim() : "";
    const displayValue = raw !== "" ? raw : "—";
    const isDash = displayValue === "—";
    return (
      <div className="flex items-center justify-between gap-3 text-[13px] leading-snug py-1.5 border-b border-slate-200/60 dark:border-slate-800/60 last:border-b-0 gap-1.5">
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />}
          <span className="text-slate-600 dark:text-slate-400 font-semibold truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0 justify-end text-end">
          <span className="text-slate-400 dark:text-slate-500 font-bold shrink-0">:</span>
          {badge ? (
            badge
          ) : (
            <span className={`font-bold break-words text-end ${isDash ? "text-slate-400 font-bold" : "text-slate-900 dark:text-slate-100"}`}>
              {displayValue}
            </span>
          )}
        </div>
      </div>
    );
  };

  const Option1ActiveBadge = ({ status = "Active" }: { status?: string }) => (
    <span className="inline-flex items-center rounded-full bg-emerald-500 text-white px-3 py-0.5 text-[10px] font-bold shadow-2xs">
      {status || "Active"}
    </span>
  );

  // ── Report values ─────────────────────────────────────────────────────────────────────────────
  // Rules: names/addresses are shown in the language on screen (nm), codes / numbers / phones are NEVER touched, and a missing
  // value is "—" — nothing is invented. The stored record keeps the original text (see handleSubmit: raw copies).
  const DASH = "—";
  const nm = (v?: string | null) => nameText(v) || DASH;
  const val = (v?: string | number | null) => (v !== undefined && v !== null && String(v).trim() !== "" ? String(v).trim() : DASH);
  /** Known English choice values (select options saved as such) shown in the language on screen. */
  const KNOWN_CHOICES: Record<string, [string, string]> = {
    "Truck Owner": ["trk.w_truck_owner", "Truck Owner"],
    "Trailer Truck": ["trk.w_trailer_truck", "Trailer Truck"],
    "Container Truck": ["trk.w_container_truck", "Container Truck"],
    "Flatbed Truck": ["trk.w_flatbed_truck", "Flatbed Truck"],
    "Box Truck": ["trk.w_box_truck", "Box Truck"],
    White: ["trk.w_white", "White"],
    Blue: ["trk.w_blue", "Blue"],
    Black: ["trk.w_black", "Black"],
    Red: ["trk.w_red", "Red"],
    Silver: ["trk.w_silver", "Silver"],
    Diesel: ["trk.w_diesel", "Diesel"],
    Petrol: ["trk.w_petrol", "Petrol"],
    Electric: ["trk.w_electric", "Electric"],
    Hybrid: ["trk.w_hybrid", "Hybrid"],
    Married: ["trk.w_married", "Married"],
    Single: ["trk.w_single", "Single"],
  };
  const choice = (v?: string | null, category?: string) => {
    const raw = String(v ?? "").trim();
    if (!raw) return DASH;
    const opt = truckOptions.find((o) => o.code === raw && (!category || o.category === category));
    if (opt) return optionLabel(opt);
    const known = KNOWN_CHOICES[raw];
    if (known) return tt(known[0], known[1]);
    return nm(raw);
  };

  type ReportSrc = {
    form: typeof EMPTY_FORM;
    ownerDetails: CustomerDetails | null; ownerRaw: any;
    companyDetails: CompanyDetails | null; companyRaw: any;
    transporterDetails: CustomerDetails | null;
    driverDetails: CustomerDetails | null; driverRaw: any;
    contacts: ContactEntry[]; driverPhotoUrl: string | null;
  };

  /** Every value shown in the report, derived from ONE source object — the live screen and a saved list row use the same code. */
  function deriveReport(src: ReportSrc) {
    const { form, ownerDetails, ownerRaw, companyDetails, companyRaw, driverDetails, driverRaw, contacts, driverPhotoUrl } = src;
  // Owner
  const ownerRawName = ownerRaw?.customer_name || ownerDetails?.customer_name || "";
  const ownerRegNo = val(ownerDetails?.person_code || ownerDetails?.code);
  const ownerFullName = nm(ownerDetails?.customer_name || ownerRawName);
  const ownerFirstName = nm(ownerRaw?.first_name || ownerDetails?.first_name || ownerRawName.split(/\s+/)[0]);
  const ownerLastName = nm(ownerRaw?.last_name || ownerDetails?.last_name || ownerRawName.split(/\s+/).slice(1).join(" "));
  const ownerFatherName = nm(ownerRaw?.father_name || ownerDetails?.father_name);
  const ownerCnic = val(ownerDetails?.cnic || ownerDetails?.registrations?.find((r) => /cnic|id|national/i.test(r.registration_type || ""))?.registration_value);
  const ownerNationality = nm((ownerRaw as any)?.nationality || (ownerDetails as any)?.nationality);
  const ownerMobile = val(ownerDetails?.mobile);
  const ownerWhatsapp = val(ownerDetails?.whatsapp || ownerDetails?.mobile);
  const ownerEmail = val(ownerDetails?.email);
  const ownerCountry = val(ownerDetails?.country_name || ownerDetails?.country);
  const ownerState = val(ownerDetails?.state_province_name || ownerDetails?.state);
  const ownerCity = val(ownerDetails?.city_name || ownerDetails?.city);
  const ownerAddress = nm(ownerRaw?.address || ownerDetails?.address);

  // Company
  const companyName = nm(companyDetails?.name);
  const companyBusinessName = nm(companyDetails?.legal_name || companyDetails?.trade_name);
  const companyRegNo = val(companyDetails?.company_code);
  const companyNtn = val(companyDetails?.tax_number || companyDetails?.registrations?.find((r) => /tax|ntn|trn/i.test(r.type || ""))?.value);
  const companyLicenseNo = val(companyDetails?.registrations?.find((r) => /license|licence/i.test(r.type || ""))?.value || companyDetails?.registration_number);
  const companyBusinessType = nm((companyDetails as any)?.business_type);
  const companyCountry = val(companyDetails?.country_name);
  const companyState = val(companyDetails?.state_name);
  const companyCity = val(companyDetails?.city_name);
  const companyAddress = nm(companyRaw?.address || companyDetails?.address);
  const companyPhoneNum = val(companyPhone(companyDetails));
  const companyWhatsappNum = val(companyDetails?.contacts?.find((c) => /whatsapp/i.test(c.type || ""))?.value || companyPhone(companyDetails));
  const companyEmailAddr = val(companyEmail(companyDetails));
  const companyRegDate = (companyDetails as any)?.created_at ? (companyDetails as any).created_at.slice(0, 10) : "";

  // Driver
  const isPermanentDriver = form.driverType === "permanent";
  const effectiveDriverPhoto = isPermanentDriver ? (driverDetails?.photo_url || driverPhotoUrl) : driverPhotoUrl;
  const driverRawName = isPermanentDriver ? (driverRaw?.customer_name || driverDetails?.customer_name || "") : (form.temporaryDriverName || "");
  const driverRegNo = isPermanentDriver ? val(driverDetails?.person_code || driverDetails?.code) : DASH;
  const driverFullName = nm(isPermanentDriver ? (driverDetails?.customer_name || driverRawName) : form.temporaryDriverName);
  const driverFirstName = nm(isPermanentDriver
    ? (driverRaw?.first_name || driverDetails?.first_name || driverRawName.split(/\s+/)[0])
    : (form.temporaryDriverFirstName || driverRawName.split(/\s+/)[0]));
  const driverLastName = nm(isPermanentDriver
    ? (driverRaw?.last_name || driverDetails?.last_name || driverRawName.split(/\s+/).slice(1).join(" "))
    : (form.temporaryDriverLastName || driverRawName.split(/\s+/).slice(1).join(" ")));
  const driverFatherName = nm(form.driverFatherName || driverRaw?.father_name || driverDetails?.father_name);
  const driverDob = isPermanentDriver ? ((driverDetails as any)?.date_of_birth || form.driverDob || "") : (form.driverDob || "");
  const driverCnic = val(form.driverCnic || (isPermanentDriver ? (driverDetails?.cnic || driverDetails?.registrations?.find((r) => /cnic|id|national/i.test(r.registration_type || ""))?.registration_value) : ""));
  const driverNationality = nm(form.driverNationality || (isPermanentDriver ? (driverRaw as any)?.nationality : ""));
  const driverMobile = val(isPermanentDriver
    ? (driverDetails?.mobile || form.driverMobile)
    : (form.driverMobile || contacts.find((c) => c.type === "Mobile")?.value));
  const driverWhatsapp = val(isPermanentDriver
    ? (driverDetails?.whatsapp || driverDetails?.mobile || form.driverWhatsapp)
    : (contacts.find((c) => c.type === "WhatsApp")?.value || form.driverWhatsapp || form.driverMobile));
  const driverEmail = val(isPermanentDriver
    ? (driverDetails?.email || form.driverEmail)
    : (contacts.find((c) => c.type === "Email")?.value || form.driverEmail));
  const driverLicenseNumber = val(form.driverLicenseNo || (isPermanentDriver ? driverDetails?.license_no : ""));
  const driverLicenseType = nm(form.driverLicenseType);
  const driverIssueDate = form.driverLicenseIssueDate || "";
  const driverExpiryDate = form.driverLicenseExpiry || (isPermanentDriver ? driverDetails?.license_expiry || "" : "");
  const driverIssuingAuthority = nm(form.driverIssuingAuthority);
  const driverMaritalStatus = choice(form.driverMaritalStatus);
    return { ownerRawName, ownerRegNo, ownerFullName, ownerFirstName, ownerLastName, ownerFatherName, ownerCnic, ownerNationality, ownerMobile, ownerWhatsapp, ownerEmail, ownerCountry, ownerState, ownerCity, ownerAddress, companyName, companyBusinessName, companyRegNo, companyNtn, companyLicenseNo, companyBusinessType, companyCountry, companyState, companyCity, companyAddress, companyPhoneNum, companyWhatsappNum, companyEmailAddr, companyRegDate, isPermanentDriver, effectiveDriverPhoto, driverRawName, driverRegNo, driverFullName, driverFirstName, driverLastName, driverFatherName, driverDob, driverCnic, driverNationality, driverMobile, driverWhatsapp, driverEmail, driverLicenseNumber, driverLicenseType, driverIssueDate, driverExpiryDate, driverIssuingAuthority, driverMaritalStatus };
  }

  const liveSrc: ReportSrc = { form, ownerDetails, ownerRaw, companyDetails, companyRaw, transporterDetails, driverDetails, driverRaw, contacts, driverPhotoUrl };
  const { ownerRawName, ownerRegNo, ownerFullName, ownerFirstName, ownerLastName, ownerFatherName, ownerCnic, ownerNationality, ownerMobile, ownerWhatsapp, ownerEmail, ownerCountry, ownerState, ownerCity, ownerAddress, companyName, companyBusinessName, companyRegNo, companyNtn, companyLicenseNo, companyBusinessType, companyCountry, companyState, companyCity, companyAddress, companyPhoneNum, companyWhatsappNum, companyEmailAddr, companyRegDate, isPermanentDriver, effectiveDriverPhoto, driverRawName, driverRegNo, driverFullName, driverFirstName, driverLastName, driverFatherName, driverDob, driverCnic, driverNationality, driverMobile, driverWhatsapp, driverEmail, driverLicenseNumber, driverLicenseType, driverIssueDate, driverExpiryDate, driverIssuingAuthority, driverMaritalStatus } = deriveReport(liveSrc);

  const E = (v?: string | number | null): string => {
    const x = v === undefined || v === null ? "" : String(v).trim();
    return x === DASH ? "" : x;
  };

  /** The report document model — values already in the language on screen; empty strings for anything the record does not hold. */
  function toTruckRecord(src: ReportSrc, extra: { branchName?: string | null; reportId?: string | null; registrationDate?: string | null } = {}): TruckProfileRecord {
    const R = deriveReport(src);
    const f = src.form;
    const perm = f.driverType === "permanent";
    const td = src.transporterDetails;
    const dd = src.driverDetails;
    const driverLoc = perm
      ? { country: val(dd?.country_name || dd?.country), state: val(dd?.state_province_name || dd?.state), city: val(dd?.city_name || dd?.city), address: nm(dd?.address) }
      : f.addDriverLocation === "yes"
        ? { country: nm(f.driverCountry), state: nm(f.driverState), city: nm(f.driverCity), address: nm(f.driverAddress) }
        : { country: DASH, state: DASH, city: DASH, address: DASH };
    const photo = R.effectiveDriverPhoto || null;
    return {
      truckNumber: f.truckNumber.trim(),
      statusLabel: statusLabel(f.status),
      registrationDate: E(formatReportDate(extra.registrationDate ?? f.registrationDate)),
      branchName: E(extra.branchName),
      driverPhotoUrl: photo && /^(https?:|data:|blob:|\/)/.test(photo) ? photo : null,
      reportId: E(extra.reportId) || f.truckNumber.trim(),
      owner: {
        regNo: E(R.ownerRegNo), type: E(choice(f.ownerType || "Truck Owner")), fullName: E(R.ownerFullName), fatherName: E(R.ownerFatherName),
        cnic: E(R.ownerCnic), nationality: E(R.ownerNationality), mobile: E(R.ownerMobile), whatsapp: E(R.ownerWhatsapp), email: E(R.ownerEmail),
        country: E(R.ownerCountry), state: E(R.ownerState), city: E(R.ownerCity), address: E(R.ownerAddress),
      },
      company: {
        name: E(R.companyName), businessName: E(R.companyBusinessName), regNo: E(R.companyRegNo), ntn: E(R.companyNtn), licenseNo: E(R.companyLicenseNo),
        businessType: E(R.companyBusinessType), country: E(R.companyCountry), state: E(R.companyState), city: E(R.companyCity), address: E(R.companyAddress),
        phone: E(R.companyPhoneNum), whatsapp: E(R.companyWhatsappNum), email: E(R.companyEmailAddr), regDate: E(formatReportDate(R.companyRegDate)),
      },
      truck: {
        truckNumber: f.truckNumber.trim(), type: E(choice(f.truckType, "truck_type")), name: E(nm(f.truckName)), make: E(f.make), model: E(f.truckModel),
        year: E(f.manufacturingYear), color: E(choice(f.color, "color")), fuel: E(choice(f.fuelType, "fuel_type")),
        capacity: f.capacity ? `${f.capacity} ${tt("trk.w_tons", "Tons")}` : "",
        chassis: E(f.chassisNumber), engine: E(f.engineNumber), regNo: E(f.registrationNumber),
        regExpiry: E(formatReportDate(f.registrationExpiryDate)), insuranceProvider: E(f.insuranceProvider),
        insuranceExpiry: E(formatReportDate(f.insuranceExpiryDate)), fitnessExpiry: E(formatReportDate(f.fitnessCertificateExpiryDate)),
      },
      transporter: td
        ? { name: E(nm(td.customer_name)), code: E(td.person_code || td.code), mobile: E(td.mobile), whatsapp: E(td.whatsapp), address: E(nm(td.address)) }
        : {},
      driver: {
        kind: perm ? tt("trk.w_permanent", "Permanent") : tt("trk.w_temporary", "Temporary"),
        regNo: E(R.driverRegNo), fullName: E(R.driverFullName), fatherName: E(R.driverFatherName), dob: E(formatReportDate(R.driverDob)),
        cnic: E(R.driverCnic), nationality: E(R.driverNationality), marital: E(R.driverMaritalStatus), mobile: E(R.driverMobile),
        whatsapp: E(R.driverWhatsapp), email: E(R.driverEmail),
        country: E(driverLoc.country), state: E(driverLoc.state), city: E(driverLoc.city), address: E(driverLoc.address),
        licenseNo: E(R.driverLicenseNumber), licenseType: E(R.driverLicenseType), issueDate: E(formatReportDate(R.driverIssueDate)),
        expiryDate: E(formatReportDate(R.driverExpiryDate)), authority: E(R.driverIssuingAuthority),
      },
      remarks: (f.remarks || "").trim(),
    };
  }

  const REPORT_ACTION = { view: viewTruckReport, print: printTruckReport, pdf: downloadTruckPdf } as const;
  async function runReport(kind: "view" | "print" | "pdf", build: () => Promise<TruckProfileRecord>) {
    if (reportBusy) return;
    setReportBusy(kind);
    try {
      const record = await build();
      await REPORT_ACTION[kind](record, activeLang);
    } catch (err) {
      console.error("[truck-report]", kind, err);
      stepAlert(tt("common.error", "Something went wrong."));
    } finally {
      setReportBusy(null);
    }
  }
  /** Live Truck Report (what is on screen right now). */
  const runLiveReport = (kind: "view" | "print" | "pdf") => runReport(kind, async () => toTruckRecord(liveSrc));
  /** A saved row from the list: its full record + linked owner / company / transporter / driver, in the language on screen. */
  const runRowReport = (row: TruckRow, kind: "view" | "print" | "pdf") =>
    runReport(kind, async () => {
      const f0 = formFromRow(row);
      const getJson = async (url: string) => { try { return await fetch(url).then((r) => r.json()); } catch { return null; } };
      const [own, ownRaw, comp, compRaw, trans, drv, drvRaw] = await Promise.all([
        f0.ownerId ? getJson(`/api/erp/customers/${encodeURIComponent(f0.ownerId)}?${langQ}`) : null,
        f0.ownerId ? getJson(`/api/erp/customers/${encodeURIComponent(f0.ownerId)}?raw=1`) : null,
        f0.companyId ? getJson(`/api/erp/companies/${encodeURIComponent(f0.companyId)}?${langQ}`) : null,
        f0.companyId ? getJson(`/api/erp/companies/${encodeURIComponent(f0.companyId)}?raw=1`) : null,
        f0.transporterId ? getJson(`/api/erp/customers/${encodeURIComponent(f0.transporterId)}?${langQ}`) : null,
        f0.driverId && f0.driverType === "permanent" ? getJson(`/api/erp/customers/${encodeURIComponent(f0.driverId)}?${langQ}`) : null,
        f0.driverId && f0.driverType === "permanent" ? getJson(`/api/erp/customers/${encodeURIComponent(f0.driverId)}?raw=1`) : null,
      ]);
      const driverRawC = drvRaw?.data?.customer ? withDriverLicense(drvRaw.data.customer, drvRaw.data.registrations, drvRaw.data.contacts) : null;
      const src: ReportSrc = {
        form: driverRawC ? mergeDriverPrefill(f0, driverRawC) : f0,
        ownerDetails: own?.data?.customer ?? null,
        ownerRaw: ownRaw?.data?.customer ?? null,
        companyDetails: comp?.data?.company || comp?.company || null,
        companyRaw: compRaw?.data?.company || compRaw?.company || null,
        transporterDetails: trans?.data?.customer ?? null,
        driverDetails: drv?.data?.customer ? withDriverLicense(drv.data.customer, drv.data.registrations, drv.data.contacts) : null,
        driverRaw: driverRawC,
        contacts: row.driver_mobile ? [{ id: "c-1", type: "WhatsApp", value: row.driver_mobile }] : [],
        driverPhotoUrl: null,
      };
      return toTruckRecord(src, { branchName: row.branch_display_name, reportId: row.entry_serial || row.truck_number, registrationDate: (row.created_at || "").slice(0, 10) });
    });

  // Full Live Report Content (OPTION 1: DGT ERP TRANSPORT REGISTRATION PROFILE)
  const fullLiveReportContent = (
    <div className="space-y-4">
      {/* TOP HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0284c7] via-[#0369a1] to-[#0b3b75] p-3.5 sm:p-4 text-white shadow-md border border-sky-400/30">
        {/* Background Cargo Ship & Port Silhouette Graphic */}
        <div className="absolute right-0 top-0 bottom-0 w-2/5 opacity-20 pointer-events-none overflow-hidden flex items-center justify-end pr-2">
          <svg className="h-full w-auto text-white" viewBox="0 0 240 100" fill="currentColor">
            <path d="M20 78 L50 78 L55 68 L110 68 L115 78 L220 78 L195 96 L35 96 Z" />
            <rect x="58" y="52" width="22" height="15" rx="1" />
            <rect x="82" y="52" width="22" height="15" rx="1" />
            <rect x="106" y="52" width="22" height="15" rx="1" />
            <rect x="64" y="36" width="20" height="14" rx="1" />
            <rect x="86" y="36" width="20" height="14" rx="1" />
            <path d="M150 25 L156 78 M175 15 L181 78 M140 38 L195 38" stroke="currentColor" strokeWidth="2.5" />
            <path d="M190 20 L225 20 M205 20 L208 78" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-13 w-13 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 shadow-inner">
            <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono drop-shadow-sm leading-none">
              DGT ERP
            </div>
            <div className="mt-1 text-xs sm:text-sm font-black tracking-wide text-white uppercase drop-shadow-xs">
              {tt("trk.w_transport_registration_profile", "TRANSPORT REGISTRATION PROFILE")}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-sky-100 tracking-tight">
              {tt("trk.w_owner_company_truck_driver_complete_in", "Owner - Company - Truck - Driver (Complete Information)")}
            </div>
          </div>
        </div>
      </div>

      {/* 1. TRANSPORT OWNER & COMPANY DETAILS */}
      <div className="rounded-2xl border border-sky-200 bg-[#f0f7ff] shadow-sm overflow-hidden dark:border-sky-900/60 dark:bg-slate-900/60">
        {/* Header Bar */}
        <div className="bg-[#0b5394] px-3.5 py-2 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider">
              {tt("trk.w_1_transport_owner_and_company_details", "1. TRANSPORT OWNER & COMPANY DETAILS")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => scrollToSection("ownerCard")}
            className="text-[10px] font-bold text-sky-200 hover:text-white underline"
          >
            {tt("trk.w_edit", "Edit")}
          </button>
        </div>

        {/* Card Content - 2 Columns */}
        <div className="p-3 sm:p-4 trk-two-col gap-4">
          {/* Left: OWNER INFORMATION */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 pb-2 mb-1.5 border-b border-sky-200/70 dark:border-slate-800 text-[#0b5394] dark:text-sky-300">
              <User className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-wider">
                {tt("trk.w_owner_information", "OWNER INFORMATION")}
              </span>
            </div>
            <Option1Row icon={CreditCard} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_registration_no", "Registration No.")} value={ownerRegNo} />
            <Option1Row icon={UserCheck} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_owner_type", "Owner Type")} value={choice(form.ownerType || "Truck Owner")} />
            <Option1Row icon={User} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_full_name", "Full Name")} value={ownerFullName} />
            <Option1Row icon={User} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_first_name", "First Name")} value={ownerFirstName} />
            <Option1Row icon={User} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_last_name", "Last Name")} value={ownerLastName} />
            <Option1Row icon={User} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_father_s_name", "Father's Name")} value={ownerFatherName} />
            <Option1Row icon={CreditCard} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_cnic_id_no", "CNIC / ID No.")} value={ownerCnic} />
            <Option1Row icon={Globe} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_nationality", "Nationality")} value={ownerNationality} />
            <Option1Row icon={Phone} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_mobile_number", "Mobile Number")} value={ownerMobile} />
            <Option1Row icon={Phone} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_whatsapp_number", "WhatsApp Number")} value={ownerWhatsapp} />
            <Option1Row icon={Mail} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_email_address", "Email Address")} value={ownerEmail} />
            <Option1Row icon={Globe} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_country", "Country")} value={ownerCountry} />
            <Option1Row icon={MapPin} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_state_province", "State / Province")} value={ownerState} />
            <Option1Row icon={Building2} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_city", "City")} value={ownerCity} />
            <Option1Row icon={MapPin} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_final_address", "Final Address")} value={ownerAddress} />
          </div>

          {/* Right: COMPANY INFORMATION */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 pb-2 mb-1.5 border-b border-sky-200/70 dark:border-slate-800 text-[#0b5394] dark:text-sky-300">
              <Building2 className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-wider">
                {tt("trk.w_company_information", "COMPANY INFORMATION")}
              </span>
            </div>
            <Option1Row icon={Building2} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_company_name", "Company Name")} value={companyName} />
            <Option1Row icon={Briefcase} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_business_name", "Business Name")} value={companyBusinessName} />
            <Option1Row icon={CreditCard} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_registration_no", "Registration No.")} value={companyRegNo} />
            <Option1Row icon={Landmark} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_ntn_tax_no", "NTN / Tax No.")} value={companyNtn} />
            <Option1Row icon={Shield} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_license_no", "License No.")} value={companyLicenseNo} />
            <Option1Row icon={TruckIcon} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_business_type", "Business Type")} value={companyBusinessType} />
            <Option1Row icon={Globe} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_country", "Country")} value={companyCountry} />
            <Option1Row icon={MapPin} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_state_province", "State / Province")} value={companyState} />
            <Option1Row icon={Building2} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_city", "City")} value={companyCity} />
            <Option1Row icon={MapPin} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_final_address", "Final Address")} value={companyAddress} />
            <Option1Row icon={Phone} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_phone_number", "Phone Number")} value={companyPhoneNum} />
            <Option1Row icon={Phone} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_whatsapp_number", "WhatsApp Number")} value={companyWhatsappNum} />
            <Option1Row icon={Mail} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_email_address", "Email Address")} value={companyEmailAddr} />
            <Option1Row icon={Calendar} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_registration_date", "Registration Date")} value={formatReportDate(companyRegDate)} />
            <Option1Row icon={CheckCircle2} iconColor="text-[#0b5394] dark:text-sky-400" label={tt("trk.w_status", "Status")} badge={<Option1ActiveBadge status={statusLabel(form.status)} />} />
          </div>
        </div>
      </div>

      {/* 2. TRUCK DETAILS */}
      <div className="rounded-2xl border border-emerald-200 bg-[#f0faf5] shadow-sm overflow-hidden dark:border-emerald-900/60 dark:bg-slate-900/60">
        {/* Header Bar */}
        <div className="bg-[#00875a] px-3.5 py-2 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">
              <TruckIcon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider">
              {tt("trk.w_2_truck_details", "2. TRUCK DETAILS")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Truck Graphic Trailer */}
            <svg className="h-4 sm:h-5 w-12 text-white opacity-90" viewBox="0 0 48 20" fill="currentColor">
              <rect x="2" y="4" width="28" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M30 8 L38 8 L44 13 L44 16 L30 16 Z" fill="currentColor" opacity="0.8" />
              <circle cx="8" cy="16" r="2.5" fill="currentColor" />
              <circle cx="15" cy="16" r="2.5" fill="currentColor" />
              <circle cx="34" cy="16" r="2.5" fill="currentColor" />
              <circle cx="41" cy="16" r="2.5" fill="currentColor" />
            </svg>
            <button
              type="button"
              onClick={() => scrollToSection("vehicleCard")}
              className="text-[10px] font-bold text-emerald-200 hover:text-white underline"
            >
              {tt("trk.w_edit", "Edit")}
            </button>
          </div>
        </div>

        {/* Card Content - 2 Columns */}
        <div className="p-3 sm:p-4 trk-two-col gap-4">
          {/* Left: Identification & Specs */}
          <div className="space-y-0.5">
            <Option1Row icon={CreditCard} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_truck_registration_no", "Truck Registration No.")} value={form.truckNumber} />
            <Option1Row icon={TruckIcon} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_truck_type", "Truck Type")} value={choice(form.truckType, "truck_type")} />
            <Option1Row icon={Tag} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_truck_name_nickname", "Truck Name / Nickname")} value={nm(form.truckName)} />
            <Option1Row icon={Shield} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_make_brand", "Make / Brand")} value={form.make} />
            <Option1Row icon={Settings} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_model", "Model")} value={form.truckModel} />
            <Option1Row icon={Calendar} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_year", "Year")} value={form.manufacturingYear} />
            <Option1Row icon={Palette} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_color", "Color")} value={choice(form.color, "color")} />
          </div>

          {/* Right: Technical, Insurance & Compliance */}
          <div className="space-y-0.5">
            <Option1Row icon={Fuel} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_fuel_type", "Fuel Type")} value={choice(form.fuelType, "fuel_type")} />
            <Option1Row icon={Scale} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_capacity_tons", "Capacity (Tons)")} value={form.capacity ? `${form.capacity} ${tt("trk.w_tons", "Tons")}` : null} />
            <Option1Row icon={CreditCard} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_chassis_no", "Chassis No.")} value={form.chassisNumber} />
            <Option1Row icon={Landmark} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_engine_no", "Engine No.")} value={form.engineNumber} />
            <Option1Row icon={FileText} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_registration_no", "Registration No.")} value={form.registrationNumber} />
            <Option1Row icon={Calendar} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_registration_expiry", "Registration Expiry")} value={formatReportDate(form.registrationExpiryDate)} />
            <Option1Row icon={ShieldCheck} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_insurance_provider", "Insurance Provider")} value={form.insuranceProvider} />
            <Option1Row icon={Calendar} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_insurance_expiry", "Insurance Expiry")} value={formatReportDate(form.insuranceExpiryDate)} />
            <Option1Row icon={CheckCircle2} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_fitness_technical_expiry", "Fitness / Technical Expiry")} value={formatReportDate(form.fitnessCertificateExpiryDate)} />
            <Option1Row icon={CheckCircle2} iconColor="text-[#00875a] dark:text-emerald-400" label={tt("trk.w_status", "Status")} badge={<Option1ActiveBadge status={statusLabel(form.status)} />} />
          </div>
        </div>
      </div>

      {/* 3. DRIVER DETAILS */}
      <div className="rounded-2xl border border-amber-200 bg-[#fffbf2] shadow-sm overflow-hidden dark:border-amber-900/60 dark:bg-slate-900/60">
        {/* Header Bar */}
        <div className="bg-[#f26522] px-3.5 py-2 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">
              <UserCheck className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider">
              {tt("trk.w_3_driver_details", "3. DRIVER DETAILS")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => scrollToSection("driverCard")}
            className="text-[10px] font-bold text-amber-200 hover:text-white underline"
          >
            {tt("trk.w_edit", "Edit")}
          </button>
        </div>

        {/* Card Content - Photo on Left + 2 Sub-Columns */}
        <div className="trk-driver-row gap-4 p-3 sm:p-4">
          {/* Driver Photo Avatar Frame */}
          <div className="flex flex-col items-center shrink-0 mx-auto md:mx-0">
            <div className="relative h-28 w-24 sm:h-32 sm:w-28 overflow-hidden rounded-2xl border-2 border-amber-300/90 bg-gradient-to-b from-sky-100 to-sky-200 shadow-sm dark:border-amber-700/60 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
              {effectiveDriverPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={effectiveDriverPhoto} alt="Driver" className="h-full w-full object-cover" />
              ) : (
                <svg className="h-22 w-22 text-slate-700" viewBox="0 0 64 64" fill="none">
                  {/* Skin head */}
                  <circle cx="32" cy="24" r="11" fill="#fcd34d" />
                  {/* Driver Peaked Cap */}
                  <path d="M20 20 C22 13, 42 13, 44 20 Z" fill="#1e3a8a" />
                  <path d="M17 21 C22 17, 42 17, 47 21 C45 23, 19 23, 17 21 Z" fill="#1d4ed8" />
                  <circle cx="32" cy="17" r="1.5" fill="#f59e0b" />
                  {/* Eyes & Smile */}
                  <circle cx="28" cy="24" r="1.2" fill="#1e293b" />
                  <circle cx="36" cy="24" r="1.2" fill="#1e293b" />
                  <path d="M29 28 Q 32 30 35 28" stroke="#1e293b" strokeWidth="1" strokeLinecap="round" />
                  {/* Blue Uniform */}
                  <path d="M16 48 C16 38, 48 38, 48 48 L48 64 L16 64 Z" fill="#1e40af" />
                  {/* Shirt Collar */}
                  <path d="M28 39 L32 46 L36 39 Z" fill="#ffffff" />
                  <path d="M31 46 L33 46 L33 60 L31 60 Z" fill="#ffffff" />
                </svg>
              )}
            </div>
            <span className="mt-1 text-[9px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              {form.driverType === "permanent" ? tt("trk.w_permanent", "Permanent") : tt("trk.w_temporary", "Temporary")}
            </span>
          </div>

          {/* 2 Sub-Columns */}
          <div className="trk-two-col w-full min-w-0 flex-1 gap-4">
            {/* Sub-column 1: Personal Details */}
            <div className="space-y-0.5">
              <Option1Row icon={CreditCard} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_driver_registration_no", "Driver Registration No.")} value={driverRegNo} />
              <Option1Row icon={User} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_full_name", "Full Name")} value={driverFullName} />
              <Option1Row icon={User} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_first_name", "First Name")} value={driverFirstName} />
              <Option1Row icon={User} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_last_name", "Last Name")} value={driverLastName} />
              <Option1Row icon={User} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_father_s_name", "Father's Name")} value={driverFatherName} />
              <Option1Row icon={Calendar} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_date_of_birth", "Date of Birth")} value={formatReportDate(driverDob)} />
              <Option1Row icon={CreditCard} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_cnic_id_no", "CNIC / ID No.")} value={driverCnic} />
              <Option1Row icon={Globe} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_nationality", "Nationality")} value={driverNationality} />
            </div>

            {/* Sub-column 2: Contact & License Details */}
            <div className="space-y-0.5">
              <Option1Row icon={Phone} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_mobile_number", "Mobile Number")} value={driverMobile} />
              <Option1Row icon={Phone} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_whatsapp_number", "WhatsApp Number")} value={driverWhatsapp} />
              <Option1Row icon={Mail} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_email_address", "Email Address")} value={driverEmail} />
              <Option1Row icon={CreditCard} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_license_number", "License Number")} value={driverLicenseNumber} />
              <Option1Row icon={TruckIcon} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_license_type", "License Type")} value={driverLicenseType} />
              <Option1Row icon={Calendar} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_issue_date", "Issue Date")} value={formatReportDate(driverIssueDate)} />
              <Option1Row icon={Calendar} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_expiry_date", "Expiry Date")} value={formatReportDate(driverExpiryDate)} />
              <Option1Row icon={Landmark} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_issuing_authority", "Issuing Authority")} value={driverIssuingAuthority} />
              <Option1Row icon={Users} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_marital_status", "Marital Status")} value={driverMaritalStatus} />
              <Option1Row icon={CheckCircle2} iconColor="text-[#f26522] dark:text-amber-400" label={tt("trk.w_current_status", "Current Status")} badge={<Option1ActiveBadge status={statusLabel(form.status)} />} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. ATTACHED DOCUMENTS (If uploaded) */}
      {documents.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 dark:border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              {tt("trk.w_attached_session_documents", "Attached Session Documents")} ({documents.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                <span className="truncate font-medium text-slate-700 dark:text-slate-300 max-w-[200px]">{d.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-blue-600 hover:underline">
                    {tt("trk.w_view", "View")}
                  </a>
                  <a href={d.url} download={d.name} className="text-[11px] font-bold text-blue-600 hover:underline">
                    {tt("trk.w_download", "Download")}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="dgt-trk space-y-5" dir={dir}>
      {/* LIST VIEW */}
      {view === "list" && (
        <>
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <a href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400">
              {tt("nav.dashboard", "Dashboard")}
            </a>
            <span className="text-slate-300 dark:text-slate-700">›</span>
            <span>{tt("nav.shipping_clearing", "Shipping & Clearing")}</span>
            <span className="text-slate-300 dark:text-slate-700">›</span>
            <span className="font-black text-slate-700 dark:text-slate-200">{tt("trk.registered_truck_title", "Clearing Truck Registration")}</span>
          </nav>

          {/* List Header */}
          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                <TruckIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {tt("trk.registered_truck_title", "Clearing Truck Registration")}
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {tt("trk.module_subtitle", "Truck master, owner, transporter, driver and reporting.")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openNewRegistration}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" /> {tt("trk.new_chat_registration", "New Clearing Truck Registration")}
            </button>
          </div>

          {message && (
            <div
              className={`rounded-2xl border p-3 text-sm font-bold ${
                message.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* KPI Analytics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-300">
                <Users className="h-4 w-4" /> {tt("trk.section_branch_user", "1. Branch & User Details")}
              </div>
              <dl className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("common.country", "Country")}</dt>
                  <dd className="text-sm font-black text-slate-900 dark:text-white">{scopeCountryLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("common.branch_name", "Branch Name")}</dt>
                  <dd className="text-sm font-black text-slate-900 dark:text-white">{scopeBranchLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("common.user_name", "User Name")}</dt>
                  <dd className="text-sm font-black text-slate-900 dark:text-white">{userName || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("common.date_time", "Date & Time")}</dt>
                  <dd className="text-xs font-bold text-slate-700 dark:text-slate-200">{nowStr}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-300">
                <TruckIcon className="h-4 w-4" /> {tt("trk.section_truck_summary", "2. Truck Summary")}
              </div>
              <dl className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("trk.kpi_total_trucks", "Total Trucks")}</dt>
                  <dd className="text-sm font-black text-slate-900 dark:text-white">{totalTrucks}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("trk.kpi_active_trucks", "Active Trucks")}</dt>
                  <dd className="text-sm font-black text-emerald-600 dark:text-emerald-400">{activeTrucksCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("trk.kpi_registered_owners", "Registered Owners")}</dt>
                  <dd className="text-sm font-black text-slate-900 dark:text-white">{registeredOwnersCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("trk.kpi_assigned_drivers", "Assigned Drivers")}</dt>
                  <dd className="text-sm font-black text-slate-900 dark:text-white">{assignedDriversCount}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-300">
                <ClipboardList className="h-4 w-4" /> {tt("trk.section_registration_summary", "3. Registration Summary")}
              </div>
              <dl className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("common.total_records", "Total Records")}</dt>
                  <dd className="text-sm font-black text-slate-900 dark:text-white">{totalTrucks}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("common.active", "Active")}</dt>
                  <dd className="text-sm font-black text-emerald-600 dark:text-emerald-400">{activeTrucksCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("trk.badge_pending", "Pending")}</dt>
                  <dd className="text-sm font-black text-amber-600 dark:text-amber-400">{pendingCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("common.inactive", "Inactive")}</dt>
                  <dd className="text-sm font-black text-slate-500 dark:text-slate-400">{inactiveCount}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-300">
                <Globe className="h-4 w-4" /> {tt("trk.section_countries_report", "4. All Countries Report")}
              </div>
              <dl className="space-y-2">
                {countryBreakdown.length ? (
                  countryBreakdown.map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-2">
                      <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{c.name}</dt>
                      <dd className="text-sm font-black text-slate-900 dark:text-white">
                        {c.count} {tt("trk.trucks_count_suffix", "trucks")}
                      </dd>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tt("common.all_countries", "All Countries")}</dt>
                    <dd className="text-sm font-black text-slate-900 dark:text-white">0</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Filter Bar & Table */}
          <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tt("trk.search_trucks_ph", "Search trucks...")}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-xs font-medium outline-none focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:focus:bg-slate-900"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200"
                >
                  <option value="all">{tt("common.filter", "Filter")}: {tt("common.status", "Status")}</option>
                  <option value="active">{tt("common.active", "Active")}</option>
                  <option value="inactive">{tt("common.inactive", "Inactive")}</option>
                  <option value="suspended">{tt("trk.badge_pending", "Pending")}</option>
                  <option value="expired">{tt("trk.badge_completed", "Completed")}</option>
                </select>

                <div className="relative" ref={columnsRef}>
                  <button
                    type="button"
                    onClick={() => setColumnsOpen((c) => !c)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200"
                  >
                    <ColumnsIcon className="h-4 w-4" /> {tt("common.columns", "Columns")}
                  </button>
                  {columnsOpen && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                      <div className="mb-2 text-[11px] font-black uppercase text-slate-400">
                        {tt("common.columns", "Columns")}
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { key: "truckName" as OptionalColumnKey, label: tt("trk.col_truck_name", "Truck Name") },
                          { key: "model" as OptionalColumnKey, label: tt("trk.col_model", "Model") },
                          { key: "company" as OptionalColumnKey, label: tt("trk.col_company", "Company") },
                          { key: "transporter" as OptionalColumnKey, label: tt("trk.col_transporter", "Transporter") },
                          { key: "mobile" as OptionalColumnKey, label: tt("common.mobile", "Mobile") },
                          { key: "branch" as OptionalColumnKey, label: tt("trk.col_branch", "Branch") },
                        ].map((col) => (
                          <label key={col.key} className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                            <input
                              type="checkbox"
                              checked={visibleCols[col.key]}
                              onChange={(e) =>
                                setVisibleCols((prev) => ({ ...prev, [col.key]: e.target.checked }))
                              }
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <ReportActions
                  title={tt("trk.list_title", "Registered Trucks")}
                  lang={activeLang}
                  rows={filteredRows.map((r) => ({
                    owner: r.owner_display_name || "-",
                    truck_no: r.truck_number,
                    truck_name: r.truck_name || "-",
                    model: r.model || "-",
                    company: r.company_display_name || "-",
                    transporter: r.transporter_display_name || "-",
                    driver: r.driver_display_name || "-",
                    mobile: r.driver_mobile || "-",
                    status: r.status,
                    reg_date: (r.created_at || "").slice(0, 10),
                    branch: r.branch_display_name || "-",
                    serial: r.entry_serial || "-",
                  }))}
                  columns={[
                    { key: "truck_no", label: tt("trk.col_truck_no", "Truck No.") },
                    { key: "owner", label: tt("trk.col_owner", "Owner") },
                    { key: "driver", label: tt("trk.col_driver", "Driver") },
                    { key: "status", label: tt("common.status", "Status") },
                  ]}
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 font-black text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                    <Th className="p-3 text-start">{tt("trk.col_truck_no", "Truck No.")}</Th>
                    {visibleCols.truckName && <Th className="p-3 text-start">{tt("trk.col_truck_name", "Truck Name")}</Th>}
                    {visibleCols.model && <Th className="p-3 text-start">{tt("trk.col_model", "Model")}</Th>}
                    <Th className="p-3 text-start">{tt("trk.col_owner", "Owner")}</Th>
                    {visibleCols.company && <Th className="p-3 text-start">{tt("trk.col_company", "Company")}</Th>}
                    {visibleCols.transporter && <Th className="p-3 text-start">{tt("trk.col_transporter", "Transporter")}</Th>}
                    <Th className="p-3 text-start">{tt("trk.col_driver", "Driver")}</Th>
                    {visibleCols.mobile && <Th className="p-3 text-start">{tt("common.mobile", "Mobile")}</Th>}
                    <Th className="p-3 text-start">{tt("common.status", "Status")}</Th>
                    {visibleCols.branch && <Th className="p-3 text-start">{tt("trk.col_branch", "Branch")}</Th>}
                    <Th className="p-3 text-end">{tt("common.actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingList ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                        <span className="mt-2 block font-medium">{tt("trk.w_loading", "Loading...")}</span>
                      </td>
                    </tr>
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        {tt("trk.no_trucks_found", "No registered trucks found.")}
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-black text-slate-900 dark:text-white">
                          {row.truck_number}
                        </td>
                        {visibleCols.truckName && (
                          <td className="p-3 font-medium text-slate-600 dark:text-slate-300">{row.truck_name || "—"}</td>
                        )}
                        {visibleCols.model && (
                          <td className="p-3 font-medium text-slate-600 dark:text-slate-300">{row.model || "—"}</td>
                        )}
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          {row.owner_display_name || "—"}
                        </td>
                        {visibleCols.company && (
                          <td className="p-3 font-medium text-slate-600 dark:text-slate-300">{row.company_display_name || "—"}</td>
                        )}
                        {visibleCols.transporter && (
                          <td className="p-3 font-medium text-slate-600 dark:text-slate-300">{row.transporter_display_name || "—"}</td>
                        )}
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          {row.driver_display_name || "—"}
                        </td>
                        {visibleCols.mobile && (
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{row.driver_mobile || "—"}</td>
                        )}
                        <td className="p-3">
                          <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${statusBadgeClasses(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        {visibleCols.branch && (
                          <td className="p-3 text-slate-500">{row.branch_display_name || "—"}</td>
                        )}
                        <td className="p-3 text-end">
                          <UnifiedActionMenu
                            onView={() => runRowReport(row, "view")}
                            onEdit={() => startEdit(row)}
                            onDelete={() => handleDelete(row.id)}
                            onPrint={() => runRowReport(row, "print")}
                            onExportPdf={() => runRowReport(row, "pdf")}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
              <div className="text-xs text-slate-500">
                {tt("trk.showing_records", "Showing {from} to {to} of {total} records")
                  .replace("{from}", String(filteredRows.length === 0 ? 0 : pageStart + 1))
                  .replace("{to}", String(Math.min(pageStart + pageSize, filteredRows.length)))
                  .replace("{total}", String(filteredRows.length))}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} {tt("trk.per_page_suffix", "/ page")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={clampedPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {clampedPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={clampedPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* FORM & LIVE REPORT VIEW */}
      {view === "form" && (
        <>
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <a href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400">
              {tt("nav.dashboard", "Dashboard")}
            </a>
            <span className="text-slate-300 dark:text-slate-700">›</span>
            <span>{tt("nav.shipping_clearing", "Shipping & Clearing")}</span>
            <span className="text-slate-300 dark:text-slate-700">›</span>
            <button type="button" onClick={backToList} className="hover:text-blue-600 dark:hover:text-blue-400">
              {tt("trk.registered_truck_title", "Clearing Truck Registration")}
            </button>
            <span className="text-slate-300 dark:text-slate-700">›</span>
            <span className="font-black text-slate-700 dark:text-slate-200">
              {editingId ? tt("trk.form_title_edit", "Edit Clearing Truck Registration") : tt("trk.new_truck_registration", "New Clearing Truck Registration")}
            </span>
          </nav>

          {/* Form Header with "View ⌄" dropdown and "← Back to List" */}
          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                <TruckIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {editingId
                    ? tt("trk.form_title_edit", "Edit Clearing Truck Registration")
                    : tt("trk.registered_truck_title", "Clearing Truck Registration")}
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {tt("trk.module_subtitle", "Truck master, owner, transporter, driver and reporting.")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={backToList}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs transition"
              >
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {tt("trk.back_to_list", "Back to List")}
              </button>
            </div>
          </div>

          {/* STEP-BY-STEP INTERACTIVE WIZARD PROGRESS BAR (large, clear, language-aware) */}
          <nav aria-label={tt("trk.w_steps_nav", "Registration steps")} className="dgt-trk-stepper rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-blue-600 font-mono text-[20px] font-black text-white shadow-xs">
                  {activeStep}
                </span>
                <span className="text-[16px] font-black uppercase tracking-wide text-slate-800 dark:text-slate-100 sm:text-[19px]">
                  {stepOf(activeStep)}: {
                    activeStep === 1 ? cleanTitle(tt("trk.section_owner", "Owner Details"), "Owner Details") :
                    activeStep === 2 ? cleanTitle(tt("trk.section_truck_details", "Truck Details"), "Truck Details") :
                    activeStep === 3 ? cleanTitle(tt("trk.section_transporter", "Transporter Details"), "Transporter Details") :
                    activeStep === 4 ? cleanTitle(tt("trk.section_driver", "Driver Details"), "Driver Details") :
                    cleanTitle(tt("trk.truck_docs", "Truck Documents"), "Truck Documents")
                  }
                </span>
              </div>
              <span className="text-[16px] font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                {Math.round((activeStep / 5) * 100)}% <span dir={dir}>{tt("trk.w_complete", "Complete")}</span>
              </span>
            </div>

            <div className="mb-4 h-[10px] w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((activeStep / 5) * 100)}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${(activeStep / 5) * 100}%`, marginInlineStart: 0 }}
              />
            </div>

            <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { step: 1, title: cleanTitle(tt("trk.section_owner", "Owner Details"), "Owner Details"), sub: tt("trk.w_step_sub_owner", "Owner info"), icon: User },
                { step: 2, title: cleanTitle(tt("trk.section_truck_details", "Truck Details"), "Truck Details"), sub: tt("trk.w_step_sub_truck", "Specs & vehicle"), icon: TruckIcon },
                { step: 3, title: cleanTitle(tt("trk.section_transporter", "Transporter Details"), "Transporter Details"), sub: tt("trk.w_step_sub_transporter", "Company link"), icon: Building2 },
                { step: 4, title: cleanTitle(tt("trk.section_driver", "Driver Details"), "Driver Details"), sub: tt("trk.w_step_sub_driver", "Driver & photo"), icon: UserCheck },
                { step: 5, title: cleanTitle(tt("trk.truck_docs", "Truck Documents"), "Truck Documents"), sub: tt("trk.w_step_sub_docs", "Upload & register"), icon: FileText },
              ].map((st) => {
                const isCurrent = activeStep === st.step;
                const isCompleted = activeStep > st.step;
                return (
                  <li key={st.step}>
                    <button
                      type="button"
                      aria-current={isCurrent ? "step" : undefined}
                      onClick={() => {
                        if (st.step > activeStep && activeStep === 2 && !form.truckNumber.trim()) {
                          stepAlert(tt("trk.w_alert_truck_first", "Please enter Truck Number first."));
                          return;
                        }
                        setActiveStep(st.step);
                      }}
                      className={`flex min-h-[64px] w-full items-center gap-3 rounded-xl border p-3 text-start transition ${
                        isCurrent
                          ? "border-blue-500 bg-blue-50/80 text-blue-700 shadow-2xs dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          : isCompleted
                          ? "border-emerald-200 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-slate-200/70 bg-slate-50/40 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400"
                      }`}
                    >
                      <span
                        className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg text-[16px] font-black transition ${
                          isCurrent
                            ? "bg-blue-600 text-white shadow-2xs"
                            : isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : st.step}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold leading-tight">{st.title}</span>
                        <span className="block text-[13px] leading-tight text-slate-500 dark:text-slate-400">{st.sub}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {message && (
            <div
              className={`rounded-2xl border p-3 text-sm font-bold ${
                message.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* MAIN 2-COLUMN LAYOUT: Compact Form (Left) & Sticky Live Truck Report (Right) */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 xl:gap-7">
            {/* LEFT FORM COLUMN (Col 5) */}
            <form onSubmit={handleSubmit} className="space-y-4 lg:col-span-5">
              {/* CARD 1: Owner / Customer Selection (Optional) */}
              {/* CARD 1: Owner / Customer Selection (Optional) */}
              <section
                id="ownerCard"
                className={`rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20 ${
                  activeStep === 1 ? "block" : "hidden"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      1
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{cleanTitle(tt("trk.section_owner", "Truck Owner Information"), "Truck Owner Information")}</span>
                        <span className="text-xs font-normal text-slate-400">{tt("trk.w_optional", "(Optional)")}</span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tt("trk.w_select_an_existing_owner_customer_acco", "Select an existing owner/customer account. Registered details appear below.")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                    {stepOf(1)}
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div>
                      <PersonPicker
                        label={tt("trk.truck_owner_name_label", "Truck Owner Name *")}
                        value={form.ownerId}
                        onValueChange={(id) => setForm((p) => ({ ...p, ownerId: id, hasOwner: id ? "yes" : "no" }))}
                        placeholder={tt("trk.search_owner_ph", "Search truck owner...")}
                        lang={activeLang}
                        createLabel={tt("trk.new_truck_owner", "+ New Truck Owner")}
                      />
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5 text-[11px] text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300 flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                      <span>
                        {tt("trk.w_if_there_is_no_owner_leave_blank_witho", "If there is no owner, leave blank (Without Owner) and continue with truck registration.")}
                      </span>
                    </div>
                  </div>

                  {form.ownerId && ownerDetails && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                      <div className="flex items-center justify-between border-b border-blue-100/80 pb-2 dark:border-blue-900/40">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">
                              {nm(ownerDetails.customer_name)}
                            </div>
                            <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase">
                              {tt("trk.w_registered_owner", "REGISTERED OWNER")}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setParty360({ customerId: form.ownerId, name: nm(ownerDetails.customer_name) === "—" ? "" : nm(ownerDetails.customer_name) })}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-2xs hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                        >
                          <Eye className="h-3 w-3" /> {tt("trk.view_owner_details", "View Owner Details")}
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_id_code_colon", "ID / Code:")}</span> <b className="text-slate-800 dark:text-slate-100">{ownerDetails.person_code || ownerDetails.code || "—"}</b></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_mobile_colon", "Mobile:")}</span> <b className="text-slate-800 dark:text-slate-100">{ownerDetails.mobile || "—"}</b></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_whatsapp_colon", "WhatsApp:")}</span> <b className="text-slate-800 dark:text-slate-100">{ownerDetails.whatsapp || "—"}</b></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_address_colon", "Address:")}</span> <b className="text-slate-800 dark:text-slate-100 truncate">{nm(ownerDetails.address)}</b></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 1 Actions */}
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={backToList}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-[15px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs transition"
                  >
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                    <span>{tt("common.back", "Back to List")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-[15px] font-black text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
                  >
                    <span>{tt("trk.w_next_truck_details", "Next: Truck Details")}</span>
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </div>
              </section>

              {/* CARD 2: Truck Registration Details (Combined Details & Physical Specs) */}
              <section
                id="vehicleCard"
                className={`rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20 ${
                  activeStep === 2 ? "block" : "hidden"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      2
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white">
                        {cleanTitle(tt("trk.section_truck_details", "Truck Details"), "Truck Details")}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tt("trk.w_enter_truck_identification_and_physica", "Enter truck identification and physical specifications.")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                    {stepOf(2)}
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                    {/* Row 1: Identification & Core Vehicle Specs */}
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.truck_no", "Truck Number *")}
                        </span>
                        <input
                          required
                          value={form.truckNumber}
                          onChange={(e) => setForm((p) => ({ ...p, truckNumber: e.target.value }))}
                          placeholder={tt("trk.w_enter_truck_number", "Enter truck number")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.truck_type", "Truck Type *")}
                        </span>
                        <select
                          value={form.truckType}
                          onChange={(e) => setForm((p) => ({ ...p, truckType: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <option value="">{tt("trk.w_select", "— Select —")}</option>
                          <option value="Trailer Truck">{tt("trk.w_trailer_truck", "Trailer Truck")}</option>
                          <option value="Container Truck">{tt("trk.w_container_truck", "Container Truck")}</option>
                          <option value="Flatbed Truck">{tt("trk.w_flatbed_truck", "Flatbed Truck")}</option>
                          <option value="Box Truck">{tt("trk.w_box_truck", "Box Truck")}</option>
                          {truckTypeOptions.map((o) => (
                            <option key={o.id} value={o.code}>
                              {optionLabel(o)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.truck_name_label", "Truck Name / Nickname")}
                        </span>
                        <input
                          value={form.truckName}
                          onChange={(e) => setForm((p) => ({ ...p, truckName: e.target.value }))}
                          placeholder={tt("trk.w_enter_truck_name_or_nickname", "Enter truck name or nickname")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                    </div>

                    {/* Row 2: Make, Model, Year, Color */}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.w_make_brand", "Make / Brand")}
                        </span>
                        <input
                          value={form.make}
                          onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
                          placeholder={tt("trk.w_enter_make_brand", "Enter make / brand")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.w_model", "Model")}
                        </span>
                        <input
                          value={form.truckModel}
                          onChange={(e) => setForm((p) => ({ ...p, truckModel: e.target.value }))}
                          placeholder={tt("trk.w_enter_model", "Enter model")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.year", "Year *")}
                        </span>
                        <input
                          type="number"
                          min={1900}
                          max={2100}
                          value={form.manufacturingYear}
                          onChange={(e) => setForm((p) => ({ ...p, manufacturingYear: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.color", "Color")}</span>
                        <select
                          value={form.color}
                          onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <option value="">{tt("trk.w_select", "— Select —")}</option>
                          <option value="White">{tt("trk.w_white", "White")}</option>
                          <option value="Blue">{tt("trk.w_blue", "Blue")}</option>
                          <option value="Black">{tt("trk.w_black", "Black")}</option>
                          <option value="Red">{tt("trk.w_red", "Red")}</option>
                          <option value="Silver">{tt("trk.w_silver", "Silver")}</option>
                          {colorOptions.map((o) => (
                            <option key={o.id} value={o.code}>
                              {optionLabel(o)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {/* Row 3: Physical & Engineering Specs */}
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.chassis_no", "Chassis No *")}
                        </span>
                        <input
                          required
                          value={form.chassisNumber}
                          onChange={(e) => setForm((p) => ({ ...p, chassisNumber: e.target.value }))}
                          placeholder={tt("trk.ph_chassis_no", "Enter chassis number")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.engine_no", "Engine No")} <span className="text-rose-500">*</span>
                        </span>
                        <input
                          required
                          value={form.engineNumber}
                          onChange={(e) => setForm((p) => ({ ...p, engineNumber: e.target.value }))}
                          placeholder={tt("trk.ph_engine_no", "Enter engine number")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.reg_no", "Registration No")}
                        </span>
                        <input
                          value={form.registrationNumber}
                          onChange={(e) => setForm((p) => ({ ...p, registrationNumber: e.target.value }))}
                          placeholder={tt("trk.w_enter_registration_number", "Enter registration number")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.capacity", "Capacity (Tons) *")}</span>
                        <input
                          type="number"
                          step="0.01"
                          value={form.capacity}
                          onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                    </div>

                    {/* Row 4: Compliance & Technical Expiries */}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 pt-1">
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.fuel_type", "Fuel Type")}</span>
                        <select
                          value={form.fuelType}
                          onChange={(e) => setForm((p) => ({ ...p, fuelType: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <option value="">{tt("trk.w_select", "— Select —")}</option>
                          <option value="Diesel">{tt("trk.w_diesel", "Diesel")}</option>
                          <option value="Petrol">{tt("trk.w_petrol", "Petrol")}</option>
                          <option value="Electric">{tt("trk.w_electric", "Electric")}</option>
                          <option value="Hybrid">{tt("trk.w_hybrid", "Hybrid")}</option>
                          {fuelTypeOptions.map((o) => (
                            <option key={o.id} value={o.code}>
                              {optionLabel(o)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("tr.reg_expiry", "Reg. Expiry")}</span>
                        <input
                          type="date"
                          value={form.registrationExpiryDate}
                          onChange={(e) => setForm((p) => ({ ...p, registrationExpiryDate: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_insurance_provider", "Insurance Provider")}</span>
                        <input
                          value={form.insuranceProvider}
                          onChange={(e) => setForm((p) => ({ ...p, insuranceProvider: e.target.value }))}
                          placeholder={tt("trk.w_enter_insurance_provider", "Enter insurance provider")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("tr.ins_expiry", "Insurance Expiry")}</span>
                        <input
                          type="date"
                          value={form.insuranceExpiryDate}
                          onChange={(e) => setForm((p) => ({ ...p, insuranceExpiryDate: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_fitness_expiry", "Fitness Expiry")}</span>
                        <input
                          type="date"
                          value={form.fitnessCertificateExpiryDate}
                          onChange={(e) => setForm((p) => ({ ...p, fitnessCertificateExpiryDate: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                    </div>
                  </div>

                {/* Step 2 Actions */}
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-[15px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs transition"
                  >
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                    <span>{tt("trk.w_back_owner_details", "Back: Owner Details")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!form.truckNumber.trim()) {
                        stepAlert(tt("trk.w_alert_truck_continue", "Please enter Truck Number to continue."));
                        return;
                      }
                      setActiveStep(3);
                    }}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-[15px] font-black text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
                  >
                    <span>{tt("trk.w_next_transporter_details", "Next: Transporter Details")}</span>
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </div>
              </section>

              {/* CARD 3: Transporter / Shipping Line Information */}
              <section
                id="transporterCard"
                className={`rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20 ${
                  activeStep === 3 ? "block" : "hidden"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      3
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white">
                        {cleanTitle(tt("trk.section_transporter", "Transporter Information"), "Transporter Information")}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tt("trk.w_select_a_transporter_person_contractor", "Select a transporter person/contractor and/or link a transport company.")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                    {stepOf(3)}
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                    {/* Transporter Person Picker */}
                    <div>
                      <PersonPicker
                        label={tt("trk.transporter_name_label", "Transporter Name") + " (Optional)"}
                        value={form.transporterId}
                        onValueChange={(id) => setForm((p) => ({ ...p, transporterId: id }))}
                        placeholder={tt("trk.search_transporter_ph", "Search transporter person...")}
                        lang={activeLang}
                        createLabel="+ New Transporter"
                      />
                    </div>

                    {form.transporterId && transporterDetails && (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div className="flex items-center justify-between border-b border-blue-100/80 pb-2 dark:border-blue-900/40">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">
                              <User className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 dark:text-white">
                                {nm(transporterDetails.customer_name)}
                              </div>
                              <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase">
                                {tt("trk.w_registered_transporter", "REGISTERED TRANSPORTER")}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_transporter_code_colon", "Transporter Code:")}</span> <b className="text-slate-800 dark:text-slate-100">{transporterDetails.person_code || transporterDetails.code || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_mobile_colon", "Mobile:")}</span> <b className="text-slate-800 dark:text-slate-100">{transporterDetails.mobile || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_whatsapp_colon", "WhatsApp:")}</span> <b className="text-slate-800 dark:text-slate-100">{transporterDetails.whatsapp || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_address_colon", "Address:")}</span> <b className="text-slate-800 dark:text-slate-100 truncate">{nm(transporterDetails.address)}</b></div>
                        </div>
                      </div>
                    )}

                    {/* Link Company Radio */}
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 pt-1">
                      <span>{tt("trk.w_link_a_company_q", "Link a company?")}</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="companyLink"
                          value="yes"
                          checked={form.companyLink === "yes"}
                          onChange={() => setForm((p) => ({ ...p, companyLink: "yes" }))}
                          className="text-blue-600"
                        />
                        <span>{tt("trk.w_yes", "Yes")}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="companyLink"
                          value="no"
                          checked={form.companyLink === "no"}
                          onChange={() => setForm((p) => ({ ...p, companyLink: "no", companyId: "" }))}
                          className="text-blue-600"
                        />
                        <span>No</span>
                      </label>
                    </div>

                    {form.companyLink === "yes" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_company_type", "Company Type")}</span>
                            <select
                              value={form.companyType}
                              onChange={(e) => setForm((p) => ({ ...p, companyType: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <option value="transporter">{tt("trk.w_transporter_company", "Transporter Company")}</option>
                              <option value="shippingLine">{tt("trk.w_shipping_line_company", "Shipping Line Company")}</option>
                            </select>
                          </label>

                          <div>
                            <CompanyPicker
                              label={form.companyType === "shippingLine" ? "Shipping Line Company *" : "Transporter Company *"}
                              value={form.companyId}
                              onValueChange={(id) => setForm((p) => ({ ...p, companyId: id }))}
                              placeholder={tt("trk.search_company_ph", "Search company...")}
                            />
                          </div>
                        </div>

                        {form.companyId && companyDetails && (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                            <div className="flex items-center justify-between border-b border-blue-100/80 pb-2 dark:border-blue-900/40">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">
                                  <Building2 className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-black text-slate-900 dark:text-white">
                                    {nm(companyDetails.name)}
                                  </div>
                                  <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase">
                                    {tt("trk.w_registered_company", "REGISTERED COMPANY")}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_company_code_colon", "Company Code:")}</span> <b className="text-slate-800 dark:text-slate-100">{companyDetails.company_code || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_legal_name_colon", "Legal Name:")}</span> <b className="text-slate-800 dark:text-slate-100">{nm(companyDetails.legal_name || companyDetails.trade_name)}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_registration_trn_colon", "Registration / TRN:")}</span> <b className="text-slate-800 dark:text-slate-100">{companyRegNumber(companyDetails) || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_owner_name_colon", "Owner Name:")}</span> <b className="text-slate-800 dark:text-slate-100">{nm(companyDetails.owner_name)}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_phone_mobile_colon", "Phone / Mobile:")}</span> <b className="text-slate-800 dark:text-slate-100">{companyPhone(companyDetails) || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_email_colon", "Email:")}</span> <b className="text-slate-800 dark:text-slate-100">{companyEmail(companyDetails) || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">{tt("trk.w_city_country_colon", "City / Country:")}</span> <b className="text-slate-800 dark:text-slate-100">{[companyDetails.city_name, companyDetails.country_name].filter(Boolean).join(", ") || "—"}</b></div>
                              <div className="flex justify-between py-0.5 sm:col-span-2"><span className="text-slate-500">{tt("trk.w_address_colon", "Address:")}</span> <b className="text-slate-800 dark:text-slate-100 truncate">{nm(companyDetails.address)}</b></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                {/* Step 3 Actions */}
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-[15px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs transition"
                  >
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                    <span>{tt("trk.w_back_truck_details", "Back: Truck Details")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep(4)}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-[15px] font-black text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
                  >
                    <span>{tt("trk.w_next_driver_details", "Next: Driver Details")}</span>
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </div>
              </section>

              {/* CARD 4: Driver Information (Optional) with Photo, Multi-Contacts, and Location */}
              <section
                id="driverCard"
                className={`rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20 ${
                  activeStep === 4 ? "block" : "hidden"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      4
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{cleanTitle(tt("trk.section_driver", "Driver Information"), "Driver Information")}</span>
                        <span className="text-xs font-normal text-slate-400">{tt("trk.w_optional", "(Optional)")}</span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tt("trk.w_select_a_permanent_driver_or_enter_tem", "Select a permanent driver or enter temporary driver details.")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="driverType"
                          value="permanent"
                          checked={form.driverType === "permanent"}
                          onChange={() => setForm((p) => ({ ...p, driverType: "permanent" }))}
                          className="text-blue-600"
                        />
                        <span>{tt("trk.w_permanent", "Permanent")}</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="driverType"
                          value="temporary"
                          checked={form.driverType === "temporary"}
                          onChange={() => setForm((p) => ({ ...p, driverType: "temporary" }))}
                          className="text-blue-600"
                        />
                        <span>{tt("trk.w_temporary", "Temporary")}</span>
                      </label>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                      {stepOf(4)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                    {/* Mobile Driver Type Radio */}
                    <div className="flex sm:hidden items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="driverTypeMobile"
                          value="permanent"
                          checked={form.driverType === "permanent"}
                          onChange={() => setForm((p) => ({ ...p, driverType: "permanent" }))}
                          className="text-blue-600"
                        />
                        <span>{tt("trk.w_permanent_driver", "Permanent Driver")}</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="driverTypeMobile"
                          value="temporary"
                          checked={form.driverType === "temporary"}
                          onChange={() => setForm((p) => ({ ...p, driverType: "temporary" }))}
                          className="text-blue-600"
                        />
                        <span>{tt("trk.w_temporary_driver", "Temporary Driver")}</span>
                      </label>
                    </div>

                    {form.driverType === "permanent" ? (
                      /* PERMANENT DRIVER FLOW: Clean dropdown + Status + Registered Driver details card */
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px] gap-3">
                          <div>
                            <PersonPicker
                              label={tt("trk.driver_name_label", "Driver Name *")}
                              value={form.driverId}
                              onValueChange={(id) => setForm((p) => ({ ...p, driverId: id }))}
                              placeholder={tt("trk.search_driver_ph", "Search driver...")}
                              lang={activeLang}
                              createLabel={tt("trk.new_driver", "+ New Driver")}
                            />
                          </div>

                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("common.status", "Status")}</span>
                            <select
                              value={form.status}
                              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <option value="active">{tt("common.active", "Active")}</option>
                              <option value="inactive">{tt("common.inactive", "Inactive")}</option>
                              <option value="suspended">{tt("trk.badge_pending", "Pending")}</option>
                              <option value="expired">{tt("trk.badge_completed", "Completed")}</option>
                            </select>
                          </label>
                        </div>

                        {/* Rich Registered Driver Preview Card */}
                        {form.driverId && driverDetails && (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                            <div className="flex items-center justify-between border-b border-blue-100/80 pb-2.5 dark:border-blue-900/40">
                              <div className="flex items-center gap-3">
                                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-2xs dark:border-blue-800 dark:bg-slate-800 flex items-center justify-center">
                                  {driverDetails.photo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={driverDetails.photo_url} alt="Driver" className="h-full w-full object-cover" />
                                  ) : (
                                    <User className="h-6 w-6 text-blue-500" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>{nm(driverDetails.customer_name)}</span>
                                    {driverDetails.person_code && (
                                      <span className="font-mono text-[10px] text-blue-700 dark:text-blue-300">
                                        ({driverDetails.person_code})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">
                                      {tt("trk.w_registered_driver", "REGISTERED DRIVER")}
                                    </span>
                                    <span className={`inline-block rounded-md px-1.5 py-0.2 text-[9px] font-bold ${statusBadgeClasses(form.status)}`}>
                                      {statusLabel(form.status)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">{tt("trk.w_license_number_colon", "License Number:")}</span>
                                <b className="text-slate-800 dark:text-slate-100 font-mono">
                                  {driverDetails.license_no || form.driverLicenseNo || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">{tt("trk.w_license_expiry_colon", "License Expiry:")}</span>
                                <b className="text-slate-800 dark:text-slate-100">
                                  {driverDetails.license_expiry || form.driverLicenseExpiry || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">{tt("trk.w_mobile_colon", "Mobile:")}</span>
                                <b className="text-slate-800 dark:text-slate-100 font-mono">
                                  {driverDetails.mobile || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">{tt("trk.w_whatsapp_colon", "WhatsApp:")}</span>
                                <b className="text-slate-800 dark:text-slate-100 font-mono">
                                  {driverDetails.whatsapp || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">{tt("trk.w_email_colon", "Email:")}</span>
                                <b className="text-slate-800 dark:text-slate-100 truncate">
                                  {driverDetails.email || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">{tt("trk.w_city_country_colon", "City / Country:")}</span>
                                <b className="text-slate-800 dark:text-slate-100">
                                  {[driverDetails.city_name || driverDetails.city, driverDetails.country_name || driverDetails.country].filter(Boolean).join(", ") || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5 sm:col-span-2">
                                <span className="text-slate-500">{tt("trk.w_address_colon", "Address:")}</span>
                                <b className="text-slate-800 dark:text-slate-100 truncate">
                                  {nm(driverDetails.address)}
                                </b>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* TEMPORARY DRIVER FLOW: Manual photo upload + Multi contacts + Manual name & license + Location */
                      <div className="space-y-4">
                        {/* Driver Photograph Upload Control */}
                        <div className="flex items-center gap-3.5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/60 to-white p-3 dark:border-blue-950/60 dark:from-blue-950/20 dark:to-slate-900">
                          <div className="relative h-18 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-700 dark:bg-slate-800 flex items-center justify-center">
                            {driverPhotoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={driverPhotoUrl} alt="Driver preview" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-8 w-8 text-blue-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <strong className="block text-xs font-black text-slate-800 dark:text-slate-200">
                              {tt("trk.w_driver_photograph", "Driver photograph")}
                            </strong>
                            <p className="mt-0.5 text-[10.5px] text-slate-500">
                              {tt("trk.w_add_driver_photo_first_then_complete_d", "Add driver photo first, then complete driver details.")}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300">
                                <Plus className="h-3 w-3" /> Add Driver Photo
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png"
                                  onChange={handleDriverPhotoUpload}
                                  className="sr-only"
                                />
                              </label>
                              <span className="text-[10px] text-slate-400">
                                {driverPhotoName || "📎 Photograph attachment · JPG/PNG ≤ 5 MB"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Driver Contacts: Up to 10 Repeatable Rows */}
                        <details className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/20 open:bg-white dark:open:bg-slate-900 transition">
                          <summary className="cursor-pointer text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between select-none">
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              <span>+ Contacts · WhatsApp / Mobile / Email</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {contacts.length} / 10 contacts
                            </span>
                          </summary>

                          <div className="mt-3 space-y-2">
                            {contacts.map((contact, index) => {
                              const isEmail = contact.type === "Email";
                              return (
                                <div key={contact.id} className="grid grid-cols-[100px_1fr_32px] gap-2 items-center">
                                  <select
                                    value={contact.type}
                                    onChange={(e) => handleContactTypeChange(index, e.target.value as ContactType)}
                                    className="h-8.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                  >
                                    <option value="WhatsApp">{tt("crm.ftype_whatsapp", "WhatsApp")}</option>
                                    <option value="Mobile">{tt("purchase.f_mobile_number", "Mobile")}</option>
                                    <option value="Phone">{tt("tax_einv.set_f_phone", "Phone")}</option>
                                    <option value="Email">{tt("tax_einv.set_f_email", "Email")}</option>
                                  </select>
                                  <input
                                    type={isEmail ? "email" : "tel"}
                                    value={contact.value}
                                    onChange={(e) => handleContactValueChange(index, e.target.value)}
                                    placeholder={isEmail ? tt("tax_einv.set_f_email", "Email address") : tt("purchase.f_mobile_number", "Number with country code")}
                                    className="h-8.5 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveContact(index)}
                                    className="flex h-8.5 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:hover:bg-rose-950/40"
                                    title={tt("common.remove", "Remove contact")}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10.5px] text-slate-400">
                                {contacts.length >= 10 ? "Maximum 10 contacts reached" : "Repeated types allowed"}
                              </span>
                              <button
                                type="button"
                                disabled={contacts.length >= 10}
                                onClick={handleAddContact}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                              >
                                <Plus className="h-3 w-3" /> Add Contact
                              </button>
                            </div>
                          </div>
                        </details>

                        {/* Temporary Driver Name & Identification Fields */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
                          <label className="space-y-1 text-xs block sm:col-span-2">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {tt("trk.w_temporary_driver_name", "Temporary Driver Name *")}
                            </span>
                            <input
                              value={form.temporaryDriverName}
                              onChange={(e) => setForm((p) => ({ ...p, temporaryDriverName: e.target.value }))}
                              placeholder={tt("trk.ph_driver_name", "Enter temporary driver name...")}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>

                          <label className="space-y-1 text-xs block">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {tt("trk.w_father_s_name", "Father's Name")}
                            </span>
                            <input
                              value={form.driverFatherName}
                              onChange={(e) => setForm((p) => ({ ...p, driverFatherName: e.target.value }))}
                              placeholder={tt("trk.w_enter_father_s_name", "Enter father's name")}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>

                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_cnic_id_no", "CNIC / ID No.")}</span>
                            <input
                              value={form.driverCnic}
                              onChange={(e) => setForm((p) => ({ ...p, driverCnic: e.target.value }))}
                              placeholder="e.g. 54321-7654321-9"
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>
                        </div>

                        {/* Temporary Driver Personal & License Specs */}
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_date_of_birth", "Date of Birth")}</span>
                            <input
                              type="date"
                              value={form.driverDob}
                              onChange={(e) => setForm((p) => ({ ...p, driverDob: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>

                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_nationality", "Nationality")}</span>
                            <input
                              value={form.driverNationality}
                              onChange={(e) => setForm((p) => ({ ...p, driverNationality: e.target.value }))}
                              placeholder={tt("trk.w_enter_nationality", "Enter nationality")}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>

                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_marital_status", "Marital Status")}</span>
                            <select
                              value={form.driverMaritalStatus}
                              onChange={(e) => setForm((p) => ({ ...p, driverMaritalStatus: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <option value="">{tt("trk.w_select", "— Select —")}</option>
                          <option value="Married">{tt("trk.w_married", "Married")}</option>
                              <option value="Single">{tt("trk.w_single", "Single")}</option>
                            </select>
                          </label>

                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("common.status", "Status")}</span>
                            <select
                              value={form.status}
                              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <option value="active">{tt("common.active", "Active")}</option>
                              <option value="inactive">{tt("common.inactive", "Inactive")}</option>
                              <option value="suspended">{tt("trk.badge_pending", "Pending")}</option>
                              <option value="expired">{tt("trk.badge_completed", "Completed")}</option>
                            </select>
                          </label>
                        </div>

                        {/* License Details */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.license_no", "Driving License Number")}</span>
                            <input
                              value={form.driverLicenseNo}
                              onChange={(e) => setForm((p) => ({ ...p, driverLicenseNo: e.target.value }))}
                              placeholder={tt("trk.license_no", "Licence number")}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>

                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_license_type", "License Type")}</span>
                            <input
                              value={form.driverLicenseType}
                              onChange={(e) => setForm((p) => ({ ...p, driverLicenseType: e.target.value }))}
                              placeholder={tt("trk.w_enter_license_type", "Enter license type")}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>

                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_issue_date", "Issue Date")}</span>
                            <input
                              type="date"
                              value={form.driverLicenseIssueDate}
                              onChange={(e) => setForm((p) => ({ ...p, driverLicenseIssueDate: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>

                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.licence_expiry_label", "Licence Expiry Date")}</span>
                            <input
                              type="date"
                              value={form.driverLicenseExpiry}
                              onChange={(e) => setForm((p) => ({ ...p, driverLicenseExpiry: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <label className="space-y-1 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.w_issuing_authority", "Issuing Authority")}</span>
                            <input
                              value={form.driverIssuingAuthority}
                              onChange={(e) => setForm((p) => ({ ...p, driverIssuingAuthority: e.target.value }))}
                              placeholder={tt("trk.w_enter_issuing_authority", "Enter issuing authority")}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>
                        </div>

                        {/* Location Management for Driver */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                            <span>{tt("nav.location_form", "Location Management for Driver")}</span>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="addDriverLocation"
                                value="yes"
                                checked={form.addDriverLocation === "yes"}
                                onChange={() => setForm((p) => ({ ...p, addDriverLocation: "yes" }))}
                                className="text-blue-600"
                              />
                              <span>{tt("trk.w_yes_add_location", "Yes (Add Location)")}</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="addDriverLocation"
                                value="no"
                                checked={form.addDriverLocation === "no"}
                                onChange={() => setForm((p) => ({ ...p, addDriverLocation: "no" }))}
                                className="text-blue-600"
                              />
                              <span>{tt("trk.w_no_not_required", "No (Not Required)")}</span>
                            </label>
                          </div>

                          {form.addDriverLocation === "yes" && (
                            <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-2 gap-2.5">
                              <label className="space-y-1 text-xs">
                                <span className="font-bold text-slate-600 dark:text-slate-400">{tt("common.country", "Country")}</span>
                                <input
                                  value={form.driverCountry}
                                  onChange={(e) => setForm((p) => ({ ...p, driverCountry: e.target.value }))}
                                  placeholder={tt("lp.country_label", "Country")}
                                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                              </label>
                              <label className="space-y-1 text-xs">
                                <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.w_state_province", "State / Province")}</span>
                                <input
                                  value={form.driverState}
                                  onChange={(e) => setForm((p) => ({ ...p, driverState: e.target.value }))}
                                  placeholder={tt("branch.row_state_province", "State / province")}
                                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                              </label>
                              <label className="space-y-1 text-xs">
                                <span className="font-bold text-slate-600 dark:text-slate-400">{tt("common.city", "City")}</span>
                                <input
                                  value={form.driverCity}
                                  onChange={(e) => setForm((p) => ({ ...p, driverCity: e.target.value }))}
                                  placeholder={tt("lp.city", "City")}
                                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                              </label>
                              <label className="space-y-1 text-xs">
                                <span className="font-bold text-slate-600 dark:text-slate-400">{tt("common.address", "Full Address")}</span>
                                <input
                                  value={form.driverAddress}
                                  onChange={(e) => setForm((p) => ({ ...p, driverAddress: e.target.value }))}
                                  placeholder={tt("trk.ph_driver_address", "Enter full address...")}
                                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                {/* Step 4 Actions */}
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-[15px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs transition"
                  >
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                    <span>{tt("trk.w_back_transporter_details", "Back: Transporter Details")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep(5)}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-[15px] font-black text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
                  >
                    <span>{tt("trk.w_next_documents_and_review", "Next: Documents & Review")}</span>
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </div>
              </section>

              {/* CARD 5: Documents (Optional) */}
              <section
                id="documentsCard"
                className={`rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20 ${
                  activeStep === 5 ? "block" : "hidden"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      5
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{cleanTitle(tt("trk.truck_docs", "Truck Documents"), "Truck Documents")}</span>
                        <span className="text-xs font-normal text-slate-400">{tt("trk.w_optional", "(Optional)")}</span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tt("trk.w_upload_registration_insurance_driver_l", "Upload registration, insurance, driver licence and save registration.")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                    {stepOf(5)}
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                    {/* Drag & Drop Upload Zone */}
                    <label
                      onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files?.length) handleAddDocuments(e.dataTransfer.files);
                      }}
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-5 text-center transition ${
                        isDragging
                          ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30"
                          : "border-slate-200 bg-slate-50/50 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-800/30"
                      }`}
                    >
                      <UploadCloud className="h-8 w-8 text-blue-500" />
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {tt("trk.w_drag_and_drop_files_here_or_click_to_u", "Drag & drop files here, or click to upload")}
                      </div>
                      <div className="text-[10.5px] text-slate-400">
                        PDF, JPG, PNG · Max 10 MB each · Session preview
                      </div>
                      <input
                        type="file"
                        multiple
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={(e) => {
                          if (e.target.files?.length) handleAddDocuments(e.target.files);
                          e.target.value = "";
                        }}
                        className="sr-only"
                      />
                    </label>

                    {/* Compact Documents List with View / Download */}
                    <details open className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/20">
                      <summary className="cursor-pointer text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between select-none">
                        <span className="flex items-center gap-1.5">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>📎 Documents · View / Download</span>
                        </span>
                        <span className="text-[10.5px] font-mono text-slate-400">
                          {documents.length} files
                        </span>
                      </summary>

                      <div className="mt-3 space-y-1.5">
                        {documents.length === 0 ? (
                          <div className="text-center text-xs text-slate-400 py-2">
                            {tt("trk.w_no_documents_added", "No documents added")}
                          </div>
                        ) : (
                          documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                                <span className="truncate font-medium text-slate-800 dark:text-slate-200">{doc.name}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  · {(doc.size / 1024).toFixed(0)} KB
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold text-blue-600 hover:underline"
                                >
                                  {tt("trk.w_view", "View")}
                                </a>
                                <a
                                  href={doc.url}
                                  download={doc.name}
                                  className="text-[11px] font-bold text-blue-600 hover:underline"
                                >
                                  {tt("trk.w_download", "Download")}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDocument(doc.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                  title={tt("trk.w_remove_file", "Remove file")}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </details>

                    {/* Existing Truck Attachments if editing */}
                    {editingId && (
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <TruckAttachments entityId={editingId} entityKey="truck" />
                      </div>
                    )}
                  </div>

                {/* Step 5 Final Actions */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveStep(4)}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-[15px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs transition"
                  >
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                    <span>{tt("trk.w_back_driver_details", "Back: Driver Details")}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-[15px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs transition"
                    >
                      <Save className="h-4 w-4 text-blue-600" />
                      <span>{tt("trk.save_draft", "Save Draft")}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-[15px] font-black text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <span>{tt("trk.submit", "Save & Register Truck")}</span>
                          <Check className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>
            </form>

            {/* RIGHT STICKY LIVE TRUCK REPORT COLUMN */}
            <div className="lg:col-span-7">
              <aside className="dgt-trk-report-card overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-4">
                {/* Header + clear actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-800/40 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {tt("trk.live_report_title", "Live Truck Report")}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tt("trk.live_report_sub", "Registration preview — updates as you type")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-200/60 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {tt("trk.w_live_preview", "LIVE PREVIEW")}
                    </span>
                    <button
                      type="button"
                      disabled={reportBusy !== null}
                      onClick={() => runLiveReport("view")}
                      data-testid="trk-report-view"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2 text-[15px] font-bold text-blue-700 shadow-2xs transition hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300 disabled:opacity-60"
                    >
                      {reportBusy === "view" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      <span>{tt("trk.w_view_report", "View Report")}</span>
                    </button>
                    <button
                      type="button"
                      disabled={reportBusy !== null}
                      onClick={() => runLiveReport("print")}
                      data-testid="trk-report-print"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-[15px] font-black text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {reportBusy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                      <span>{tt("common.print", "Print")}</span>
                    </button>
                    <button
                      type="button"
                      disabled={reportBusy !== null}
                      onClick={() => runLiveReport("pdf")}
                      data-testid="trk-report-pdf"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2 text-[15px] font-bold text-blue-700 shadow-2xs transition hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300 disabled:opacity-60"
                    >
                      {reportBusy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span>{tt("trk.w_download_pdf", "Download PDF")}</span>
                    </button>
                  </div>
                </div>

                {/* Report */}
                <div id="trk-live-report" className="dgt-trk-report max-h-[calc(100vh-190px)] overflow-y-auto p-4 sm:p-5">
                  {fullLiveReportContent}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-5 py-2.5 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                  <span>{tt("trk.w_live_form_preview_central_erp", "Live form preview · central ERP")}</span>
                </div>
              </aside>
            </div>
          </div>
        </>
      )}

      {/* Party 360 View Modal */}
      {party360 && (
        <Party360Modal
          customerId={party360.customerId}
          name={party360.name}
          lang={activeLang}
          onClose={() => setParty360(null)}
        />
      )}
    </div>
  );
}
