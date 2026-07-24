"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiDelete, apiPatch, apiPost } from "@/lib/api/client";
import { listCountries } from "@/features/locations/location-api";
import { listGoods, type GoodsListRow } from "@/features/inventory/goods-api";

type GoodsVariation = {
  id: string;
  goods_id: string;
  size: string;
  brand: string;
  is_active: boolean;
  created_at: string;
};

type GoodsRecord = {
  id: string;
  chs_code: string;
  goods_name: string;
  origin_country_id: string | null;
  is_active: boolean;
  total_origins: number;
  total_sizes: number;
  total_brands: number;
  variations: GoodsVariation[];
};

export default function GoodsManagementClient({ session }: { session: any }) {
  const [countries, setCountries] = useState<Array<{ id: string; name: string; currency_code: string }>>([]);
  const [rows, setRows] = useState<GoodsRecord[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals / Editing States
  const [viewRow, setViewRow] = useState<GoodsRecord | null>(null);
  const [editRow, setEditRow] = useState<GoodsRecord | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Variation modals
  const [addVarGoods, setAddVarGoods] = useState<GoodsRecord | null>(null);
  const [editVarRow, setEditVarRow] = useState<{ goodsId: string; variation: GoodsVariation } | null>(null);

  const [form, setForm] = useState({
    goodsName: "",
    chsCode: "",
    originCountryId: "",
    size: "",
    brand: ""
  });

  useEffect(() => {
    listCountries()
      .then((res) => setCountries(res))
      .catch(() => null);
  }, []);

  async function refresh(input?: { q?: string }) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await listGoods({ q: input?.q, limit: 200 });
      setRows((res.goods as unknown as GoodsRecord[]) ?? []);
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Failed to fetch goods list." });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh({ q });
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  async function createGoods() {
    if (!form.goodsName.trim() || !form.chsCode.trim()) {
      setBanner({ type: "error", text: "Goods Name and CHS Code are required." });
      return;
    }

    const hasVariation = form.size.trim() || form.brand.trim() || form.originCountryId;
    if (hasVariation && (!form.size.trim() || !form.brand.trim())) {
      setBanner({ type: "error", text: "To add a variation, both Size and Brand are required." });
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      await apiPost("/api/erp/goods", {
        chsCode: form.chsCode,
        goodsName: form.goodsName,
        originalLanguage: "en",
        initialVariation: hasVariation ? {
          originCountryId: form.originCountryId || null,
          size: form.size.trim(),
          brand: form.brand.trim()
        } : null
      });

      setForm({
        goodsName: "",
        chsCode: "",
        originCountryId: "",
        size: "",
        brand: ""
      });
      await refresh({ q });
      setBanner({ type: "success", text: "Goods Master record and initial variation saved successfully." });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Failed to save goods." });
    } finally {
      setBusy(false);
    }
  }

  async function saveEditMaster(next: { goodsName: string; chsCode: string }) {
    if (!editRow) return;
    if (!next.goodsName.trim() || !next.chsCode.trim()) {
      setBanner({ type: "error", text: "Goods Name and CHS Code are required." });
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      await apiPatch(`/api/erp/goods/${editRow.id}`, {
        chsCode: next.chsCode,
        goodsName: next.goodsName,
        originCountryId: next.originCountryId || null,
        originalLanguage: "en"
      });
      setEditRow(null);
      await refresh({ q });
      setBanner({ type: "success", text: "Goods Master record updated successfully." });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Failed to update goods." });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(row: GoodsRecord) {
    const ok = window.confirm(`Are you sure you want to delete goods: ${row.goods_name}? This will delete all its variations.`);
    if (!ok) return;
    setBusy(true);
    setBanner(null);
    try {
      await apiDelete(`/api/erp/goods/${row.id}`);
      await refresh({ q });
      setBanner({ type: "success", text: "Goods Master record and variations deleted." });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Failed to delete goods." });
    } finally {
      setBusy(false);
    }
  }

  // --- Variation Handlers ---

  async function handleAddVariation(next: { size: string; brand: string }) {
    if (!addVarGoods) return;
    if (!next.size.trim() || !next.brand.trim()) {
      alert("Size and Brand are required fields.");
      return;
    }

    setBusy(true);
    try {
      await apiPost("/api/erp/goods/variations", {
        goodsId: addVarGoods.id,
        size: next.size,
        brand: next.brand
      });
      setAddVarGoods(null);
      await refresh({ q });
      setBanner({ type: "success", text: "Variation added successfully." });
    } catch (e: any) {
      alert(e?.message ?? "Failed to add variation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEditVariation(next: { size: string; brand: string }) {
    if (!editVarRow) return;
    if (!next.size.trim() || !next.brand.trim()) {
      alert("Size and Brand are required fields.");
      return;
    }

    setBusy(true);
    try {
      await apiPatch(`/api/erp/goods/variations/${editVarRow.variation.id}`, {
        goodsId: editVarRow.goodsId,
        size: next.size,
        brand: next.brand
      });
      setEditVarRow(null);
      await refresh({ q });
      setBanner({ type: "success", text: "Variation updated successfully." });
    } catch (e: any) {
      alert(e?.message ?? "Failed to update variation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteVariation(varId: string) {
    const ok = window.confirm("Are you sure you want to delete this variation?");
    if (!ok) return;

    setBusy(true);
    try {
      await apiDelete(`/api/erp/goods/variations/${varId}`);
      await refresh({ q });
      setBanner({ type: "success", text: "Variation deleted successfully." });
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete variation.");
    } finally {
      setBusy(false);
    }
  }

  // --- Toggle Row Expansion ---
  function toggleRow(id: string) {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  }

  const originNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of countries) map.set(c.id, c.name);
    return map;
  }, [countries]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings / Management</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Goods Master</h1>
          <p className="text-sm text-muted-foreground">Centralized goods registry used across Purchase, Sales, and Inventory.</p>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">Master Data</span>
      </div>

      {banner ? (
        <div className={`rounded-lg border p-3 text-sm flex justify-between items-center ${
          banner.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-rose-500/30 bg-rose-500/10 text-rose-600"
        }`}>
          <span>{banner.text}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBanner(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {/* Creation form */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground font-semibold">CHS Code</span>
              <input
                value={form.chsCode}
                onChange={(e) => setForm((s) => ({ ...s, chsCode: e.target.value }))}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                placeholder="e.g. 0802.12.00"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground font-semibold">Goods Name</span>
              <input
                value={form.goodsName}
                onChange={(e) => setForm((s) => ({ ...s, goodsName: e.target.value }))}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                placeholder="e.g. Almonds"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground font-semibold">Origin Country</span>
              <select
                value={form.originCountryId}
                onChange={(e) => setForm((s) => ({ ...s, originCountryId: e.target.value }))}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
              >
                <option value="">Select origin country</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 border-t pt-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Variation (Optional)</span>
            <div className="mt-2 grid gap-3 md:grid-cols-2">

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground font-semibold">Size</span>
                <input
                  value={form.size}
                  onChange={(e) => setForm((s) => ({ ...s, size: e.target.value }))}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                  placeholder="e.g. 22/24"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground font-semibold">Brand</span>
                <input
                  value={form.brand}
                  onChange={(e) => setForm((s) => ({ ...s, brand: e.target.value }))}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                  placeholder="e.g. Brand A"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="text-xs text-muted-foreground">
              Goods records require a unique CHS Code and a Name. Variations are added below.
            </div>
            <Button type="button" className="h-10 rounded-lg font-bold" onClick={createGoods} disabled={busy}>
              {busy ? "Saving..." : <span className="inline-flex items-center gap-2"><Save className="h-4 w-4" />Save Goods Master</span>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Registry/Report Grid */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div>
              <div className="text-sm font-semibold">Goods Registry</div>
              <div className="text-xs text-muted-foreground font-medium">Search products and manage variations.</div>
            </div>

            <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm w-full max-w-xs">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search goods name / chs code..."
              />
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="w-10 px-3 py-3"></th>
                  <th className="px-3 py-3 text-start font-semibold uppercase tracking-wider">CHS Code</th>
                  <th className="px-3 py-3 text-start font-semibold uppercase tracking-wider">Goods Name</th>
                  <th className="px-3 py-3 text-start font-semibold uppercase tracking-wider">Origin Country</th>
                  <th className="px-3 py-3 text-center font-semibold uppercase tracking-wider">Total Sizes</th>
                  <th className="px-3 py-3 text-center font-semibold uppercase tracking-wider">Total Brands</th>
                  <th className="px-3 py-3 text-end font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length ? (
                  rows.map((r) => {
                    const isExpanded = expandedRows.has(r.id);
                    return (
                      <React.Fragment key={r.id}>
                        <tr className="hover:bg-muted/30 transition">
                          <td className="px-3 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => toggleRow(r.id)}
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </td>
                          <td className="px-3 py-3 font-semibold text-foreground">{r.chs_code}</td>
                          <td className="px-3 py-3 text-foreground">{r.goods_name}</td>
                          <td className="px-3 py-3 text-foreground">{r.origin_country_id ? originNameById.get(r.origin_country_id) ?? "-" : "Global"}</td>
                          <td className="px-3 py-3 text-center font-medium">{r.total_sizes}</td>
                          <td className="px-3 py-3 text-center font-medium">{r.total_brands}</td>
                          <td className="px-3 py-3 text-end">
                            <div className="flex justify-end gap-1.5">
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewRow(r)} aria-label="View">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditRow(r)} aria-label="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => void deleteRow(r)} disabled={busy} aria-label="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Variations Subtable */}
                        {isExpanded ? (
                          <tr className="bg-muted/20">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="rounded-lg border border-border/80 bg-background p-3 shadow-inner">
                                <div className="flex items-center justify-between border-b pb-2 mb-2">
                                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Variations List</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAddVarGoods(r)}
                                    className="h-7 rounded-md text-xs font-bold border-dashed flex gap-1 border-primary text-primary hover:bg-primary/5"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Variation
                                  </Button>
                                </div>

                                {r.variations && r.variations.length ? (
                                  <table className="w-full text-xs text-start">
                                    <thead>
                                      <tr className="text-muted-foreground border-b font-medium">
                                        <th className="py-2 text-start">Size</th>
                                        <th className="py-2 text-start">Brand</th>
                                        <th className="py-2 text-end">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                      {r.variations.map((v) => (
                                        <tr key={v.id} className="hover:bg-muted/20">
                                          <td className="py-2 text-muted-foreground">{v.size}</td>
                                          <td className="py-2 text-muted-foreground">{v.brand}</td>
                                          <td className="py-2 text-end">
                                            <div className="flex justify-end gap-1">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground"
                                                onClick={() => setEditVarRow({ goodsId: r.id, variation: v })}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-rose-500 hover:bg-rose-50"
                                                onClick={() => void handleDeleteVariation(v.id)}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="py-6 text-center text-xs text-muted-foreground font-semibold">
                                    No variations added yet for this product.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-sm text-muted-foreground font-semibold">
                      No goods master records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* View Details Modal */}
      {viewRow ? (
        <SimpleModal title="Goods Details" onClose={() => setViewRow(null)}>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3 shadow-sm">
                <div className="text-xs text-muted-foreground font-semibold">CHS Code</div>
                <div className="mt-1 text-sm font-bold text-foreground">{viewRow.chs_code}</div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 shadow-sm">
                <div className="text-xs text-muted-foreground font-semibold">Goods Name</div>
                <div className="mt-1 text-sm font-bold text-foreground">{viewRow.goods_name}</div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 shadow-sm">
                <div className="text-xs text-muted-foreground font-semibold">Origin Country</div>
                <div className="mt-1 text-sm font-bold text-foreground">{viewRow.origin_country_id ? originNameById.get(viewRow.origin_country_id) ?? "-" : "Global"}</div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3 shadow-sm">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1.5 mb-2">Variations Breakdown</div>
              {viewRow.variations && viewRow.variations.length ? (
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {viewRow.variations.map((v) => (
                    <div key={v.id} className="text-xs py-1 px-2 hover:bg-muted/30 rounded flex justify-between border border-border/40">
                      <span className="text-muted-foreground">{v.size}</span>
                      <span className="text-muted-foreground font-medium">{v.brand}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-center py-3 text-muted-foreground font-medium">No variations loaded.</div>
              )}
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {/* Edit Master Goods Modal */}
      {editRow ? (
        <EditMasterModal
          row={editRow}
          countries={countries}
          onClose={() => setEditRow(null)}
          onSave={saveEditMaster}
          busy={busy}
        />
      ) : null}

      {/* Add Variation Modal */}
      {addVarGoods ? (
        <VariationModal
          title={`Add Variation for ${addVarGoods.goods_name}`}
          onClose={() => setAddVarGoods(null)}
          onSave={handleAddVariation}
          busy={busy}
        />
      ) : null}

      {/* Edit Variation Modal */}
      {editVarRow ? (
        <VariationModal
          title={`Edit Variation`}
          initialValues={{
            size: editVarRow.variation.size,
            brand: editVarRow.variation.brand
          }}
          onClose={() => setEditVarRow(null)}
          onSave={handleEditVariation}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

// Modal helper for editing master record properties
function EditMasterModal({
  row,
  onClose,
  onSave,
  busy
}: {
  row: GoodsRecord;
  onClose: () => void;
  onSave: (next: { goodsName: string; chsCode: string; originCountryId: string }) => void;
  busy: boolean;
  countries: Array<{ id: string; name: string }>;
}) {
  const [draft, setDraft] = useState({
    goodsName: row.goods_name ?? "",
    chsCode: row.chs_code ?? "",
    originCountryId: row.origin_country_id ?? ""
  });

  return (
    <SimpleModal title="Edit Goods Master" onClose={onClose}>
      <div className="grid gap-3 mb-4">
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground font-semibold">CHS Code</span>
          <input
            value={draft.chsCode}
            onChange={(e) => setDraft((s) => ({ ...s, chsCode: e.target.value }))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground font-semibold">Goods Name</span>
          <input
            value={draft.goodsName}
            onChange={(e) => setDraft((s) => ({ ...s, goodsName: e.target.value }))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground font-semibold">Origin Country</span>
          <select
            value={draft.originCountryId}
            onChange={(e) => setDraft((s) => ({ ...s, originCountryId: e.target.value }))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
          >
            <option value="">Select origin country</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" className="h-9 rounded-lg font-bold" onClick={() => onSave(draft)} disabled={busy}>
          <Save className="h-4 w-4 mr-1.5" />
          Save Changes
        </Button>
      </div>
    </SimpleModal>
  );
}

// Modal helper for adding / editing variation record properties
function VariationModal({
  title,
  initialValues,
  onClose,
  onSave,
  busy
}: {
  title: string;
  initialValues?: { size: string; brand: string };
  onClose: () => void;
  onSave: (next: { size: string; brand: string }) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState({
    size: initialValues?.size ?? "",
    brand: initialValues?.brand ?? ""
  });

  return (
    <SimpleModal title={title} onClose={onClose}>
      <div className="grid gap-3 mb-4">
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground font-semibold">Size</span>
          <input
            value={draft.size}
            onChange={(e) => setDraft((s) => ({ ...s, size: e.target.value }))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
            placeholder="e.g. 22/24"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground font-semibold">Brand</span>
          <input
            value={draft.brand}
            onChange={(e) => setDraft((s) => ({ ...s, brand: e.target.value }))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
            placeholder="e.g. Brand A"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" className="h-9 rounded-lg font-bold" onClick={() => onSave(draft)} disabled={busy}>
          <Save className="h-4 w-4 mr-1.5" />
          Save Variation
        </Button>
      </div>
    </SimpleModal>
  );
}
