"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, Printer, X, Check, Package } from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { SearchSelect } from "@/components/ui/search-select";

type GoodsRecord = { id: string; chs_code: string; name: string; category: string; brand: string; origin_country: string; sizes: string; is_active: boolean; created_at: string };

export function GoodsMasterRegistry() {
  const [goods, setGoods] = useState<GoodsRecord[]>([]);
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
    chsCode: "",
    name: "",
    category: "General Merchandise",
    brand: "",
    originCountry: "",
    sizes: "",
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

  async function loadGoods() {
    setLoading(true);
    try {
      const res = await apiGet<{ goods: GoodsRecord[]; summary: typeof summary }>(
        `/api/erp/goods-master?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setGoods(res.goods || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load goods:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoods();
    loadCountries();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return goods;
    return goods.filter((g) => g.name.toLowerCase().includes(q) || g.chs_code.toLowerCase().includes(q) || (g.brand && g.brand.toLowerCase().includes(q)));
  }, [searchQuery, goods]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this goods item?")) return;
    try {
      await apiDelete(`/api/erp/goods-master/${id}`);
      loadGoods();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.chsCode) {
      alert("Please fill in CHS Code and Item Name.");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/erp/goods-master", formData);
      setIsModalOpen(false);
      setFormData({
        chsCode: "",
        name: "",
        category: "General Merchandise",
        brand: "",
        originCountry: "",
        sizes: "",
        isActive: true
      });
      loadGoods();
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
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Goods Master</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage global product, goods catalog and CHS classifications</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowReport(true)} size="sm" variant="outline">
            <Printer className="w-4 h-4 mr-1" /> Print Preview
          </Button>
          <Button onClick={() => setIsModalOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> + New Goods Item
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex gap-2">
          <Input placeholder="Search goods by name, CHS code, or brand..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
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
                  <Th className="p-3 text-left">CHS Code</Th>
                  <Th className="p-3 text-left">Name</Th>
                  <Th className="p-3 text-left">Category</Th>
                  <Th className="p-3 text-left">Brand / Size</Th>
                  <Th className="p-3 text-left">Origin</Th>
                  <Th className="p-3 text-center">Status</Th>
                  <Th className="p-3 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">No goods records found</td>
                  </tr>
                ) : (
                  filtered.map((g, idx) => (
                    <tr key={g.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{g.chs_code}</td>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-200">{g.name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{g.category || '-'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{[g.brand, g.sizes].filter(Boolean).join(" / ") || '-'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{g.origin_country || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", g.is_active ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300")}>
                          {g.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDelete(g.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 rounded transition-colors" title="Delete Goods Item">
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

    {/* New Goods Modal */}
    {isModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" /> Add New Goods Item
            </h3>
            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">CHS Code *</label>
                <Input
                  placeholder="e.g. 1006.30"
                  value={formData.chsCode}
                  onChange={(e) => setFormData({ ...formData, chsCode: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                >
                  <option value="General Merchandise">General Merchandise</option>
                  <option value="Agriculture & Food">Agriculture & Food</option>
                  <option value="Textiles & Garments">Textiles & Garments</option>
                  <option value="Metals & Minerals">Metals & Minerals</option>
                  <option value="Chemicals & Fertilizers">Chemicals & Fertilizers</option>
                  <option value="Electronics & Machinery">Electronics & Machinery</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Goods Name / Description *</label>
              <Input
                placeholder="e.g. Super Basmati Rice 50kg Bags"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Brand Name</label>
                <Input
                  placeholder="e.g. Mughal / Al-Habib"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Sizes / Specs</label>
                <Input
                  placeholder="e.g. 50kg / 25kg"
                  value={formData.sizes}
                  onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Origin Country</label>
              <SearchSelect
                label=""
                value={formData.originCountry}
                options={countries.map(c => ({ value: c.name, label: c.name }))}
                placeholder="Select Origin Country..."
                onValueChange={(val) => setFormData({ ...formData, originCountry: val })}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="goods_is_active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="goods_is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">Active Item in Catalog</label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Save Goods Item
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    <UniversalReportModal
      isOpen={showReport}
      onClose={() => setShowReport(false)}
      title="Goods Master Register"
      data={goods}
      columns={[
        { key: "chs_code", label: "CHS Code" },
        { key: "name", label: "Item Name" },
        { key: "category", label: "Category" },
        { key: "brand", label: "Brand" },
        { key: "origin_country", label: "Origin" },
        { key: "is_active", label: "Status", format: (v) => (v ? "Active" : "Inactive") }
      ]}
    />
    </>
  );
}
