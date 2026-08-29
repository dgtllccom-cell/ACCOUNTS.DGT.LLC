"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, Printer, X, Check, Package, Sparkles, Layers, Tag, FileText, Settings2, Edit2 } from "lucide-react";
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

type MasterParamRecord = {
  id: string;
  goods_id: string | null;
  param_type: "brand" | "size" | "variety" | "extra_details";
  param_code: string;
  param_value: string;
  sort_order: number;
  is_active: boolean;
};

export function GoodsMasterRegistry() {
  const lang = useActiveLanguage();
  const [goods, setGoods] = useState<GoodsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [showReport, setShowReport] = useState(false);

  // Database Parameters State (NO HARDCODING)
  const [dbParameters, setDbParameters] = useState<{
    brands: string[];
    sizes: string[];
    varieties: string[];
    extraDetails: string[];
  }>({
    brands: [],
    sizes: [],
    varieties: [],
    extraDetails: []
  });
  const [allDbParams, setAllDbParams] = useState<MasterParamRecord[]>([]);
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [paramTab, setParamTab] = useState<"brand" | "size" | "variety" | "extra_details">("variety");

  // New/Edit Parameter State
  const [newParamValue, setNewParamValue] = useState("");
  const [editingParamId, setEditingParamId] = useState<string | null>(null);
  const [editingParamValue, setEditingParamValue] = useState("");
  const [savingParam, setSavingParam] = useState(false);

  // Modal State for Goods
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

  async function loadMasterParameters(goodsNameFilter?: string) {
    try {
      const res = await apiGet<{
        parameters: MasterParamRecord[];
        grouped: { brands: string[]; sizes: string[]; varieties: string[]; extraDetails: string[] };
      }>(`/api/erp/goods/parameters?goodsName=${encodeURIComponent(goodsNameFilter || "Almond")}`);
      if (res.grouped) {
        setDbParameters({
          brands: res.grouped.brands || [],
          sizes: res.grouped.sizes || [],
          varieties: res.grouped.varieties || [],
          extraDetails: res.grouped.extraDetails || []
        });
      }
      if (res.parameters) {
        setAllDbParams(res.parameters);
      }
    } catch (err) {
      console.error("Failed to load master parameters from database:", err);
    }
  }

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
    loadMasterParameters("Almond");
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
    if (!window.confirm(t(lang, "gmr.confirm_delete_item", "Delete this goods item?"))) return;
    try {
      await apiDelete(`/api/erp/goods-master/${id}`);
      loadGoods();
    } catch (err: any) {
      alert(`${t(lang, "gmr.err_delete_item", "Failed to delete")}: ${err.message}`);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.chsCode) {
      alert(t(lang, "gmr.fill_required", "Please fill in HS Code and Goods Name."));
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
      loadMasterParameters("Almond");
    } catch (err: any) {
      alert(`${t(lang, "gmr.err_save", "Failed to save")}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Master Parameter CRUD handlers
  async function handleAddParameter(e: React.FormEvent) {
    e.preventDefault();
    if (!newParamValue.trim()) return;
    setSavingParam(true);
    try {
      await apiPost("/api/erp/goods/parameters", {
        paramType: paramTab,
        paramValue: newParamValue.trim(),
        sortOrder: (allDbParams.filter(p => p.param_type === paramTab).length || 0) + 1,
        isActive: true
      });
      setNewParamValue("");
      await loadMasterParameters("Almond");
    } catch (err: any) {
      alert(`${t(lang, "gmr.err_add_param", "Failed to add parameter")}: ${err.message}`);
    } finally {
      setSavingParam(false);
    }
  }

  async function handleUpdateParameter(id: string) {
    if (!editingParamValue.trim()) return;
    setSavingParam(true);
    try {
      await apiPatch("/api/erp/goods/parameters", {
        id,
        paramValue: editingParamValue.trim()
      });
      setEditingParamId(null);
      setEditingParamValue("");
      await loadMasterParameters("Almond");
    } catch (err: any) {
      alert(`${t(lang, "gmr.err_update_param", "Failed to update parameter")}: ${err.message}`);
    } finally {
      setSavingParam(false);
    }
  }

  async function handleToggleParamStatus(id: string, currentActive: boolean) {
    try {
      await apiPatch("/api/erp/goods/parameters", {
        id,
        isActive: !currentActive
      });
      await loadMasterParameters("Almond");
    } catch (err: any) {
      alert(`${t(lang, "gmr.err_status", "Failed to update status")}: ${err.message}`);
    }
  }

  async function handleDeleteParameter(id: string) {
    if (!window.confirm(t(lang, "gmr.confirm_delete_param", "Are you sure you want to delete this master parameter?"))) return;
    try {
      await apiDelete(`/api/erp/goods/parameters?id=${id}`);
      await loadMasterParameters("Almond");
    } catch (err: any) {
      alert(`${t(lang, "gmr.err_delete_param", "Failed to delete parameter")}: ${err.message}`);
    }
  }

  // Load the master parameters (Brand / Size / Variety / Extra Details) for the
  // typed goods name straight from the database — no hard-coded goods-specific
  // values or arrays. Prefill of the blank fields happens in the effect below
  // once the DB parameters arrive.
  function handleGoodsNameChange(val: string) {
    setFormData(prev => ({ ...prev, name: val }));
    const key = val.trim();
    if (key.length >= 3) loadMasterParameters(key);
  }

  // Prefill still-empty parameter fields from the database-driven values while
  // the "Add New Goods Master" modal is open. Never injects literal fallbacks.
  useEffect(() => {
    if (!isModalOpen) return;
    setFormData(prev => ({
      ...prev,
      brand: prev.brand || dbParameters.brands[0] || "",
      sizes: prev.sizes || dbParameters.sizes[0] || "",
      variety: prev.variety || dbParameters.varieties[0] || "",
      extraDetails: prev.extraDetails || dbParameters.extraDetails[0] || "",
    }));
  }, [dbParameters, isModalOpen]);

  return (
    <>
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="min-w-0">
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            {t(lang, "gmr.title", "Goods Master Registry")}
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(lang, "gmr.subtitle", "Goods Name → HS Code → Brand → Size → Variety → Extra Details")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button onClick={() => setIsParamModalOpen(true)} size="sm" variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/40">
            <Settings2 className="w-4 h-4 mr-1" /> {t(lang, "gmr.master_parameters_btn", "Master Parameters")}
          </Button>
          <Button onClick={() => setShowReport(true)} size="sm" variant="outline" className="border-slate-300 dark:border-slate-700">
            <Printer className="w-4 h-4 mr-1" /> {t(lang, "gmr.print_preview", "Print / PDF Report")}
          </Button>
          <Button onClick={() => setIsModalOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold">
            <Plus className="w-4 h-4 mr-1" /> {t(lang, "gmr.new_item", "Add New Goods Master")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder={t(lang, "gmr.search_ph", "Search by Goods Name, HS Code, Brand, Variety, or Specs...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full sm:max-w-md" />
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

    {/* Master Parameters Management Modal */}
    {isParamModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/30">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-amber-600" />
                {t(lang, "gmr.pm_title", "Goods Master Parameters Manager (Database-Driven)")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(lang, "gmr.pm_desc", "Add, Rename, Edit, or Deactivate Brands, Sizes, Varieties, and Extra Details in the live database.")}
              </p>
            </div>
            <button onClick={() => setIsParamModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Tabs for parameter types */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
              {(["variety", "brand", "size", "extra_details"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setParamTab(tab)}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors",
                    paramTab === tab
                      ? "border-amber-600 text-amber-600 dark:text-amber-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  {tab === "brand" ? t(lang, "gmr.pm_tab_brands", "1. Brands") : tab === "size" ? t(lang, "gmr.pm_tab_sizes", "2. Sizes") : tab === "variety" ? t(lang, "gmr.pm_tab_varieties", "3. Varieties") : t(lang, "gmr.pm_tab_extra", "4. Extra Details")}
                </button>
              ))}
            </div>

            {/* Add new parameter form */}
            <form onSubmit={handleAddParameter} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <Input
                placeholder={t(lang, "gmr.pm_add_ph", "Add new master entry…")}
                value={newParamValue}
                onChange={(e) => setNewParamValue(e.target.value)}
                className="bg-white dark:bg-slate-900"
              />
              <Button type="submit" disabled={savingParam || !newParamValue.trim()} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-semibold">
                {savingParam ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t(lang, "gmr.pm_add_btn", "Add Parameter")}
              </Button>
            </form>

            {/* Parameter List */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                    <Th className="p-3 text-left">#</Th>
                    <Th className="p-3 text-left">{t(lang, "gmr.pm_col_value", "Parameter Value")}</Th>
                    <Th className="p-3 text-center">Status</Th>
                    <Th className="p-3 text-center">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {allDbParams.filter(p => p.param_type === paramTab).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">{t(lang, "gmr.pm_no_records", "No records found in database.")}</td>
                    </tr>
                  ) : (
                    allDbParams.filter(p => p.param_type === paramTab).map((p, idx) => (
                      <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50">
                        <td className="p-3 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                          {editingParamId === p.id ? (
                            <div className="flex gap-2">
                              <Input
                                value={editingParamValue}
                                onChange={(e) => setEditingParamValue(e.target.value)}
                                className="h-8 text-xs"
                              />
                              <Button size="sm" onClick={() => handleUpdateParameter(p.id)} className="h-8 bg-emerald-600 text-white">{t(lang, "gmr.save", "Save")}</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingParamId(null)} className="h-8">{t(lang, "common.cancel", "Cancel")}</Button>
                            </div>
                          ) : (
                            p.param_value
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleParamStatus(p.id, p.is_active)}
                            className={cn("px-2 py-0.5 text-xs rounded-full font-semibold", p.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600")}
                          >
                            {p.is_active ? t(lang, "gmr.status_active", "Active") : t(lang, "gmr.status_inactive", "Inactive")}
                          </button>
                        </td>
                        <td className="p-3 text-center flex justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setEditingParamId(p.id); setEditingParamValue(p.param_value); }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                            title={t(lang, "gmr.pm_edit_title", "Edit / Rename Parameter")}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteParameter(p.id)}
                            className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                            title={t(lang, "gmr.pm_delete_title", "Delete Parameter")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end">
            <Button onClick={() => setIsParamModalOpen(false)} variant="outline">{t(lang, "gmr.pm_close", "Close Manager")}</Button>
          </div>
        </div>
      </div>
    )}

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
                {t(lang, "gmr.structured_flow", "Structured flow: Goods Name → HS Code → Brand → Size → Variety → Extra Details")}
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
                  <Package className="w-3.5 h-3.5 text-blue-600" /> {t(lang, "gmr.f_goods_name", "1. Goods Name")} *
                </label>
                <Input
                  placeholder={t(lang, "gmr.ph_goods_name", "e.g. Almond Kernel / Basmati Rice")}
                  value={formData.name}
                  onChange={(e) => handleGoodsNameChange(e.target.value)}
                  required
                  className="font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-600" /> {t(lang, "gmr.f_hs_code", "2. HS Code")} *
                </label>
                <Input
                  placeholder={t(lang, "gmr.ph_hs_code", "e.g. 0802.12.0000")}
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-600" /> {t(lang, "gmr.f_brand", "3. Brand Name")}
                  </label>
                  <button type="button" onClick={() => { setIsParamModalOpen(true); setParamTab("brand"); }} className="text-[11px] text-amber-600 hover:underline">
                    {t(lang, "gmr.manage_brands", "+ Manage Brands")}
                  </button>
                </div>
                <Input
                  placeholder={t(lang, "gmr.ph_brand", "e.g. Digital LLC / BG / Blue Diamond")}
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
                {dbParameters.brands.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dbParameters.brands.slice(0, 6).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setFormData({ ...formData, brand: b })}
                        className={cn(
                          "text-[11px] px-1.5 py-0.5 rounded border transition-colors",
                          formData.brand === b ? "bg-blue-600 text-white border-blue-600 font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" /> {t(lang, "gmr.f_size", "4. Size / Grade")}
                  </label>
                  <button type="button" onClick={() => { setIsParamModalOpen(true); setParamTab("size"); }} className="text-[11px] text-amber-600 hover:underline">
                    {t(lang, "gmr.manage_sizes", "+ Manage Sizes")}
                  </button>
                </div>
                <Input
                  placeholder={t(lang, "gmr.ph_size", "e.g. 18/20 / 20/22 / 23/25")}
                  value={formData.sizes}
                  onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
                />
                {dbParameters.sizes.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dbParameters.sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({ ...formData, sizes: s })}
                        className={cn(
                          "text-[11px] px-1.5 py-0.5 rounded border transition-colors",
                          formData.sizes === s ? "bg-blue-600 text-white border-blue-600 font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Variety (Field #5) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-600" /> {t(lang, "gmr.f_variety", "5. Variety (Database Master Attribute)")}
                </label>
                <button type="button" onClick={() => { setIsParamModalOpen(true); setParamTab("variety"); }} className="text-[11px] text-amber-600 hover:underline font-semibold">
                  {t(lang, "gmr.manage_varieties", "+ Manage Varieties")}
                </button>
              </div>
              <Input
                placeholder={t(lang, "gmr.ph_variety", "e.g. Nonpareil / Carmel / Independence / Butte / Marcona")}
                value={formData.variety}
                onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                className="border-amber-200 dark:border-amber-900/60 focus:ring-amber-500"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 py-0.5">{t(lang, "gmr.db_master_varieties", "Database Master Varieties:")}</span>
                {dbParameters.varieties.map((v) => (
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
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> {t(lang, "gmr.f_extra", "6. Extra Details / Specification")}
                </label>
                <button type="button" onClick={() => { setIsParamModalOpen(true); setParamTab("extra_details"); }} className="text-[11px] text-amber-600 hover:underline font-semibold">
                  {t(lang, "gmr.manage_specs", "+ Manage Specs")}
                </button>
              </div>
              <textarea
                rows={3}
                placeholder={t(lang, "gmr.ph_extra", "Enter quality description, shell/nut characteristics, color, shape, moisture, surface grade, packing specification, etc.")}
                value={formData.extraDetails}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, extraDetails: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {dbParameters.extraDetails.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-[11px] font-semibold text-slate-400 py-0.5">{t(lang, "gmr.preset_specs", "Preset Specs:")}</span>
                  {dbParameters.extraDetails.slice(0, 4).map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setFormData({ ...formData, extraDetails: ex })}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 truncate max-w-[200px]"
                      title={ex}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 5: Category & Origin */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">{t(lang, "gmr.f_category", "Category")}</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                >
                  <option value="Agriculture & Food">{t(lang, "gmr.cat_agriculture", "Agriculture & Food")}</option>
                  <option value="General Merchandise">{t(lang, "gmr.cat_general", "General Merchandise")}</option>
                  <option value="Textiles & Garments">{t(lang, "gmr.cat_textiles", "Textiles & Garments")}</option>
                  <option value="Metals & Minerals">{t(lang, "gmr.cat_metals", "Metals & Minerals")}</option>
                  <option value="Chemicals & Fertilizers">{t(lang, "gmr.cat_chemicals", "Chemicals & Fertilizers")}</option>
                  <option value="Electronics & Machinery">{t(lang, "gmr.cat_electronics", "Electronics & Machinery")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">{t(lang, "gmr.f_origin", "Origin Country")}</label>
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
              <label htmlFor="goods_is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t(lang, "gmr.active_record", "Active Goods Record")}</label>
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
        { key: "chs_code", label: translateHeader(lang, "HS Code") },
        { key: "name", label: translateHeader(lang, "Goods Name") },
        { key: "category", label: translateHeader(lang, "Category") },
        { key: "brand", label: translateHeader(lang, "Brand") },
        { key: "sizes", label: translateHeader(lang, "Size") },
        { key: "variety", label: translateHeader(lang, "Variety") },
        { key: "extra_details", label: translateHeader(lang, "Extra Details / Specification") },
        { key: "origin_country", label: translateHeader(lang, "Origin") },
        { key: "is_active", label: translateHeader(lang, "Status"), format: (v) => (v ? t(lang, "gmr.status_active", "Active") : t(lang, "gmr.status_inactive", "Inactive")) }
      ]}
    />
    </>
  );
}
