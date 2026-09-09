"use client";

import { useEffect, useMemo, useState } from "react";
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
  Pencil,
  Trash2,
  ListChecks,
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

/**
 * Registered Truck (Shipping & Clearing). Table: trucks.
 *
 * Redesigned to reuse the ERP's real masters instead of the previous 5-step wizard's own
 * per-language name-snapshot fields (owner_name_en/ur/ar/fa/ps, etc.) — those columns are left
 * untouched for any historical rows but this form no longer writes to them. Owner, Transporter
 * and Driver all resolve through the same Customer/Person master (PersonPicker); Registered
 * Company resolves through the Company master (CompanyPicker). Each keeps one stable id — the
 * display name is fetched live from the master record, so it already follows the viewer's
 * active language via the ERP's one central translation architecture, with no duplicate name
 * columns per language.
 */

type CustomerDetails = {
  id: string;
  customer_name?: string;
  code?: string;
  customer_code?: string;
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
  phone?: string;
  address?: string;
};

type TruckRow = {
  id: string;
  truck_number: string;
  truck_name: string | null;
  model: string | null;
  chassis_number: string | null;
  engine_number: string | null;
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
};

export function TruckRecreationWizard({ lang: initialLang = "en" }: { lang?: SupportedLanguage }) {
  const globalLang = useActiveLanguage();
  const activeLang = (globalLang || initialLang) as SupportedLanguage;
  const dir = getLanguageDirection(activeLang);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);
  const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);

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

  async function loadList() {
    setLoadingList(true);
    try {
      const res = await fetch("/api/erp/master-data/trucks");
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
  }, []);

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
        if (res?.customer) setOwnerDetails(res.customer);
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
        if (res?.company) setCompanyDetails(res.company);
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
        if (res?.customer) setTransporterDetails(res.customer);
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
        if (res?.customer) {
          const c: CustomerDetails = res.customer;
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

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setOwnerDetails(null);
    setCompanyDetails(null);
    setTransporterDetails(null);
    setDriverDetails(null);
  }

  function startEdit(row: TruckRow) {
    setEditingId(row.id);
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
    });
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

  function handleView(row: TruckRow) {
    openMasterProfileReportWindow({
      lang: activeLang,
      title: tt("trk.registered_truck_title", "Registered Truck"),
      subtitle: tt("trk.module_subtitle", "Shipping & Clearing Management"),
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
          title: tt("trk.section_company", "3. Registered Company (Mandatory)"),
          rows: [{ label: tt("trk.company_name_label", "Company Name *").replace(" *", ""), value: row.company_display_name }],
        },
        {
          title: tt("trk.section_transporter", "4. Transporter Information"),
          rows: [{ label: tt("trk.transporter_name_label", "Transporter Name *").replace(" *", ""), value: row.transporter_display_name }],
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
      autoPrint: false,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ownerId || !form.truckNumber.trim() || !form.chassisNumber.trim() || !form.engineNumber.trim() || !form.companyId || !form.driverId) {
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
        transport_company_id: form.companyId,
        transport_company: companyDetails?.name || null,
        transporter_person_id: form.transporterId || null,
        driver_person_id: form.driverId,
        driver_name: driverDetails?.customer_name || null,
        driver_mobile: form.driverMobile.trim() || null,
        driver_cnic_passport: form.driverLicenseNo.trim() || null,
        driver_docs_expiry_date: form.driverLicenseExpiry || null,
        notes: form.remarks.trim() || null,
        status: form.status,
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

      setMessage({
        kind: "success",
        text: editingId ? tt("trk.updated_success_msg", "Truck Record Successfully Updated!") : tt("trk.success_msg", "Truck Record Successfully Created!"),
      });
      resetForm();
      await loadList();
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

  const DetailCard = ({ title, icon: Icon, data }: { title: string; icon: any; data: Array<{ label: string; value: string | null | undefined }> }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <dl className="space-y-1.5 text-xs">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-slate-500 dark:text-slate-400">{d.label} :</dt>
            <dd className="text-end font-bold text-slate-800 dark:text-slate-100">{d.value || "-"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div dir={dir} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <TruckIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {editingId ? tt("common.edit", "Edit") : tt("trk.registered_truck_title", "Registered Truck")}
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{tt("trk.module_subtitle", "Shipping & Clearing Management")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            {editingId ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editingId ? tt("common.cancel", "Cancel") : tt("trk.new_truck_registration", "New Truck Registration")}
          </button>
        </div>
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column: form sections */}
        <div className="space-y-4 lg:col-span-2">
          {/* 1. Owner */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
              <User className="h-4 w-4" /> {tt("trk.section_owner", "1. Truck Owner Information")}
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <PersonPicker
                  label={tt("trk.truck_owner_name_label", "Truck Owner Name *")}
                  value={form.ownerId}
                  onValueChange={(id) => setForm((p) => ({ ...p, ownerId: id }))}
                  placeholder={tt("trk.search_owner_ph", "Search truck owner...")}
                  lang={activeLang}
                />
              </div>
              {form.ownerId && (
                <button
                  type="button"
                  onClick={() => setParty360({ customerId: form.ownerId, name: ownerDetails?.customer_name || "" })}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  <Eye className="h-3.5 w-3.5" /> {tt("trk.view_owner_details", "View Owner Details")}
                </button>
              )}
            </div>
          </section>

          {/* 2. Truck Details */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
              <TruckIcon className="h-4 w-4" /> {tt("trk.section_truck_details", "2. Truck Details")}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("trk.truck_no", "Truck Number *")}</span>
                <input
                  required
                  value={form.truckNumber}
                  onChange={(e) => setForm((p) => ({ ...p, truckNumber: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("trk.truck_name_label", "Truck Name")}</span>
                <input
                  value={form.truckName}
                  onChange={(e) => setForm((p) => ({ ...p, truckName: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("trk.model", "Model *")}</span>
                <input
                  value={form.truckModel}
                  onChange={(e) => setForm((p) => ({ ...p, truckModel: e.target.value }))}
                  placeholder={tt("trk.ph_model", "Enter model")}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("trk.chassis_no", "Chassis No *")}</span>
                <input
                  required
                  value={form.chassisNumber}
                  onChange={(e) => setForm((p) => ({ ...p, chassisNumber: e.target.value }))}
                  placeholder={tt("trk.ph_chassis_no", "Enter chassis number")}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("trk.engine_no", "Engine No")} *</span>
                <input
                  required
                  value={form.engineNumber}
                  onChange={(e) => setForm((p) => ({ ...p, engineNumber: e.target.value }))}
                  placeholder={tt("trk.ph_engine_no", "Enter engine number")}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
          </section>

          {/* 3. Company */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
              <Building2 className="h-4 w-4" /> {tt("trk.section_company", "3. Registered Company (Mandatory)")}
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <CompanyPicker
                  label={tt("trk.company_name_label", "Company Name *")}
                  value={form.companyId}
                  onValueChange={(id) => setForm((p) => ({ ...p, companyId: id }))}
                  placeholder={tt("trk.search_company_ph", "Search company...")}
                />
              </div>
            </div>
          </section>

          {/* 4. Transporter */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
              <TruckIcon className="h-4 w-4" /> {tt("trk.section_transporter", "4. Transporter Information")}
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <PersonPicker
                  label={tt("trk.transporter_name_label", "Transporter Name *")}
                  value={form.transporterId}
                  onValueChange={(id) => setForm((p) => ({ ...p, transporterId: id }))}
                  placeholder={tt("trk.search_transporter_ph", "Search transporter...")}
                  lang={activeLang}
                />
              </div>
              {form.transporterId && (
                <button
                  type="button"
                  onClick={() => setParty360({ customerId: form.transporterId, name: transporterDetails?.customer_name || "" })}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  <Eye className="h-3.5 w-3.5" /> {tt("trk.view_transporter_details", "View Transporter Details")}
                </button>
              )}
            </div>
          </section>

          {/* 5. Driver */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
              <UserCheck className="h-4 w-4" /> {tt("trk.section_driver", "5. Driver Information")}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-end gap-2 lg:col-span-2">
                <div className="flex-1">
                  <PersonPicker
                    label={tt("trk.driver_name_label", "Driver Name *")}
                    value={form.driverId}
                    onValueChange={(id) => setForm((p) => ({ ...p, driverId: id }))}
                    placeholder={tt("trk.search_driver_ph", "Search driver...")}
                    lang={activeLang}
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
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("common.mobile", "Mobile")}</span>
                <input
                  value={form.driverMobile}
                  onChange={(e) => setForm((p) => ({ ...p, driverMobile: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("trk.license_no", "Driving License Number")}</span>
                <input
                  value={form.driverLicenseNo}
                  onChange={(e) => setForm((p) => ({ ...p, driverLicenseNo: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("trk.licence_expiry_label", "Licence Expiry Date")}</span>
                <input
                  type="date"
                  value={form.driverLicenseExpiry}
                  onChange={(e) => setForm((p) => ({ ...p, driverLicenseExpiry: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
          </section>

          {/* 6. Additional Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
              <ListChecks className="h-4 w-4" /> {tt("trk.section_additional", "6. Additional Information")}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs sm:col-span-3">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("trk.remarks", "Remarks (Optional)")}</span>
                <textarea
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("common.status", "Status")}</span>
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
                <span className="font-bold text-slate-500 dark:text-slate-400">{tt("common.registration_date", "Registration Date")}</span>
                <input
                  type="date"
                  value={form.registrationDate}
                  onChange={(e) => setForm((p) => ({ ...p, registrationDate: e.target.value }))}
                  disabled
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {tt("common.save", "Save")}
              </button>
              {!editingId && (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  <Plus className="h-4 w-4" /> {tt("common.save_and_new", "Save & New")}
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <X className="h-4 w-4" /> {tt("common.cancel", "Cancel")}
              </button>
            </div>
          </section>
        </div>

        {/* Right column: live detail cards */}
        <div className="space-y-4">
          {form.ownerId && (
            <DetailCard
              title={tt("trk.owner_details_card", "Truck Owner Details")}
              icon={User}
              data={[
                { label: tt("common.name", "Name"), value: ownerDetails?.customer_name },
                { label: tt("trk.owner_code_label", "Owner Code"), value: ownerDetails?.customer_code || ownerDetails?.code },
                { label: tt("common.mobile", "Mobile"), value: ownerDetails?.mobile || ownerDetails?.whatsapp },
                { label: tt("common.address", "Address"), value: ownerDetails?.address },
              ]}
            />
          )}
          {form.companyId && (
            <DetailCard
              title={tt("trk.company_details_card", "Company Details")}
              icon={Building2}
              data={[
                { label: tt("common.name", "Name"), value: companyDetails?.name },
                { label: tt("trk.company_code_label", "Company Code"), value: companyDetails?.company_code },
                { label: tt("common.country", "Country"), value: companyDetails?.country_name },
                { label: tt("common.city", "City"), value: companyDetails?.city_name },
                { label: tt("common.phone", "Phone"), value: companyDetails?.phone },
              ]}
            />
          )}
          {form.transporterId && (
            <DetailCard
              title={tt("trk.transporter_details_card", "Transporter Details")}
              icon={TruckIcon}
              data={[
                { label: tt("common.name", "Name"), value: transporterDetails?.customer_name },
                { label: tt("trk.transporter_code_label", "Transporter Code"), value: transporterDetails?.customer_code || transporterDetails?.code },
                { label: tt("common.contact", "Contact"), value: transporterDetails?.mobile || transporterDetails?.whatsapp },
                { label: tt("common.address", "Address"), value: transporterDetails?.address },
              ]}
            />
          )}
          {form.driverId && (
            <DetailCard
              title={tt("trk.driver_details_card", "Driver Details")}
              icon={UserCheck}
              data={[
                { label: tt("common.name", "Name"), value: driverDetails?.customer_name },
                { label: tt("common.mobile", "Mobile"), value: form.driverMobile },
                { label: tt("trk.lbl_license", "License No"), value: form.driverLicenseNo },
                { label: tt("trk.licence_expiry_label", "Licence Expiry Date"), value: form.driverLicenseExpiry },
                { label: tt("common.address", "Address"), value: driverDetails?.address },
              ]}
            />
          )}
        </div>
      </form>

      {/* Registered Trucks List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
            <ListChecks className="h-4 w-4 text-blue-600" /> {tt("trk.list_title", "Registered Trucks List")}
          </h2>
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
            <ReportActions
              title={tt("trk.list_title", "Registered Trucks List")}
              lang={activeLang}
              rows={filteredRows.map((r) => ({
                owner: r.owner_display_name || "-",
                truck_no: r.truck_number,
                truck_name: r.truck_name || "-",
                model: r.model || "-",
                company: r.company_display_name || "-",
                transporter: r.transporter_display_name || "-",
                driver: r.driver_display_name || "-",
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
                <th className="px-2 py-2 text-start">{tt("trk.col_owner", "Owner Name")}</th>
                <th className="px-2 py-2 text-start">{tt("trk.col_truck_no", "Truck No.")}</th>
                <th className="px-2 py-2 text-start">{tt("trk.col_truck_name", "Truck Name")}</th>
                <th className="px-2 py-2 text-start">{tt("trk.col_model", "Model")}</th>
                <th className="px-2 py-2 text-start">{tt("trk.col_company", "Company")}</th>
                <th className="px-2 py-2 text-start">{tt("trk.col_transporter", "Transporter")}</th>
                <th className="px-2 py-2 text-start">{tt("trk.col_driver", "Driver")}</th>
                <th className="px-2 py-2 text-start">{tt("common.status", "Status")}</th>
                <th className="px-2 py-2 text-start">{tt("trk.col_reg_date", "Reg. Date")}</th>
                <th className="px-2 py-2 text-start">{tt("trk.col_branch", "Branch")}</th>
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
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                    {tt("trk.no_trucks_found", "No registered trucks found.")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-2 font-semibold text-slate-500">{idx + 1}</td>
                    <td className="px-2 py-2 font-bold text-slate-800 dark:text-slate-100">{r.owner_display_name || "-"}</td>
                    <td className="px-2 py-2 font-mono font-bold">{r.truck_number}</td>
                    <td className="px-2 py-2">{r.truck_name || "-"}</td>
                    <td className="px-2 py-2">{r.model || "-"}</td>
                    <td className="px-2 py-2">{r.company_display_name || "-"}</td>
                    <td className="px-2 py-2">{r.transporter_display_name || "-"}</td>
                    <td className="px-2 py-2">{r.driver_display_name || "-"}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          r.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {r.status === "active" ? tt("common.active", "Active") : tt("common.inactive", "Inactive")}
                      </span>
                    </td>
                    <td className="px-2 py-2">{(r.created_at || "").slice(0, 10)}</td>
                    <td className="px-2 py-2">{r.branch_display_name || "-"}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => handleView(r)} title={tt("common.view", "View")} className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => startEdit(r)} title={tt("common.edit", "Edit")} className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(r.id)} title={tt("common.delete", "Delete")} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {party360 && (
        <Party360Modal customerId={party360.customerId} name={party360.name} lang={activeLang} onClose={() => setParty360(null)} />
      )}
    </div>
  );
}
