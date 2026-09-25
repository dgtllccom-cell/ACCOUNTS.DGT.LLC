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
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { VoiceDictateButton } from "@/components/voice-dictate-button";
import { t } from "@/lib/i18n/ui";
import { PersonPicker } from "@/components/erp/person-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { Party360Modal } from "@/features/customers/components/party-360-modal";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";
import { ReportActions } from "@/components/ui/report-actions";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { TruckAttachments } from "@/features/clearing-agent/components/truck-attachments";

/**
 * Clearing Truck Registration (Shipping & Clearing). Table: trucks.
 *
 * Table-first workflow: the Registered Trucks list — with a live Branch & User /
 * Truck / Registration / Countries summary above it — is the landing view. "New
 * Clearing Truck Registration" opens a compact entry form (left) next to a large
 * live report preview (right) that mirrors every field as it's typed. Saving
 * returns to the (now updated) list view. Same POST/PATCH/DELETE contract as
 * before against /api/erp/master-data/trucks — no new module, route, table or
 * duplicate Truck Registration system.
 *
 * Owner, Transporter and Driver all resolve through the same Customer/Person
 * master (PersonPicker) — search/select an existing person, or "+ New Owner /
 * Transporter / Driver" opens the SAME embedded Customer/Person Management form
 * (no separate Driver master), saves, and auto-selects the newly created person.
 * Registered Company resolves through the Company master (CompanyPicker). Each
 * keeps one stable id — the display name is fetched live from the master record
 * (already localized server-side), so it follows the viewer's active language
 * via the ERP's one central translation architecture.
 */

type CustomerDetails = {
  id: string;
  customer_name?: string;
  code?: string;
  person_code?: string;
  mobile?: string;
  whatsapp?: string;
  cnic?: string;
  passport?: string;
  license_no?: string;
  address?: string;
};

type CompanyDetails = {
  id: string;
  name?: string;
  company_code?: string;
  country_name?: string;
  city_name?: string;
  address?: string;
  contacts?: Array<{ type?: string; value?: string }>;
};

