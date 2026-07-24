"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export function GoodsVariationsGrid({ goodsId }: { goodsId: string }) {
  const [goods, setGoods] = useState<any>(null);
  const [variations, setVariations] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Variation Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ originCountryId: "", size: "", brand: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [goodsRes, countriesRes] = await Promise.all([
        fetch(`/api/erp/goods/${goodsId}`).then(r => r.json()),
        fetch("/api/erp/countries?limit=500").then(r => r.json())
      ]);

      if (goodsRes.ok && goodsRes.data) {
        setGoods(goodsRes.data);
        setVariations(goodsRes.data.variations || []);
      }
      
      // Transit countries from db
      if (countriesRes.ok && countriesRes.data?.countries) {
        setCountries(countriesRes.data.countries);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (goodsId) {
      setShowAddForm(false);
      setAddForm({ originCountryId: "", size: "", brand: "" });
      fetchData();
    }
  }, [goodsId]);

  const handleAddVariation = async () => {
    if (!addForm.size.trim() || !addForm.brand.trim()) {
      setAddError("Size and Brand are required.");
      return;
    }
    
    setAdding(true);
    setAddError("");
    
    try {
      const res = await fetch("/api/erp/goods/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodsId,
          originCountryId: addForm.originCountryId || null,
          size: addForm.size.trim().toUpperCase(),
          brand: addForm.brand.trim().toUpperCase()
        })
      });
      const payload = await res.json().catch(() => ({}));
      
      if (!res.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "Failed to create variation");
      }
      
      // Reset form and refresh
      setAddForm({ originCountryId: "", size: "", brand: "" });
      setShowAddForm(false);
      fetchData();
      
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add variation");
    } finally {
      setAdding(false);
    }
  };

  const getCountryName = (id: string | null) => {
    if (!id) return "-";
    const c = countries.find(x => x.id === id);
    return c ? c.name : id;
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading variations...</div>;
  }

  if (!goods) {
    return <div className="p-8 text-center text-destructive">Failed to load Goods Data</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header Info */}
      <div className="p-6 border-b border-border bg-slate-50/50 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            {goods.goods_name || goods.goodsName}
          </h2>
          <div className="mt-2 flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <span className="bg-white px-2 py-1 rounded border border-border">HS: {goods.chs_code || goods.chsCode}</span>
            <span>Total Variations: {variations.length}</span>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`flex items-center gap-1 px-4 py-2 rounded text-xs font-semibold transition-colors ${
            showAddForm 
              ? "bg-slate-200 text-slate-700 hover:bg-slate-300" 
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {showAddForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add Variation</>}
        </button>
      </div>

      {/* Add Variation Form */}
      {showAddForm && (
        <div className="p-4 bg-primary/5 border-b border-primary/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">New Variation</h3>
          {addError && <div className="text-destructive text-[11px] mb-2">{addError}</div>}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Origin Country</label>
              <select
                value={addForm.originCountryId}
                onChange={e => setAddForm(p => ({ ...p, originCountryId: e.target.value }))}
                className="w-full bg-white border border-input rounded px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
              >
                <option value="">Select Origin...</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Size *</label>
              <input
                type="text"
                placeholder="e.g. W320"
                value={addForm.size}
                onChange={e => setAddForm(p => ({ ...p, size: e.target.value }))}
                className="w-full bg-white border border-input rounded px-3 py-2 text-foreground text-sm outline-none focus:border-primary uppercase"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Brand *</label>
              <input
                type="text"
                placeholder="e.g. DGT"
                value={addForm.brand}
                onChange={e => setAddForm(p => ({ ...p, brand: e.target.value }))}
                className="w-full bg-white border border-input rounded px-3 py-2 text-foreground text-sm outline-none focus:border-primary uppercase"
              />
            </div>
            <button
              onClick={handleAddVariation}
              disabled={adding}
              className="bg-primary text-primary-foreground px-6 py-2 rounded text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {adding ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        {variations.length === 0 ? (
          <div className="text-center p-8 border-2 border-dashed border-border rounded-lg text-muted-foreground">
            <p className="text-sm">No variations found for this Goods Master.</p>
            <p className="text-xs mt-1">Click "Add Variation" to create one (Origin + Size + Brand).</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Goods Name</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Origin</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Brand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {variations.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">{goods.goods_name || goods.goodsName}</td>
                    <td className="px-4 py-3 text-slate-600">{getCountryName(v.origin_country_id)}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{v.size}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{v.brand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
