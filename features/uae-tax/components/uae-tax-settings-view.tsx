"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calculator,
  Check,
  Loader2,
  MapPin,
  Pencil,
  Percent,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import type {
  UaeDesignatedZone,
  UaeTaxEntity,
} from "@/features/uae-tax/types/uae-tax";

type Country = { id: string; name: string; iso2?: string; currency_code?: string };
type MainBranch = { id: string; name: string; countryId?: string };
type CityBranch = { id: string; name?: string; city_name?: string; countryId?: string; countryBranchId?: string };

type TabKey = "entities" | "zones" | "rates";

type EntityForm = {
  id?: string;
  countryId: string;
  trn: string;
  legalName: string;
  registeredName: string;
  registrationDate: string;
  filingFrequency: "monthly" | "quarterly";
  firstPeriodStart: string;
  baseCurrency: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  cityBranchIds: string[];
};

const BLANK_FORM: EntityForm = {
  countryId: "",
  trn: "",
  legalName: "",
  registeredName: "",
  registrationDate: "",
  filingFrequency: "quarterly",
  firstPeriodStart: "",
  baseCurrency: "AED",
  address: "",
  phone: "",
  email: "",
  isActive: true,
  cityBranchIds: [],
};

export function UaeTaxSettingsView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("tax_einv", langProp);

  const [tab, setTab] = useState<TabKey>("entities");
  const [entities, setEntities] = useState<UaeTaxEntity[]>([]);
  const [zones, setZones] = useState<UaeDesignatedZone[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EntityForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cityBranches, setCityBranches] = useState<CityBranch[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ents, zs, meta] = await Promise.all([
        apiGet<{ entities: UaeTaxEntity[] }>("/api/erp/uae-tax/entities"),
        apiGet<{ zones: UaeDesignatedZone[] }>("/api/erp/uae-tax/designated-zones"),
        apiGet<{ countries: Country[] }>("/api/erp/reports/meta"),
      ]);
      setEntities(ents.entities ?? []);
      setZones(zs.zones ?? []);
      const uae = (meta.countries ?? []).filter(
        (c) => (c.iso2 || "").toUpperCase() === "AE" || /united arab emirates|uae/i.test(c.name),
      );
      setCountries(uae.length ? uae : meta.countries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Load city branches for the form's country
  useEffect(() => {
    if (!form.countryId) {
      setCityBranches([]);
      return;
    }
    let cancelled = false;
    apiGet<{ cityBranches: CityBranch[] }>(`/api/erp/locations/branches/city?countryId=${form.countryId}`)
      .then((r) => {
        if (!cancelled) setCityBranches(r.cityBranches ?? []);
      })
      .catch(() => {
        if (!cancelled) setCityBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.countryId]);

  const openCreate = () => {
    setForm({ ...BLANK_FORM, countryId: countries[0]?.id ?? "" });
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = async (ent: UaeTaxEntity) => {
    setSaveError(null);
    let branchIds: string[] = [];
    try {
      const full = await apiGet<{ entity: (UaeTaxEntity & { branches?: { city_branch_id: string | null }[] }) | null }>(
        `/api/erp/uae-tax/entities/${ent.id}`,
      );
      branchIds = (full.entity?.branches ?? [])
        .map((b) => b.city_branch_id)
        .filter((x): x is string => Boolean(x));
    } catch {
      /* ignore — edit still works, branches just start empty */
    }
    setForm({
      id: ent.id,
      countryId: ent.country_id,
      trn: ent.trn,
      legalName: ent.legal_name,
      registeredName: ent.registered_name ?? "",
      registrationDate: ent.registration_date ?? "",
      filingFrequency: ent.filing_frequency,
      firstPeriodStart: ent.first_period_start ?? "",
      baseCurrency: ent.base_currency,
      address: ent.address ?? "",
      phone: ent.phone ?? "",
      email: ent.email ?? "",
      isActive: ent.is_active,
      cityBranchIds: branchIds,
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const branches = form.cityBranchIds.map((id) => ({ cityBranchId: id }));
      if (form.id) {
        await apiPatch(`/api/erp/uae-tax/entities/${form.id}`, {
          trn: form.trn,
          legalName: form.legalName,
          registeredName: form.registeredName || null,
          registrationDate: form.registrationDate || null,
          filingFrequency: form.filingFrequency,
          firstPeriodStart: form.firstPeriodStart || null,
          baseCurrency: form.baseCurrency,
          address: form.address || null,
          phone: form.phone || null,
          email: form.email || null,
          isActive: form.isActive,
          branches,
        });
      } else {
        const created = await apiPost<{ id: string }>("/api/erp/uae-tax/entities", {
          countryId: form.countryId,
          trn: form.trn,
          legalName: form.legalName,
          registeredName: form.registeredName || null,
          registrationDate: form.registrationDate || null,
          filingFrequency: form.filingFrequency,
          firstPeriodStart: form.firstPeriodStart || null,
          baseCurrency: form.baseCurrency,
          address: form.address || null,
          phone: form.phone || null,
          email: form.email || "",
        });
        if (branches.length) {
          await apiPatch(`/api/erp/uae-tax/entities/${created.id}`, { branches });
        }
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(/duplicate|unique|already/i.test(msg) ? s.t("set_err_trn", "This TRN is already registered.") : msg);
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.countryId && form.trn.trim().length >= 5 && form.legalName.trim().length >= 2;

  const tabs: { key: TabKey; label: string; icon: typeof Building2 }[] = useMemo(
    () => [
      { key: "entities", label: s.t("set_tab_entities", "Tax Entities"), icon: Building2 },
      { key: "zones", label: s.t("set_tab_zones", "Designated Zones"), icon: MapPin },
      { key: "rates", label: s.t("set_tab_rates", "VAT Rates"), icon: Percent },
    ],
    [s],
  );

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <header className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
            <Calculator className="h-5 w-5" />
          </span>
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("set_title", "UAE Tax Settings")}</h1>
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-500">{s.t("set_subtitle", "")}</p>
          </div>
        </header>

        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  tab === t.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-4 w-4 animate-spin" /> …
          </div>
        ) : tab === "entities" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {s.t("set_add_entity", "Add Tax Entity")}
              </button>
            </div>
            {entities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                {s.t("set_no_entities", "No tax entities yet.")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr className="text-left">
                      <Th className="px-4 py-3">{s.t("set_col_trn", "TRN")}</Th>
                      <Th className="px-4 py-3">{s.t("set_col_legal_name", "Legal Name")}</Th>
                      <Th className="px-4 py-3">{s.t("set_col_frequency", "Filing Frequency")}</Th>
                      <Th className="px-4 py-3">{s.t("set_col_branches", "Mapped Branches")}</Th>
                      <Th className="px-4 py-3">{s.t("set_col_status", "Status")}</Th>
                      <Th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {entities.map((ent) => (
                      <tr key={ent.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-100">{ent.trn}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{ent.legal_name}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {ent.filing_frequency === "monthly" ? s.t("set_freq_monthly", "Monthly") : s.t("set_freq_quarterly", "Quarterly")}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{ent.branch_count ?? 0}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              ent.is_active
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                            }`}
                          >
                            {ent.is_active ? s.t("set_f_active", "Active") : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void openEdit(ent)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            <Pencil className="h-3 w-3" />
                            {s.t("set_edit_entity", "Edit Tax Entity")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === "zones" ? (
          <div className="space-y-3">
            <ZoneAddForm
              s={s}
              onAdded={async () => {
                await load();
              }}
            />
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {zones.length === 0 ? (
              <p className="p-10 text-center text-xs text-slate-500">{s.t("set_no_zones", "No Designated Zones configured.")}</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr className="text-left">
                    <Th className="px-4 py-3">{s.t("set_zone_name", "Zone Name")}</Th>
                    <Th className="px-4 py-3">{s.t("set_zone_emirate", "Emirate")}</Th>
                    <Th className="px-4 py-3">{s.t("set_zone_type", "Zone Type")}</Th>
                    <Th className="px-4 py-3">{s.t("set_zone_designated", "VAT Designated")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{z.zone_name}</td>
                      <td className="px-4 py-3 text-slate-500">{z.emirate ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{z.zone_type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            z.is_designated
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          }`}
                        >
                          {z.is_designated ? s.t("set_zone_yes", "Designated Zone") : s.t("set_zone_no", "Free Zone (not designated)")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <Percent className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-slate-500">{s.t("set_open_rates", "")}</p>
            <Link
              href="/dashboard/tax"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              {s.t("set_tab_rates", "VAT Rates")}
            </Link>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8" dir={s.dir}>
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                {form.id ? s.t("set_edit_entity", "Edit Tax Entity") : s.t("set_add_entity", "Add Tax Entity")}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid max-h-[70vh] gap-3 overflow-y-auto p-5 sm:grid-cols-2">
              <Field label={s.t("set_f_country", "Country")}>
                <select
                  value={form.countryId}
                  disabled={Boolean(form.id)}
                  onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value, cityBranchIds: [] }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 disabled:opacity-60"
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={s.t("set_f_trn", "Tax Registration Number (TRN)")}>
                <input
                  value={form.trn}
                  onChange={(e) => setForm((f) => ({ ...f, trn: e.target.value }))}
                  placeholder="TRN-100000000000003"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
              <Field label={s.t("set_f_legal_name", "Registered Legal Name")}>
                <input
                  value={form.legalName}
                  onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
              <Field label={s.t("set_f_registered_name", "Trade / Registered Name (optional)")}>
                <input
                  value={form.registeredName}
                  onChange={(e) => setForm((f) => ({ ...f, registeredName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
              <Field label={s.t("set_f_registration_date", "VAT Registration Date")}>
                <input
                  type="date"
                  value={form.registrationDate}
                  onChange={(e) => setForm((f) => ({ ...f, registrationDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
              <Field label={s.t("set_f_frequency", "Filing Frequency")}>
                <select
                  value={form.filingFrequency}
                  onChange={(e) => setForm((f) => ({ ...f, filingFrequency: e.target.value as "monthly" | "quarterly" }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="quarterly">{s.t("set_freq_quarterly", "Quarterly")}</option>
                  <option value="monthly">{s.t("set_freq_monthly", "Monthly")}</option>
                </select>
              </Field>
              <Field label={s.t("set_f_first_period", "First Period Start")}>
                <input
                  type="date"
                  value={form.firstPeriodStart}
                  onChange={(e) => setForm((f) => ({ ...f, firstPeriodStart: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
              <Field label={s.t("set_f_base_currency", "Base / Filing Currency")}>
                <input
                  value={form.baseCurrency}
                  onChange={(e) => setForm((f) => ({ ...f, baseCurrency: e.target.value.toUpperCase().slice(0, 3) }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs uppercase dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
              <Field label={s.t("set_f_phone", "Phone")}>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
              <Field label={s.t("set_f_email", "Email")}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={s.t("set_f_address", "Address")}>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.t("set_f_branches", "Mapped Branches")}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">{s.t("set_f_branches_help", "")}</p>
                <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                  {cityBranches.length === 0 ? (
                    <span className="text-[11px] text-slate-400">—</span>
                  ) : (
                    cityBranches.map((b) => {
                      const on = form.cityBranchIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              cityBranchIds: on
                                ? f.cityBranchIds.filter((x) => x !== b.id)
                                : [...f.cityBranchIds, b.id],
                            }))
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                            on
                              ? "bg-blue-600 text-white"
                              : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                          }`}
                        >
                          {on ? <Check className="h-3 w-3" /> : null}
                          {b.name || b.city_name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                {s.t("set_f_active", "Active")}
              </label>
            </div>

            {saveError ? (
              <p className="mx-5 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{saveError}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                {s.tGlobal("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {s.tGlobal("common.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ZoneAddForm({ s, onAdded }: { s: ReturnType<typeof useErpScreen>; onAdded: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [emirate, setEmirate] = useState("");
  const [zoneType, setZoneType] = useState<"free_zone" | "designated_zone" | "mainland_special">("free_zone");
  const [isDesignated, setIsDesignated] = useState(false);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      await apiPost("/api/erp/uae-tax/designated-zones", {
        zoneName: name.trim(),
        emirate: emirate.trim() || null,
        zoneType,
        isDesignated,
      });
      setName("");
      setEmirate("");
      setIsDesignated(false);
      await onAdded();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {s.t("set_zone_name", "Zone Name")}
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {s.t("set_zone_emirate", "Emirate")}
        <input value={emirate} onChange={(e) => setEmirate(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {s.t("set_zone_type", "Zone Type")}
        <select value={zoneType} onChange={(e) => setZoneType(e.target.value as typeof zoneType)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
          <option value="free_zone">free_zone</option>
          <option value="designated_zone">designated_zone</option>
          <option value="mainland_special">mainland_special</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5 pb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={isDesignated} onChange={(e) => setIsDesignated(e.target.checked)} />
        {s.t("set_zone_designated", "VAT Designated")}
      </label>
      <button
        type="button"
        onClick={() => void add()}
        disabled={saving || name.trim().length < 2}
        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {s.tGlobal("common.add", "Add")}
      </button>
    </div>
  );
}
