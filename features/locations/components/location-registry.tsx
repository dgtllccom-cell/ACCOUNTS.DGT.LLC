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
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";

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
  const s = useErpScreen("locreg");

  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

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
    if (!window.confirm(s.t("confirm_delete", "Delete this location? This action cannot be undone."))) return;
    setDeleting(id);
    try {
      await apiDelete(`/api/erp/locations/${id}`);
      loadLocations();
      setPage(1);
    } catch (err: any) {
      alert(`${s.t("delete_failed", "Failed to delete")}: ${err.message || String(err)}`);
    } finally {
      setDeleting(null);
    }
  }

  function handlePrint() {
    const align = s.isRtl ? "right" : "left";
    const html = `
      <!DOCTYPE html>
      <html lang="${s.lang}" dir="${s.dir}">
        <head>
          <title>${s.t("report_title", "Location Registry Report")}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: system-ui, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: 800; color: #1e3a8a; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #1e3a8a; color: white; padding: 8px; text-align: ${align}; font-weight: 700; }
            td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: ${align}; }
            .active { color: #16a34a; font-weight: 600; }
            .inactive { color: #dc2626; font-weight: 600; }
            .summary { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
            .summary-item { display: inline-block; margin-${s.isRtl ? "left" : "right"}: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${s.t("report_title", "Location Registry Report")}</div>
            <div style="font-size: 12px; color: #64748b;">${s.t("report_generated", "Generated")}: ${new Date().toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${s.t("col_name", "Location Name")}</th>
                <th>${s.t("col_code", "Code")}</th>
                <th>${s.t("col_country", "Country")}</th>
                <th>${s.t("col_state", "State / Province")}</th>
                <th>${s.t("col_district", "District")}</th>
                <th>${s.t("col_status", "Status")}</th>
                <th>${s.t("col_created", "Created Date")}</th>
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
                  <td><span class="${loc.is_active ? "active" : "inactive"}">${loc.is_active ? s.t("status_active", "Active") : s.t("status_inactive", "Inactive")}</span></td>
                  <td>${new Date(loc.created_at).toLocaleDateString()}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="summary">
            <div class="summary-item"><strong>${s.t("report_total", "Total")}:</strong> ${filtered.length}</div>
            <div class="summary-item"><strong>${s.t("status_active", "Active")}:</strong> ${filtered.filter((l) => l.is_active).length}</div>
            <div class="summary-item"><strong>${s.t("status_inactive", "Inactive")}:</strong> ${filtered.filter((l) => !l.is_active).length}</div>
          </div>
        </body>
      </html>
    `;
    // Centralized preview modal (Print / Save-as-PDF / orientation / share) —
    // no popup window / document.write.
    import("@/lib/store/print-store").then(({ printStore }) => {
      printStore.openPrint(html, s.t("title", "Location Registry"));
    });
  }

  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <div className="space-y-4" dir={s.dir}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{s.t("title", "Location Management")}</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {s.t("subtitle", "Manage all locations: countries, states, districts, cities")}
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard/settings/location/new")}>
            <Plus className="w-4 h-4 mr-1" /> {s.t("new_location", "New Location")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Bar */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={s.t("search_ph", "Search location name, code, country...")}
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
              <option value="all">{s.t("filter_all", "All Status")}</option>
              <option value="Active">{s.t("filter_active", "Active Only")}</option>
              <option value="Inactive">{s.t("filter_inactive", "Inactive Only")}</option>
            </select>
            <Button variant="outline" onClick={() => setShowReport(true)} title={s.t("col_status", "Status")}>
              <Printer className="w-4 h-4" />
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xs text-blue-600 font-semibold">{s.t("stat_total", "TOTAL")}</div>
              <div className="text-lg font-bold text-blue-900">{summary.total}</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-xs text-green-600 font-semibold">{s.t("stat_active", "ACTIVE")}</div>
              <div className="text-lg font-bold text-green-900">{summary.active}</div>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <div className="text-xs text-red-600 font-semibold">{s.t("stat_inactive", "INACTIVE")}</div>
              <div className="text-lg font-bold text-red-900">{summary.inactive}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-xs text-slate-600 font-semibold">{s.t("stat_showing", "SHOWING")}</div>
              <div className="text-lg font-bold text-slate-900">{paginated.length}</div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-slate-600">{s.t("loading", "Loading locations...")}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-600">{s.t("empty", "No locations found")}</p>
                <Button
                  onClick={() => router.push("/dashboard/settings/location/new")}
                  className="mt-4"
                >
                  {s.t("create_first", "Create First Location")}
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <Th className={`p-3 font-semibold text-slate-700 ${s.textStart}`}>#</Th>
                    <Th className={`p-3 font-semibold text-slate-700 ${s.textStart}`}>{s.t("col_name", "Location Name")}</Th>
                    <Th className={`p-3 font-semibold text-slate-700 ${s.textStart}`}>{s.t("col_code", "Code")}</Th>
                    <Th className={`p-3 font-semibold text-slate-700 ${s.textStart}`}>{s.t("col_country", "Country")}</Th>
                    <Th className={`p-3 font-semibold text-slate-700 ${s.textStart}`}>{s.t("col_state", "State / Province")}</Th>
                    <Th className={`p-3 font-semibold text-slate-700 ${s.textStart}`}>{s.t("col_district", "District")}</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">{s.t("col_status", "Status")}</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">{s.t("col_created", "Created Date")}</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">{s.t("col_actions", "Actions")}</Th>
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
                          {loc.is_active ? s.t("status_active", "Active") : s.t("status_inactive", "Inactive")}
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
                            title={s.t("view", "View")}
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/settings/location/${loc.id}/edit`)}
                            className="p-1 hover:bg-amber-100 rounded transition"
                            title={s.t("edit", "Edit")}
                          >
                            <PencilLine className="w-4 h-4 text-amber-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(loc.id)}
                            disabled={deleting === loc.id}
                            className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                            title={s.t("delete", "Delete")}
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
                {s.t("page_of", "Page {page} of {total}").replace("{page}", String(page)).replace("{total}", String(totalPages))}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  {s.t("prev", "Previous")}
                </Button>
                <Button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                >
                  {s.t("next", "Next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UniversalReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title={s.t("modal_title", "Location Master Registry Report")}
        subtitle={s.t("modal_subtitle", "Countries, States, Districts, Cities — Full Location Hierarchy")}
        exportFileName="location_registry_report"
        filters={[
          { label: s.t("filter_search", "Search"), value: searchQuery || s.t("all", "All") },
          { label: s.t("filter_status", "Status"), value: statusFilter === "all" ? s.t("all", "All") : statusFilter }
        ]}
        columns={[
          { key: "name", label: s.t("col_name", "Location Name") },
          { key: "code", label: s.t("col_code", "Code") },
          { key: "country", label: s.t("col_country", "Country") },
          { key: "state", label: s.t("col_state", "State / Province") },
          { key: "district", label: s.t("col_district", "District") },
          { key: "city", label: s.t("col_city", "City") },
          { key: "postal_code", label: s.t("col_postal", "Postal Code") },
          { key: "status", label: s.t("col_status", "Status"), align: "center" }
        ]}
        data={filtered.map(l => ({
          name: l.name,
          code: l.code || "-",
          country: l.country?.name || "-",
          state: l.state?.name || "-",
          district: l.district?.name || "-",
          city: l.city?.name || "-",
          postal_code: l.postal_code || "-",
          status: l.is_active ? s.t("status_active", "Active") : s.t("status_inactive", "Inactive")
        }))}
      />
    </div>
  );
}
