"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { printStore } from "@/lib/store/print-store";
import type { Route } from "next";
import { Building2, Plus, Search, Eye, PencilLine, Printer, Trash2, X, MoreVertical, Loader2, ArrowLeft, Users, FileText, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiDelete } from "@/lib/api/client";
import type { CompanyRow } from "@/lib/repositories/companies-repository";
import { ReportFilterBar, type ReportFilterValues } from "@/features/reports/components/report-filter-bar";
import { ReportPagination } from "@/features/reports/components/report-pagination";
import { ReportStatusLegend } from "@/features/reports/components/report-status-legend";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

export type CompanyDisplayRecord = {
  id: string;
  ownerName: string;
  companyName: string;
  businessName: string;
  country: string;
  state: string;
  city: string;
  zipCode: string;
  address: string;
  contacts: Array<{ id: string; type: string; value: string }>;
  registrations: Array<{ id: string; type: string; value: string }>;
  ownerIds: Array<{ id: string; type: string; value: string }>;
  raw: CompanyRow;
};

function mapDbRowToDisplayRecord(c: CompanyRow): CompanyDisplayRecord {
  return {
    id: c.id,
    ownerName: c.owner_name || "-",
    companyName: c.name || "-",
    businessName: c.legal_name || "-",
    country: c.country_name || "Pakistan",
    state: c.state_name || "-",
    city: c.city_name || c.district_name || "-",
    zipCode: c.zip_code || "",
    address: c.address || "",
    contacts: (c.contacts || []).map((x, i) => ({
      id: x.id || `c-${i}`,
      type: x.type || "Contact",
      value: x.value || ""
    })),
    registrations: (c.registrations || []).map((x, i) => ({
      id: x.id || `r-${i}`,
      type: x.type || "Registration",
      value: x.value || ""
    })),
    ownerIds: (c.owner_ids || []).map((x, i) => ({
      id: x.id || `o-${i}`,
      type: x.type || "ID",
      value: x.value || ""
    })),
    raw: c
  };
}

