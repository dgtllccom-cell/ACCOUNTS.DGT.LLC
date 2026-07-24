"use client";

import React, { useEffect, useState } from "react";
import { GoodsMasterWizard } from "./goods-master-wizard";
import { GoodsVariationsGrid } from "./goods-variations-grid";
import { PackageSearch, Plus, ChevronRight } from "lucide-react";

export function GoodsMasterPageClient() {
  const [goods, setGoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoodsId, setSelectedGoodsId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const fetchGoods = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/goods?limit=500");
      const payload = await res.json();
      if (payload.ok && payload.data?.goods) {
        setGoods(payload.data.goods);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoods();
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-[700px]">
      {/* Sidebar: Goods Master List */}
      <div className="w-full md:w-1/3 border-r border-border flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-border flex items-center justify-between bg-white">
          <h2 className="font-semibold text-sm">Goods Masters</h2>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <p className="text-xs text-muted-foreground p-4 text-center animate-pulse">Loading goods...</p>
          ) : goods.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <PackageSearch className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">No Goods found</p>
            </div>
          ) : (
            goods.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedGoodsId(item.id)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm flex items-center justify-between group transition-all ${
                  selectedGoodsId === item.id 
                    ? "bg-primary/10 border border-primary/20" 
                    : "hover:bg-white border border-transparent hover:border-border"
                }`}
              >
                <div>
                  <p className={`font-semibold ${selectedGoodsId === item.id ? "text-primary" : "text-slate-700"}`}>
                    {item.goods_name || item.goodsName}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">HS Code: {item.chs_code || item.chsCode}</p>
                </div>
                <ChevronRight className={`w-4 h-4 transition-colors ${selectedGoodsId === item.id ? "text-primary" : "text-slate-300 group-hover:text-slate-500"}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Variations Grid */}
      <div className="w-full md:w-2/3 bg-white flex flex-col">
        {selectedGoodsId ? (
          <GoodsVariationsGrid goodsId={selectedGoodsId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <PackageSearch className="w-16 h-16 opacity-10 mb-4" />
            <h3 className="font-semibold text-lg text-slate-800">No Goods Master Selected</h3>
            <p className="text-sm mt-1 max-w-sm">
              Select a Goods Master from the sidebar to view and manage its Variations (Origin, Size, Brand).
            </p>
          </div>
        )}
      </div>

      {showWizard && (
        <GoodsMasterWizard 
          onClose={() => setShowWizard(false)} 
          onSaved={(id) => {
            fetchGoods();
            setSelectedGoodsId(id);
          }} 
        />
      )}
    </div>
  );
}
