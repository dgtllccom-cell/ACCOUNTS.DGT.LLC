"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Layers,
  Sparkles,
  Tag,
  SlidersHorizontal,
  Award,
  Package,
  FileText,
  ListTree,
  Search,
  Filter,
  CheckCircle2,
  Loader2,
  CornerDownRight,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import type { GoodsRecord, GoodsVariation } from "./goods-master-registry";

// =========================================================================
// Data Models for Hierarchy
// Goods → Variety → Size → Grade → Brand → Extra Details → Detail Lines
// =========================================================================

export type DetailItem = {
  id: string;
  title: string;
  lines: string[];
};

export type BrandNode = {
  brandName: string;
  variationId: string;
  isActive: boolean;
  extraDetails: DetailItem[];
  rawVariation: GoodsVariation;
};

export type GradeNode = {
  gradeName: string;
  brands: BrandNode[];
};

export type SizeNode = {
  sizeName: string;
  grades: GradeNode[];
};

export type VarietyNode = {
  varietyName: string;
  sizes: SizeNode[];
};

// Parser for Extra Details (supports JSON and legacy text)
export function parseExtraDetails(raw?: string | null): DetailItem[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();

  // Try parsing as JSON array
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          id: item.id || `ed-${idx + 1}`,
          title: item.title || item.name || `Detail #${idx + 1}`,
          lines: Array.isArray(item.lines)
            ? item.lines.map(String).filter((l: string) => l.trim().length > 0)
            : item.lines
            ? [String(item.lines)]
            : [],
        }));
      }
    } catch {
      // fallback to delimiter parsing
    }
  }

  // Legacy delimiter split: "|" or newlines
  const parts = trimmed.split(/\s*\|\s*|\n+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];

  return parts.map((part, idx) => {
    // Check if line contains a colon e.g. "Kernel Yield: 50%" or "Packaging: 25kg"
    const colonIdx = part.indexOf(":");
    if (colonIdx > 0 && colonIdx < part.length - 1) {
      const title = part.substring(0, colonIdx).trim();
      const val = part.substring(colonIdx + 1).trim();
      return {
        id: `ed-legacy-${idx + 1}`,
        title: title || part,
        lines: val ? [val] : [part],
      };
    }
    return {
      id: `ed-legacy-${idx + 1}`,
      title: part,
      lines: [part],
    };
  });
}

export function serializeExtraDetails(items: DetailItem[]): string {
  if (!items || items.length === 0) return "";
  return JSON.stringify(items);
}

interface GoodsHierarchyTreeProps {
  goods: GoodsRecord;
  onRefresh: () => Promise<void>;
}

