"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Search, Loader2, RefreshCw, FileText, CheckCircle2, ShieldCheck, Landmark, Building2 } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";

type AgentCustomEntryRow = {
  id: string;
  entry_no: string;
  customs_declaration_no: string | null;
  declaration_type: "import" | "export" | "transit";
  agent_name: string;
  customs_station: string;
  consignee_name: string | null;
  consignor_name: string | null;
  hscode: string | null;
  goods_description: string | null;
  assessed_value: number;
  duty_paid: number;
  currency_code: string;
  clearance_status: "submitted" | "under_inspection" | "cleared" | "rejected";
  remarks: string | null;
  created_at: string;
};

const EMPTY_ENTRY: any = {
  id: "",
  entry_no: "",
  customs_declaration_no: "",
  declaration_type: "import",
  agent_name: "",
  customs_station: "Karachi Customs House",
  consignee_name: "",
  consignor_name: "",
  hscode: "",
  goods_description: "",
  assessed_value: 0,
  duty_paid: 0,
  currency_code: "USD",
  clearance_status: "submitted",
  remarks: "",
};

export function AgentCustomEntryManagementView({ lang }: { lang: SupportedLanguage }) {
  const dir = getLanguageDirection(lang);
  const [rows, setRows] = useState<AgentCustomEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<any>(EMPTY_ENTRY);
  const [isEditing, setIsEditing] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/clearing-agent/agent-custom-entry");
      const json = await res.json();
      if (json.success) {
        setRows(json.data || []);
      } else {
        throw new Error(json.error || "Failed to load custom entries");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = query.trim().toLowerCase();
      const matchSearch =
        !q ||
        (r.entry_no && r.entry_no.toLowerCase().includes(q)) ||
        (r.customs_declaration_no && r.customs_declaration_no.toLowerCase().includes(q)) ||
        (r.agent_name && r.agent_name.toLowerCase().includes(q)) ||
        (r.customs_station && r.customs_station.toLowerCase().includes(q)) ||
        (r.consignee_name && r.consignee_name.toLowerCase().includes(q));

      const matchStatus = statusFilter === "all" || r.clearance_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, query, statusFilter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/erp/clearing-agent/agent-custom-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save entry");

      setSuccessMessage(`Custom Declaration ${json.data.entry_no || "saved"} created successfully!`);
      setForm(EMPTY_ENTRY);
      setIsEditing(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(row: AgentCustomEntryRow) {
    setForm(row);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div dir={dir} className="w-full space-y-4 pb-12 text-foreground">
        {/* Ribbon Header (Clean White ERP Style) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-md border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                Customs & Border Station Module
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-md border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                5-Language Translation Sync
              </span>
            </div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Agent Custom Declaration Form</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Record customs declarations (GD numbers, HS Codes, Duty payments & inspection clearance).
            </p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Declarations
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm font-medium">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 flex items-center gap-3 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Custom Declaration Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-400" />
              {isEditing ? "Edit Custom Declaration Entry" : "New Custom Declaration Entry"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Entry Ref / Serial No</label>
              <input
                type="text"
                placeholder="Auto-generated (or custom)"
                value={form.entry_no}
                onChange={(e) => setForm({ ...form, entry_no: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Customs GD Number *</label>
              <input
                type="text"
                placeholder="e.g. KADP-HC-89123"
                value={form.customs_declaration_no}
                onChange={(e) => setForm({ ...form, customs_declaration_no: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Declaration Type</label>
              <select
                value={form.declaration_type}
                onChange={(e) => setForm({ ...form, declaration_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="import">Import Declaration</option>
                <option value="export">Export Declaration</option>
                <option value="transit">Transit Declaration</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Customs Station / Office *</label>
              <input
                type="text"
                placeholder="e.g. Karachi Port Customs / Torkham Border"
                value={form.customs_station}
                onChange={(e) => setForm({ ...form, customs_station: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Clearing Agent Company *</label>
              <input
                type="text"
                placeholder="e.g. DGT Logistics Clearing"
                value={form.agent_name}
                onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Consignee Name (Importer)</label>
              <input
                type="text"
                placeholder="e.g. Damaan Global LLC"
                value={form.consignee_name}
                onChange={(e) => setForm({ ...form, consignee_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Consignor Name (Exporter)</label>
              <input
                type="text"
                placeholder="e.g. Global Trade Corp"
                value={form.consignor_name}
                onChange={(e) => setForm({ ...form, consignor_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">HS Code</label>
              <input
                type="text"
                placeholder="e.g. 8704.2100"
                value={form.hscode}
                onChange={(e) => setForm({ ...form, hscode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Assessed Value</label>
              <input
                type="number"
                step="any"
                value={form.assessed_value}
                onChange={(e) => setForm({ ...form, assessed_value: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Customs Duty Paid</label>
              <input
                type="number"
                step="any"
                value={form.duty_paid}
                onChange={(e) => setForm({ ...form, duty_paid: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Clearance Status</label>
              <select
                value={form.clearance_status}
                onChange={(e) => setForm({ ...form, clearance_status: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="submitted">Submitted</option>
                <option value="under_inspection">Under Inspection</option>
                <option value="cleared">Cleared</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Goods Description & Remarks</label>
            <textarea
              rows={2}
              placeholder="Detailed description of cargo items, tariff notes..."
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Custom Declaration
            </button>
          </div>
        </form>

        {/* Declarations Register Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <h2 className="text-lg font-semibold text-white">Registered Custom Declarations ({filteredRows.length})</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search GD no, entry, agent..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 w-64 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading custom declarations...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">No custom declarations found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <Th className="px-4 py-3">Entry No</Th>
                    <Th className="px-4 py-3">GD Number</Th>
                    <Th className="px-4 py-3">Agent / Station</Th>
                    <Th className="px-4 py-3">Consignee</Th>
                    <Th className="px-4 py-3">Duty Paid</Th>
                    <Th className="px-4 py-3">Status</Th>
                    <Th className="px-4 py-3 text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-indigo-400">{r.entry_no}</td>
                      <td className="px-4 py-3 font-mono text-white">{r.customs_declaration_no || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{r.agent_name}</div>
                        <div className="text-xs text-slate-400">{r.customs_station}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{r.consignee_name || "-"}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                        ${(r.duty_paid || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${
                            r.clearance_status === "cleared"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : r.clearance_status === "under_inspection"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {r.clearance_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEdit(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  );
}
