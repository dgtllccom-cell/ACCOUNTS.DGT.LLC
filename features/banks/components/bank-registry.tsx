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
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";

type BankRecord = {
  id: string;
  bank_code: string | null;
  bank_name: string;
  branch_name: string | null;
  country_id: string;
  account_title: string | null;
  account_number: string | null;
  iban: string | null;
  swift_code: string | null;
  currency_code: string;
  is_active: boolean;
  created_at: string;
  country?: { name: string };
};

export function BankRegistry() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const th = (label: string) => translateHeader(lang, label);

  const [banks, setBanks] = useState<BankRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadBanks() {
    setLoading(true);
    try {
      const res = await apiGet<{ banks: BankRecord[]; summary: typeof summary }>(
        `/api/erp/banks?limit=500&status=${statusFilter === "all" ? "" : statusFilter}`
      );
      setBanks(res.banks || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load banks:", err);
      setBanks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBanks();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter(
      (bank) =>
        bank.bank_name.toLowerCase().includes(q) ||
        bank.bank_code?.toLowerCase().includes(q) ||
        bank.account_number?.toLowerCase().includes(q) ||
        bank.iban?.toLowerCase().includes(q)
    );
  }, [searchQuery, banks]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this bank record? This action cannot be undone.")) return;
    setDeleting(id);
    try {
      await apiDelete(`/api/erp/banks/${id}`);
      loadBanks();
      setPage(1);
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  }

  function handlePrint() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Banks Report</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: system-ui, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: 800; color: #1e3a8a; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background: #1e3a8a; color: white; padding: 6px; text-align: left; font-weight: 700; }
            td { border-bottom: 1px solid #e2e8f0; padding: 6px; }
            .active { color: #16a34a; font-weight: 600; }
            .inactive { color: #dc2626; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Bank Registry Report</div>
            <div style="font-size: 12px; color: #64748b;">Generated: ${new Date().toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Bank Name</th>
                <th>Code</th>
                <th>Branch</th>
                <th>Country</th>
                <th>Account Title</th>
                <th>Account Number</th>
                <th>IBAN</th>
                <th>SWIFT</th>
                <th>Currency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${paginated
                .map(
                  (bank, idx) => `
                <tr>
                  <td>${(page - 1) * pageSize + idx + 1}</td>
                  <td><strong>${bank.bank_name}</strong></td>
                  <td>${bank.bank_code || "-"}</td>
                  <td>${bank.branch_name || "-"}</td>
                  <td>${bank.country?.name || "-"}</td>
                  <td>${bank.account_title || "-"}</td>
                  <td>${bank.account_number || "-"}</td>
                  <td>${bank.iban || "-"}</td>
                  <td>${bank.swift_code || "-"}</td>
                  <td>${bank.currency_code}</td>
                  <td><span class="${bank.is_active ? "active" : "inactive"}">${bank.is_active ? "Active" : "Inactive"}</span></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <strong>Total:</strong> ${filtered.length} | <strong>Active:</strong> ${filtered.filter((b) => b.is_active).length} | <strong>Inactive:</strong> ${filtered.filter((b) => !b.is_active).length}
          </div>
        </body>
      </html>
    `;
    openA4ReportWindow(html, "banks-report");
  }

  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Bank Management</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {th("Manage all banks and banking details")}
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard/settings/bank/new")}>
            <Plus className="w-4 h-4 mr-1" /> New Bank
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <Input
                placeholder="Search bank name, code, account number, IBAN..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
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

          <div className="border rounded-lg overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-slate-600">Loading banks...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-600">No banks found</p>
                <Button onClick={() => router.push("/dashboard/settings/bank/new")} className="mt-4">
                  Create First Bank
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <Th className="p-3 text-left font-semibold text-slate-700">#</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Bank Name</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Code</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Branch</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Country</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Account Title</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">IBAN</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">Currency</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">Status</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((bank, idx) => (
                    <tr key={bank.id} className="border-b hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-600">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{bank.bank_name}</td>
                      <td className="p-3 text-slate-600 font-mono">{bank.bank_code || "-"}</td>
                      <td className="p-3 text-slate-600">{bank.branch_name || "-"}</td>
                      <td className="p-3 text-slate-600">{bank.country?.name || "-"}</td>
                      <td className="p-3 text-slate-600 text-xs">{bank.account_title || "-"}</td>
                      <td className="p-3 text-slate-600 font-mono text-xs">{bank.iban || "-"}</td>
                      <td className="p-3 text-center font-mono text-sm">{bank.currency_code}</td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs font-semibold",
                            bank.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          )}
                        >
                          {bank.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => router.push(`/dashboard/settings/bank/${bank.id}/view`)}
                            className="p-1 hover:bg-blue-100 rounded transition"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/settings/bank/${bank.id}/edit`)}
                            className="p-1 hover:bg-amber-100 rounded transition"
                          >
                            <PencilLine className="w-4 h-4 text-amber-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(bank.id)}
                            disabled={deleting === bank.id}
                            className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">Page {page} of {totalPages}</div>
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
