"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilLine, Trash2, Plus, Search, Loader2, Printer } from "lucide-react";
import { apiGet, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";

type ContactTypeRecord = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export function ContactTypeRegistry() {
  const router = useRouter();
  const [types, setTypes] = useState<ContactTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [showReport, setShowReport] = useState(false);

  async function loadTypes() {
    setLoading(true);
    try {
      const res = await apiGet<{ contactTypes: ContactTypeRecord[]; summary: typeof summary }>(
        `/api/erp/contact-types?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setTypes(res.contactTypes || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load contact types:", err);
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

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this contact type?")) return;
    try {
      await apiDelete(`/api/erp/contact-types/${id}`);
      loadTypes();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Contact Types</CardTitle>
          <p className="text-sm text-slate-500 mt-1">Manage contact type categories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowReport(true)}>
            <Printer className="w-4 h-4 mr-1" /> Print Preview
          </Button>
          <Button onClick={() => router.push("/dashboard/settings/contact-type/new")}>
            <Plus className="w-4 h-4 mr-1" /> New Type
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-md"
          >
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
                  <Th className="p-3 text-left">Category</Th>
                  <Th className="p-3 text-center">Status</Th>
                  <Th className="p-3 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((type, idx) => (
                  <tr key={type.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="p-3 font-mono text-xs">{type.code}</td>
                    <td className="p-3 font-semibold">{type.name}</td>
                    <td className="p-3 text-slate-600">{type.category}</td>
                    <td className="p-3 text-center">
                      <span
                        className={cn(
                          "px-2 py-1 rounded text-xs font-semibold",
                          type.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        )}
                      >
                        {type.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => router.push(`/dashboard/settings/contact-type/${type.id}/edit`)}
                          className="p-1 hover:bg-blue-100 rounded"
                        >
                          <PencilLine className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(type.id)}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    <UniversalReportModal
      isOpen={showReport}
      onClose={() => setShowReport(false)}
      title="Contact Type Report"
      subtitle="Master Contact Type Classification Registry"
      exportFileName="contact_types_report"
      filters={[
        { label: "Search", value: searchQuery || "All" },
        { label: "Status", value: statusFilter === "all" ? "All" : statusFilter }
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Contact Type Name" },
        { key: "category", label: "Category" },
        { key: "description", label: "Description" },
        { key: "status", label: "Status", align: "center" }
      ]}
      data={filtered.map(t => ({
        code: t.code || "-",
        name: t.name,
        category: t.category || "-",
        description: t.description || "-",
        status: t.is_active ? "Active" : "Inactive"
      }))}
    />
    </>
  );
}
