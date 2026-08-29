"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, Printer, X, Check, Package, Sparkles, Layers, Tag, FileText } from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { SearchSelect } from "@/components/ui/search-select";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

type GoodsRecord = {
  id: string;
  chs_code: string;
  name: string;
  category: string;
  brand: string;
  origin_country: string;
  sizes: string;
  variety: string;
  extra_details: string;
  is_active: boolean;
  created_at: string;
};

const ALMOND_VARIETIES = [
  "Aldrich", "Butte", "Carmel", "Fritz", "Independence", 
  "Marcona", "Monterey", "Nonpareil", "Padre", "Price", "Sonora", "Wood Colony"
];

export function GoodsMasterRegistry() {
  const lang = useActiveLanguage();
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
    category: "Agriculture & Food",
    brand: "",
    originCountry: "",
    sizes: "",
    variety: "",
    extraDetails: "",
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
    return goods.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.chs_code.toLowerCase().includes(q) ||
      (g.brand && g.brand.toLowerCase().includes(q)) ||
      (g.variety && g.variety.toLowerCase().includes(q)) ||
      (g.extra_details && g.extra_details.toLowerCase().includes(q))
    );
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
        category: "Agriculture & Food",
        brand: "",
        originCountry: "",
        sizes: "",
        variety: "",
        extraDetails: "",
        isActive: true
      });
      loadGoods();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Auto pre-fill Almond Kernel details if selected
  function handleGoodsNameChange(val: string) {
    if (val.toLowerCase().includes("almond")) {
      setFormData(prev => ({
        ...prev,
        name: val,
        chsCode: prev.chsCode || "0802.12.0000",
        category: "Agriculture & Food",
        variety: prev.variety || "Nonpareil",
        sizes: prev.sizes || "20/22",
        brand: prev.brand || "CALIFORNIA GOLD",
        extraDetails: prev.extraDetails || "Grade A Sweet Almond Kernels, Medium Flattish Shape, Smooth Light Brown Skin, Shell-Free, Max 5% Moisture"
      }));
    } else {
      setFormData(prev => ({ ...prev, name: val }));
    }
  }

  return (
    <>
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            {t(lang, "gmr.title", "Goods Master Registry")}
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(lang, "gmr.subtitle", "Goods Name → HS Code → Brand → Size → Variety → Extra Details")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowReport(true)} size="sm" variant="outline" className="border-slate-300 dark:border-slate-700">
            <Printer className="w-4 h-4 mr-1" /> {t(lang, "gmr.print_preview", "Print / PDF Report")}
          </Button>
          <Button onClick={() => setIsModalOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold">
            <Plus className="w-4 h-4 mr-1" /> {t(lang, "gmr.new_item", "Add New Goods Master")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex gap-2">
          <Input placeholder={t(lang, "gmr.search_ph", "Search by Goods Name, HS Code, Brand, Variety, or Specs...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm">
            <option value="all">{t(lang, "gmr.all_status", "All Statuses")}</option>
            <option value="Active">{t(lang, "gmr.active_only", "Active Only")}</option>
            <option value="Inactive">{t(lang, "gmr.inactive_only", "Inactive Only")}</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{translateHeader(lang, "TOTAL")}</div>
            <div className="text-2xl font-bold text-blue-950 dark:text-blue-200 mt-1">{summary.total}</div>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{translateHeader(lang, "ACTIVE")}</div>
            <div className="text-2xl font-bold text-emerald-950 dark:text-emerald-200 mt-1">{summary.active}</div>
          </div>
          <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">{translateHeader(lang, "INACTIVE")}</div>
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
                  <Th className="p-3 text-left">HS Code</Th>
                  <Th className="p-3 text-left">Goods Name</Th>
                  <Th className="p-3 text-left">Brand</Th>
                  <Th className="p-3 text-left">Size</Th>
                  <Th className="p-3 text-left">Variety</Th>
                  <Th className="p-3 text-left">Extra Details / Specs</Th>
                  <Th className="p-3 text-center">Status</Th>
                  <Th className="p-3 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">{t(lang, "gmr.no_records", "No goods master records found.")}</td>
                  </tr>
                ) : (
                  filtered.map((g, idx) => (
                    <tr key={g.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{g.chs_code}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{g.name}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{g.brand || '-'}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{g.sizes || '-'}</td>
                      <td className="p-3">
                        {g.variety ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                            <Tag className="w-3 h-3 mr-1" />
                            {g.variety}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 text-xs max-w-xs truncate" title={g.extra_details}>
                        {g.extra_details || '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", g.is_active ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300")}>
                          {g.is_active ? translateHeader(lang, "ACTIVE") : translateHeader(lang, "INACTIVE")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDelete(g.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 rounded transition-colors" title={t(lang, "gmr.delete_item_title", "Delete Goods Item")}>
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

    {/* New Goods Master Modal — Full 6-Part Structure */}
    {isModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                {t(lang, "gmr.add_new_item", "ADD NEW GOODS MASTER ENTRY")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Structured flow: Goods Name → HS Code → Brand → Size → Variety → Extra Details
              </p>
            </div>
            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            
            {/* Row 1: Goods Name & HS Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-blue-600" /> 1. GOODS NAME *
                </label>
                <Input
                  placeholder="e.g. Almond Kernel / Basmati Rice"
                  value={formData.name}
                  onChange={(e) => handleGoodsNameChange(e.target.value)}
                  required
                  className="font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-600" /> 2. HS CODE *
                </label>
                <Input
                  placeholder="e.g. 0802.12.0000"
                  value={formData.chsCode}
                  onChange={(e) => setFormData({ ...formData, chsCode: e.target.value.toUpperCase() })}
                  required
                  className="font-mono font-bold text-blue-600"
                />
              </div>
            </div>

            {/* Row 2: Brand & Size */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600" /> 3. BRAND NAME
                </label>
                <Input
                  placeholder="e.g. CALIFORNIA GOLD / BLUE DIAMOND"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" /> 4. SIZE / GRADE
                </label>
                <Input
                  placeholder="e.g. 20/22 / 23/25 / 50kg Bags"
                  value={formData.sizes}
                  onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Variety (Field #5) */}
            <div>
              <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-600" /> 5. VARIETY (SEPARATE MASTER ATTRIBUTE)
              </label>
              <Input
                placeholder="e.g. Nonpareil / Carmel / Independence / Butte / Marcona"
                value={formData.variety}
                onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                className="border-amber-200 dark:border-amber-900/60 focus:ring-amber-500"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 py-0.5">Almond Chart Varieties:</span>
                {ALMOND_VARIETIES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormData({ ...formData, variety: v })}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded border transition-colors",
                      formData.variety === v
                        ? "bg-amber-600 text-white border-amber-600 font-bold"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 4: Extra Details / Specification (Field #6) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-600" /> 6. EXTRA DETAILS / SPECIFICATION
              </label>
              <textarea
                rows={3}
                placeholder="Enter quality description, shell/nut characteristics, color, shape, moisture, surface grade, packing specification, etc."
                value={formData.extraDetails}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, extraDetails: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Row 5: Category & Origin */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">CATEGORY</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                >
                  <option value="Agriculture & Food">Agriculture & Food</option>
                  <option value="General Merchandise">General Merchandise</option>
                  <option value="Textiles & Garments">Textiles & Garments</option>
                  <option value="Metals & Minerals">Metals & Minerals</option>
                  <option value="Chemicals & Fertilizers">Chemicals & Fertilizers</option>
                  <option value="Electronics & Machinery">Electronics & Machinery</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">ORIGIN COUNTRY</label>
                <SearchSelect
                  label=""
                  value={formData.originCountry}
                  options={countries.map(c => ({ value: c.name, label: c.name }))}
                  placeholder={t(lang, "gmr.select_origin_ph", "Select Origin Country...")}
                  onValueChange={(val) => setFormData({ ...formData, originCountry: val })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="goods_is_active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="goods_is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">Active Goods Record</label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                {t(lang, "common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                {t(lang, "gmr.save_item", "Save Goods Master")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    <UniversalReportModal
      isOpen={showReport}
      onClose={() => setShowReport(false)}
      title={t(lang, "gmr.register_title", "Goods Master & Product Catalog Report")}
      data={goods}
      columns={[
        { key: "chs_code", label: "HS Code" },
        { key: "name", label: "Goods Name" },
        { key: "category", label: "Category" },
        { key: "brand", label: "Brand" },
        { key: "sizes", label: "Size" },
        { key: "variety", label: "Variety" },
        { key: "extra_details", label: "Extra Details / Specification" },
        { key: "origin_country", label: "Origin" },
        { key: "is_active", label: "Status", format: (v) => (v ? "Active" : "Inactive") }
      ]}
    />
    </>
  );
}
