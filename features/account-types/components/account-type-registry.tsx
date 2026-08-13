"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Th } from "@/components/ui/translated-th";

type AccountTypeRecord = { id: string; code: string; name: string; ledger_group: string; description: string | null; is_active: boolean; created_at: string };

export function AccountTypeRegistry() {
  const [types, setTypes] = useState<AccountTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });

  async function loadTypes() {
    setLoading(true);
    try {
      const res = await apiGet<{ accountTypes: AccountTypeRecord[]; summary: typeof summary }>(
        `/api/erp/account-types?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setTypes(res.accountTypes || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load account types:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTypes();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return types;
    return types.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }, [searchQuery, types]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this account type?")) return;
    try {
      await apiDelete(`/api/erp/account-types/${id}`);
      loadTypes();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Account Types</CardTitle>
          <p className="text-sm text-slate-500 mt-1">Manage ledger account types</p>
        </div>
        <Button onClick={() => alert("Add form coming soon")} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 border rounded-md">
            <option value="all">All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-blue-50 p-2 rounded">
            <div className="text-xs font-semibold text-blue-600">TOTAL</div>
            <div className="text-lg font-bold text-blue-900">{summary.total}</div>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <div className="text-xs font-semibold text-green-600">ACTIVE</div>
            <div className="text-lg font-bold text-green-900">{summary.active}</div>
          </div>
          <div className="bg-red-50 p-2 rounded">
            <div className="text-xs font-semibold text-red-600">INACTIVE</div>
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
                  <Th className="p-3 text-left">Code</Th>
                  <Th className="p-3 text-left">Name</Th>
                  <Th className="p-3 text-left">Ledger Group</Th>
                  <Th className="p-3 text-center">Status</Th>
                  <Th className="p-3 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((type, idx) => (
                  <tr key={type.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">{idx + 1}</td>
                    <td className="p-3 font-mono text-xs">{type.code}</td>
                    <td className="p-3 font-semibold">{type.name}</td>
                    <td className="p-3 text-slate-600">{type.ledger_group}</td>
                    <td className="p-3 text-center">
                      <span className={cn("px-2 py-1 rounded text-xs font-semibold", type.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                        {type.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleDelete(type.id)} className="p-1 hover:bg-red-100 rounded">
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
