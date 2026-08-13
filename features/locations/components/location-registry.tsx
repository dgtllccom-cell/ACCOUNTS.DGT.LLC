"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilLine, Trash2, Plus, Search, Loader2, Download, Printer } from "lucide-react";
import { apiGet, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";

type LocationRecord = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  name: string;
  code: string | null;
  postal_code: string | null;
  is_active: boolean;
  created_at: string;
  country?: { name: string };
  state?: { name: string };
  district?: { name: string };
  city?: { name: string };
};

export function LocationRegistry() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const th = (label: string) => translateHeader(lang, label);

  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadLocations() {
    setLoading(true);
    try {
      const res = await apiGet<{ locations: LocationRecord[]; summary: typeof summary }>(
        `/api/erp/locations?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setLocations(res.locations || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load locations:", err);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLocations();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.code?.toLowerCase().includes(q) ||
        loc.country?.name.toLowerCase().includes(q)
    );
  }, [searchQuery, locations]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this location? This action cannot be undone.")) return;
    setDeleting(id);
    try {
      await apiDelete(`/api/erp/locations/${id}`);
      loadLocations();
      setPage(1);
    } catch (err: any) {
      alert(`Failed to delete: ${err.message || String(err)}`);
    } finally {
      setDeleting(null);
    }
  }

  function handlePrint() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Locations Report</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: system-ui, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: 800; color: #1e3a8a; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #1e3a8a; color: white; padding: 8px; text-align: left; font-weight: 700; }
            td { border-bottom: 1px solid #e2e8f0; padding: 8px; }
            .active { color: #16a34a; font-weight: 600; }
            .inactive { color: #dc2626; font-weight: 600; }
            .summary { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
            .summary-item { display: inline-block; margin-right: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Location Registry Report</div>
            <div style="font-size: 12px; color: #64748b;">Generated: ${new Date().toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Location Name</th>
                <th>Code</th>
                <th>Country</th>
                <th>State</th>
                <th>District</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${paginated
                .map(
                  (loc, idx) => `
                <tr>
                  <td>${(page - 1) * pageSize + idx + 1}</td>
                  <td>${loc.name}</td>
                  <td>${loc.code || "-"}</td>
                  <td>${loc.country?.name || "-"}</td>
                  <td>${loc.state?.name || "-"}</td>
                  <td>${loc.district?.name || "-"}</td>
                  <td><span class="${loc.is_active ? "active" : "inactive"}">${loc.is_active ? "Active" : "Inactive"}</span></td>
                  <td>${new Date(loc.created_at).toLocaleDateString()}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="summary">
            <div class="summary-item"><strong>Total:</strong> ${filtered.length}</div>
            <div class="summary-item"><strong>Active:</strong> ${filtered.filter((l) => l.is_active).length}</div>
            <div class="summary-item"><strong>Inactive:</strong> ${filtered.filter((l) => !l.is_active).length}</div>
          </div>
        </body>
      </html>
    `;
    openA4ReportWindow(html, "locations-report");
  }

  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Location Management</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {th("Manage all locations: countries, states, districts, cities")}
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard/settings/location/new")}>
            <Plus className="w-4 h-4 mr-1" /> New Location
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Bar */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search location name, code, country..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-md bg-white"
            >
              <option value="all">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xs text-blue-600 font-semibold">TOTAL</div>
              <div className="text-lg font-bold text-blue-900">{summary.total}</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-xs text-green-600 font-semibold">ACTIVE</div>
              <div className="text-lg font-bold text-green-900">{summary.active}</div>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <div className="text-xs text-red-600 font-semibold">INACTIVE</div>
              <div className="text-lg font-bold text-red-900">{summary.inactive}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-xs text-slate-600 font-semibold">SHOWING</div>
              <div className="text-lg font-bold text-slate-900">{paginated.length}</div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-slate-600">Loading locations...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-600">No locations found</p>
                <Button
                  onClick={() => router.push("/dashboard/settings/location/new")}
                  className="mt-4"
                >
                  Create First Location
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <Th className="p-3 text-left font-semibold text-slate-700">#</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">
                      {th("Location Name")}
                    </Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Code</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Country</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">State/Province</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">District</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">Status</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">
                      {th("Created Date")}
                    </Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((loc, idx) => (
                    <tr key={loc.id} className="border-b hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-600">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{loc.name}</td>
                      <td className="p-3 text-slate-600 font-mono">{loc.code || "-"}</td>
                      <td className="p-3 text-slate-600">{loc.country?.name || "-"}</td>
                      <td className="p-3 text-slate-600">{loc.state?.name || "-"}</td>
                      <td className="p-3 text-slate-600">{loc.district?.name || "-"}</td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs font-semibold",
                            loc.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          )}
                        >
                          {loc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-center text-slate-600 text-xs">
                        {new Date(loc.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => router.push(`/dashboard/settings/location/${loc.id}/view`)}
                            className="p-1 hover:bg-blue-100 rounded transition"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/settings/location/${loc.id}/edit`)}
                            className="p-1 hover:bg-amber-100 rounded transition"
                            title="Edit"
                          >
                            <PencilLine className="w-4 h-4 text-amber-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(loc.id)}
                            disabled={deleting === loc.id}
                            className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