export function CompanyRegistry() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const th = (label: string) => translateHeader(lang, label);
  const [savedCompanies, setSavedCompanies] = useState<CompanyDisplayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingCompany, setViewingCompany] = useState<CompanyDisplayRecord | null>(null);
  const [selectedOwnerGroup, setSelectedOwnerGroup] = useState<{ ownerName: string; companies: CompanyDisplayRecord[] } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [filters, setFilters] = useState<ReportFilterValues>({
    countryId: "all",
    mainBranchId: "all",
    branchId: "all",
    fromDate: "",
    toDate: "",
    currency: "USD",
    userId: "all",
    reportType: "company"
  });

  useEffect(() => {
    function handleOutsideClick() {
      setOpenMenuId(null);
    }
    if (openMenuId !== null) {
      window.addEventListener("click", handleOutsideClick);
      return () => {
        window.removeEventListener("click", handleOutsideClick);
      };
    }
  }, [openMenuId]);

  async function loadCompaniesFromDb() {
    setLoading(true);
    try {
      const res = await apiGet<{ companies: CompanyRow[] }>("/api/erp/companies?limit=500");
      const list = res.companies || [];
      setSavedCompanies(list.map(mapDbRowToDisplayRecord));
    } catch (err) {
      console.error("Failed to fetch companies from database:", err);
      setSavedCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompaniesFromDb();
  }, []);

  // Group companies by Owner Name to count companies per owner
  const ownerGroupedMap = useMemo(() => {
    const map = new Map<string, CompanyDisplayRecord[]>();
    for (const c of savedCompanies) {
      const key = (c.ownerName || "Unknown Owner").trim().toUpperCase();
      const existing = map.get(key) || [];
      existing.push(c);
      map.set(key, existing);
    }
    return map;
  }, [savedCompanies]);

  const stats = useMemo(() => {
    const total = savedCompanies.length;
    const totalOwners = ownerGroupedMap.size;
    const multiCompanyOwners = Array.from(ownerGroupedMap.values()).filter((arr) => arr.length > 1).length;
    return { total, totalOwners, multiCompanyOwners };
  }, [savedCompanies, ownerGroupedMap]);

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedCompanies;
    return savedCompanies.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.businessName.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [searchQuery, savedCompanies]);

  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCompanies.slice(start, start + pageSize);
  }, [filteredCompanies, page, pageSize]);

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this company from the database?")) return;
    try {
      await apiDelete(`/api/erp/companies/${id}`);
      if (viewingCompany?.id === id) setViewingCompany(null);
      loadCompaniesFromDb();
    } catch (err: any) {
      alert(`Failed to delete company: ${err.message || String(err)}`);
    }
  }

  function handlePrint(c: CompanyDisplayRecord) {
    const contactsHTML = c.contacts.length > 0
      ? `<ul>` + c.contacts.map((x) => `<li><strong>${x.type}</strong><span>${x.value}</span></li>`).join("") + `</ul>`
      : `<div style="font-size: 11px; font-style: italic; color: #94a3b8; text-align: center; margin-top: 10px;">No registered contact methods</div>`;

    const regsHTML = c.registrations.length > 0
      ? `<ul>` + c.registrations.map((x) => `<li><strong>${x.type}</strong><span>${x.value}</span></li>`).join("") + `</ul>`
      : `<div style="font-size: 11px; font-style: italic; color: #94a3b8; text-align: center; margin-top: 10px;">No registered tax credentials</div>`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificate of Incorporation - ${c.companyName}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: system-ui, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #f8fafc; }
            .certificate-container { border: 2px solid #1e3a8a; padding: 30px; border-radius: 12px; background: #ffffff; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 20px; text-align: center; }
            .org-title { font-size: 18px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0; }
            .cert-title { font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
            .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; background: #ffffff; }
            .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1e3a8a; margin-bottom: 8px; border-b: 1px solid #e2e8f0; pb: 4px; }
            .field { margin-bottom: 8px; }
            .label { font-size: 9px; uppercase; color: #64748b; font-weight: 700; }
            .value { font-size: 12px; font-weight: 700; color: #0f172a; }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            <div class="header">
              <h2 class="org-title">Damaan Business Group ERP</h2>
              <h1 class="cert-title">Certificate of Incorporation</h1>
            </div>
            <div class="grid">
              <div class="card">
                <div class="card-title">Company & Owner Info</div>
                <div class="field"><div class="label">Company Name</div><div class="value">${c.companyName}</div></div>
                <div class="field"><div class="label">Owner Name</div><div class="value">${c.ownerName}</div></div>
              </div>
              <div class="card">
                <div class="card-title">Location & Contact</div>
                <div class="field"><div class="label">Address</div><div class="value">${c.address || "-"}</div></div>
                <div class="field"><div class="label">Jurisdiction</div><div class="value">${[c.city, c.state, c.country].filter(Boolean).join(", ")}</div></div>
              </div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;
    printStore.openPrint(html, `Certificate of Incorporation - ${c.companyName}`);
  }

  return (
    <div className="space-y-5 text-slate-900 dark:text-slate-100">

      {/* Top Header Bar with Back Button, Popover Filter Curtain, and Incorporate Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Settings / Company</span>
            <h1 className="text-xl font-black tracking-tight">Company Management Registry</h1>
            <p className="text-xs text-slate-500 font-medium">Manage incorporated business entities, owners, registration numbers, and locations.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReportFilterBar
            lang={lang}
            filters={filters}
            onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
            onReset={() => setFilters({ countryId: "all", mainBranchId: "all", branchId: "all", fromDate: "", toDate: "", currency: "USD", userId: "all", reportType: "company" })}
            onApply={loadCompaniesFromDb}
            countries={[{ id: "pk", name: "Pakistan" }, { id: "uae", name: "UAE" }]}
            mainBranches={[]}
            cityBranches={[]}
          />

          <Button
            type="button"
            onClick={() => router.push("/dashboard/settings/company-setup" as Route)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-4 rounded-xl text-xs shadow-md"
          >
            <Plus className="h-4 w-4" />
            + {th("INCORPORATE NEW COMPANY")}
          </Button>
        </div>
      </div>

      {/* STANDARDIZED 5 KPI SUMMARY CARDS GRID */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* MANDATORY Card 1: BRANCH & USER DETAILS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. {th("BRANCH & USER DETAILS")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{th("COUNTRY")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">Pakistan</span>
            </div>
            <div className="flex justify-between">
              <span>{th("BRANCH NAME")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">Karachi Main</span>
            </div>
            <div className="flex justify-between">
              <span>{th("USER ID / NAME")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px]" title="USR-001 (Admin User)">USR-001 (Admin)</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{th("STATUS")}:</span>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px]">{th("ACTIVE SESSION")}</span>
            </div>
          </div>
        </div>

        {/* Card 2: INCORPORATED COMPANIES SUMMARY */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2. {th("COMPANIES SUMMARY")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{th("TOTAL INCORPORATED")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{stats.total}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{th("TOTAL OWNERS")}:</span>
              <span>{stats.totalOwners}</span>
            </div>
          </div>
        </div>

        {/* Card 3: OWNER & ENTITY BREAKDOWN */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Layers className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. {th("OWNER BREAKDOWN")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-indigo-600 font-bold">
              <span>{th("MULTI-COMPANY OWNERS")}:</span>
              <span>{stats.multiCompanyOwners}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{th("SINGLE OWNERS")}:</span>
              <span>{stats.totalOwners - stats.multiCompanyOwners}</span>
            </div>
          </div>
        </div>

        {/* Card 4: BRANCHES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">4. {th("BRANCHES")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{th("TOTAL BRANCHES")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">12</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{th("ACTIVE BRANCHES")}:</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* Card 5: QUICK INFO */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">5. {th("QUICK INFO")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{th("CURRENCY")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">USD</span>
            </div>
            <div className="flex justify-between">
              <span>{th("COMPANY")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px]">DGT LLC</span>
            </div>
            <div className="flex justify-between">
              <span>{th("FINANCIAL YEAR")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">2025-26</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by owner name, company name, city, country..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 text-xs font-bold bg-white text-slate-900 border-slate-200 shadow-sm rounded-xl"
        />
      </div>

      {/* Main Table with Owner Name & Company Count Column */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-wider border-b border-slate-200 dark:bg-slate-950/60 dark:border-slate-800">
              <tr>
                <Th className="px-4 py-3.5">SR#</Th>
                <Th className="px-4 py-3.5">Owner Name (اونر کا نام)</Th>
                <Th className="px-4 py-3.5 text-center">Company Count (تعداد)</Th>
                <Th className="px-4 py-3.5">Company / Business Name</Th>
                <Th className="px-4 py-3.5">Country</Th>
                <Th className="px-4 py-3.5">State / Province</Th>
                <Th className="px-4 py-3.5">City</Th>
                <Th className="px-4 py-3.5 text-center">Contacts & Regs</Th>
                <Th className="px-4 py-3.5 text-end">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400 font-medium">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600 mb-2" />
                    Loading companies registry from database...
                  </td>
                </tr>
              ) : paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400 font-semibold">
                    No incorporated companies found matching query filters.
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((c, idx) => {
                  const ownerKey = (c.ownerName || "Unknown Owner").trim().toUpperCase();
                  const ownerCompanies = ownerGroupedMap.get(ownerKey) || [c];
                  const companyCount = ownerCompanies.length;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-slate-400 font-bold">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => setSelectedOwnerGroup({ ownerName: c.ownerName, companies: ownerCompanies })}
                          className="hover:underline text-blue-600 dark:text-blue-400 text-left font-black"
                        >
                          {c.ownerName}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedOwnerGroup({ ownerName: c.ownerName, companies: ownerCompanies })}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-black transition",
                            companyCount > 1
                              ? "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          )}
                        >
                          {companyCount} {companyCount === 1 ? "Company" : "Companies"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                        {c.companyName}
                        {c.businessName && c.businessName !== "-" && c.businessName !== c.companyName ? (
                          <span className="block text-[10px] text-slate-400 font-normal">{c.businessName}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-bold">{c.country || "-"}</td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">{c.state || "-"}</td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">{c.city || "-"}</td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {c.contacts.length} C / {c.registrations.length} R
                      </td>
                      <td className="px-4 py-3.5 text-end">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === c.id ? null : c.id);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openMenuId === c.id && (
                            <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold shadow-xl dark:border-slate-800 dark:bg-slate-900">
                              <button
                                onClick={() => setSelectedOwnerGroup({ ownerName: c.ownerName, companies: ownerCompanies })}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Eye className="h-4 w-4 text-purple-500" /> View Owner Companies ({companyCount})
                              </button>
                              <button
                                onClick={() => handlePrint(c)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Printer className="h-4 w-4 text-blue-500" /> Print Certificate
                              </button>
                              <button
                                onClick={() => router.push(`/dashboard/settings/company-setup?companyId=${c.id}` as Route)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <PencilLine className="h-4 w-4 text-emerald-500" /> Edit Company
                              </button>
                              <button
                                onClick={() => handleDelete(c.id)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-4 w-4" /> Delete Entity
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standardized Pagination */}
      <ReportPagination
        totalCount={filteredCompanies.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Standardized Status Legend */}
      <ReportStatusLegend
        statuses={["Active", "Incorporated", "Multi-Company Owner"]}
        notes={[
          "Owners with multiple incorporated companies can be inspected by clicking their Owner Name or Company Count badge.",
          "Certificates of Incorporation can be printed directly via the 3-dot action menu."
        ]}
      />

      {/* OWNER COMPANIES DRAWER / MODAL */}
      {selectedOwnerGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Multi-Company Owner Profile</span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Owner: {selectedOwnerGroup.ownerName}
                </h2>
                <p className="text-xs font-medium text-slate-500">Total Registered Companies: {selectedOwnerGroup.companies.length}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOwnerGroup(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedOwnerGroup.companies.map((comp, idx) => (
                <div key={comp.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{comp.companyName}</h4>
                    </div>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">{[comp.city, comp.state, comp.country].filter(Boolean).join(", ")}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">{comp.address || "No address specified"}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrint(comp)}
                      className="h-8 text-xs font-bold border-slate-200"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1 text-blue-500" /> Certificate
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/dashboard/settings/company-setup?companyId=${comp.id}` as Route)}
                      className="h-8 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <PencilLine className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
