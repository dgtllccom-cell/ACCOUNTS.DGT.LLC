"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, Eye, Printer } from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";

type AccountRecord = {
  id: string;
  code: string;
  name: string;
  account_type_id: string;
  country_id: string;
  is_active: boolean;
  created_at: string;
  country?: { name: string };
  links?: { companies: number; banks: number; warehouses: number };
};

export function AccountRegistry() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [showReport, setShowReport] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await apiGet<{ accounts: AccountRecord[]; summary: typeof summary }>(
        `/api/erp/accounts?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setAccounts(res.accounts || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
  }, [searchQuery, accounts]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this account? This will remove all linked associations.")) return;
    try {
      await apiDelete(`/api/erp/accounts/${id}`);
      loadAccounts();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Accounts</CardTitle>
          <p className="text-sm text-slate-500 mt-1">Manage chart of accounts with multi-link support</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowReport(true)} variant="outline" size="sm" className="flex items-center gap-1.5 border-slate-700 hover:bg-slate-800">
            <Printer className="w-4 h-4 text-cyan-400" /> Print / Report
          </Button>
          <Button onClick={() => alert("Add form coming soon")} size="sm">
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>
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
                  <Th className="p-3 text-left">Country</Th>
                  <Th className="p-3 text-center">Companies</Th>
                  <Th className="p-3 text-center">Banks</Th>
                  <Th className="p-3 text-center">Warehouses</Th>
                  <Th className="p-3 text-center">Status</Th>
                  <Th className="p-3 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((acc, idx) => (
                  <tr key={acc.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">{idx + 1}</td>
                    <td className="p-3 font-mono text-xs">{acc.code}</td>
                    <td className="p-3 font-semibold">{acc.name}</td>
                    <td className="p-3 text-slate-600">{acc.country?.name || "-"}</td>
                    <td className="p-3 text-center font-mono text-sm">{acc.links?.companies || 0}</td>
                    <td className="p-3 text-center font-mono text-sm">{acc.links?.banks || 0}</td>
                    <td className="p-3 text-center font-mono text-sm">{acc.links?.warehouses || 0}</td>
                    <td className="p-3 text-center">
                      <span className={cn("px-2 py-1 rounded text-xs font-semibold", acc.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                        {acc.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-center flex gap-1 justify-center">
                      <button className="p-1 hover:bg-blue-100 rounded" title="View details">
                        <Eye className="w-4 h-4 text-blue-600" />
                      </button>
                      <button onClick={() => handleDelete(acc.id)} className="p-1 hover:bg-red-100 rounded" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <UniversalReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          title="Account Registry Report"
          subtitle="Complete Master Chart of Accounts with Multi-Link Counts"
          exportFileName="account_registry_report"
          filters={[
            { label: "Status Filter", value: statusFilter },
            { label: "Search Query", value: searchQuery || "None" }
          ]}
          columns={[
            { key: "code", label: "Account Code" },
            { key: "name", label: "Account Name" },
            { key: "country_name", label: "Country" },
            { key: "company_links", label: "Companies Linked", align: "center", isNumeric: true },
            { key: "bank_links", label: "Banks Linked", align: "center", isNumeric: true },
            { key: "warehouse_links", label: "Warehouses Linked", align: "center", isNumeric: true },
            { key: "status", label: "Status", align: "center" }
          ]}
          data={filtered.map(a => ({
            code: a.code,
            name: a.name,
            country_name: a.country?.name || "-",
            company_links: a.links?.companies || 0,
            bank_links: a.links?.banks || 0,
            warehouse_links: a.links?.warehouses || 0,
            status: a.is_active ? "Active" : "Inactive"
          }))}
        />
      </CardContent>
    </Card>
  );
}
