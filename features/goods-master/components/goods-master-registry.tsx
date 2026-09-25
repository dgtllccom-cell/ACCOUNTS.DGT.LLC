"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Minus,
  Trash2,
  Printer,
  X,
  Check,
  Package,
  Layers,
  Search,
  Settings2,
  Edit2,
  Camera,
  ChevronDown,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

export type GoodsVariation = {
  id: string;
  goods_id: string;
  brand: string;
  size: string;
  extra_details: string;
  variety?: string;
  is_active: boolean;
  created_at: string;
};

export type GoodsRecord = {
  id: string;
  chs_code: string;
  name: string;
  category: string;
  brand?: string;
  sizes?: string;
  extra_details?: string;
  variety?: string;
  origin_country: string;
  origin_country_id?: string | null;
  is_active: boolean;
  created_at: string;
  variations: GoodsVariation[];
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [expandedGoodsIds, setExpandedGoodsIds] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);

  // Countries
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);

  // Database Parameters
  const [dbParameters, setDbParameters] = useState<{
    brands: string[];
    sizes: string[];
    extraDetails: string[];
  }>({
    brands: [],
    sizes: [],
    extraDetails: [],
  });
  const [allDbParams, setAllDbParams] = useState<MasterParamRecord[]>([]);
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [paramTab, setParamTab] = useState<"brand" | "size" | "extra_details">("brand");
  const [newParamValue, setNewParamValue] = useState("");
  const [editingParamId, setEditingParamId] = useState<string | null>(null);
  const [editingParamValue, setEditingParamValue] = useState("");
  const [savingParam, setSavingParam] = useState(false);

  // Step 1 Modal — Basic Goods Item
  const [isStep1Open, setIsStep1Open] = useState(false);
  const [savingStep1, setSavingStep1] = useState(false);
  const [step1Image, setStep1Image] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step1Form, setStep1Form] = useState({
    name: "",
    chsCode: "",
    originCountry: "",
    originCountryId: "",
  });

  // Step 2 Modal — Variant Details
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [activeGoodsForVariant, setActiveGoodsForVariant] = useState<GoodsRecord | null>(null);
  const [editingVariant, setEditingVariant] = useState<GoodsVariation | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);
  const [variantForm, setVariantForm] = useState({
    brand: "",
    size: "",
    extraDetails: "",
  });

  // Edit Basic Goods Item Modal
  const [isEditGoodsOpen, setIsEditGoodsOpen] = useState(false);
  const [savingEditGoods, setSavingEditGoods] = useState(false);
  const [editGoodsForm, setEditGoodsForm] = useState({
    id: "",
    name: "",
    chsCode: "",
    originCountry: "",
    originCountryId: "",
    isActive: true,
  });

  // Load Countries
  async function loadCountries() {
    try {
      const res = await apiGet<{ countries: { id: string; name: string }[] }>("/api/erp/locations/countries");
      const list = (res.countries || []).filter((c) => !c.name.startsWith("QA ") && !c.name.includes("DEVTEST"));
      setCountries(list);
    } catch (err) {
      console.error("Failed to load countries:", err);
    }
  }

  // Load Master Parameters
  async function loadMasterParameters(goodsNameFilter?: string) {
    try {
      const res = await apiGet<{
        parameters: MasterParamRecord[];
        grouped: { brands: string[]; sizes: string[]; varieties: string[]; extraDetails: string[] };
      }>(`/api/erp/goods/parameters?goodsName=${encodeURIComponent(goodsNameFilter || "Walnut")}`);
      if (res.grouped) {
        setDbParameters({
          brands: res.grouped.brands || [],
          sizes: res.grouped.sizes || [],
          extraDetails: res.grouped.extraDetails || [],
        });
      }
      if (res.parameters) {
        setAllDbParams(res.parameters);
      }
    } catch (err) {
      console.error("Failed to load master parameters:", err);
    }
  }

  // Load Goods List
  async function loadGoods(keepExpandedId?: string) {
    setLoading(true);
    try {
      const statusParam = statusFilter === "all" ? "" : statusFilter;
      const res = await apiGet<{ goods: GoodsRecord[]; summary: typeof summary }>(
        `/api/erp/goods-master?limit=500&status=${statusParam}`
      );
      const list = res.goods || [];
      setGoods(list);
      setSummary(res.summary || { total: list.length, active: list.filter((g) => g.is_active).length, inactive: list.filter((g) => !g.is_active).length });

      if (keepExpandedId) {
        setExpandedGoodsIds((prev) => new Set([...prev, keepExpandedId]));
      }
    } catch (err) {
      console.error("Failed to load goods:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoods();
    loadCountries();
    loadMasterParameters("Walnut");
  }, [statusFilter]);

  // Toggle Row Expansion
  function toggleRowExpand(goodsId: string) {
    setExpandedGoodsIds((prev) => {
      const next = new Set(prev);
      if (next.has(goodsId)) {
        next.delete(goodsId);
      } else {
        next.add(goodsId);
      }
      return next;
    });
  }

  // Filter Goods
  const filteredGoods = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return goods;
    return goods.filter((g) => {
      const inBasic =
        g.name.toLowerCase().includes(q) ||
        g.chs_code.toLowerCase().includes(q) ||
        g.origin_country.toLowerCase().includes(q);
      const inVariants = (g.variations || []).some(
        (v) =>
          v.brand.toLowerCase().includes(q) ||
          v.size.toLowerCase().includes(q) ||
          v.extra_details.toLowerCase().includes(q)
      );
      return inBasic || inVariants;
    });
  }, [searchQuery, goods]);

  // STEP 1: Save Basic Goods Item
  async function handleSaveStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!step1Form.name.trim() || !step1Form.chsCode.trim()) {
      alert("Please fill in Goods Name and HS Code.");
      return;
    }
    setSavingStep1(true);
    try {
      const res = await apiPost<{ id: string }>("/api/erp/goods-master", {
        name: step1Form.name.trim(),
        chsCode: step1Form.chsCode.trim().toUpperCase(),
        originCountry: step1Form.originCountry.trim() || null,
        originCountryId: step1Form.originCountryId || null,
        category: "Agriculture & Food",
        isActive: true,
      });

      const newId = res.id;
      setIsStep1Open(false);
      setStep1Form({ name: "", chsCode: "", originCountry: "", originCountryId: "" });
      setStep1Image(null);

      // Reload and expand the new goods row
      await loadGoods(newId);
    } catch (err: any) {
      alert(`Failed to save Basic Goods Item: ${err.message}`);
    } finally {
      setSavingStep1(false);
    }
  }

  // Image Upload simulation
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setStep1Image(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  // STEP 2: Open Variant Modal
  function openAddVariantModal(goodsItem: GoodsRecord) {
    setActiveGoodsForVariant(goodsItem);
    setEditingVariant(null);
    setVariantForm({
      brand: dbParameters.brands[0] || "DGT LLC",
      size: dbParameters.sizes[0] || "",
      extraDetails: "",
    });
    setIsVariantModalOpen(true);
  }

  function openEditVariantModal(goodsItem: GoodsRecord, variant: GoodsVariation) {
    setActiveGoodsForVariant(goodsItem);
    setEditingVariant(variant);
    setVariantForm({
      brand: variant.brand,
      size: variant.size,
      extraDetails: variant.extra_details,
    });
    setIsVariantModalOpen(true);
  }

  // Save Variant
  async function handleSaveVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!activeGoodsForVariant) return;
    if (!variantForm.brand.trim() || !variantForm.size.trim()) {
      alert("Please provide Brand and Size/Grade.");
      return;
    }

    setSavingVariant(true);
    try {
      if (editingVariant) {
        // Edit variant
        await apiPatch(`/api/erp/goods-master/variations/${editingVariant.id}`, {
          brand: variantForm.brand.trim(),
          size: variantForm.size.trim(),
          extraDetails: variantForm.extraDetails.trim() || null,
        });
      } else {
        // Add new variant
        await apiPost(`/api/erp/goods-master/${activeGoodsForVariant.id}/variations`, {
          brand: variantForm.brand.trim(),
          size: variantForm.size.trim(),
          extraDetails: variantForm.extraDetails.trim() || null,
        });
      }

      setIsVariantModalOpen(false);
      await loadGoods(activeGoodsForVariant.id);
    } catch (err: any) {
      alert(`Failed to save variant: ${err.message}`);
    } finally {
      setSavingVariant(false);
    }
  }

  // Delete Variant
  async function handleDeleteVariant(goodsId: string, variant: GoodsVariation) {
    if (!window.confirm(`Delete variant "${variant.brand} - ${variant.size}"?`)) return;
    try {
      await apiDelete(`/api/erp/goods-master/variations/${variant.id}`);
      await loadGoods(goodsId);
    } catch (err: any) {
      alert(`Failed to delete variant: ${err.message}`);
    }
  }

  // Open Edit Basic Goods Modal
  function openEditGoodsModal(item: GoodsRecord) {
    setEditGoodsForm({
      id: item.id,
      name: item.name,
      chsCode: item.chs_code,
      originCountry: item.origin_country,
      originCountryId: item.origin_country_id || "",
      isActive: item.is_active,
    });
    setIsEditGoodsOpen(true);
  }

  // Save Edit Basic Goods
  async function handleSaveEditGoods(e: React.FormEvent) {
    e.preventDefault();
    if (!editGoodsForm.name.trim() || !editGoodsForm.chsCode.trim()) {
      alert("Please fill in Goods Name and HS Code.");
      return;
    }
    setSavingEditGoods(true);
    try {
      await apiPatch(`/api/erp/goods-master/${editGoodsForm.id}`, {
        name: editGoodsForm.name.trim(),
        chsCode: editGoodsForm.chsCode.trim().toUpperCase(),
        originCountry: editGoodsForm.originCountry.trim() || null,
        originCountryId: editGoodsForm.originCountryId || null,
        isActive: editGoodsForm.isActive,
      });
      setIsEditGoodsOpen(false);
      await loadGoods(editGoodsForm.id);
    } catch (err: any) {
      alert(`Failed to update Goods item: ${err.message}`);
    } finally {
      setSavingEditGoods(false);
    }
  }

  // Delete Basic Goods Item
  async function handleDeleteGoods(item: GoodsRecord) {
    if (!window.confirm(`Delete Goods Master item "${item.name}" and all its linked variants?`)) return;
    try {
      await apiDelete(`/api/erp/goods-master/${item.id}`);
      await loadGoods();
    } catch (err: any) {
      alert(`Failed to delete Goods item: ${err.message}`);
    }
  }

  // Parameter CRUD Handlers
  async function handleAddParameter(e: React.FormEvent) {
    e.preventDefault();
    if (!newParamValue.trim()) return;
    setSavingParam(true);
    try {
      await apiPost("/api/erp/goods/parameters", {
        paramType: paramTab,
        paramValue: newParamValue.trim(),
        sortOrder: (allDbParams.filter((p) => p.param_type === paramTab).length || 0) + 1,
        isActive: true,
      });
      setNewParamValue("");
      await loadMasterParameters("Walnut");
    } catch (err: any) {
      alert(`Failed to add parameter: ${err.message}`);
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
        paramValue: editingParamValue.trim(),
      });
      setEditingParamId(null);
      setEditingParamValue("");
      await loadMasterParameters("Walnut");
    } catch (err: any) {
      alert(`Failed to update parameter: ${err.message}`);
    } finally {
      setSavingParam(false);
    }
  }

  async function handleToggleParamStatus(id: string, currentActive: boolean) {
    try {
      await apiPatch("/api/erp/goods/parameters", {
        id,
        isActive: !currentActive,
      });
      await loadMasterParameters("Walnut");
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  }

  async function handleDeleteParameter(id: string) {
    if (!window.confirm("Are you sure you want to delete this master parameter?")) return;
    try {
      await apiDelete(`/api/erp/goods/parameters?id=${id}`);
      await loadMasterParameters("Walnut");
    } catch (err: any) {
      alert(`Failed to delete parameter: ${err.message}`);
    }
  }

  return (
    <>
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
        {/* Top Header */}
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-6 py-5 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {translateHeader(lang, "GOODS MASTER")}
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {translateHeader(lang, "MANAGE GLOBAL PRODUCT, GOODS CATALOG AND HS CLASSIFICATIONS")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={() => setIsParamModalOpen(true)}
              size="sm"
              variant="outline"
              className="border-amber-300 dark:border-amber-700/80 text-amber-700 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-semibold px-3.5 h-9"
            >
              <Settings2 className="w-3.5 h-3.5 mr-1.5" />
              {translateHeader(lang, "MASTER PARAMETERS")}
            </Button>

            <Button
              onClick={() => setShowReport(true)}
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium px-3.5 h-9"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              {translateHeader(lang, "PRINT PREVIEW")}
            </Button>

            <Button
              onClick={() => {
                setStep1Form({
                  name: "",
                  chsCode: "",
                  originCountry: countries[0]?.name || "Chile",
                  originCountryId: countries[0]?.id || "",
                });
                setIsStep1Open(true);
              }}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-9 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {translateHeader(lang, "NEW GOODS ITEM")}
            </Button>
          </div>
        </CardHeader>

        {/* Filter and Metric Cards Bar */}
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search and Status Filter */}
            <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder={translateHeader(lang, "SEARCH BY NAME, HS CODE, OR ORIGIN...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-sm bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-800 rounded-lg focus-visible:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  aria-label={translateHeader(lang, "FILTER GOODS BY STATUS")}
                  className="h-10 px-3.5 pr-8 border rounded-lg bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">{translateHeader(lang, "ALL STATUS")}</option>
                  <option value="active">{translateHeader(lang, "ACTIVE ONLY")}</option>
                  <option value="inactive">{translateHeader(lang, "INACTIVE ONLY")}</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Metric Cards (Inline compact badges matching approved reference) */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-150 dark:border-blue-900/60 px-4 py-2 rounded-lg min-w-[90px]">
                <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                  {translateHeader(lang, "TOTAL")}
                </div>
                <div className="text-xl font-bold text-blue-950 dark:text-blue-200 leading-tight">
                  {summary.total}
                </div>
              </div>

              <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-150 dark:border-emerald-900/60 px-4 py-2 rounded-lg min-w-[90px]">
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                  {translateHeader(lang, "ACTIVE")}
                </div>
                <div className="text-xl font-bold text-emerald-950 dark:text-emerald-200 leading-tight">
                  {summary.active}
                </div>
              </div>

              <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-150 dark:border-rose-900/60 px-4 py-2 rounded-lg min-w-[90px]">
                <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                  {translateHeader(lang, "INACTIVE")}
                </div>
                <div className="text-xl font-bold text-rose-950 dark:text-rose-200 leading-tight">
                  {summary.inactive}
                </div>
              </div>
            </div>
          </div>

          {/* Main Goods Table */}
          {loading ? (
            <div className="p-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading Goods Master catalog...</p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                    <Th className="p-3.5 text-center w-12">#</Th>
                    <Th className="p-3.5 text-left w-36">{translateHeader(lang, "HS Code")}</Th>
                    <Th className="p-3.5 text-left">{translateHeader(lang, "Goods Name")}</Th>
                    <Th className="p-3.5 text-left w-48">{translateHeader(lang, "Origin")}</Th>
                    <Th className="p-3.5 text-center w-48">{translateHeader(lang, "Actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredGoods.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400">
                        <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                        <p className="text-sm font-medium">No goods items found.</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Click "+ New Goods Item" above to add your first master product.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredGoods.map((g, idx) => {
                      const isExpanded = expandedGoodsIds.has(g.id);
                      const varCount = (g.variations || []).length;

                      return (
                        <React.Fragment key={g.id}>
                          <tr
                            className={cn(
                              "transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40",
                              isExpanded && "bg-slate-50/90 dark:bg-slate-850/60 font-medium"
                            )}
                          >
                            {/* # */}
                            <td className="p-3.5 text-center text-slate-400 text-xs font-mono">
                              {idx + 1}
                            </td>

                            {/* HS Code */}
                            <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                              {g.chs_code}
                            </td>

                            {/* Goods Name */}
                            <td className="p-3.5 font-semibold text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <span>{g.name}</span>
                                {varCount > 0 && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal">
                                    {varCount} {varCount === 1 ? "variant" : "variants"}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Origin */}
                            <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">
                              {g.origin_country || "-"}
                            </td>

                            {/* Actions: [+] or [-], ACTIVE/INACTIVE, Edit, Delete */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {/* Circular + or - Button */}
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpand(g.id)}
                                  className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-white transition-all shadow-sm shrink-0",
                                    isExpanded
                                      ? "bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-300 dark:ring-blue-900"
                                      : "bg-blue-600 hover:bg-blue-700"
                                  )}
                                  title={isExpanded ? "Collapse variants" : "Expand variants"}
                                >
                                  {isExpanded ? (
                                    <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                  )}
                                </button>

                                {/* Status Pill Badge */}
                                <span
                                  className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider",
                                    g.is_active
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                                  )}
                                >
                                  {g.is_active
                                    ? translateHeader(lang, "ACTIVE")
                                    : translateHeader(lang, "INACTIVE")}
                                </span>

                                {/* Blue Edit Icon Button */}
                                <button
                                  type="button"
                                  onClick={() => openEditGoodsModal(g)}
                                  className="w-7 h-7 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-xs"
                                  title={translateHeader(lang, "EDIT BASIC GOODS ITEM")}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Red Trash Icon Button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGoods(g)}
                                  className="w-7 h-7 rounded bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs"
                                  title={translateHeader(lang, "DELETE GOODS MASTER ITEM")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Secondary Section (STEP 2: Variants Sub-table) */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70 dark:bg-slate-900/60">
                              <td colSpan={5} className="p-0 border-b border-slate-200 dark:border-slate-800">
                                <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-50/90 to-white dark:from-slate-900/80 dark:to-slate-950 border-t border-slate-200 dark:border-slate-800">
                                  {/* Sub-table Panel Header */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                        <Layers className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                          {translateHeader(lang, "VARIANTS / DETAILS FOR THIS GOODS ITEM")}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          {translateHeader(
                                            lang,
                                            "YOU CAN ADD MULTIPLE BRANDS, SIZES AND EXTRA DETAILS FOR THIS ITEM."
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    <Button
                                      onClick={() => openAddVariantModal(g)}
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 h-8 shadow-xs"
                                    >
                                      <Plus className="w-3.5 h-3.5 mr-1" />
                                      {translateHeader(lang, "+ ADD NEW VARIANT")}
                                    </Button>
                                  </div>

                                  {/* Sub-table for Variants */}
                                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                                          <Th className="p-2.5 text-center w-12">#</Th>
                                          <Th className="p-2.5 text-left w-48">{translateHeader(lang, "Brand")}</Th>
                                          <Th className="p-2.5 text-left w-36">{translateHeader(lang, "SIZE / GRADE")}</Th>
                                          <Th className="p-2.5 text-left">{translateHeader(lang, "EXTRA DETAILS / SPECIFICATION")}</Th>
                                          <Th className="p-2.5 text-center w-28">{translateHeader(lang, "Actions")}</Th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {(g.variations || []).length === 0 ? (
                                          <tr>
                                            <td colSpan={5} className="p-6 text-center text-slate-400">
                                              No variants added yet for this item. Click{" "}
                                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                "+ Add New Variant"
                                              </span>{" "}
                                              above to add multiple Brand, Size/Grade and specifications.
                                            </td>
                                          </tr>
                                        ) : (
                                          g.variations.map((v, vIdx) => (
                                            <tr
                                              key={v.id}
                                              className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors"
                                            >
                                              <td className="p-2.5 text-center text-slate-400 font-mono">
                                                {vIdx + 1}
                                              </td>
                                              <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                                                {v.brand || "-"}
                                              </td>
                                              <td className="p-2.5 font-mono font-medium text-slate-700 dark:text-slate-300">
                                                {v.size || "-"}
                                              </td>
                                              <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                                {v.extra_details ? (
                                                  <span className="leading-relaxed">{v.extra_details}</span>
                                                ) : (
                                                  <span className="text-slate-400 italic">No extra specs</span>
                                                )}
                                              </td>
                                              <td className="p-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => openEditVariantModal(g, v)}
                                                    className="w-6 h-6 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-xs"
                                                    title={translateHeader(lang, "EDIT VARIANT")}
                                                  >
                                                    <Edit2 className="w-3 h-3" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteVariant(g.id, v)}
                                                    className="w-6 h-6 rounded bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs"
                                                    title={translateHeader(lang, "DELETE VARIANT")}
                                                  >
                                                    <Trash2 className="w-3 h-3" />
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
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* STEP 1 MODAL: ADD NEW GOODS ITEM (BASIC - SAVE ONLY ONCE)                 */}
      {/* Strictly matching approved reference design in media_1790362353366.png   */}
      {/* ========================================================================= */}
      {isStep1Open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {translateHeader(lang, "ADD NEW GOODS ITEM (STEP 1)")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {translateHeader(
                      lang,
                      "ENTER BASIC INFORMATION FIRST. AFTER SAVING, YOU CAN ADD MULTIPLE BRANDS, SIZES AND DETAILS."
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStep1Open(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns */}
            <form onSubmit={handleSaveStep1} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Left Column: Image Box & Upload Button */}
                <div className="md:col-span-4 flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/60 dark:bg-slate-850/50 text-center">
                  <div className="w-28 h-28 rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3 shadow-xs relative">
                    {step1Image ? (
                      <img src={step1Image} alt="Goods Preview" className="w-full h-full object-cover" />
                    ) : (
                      /* Styled Walnut Graphic matching reference */
                      <div className="p-2 flex flex-col items-center justify-center">
                        <svg
                          className="w-16 h-16 text-amber-600 dark:text-amber-500"
                          viewBox="0 0 64 64"
                          fill="currentColor"
                        >
                          <circle cx="28" cy="30" r="18" fill="#D97706" opacity="0.85" />
                          <circle cx="40" cy="36" r="16" fill="#B45309" opacity="0.9" />
                          <ellipse cx="28" cy="30" rx="6" ry="14" fill="#92400E" opacity="0.75" />
                          <ellipse cx="40" cy="36" rx="5" ry="12" fill="#78350F" opacity="0.75" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs font-semibold px-3 border-slate-300 dark:border-slate-700"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1" />
                    Upload Image
                  </Button>

                  <span className="text-[10px] text-slate-400 mt-1.5 font-medium">JPG, PNG (Max 2MB)</span>
                </div>

                {/* Right Column: 3 Basic Fields (Goods Name, HS Code, Origin) */}
                <div className="md:col-span-8 space-y-4">
                  {/* 1. GOODS NAME * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      1. {translateHeader(lang, "GOODS NAME")} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        placeholder="e.g. WALNUT IN SHELL"
                        value={step1Form.name}
                        onChange={(e) => setStep1Form({ ...step1Form, name: e.target.value })}
                        required
                        className="h-10 text-sm font-semibold pr-8"
                      />
                      {step1Form.name && (
                        <button
                          type="button"
                          onClick={() => setStep1Form({ ...step1Form, name: "" })}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. HS CODE * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      2. {translateHeader(lang, "HS / CHS CODE")} <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="e.g. 08023200"
                        value={step1Form.chsCode}
                        onChange={(e) => setStep1Form({ ...step1Form, chsCode: e.target.value.toUpperCase() })}
                        required
                        className="h-10 font-mono font-bold text-blue-600 dark:text-blue-400 text-sm flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 px-3 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 3. ORIGIN COUNTRY * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      3. {translateHeader(lang, "ORIGIN COUNTRY")} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={step1Form.originCountry}
                        onChange={(e) => {
                          const cName = e.target.value;
                          const found = countries.find((c) => c.name === cName);
                          setStep1Form({
                            ...step1Form,
                            originCountry: cName,
                            originCountryId: found ? found.id : "",
                          });
                        }}
                        required
                        aria-label={translateHeader(lang, "SELECT ORIGIN COUNTRY")}
                        className="w-full h-10 px-3.5 pr-8 border rounded-lg bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">Select Origin Country...</option>
                        {countries.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer: Cancel & Save Basic Item */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-150 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStep1Open(false)}
                  className="px-5 h-9 text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingStep1}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 h-9 shadow-sm"
                >
                  {savingStep1 ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1.5" />
                  )}
                  {translateHeader(lang, "SAVE BASIC ITEM")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2 MODAL: ADD / EDIT VARIANT (MULTIPLE VARIANTS PER BASIC ITEM)       */}
      {/* Brand, Size/Grade, Extra Details/Specification (NO separate Variety box)   */}
      {/* ========================================================================= */}
      {isVariantModalOpen && activeGoodsForVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingVariant ? "Edit Variant" : "Add New Variant"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    For: <span className="font-semibold text-slate-800 dark:text-slate-200">{activeGoodsForVariant.name}</span>{" "}
                    ({activeGoodsForVariant.chs_code} • {activeGoodsForVariant.origin_country})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="p-6 space-y-4">
              {/* Brand Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Brand <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. DGT LLC / ABC BRAND"
                  value={variantForm.brand}
                  onChange={(e) => setVariantForm({ ...variantForm, brand: e.target.value })}
                  required
                  className="font-medium h-9 text-sm"
                />
                {dbParameters.brands.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dbParameters.brands.slice(0, 5).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setVariantForm({ ...variantForm, brand: b })}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded border transition-colors",
                          variantForm.brand === b
                            ? "bg-blue-600 text-white border-blue-600 font-bold"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Size / Grade Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Size / Grade <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. 34-36 MM / 32-34 MM"
                  value={variantForm.size}
                  onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
                  required
                  className="font-medium h-9 text-sm font-mono"
                />
                {dbParameters.sizes.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dbParameters.sizes.slice(0, 6).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setVariantForm({ ...variantForm, size: s })}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded border transition-colors",
                          variantForm.size === s
                            ? "bg-blue-600 text-white border-blue-600 font-bold"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Extra Details / Specification Field (includes quality, yield, color notes) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Extra Details / Specification
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Kernel Yield: 50% | 90% Light, 10% Dark | Premium Export Quality"
                  value={variantForm.extraDetails}
                  onChange={(e) => setVariantForm({ ...variantForm, extraDetails: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Any quality information such as Kernel Yield, Light/Dark %, Premium Grade, or Packing specs can be entered here.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-150 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="px-4 h-9 text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingVariant}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 h-9 shadow-sm"
                >
                  {savingVariant ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1.5" />
                  )}
                  {editingVariant ? "Update Variant" : "Save Variant"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT BASIC GOODS ITEM MODAL                                               */}
      {/* ========================================================================= */}
      {isEditGoodsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                Edit Basic Goods Item
              </h3>
              <button
                type="button"
                onClick={() => setIsEditGoodsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditGoods} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Goods Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={editGoodsForm.name}
                  onChange={(e) => setEditGoodsForm({ ...editGoodsForm, name: e.target.value })}
                  required
                  className="font-medium h-9 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  HS Code <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={editGoodsForm.chsCode}
                  onChange={(e) => setEditGoodsForm({ ...editGoodsForm, chsCode: e.target.value.toUpperCase() })}
                  required
                  className="font-mono font-bold text-blue-600 h-9 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Origin Country <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editGoodsForm.originCountry}
                  onChange={(e) => {
                    const cName = e.target.value;
                    const found = countries.find((c) => c.name === cName);
                    setEditGoodsForm({
                      ...editGoodsForm,
                      originCountry: cName,
                      originCountryId: found ? found.id : "",
                    });
                  }}
                  required
                  aria-label={translateHeader(lang, "EDIT ORIGIN COUNTRY")}
                  className="w-full h-9 px-3 border rounded-lg bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  <option value="">Select Origin Country...</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="edit_goods_is_active"
                  checked={editGoodsForm.isActive}
                  onChange={(e) => setEditGoodsForm({ ...editGoodsForm, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="edit_goods_is_active" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Active Status
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-150 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditGoodsOpen(false)}
                  className="px-4 h-9 text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingEditGoods}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 h-9 shadow-sm"
                >
                  {savingEditGoods ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Update Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MASTER PARAMETERS MODAL                                                   */}
      {/* ========================================================================= */}
      {isParamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/30">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-amber-600" />
                  Master Parameters Manager
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage preset Brands, Sizes, and Specifications in the database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsParamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
                {(["brand", "size", "extra_details"] as const).map((tab) => (
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
                    {tab === "brand" ? "1. Brands" : tab === "size" ? "2. Sizes / Grades" : "3. Extra Details / Specs"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddParameter} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <Input
                  placeholder={translateHeader(lang, "ADD NEW PRESET ENTRY...")}
                  value={newParamValue}
                  onChange={(e) => setNewParamValue(e.target.value)}
                  className="bg-white dark:bg-slate-900 h-9 text-xs"
                />
                <Button
                  type="submit"
                  disabled={savingParam || !newParamValue.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-semibold h-9 text-xs"
                >
                  {savingParam ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                  Add Parameter
                </Button>
              </form>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                      <Th className="p-2.5 text-left w-12">#</Th>
                      <Th className="p-2.5 text-left">Parameter Value</Th>
                      <Th className="p-2.5 text-center w-24">Status</Th>
                      <Th className="p-2.5 text-center w-20">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDbParams.filter((p) => p.param_type === paramTab).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400">
                          No preset parameters recorded yet for this tab.
                        </td>
                      </tr>
                    ) : (
                      allDbParams
                        .filter((p) => p.param_type === paramTab)
                        .map((p, idx) => (
                          <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50">
                            <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                              {editingParamId === p.id ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={editingParamValue}
                                    onChange={(e) => setEditingParamValue(e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                  <Button size="sm" onClick={() => handleUpdateParameter(p.id)} className="h-7 bg-emerald-600 text-white text-[11px]">
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingParamId(null)} className="h-7 text-[11px]">
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                p.param_value
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleParamStatus(p.id, p.is_active)}
                                className={cn(
                                  "px-2 py-0.5 text-[10px] rounded-full font-bold",
                                  p.is_active
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-slate-200 text-slate-600"
                                )}
                              >
                                {p.is_active ? "Active" : "Inactive"}
                              </button>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingParamId(p.id);
                                    setEditingParamValue(p.param_value);
                                  }}
                                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                                  title={translateHeader(lang, "EDIT PARAMETER")}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteParameter(p.id)}
                                  className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                  title={translateHeader(lang, "DELETE PARAMETER")}
                                >
                                  <Trash2 className="w-3 h-3" />
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

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end">
              <Button onClick={() => setIsParamModalOpen(false)} variant="outline" size="sm" className="h-8 text-xs">
                Close Manager
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIVERSAL REPORT MODAL (PRINT PREVIEW)                                   */}
      {/* ========================================================================= */}
      <UniversalReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title={translateHeader(lang, "GOODS MASTER")}
        data={goods.flatMap((g) =>
          (g.variations || []).length > 0
            ? g.variations.map((v) => ({
                chs_code: g.chs_code,
                name: g.name,
                origin_country: g.origin_country,
                brand: v.brand,
                size: v.size,
                extra_details: v.extra_details,
                is_active: g.is_active && v.is_active,
              }))
            : [
                {
                  chs_code: g.chs_code,
                  name: g.name,
                  origin_country: g.origin_country,
                  brand: "-",
                  size: "-",
                  extra_details: "-",
                  is_active: g.is_active,
                },
              ]
        )}
        columns={[
          { key: "chs_code", label: translateHeader(lang, "HS Code") },
          { key: "name", label: translateHeader(lang, "Goods Name") },
          { key: "origin_country", label: translateHeader(lang, "Origin") },
          { key: "brand", label: translateHeader(lang, "Brand") },
          { key: "size", label: translateHeader(lang, "SIZE / GRADE") },
          { key: "extra_details", label: translateHeader(lang, "EXTRA DETAILS / SPECIFICATION") },
          {
            key: "is_active",
            label: translateHeader(lang, "Status"),
            format: (v) => (v ? translateHeader(lang, "ACTIVE") : translateHeader(lang, "INACTIVE")),
          },
        ]}
      />
    </>
  );
}
