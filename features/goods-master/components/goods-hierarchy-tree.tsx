"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  Search,
  Loader2,
  LayoutGrid,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import type { GoodsRecord, GoodsVariation } from "./goods-master-registry";

// =========================================================================
// Data Models for Commercial Specifications / Description
// =========================================================================

export type DetailItem = {
  id: string;
  title: string;
  lines: string[];
};

// Parser for Extra Details (supports JSON array, delimited text, or key-value pairs)
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
          title: item.title || item.name || `Spec #${idx + 1}`,
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

  // Delimiter split: "|" or newlines
  const parts = trimmed.split(/\s*\|\s*|\n+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];

  return parts.map((part, idx) => {
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

// Convert parsed details to individual specification lines for table tags
export function getCommercialSpecLines(raw?: string | null): string[] {
  const details = parseExtraDetails(raw);
  const result: string[] = [];

  for (const d of details) {
    if (d.lines && d.lines.length > 0) {
      for (const line of d.lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;

        // If line already contains key:value or title is generic
        const titleLower = (d.title || "").toLowerCase();
        if (
          !d.title ||
          titleLower.startsWith("report") ||
          titleLower.startsWith("spec") ||
          titleLower === "quality specs" ||
          titleLower === "description" ||
          cleanLine.includes(":") ||
          cleanLine.toLowerCase().startsWith(titleLower)
        ) {
          result.push(cleanLine);
        } else {
          result.push(`${d.title}: ${cleanLine}`);
        }
      }
    } else if (d.title && !d.title.toLowerCase().startsWith("spec") && !d.title.toLowerCase().startsWith("report")) {
      result.push(d.title.trim());
    }
  }

  return result;
}

export function serializeExtraDetails(items: DetailItem[]): string {
  if (!items || items.length === 0) return "";
  return JSON.stringify(items);
}

// Format detail items into human-readable text for edit textareas
function detailItemsToText(items: DetailItem[]): string {
  if (!items || items.length === 0) return "";
  const lines: string[] = [];
  for (const item of items) {
    if (item.lines && item.lines.length > 0) {
      for (const line of item.lines) {
        const titleLower = (item.title || "").toLowerCase();
        if (
          line.includes(":") ||
          titleLower.startsWith("spec") ||
          titleLower.startsWith("report") ||
          titleLower === "description" ||
          titleLower === "commercial specification" ||
          item.title === line
        ) {
          lines.push(line);
        } else {
          lines.push(`${item.title}: ${line}`);
        }
      }
    } else if (item.title) {
      lines.push(item.title);
    }
  }
  return lines.join("\n");
}

function textToDetailItems(text: string, defaultTitle = "Commercial Specification"): DetailItem[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  return [
    {
      id: `ed-${Date.now()}`,
      title: defaultTitle,
      lines,
    },
  ];
}

interface GoodsHierarchyTreeProps {
  goods: GoodsRecord;
  onRefresh: () => Promise<void>;
}

export function GoodsHierarchyTree({ goods, onRefresh }: GoodsHierarchyTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [busy, setBusy] = useState(false);

  // Toggle compact / expanded specifications display
  const [isCompactSpecs, setIsCompactSpecs] = useState(false);

  // Edit variation modal state
  const [editingVariation, setEditingVariation] = useState<{
    id: string;
    variety: string;
    size: string;
    grade: string;
    brand: string;
    extraDetailsText: string;
  } | null>(null);

  // Add combination modal state
  const [showAddComboModal, setShowAddComboModal] = useState(false);
  const [comboForm, setComboForm] = useState({
    variety: "",
    size: "",
    grade: "Standard",
    brand: "DGT",
    detailLines: "Moisture: max 5%\nForeign Material: max 0.05%",
  });

  // Add single variety modal state
  const [showAddVarietyModal, setShowAddVarietyModal] = useState(false);
  const [varietyInput, setVarietyInput] = useState("");

  const rawVariations = goods.variations || [];

  // Summary counts
  const stats = useMemo(() => {
    const varieties = new Set<string>();
    const sizes = new Set<string>();
    const brands = new Set<string>();
    let totalSpecs = 0;

    for (const v of rawVariations) {
      if (v.variety) varieties.add(v.variety.trim().toLowerCase());
      if (v.size) sizes.add(v.size.trim().toLowerCase());
      if (v.brand) brands.add(v.brand.trim().toLowerCase());

      const specLines = getCommercialSpecLines(v.extra_details);
      totalSpecs += specLines.length;
    }

    return {
      totalVarieties: varieties.size || (rawVariations.length > 0 ? 1 : 0),
      totalSizes: sizes.size || (rawVariations.length > 0 ? 1 : 0),
      totalBrands: brands.size || (rawVariations.length > 0 ? 1 : 0),
      totalSpecs: totalSpecs,
      totalCombinations: rawVariations.length,
    };
  }, [rawVariations]);

  // Filtered rows
  const filteredVariations = useMemo(() => {
    if (!searchTerm.trim()) return rawVariations;
    const q = searchTerm.toLowerCase().trim();

    return rawVariations.filter((v) => {
      const variety = (v.variety || "").toLowerCase();
      const size = (v.size || "").toLowerCase();
      const grade = ((v as any).grade || "").toLowerCase();
      const brand = (v.brand || "").toLowerCase();
      const extra = (v.extra_details || "").toLowerCase();
      return (
        variety.includes(q) ||
        size.includes(q) ||
        grade.includes(q) ||
        brand.includes(q) ||
        extra.includes(q)
      );
    });
  }, [rawVariations, searchTerm]);

  // Open Edit Modal for a row
  function handleOpenEdit(v: GoodsVariation) {
    const details = parseExtraDetails(v.extra_details);
    setEditingVariation({
      id: v.id,
      variety: v.variety || "",
      size: v.size || "",
      grade: (v as any).grade || "Standard",
      brand: v.brand || "",
      extraDetailsText: detailItemsToText(details),
    });
  }

  // Save Edit Variation
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVariation) return;

    setBusy(true);
    try {
      const details = textToDetailItems(editingVariation.extraDetailsText);
      await apiPatch(`/api/erp/goods-master/variations/${editingVariation.id}`, {
        variety: editingVariation.variety.trim(),
        size: editingVariation.size.trim(),
        grade: editingVariation.grade.trim() || "Standard",
        brand: editingVariation.brand.trim(),
        extraDetails: serializeExtraDetails(details),
      });

      setEditingVariation(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to save variation: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Delete Variation
  async function handleDeleteVariation(variationId: string, label: string) {
    if (!window.confirm(`Delete variation "${label}"? This action cannot be undone.`)) return;

    setBusy(true);
    try {
      await apiDelete(`/api/erp/goods-master/variations/${variationId}`);
      if (editingVariation?.id === variationId) {
        setEditingVariation(null);
      }
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to delete variation: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Add Combination Submit
  async function handleAddFullCombo(e: React.FormEvent) {
    e.preventDefault();
    if (!comboForm.variety.trim() || !comboForm.size.trim() || !comboForm.brand.trim()) {
      alert("Please fill in Variety, Size, and Brand.");
      return;
    }

    setBusy(true);
    try {
      const details = textToDetailItems(comboForm.detailLines, "Commercial Specification");

      await apiPost(`/api/erp/goods-master/${goods.id}/variations`, {
        variety: comboForm.variety.trim(),
        size: comboForm.size.trim(),
        grade: comboForm.grade.trim() || "Standard",
        brand: comboForm.brand.trim(),
        extraDetails: serializeExtraDetails(details),
      });

      setShowAddComboModal(false);
      setComboForm({
        variety: "",
        size: "",
        grade: "Standard",
        brand: "DGT",
        detailLines: "Moisture: max 5%\nForeign Material: max 0.05%",
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to add combination: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Add Variety Submit
  async function handleAddVariety(e: React.FormEvent) {
    e.preventDefault();
    if (!varietyInput.trim()) {
      alert("Variety name is required.");
      return;
    }

    setBusy(true);
    try {
      await apiPost(`/api/erp/goods-master/${goods.id}/hierarchy`, {
        action: "addNode",
        level: "variety",
        variety: varietyInput.trim(),
        size: "Standard Size",
        grade: "Standard",
        brand: "DGT",
      });

      setShowAddVarietyModal(false);
      setVarietyInput("");
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to add variety: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 text-xs">
      {/* ----------------------------------------------------------------- */}
      {/* 1. Header Toolbar (Commercial Specification View)                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800">
        <div>
          {/* Goods Title & Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <LayoutGrid className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              {goods.name}
            </span>

            {/* HS Code Badge */}
            <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-md bg-[#e0f2fe] text-[#0284c7] dark:bg-sky-950/70 dark:text-sky-300 font-bold border border-sky-200/70 dark:border-sky-800">
              HS: {goods.chs_code || "N/A"}
            </span>

            {/* Varieties • Sizes • Brands Badge */}
            <span className="text-[11px] px-2.5 py-0.5 rounded-md font-semibold bg-[#ecfdf5] text-[#059669] dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">
              {stats.totalVarieties} Varieties • {stats.totalSizes} Sizes • {stats.totalBrands} Brands
            </span>

            {/* Commercial Specs Badge */}
            <span className="text-[11px] px-2.5 py-0.5 rounded-md font-semibold bg-[#f3e8ff] text-[#7c3aed] dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800">
              {stats.totalSpecs} Commercial Specs
            </span>
          </div>

          {/* Breadcrumb Subtitle */}
          <div className="mt-1 text-[11px] text-slate-500 font-normal">
            Hierarchy: Variety → Size → Grade → Brand → Commercial Specification
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Filter */}
          <div className="relative w-36 sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-md"
            />
          </div>

          {/* Collapse / Expand Specs */}
          <button
            type="button"
            onClick={() => setIsCompactSpecs(!isCompactSpecs)}
            className="h-8 px-3 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs"
          >
            {isCompactSpecs ? "Expand Specs" : "Collapse Specs"}
          </button>

          {/* + Variety */}
          <button
            type="button"
            onClick={() => setShowAddVarietyModal(true)}
            className="h-8 px-3 text-xs font-bold rounded-md bg-[#d97706] hover:bg-[#b45309] text-white flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Variety
          </button>

          {/* + Combination */}
          <button
            type="button"
            onClick={() => setShowAddComboModal(true)}
            className="h-8 px-3 text-xs font-bold rounded-md bg-[#059669] hover:bg-[#047857] text-white flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Combination
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Compact Table: Specs displayed directly on the table           */}
      {/* ----------------------------------------------------------------- */}
      {rawVariations.length === 0 ? (
        <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 font-medium text-xs">No variations recorded yet for {goods.name}.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowAddComboModal(true)}
              className="bg-[#059669] hover:bg-[#047857] text-white h-8 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add First Combination
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                <th className="py-2.5 px-4 w-12 text-center">#</th>
                <th className="py-2.5 px-4 w-40">Variety</th>
                <th className="py-2.5 px-4 w-28">Size</th>
                <th className="py-2.5 px-4 w-28">Grade</th>
                <th className="py-2.5 px-4 w-32">Brand</th>
                <th className="py-2.5 px-4">Description / Commercial Specification</th>
                <th className="py-2.5 px-4 text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredVariations.map((v, idx) => {
                const specLines = getCommercialSpecLines(v.extra_details);
                const rowNum = String(idx + 1).padStart(2, "0");

                // If compact view, show first 2 and +N more
                const visibleSpecs = isCompactSpecs ? specLines.slice(0, 2) : specLines;
                const hiddenCount = isCompactSpecs ? Math.max(0, specLines.length - 2) : 0;

                return (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* # */}
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 text-xs text-center">
                      {rowNum}
                    </td>

                    {/* Variety */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {v.variety || "Standard"}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                        {goods.name} Variety
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-md font-semibold text-[11px] bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
                        {v.size || "Standard"}
                      </span>
                    </td>

                    {/* Grade */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-md font-semibold text-[11px] bg-[#faf5ff] text-[#9333ea] border border-[#e9d5ff] dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">
                        {(v as any).grade || "Standard"}
                      </span>
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-4 font-bold text-[#059669] dark:text-emerald-400 text-xs tracking-wide">
                      {v.brand || "Default"}
                    </td>

                    {/* Description / Commercial Specification (Displayed Directly On The Table) */}
                    <td className="py-3 px-4">
                      {specLines.length === 0 ? (
                        <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                          — No specifications set —
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                          {visibleSpecs.map((spec, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe] dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 shadow-2xs"
                            >
                              {spec}
                            </span>
                          ))}
                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setIsCompactSpecs(false)}
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                            >
                              +{hiddenCount} more
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(v)}
                          className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                          title="Edit this combination"
                        >
                          <Pencil className="w-3 h-3 text-slate-500" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteVariation(
                              v.id,
                              `${v.variety || "Std"} / ${v.size} / ${v.brand}`
                            )
                          }
                          className="w-6 h-6 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete this combination"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. Modal: Edit Combination                                        */}
      {/* ----------------------------------------------------------------- */}
      {editingVariation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md p-5 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-[#059669]" />
                  Edit Combination — {goods.name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Update variety, size, grade, brand, and commercial specification
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingVariation(null)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Variety */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Variety
                  </label>
                  <Input
                    type="text"
                    required
                    value={editingVariation.variety}
                    onChange={(e) =>
                      setEditingVariation({ ...editingVariation, variety: e.target.value })
                    }
                    className="h-8 text-xs font-semibold"
                  />
                </div>

                {/* Size */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Size
                  </label>
                  <Input
                    type="text"
                    required
                    value={editingVariation.size}
                    onChange={(e) =>
                      setEditingVariation({ ...editingVariation, size: e.target.value })
                    }
                    className="h-8 text-xs font-semibold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Grade */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Grade
                  </label>
                  <Input
                    type="text"
                    value={editingVariation.grade}
                    onChange={(e) =>
                      setEditingVariation({ ...editingVariation, grade: e.target.value })
                    }
                    className="h-8 text-xs font-semibold"
                  />
                </div>

                {/* Brand */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Brand
                  </label>
                  <Input
                    type="text"
                    required
                    value={editingVariation.brand}
                    onChange={(e) =>
                      setEditingVariation({ ...editingVariation, brand: e.target.value })
                    }
                    className="h-8 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Description / Commercial Specification */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Commercial Specification (one per line)
                </label>
                <textarea
                  rows={4}
                  placeholder="Moisture: max 5%&#10;Foreign Material: max 0.05%&#10;Kernel Yield: 50%&#10;Packaging: 25kg PP Bags"
                  value={editingVariation.extraDetailsText}
                  onChange={(e) =>
                    setEditingVariation({
                      ...editingVariation,
                      extraDetailsText: e.target.value,
                    })
                  }
                  className="w-full text-xs p-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#059669] font-mono"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    handleDeleteVariation(
                      editingVariation.id,
                      `${editingVariation.variety} / ${editingVariation.size} / ${editingVariation.brand}`
                    )
                  }
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingVariation(null)}
                    className="h-8 text-xs px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy}
                    className="h-8 text-xs px-4 bg-[#059669] hover:bg-[#047857] text-white font-bold"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. Modal: Add Full Variant Combination                            */}
      {/* ----------------------------------------------------------------- */}
      {showAddComboModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-lg p-5 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#059669]" />
                  Add Combination — {goods.name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Create a new Variety → Size → Grade → Brand combination with Commercial Specification
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
                    placeholder="e.g. NPEX, IMPAX, CARMEL"
                    value={comboForm.variety}
                    onChange={(e) => setComboForm({ ...comboForm, variety: e.target.value })}
                    className="h-8 text-xs font-semibold"
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
                    placeholder="e.g. 23 / 25, 18 / 20"
                    value={comboForm.size}
                    onChange={(e) => setComboForm({ ...comboForm, size: e.target.value })}
                    className="h-8 text-xs font-mono font-semibold"
                  />
                </div>

                {/* 3. Grade */}
                <div>
                  <label className="block text-[11px] font-bold text-purple-700 dark:text-purple-400 mb-1">
                    3. Grade / Quality Class
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Standard, Premium, A Grade"
                    value={comboForm.grade}
                    onChange={(e) => setComboForm({ ...comboForm, grade: e.target.value })}
                    className="h-8 text-xs font-semibold"
                  />
                </div>

                {/* 4. Brand */}
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                    4. Brand / Label *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. DGT.LLC, DGT, DADI HEALTHY"
                    value={comboForm.brand}
                    onChange={(e) => setComboForm({ ...comboForm, brand: e.target.value })}
                    className="h-8 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* 5. Description / Commercial Specification */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  5. Description / Commercial Specification (one per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Moisture: max 5%&#10;Foreign Material: max 0.05%&#10;Kernel Yield: 50%&#10;Packaging: 25kg PP Bags"
                  value={comboForm.detailLines}
                  onChange={(e) => setComboForm({ ...comboForm, detailLines: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#059669] font-mono"
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
                  className="h-8 text-xs px-4 bg-[#059669] hover:bg-[#047857] text-white font-bold"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" />
                  )}
                  Add Combination
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 5. Modal: Add Single Variety                                      */}
      {/* ----------------------------------------------------------------- */}
      {showAddVarietyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-sm p-5 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#d97706]" />
                Add Variety to {goods.name}
              </h4>
              <button
                type="button"
                onClick={() => setShowAddVarietyModal(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVariety} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Variety Name *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. NPEX, IMPAX, CARMEL"
                  value={varietyInput}
                  onChange={(e) => setVarietyInput(e.target.value)}
                  className="h-8 text-xs font-semibold"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddVarietyModal(false)}
                  className="h-8 text-xs px-3"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy}
                  className="h-8 text-xs px-4 bg-[#d97706] hover:bg-[#b45309] text-white font-bold"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" />
                  )}
                  Add Variety
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
