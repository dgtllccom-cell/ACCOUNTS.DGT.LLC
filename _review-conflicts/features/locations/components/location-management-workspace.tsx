"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Globe2, Map, MapPin, Building2, Warehouse, DoorOpen, 
  Search, Plus, Filter, LayoutGrid, CheckCircle2, AlertTriangle, 
  Loader2, Edit3, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";

// Hierarchy Types
type LocationLevel = "country" | "state" | "city" | "branch" | "warehouse" | "office";

export function LocationManagementWorkspace() {
  const [activeTab, setActiveTab] = useState<LocationLevel>("country");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  // We will populate this from the APIs in a real scenario
  useEffect(() => {
    // Scaffold hook
  }, [activeTab]);

  const tabs = [
    { id: "country", label: "Countries", icon: Globe2 },
    { id: "state", label: "States & Provinces", icon: Map },
    { id: "city", label: "Cities & Districts", icon: MapPin },
    { id: "branch", label: "Branches", icon: Building2 },
    { id: "warehouse", label: "Warehouses", icon: Warehouse },
    { id: "office", label: "Offices", icon: DoorOpen },
  ] as const;

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50/50">
      
      {/* LEFT SIDEBAR - HIERARCHY NAVIGATION */}
      <div className="w-[280px] shrink-0 border-r border-slate-200 bg-white flex flex-col shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-10 relative">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 text-emerald-700">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Globe2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-black tracking-tight text-slate-800 leading-tight">Master Locations</h2>
              <p className="text-[10px] text-slate-500 font-medium">Unified ERP Directory</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1.5">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as LocationLevel)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left group relative ${
                    isActive 
                      ? "bg-emerald-50 text-emerald-800 shadow-sm border border-emerald-100" 
                      : "hover:bg-slate-100/80 text-slate-600 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  <div className={`p-1.5 rounded-md transition-colors ${
                    isActive ? "bg-emerald-100/50 text-emerald-600" : "bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-slate-600 shadow-sm"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 font-semibold text-xs tracking-wide">
                    {tab.label}
                  </div>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/30 overflow-hidden relative">
        <div className="p-6 border-b border-slate-200 bg-white shadow-sm flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight capitalize flex items-center gap-3">
              {tabs.find(t => t.id === activeTab)?.label} Directory
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">
              Manage all {activeTab}s centrally. Changes made here apply across all ERP modules instantly.
            </p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-5 shadow-lg shadow-emerald-500/20 tracking-wide transition-all uppercase text-[11px] gap-2">
            <Plus className="h-4 w-4" /> Add New {activeTab}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-4">
            
            {/* Search Bar */}
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab}s...`}
                  className="pl-9 bg-transparent border-none shadow-none focus-visible:ring-0 text-sm h-10 w-full"
                />
              </div>
              <Button variant="outline" className="h-10 border-slate-200 text-slate-600 font-semibold text-xs bg-slate-50 hover:bg-slate-100">
                <Filter className="h-3.5 w-3.5 mr-2" /> Filters
              </Button>
            </div>

            {/* List Skeleton / Blank State */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
              <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 ring-8 ring-emerald-50/50">
                {(() => {
                  const ActiveIcon = tabs.find((t) => t.id === activeTab)?.icon;
                  return ActiveIcon ? <ActiveIcon className="h-8 w-8" /> : null;
                })()}
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">Centralized {activeTab} Database</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-6">
                This workspace replaces the separate {activeTab} modules. Add a {activeTab} here, and it instantly syncs to Dropdowns, Purchase Forms, and Reports system-wide.
              </p>
              <Button variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-bold bg-emerald-50/30">
                <LayoutGrid className="h-4 w-4 mr-2" /> Load {activeTab}s
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
