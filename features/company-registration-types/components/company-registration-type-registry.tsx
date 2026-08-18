"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, Printer, X, Check, Building } from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";

type CompanyRegistrationTypeRecord = { id: string; code: string; name: string; country_id?: string; description: string | null; is_active: boolean; created_at: string; country?: { name: string } };

export function CompanyRegistrationTypeRegistry() {
  const [types, setTypes] = useState<CompanyRegistrationTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [showReport, setShowReport] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    isActive: true
  });

  async function loadTypes() {
    setLoading(true);
    try {
      const res = await apiGet<{ companyRegistrationTypes: CompanyRegistrationTypeRecord[]; summary: typeof summary }>(
        `/api/erp/company-registration-types?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setTypes(res.companyRegistrationTypes || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load company registration types:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTypes();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return types;
    return types.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }, [searchQuery, types]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this company registration type?")) return;
    try {
      await apiDelete(`/api/erp/company-registration-types/${id}`);
      loadTypes();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      alert("Please fill in Code and Name.");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/erp/company-registration-types", formData);
      setIsModalOpen(false);
      setFormData({
        code: "",
        name: "",
        description: "",
        isActive: true
      });
      loadTypes();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Company Registration Types</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage company registration classification types, license kinds and legal structures</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowReport(true)} size="sm" variant="outline">
            <Printer className="w-4 h-4 mr-1" /> Print Preview
          </Button>
          <Button onClick={() => setIsModalOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> + New Registration Type
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex gap-2">
          <Input placeholder="Search registration types..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm">
            <option value="all">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">TOTAL</div>
            <div className="text-2xl font-bold text-blue-950 dark:text-blue-200 mt-1">{summary.total}</div>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">ACTIVE</div>
            <div className="text-2xl font-bold text-emerald-950 dark:text-emerald-200 mt-1">{summary.active}</div>
          </div>
          <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">INACTIVE</div>
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
                  <Th className="p-3 text-left">Description</Th>
                  <Th className="p-3 text-center">Status</Th>
                  <Th className="p-3 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">No company registration types found</td>
                  </tr>
                ) : (
                  filtered.map((type, idx) => (
                    <tr key={type.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{type.code}</td>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-200">{type.name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{type.description || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", type.is_active ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300")}>
                          {type.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDelete(type.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 rounded transition-colors" title="Delete Registration Type">
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

    {/* New Company Registration Type Modal */}
    {isModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" /> Add New Registration Type
            </h3>
            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Type Code *</label>
              <Input
                placeholder="e.g. REG-LLC / REG-CORP / REG-PVT"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Registration Type Name *</label>
              <Input
                placeholder="e.g. Limited Liability Company (LLC) / Sole Proprietorship"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Description</label>
              <Input
                placeholder="Optional description / legal requirements..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="reg_is_active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="reg_is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">Active Registration Type</label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Save Type
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    <UniversalReportModal
      isOpen={showReport}
      onClose={() => setShowReport(false)}
      title="Company Registration Types Registry"
      data={types}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Type Name" },
        { key: "description", label: "Description" },
        { key: "is_active", label: "Status", format: (v) => (v ? "Active" : "Inactive") }
      ]}
    />
    </>
  );
}
