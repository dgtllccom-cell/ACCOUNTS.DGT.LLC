/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Face-ID / biometric devices → the existing attendance records (office_attendance).
 * HR registers a device per branch; the device pushes punches to /api/public/attendance/device-events
 * with its code + key (the key is shown once), or HR uploads the device's exported log (CSV).
 * Punches whose biometric id is not yet assigned stay "unmatched" until HR maps them to an employee.
 */
import { useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, Loader2, Plus, Power, Upload, UserCheck, X, Copy } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800";

const EVENT_TONE: Record<string, string> = {
  applied: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  pending: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  unmatched: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  ignored_manual: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ignored_duplicate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function BiometricDevicesPanel({ lang, employees }: { lang?: string; employees?: Row[] }) {
  const s = useErpScreen("hrm", lang);
  const [devices, setDevices] = useState<Row[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shownKey, setShownKey] = useState<{ code: string; key: string } | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [mapFor, setMapFor] = useState<string | null>(null);
  const [mapEmployee, setMapEmployee] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, e] = await Promise.all([
        apiGet<{ devices: Row[] }>("/api/erp/hr/attendance-devices"),
        apiGet<{ events: Row[] }>(`/api/erp/hr/attendance-devices/events?limit=200${eventFilter ? `&status=${eventFilter}` : ""}`),
      ]);
      setDevices(d.devices ?? []);
      setEvents(e.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [eventFilter]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try { await fn(); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const rotate = (d: Row) => {
    if (!window.confirm(s.t("dev_rotate_confirm", "Issue a new key? The device stops working until it is configured with the new key."))) return;
    void act(async () => {
      const r = await apiPatch<{ apiKey: string }>(`/api/erp/hr/attendance-devices/${d.id}`, { action: "rotate_key" });
      setShownKey({ code: d.device_code, key: r.apiKey });
    });
  };
  const toggle = (d: Row) => void act(async () => {
    await apiPatch(`/api/erp/hr/attendance-devices/${d.id}`, { action: d.is_active ? "deactivate" : "activate" });
  });
  const importLog = (d: Row, file: File) => void act(async () => {
    const r = await apiPost<Row>(`/api/erp/hr/attendance-devices/${d.id}/import`, { csv: await file.text() });
    setNotice(`${s.t("dev_import_done", "Log imported")}: ${r.stored ?? 0} ${s.t("dev_stored", "stored")}, ${r.duplicates ?? 0} ${s.t("dev_duplicates", "duplicates")}, ${r.unmatched ?? 0} ${s.t("dev_unmatched", "unmatched")}, ${r.attendanceUpdated ?? 0} ${s.t("dev_att_updated", "attendance days updated")}`);
  });
  const mapBio = () => {
    if (!mapFor || !mapEmployee) return;
    void act(async () => {
      const r = await apiPost<Row>("/api/erp/hr/attendance-devices/map", { employeeId: mapEmployee, biometricId: mapFor });
      setNotice(`${s.t("dev_mapped", "Biometric ID assigned")}: ${r.eventsMatched ?? 0} ${s.t("dev_events_matched", "punches matched")}, ${r.attendanceUpdated ?? 0} ${s.t("dev_att_updated", "attendance days updated")}`);
      setMapFor(null);
      setMapEmployee("");
    });
  };

  const eventStatus = (st: string) =>
    ({
      applied: s.t("ev_applied", "Applied to attendance"),
      pending: s.t("ev_pending", "Pending"),
      unmatched: s.t("ev_unmatched", "Unmatched ID"),
      ignored_manual: s.t("ev_ignored_manual", "Kept manual record"),
      ignored_duplicate: s.t("ev_ignored_duplicate", "Duplicate"),
    })[st] ?? st;
  const unmatchedIds = [...new Set(events.filter((e) => e.status === "unmatched").map((e) => String(e.biometric_id)))];

  return (
    <div className="space-y-4" dir={s.dir} data-testid="biometric-devices">
      <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4 text-xs text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-200">
        <p className="font-bold">{s.t("dev_how_title", "How devices feed attendance")}</p>
        <p className="mt-1">{s.t("dev_how_body", "Each punch is stored once, then rolled into the employee's attendance for that day (first in / last out). A manual or HR-corrected attendance record is never overwritten by a device. Payroll reads the same attendance records.")}</p>
        <p className="mt-1 font-mono text-[11px]" dir="ltr">POST /api/public/attendance/device-events · x-device-code · x-device-key</p>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {notice && <p data-testid="dev-notice" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

      {shownKey && (
        <div data-testid="dev-key" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs dark:border-amber-800 dark:bg-amber-950/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-amber-900 dark:text-amber-200">{s.t("dev_key_once", "Device key — shown only once. Configure it on the device now; it cannot be displayed again.")}</p>
              <p className="mt-2 text-slate-600 dark:text-slate-300">{s.t("dev_code", "Device Code")}: <span className="font-mono font-bold" dir="ltr">{shownKey.code}</span></p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-slate-900 dark:text-white" dir="ltr" data-testid="dev-key-value">{shownKey.key}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" aria-label={s.t("copy", "Copy")} onClick={() => void navigator.clipboard?.writeText(shownKey.key)} className="rounded-lg border border-amber-300 p-1.5 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200"><Copy className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label={s.t("close", "Close")} onClick={() => setShownKey(null)} className="rounded-lg border border-amber-300 p-1.5 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Fingerprint className="h-4 w-4 text-purple-600" />{s.t("dev_title", "Registered Devices")}</h3>
          <button type="button" data-testid="dev-register-open" onClick={() => setShowRegister(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700">
            <Plus className="h-4 w-4" /> {s.t("dev_register", "Register Device")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                {[s.t("dev_code", "Device Code"), s.t("name", "Name"), s.t("dev_type", "Type"), s.t("branch", "Branch"), s.t("dev_key_hint", "Key ends with"), s.t("dev_last_seen", "Last seen"), s.t("dev_punches", "Punches"), s.t("status_label", "Status"), s.t("actions", "Actions")].map((h) => (
                  <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-purple-600" /></td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">{s.t("dev_none", "No devices registered yet.")}</td></tr>
              ) : devices.map((d) => (
                <tr key={d.id} data-testid="dev-row" className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-mono font-semibold" dir="ltr">{d.device_code}</td>
                  <td className="px-3 py-2">{d.name}</td>
                  <td className="px-3 py-2">{s.t(`dev_type_${d.device_type}`, d.device_type)}</td>
                  <td className="px-3 py-2">{d.city_branch_name ?? d.country_name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono" dir="ltr">…{d.api_key_hint ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : s.t("dev_never", "Never")}</td>
                  <td className="px-3 py-2 tabular-nums">{d.event_count}{d.unmatched_count ? <span className="ms-1 text-amber-600">({d.unmatched_count} {s.t("dev_unmatched", "unmatched")})</span> : null}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.is_active ? EVENT_TONE.applied : EVENT_TONE.ignored_manual}`}>{d.is_active ? s.t("active", "Active") : s.t("inactive", "Inactive")}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" disabled={busy} onClick={() => rotate(d)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700"><KeyRound className="h-3 w-3" />{s.t("dev_rotate", "New key")}</button>
                      <button type="button" disabled={busy} onClick={() => toggle(d)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700"><Power className="h-3 w-3" />{d.is_active ? s.t("dev_disable", "Disable") : s.t("dev_enable", "Enable")}</button>
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold hover:bg-slate-50 dark:border-slate-700">
                        <Upload className="h-3 w-3" />{s.t("dev_import", "Import log (CSV)")}
                        <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importLog(d, f); e.target.value = ""; }} />
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800">{s.t("dev_csv_hint", "CSV columns: biometric ID, date-time (device local time), optional in/out.")}</p>
      </section>

      {unmatchedIds.length > 0 && (
        <section data-testid="dev-unmatched" className="rounded-2xl border border-amber-200 bg-white p-3 dark:border-amber-900/60 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">{s.t("dev_unmatched_title", "Unmatched biometric IDs")}</h3>
          <p className="mt-1 text-xs text-slate-500">{s.t("dev_unmatched_body", "These IDs punched on a device but are not assigned to any employee. Assign each to the right employee; its punches are then applied to attendance.")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unmatchedIds.map((id) => (
              <button key={id} type="button" onClick={() => { setMapFor(id); setMapEmployee(""); }} className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${mapFor === id ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200" : "border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-200"}`} dir="ltr">{id}</button>
            ))}
          </div>
          {mapFor && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs">{s.t("dev_assign_to", "Assign")} <b className="font-mono" dir="ltr">{mapFor}</b> {s.t("dev_to_employee", "to employee")}:</span>
              <select data-testid="dev-map-employee" value={mapEmployee} onChange={(e) => setMapEmployee(e.target.value)} className={`${INP} w-64`}>
                <option value="">{s.t("select_employee", "Select employee…")}</option>
                {(employees ?? []).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_code}){e.biometric_id ? ` · ${e.biometric_id}` : ""}</option>)}
              </select>
              <button type="button" data-testid="dev-map-save" disabled={!mapEmployee || busy} onClick={mapBio} className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><UserCheck className="h-3.5 w-3.5" />{s.t("dev_assign", "Assign ID")}</button>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <h3 className="text-sm font-bold">{s.t("dev_events", "Device Punches")}</h3>
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className={`${INP} w-48`}>
            <option value="">{s.t("all_status", "All Status")}</option>
            {["applied", "unmatched", "ignored_manual", "pending"].map((k) => <option key={k} value={k}>{eventStatus(k)}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                {[s.t("dev_punch_time", "Punch time"), s.t("dev_code", "Device Code"), s.t("dev_bio_id", "Biometric ID"), s.t("emp_code", "Employee ID"), s.t("dev_direction", "In / Out"), s.t("source", "Source"), s.t("status_label", "Status")].map((h) => (
                  <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && events.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">{s.t("dev_no_events", "No device punches received yet.")}</td></tr>
              ) : events.map((e) => (
                <tr key={e.id} data-testid="dev-event" data-status={e.status} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 tabular-nums">{new Date(e.event_time).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono" dir="ltr">{e.device_code}</td>
                  <td className="px-3 py-2 font-mono" dir="ltr">{e.biometric_id}</td>
                  <td className="px-3 py-2 font-mono">{e.employee_code ?? "—"}</td>
                  <td className="px-3 py-2">{e.direction === "in" ? s.t("dir_in", "In") : e.direction === "out" ? s.t("dir_out", "Out") : "—"}</td>
                  <td className="px-3 py-2">{e.source === "import" ? s.t("src_import", "Device log import") : s.t("src_device", "Face-ID / device")}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${EVENT_TONE[e.status] ?? EVENT_TONE.pending}`}>{eventStatus(e.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showRegister && (
        <RegisterDeviceModal
          s={s}
          onClose={() => setShowRegister(false)}
          onRegistered={(code, key) => { setShowRegister(false); setShownKey({ code, key }); void load(); }}
        />
      )}
    </div>
  );
}

function RegisterDeviceModal({ s, onClose, onRegistered }: { s: ReturnType<typeof useErpScreen>; onClose: () => void; onRegistered: (code: string, key: string) => void }) {
  const [countries, setCountries] = useState<Row[]>([]);
  const [branches, setBranches] = useState<Row[]>([]);
  const [f, setF] = useState({ deviceCode: "", name: "", deviceType: "face", serialNo: "", countryId: "", cityBranchId: "", timezone: "Asia/Dubai" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    apiGet<any>("/api/branch-management/countries").then((r) => setCountries(r?.countries ?? [])).catch(() => setCountries([]));
  }, []);
  useEffect(() => {
    if (!f.countryId) { setBranches([]); return; }
    apiGet<any>(`/api/branch-management/city-branches?countryId=${encodeURIComponent(f.countryId)}`).then((r) => setBranches(r?.cityBranches ?? [])).catch(() => setBranches([]));
  }, [f.countryId]);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const br = branches.find((b) => b.id === f.cityBranchId);
      const r = await apiPost<{ device: Row; apiKey: string }>("/api/erp/hr/attendance-devices", {
        deviceCode: f.deviceCode, name: f.name, deviceType: f.deviceType, serialNo: f.serialNo || null,
        countryId: f.countryId, cityBranchId: f.cityBranchId || null, countryBranchId: br?.country_branch_id ?? null, timezone: f.timezone,
      });
      onRegistered(r.device?.device_code ?? f.deviceCode, r.apiKey);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" dir={s.dir}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" data-testid="dev-register-modal">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">{s.t("dev_register", "Register Device")}</h3>
          <button type="button" aria-label={s.t("close", "Close")} onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <L label={s.t("dev_code", "Device Code")}><input data-testid="dev-f-code" className={INP} dir="ltr" value={f.deviceCode} onChange={(e) => set("deviceCode", e.target.value)} /></L>
          <L label={s.t("name", "Name")}><input data-testid="dev-f-name" className={INP} value={f.name} onChange={(e) => set("name", e.target.value)} /></L>
          <L label={s.t("dev_type", "Type")}>
            <select className={INP} value={f.deviceType} onChange={(e) => set("deviceType", e.target.value)}>
              {["face", "fingerprint", "card", "mobile", "other"].map((t) => <option key={t} value={t}>{s.t(`dev_type_${t}`, t)}</option>)}
            </select>
          </L>
          <L label={s.t("dev_serial", "Serial No.")}><input className={INP} dir="ltr" value={f.serialNo} onChange={(e) => set("serialNo", e.target.value)} /></L>
          <L label={s.t("country", "Country")}>
            <select data-testid="dev-f-country" className={INP} value={f.countryId} onChange={(e) => { set("countryId", e.target.value); set("cityBranchId", ""); }}>
              <option value="">{s.t("select", "Select…")}</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </L>
          <L label={s.t("branch", "Branch")}>
            <select data-testid="dev-f-branch" className={INP} value={f.cityBranchId} onChange={(e) => set("cityBranchId", e.target.value)}>
              <option value="">{s.t("select", "Select…")}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </L>
          <L label={s.t("dev_timezone", "Device time zone")}>
            <select className={INP} value={f.timezone} onChange={(e) => set("timezone", e.target.value)} dir="ltr">
              {["Asia/Dubai", "Asia/Karachi", "Asia/Kabul", "Asia/Tehran", "Asia/Riyadh", "Asia/Muscat", "UTC"].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </L>
        </div>
        {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" data-testid="dev-f-save" disabled={saving || !f.deviceCode || !f.name || !f.countryId} onClick={() => void submit()} className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("dev_register", "Register Device")}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

/** Label + control. Module-level so inputs keep focus while typing. */
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>{children}</div>;
}
