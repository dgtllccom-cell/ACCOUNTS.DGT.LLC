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
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { PersonPicker } from "@/components/erp/person-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { Party360Modal } from "@/features/customers/components/party-360-modal";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";
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
  code?: string;
  person_code?: string;
  photo_url?: string | null;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  cnic?: string;
  passport?: string;
  license_no?: string;
  license_expiry?: string;
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
  truckNumber: "",
  truckName: "",
  truckModel: "",
  chassisNumber: "",
  engineNumber: "",
  registrationNumber: "",
  truckType: "Trailer Truck",
  make: "",
  manufacturingYear: "2022",
  color: "White",
  fuelType: "Diesel",
  capacity: "25",
  registrationExpiryDate: "",
  insuranceExpiryDate: "",
  companyLink: "yes",
  companyType: "transporter",
  companyId: "",
  transporterId: "",
  driverType: "permanent",
  temporaryDriverName: "",
  driverId: "",
  driverMobile: "",
  driverLicenseNo: "",
  driverLicenseExpiry: "",
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

  // Overlay modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewModalTab, setViewModalTab] = useState<"full" | "owner" | "vehicle" | "transporter" | "driver" | "documents">("full");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

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
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) setViewMenuOpen(false);
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

  // Lookup details for Owner
  useEffect(() => {
    if (!form.ownerId || form.hasOwner === "no") {
      setOwnerDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(form.ownerId)}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.data?.customer) setOwnerDetails(res.data.customer);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.ownerId, form.hasOwner]);

  // Lookup details for Company
  useEffect(() => {
    if (!form.companyId || form.companyLink === "no") {
      setCompanyDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/companies/${encodeURIComponent(form.companyId)}`).then((r) => r.json());
        if (cancelled) return;
        const comp = res?.data?.company || res?.company;
        if (comp) setCompanyDetails(comp);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.companyId, form.companyLink]);

  // Lookup details for Transporter
  useEffect(() => {
    if (!form.transporterId) {
      setTransporterDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(form.transporterId)}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.data?.customer) setTransporterDetails(res.data.customer);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.transporterId]);

  // Lookup details for Driver
  useEffect(() => {
    if (!form.driverId || form.driverType !== "permanent") {
      setDriverDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(form.driverId)}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.data?.customer) {
          const c: CustomerDetails = {
            ...res.data.customer,
            registrations: res.data.registrations || [],
            contacts: res.data.contacts || [],
          };
          // Try to extract license number from registrations if not directly on customer
          const dlReg = c.registrations?.find((r) =>
            ["driving_license", "driving_licence", "license", "licence", "dl"].includes(
              (r.registration_type || "").toLowerCase().trim()
            )
          );
          if (!c.license_no && dlReg?.registration_value) {
            c.license_no = dlReg.registration_value;
          }

          setDriverDetails(c);
          setForm((prev) => ({
            ...prev,
            driverMobile: prev.driverMobile || c.mobile || c.whatsapp || "",
            driverLicenseNo: prev.driverLicenseNo || c.license_no || "",
            driverCountry: prev.driverCountry || c.country_name || c.country || "",
            driverState: prev.driverState || c.state_province_name || c.state || "",
            driverCity: prev.driverCity || c.city_name || c.city || "",
            driverAddress: prev.driverAddress || c.address || "",
          }));
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
    if (typeof document !== "undefined") {
      const el = document.getElementById(cardId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
      alert("Please upload a JPG or PNG image under 5 MB.");
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
    setOwnerDetails(null);
    setCompanyDetails(null);
    setTransporterDetails(null);
    setDriverDetails(null);
  }

  function openNewRegistration() {
    resetForm();
    setMessage(null);
    setView("form");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToList() {
    resetForm();
    setMessage(null);
    setView("list");
  }

  function startEdit(row: TruckRow) {
    setEditingId(row.id);
    setForm({
      hasOwner: row.owner_person_id ? "yes" : "no",
      ownerId: row.owner_person_id || "",
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
      driverId: row.driver_person_id || "",
      driverMobile: row.driver_mobile || "",
      driverLicenseNo: row.driver_cnic_passport || "",
      driverLicenseExpiry: row.driver_docs_expiry_date || "",
      addDriverLocation: "yes",
      driverCountry: "",
      driverState: "",
      driverCity: "",
      driverAddress: "",
      remarks: row.notes || "",
      status: row.status || "active",
      registrationDate: (row.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      registrationNumber: row.registration_number || "",
      truckType: row.truck_type || "Trailer Truck",
      make: row.make || "",
      manufacturingYear: row.manufacturing_year ? String(row.manufacturing_year) : "2022",
      color: row.color || "White",
      fuelType: row.fuel_type || "Diesel",
      capacity: row.capacity || "25",
      registrationExpiryDate: row.registration_expiry_date || "",
      insuranceExpiryDate: row.insurance_expiry_date || "",
    });
    if (row.driver_mobile) {
      setContacts([{ id: "c-1", type: "WhatsApp", value: row.driver_mobile }]);
    }
    setMessage(null);
    setView("form");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  function handleView(row: TruckRow, options?: { autoPrint?: boolean }) {
    openMasterProfileReportWindow({
      lang: activeLang,
      title: tt("trk.registered_truck_title", "Clearing Truck Registration"),
      subtitle: tt("trk.module_subtitle", "Truck master, owner, transporter, driver and reporting."),
      name: row.truck_number,
      status: row.status,
      meta: [
        { label: tt("trk.col_truck_no", "Truck No."), value: row.truck_number },
        { label: tt("common.registration_date", "Registration Date"), value: (row.created_at || "").slice(0, 10) },
        { label: tt("common.status", "Status"), value: row.status },
        { label: tt("trk.col_branch", "Branch"), value: row.branch_display_name },
      ],
      sections: [
        {
          title: tt("trk.section_truck_details", "2. Truck Details"),
          rows: [
            { label: tt("trk.truck_owner_name_label", "Truck Owner Name *").replace(" *", ""), value: row.owner_display_name },
            { label: tt("trk.truck_name_label", "Truck Name"), value: row.truck_name },
            { label: tt("trk.model", "Model *").replace(" *", ""), value: row.model },
            { label: tt("trk.chassis_no", "Chassis No *").replace(" *", ""), value: row.chassis_number },
            { label: tt("trk.engine_no", "Engine No"), value: row.engine_number },
          ],
        },
        {
          title: tt("com.vehicle_specifications", "Vehicle Specifications"),
          rows: [
            { label: tt("trk.reg_no", "Registration No *").replace(" *", ""), value: row.registration_number },
            { label: tt("trk.truck_type", "Truck Type *").replace(" *", ""), value: row.truck_type },
            { label: tt("trk.make", "Make *").replace(" *", ""), value: row.make },
            { label: tt("trk.year", "Year *").replace(" *", ""), value: row.manufacturing_year ? String(row.manufacturing_year) : null },
            { label: tt("trk.color", "Color"), value: row.color },
            { label: tt("trk.fuel_type", "Fuel Type"), value: row.fuel_type },
            { label: tt("trk.capacity", "Capacity (Tons) *").replace(" *", ""), value: row.capacity },
            { label: tt("tr.reg_expiry", "Reg. Expiry"), value: row.registration_expiry_date },
            { label: tt("tr.ins_expiry", "Insurance Expiry"), value: row.insurance_expiry_date },
          ],
        },
        {
          title: tt("trk.section_company", "3. Registered Company"),
          rows: [{ label: tt("trk.company_name_label", "Company Name"), value: row.company_display_name }],
        },
        {
          title: tt("trk.section_transporter", "4. Transporter Information"),
          rows: [{ label: tt("trk.transporter_name_label", "Transporter Name"), value: row.transporter_display_name }],
        },
        {
          title: tt("trk.section_driver", "5. Driver Information"),
          rows: [
            { label: tt("trk.driver_name_label", "Driver Name *").replace(" *", ""), value: row.driver_display_name },
            { label: tt("common.mobile", "Mobile"), value: row.driver_mobile },
            { label: tt("trk.license_no", "Driving License Number"), value: row.driver_cnic_passport },
            { label: tt("trk.licence_expiry_label", "Licence Expiry Date"), value: row.driver_docs_expiry_date },
          ],
        },
        {
          title: tt("trk.section_additional", "6. Additional Information"),
          rows: [{ label: tt("trk.remarks", "Remarks (Optional)"), value: row.notes }],
          fullWidth: true,
        },
      ],
      reportIdPrefix: "TRUCK",
      reportIdValue: row.entry_serial || row.truck_number,
      autoPrint: options?.autoPrint ?? false,
    });
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
          ? driverDetails?.customer_name || null
          : form.temporaryDriverName.trim() || null;

      const payload = {
        truck_number: form.truckNumber.trim(),
        truck_name: form.truckName.trim() || null,
        model: form.truckModel.trim() || null,
        chassis_number: form.chassisNumber.trim(),
        engine_number: form.engineNumber.trim(),
        owner_person_id: form.hasOwner === "yes" && form.ownerId ? form.ownerId : null,
        owner_name: form.hasOwner === "yes" ? ownerDetails?.customer_name || null : null,
        owner_mobile: form.hasOwner === "yes" ? ownerDetails?.mobile || ownerDetails?.whatsapp || null : null,
        transport_company_id: form.companyLink === "yes" && form.companyId ? form.companyId : null,
        transport_company: form.companyLink === "yes" ? companyDetails?.name || null : null,
        transporter_person_id: form.transporterId ? form.transporterId : null,
        driver_person_id: form.driverType === "permanent" && form.driverId ? form.driverId : null,
        driver_name: driverName,
        driver_mobile: firstValidContact,
        driver_cnic_passport: form.driverLicenseNo.trim() || null,
        driver_docs_expiry_date: form.driverLicenseExpiry || null,
        notes: form.remarks.trim() || null,
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

  // Reusable Report Row
  const LiveReportRow = ({
    label,
    value,
    badge,
  }: {
    label: string;
    value?: string | number | null;
    badge?: React.ReactNode;
  }) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 text-[11px] last:border-0 dark:border-slate-800/80">
      <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">{label}:</span>
      {badge ? (
        <span className="text-end">{badge}</span>
      ) : (
        <b className="text-slate-800 dark:text-slate-100 font-semibold break-words text-end">
          {value || "—"}
        </b>
      )}
    </div>
  );

  // Reusable Report Section
  const LiveReportSection = ({
    title,
    icon: Icon,
    children,
    action,
  }: {
    title: string;
    icon: any;
    children: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 transition">
      <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
            {title}
          </span>
        </div>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );

  // Full Live Report Content
  const fullLiveReportContent = (
    <div className="space-y-3.5">
      {/* Dark Truck Banner with Live Status & Specifications */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest text-blue-300 uppercase">
                {tt("trk.col_truck_no", "Truck No.")}
              </span>
              <span className={`inline-block rounded-md px-2 py-0.5 text-[9px] font-bold ${statusBadgeClasses(form.status)}`}>
                {statusLabel(form.status)}
              </span>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white">
              {form.truckNumber || "New Registration"}
            </div>
            {form.truckName && (
              <div className="text-xs text-blue-200/80 font-medium">
                {form.truckName} {form.truckModel ? `· Model ${form.truckModel}` : ""}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-200">
              <TruckIcon className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-200 border border-blue-400/20">
              {form.truckType}
            </span>
          </div>
        </div>
      </div>

      {/* 1. Owner / Customer Information */}
      <LiveReportSection
        title={`1. ${cleanTitle(tt("trk.section_owner", "Truck Owner Information"), "Truck Owner Information")}`}
        icon={User}
      >
        {form.hasOwner === "no" || !form.ownerId ? (
          <div className="p-2 text-xs text-slate-500 italic">
            No owner is linked to this truck. Direct registration without owner.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <LiveReportRow label={tt("common.name", "Name")} value={ownerDetails?.customer_name} />
            <LiveReportRow label={tt("trk.owner_code_label", "Owner Code")} value={ownerDetails?.person_code || ownerDetails?.code} />
            <LiveReportRow label={tt("common.mobile", "Mobile")} value={ownerDetails?.mobile} />
            <LiveReportRow label={tt("common.whatsapp", "WhatsApp")} value={ownerDetails?.whatsapp} />
            <div className="sm:col-span-2">
              <LiveReportRow label={tt("common.address", "Address")} value={ownerDetails?.address} />
            </div>
          </div>
        )}
      </LiveReportSection>

      {/* 2. Truck & Vehicle Details */}
      <LiveReportSection
        title={`2. ${cleanTitle(tt("trk.section_truck_details", "Truck Details"), "Truck Details")}`}
        icon={TruckIcon}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <LiveReportRow label={tt("trk.truck_no", "Truck Number")} value={form.truckNumber} />
          <LiveReportRow label={tt("trk.truck_name_label", "Truck Name")} value={form.truckName} />
          <LiveReportRow label={tt("trk.truck_type", "Truck Type")} value={form.truckType} />
          <LiveReportRow label={tt("trk.year", "Year")} value={form.manufacturingYear} />
          <LiveReportRow label={tt("trk.color", "Color")} value={form.color} />
          <LiveReportRow label={tt("trk.fuel_type", "Fuel Type")} value={form.fuelType} />
          <LiveReportRow label={tt("trk.capacity", "Capacity (Tons)")} value={form.capacity ? `${form.capacity} Tons` : null} />
          <LiveReportRow label={tt("trk.reg_no", "Registration No")} value={form.registrationNumber} />
          <LiveReportRow label={tt("trk.chassis_no", "Chassis No")} value={form.chassisNumber} />
          <LiveReportRow label={tt("trk.engine_no", "Engine No")} value={form.engineNumber} />
          <LiveReportRow label={tt("tr.reg_expiry", "Reg. Expiry")} value={form.registrationExpiryDate} />
          <LiveReportRow label={tt("tr.ins_expiry", "Insurance Expiry")} value={form.insuranceExpiryDate} />
        </div>
      </LiveReportSection>

      {/* 3. Transporter & Company Information */}
      <LiveReportSection
        title={`3. ${cleanTitle(tt("trk.section_transporter", "Transporter Information"), "Transporter Information")}`}
        icon={Building2}
      >
        {form.companyLink === "no" && !form.transporterId ? (
          <div className="p-2 text-xs text-slate-500 italic">
            No transporter or shipping-line company is linked.
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Transporter Person Card if selected */}
            {transporterDetails ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex items-center justify-between border-b border-blue-100/80 pb-1.5 mb-1.5 dark:border-blue-900/40">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {transporterDetails.customer_name}
                    </span>
                  </div>
                  <span className="rounded-md bg-blue-600 text-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                    REGISTERED TRANSPORTER
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <LiveReportRow label={tt("trk.transporter_code_label", "Transporter Code")} value={transporterDetails.person_code || transporterDetails.code} />
                  <LiveReportRow label={tt("common.mobile", "Mobile")} value={transporterDetails.mobile} />
                  <LiveReportRow label={tt("common.whatsapp", "WhatsApp")} value={transporterDetails.whatsapp} />
                  <LiveReportRow label={tt("common.address", "Address")} value={transporterDetails.address} />
                </div>
              </div>
            ) : form.transporterId ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> Loading transporter details...
              </div>
            ) : null}

            {/* Linked Transport / Shipping Company */}
            {form.companyLink === "yes" && (companyDetails ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5 mb-1.5 dark:border-slate-700/80">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {companyDetails.name}
                    </span>
                  </div>
                  <span className="rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                    {form.companyType === "shippingLine" ? "Shipping Line Company" : "Transporter Company"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <LiveReportRow label={tt("trk.company_code_label", "Company Code")} value={companyDetails.company_code} />
                  <LiveReportRow label={tt("c360.legal_name", "Legal / Trade Name")} value={companyDetails.legal_name || companyDetails.trade_name} />
                  <LiveReportRow label={tt("ctm.trn_reg_no", "Registration / TRN")} value={companyRegNumber(companyDetails)} />
                  <LiveReportRow label={tt("sed.f_owner_name", "Owner Name")} value={companyDetails.owner_name} />
                  <LiveReportRow label={tt("common.phone", "Phone / Mobile")} value={companyPhone(companyDetails)} />
                  <LiveReportRow label={tt("common.email", "Email")} value={companyEmail(companyDetails)} />
                  <LiveReportRow label={tt("common.city", "City / Country")} value={[companyDetails.city_name, companyDetails.country_name].filter(Boolean).join(", ")} />
                  <div className="sm:col-span-2">
                    <LiveReportRow label={tt("common.address", "Registered Office")} value={companyDetails.address} />
                  </div>
                </div>
              </div>
            ) : form.companyId ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> Loading company information...
              </div>
            ) : (
              <div className="p-2 text-xs text-slate-400 italic">
                Choose an existing company to display its registered details.
              </div>
            ))}
          </div>
        )}
      </LiveReportSection>

      {/* 4. Driver Information */}
      <LiveReportSection
        title={`4. ${cleanTitle(tt("trk.section_driver", "Driver Information"), "Driver Information")}`}
        icon={UserCheck}
        action={
          <button
            type="button"
            onClick={() => scrollToSection("driverCard")}
            className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            Edit
          </button>
        }
      >
        {/* Driver Photo Preview Card */}
        <div className="my-1.5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs dark:border-slate-700 dark:bg-slate-800 flex items-center justify-center">
            {(form.driverType === "permanent" ? (driverDetails?.photo_url || driverPhotoUrl) : driverPhotoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.driverType === "permanent" ? (driverDetails?.photo_url || driverPhotoUrl)! : driverPhotoUrl!}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-black text-slate-900 dark:text-white">
              {form.driverType === "permanent"
                ? driverDetails?.customer_name || tt("trk.driver_name_label", "Driver Name")
                : form.temporaryDriverName || "Temporary Driver"}
            </div>
            <div className="mt-0.5 inline-block rounded-md bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              {form.driverType === "permanent" ? "Permanent Driver" : "Temporary Driver"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <LiveReportRow
            label={tt("trk.license_no", "Driving License Number")}
            value={form.driverType === "permanent" ? (driverDetails?.license_no || form.driverLicenseNo) : form.driverLicenseNo}
          />
          <LiveReportRow
            label={tt("trk.licence_expiry_label", "Licence Expiry Date")}
            value={form.driverType === "permanent" ? (driverDetails?.license_expiry || form.driverLicenseExpiry) : form.driverLicenseExpiry}
          />
          <LiveReportRow
            label={tt("common.status", "Status")}
            badge={
              <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${statusBadgeClasses(form.status)}`}>
                {statusLabel(form.status)}
              </span>
            }
          />
          <LiveReportRow
            label={tt("common.mobile", "Primary Mobile")}
            value={form.driverType === "permanent" ? (driverDetails?.mobile || driverDetails?.whatsapp || form.driverMobile) : form.driverMobile}
          />
        </div>

        {/* Additional Contacts */}
        {form.driverType === "permanent" ? (
          (driverDetails?.whatsapp || driverDetails?.email) && (
            <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contacts</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                {driverDetails.whatsapp && <LiveReportRow label={tt("crm.ftype_whatsapp", "WhatsApp")} value={driverDetails.whatsapp} />}
                {driverDetails.email && <LiveReportRow label={tt("tax_einv.set_f_email", "Email")} value={driverDetails.email} />}
              </div>
            </div>
          )
        ) : (
          contacts.filter((c) => c.value.trim().length > 0).length > 0 && (
            <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contacts</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                {contacts.filter((c) => c.value.trim().length > 0).map((c, idx) => (
                  <LiveReportRow key={c.id || idx} label={c.type} value={c.value} />
                ))}
              </div>
            </div>
          )
        )}

        {/* Location */}
        {form.driverType === "permanent" ? (
          (driverDetails?.city_name || driverDetails?.city || driverDetails?.country_name || driverDetails?.country || driverDetails?.address) && (
            <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <LiveReportRow
                label={tt("common.location", "Driver Location")}
                value={[driverDetails.city_name || driverDetails.city, driverDetails.state_province_name || driverDetails.state, driverDetails.country_name || driverDetails.country, driverDetails.address].filter(Boolean).join(", ")}
              />
            </div>
          )
        ) : (
          form.addDriverLocation === "yes" && (form.driverCountry || form.driverCity || form.driverAddress) && (
            <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <LiveReportRow
                label={tt("common.location", "Driver Location")}
                value={[form.driverCountry, form.driverState, form.driverCity, form.driverAddress].filter(Boolean).join(", ")}
              />
            </div>
          )
        )}
      </LiveReportSection>

      {/* 5. Documents */}
      <LiveReportSection
        title={`5. Documents`}
        icon={FileText}
        action={
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-mono font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {documents.length} files
          </span>
        }
      >
        {documents.length === 0 ? (
          <div className="p-2 text-center text-xs text-slate-400">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="space-y-1.5 pt-1">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                <span className="truncate font-medium text-slate-700 dark:text-slate-300 max-w-[200px]">{d.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-blue-600 hover:underline">
                    View
                  </a>
                  <a href={d.url} download={d.name} className="text-[11px] font-bold text-blue-600 hover:underline">
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </LiveReportSection>
    </div>
  );

  return (
    <div className="space-y-5" dir={dir}>
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
                        <span className="mt-2 block font-medium">Loading...</span>
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
                            onView={() => handleView(row)}
                            onEdit={() => startEdit(row)}
                            onDelete={() => handleDelete(row.id)}
                            onPrint={() => handleView(row, { autoPrint: true })}
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
                {tt("trk.showing_records", "Showing")} {filteredRows.length === 0 ? 0 : pageStart + 1} -{" "}
                {Math.min(pageStart + pageSize, filteredRows.length)} / {filteredRows.length}
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

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                LIVE ERP SYNC
              </span>

              {/* View ⌄ Dropdown */}
              <div className="relative" ref={viewMenuRef}>
                <button
                  type="button"
                  onClick={() => setViewMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 shadow-2xs"
                >
                  <Eye className="h-4 w-4" />
                  <span>View</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>

                {viewMenuOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-top-1">
                    <div className="px-2 py-1 text-[9px] font-black tracking-wider text-slate-400 uppercase">
                      REGISTRATION VIEWS
                    </div>
                    {[
                      { key: "full", label: "Live Truck Report", icon: TruckIcon },
                      { key: "owner", label: "Owner Details", icon: User },
                      { key: "vehicle", label: "Truck & Vehicle", icon: TruckIcon },
                      { key: "transporter", label: "Transporter Details", icon: Building2 },
                      { key: "driver", label: "Driver Details", icon: UserCheck },
                      { key: "documents", label: "Documents", icon: FileText },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setViewModalTab(opt.key as any);
                            setViewModalOpen(true);
                            setViewMenuOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-blue-600" />
                            <span>{opt.label}</span>
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" />
                        </button>
                      );
                    })}
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setViewMenuOpen(false);
                        window.print();
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Printer className="h-3.5 w-3.5 text-slate-500" />
                        <span>Print Report</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={backToList}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs transition"
              >
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {tt("trk.back_to_list", "Back to List")}
              </button>
            </div>
          </div>

          {/* 5-Step Bar across the top */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            {[
              { id: "vehicleCard", num: 1, title: "Truck & Vehicle", sub: "Truck, chassis, engine" },
              { id: "transporterCard", num: 2, title: "Transporter", sub: "Transporter / Company" },
              { id: "driverCard", num: 3, title: "Driver", sub: "Driver & photo info" },
              { id: "documentsCard", num: 4, title: "Documents", sub: "Upload documents" },
              { id: "review", num: 5, title: "Review & Save", sub: "Confirm & register" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  if (st.id === "review") {
                    setViewModalTab("full");
                    setViewModalOpen(true);
                  } else {
                    scrollToSection(st.id);
                  }
                }}
                className="flex items-center gap-2.5 rounded-xl p-2 text-start transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {st.num}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{st.title}</div>
                  <div className="truncate text-[10px] text-slate-400 hidden xl:block">{st.sub}</div>
                </div>
              </button>
            ))}
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

          {/* MAIN 2-COLUMN LAYOUT: Compact Form (Left) & Sticky Live Truck Report (Right) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* LEFT FORM COLUMN (Col 5) */}
            <form onSubmit={handleSubmit} className="space-y-4 lg:col-span-5">
              {/* CARD 1: Owner / Customer Selection (Optional) */}
              <section id="ownerCard" className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      1
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{cleanTitle(tt("trk.section_owner", "Truck Owner Information"), "Truck Owner Information")}</span>
                        <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                      </h2>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        Select an existing owner/customer account. Registered details appear below.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCollapse("owner")}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {collapsedCards.owner ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                </div>

                {!collapsedCards.owner && (
                  <div className="mt-4 space-y-3.5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr]">
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
                          If there is no owner, leave blank (Without Owner) and continue with truck registration.
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
                                {ownerDetails.customer_name}
                              </div>
                              <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase">
                                REGISTERED OWNER
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setParty360({ customerId: form.ownerId, name: ownerDetails.customer_name || "" })}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-2xs hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                          >
                            <Eye className="h-3 w-3" /> {tt("trk.view_owner_details", "View Owner Details")}
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">ID / Code:</span> <b className="text-slate-800 dark:text-slate-100">{ownerDetails.person_code || ownerDetails.code || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">Mobile:</span> <b className="text-slate-800 dark:text-slate-100">{ownerDetails.mobile || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">WhatsApp:</span> <b className="text-slate-800 dark:text-slate-100">{ownerDetails.whatsapp || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">Address:</span> <b className="text-slate-800 dark:text-slate-100 truncate">{ownerDetails.address || "—"}</b></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* CARD 2: Truck Registration Details (Combined Details & Physical Specs) */}
              <section id="vehicleCard" className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      2
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white">
                        {cleanTitle(tt("trk.section_truck_details", "Truck Details"), "Truck Details")}
                      </h2>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        Enter truck identification and physical specifications.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCollapse("vehicle")}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {collapsedCards.vehicle ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                </div>

                {!collapsedCards.vehicle && (
                  <div className="mt-4 space-y-3.5">
                    {/* Row 1: Identification */}
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {tt("trk.truck_no", "Truck Number *")}
                        </span>
                        <input
                          required
                          value={form.truckNumber}
                          onChange={(e) => setForm((p) => ({ ...p, truckNumber: e.target.value }))}
                          placeholder="e.g. TRK-TEST-001"
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
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
                          {tt("trk.reg_no", "Registration No *")}
                        </span>
                        <input
                          value={form.registrationNumber}
                          onChange={(e) => setForm((p) => ({ ...p, registrationNumber: e.target.value }))}
                          placeholder="e.g. Qq-1234-XYZ"
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
                          <option value="Trailer Truck">Trailer Truck</option>
                          <option value="Container Truck">Container Truck</option>
                          <option value="Flatbed Truck">Flatbed Truck</option>
                          <option value="Box Truck">Box Truck</option>
                          {truckTypeOptions.map((o) => (
                            <option key={o.id} value={o.code}>
                              {optionLabel(o)}
                            </option>
                          ))}
                        </select>
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
                    </div>

                    {/* Row 2: Physical Specifications */}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 pt-1">
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.color", "Color")}</span>
                        <select
                          value={form.color}
                          onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <option value="White">White</option>
                          <option value="Blue">Blue</option>
                          <option value="Black">Black</option>
                          <option value="Red">Red</option>
                          <option value="Silver">Silver</option>
                          {colorOptions.map((o) => (
                            <option key={o.id} value={o.code}>
                              {optionLabel(o)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.fuel_type", "Fuel Type")}</span>
                        <select
                          value={form.fuelType}
                          onChange={(e) => setForm((p) => ({ ...p, fuelType: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <option value="Diesel">Diesel</option>
                          <option value="Petrol">Petrol</option>
                          <option value="Electric">Electric</option>
                          <option value="Hybrid">Hybrid</option>
                          {fuelTypeOptions.map((o) => (
                            <option key={o.id} value={o.code}>
                              {optionLabel(o)}
                            </option>
                          ))}
                        </select>
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
                        <span className="font-bold text-slate-700 dark:text-slate-300">{tt("tr.ins_expiry", "Insurance Expiry")}</span>
                        <input
                          type="date"
                          value={form.insuranceExpiryDate}
                          onChange={(e) => setForm((p) => ({ ...p, insuranceExpiryDate: e.target.value }))}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </section>

              {/* CARD 3: Transporter / Shipping Line Information */}
              <section id="transporterCard" className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      3
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white">
                        {cleanTitle(tt("trk.section_transporter", "Transporter Information"), "Transporter Information")}
                      </h2>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        Select a transporter person/contractor and/or link a transport company.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCollapse("transporter")}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {collapsedCards.transporter ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                </div>

                {!collapsedCards.transporter && (
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
                                {transporterDetails.customer_name}
                              </div>
                              <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase">
                                REGISTERED TRANSPORTER
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">Transporter Code:</span> <b className="text-slate-800 dark:text-slate-100">{transporterDetails.person_code || transporterDetails.code || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">Mobile:</span> <b className="text-slate-800 dark:text-slate-100">{transporterDetails.mobile || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">WhatsApp:</span> <b className="text-slate-800 dark:text-slate-100">{transporterDetails.whatsapp || "—"}</b></div>
                          <div className="flex justify-between py-0.5"><span className="text-slate-500">Address:</span> <b className="text-slate-800 dark:text-slate-100 truncate">{transporterDetails.address || "—"}</b></div>
                        </div>
                      </div>
                    )}

                    {/* Link Company Radio */}
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 pt-1">
                      <span>Link a company?</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="companyLink"
                          value="yes"
                          checked={form.companyLink === "yes"}
                          onChange={() => setForm((p) => ({ ...p, companyLink: "yes" }))}
                          className="text-blue-600"
                        />
                        <span>Yes</span>
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
                            <span className="font-bold text-slate-700 dark:text-slate-300">Company Type</span>
                            <select
                              value={form.companyType}
                              onChange={(e) => setForm((p) => ({ ...p, companyType: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <option value="transporter">Transporter Company</option>
                              <option value="shippingLine">Shipping Line Company</option>
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
                                    {companyDetails.name}
                                  </div>
                                  <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase">
                                    REGISTERED COMPANY
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">Company Code:</span> <b className="text-slate-800 dark:text-slate-100">{companyDetails.company_code || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">Legal Name:</span> <b className="text-slate-800 dark:text-slate-100">{companyDetails.legal_name || companyDetails.trade_name || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">Registration / TRN:</span> <b className="text-slate-800 dark:text-slate-100">{companyRegNumber(companyDetails) || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">Owner Name:</span> <b className="text-slate-800 dark:text-slate-100">{companyDetails.owner_name || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">Phone / Mobile:</span> <b className="text-slate-800 dark:text-slate-100">{companyPhone(companyDetails) || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">Email:</span> <b className="text-slate-800 dark:text-slate-100">{companyEmail(companyDetails) || "—"}</b></div>
                              <div className="flex justify-between py-0.5"><span className="text-slate-500">City / Country:</span> <b className="text-slate-800 dark:text-slate-100">{[companyDetails.city_name, companyDetails.country_name].filter(Boolean).join(", ") || "—"}</b></div>
                              <div className="flex justify-between py-0.5 sm:col-span-2"><span className="text-slate-500">Address:</span> <b className="text-slate-800 dark:text-slate-100 truncate">{companyDetails.address || "—"}</b></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* CARD 4: Driver Information (Optional) with Photo, Multi-Contacts, and Location */}
              <section id="driverCard" className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      4
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{cleanTitle(tt("trk.section_driver", "Driver Information"), "Driver Information")}</span>
                        <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                      </h2>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        Select a permanent driver or enter temporary driver details.
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
                        <span>Permanent</span>
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
                        <span>Temporary</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCollapse("driver")}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {collapsedCards.driver ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {!collapsedCards.driver && (
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
                        <span>Permanent Driver</span>
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
                        <span>Temporary Driver</span>
                      </label>
                    </div>

                    {form.driverType === "permanent" ? (
                      /* PERMANENT DRIVER FLOW: Clean dropdown + Status + Registered Driver details card */
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
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
                                    <span>{driverDetails.customer_name}</span>
                                    {driverDetails.person_code && (
                                      <span className="font-mono text-[10px] text-blue-700 dark:text-blue-300">
                                        ({driverDetails.person_code})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">
                                      REGISTERED DRIVER
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
                                <span className="text-slate-500">License Number:</span>
                                <b className="text-slate-800 dark:text-slate-100 font-mono">
                                  {driverDetails.license_no || form.driverLicenseNo || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">License Expiry:</span>
                                <b className="text-slate-800 dark:text-slate-100">
                                  {driverDetails.license_expiry || form.driverLicenseExpiry || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">Mobile:</span>
                                <b className="text-slate-800 dark:text-slate-100 font-mono">
                                  {driverDetails.mobile || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">WhatsApp:</span>
                                <b className="text-slate-800 dark:text-slate-100 font-mono">
                                  {driverDetails.whatsapp || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">Email:</span>
                                <b className="text-slate-800 dark:text-slate-100 truncate">
                                  {driverDetails.email || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-500">City / Country:</span>
                                <b className="text-slate-800 dark:text-slate-100">
                                  {[driverDetails.city_name || driverDetails.city, driverDetails.country_name || driverDetails.country].filter(Boolean).join(", ") || "—"}
                                </b>
                              </div>
                              <div className="flex justify-between py-0.5 sm:col-span-2">
                                <span className="text-slate-500">Address:</span>
                                <b className="text-slate-800 dark:text-slate-100 truncate">
                                  {driverDetails.address || "—"}
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
                              Driver photograph
                            </strong>
                            <p className="mt-0.5 text-[10.5px] text-slate-500">
                              Add driver photo first, then complete driver details.
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
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                          <label className="space-y-1 text-xs block">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {tt("trk.ph_driver_name", "Temporary Driver Name")}
                            </span>
                            <input
                              value={form.temporaryDriverName}
                              onChange={(e) => setForm((p) => ({ ...p, temporaryDriverName: e.target.value }))}
                              placeholder={tt("trk.ph_driver_name", "Enter temporary driver name...")}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>

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
                            <span className="font-bold text-slate-700 dark:text-slate-300">{tt("trk.licence_expiry_label", "Licence Expiry Date")}</span>
                            <input
                              type="date"
                              value={form.driverLicenseExpiry}
                              onChange={(e) => setForm((p) => ({ ...p, driverLicenseExpiry: e.target.value }))}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
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
                              <span>Yes (Add Location)</span>
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
                              <span>No (Not Required)</span>
                            </label>
                          </div>

                          {form.addDriverLocation === "yes" && (
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
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
                                <span className="font-bold text-slate-600 dark:text-slate-400">State / Province</span>
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
                )}
              </section>

              {/* CARD 5: Documents (Optional) */}
              <section id="documentsCard" className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-20">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      5
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>Documents</span>
                        <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                      </h2>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        Upload registration, insurance, driver licence and supporting files.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCollapse("documents")}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {collapsedCards.documents ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                </div>

                {!collapsedCards.documents && (
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
                        Drag & drop files here, or click to upload
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
                            No documents added
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
                                  View
                                </a>
                                <a
                                  href={doc.url}
                                  download={doc.name}
                                  className="text-[11px] font-bold text-blue-600 hover:underline"
                                >
                                  Download
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDocument(doc.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                  title="Remove file"
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
                )}
              </section>

              {/* Form Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={backToList}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs"
                >
                  <X className="h-4 w-4" /> {tt("common.cancel", "Cancel")}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs"
                  >
                    <Save className="h-4 w-4 text-blue-600" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Save & Register</span>
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* RIGHT STICKY LIVE TRUCK REPORT COLUMN (Col 7) */}
            <div className="lg:col-span-7">
              <aside className="rounded-3xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-6 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white">
                        {tt("trk.live_report_title", "Live Truck Report")}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {tt("trk.live_report_sub", "Registration preview — updates as you type")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300">
                    LIVE PREVIEW
                  </span>
                </div>

                {/* Content */}
                <div className="p-3.5 max-h-[calc(100vh-180px)] overflow-y-auto">
                  {fullLiveReportContent}
                </div>

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[10px] text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                  <span>Live form preview · central ERP</span>
                  <button
                    type="button"
                    onClick={() => {
                      setViewModalTab("full");
                      setViewModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Report</span>
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </>
      )}

      {/* OVERLAY MODAL: VIEW REPORT DIALOG */}
      {viewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  {viewModalTab === "full" && tt("trk.live_report_title", "Live Truck Report")}
                  {viewModalTab === "owner" && cleanTitle(tt("trk.section_owner", "Owner Details"), "Owner Details")}
                  {viewModalTab === "vehicle" && cleanTitle(tt("trk.section_truck_details", "Truck Details"), "Truck Details")}
                  {viewModalTab === "transporter" && cleanTitle(tt("trk.section_transporter", "Transporter Details"), "Transporter Details")}
                  {viewModalTab === "driver" && cleanTitle(tt("trk.section_driver", "Driver Details"), "Driver Details")}
                  {viewModalTab === "documents" && "Documents"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {viewModalTab === "full" && fullLiveReportContent}

              {viewModalTab === "owner" && (
                <LiveReportSection title={`1. ${cleanTitle(tt("trk.section_owner", "Truck Owner Information"), "Truck Owner Information")}`} icon={User}>
                  <LiveReportRow label={tt("common.name", "Name")} value={ownerDetails?.customer_name || "—"} />
                  <LiveReportRow label={tt("trk.owner_code_label", "Owner Code")} value={ownerDetails?.person_code || ownerDetails?.code || "—"} />
                  <LiveReportRow label={tt("common.mobile", "Mobile")} value={ownerDetails?.mobile || "—"} />
                  <LiveReportRow label="WhatsApp" value={ownerDetails?.whatsapp || "—"} />
                  <LiveReportRow label={tt("common.address", "Address")} value={ownerDetails?.address || "—"} />
                </LiveReportSection>
              )}

              {viewModalTab === "vehicle" && (
                <LiveReportSection title={`2. ${cleanTitle(tt("trk.section_truck_details", "Truck Details"), "Truck Details")}`} icon={TruckIcon}>
                  <LiveReportRow label={tt("trk.truck_no", "Truck Number")} value={form.truckNumber} />
                  <LiveReportRow label={tt("trk.chassis_no", "Chassis No")} value={form.chassisNumber} />
                  <LiveReportRow label={tt("trk.engine_no", "Engine No")} value={form.engineNumber} />
                  <LiveReportRow label={tt("trk.reg_no", "Registration No")} value={form.registrationNumber} />
                  <LiveReportRow label={tt("trk.truck_type", "Truck Type")} value={form.truckType} />
                  <LiveReportRow label={tt("trk.year", "Year")} value={form.manufacturingYear} />
                  <LiveReportRow label={tt("trk.color", "Color")} value={form.color} />
                  <LiveReportRow label={tt("trk.fuel_type", "Fuel Type")} value={form.fuelType} />
                  <LiveReportRow label={tt("trk.capacity", "Capacity (Tons)")} value={form.capacity} />
                  <LiveReportRow label={tt("tr.reg_expiry", "Reg. Expiry")} value={form.registrationExpiryDate} />
                  <LiveReportRow label={tt("tr.ins_expiry", "Insurance Expiry")} value={form.insuranceExpiryDate} />
                </LiveReportSection>
              )}

              {viewModalTab === "transporter" && (
                <LiveReportSection title={`3. ${cleanTitle(tt("trk.section_transporter", "Transporter Information"), "Transporter Information")}`} icon={Building2}>
                  {transporterDetails && (
                    <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100">{transporterDetails.customer_name}</div>
                      <LiveReportRow label={tt("trk.transporter_code_label", "Transporter Code")} value={transporterDetails.person_code || transporterDetails.code} />
                      <LiveReportRow label={tt("common.mobile", "Mobile")} value={transporterDetails.mobile} />
                      <LiveReportRow label={tt("common.whatsapp", "WhatsApp")} value={transporterDetails.whatsapp} />
                      <LiveReportRow label={tt("common.address", "Address")} value={transporterDetails.address} />
                    </div>
                  )}
                  {companyDetails && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100">{companyDetails.name}</div>
                      <LiveReportRow label={tt("trk.company_code_label", "Company Code")} value={companyDetails.company_code} />
                      <LiveReportRow label={tt("c360.legal_name", "Legal / Trade Name")} value={companyDetails.legal_name || companyDetails.trade_name} />
                      <LiveReportRow label={tt("ctm.trn_reg_no", "Registration / TRN")} value={companyRegNumber(companyDetails)} />
                      <LiveReportRow label={tt("sed.f_owner_name", "Owner Name")} value={companyDetails.owner_name} />
                      <LiveReportRow label={tt("common.phone", "Phone / Mobile")} value={companyPhone(companyDetails)} />
                      <LiveReportRow label={tt("common.email", "Email")} value={companyEmail(companyDetails)} />
                      <LiveReportRow label={tt("common.city", "City / Country")} value={[companyDetails.city_name, companyDetails.country_name].filter(Boolean).join(", ")} />
                      <LiveReportRow label={tt("common.address", "Address")} value={companyDetails.address} />
                    </div>
                  )}
                  {!transporterDetails && !companyDetails && (
                    <div className="p-2 text-center text-xs text-slate-400 italic">No transporter or company linked</div>
                  )}
                </LiveReportSection>
              )}

              {viewModalTab === "driver" && (
                <LiveReportSection title={`4. ${cleanTitle(tt("trk.section_driver", "Driver Information"), "Driver Information")}`} icon={UserCheck}>
                  <LiveReportRow
                    label={tt("trk.driver_name_label", "Driver Name")}
                    value={form.driverType === "permanent" ? driverDetails?.customer_name : form.temporaryDriverName}
                  />
                  <LiveReportRow
                    label={tt("trk.license_no", "Driving License Number")}
                    value={form.driverType === "permanent" ? (driverDetails?.license_no || form.driverLicenseNo) : form.driverLicenseNo}
                  />
                  <LiveReportRow
                    label={tt("trk.licence_expiry_label", "Licence Expiry Date")}
                    value={form.driverType === "permanent" ? (driverDetails?.license_expiry || form.driverLicenseExpiry) : form.driverLicenseExpiry}
                  />
                  <LiveReportRow
                    label={tt("common.status", "Status")}
                    badge={
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${statusBadgeClasses(form.status)}`}>
                        {statusLabel(form.status)}
                      </span>
                    }
                  />
                  {form.driverType === "permanent" ? (
                    <>
                      {driverDetails?.mobile && <LiveReportRow label={tt("common.mobile", "Primary Mobile")} value={driverDetails.mobile} />}
                      {driverDetails?.whatsapp && <LiveReportRow label={tt("crm.ftype_whatsapp", "WhatsApp")} value={driverDetails.whatsapp} />}
                      {driverDetails?.email && <LiveReportRow label={tt("tax_einv.set_f_email", "Email")} value={driverDetails.email} />}
                      {(driverDetails?.city_name || driverDetails?.city || driverDetails?.country_name || driverDetails?.country || driverDetails?.address) && (
                        <LiveReportRow
                          label={tt("common.location", "Location")}
                          value={[driverDetails.city_name || driverDetails.city, driverDetails.state_province_name || driverDetails.state, driverDetails.country_name || driverDetails.country, driverDetails.address].filter(Boolean).join(", ")}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {form.driverMobile && <LiveReportRow label={tt("common.mobile", "Primary Mobile")} value={form.driverMobile} />}
                      {contacts.filter((c) => c.value.trim().length > 0).map((c, idx) => (
                        <LiveReportRow key={c.id || idx} label={c.type} value={c.value} />
                      ))}
                      {form.addDriverLocation === "yes" && (form.driverCountry || form.driverCity || form.driverAddress) && (
                        <LiveReportRow
                          label={tt("common.location", "Location")}
                          value={[form.driverCountry, form.driverState, form.driverCity, form.driverAddress].filter(Boolean).join(", ") || "—"}
                        />
                      )}
                    </>
                  )}
                </LiveReportSection>
              )}

              {viewModalTab === "documents" && (
                <LiveReportSection title="5. Documents" icon={FileText}>
                  {documents.length === 0 ? (
                    <div className="p-2 text-center text-xs text-slate-400">
                      No documents uploaded yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {documents.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                          <span className="truncate font-medium text-slate-700 dark:text-slate-300">{d.name}</span>
                          <div className="flex items-center gap-2">
                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline">
                              View
                            </a>
                            <a href={d.url} download={d.name} className="text-xs font-bold text-blue-600 hover:underline">
                              Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </LiveReportSection>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Design preview synced with active form inputs
              </span>
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