function companyPhone(company: CompanyDetails | null): string | undefined {
  if (!company?.contacts?.length) return undefined;
  const byType = (t: string) => company.contacts!.find((c) => (c.type || "").toLowerCase() === t)?.value;
  return byType("office") || byType("mobile") || byType("whatsapp") || company.contacts[0]?.value;
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

const EMPTY_FORM = {
  ownerId: "",
  truckNumber: "",
  truckName: "",
  truckModel: "",
  chassisNumber: "",
  engineNumber: "",
  companyId: "",
  transporterId: "",
  driverId: "",
  driverMobile: "",
  driverLicenseNo: "",
  driverLicenseExpiry: "",
  remarks: "",
  status: "active",
  registrationDate: new Date().toISOString().slice(0, 10),
  registrationNumber: "",
  truckType: "",
  make: "",
  manufacturingYear: "",
  color: "",
  fuelType: "",
  capacity: "",
  registrationExpiryDate: "",
  insuranceExpiryDate: "",
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

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

  const [nowStr] = useState(() => new Date().toLocaleString());

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

  useEffect(() => {
    if (!form.ownerId) {
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
  }, [form.ownerId]);

  useEffect(() => {
    if (!form.companyId) {
      setCompanyDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/companies/${encodeURIComponent(form.companyId)}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.data?.company) setCompanyDetails(res.data.company);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.companyId]);

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

  useEffect(() => {
    if (!form.driverId) {
      setDriverDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(form.driverId)}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.data?.customer) {
          const c: CustomerDetails = res.data.customer;
          setDriverDetails(c);
          setForm((prev) => ({
            ...prev,
            driverMobile: prev.driverMobile || c.mobile || c.whatsapp || "",
            driverLicenseNo: prev.driverLicenseNo || c.license_no || "",
          }));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.driverId]);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  function canGoNext(step: number): boolean {
    if (step === 1) {
      if (!form.ownerId) {
        setMessage({ kind: "error", text: tt("trk.required_fields_error", "Please select a Truck Owner to continue.") });
        return false;
      }
    }
    if (step === 2) {
      if (!form.truckNumber.trim() || !form.chassisNumber.trim() || !form.engineNumber.trim()) {
        setMessage({ kind: "error", text: tt("trk.required_fields_error", "Truck Number, Chassis No and Engine No are required.") });
        return false;
      }
    }
    // Step 3: Company is optional, can always proceed!
    // Step 4: Transporter is optional, can always proceed!
    setMessage(null);
    return true;
  }

  function handleNext() {
    if (!canGoNext(currentStep)) return;
    if (currentStep < 5) {
      setCurrentStep((p) => ((p + 1) as any));
    }
  }

  function handlePrev() {
    setMessage(null);
    if (currentStep > 1) {
      setCurrentStep((p) => ((p - 1) as any));
    }
  }

  function canGoToStep(targetStep: 1 | 2 | 3 | 4 | 5): boolean {
    if (targetStep <= currentStep) {
      setMessage(null);
      return true;
    }
    for (let s = currentStep; s < targetStep; s++) {
      if (!canGoNext(s)) return false;
    }
    setMessage(null);
    return true;
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setOwnerDetails(null);
    setCompanyDetails(null);
    setTransporterDetails(null);
    setDriverDetails(null);
    setCurrentStep(1);
  }

  function openNewRegistration() {
    resetForm();
    setMessage(null);
    setView("form");
  }

  function backToList() {
    resetForm();
    setMessage(null);
    setView("list");
  }

  function startEdit(row: TruckRow) {
    setEditingId(row.id);
    setCurrentStep(1);
    setForm({
      ownerId: row.owner_person_id || "",
      truckNumber: row.truck_number || "",
      truckName: row.truck_name || "",
      truckModel: row.model || "",
      chassisNumber: row.chassis_number || "",
      engineNumber: row.engine_number || "",
      companyId: row.transport_company_id || "",
      transporterId: row.transporter_person_id || "",
      driverId: row.driver_person_id || "",
      driverMobile: row.driver_mobile || "",
      driverLicenseNo: row.driver_cnic_passport || "",
      driverLicenseExpiry: row.driver_docs_expiry_date || "",
      remarks: row.notes || "",
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
      insuranceExpiryDate: row.insurance_expiry_date || "",
    });
    setMessage(null);
    setView("form");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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
        {
          title: tt("common.serial_numbers", "Serial Numbers"),
          rows: [
            { label: tt("trk.serial_global", "Global / Super Admin Serial"), value: row.super_admin_serial },
            { label: tt("trk.serial_country", "Country Serial"), value: row.country_serial },
            { label: tt("trk.serial_branch", "Main / Parent Branch Serial"), value: row.branch_serial },
            { label: tt("trk.serial_city", "Branch / City Branch Serial"), value: row.entry_serial },
          ],
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
    if (currentStep !== 5) {
      handleNext();
      return;
    }
    if (!form.ownerId || !form.truckNumber.trim() || !form.chassisNumber.trim() || !form.engineNumber.trim() || !form.driverId) {
      setMessage({ kind: "error", text: tt("trk.required_fields_error", "Please fill all mandatory fields marked with *.") });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        truck_number: form.truckNumber.trim(),
        truck_name: form.truckName.trim() || null,
        model: form.truckModel.trim() || null,
        chassis_number: form.chassisNumber.trim(),
        engine_number: form.engineNumber.trim(),
        owner_person_id: form.ownerId,
        owner_name: ownerDetails?.customer_name || null,
        owner_mobile: ownerDetails?.mobile || ownerDetails?.whatsapp || null,
        transport_company_id: form.companyId || null,
        transport_company: companyDetails?.name || null,
        transporter_person_id: form.transporterId || null,
        driver_person_id: form.driverId,
        driver_name: driverDetails?.customer_name || null,
        driver_mobile: form.driverMobile.trim() || null,
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
      resetForm();
      setView("list");
      await loadList();
      setMessage({
        kind: "success",
        text: wasEditing ? tt("trk.updated_success_msg", "Truck Record Successfully Updated!") : tt("trk.success_msg", "Truck Record Successfully Created!"),
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

  // ── KPI / summary computations — real, live, derived from the same fetched rows ──
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

  const ReportSection = ({
    title,
    icon: Icon,
    rows: sectionRows,
  }: {
    title: string;
    icon: any;
    rows: Array<{ label: string; value: string | null | undefined }>;
  }) => (
    <div className="border-b border-slate-100 py-3 last:border-0 last:pb-0 dark:border-slate-800">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {sectionRows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-2 rounded-lg bg-slate-50/70 px-2.5 py-1.5 dark:bg-slate-800/40"
          >
            <dt className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{r.label}</dt>
            <dd className="truncate text-end text-xs font-bold text-slate-800 dark:text-slate-100">{r.value || "-"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const KpiCard = ({
    title,
    icon: Icon,
    items,
  }: {
    title: string;
    icon: any;
    items: Array<{ label: string; value: string | number }>;
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-300">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <dl className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-2">
            <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{it.label}</dt>
            <dd className="text-sm font-black text-slate-900 dark:text-white">{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
      <a href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400">
        {tt("nav.dashboard", "Dashboard")}
      </a>
      <span className="text-slate-300 dark:text-slate-700">›</span>
      <span>{tt("nav.shipping_clearing", "Shipping & Clearing")}</span>
      <span className="text-slate-300 dark:text-slate-700">›</span>
      <span className="font-black text-slate-700 dark:text-slate-200">{tt("trk.registered_truck_title", "Clearing Truck Registration")}</span>
    </nav>
  );

  const listHeader = (
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
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" /> {tt("trk.new_chat_registration", "New Clearing Truck Registration")}
      </button>
    </div>
  );

  const formHeader = (
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
          <TruckIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight text-slate-900 dark:text-white">
            {editingId ? tt("trk.form_title_edit", "Edit Clearing Truck Registration") : tt("trk.new_truck_registration", "New Clearing Truck Registration")}
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {tt("trk.module_subtitle", "Truck master, owner, transporter, driver and reporting.")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={backToList}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {tt("trk.back_to_list", "Back to List")}
      </button>
    </div>
  );

  const messageBanner = message && (
    <div
      className={`rounded-2xl border p-3 text-sm font-bold ${
        message.kind === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
      }`}
    >
      {message.text}
    </div>
  );

  const kpiCards = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title={tt("trk.section_branch_user", "1. Branch & User Details")}
        icon={Users}
        items={[
          { label: tt("common.country", "Country"), value: scopeCountryLabel },
          { label: tt("common.branch_name", "Branch Name"), value: scopeBranchLabel },
          { label: tt("common.user_name", "User Name"), value: userName || "—" },
          { label: tt("common.date_time", "Date & Time"), value: nowStr },
        ]}
      />
      <KpiCard
        title={tt("trk.section_truck_summary", "2. Truck Summary")}
        icon={TruckIcon}
        items={[
          { label: tt("trk.kpi_total_trucks", "Total Trucks"), value: totalTrucks },
          { label: tt("trk.kpi_active_trucks", "Active Trucks"), value: activeTrucksCount },
          { label: tt("trk.kpi_registered_owners", "Registered Owners"), value: registeredOwnersCount },
          { label: tt("trk.kpi_assigned_drivers", "Assigned Drivers"), value: assignedDriversCount },
        ]}
      />
      <KpiCard
        title={tt("trk.section_registration_summary", "3. Registration Summary")}
        icon={ClipboardList}
        items={[
          { label: tt("common.total_records", "Total Records"), value: totalTrucks },
          { label: tt("common.active", "Active"), value: activeTrucksCount },
          { label: tt("common.pending", "Pending"), value: pendingCount },
          { label: tt("common.inactive", "Inactive"), value: inactiveCount },
        ]}
      />
      <KpiCard
        title={tt("trk.section_countries_report", "4. All Countries Report")}
        icon={Globe}
        items={
          countryBreakdown.length
            ? countryBreakdown.map((c) => ({ label: c.name, value: `${c.count} ${tt("trk.trucks_count_suffix", "trucks")}` }))
            : [{ label: tt("common.all_countries", "All Countries"), value: 0 }]
        }
      />
    </div>
  );

  const OPTIONAL_COLUMN_DEFS: Array<{ key: OptionalColumnKey; label: string }> = [
    { key: "truckName", label: tt("trk.col_truck_name", "Truck Name") },
    { key: "model", label: tt("trk.col_model", "Model") },
    { key: "company", label: tt("trk.col_company", "Company") },
    { key: "transporter", label: tt("trk.col_transporter", "Transporter") },
    { key: "mobile", label: tt("common.mobile", "Mobile") },
    { key: "branch", label: tt("trk.col_branch", "Branch") },
  ];

  const columnsToggle = (
    <div className="relative" ref={columnsRef}>
      <button
        type="button"
        onClick={() => setColumnsOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
      >
        <ColumnsIcon className="h-3.5 w-3.5" /> {tt("common.columns", "Columns")}
      </button>
      {columnsOpen && (
        <div className="absolute end-0 z-20 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {OPTIONAL_COLUMN_DEFS.map((col) => (
            <label
              key={col.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={visibleCols[col.key]}
                onChange={(e) => setVisibleCols((prev) => ({ ...prev, [col.key]: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const paginationBar = (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-1 pt-3 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {filteredRows.length === 0
          ? tt("trk.no_trucks_found", "No registered trucks found.")
          : tt("trk.showing_records", "Showing {from} to {to} of {total} records")
              .replace("{from}", String(pageStart + 1))
              .replace("{to}", String(Math.min(pageStart + pageSize, filteredRows.length)))
              .replace("{total}", String(filteredRows.length))}
      </div>
      <div className="flex items-center gap-3">
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="h-7 rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] font-bold outline-none dark:border-slate-700 dark:bg-slate-950"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} {tt("trk.per_page_suffix", "/ page")}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={clampedPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
          <span className="min-w-[2.5rem] text-center font-black text-slate-700 dark:text-slate-200">
            {clampedPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={clampedPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
          >
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );

  const trucksTable = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
            <ListChecks className="h-4 w-4 text-blue-600" /> {tt("trk.list_title", "Registered Trucks")}
          </h2>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {tt("trk.list_subtitle", "All registered trucks and master records")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tt("trk.search_trucks_ph", "Search trucks...")}
              className="h-8 w-56 rounded-lg border border-slate-200 bg-white ps-8 pe-3 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">{tt("common.filter", "Filter")}: {tt("common.status", "Status")}</option>
            <option value="active">{tt("common.active", "Active")}</option>
            <option value="inactive">{tt("common.inactive", "Inactive")}</option>
          </select>
          {columnsToggle}
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
              { key: "owner", label: tt("trk.col_owner", "Owner Name") },
              { key: "truck_no", label: tt("trk.col_truck_no", "Truck No.") },
              { key: "truck_name", label: tt("trk.col_truck_name", "Truck Name") },
              { key: "model", label: tt("trk.col_model", "Model") },
              { key: "company", label: tt("trk.col_company", "Company") },
              { key: "transporter", label: tt("trk.col_transporter", "Transporter") },
              { key: "driver", label: tt("trk.col_driver", "Driver") },
              { key: "mobile", label: tt("common.mobile", "Mobile") },
              { key: "status", label: tt("common.status", "Status") },
              { key: "reg_date", label: tt("trk.col_reg_date", "Reg. Date") },
              { key: "branch", label: tt("trk.col_branch", "Branch") },
              { key: "serial", label: tt("trk.col_serials", "Serials") },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs">
          <thead className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-2 py-2 text-start">#</th>
              <th className="px-2 py-2 text-start">{tt("trk.col_truck_no", "Truck No.")}</th>
              <th className="px-2 py-2 text-start">{tt("trk.col_owner", "Owner Name")}</th>
              {visibleCols.truckName && <th className="px-2 py-2 text-start">{tt("trk.col_truck_name", "Truck Name")}</th>}
              {visibleCols.model && <th className="px-2 py-2 text-start">{tt("trk.col_model", "Model")}</th>}
              {visibleCols.company && <th className="px-2 py-2 text-start">{tt("trk.col_company", "Company")}</th>}
              {visibleCols.transporter && <th className="px-2 py-2 text-start">{tt("trk.col_transporter", "Transporter")}</th>}
              <th className="px-2 py-2 text-start">{tt("trk.col_driver", "Driver")}</th>
              {visibleCols.mobile && <th className="px-2 py-2 text-start">{tt("common.mobile", "Mobile")}</th>}
              {visibleCols.branch && <th className="px-2 py-2 text-start">{tt("trk.col_branch", "Branch")}</th>}
              <th className="px-2 py-2 text-start">{tt("common.status", "Status")}</th>
              <th className="px-2 py-2 text-end">{tt("common.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loadingList ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  {tt("trk.no_trucks_found", "No registered trucks found.")}
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-2 py-2 font-semibold text-slate-500">{pageStart + idx + 1}</td>
                  <td className="px-2 py-2 font-mono font-bold">{r.truck_number}</td>
                  <td className="px-2 py-2 font-bold text-slate-800 dark:text-slate-100">{r.owner_display_name || "-"}</td>
                  {visibleCols.truckName && <td className="px-2 py-2">{r.truck_name || "-"}</td>}
                  {visibleCols.model && <td className="px-2 py-2">{r.model || "-"}</td>}
                  {visibleCols.company && <td className="px-2 py-2">{r.company_display_name || "-"}</td>}
                  {visibleCols.transporter && <td className="px-2 py-2">{r.transporter_display_name || "-"}</td>}
                  <td className="px-2 py-2">{r.driver_display_name || "-"}</td>
                  {visibleCols.mobile && (
                    <td className="px-2 py-2 font-mono" dir="ltr">
                      {r.driver_mobile || "-"}
                    </td>
                  )}
                  {visibleCols.branch && <td className="px-2 py-2">{r.branch_display_name || "-"}</td>}
                  <td className="px-2 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClasses(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end">
                      <UnifiedActionMenu
                        onView={() => handleView(r)}
                        onEdit={() => startEdit(r)}
                        onPrint={() => handleView(r, { autoPrint: true })}
                        onDelete={() => handleDelete(r.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginationBar}
    </div>
  );

  return (
    <div dir={dir} className="space-y-4">
      {view === "list" ? (
        <>
          {listHeader}
          {breadcrumb}
          {messageBanner}
          {kpiCards}
          {trucksTable}
        </>
      ) : (
        <>
          {formHeader}
          {messageBanner}

          {/* Stepper Progress Bar */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { step: 1, label: "Step 1", name: tt("trk.section_owner", "Owner Info"), icon: User, required: true },
                { step: 2, label: "Step 2", name: tt("trk.section_truck_details", "Truck & Specs"), icon: TruckIcon, required: true },
                { step: 3, label: "Step 3", name: tt("trk.section_company", "Company"), badge: "Optional", icon: Building2, required: false },
                { step: 4, label: "Step 4", name: tt("trk.section_transporter", "Transporter"), badge: "Optional", icon: TruckIcon, required: false },
                { step: 5, label: "Step 5", name: tt("trk.section_driver", "Driver & Finalize"), icon: UserCheck, required: true },
              ].map((s) => {
                const isActive = currentStep === s.step;
                const isPassed = currentStep > s.step;
                const StepIcon = s.icon;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      if (canGoToStep(s.step as any)) setCurrentStep(s.step as any);
                    }}
                    className={`group relative flex items-center gap-3 rounded-2xl border p-3 text-start transition-all ${
                      isActive
                        ? "border-blue-500 bg-blue-50/70 shadow-sm shadow-blue-500/10 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40"
                        : isPassed
                        ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                        : "border-slate-200/70 bg-slate-50/50 hover:bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                          : isPassed
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {isPassed ? <Check className="h-5 w-5" /> : <StepIcon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider ${
                            isActive ? "text-blue-700 dark:text-blue-300" : isPassed ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {s.label}
                        </span>
                        {s.badge && (
                          <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {s.badge}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                        {s.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left column: active step entry form */}
            <div className="space-y-4 lg:col-span-7">
              {/* STEP 1: Owner Information */}
              {currentStep === 1 && (
                <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-white">
                          Step 1: {tt("trk.section_owner", "Truck Owner Information")}
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Select or register the owner of this vehicle
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      Step 1 of 5
                    </span>
                  </div>

                  <div className="space-y-4">
                    <PersonPicker
                      label={tt("trk.truck_owner_name_label", "Truck Owner Name *")}
                      value={form.ownerId}
                      onValueChange={(id) => setForm((p) => ({ ...p, ownerId: id }))}
                      placeholder={tt("trk.search_owner_ph", "Search truck owner...")}
                      lang={activeLang}
                      createLabel={tt("trk.new_truck_owner", "+ New Truck Owner")}
                    />

                    {form.ownerId && (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 dark:text-white">
                              {ownerDetails?.customer_name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {ownerDetails?.person_code ? `${tt("trk.owner_code_label", "Owner Code")}: ${ownerDetails.person_code}` : ""}
                              {ownerDetails?.mobile ? ` • ${ownerDetails.mobile}` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setParty360({ customerId: form.ownerId, name: ownerDetails?.customer_name || "" })}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                          >
                            <Eye className="h-3.5 w-3.5" /> {tt("trk.view_owner_details", "View Owner Details")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={backToList}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <X className="h-4 w-4" /> {tt("common.cancel", "Cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700"
                    >
                      Next Step <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </button>
                  </div>
                </section>
              )}

              {/* STEP 2: Truck Details & Vehicle Specifications */}
              {currentStep === 2 && (
                <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <TruckIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-white">
                          Step 2: {tt("trk.section_truck_details", "Truck Details & Specifications")}
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Enter identification numbers and physical specifications
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      Step 2 of 5
                    </span>
                  </div>

                  {/* 2a. Basic Identifiers */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {tt("trk.section_truck_details", "2. Truck Details")}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.truck_no", "Truck Number *")}</span>
                        <input
                          required
                          value={form.truckNumber}
                          onChange={(e) => setForm((p) => ({ ...p, truckNumber: e.target.value }))}
                          placeholder="e.g. TRK-8891"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.truck_name_label", "Truck Name")}</span>
                        <input
                          value={form.truckName}
                          onChange={(e) => setForm((p) => ({ ...p, truckName: e.target.value }))}
                          placeholder="e.g. Dammam Express"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.model", "Model *")}</span>
                        <input
                          value={form.truckModel}
                          onChange={(e) => setForm((p) => ({ ...p, truckModel: e.target.value }))}
                          placeholder={tt("trk.ph_model", "Enter model")}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.chassis_no", "Chassis No *")}</span>
                        <input
                          required
                          value={form.chassisNumber}
                          onChange={(e) => setForm((p) => ({ ...p, chassisNumber: e.target.value }))}
                          placeholder={tt("trk.ph_chassis_no", "Enter chassis number")}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-xs sm:col-span-2">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.engine_no", "Engine No *")}</span>
                        <input
                          required
                          value={form.engineNumber}
                          onChange={(e) => setForm((p) => ({ ...p, engineNumber: e.target.value }))}
                          placeholder={tt("trk.ph_engine_no", "Enter engine number")}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    </div>
                  </div>

                  {/* 2b. Vehicle Specifications */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {tt("com.vehicle_specifications", "Vehicle Specifications")}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.reg_no", "Registration No")}</span>
                        <input
                          value={form.registrationNumber}
                          onChange={(e) => setForm((p) => ({ ...p, registrationNumber: e.target.value }))}
                          placeholder="e.g. 1234-XYZ"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.truck_type", "Truck Type")}</span>
                        <select
                          value={form.truckType}
                          onChange={(e) => setForm((p) => ({ ...p, truckType: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="" />
                          {truckTypeOptions.map((o) => (
                            <option key={o.id} value={o.code}>{optionLabel(o)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.make", "Make")}</span>
                        <select
                          value={form.make}
                          onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="" />
                          {makeOptions.map((o) => (
                            <option key={o.id} value={o.code}>{optionLabel(o)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.year", "Year")}</span>
                        <input
                          type="number"
                          min={1980}
                          max={new Date().getFullYear() + 1}
                          value={form.manufacturingYear}
                          onChange={(e) => setForm((p) => ({ ...p, manufacturingYear: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.color", "Color")}</span>
                        <select
                          value={form.color}
                          onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="" />
                          {colorOptions.map((o) => (
                            <option key={o.id} value={o.code}>{optionLabel(o)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.fuel_type", "Fuel Type")}</span>
                        <select
                          value={form.fuelType}
                          onChange={(e) => setForm((p) => ({ ...p, fuelType: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="" />
                          {fuelTypeOptions.map((o) => (
                            <option key={o.id} value={o.code}>{optionLabel(o)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs sm:col-span-2">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.capacity", "Capacity (Tons)")}</span>
                        <input
                          value={form.capacity}
                          onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                          placeholder="e.g. 25"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("tr.reg_expiry", "Reg. Expiry")}</span>
                        <input
                          type="date"
                          value={form.registrationExpiryDate}
                          onChange={(e) => setForm((p) => ({ ...p, registrationExpiryDate: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{tt("tr.ins_expiry", "Insurance Expiry")}</span>
                        <input
                          type="date"
                          value={form.insuranceExpiryDate}
                          onChange={(e) => setForm((p) => ({ ...p, insuranceExpiryDate: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700"
                    >
                      Next Step <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </button>
                  </div>
                </section>
              )}

              {/* STEP 3: Registered Company (Optional) */}
              {currentStep === 3 && (
                <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-black text-slate-900 dark:text-white">
                            Step 3: {tt("trk.section_company", "Registered Company")}
                          </h2>
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60">
                            Optional
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Optional registration if the truck is registered under a transport company
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      Step 3 of 5
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                      <p className="font-semibold leading-relaxed">
                        Company registration is not mandatory. If this truck is owned independently or not linked to any transport company, you can leave this empty and click Next or Skip.
                      </p>
                    </div>

                    <CompanyPicker
                      label={tt("trk.company_name_label", "Company Name (Optional)")}
                      value={form.companyId}
                      onValueChange={(id) => setForm((p) => ({ ...p, companyId: id }))}
                      placeholder={tt("trk.search_company_ph", "Search company (or leave blank)...")}
                    />

                    {form.companyId && (
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{companyDetails?.name}</span>
                          {companyDetails?.company_code && (
                            <span className="ms-2 text-slate-500">({companyDetails.company_code})</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, companyId: "" }))}
                          className="text-xs font-bold text-rose-600 hover:underline dark:text-rose-400"
                        >
                          {tt("common.clear", "Clear")}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700"
                    >
                      {form.companyId
                        ? "Next Step"
                        : "Skip / Next Step"} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </button>
                  </div>
                </section>
              )}

              {/* STEP 4: Transporter Information (Optional) */}
              {currentStep === 4 && (
                <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <TruckIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-black text-slate-900 dark:text-white">
                            Step 4: {tt("trk.section_transporter", "Transporter Information")}
                          </h2>
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60">
                            Optional
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Optional transporter person or dispatch party
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      Step 4 of 5
                    </span>
                  </div>

                  <div className="space-y-4">
                    <PersonPicker
                      label={tt("trk.transporter_name_label", "Transporter Name (Optional)")}
                      value={form.transporterId}
                      onValueChange={(id) => setForm((p) => ({ ...p, transporterId: id }))}
                      placeholder={tt("trk.search_transporter_ph", "Search transporter (or leave blank)...")}
                      lang={activeLang}
                      createLabel={tt("trk.new_transporter", "+ New Transporter")}
                    />

                    {form.transporterId && (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 dark:text-white">
                              {transporterDetails?.customer_name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {transporterDetails?.person_code ? `${tt("trk.transporter_code_label", "Transporter Code")}: ${transporterDetails.person_code}` : ""}
                              {transporterDetails?.mobile ? ` • ${transporterDetails.mobile}` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setParty360({ customerId: form.transporterId, name: transporterDetails?.customer_name || "" })}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                          >
                            <Eye className="h-3.5 w-3.5" /> {tt("trk.view_transporter_details", "View Transporter Details")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700"
                    >
                      Next Step <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </button>
                  </div>
                </section>
              )}

              {/* STEP 5: Driver Information & Finalization */}
              {currentStep === 5 && (
                <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-white">
                          Step 5: {tt("trk.section_driver", "Driver Information & Finalization")}
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Assign driver, add remarks and complete registration
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Step 5 of 5
                    </span>
                  </div>

                  {/* Driver fields */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {tt("trk.section_driver", "5. Driver Information")}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <PersonPicker
                            label={tt("trk.driver_name_label", "Driver Name *")}
                            value={form.driverId}
                            onValueChange={(id) => setForm((p) => ({ ...p, driverId: id }))}
                            placeholder={tt("trk.search_driver_ph", "Search driver...")}
                            lang={activeLang}
                            createLabel={tt("trk.new_driver", "+ New Driver")}
                          />
                        </div>
                        {form.driverId && (
                          <button
                            type="button"
                            onClick={() => setParty360({ customerId: form.driverId, name: driverDetails?.customer_name || "" })}
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
                            title={tt("trk.view_driver_details", "View Driver Details")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-400">{tt("common.mobile", "Mobile")}</span>
                          <input
                            value={form.driverMobile}
                            onChange={(e) => setForm((p) => ({ ...p, driverMobile: e.target.value }))}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.license_no", "Driving License Number")}</span>
                          <input
                            value={form.driverLicenseNo}
                            onChange={(e) => setForm((p) => ({ ...p, driverLicenseNo: e.target.value }))}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                        <label className="space-y-1 text-xs sm:col-span-2">
                          <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.licence_expiry_label", "Licence Expiry Date")}</span>
                          <input
                            type="date"
                            value={form.driverLicenseExpiry}
                            onChange={(e) => setForm((p) => ({ ...p, driverLicenseExpiry: e.target.value }))}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Additional info */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {tt("trk.section_additional", "6. Additional Information")}
                    </h3>
                    <div className="space-y-3">
                      <label className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-600 dark:text-slate-400">{tt("trk.remarks", "Remarks (Optional)")}</span>
                          <VoiceDictateButton
                            context="clearing"
                            lang={activeLang}
                            value={form.remarks}
                            onChange={(next) => setForm((p) => ({ ...p, remarks: next }))}
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={form.remarks}
                          onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-400">{tt("common.status", "Status")}</span>
                          <select
                            value={form.status}
                            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                          >
                            <option value="active">{tt("common.active", "Active")}</option>
                            <option value="inactive">{tt("common.inactive", "Inactive")}</option>
                            <option value="suspended">{tt("trk.badge_pending", "Pending")}</option>
                            <option value="expired">{tt("trk.badge_completed", "Completed")}</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-400">{tt("common.registration_date", "Registration Date")}</span>
                          <input
                            type="date"
                            value={form.registrationDate}
                            onChange={(e) => setForm((p) => ({ ...p, registrationDate: e.target.value }))}
                            disabled
                            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none dark:border-slate-700 dark:bg-slate-800"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {editingId ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                      <TruckAttachments entityId={editingId} entityKey="truck" />
                    </div>
                  ) : null}

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> Back
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={backToList}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      >
                        <X className="h-4 w-4" /> {tt("common.cancel", "Cancel")}
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {tt("common.save", "Save")}
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Right column: live report */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-blue-100 bg-white shadow-md dark:border-blue-950/60 dark:bg-slate-900 lg:sticky lg:top-6">
                <div className="flex items-center justify-between gap-3 rounded-t-3xl border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4 dark:border-slate-800 dark:from-blue-950/40 dark:to-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">{tt("trk.live_report_title", "Live Truck Report")}</h3>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {tt("trk.live_report_sub", "Registration preview — updates as you type")}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusBadgeClasses(form.status)}`}>
                    {statusLabel(form.status)}
                  </span>
                </div>

                <div className="px-5 py-4">
                  <div className="mb-3 rounded-2xl bg-slate-900 px-4 py-3.5 text-white dark:bg-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">{tt("trk.col_truck_no", "Truck No.")}</div>
                    <div className="truncate font-mono text-2xl font-black">{form.truckNumber || "—"}</div>
                  </div>

                  <ReportSection
                    title={tt("trk.section_owner", "1. Truck Owner Information")}
                    icon={User}
                    rows={[
                      { label: tt("common.name", "Name"), value: ownerDetails?.customer_name },
                      { label: tt("trk.owner_code_label", "Owner Code"), value: ownerDetails?.person_code },
                      { label: tt("common.mobile", "Mobile"), value: ownerDetails?.mobile || ownerDetails?.whatsapp },
                      { label: tt("common.address", "Address"), value: ownerDetails?.address },
                    ]}
                  />

                  <ReportSection
                    title={tt("trk.section_truck_details", "2. Truck Details")}
                    icon={TruckIcon}
                    rows={[
                      { label: tt("trk.truck_name_label", "Truck Name"), value: form.truckName },
                      { label: tt("trk.model", "Model *").replace(" *", ""), value: form.truckModel },
                      { label: tt("trk.chassis_no", "Chassis No *").replace(" *", ""), value: form.chassisNumber },
                      { label: tt("trk.engine_no", "Engine No"), value: form.engineNumber },
                    ]}
                  />

                  <ReportSection
                    title={tt("com.vehicle_specifications", "Vehicle Specifications")}
                    icon={ListChecks}
                    rows={[
                      { label: tt("trk.reg_no", "Registration No *").replace(" *", ""), value: form.registrationNumber },
                      { label: tt("trk.truck_type", "Truck Type *").replace(" *", ""), value: truckTypeOptions.find((o) => o.code === form.truckType) ? optionLabel(truckTypeOptions.find((o) => o.code === form.truckType)!) : form.truckType },
                      { label: tt("trk.make", "Make *").replace(" *", ""), value: makeOptions.find((o) => o.code === form.make) ? optionLabel(makeOptions.find((o) => o.code === form.make)!) : form.make },
                      { label: tt("trk.year", "Year *").replace(" *", ""), value: form.manufacturingYear },
                      { label: tt("trk.color", "Color"), value: colorOptions.find((o) => o.code === form.color) ? optionLabel(colorOptions.find((o) => o.code === form.color)!) : form.color },
                      { label: tt("trk.fuel_type", "Fuel Type"), value: fuelTypeOptions.find((o) => o.code === form.fuelType) ? optionLabel(fuelTypeOptions.find((o) => o.code === form.fuelType)!) : form.fuelType },
                      { label: tt("trk.capacity", "Capacity (Tons) *").replace(" *", ""), value: form.capacity },
                      { label: tt("tr.reg_expiry", "Reg. Expiry"), value: form.registrationExpiryDate },
                      { label: tt("tr.ins_expiry", "Insurance Expiry"), value: form.insuranceExpiryDate },
                    ]}
                  />

                  <ReportSection
                    title={tt("trk.section_company", "3. Registered Company")}
                    icon={Building2}
                    rows={[
                      { label: tt("common.name", "Name"), value: companyDetails?.name },
                      { label: tt("trk.company_code_label", "Company Code"), value: companyDetails?.company_code },
                      { label: tt("common.country", "Country"), value: companyDetails?.country_name },
                      { label: tt("common.city", "City"), value: companyDetails?.city_name },
                      { label: tt("common.phone", "Phone"), value: companyPhone(companyDetails) },
                    ]}
                  />

                  <ReportSection
                    title={tt("trk.section_transporter", "4. Transporter Information")}
                    icon={TruckIcon}
                    rows={[
                      { label: tt("common.name", "Name"), value: transporterDetails?.customer_name },
                      { label: tt("trk.transporter_code_label", "Transporter Code"), value: transporterDetails?.person_code },
                      { label: tt("common.contact", "Contact"), value: transporterDetails?.mobile || transporterDetails?.whatsapp },
                      { label: tt("common.address", "Address"), value: transporterDetails?.address },
                    ]}
                  />

                  <ReportSection
                    title={tt("trk.section_driver", "5. Driver Information")}
                    icon={UserCheck}
                    rows={[
                      { label: tt("common.name", "Name"), value: driverDetails?.customer_name },
                      { label: tt("common.mobile", "Mobile"), value: form.driverMobile },
                      { label: tt("trk.lbl_license", "License No"), value: form.driverLicenseNo },
                      { label: tt("trk.licence_expiry_label", "Licence Expiry Date"), value: form.driverLicenseExpiry },
                      { label: tt("common.address", "Address"), value: driverDetails?.address },
                    ]}
                  />

                  <ReportSection
                    title={tt("trk.section_additional", "6. Additional Information")}
                    icon={ListChecks}
                    rows={[
                      { label: tt("common.registration_date", "Registration Date"), value: form.registrationDate },
                      { label: tt("trk.remarks", "Remarks (Optional)").replace(" (Optional)", ""), value: form.remarks },
                    ]}
                  />
                </div>
              </div>
            </div>
          </form>
        </>
      )}

      {party360 && (
        <Party360Modal customerId={party360.customerId} name={party360.name} lang={activeLang} onClose={() => setParty360(null)} />
      )}
    </div>
  );
}