export function GoodsHierarchyTree({ goods, onRefresh }: GoodsHierarchyTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [busy, setBusy] = useState(false);

  // Expansion state sets
  const [expandedVarieties, setExpandedVarieties] = useState<Set<string>>(new Set());
  const [expandedSizes, setExpandedSizes] = useState<Set<string>>(new Set());
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  // Compact Inline Edit State
  const [editState, setEditState] = useState<{
    type: "variety" | "size" | "grade" | "brand" | "extraDetail" | "detailLine";
    variety?: string;
    size?: string;
    grade?: string;
    brand?: string;
    variationId?: string;
    detailId?: string;
    lineIndex?: number;
    initialValue: string;
    currentValue: string;
  } | null>(null);

  // Quick Add Child Modal / State
  const [quickAddState, setQuickAddState] = useState<{
    level: "variety" | "size" | "grade" | "brand" | "extraDetail" | "detailLine";
    variety?: string;
    size?: string;
    grade?: string;
    brand?: string;
    variationId?: string;
    detailId?: string;
    name: string;
    subValue?: string; // used for initial detail line
  } | null>(null);

  // Full combination modal
  const [showAddComboModal, setShowAddComboModal] = useState(false);
  const [comboForm, setComboForm] = useState({
    variety: "",
    size: "",
    grade: "Premium Grade",
    brand: "DGT",
    detailTitle: "Premium Quality",
    detailLines: "Moisture: max 5%\nForeign Material: max 0.05%",
  });

  // Build the hierarchical tree from goods.variations
  const tree: VarietyNode[] = useMemo(() => {
    const rawVariations = goods.variations || [];
    const varietyMap = new Map<string, Map<string, Map<string, BrandNode[]>>>();

    for (const v of rawVariations) {
      const varietyKey = (v.variety || "").trim() || "Standard Variety";
      const sizeKey = (v.size || "").trim() || "Standard Size";
      const gradeKey = ((v as any).grade || "").trim() || "Standard Grade";
      const brandKey = (v.brand || "").trim() || "Default Brand";

      if (!varietyMap.has(varietyKey)) {
        varietyMap.set(varietyKey, new Map());
      }
      const sizeMap = varietyMap.get(varietyKey)!;

      if (!sizeMap.has(sizeKey)) {
        sizeMap.set(sizeKey, new Map());
      }
      const gradeMap = sizeMap.get(sizeKey)!;

      if (!gradeMap.has(gradeKey)) {
        gradeMap.set(gradeKey, []);
      }
      const brandList = gradeMap.get(gradeKey)!;

      brandList.push({
        brandName: brandKey,
        variationId: v.id,
        isActive: v.is_active,
        extraDetails: parseExtraDetails(v.extra_details),
        rawVariation: v,
      });
    }

    const result: VarietyNode[] = [];
    varietyMap.forEach((sizeMap, varietyName) => {
      const sizes: SizeNode[] = [];
      sizeMap.forEach((gradeMap, sizeName) => {
        const grades: GradeNode[] = [];
        gradeMap.forEach((brands, gradeName) => {
          grades.push({ gradeName, brands });
        });
        sizes.push({ sizeName, grades });
      });
      result.push({ varietyName, sizes });
    });

    return result;
  }, [goods.variations]);

  // Total counts for stats bar
  const stats = useMemo(() => {
    let totalVarieties = tree.length;
    let totalSizes = 0;
    let totalGrades = 0;
    let totalBrands = 0;
    let totalExtraDetails = 0;
    let totalDetailLines = 0;

    for (const v of tree) {
      totalSizes += v.sizes.length;
      for (const s of v.sizes) {
        totalGrades += s.grades.length;
        for (const gr of s.grades) {
          totalBrands += gr.brands.length;
          for (const b of gr.brands) {
            totalExtraDetails += b.extraDetails.length;
            for (const ed of b.extraDetails) {
              totalDetailLines += ed.lines.length;
            }
          }
        }
      }
    }

    return {
      totalVarieties,
      totalSizes,
      totalGrades,
      totalBrands,
      totalExtraDetails,
      totalDetailLines,
      totalCombinations: (goods.variations || []).length,
    };
  }, [tree, goods.variations]);

  // Expand first variety on load if none expanded
  React.useEffect(() => {
    if (tree.length > 0 && expandedVarieties.size === 0) {
      setExpandedVarieties(new Set([tree[0].varietyName]));
      if (tree[0].sizes.length > 0) {
        const firstSizeKey = `${tree[0].varietyName}:::${tree[0].sizes[0].sizeName}`;
        setExpandedSizes(new Set([firstSizeKey]));
        if (tree[0].sizes[0].grades.length > 0) {
          const firstGradeKey = `${firstSizeKey}:::${tree[0].sizes[0].grades[0].gradeName}`;
          setExpandedGrades(new Set([firstGradeKey]));
        }
      }
    }
  }, [tree]);

  // Expand / Collapse All
  function toggleExpandAll() {
    if (expandedVarieties.size > 0) {
      // Collapse all
      setExpandedVarieties(new Set());
      setExpandedSizes(new Set());
      setExpandedGrades(new Set());
      setExpandedBrands(new Set());
      setExpandedDetails(new Set());
    } else {
      // Expand all
      const allV = new Set<string>();
      const allS = new Set<string>();
      const allG = new Set<string>();
      const allB = new Set<string>();
      const allD = new Set<string>();

      for (const v of tree) {
        allV.add(v.varietyName);
        for (const s of v.sizes) {
          const sKey = `${v.varietyName}:::${s.sizeName}`;
          allS.add(sKey);
          for (const gr of s.grades) {
            const gKey = `${sKey}:::${gr.gradeName}`;
            allG.add(gKey);
            for (const b of gr.brands) {
              const bKey = `${gKey}:::${b.brandName}`;
              allB.add(bKey);
              for (const ed of b.extraDetails) {
                allD.add(ed.id);
              }
            }
          }
        }
      }
      setExpandedVarieties(allV);
      setExpandedSizes(allS);
      setExpandedGrades(allG);
      setExpandedBrands(allB);
      setExpandedDetails(allD);
    }
  }

  // Toggle helpers
  function toggleVariety(name: string) {
    setExpandedVarieties((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleSize(vName: string, sName: string) {
    const key = `${vName}:::${sName}`;
    setExpandedSizes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleGrade(vName: string, sName: string, grName: string) {
    const key = `${vName}:::${sName}:::${grName}`;
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleBrand(vName: string, sName: string, grName: string, bName: string) {
    const key = `${vName}:::${sName}:::${grName}:::${bName}`;
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleDetail(detailId: string) {
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      next.has(detailId) ? next.delete(detailId) : next.add(detailId);
      return next;
    });
  }

  // =========================================================================
  // Save Inline Edit (Variety, Size, Grade, Brand, Extra Detail, Detail Line)
  // =========================================================================
  async function handleSaveEdit() {
    if (!editState) return;
    const newVal = editState.currentValue.trim();
    if (!newVal) {
      alert("Value cannot be blank.");
      return;
    }

    setBusy(true);
    try {
      if (editState.type === "variety") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "renameVariety",
          oldVariety: editState.initialValue,
          newVariety: newVal,
        });
      } else if (editState.type === "size") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "renameSize",
          variety: editState.variety,
          oldSize: editState.initialValue,
          newSize: newVal,
        });
      } else if (editState.type === "grade") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "renameGrade",
          variety: editState.variety,
          size: editState.size!,
          oldGrade: editState.initialValue,
          newGrade: newVal,
        });
      } else if (editState.type === "brand") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "renameBrand",
          variety: editState.variety,
          size: editState.size!,
          grade: editState.grade,
          oldBrand: editState.initialValue,
          newBrand: newVal,
        });
      } else if (editState.type === "extraDetail") {
        // Find variation and update detail item title
        const variation = (goods.variations || []).find((v) => v.id === editState.variationId);
        if (variation) {
          const details = parseExtraDetails(variation.extra_details);
          const target = details.find((d) => d.id === editState.detailId);
          if (target) {
            target.title = newVal;
            await apiPatch(`/api/erp/goods-master/variations/${variation.id}`, {
              extraDetails: serializeExtraDetails(details),
            });
          }
        }
      } else if (editState.type === "detailLine") {
        // Find variation and update specific line
        const variation = (goods.variations || []).find((v) => v.id === editState.variationId);
        if (variation) {
          const details = parseExtraDetails(variation.extra_details);
          const target = details.find((d) => d.id === editState.detailId);
          if (target && editState.lineIndex !== undefined) {
            target.lines[editState.lineIndex] = newVal;
            await apiPatch(`/api/erp/goods-master/variations/${variation.id}`, {
              extraDetails: serializeExtraDetails(details),
            });
          }
        }
      }

      setEditState(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to update value: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // Save Quick Add Child
  // =========================================================================
  async function handleSaveQuickAdd() {
    if (!quickAddState) return;
    const name = quickAddState.name.trim();
    if (!name) {
      alert("Name / value is required.");
      return;
    }

    setBusy(true);
    try {
      if (quickAddState.level === "variety") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "addNode",
          level: "variety",
          variety: name,
          size: "Standard Size",
          grade: "Standard Grade",
          brand: "Default Brand",
        });
        setExpandedVarieties((prev) => new Set([...prev, name]));
      } else if (quickAddState.level === "size") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "addNode",
          level: "size",
          variety: quickAddState.variety,
          size: name,
          grade: "Standard Grade",
          brand: "Default Brand",
        });
        const sKey = `${quickAddState.variety}:::${name}`;
        setExpandedSizes((prev) => new Set([...prev, sKey]));
      } else if (quickAddState.level === "grade") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "addNode",
          level: "grade",
          variety: quickAddState.variety,
          size: quickAddState.size,
          grade: name,
          brand: "Default Brand",
        });
        const gKey = `${quickAddState.variety}:::${quickAddState.size}:::${name}`;
        setExpandedGrades((prev) => new Set([...prev, gKey]));
      } else if (quickAddState.level === "brand") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "addNode",
          level: "brand",
          variety: quickAddState.variety,
          size: quickAddState.size,
          grade: quickAddState.grade,
          brand: name,
        });
        const bKey = `${quickAddState.variety}:::${quickAddState.size}:::${quickAddState.grade}:::${name}`;
        setExpandedBrands((prev) => new Set([...prev, bKey]));
      } else if (quickAddState.level === "extraDetail") {
        // Add new Extra Detail item to variation
        const variation = (goods.variations || []).find((v) => v.id === quickAddState.variationId);
        if (variation) {
          const details = parseExtraDetails(variation.extra_details);
          const newId = `ed-${Date.now()}`;
          const initialLines = quickAddState.subValue
            ? quickAddState.subValue.split("\n").map((l) => l.trim()).filter(Boolean)
            : [];
          details.push({
            id: newId,
            title: name,
            lines: initialLines.length > 0 ? initialLines : ["Specification standard"],
          });
          await apiPatch(`/api/erp/goods-master/variations/${variation.id}`, {
            extraDetails: serializeExtraDetails(details),
          });
          setExpandedDetails((prev) => new Set([...prev, newId]));
        }
      } else if (quickAddState.level === "detailLine") {
        // Append detail line to extra detail item
        const variation = (goods.variations || []).find((v) => v.id === quickAddState.variationId);
        if (variation) {
          const details = parseExtraDetails(variation.extra_details);
          const target = details.find((d) => d.id === quickAddState.detailId);
          if (target) {
            target.lines.push(name);
            await apiPatch(`/api/erp/goods-master/variations/${variation.id}`, {
              extraDetails: serializeExtraDetails(details),
            });
          }
        }
      }

      setQuickAddState(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to add: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // Delete Node (Variety, Size, Grade, Brand, Extra Detail, Detail Line)
  // =========================================================================
  async function handleDeleteNode(
    level: "variety" | "size" | "grade" | "brand" | "extraDetail" | "detailLine",
    payload: {
      variety?: string;
      size?: string;
      grade?: string;
      brand?: string;
      variationId?: string;
      detailId?: string;
      lineIndex?: number;
      label: string;
    }
  ) {
    if (!window.confirm(`Delete ${level} "${payload.label}"?`)) return;

    setBusy(true);
    try {
      if (level === "variety" || level === "size" || level === "grade" || level === "brand") {
        await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
          action: "deleteNode",
          level,
          variety: payload.variety,
          size: payload.size,
          grade: payload.grade,
          brand: payload.brand,
        });
      } else if (level === "extraDetail") {
        const variation = (goods.variations || []).find((v) => v.id === payload.variationId);
        if (variation) {
          const details = parseExtraDetails(variation.extra_details).filter((d) => d.id !== payload.detailId);
          await apiPatch(`/api/erp/goods-master/variations/${variation.id}`, {
            extraDetails: serializeExtraDetails(details),
          });
        }
      } else if (level === "detailLine") {
        const variation = (goods.variations || []).find((v) => v.id === payload.variationId);
        if (variation) {
          const details = parseExtraDetails(variation.extra_details);
          const target = details.find((d) => d.id === payload.detailId);
          if (target && payload.lineIndex !== undefined) {
            target.lines.splice(payload.lineIndex, 1);
            await apiPatch(`/api/erp/goods-master/variations/${variation.id}`, {
              extraDetails: serializeExtraDetails(details),
            });
          }
        }
      }
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // Add Full Variant Combination Modal Submit
  // =========================================================================
  async function handleAddFullCombo(e: React.FormEvent) {
    e.preventDefault();
    if (!comboForm.variety.trim() || !comboForm.size.trim() || !comboForm.brand.trim()) {
      alert("Please fill in Variety, Size, and Brand.");
      return;
    }

    setBusy(true);
    try {
      const lines = comboForm.detailLines
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const extraDetailsArray: DetailItem[] = [
        {
          id: `ed-${Date.now()}`,
          title: comboForm.detailTitle.trim() || "Quality Specs",
          lines: lines.length > 0 ? lines : ["Standard specification"],
        },
      ];

      await apiPost(`/api/erp/goods-master/${goods.id}/variations`, {
        variety: comboForm.variety.trim(),
        size: comboForm.size.trim(),
        grade: comboForm.grade.trim() || "Standard Grade",
        brand: comboForm.brand.trim(),
        extraDetails: serializeExtraDetails(extraDetailsArray),
      });

      setShowAddComboModal(false);
      setComboForm({
        variety: "",
        size: "",
        grade: "Premium Grade",
        brand: "DGT",
        detailTitle: "Premium Quality",
        detailLines: "Moisture: max 5%\nForeign Material: max 0.05%",
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to add combination: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Filtered Tree (Search)
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return tree;
    const q = searchTerm.toLowerCase().trim();

    return tree
      .map((v) => {
        const vMatches = v.varietyName.toLowerCase().includes(q);
        const filteredSizes = v.sizes
          .map((s) => {
            const sMatches = s.sizeName.toLowerCase().includes(q);
            const filteredGrades = s.grades
              .map((gr) => {
                const grMatches = gr.gradeName.toLowerCase().includes(q);
                const filteredBrands = gr.brands.filter(
                  (b) =>
                    b.brandName.toLowerCase().includes(q) ||
                    b.extraDetails.some(
                      (ed) =>
                        ed.title.toLowerCase().includes(q) ||
                        ed.lines.some((l) => l.toLowerCase().includes(q))
                    )
                );
                if (grMatches || filteredBrands.length > 0) {
                  return { ...gr, brands: filteredBrands.length > 0 ? filteredBrands : gr.brands };
                }
                return null;
              })
              .filter(Boolean) as GradeNode[];

            if (sMatches || filteredGrades.length > 0) {
              return { ...s, grades: filteredGrades.length > 0 ? filteredGrades : s.grades };
            }
            return null;
          })
          .filter(Boolean) as SizeNode[];

        if (vMatches || filteredSizes.length > 0) {
          return { ...v, sizes: filteredSizes.length > 0 ? filteredSizes : v.sizes };
        }
        return null;
      })
      .filter(Boolean) as VarietyNode[];
  }, [tree, searchTerm]);

  return (
    <div className="p-3 sm:p-5 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 dark:from-slate-900/90 dark:via-slate-950 dark:to-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-xs">
      {/* ----------------------------------------------------------------- */}
      {/* 1. Header Toolbar: Summary Badges & Quick Action Buttons          */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <ListTree className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {goods.name}
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold">
              HS: {goods.chs_code || "N/A"}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              {stats.totalVarieties} Varieties • {stats.totalSizes} Sizes • {stats.totalBrands} Brands
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
              {stats.totalExtraDetails} Extra Details • {stats.totalDetailLines} Detail Lines
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
            <span>Hierarchy:</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">Variety</span>
            <span>→</span>
            <span className="text-sky-600 dark:text-sky-400 font-semibold">Size</span>
            <span>→</span>
            <span className="text-purple-600 dark:text-purple-400 font-semibold">Grade</span>
            <span>→</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Brand</span>
            <span>→</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">Extra Details</span>
            <span>→</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">Detail Lines</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Tree Search Filter */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search tree..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7.5 pl-8 pr-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            />
          </div>

          {/* Expand/Collapse All */}
          <button
            type="button"
            onClick={toggleExpandAll}
            className="h-7.5 px-2.5 text-[11px] font-semibold rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            {expandedVarieties.size > 0 ? "Collapse All" : "Expand All"}
          </button>

          {/* + Add Variety */}
          <button
            type="button"
            onClick={() => setQuickAddState({ level: "variety", name: "" })}
            className="h-7.5 px-2.5 text-[11px] font-bold rounded bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shadow-xs transition-colors"
            title="Add a new Variety under this Good"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            Variety
          </button>

          {/* + Add Full Combination */}
          <button
            type="button"
            onClick={() => setShowAddComboModal(true)}
            className="h-7.5 px-3 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-xs transition-colors"
            title="Add full Variety → Size → Grade → Brand combination"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            Combination
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Hierarchical Tree Nodes                                        */}
      {/* ----------------------------------------------------------------- */}
      {filteredTree.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 font-medium">No variations recorded yet for {goods.name}.</p>
          <div className="mt-2 flex justify-center gap-2">
            <Button
              size="sm"
              onClick={() => setQuickAddState({ level: "variety", name: "" })}
              className="bg-amber-600 hover:bg-amber-700 text-white h-7.5 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add First Variety
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddComboModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-7.5 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Full Combination
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTree.map((variety) => {
            const isVExpanded = expandedVarieties.has(variety.varietyName);
            const totalVarCombos = variety.sizes.reduce(
              (acc, s) => acc + s.grades.reduce((gAcc, gr) => gAcc + gr.brands.length, 0),
              0
            );

            return (
              <div
                key={variety.varietyName}
                className="rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden"
              >
                {/* ---------------- Level 1: Variety Node ---------------- */}
                <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/20 hover:bg-amber-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleVariety(variety.varietyName)}
                      className="w-5 h-5 flex items-center justify-center rounded text-amber-700 dark:text-amber-400 hover:bg-amber-200/50 transition-colors"
                    >
                      {isVExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="font-bold text-amber-900 dark:text-amber-300 text-xs tracking-wide">
                      {variety.varietyName}
                    </span>

                    {/* Small inline pencil icon directly beside Variety */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditState({
                          type: "variety",
                          initialValue: variety.varietyName,
                          currentValue: variety.varietyName,
                        })
                      }
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-amber-200/60 text-amber-700 dark:text-amber-400 transition-colors"
                      title="Edit Variety Name"
                    >
                      <Edit2 className="w-3 h-3 stroke-[2.2]" />
                    </button>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold font-mono">
                      {variety.sizes.length} {variety.sizes.length === 1 ? "Size" : "Sizes"} • {totalVarCombos} {totalVarCombos === 1 ? "Combo" : "Combos"}
                    </span>
                  </div>

                  {/* Actions for Variety: + Add Size, Delete Variety */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setQuickAddState({
                          level: "size",
                          variety: variety.varietyName,
                          name: "",
                        })
                      }
                      className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 font-bold text-[10px] flex items-center gap-0.5 transition-colors"
                      title="Add Size under this Variety"
                    >
                      <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                      Size
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteNode("variety", {
                          variety: variety.varietyName,
                          label: variety.varietyName,
                        })
                      }
                      className="w-5 h-5 flex items-center justify-center rounded text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors"
                      title="Delete this Variety and its variants"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* ---------------- Level 2: Sizes under Variety ---------------- */}
                {isVExpanded && (
                  <div className="pl-5 pr-2.5 py-2 space-y-2 border-t border-amber-100 dark:border-amber-950/60 bg-amber-50/20 dark:bg-slate-950/30">
                    {variety.sizes.length === 0 ? (
                      <p className="text-slate-400 text-[11px] italic py-1 pl-3">
                        No sizes under this variety. Click "+ Size" above to add one.
                      </p>
                    ) : (
                      variety.sizes.map((size) => {
                        const sizeKey = `${variety.varietyName}:::${size.sizeName}`;
                        const isSExpanded = expandedSizes.has(sizeKey);

                        return (
                          <div
                            key={size.sizeName}
                            className="rounded border border-sky-200/80 dark:border-sky-900/50 bg-white dark:bg-slate-900 overflow-hidden"
                          >
                            {/* Size Row */}
                            <div className="flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-r from-sky-50/80 to-white dark:from-sky-950/40 dark:to-slate-900 hover:bg-sky-50 transition-colors">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleSize(variety.varietyName, size.sizeName)}
                                  className="w-4.5 h-4.5 flex items-center justify-center rounded text-sky-700 dark:text-sky-400 hover:bg-sky-200/50"
                                >
                                  {isSExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <SlidersHorizontal className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                <span className="font-bold text-sky-900 dark:text-sky-300 font-mono text-[11px]">
                                  {size.sizeName}
                                </span>

                                {/* Small inline pencil icon directly beside Size */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditState({
                                      type: "size",
                                      variety: variety.varietyName,
                                      initialValue: size.sizeName,
                                      currentValue: size.sizeName,
                                    })
                                  }
                                  className="w-4.5 h-4.5 flex items-center justify-center rounded hover:bg-sky-200/60 text-sky-700 dark:text-sky-400 transition-colors"
                                  title="Edit Size"
                                >
                                  <Edit2 className="w-2.5 h-2.5 stroke-[2.2]" />
                                </button>

                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-medium">
                                  {size.grades.length} {size.grades.length === 1 ? "Grade" : "Grades"}
                                </span>
                              </div>

                              {/* Size actions: + Add Grade, Delete Size */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuickAddState({
                                      level: "grade",
                                      variety: variety.varietyName,
                                      size: size.sizeName,
                                      name: "",
                                    })
                                  }
                                  className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 font-bold text-[10px] flex items-center gap-0.5"
                                  title="Add Grade under this Size"
                                >
                                  <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                                  Grade
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteNode("size", {
                                      variety: variety.varietyName,
                                      size: size.sizeName,
                                      label: size.sizeName,
                                    })
                                  }
                                  className="w-4.5 h-4.5 flex items-center justify-center rounded text-rose-500 hover:bg-rose-100"
                                  title="Delete this Size"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>

                            {/* ---------------- Level 3: Grades under Size ---------------- */}
                            {isSExpanded && (
                              <div className="pl-5 pr-2 py-1.5 space-y-1.5 border-t border-sky-100 dark:border-sky-950/60 bg-sky-50/20 dark:bg-slate-950/20">
                                {size.grades.length === 0 ? (
                                  <p className="text-slate-400 text-[11px] italic pl-2">
                                    No grades under this size.
                                  </p>
                                ) : (
                                  size.grades.map((grade) => {
                                    const gradeKey = `${variety.varietyName}:::${size.sizeName}:::${grade.gradeName}`;
                                    const isGrExpanded = expandedGrades.has(gradeKey);

                                    return (
                                      <div
                                        key={grade.gradeName}
                                        className="rounded border border-purple-200/80 dark:border-purple-900/50 bg-white dark:bg-slate-900 overflow-hidden"
                                      >
                                        {/* Grade Row */}
                                        <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-purple-50/80 to-white dark:from-purple-950/40 dark:to-slate-900 hover:bg-purple-50 transition-colors">
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                toggleGrade(
                                                  variety.varietyName,
                                                  size.sizeName,
                                                  grade.gradeName
                                                )
                                              }
                                              className="w-4 h-4 flex items-center justify-center rounded text-purple-700 dark:text-purple-400 hover:bg-purple-200/50"
                                            >
                                              {isGrExpanded ? (
                                                <ChevronDown className="w-3 h-3" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3" />
                                              )}
                                            </button>

                                            <Award className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                            <span className="font-semibold text-purple-900 dark:text-purple-300 text-[11px]">
                                              {grade.gradeName}
                                            </span>

                                            {/* Small inline pencil icon directly beside Grade */}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setEditState({
                                                  type: "grade",
                                                  variety: variety.varietyName,
                                                  size: size.sizeName,
                                                  initialValue: grade.gradeName,
                                                  currentValue: grade.gradeName,
                                                })
                                              }
                                              className="w-4 h-4 flex items-center justify-center rounded hover:bg-purple-200/60 text-purple-700 dark:text-purple-400"
                                              title="Edit Grade"
                                            >
                                              <Edit2 className="w-2.5 h-2.5 stroke-[2.2]" />
                                            </button>

                                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-medium">
                                              {grade.brands.length} {grade.brands.length === 1 ? "Brand" : "Brands"}
                                            </span>
                                          </div>

                                          {/* Grade actions: + Add Brand, Delete Grade */}
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setQuickAddState({
                                                  level: "brand",
                                                  variety: variety.varietyName,
                                                  size: size.sizeName,
                                                  grade: grade.gradeName,
                                                  name: "",
                                                })
                                              }
                                              className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 font-bold text-[10px] flex items-center gap-0.5"
                                              title="Add Brand under this Grade"
                                            >
                                              <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                                              Brand
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleDeleteNode("grade", {
                                                  variety: variety.varietyName,
                                                  size: size.sizeName,
                                                  grade: grade.gradeName,
                                                  label: grade.gradeName,
                                                })
                                              }
                                              className="w-4 h-4 flex items-center justify-center rounded text-rose-500 hover:bg-rose-100"
                                              title="Delete this Grade"
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* ---------------- Level 4: Brands under Grade ---------------- */}
                                        {isGrExpanded && (
                                          <div className="pl-4 pr-1.5 py-1.5 space-y-1.5 border-t border-purple-100 dark:border-purple-950/60 bg-purple-50/20 dark:bg-slate-950/20">
                                            {grade.brands.length === 0 ? (
                                              <p className="text-slate-400 text-[10px] italic pl-2">
                                                No brands under this grade.
                                              </p>
                                            ) : (
                                              grade.brands.map((brand) => {
                                                const brandKey = `${variety.varietyName}:::${size.sizeName}:::${grade.gradeName}:::${brand.brandName}`;
                                                const isBExpanded = expandedBrands.has(brandKey);

                                                return (
                                                  <div
                                                    key={brand.variationId}
                                                    className="rounded border border-emerald-200/80 dark:border-emerald-900/50 bg-white dark:bg-slate-900 overflow-hidden"
                                                  >
                                                    {/* Brand Row */}
                                                    <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-emerald-50/80 to-white dark:from-emerald-950/40 dark:to-slate-900 hover:bg-emerald-50 transition-colors">
                                                      <div className="flex items-center gap-2">
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            toggleBrand(
                                                              variety.varietyName,
                                                              size.sizeName,
                                                              grade.gradeName,
                                                              brand.brandName
                                                            )
                                                          }
                                                          className="w-4 h-4 flex items-center justify-center rounded text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200/50"
                                                        >
                                                          {isBExpanded ? (
                                                            <ChevronDown className="w-3 h-3" />
                                                          ) : (
                                                            <ChevronRight className="w-3 h-3" />
                                                          )}
                                                        </button>

                                                        <Package className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                        <span className="font-bold text-emerald-900 dark:text-emerald-300 text-[11px]">
                                                          {brand.brandName}
                                                        </span>

                                                        {/* Small inline pencil icon directly beside Brand */}
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            setEditState({
                                                              type: "brand",
                                                              variety: variety.varietyName,
                                                              size: size.sizeName,
                                                              grade: grade.gradeName,
                                                              initialValue: brand.brandName,
                                                              currentValue: brand.brandName,
                                                            })
                                                          }
                                                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-emerald-200/60 text-emerald-700 dark:text-emerald-400"
                                                          title="Edit Brand"
                                                        >
                                                          <Edit2 className="w-2.5 h-2.5 stroke-[2.2]" />
                                                        </button>

                                                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold font-mono">
                                                          {brand.extraDetails.length} {brand.extraDetails.length === 1 ? "Detail" : "Extra Details"}
                                                        </span>
                                                      </div>

                                                      {/* Brand Actions: + Add Extra Detail, Delete Brand */}
                                                      <div className="flex items-center gap-1">
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            setQuickAddState({
                                                              level: "extraDetail",
                                                              variationId: brand.variationId,
                                                              name: "",
                                                              subValue: "",
                                                            })
                                                          }
                                                          className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 font-bold text-[10px] flex items-center gap-0.5"
                                                          title="Add Extra Detail under this Brand"
                                                        >
                                                          <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                                                          Extra Detail
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            handleDeleteNode("brand", {
                                                              variety: variety.varietyName,
                                                              size: size.sizeName,
                                                              grade: grade.gradeName,
                                                              brand: brand.brandName,
                                                              label: brand.brandName,
                                                            })
                                                          }
                                                          className="w-4 h-4 flex items-center justify-center rounded text-rose-500 hover:bg-rose-100"
                                                          title="Delete this Brand"
                                                        >
                                                          <Trash2 className="w-2.5 h-2.5" />
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* ---------------- Level 5 & 6: Extra Details & Detail Lines ---------------- */}
                                                    {isBExpanded && (
                                                      <div className="pl-4 pr-1.5 py-1.5 space-y-1.5 border-t border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/20 dark:bg-slate-950/20">
                                                        {brand.extraDetails.length === 0 ? (
                                                          <p className="text-slate-400 text-[10px] italic pl-2">
                                                            No Extra Details recorded. Click "+ Extra Detail" above to add specifications.
                                                          </p>
                                                        ) : (
                                                          brand.extraDetails.map((detail) => {
                                                            const isDExpanded = expandedDetails.has(detail.id);

                                                            return (
                                                              <div
                                                                key={detail.id}
                                                                className="rounded border border-rose-200/80 dark:border-rose-900/50 bg-white dark:bg-slate-900 overflow-hidden"
                                                              >
                                                                {/* Level 5: Extra Detail Row */}
                                                                <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-rose-50/80 to-white dark:from-rose-950/40 dark:to-slate-900 hover:bg-rose-50 transition-colors">
                                                                  <div className="flex items-center gap-2">
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => toggleDetail(detail.id)}
                                                                      className="w-3.5 h-3.5 flex items-center justify-center rounded text-rose-700 dark:text-rose-400 hover:bg-rose-200/50"
                                                                    >
                                                                      {isDExpanded ? (
                                                                        <ChevronDown className="w-3 h-3" />
                                                                      ) : (
                                                                        <ChevronRight className="w-3 h-3" />
                                                                      )}
                                                                    </button>

                                                                    <FileText className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                                                    <span className="font-semibold text-rose-900 dark:text-rose-300 text-[10.5px]">
                                                                      {detail.title}
                                                                    </span>

                                                                    {/* Small inline pencil icon directly beside Extra Detail */}
                                                                    <button
                                                                      type="button"
                                                                      onClick={() =>
                                                                        setEditState({
                                                                          type: "extraDetail",
                                                                          variationId: brand.variationId,
                                                                          detailId: detail.id,
                                                                          initialValue: detail.title,
                                                                          currentValue: detail.title,
                                                                        })
                                                                      }
                                                                      className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-rose-200/60 text-rose-700 dark:text-rose-400"
                                                                      title="Edit Extra Detail Title"
                                                                    >
                                                                      <Edit2 className="w-2.5 h-2.5 stroke-[2.2]" />
                                                                    </button>

                                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-medium">
                                                                      {detail.lines.length} {detail.lines.length === 1 ? "Line" : "Lines"}
                                                                    </span>
                                                                  </div>

                                                                  {/* Extra Detail Actions: + Add Detail Line, Delete Detail */}
                                                                  <div className="flex items-center gap-1">
                                                                    <button
                                                                      type="button"
                                                                      onClick={() =>
                                                                        setQuickAddState({
                                                                          level: "detailLine",
                                                                          variationId: brand.variationId,
                                                                          detailId: detail.id,
                                                                          name: "",
                                                                        })
                                                                      }
                                                                      className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-[9.5px] flex items-center gap-0.5"
                                                                      title="Add Detail Line under this Extra Detail"
                                                                    >
                                                                      <Plus className="w-2 h-2 stroke-[2.5]" />
                                                                      Line
                                                                    </button>

                                                                    <button
                                                                      type="button"
                                                                      onClick={() =>
                                                                        handleDeleteNode("extraDetail", {
                                                                          variationId: brand.variationId,
                                                                          detailId: detail.id,
                                                                          label: detail.title,
                                                                        })
                                                                      }
                                                                      className="w-3.5 h-3.5 flex items-center justify-center rounded text-rose-500 hover:bg-rose-100"
                                                                      title="Delete this Extra Detail"
                                                                    >
                                                                      <Trash2 className="w-2.5 h-2.5" />
                                                                    </button>
                                                                  </div>
                                                                </div>

                                                                {/* ---------------- Level 6: Detail Lines ---------------- */}
                                                                {isDExpanded && (
                                                                  <div className="pl-6 pr-2 py-1 space-y-1 border-t border-rose-100 dark:border-rose-950/60 bg-rose-50/15 dark:bg-slate-950/15">
                                                                    {detail.lines.length === 0 ? (
                                                                      <p className="text-slate-400 text-[10px] italic">
                                                                        No detail lines.
                                                                      </p>
                                                                    ) : (
                                                                      detail.lines.map((line, lIdx) => (
                                                                        <div
                                                                          key={lIdx}
                                                                          className="flex items-center justify-between gap-2 py-0.5 text-[10.5px] text-slate-700 dark:text-slate-300 group"
                                                                        >
                                                                          <div className="flex items-center gap-1.5">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                                                            <span>{line}</span>

                                                                            {/* Small inline pencil icon directly beside Detail Line */}
                                                                            <button
                                                                              type="button"
                                                                              onClick={() =>
                                                                                setEditState({
                                                                                  type: "detailLine",
                                                                                  variationId: brand.variationId,
                                                                                  detailId: detail.id,
                                                                                  lineIndex: lIdx,
                                                                                  initialValue: line,
                                                                                  currentValue: line,
                                                                                })
                                                                              }
                                                                              className="w-3.5 h-3.5 flex items-center justify-center rounded opacity-60 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 transition-opacity"
                                                                              title="Edit this Detail Line"
                                                                            >
                                                                              <Edit2 className="w-2.5 h-2.5 stroke-[2.2]" />
                                                                            </button>
                                                                          </div>

                                                                          <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                              handleDeleteNode("detailLine", {
                                                                                variationId: brand.variationId,
                                                                                detailId: detail.id,
                                                                                lineIndex: lIdx,
                                                                                label: line,
                                                                              })
                                                                            }
                                                                            className="w-3.5 h-3.5 flex items-center justify-center rounded text-rose-400 hover:text-rose-600 opacity-60 group-hover:opacity-100 transition-opacity"
                                                                            title="Delete this Detail Line"
                                                                          >
                                                                            <Trash2 className="w-2.5 h-2.5" />
                                                                          </button>
                                                                        </div>
                                                                      ))
                                                                    )}
                                                                  </div>
                                                                )}
                                                              </div>
                                                            );
                                                          })
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. Small Modal / Popover: Compact Edit (Pencil Click)             */}
      {/* ----------------------------------------------------------------- */}
      {editState && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-sm p-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                Edit {editState.type === "extraDetail" ? "Extra Detail Title" : editState.type === "detailLine" ? "Detail Line" : editState.type}
              </span>
              <button
                type="button"
                onClick={() => setEditState(null)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Existing Value:
                </label>
                <Input
                  type="text"
                  autoFocus
                  value={editState.currentValue}
                  onChange={(e) => setEditState({ ...editState, currentValue: e.target.value })}
                  className="text-xs h-8 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditState(null)}
                  className="h-7 text-xs px-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy}
                  className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. Small Modal / Popover: Quick Add Child                         */}
      {/* ----------------------------------------------------------------- */}
      {quickAddState && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-sm p-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                Add New {quickAddState.level === "extraDetail" ? "Extra Detail" : quickAddState.level === "detailLine" ? "Detail Line" : quickAddState.level}
              </span>
              <button
                type="button"
                onClick={() => setQuickAddState(null)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveQuickAdd();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {quickAddState.level === "variety"
                    ? "Variety / Cultivar Name (e.g. IMPAX, NONPAREIL):"
                    : quickAddState.level === "size"
                    ? "Size / Caliber (e.g. 18–20, 20–22, 23–25):"
                    : quickAddState.level === "grade"
                    ? "Grade / Quality (e.g. Premium Grade, Supreme):"
                    : quickAddState.level === "brand"
                    ? "Brand / Label (e.g. DGT, OGT ONE):"
                    : quickAddState.level === "extraDetail"
                    ? "Extra Detail Title (e.g. Premium Quality, Packaging):"
                    : "Detail Line Text (e.g. Moisture: max 5%):"}
                </label>
                <Input
                  type="text"
                  autoFocus
                  placeholder={`Enter ${quickAddState.level} name...`}
                  value={quickAddState.name}
                  onChange={(e) => setQuickAddState({ ...quickAddState, name: e.target.value })}
                  className="text-xs h-8 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              {quickAddState.level === "extraDetail" && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Initial Detail Lines (one per line, optional):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Moisture: max 5%&#10;Foreign material: max 0.05%"
                    value={quickAddState.subValue || ""}
                    onChange={(e) =>
                      setQuickAddState({ ...quickAddState, subValue: e.target.value })
                    }
                    className="w-full text-xs p-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setQuickAddState(null)}
                  className="h-7 text-xs px-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy}
                  className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                  Add Node
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 5. Modal: Add Full Variant Combination                            */}
      {/* ----------------------------------------------------------------- */}
      {showAddComboModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-lg p-5 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Add Variant Combination for {goods.name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Internal structure: Variety → Size → Grade → Brand → Extra Details → Detail Lines
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddComboModal(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFullCombo} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Variety */}
                <div>
                  <label className="block text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1">
                    1. Variety / Cultivar *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. IMPAX, NONPAREIL, CARMEL"
                    value={comboForm.variety}
                    onChange={(e) => setComboForm({ ...comboForm, variety: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>

                {/* 2. Size */}
                <div>
                  <label className="block text-[11px] font-bold text-sky-700 dark:text-sky-400 mb-1">
                    2. Size / Caliber *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. 18–20, 20–22, 23–25"
                    value={comboForm.size}
                    onChange={(e) => setComboForm({ ...comboForm, size: e.target.value })}
                    className="h-8 text-xs font-mono font-medium"
                  />
                </div>

                {/* 3. Grade */}
                <div>
                  <label className="block text-[11px] font-bold text-purple-700 dark:text-purple-400 mb-1">
                    3. Grade / Quality Class
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Premium Grade, Supreme"
                    value={comboForm.grade}
                    onChange={(e) => setComboForm({ ...comboForm, grade: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>

                {/* 4. Brand */}
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                    4. Brand / Packing Label *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. DGT, OGT ONE, DEFAULT"
                    value={comboForm.brand}
                    onChange={(e) => setComboForm({ ...comboForm, brand: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
              </div>

              {/* 5. Extra Detail Title */}
              <div>
                <label className="block text-[11px] font-bold text-rose-700 dark:text-rose-400 mb-1">
                  5. Extra Detail / Specification Title
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Premium Quality, Export Specs, Packaging"
                  value={comboForm.detailTitle}
                  onChange={(e) => setComboForm({ ...comboForm, detailTitle: e.target.value })}
                  className="h-8 text-xs font-medium"
                />
              </div>

              {/* 6. Detail Lines */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  6. Detail Lines (one per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Moisture: max 5%&#10;Foreign Material: max 0.05%&#10;Kernel Yield: 50%"
                  value={comboForm.detailLines}
                  onChange={(e) => setComboForm({ ...comboForm, detailLines: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddComboModal(false)}
                  className="h-8 text-xs px-3"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy}
                  className="h-8 text-xs px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" />}
                  Add Combination
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
