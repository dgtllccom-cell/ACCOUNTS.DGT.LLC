"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, Printer, X, Check } from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { SearchSelect } from "@/components/ui/search-select";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type PortRecord = { id: string; code: string; name: string; border_type: string; country_id: string; is_active: boolean; created_at: string; country?: { name: string } };

export function PortRegistry() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [ports, setPorts] = useState<PortRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [showReport, setShowReport] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    countryId: "",
    borderType: "Sea Port",
    isActive: true
  });

  async function loadCountries() {
    try {
      const res = await apiGet<{ countries: { id: string; name: string }[] }>("/api/erp/locations/countries");
      const list = (res.countries || []).filter(c => !c.name.startsWith("QA ") && !c.name.includes("DEVTEST"));
      setCountries(list);
    } catch (err) {
      console.error("Failed to load countries:", err);
    }
  }

  async function loadPorts() {
    setLoading(true);
    try {
      const res = await apiGet<{ ports: PortRecord[]; summary: typeof summary }>(
        `/api/erp/ports?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setPorts(res.ports || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load ports:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPorts();
    loadCountries();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return ports;
    return ports.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [searchQuery, ports]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this port?")) return;
    try {
      await apiDelete(`/api/erp/ports/${id}`);
      loadPorts();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.countryId) {
      alert("Please fill in Code, Name, and Country.");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/erp/ports", formData);
      setIsModalOpen(false);
      setFormData({
        code: "",
        name: "",
        countryId: "",
        borderType: "Sea Port",
        isActive: true
      });
      loadPorts();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm" dir={isRtl ? "rtl" : "ltr"}>
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">{tt("port.title", "Ports & Boundaries")}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{tt("port.subtitle", "Manage departure, arrival, and border crossing ports")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowReport(true)} size="sm" variant="outline">
            <Printer className="w-4 h-4 mr-1" /> {tt("port.print", "Print Preview")}
          </Button>
          <Button onClick={() => setIsModalOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> {tt("port.new", "New Port")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex gap-2">
          <Input placeholder={tt("port.search", "Search ports by code or name...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm">
            <option value="all">{tt("port.all_status", "All Status")}</option>
            <option value="Active">{tt("port.active_only", "Active Only")}</option>
            <option value="Inactive">{tt("port.inactive_only", "Inactive Only")}</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{tt("port.total", "Total")}</div>
            <div className="text-2xl font-bold text-blue-950 dark:text-blue-200 mt-1">{summary.total}</div>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{tt("common.active", "Active")}</div>
            <div className="text-2xl font-bold text-emerald-950 dark:text-emerald-200 mt-1">{summary.active}</div>
          </div>
          <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">{tt("common.inactive", "Inactive")}</div>
            <div className="text-2xl font-bold text-rose-950 dark:text-rose-200 mt-1">{summary.inactive}</div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <Th className="p-3">#</Th>
                  <Th className="p-3 text-left">Code</Th>
                  <Th className="p-3 text-left">Name</Th>
                  <Th className="p-3 text-left">Country</Th>
                  <Th className="p-3 text-left">Border Type</Th>
                  <Th className="p-3 text-center">Status</Th>
                  <Th className="p-3 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">{tt("port.empty", "No ports found")}</td>
                  </tr>
                ) : (
                  filtered.map((port, idx) => (
                    <tr key={port.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{port.code}</td>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-200">{port.name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{port.country?.name || '-'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{port.border_type || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", port.is_active ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300")}>
                          {port.is_active ? tt("common.active", "Active") : tt("common.inactive", "Inactive")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDelete(port.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 rounded transition-colors" title={tt("ports.delete_port", "Delete Port")}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    {/* New Port Modal */}
    {isModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tt("port.modal_title", "Add New Port / Boundary")}</h3>
            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">{tt("port.code_label", "Port Code")} *</label>
                <Input
                  placeholder={tt("ports.code_ph", "e.g. PK-KHI")}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">{tt("port.border_type", "Border Type")}</label>
                <select
                  value={formData.borderType}
                  onChange={(e) => setFormData({ ...formData, borderType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                >
                  <option value="Sea Port">{tt("port.sea_port", "Sea Port")}</option>
                  <option value="Dry Port">{tt("port.dry_port", "Dry Port")}</option>
                  <option value="Airport">{tt("port.airport", "Airport")}</option>
                  <option value="Land Border / Checkpoint">{tt("port.land_border", "Land Border / Checkpoint")}</option>
                  <option value="Customs Terminal">{tt("port.customs", "Customs Terminal")}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">{tt("port.name_label", "Port Name")} *</label>
              <Input
                placeholder={tt("ports.name_ph", "e.g. Karachi Port Trust / Port Qasim")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">{tt("common.country", "Country")} *</label>
              <SearchSelect
                label=""
                value={formData.countryId}
                options={countries.map(c => ({ value: c.id, label: c.name }))}
                placeholder={tt("common.select_country", "Select Country...")}
                onValueChange={(val) => setFormData({ ...formData, countryId: val })}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="port_is_active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="port_is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">{tt("port.is_active", "Active Port")}</label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                {tt("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} {tt("port.save", "Save Port")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    <UniversalReportModal
      isOpen={showReport}
      onClose={() => setShowReport(false)}
      title={tt("port.register_title", "Ports & Boundaries Register")}
      subtitle={tt("port.register_subtitle", "Official Ports, Border Crossings & Entry/Exit Points Registry")}
      exportFileName="port_boundary_report"
      filters={[
        { label: tt("common.search", "Search"), value: searchQuery || "All" },
        { label: tt("common.status", "Status"), value: statusFilter === "all" ? "All" : statusFilter }
      ]}
      columns={[
        { key: "code", label: tt("port.col_code", "Port Code") },
        { key: "name", label: tt("port.col_name", "Port / Boundary Name") },
        { key: "border_type", label: tt("port.col_border_type", "Border Type") },
        { key: "country", label: tt("common.country", "Country") },
        { key: "status", label: tt("common.status", "Status"), align: "center" }
      ]}
      data={filtered.map(p => ({
        code: p.code || "-",
        name: p.name,
        border_type: p.border_type || "-",
        country: p.country?.name || "-",
        status: p.is_active ? "Active" : "Inactive"
      }))}
    />
    </>
  );
}
