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
  Tag,
  CheckCircle2,
  Sparkles,
  FileText,
  Boxes,
  HelpCircle,
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

export type MasterParamRecord = {
  id: string;
  goods_id: string | null;
  param_type: "brand" | "size" | "variety" | "extra_details";
  param_code: string;
  param_value: string;
  sort_order: number;
  is_active: boolean;
};

const PRESET_CATEGORIES = [
  "Dry Fruits",
  "Fresh Fruits",
  "Spices & Herbs",
  "Grains & Pulses",
  "Oils & Seeds",
  "Agriculture & Food",
  "General Cargo",
];

function getCategoryBadgeClass(category?: string) {
  const cat = (category || "Dry Fruits").toLowerCase();
  if (cat.includes("dry")) {
    return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800";
  }
  if (cat.includes("fresh")) {
    return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800";
  }
  if (cat.includes("spice")) {
    return "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800";
  }
  if (cat.includes("grain") || cat.includes("pulse")) {
    return "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800";
  }
  if (cat.includes("oil") || cat.includes("seed")) {
    return "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/80 dark:text-yellow-300 dark:border-yellow-800";
  }
  return "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
}

export function GoodsMasterRegistry() {
  const lang = useActiveLanguage();
  const [goods, setGoods] = useState<GoodsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [expandedGoodsIds, setExpandedGoodsIds] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);

  // Active sub-tab inside expanded row: goodsId -> "combinations" | "variety" | "size" | "brand" | "extra_details"
  const [expandedSubTab, setExpandedSubTab] = useState<
    Record<string, "combinations" | "variety" | "size" | "brand" | "extra_details">
  >({});

  // Parameters cached by goodsId (or null for globals)
  const [paramsByGoodsId, setParamsByGoodsId] = useState<Record<string, MasterParamRecord[]>>({});
  const [loadingParamsFor, setLoadingParamsFor] = useState<Record<string, boolean>>({});

  // Quick-add inputs for expanded item parameter tabs
  const [inlineNewParam, setInlineNewParam] = useState<Record<string, string>>({});
  const [savingInlineParam, setSavingInlineParam] = useState<Record<string, boolean>>({});

  // Editing inline param state
  const [editingParamId, setEditingParamId] = useState<string | null>(null);
  const [editingParamValue, setEditingParamValue] = useState("");

  // Countries
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);

  // Master Global Parameters Modal
  const [allDbParams, setAllDbParams] = useState<MasterParamRecord[]>([]);
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [paramTab, setParamTab] = useState<"variety" | "size" | "brand" | "extra_details">("variety");
  const [newParamValue, setNewParamValue] = useState("");
  const [savingParam, setSavingParam] = useState(false);

  // =========================================================================
  // Master Flow Modal: "Add / Edit Goods" (Sections 1 through 6)
  // =========================================================================
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [masterModalTab, setMasterModalTab] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [activeModalGoods, setActiveModalGoods] = useState<GoodsRecord | null>(null);
  const [savingMasterSection1, setSavingMasterSection1] = useState(false);
  const [masterSection1Saved, setMasterSection1Saved] = useState(false);

  const [masterForm, setMasterForm] = useState({
    name: "",
    chsCode: "",
    category: "Dry Fruits",
    description: "",
    originCountry: "",
    originCountryId: "",
    isActive: true,
  });

  // Modal Variant Combination (Add / Edit)
  const [isCombinationModalOpen, setIsCombinationModalOpen] = useState(false);
  const [targetGoodsForCombination, setTargetGoodsForCombination] = useState<GoodsRecord | null>(null);
  const [editingCombination, setEditingCombination] = useState<GoodsVariation | null>(null);
  const [savingCombination, setSavingCombination] = useState(false);
  const [combinationForm, setCombinationForm] = useState({
    variety: "",
    size: "",
    brand: "",
    extraDetails: "",
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

  // Load Parameters for a specific goods item
  async function loadGoodsParameters(goodsItem: GoodsRecord) {
    setLoadingParamsFor((prev) => ({ ...prev, [goodsItem.id]: true }));
    try {
      const res = await apiGet<{
        parameters: MasterParamRecord[];
      }>(`/api/erp/goods/parameters?goodsId=${encodeURIComponent(goodsItem.id)}&goodsName=${encodeURIComponent(goodsItem.name)}`);
      if (res.parameters) {
        setParamsByGoodsId((prev) => ({
          ...prev,
          [goodsItem.id]: res.parameters,
        }));
      }
    } catch (err) {
      console.error("Failed to load parameters for goods:", err);
    } finally {
      setLoadingParamsFor((prev) => ({ ...prev, [goodsItem.id]: false }));
    }
  }

  // Load Master Parameters (Global)
  async function loadMasterParameters() {
    try {
      const res = await apiGet<{
        parameters: MasterParamRecord[];
      }>("/api/erp/goods/parameters");
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
      setSummary(
        res.summary || {
          total: list.length,
          active: list.filter((g) => g.is_active).length,
          inactive: list.filter((g) => !g.is_active).length,
        }
      );

      if (keepExpandedId) {
        setExpandedGoodsIds((prev) => new Set([...prev, keepExpandedId]));
        const match = list.find((g) => g.id === keepExpandedId);
        if (match) {
          loadGoodsParameters(match);
        }
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
    loadMasterParameters();
  }, [statusFilter]);

  // Toggle Row Expansion
  function toggleRowExpand(goodsItem: GoodsRecord) {
    setExpandedGoodsIds((prev) => {
      const next = new Set(prev);
      if (next.has(goodsItem.id)) {
        next.delete(goodsItem.id);
      } else {
        next.add(goodsItem.id);
        // Automatically fetch parameters for this good if not loaded yet
        if (!paramsByGoodsId[goodsItem.id]) {
          loadGoodsParameters(goodsItem);
        }
        // Default sub-tab to combinations
        if (!expandedSubTab[goodsItem.id]) {
          setExpandedSubTab((st) => ({ ...st, [goodsItem.id]: "combinations" }));
        }
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
        (g.category || "").toLowerCase().includes(q) ||
        (g.origin_country || "").toLowerCase().includes(q);
      const inVariants = (g.variations || []).some(
        (v) =>
          (v.brand || "").toLowerCase().includes(q) ||
          (v.size || "").toLowerCase().includes(q) ||
          (v.variety || "").toLowerCase().includes(q) ||
          (v.extra_details || "").toLowerCase().includes(q)
      );
      return inBasic || inVariants;
    });
  }, [searchQuery, goods]);

  // =========================================================================
  // Open Master Add / Edit Goods Dialog (The 6-Step Workflow)
  // =========================================================================
  function openAddGoodsModal() {
    setActiveModalGoods(null);
    setMasterSection1Saved(false);
    setMasterModalTab(1);
    setMasterForm({
      name: "",
      chsCode: "",
      category: "Dry Fruits",
      description: "",
      originCountry: countries[0]?.name || "Chile",
      originCountryId: countries[0]?.id || "",
      isActive: true,
    });
    setIsMasterModalOpen(true);
  }

  function openEditGoodsModal(item: GoodsRecord) {
    setActiveModalGoods(item);
    setMasterSection1Saved(true);
    setMasterModalTab(1);
    setMasterForm({
      name: item.name,
      chsCode: item.chs_code,
      category: item.category || "Dry Fruits",
      description: item.extra_details || "",
      originCountry: item.origin_country || "",
      originCountryId: item.origin_country_id || "",
      isActive: item.is_active,
    });
    loadGoodsParameters(item);
    setIsMasterModalOpen(true);
  }

  // Save Section 1 (Main Goods - Save Once)
  async function handleSaveMasterSection1(e: React.FormEvent) {
    e.preventDefault();
    if (!masterForm.name.trim() || !masterForm.chsCode.trim()) {
      alert("Please fill in Goods Name and HS Code.");
      return;
    }
    setSavingMasterSection1(true);
    try {
      if (activeModalGoods) {
        // Update existing goods item
        await apiPatch(`/api/erp/goods-master/${activeModalGoods.id}`, {
          name: masterForm.name.trim(),
          chsCode: masterForm.chsCode.trim().toUpperCase(),
          category: masterForm.category.trim() || null,
          originCountry: masterForm.originCountry.trim() || null,
          originCountryId: masterForm.originCountryId || null,
          isActive: masterForm.isActive,
        });

        const updated: GoodsRecord = {
          ...activeModalGoods,
          name: masterForm.name.trim(),
          chs_code: masterForm.chsCode.trim().toUpperCase(),
          category: masterForm.category.trim(),
          origin_country: masterForm.originCountry.trim(),
          is_active: masterForm.isActive,
        };
        setActiveModalGoods(updated);
        setMasterSection1Saved(true);
        await loadGoods(updated.id);
      } else {
        // Create new goods item
        const res = await apiPost<{ id: string }>("/api/erp/goods-master", {
          name: masterForm.name.trim(),
          chsCode: masterForm.chsCode.trim().toUpperCase(),
          category: masterForm.category.trim() || "Dry Fruits",
          originCountry: masterForm.originCountry.trim() || null,
          originCountryId: masterForm.originCountryId || null,
          extraDetails: masterForm.description.trim() || null,
          isActive: masterForm.isActive,
        });

        const newId = res.id;
        const newGood: GoodsRecord = {
          id: newId,
          name: masterForm.name.trim(),
          chs_code: masterForm.chsCode.trim().toUpperCase(),
          category: masterForm.category.trim(),
          origin_country: masterForm.originCountry.trim(),
          origin_country_id: masterForm.originCountryId || null,
          is_active: true,
          created_at: new Date().toISOString(),
          variations: [],
        };
        setActiveModalGoods(newGood);
        setMasterSection1Saved(true);
        // Automatically switch to Option 2: Variety
        setMasterModalTab(2);
        await loadGoods(newId);
        loadGoodsParameters(newGood);
      }
    } catch (err: any) {
      alert(`Failed to save Goods Item: ${err.message}`);
    } finally {
      setSavingMasterSection1(false);
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

  // =========================================================================
  // Parameter CRUD (Variety, Size, Brand, Extra Details)
  // =========================================================================
  async function handleAddParameterForGoods(goodsId: string, paramType: "variety" | "size" | "brand" | "extra_details", val: string) {
    if (!val.trim()) return;
    setSavingInlineParam((prev) => ({ ...prev, [`${goodsId}_${paramType}`]: true }));
    try {
      await apiPost("/api/erp/goods/parameters", {
        goodsId,
        paramType,
        paramValue: val.trim(),
        sortOrder: ((paramsByGoodsId[goodsId] || []).filter((p) => p.param_type === paramType).length || 0) + 1,
        isActive: true,
      });
      // Clear input
      setInlineNewParam((prev) => ({ ...prev, [`${goodsId}_${paramType}`]: "" }));
      // Reload parameters
      const gItem = goods.find((g) => g.id === goodsId) || activeModalGoods;
      if (gItem) {
        await loadGoodsParameters(gItem);
      }
    } catch (err: any) {
      alert(`Failed to add parameter: ${err.message}`);
    } finally {
      setSavingInlineParam((prev) => ({ ...prev, [`${goodsId}_${paramType}`]: false }));
    }
  }

  async function handleUpdateParam(paramId: string, goodsId?: string) {
    if (!editingParamValue.trim()) return;
    try {
      await apiPatch("/api/erp/goods/parameters", {
        id: paramId,
        paramValue: editingParamValue.trim(),
      });
      setEditingParamId(null);
      setEditingParamValue("");
      if (goodsId) {
        const gItem = goods.find((g) => g.id === goodsId) || activeModalGoods;
        if (gItem) await loadGoodsParameters(gItem);
      } else {
        await loadMasterParameters();
      }
    } catch (err: any) {
      alert(`Failed to update parameter: ${err.message}`);
    }
  }

  async function handleDeleteParam(paramId: string, goodsId?: string) {
    if (!window.confirm("Are you sure you want to delete this parameter?")) return;
    try {
      await apiDelete(`/api/erp/goods/parameters?id=${paramId}`);
      if (goodsId) {
        const gItem = goods.find((g) => g.id === goodsId) || activeModalGoods;
        if (gItem) await loadGoodsParameters(gItem);
      } else {
        await loadMasterParameters();
      }
    } catch (err: any) {
      alert(`Failed to delete parameter: ${err.message}`);
    }
  }

  // =========================================================================
  // Variant Combinations CRUD (Final Combinations Register)
  // =========================================================================
  function openAddCombinationModal(goodsItem: GoodsRecord) {
    setTargetGoodsForCombination(goodsItem);
    setEditingCombination(null);

    const goodParams = paramsByGoodsId[goodsItem.id] || [];
    const varieties = goodParams.filter((p) => p.param_type === "variety" && p.is_active).map((p) => p.param_value);
    const sizes = goodParams.filter((p) => p.param_type === "size" && p.is_active).map((p) => p.param_value);
    const brands = goodParams.filter((p) => p.param_type === "brand" && p.is_active).map((p) => p.param_value);
    const reports = goodParams.filter((p) => p.param_type === "extra_details" && p.is_active).map((p) => p.param_value);

    setCombinationForm({
      variety: varieties[0] || "",
      size: sizes[0] || "",
      brand: brands[0] || "DGT LLC",
      extraDetails: reports[0] || "Premium Quality",
      isActive: true,
    });
    setIsCombinationModalOpen(true);
  }

  function openEditCombinationModal(goodsItem: GoodsRecord, variant: GoodsVariation) {
    setTargetGoodsForCombination(goodsItem);
    setEditingCombination(variant);
    setCombinationForm({
      variety: variant.variety || "",
      size: variant.size || "",
      brand: variant.brand || "",
      extraDetails: variant.extra_details || "",
      isActive: variant.is_active,
    });
    setIsCombinationModalOpen(true);
  }

  async function handleSaveCombination(e: React.FormEvent) {
    e.preventDefault();
    if (!targetGoodsForCombination) return;
    if (!combinationForm.brand.trim() || !combinationForm.size.trim()) {
      alert("Please provide Brand and Size / Grade for this combination.");
      return;
    }

    setSavingCombination(true);
    try {
      if (editingCombination) {
        await apiPatch(`/api/erp/goods-master/variations/${editingCombination.id}`, {
          brand: combinationForm.brand.trim(),
          size: combinationForm.size.trim(),
          variety: combinationForm.variety.trim() || null,
          extraDetails: combinationForm.extraDetails.trim() || null,
          isActive: combinationForm.isActive,
        });
      } else {
        await apiPost(`/api/erp/goods-master/${targetGoodsForCombination.id}/variations`, {
          brand: combinationForm.brand.trim(),
          size: combinationForm.size.trim(),
          variety: combinationForm.variety.trim() || null,
          extraDetails: combinationForm.extraDetails.trim() || null,
        });
      }

      setIsCombinationModalOpen(false);
      await loadGoods(targetGoodsForCombination.id);
    } catch (err: any) {
      alert(`Failed to save variant combination: ${err.message}`);
    } finally {
      setSavingCombination(false);
    }
  }

  async function handleDeleteCombination(goodsId: string, variant: GoodsVariation) {
    if (!window.confirm(`Delete variant combination "${variant.variety ? variant.variety + ' - ' : ''}${variant.size} - ${variant.brand}"?`)) return;
    try {
      await apiDelete(`/api/erp/goods-master/variations/${variant.id}`);
      await loadGoods(goodsId);
    } catch (err: any) {
      alert(`Failed to delete combination: ${err.message}`);
    }
  }

  return (
    <>
      <Card className="border-border shadow-sm bg-card">
        {/* Top Header Bar */}
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-sm shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {translateHeader(lang, "Goods Master")}
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {translateHeader(lang, "Manage global product, goods catalog and CHS classifications")}
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
              {translateHeader(lang, "Master Parameters")}
            </Button>

            <Button
              onClick={() => setShowReport(true)}
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium px-3.5 h-9"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              {translateHeader(lang, "Print Preview")}
            </Button>

            <Button
              onClick={openAddGoodsModal}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-9 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {translateHeader(lang, "+ New Goods Item")}
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
                  placeholder="Search goods by name, CHS code, or brand..."
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
                  aria-label="Filter goods by status"
                  className="h-10 px-3.5 pr-8 border rounded-lg bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Metric Cards (Inline compact badges) */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-150 dark:border-blue-900/60 px-4 py-2 rounded-lg min-w-[90px]">
                <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                  TOTAL
                </div>
                <div className="text-xl font-bold text-blue-950 dark:text-blue-200 leading-tight">
                  {summary.total}
                </div>
              </div>

              <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-150 dark:border-emerald-900/60 px-4 py-2 rounded-lg min-w-[90px]">
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                  ACTIVE
                </div>
                <div className="text-xl font-bold text-emerald-950 dark:text-emerald-200 leading-tight">
                  {summary.active}
                </div>
              </div>

              <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-150 dark:border-rose-900/60 px-4 py-2 rounded-lg min-w-[90px]">
                <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                  INACTIVE
                </div>
                <div className="text-xl font-bold text-rose-950 dark:text-rose-200 leading-tight">
                  {summary.inactive}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MAIN GOODS MASTER DASHBOARD TABLE                                         */}
          {/* Columns strictly as requested:                                             */}
          {/* 1. # (Serial Number)                                                      */}
          {/* 2. Goods Name (Clean title)                                               */}
          {/* 3. HS Code (Chassis Code)                                                 */}
          {/* 4. Category (Dry Fruits / Fresh Fruits / etc. - "dry hai ya fresh")       */}
          {/* 5. Status (ACTIVE / INACTIVE)                                             */}
          {/* 6. Actions (+ to expand, Edit, Delete)                                    */}
          {/* ========================================================================= */}
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
                    <Th className="p-3.5 text-center w-14">#</Th>
                    <Th className="p-3.5 text-left">{translateHeader(lang, "GOODS NAME")}</Th>
                    <Th className="p-3.5 text-left w-44">{translateHeader(lang, "HS / PCT CODE")}</Th>
                    <Th className="p-3.5 text-left w-48">{translateHeader(lang, "CATEGORY")}</Th>
                    <Th className="p-3.5 text-center w-28">{translateHeader(lang, "STATUS")}</Th>
                    <Th className="p-3.5 text-center w-36">{translateHeader(lang, "ACTIONS")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredGoods.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">
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
                      const goodParams = paramsByGoodsId[g.id] || [];
                      const varietyCount = goodParams.filter((p) => p.param_type === "variety").length;
                      const sizeCount = goodParams.filter((p) => p.param_type === "size").length;
                      const brandCount = goodParams.filter((p) => p.param_type === "brand").length;
                      const reportCount = goodParams.filter((p) => p.param_type === "extra_details").length;

                      const activeTab = expandedSubTab[g.id] || "combinations";

                      return (
                        <React.Fragment key={g.id}>
                          <tr
                            className={cn(
                              "transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40",
                              isExpanded && "bg-slate-50/90 dark:bg-slate-850/60 font-medium"
                            )}
                          >
                            {/* 1. Serial Number (#) */}
                            <td className="p-3.5 text-center text-slate-400 text-xs font-mono">
                              {idx + 1}
                            </td>

                            {/* 2. Goods Name (Clean title + badge) */}
                            <td className="p-3.5 font-semibold text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold">{g.name}</span>
                                {varCount > 0 ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    {varCount} {varCount === 1 ? "variant" : "variants"}
                                  </span>
                                ) : (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">
                                    0 variants
                                  </span>
                                )}
                                {g.origin_country && (
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    ({g.origin_country})
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 3. HS / PCT Code (Chassis Code) */}
                            <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                              {g.chs_code || "-"}
                            </td>

                            {/* 4. Category (Dry Fruits / Fresh Fruits / etc.) */}
                            <td className="p-3.5">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border tracking-wide",
                                  getCategoryBadgeClass(g.category)
                                )}
                              >
                                {g.category || "Dry Fruits"}
                              </span>
                            </td>

                            {/* 5. Status Badge */}
                            <td className="p-3.5 text-center">
                              <span
                                className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider",
                                  g.is_active
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                                )}
                              >
                                {g.is_active ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>

                            {/* 6. Actions: Plus (+) expand, Edit, Delete */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {/* Circular + or - Button */}
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpand(g)}
                                  className={cn(
                                    "w-7 h-7 rounded-full flex items-center justify-center text-white transition-all shadow-sm shrink-0",
                                    isExpanded
                                      ? "bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-300 dark:ring-blue-900"
                                      : "bg-blue-600 hover:bg-blue-700"
                                  )}
                                  title={isExpanded ? "Collapse item parameters" : "Click '+' to see all brands, sizes, varieties and reports for this item"}
                                >
                                  {isExpanded ? (
                                    <Minus className="w-4 h-4 stroke-[2.5]" />
                                  ) : (
                                    <Plus className="w-4 h-4 stroke-[2.5]" />
                                  )}
                                </button>

                                {/* Blue Edit Icon Button */}
                                <button
                                  type="button"
                                  onClick={() => openEditGoodsModal(g)}
                                  className="w-7 h-7 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-xs"
                                  title="Edit Goods Master Item & Parameters"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Red Trash Icon Button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGoods(g)}
                                  className="w-7 h-7 rounded bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs"
                                  title="Delete Goods Master Item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* ========================================================================= */}
                          {/* EXPANDED SECTION FOR THIS GOOD (OPENS ON PLUS '+')                       */}
                          {/* Shows: Complete hierarchy & options (Variety, Size, Brand, Reports)       */}
                          {/* ========================================================================= */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70 dark:bg-slate-900/60">
                              <td colSpan={6} className="p-0 border-b border-slate-200 dark:border-slate-800">
                                <div className="p-4 sm:p-6 bg-gradient-to-b from-slate-50/90 to-white dark:from-slate-900/80 dark:to-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-4">
                                  {/* Sub-table Header Bar */}
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                                    <div>
                                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <span className="text-blue-600 dark:text-blue-400">{g.name}</span>
                                        <span className="text-xs px-2 py-0.5 rounded font-mono font-normal bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                          HS: {g.chs_code}
                                        </span>
                                        <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold border", getCategoryBadgeClass(g.category))}>
                                          {g.category || "Dry Fruits"}
                                        </span>
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Internal ERP master structure: Manage Varieties, Sizes/Grades, Brands, Reports/Specs and active combinations.
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        onClick={() => openAddCombinationModal(g)}
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 h-8 shadow-xs"
                                      >
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        + Add Variant Combination
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Sub-Tabs: Combinations, Variety, Size, Brand, Reports */}
                                  <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedSubTab((st) => ({ ...st, [g.id]: "combinations" }))}
                                      className={cn(
                                        "px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5",
                                        activeTab === "combinations"
                                          ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                      )}
                                    >
                                      <Boxes className="w-3.5 h-3.5" />
                                      Combinations Register ({varCount})
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedSubTab((st) => ({ ...st, [g.id]: "variety" }))}
                                      className={cn(
                                        "px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5",
                                        activeTab === "variety"
                                          ? "border-amber-600 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900"
                                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                      )}
                                    >
                                      <Tag className="w-3.5 h-3.5" />
                                      2. Variety / Type ({varietyCount})
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedSubTab((st) => ({ ...st, [g.id]: "size" }))}
                                      className={cn(
                                        "px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5",
                                        activeTab === "size"
                                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                      )}
                                    >
                                      <SlidersHorizontal className="w-3.5 h-3.5" />
                                      3. Size / Grade ({sizeCount})
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedSubTab((st) => ({ ...st, [g.id]: "brand" }))}
                                      className={cn(
                                        "px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5",
                                        activeTab === "brand"
                                          ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900"
                                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                      )}
                                    >
                                      <Package className="w-3.5 h-3.5" />
                                      4. Brand ({brandCount})
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedSubTab((st) => ({ ...st, [g.id]: "extra_details" }))}
                                      className={cn(
                                        "px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5",
                                        activeTab === "extra_details"
                                          ? "border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900"
                                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                      )}
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      5. Reports / Extra Details ({reportCount})
                                    </button>
                                  </div>

                                  {/* Sub-Tab 1: Final Combinations Register */}
                                  {activeTab === "combinations" && (
                                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                                            <Th className="p-2.5 text-center w-12">#</Th>
                                            <Th className="p-2.5 text-left w-36">Variety / Type</Th>
                                            <Th className="p-2.5 text-left w-32">Size / Grade</Th>
                                            <Th className="p-2.5 text-left w-36">Brand</Th>
                                            <Th className="p-2.5 text-left">Report / Specification</Th>
                                            <Th className="p-2.5 text-center w-24">Status</Th>
                                            <Th className="p-2.5 text-center w-24">Actions</Th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {(g.variations || []).length === 0 ? (
                                            <tr>
                                              <td colSpan={7} className="p-6 text-center text-slate-400">
                                                No variant combinations registered yet for this item. Click{" "}
                                                <button
                                                  type="button"
                                                  onClick={() => openAddCombinationModal(g)}
                                                  className="font-semibold text-emerald-600 dark:text-emerald-400 underline hover:no-underline"
                                                >
                                                  "+ Add Variant Combination"
                                                </button>{" "}
                                                to pair Variety, Size, Brand and Report details.
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
                                                <td className="p-2.5 font-medium text-amber-700 dark:text-amber-400">
                                                  {v.variety ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px]">
                                                      {v.variety}
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-400">-</span>
                                                  )}
                                                </td>
                                                <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                                                  {v.size || "-"}
                                                </td>
                                                <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                                                  {v.brand || "-"}
                                                </td>
                                                <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                                  {v.extra_details ? (
                                                    <span className="leading-relaxed">{v.extra_details}</span>
                                                  ) : (
                                                    <span className="text-slate-400 italic">No extra specs</span>
                                                  )}
                                                </td>
                                                <td className="p-2.5 text-center">
                                                  <span
                                                    className={cn(
                                                      "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                      v.is_active
                                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                                        : "bg-slate-100 text-slate-600"
                                                    )}
                                                  >
                                                    {v.is_active ? "Active" : "Inactive"}
                                                  </span>
                                                </td>
                                                <td className="p-2.5 text-center">
                                                  <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                      type="button"
                                                      onClick={() => openEditCombinationModal(g, v)}
                                                      className="w-6 h-6 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-xs"
                                                      title="Edit Variant Combination"
                                                    >
                                                      <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteCombination(g.id, v)}
                                                      className="w-6 h-6 rounded bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs"
                                                      title="Delete Variant Combination"
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
                                  )}

                                  {/* Sub-Tab 2: Variety / Type Parameter Manager */}
                                  {activeTab === "variety" && (
                                    <div className="space-y-3">
                                      <div className="flex gap-2 items-center">
                                        <Input
                                          placeholder="Enter Variety Name (e.g. IMPAX, INDEPENDENCE, CARMEL, NONPAREIL)..."
                                          value={inlineNewParam[`${g.id}_variety`] || ""}
                                          onChange={(e) =>
                                            setInlineNewParam((prev) => ({
                                              ...prev,
                                              [`${g.id}_variety`]: e.target.value,
                                            }))
                                          }
                                          className="h-8 text-xs bg-white dark:bg-slate-900 flex-1"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleAddParameterForGoods(
                                              g.id,
                                              "variety",
                                              inlineNewParam[`${g.id}_variety`] || ""
                                            )
                                          }
                                          disabled={
                                            savingInlineParam[`${g.id}_variety`] ||
                                            !(inlineNewParam[`${g.id}_variety`] || "").trim()
                                          }
                                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 font-semibold shrink-0"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          + Add Variety
                                        </Button>
                                      </div>

                                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 border-b text-slate-700 dark:text-slate-300 font-bold uppercase">
                                              <Th className="p-2 text-center w-12">#</Th>
                                              <Th className="p-2 text-left">Variety Name</Th>
                                              <Th className="p-2 text-center w-24">Status</Th>
                                              <Th className="p-2 text-center w-24">Actions</Th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {goodParams.filter((p) => p.param_type === "variety").length === 0 ? (
                                              <tr>
                                                <td colSpan={4} className="p-4 text-center text-slate-400">
                                                  No varieties registered yet for this item. Add one above.
                                                </td>
                                              </tr>
                                            ) : (
                                              goodParams
                                                .filter((p) => p.param_type === "variety")
                                                .map((p, pIdx) => (
                                                  <tr key={p.id} className="border-b hover:bg-slate-50">
                                                    <td className="p-2 text-center text-slate-400 font-mono">{pIdx + 1}</td>
                                                    <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">
                                                      {editingParamId === p.id ? (
                                                        <div className="flex gap-2">
                                                          <Input
                                                            value={editingParamValue}
                                                            onChange={(e) => setEditingParamValue(e.target.value)}
                                                            className="h-7 text-xs"
                                                          />
                                                          <Button
                                                            size="sm"
                                                            onClick={() => handleUpdateParam(p.id, g.id)}
                                                            className="h-7 bg-emerald-600 text-white text-[11px]"
                                                          >
                                                            Save
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingParamId(null)}
                                                            className="h-7 text-[11px]"
                                                          >
                                                            Cancel
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        p.param_value
                                                      )}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                                        Active
                                                      </span>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setEditingParamId(p.id);
                                                            setEditingParamValue(p.param_value);
                                                          }}
                                                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                                        >
                                                          <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleDeleteParam(p.id, g.id)}
                                                          className="p-1 hover:bg-rose-100 rounded text-rose-600"
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
                                  )}

                                  {/* Sub-Tab 3: Size / Grade Parameter Manager */}
                                  {activeTab === "size" && (
                                    <div className="space-y-3">
                                      <div className="flex gap-2 items-center">
                                        <Input
                                          placeholder="Enter Size / Grade (e.g. 18-20, 20-22, 23-25, 27-30)..."
                                          value={inlineNewParam[`${g.id}_size`] || ""}
                                          onChange={(e) =>
                                            setInlineNewParam((prev) => ({
                                              ...prev,
                                              [`${g.id}_size`]: e.target.value,
                                            }))
                                          }
                                          className="h-8 text-xs bg-white dark:bg-slate-900 flex-1 font-mono"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleAddParameterForGoods(
                                              g.id,
                                              "size",
                                              inlineNewParam[`${g.id}_size`] || ""
                                            )
                                          }
                                          disabled={
                                            savingInlineParam[`${g.id}_size`] ||
                                            !(inlineNewParam[`${g.id}_size`] || "").trim()
                                          }
                                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 font-semibold shrink-0"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          + Add Size
                                        </Button>
                                      </div>

                                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 border-b text-slate-700 dark:text-slate-300 font-bold uppercase">
                                              <Th className="p-2 text-center w-12">#</Th>
                                              <Th className="p-2 text-left">Size / Grade</Th>
                                              <Th className="p-2 text-center w-24">Status</Th>
                                              <Th className="p-2 text-center w-24">Actions</Th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {goodParams.filter((p) => p.param_type === "size").length === 0 ? (
                                              <tr>
                                                <td colSpan={4} className="p-4 text-center text-slate-400">
                                                  No sizes / grades registered yet for this item. Add one above.
                                                </td>
                                              </tr>
                                            ) : (
                                              goodParams
                                                .filter((p) => p.param_type === "size")
                                                .map((p, pIdx) => (
                                                  <tr key={p.id} className="border-b hover:bg-slate-50">
                                                    <td className="p-2 text-center text-slate-400 font-mono">{pIdx + 1}</td>
                                                    <td className="p-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                                                      {editingParamId === p.id ? (
                                                        <div className="flex gap-2">
                                                          <Input
                                                            value={editingParamValue}
                                                            onChange={(e) => setEditingParamValue(e.target.value)}
                                                            className="h-7 text-xs"
                                                          />
                                                          <Button
                                                            size="sm"
                                                            onClick={() => handleUpdateParam(p.id, g.id)}
                                                            className="h-7 bg-emerald-600 text-white text-[11px]"
                                                          >
                                                            Save
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingParamId(null)}
                                                            className="h-7 text-[11px]"
                                                          >
                                                            Cancel
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        p.param_value
                                                      )}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                                        Active
                                                      </span>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setEditingParamId(p.id);
                                                            setEditingParamValue(p.param_value);
                                                          }}
                                                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                                        >
                                                          <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleDeleteParam(p.id, g.id)}
                                                          className="p-1 hover:bg-rose-100 rounded text-rose-600"
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
                                  )}

                                  {/* Sub-Tab 4: Brand Parameter Manager */}
                                  {activeTab === "brand" && (
                                    <div className="space-y-3">
                                      <div className="flex gap-2 items-center">
                                        <Input
                                          placeholder="Enter Brand Name (e.g. DGT, DADI HEALTHY, PREMIUM, GOLDEN)..."
                                          value={inlineNewParam[`${g.id}_brand`] || ""}
                                          onChange={(e) =>
                                            setInlineNewParam((prev) => ({
                                              ...prev,
                                              [`${g.id}_brand`]: e.target.value,
                                            }))
                                          }
                                          className="h-8 text-xs bg-white dark:bg-slate-900 flex-1 font-semibold"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleAddParameterForGoods(
                                              g.id,
                                              "brand",
                                              inlineNewParam[`${g.id}_brand`] || ""
                                            )
                                          }
                                          disabled={
                                            savingInlineParam[`${g.id}_brand`] ||
                                            !(inlineNewParam[`${g.id}_brand`] || "").trim()
                                          }
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-semibold shrink-0"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          + Add Brand
                                        </Button>
                                      </div>

                                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 border-b text-slate-700 dark:text-slate-300 font-bold uppercase">
                                              <Th className="p-2 text-center w-12">#</Th>
                                              <Th className="p-2 text-left">Brand Name</Th>
                                              <Th className="p-2 text-center w-24">Status</Th>
                                              <Th className="p-2 text-center w-24">Actions</Th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {goodParams.filter((p) => p.param_type === "brand").length === 0 ? (
                                              <tr>
                                                <td colSpan={4} className="p-4 text-center text-slate-400">
                                                  No brands registered yet for this item. Add one above.
                                                </td>
                                              </tr>
                                            ) : (
                                              goodParams
                                                .filter((p) => p.param_type === "brand")
                                                .map((p, pIdx) => (
                                                  <tr key={p.id} className="border-b hover:bg-slate-50">
                                                    <td className="p-2 text-center text-slate-400 font-mono">{pIdx + 1}</td>
                                                    <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">
                                                      {editingParamId === p.id ? (
                                                        <div className="flex gap-2">
                                                          <Input
                                                            value={editingParamValue}
                                                            onChange={(e) => setEditingParamValue(e.target.value)}
                                                            className="h-7 text-xs"
                                                          />
                                                          <Button
                                                            size="sm"
                                                            onClick={() => handleUpdateParam(p.id, g.id)}
                                                            className="h-7 bg-emerald-600 text-white text-[11px]"
                                                          >
                                                            Save
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingParamId(null)}
                                                            className="h-7 text-[11px]"
                                                          >
                                                            Cancel
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        p.param_value
                                                      )}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                                        Active
                                                      </span>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setEditingParamId(p.id);
                                                            setEditingParamValue(p.param_value);
                                                          }}
                                                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                                        >
                                                          <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleDeleteParam(p.id, g.id)}
                                                          className="p-1 hover:bg-rose-100 rounded text-rose-600"
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
                                  )}

                                  {/* Sub-Tab 5: Reports / Extra Details Parameter Manager */}
                                  {activeTab === "extra_details" && (
                                    <div className="space-y-3">
                                      <div className="flex gap-2 items-center">
                                        <Input
                                          placeholder="Enter Report Name / Specification (e.g. Premium Quality, Export Quality, Special Packing)..."
                                          value={inlineNewParam[`${g.id}_extra_details`] || ""}
                                          onChange={(e) =>
                                            setInlineNewParam((prev) => ({
                                              ...prev,
                                              [`${g.id}_extra_details`]: e.target.value,
                                            }))
                                          }
                                          className="h-8 text-xs bg-white dark:bg-slate-900 flex-1"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleAddParameterForGoods(
                                              g.id,
                                              "extra_details",
                                              inlineNewParam[`${g.id}_extra_details`] || ""
                                            )
                                          }
                                          disabled={
                                            savingInlineParam[`${g.id}_extra_details`] ||
                                            !(inlineNewParam[`${g.id}_extra_details`] || "").trim()
                                          }
                                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 font-semibold shrink-0"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          + Add Report
                                        </Button>
                                      </div>

                                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 border-b text-slate-700 dark:text-slate-300 font-bold uppercase">
                                              <Th className="p-2 text-center w-12">#</Th>
                                              <Th className="p-2 text-left">Report Name / Specification</Th>
                                              <Th className="p-2 text-center w-24">Status</Th>
                                              <Th className="p-2 text-center w-24">Actions</Th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {goodParams.filter((p) => p.param_type === "extra_details").length === 0 ? (
                                              <tr>
                                                <td colSpan={4} className="p-4 text-center text-slate-400">
                                                  No reports or extra specifications registered yet for this item. Add one above.
                                                </td>
                                              </tr>
                                            ) : (
                                              goodParams
                                                .filter((p) => p.param_type === "extra_details")
                                                .map((p, pIdx) => (
                                                  <tr key={p.id} className="border-b hover:bg-slate-50">
                                                    <td className="p-2 text-center text-slate-400 font-mono">{pIdx + 1}</td>
                                                    <td className="p-2 font-medium text-slate-800 dark:text-slate-200">
                                                      {editingParamId === p.id ? (
                                                        <div className="flex gap-2">
                                                          <Input
                                                            value={editingParamValue}
                                                            onChange={(e) => setEditingParamValue(e.target.value)}
                                                            className="h-7 text-xs"
                                                          />
                                                          <Button
                                                            size="sm"
                                                            onClick={() => handleUpdateParam(p.id, g.id)}
                                                            className="h-7 bg-emerald-600 text-white text-[11px]"
                                                          >
                                                            Save
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingParamId(null)}
                                                            className="h-7 text-[11px]"
                                                          >
                                                            Cancel
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        p.param_value
                                                      )}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                                        Active
                                                      </span>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setEditingParamId(p.id);
                                                            setEditingParamValue(p.param_value);
                                                          }}
                                                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                                        >
                                                          <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleDeleteParam(p.id, g.id)}
                                                          className="p-1 hover:bg-rose-100 rounded text-rose-600"
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
                                  )}
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
      {/* MASTER FLOW MODAL: "GOODS MASTER — ADD / EDIT GOODS"                      */}
      {/* Exactly as user requested: Step 1: Main Goods (Save Once) ->              */}
      {/* Once saved: Steps 2, 3, 4, 5 unlock directly for entries!                */}
      {/* ========================================================================= */}
      {isMasterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Goods Master — Add / Edit Goods
                    {activeModalGoods && (
                      <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {activeModalGoods.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Step 1 saves root goods item. Steps 2, 3, 4, 5 & 6 configure Varieties, Sizes, Brands & Reports.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMasterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Tabs Bar */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-100/60 dark:bg-slate-900 overflow-x-auto gap-1">
              {[
                { step: 1, label: "1. Main Goods (Save Once)", enabled: true },
                { step: 2, label: "2. Variety / Type", enabled: masterSection1Saved },
                { step: 3, label: "3. Size / Grade", enabled: masterSection1Saved },
                { step: 4, label: "4. Brand", enabled: masterSection1Saved },
                { step: 5, label: "5. Reports / Details", enabled: masterSection1Saved },
                { step: 6, label: "6. Final Combinations", enabled: masterSection1Saved },
              ].map((t) => (
                <button
                  key={t.step}
                  type="button"
                  disabled={!t.enabled}
                  onClick={() => setMasterModalTab(t.step as any)}
                  className={cn(
                    "px-3.5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5",
                    masterModalTab === t.step
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                      : t.enabled
                      ? "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      : "border-transparent text-slate-350 dark:text-slate-600 cursor-not-allowed opacity-60"
                  )}
                >
                  {t.step === 1 && masterSection1Saved ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] flex items-center justify-center font-mono">
                      {t.step}
                    </span>
                  )}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* SECTION 1: Main Goods (Save Once) */}
              {masterModalTab === 1 && (
                <form onSubmit={handleSaveMasterSection1} className="space-y-4">
                  <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3.5 rounded-xl flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-900 dark:text-blue-200">
                      <strong>1. Main Goods (Save Once):</strong> Enter Goods Name, HS Code and Category (Dry / Fresh). After saving, Options 2, 3, 4, 5 unlock below.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Goods Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Goods Name <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        placeholder="e.g. ALMOND KERNELS / WALNUT IN SHELL"
                        value={masterForm.name}
                        onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })}
                        required
                        className="h-10 text-sm font-semibold"
                      />
                    </div>

                    {/* HS / PCT Code */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        HS / PCT Code <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        placeholder="e.g. 0802.12 / 0802.32"
                        value={masterForm.chsCode}
                        onChange={(e) => setMasterForm({ ...masterForm, chsCode: e.target.value.toUpperCase() })}
                        required
                        className="h-10 text-sm font-mono font-bold text-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category (Dry Fruits / Fresh Fruits / etc.) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Category (Dry / Fresh) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={masterForm.category}
                          onChange={(e) => setMasterForm({ ...masterForm, category: e.target.value })}
                          className="w-full h-10 px-3.5 pr-8 border rounded-lg bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                        >
                          {PRESET_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Origin Country */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Origin Country
                      </label>
                      <div className="relative">
                        <select
                          value={masterForm.originCountry}
                          onChange={(e) => {
                            const cName = e.target.value;
                            const found = countries.find((c) => c.name === cName);
                            setMasterForm({
                              ...masterForm,
                              originCountry: cName,
                              originCountryId: found ? found.id : "",
                            });
                          }}
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

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Description / Commercial Specification
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Shelled Almonds, Carmel & Nonpareil varieties"
                      value={masterForm.description}
                      onChange={(e) => setMasterForm({ ...masterForm, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="master_modal_active"
                        checked={masterForm.isActive}
                        onChange={(e) => setMasterForm({ ...masterForm, isActive: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor="master_modal_active" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Active in ERP
                      </label>
                    </div>

                    <Button
                      type="submit"
                      disabled={savingMasterSection1}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 h-10 shadow-sm"
                    >
                      {savingMasterSection1 ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      {activeModalGoods ? "💾 Update Goods" : "💾 Save Goods & Unlock Options 2–6"}
                    </Button>
                  </div>
                </form>
              )}

              {/* SECTION 2: Variety / Type (Multiple) */}
              {masterModalTab === 2 && activeModalGoods && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        2. Variety / Type (Multiple) for {activeModalGoods.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        e.g. IMPAX, INDEPENDENCE, CARMEL, NONPAREIL, MONTEREY, PRICE, SONORA, MISSION
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Add Variety Name (e.g. IMPAX)..."
                      value={inlineNewParam[`${activeModalGoods.id}_variety`] || ""}
                      onChange={(e) =>
                        setInlineNewParam((prev) => ({
                          ...prev,
                          [`${activeModalGoods.id}_variety`]: e.target.value,
                        }))
                      }
                      className="h-9 text-xs"
                    />
                    <Button
                      onClick={() =>
                        handleAddParameterForGoods(
                          activeModalGoods.id,
                          "variety",
                          inlineNewParam[`${activeModalGoods.id}_variety`] || ""
                        )
                      }
                      disabled={
                        savingInlineParam[`${activeModalGoods.id}_variety`] ||
                        !(inlineNewParam[`${activeModalGoods.id}_variety`] || "").trim()
                      }
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 font-semibold shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Add Variety
                    </Button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b font-bold text-slate-700">
                          <Th className="p-2.5 text-center w-12">#</Th>
                          <Th className="p-2.5 text-left">Variety Name</Th>
                          <Th className="p-2.5 text-center w-24">Actions</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paramsByGoodsId[activeModalGoods.id] || []).filter((p) => p.param_type === "variety").length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-6 text-center text-slate-400">
                              No varieties added yet. Type a variety above and click "+ Add Variety".
                            </td>
                          </tr>
                        ) : (
                          (paramsByGoodsId[activeModalGoods.id] || [])
                            .filter((p) => p.param_type === "variety")
                            .map((p, idx) => (
                              <tr key={p.id} className="border-b hover:bg-slate-50">
                                <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="p-2.5 font-semibold text-amber-900 dark:text-amber-300">{p.param_value}</td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParam(p.id, activeModalGoods.id)}
                                    className="p-1 hover:bg-rose-100 rounded text-rose-600"
                                    title="Delete Variety"
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
              )}

              {/* SECTION 3: Size / Grade (Multiple) */}
              {masterModalTab === 3 && activeModalGoods && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        3. Size / Grade (Multiple) for {activeModalGoods.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        e.g. 18-20, 20-22, 23-25, 25-27, 27-30, 30-32, 32-34, 34-36 MM
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Add Size / Grade (e.g. 18-20)..."
                      value={inlineNewParam[`${activeModalGoods.id}_size`] || ""}
                      onChange={(e) =>
                        setInlineNewParam((prev) => ({
                          ...prev,
                          [`${activeModalGoods.id}_size`]: e.target.value,
                        }))
                      }
                      className="h-9 text-xs font-mono"
                    />
                    <Button
                      onClick={() =>
                        handleAddParameterForGoods(
                          activeModalGoods.id,
                          "size",
                          inlineNewParam[`${activeModalGoods.id}_size`] || ""
                        )
                      }
                      disabled={
                        savingInlineParam[`${activeModalGoods.id}_size`] ||
                        !(inlineNewParam[`${activeModalGoods.id}_size`] || "").trim()
                      }
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 font-semibold shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Add Size
                    </Button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b font-bold text-slate-700">
                          <Th className="p-2.5 text-center w-12">#</Th>
                          <Th className="p-2.5 text-left">Size / Grade</Th>
                          <Th className="p-2.5 text-center w-24">Actions</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paramsByGoodsId[activeModalGoods.id] || []).filter((p) => p.param_type === "size").length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-6 text-center text-slate-400">
                              No sizes/grades added yet. Type a size above and click "+ Add Size".
                            </td>
                          </tr>
                        ) : (
                          (paramsByGoodsId[activeModalGoods.id] || [])
                            .filter((p) => p.param_type === "size")
                            .map((p, idx) => (
                              <tr key={p.id} className="border-b hover:bg-slate-50">
                                <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="p-2.5 font-mono font-bold text-indigo-900 dark:text-indigo-300">{p.param_value}</td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParam(p.id, activeModalGoods.id)}
                                    className="p-1 hover:bg-rose-100 rounded text-rose-600"
                                    title="Delete Size"
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
              )}

              {/* SECTION 4: Brand (Multiple) */}
              {masterModalTab === 4 && activeModalGoods && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        4. Brand (Multiple) for {activeModalGoods.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        e.g. DGT, DADI HEALTHY, PREMIUM, GOLDEN, NATURAL, FARM FRESH, ABC
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Add Brand Name (e.g. DGT LLC)..."
                      value={inlineNewParam[`${activeModalGoods.id}_brand`] || ""}
                      onChange={(e) =>
                        setInlineNewParam((prev) => ({
                          ...prev,
                          [`${activeModalGoods.id}_brand`]: e.target.value,
                        }))
                      }
                      className="h-9 text-xs font-semibold"
                    />
                    <Button
                      onClick={() =>
                        handleAddParameterForGoods(
                          activeModalGoods.id,
                          "brand",
                          inlineNewParam[`${activeModalGoods.id}_brand`] || ""
                        )
                      }
                      disabled={
                        savingInlineParam[`${activeModalGoods.id}_brand`] ||
                        !(inlineNewParam[`${activeModalGoods.id}_brand`] || "").trim()
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Add Brand
                    </Button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b font-bold text-slate-700">
                          <Th className="p-2.5 text-center w-12">#</Th>
                          <Th className="p-2.5 text-left">Brand Name</Th>
                          <Th className="p-2.5 text-center w-24">Actions</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paramsByGoodsId[activeModalGoods.id] || []).filter((p) => p.param_type === "brand").length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-6 text-center text-slate-400">
                              No brands added yet. Type a brand above and click "+ Add Brand".
                            </td>
                          </tr>
                        ) : (
                          (paramsByGoodsId[activeModalGoods.id] || [])
                            .filter((p) => p.param_type === "brand")
                            .map((p, idx) => (
                              <tr key={p.id} className="border-b hover:bg-slate-50">
                                <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{p.param_value}</td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParam(p.id, activeModalGoods.id)}
                                    className="p-1 hover:bg-rose-100 rounded text-rose-600"
                                    title="Delete Brand"
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
              )}

              {/* SECTION 5: Reports / Extra Details (Multiple per Variant) */}
              {masterModalTab === 5 && activeModalGoods && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        5. Reports / Extra Details (Multiple per Variant) for {activeModalGoods.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        e.g. Premium Quality, Export Quality, Local Market, Special Packing, Lab Test Available
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Add Report / Spec (e.g. Premium Quality, 90% Light)..."
                      value={inlineNewParam[`${activeModalGoods.id}_extra_details`] || ""}
                      onChange={(e) =>
                        setInlineNewParam((prev) => ({
                          ...prev,
                          [`${activeModalGoods.id}_extra_details`]: e.target.value,
                        }))
                      }
                      className="h-9 text-xs"
                    />
                    <Button
                      onClick={() =>
                        handleAddParameterForGoods(
                          activeModalGoods.id,
                          "extra_details",
                          inlineNewParam[`${activeModalGoods.id}_extra_details`] || ""
                        )
                      }
                      disabled={
                        savingInlineParam[`${activeModalGoods.id}_extra_details`] ||
                        !(inlineNewParam[`${activeModalGoods.id}_extra_details`] || "").trim()
                      }
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-9 font-semibold shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Add Report
                    </Button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b font-bold text-slate-700">
                          <Th className="p-2.5 text-center w-12">#</Th>
                          <Th className="p-2.5 text-left">Report Name / Specification</Th>
                          <Th className="p-2.5 text-center w-24">Actions</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paramsByGoodsId[activeModalGoods.id] || []).filter((p) => p.param_type === "extra_details").length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-6 text-center text-slate-400">
                              No reports or specifications added yet. Add one above.
                            </td>
                          </tr>
                        ) : (
                          (paramsByGoodsId[activeModalGoods.id] || [])
                            .filter((p) => p.param_type === "extra_details")
                            .map((p, idx) => (
                              <tr key={p.id} className="border-b hover:bg-slate-50">
                                <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{p.param_value}</td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParam(p.id, activeModalGoods.id)}
                                    className="p-1 hover:bg-rose-100 rounded text-rose-600"
                                    title="Delete Report"
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
              )}

              {/* SECTION 6: Final Variants Register (All Combinations) */}
              {masterModalTab === 6 && activeModalGoods && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        6. Final Variants Register (All Combinations)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Pairs of Variety + Size + Brand + Report linked to {activeModalGoods.name}.
                      </p>
                    </div>

                    <Button
                      onClick={() => openAddCombinationModal(activeModalGoods)}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Add Variant Combination
                    </Button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b font-bold text-slate-700">
                          <Th className="p-2.5 text-center w-12">#</Th>
                          <Th className="p-2.5 text-left">Variety</Th>
                          <Th className="p-2.5 text-left">Size / Grade</Th>
                          <Th className="p-2.5 text-left">Brand</Th>
                          <Th className="p-2.5 text-left">Report / Specification</Th>
                          <Th className="p-2.5 text-center w-24">Actions</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeModalGoods.variations || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400">
                              No combinations added yet. Click "+ Add Variant Combination" above.
                            </td>
                          </tr>
                        ) : (
                          activeModalGoods.variations.map((v, idx) => (
                            <tr key={v.id} className="border-b hover:bg-slate-50">
                              <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="p-2.5 font-medium text-amber-700">{v.variety || "-"}</td>
                              <td className="p-2.5 font-mono font-bold text-slate-800">{v.size || "-"}</td>
                              <td className="p-2.5 font-semibold text-slate-800">{v.brand || "-"}</td>
                              <td className="p-2.5 text-slate-600">{v.extra_details || "-"}</td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditCombinationModal(activeModalGoods, v)}
                                    className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCombination(activeModalGoods.id, v)}
                                    className="p-1 hover:bg-rose-100 rounded text-rose-600"
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
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                {activeModalGoods ? (
                  <span>
                    Item saved in database. Changes in options 2–6 apply directly.
                  </span>
                ) : (
                  <span>Fill and save Section 1 first to unlock options 2, 3, 4, 5, 6.</span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMasterModalOpen(false)}
                className="h-8 text-xs font-semibold px-4"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMBINATION MODAL: ADD / EDIT FINAL VARIANT COMBINATION                    */}
      {/* ========================================================================= */}
      {isCombinationModalOpen && targetGoodsForCombination && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingCombination ? "Edit Variant Combination" : "Add Variant Combination"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    For: <span className="font-semibold text-slate-800 dark:text-slate-200">{targetGoodsForCombination.name}</span>{" "}
                    ({targetGoodsForCombination.chs_code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCombinationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCombination} className="p-6 space-y-4">
              {/* Variety Select or Custom */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Variety / Type
                </label>
                <Input
                  placeholder="e.g. IMPAX, INDEPENDENCE, CARMEL"
                  value={combinationForm.variety}
                  onChange={(e) => setCombinationForm({ ...combinationForm, variety: e.target.value })}
                  className="h-9 text-sm"
                />
                {((paramsByGoodsId[targetGoodsForCombination.id] || []).filter((p) => p.param_type === "variety")).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(paramsByGoodsId[targetGoodsForCombination.id] || [])
                      .filter((p) => p.param_type === "variety")
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setCombinationForm({ ...combinationForm, variety: p.param_value })}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded border transition-colors",
                            combinationForm.variety === p.param_value
                              ? "bg-amber-600 text-white border-amber-600 font-bold"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          )}
                        >
                          {p.param_value}
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
                  placeholder="e.g. 18-20, 20-22, 34-36 MM"
                  value={combinationForm.size}
                  onChange={(e) => setCombinationForm({ ...combinationForm, size: e.target.value })}
                  required
                  className="font-mono h-9 text-sm font-bold"
                />
                {((paramsByGoodsId[targetGoodsForCombination.id] || []).filter((p) => p.param_type === "size")).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(paramsByGoodsId[targetGoodsForCombination.id] || [])
                      .filter((p) => p.param_type === "size")
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setCombinationForm({ ...combinationForm, size: p.param_value })}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded border transition-colors",
                            combinationForm.size === p.param_value
                              ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          )}
                        >
                          {p.param_value}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Brand Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Brand <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. DGT LLC, DADI HEALTHY, PREMIUM"
                  value={combinationForm.brand}
                  onChange={(e) => setCombinationForm({ ...combinationForm, brand: e.target.value })}
                  required
                  className="font-medium h-9 text-sm"
                />
                {((paramsByGoodsId[targetGoodsForCombination.id] || []).filter((p) => p.param_type === "brand")).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(paramsByGoodsId[targetGoodsForCombination.id] || [])
                      .filter((p) => p.param_type === "brand")
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setCombinationForm({ ...combinationForm, brand: p.param_value })}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded border transition-colors",
                            combinationForm.brand === p.param_value
                              ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          )}
                        >
                          {p.param_value}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Report / Extra Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Report / Specification
                </label>
                <Input
                  placeholder="e.g. Premium Quality, 90% Light, Export Quality"
                  value={combinationForm.extraDetails}
                  onChange={(e) => setCombinationForm({ ...combinationForm, extraDetails: e.target.value })}
                  className="h-9 text-sm"
                />
                {((paramsByGoodsId[targetGoodsForCombination.id] || []).filter((p) => p.param_type === "extra_details")).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(paramsByGoodsId[targetGoodsForCombination.id] || [])
                      .filter((p) => p.param_type === "extra_details")
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setCombinationForm({ ...combinationForm, extraDetails: p.param_value })}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded border transition-colors",
                            combinationForm.extraDetails === p.param_value
                              ? "bg-purple-600 text-white border-purple-600 font-bold"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          )}
                        >
                          {p.param_value}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-150 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCombinationModalOpen(false)}
                  className="px-4 h-9 text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingCombination}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 h-9 shadow-sm"
                >
                  {savingCombination ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1.5" />
                  )}
                  {editingCombination ? "Update Combination" : "Save Combination"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GLOBAL MASTER PARAMETERS MODAL                                            */}
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
                  Manage global preset Varieties, Sizes, Brands and Specifications in the database.
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
                {(["variety", "size", "brand", "extra_details"] as const).map((tab) => (
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
                    {tab === "variety"
                      ? "1. Varieties"
                      : tab === "size"
                      ? "2. Sizes / Grades"
                      : tab === "brand"
                      ? "3. Brands"
                      : "4. Reports / Specs"}
                  </button>
                ))}
              </div>

              <form
                onSubmit={async (e) => {
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
                    await loadMasterParameters();
                  } catch (err: any) {
                    alert(`Failed to add parameter: ${err.message}`);
                  } finally {
                    setSavingParam(false);
                  }
                }}
                className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <Input
                  placeholder="Add new preset entry..."
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
                                  <Button size="sm" onClick={() => handleUpdateParam(p.id)} className="h-7 bg-emerald-600 text-white text-[11px]">
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
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                Active
                              </span>
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
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteParam(p.id)}
                                  className="p-1 hover:bg-rose-100 text-rose-600 rounded"
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
                category: g.category || "Dry Fruits",
                variety: v.variety || "-",
                brand: v.brand || "-",
                size: v.size || "-",
                extra_details: v.extra_details || "-",
                is_active: g.is_active && v.is_active,
              }))
            : [
                {
                  chs_code: g.chs_code,
                  name: g.name,
                  category: g.category || "Dry Fruits",
                  variety: "-",
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
          { key: "category", label: translateHeader(lang, "Category") },
          { key: "variety", label: translateHeader(lang, "Variety") },
          { key: "size", label: translateHeader(lang, "SIZE / GRADE") },
          { key: "brand", label: translateHeader(lang, "Brand") },
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
