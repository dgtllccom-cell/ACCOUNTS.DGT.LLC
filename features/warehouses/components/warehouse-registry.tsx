"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type WarehouseRecord = { id: string; code: string; name: string; country_id: string; location_id: string; is_active: boolean; created_at: string; country?: { name: string } };

export function WarehouseRegistry() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });

  async function loadWarehouses() {
    setLoading(true);
    try {
      const res = await apiGet<{ warehouses: WarehouseRecord[]; summary: typeof summary }>(
        `/api/erp/warehouses?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setWarehouses(res.warehouses || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load warehouses:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter((w) => w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q));
  }, [searchQuery, warehouses]);

  async function handleDelete(id: string) {
    if (!window.confirm(tt("common.delete", "Delete") + "?")) return;
    try {
      await apiDelete(`/api/erp/warehouses/${id}`);
      loadWarehouses();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  return (
    <Card dir={isRtl ? "rtl" : "ltr"}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{tt("wh.title", "Warehouses")}</CardTitle>
          <p className="text-sm text-slate-500 mt-1">{tt("wh.subtitle", "Manage warehouse locations")}</p>
        </div>
        <Button onClick={() => alert("Add form coming soon")} size="sm">
          <Plus className="w-4 h-4 mr-1" /> {tt("common.new", "New")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder={tt("common.search", "Search...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 border rounded-md">
            <option value="all">{tt("common.all", "All")}</option>
            <option value="Active">{tt("common.active", "Active")}</option>
            <option value="Inactive">{tt("common.inactive", "Inactive")}</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-blue-50 p-2 rounded">
            <div className="text-xs font-semibold text-blue-600">{tt("common.total", "TOTAL").toUpperCase()}</div>
            <div className="text-lg font-bold text-blue-900">{summary.total}</div>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <div className="text-xs font-semibold text-green-600">{tt("common.active", "ACTIVE").toUpperCase()}</div>
            <div className="text-lg font-bold text-green-900">{summary.active}</div>
          </div>
          <div className="bg-red-50 p-2 rounded">
            <div className="text-xs font-semibold text-red-600">{tt("common.inactive", "INACTIVE").toUpperCase()}</div>
            <div className="text-lg font-bold text-red-900">{summary.inactive}</div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <Th className="p-3">#</Th>
                  <Th className="p-3 text-left">{tt("common.code", "Code")}</Th>
                  <Th className="p-3 text-left">{tt("common.name", "Name")}</Th>
                  <Th className="p-3 text-left">{tt("common.country", "Country")}</Th>
                  <Th className="p-3 text-center">{tt("common.status", "Status")}</Th>
                  <Th className="p-3 text-center">{tt("common.actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((wh, idx) => (
                  <tr key={wh.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">{idx + 1}</td>
                    <td className="p-3 font-mono text-xs">{wh.code}</td>
                    <td className="p-3 font-semibold">{wh.name}</td>
                    <td className="p-3 text-slate-600">{wh.country?.name || '-'}</td>
                    <td className="p-3 text-center">
                      <span className={cn("px-2 py-1 rounded text-xs font-semibold", wh.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                        {wh.is_active ? tt("common.active", "Active") : tt("common.inactive", "Inactive")}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleDelete(wh.id)} className="p-1 hover:bg-red-100 rounded">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
